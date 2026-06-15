import { supabaseClient } from '../lib/supabaseClient';
import {
  BranchClassification,
  DeliveryArea,
  DeliveryBlock,
  DeliveryCostSetting,
  DeliveryDriver,
  DeliveryLifecycleStatus,
  DeliveryOrder,
  DeliveryOrderEvent,
  DeliveryOrderLifecycleInput,
  DeliveryOrderInput,
  DeliverySupervisor
} from '../types';

const PAYMENT_TYPES = new Set(['BP', 'CARD', 'CASH', 'TALABAT']);
const LIFECYCLE_STATUSES: DeliveryLifecycleStatus[] = ['recorded', 'assigned', 'picked_up', 'delivered', 'cancelled'];

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

const normalizeOrderInput = (input: DeliveryOrderInput): DeliveryOrderInput => {
  const branchId = input.branchId?.trim();
  const orderDate = input.orderDate?.trim();
  const paymentType = input.paymentType;
  const valueBhd = Number(input.valueBhd);
  const blockNumber = input.blockNumber?.trim() || null;

  if (!branchId) throw new Error('Branch is required for delivery orders.');
  if (!orderDate || !isValidDateKey(orderDate)) throw new Error('A valid order date is required.');
  if (!PAYMENT_TYPES.has(paymentType)) throw new Error('A valid payment type is required.');
  if (!Number.isFinite(valueBhd) || valueBhd <= 0) throw new Error('Order value must be greater than zero.');
  if (paymentType !== 'TALABAT' && !blockNumber) {
    throw new Error('Block number is required for non-Talabat delivery orders.');
  }

  return {
    ...input,
    branchId,
    orderDate,
    valueBhd,
    paymentType,
    pharmacistId: input.pharmacistId || null,
    pharmacistName: input.pharmacistName?.trim() || null,
    driverId: input.driverId || null,
    blockNumber: paymentType === 'TALABAT' ? null : blockNumber,
    notes: input.notes?.trim() || undefined
  };
};

const resolveActivePharmacistForBranch = async (branchId: string, pharmacistId?: string | null) => {
  if (!pharmacistId) return null;

  const { data: assignment, error: assignmentError } = await supabaseClient
    .from('pharmacist_branches')
    .select('pharmacist_id')
    .eq('branch_id', branchId)
    .eq('pharmacist_id', pharmacistId)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) throw new Error('Selected pharmacist is not assigned to this branch.');

  const { data: pharmacist, error: pharmacistError } = await supabaseClient
    .from('pharmacists')
    .select('name, is_active')
    .eq('id', pharmacistId)
    .maybeSingle();
  if (pharmacistError) throw pharmacistError;
  if (!pharmacist?.is_active) throw new Error('Selected pharmacist is inactive or unavailable.');
  return pharmacist.name as string;
};

const assertActiveDriver = async (driverId?: string | null) => {
  if (!driverId) return;
  const { data, error } = await supabaseClient
    .from('delivery_drivers')
    .select('id, is_active')
    .eq('id', driverId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.is_active) throw new Error('Selected driver is inactive or unavailable.');
};

const toLifecycleStatus = (value: string | null | undefined): DeliveryLifecycleStatus =>
  LIFECYCLE_STATUSES.includes(value as DeliveryLifecycleStatus)
    ? value as DeliveryLifecycleStatus
    : 'recorded';

const toOrder = (row: any): DeliveryOrder => ({
  id: row.id,
  branchId: row.branch_id,
  branchName: row.branch?.name,
  orderDate: row.order_date,
  valueBhd: Number(row.value_bhd || 0),
  paymentType: row.payment_type,
  pharmacistId: row.pharmacist_id,
  pharmacistName: row.pharmacist_name || row.pharmacist?.name || null,
  driverId: row.driver_id,
  driverCode: row.driver?.driver_code || null,
  driverName: row.driver?.name || null,
  blockNumber: row.block_number,
  areaName: row.area_name,
  governorate: row.governorate,
  isOutsideGovernorate: !!row.is_outside_governorate,
  notes: row.notes || undefined,
  createdAt: row.created_at,
  deliveryStatus: toLifecycleStatus(row.delivery_status),
  assignedAt: row.assigned_at || null,
  pickedUpAt: row.picked_up_at || null,
  deliveredAt: row.delivered_at || null,
  cancelledAt: row.cancelled_at || null,
  cancelledReason: row.cancelled_reason || null,
  lifecycleUpdatedAt: row.lifecycle_updated_at || null
});

