import { supabaseClient } from '../lib/supabaseClient';
import { AppUser, BranchStaffAssignment, BranchZone, FeaturePermission, Role, RolePermission, SupervisorScopeMode, UserFeaturePermission } from '../types';

export type AdminCreateUserInput = {
  email: string;
  password: string;
  role: Role;
  branchId?: string | null;
  driverId?: string | null;
  supervisorZoneIds?: string[];
  isActive?: boolean;
};

const parseFunctionErrorBody = async (error: any): Promise<string | null> => {
  const response = error?.context;
  if (!response || typeof response.clone !== 'function') return null;

  try {
    const text = await response.clone().text();
    if (!text) return null;

    try {
      const parsed = JSON.parse(text);
      if (typeof parsed?.error === 'string' && parsed.error.trim()) return parsed.error.trim();
      if (typeof parsed?.message === 'string' && parsed.message.trim()) return parsed.message.trim();
    } catch {
      return text.trim();
    }
  } catch {
    return null;
  }

  return null;
};

const throwFunctionError = async (error: any, fallback: string): Promise<never> => {
  const serverMessage = await parseFunctionErrorBody(error);
  const message = String(error?.message || '');

  if (message.toLowerCase().includes('failed to send a request to the edge function')) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const originHint = origin ? ` Current origin: ${origin}.` : '';
    throw new Error(
      `Could not reach the user-management Edge Function.${originHint} ` +
      'If you are testing from localhost or a preview URL, open the production domain or add this origin to Supabase ALLOWED_ORIGIN / CLIENT_APP_URL.'
    );
  }

  throw new Error(serverMessage || error?.message || fallback);
};

