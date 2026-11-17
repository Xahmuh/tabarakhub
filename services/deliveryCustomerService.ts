import { supabaseClient } from '../lib/supabaseClient';

export interface CustomerAddress {
  block_number: string | null;
  area_name: string | null;
  governorate: string | null;
  location_url: string | null;
  customer_address: string | null;
}

export interface DeliveryCustomer {
  phone: string;
  address_count: number;
  order_count: number;
  last_order_date: string;
}

export interface CustomerDeliveryOrder {
  id: string;
  order_number: string | null;
  order_date: string;
  value_bhd: number;
  branch_name: string | null;
  delivery_status: string;
  delivered_at: string | null;
  driver_name: string | null;
  recorded_driver_name: string | null;
  pharmacist_name: string | null;
}

export const CUSTOMER_PAGE_SIZE = 10;
const listPage = <T>(rows: T[]) => ({
  rows: rows.slice(0, CUSTOMER_PAGE_SIZE),
  hasNext: rows.length > CUSTOMER_PAGE_SIZE
});

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseClient.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const deliveryCustomerService = {
  lookup: (branchId: string, phone: string) =>
    rpc<CustomerAddress[]>('app_delivery_lookup_customer_addresses', { p_branch_id: branchId, p_phone: phone }),
  suggest: (branchId: string, prefix: string) =>
    rpc<{ last_digit: string }[]>('app_delivery_suggest_customer_numbers', { p_branch_id: branchId, p_prefix: prefix }),
  list: async (branchId: string | null, search: string, page: number) =>
    listPage(await rpc<DeliveryCustomer[]>('app_delivery_list_customers', {
      p_branch_id: branchId, p_search: search || null, p_offset: page * CUSTOMER_PAGE_SIZE
    })),
  addresses: (branchId: string | null, phone: string) =>
    rpc<CustomerAddress[]>('app_delivery_customer_log_addresses', { p_branch_id: branchId, p_phone: phone }),
  orders: async (branchId: string | null, phone: string, page: number) =>
    listPage(await rpc<CustomerDeliveryOrder[]>('app_delivery_customer_log_orders', {
      p_branch_id: branchId, p_phone: phone, p_offset: page * CUSTOMER_PAGE_SIZE
    }))
};
