import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabaseClient } from '../lib/supabaseClient';
import { DeliveryNotification, DeliveryNotificationPayload } from '../types';

const NOTIFICATION_SELECT = `
  *,
  branch:branches!delivery_notifications_branch_id_fkey(code, name),
  driver:delivery_drivers(name, driver_code),
  order:delivery_orders!delivery_notifications_order_id_fkey(order_number, order_date)
`;

interface DeliveryNotificationListOptions {
  limit?: number;
  unreadOnly?: boolean;
}

const toPayload = (value: unknown): DeliveryNotificationPayload => (
  value && typeof value === 'object' ? value as DeliveryNotificationPayload : {}
);

const toNotification = (row: any): DeliveryNotification => {
  const payload = toPayload(row.payload);
  const orderNumber = row.order?.order_number || payload.orderNumber || null;
  const orderLabel = orderNumber || (row.order_id ? `#${String(row.order_id).slice(0, 8)}` : 'the order');
  const body = row.body
    ? String(row.body).replace(/order\s+#?[0-9a-f]{8}\b/i, `order ${orderLabel}`)
    : `${row.driver?.name || payload.driverName || row.driver?.driver_code || payload.driverCode || 'Driver'} delivered order ${orderLabel}.`;
  return {
    id: row.id,
    notificationType: row.notification_type || 'delivery_delivered',
    orderId: row.order_id,
    eventId: row.event_id,
    branchId: row.branch_id,
    branchName: row.branch?.name || payload.branchName || null,
    branchCode: row.branch?.code || payload.branchCode || null,
    driverId: row.driver_id || payload.driverId || null,
    driverName: row.driver?.name || payload.driverName || null,
    driverCode: row.driver?.driver_code || payload.driverCode || null,
    title: row.title || 'Delivery completed',
    body,
    payload: {
      ...payload,
      orderId: payload.orderId || row.order_id || null,
      orderNumber,
      orderDate: payload.orderDate || row.order?.order_date || null
    },
    isRead: !!row.is_read,
    readAt: row.read_at || null,
    readBy: row.read_by || null,
    createdAt: row.created_at
  };
};

export const deliveryNotificationService = {
  list: async (options: DeliveryNotificationListOptions = {}): Promise<DeliveryNotification[]> => {
    let query = supabaseClient
      .from('delivery_notifications')
      .select(NOTIFICATION_SELECT)
      .order('created_at', { ascending: false })
      .limit(options.limit || 80);

    if (options.unreadOnly) query = query.eq('is_read', false);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(toNotification);
  },

  getUnreadCount: async (): Promise<number> => {
    const { count, error } = await supabaseClient
      .from('delivery_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);
    if (error) throw error;
    return count || 0;
  },

  markRead: async (id: string, read = true): Promise<DeliveryNotification> => {
    const { data, error } = await supabaseClient.rpc('app_mark_delivery_notification_read' as any, {
      p_notification_id: id,
      p_read: read
    });
    if (error) throw error;
    return toNotification(data);
  },

  markAllRead: async (): Promise<number> => {
    const { data, error } = await supabaseClient.rpc('app_mark_all_delivery_notifications_read' as any);
    if (error) throw error;
    return Number(data || 0);
  },

  subscribeToNew: (onInsert: (notification: DeliveryNotification) => void): (() => void) => {
    const channel: RealtimeChannel = supabaseClient
      .channel('delivery-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'delivery_notifications' },
        payload => onInsert(toNotification(payload.new))
      )
      .subscribe();

    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }
};
