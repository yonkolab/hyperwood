import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  operatorApiTokens,
  operatorPrincipals,
  operatorRoleAssignments,
} from '../../db/schema';
import { createOpaqueToken, normalizeEmail, sha256Hex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import {
  formatInternalActor,
  type OperatorRole,
  resolveOperatorPermissions,
} from './operator-access';

export class OperatorPrincipalService {
  /**
   * Create one operator principal and assign the requested roles.
   *
   * Example:
   * `await operatorPrincipalService.createOperator({ email: 'ops@example.com', roles: ['operations_admin'] })`
   */
  async createOperator(input: {
    email: string;
    displayName?: string;
    roles: OperatorRole[];
  }) {
    const normalizedEmail = normalizeEmail(input.email);

    return db.transaction(async (tx) => {
      const existingRows = await tx
        .select({ id: operatorPrincipals.id })
        .from(operatorPrincipals)
        .where(eq(operatorPrincipals.email, normalizedEmail))
        .limit(1);

      if (existingRows[0]) {
        throw new AppError(
          409,
          'operator_email_conflict',
          `operator email "${normalizedEmail}" already exists; expected a unique operator email`,
        );
      }

      const createdRows = await tx
        .insert(operatorPrincipals)
        .values({
          email: normalizedEmail,
          displayName: input.displayName ?? null,
        })
        .returning();
      const created = createdRows[0];

      if (!created) {
        throw new AppError(
          500,
          'operator_creation_failed',
          `failed to create operator for email "${normalizedEmail}"`,
        );
      }

      await tx.insert(operatorRoleAssignments).values(
        input.roles.map((role) => ({
          operatorId: created.id,
          role,
        })),
      );

      return {
        operator: {
          id: created.id,
          email: created.email,
          displayName: created.displayName,
          status: created.status,
          roles: [...input.roles].sort(),
          permissions: resolveOperatorPermissions(input.roles),
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      };
    });
  }

  /**
   * Return operator principals with their roles and active token counts.
   *
   * Example:
   * `await operatorPrincipalService.listOperators({ limit: 20 })`
   */
  async listOperators(input: { limit: number }) {
    const operators = await db
      .select()
      .from(operatorPrincipals)
      .orderBy(desc(operatorPrincipals.createdAt))
      .limit(Math.min(input.limit, 100));

    if (operators.length === 0) {
      return {
        operators: [],
      };
    }

    const operatorIds = operators.map((operator) => operator.id);
    const [roles, activeTokens] = await Promise.all([
      db
        .select({
          operatorId: operatorRoleAssignments.operatorId,
          role: operatorRoleAssignments.role,
        })
        .from(operatorRoleAssignments)
        .where(inArray(operatorRoleAssignments.operatorId, operatorIds)),
      db
        .select({
          operatorId: operatorApiTokens.operatorId,
          tokenId: operatorApiTokens.id,
        })
        .from(operatorApiTokens)
        .where(
          and(
            inArray(operatorApiTokens.operatorId, operatorIds),
            isNull(operatorApiTokens.revokedAt),
          ),
        ),
    ]);

    const rolesByOperator = new Map<string, OperatorRole[]>();
    for (const row of roles) {
      const current = rolesByOperator.get(row.operatorId) ?? [];
      current.push(row.role as OperatorRole);
      rolesByOperator.set(row.operatorId, current);
    }

    const activeTokenCountByOperator = new Map<string, number>();
    for (const row of activeTokens) {
      activeTokenCountByOperator.set(
        row.operatorId,
        (activeTokenCountByOperator.get(row.operatorId) ?? 0) + 1,
      );
    }

    return {
      operators: operators.map((operator) => {
        const assignedRoles = (rolesByOperator.get(operator.id) ?? []).sort();

        return {
          id: operator.id,
          email: operator.email,
          displayName: operator.displayName,
          status: operator.status,
          actor: formatInternalActor({
            authSource: 'operator_token',
            displayName: operator.displayName,
            email: operator.email,
          }),
          roles: assignedRoles,
          permissions: resolveOperatorPermissions(assignedRoles),
          activeTokenCount: activeTokenCountByOperator.get(operator.id) ?? 0,
          createdAt: operator.createdAt.toISOString(),
          updatedAt: operator.updatedAt.toISOString(),
        };
      }),
    };
  }

  /**
   * Create one operator token and return the raw secret exactly once.
   *
   * Example:
   * `await operatorPrincipalService.createOperatorToken({ operatorId, label: 'cli' })`
   */
  async createOperatorToken(input: { operatorId: string; label: string }) {
    const [operator] = await db
      .select()
      .from(operatorPrincipals)
      .where(eq(operatorPrincipals.id, input.operatorId))
      .limit(1);

    if (!operator) {
      throw new AppError(
        404,
        'operator_not_found',
        `operator was not found: ${input.operatorId}`,
      );
    }

    if (operator.status !== 'active') {
      throw new AppError(
        409,
        'operator_not_active',
        `operator "${operator.email}" is ${operator.status}; expected status "active"`,
      );
    }

    const tokenPrefix = `hwo_${createOpaqueToken(6)}`;
    const rawToken = `${tokenPrefix}.${createOpaqueToken(24)}`;
    const tokenHash = sha256Hex(rawToken);

    const createdRows = await db
      .insert(operatorApiTokens)
      .values({
        operatorId: input.operatorId,
        label: input.label,
        tokenPrefix,
        tokenHash,
      })
      .returning();
    const created = createdRows[0];

    if (!created) {
      throw new AppError(
        500,
        'operator_token_creation_failed',
        `failed to create token for operator ${input.operatorId}`,
      );
    }

    return {
      token: {
        id: created.id,
        operatorId: created.operatorId,
        label: created.label,
        tokenPrefix: created.tokenPrefix,
        rawToken,
        createdAt: created.createdAt.toISOString(),
      },
    };
  }

  /**
   * Revoke one operator token so it can no longer authenticate internal routes.
   *
   * Example:
   * `await operatorPrincipalService.revokeOperatorToken({ tokenId })`
   */
  async revokeOperatorToken(input: { tokenId: string }) {
    const [token] = await db
      .select()
      .from(operatorApiTokens)
      .where(eq(operatorApiTokens.id, input.tokenId))
      .limit(1);

    if (!token) {
      throw new AppError(
        404,
        'operator_token_not_found',
        `operator token was not found: ${input.tokenId}`,
      );
    }

    if (token.revokedAt) {
      return {
        tokenId: token.id,
        revoked: true,
        alreadyRevoked: true,
      };
    }

    await db
      .update(operatorApiTokens)
      .set({
        revokedAt: new Date(),
      })
      .where(eq(operatorApiTokens.id, token.id));

    return {
      tokenId: token.id,
      revoked: true,
      alreadyRevoked: false,
    };
  }
}
