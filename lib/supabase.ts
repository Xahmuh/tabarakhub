import { createClient } from '@supabase/supabase-js';
import { authService } from '../services/authService';
import { branchService } from '../services/branchService';
import { pharmacistService } from '../services/pharmacistService';
import { permissionService } from '../services/permissionService';
import { saleService } from '../services/saleService';
import { hrService } from '../services/hrService';
import { financeService } from '../services/financeService';
import { codexService } from '../services/codexService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing in .env - falling back to offline seeds.");
}

export const supabaseClient = createClient(supabaseUrl || '', supabaseAnonKey || '');

/**
 * @deprecated Use individual services from @/services instead.
 * This object is maintained for backward compatibility during refactoring.
 */
export const supabase = {
  client: supabaseClient,
  auth: authService,
  branches: branchService,
  pharmacists: pharmacistService,
  permissions: permissionService,
  products: saleService.products,
  manualProducts: saleService.manualProducts,
  sales: saleService.sales,
  shortages: saleService.shortages,
  hrRequests: hrService,
  cashFlow: financeService.cashFlow,
  cashDifferences: financeService.cashDifferences,
  codex: codexService
};
