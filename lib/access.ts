import { FeaturePermission, Role, RolePermission } from '../types';

export const ALL_ROLES: Role[] = ['admin', 'branch', 'supervisor', 'warehouse', 'accounts', 'owner', 'manager'];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager (Legacy)',
  accounts: 'Accounts',
  supervisor: 'Supervisor',
  warehouse: 'Warehouse',
  branch: 'Branch'
};

/** Admin is the full-control project role; manager is kept as a legacy alias during migration. */
export const isAdminRole = (role?: Role | string | null): boolean =>
  role === 'admin' || role === 'manager';

/** Backward-compatible name for older modules. */
export const isManagerRole = isAdminRole;

/** Roles that may read data across all branches. */
export const isCrossBranchRole = (role?: Role | string | null): boolean =>
  isAdminRole(role) || role === 'owner' || role === 'warehouse';

/** Roles whose identity is not a single branch (synthetic identity users). */
export const isIdentityRole = (role?: Role | string | null): boolean => role !== 'branch';

export type AccessLevel = 'edit' | 'read' | 'none';

/**
 * Effective feature access: branch/user override -> role default -> none.
 * Admins always have edit access.
 */
export const resolveAccessLevel = (
  feature: string,
  role: Role | undefined,
  overrides: FeaturePermission[] | undefined,
  roleDefaults: RolePermission[] | undefined
): AccessLevel => {
  if (isAdminRole(role)) return 'edit';
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
