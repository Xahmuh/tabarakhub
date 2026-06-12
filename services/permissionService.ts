import { supabaseClient } from '../lib/supabaseClient';
import { AppUser, FeaturePermission, Role, RolePermission } from '../types';

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

  // --- User & role administration (manager-guarded security definer RPCs) ---
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

  // --- Supervisor branch assignments ---
  listSupervisorBranches: async (supervisorUserId: string): Promise<string[]> => {
    const { data, error } = await supabaseClient
      .from('supervisor_branches')
      .select('branch_id')
      .eq('supervisor_user_id', supervisorUserId);
    if (error) return [];
    return (data || []).map(r => r.branch_id);
  },
  setSupervisorBranches: async (supervisorUserId: string, branchIds: string[]) => {
    const { error: delError } = await supabaseClient
      .from('supervisor_branches')
      .delete()
      .eq('supervisor_user_id', supervisorUserId);
    if (delError) throw delError;
    if (branchIds.length > 0) {
      const rows = branchIds.map(branchId => ({ supervisor_user_id: supervisorUserId, branch_id: branchId }));
      const { error } = await supabaseClient.from('supervisor_branches').insert(rows);
      if (error) throw error;
    }
    return true;
  }
};
