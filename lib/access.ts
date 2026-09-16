import { FeaturePermission, Role, RolePermission } from '../types';

export const ALL_ROLES: Role[] = ['admin', 'branch', 'supervisor', 'warehouse', 'accounts', 'owner', 'manager', 'driver'];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner / Read-only Executive',
  admin: 'Admin',
  manager: 'Manager (Legacy)',
  accounts: 'Accounts',
  supervisor: 'Supervisor',
  warehouse: 'Warehouse',
  branch: 'Branch',
  driver: 'Driver'
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

export type PermissionLike = {
  featureName: string;
  accessLevel: 'read' | 'edit' | 'none';
  role?: Role;
};

/**
 * Effective feature & sub-tool access with 4-tier zero-conflict resolution:
 * 1. Explicit User/Branch Sub-Feature Override  (e.g., user: 'operational_expenses:new-expense' => 'none')
 * 2. Explicit User/Branch Module Override       (e.g., user: 'operational_expenses' => 'edit')
 * 3. Standard Role Sub-Feature Default          (e.g., role: 'branch' + 'operational_expenses:new-expense')
 * 4. Standard Role Module Default               (e.g., role: 'branch' + 'operational_expenses')
 *
 * Admins always have edit access. Owner role 'edit' permissions are capped at 'read'.
 */
export const resolveAccessLevel = (
  feature: string,
  role: Role | undefined,
  overrides: PermissionLike[] | undefined,
  roleDefaults: (RolePermission | PermissionLike)[] | undefined
): AccessLevel => {
  if (isAdminRole(role)) return 'edit';

  const isSubFeature = feature.includes(':');
  const parentModule = isSubFeature ? feature.split(':')[0] : feature;

  // 1. Explicit User/Branch Sub-Feature Override
  if (isSubFeature && overrides) {
    const subOverride = overrides.find(p => p.featureName === feature);
    if (subOverride && subOverride.accessLevel) {
      return role === 'owner' && subOverride.accessLevel === 'edit' ? 'read' : subOverride.accessLevel;
    }
  }

  // 2. Explicit User/Branch Module Override
  if (overrides) {
    const moduleOverride = overrides.find(p => p.featureName === parentModule);
    if (moduleOverride && moduleOverride.accessLevel) {
      return role === 'owner' && moduleOverride.accessLevel === 'edit' ? 'read' : moduleOverride.accessLevel;
    }
  }

  // 3. Standard Role Sub-Feature Default
  if (isSubFeature && roleDefaults) {
    const roleSubDefault = roleDefaults.find(p => p.featureName === feature && (p.role ? p.role === role : true));
    if (roleSubDefault && roleSubDefault.accessLevel) {
      return role === 'owner' && roleSubDefault.accessLevel === 'edit' ? 'read' : roleSubDefault.accessLevel;
    }
  }

  // 4. Standard Role Module Default
  if (roleDefaults) {
    const roleModuleDefault = roleDefaults.find(p => p.featureName === parentModule && (p.role ? p.role === role : true));
    if (roleModuleDefault && roleModuleDefault.accessLevel) {
      return role === 'owner' && roleModuleDefault.accessLevel === 'edit' ? 'read' : roleModuleDefault.accessLevel;
    }
  }

  return 'none';
};

/** Convenience checker mirroring the legacy checkPermission(feature) boolean style with sub-tool support. */
export const buildPermissionChecker = (
  role: Role | undefined,
  overrides: PermissionLike[] | undefined,
  roleDefaults: (RolePermission | PermissionLike)[] | undefined
) => (feature: string, minimum: AccessLevel = 'read'): boolean => {
  const level = resolveAccessLevel(feature, role, overrides, roleDefaults);
  if (minimum === 'edit') return level === 'edit';
  return level !== 'none';
};

