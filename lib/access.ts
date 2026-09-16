import { FeaturePermission, Role, RolePermission } from '../types';

export const ALL_ROLES: Role[] = ['admin', 'owner', 'branch', 'supervisor', 'warehouse', 'accounts', 'driver', 'worker'];

const BASE_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  owner: 'Owner / Executive',
  branch: 'Branch',
  supervisor: 'Supervisor',
  warehouse: 'Warehouse',
  accounts: 'Accounts',
  driver: 'Driver',
  worker: 'Worker'
};

export const ROLE_LABELS: Record<Role, string> = new Proxy(BASE_ROLE_LABELS, {
  get(target, prop: string) {
    if (prop in target) return target[prop];
    if (typeof prop === 'string') {
      return prop.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    return prop;
  }
}) as Record<Role, string>;

/** Admin is full-control executive role; manager is kept as a legacy alias during migration. */
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
 * Effective feature access: branch/user override -> role default -> child override bubble-up -> none.
 * Admins always have edit access.
 *
 * Child → Parent bubble-up: if no explicit parent override/default exists but the user has
 * an override on any child (e.g. products:catalogue=read), the parent ('products') resolves to
 * the best child access level. This allows users with only sub-feature grants to see the module.
 */
export const resolveAccessLevel = (
  feature: string,
  role: Role | undefined,
  overrides: FeaturePermission[] | undefined,
  roleDefaults: RolePermission[] | undefined
): AccessLevel => {
  if (isAdminRole(role)) return 'edit';

  // 1. Explicit user override for this feature takes highest precedence
  const override = overrides?.find(p => p.featureName === feature);
  if (override) return override.accessLevel;

  // Hard boundary: Branch role must never access payroll
  if (role === 'branch' && (feature === 'payroll' || feature === 'driver_payroll' || feature === 'driver-payroll' || feature.startsWith('payroll:'))) {
    return 'none';
  }

  // Hard boundary: Branch role access for Operational Cash Expenses
  if (role === 'branch') {
    if (feature === 'operational_expenses' || feature === 'operational-expenses' || feature === 'operationalExpenses') {
      return 'edit';
    }
    if (feature === 'operational_expenses:new-expense' || feature === 'operational_expenses:expenses') {
      return 'edit';
    }
    if (feature === 'operational_expenses:dashboard' || feature === 'operational_expenses:reports') {
      return 'read';
    }
    if (
      feature === 'operational_expenses:vehicle-actions' ||
      feature === 'operational_expenses:fuel-leaderboard' ||
      feature === 'operational_expenses:vehicles'
    ) {
      return 'none';
    }
    if (feature.startsWith('operational_expenses:')) {
      return 'edit';
    }
  }

  // 2. Role default for this feature
  const roleDefault = roleDefaults?.find(p => (!p.role || p.role === role) && p.featureName === feature);
  if (roleDefault) return roleDefault.accessLevel;

  // Fallback for Owner / Executive on Owner Dashboard
  if (role === 'owner' && (feature === 'owner_dashboard' || feature === 'owner-dashboard')) {
    return 'read';
  }

  // 3. Sub-feature: fall back to parent
  if (feature.includes(':')) {
    const parentFeature = feature.split(':')[0];
    return resolveAccessLevel(parentFeature, role, overrides, roleDefaults);
  }

  // 4. Parent feature with no direct override: bubble up from any child override.
  //    e.g. if user has products:catalogue=read but no products row, expose the module.
  if (overrides && overrides.length > 0) {
    const childOverrides = overrides.filter(
      p => p.featureName.startsWith(`${feature}:`) && p.accessLevel !== 'none'
    );
    if (childOverrides.length > 0) {
      return childOverrides.some(p => p.accessLevel === 'edit') ? 'edit' : 'read';
    }
  }

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
