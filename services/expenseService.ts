import { supabaseClient } from '../lib/supabaseClient';
import {
  ExpenseCategory,
  ExpenseTransaction,
  ExpenseTransactionInput,
  ExpenseFilters,
  ExpenseDashboardKpis,
  HighestExpenseVehicle,
  ExpenseCalendarDay,
  BranchExpenseRanking,
  Branch,
  FuelExpenseDetail,
  Vehicle,
  VehicleOdometerHistory
} from '../types';
import { toBhdStorageValue } from '../utils/money';
import { calculateVehicleAlertStatus } from '../app/operational-expenses/utils/vehicleAlertUtils';

// --- Mappers ---

const toCategory = (row: any): ExpenseCategory => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  displayOrder: row.display_order,
  isActive: row.is_active
});

const toVehicle = (row: any): Vehicle => ({
  id: row.id,
  vehicleCode: row.vehicle_code,
  vehicleType: row.vehicle_type || 'Motorcycle',
  ownershipType: row.ownership_type || 'Internal',
  plateNumber: row.plate_number || undefined,
  crNumber: row.cr_number || undefined,
  registrationExpiryDate: row.registration_expiry_date || undefined,
  initialOdometer: Number(row.initial_odometer || 0),
  status: row.status || 'Active',
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toOdometerHistory = (row: any): VehicleOdometerHistory => ({
  id: row.id,
  vehicleId: row.vehicle_id,
  odometerReading: Number(row.odometer_reading || 0),
  readingDate: row.reading_date,
  readingTime: row.reading_time || undefined,
  sourceType: row.source_type,
  sourceReferenceId: row.source_reference_id || undefined,
  driverId: row.driver_id || undefined,
  driverName: row.driver?.name || row.expense?.driver?.name || undefined,
  branchId: row.branch_id || undefined,
  branchName: row.branch?.name || row.expense?.branch?.name || undefined,
  branchCode: row.branch?.code || row.expense?.branch?.code || undefined,
  amount: row.expense?.amount !== undefined && row.expense?.amount !== null ? Number(row.expense.amount) : undefined,
  location: (row.branch?.name || row.expense?.branch?.name)
    ? `${row.branch?.name || row.expense?.branch?.name} (${row.branch?.code || row.expense?.branch?.code || ''})`
    : undefined,
  notes: row.notes || undefined,
  createdBy: row.created_by || undefined,
  createdAt: row.created_at
});

const toFuelDetail = (row: any): FuelExpenseDetail => ({
  id: row.id,
  expenseId: row.expense_id,
  vehicleId: row.vehicle_id,
  driverId: row.driver_id || undefined,
  previousOdometer: Number(row.previous_odometer || 0),
  currentOdometer: Number(row.current_odometer || 0),
  distanceSincePrevious: Number(row.distance_since_previous || 0),
  liters: row.liters ? Number(row.liters) : undefined,
  fuelPricePerLiter: row.fuel_price_per_liter ? Number(row.fuel_price_per_liter) : undefined,
  createdAt: row.created_at
});

const EXPENSE_SELECT = `
  *,
  branch:branches!expense_transactions_branch_id_fkey(code, name),
  category:expense_categories!expense_transactions_category_id_fkey(name, slug),
  vehicle:vehicles(vehicle_code, plate_number, ownership_type),
  driver:delivery_drivers!expense_transactions_driver_id_fkey(name),
  fuel_detail:fuel_expense_details(*)
`;

const toExpense = (row: any): ExpenseTransaction => ({
  id: row.id,
  referenceNo: row.reference_no,
  branchId: row.branch_id,
  branchCode: row.branch?.code || undefined,
  branchName: row.branch?.name || undefined,
  categoryId: row.category_id,
  categoryName: row.category?.name || undefined,
  categorySlug: row.category?.slug || undefined,
  expenseDate: row.expense_date,
  expenseTime: row.expense_time || undefined,
  amount: Number(row.amount || 0),
  currency: row.currency || 'BHD',
  status: row.status || 'Active',
  description: row.description || undefined,
  paidTo: row.paid_to || undefined,
  driverId: row.driver_id || undefined,
  driverName: row.driver?.name || undefined,
  vehicleId: row.vehicle_id || undefined,
  vehicleCode: row.vehicle?.vehicle_code || undefined,
  plateNumber: row.vehicle?.plate_number || undefined,
  ownershipType: row.vehicle?.ownership_type || 'Internal',
  receiptUrl: row.receipt_url || undefined,
  receiptProvidedToAccounts: !!row.receipt_provided_to_accounts,
  receiptProvidedAt: row.receipt_provided_at || undefined,
  receiptProvidedBy: row.receipt_provided_by || undefined,
  createdBy: row.created_by || undefined,
  createdAt: row.created_at,
  updatedBy: row.updated_by || undefined,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at || undefined,
  fuelDetails: row.fuel_detail?.[0] ? toFuelDetail(row.fuel_detail[0])
    : row.fuel_detail && !Array.isArray(row.fuel_detail) ? toFuelDetail(row.fuel_detail)
    : undefined
});

const normalizeBhd = (value: number | string | null | undefined) => toBhdStorageValue(value);

const resolveValidBranchId = async (providedBranchId: string): Promise<string> => {
  if (!providedBranchId) {
    const { data: firstBranch } = await supabaseClient
      .from('branches')
      .select('id')
      .limit(1)
      .maybeSingle();
    return firstBranch?.id || providedBranchId;
  }

  const { data: byId } = await supabaseClient
    .from('branches')
    .select('id')
    .eq('id', providedBranchId)
    .maybeSingle();

  if (byId) return byId.id;

  const { data: byCode } = await supabaseClient
    .from('branches')
    .select('id')
    .ilike('code', providedBranchId)
    .maybeSingle();

  if (byCode) return byCode.id;

  const { data: firstBranch } = await supabaseClient
    .from('branches')
    .select('id')
    .limit(1)
    .maybeSingle();

  return firstBranch?.id || providedBranchId;
};

// --- Service ---

export const expenseService = {
  categories: {
    list: async (): Promise<ExpenseCategory[]> => {
      const { data, error } = await supabaseClient
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return (data || []).map(toCategory);
    }
  },

  vehicles: {
    list: async (includeInactive = false): Promise<Vehicle[]> => {
      let query = supabaseClient.from('vehicles').select('*').order('vehicle_code');
      if (!includeInactive) query = query.eq('status', 'Active');
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(toVehicle);
    },

    create: async (input: { vehicleCode?: string; vehicleType: string; ownershipType?: string; plateNumber: string; crNumber?: string; registrationExpiryDate?: string; initialOdometer: number }): Promise<Vehicle> => {
      const { data: session } = await supabaseClient.auth.getSession();
      
      let code = input.vehicleCode?.trim().toUpperCase();
      if (!code) {
        const { data: existingCodes } = await supabaseClient.from('vehicles').select('vehicle_code');
        let maxNum = (existingCodes || []).length;
        (existingCodes || []).forEach(row => {
          const m = /^V-(\d+)$/i.exec(row.vehicle_code || '');
          if (m) {
            const num = parseInt(m[1], 10);
            if (num > maxNum) maxNum = num;
          }
        });
        code = `V-${String(maxNum + 1).padStart(3, '0')}`;
      }

      const payload = {
        vehicle_code: code,
        vehicle_type: input.vehicleType,
        ownership_type: input.ownershipType || 'Internal',
        plate_number: input.plateNumber?.trim() || null,
        cr_number: input.crNumber?.trim() || null,
        registration_expiry_date: input.registrationExpiryDate || null,
        initial_odometer: input.initialOdometer,
        status: 'Active'
      };
      let { data, error } = await supabaseClient
        .from('vehicles')
        .insert([payload])
        .select()
        .single();
      if (error && (error.message?.includes('ownership_type') || error.details?.includes('ownership_type'))) {
        delete (payload as any).ownership_type;
        const retry = await supabaseClient
          .from('vehicles')
          .insert([payload])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }
      if (error) throw error;

      // Create initial odometer history record
      await supabaseClient.from('vehicle_odometer_history').insert([{
        vehicle_id: data.id,
        odometer_reading: input.initialOdometer,
        reading_date: new Date().toISOString().split('T')[0],
        source_type: 'INITIAL',
        created_by: session.session?.user?.id || null
      }]);

      return toVehicle(data);
    },

    update: async (id: string, input: Partial<{ vehicleCode: string; vehicleType: string; ownershipType: string; plateNumber: string; crNumber: string; registrationExpiryDate: string; initialOdometer: number; status: string }>): Promise<Vehicle> => {
      const payload: any = { updated_at: new Date().toISOString() };
      if (input.vehicleCode !== undefined) payload.vehicle_code = input.vehicleCode.trim().toUpperCase();
      if (input.vehicleType !== undefined) payload.vehicle_type = input.vehicleType;
      if (input.ownershipType !== undefined) payload.ownership_type = input.ownershipType;
      if (input.plateNumber !== undefined) payload.plate_number = input.plateNumber.trim() || null;
      if (input.crNumber !== undefined) payload.cr_number = input.crNumber.trim() || null;
      if (input.registrationExpiryDate !== undefined) payload.registration_expiry_date = input.registrationExpiryDate || null;
      if (input.initialOdometer !== undefined) payload.initial_odometer = input.initialOdometer;
      if (input.status !== undefined) payload.status = input.status;

      let { data, error } = await supabaseClient
        .from('vehicles')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error && (error.message?.includes('ownership_type') || error.details?.includes('ownership_type'))) {
        delete payload.ownership_type;
        const retry = await supabaseClient
          .from('vehicles')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      return toVehicle(data);
    },

    delete: async (id: string): Promise<void> => {
      // 1. Delete associated odometer history records
      try {
        await supabaseClient
          .from('vehicle_odometer_history')
          .delete()
          .eq('vehicle_id', id);
      } catch (e) {
        console.warn('Odometer history cleanup skipped:', e);
      }

      // 2. Set vehicle_id to NULL in fuel_expense_details
      try {
        await supabaseClient
          .from('fuel_expense_details')
          .update({ vehicle_id: null })
          .eq('vehicle_id', id);
      } catch (e) {
        console.warn('Fuel expense details cleanup skipped:', e);
      }

      // 3. Set vehicle_id to NULL in expense_transactions
      try {
        await supabaseClient
          .from('expense_transactions')
          .update({ vehicle_id: null })
          .eq('vehicle_id', id);
      } catch (e) {
        console.warn('Expense transactions cleanup skipped:', e);
      }

      // 4. Hard delete vehicle record from Supabase database with .select() confirmation
      const { data, error } = await supabaseClient
        .from('vehicles')
        .delete()
        .eq('id', id)
        .select();

      if (error) {
        console.error('Error deleting vehicle from database:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn(`Vehicle ${id} was not deleted by Supabase query (0 rows affected). Check RLS policies.`);
      }
    },

    getLatestOdometer: async (vehicleId: string): Promise<number> => {
      const { data, error } = await supabaseClient
        .from('vehicle_odometer_history')
        .select('odometer_reading')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) return Number(data.odometer_reading);

      // Fallback to vehicle initial odometer
      const { data: veh } = await supabaseClient
        .from('vehicles')
        .select('initial_odometer')
        .eq('id', vehicleId)
        .maybeSingle();

      return veh ? Number(veh.initial_odometer || 0) : 0;
    },

    getLatestOdometerDetails: async (vehicleId: string): Promise<{ reading: number; date: string | null; driverId?: string }> => {
      const { data, error } = await supabaseClient
        .from('vehicle_odometer_history')
        .select('odometer_reading, reading_date, driver_id, created_at')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return {
          reading: Number(data.odometer_reading),
          date: data.reading_date || data.created_at || null,
          driverId: data.driver_id || undefined
        };
      }

      // Fallback to vehicle initial_odometer
      const { data: veh } = await supabaseClient
        .from('vehicles')
        .select('initial_odometer, created_at')
        .eq('id', vehicleId)
        .maybeSingle();

      if (veh) {
        return {
          reading: Number(veh.initial_odometer || 0),
          date: veh.created_at || null
        };
      }

      return { reading: 0, date: null };
    },

    getOdometerHistory: async (vehicleId: string): Promise<VehicleOdometerHistory[]> => {
      // 1. Fetch raw odometer history rows
      const { data: odoData, error: odoError } = await supabaseClient
        .from('vehicle_odometer_history')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });

      if (odoError) {
        console.error('Error fetching vehicle_odometer_history:', odoError);
      }

      const rawOdoRows = odoData || [];

      // 2. Fetch all expense transactions linked to this vehicle
      const { data: expData, error: expError } = await supabaseClient
        .from('expense_transactions')
        .select(`
          id, amount, description, reference_no, expense_date, expense_time, created_at,
          category:expense_categories!expense_transactions_category_id_fkey(name, slug),
          driver:delivery_drivers!expense_transactions_driver_id_fkey(name),
          branch:branches!expense_transactions_branch_id_fkey(name, code),
          fuel_detail:fuel_expense_details(*)
        `)
        .eq('vehicle_id', vehicleId)
        .is('deleted_at', null)
        .order('expense_date', { ascending: false });

      if (expError) {
        console.error('Error fetching vehicle expense_transactions:', expError);
      }

      const expenseRows = expData || [];
      const expenseMap: Record<string, any> = {};
      expenseRows.forEach((e: any) => { expenseMap[e.id] = e; });

      const historyMap = new Map<string, VehicleOdometerHistory>();

      // A. Process odometer history entries
      rawOdoRows.forEach((r: any) => {
        const exp = r.source_reference_id ? expenseMap[r.source_reference_id] : null;
        const historyItem: VehicleOdometerHistory = {
          id: r.id,
          vehicleId: r.vehicle_id,
          odometerReading: Number(r.odometer_reading || 0),
          readingDate: r.reading_date || r.created_at,
          readingTime: r.reading_time || undefined,
          sourceType: r.source_type || 'MANUAL',
          sourceReferenceId: r.source_reference_id || undefined,
          driverId: r.driver_id || exp?.driver?.id || undefined,
          driverName: exp?.driver?.name || undefined,
          branchId: r.branch_id || exp?.branch?.id || undefined,
          branchName: exp?.branch?.name || undefined,
          branchCode: exp?.branch?.code || undefined,
          amount: exp ? Number(exp.amount || 0) : undefined,
          notes: exp ? `${exp.reference_no} - ${exp.category?.name || ''} (${exp.description || ''})` : (r.source_type === 'INITIAL' ? 'Initial Odometer' : undefined),
          createdAt: r.created_at
        };
        historyMap.set(r.id, historyItem);
      });

      // B. Process expense transactions for this vehicle that might not be in odometer history
      expenseRows.forEach((exp: any) => {
        const alreadyLinked = rawOdoRows.some((r: any) => r.source_reference_id === exp.id);
        if (!alreadyLinked) {
          const fuelDetail = exp.fuel_detail?.[0] || (exp.fuel_detail && !Array.isArray(exp.fuel_detail) ? exp.fuel_detail : null);
          const odoReading = fuelDetail ? Number(fuelDetail.current_odometer || 0) : 0;
          const historyItem: VehicleOdometerHistory = {
            id: `exp-${exp.id}`,
            vehicleId: vehicleId,
            odometerReading: odoReading,
            readingDate: exp.expense_date || exp.created_at,
            readingTime: exp.expense_time || undefined,
            sourceType: exp.category?.slug === 'fuel' ? 'FUEL_EXPENSE' : 'EXPENSE',
            sourceReferenceId: exp.id,
            driverId: exp.driver?.id || undefined,
            driverName: exp.driver?.name || undefined,
            branchId: exp.branch?.id || undefined,
            branchName: exp.branch?.name || undefined,
            branchCode: exp.branch?.code || undefined,
            amount: Number(exp.amount || 0),
            notes: `${exp.reference_no} - ${exp.category?.name || 'Expense'} (${exp.description || ''})`,
            createdAt: exp.created_at
          };
          historyMap.set(`exp-${exp.id}`, historyItem);
        }
      });

      // C. If no INITIAL record exists in historyMap, synthesize an INITIAL record from vehicle initial_odometer
      const hasInitial = Array.from(historyMap.values()).some(item => item.sourceType === 'INITIAL');
      if (!hasInitial) {
        const { data: veh } = await supabaseClient
          .from('vehicles')
          .select('initial_odometer, created_at')
          .eq('id', vehicleId)
          .maybeSingle();

        if (veh) {
          const initOdo = Number(veh.initial_odometer || 0);
          historyMap.set(`initial-${vehicleId}`, {
            id: `initial-${vehicleId}`,
            vehicleId: vehicleId,
            odometerReading: initOdo,
            readingDate: veh.created_at ? veh.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            sourceType: 'INITIAL',
            notes: 'Initial Odometer',
            createdAt: veh.created_at || new Date().toISOString()
          });
        }
      }

      // Sort all records chronologically from oldest to newest (ASC), with INITIAL always first (#1)
      const result = Array.from(historyMap.values()).sort((a, b) => {
        if (a.sourceType === 'INITIAL' && b.sourceType !== 'INITIAL') return -1;
        if (b.sourceType === 'INITIAL' && a.sourceType !== 'INITIAL') return 1;
        const dateA = new Date(a.readingDate || a.createdAt).getTime();
        const dateB = new Date(b.readingDate || b.createdAt).getTime();
        return dateA - dateB;
      });

      return result;
    },

    getAlertsSummary: async (): Promise<{ totalAlerts: number; expiredCount: number; expiringSoonCount: number; overdueMaintenanceCount: number }> => {
      try {
        const [vehicles, expenses] = await Promise.all([
          expenseService.vehicles.list(true),
          expenseService.expenses.list({})
        ]);
        const statuses = vehicles.map(v => calculateVehicleAlertStatus(v, expenses));
        const expiredCount = statuses.filter(s => s.registrationStatus === 'EXPIRED').length;
        const expiringSoonCount = statuses.filter(s => s.registrationStatus === 'EXPIRING_SOON').length;
        const overdueMaintenanceCount = statuses.filter(s => s.maintenanceStatus === 'OVERDUE').length;
        const totalAlerts = expiredCount + expiringSoonCount + overdueMaintenanceCount;
        return { totalAlerts, expiredCount, expiringSoonCount, overdueMaintenanceCount };
      } catch (err) {
        console.warn('Failed to calculate vehicle alerts summary:', err);
        return { totalAlerts: 0, expiredCount: 0, expiringSoonCount: 0, overdueMaintenanceCount: 0 };
      }
    }
  },

  expenses: {
    list: async (filters: ExpenseFilters = {}): Promise<ExpenseTransaction[]> => {
      let query = supabaseClient.from('expense_transactions').select(EXPENSE_SELECT).is('deleted_at', null);
      if (filters.branchId && filters.branchId !== 'all') query = query.eq('branch_id', filters.branchId);
      if (filters.dateFrom) query = query.gte('expense_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('expense_date', filters.dateTo);
      if (filters.categoryId && filters.categoryId !== 'all') query = query.eq('category_id', filters.categoryId);
      if (filters.driverId && filters.driverId !== 'all') query = query.eq('driver_id', filters.driverId);
      if (filters.vehicleId && filters.vehicleId !== 'all') query = query.eq('vehicle_id', filters.vehicleId);
      const { data, error } = await query
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []).map(toExpense);
    },

    getById: async (id: string): Promise<ExpenseTransaction | null> => {
      const { data, error } = await supabaseClient
        .from('expense_transactions')
        .select(EXPENSE_SELECT)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? toExpense(data) : null;
    },

    create: async (input: ExpenseTransactionInput): Promise<ExpenseTransaction> => {
      const { data: session } = await supabaseClient.auth.getSession();
      const userId = session.session?.user?.id || null;

      // Get category slug to determine if fuel
      const { data: category } = await supabaseClient
        .from('expense_categories')
        .select('slug')
        .eq('id', input.categoryId)
        .maybeSingle();

      const isFuel = category?.slug === 'fuel';

      // Validate fuel requirements
      if (isFuel) {
        if (!input.vehicleId) throw new Error('Please select a vehicle.');
        if (!input.driverId) throw new Error('Please select a driver.');
        if (input.currentOdometer === undefined || input.currentOdometer === null) throw new Error('Current odometer is required.');
      }

      // Get last odometer for fuel
      let previousOdometer = 0;
      if (isFuel && input.vehicleId) {
        previousOdometer = await expenseService.vehicles.getLatestOdometer(input.vehicleId);
        if (input.currentOdometer! < previousOdometer) {
          throw new Error('Current odometer cannot be lower than the last recorded reading.');
        }
      }

      // Resolve valid branch ID in database
      const branchId = await resolveValidBranchId(input.branchId);

      // Generate atomic reference number
      const { data: refNo, error: refError } = await supabaseClient.rpc(
        'app_expense_next_reference_no' as any,
        { p_branch_id: branchId, p_expense_date: input.expenseDate }
      );
      if (refError) throw refError;

      const now = new Date();
      const expenseTime = input.expenseTime || now.toTimeString().slice(0, 5);
      const amount = Number(normalizeBhd(input.amount));

      // Insert expense transaction
      const payload = {
        reference_no: refNo as string,
        branch_id: branchId,
        category_id: input.categoryId,
        expense_date: input.expenseDate,
        expense_time: expenseTime,
        amount: normalizeBhd(input.amount),
        currency: 'BHD',
        description: input.description?.trim() || null,
        paid_to: input.paidTo?.trim() || null,
        driver_id: isFuel ? input.driverId : null,
        vehicle_id: isFuel ? input.vehicleId : null,
        receipt_url: input.receiptUrl || null,
        receipt_provided_to_accounts: input.receiptProvidedToAccounts || false,
        receipt_provided_at: input.receiptProvidedToAccounts ? now.toISOString() : null,
        receipt_provided_by: input.receiptProvidedToAccounts ? userId : null,
        created_by: input.createdBy?.trim() || userId
      };

      const { data: insertedRows, error } = await supabaseClient
        .from('expense_transactions')
        .insert([payload])
        .select(EXPENSE_SELECT);

      if (error) throw error;
      const data = insertedRows && insertedRows.length > 0 ? insertedRows[0] : null;
      if (!data) throw new Error('Failed to record expense. Please try again.');

      // Create fuel details and odometer history
      if (isFuel && input.vehicleId) {
        const distance = (input.currentOdometer || 0) - previousOdometer;
        await supabaseClient.from('fuel_expense_details').insert([{
          expense_id: data.id,
          vehicle_id: input.vehicleId,
          driver_id: input.driverId,
          previous_odometer: previousOdometer,
          current_odometer: input.currentOdometer,
          distance_since_previous: distance,
          liters: input.liters || null,
          fuel_price_per_liter: input.fuelPricePerLiter || null
        }]);

        await supabaseClient.from('vehicle_odometer_history').insert([{
          vehicle_id: input.vehicleId,
          odometer_reading: input.currentOdometer,
          reading_date: input.expenseDate,
          reading_time: expenseTime,
          source_type: 'FUEL_EXPENSE',
          source_reference_id: data.id,
          driver_id: input.driverId,
          branch_id: input.branchId,
          created_by: userId
        }]);
      }

      return toExpense(data);
    },

    update: async (id: string, input: Partial<ExpenseTransactionInput>): Promise<ExpenseTransaction> => {
      const { data: session } = await supabaseClient.auth.getSession();
      const userId = session.session?.user?.id || null;

      const payload: any = {
        updated_by: userId,
        updated_at: new Date().toISOString()
      };

      if (input.branchId !== undefined) payload.branch_id = input.branchId;
      if (input.expenseDate !== undefined) payload.expense_date = input.expenseDate;
      if (input.expenseTime !== undefined) payload.expense_time = input.expenseTime;
      if (input.categoryId !== undefined) payload.category_id = input.categoryId;
      if (input.driverId !== undefined) payload.driver_id = input.driverId;
      if (input.vehicleId !== undefined) payload.vehicle_id = input.vehicleId;
      if (input.createdBy !== undefined) payload.created_by = input.createdBy?.trim() || null;
      if (input.amount !== undefined) payload.amount = normalizeBhd(input.amount);
      if (input.description !== undefined) payload.description = input.description?.trim() || null;
      if (input.paidTo !== undefined) payload.paid_to = input.paidTo?.trim() || null;
      if (input.receiptUrl !== undefined) payload.receipt_url = input.receiptUrl || null;
      if (input.receiptProvidedToAccounts !== undefined) {
        payload.receipt_provided_to_accounts = input.receiptProvidedToAccounts;
        if (input.receiptProvidedToAccounts) {
          payload.receipt_provided_at = new Date().toISOString();
          payload.receipt_provided_by = userId;
        }
      }

      const { data: updatedRows, error } = await supabaseClient
        .from('expense_transactions')
        .update(payload)
        .eq('id', id)
        .select(EXPENSE_SELECT);

      if (error) throw error;
      const data = updatedRows && updatedRows.length > 0 ? updatedRows[0] : null;
      if (!data) throw new Error('Failed to update expense. Please try again.');

      // Update fuel odometer if changed
      if (input.currentOdometer !== undefined && data.vehicle_id) {
        const { data: fuelDetail } = await supabaseClient
          .from('fuel_expense_details')
          .select('id, previous_odometer')
          .eq('expense_id', id)
          .maybeSingle();

        if (fuelDetail) {
          const prevOdo = Number(fuelDetail.previous_odometer || 0);
          if (input.currentOdometer < prevOdo) {
            throw new Error('Current odometer cannot be lower than the last recorded reading.');
          }
          const distance = input.currentOdometer - prevOdo;
          await supabaseClient
            .from('fuel_expense_details')
            .update({
              current_odometer: input.currentOdometer,
              distance_since_previous: distance,
              liters: input.liters || null,
              fuel_price_per_liter: input.fuelPricePerLiter || null
            })
            .eq('id', fuelDetail.id);

          // Update odometer history
          const odoUpdate: any = {};
          if (input.currentOdometer !== undefined) odoUpdate.odometer_reading = input.currentOdometer;
          if (input.branchId !== undefined) odoUpdate.branch_id = input.branchId;

          if (Object.keys(odoUpdate).length > 0) {
            await supabaseClient
              .from('vehicle_odometer_history')
              .update(odoUpdate)
              .eq('source_reference_id', id)
              .eq('source_type', 'FUEL_EXPENSE');
          }
        }
      }

      return toExpense(data);
    },

    cancel: async (id: string): Promise<ExpenseTransaction> => {
      const { data: session } = await supabaseClient.auth.getSession();
      const userId = session.session?.user?.id || null;

      const { data, error } = await supabaseClient
        .from('expense_transactions')
        .update({
          status: 'Cancelled',
          updated_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(EXPENSE_SELECT)
        .single();

      if (error) throw error;
      return toExpense(data);
    },

    delete: async (id: string): Promise<boolean> => {
      // Clean up related odometer entry if fuel expense
      await supabaseClient
        .from('vehicle_odometer_history')
        .delete()
        .eq('source_reference_id', id);

      // Soft delete expense transaction
      const { error } = await supabaseClient
        .from('expense_transactions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return true;
    },

    toggleReceiptProvided: async (id: string, provided: boolean): Promise<ExpenseTransaction> => {
      const { data: session } = await supabaseClient.auth.getSession();
      const userId = session.session?.user?.id || null;
      const payload: any = {
        receipt_provided_to_accounts: provided,
        updated_by: userId,
        updated_at: new Date().toISOString()
      };
      if (provided) {
        payload.receipt_provided_at = new Date().toISOString();
        payload.receipt_provided_by = userId;
      }

      const { data, error } = await supabaseClient
        .from('expense_transactions')
        .update(payload)
        .eq('id', id)
        .select(EXPENSE_SELECT)
        .single();
      if (error) throw error;
      return toExpense(data);
    },

    getDashboardKpis: async (filters: ExpenseFilters = {}): Promise<ExpenseDashboardKpis> => {
      const getLocalYmd = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const today = new Date();
      const todayStr = getLocalYmd(today);

      // Get first day of week (Sunday)
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekStartStr = getLocalYmd(weekStart);

      // Get first & last day of current month
      const monthStartStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const monthEndStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

      // Build query
      let q = supabaseClient
        .from('expense_transactions')
        .select(`
          expense_date, 
          amount, 
          vehicle_id, 
          category:expense_categories!expense_transactions_category_id_fkey(slug), 
          receipt_provided_to_accounts,
          vehicle:vehicles(vehicle_code, plate_number),
          fuel_detail:fuel_expense_details(distance_since_previous, liters)
        `)
        .is('deleted_at', null)
        .neq('status', 'Cancelled');

      if (filters.dateFrom) q = q.gte('expense_date', filters.dateFrom);
      if (filters.dateTo) q = q.lte('expense_date', filters.dateTo);
      if (!filters.dateFrom && !filters.dateTo) {
        q = q.gte('expense_date', monthStartStr).lte('expense_date', monthEndStr);
      }

      if (filters.branchId && filters.branchId !== 'all') q = q.eq('branch_id', filters.branchId);

      const { data: monthData, error } = await q;
      if (error) throw error;

      const rows = monthData || [];
      let todayTotal = 0, weekTotal = 0, monthTotal = 0;
      let fuelTotal = 0, vehicleServicesTotal = 0, maintenanceTotal = 0, suppliesTotal = 0, otherTotal = 0;
      let receiptsPending = 0;
      let totalDistanceKm = 0;
      let totalFuelLiters = 0;
      const vehicleTotals: Record<string, { vehicleId: string; vehicleCode: string; plateNumber?: string; totalExpense: number }> = {};

      rows.forEach((row: any) => {
        const amt = Number(row.amount || 0);
        const slug = row.category?.slug || 'other';
        const expDate = row.expense_date || '';

        monthTotal += amt;
        if (expDate >= weekStartStr && expDate <= todayStr) weekTotal += amt;
        if (expDate === todayStr) todayTotal += amt;

        switch (slug) {
          case 'fuel': fuelTotal += amt; break;
          case 'vehicle_services': vehicleServicesTotal += amt; break;
          case 'maintenance': maintenanceTotal += amt; break;
          case 'supplies': suppliesTotal += amt; break;
          default: otherTotal += amt;
        }

        if (!row.receipt_provided_to_accounts) receiptsPending++;

        // Track vehicle total expenses
        if (row.vehicle_id) {
          const vId = row.vehicle_id;
          if (!vehicleTotals[vId]) {
            const vCode = row.vehicle?.vehicle_code || 'V-???';
            const pNum = row.vehicle?.plate_number || undefined;
            vehicleTotals[vId] = { vehicleId: vId, vehicleCode: vCode, plateNumber: pNum, totalExpense: 0 };
          }
          vehicleTotals[vId].totalExpense += amt;
        }

        // Fuel details (distance & liters)
        const fDetail = Array.isArray(row.fuel_detail) ? row.fuel_detail[0] : row.fuel_detail;
        if (fDetail) {
          const dist = Number(fDetail.distance_since_previous || 0);
          const ltrs = Number(fDetail.liters || 0);
          if (dist > 0) totalDistanceKm += dist;
          if (ltrs > 0) totalFuelLiters += ltrs;
        }
      });

      // Highest Expense Vehicle
      let highestExpenseVehicle: HighestExpenseVehicle | undefined = undefined;
      Object.values(vehicleTotals).forEach(v => {
        if (!highestExpenseVehicle || v.totalExpense > highestExpenseVehicle.totalExpense) {
          highestExpenseVehicle = v;
        }
      });

      // Average Calculations
      const avgCostPerKm = totalDistanceKm > 0 ? (fuelTotal + vehicleServicesTotal) / totalDistanceKm : 0;
      const avgConsumptionPer100Km = totalDistanceKm > 0 ? (totalFuelLiters / totalDistanceKm) * 100 : 0;

      // Determine date window for current & previous period
      const activeStartStr = filters.dateFrom || monthStartStr;
      const activeEndStr = filters.dateTo || monthEndStr;

      const startDateObj = new Date(activeStartStr + 'T00:00:00');
      const endDateObj = new Date(activeEndStr + 'T00:00:00');
      const durationMs = endDateObj.getTime() - startDateObj.getTime();
      const daysDiff = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)) + 1);

      const prevEndObj = new Date(startDateObj);
      prevEndObj.setDate(prevEndObj.getDate() - 1);
      const prevStartObj = new Date(prevEndObj);
      prevStartObj.setDate(prevStartObj.getDate() - daysDiff + 1);

      const prevStartStr = getLocalYmd(prevStartObj);
      const prevEndStr = getLocalYmd(prevEndObj);

      // Query previous period for comparison
      let prevQ = supabaseClient
        .from('expense_transactions')
        .select(`
          amount, 
          category:expense_categories!expense_transactions_category_id_fkey(slug), 
          fuel_detail:fuel_expense_details(distance_since_previous, liters)
        `)
        .is('deleted_at', null)
        .neq('status', 'Cancelled')
        .gte('expense_date', prevStartStr)
        .lte('expense_date', prevEndStr);

      if (filters.branchId && filters.branchId !== 'all') prevQ = prevQ.eq('branch_id', filters.branchId);

      const { data: prevData } = await prevQ;
      const prevRows = prevData || [];

      let prevTotalExpenses = 0;
      let prevFuelTotal = 0;
      let prevVehicleServicesTotal = 0;
      let prevTotalDistanceKm = 0;
      let prevTotalFuelLiters = 0;

      prevRows.forEach((row: any) => {
        const amt = Number(row.amount || 0);
        const slug = row.category?.slug || 'other';

        prevTotalExpenses += amt;
        if (slug === 'fuel') prevFuelTotal += amt;
        if (slug === 'vehicle_services') prevVehicleServicesTotal += amt;

        const fDetail = Array.isArray(row.fuel_detail) ? row.fuel_detail[0] : row.fuel_detail;
        if (fDetail) {
          const dist = Number(fDetail.distance_since_previous || 0);
          const ltrs = Number(fDetail.liters || 0);
          if (dist > 0) prevTotalDistanceKm += dist;
          if (ltrs > 0) prevTotalFuelLiters += ltrs;
        }
      });

      const prevAvgCostPerKm = prevTotalDistanceKm > 0 ? (prevFuelTotal + prevVehicleServicesTotal) / prevTotalDistanceKm : 0;
      const prevAvgConsumptionPer100Km = prevTotalDistanceKm > 0 ? (prevTotalFuelLiters / prevTotalDistanceKm) * 100 : 0;

      const calcChangePct = (curr: number, prev: number): number | undefined => {
        if (prev <= 0) return undefined;
        return Number((((curr - prev) / prev) * 100).toFixed(1));
      };

      return {
        totalExpenses: Number(monthTotal.toFixed(3)),
        todayTotal: Number(todayTotal.toFixed(3)),
        weekTotal: Number(weekTotal.toFixed(3)),
        monthTotal: Number(monthTotal.toFixed(3)),
        fuelTotal: Number(fuelTotal.toFixed(3)),
        vehicleServicesTotal: Number(vehicleServicesTotal.toFixed(3)),
        maintenanceTotal: Number(maintenanceTotal.toFixed(3)),
        suppliesTotal: Number(suppliesTotal.toFixed(3)),
        otherTotal: Number(otherTotal.toFixed(3)),
        transactionCount: rows.length,
        receiptsPending,
        totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
        totalFuelLiters: Number(totalFuelLiters.toFixed(1)),
        avgCostPerKm: Number(avgCostPerKm.toFixed(3)),
        avgConsumptionPer100Km: Number(avgConsumptionPer100Km.toFixed(1)),
        highestExpenseVehicle,
        prevPeriodLabel: `${prevStartStr} to ${prevEndStr}`,
        totalExpensesChangePct: calcChangePct(monthTotal, prevTotalExpenses),
        fuelTotalChangePct: calcChangePct(fuelTotal, prevFuelTotal),
        avgCostPerKmChangePct: calcChangePct(avgCostPerKm, prevAvgCostPerKm),
        avgConsumptionChangePct: calcChangePct(avgConsumptionPer100Km, prevAvgConsumptionPer100Km)
      };
    },

    getCalendarTotals: async (year: number, month: number, filters: ExpenseFilters = {}): Promise<ExpenseCalendarDay[]> => {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      let query = supabaseClient
        .from('expense_transactions')
        .select('expense_date, amount')
        .is('deleted_at', null)
        .neq('status', 'Cancelled')
        .gte('expense_date', from)
        .lte('expense_date', to);
      if (filters.branchId && filters.branchId !== 'all') query = query.eq('branch_id', filters.branchId);

      const { data, error } = await query;
      if (error) throw error;

      const totals: Record<string, { total: number; count: number }> = {};
      (data || []).forEach((row: any) => {
        const key = row.expense_date;
        if (!totals[key]) totals[key] = { total: 0, count: 0 };
        totals[key].total += Number(row.amount || 0);
        totals[key].count++;
      });

      return Object.entries(totals).map(([date, { total, count }]) => ({
        date,
        total: Number(total.toFixed(3)),
        count
      }));
    },

    getDayExpenses: async (date: string, filters: ExpenseFilters = {}): Promise<ExpenseTransaction[]> => {
      let query = supabaseClient
        .from('expense_transactions')
        .select(EXPENSE_SELECT)
        .is('deleted_at', null)
        .neq('status', 'Cancelled')
        .eq('expense_date', date);
      if (filters.branchId && filters.branchId !== 'all') query = query.eq('branch_id', filters.branchId);

      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(toExpense);
    },

    getBranchExpenseRankings: async (year: number, month: number, filters: ExpenseFilters = {}, allBranches: Branch[] = []): Promise<BranchExpenseRanking[]> => {
      const defaultFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const defaultTo = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      let query = supabaseClient
        .from('expense_transactions')
        .select('branch_id, amount, branch:branches(id, code, name)')
        .is('deleted_at', null)
        .neq('status', 'Cancelled');

      if (filters.dateFrom) query = query.gte('expense_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('expense_date', filters.dateTo);
      if (!filters.dateFrom && !filters.dateTo) {
        query = query.gte('expense_date', defaultFrom).lte('expense_date', defaultTo);
      }

      if (filters.branchId && filters.branchId !== 'all') {
        query = query.eq('branch_id', filters.branchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const branchMap: Record<string, { branchId: string; branchCode: string; branchName: string; total: number; count: number }> = {};

      if (allBranches.length > 0) {
        allBranches.forEach(b => {
          if (!filters.branchId || filters.branchId === 'all' || filters.branchId === b.id) {
            branchMap[b.id] = {
              branchId: b.id,
              branchCode: b.code,
              branchName: b.name,
              total: 0,
              count: 0
            };
          }
        });
      }

      let overallTotal = 0;

      (data || []).forEach((row: any) => {
        const amt = Number(row.amount || 0);
        const bId = row.branch_id || 'unknown';
        const bCode = row.branch?.code || 'N/A';
        const bName = row.branch?.name || 'Unknown Branch';

        if (!branchMap[bId]) {
          branchMap[bId] = {
            branchId: bId,
            branchCode: bCode,
            branchName: bName,
            total: 0,
            count: 0
          };
        }
        branchMap[bId].total += amt;
        branchMap[bId].count += 1;
        overallTotal += amt;
      });

      const sorted = Object.values(branchMap).sort((a, b) => b.total - a.total);

      return sorted.map(item => ({
        ...item,
        total: Number(item.total.toFixed(3)),
        percentage: overallTotal > 0 ? Number(((item.total / overallTotal) * 100).toFixed(1)) : 0
      }));
    },
  },

  receipts: {
    upload: async (file: File, expenseId: string): Promise<string> => {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${expenseId}/${Date.now()}.${ext}`;
      const { error } = await supabaseClient.storage
        .from('expense-receipts')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabaseClient.storage
        .from('expense-receipts')
        .getPublicUrl(path);
      return urlData.publicUrl;
    }
  }
};
