import React, { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, Calendar, CheckCircle2, Clock, Filter, Fuel, ShieldAlert, Sparkles, Truck, Wrench, RefreshCw, ChevronRight, X, User } from 'lucide-react';
import { Vehicle, ExpenseTransaction } from '../../types';
import { expenseService } from '../../services/expenseService';
import { workforceService, Employee } from '../../services/workforceService';
import { calculateVehicleAlertStatus, VehicleAlertStatus, SERVICE_INTERVAL_KM } from './utils/vehicleAlertUtils';
import { BahrainLicensePlate } from './components/BahrainLicensePlate';

interface VehicleActionsManagerProps {
  onRecordMaintenance?: (vehicle: Vehicle) => void;
}

export const VehicleActionsManager: React.FC<VehicleActionsManagerProps> = ({ onRecordMaintenance }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [expenses, setExpenses] = useState<ExpenseTransaction[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'REGISTRATION' | 'MAINTENANCE'>('ALL');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Modal state for updating registration date
  const [updatingVehicle, setUpdatingVehicle] = useState<Vehicle | null>(null);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [savingDate, setSavingDate] = useState(false);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());

  const calculateOneYearLater = (currentDateStr?: string | null): string => {
    if (!currentDateStr) {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().split('T')[0];
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(currentDateStr)) {
      const parts = currentDateStr.split('-');
      const year = parseInt(parts[0], 10) + 1;
      return `${year}-${parts[1]}-${parts[2]}`;
    }
    const parsed = new Date(currentDateStr);
    if (!isNaN(parsed.getTime())) {
      parsed.setFullYear(parsed.getFullYear() + 1);
      return parsed.toISOString().split('T')[0];
    }
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vList, eList, empList] = await Promise.all([
        expenseService.vehicles.list(true),
        expenseService.expenses.list({}),
        workforceService.getAllEmployees()
      ]);
      setVehicles(vList);
      setExpenses(eList);
      setEmployees(empList);
    } catch (err) {
      console.error('Error fetching vehicle action data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAssignedStaffForVehicle = (vehicle: Vehicle): Employee[] => {
    if (!employees || employees.length === 0) return [];
    const vId = (vehicle.id || '').toLowerCase();
    const vCode = (vehicle.vehicleCode || '').toLowerCase();
    const vPlate = (vehicle.plateNumber || '').toLowerCase();

    return employees.filter(emp => {
      if (!emp.assigned_vehicles || emp.assigned_vehicles.length === 0) return false;
      return emp.assigned_vehicles.some(entry => {
        const eLower = entry.toLowerCase();
        return (
          (vId && eLower.includes(vId)) ||
          (vCode && eLower.includes(vCode)) ||
          (vPlate && eLower.includes(vPlate))
        );
      });
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const alertStatuses: VehicleAlertStatus[] = useMemo(() => {
    return vehicles.map(v => calculateVehicleAlertStatus(v, expenses));
  }, [vehicles, expenses]);

  // Statistics
  const activeVehicles = useMemo(() => {
    return vehicles.filter(v => (v.status || 'Active') === 'Active');
  }, [vehicles]);

  const activeFleetStats = useMemo(() => {
    const totalActive = activeVehicles.length;
    
    // Tabarak Owned (Internal)
    const tabarakOwned = activeVehicles.filter(v => v.ownershipType !== 'External');
    const tabarakMotorcycles = tabarakOwned.filter(v => (v.vehicleType || 'Motorcycle') === 'Motorcycle').length;
    const tabarakCars = tabarakOwned.filter(v => (v.vehicleType || '') !== 'Motorcycle').length;

    // External
    const externalVehicles = activeVehicles.filter(v => v.ownershipType === 'External').length;

    return {
      totalActive,
      tabarakOwnedTotal: tabarakOwned.length,
      tabarakMotorcycles,
      tabarakCars,
      externalVehicles
    };
  }, [activeVehicles]);

  const expiredCount = useMemo(() => alertStatuses.filter(s => s.registrationStatus === 'EXPIRED').length, [alertStatuses]);
  const expiringSoonCount = useMemo(() => alertStatuses.filter(s => s.registrationStatus === 'EXPIRING_SOON').length, [alertStatuses]);
  const maintenanceOverdueCount = useMemo(() => alertStatuses.filter(s => s.maintenanceStatus === 'OVERDUE').length, [alertStatuses]);
  const totalAlertsCount = expiredCount + expiringSoonCount + maintenanceOverdueCount;

  // Build Checklist Items
  const actionItems = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'REGISTRATION' | 'MAINTENANCE';
      severity: 'CRITICAL' | 'WARNING' | 'SCHEDULED';
      vehicle: Vehicle;
      status: VehicleAlertStatus;
      title: string;
      titleAr: string;
      description: string;
      descriptionAr: string;
      dueDateText?: string;
    }> = [];

    alertStatuses.forEach(s => {
      // Registration Action Item
      if (s.registrationStatus === 'EXPIRED') {
        list.push({
          id: `reg-${s.vehicle.id}`,
          type: 'REGISTRATION',
          severity: 'CRITICAL',
          vehicle: s.vehicle,
          status: s,
          title: `Renew Registration & Insurance: ${s.vehicle.plateNumber || s.vehicle.vehicleCode}`,
          titleAr: `تجديد الفحص والتأمين: ${s.vehicle.plateNumber || s.vehicle.vehicleCode}`,
          description: `Technical registration expired ${Math.abs(s.daysUntilExpiry || 0)} days ago. Immediate renewal required.`,
          descriptionAr: `انتهى الترخيص الفني منذ ${Math.abs(s.daysUntilExpiry || 0)} يوم. ينبغي التجديد فوراً لتفادي المخالفات.`,
          dueDateText: `Expired: ${s.vehicle.registrationExpiryDate}`
        });
      } else if (s.registrationStatus === 'EXPIRING_SOON') {
        list.push({
          id: `reg-${s.vehicle.id}`,
          type: 'REGISTRATION',
          severity: 'WARNING',
          vehicle: s.vehicle,
          status: s,
          title: `Upcoming Registration Renewal: ${s.vehicle.plateNumber || s.vehicle.vehicleCode}`,
          titleAr: `تجديد الترخيص قريب: ${s.vehicle.plateNumber || s.vehicle.vehicleCode}`,
          description: `Technical registration expires in ${s.daysUntilExpiry} days on ${s.vehicle.registrationExpiryDate}.`,
          descriptionAr: `ينتهي الترخيص الفني خلال ${s.daysUntilExpiry} يوم بتاريخ ${s.vehicle.registrationExpiryDate}.`,
          dueDateText: `Expires: ${s.vehicle.registrationExpiryDate}`
        });
      } else if (s.vehicle.registrationExpiryDate) {
        list.push({
          id: `reg-${s.vehicle.id}`,
          type: 'REGISTRATION',
          severity: 'SCHEDULED',
          vehicle: s.vehicle,
          status: s,
          title: `Scheduled Registration Renewal: ${s.vehicle.plateNumber || s.vehicle.vehicleCode}`,
          titleAr: `جدولة تجديد الترخيص: ${s.vehicle.plateNumber || s.vehicle.vehicleCode}`,
          description: `Technical registration scheduled for renewal on ${s.vehicle.registrationExpiryDate}.`,
          descriptionAr: `مجدول لتجديد الترخيص الفني بتاريخ ${s.vehicle.registrationExpiryDate}.`,
          dueDateText: `Scheduled: ${s.vehicle.registrationExpiryDate}`
        });
      }

      // Maintenance Action Item
      if (s.maintenanceStatus === 'OVERDUE') {
        list.push({
          id: `maint-${s.vehicle.id}`,
          type: 'MAINTENANCE',
          severity: 'CRITICAL',
          vehicle: s.vehicle,
          status: s,
          title: `Periodic Maintenance Overdue: ${s.vehicle.plateNumber || s.vehicle.vehicleCode}`,
          titleAr: `صيانة دورية متأخرة: ${s.vehicle.plateNumber || s.vehicle.vehicleCode}`,
          description: `Driven ${s.kmSinceLastService?.toLocaleString()} km since last service (Threshold: ${SERVICE_INTERVAL_KM.toLocaleString()} km).`,
          descriptionAr: `قطعت المركبة ${s.kmSinceLastService?.toLocaleString()} كم منذ آخر صيانة (الحد الموصى به: ${SERVICE_INTERVAL_KM.toLocaleString()} كم).`,
          dueDateText: `Odometer: ${s.latestOdometer?.toLocaleString()} km`
        });
      } else if (s.maintenanceStatus === 'DUE_SOON') {
        list.push({
          id: `maint-${s.vehicle.id}`,
          type: 'MAINTENANCE',
          severity: 'WARNING',
          vehicle: s.vehicle,
          status: s,
          title: `Service Due Soon: ${s.vehicle.plateNumber || s.vehicle.vehicleCode}`,
          titleAr: `اقتراب موعد الصيانة: ${s.vehicle.plateNumber || s.vehicle.vehicleCode}`,
          description: `Driven ${s.kmSinceLastService?.toLocaleString()} km. Close to ${SERVICE_INTERVAL_KM.toLocaleString()} km service threshold.`,
          descriptionAr: `قطعت المركبة ${s.kmSinceLastService?.toLocaleString()} كم. اقتربت من حد الصيانة الدورية.`,
          dueDateText: `Odometer: ${s.latestOdometer?.toLocaleString()} km`
        });
      }
    });

    return list;
  }, [alertStatuses]);

  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([new Date().getFullYear()]);
    vehicles.forEach(v => {
      if (v.registrationExpiryDate) {
        const y = parseInt(v.registrationExpiryDate.substring(0, 4), 10);
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [vehicles]);

  const monthlyRenewals = useMemo(() => {
    const months = [
      { key: '01', nameEn: 'Jan', nameAr: 'يناير' },
      { key: '02', nameEn: 'Feb', nameAr: 'فبراير' },
      { key: '03', nameEn: 'Mar', nameAr: 'مارس' },
      { key: '04', nameEn: 'Apr', nameAr: 'أبريل' },
      { key: '05', nameEn: 'May', nameAr: 'مايو' },
      { key: '06', nameEn: 'Jun', nameAr: 'يونيو' },
      { key: '07', nameEn: 'Jul', nameAr: 'يوليو' },
      { key: '08', nameEn: 'Aug', nameAr: 'أغسطس' },
      { key: '09', nameEn: 'Sep', nameAr: 'سبتمبر' },
      { key: '10', nameEn: 'Oct', nameAr: 'أكتوبر' },
      { key: '11', nameEn: 'Nov', nameAr: 'نوفمبر' },
      { key: '12', nameEn: 'Dec', nameAr: 'ديسمبر' }
    ];

    const now = new Date();
    const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
    const isCurrentCalendarYear = now.getFullYear() === selectedYear;

    return months.map(m => {
      const monthKey = `${selectedYear}-${m.key}`;
      const matchedVehicles = vehicles.filter(v => {
        if (!v.registrationExpiryDate) return false;
        return v.registrationExpiryDate.startsWith(monthKey);
      });

      const isCurrentMonth = isCurrentCalendarYear && m.key === currentMonthStr;
      const isPastMonth = isCurrentCalendarYear && parseInt(m.key, 10) < parseInt(currentMonthStr, 10);

      return {
        ...m,
        monthKey,
        count: matchedVehicles.length,
        vehicles: matchedVehicles,
        isCurrentMonth,
        isPastMonth
      };
    });
  }, [vehicles, selectedYear]);

  const filteredActionItems = useMemo(() => {
    return actionItems.filter(item => {
      if (filterType === 'REGISTRATION' && item.type !== 'REGISTRATION') return false;
      if (filterType === 'MAINTENANCE' && item.type !== 'MAINTENANCE') return false;

      if (selectedMonthKey) {
        if (!item.vehicle.registrationExpiryDate) return false;
        return item.vehicle.registrationExpiryDate.startsWith(selectedMonthKey);
      }

      // Default view when no month selected: show urgent items (CRITICAL & WARNING)
      return item.severity === 'CRITICAL' || item.severity === 'WARNING';
    });
  }, [actionItems, filterType, selectedMonthKey]);

  const handleUpdateExpiryDate = async () => {
    if (!updatingVehicle || !newExpiryDate) return;
    setSavingDate(true);
    try {
      await expenseService.vehicles.update(updatingVehicle.id, {
        registrationExpiryDate: newExpiryDate
      });
      setUpdatingVehicle(null);
      setNewExpiryDate('');
      await fetchData();
    } catch (err) {
      console.error('Failed to update registration date:', err);
      alert('Failed to update registration date.');
    } finally {
      setSavingDate(false);
    }
  };

  const toggleTaskCompleted = (taskId: string) => {
    setCompletedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <RefreshCw className="h-8 w-8 text-brand animate-spin mb-3" />
        <p className="text-sm font-bold text-slate-600">Analyzing vehicle alert status & action items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-brand/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                Vehicle Fleet Monitoring / متابعة الأسطول
              </span>
              {totalAlertsCount > 0 && (
                <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                  {totalAlertsCount} Action Required
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
              Vehicle Actions & Compliance / إجراءات وتنبيهات المركبات
            </h2>
            <p className="text-xs font-medium text-slate-300 mt-1 max-w-2xl">
              Auto-generated TO-DO list for technical registration renewals, insurance expiry, and periodic 5,000 km maintenance alerts.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/10 w-fit shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Status
          </button>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          {/* Active Fleet Breakdown Card */}
          <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Active Fleet / المركبات النشطة</p>
                <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
                  <Truck className="h-4 w-4 text-emerald-400" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-white">{activeFleetStats.totalActive}</p>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Active
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2">
              {/* Tabarak Owned */}
              <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-300">Tabarak Owned</span>
                  <span className="text-xs font-black text-white">{activeFleetStats.tabarakOwnedTotal}</span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-300 mt-1 font-semibold">
                  <span>🏍️ {activeFleetStats.tabarakMotorcycles} Bikes</span>
                  <span>🚗 {activeFleetStats.tabarakCars} Cars</span>
                </div>
              </div>

              {/* External */}
              <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-wider text-purple-300">External</span>
                  <span className="text-xs font-black text-white">{activeFleetStats.externalVehicles}</span>
                </div>
                <div className="text-[9px] text-slate-300 mt-1 font-semibold">
                  <span>⚡ External/Flexi</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Expired Registration / منتهي</p>
                <p className="text-2xl font-black text-rose-400 mt-0.5">{expiredCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Urgent technical renewal required</p>
              </div>
              <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center border border-rose-500/30">
                <ShieldAlert className="h-5 w-5 text-rose-400" />
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Expiring Soon (&lt; 30 Days)</p>
                <p className="text-2xl font-black text-amber-400 mt-0.5">{expiringSoonCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Registration expiring within a month</p>
              </div>
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Service Overdue (&gt; 5,000 km)</p>
                <p className="text-2xl font-black text-amber-300 mt-0.5">{maintenanceOverdueCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Periodic maintenance recommended</p>
              </div>
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30">
                <Wrench className="h-5 w-5 text-amber-300" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Registration Schedule Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-brand" />
                Monthly Renewal Breakdown / جدولة التجديد الشهرية للمركبات
              </h3>
              {selectedMonthKey && (
                <span className="bg-brand/10 text-brand border border-brand/20 text-xs font-black px-2.5 py-0.5 rounded-full">
                  Filtered by Month
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Monthly breakdown showing the number of vehicles requiring registration renewal each month. Click a month to filter the checklist below.
            </p>
          </div>

          {/* Year Selector & Reset */}
          <div className="flex items-center gap-2">
            {selectedMonthKey && (
              <button
                onClick={() => setSelectedMonthKey(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1"
              >
                <X className="h-3.5 w-3.5" /> Show All Months
              </button>
            )}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {availableYears.map(yr => (
                <button
                  key={yr}
                  onClick={() => { setSelectedYear(yr); setSelectedMonthKey(null); }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                    selectedYear === yr ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 12-Month Interactive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2.5">
          {monthlyRenewals.map(m => {
            const isSelected = selectedMonthKey === m.monthKey;
            const hasVehicles = m.count > 0;

            return (
              <button
                key={m.monthKey}
                onClick={() => {
                  if (isSelected) setSelectedMonthKey(null);
                  else setSelectedMonthKey(m.monthKey);
                }}
                className={`relative p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-between min-h-[96px] cursor-pointer group ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/30 shadow-md scale-102 z-10'
                    : hasVehicles
                    ? m.isPastMonth
                      ? 'bg-rose-50/60 border-rose-200 text-slate-900 hover:border-rose-400 hover:bg-rose-50 shadow-2xs'
                      : m.isCurrentMonth
                      ? 'bg-amber-50/80 border-amber-300 text-slate-900 hover:border-amber-400 shadow-2xs'
                      : 'bg-indigo-50/50 border-indigo-200 text-slate-900 hover:border-indigo-300 hover:bg-indigo-50'
                    : 'bg-white border-slate-150 text-slate-400 hover:bg-slate-50 hover:border-slate-200'
                }`}
              >
                {m.isCurrentMonth && (
                  <span className={`absolute -top-2 px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider ${
                    isSelected ? 'bg-white text-slate-900' : 'bg-amber-500 text-white shadow-2xs'
                  }`}>
                    Current
                  </span>
                )}

                <div className="mt-1">
                  <span className={`block text-xs font-black uppercase ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                    {m.nameEn}
                  </span>
                  <span className={`block text-[10px] font-bold ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                    {m.nameAr}
                  </span>
                </div>

                <div className="mt-2 mb-1">
                  <span
                    className={`inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-xs font-black transition-transform group-hover:scale-110 ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-xs'
                        : hasVehicles
                        ? m.isPastMonth
                          ? 'bg-rose-500 text-white shadow-2xs'
                          : m.isCurrentMonth
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-150 text-slate-400'
                    }`}
                  >
                    {m.count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* TO-DO Checklist Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/50">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand" />
              Vehicle TO-DO Checklist / قائمة المهام الإجرائية
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated action list generated based on registration dates and fuel odometer logs.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex bg-slate-200/70 p-1 rounded-xl gap-1 shrink-0">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterType === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({actionItems.length})
            </button>
            <button
              onClick={() => setFilterType('REGISTRATION')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterType === 'REGISTRATION' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Registrations ({actionItems.filter(i => i.type === 'REGISTRATION').length})
            </button>
            <button
              onClick={() => setFilterType('MAINTENANCE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterType === 'MAINTENANCE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Maintenance ({actionItems.filter(i => i.type === 'MAINTENANCE').length})
            </button>
          </div>
        </div>

        {/* Action Item Cards */}
        <div className="p-6 space-y-4">
          {filteredActionItems.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <h4 className="text-base font-black text-slate-900">All Vehicles Compliant & Up to Date!</h4>
              <p className="text-xs text-slate-500 mt-1">No pending registration renewals or overdue maintenance tasks.</p>
            </div>
          ) : (
            filteredActionItems.map(item => {
              const isCompleted = completedTaskIds.has(item.id);
              const isCritical = item.severity === 'CRITICAL';
              const isWarning = item.severity === 'WARNING';
              const assignedStaff = getAssignedStaffForVehicle(item.vehicle);

              return (
                <div
                  key={item.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isCompleted
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : isCritical
                      ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                      : isWarning
                      ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                      : 'bg-indigo-50/40 border-indigo-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleTaskCompleted(item.id)}
                        className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : isCritical
                            ? 'border-rose-400 bg-white hover:bg-rose-50'
                            : isWarning
                            ? 'border-amber-400 bg-white hover:bg-amber-50'
                            : 'border-indigo-400 bg-white hover:bg-indigo-50'
                        }`}
                        title={isCompleted ? 'Mark as incomplete' : 'Mark as completed'}
                      >
                        {isCompleted && <CheckCircle2 className="h-4 w-4" />}
                      </button>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <BahrainLicensePlate plateNumber={item.vehicle.plateNumber} size="sm" />
                          <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            Code: {item.vehicle.vehicleCode}
                          </span>
                          {item.vehicle.ownershipType === 'External' && (
                            <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider shadow-xs shadow-orange-500/20">
                              ⚡ Flexi
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              isCritical
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : isWarning
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            }`}
                          >
                            {item.severity}
                          </span>
                        </div>

                        <h4 className={`text-sm font-black ${isCompleted ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {item.titleAr} / {item.title}
                        </h4>
                        <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                          {item.descriptionAr}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1 font-semibold flex items-center gap-2">
                          <span>{item.description}</span>
                          {item.dueDateText && <span className="font-bold text-slate-600">• {item.dueDateText}</span>}
                        </p>

                        {/* Assigned Driver Badge */}
                        <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-200/60 text-xs">
                          <span className="text-[11px] font-extrabold text-slate-500 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            Assigned Driver / السائق:
                          </span>
                          {assignedStaff.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {assignedStaff.map(staff => (
                                <span
                                  key={staff.id}
                                  className="inline-flex items-center gap-1 bg-emerald-100/70 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-md border border-emerald-200/80 text-[11px] shadow-2xs"
                                >
                                  {staff.full_name} <span className="text-emerald-600 font-bold">({staff.code})</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium italic text-[11px] bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/50">
                              Unassigned / غير مسند لسائق
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end lg:self-center flex-wrap">
                      {item.type === 'REGISTRATION' && (
                        <button
                          onClick={() => {
                            const autoNextYear = calculateOneYearLater(item.vehicle.registrationExpiryDate);
                            setUpdatingVehicle(item.vehicle);
                            setNewExpiryDate(autoNextYear);
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-600/20"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                          Confirm Renewal (+1 Year) / تأكيد التجديد
                        </button>
                      )}

                      {item.type === 'MAINTENANCE' && (
                        <button
                          onClick={() => onRecordMaintenance && onRecordMaintenance(item.vehicle)}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          Record Service Expense / تسجيل صيانة
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal to update registration expiry date */}
      {updatingVehicle && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Update Technical Registration Date</h3>
                <p className="text-xs text-slate-500 mt-0.5">تحديث وتأكيد تاريخ انتهاء فحص المركبة</p>
              </div>
              <BahrainLicensePlate plateNumber={updatingVehicle.plateNumber} size="sm" />
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">Vehicle Code:</span>
                <span className="font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{updatingVehicle.vehicleCode}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">Current Expiry:</span>
                <span className="font-bold text-rose-600">{updatingVehicle.registrationExpiryDate || 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">New Calculated Expiry:</span>
                <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{newExpiryDate || 'Select Date'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    New Technical Registration Expiry Date *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const autoNextYear = calculateOneYearLater(updatingVehicle.registrationExpiryDate);
                      setNewExpiryDate(autoNextYear);
                    }}
                    className="text-[10px] font-bold text-brand hover:underline"
                  >
                    +1 Year from current
                  </button>
                </div>
                <input
                  type="date"
                  value={newExpiryDate}
                  onChange={e => setNewExpiryDate(e.target.value)}
                  className="w-full text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUpdatingVehicle(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingDate || !newExpiryDate}
                  onClick={handleUpdateExpiryDate}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50"
                >
                  {savingDate ? 'Saving...' : 'Confirm Registration Renewal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
