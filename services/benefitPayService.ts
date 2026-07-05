import { supabaseClient } from '../lib/supabaseClient';
import {
  BenefitPayTransfer,
  BenefitPayTransferInput,
  BenefitPayTransferType
} from '../types';
import { toBhdStorageValue } from '../utils/money';

const TRANSFER_TYPES: BenefitPayTransferType[] = ['AFS', 'CREDIMAX', 'IBAN'];

const TRANSFER_SELECT = `
  *,
  branch:branches!benefit_pay_transfers_branch_id_fkey(code, name),
  pharmacist:pharmacists!benefit_pay_transfers_pharmacist_id_fkey(code, name),
  delivery_order:delivery_orders!benefit_pay_transfers_delivery_order_id_fkey(order_number)
`;

const isValidDateKey = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const normalizeTransferType = (value: string): BenefitPayTransferType => {
  const normalized = value.trim().toUpperCase() as BenefitPayTransferType;
  if (!TRANSFER_TYPES.includes(normalized)) throw new Error('Select a valid transfer type.');
  return normalized;
};

const normalizeTime = (value: string) => {
  const text = value.trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(text);
  if (!match) throw new Error('Transfer time must use HH:mm format.');
  return `${match[1]}:${match[2]}`;
};

const normalizeBhd = (value: number | string | null | undefined) => toBhdStorageValue(value);

const toTransfer = (row: any): BenefitPayTransfer => ({
  id: row.id,
  serialNumber: row.serial_number,
  sequenceNo: Number(row.sequence_no || 0),
  branchId: row.branch_id,
  branchCode: row.branch?.code || null,
  branchName: row.branch?.name || null,
  transferDate: row.transfer_date,
  pharmacistId: row.pharmacist_id || null,
  pharmacistName: row.pharmacist?.name || row.pharmacist_name || null,
  transferType: normalizeTransferType(row.transfer_type),
  valueBhd: Number(row.value_bhd || 0),
  transferTime: row.transfer_time ? String(row.transfer_time).slice(0, 5) : '',
  source: row.source === 'delivery' ? 'delivery' : 'manual',
  deliveryOrderId: row.delivery_order_id || null,
  deliveryOrderNumber: row.delivery_order?.order_number || null,
  notes: row.notes || null,
  createdBy: row.created_by || null,
  createdAt: row.created_at,
  updatedBy: row.updated_by || null,
  updatedAt: row.updated_at
});

const resolveActivePharmacistForBranch = async (branchId: string, pharmacistId: string) => {
  const { data: assignment, error: assignmentError } = await supabaseClient
    .from('pharmacist_branches')
    .select('pharmacist_id')
    .eq('branch_id', branchId)
    .eq('pharmacist_id', pharmacistId)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) throw new Error('Selected pharmacist is not assigned to this branch.');

  const { data, error } = await supabaseClient
    .from('pharmacists')
    .select('name, is_active')
    .eq('id', pharmacistId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.is_active) throw new Error('Selected pharmacist is inactive or unavailable.');
  return data.name as string;
};

export interface BenefitPayTransferFilters {
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  transferType?: BenefitPayTransferType | 'all';
  source?: 'manual' | 'delivery' | 'all';
  pharmacistId?: string;
}

