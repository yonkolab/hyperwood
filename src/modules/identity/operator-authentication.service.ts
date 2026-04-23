import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  operatorApiTokens,
  operatorPrincipals,
  operatorRoleAssignments,
} from '../../db/schema';
import { sha256Hex } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import {
  formatInternalActor,
  type OperatorPermission,
  type OperatorRole,
  resolveOperatorPermissions,
} from './operator-access';

export type AuthenticatedOperator = {
  id: string;
  email: string;
  displayName: string | null;
  roles: OperatorRole[];
  permissions: OperatorPermission[];
  tokenId: string;
};

export class OperatorAuthenticationService {
  /**
   * Resolve one operator token into an authenticated operator principal.
   *
   * Example:
   * `await operatorAuthenticationService.authenticateOperatorToken(rawToken, 'operations:read')`
   */
  async authenticateOperatorToken(
    rawToken: string,
    requiredPermission?: OperatorPermission,
  ): Promise<AuthenticatedOperator> {
    const tokenHash = sha256Hex(rawToken);
    const rows = await db
      .select({
        tokenId: operatorApiTokens.id,
        operatorId: operatorPrincipals.id,
        operatorEmail: operatorPrincipals.email,
        operatorDisplayName: operatorPrincipals.displayName,
        operatorStatus: operatorPrincipals.status,
      })
      .from(operatorApiTokens)
      .innerJoin(
        operatorPrincipals,
        eq(operatorPrincipals.id, operatorApiTokens.operatorId),
      )
      .where(
        and(
          eq(operatorApiTokens.tokenHash, tokenHash),
          isNull(operatorApiTokens.revokedAt),
        ),
      )
      .limit(1);
    const row = rows[0];

    if (!row) {
      throw new AppError(
        401,
        'invalid_operator_token',
        'operator token is invalid; expected a valid x-operator-token header',
      );
    }

    if (row.operatorStatus !== 'active') {
      throw new AppError(
        403,
        'operator_not_active',
        `operator "${row.operatorEmail}" is ${row.operatorStatus}; expected status "active"`,
      );
    }

    const roleRows = await db
      .select({
        role: operatorRoleAssignments.role,
      })
      .from(operatorRoleAssignments)
      .where(eq(operatorRoleAssignments.operatorId, row.operatorId));
    const roles = roleRows
      .map((roleRow) => roleRow.role as OperatorRole)
      .sort();
    const permissions = resolveOperatorPermissions(roles);

    if (requiredPermission && !permissions.includes(requiredPermission)) {
      throw new AppError(
        403,
        'insufficient_operator_permission',
        `operator "${row.operatorEmail}" is missing permission "${requiredPermission}"; expected one of [${permissions.join(', ')}]`,
      );
    }

    await db
      .update(operatorApiTokens)
      .set({
        lastUsedAt: new Date(),
      })
      .where(eq(operatorApiTokens.id, row.tokenId));

    return {
      id: row.operatorId,
      email: row.operatorEmail,
      displayName: row.operatorDisplayName,
      roles,
      permissions,
      tokenId: row.tokenId,
    };
  }

  formatActor(operator: Pick<AuthenticatedOperator, 'displayName' | 'email'>) {
    return formatInternalActor({
      authSource: 'operator_token',
      displayName: operator.displayName,
      email: operator.email,
    });
  }
}
