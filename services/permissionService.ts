import { supabaseClient } from '../lib/supabase';
import { FeaturePermission } from '../types';

export const permissionService = {
  listForBranch: async (branchId: string) => {
    const { data, error } = await supabaseClient.from('feature_permissions').select('*').eq('branch_id', branchId);
    if (error) return [];
    return data.map(p => ({
      id: p.id,
      branchId: p.branch_id,
      featureName: p.feature_name,
      accessLevel: p.access_level
    }));
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
  }
};
