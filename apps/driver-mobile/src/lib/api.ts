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
    actualDeliveryCount: number;
    internalTransferCount: number;
  };
  monthlyTarget?: {
    targetMonth: string;
    monthEnd: string;
    isConfigured: boolean;
    targetActualDeliveries: number;
    actualDeliveries: number;
    remainingDeliveries: number;
    progressPct: number;
    targetReached: boolean;
    overTargetDeliveries: number;
    targetIncentiveBhd: number;
    overTargetIncentivePerOrderBhd: number;
    earnedIncentiveBhd: number;
  };
};

export type DriverOrderStatus = 'assigned' | 'picked_up' | 'delivered' | 'cancelled';
export type DriverOrderKind = 'actual_delivery' | 'internal_transfer';
export type DriverHistoryStatusFilter = Extract<DriverOrderStatus, 'picked_up' | 'delivered' | 'cancelled'>;
export type DriverHistoryKindFilter = DriverOrderKind;

export type DriverOrderHistoryFilters = {
  status?: DriverHistoryStatusFilter | null;
  orderKind?: DriverHistoryKindFilter | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
};

export type DriverDutyStartLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
};

export type DriverBranchOption = {
  id: string;
  code?: string | null;
  name: string;
};

export type DriverNearbyStartBranch = DriverBranchOption & {
  distanceMeters: number;
  radiusMeters: number;
  isWithinRadius: boolean;
};

export type DriverOrder = {
  id: string;
  branchId: string;
  branchName: string;
  orderDate: string;
  paymentType: string;
  orderKind: DriverOrderKind;
  transferFromBranchId?: string | null;
  transferFromBranchCode?: string | null;
  transferFromBranchName?: string | null;
  transferToBranchId?: string | null;
  transferToBranchCode?: string | null;
  transferToBranchName?: string | null;
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
  pickupBatchId?: string | null;
  batchDeliverySequence?: number | null;
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
  paymentType: row.payment_type,
  orderKind: row.order_kind === 'internal_transfer' ? 'internal_transfer' : 'actual_delivery',
  transferFromBranchId: row.transfer_from_branch_id,
  transferFromBranchCode: row.transfer_from_branch_code,
  transferFromBranchName: row.transfer_from_branch_name,
  transferToBranchId: row.transfer_to_branch_id,
  transferToBranchCode: row.transfer_to_branch_code,
  transferToBranchName: row.transfer_to_branch_name,
  blockNumber: row.block_number,
  areaName: row.area_name,
  governorate: row.governorate,
  deliveryStatus: row.delivery_status,
  assignedAt: row.assigned_at,
  pickedUpAt: row.picked_up_at,
  deliveredAt: row.delivered_at,
  cancelledAt: row.cancelled_at,
  notes: row.notes,
  createdAt: row.created_at,
  pickupBatchId: row.pickup_batch_id,
  batchDeliverySequence: row.batch_delivery_sequence ?? null
});

export const driverApi = {
  signIn: async (identifier: string, password: string) => {
    const rawIdentifier = identifier.trim();
    let email = rawIdentifier.toLowerCase();

    if (!rawIdentifier.includes('@')) {
      const { data, error } = await supabase.rpc('app_driver_resolve_login_identifier', {
        p_identifier: rawIdentifier
      });

      if (error) {
        throw new Error(error.message || 'Could not find this driver code.');
      }

      email = String(data || '').trim().toLowerCase();
    }

    if (!email) throw new Error('Email ID or driver code is required.');

    const { error } = await supabase.auth.signInWithPassword({
      email,
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

  orderHistory: async (filters: DriverOrderHistoryFilters = {}): Promise<DriverOrder[]> => {
    const { data, error } = await supabase.rpc('app_driver_get_order_history', {
      p_limit: filters.limit || 80,
      p_status: filters.status || null,
      p_order_kind: filters.orderKind || null,
      p_date_from: filters.dateFrom || null,
      p_date_to: filters.dateTo || null
    });
    const rows = assertRpc(data as any[], error, 'Could not load order history.');
    return rows.map(mapOrder);
  },

  transferBranches: async (): Promise<DriverBranchOption[]> => {
    const { data, error } = await supabase.rpc('app_driver_list_transfer_branches');
    const rows = assertRpc(data as any[], error, 'Could not load transfer branches.');
    return rows.map(row => ({
      id: row.id,
      code: row.code || null,
      name: row.name || 'Branch'
    }));
  },

  nearbyStartBranch: async (location: DriverDutyStartLocation): Promise<DriverNearbyStartBranch | null> => {
    const { data, error } = await supabase.rpc('app_driver_get_nearby_start_branch', {
      p_lat: location.latitude,
      p_lng: location.longitude,
      p_accuracy_m: location.accuracyMeters ?? null
    });
    const rows = assertRpc(data as any[], error, 'Could not check nearby branch.');
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      code: row.code || null,
      name: row.name || 'Branch',
      distanceMeters: Number(row.distance_m ?? 0),
      radiusMeters: Number(row.radius_m ?? 0),
      isWithinRadius: Boolean(row.is_within_radius)
    };
  },

  startShift: async (location: DriverDutyStartLocation): Promise<DriverSessionPayload> => {
    const { data, error } = await supabase.rpc('app_driver_start_shift', {
      p_lat: location.latitude,
      p_lng: location.longitude,
      p_accuracy_m: location.accuracyMeters ?? null
    });
    return assertRpc(data as DriverSessionPayload, error, 'Could not start shift.');
  },

  endShift: async (): Promise<DriverSessionPayload> => {
    const { data, error } = await supabase.rpc('app_driver_end_shift');
    return assertRpc(data as DriverSessionPayload, error, 'Could not end shift.');
  },

  pickupOrders: async (
    orderIds: string[],
    idempotencyKey = `pickup:${Date.now()}`
  ) => {
    const { error } = await supabase.rpc('app_driver_pickup_orders', {
      p_order_ids: orderIds,
      p_idempotency_key: idempotencyKey
    });
    if (error) throw error;
  },

  createInternalTransfer: async (
    fromBranchId: string,
    toBranchId: string,
    notes?: string | null,
    idempotencyKey = `transfer:${fromBranchId}:${toBranchId}:${Date.now()}`
  ) => {
    const { data, error } = await supabase.rpc('app_driver_create_internal_transfer', {
      p_from_branch_id: fromBranchId,
      p_to_branch_id: toBranchId,
      p_notes: notes || null,
      p_idempotency_key: idempotencyKey
    });
    return assertRpc(data as string, error, 'Could not create internal transfer.');
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
