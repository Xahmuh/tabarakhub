import { supabaseClient } from '@/lib/supabaseClient';

export type DashboardKPIs = {
  total_shortages: number;
  total_lost_sales: number;
  total_products: number;
  shortage_by_day: { date: string; count: number }[];
};

export async function getDashboardKPIs(
  branchId: string,
  dateFrom: string,
  dateTo: string
) {
  const { data, error } = await supabaseClient.rpc('get_dashboard_kpis', {
    p_branch_id: branchId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });

  if (error) throw error;
  return data as DashboardKPIs;
}
