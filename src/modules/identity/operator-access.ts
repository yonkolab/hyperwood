export const operatorPermissions = [
  'operations:read',
  'operations:scan',
  'markets:write',
  'markets:settle',
  'compliance:write',
  'funding:approve',
  'funding:reconcile',
  'exchange:write',
  'identity:link',
] as const;

export type OperatorPermission = (typeof operatorPermissions)[number];

export const operatorRoles = [
  'super_admin',
  'operations_reader',
  'operations_scanner',
  'market_writer',
  'market_settler',
  'compliance_admin',
  'funding_approver',
  'funding_reconciler',
  'exchange_admin',
  'identity_admin',
] as const;

export type OperatorRole = (typeof operatorRoles)[number];

const operatorRolePermissions: Record<OperatorRole, OperatorPermission[]> = {
  super_admin: [...operatorPermissions],
  operations_reader: ['operations:read'],
  operations_scanner: ['operations:scan'],
  market_writer: ['markets:write'],
  market_settler: ['markets:settle'],
  compliance_admin: ['compliance:write'],
  funding_approver: ['funding:approve'],
  funding_reconciler: ['funding:reconcile'],
  exchange_admin: ['exchange:write'],
  identity_admin: ['identity:link'],
};

export function resolveOperatorPermissions(roles: OperatorRole[]) {
  return Array.from(
    new Set(roles.flatMap((role) => operatorRolePermissions[role] ?? [])),
  ).sort();
}

export function formatInternalActor(input: {
  authSource: 'bootstrap' | 'operator_token';
  displayName: string | null;
  email: string | null;
}) {
  if (input.authSource === 'bootstrap') {
    return 'bootstrap';
  }

  if (input.displayName && input.email) {
    return `${input.displayName} <${input.email}>`;
  }

  if (input.email) {
    return input.email;
  }

  return 'operator';
}
