import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, CheckSquare, Clock, Download, Edit2, FileSpreadsheet, FileText, Info, Link2, MapPin, Plus, PowerOff, Save, Search, ShieldAlert, Square, Trash2, Truck, Upload, User, Users, X } from 'lucide-react';
import { Vehicle, VehicleOdometerHistory, VehicleOwnershipType } from '../../types';
import { expenseService } from '../../services/expenseService';
import { workforceService, Employee } from '../../services/workforceService';
import { formatBhdWithCurrency } from '../../utils/money';
import { exportVehicleOdometerToExcel } from './utils/exportExpenses';
import { downloadVehicleCsvTemplate, exportVehiclesToCsv } from './utils/vehicleCsvUtils';
import { VehicleCsvImportModal } from './VehicleCsvImportModal';
import { PaginationControls } from '../shared';
import { BahrainLicensePlate } from './components/BahrainLicensePlate';

const HISTORY_PAGE_SIZE = 25;

export const VehicleManager: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [odometerHistory, setOdometerHistory] = useState<VehicleOdometerHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [showImportModal, setShowImportModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'Motorcycle' | 'Car'>('ALL');
  const [filterOwnership, setFilterOwnership] = useState<'ALL' | 'Internal' | 'External'>('ALL');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Form state
  const [vehicleCode, setVehicleCode] = useState('');
  const [vehicleType, setVehicleType] = useState('Motorcycle');
  const [ownershipType, setOwnershipType] = useState<VehicleOwnershipType>('Internal');
  const [plateNumber, setPlateNumber] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [registrationExpiryDate, setRegistrationExpiryDate] = useState('');
  const [initialOdometer, setInitialOdometer] = useState('0');
  const [saving, setSaving] = useState(false);

  // Staff assignment form state
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      expenseService.vehicles.list(true).catch(() => []),
      workforceService.getAllEmployees().catch(() => [])
    ])
      .then(([vehs, emps]) => {
        setVehicles(vehs);
        setEmployees(emps);
        resetForm(vehs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Helper to find employees assigned to a given vehicle
  const getLinkedEmployeesForVehicle = (vehicle: Vehicle | null): Employee[] => {
    if (!vehicle || !employees || employees.length === 0) return [];
    const pPlate = (vehicle.plateNumber || '').trim().toUpperCase();
    const pCode = (vehicle.vehicleCode || '').trim().toUpperCase();

    return employees.filter(emp => {
      if (!emp.assigned_vehicles || emp.assigned_vehicles.length === 0) return false;
      return emp.assigned_vehicles.some(vTag => {
        const tagUpper = vTag.trim().toUpperCase();
        return (
          (pPlate && (tagUpper === pPlate || tagUpper.includes(pPlate) || pPlate.includes(tagUpper))) ||
          (pCode && (tagUpper === pCode || tagUpper.includes(pCode) || pCode.includes(tagUpper)))
        );
      });
    });
  };

  useEffect(() => {
    if (selectedVehicle) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedVehicle]);

  const handleSelectVehicle = async (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setHistoryLoading(true);
    setHistoryPage(1);
    try {
      const history = await expenseService.vehicles.getOdometerHistory(vehicle.id);
      setOdometerHistory(history);
    } catch (e) { console.error(e); }
    finally { setHistoryLoading(false); }
  };

  const chronologicalHistory = useMemo(() => {
    return [...odometerHistory].sort((a, b) => {
      if (a.sourceType === 'INITIAL' && b.sourceType !== 'INITIAL') return -1;
      if (b.sourceType === 'INITIAL' && a.sourceType !== 'INITIAL') return 1;
      const dateA = new Date(a.readingDate || a.createdAt).getTime();
      const dateB = new Date(b.readingDate || b.createdAt).getTime();
      return dateA - dateB;
    });
  }, [odometerHistory]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const query = searchTerm.toLowerCase().trim();
      const linked = getLinkedEmployeesForVehicle(v);
      const matchEmp = linked.some(
        emp => emp.code.toLowerCase().includes(query) || emp.full_name.toLowerCase().includes(query)
      );

      const matchSearch = !query ||
        (v.plateNumber || '').toLowerCase().includes(query) ||
        (v.vehicleCode || '').toLowerCase().includes(query) ||
        (v.crNumber || '').toLowerCase().includes(query) ||
        matchEmp;

      const vType = (v.vehicleType || '').toLowerCase();
      const matchType = filterType === 'ALL' ||
        (filterType === 'Motorcycle' && (vType.includes('motorcycle') || vType.includes('bike'))) ||
        (filterType === 'Car' && !vType.includes('motorcycle') && !vType.includes('bike'));

      const vOwnership = v.ownershipType || 'Internal';
      const matchOwnership = filterOwnership === 'ALL' || vOwnership === filterOwnership;

      return matchSearch && matchType && matchOwnership;
    });
  }, [vehicles, searchTerm, filterType, filterOwnership, employees]);

  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return chronologicalHistory.slice(start, start + HISTORY_PAGE_SIZE);
  }, [chronologicalHistory, historyPage]);

  const totalVehicleExpenses = useMemo(() => {
    return odometerHistory.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [odometerHistory]);

  const latestOdometerReading = useMemo(() => {
    const recordWithOdo = odometerHistory.find(item => item.odometerReading > 0);
    if (recordWithOdo) return recordWithOdo.odometerReading;
    return selectedVehicle?.initialOdometer || 0;
  }, [odometerHistory, selectedVehicle]);

  const generateNextVehicleCode = (list: Vehicle[]) => {
    let maxNum = list.length;
    list.forEach(v => {
      const match = /^V-(\d+)$/i.exec(v.vehicleCode || '');
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `V-${String(maxNum + 1).padStart(3, '0')}`;
  };

  const resetForm = (currentVehicles: Vehicle[] = vehicles) => {
    setVehicleCode(generateNextVehicleCode(currentVehicles));
    setVehicleType('Motorcycle');
    setOwnershipType('Internal');
    setPlateNumber('');
    setCrNumber('');
    setRegistrationExpiryDate('');
    setInitialOdometer('0');
    setEditVehicle(null);
    setSelectedStaffIds([]);
    setStaffSearchTerm('');
    setStaffDropdownOpen(false);
    setError(null);
  };

  const openEdit = (vehicle: Vehicle) => {
    setEditVehicle(vehicle);
    setVehicleCode(vehicle.vehicleCode);
    setVehicleType(vehicle.vehicleType);
    setOwnershipType(vehicle.ownershipType || 'Internal');
    setPlateNumber(vehicle.plateNumber || '');
    setCrNumber(vehicle.crNumber || '');
    setRegistrationExpiryDate(vehicle.registrationExpiryDate || '');
    setInitialOdometer(vehicle.initialOdometer?.toString() || '0');

    // Pre-populate linked staff members
    const linkedEmps = getLinkedEmployeesForVehicle(vehicle);
    setSelectedStaffIds(linkedEmps.map(e => e.id));
    setStaffSearchTerm('');
    setStaffDropdownOpen(false);

    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      let savedVehicle: Vehicle;
      if (editVehicle) {
        savedVehicle = await expenseService.vehicles.update(editVehicle.id, {
          vehicleCode,
          vehicleType,
          ownershipType,
          plateNumber,
          crNumber,
          registrationExpiryDate,
          initialOdometer: Number(initialOdometer) || 0,
          status: editVehicle.status
        });
        setVehicles(prev => prev.map(v => v.id === savedVehicle.id ? savedVehicle : v));
      } else {
        savedVehicle = await expenseService.vehicles.create({
          vehicleCode,
          vehicleType,
          ownershipType,
          plateNumber,
          crNumber,
          registrationExpiryDate,
          initialOdometer: Number(initialOdometer) || 0
        });
        setVehicles(prev => [...prev, savedVehicle]);
      }

      // Sync vehicle assignment with workforce employees
      const vehicleTag = (savedVehicle.plateNumber || savedVehicle.vehicleCode || '').trim().toUpperCase();
      if (vehicleTag && employees.length > 0) {
        for (const emp of employees) {
          const isSelected = selectedStaffIds.includes(emp.id);
          const currentVehs = emp.assigned_vehicles || [];
          const isCurrentlyAssigned = currentVehs.some(v => v.trim().toUpperCase() === vehicleTag);

          if (isSelected && !isCurrentlyAssigned) {
            const updatedVehs = [...currentVehs, vehicleTag];
            emp.assigned_vehicles = updatedVehs;
            try {
              await workforceService.saveEmployee(emp, emp.assignments || []);
            } catch (err) {
              console.warn(`Failed to link vehicle ${vehicleTag} to employee ${emp.code}:`, err);
            }
          } else if (!isSelected && isCurrentlyAssigned) {
            const updatedVehs = currentVehs.filter(v => v.trim().toUpperCase() !== vehicleTag);
            emp.assigned_vehicles = updatedVehs;
            try {
              await workforceService.saveEmployee(emp, emp.assignments || []);
            } catch (err) {
              console.warn(`Failed to unlink vehicle ${vehicleTag} from employee ${emp.code}:`, err);
            }
          }
        }
        // Refresh employees list
        const freshEmps = await workforceService.getAllEmployees().catch(() => []);
        if (freshEmps.length > 0) setEmployees(freshEmps);
      }

      resetForm();
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save vehicle.');
    } finally {
      setSaving(false);
    }
  };

  // Decision Modal State for Deactivate vs Permanent Delete
  const [vehicleToAction, setVehicleToAction] = useState<Vehicle | null>(null);
  const [checkingData, setCheckingData] = useState(false);
  const [linkedInfo, setLinkedInfo] = useState<{
    employees: Employee[];
    odometerCount: number;
    expenseCount: number;
  } | null>(null);
  const [executingAction, setExecutingAction] = useState(false);

  const openActionModal = async (vehicle: Vehicle) => {
    setVehicleToAction(vehicle);
    setCheckingData(true);
    setLinkedInfo(null);
    try {
      const linkedEmps = getLinkedEmployeesForVehicle(vehicle);
      const odoLogs = await expenseService.vehicles.getOdometerHistory(vehicle.id).catch(() => []);
      
      const expCount = await expenseService.vehicles.getExpenseTransactionCount(vehicle.id);

      setLinkedInfo({
        employees: linkedEmps,
        odometerCount: odoLogs.length,
        expenseCount: expCount
      });
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingData(false);
    }
  };

  const handleDeactivateChoice = async () => {
    if (!vehicleToAction) return;
    setExecutingAction(true);
    try {
      const newStatus = vehicleToAction.status === 'Active' ? 'Inactive' : 'Active';
      const updated = await expenseService.vehicles.update(vehicleToAction.id, { status: newStatus });
      setVehicles(prev => prev.map(v => v.id === updated.id ? updated : v));
      setVehicleToAction(null);
      setLinkedInfo(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update vehicle status.');
    } finally {
      setExecutingAction(false);
    }
  };

  const handlePermanentDeleteChoice = async () => {
    if (!vehicleToAction) return;
    setExecutingAction(true);
    try {
      // 1. Hard delete vehicle record from database
      await expenseService.vehicles.delete(vehicleToAction.id);

      // 2. Un-assign vehicle from workforce employees
      const plateNorm = (vehicleToAction.plateNumber || '').trim().toUpperCase();
      const codeNorm = (vehicleToAction.vehicleCode || '').trim().toUpperCase();
      const linkedEmps = linkedInfo?.employees || getLinkedEmployeesForVehicle(vehicleToAction);

      for (const emp of linkedEmps) {
        const updatedVehicles = (emp.assigned_vehicles || []).filter(vTag => {
          const tUpper = vTag.trim().toUpperCase();
          const isMatch = (plateNorm && (tUpper === plateNorm || tUpper.includes(plateNorm) || plateNorm.includes(tUpper))) ||
                          (codeNorm && (tUpper === codeNorm || tUpper.includes(codeNorm) || codeNorm.includes(tUpper)));
          return !isMatch;
        });
        await workforceService.saveEmployee({ ...emp, assigned_vehicles: updatedVehicles }).catch(console.error);
      }

      // 3. Refresh vehicles list directly from DB to guarantee local state matches DB reality
      const freshList = await expenseService.vehicles.list(true).catch(() => null);
      if (freshList) {
        setVehicles(freshList);
      } else {
        setVehicles(prev => prev.filter(v => v.id !== vehicleToAction.id));
      }

      if (selectedVehicle?.id === vehicleToAction.id) {
        setSelectedVehicle(null);
        setOdometerHistory([]);
      }

      // Refresh employees list
      workforceService.getAllEmployees().then(setEmployees).catch(console.error);

      setVehicleToAction(null);
      setLinkedInfo(null);
    } catch (err: any) {
      alert(err.message || 'Failed to permanently delete vehicle.');
    } finally {
      setExecutingAction(false);
    }
  };

  const handleToggleStatus = async (vehicle: Vehicle) => {
    const newStatus = vehicle.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const updated = await expenseService.vehicles.update(vehicle.id, { status: newStatus });
      setVehicles(prev => prev.map(v => v.id === updated.id ? updated : v));
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    openActionModal(vehicle);
  };

  // Bulk Selection State & Handlers
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const isAllSelected = filteredVehicles.length > 0 && selectedIds.length === filteredVehicles.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredVehicles.map(v => v.id));
    }
  };

  const toggleSelectVehicleId = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const confirmMsg = `⚠️ ARE YOU SURE YOU WANT TO PERMANENTLY DELETE ${count} SELECTED VEHICLE(S)?\n\nThis will completely wipe them from Supabase database and un-link any assigned workforce drivers. This action cannot be undone!`;
    if (!window.confirm(confirmMsg)) return;

    setExecutingAction(true);
    let deletedCount = 0;
    let failCount = 0;

    try {
      const selectedVehicles = vehicles.filter(v => selectedIds.includes(v.id));

      for (const v of selectedVehicles) {
        try {
          await expenseService.vehicles.delete(v.id);
          deletedCount++;

          const plateNorm = (v.plateNumber || '').trim().toUpperCase();
          const codeNorm = (v.vehicleCode || '').trim().toUpperCase();
          const linkedEmps = getLinkedEmployeesForVehicle(v);

          for (const emp of linkedEmps) {
            const updatedVehicles = (emp.assigned_vehicles || []).filter(vTag => {
              const tUpper = vTag.trim().toUpperCase();
              const isMatch = (plateNorm && (tUpper === plateNorm || tUpper.includes(plateNorm) || plateNorm.includes(tUpper))) ||
                              (codeNorm && (tUpper === codeNorm || tUpper.includes(codeNorm) || codeNorm.includes(tUpper)));
              return !isMatch;
            });
            await workforceService.saveEmployee({ ...emp, assigned_vehicles: updatedVehicles }).catch(console.error);
          }
        } catch (err) {
          console.error(`Failed to delete vehicle ${v.vehicleCode}:`, err);
          failCount++;
        }
      }

      // Re-fetch fresh vehicle list from DB
      const freshList = await expenseService.vehicles.list(true).catch(() => null);
      if (freshList) {
        setVehicles(freshList);
      } else {
        setVehicles(prev => prev.filter(v => !selectedIds.includes(v.id)));
      }

      if (selectedVehicle && selectedIds.includes(selectedVehicle.id)) {
        setSelectedVehicle(null);
        setOdometerHistory([]);
      }
      setSelectedIds([]);
      workforceService.getAllEmployees().then(setEmployees).catch(console.error);

      if (failCount > 0) {
        alert(`Deleted ${deletedCount} vehicle(s). ${failCount} vehicle(s) could not be deleted due to database rules.`);
      } else {
        alert(`Successfully permanently deleted ${deletedCount} vehicle(s) from the database.`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to bulk delete vehicles.');
    } finally {
      setExecutingAction(false);
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.length === 0) return;
    setExecutingAction(true);
    try {
      for (const id of selectedIds) {
        await expenseService.vehicles.update(id, { status: 'Inactive' }).catch(console.error);
      }
      setVehicles(prev => prev.map(v => selectedIds.includes(v.id) ? { ...v, status: 'Inactive' } : v));
      setSelectedIds([]);
    } catch (err: any) {
      alert(err.message || 'Failed to bulk deactivate.');
    } finally {
      setExecutingAction(false);
    }
  };

  const handleBulkActivate = async () => {
    if (selectedIds.length === 0) return;
    setExecutingAction(true);
    try {
      for (const id of selectedIds) {
        await expenseService.vehicles.update(id, { status: 'Active' }).catch(console.error);
      }
      setVehicles(prev => prev.map(v => selectedIds.includes(v.id) ? { ...v, status: 'Active' } : v));
      setSelectedIds([]);
    } catch (err: any) {
      alert(err.message || 'Failed to bulk activate.');
    } finally {
      setExecutingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-black text-slate-900">Vehicle Fleet</h3>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 text-brand border border-brand/20 text-xs font-black shadow-xs">
              <Truck className="h-4 w-4" />
              {vehicles.length} {vehicles.length === 1 ? 'Vehicle' : 'Vehicles'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">Manage vehicles and track odometer history.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadVehicleCsvTemplate}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
            title="Download CSV Template for Vehicle Fleet import"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Template
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-colors"
          >
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <button
            onClick={() => exportVehiclesToCsv(filteredVehicles, getLinkedEmployeesForVehicle)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
            title="Export current vehicles list to CSV file"
          >
            <Download className="h-4 w-4 text-emerald-400" /> Export CSV
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:bg-brand-hover transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Vehicle
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h4 className="text-sm font-black text-slate-900 mb-4">{editVehicle ? 'Edit Vehicle' : 'New Vehicle'}</h4>
          {error && (
            <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-bold">{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Plate Number *</label>
              <input
                value={plateNumber}
                onChange={e => setPlateNumber(e.target.value)}
                required
                placeholder="e.g. 123456"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                Vehicle Code (Auto)
              </label>
              <input
                value={vehicleCode}
                onChange={e => setVehicleCode(e.target.value)}
                placeholder="Auto Generated (e.g. V-001)"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 font-mono px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:bg-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Type</label>
              <select value={vehicleType} onChange={e => setVehicleType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand">
                <option value="Motorcycle">Motorcycle</option>
                <option value="Car">Car</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                Ownership / الملكية
              </label>
              <select
                value={ownershipType}
                onChange={e => setOwnershipType(e.target.value as VehicleOwnershipType)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="Internal">Internal (Company Owned / شركة)</option>
                <option value="External">External (Flexi Driver / سائق)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">CR No. (Optional)</label>
              <input
                value={crNumber}
                onChange={e => setCrNumber(e.target.value)}
                placeholder="e.g. 102030-1"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Reg. Expiry (Optional)</label>
              <input
                type="date"
                value={registrationExpiryDate}
                onChange={e => setRegistrationExpiryDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Initial Odometer</label>
              <input
                type="number"
                value={initialOdometer}
                onChange={e => setInitialOdometer(e.target.value)}
                step="0.1"
                min="0"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            {/* Staff Assignment Section */}
            <div className="col-span-full border-t border-slate-100 pt-4 mt-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-brand" />
                Assigned Drivers & Workers / إسناد سائقين وعمال للمركبة
              </label>

              {/* Selected Chips */}
              {selectedStaffIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedStaffIds.map(empId => {
                    const emp = employees.find(e => e.id === empId);
                    if (!emp) return null;
                    return (
                      <span
                        key={empId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 text-xs font-bold shadow-2xs"
                      >
                        <span className="font-mono bg-purple-200/60 px-1 rounded text-[10px]">{emp.code}</span>
                        <span>{emp.full_name}</span>
                        <span className="text-[10px] text-purple-600 font-normal">({emp.category})</span>
                        <button
                          type="button"
                          onClick={() => setSelectedStaffIds(prev => prev.filter(id => id !== empId))}
                          className="text-purple-400 hover:text-purple-700 ml-0.5 p-0.5 rounded-full"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Searchable Dropdown Input */}
              <div className="relative">
                <input
                  type="text"
                  value={staffSearchTerm}
                  onChange={e => {
                    setStaffSearchTerm(e.target.value);
                    setStaffDropdownOpen(true);
                  }}
                  onFocus={() => setStaffDropdownOpen(true)}
                  placeholder="Search driver/worker by code (e.g. D001, D002) or name..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />

                {staffDropdownOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100">
                    <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400">Click staff member to assign / unassign</span>
                      <button
                        type="button"
                        onClick={() => setStaffDropdownOpen(false)}
                        className="text-xs text-brand font-bold hover:underline"
                      >
                        Done
                      </button>
                    </div>
                    {employees
                      .filter(emp => {
                        // Exclude Pharmacists - include Drivers and Workers only
                        const categoryNorm = (emp.category || '').trim().toLowerCase();
                        if (categoryNorm === 'pharmacist' || emp.code?.toUpperCase().startsWith('E')) {
                          return false;
                        }
                        const q = staffSearchTerm.toLowerCase().trim();
                        if (!q) return true;
                        return (
                          (emp.code || '').toLowerCase().includes(q) ||
                          (emp.full_name || '').toLowerCase().includes(q) ||
                          (emp.category || '').toLowerCase().includes(q) ||
                          (emp.driver_id || '').toLowerCase().includes(q)
                        );
                      })
                      .map(emp => {
                        const isSelected = selectedStaffIds.includes(emp.id);
                        return (
                          <button
                            type="button"
                            key={emp.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedStaffIds(prev => prev.filter(id => id !== emp.id));
                              } else {
                                setSelectedStaffIds(prev => [...prev, emp.id]);
                              }
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                              isSelected ? 'bg-purple-50/60 font-bold' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                              />
                              <span className="font-mono text-purple-700 font-black bg-purple-100/70 px-1.5 py-0.5 rounded text-[10px]">
                                {emp.code}
                              </span>
                              <span className="font-bold text-slate-800">{emp.full_name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">{emp.category}</span>
                          </button>
                        );
                      })}
                    {employees.length === 0 && (
                      <div className="p-3 text-xs text-slate-400 text-center font-medium">No registered drivers or staff found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-full flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-sm hover:bg-brand-hover transition-colors disabled:opacity-50">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : editVehicle ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Bar & Type Filters */}
      {vehicles.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by plate number, code, CR..."
              className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                filterType === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({vehicles.length})
            </button>
            <button
              onClick={() => setFilterType('Motorcycle')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                filterType === 'Motorcycle'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Motorcycles ({vehicles.filter(v => (v.vehicleType || '').toLowerCase().includes('motorcycle') || (v.vehicleType || '').toLowerCase().includes('bike')).length})
            </button>
            <button
              onClick={() => setFilterType('Car')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                filterType === 'Car'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Cars ({vehicles.filter(v => !(v.vehicleType || '').toLowerCase().includes('motorcycle') && !(v.vehicleType || '').toLowerCase().includes('bike')).length})
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button
              onClick={() => setFilterOwnership('ALL')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                filterOwnership === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setFilterOwnership('Internal')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                filterOwnership === 'Internal'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Internal ({vehicles.filter(v => (v.ownershipType || 'Internal') === 'Internal').length})
            </button>
            <button
              onClick={() => setFilterOwnership('External')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                filterOwnership === 'External'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs'
                  : 'bg-slate-100 text-amber-700 hover:bg-slate-200'
              }`}
            >
              ⚡ Flexi ({vehicles.filter(v => v.ownershipType === 'External').length})
            </button>
          </div>
        </div>
      )}

      {/* Bulk Selection Action Toolbar */}
      {filteredVehicles.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 text-white p-3 rounded-2xl shadow-lg border border-slate-800 transition-all">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all text-xs font-black"
            >
              {isAllSelected ? (
                <CheckSquare className="h-4 w-4 text-brand" />
              ) : (
                <Square className="h-4 w-4 text-slate-400" />
              )}
              <span>{isAllSelected ? 'Deselect All' : 'Select All'} ({filteredVehicles.length})</span>
            </button>

            {selectedIds.length > 0 && (
              <span className="text-xs font-bold text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                {selectedIds.length} vehicle(s) selected
              </span>
            )}
          </div>

          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleBulkDeactivate}
                disabled={executingAction}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black transition-all flex items-center gap-1.5"
              >
                <PowerOff className="h-3.5 w-3.5" />
                Deactivate ({selectedIds.length})
              </button>

              <button
                onClick={handleBulkActivate}
                disabled={executingAction}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-black transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Activate ({selectedIds.length})
              </button>

              <button
                onClick={handleBulkDelete}
                disabled={executingAction}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-sm shadow-rose-900/30 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete ({selectedIds.length})
              </button>

              <button
                onClick={() => setSelectedIds([])}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Clear selection"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
              Click checkboxes on vehicle cards to perform bulk actions
            </span>
          )}
        </div>
      )}

      {/* Vehicle Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <Truck className="h-12 w-12 text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-400">No vehicles registered yet.</p>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-6">
          <Search className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-black text-slate-800">No matching vehicles found</h4>
          <p className="text-xs text-slate-500 font-medium mt-1">No vehicle matches "{searchTerm}". Try searching for another plate number or vehicle code.</p>
          <button
            onClick={() => { setSearchTerm(''); setFilterType('ALL'); }}
            className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            Clear Search & Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredVehicles.map(vehicle => {
            const isRegExpired = vehicle.registrationExpiryDate && new Date(vehicle.registrationExpiryDate) < new Date();
            const isSelected = selectedVehicle?.id === vehicle.id;
            const isCheckedForBulk = selectedIds.includes(vehicle.id);
            return (
              <div
                key={vehicle.id}
                className={`group relative bg-white rounded-2xl border p-4 cursor-pointer transition-all flex flex-col justify-between ${
                  isCheckedForBulk
                    ? 'border-brand ring-2 ring-brand shadow-md bg-brand/5'
                    : isSelected
                    ? 'border-brand ring-2 ring-brand/20 shadow-md'
                    : 'border-slate-200/90 shadow-sm hover:border-brand/40 hover:shadow-md'
                }`}
                onClick={() => handleSelectVehicle(vehicle)}
              >
                <div>
                  {/* Checkbox for Bulk Selection */}
                  <div
                    onClick={(e) => toggleSelectVehicleId(vehicle.id, e)}
                    className="absolute top-3 left-3 z-20 p-1 rounded-lg bg-white/90 shadow-2xs border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Select for bulk action"
                  >
                    {isCheckedForBulk ? (
                      <CheckSquare className="h-4 w-4 text-brand" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-300 hover:text-slate-500" />
                    )}
                  </div>
                  {/* Hero Section: Bahrain License Plate */}
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-center justify-center mb-3">
                    <BahrainLicensePlate plateNumber={vehicle.plateNumber || vehicle.vehicleCode} size="md" className="max-w-full" />
                  </div>

                  {/* Vehicle Type & Status Badge */}
                  <div className="flex items-center justify-between mb-2 gap-1.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">{vehicle.vehicleType}</h4>
                        {vehicle.ownershipType === 'External' ? (
                          <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black px-1.5 py-0.2 rounded-full text-[8px] uppercase tracking-wider shadow-xs shadow-orange-500/20">
                            ⚡ Flexi
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-500 font-extrabold px-1.5 py-0.2 rounded text-[8px] uppercase tracking-wider border border-slate-200/60">
                            Internal
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono font-bold text-slate-400">Code: {vehicle.vehicleCode}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      vehicle.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50' : 'bg-slate-100 text-slate-400 border border-slate-200/50'
                    }`}>
                      {vehicle.status}
                    </span>
                  </div>

                  {/* Vehicle Sub-details */}
                  <div className="space-y-1 my-2 text-xs bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                    {vehicle.crNumber && (
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 font-bold uppercase">CR No:</span>
                        <span className="font-extrabold text-slate-800">{vehicle.crNumber}</span>
                      </div>
                    )}
                    {vehicle.registrationExpiryDate ? (
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 font-bold uppercase">Reg. Expiry:</span>
                        <span className="font-extrabold text-slate-800 flex items-center gap-1">
                          {new Date(vehicle.registrationExpiryDate + 'T00:00:00').toLocaleDateString('en-GB')}
                          {(() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const expDate = new Date(vehicle.registrationExpiryDate + 'T00:00:00');
                            const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            if (daysLeft < 0) {
                              return <span className="text-[8px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-black border border-rose-200">EXPIRED</span>;
                            } else if (daysLeft <= 30) {
                              return <span className="text-[8px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-black border border-amber-200">IN {daysLeft} DAYS</span>;
                            }
                            return <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded font-black border border-emerald-200">VALID</span>;
                          })()}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 font-bold uppercase">Reg. Expiry:</span>
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.2 rounded">Set Date</span>
                      </div>
                    )}
                  </div>

                  {/* Linked Driver / Staff Badge (User Code Tagging) */}
                  {(() => {
                    const linked = getLinkedEmployeesForVehicle(vehicle);
                    if (linked.length > 0) {
                      return (
                        <div className="mt-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 flex flex-col gap-1 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1">
                              <Link2 className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>LINKED WITH WORKFORCE</span>
                            </span>
                            <span className="text-[9px] font-black font-mono bg-amber-500 text-white px-1.5 py-0.2 rounded-full">
                              {linked.length}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {linked.map(emp => (
                              <span
                                key={emp.id}
                                title={`${emp.full_name} (${emp.category})`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-white font-mono font-black text-[10px] shadow-xs"
                              >
                                <span>{emp.code}</span>
                                <span className="text-[9px] font-bold opacity-90 font-sans max-w-[80px] truncate">({emp.full_name})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="mt-2 px-2 py-1 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-[9px] font-bold text-slate-400 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-300" />
                            <span>Unassigned</span>
                          </span>
                          <span className="text-[8px] uppercase tracking-wider text-slate-300 font-mono">No Staff Linked</span>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <button onClick={(e) => { e.stopPropagation(); handleSelectVehicle(vehicle); }}
                    className={`w-full text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${
                      isSelected ? 'bg-brand text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-brand/10 hover:text-brand'
                    }`}>
                    <Clock className="h-3.5 w-3.5" />
                    {isSelected ? 'Viewing History' : 'View History'}
                  </button>

                  <div className="flex items-center justify-between text-xs px-1 pt-1">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(vehicle); }}
                      className="font-bold text-brand hover:underline flex items-center gap-1 text-[11px]">
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleToggleStatus(vehicle); }}
                      className="font-bold text-slate-400 hover:text-brand text-[11px]">
                      {vehicle.status === 'Active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteVehicle(vehicle); }}
                      className="font-bold text-red-500 hover:text-red-700 flex items-center gap-0.5 text-[11px]"
                      title="Delete vehicle">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Odometer History Modal */}
      {mounted && selectedVehicle && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={() => setSelectedVehicle(null)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl overflow-hidden w-full max-w-4xl max-h-[85vh] flex flex-col my-auto transform transition-all relative z-[100000]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Detailed Vehicle Summary Card */}
            <div className="p-6 bg-slate-50/70 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <BahrainLicensePlate plateNumber={selectedVehicle.plateNumber || selectedVehicle.vehicleCode} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900">
                        Odometer & Expense History
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        selectedVehicle.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {selectedVehicle.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">
                      Vehicle Code: <span className="font-mono text-slate-700">{selectedVehicle.vehicleCode}</span> • Type: {selectedVehicle.vehicleType}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => exportVehicleOdometerToExcel(selectedVehicle, odometerHistory)}
                    disabled={odometerHistory.length === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 shadow-sm"
                    title="Download full records as Excel sheet per vehicle"
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Export Excel
                  </button>
                  <button
                    onClick={() => setSelectedVehicle(null)}
                    className="p-2 hover:bg-slate-200/80 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Vehicle Detailed KPIs Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200/60">
                <div className="p-3 bg-white rounded-xl border border-slate-200/60 shadow-xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">CR Number</p>
                  <p className="text-xs font-black text-slate-900 mt-0.5">{selectedVehicle.crNumber || 'Not Specified'}</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200/60 shadow-xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Reg. Expiry Date</p>
                  <p className="text-xs font-black text-slate-900 mt-0.5">
                    {selectedVehicle.registrationExpiryDate 
                      ? new Date(selectedVehicle.registrationExpiryDate).toLocaleDateString('en-GB')
                      : 'Not Specified'}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200/60 shadow-xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Initial ➔ Latest Odo</p>
                  <p className="text-xs font-black text-slate-900 mt-0.5">
                    {selectedVehicle.initialOdometer || 0} km <span className="text-slate-400 font-normal">➔</span> {latestOdometerReading.toLocaleString()} km
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200/60 shadow-xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Expenses Logged</p>
                  <p className="text-xs font-black text-brand mt-0.5">
                    {formatBhdWithCurrency(totalVehicleExpenses)}
                  </p>
                </div>
              </div>

              {/* Linked Employees Header Bar */}
              {(() => {
                const linked = getLinkedEmployeesForVehicle(selectedVehicle);
                if (linked.length === 0) return null;
                return (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-amber-600" />
                      <span>LINKED WITH WORKFORCE ({linked.length} STAFF ASSIGNED)</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {linked.map(emp => (
                        <span key={emp.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-white font-mono text-xs font-black shadow-xs">
                          <span>{emp.code}</span>
                          <span className="font-sans font-bold opacity-90">({emp.full_name} - {emp.category})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Body / Scrollable Table */}
            <div className="flex-1 overflow-y-auto p-6">
              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                </div>
              ) : odometerHistory.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">No readings or expense records yet for this vehicle.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 w-12">#</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Date & Time</th>
                          <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Odometer</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Driver Name</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Location</th>
                          <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Amount Paid</th>
                          <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {paginatedHistory.map((row, idx) => {
                          const rowNum = (historyPage - 1) * HISTORY_PAGE_SIZE + idx + 1;
                          return (
                            <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-3 py-3 text-center font-extrabold text-xs text-slate-400">
                                {rowNum}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                <span className="flex items-center gap-1.5 text-xs font-medium">
                                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  {new Date(row.readingDate || row.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-black text-slate-900">
                                {row.odometerReading.toLocaleString()} km
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                <span className="flex items-center gap-1.5 font-bold text-xs">
                                  <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  {row.driverName || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                <span className="flex items-center gap-1.5 text-xs">
                                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  {row.location || row.branchName || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-black text-slate-900">
                                {row.amount !== undefined && row.amount !== null ? formatBhdWithCurrency(row.amount) : '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  row.sourceType === 'FUEL_EXPENSE' ? 'bg-amber-50 text-amber-700 border border-amber-200/50'
                                  : row.sourceType === 'INITIAL' ? 'bg-blue-50 text-blue-700 border border-blue-200/50'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200/50'
                                }`}>
                                  {row.sourceType.replace(/_/g, ' ')}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/40">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-bold">
                        Showing {((historyPage - 1) * HISTORY_PAGE_SIZE) + 1} - {Math.min(historyPage * HISTORY_PAGE_SIZE, odometerHistory.length)} of {odometerHistory.length} records
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-200/60 text-slate-600 text-[10px] font-black uppercase">
                        25 per page
                      </span>
                    </div>

                    {Math.ceil(odometerHistory.length / HISTORY_PAGE_SIZE) > 1 && (
                      <PaginationControls
                        currentPage={historyPage}
                        totalPages={Math.ceil(odometerHistory.length / HISTORY_PAGE_SIZE)}
                        onPageChange={setHistoryPage}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Delete & Deactivate Decision Modal */}
      {mounted && vehicleToAction && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in"
          onClick={() => !executingAction && setVehicleToAction(null)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl overflow-hidden w-full max-w-xl flex flex-col transform transition-all relative z-[100000]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BahrainLicensePlate plateNumber={vehicleToAction.plateNumber || vehicleToAction.vehicleCode} size="sm" />
                <div>
                  <h3 className="text-base font-black text-slate-900">Vehicle Action & Deletion Options</h3>
                  <p className="text-xs font-mono font-bold text-slate-500">Code: {vehicleToAction.vehicleCode} • Type: {vehicleToAction.vehicleType}</p>
                </div>
              </div>
              <button
                onClick={() => setVehicleToAction(null)}
                disabled={executingAction}
                className="p-2 hover:bg-slate-200/80 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {checkingData ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                  <p className="text-xs font-bold text-slate-500">Auditing system records for this vehicle...</p>
                </div>
              ) : (
                <>
                  {/* System Data Inspection Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Info className="h-4 w-4 text-brand" />
                        <span>Linked System Records Audit</span>
                      </span>
                      <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        {(linkedInfo?.employees.length || 0) + (linkedInfo?.odometerCount || 0) + (linkedInfo?.expenseCount || 0)} Linked Items
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                        <Users className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Workforce</p>
                        <p className="text-sm font-black text-slate-900">{linkedInfo?.employees.length || 0} Staff</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                        <Clock className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Odometer</p>
                        <p className="text-sm font-black text-slate-900">{linkedInfo?.odometerCount || 0} Logs</p>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                        <FileText className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Expenses</p>
                        <p className="text-sm font-black text-slate-900">{linkedInfo?.expenseCount || 0} Records</p>
                      </div>
                    </div>

                    {linkedInfo?.employees && linkedInfo.employees.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <p className="text-[10px] font-black uppercase text-amber-700 mb-1">Assigned Employees:</p>
                        <div className="flex flex-wrap gap-1">
                          {linkedInfo.employees.map(emp => (
                            <span key={emp.id} className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200">
                              {emp.code} ({emp.full_name})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Alert banner if data exists */}
                  {((linkedInfo?.employees.length || 0) + (linkedInfo?.odometerCount || 0) + (linkedInfo?.expenseCount || 0)) > 0 ? (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-black text-amber-900 uppercase">⚠️ Warning: Vehicle has linked system data!</p>
                        <p className="font-medium text-amber-800 mt-0.5 leading-relaxed">
                          This vehicle is linked to historical logs or assigned drivers. If you want to preserve history while disabling daily use, choose <strong>Deactivate</strong>. If you want to wipe it completely from the database, choose <strong>Permanent Delete</strong>.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-black text-emerald-900 uppercase">Clean Vehicle Record</p>
                        <p className="font-medium text-emerald-800 mt-0.5">
                          No active drivers or transaction logs are currently bound to this vehicle. It can be deactivated or safely deleted.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {/* Option A: Deactivate */}
                    <button
                      onClick={handleDeactivateChoice}
                      disabled={executingAction}
                      className="group p-4 rounded-2xl border-2 border-slate-200 hover:border-amber-500 bg-white hover:bg-amber-50/50 text-left transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="p-2 rounded-xl bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                            <PowerOff className="h-4 w-4" />
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Recommended
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-slate-900 group-hover:text-amber-900">
                          {vehicleToAction.status === 'Active' ? 'Deactivate Vehicle' : 'Activate Vehicle'}
                        </h4>
                        <p className="text-[11px] font-medium text-slate-500 mt-1 leading-snug">
                          {vehicleToAction.status === 'Active'
                            ? 'Safely hides vehicle from active duty. Preserves all history, fuel logs & staff links.'
                            : 'Re-activates motorcycle for daily operational assignments.'}
                        </p>
                      </div>
                      <div className="mt-4 pt-2 border-t border-slate-100 text-xs font-black text-amber-700 group-hover:underline flex items-center justify-between">
                        <span>{vehicleToAction.status === 'Active' ? 'Set as Inactive' : 'Set as Active'}</span>
                        <span>➔</span>
                      </div>
                    </button>

                    {/* Option B: Permanent Delete */}
                    <button
                      onClick={handlePermanentDeleteChoice}
                      disabled={executingAction}
                      className="group p-4 rounded-2xl border-2 border-red-200 hover:border-red-500 bg-white hover:bg-red-50/50 text-left transition-all flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="p-2 rounded-xl bg-red-100 text-red-700 group-hover:bg-red-600 group-hover:text-white transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            Hard Delete
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-red-600 group-hover:text-red-700">
                          Permanent Delete
                        </h4>
                        <p className="text-[11px] font-medium text-slate-500 mt-1 leading-snug">
                          Permanently wipes vehicle from database. Unlinks workforce tags & frees up plate number.
                        </p>
                      </div>
                      <div className="mt-4 pt-2 border-t border-red-100 text-xs font-black text-red-600 group-hover:underline flex items-center justify-between">
                        <span>Delete Permanently</span>
                        <span>➔</span>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showImportModal && (
        <VehicleCsvImportModal
          employees={employees}
          onClose={() => setShowImportModal(false)}
          onImportComplete={async (newVehs) => {
            setShowImportModal(false);
            const freshVehs = await expenseService.vehicles.list(true).catch(() => []);
            const freshEmps = await workforceService.getAllEmployees().catch(() => []);
            if (freshVehs.length > 0) setVehicles(freshVehs);
            if (freshEmps.length > 0) setEmployees(freshEmps);
          }}
        />
      )}
    </div>
  );
};