const toOrderEvent = (row: any): DeliveryOrderEvent => ({
  id: row.id,
  orderId: row.order_id,
  branchId: row.branch_id,
  branchName: row.branch?.name || null,
  eventType: toLifecycleStatus(row.event_type),
  previousStatus: row.previous_status ? toLifecycleStatus(row.previous_status) : null,
  newStatus: toLifecycleStatus(row.new_status),
  driverId: row.driver_id,
  driverCode: row.driver?.driver_code || null,
  driverName: row.driver?.name || null,
  actorUserId: row.actor_user_id,
  actorRole: row.actor_role,
  notes: row.notes,
  idempotencyKey: row.idempotency_key,
  metadata: row.metadata || {},
  createdAt: row.created_at
});

const toBlock = (row: any): DeliveryBlock => ({
  blockNumber: row.block_number,
  areaId: row.area_id,
  areaName: row.area_name,
  governorate: row.governorate,
  isActive: row.is_active
});

const cleanBlockSearchTerm = (value: string) => value.trim().replace(/[,%()]/g, ' ').replace(/\s+/g, ' ');

const ORDER_SELECT = `
  *,
  driver:delivery_drivers(name, driver_code),
  pharmacist:pharmacists(name)
`;

export interface DeliveryOrderFilters {
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentType?: string;
  driverId?: string;
  pharmacistId?: string;
  governorate?: string;
}

