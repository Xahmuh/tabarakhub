// ============================================================================
// VEHICLES & OPERATIONAL EXPENSES TYPES
// ============================================================================

export type VehicleOwnershipType = 'Internal' | 'External';

export interface Vehicle {
  id: string;
  vehicleCode: string;
  vehicleType: string;
  ownershipType?: VehicleOwnershipType;
  plateNumber?: string;
  crNumber?: string;
  registrationExpiryDate?: string;
  initialOdometer: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VehicleOdometerHistory {
  id: string;
  vehicleId: string;
  odometerReading: number;
  readingDate: string;
  readingTime?: string;
  sourceType: string;
  sourceReferenceId?: string;
  driverId?: string;
  driverName?: string;
  branchId?: string;
  branchName?: string;
  branchCode?: string;
  amount?: number;
  location?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface FuelExpenseDetail {
  id: string;
  expenseId: string;
  vehicleId: string;
  driverId?: string;
  previousOdometer: number;
  currentOdometer: number;
  distanceSincePrevious: number;
  liters?: number;
  fuelPricePerLiter?: number;
  createdAt?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  isActive: boolean;
}

export interface ExpenseTransaction {
  id: string;
  referenceNo: string;
  branchId: string;
  branchCode?: string;
  branchName?: string;
  categoryId: string;
  categoryName?: string;
  categorySlug?: string;
  expenseDate: string;
  expenseTime?: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  paidTo?: string;
  driverId?: string;
  driverName?: string;
  vehicleId?: string;
  vehicleCode?: string;
  plateNumber?: string;
  ownershipType?: VehicleOwnershipType;
  receiptUrl?: string;
  receiptProvidedToAccounts: boolean;
  receiptProvidedAt?: string;
  receiptProvidedBy?: string;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  deletedAt?: string;
  fuelDetails?: FuelExpenseDetail;
}

export interface ExpenseTransactionInput {
  branchId: string;
  categoryId: string;
  expenseDate: string;
  expenseTime?: string;
  amount: number;
  currency?: string;
  description?: string;
  paidTo?: string;
  driverId?: string;
  vehicleId?: string;
  receiptUrl?: string;
  receiptProvidedToAccounts?: boolean;
  createdBy?: string;
  currentOdometer?: number;
  liters?: number;
  fuelPricePerLiter?: number;
  fuelDetails?: {
    currentOdometer: number;
    liters?: number;
    fuelPricePerLiter?: number;
  };
}

export interface ExpenseFilters {
  branchId?: string;
  categoryId?: string;
  vehicleId?: string;
  driverId?: string;
  startDate?: string;
  endDate?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  status?: string;
  receiptPending?: boolean;
}

export interface HighestExpenseVehicle {
  vehicleId: string;
  vehicleCode: string;
  plateNumber?: string;
  totalExpense: number;
}

export interface ExpenseDashboardKpis {
  totalExpenses: number;
  totalCount?: number;
  transactionCount?: number;
  fuelTotal: number;
  maintenanceTotal: number;
  suppliesTotal: number;
  vehicleServicesTotal: number;
  otherTotal: number;
  todayTotal?: number;
  weekTotal?: number;
  monthTotal?: number;
  receiptsPending?: number;
  receiptsPendingCount?: number;
  totalDistanceKm: number;
  totalFuelLiters: number;
  avgCostPerKm: number;
  avgLitersPer100Km?: number;
  avgConsumptionPer100Km?: number;
  prevPeriodLabel?: string;
  totalExpensesChangePct?: number;
  fuelTotalChangePct?: number;
  avgCostPerKmChangePct?: number;
  avgConsumptionChangePct?: number;
  highestExpenseVehicle?: HighestExpenseVehicle;
}

export interface ExpenseCalendarDay {
  date: string;
  dayOfMonth?: number;
  dayOfWeek?: number;
  total?: number;
  count?: number;
  totalAmount?: number;
  transactionCount?: number;
  isCurrentMonth?: boolean;
  isToday?: boolean;
  }

export interface BranchExpenseRanking {
  branchId: string;
  branchCode: string;
  branchName: string;
  total?: number;
  count?: number;
  totalAmount?: number;
  transactionCount?: number;
  percentage: number;
}

// ============================================================================
// AUTOMATED DUTY SCHEDULER TYPES (Spec v1.0)
// ============================================================================