export const permissionService = {
  listForBranch: async (branchId: string) => {
    const { data, error } = await supabaseClient.from('feature_permissions').select('*').eq('branch_id', branchId);
    if (error) return [];
    return data.map(p => ({
      id: p.id,
      branchId: p.branch_id,
      featureName: p.feature_name,
      accessLevel: p.access_level
    })) as FeaturePermission[];
  },
  upsert: async (permission: Partial<FeaturePermission>) => {
    const payload = {
      branch_id: permission.branchId,
      feature_name: permission.featureName,
      access_level: permission.accessLevel
    };
    const { data, error } = await supabaseClient.from('feature_permissions').upsert([payload], { onConflict: 'branch_id,feature_name' }).select().single();
    if (error) throw error;
    return data;
  },
  deleteForBranch: async (branchId: string, featureName: string) => {
    const { error } = await supabaseClient
      .from('feature_permissions')
      .delete()
      .eq('branch_id', branchId)
      .eq('feature_name', featureName);
    if (error) throw error;
    return true;
  },

  // --- Role-level defaults (effective when no branch override exists) ---
  listRoleDefaults: async (role: Role): Promise<RolePermission[]> => {
    const { data, error } = await supabaseClient
      .from('role_permissions')
      .select('role, feature_name, access_level')
      .eq('role', role);
    if (error) return [];
    return (data || []).map(p => ({
      role: p.role,
      featureName: p.feature_name,
      accessLevel: p.access_level
    }));
  },
  listAllRoleDefaults: async (): Promise<RolePermission[]> => {
    const { data, error } = await supabaseClient
      .from('role_permissions')
      .select('role, feature_name, access_level');
    if (error) return [];
    return (data || []).map(p => ({
      role: p.role,
      featureName: p.feature_name,
      accessLevel: p.access_level
    }));
  },
  upsertRoleDefault: async (permission: RolePermission) => {
    const { error } = await supabaseClient
      .from('role_permissions')
      .upsert(
        [{ role: permission.role, feature_name: permission.featureName, access_level: permission.accessLevel, updated_at: new Date().toISOString() }],
        { onConflict: 'role,feature_name' }
      );
    if (error) throw error;
    return true;
  },
  listForUser: async (userId: string): Promise<FeaturePermission[]> => {
    const { data, error } = await supabaseClient
      .from('app_user_feature_permissions')
      .select('user_id, feature_name, access_level')
      .eq('user_id', userId);
    if (error) return [];
    return (data || []).map(p => ({
      id: `${p.user_id}:${p.feature_name}`,
      branchId: `user:${p.user_id}`,
      featureName: p.feature_name,
      accessLevel: p.access_level
    })) as FeaturePermission[];
  },
  listRawForUser: async (userId: string): Promise<UserFeaturePermission[]> => {
    const { data, error } = await supabaseClient
      .from('app_user_feature_permissions')
      .select('user_id, feature_name, access_level')
      .eq('user_id', userId);
    if (error) return [];
    return (data || []).map(p => ({
      userId: p.user_id,
      featureName: p.feature_name,
      accessLevel: p.access_level
    }));
  },
  replaceUserPermissions: async (userId: string, permissions: Array<Pick<UserFeaturePermission, 'featureName' | 'accessLevel'>>) => {
    const { error: deleteError } = await supabaseClient
      .from('app_user_feature_permissions')
      .delete()
      .eq('user_id', userId);
    if (deleteError) throw deleteError;

    if (permissions.length === 0) return true;

    const rows = permissions.map(permission => ({
      user_id: userId,
      feature_name: permission.featureName,
      access_level: permission.accessLevel,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabaseClient
      .from('app_user_feature_permissions')
      .insert(rows);
    if (error) throw error;
    return true;
  },

  // --- User & role administration (admin-guarded security definer RPCs/functions) ---
  adminListUsers: async (): Promise<AppUser[]> => {
    const { data, error } = await supabaseClient.rpc('app_admin_list_users');
    if (error) throw error;
    return (data || []).map((u: any) => ({
      userId: u.user_id,
      email: u.email,
      role: u.role,
      branchId: u.branch_id,
      branchCode: u.branch_code,
      branchName: u.branch_name,
      supervisorScopeMode: u.supervisor_scope_mode || (u.role === 'supervisor' ? 'assigned_zones' : null),
      isActive: u.is_active,
      createdAt: u.created_at
    }));
  },
  adminSetUserRole: async (userId: string, role: Role, branchId?: string | null, isActive = true) => {
    const { error } = await supabaseClient.rpc('app_admin_set_user_role', {
      target_user_id: userId,
      new_role: role,
      new_branch_id: branchId ?? null,
      new_is_active: isActive
    });
    if (error) throw error;
    return true;
  },
  adminSetSupervisorScopeMode: async (userId: string, scopeMode: SupervisorScopeMode) => {
    const { error } = await supabaseClient.rpc('app_admin_set_supervisor_scope_mode', {
      target_user_id: userId,
      new_scope_mode: scopeMode
    });
    if (error) throw error;
    return true;
  },
  adminLinkDriverUser: async (userId: string, driverId: string): Promise<boolean> => {
    const { error: unlinkError } = await supabaseClient
      .from('delivery_drivers')
      .update({ auth_user_id: null, updated_at: new Date().toISOString() })
      .eq('auth_user_id', userId);
    if (unlinkError) throw unlinkError;

    const { error } = await supabaseClient
      .from('delivery_drivers')
      .update({ auth_user_id: userId, updated_at: new Date().toISOString() })
      .eq('id', driverId);
    if (error) throw error;
    return true;
  },
  adminCreateUser: async (input: AdminCreateUserInput): Promise<AppUser> => {
    const { data, error } = await supabaseClient.functions.invoke('admin-create-user', {
      body: {
        ...input,
        supervisorZoneIds: undefined,
        supervisorBranchIds: []
      }
    });
    if (error) await throwFunctionError(error, 'Could not create the user.');
    if (data?.error) throw new Error(data.error);
    const user = data?.user;
    if (!user) throw new Error('User was created but no user payload was returned.');
    if (input.role === 'supervisor' && input.supervisorZoneIds && input.supervisorZoneIds.length > 0) {
      await permissionService.setSupervisorZones(user.userId, input.supervisorZoneIds);
    }
    return user as AppUser;
  },
  adminDeleteUser: async (userId: string): Promise<boolean> => {
    const { data, error } = await supabaseClient.functions.invoke('admin-delete-user', {
      body: { userId }
    });
    if (error) await throwFunctionError(error, 'Could not delete the user.');
    if (data?.error) throw new Error(data.error);
    return true;
  },
  adminResetUserPassword: async (userId: string, password: string): Promise<boolean> => {
    const { data, error } = await supabaseClient.functions.invoke('admin-reset-user-password', {
      body: { userId, password }
    });
    if (error) await throwFunctionError(error, 'Could not reset the user password.');
    if (data?.error) throw new Error(data.error);
    return true;
  },

  // --- Supervisor zone assignments ---
  listBranchZones: async (): Promise<BranchZone[]> => {
    const [{ data: zones, error: zoneError }, { data: members, error: memberError }] = await Promise.all([
      supabaseClient.from('branch_zones').select('*').order('name'),
      supabaseClient.from('branch_zone_members').select('zone_id, branch_id')
    ]);
    if (zoneError) throw zoneError;
    if (memberError) throw memberError;

    const branchIdsByZone = new Map<string, string[]>();
    (members || []).forEach(member => {
      const list = branchIdsByZone.get(member.zone_id) || [];
      list.push(member.branch_id);
      branchIdsByZone.set(member.zone_id, list);
    });

    return (zones || []).map(zone => ({
      id: zone.id,
      code: zone.code,
      name: zone.name,
      supervisorUserId: zone.supervisor_user_id,
      notes: zone.notes || undefined,
      isActive: zone.is_active,
      branchIds: branchIdsByZone.get(zone.id) || [],
      createdAt: zone.created_at,
      updatedAt: zone.updated_at
    }));
  },
  upsertBranchZone: async (zone: Partial<BranchZone>): Promise<BranchZone> => {
    const code = zone.code?.trim().toUpperCase();
    if (!code) throw new Error('Zone code is required.');
    if (!/^[A-Z0-9_-]{1,32}$/.test(code)) throw new Error('Zone code can only contain letters, numbers, underscore, or dash.');

    const payload: any = {
      code,
      name: zone.name?.trim(),
      supervisor_user_id: zone.supervisorUserId || null,
      notes: zone.notes?.trim() || null,
      is_active: zone.isActive ?? true,
      updated_at: new Date().toISOString()
    };
    if (zone.id) payload.id = zone.id;

    const { data, error } = await supabaseClient
      .from('branch_zones')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      code: data.code,
      name: data.name,
      supervisorUserId: data.supervisor_user_id,
      notes: data.notes || undefined,
      isActive: data.is_active,
      branchIds: zone.branchIds || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  },
  replaceBranchZoneBranches: async (zoneId: string, branchIds: string[]) => {
    const uniqueBranchIds = Array.from(new Set(branchIds.filter(Boolean)));

    if (uniqueBranchIds.length > 0) {
      const { error: moveError } = await supabaseClient
        .from('branch_zone_members')
        .delete()
        .in('branch_id', uniqueBranchIds);
      if (moveError) throw moveError;
    }

    const { error: clearError } = await supabaseClient
      .from('branch_zone_members')
      .delete()
      .eq('zone_id', zoneId);
    if (clearError) throw clearError;

    if (uniqueBranchIds.length > 0) {
      const { error } = await supabaseClient
        .from('branch_zone_members')
        .insert(uniqueBranchIds.map(branchId => ({ zone_id: zoneId, branch_id: branchId })));
      if (error) throw error;
    }

    const { error: syncError } = await supabaseClient.rpc('app_sync_supervisor_zone_access');
    if (syncError) throw syncError;
    return true;
  },
  setSupervisorZones: async (supervisorUserId: string, zoneIds: string[]) => {
    const { error: clearError } = await supabaseClient
      .from('branch_zones')
      .update({ supervisor_user_id: null, updated_at: new Date().toISOString() })
      .eq('supervisor_user_id', supervisorUserId);
    if (clearError) throw clearError;

    if (zoneIds.length > 0) {
      const { error } = await supabaseClient
        .from('branch_zones')
        .update({ supervisor_user_id: supervisorUserId, updated_at: new Date().toISOString() })
        .in('id', zoneIds);
      if (error) throw error;
    }

    const { error: syncError } = await supabaseClient.rpc('app_sync_supervisor_zone_access');
    if (syncError) throw syncError;
    return true;
  },

  // --- Branch staff assignments (Access-owned branch -> people/driver mapping) ---
  listBranchStaffAssignments: async (): Promise<BranchStaffAssignment[]> => {
    const [{ data: pharmacistRows, error: pharmacistError }, { data: driverRows, error: driverError }] = await Promise.all([
      supabaseClient.from('pharmacist_branches').select('branch_id, pharmacist_id'),
      supabaseClient.from('delivery_driver_branches').select('branch_id, driver_id')
    ]);
    if (pharmacistError) throw pharmacistError;
    if (driverError) throw driverError;

    const byBranch = new Map<string, BranchStaffAssignment>();
    const ensure = (branchId: string) => {
      const existing = byBranch.get(branchId);
      if (existing) return existing;
      const created = { branchId, pharmacistIds: [], driverIds: [] };
      byBranch.set(branchId, created);
      return created;
    };

    (pharmacistRows || []).forEach(row => {
      if (!row.branch_id || !row.pharmacist_id) return;
      ensure(row.branch_id).pharmacistIds.push(row.pharmacist_id);
    });

    (driverRows || []).forEach(row => {
      if (!row.branch_id || !row.driver_id) return;
      ensure(row.branch_id).driverIds.push(row.driver_id);
    });

    return Array.from(byBranch.values()).map(assignment => ({
      branchId: assignment.branchId,
      pharmacistIds: Array.from(new Set(assignment.pharmacistIds)),
      driverIds: Array.from(new Set(assignment.driverIds))
    }));
  },
  replaceBranchStaffAssignments: async (branchId: string, pharmacistIds: string[], driverIds: string[]) => {
    const uniquePharmacistIds = Array.from(new Set(pharmacistIds.filter(Boolean)));
    const uniqueDriverIds = Array.from(new Set(driverIds.filter(Boolean)));
    const { error } = await supabaseClient.rpc('app_replace_branch_staff_assignments', {
      p_branch_id: branchId,
      p_pharmacist_ids: uniquePharmacistIds,
      p_driver_ids: uniqueDriverIds
    });
    if (error) throw error;
    return true;
  }
};
