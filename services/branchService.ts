import { supabaseClient } from '../lib/supabase';
import { Branch } from '../types';

export const branchService = {
  list: async () => {
    try {
      const { data, error } = await supabaseClient.from('branches').select('*');
      if (error) throw error;
      return data?.map(b => ({
        id: b.id,
        code: b.code,
        name: b.name,
        role: b.role,
        googleMapsLink: b.google_maps_link,
        whatsappNumber: b.whatsapp_number,
        isSpinEnabled: b.is_spin_enabled,
        isItemsEntryEnabled: b.is_items_entry_enabled,
        isKPIDashboardEnabled: b.is_kpi_dashboard_enabled,
        password: b.password
      })) || [];
    } catch (e) {
      return [];
    }
  },
  findByCode: async (code: string) => {
    try {
      const { data, error } = await supabaseClient.from('branches').select('*').ilike('code', code).maybeSingle();
      if (error) throw error;
      if (data) return {
        id: data.id,
        code: data.code,
        name: data.name,
        role: data.role,
        googleMapsLink: data.google_maps_link,
        whatsappNumber: data.whatsapp_number,
        isSpinEnabled: data.is_spin_enabled,
        isItemsEntryEnabled: data.is_items_entry_enabled,
        isKPIDashboardEnabled: data.is_kpi_dashboard_enabled,
        password: data.password
      };
      return undefined;
    } catch (e) {
      return undefined;
    }
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
      is_kpi_dashboard_enabled: branch.isKPIDashboardEnabled,
      password: branch.password
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