export interface DeliveryOrderEventFilters {
  orderId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export const deliveryService = {
  orders: {
    list: async (filters: DeliveryOrderFilters = {}): Promise<DeliveryOrder[]> => {
      // Supabase query builders are mutable, so build a fresh one per page.
      const buildQuery = () => {
        let query = supabaseClient.from('delivery_orders').select(ORDER_SELECT);
        if (filters.branchId && filters.branchId !== 'all') query = query.eq('branch_id', filters.branchId);
        if (filters.dateFrom) query = query.gte('order_date', filters.dateFrom);
        if (filters.dateTo) query = query.lte('order_date', filters.dateTo);
        if (filters.paymentType && filters.paymentType !== 'all') query = query.eq('payment_type', filters.paymentType);
        if (filters.driverId && filters.driverId !== 'all') query = query.eq('driver_id', filters.driverId);
        if (filters.pharmacistId && filters.pharmacistId !== 'all') query = query.eq('pharmacist_id', filters.pharmacistId);
        if (filters.governorate && filters.governorate !== 'all') query = query.eq('governorate', filters.governorate);
        return query;
      };

      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      // Paginate to cover long ranges without silently truncating.
      for (;;) {
        const { data, error } = await buildQuery()
          .order('order_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize || all.length >= 50000) break;
        from += pageSize;
      }
      return all.map(toOrder);
    },

    insert: async (input: DeliveryOrderInput): Promise<DeliveryOrder> => {
      const normalized = normalizeOrderInput(input);
      const pharmacistName = await resolveActivePharmacistForBranch(normalized.branchId, normalized.pharmacistId);
      await assertActiveDriver(normalized.driverId);
      const { data: session } = await supabaseClient.auth.getSession();
      const payload = {
        branch_id: normalized.branchId,
        order_date: normalized.orderDate,
        value_bhd: normalized.valueBhd,
        payment_type: normalized.paymentType,
        pharmacist_id: normalized.pharmacistId || null,
        pharmacist_name: pharmacistName || null,
        driver_id: normalized.driverId || null,
        block_number: normalized.blockNumber,
        notes: normalized.notes || null,
        created_by: session.session?.user?.id || null
      };
      const { data, error } = await supabaseClient
        .from('delivery_orders')
        .insert([payload])
        .select(ORDER_SELECT)
        .single();
      if (error) throw error;
      return toOrder(data);
    },

    update: async (id: string, input: Partial<DeliveryOrderInput>): Promise<DeliveryOrder> => {
      const { data: session } = await supabaseClient.auth.getSession();
      const payload: any = { updated_at: new Date().toISOString(), updated_by: session.session?.user?.id || null };
      if (input.orderDate !== undefined) {
        const orderDate = input.orderDate.trim();
        if (!isValidDateKey(orderDate)) throw new Error('A valid order date is required.');
        payload.order_date = orderDate;
      }
      if (input.valueBhd !== undefined) {
        const valueBhd = Number(input.valueBhd);
        if (!Number.isFinite(valueBhd) || valueBhd <= 0) throw new Error('Order value must be greater than zero.');
        payload.value_bhd = valueBhd;
      }
      if (input.paymentType !== undefined) {
        if (!PAYMENT_TYPES.has(input.paymentType)) throw new Error('A valid payment type is required.');
        payload.payment_type = input.paymentType;
      }
      if (input.pharmacistId !== undefined) payload.pharmacist_id = input.pharmacistId;
      if (input.pharmacistName !== undefined) payload.pharmacist_name = input.pharmacistName;
      if (input.driverId !== undefined) {
        await assertActiveDriver(input.driverId);
        payload.driver_id = input.driverId || null;
      }
      if (input.blockNumber !== undefined) payload.block_number = input.blockNumber?.trim() || null;
      if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
      if (payload.payment_type === 'TALABAT') payload.block_number = null;

      if (input.pharmacistId) {
        const { data: current, error: currentError } = await supabaseClient
          .from('delivery_orders')
          .select('branch_id')
          .eq('id', id)
          .single();
        if (currentError) throw currentError;
        payload.pharmacist_name = await resolveActivePharmacistForBranch(current.branch_id, input.pharmacistId);
      } else if (input.pharmacistId === null) {
        payload.pharmacist_name = null;
      }

      const { data, error } = await supabaseClient
        .from('delivery_orders')
        .update(payload)
        .eq('id', id)
        .select(ORDER_SELECT)
        .single();
      if (error) throw error;
      return toOrder(data);
    },

    delete: async (id: string) => {
      const { error } = await supabaseClient.rpc('app_delivery_delete_recorded_order' as any, {
        p_order_id: id
      });
      if (error) throw error;
      return true;
    },

    /** Possible duplicate: same branch/date/value/payment/driver created in the last N minutes. */
    findRecentDuplicate: async (input: DeliveryOrderInput, windowMinutes = 10): Promise<DeliveryOrder | null> => {
      const normalized = normalizeOrderInput(input);
      const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
      let query = supabaseClient
        .from('delivery_orders')
        .select(ORDER_SELECT)
        .eq('branch_id', normalized.branchId)
        .eq('order_date', normalized.orderDate)
        .eq('value_bhd', normalized.valueBhd)
        .eq('payment_type', normalized.paymentType)
        .gte('created_at', since)
        .limit(1);
      if (normalized.driverId) query = query.eq('driver_id', normalized.driverId);
      const { data, error } = await query;
      if (error) return null;
      return data && data.length > 0 ? toOrder(data[0]) : null;
    }
  },

  lifecycle: {
    listEvents: async (filters: DeliveryOrderEventFilters = {}): Promise<DeliveryOrderEvent[]> => {
      let query = supabaseClient
        .from('delivery_order_events')
        .select('*, driver:delivery_drivers(name, driver_code), branch:branches(name)')
        .order('created_at', { ascending: false })
        .limit(filters.limit || 200);
      if (filters.orderId) query = query.eq('order_id', filters.orderId);
      if (filters.branchId && filters.branchId !== 'all') query = query.eq('branch_id', filters.branchId);
      if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
      if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59.999`);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(toOrderEvent);
    },

    transition: async (input: DeliveryOrderLifecycleInput): Promise<DeliveryOrderEvent> => {
      if (!input.orderId) throw new Error('Delivery order is required.');
      if (!LIFECYCLE_STATUSES.includes(input.nextStatus)) throw new Error('A valid delivery status is required.');
      if (input.driverId) await assertActiveDriver(input.driverId);
      const { data, error } = await supabaseClient.rpc('app_delivery_transition_order', {
        p_order_id: input.orderId,
        p_next_status: input.nextStatus,
        p_driver_id: input.driverId || null,
        p_notes: input.notes?.trim() || null,
        p_idempotency_key: input.idempotencyKey || null
      });
      if (error) throw error;
      return toOrderEvent(data);
    }
  },

  drivers: {
    list: async (includeInactive = false): Promise<DeliveryDriver[]> => {
      let query = supabaseClient.from('delivery_drivers').select('*').order('name');
      if (!includeInactive) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id,
        driverCode: d.driver_code || undefined,
        name: d.name,
        phone: d.phone || undefined,
        notes: d.notes || undefined,
        isActive: d.is_active
      }));
    },
    upsert: async (driver: Partial<DeliveryDriver>): Promise<DeliveryDriver> => {
      const payload: any = {
        name: driver.name?.trim(),
        phone: driver.phone || null,
        notes: driver.notes || null,
        is_active: driver.isActive ?? true,
        updated_at: new Date().toISOString()
      };
      if (driver.id) payload.id = driver.id;
      const { data, error } = await supabaseClient.from('delivery_drivers').upsert(payload).select().single();
      if (error) throw error;
      return {
        id: data.id,
        driverCode: data.driver_code || undefined,
        name: data.name,
        phone: data.phone || undefined,
        notes: data.notes || undefined,
        isActive: data.is_active
      };
    },
    deactivate: async (id: string) => {
      const { error } = await supabaseClient.from('delivery_drivers').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      return true;
    }
  },

  areas: {
    list: async (includeInactive = false): Promise<DeliveryArea[]> => {
      let query = supabaseClient.from('delivery_areas').select('*').order('name');
      if (!includeInactive) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(a => ({
        id: a.id,
        name: a.name,
        governorate: a.governorate,
        notes: a.notes || undefined,
        isActive: a.is_active
      }));
    },
    upsert: async (area: Partial<DeliveryArea>): Promise<DeliveryArea> => {
      const payload: any = {
        name: area.name?.trim(),
        governorate: area.governorate,
        notes: area.notes || null,
        is_active: area.isActive ?? true,
        updated_at: new Date().toISOString()
      };
      if (area.id) payload.id = area.id;
      const { data, error } = await supabaseClient.from('delivery_areas').upsert(payload).select().single();
      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        governorate: data.governorate,
        notes: data.notes || undefined,
        isActive: data.is_active
      };
    }
  },

  supervisors: {
    list: async (includeInactive = false): Promise<DeliverySupervisor[]> => {
      let query = supabaseClient.from('delivery_supervisors').select('*').order('name');
      if (!includeInactive) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(s => ({
        id: s.id,
        name: s.name,
        phone: s.phone || undefined,
        email: s.email || undefined,
        userId: s.user_id,
        notes: s.notes || undefined,
        isActive: s.is_active
      }));
    },
    upsert: async (supervisor: Partial<DeliverySupervisor>): Promise<DeliverySupervisor> => {
      const payload: any = {
        name: supervisor.name?.trim(),
        phone: supervisor.phone || null,
        email: supervisor.email || null,
        user_id: supervisor.userId || null,
        notes: supervisor.notes || null,
        is_active: supervisor.isActive ?? true,
        updated_at: new Date().toISOString()
      };
      if (supervisor.id) payload.id = supervisor.id;
      const { data, error } = await supabaseClient.from('delivery_supervisors').upsert(payload).select().single();
      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        phone: data.phone || undefined,
        email: data.email || undefined,
        userId: data.user_id,
        notes: data.notes || undefined,
        isActive: data.is_active
      };
    }
  },

  blocks: {
    list: async (includeInactive = false): Promise<DeliveryBlock[]> => {
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      for (;;) {
        let query = supabaseClient.from('delivery_blocks').select('*').order('block_number');
        if (!includeInactive) query = query.eq('is_active', true);
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all.map(toBlock);
    },
    search: async (queryStr: string, limit = 12): Promise<DeliveryBlock[]> => {
      const trimmed = cleanBlockSearchTerm(queryStr);
      if (!trimmed) return [];
      const { data, error } = await supabaseClient
        .from('delivery_blocks')
        .select('*')
        .or(`block_number.ilike.%${trimmed}%,area_name.ilike.%${trimmed}%,governorate.ilike.%${trimmed}%`)
        .eq('is_active', true)
        .order('block_number')
        .limit(limit);
      if (error || !data) return [];
      const normalized = trimmed.toLowerCase();
      return data
        .map(toBlock)
        .sort((a, b) => {
          const aExact = a.blockNumber.toLowerCase() === normalized ? 0 : 1;
          const bExact = b.blockNumber.toLowerCase() === normalized ? 0 : 1;
          return aExact - bExact || a.blockNumber.localeCompare(b.blockNumber, undefined, { numeric: true });
        });
    },
    resolve: async (queryStr: string): Promise<DeliveryBlock | null> => {
      const matches = await deliveryService.blocks.search(queryStr, 1);
      return matches[0] || null;
    },
    upsert: async (block: DeliveryBlock) => {
      const { error } = await supabaseClient.from('delivery_blocks').upsert({
        block_number: block.blockNumber.trim(),
        area_id: block.areaId || null,
        area_name: block.areaName.trim(),
        governorate: block.governorate,
        is_active: block.isActive,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      return true;
    }
  },

  classifications: {
    list: async (): Promise<BranchClassification[]> => {
      const { data, error } = await supabaseClient.from('branch_classifications').select('*');
      if (error) return [];
      return (data || []).map(c => ({
        branchId: c.branch_id,
        areaId: c.area_id,
        area: c.area || undefined,
        supervisorId: c.supervisor_id,
        supervisorName: c.supervisor_name || undefined,
        supervisorUserId: c.supervisor_user_id,
        governorate: c.governorate
      }));
    },
    upsert: async (classification: BranchClassification) => {
      const { error } = await supabaseClient.from('branch_classifications').upsert({
        branch_id: classification.branchId,
        area_id: classification.areaId || null,
        area: classification.area || null,
        supervisor_id: classification.supervisorId || null,
        supervisor_name: classification.supervisorName || null,
        supervisor_user_id: classification.supervisorUserId || null,
        governorate: classification.governorate || null,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      return true;
    }
  },

  costSettings: {
    list: async (): Promise<DeliveryCostSetting[]> => {
      const { data, error } = await supabaseClient.from('delivery_cost_settings').select('*');
      if (error) return [];
      return (data || []).map(s => ({
        id: s.id,
        driverId: s.driver_id,
        monthlyCostBhd: Number(s.monthly_cost_bhd || 0),
        workingDaysPerMonth: Number(s.working_days_per_month || 26),
        targetOrdersPerDay: Number(s.target_orders_per_day || 15),
        assumedMarginPct: s.assumed_margin_pct === null ? null : Number(s.assumed_margin_pct)
      }));
    },
    upsert: async (setting: DeliveryCostSetting) => {
      const payload: any = {
        driver_id: setting.driverId,
        monthly_cost_bhd: setting.monthlyCostBhd,
        working_days_per_month: setting.workingDaysPerMonth,
        target_orders_per_day: setting.targetOrdersPerDay,
        assumed_margin_pct: setting.assumedMarginPct ?? null,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabaseClient
        .from('delivery_cost_settings')
        .upsert(payload, { onConflict: 'driver_id' });
      if (error) throw error;
      return true;
    }
  },

  auditLogs: {
    listForOrder: async (orderId: string) => {
      const { data, error } = await supabaseClient
        .from('delivery_order_audit_logs')
        .select('*')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    listRecent: async (limit = 200) => {
      const { data, error } = await supabaseClient
        .from('delivery_order_audit_logs')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(limit);
      if (error) return [];
      return data || [];
    }
  }
};
