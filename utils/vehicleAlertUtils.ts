import { Vehicle, ExpenseTransaction } from '../types';

export interface VehicleAlertStatus {
  vehicle: Vehicle;
  registrationStatus: 'EXPIRED' | 'EXPIRING_SOON' | 'VALID' | 'NO_DATE';
  daysUntilExpiry: number | null;
  lastServiceDate?: string;
  lastServiceOdometer?: number;
  latestOdometer?: number;
  kmSinceLastService?: number;
  maintenanceStatus: 'OVERDUE' | 'DUE_SOON' | 'OK';
  hasAlert: boolean;
}

export const SERVICE_INTERVAL_KM = 5000;
export const WARNING_KM = 4500;

export const calculateVehicleAlertStatus = (
  vehicle: Vehicle,
  expenses: ExpenseTransaction[] = []
): VehicleAlertStatus => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Registration Expiry Status
  let registrationStatus: 'EXPIRED' | 'EXPIRING_SOON' | 'VALID' | 'NO_DATE' = 'NO_DATE';
  let daysUntilExpiry: number | null = null;

  if (vehicle.registrationExpiryDate) {
    const expDate = new Date(vehicle.registrationExpiryDate + 'T00:00:00');
    daysUntilExpiry = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      registrationStatus = 'EXPIRED';
    } else if (daysUntilExpiry <= 30) {
      registrationStatus = 'EXPIRING_SOON';
    } else {
      registrationStatus = 'VALID';
    }
  }

  // 2. Maintenance Status based on fuel/service expenses
  const vehicleExpenses = expenses.filter(
    e => (e.vehicleId === vehicle.id || e.plateNumber === vehicle.plateNumber || e.vehicleCode === vehicle.vehicleCode) && e.status !== 'Cancelled'
  );

  // Find last vehicle service expense
  const serviceExpenses = vehicleExpenses.filter(e => e.categorySlug === 'vehicle_services');
  const lastService = serviceExpenses.sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())[0];

  // Find latest odometer reading
  const fuelWithOdo = vehicleExpenses.filter(e => e.fuelDetails?.currentOdometer);
  const latestOdoExp = fuelWithOdo.sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())[0];
  const latestOdometer = latestOdoExp?.fuelDetails?.currentOdometer || vehicle.initialOdometer || 0;

  // Calculate km since last service
  const lastServiceOdometer = lastService?.fuelDetails?.currentOdometer || vehicle.initialOdometer || 0;
  const kmSinceLastService = Math.max(0, latestOdometer - lastServiceOdometer);

  let maintenanceStatus: 'OVERDUE' | 'DUE_SOON' | 'OK' = 'OK';
  if (kmSinceLastService >= SERVICE_INTERVAL_KM) {
    maintenanceStatus = 'OVERDUE';
  } else if (kmSinceLastService >= WARNING_KM) {
    maintenanceStatus = 'DUE_SOON';
  }

  const hasAlert = registrationStatus === 'EXPIRED' || registrationStatus === 'EXPIRING_SOON' || maintenanceStatus === 'OVERDUE' || maintenanceStatus === 'DUE_SOON';

  return {
    vehicle,
    registrationStatus,
    daysUntilExpiry,
    lastServiceDate: lastService?.expenseDate,
    lastServiceOdometer,
    latestOdometer,
    kmSinceLastService,
    maintenanceStatus,
    hasAlert
  };
};
