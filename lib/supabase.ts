import { authService } from '../services/authService';
import { branchService } from '../services/branchService';
import { pharmacistService } from '../services/pharmacistService';
import { permissionService } from '../services/permissionService';
import { saleService } from '../services/saleService';
import { hrService } from '../services/hrService';
import { financeService } from '../services/financeService';
import { codexService } from '../services/codexService';
import { systemSettingsService } from '../services/systemSettingsService';
import { deliveryService } from '../services/deliveryService';
import { benefitPayService } from '../services/benefitPayService';
import { branchLoginApprovalService } from '../services/branchLoginApprovalService';
import { supabaseClient } from './supabaseClient';
export { supabaseClient } from './supabaseClient';

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
  codex: codexService,
  systemSettings: systemSettingsService,
  delivery: deliveryService,
  benefitPay: benefitPayService,
  branchLoginApprovals: branchLoginApprovalService
};
