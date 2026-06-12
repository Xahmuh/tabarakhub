import { supabaseClient } from '../lib/supabaseClient';
import { Branch } from '../types';

const BRANCH_COLUMNS = 'id, code, name, role, google_maps_link, whatsapp_number, is_spin_enabled, is_items_entry_enabled, is_kpi_dashboard_enabled';

const toBranch = (b: any): Branch => ({
  id: b.id,
  code: b.code,
  name: b.name,
  role: b.role,
  googleMapsLink: b.google_maps_link,
  whatsappNumber: b.whatsapp_number,
  isSpinEnabled: b.is_spin_enabled,
  isItemsEntryEnabled: b.is_items_entry_enabled,
  isKPIDashboardEnabled: b.is_kpi_dashboard_enabled
});

export const branchService = {
  list: async () => {
    try {
      const { data, error } = await supabaseClient.from('branches').select(BRANCH_COLUMNS);
      if (error) throw error;
      return data?.map(toBranch) || [];
    } catch (e) {
      return [];
    }
  },
  findByCode: async (code: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('branches')
        .select(BRANCH_COLUMNS)
        .ilike('code', code)
        .maybeSingle();
      if (error) throw error;
      if (data) return toBranch(data);
      return undefined;
    } catch (e) {
      return undefined;
    }
  },
  getCurrent: async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user) return null;

    const { data, error } = await supabaseClient
      .from('app_user_profiles')
      .select(`branch:branches(${BRANCH_COLUMNS})`)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error || !data?.branch) return null;
    const branch = Array.isArray(data.branch) ? data.branch[0] : data.branch;
    return toBranch(branch);
  },
  upsert: async (branch: Partial<Branch>) => {
    const payload: any = {
      code: branch.code?.toUpperCase(),
      name: branch.name,
      role: branch.role,
      google_maps_link: branch.googleMapsLink,
      whatsapp_number: branch.whatsappNumber,
      is_spin_enabled: branch.isSpinEnabled,
      is_items_entry_enabled: branch.isItemsEntryEnabled,
      is_kpi_dashboard_enabled: branch.isKPIDashboardEnabled
    };

    if (branch.id && branch.id.length > 5) {
      payload.id = branch.id;
    }

    const { data, error } = await supabaseClient
      .from('branches')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
  delete: async (id: string) => {
    const { error } = await supabaseClient.from('branches').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};
