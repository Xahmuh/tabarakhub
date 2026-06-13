import { supabaseClient } from '../lib/supabaseClient';
import {
  BranchClassification,
  DeliveryArea,
  DeliveryBlock,
  DeliveryCostSetting,
  DeliveryDriver,
  DeliveryOrder,
  DeliveryOrderInput,
  DeliverySupervisor
} from '../types';

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
  driverName: row.driver?.name || null,
  blockNumber: row.block_number,
  areaName: row.area_name,
  governorate: row.governorate,
  isOutsideGovernorate: !!row.is_outside_governorate,
  notes: row.notes || undefined,
  createdAt: row.created_at
});

const ORDER_SELECT = `
  *,
  driver:delivery_drivers(name),
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
      const { data: session } = await supabaseClient.auth.getSession();
      const payload = {
        branch_id: input.branchId,
        order_date: input.orderDate,
        value_bhd: input.valueBhd,
        payment_type: input.paymentType,
        pharmacist_id: input.pharmacistId || null,
        pharmacist_name: input.pharmacistName || null,
        driver_id: input.driverId || null,
        block_number: input.paymentType === 'TALABAT' ? null : input.blockNumber || null,
        notes: input.notes || null,
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
      if (input.orderDate !== undefined) payload.order_date = input.orderDate;
      if (input.valueBhd !== undefined) payload.value_bhd = input.valueBhd;
      if (input.paymentType !== undefined) payload.payment_type = input.paymentType;
      if (input.pharmacistId !== undefined) payload.pharmacist_id = input.pharmacistId;
      if (input.pharmacistName !== undefined) payload.pharmacist_name = input.pharmacistName;
      if (input.driverId !== undefined) payload.driver_id = input.driverId;
      if (input.blockNumber !== undefined) payload.block_number = input.blockNumber;
      if (input.notes !== undefined) payload.notes = input.notes;
      if (payload.payment_type === 'TALABAT') payload.block_number = null;

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
      const { error } = await supabaseClient.from('delivery_orders').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    /** Possible duplicate: same branch/date/value/payment/driver created in the last N minutes. */
    findRecentDuplicate: async (input: DeliveryOrderInput, windowMinutes = 10): Promise<DeliveryOrder | null> => {
      const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
      let query = supabaseClient
        .from('delivery_orders')
        .select(ORDER_SELECT)
        .eq('branch_id', input.branchId)
        .eq('order_date', input.orderDate)
        .eq('value_bhd', input.valueBhd)
        .eq('payment_type', input.paymentType)
        .gte('created_at', since)
        .limit(1);
      if (input.driverId) query = query.eq('driver_id', input.driverId);
      const { data, error } = await query;
      if (error) return null;
      return data && data.length > 0 ? toOrder(data[0]) : null;
    }
  },

  drivers: {
    list: async (includeInactive = false): Promise<DeliveryDriver[]> => {
      let query = supabaseClient.from('delivery_drivers').select('*').order('name');
      if (!includeInactive) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id, name: d.name, phone: d.phone || undefined, notes: d.notes || undefined, isActive: d.is_active
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
      return { id: data.id, name: data.name, phone: data.phone || undefined, notes: data.notes || undefined, isActive: data.is_active };
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
      return all.map(b => ({
        blockNumber: b.block_number, areaId: b.area_id, areaName: b.area_name, governorate: b.governorate, isActive: b.is_active
      }));
    },
    resolve: async (blockNumber: string): Promise<DeliveryBlock | null> => {
      const { data, error } = await supabaseClient
        .from('delivery_blocks')
        .select('*')
        .eq('block_number', blockNumber.trim())
        .eq('is_active', true)
        .maybeSingle();
      if (error || !data) return null;
      return { blockNumber: data.block_number, areaId: data.area_id, areaName: data.area_name, governorate: data.governorate, isActive: data.is_active };
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
