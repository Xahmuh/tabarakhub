import { supabaseClient } from '../lib/supabaseClient';
import { Pharmacist } from '../types';

const PHARMACIST_COLUMNS = 'id, code, name, is_active';

const normalizePharmacistCode = (code?: string | null) => code?.trim().toUpperCase() || '';

const toPharmacist = (p: any, branchId?: string): Pharmacist => ({
  id: p.id,
  branchId: branchId || p.branch_id || '',
  code: p.code || '',
  name: p.name,
  isActive: p.is_active
});

export const pharmacistService = {
  listAll: async () => {
    try {
      const { data, error } = await supabaseClient
        .from('pharmacists')
        .select(PHARMACIST_COLUMNS)
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return (data || []).map(p => toPharmacist(p));
    } catch (e) {
      return [];
    }
  },
  listByBranch: async (branchId: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('pharmacists')
        .select(PHARMACIST_COLUMNS)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      return (data || []).map((p: any) => toPharmacist(p, branchId));
    } catch (e) {
      return [];
    }
  },
  findById: async (id: string) => {
    try {
      const { data, error } = await supabaseClient.from('pharmacists').select(PHARMACIST_COLUMNS).eq('id', id).single();
      if (error) throw error;
      return toPharmacist(data);
    } catch (e) {
      return null;
    }
  },
  upsert: async (pharmacist: Partial<Pharmacist>, branchIds?: string[]) => {
    const code = normalizePharmacistCode(pharmacist.code);
    if (!code) throw new Error('Pharmacist code is required');
    if (!/^[A-Z0-9_-]+$/.test(code)) throw new Error('Pharmacist code can only contain letters, numbers, underscore, or dash');

    const payload: any = {
      code,
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
