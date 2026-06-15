import { supabase } from './supabase';

export type DriverSessionPayload = {
  driver: {
    id: string;
    driverCode?: string | null;
    name: string;
    phone?: string | null;
    isActive: boolean;
    isOnline: boolean;
    statusChangedAt?: string | null;
    lastSeenAt?: string | null;
  };
  activeShift: null | {
    id: string;
    shiftDate: string;
    startedAt: string;
  };
  stats: {
    statDate: string;
    firstOnlineAt?: string | null;
    lastOfflineAt?: string | null;
    totalWorkingMinutes: number;
    assignedCount: number;
    pickedUpCount: number;
    deliveredCount: number;
    cancelledCount: number;
  };
};

export type DriverOrderStatus = 'assigned' | 'picked_up' | 'delivered' | 'cancelled';

export type DriverOrder = {
  id: string;
  branchId: string;
  branchName: string;
  orderDate: string;
  valueBhd: number;
  paymentType: string;
  blockNumber?: string | null;
  areaName?: string | null;
  governorate?: string | null;
  deliveryStatus: DriverOrderStatus;
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  notes?: string | null;
  createdAt: string;
};

const assertRpc = <T,>(data: T | null, error: unknown, fallback: string): T => {
  if (error) {
    const message = error instanceof Error ? error.message : fallback;
    throw new Error(message);
  }
  if (data === null || data === undefined) throw new Error(fallback);
  return data;
};

const mapOrder = (row: any): DriverOrder => ({
  id: row.id,
  branchId: row.branch_id,
  branchName: row.branch_name || 'Branch',
  orderDate: row.order_date,
  valueBhd: Number(row.value_bhd || 0),
  paymentType: row.payment_type,
  blockNumber: row.block_number,
  areaName: row.area_name,
  governorate: row.governorate,
  deliveryStatus: row.delivery_status,
  assignedAt: row.assigned_at,
  pickedUpAt: row.picked_up_at,
  deliveredAt: row.delivered_at,
  cancelledAt: row.cancelled_at,
  notes: row.notes,
  createdAt: row.created_at
});

export const driverApi = {
  signIn: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) throw error;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  session: async (): Promise<DriverSessionPayload> => {
    const { data, error } = await supabase.rpc('app_driver_get_session');
    return assertRpc(data as DriverSessionPayload, error, 'Could not load driver session.');
  },

  activeOrders: async (): Promise<DriverOrder[]> => {
    const { data, error } = await supabase.rpc('app_driver_get_active_orders');
    const rows = assertRpc(data as any[], error, 'Could not load assigned orders.');
    return rows.map(mapOrder);
  },

  startShift: async (): Promise<DriverSessionPayload> => {
    const { data, error } = await supabase.rpc('app_driver_start_shift');
    return assertRpc(data as DriverSessionPayload, error, 'Could not start shift.');
  },

  endShift: async (): Promise<DriverSessionPayload> => {
    const { data, error } = await supabase.rpc('app_driver_end_shift');
    return assertRpc(data as DriverSessionPayload, error, 'Could not end shift.');
  },

  transitionOrder: async (
    orderId: string,
    nextStatus: DriverOrderStatus,
    notes?: string | null,
    idempotencyKey = `${orderId}:${nextStatus}:${Date.now()}`
  ) => {
    const { error } = await supabase.rpc('app_driver_transition_order', {
      p_order_id: orderId,
      p_next_status: nextStatus,
      p_notes: notes || null,
      p_idempotency_key: idempotencyKey
    });
    if (error) throw error;
  },

  registerPushToken: async (token: string) => {
    const { error } = await supabase.rpc('app_driver_register_push_token', {
      p_token: token
    });
    if (error) throw error;
  }
};
