import { supabaseClient } from '../lib/supabaseClient';
import { BranchDeliveryProfile, BranchDeliveryProfileInput } from '../types';

const PROFILE_COLUMNS = `
  id,
  branch_id,
  origin_block_number,
  core_radius_km,
  standard_radius_km,
  extended_radius_km,
  target_delivery_minutes,
  warning_delivery_minutes,
  is_delivery_enabled,
  notes,
  created_at,
  updated_at,
  branch:branches(id, code, name, role)
`;

const num = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toProfile = (row: any): BranchDeliveryProfile => {
  const branch = Array.isArray(row.branch) ? row.branch[0] : row.branch;
  return {
    id: row.id,
    branchId: row.branch_id,
    branchCode: branch?.code || null,
    branchName: branch?.name || null,
    originBlockNumber: row.origin_block_number,
    coreRadiusKm: num(row.core_radius_km, 3),
    standardRadiusKm: num(row.standard_radius_km, 5),
    extendedRadiusKm: num(row.extended_radius_km, 8),
    targetDeliveryMinutes: num(row.target_delivery_minutes, 25),
    warningDeliveryMinutes: num(row.warning_delivery_minutes, 35),
    isDeliveryEnabled: row.is_delivery_enabled !== false,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const toPayload = (input: BranchDeliveryProfileInput) => ({
  branch_id: input.branchId,
  origin_block_number: input.originBlockNumber.trim(),
  core_radius_km: input.coreRadiusKm,
  standard_radius_km: input.standardRadiusKm,
  extended_radius_km: input.extendedRadiusKm,
  target_delivery_minutes: input.targetDeliveryMinutes,
  warning_delivery_minutes: input.warningDeliveryMinutes,
  is_delivery_enabled: input.isDeliveryEnabled,
  notes: input.notes?.trim() || null
});

export const branchDeliveryProfileService = {
  listBranchDeliveryProfiles: async (): Promise<BranchDeliveryProfile[]> => {
    const { data, error } = await supabaseClient
      .from('branch_delivery_profiles')
      .select(PROFILE_COLUMNS);

    if (error) {
      throw new Error(`Could not load branch delivery profiles: ${error.message}`);
    }

    return (data || [])
      .map(toProfile)
      .sort((a, b) => (a.branchCode || a.branchName || '').localeCompare(b.branchCode || b.branchName || ''));
  },

  getBranchDeliveryProfile: async (branchId: string): Promise<BranchDeliveryProfile | null> => {
    const { data, error } = await supabaseClient
      .from('branch_delivery_profiles')
      .select(PROFILE_COLUMNS)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load branch delivery profile: ${error.message}`);
    }

    return data ? toProfile(data) : null;
  },

  upsertBranchDeliveryProfile: async (input: BranchDeliveryProfileInput): Promise<BranchDeliveryProfile> => {
    const payload = toPayload(input);
    if (!payload.origin_block_number) {
      throw new Error('Origin block number is required.');
    }
    if (payload.core_radius_km > payload.standard_radius_km || payload.standard_radius_km > payload.extended_radius_km) {
      throw new Error('Radius bands must be ordered: core <= standard <= extended.');
    }

    const { data, error } = await supabaseClient
      .from('branch_delivery_profiles')
      .upsert(payload, { onConflict: 'branch_id' })
      .select(PROFILE_COLUMNS)
      .single();

    if (error) {
      throw new Error(`Could not save branch delivery profile: ${error.message}`);
    }

    return toProfile(data);
  }
};