export const benefitPayService = {
  transfers: {
    list: async (filters: BenefitPayTransferFilters = {}): Promise<BenefitPayTransfer[]> => {
      const buildQuery = () => {
        let query = supabaseClient.from('benefit_pay_transfers').select(TRANSFER_SELECT);
        if (filters.branchId && filters.branchId !== 'all') query = query.eq('branch_id', filters.branchId);
        if (filters.dateFrom) query = query.gte('transfer_date', filters.dateFrom);
        if (filters.dateTo) query = query.lte('transfer_date', filters.dateTo);
        if (filters.transferType && filters.transferType !== 'all') query = query.eq('transfer_type', filters.transferType);
        if (filters.source && filters.source !== 'all') query = query.eq('source', filters.source);
        if (filters.pharmacistId && filters.pharmacistId !== 'all') query = query.eq('pharmacist_id', filters.pharmacistId);
        return query;
      };

      const rows: any[] = [];
      let from = 0;
      const pageSize = 1000;
      for (;;) {
        const { data, error } = await buildQuery()
          .order('transfer_date', { ascending: false })
          .order('transfer_time', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < pageSize || rows.length >= 50000) break;
        from += pageSize;
      }

      return rows.map(toTransfer);
    },

    insert: async (input: BenefitPayTransferInput): Promise<BenefitPayTransfer> => {
      const branchId = input.branchId?.trim();
      const transferDate = input.transferDate?.trim();
      const pharmacistId = input.pharmacistId?.trim();
      const transferType = normalizeTransferType(input.transferType);
      const transferTime = normalizeTime(input.transferTime);
      const valueBhd = Number(normalizeBhd(input.valueBhd));

      if (!branchId) throw new Error('Branch is required.');
      if (!transferDate || !isValidDateKey(transferDate)) throw new Error('A valid transfer date is required.');
      if (!pharmacistId) throw new Error('Pharmacist is required.');
      if (!Number.isFinite(valueBhd) || valueBhd <= 0) throw new Error('Transfer value must be greater than zero.');

      const { data: session } = await supabaseClient.auth.getSession();
      const pharmacistName = await resolveActivePharmacistForBranch(branchId, pharmacistId);

      const payload = {
        branch_id: branchId,
        transfer_date: transferDate,
        pharmacist_id: pharmacistId,
        pharmacist_name: pharmacistName,
        transfer_type: transferType,
        value_bhd: normalizeBhd(input.valueBhd),
        transfer_time: transferTime,
        source: 'manual',
        notes: input.notes?.trim() || null,
        created_by: session.session?.user?.id || null,
        updated_by: session.session?.user?.id || null
      };

      const { data, error } = await supabaseClient
        .from('benefit_pay_transfers')
        .insert([payload])
        .select(TRANSFER_SELECT)
        .single();
      if (error) throw error;
      return toTransfer(data);
    },

    update: async (id: string, input: BenefitPayTransferInput): Promise<BenefitPayTransfer> => {
      const transferId = id?.trim();
      const branchId = input.branchId?.trim();
      const transferDate = input.transferDate?.trim();
      const pharmacistId = input.pharmacistId?.trim();
      const transferType = normalizeTransferType(input.transferType);
      const transferTime = normalizeTime(input.transferTime);
      const valueBhd = Number(normalizeBhd(input.valueBhd));

      if (!transferId) throw new Error('Benefit Pay transfer is required.');
      if (!branchId) throw new Error('Branch is required.');
      if (!transferDate || !isValidDateKey(transferDate)) throw new Error('A valid transfer date is required.');
      if (!pharmacistId) throw new Error('Pharmacist is required.');
      if (!Number.isFinite(valueBhd) || valueBhd <= 0) throw new Error('Transfer value must be greater than zero.');

      const { data: session } = await supabaseClient.auth.getSession();
      const pharmacistName = await resolveActivePharmacistForBranch(branchId, pharmacistId);

      const payload = {
        branch_id: branchId,
        transfer_date: transferDate,
        pharmacist_id: pharmacistId,
        pharmacist_name: pharmacistName,
        transfer_type: transferType,
        value_bhd: normalizeBhd(input.valueBhd),
        transfer_time: transferTime,
        notes: input.notes?.trim() || null,
        updated_by: session.session?.user?.id || null
      };

      const { data, error } = await supabaseClient
        .from('benefit_pay_transfers')
        .update(payload)
        .eq('id', transferId)
        .select(TRANSFER_SELECT)
        .single();
      if (error) throw error;
      return toTransfer(data);
    },

    delete: async (id: string) => {
      const { error } = await supabaseClient.rpc('app_benefit_pay_delete_transfer' as any, {
        p_transfer_id: id
      });
      if (error) throw error;
      return true;
    }
  }
};
