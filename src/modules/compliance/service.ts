import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  accountRestrictions,
  complianceProfiles,
  users,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import { getSupportedPaymentMethodsForCountry } from '../funding/policy';
import { AdminAuditService } from '../operations/audit';
import type {
  ApplyAccountRestrictionInput,
  CapabilityEvaluation,
  CapabilityName,
  FundingRail,
  UpsertComplianceProfileInput,
} from './types';

const RESTRICTED_JURISDICTIONS = new Set(['CU', 'IR', 'KP', 'SY']);

export class ComplianceService {
  private readonly adminAuditService = new AdminAuditService();

  async upsertComplianceProfile(input: UpsertComplianceProfileInput) {
    const [user] = await db
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    if (!user) {
      throw new AppError(404, 'user_not_found', 'user was not found');
    }

    const now = new Date();

    await db
      .insert(complianceProfiles)
      .values({
        userId: input.userId,
        countryCode: input.countryCode.toUpperCase(),
        jurisdictionCode: input.jurisdictionCode.toUpperCase(),
        legalEntity: input.legalEntity,
        kycStatus: input.kycStatus,
        sanctionsStatus: input.sanctionsStatus,
        kycProvider: input.kycProvider,
        providerReference: input.providerReference,
        ageVerifiedAt: input.ageVerified ? now : null,
        metadata: input.metadata ?? {},
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: complianceProfiles.userId,
        set: {
          countryCode: input.countryCode.toUpperCase(),
          jurisdictionCode: input.jurisdictionCode.toUpperCase(),
          legalEntity: input.legalEntity,
          kycStatus: input.kycStatus,
          sanctionsStatus: input.sanctionsStatus,
          kycProvider: input.kycProvider,
          providerReference: input.providerReference,
          ageVerifiedAt: input.ageVerified ? now : null,
          metadata: input.metadata ?? {},
          updatedAt: now,
        },
      });

    await db
      .update(users)
      .set({
        kycStatus: input.kycStatus,
        region: input.jurisdictionCode.toUpperCase(),
        updatedAt: now,
      })
      .where(eq(users.id, input.userId));

    await this.adminAuditService.recordEvent({
      action: 'compliance.profile_upserted',
      actor: input.changedBy ?? 'bootstrap',
      targetType: 'user',
      targetId: input.userId,
      payload: {
        countryCode: input.countryCode.toUpperCase(),
        jurisdictionCode: input.jurisdictionCode.toUpperCase(),
        legalEntity: input.legalEntity,
        kycStatus: input.kycStatus,
        sanctionsStatus: input.sanctionsStatus,
        ageVerified: input.ageVerified,
      },
    });

    return this.getCapabilityEvaluation(input.userId);
  }

  async applyAccountRestriction(input: ApplyAccountRestrictionInput) {
    const [user] = await db
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    if (!user) {
      throw new AppError(404, 'user_not_found', 'user was not found');
    }

    const insertedRows = await db
      .insert(accountRestrictions)
      .values({
        userId: input.userId,
        scope: input.scope,
        reason: input.reason,
        source: input.source,
        expiresAt: input.expiresAt,
      })
      .returning();

    await this.adminAuditService.recordEvent({
      action: 'compliance.restriction_applied',
      actor: input.changedBy ?? 'bootstrap',
      targetType: 'user',
      targetId: input.userId,
      payload: {
        scope: input.scope,
        reason: input.reason,
        source: input.source,
        expiresAt: input.expiresAt?.toISOString() ?? null,
      },
    });

    return {
      restriction: insertedRows[0],
    };
  }

  async getCapabilityEvaluation(userId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new AppError(404, 'user_not_found', 'user was not found');
    }

    const [profile] = await db
      .select()
      .from(complianceProfiles)
      .where(eq(complianceProfiles.userId, userId))
      .limit(1);

    const restrictions = await db
      .select()
      .from(accountRestrictions)
      .where(
        and(
          eq(accountRestrictions.userId, userId),
          isNull(accountRestrictions.resolvedAt),
          or(
            isNull(accountRestrictions.expiresAt),
            gt(accountRestrictions.expiresAt, new Date()),
          ),
        ),
      );

    const trading = this.evaluateCapability({
      capability: 'trading',
      userStatus: user.status,
      profile,
      restrictions,
    });
    const funding = this.evaluateCapability({
      capability: 'funding',
      userStatus: user.status,
      profile,
      restrictions,
    });
    const withdrawal = this.evaluateCapability({
      capability: 'withdrawal',
      userStatus: user.status,
      profile,
      restrictions,
    });

    return {
      userId,
      profile: profile ?? null,
      restrictions,
      capabilities: {
        trading,
        funding,
        withdrawal,
      },
      fundingMethods:
        funding.allowed && profile
          ? this.getFundingMethods(profile.countryCode)
          : [],
    };
  }

  private evaluateCapability(input: {
    capability: CapabilityName;
    userStatus: typeof users.$inferSelect.status;
    profile: typeof complianceProfiles.$inferSelect | undefined;
    restrictions: Array<typeof accountRestrictions.$inferSelect>;
  }): CapabilityEvaluation {
    const reasons: string[] = [];

    if (input.userStatus !== 'active') {
      reasons.push('account_not_active');
    }

    if (!input.profile) {
      reasons.push('missing_compliance_profile');
    } else {
      if (RESTRICTED_JURISDICTIONS.has(input.profile.jurisdictionCode)) {
        reasons.push('restricted_jurisdiction');
      }

      if (input.profile.kycStatus !== 'approved') {
        reasons.push(`kyc_${input.profile.kycStatus}`);
      }

      if (input.profile.sanctionsStatus !== 'clear') {
        reasons.push(`sanctions_${input.profile.sanctionsStatus}`);
      }

      if (!input.profile.ageVerifiedAt) {
        reasons.push('age_not_verified');
      }
    }

    for (const restriction of input.restrictions) {
      if (
        restriction.scope === 'all' ||
        restriction.scope === input.capability
      ) {
        reasons.push(`restriction_${restriction.scope}`);
      }
    }

    return {
      allowed: reasons.length === 0,
      reasons,
    };
  }

  private getFundingMethods(countryCode: string): FundingRail[] {
    return getSupportedPaymentMethodsForCountry(countryCode);
  }
}
