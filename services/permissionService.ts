import { supabaseClient } from '../lib/supabaseClient';
import { AppUser, FeaturePermission, Role, RolePermission, UserFeaturePermission } from '../types';

export type AdminCreateUserInput = {
  email: string;
  password: string;
  role: Role;
  branchId?: string | null;
  supervisorBranchIds?: string[];
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
  adminCreateUser: async (input: AdminCreateUserInput): Promise<AppUser> => {
    const { data, error } = await supabaseClient.functions.invoke('admin-create-user', {
      body: input
    });
    if (error) await throwFunctionError(error, 'Could not create the user.');
    if (data?.error) throw new Error(data.error);
    const user = data?.user;
    if (!user) throw new Error('User was created but no user payload was returned.');
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
