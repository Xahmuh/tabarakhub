import { Role } from '../types';
import { ROLE_LABELS } from './access';

export interface CustomRoleDefinition {
  id: string;
  label: string;
  description?: string;
  badgeClass?: string;
  isSystem?: boolean;
}

export const SYSTEM_ROLES: CustomRoleDefinition[] = [
  { id: 'admin', label: 'Admin', isSystem: true, badgeClass: 'border-brand/15 bg-brand/5 text-brand' },
  { id: 'owner', label: 'Owner / Executive', isSystem: true, badgeClass: 'border-violet-200 bg-violet-50 text-violet-700' },
  { id: 'branch', label: 'Branch', isSystem: true, badgeClass: 'border-slate-200 bg-slate-50 text-slate-700' },
  { id: 'supervisor', label: 'Supervisor', isSystem: true, badgeClass: 'border-blue-200 bg-blue-50 text-blue-700' },
  { id: 'warehouse', label: 'Warehouse', isSystem: true, badgeClass: 'border-amber-200 bg-amber-50 text-amber-700' },
  { id: 'accounts', label: 'Accounts', isSystem: true, badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  { id: 'driver', label: 'Driver', isSystem: true, badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
  { id: 'worker', label: 'Worker', isSystem: true, badgeClass: 'border-orange-200 bg-orange-50 text-orange-700' }
];

const CUSTOM_ROLES_STORAGE_KEY = 'tabarak_custom_roles';

export const getCustomRoles = (): CustomRoleDefinition[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_ROLES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveCustomRoles = (roles: CustomRoleDefinition[]): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CUSTOM_ROLES_STORAGE_KEY, JSON.stringify(roles));
};

export const getAllRoleDefinitions = (): CustomRoleDefinition[] => {
  const custom = getCustomRoles();
  return [...SYSTEM_ROLES, ...custom];
};

export const getAllRoleIds = (): string[] => {
  return getAllRoleDefinitions().map(r => r.id);
};

export const getRoleLabel = (role: string): string => {
  const all = getAllRoleDefinitions();
  const found = all.find(r => r.id === role);
  if (found) return found.label;
  if (ROLE_LABELS[role as Role]) return ROLE_LABELS[role as Role];
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export const getRoleBadgeClass = (role: string): string => {
  const all = getAllRoleDefinitions();
  const found = all.find(r => r.id === role);
  if (found && found.badgeClass) return found.badgeClass;
  return 'border-purple-200 bg-purple-50 text-purple-700';
};
