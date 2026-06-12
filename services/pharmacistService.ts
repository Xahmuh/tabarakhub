import { supabaseClient } from '../lib/supabaseClient';
import { Pharmacist } from '../types';

export const pharmacistService = {
  listAll: async () => {
    try {
      const { data, error } = await supabaseClient
        .from('pharmacists')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data.map(p => ({
        id: p.id,
        name: p.name,
        isActive: p.is_active
      }));
    } catch (e) {
      return [];
    }
  },
  listByBranch: async (branchId: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('pharmacists')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []).map((p: any) => ({ id: p.id, branchId, name: p.name, isActive: p.is_active }));
    } catch (e) {
      return [];
    }
  },
  findById: async (id: string) => {
    try {
      const { data, error } = await supabaseClient.from('pharmacists').select('*').eq('id', id).single();
      if (error) throw error;
      return { id: data.id, name: data.name, isActive: data.is_active };
    } catch (e) {
      return null;
    }
  },
  upsert: async (pharmacist: Partial<Pharmacist>, branchIds?: string[]) => {
    const payload: any = {
      name: pharmacist.name,
      is_active: pharmacist.isActive ?? true
    };

    if (pharmacist.id && pharmacist.id.length > 5) {
      payload.id = pharmacist.id;
    }

    const { data, error } = await supabaseClient
      .from('pharmacists')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    const pData = data;

    if (branchIds) {
      await supabaseClient.from('pharmacist_branches').delete().eq('pharmacist_id', pData.id);
      if (branchIds.length > 0) {
        const assignments = branchIds.map(bid => ({ pharmacist_id: pData.id, branch_id: bid }));
        const { error: relError } = await supabaseClient.from('pharmacist_branches').insert(assignments);
        if (relError) throw relError;
      }
    }

    return pData;
  },
  delete: async (id: string) => {
    const { error } = await supabaseClient
      .from('pharmacists')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};
