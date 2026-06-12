import { FeaturePermission, Role, RolePermission } from '../types';

export const ALL_ROLES: Role[] = ['owner', 'admin', 'manager', 'accounts', 'supervisor', 'warehouse', 'branch'];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  accounts: 'Accounts',
  supervisor: 'Supervisor',
  warehouse: 'Warehouse',
  branch: 'Branch'
};

/** Manager is the only role with full management control. */
export const isManagerRole = (role?: Role | string | null): boolean => role === 'manager';

/** Roles that may read data across all branches. */
export const isCrossBranchRole = (role?: Role | string | null): boolean =>
  role === 'manager' || role === 'owner' || role === 'warehouse';

/** Roles whose identity is not a single branch (synthetic identity users). */
export const isIdentityRole = (role?: Role | string | null): boolean => role !== 'branch';

export type AccessLevel = 'edit' | 'read' | 'none';

/**
 * Effective feature access: branch/user override -> role default -> none.
 * Managers always have edit access.
 */
export const resolveAccessLevel = (
  feature: string,
  role: Role | undefined,
  overrides: FeaturePermission[] | undefined,
  roleDefaults: RolePermission[] | undefined
): AccessLevel => {
  if (role === 'manager') return 'edit';
  const override = overrides?.find(p => p.featureName === feature);
  if (override) return override.accessLevel;
  const roleDefault = roleDefaults?.find(p => p.featureName === feature);
  if (roleDefault) return roleDefault.accessLevel;
  return 'none';
};

/** Convenience checker mirroring the legacy checkPermission(feature) boolean style. */
export const buildPermissionChecker = (
  role: Role | undefined,
  overrides: FeaturePermission[] | undefined,
  roleDefaults: RolePermission[] | undefined
) => (feature: string, minimum: AccessLevel = 'read'): boolean => {
  const level = resolveAccessLevel(feature, role, overrides, roleDefaults);
  if (minimum === 'edit') return level === 'edit';
  return level !== 'none';
};
