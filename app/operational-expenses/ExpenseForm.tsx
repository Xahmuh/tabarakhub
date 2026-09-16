import React, { useEffect, useState, useMemo } from 'react';
import { AlertCircle, ArrowLeft, Building2, FileText, Fuel, Info, Lock, Package, Save, Unlock, Upload, UserCheck, Wrench } from 'lucide-react';
import { Branch, DeliveryDriver, ExpenseCategory, ExpenseTransaction, ExpenseTransactionInput, Pharmacist, Vehicle } from '../../types';
import { expenseService } from '../../services/expenseService';
import { deliveryService } from '../../services/deliveryService';
import { branchService } from '../../services/branchService';
import { pharmacistService } from '../../services/pharmacistService';
import { workforceService, Employee } from '../../services/workforceService';
import { supabaseClient } from '../../lib/supabaseClient';
import { isManagerRole } from '../../lib/access';
import { formatBhdAmount } from '../../utils/money';
import { SearchableSelect, SelectOption } from '../delivery/components/SearchableSelect';
import { BahrainLicensePlate } from './components/BahrainLicensePlate';

interface ExpenseFormProps {
  user: Branch;
  pharmacist?: { id: string; name: string; code: string } | null;
  editExpenseId: string | null;
  onSaved: () => void;
  onCancel: () => void;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ user, pharmacist, editExpenseId, onSaved, onCancel }) => {
  const role = user.role;
  const isAdminOrFinance = useMemo(
    () => ['owner', 'admin', 'manager', 'accounts'].includes(role) || isManagerRole(role),
    [role]
  );

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(user.id);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingExpense, setExistingExpense] = useState<ExpenseTransaction | null>(null);

  // Form state
  const [categoryId, setCategoryId] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expenseTime, setExpenseTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [createdBy, setCreatedBy] = useState<string>(pharmacist?.name || '');
  const [isPharmacistLocked, setIsPharmacistLocked] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [currentOdometer, setCurrentOdometer] = useState<string>('');
  const [liters, setLiters] = useState<string>('');
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [receiptProvided, setReceiptProvided] = useState(false);

  // Derived state
  const [previousOdometer, setPreviousOdometer] = useState<number>(0);
  const [previousOdometerDate, setPreviousOdometerDate] = useState<string | null>(null);
  const selectedCategory = useMemo(() => categories.find(c => c.id === categoryId), [categories, categoryId]);

  const branchOptions: SelectOption[] = useMemo(() => {
    return branches.map(b => ({
      value: b.id,
      label: b.name,
      hint: b.code ? `(${b.code})` : undefined
    }));
  }, [branches]);
  const isFuel = selectedCategory?.slug === 'fuel';
  const isVehicleServices = selectedCategory?.slug === 'vehicle_services';
  const isVehicleRequired = isFuel || isVehicleServices;
  const distance = isFuel && currentOdometer ? Math.max(0, Number(currentOdometer) - previousOdometer) : 0;
  const lockStorageKey = `expense_recording_locks_${user.id}`;

  const pharmacistOptions: SelectOption[] = useMemo(() => {
    const opts = pharmacists.map(p => ({
      value: p.name,
      label: p.name,
      hint: p.code ? `(${p.code})` : undefined
    }));
    if (createdBy && !opts.some(o => o.value === createdBy)) {
      opts.unshift({ value: createdBy, label: createdBy, hint: 'Selected' });
    }
    return opts;
  }, [pharmacists, createdBy]);

  const vehicleOptions: SelectOption[] = useMemo(() => {
    return vehicles.map(v => ({
      value: v.id,
      label: v.plateNumber ? `Plate: ${v.plateNumber}` : v.vehicleCode,
      hint: v.plateNumber ? `(Code: ${v.vehicleCode})` : undefined,
      data: v
    }));
  }, [vehicles]);

  const driverOptions: SelectOption[] = useMemo(() => {
    return drivers.map(d => ({
      value: d.id,
      label: d.name,
      hint: d.phone || undefined
    }));
  }, [drivers]);

  // Restore locked pharmacist
  useEffect(() => {
    if (!editExpenseId) {
      try {
        const stored = localStorage.getItem(lockStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.isPharmacistLocked && parsed.createdBy) {
            setCreatedBy(parsed.createdBy);
            setIsPharmacistLocked(true);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [user.id, editExpenseId]);

  // Handle lock toggle
  const togglePharmacistLock = () => {
    if (isPharmacistLocked) {
      setIsPharmacistLocked(false);
      try {
        localStorage.removeItem(lockStorageKey);
      } catch (e) { console.error(e); }
    } else {
      if (!createdBy.trim()) return;
      setIsPharmacistLocked(true);
      try {
        localStorage.setItem(lockStorageKey, JSON.stringify({ isPharmacistLocked: true, createdBy }));
      } catch (e) { console.error(e); }
    }
  };

  // Load reference data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [cats, vehs, drvs, branchList, empList] = await Promise.all([
          expenseService.categories.list(),
          expenseService.vehicles.list(),
          deliveryService.drivers.listByBranch(user.id),
          isAdminOrFinance ? branchService.list() : Promise.resolve([]),
          workforceService.getAllEmployees().catch(() => [])
        ]);
        setCategories(cats);
        setVehicles(vehs);
        setEmployees(empList || []);

        // Combine drivers with driver-category employees from workforce directory if not listed
        const combinedDrivers = [...drvs];
        (empList || []).filter(e => e.category === 'Driver' || e.driver_id).forEach(emp => {
          const empDriverId = emp.driver_id || emp.id;
          const exists = combinedDrivers.some(
            d => d.id === empDriverId || d.name.trim().toLowerCase() === emp.full_name.trim().toLowerCase()
          );
          if (!exists) {
            combinedDrivers.push({
              id: empDriverId,
              driverCode: emp.code,
              name: emp.full_name,
              phone: emp.phone || undefined,
              isActive: emp.status === 'Active',
              branchIds: [user.id]
            });
          }
        });
        setDrivers(combinedDrivers);

        if (branchList && branchList.length > 0) setBranches(branchList);

        // 1. Try branch pharmacists first
        let pharms = await pharmacistService.listByBranch(user.id);

        // 2. Fallback to all system pharmacists registered in DB
        if (!pharms || pharms.length === 0) {
          pharms = await pharmacistService.listAll();
        }

        // 3. Direct DB query fallback
        if (!pharms || pharms.length === 0) {
          const { data: dbPharms } = await supabaseClient
            .from('pharmacists')
            .select('id, code, name, is_active')
            .order('name');
          if (dbPharms && dbPharms.length > 0) {
            pharms = dbPharms.map((p: any) => ({
              id: p.id,
              branchId: user.id,
              code: p.code || '',
              name: p.name,
              isActive: p.is_active ?? true
            }));
          }
        }

        // 4. Prepend active logged-in pharmacist if not already listed
        if (pharmacist && pharmacist.name) {
          const exists = pharms.some(p => p.name === pharmacist.name);
          if (!exists) {
            pharms.unshift({
              id: pharmacist.id || 'active-context-pharm',
              branchId: user.id,
              code: pharmacist.code || '',
              name: pharmacist.name,
              isActive: true
            });
          }
        }

        setPharmacists(pharms);

        if (cats.length > 0 && !categoryId) setCategoryId(cats[0].id);

        // Pre-select active pharmacist if available and field is empty
        if (!createdBy && pharmacist?.name) {
          setCreatedBy(pharmacist.name);
        } else if (!createdBy && pharms.length > 0) {
          setCreatedBy(pharms[0].name);
        }

        // Load existing expense for edit
        if (editExpenseId) {
          const exp = await expenseService.expenses.getById(editExpenseId);
          if (exp) {
            setExistingExpense(exp);
            if (exp.branchId) setSelectedBranchId(exp.branchId);
            setCategoryId(exp.categoryId);
            setExpenseDate(exp.expenseDate);
            setExpenseTime(exp.expenseTime || '');
            setCreatedBy(exp.createdBy || pharmacist?.name || '');
            setAmount(formatBhdAmount(exp.amount));
            setDescription(exp.description || '');
            setPaidTo(exp.paidTo || '');
            setVehicleId(exp.vehicleId || '');
            setDriverId(exp.driverId || '');
            setReceiptUrl(exp.receiptUrl || '');
            setReceiptProvided(exp.receiptProvidedToAccounts);
            if (exp.fuelDetails) {
              setCurrentOdometer(String(exp.fuelDetails.currentOdometer));
              setPreviousOdometer(exp.fuelDetails.previousOdometer);
              setLiters(exp.fuelDetails.liters ? String(exp.fuelDetails.liters) : '');
              setFuelPricePerLiter(exp.fuelDetails.fuelPricePerLiter ? String(exp.fuelDetails.fuelPricePerLiter) : '');
            }
          }
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    loadData();
  }, [editExpenseId, user.id, isAdminOrFinance]);

  // Reload drivers when selectedBranchId changes for privileged users
  useEffect(() => {
    if (selectedBranchId && isAdminOrFinance) {
      deliveryService.drivers.listByBranch(selectedBranchId)
        .then(drvs => {
          const combinedDrivers = [...drvs];
          (employees || []).filter(e => e.category === 'Driver' || e.driver_id).forEach(emp => {
            const empDriverId = emp.driver_id || emp.id;
            const exists = combinedDrivers.some(
              d => d.id === empDriverId || d.name.trim().toLowerCase() === emp.full_name.trim().toLowerCase()
            );
            if (!exists) {
              combinedDrivers.push({
                id: empDriverId,
                driverCode: emp.code,
                name: emp.full_name,
                phone: emp.phone || undefined,
                isActive: emp.status === 'Active',
                branchIds: [selectedBranchId]
              });
            }
          });
          setDrivers(combinedDrivers);
        })
        .catch(console.error);
    }
  }, [selectedBranchId, isAdminOrFinance, employees]);

  // Auto-detect assigned driver when Vehicle Plate Number changes
  useEffect(() => {
    if (!vehicleId || editExpenseId) return;

    const selVehicle = vehicles.find(v => v.id === vehicleId);
    if (!selVehicle) return;

    const vId = (selVehicle.id || '').toLowerCase();
    const vCode = (selVehicle.vehicleCode || '').toLowerCase();
    const vPlate = (selVehicle.plateNumber || '').toLowerCase();

    // 1. Try workforce assigned employees first
    const assignedEmp = employees.find(emp => {
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

    if (assignedEmp) {
      const matchedDriver = drivers.find(
        d =>
          (assignedEmp.driver_id && d.id === assignedEmp.driver_id) ||
          (d.driverCode && d.driverCode.toLowerCase() === assignedEmp.code.toLowerCase()) ||
          d.name.trim().toLowerCase() === assignedEmp.full_name.trim().toLowerCase() ||
          assignedEmp.full_name.toLowerCase().includes(d.name.toLowerCase()) ||
          d.name.toLowerCase().includes(assignedEmp.full_name.toLowerCase())
      );

      if (matchedDriver) {
        setDriverId(matchedDriver.id);
        setPaidTo(matchedDriver.name);
        return;
      }
    }

    // 2. Fallback: check latest odometer / expense history for this vehicle
    expenseService.vehicles.getLatestOdometerDetails(vehicleId).then(details => {
      if (details.driverId) {
        const matchedDriver = drivers.find(d => d.id === details.driverId);
        if (matchedDriver) {
          setDriverId(matchedDriver.id);
          setPaidTo(matchedDriver.name);
        }
      }
    }).catch(() => undefined);

  }, [vehicleId, vehicles, employees, drivers, editExpenseId]);

  // Load previous odometer & last reading date when vehicle changes
  useEffect(() => {
    if (!vehicleId || !isFuel) {
      setPreviousOdometer(0);
      setPreviousOdometerDate(null);
      return;
    }
    expenseService.vehicles.getLatestOdometerDetails(vehicleId).then(details => {
      setPreviousOdometer(details.reading);
      setPreviousOdometerDate(details.date);
    }).catch(console.error);
  }, [vehicleId, isFuel]);

  // Auto-sync Paid To with driver name for fuel & vehicle services expenses
  useEffect(() => {
    if (isVehicleRequired && driverId && drivers.length > 0) {
      const drv = drivers.find(d => d.id === driverId);
      if (drv && !paidTo) {
        setPaidTo(drv.name);
      }
    }
  }, [isVehicleRequired, driverId, drivers]);

  // Reset vehicle & driver when switching to non-vehicle categories
  useEffect(() => {
    if (selectedCategory && !isVehicleRequired) {
      setVehicleId('');
      setDriverId('');
    }
  }, [selectedCategory, isVehicleRequired]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation for Vehicle-required categories (Fuel & Vehicle Services)
    if (isVehicleRequired) {
      if (!vehicleId) {
        setError('Please select a Vehicle Plate Number.');
        return;
      }
      if (!driverId) {
        setError('Please select a Driver.');
        return;
      }
    }

    setSaving(true);

    try {
      let uploadedReceiptUrl = receiptUrl;

      if (editExpenseId) {
        if (receiptFile) {
          uploadedReceiptUrl = await expenseService.receipts.upload(receiptFile, editExpenseId);
        }
        await expenseService.expenses.update(editExpenseId, {
          branchId: isAdminOrFinance ? selectedBranchId : user.id,
          expenseDate,
          expenseTime,
          createdBy,
          amount,
          description,
          paidTo,
          driverId: driverId || undefined,
          vehicleId: vehicleId || undefined,
          receiptUrl: uploadedReceiptUrl || undefined,
          receiptProvidedToAccounts: receiptProvided,
          currentOdometer: isFuel ? Number(currentOdometer) : undefined,
          liters: isFuel && liters ? Number(liters) : undefined,
          fuelPricePerLiter: isFuel && fuelPricePerLiter ? Number(fuelPricePerLiter) : undefined
        });
      } else {
        const input: ExpenseTransactionInput = {
          branchId: isAdminOrFinance ? selectedBranchId : user.id,
          categoryId,
          expenseDate,
          expenseTime,
          createdBy,
          amount,
          description,
          paidTo,
          driverId: driverId || undefined,
          vehicleId: vehicleId || undefined,
          currentOdometer: isFuel ? Number(currentOdometer) : undefined,
          liters: isFuel && liters ? Number(liters) : undefined,
          fuelPricePerLiter: isFuel && fuelPricePerLiter ? Number(fuelPricePerLiter) : undefined,
          receiptUrl: uploadedReceiptUrl || undefined,
          receiptProvidedToAccounts: receiptProvided
        };

        const created = await expenseService.expenses.create(input);

        if (receiptFile && created.id) {
          uploadedReceiptUrl = await expenseService.receipts.upload(receiptFile, created.id);
          await expenseService.expenses.update(created.id, { receiptUrl: uploadedReceiptUrl });
        }
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-slate-900">
                {editExpenseId ? 'Edit Expense' : 'Record New Expense'}
              </h3>
              {selectedCategory && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-brand/10 text-brand">
                  {selectedCategory.name}
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              {editExpenseId ? `Editing ${existingExpense?.referenceNo}` : 'Record and track operational cash transactions for your branch'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-bold">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category Selection Grid (Single Row Layout with Hover & Selection Popup) */}
        {!editExpenseId && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6">
            <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
              1. Select Expense Category *
            </label>
            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {categories.map(cat => {
                const isSelected = categoryId === cat.id;
                const getIcon = () => {
                  const iconClass = `h-5 w-5 mb-1.5 transition-colors ${isSelected ? 'text-brand' : 'text-slate-500'}`;
                  switch (cat.slug) {
                    case 'fuel': return <Fuel className={iconClass} />;
                    case 'vehicle_services': return <Wrench className={iconClass} />;
                    case 'maintenance': return <Building2 className={iconClass} />;
                    case 'supplies': return <Package className={iconClass} />;
                    default: return <FileText className={iconClass} />;
                  }
                };

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex flex-col items-center justify-center p-2.5 sm:p-3.5 rounded-xl border-2 text-xs font-bold transition-all text-center ${
                      isSelected
                        ? 'border-brand bg-brand/5 text-brand shadow-sm scale-[1.01]'
                        : 'border-slate-200 text-slate-600 hover:border-brand/40 hover:bg-slate-50/80'
                    }`}
                  >
                    {getIcon()}
                    <span className="truncate max-w-full text-[11px] sm:text-xs font-black">{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Selected Category Guidance Banner (Bilingual AR + EN - Centered) */}
            {selectedCategory && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-black border-b border-slate-200/60 pb-2.5 w-full text-center">
                  <Info className="h-4 w-4 shrink-0 text-brand" />
                  <span className="uppercase tracking-wider text-brand">Category Guidance</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-brand">إرشادات الفئة</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-brand/10 text-brand border border-brand/20 ml-1">
                    {selectedCategory.name}
                  </span>
                </div>

                {/* Arabic Guidance */}
                <div className="text-[13.5px] sm:text-sm font-bold text-slate-800 leading-relaxed text-center w-full">
                  {selectedCategory.slug === 'fuel' && 'تُسجل هنا مصروفات الوقود (بنزين/ديزل) الخاصة بمركبات التوصيل المعتمدة مع التزام إدخال قراءة العداد السليمة.'}
                  {selectedCategory.slug === 'vehicle_services' && 'تُسجل هنا صيانات وخدمات المركبات مثل تغيير الزيت، الفلاتر، الإطارات والإصلاحات الميكانيكية لسيارات التوصيل.'}
                  {selectedCategory.slug === 'maintenance' && 'تُسجل هنا مصروفات صيانة وتجهيزات الفرع والمبنى (مثل المكيفات، الكهرباء، السباكة، والنظافة العامة وتجهيزات المحل).'}
                  {selectedCategory.slug === 'supplies' && 'تُسجل هنا المستلزمات التشغيلية واليومية بالفرع مثل أوراق الطباعة، أكياس التغليف، والأدوات المكتبية والمستهلكات.'}
                  {selectedCategory.slug !== 'fuel' && selectedCategory.slug !== 'vehicle_services' && selectedCategory.slug !== 'maintenance' && selectedCategory.slug !== 'supplies' && 'تُسجل هنا أي مصروفات تشغيلية نقدية طارئة لا تندرج تحت أي من الفئات المحددة أعلاه.'}
                </div>

                {/* English Guidance */}
                <div className="text-xs font-medium text-slate-500 leading-relaxed text-center w-full border-t border-slate-200/60 pt-2.5">
                  {selectedCategory.slug === 'fuel' && 'Record fuel expenses (Petrol/Diesel) for assigned delivery vehicles along with accurate odometer readings.'}
                  {selectedCategory.slug === 'vehicle_services' && 'Record vehicle maintenance and services such as oil changes, filters, tires, and mechanical repairs for delivery vehicles.'}
                  {selectedCategory.slug === 'maintenance' && 'Record branch and facility maintenance expenses (such as AC repair, electrical, plumbing, store fixtures, and general upkeep).'}
                  {selectedCategory.slug === 'supplies' && 'Record daily operational supplies for the branch such as thermal printing paper, packaging bags, office stationery, and consumables.'}
                  {selectedCategory.slug !== 'fuel' && selectedCategory.slug !== 'vehicle_services' && selectedCategory.slug !== 'maintenance' && selectedCategory.slug !== 'supplies' && 'Record any other emergency cash operational expenses that do not fit into the categories listed above.'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2-Column Wide Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Entry Metadata & Basic Info */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-3">
                {editExpenseId ? 'Expense Information' : '2. Expense Information'}
              </h4>

              {/* Branch Selection (Locked for Branch user, Editable for Admin / Finance) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Branch *</label>
                {isAdminOrFinance ? (
                  <SearchableSelect
                    options={branchOptions}
                    value={selectedBranchId || null}
                    onChange={val => setSelectedBranchId(val || user.id)}
                    placeholder="Select branch..."
                    searchPlaceholder="Type branch name or code..."
                  />
                ) : (
                  <div className="flex items-center justify-between w-full rounded-xl border border-slate-200/80 bg-slate-100/80 px-3.5 py-2.5 text-sm font-bold text-slate-700">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{user.name}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/70 text-slate-500">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  </div>
                )}
              </div>

              {/* Pharmacist / Recorded By */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Pharmacist / Recorded By *
                  </label>
                  {!editExpenseId && (
                    <button
                      type="button"
                      onClick={togglePharmacistLock}
                      className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg transition-colors ${
                        isPharmacistLocked ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={isPharmacistLocked ? 'Unlock pharmacist selection' : 'Lock selected pharmacist for quick multi-entry'}
                    >
                      {isPharmacistLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                      {isPharmacistLocked ? 'Locked' : 'Lock'}
                    </button>
                  )}
                </div>

                <SearchableSelect
                  options={pharmacistOptions}
                  value={createdBy || null}
                  onChange={val => setCreatedBy(val || '')}
                  placeholder="Search or select Pharmacist..."
                  searchPlaceholder="Type pharmacist name or code..."
                  disabled={isPharmacistLocked && !editExpenseId}
                />
              </div>

              {/* Expense Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Expense Date *</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={e => setExpenseDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>

              {/* Description / Notes (Optional for all categories including Fuel) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Description / Notes (Optional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder={isFuel ? "Optional notes (e.g. Full tank, Trip details)..." : "What was this expense for?"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
                />
              </div>

              {/* Paid To */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Paid To / Payee</label>
                <input
                  type="text"
                  value={paidTo}
                  onChange={e => setPaidTo(e.target.value)}
                  placeholder="Vendor or payee name"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Financials & Fuel/Vehicle Details */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-3">
                {editExpenseId ? 'Financial & Specific Details' : '3. Financial & Specific Details'}
              </h4>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Amount (BHD) *</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    step="0.001"
                    min="0.001"
                    required
                    placeholder="0.000"
                    className="w-full rounded-xl border-2 border-brand/30 bg-brand/5 px-4 py-3 text-2xl font-black text-brand shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                  <span className="absolute right-4 top-3.5 text-xs font-black uppercase tracking-wider text-brand/60">BHD</span>
                </div>
              </div>

              {/* Vehicle & Driver Selection */}
              {isVehicleRequired ? (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Vehicle Plate Number *</label>
                      <SearchableSelect
                        options={vehicleOptions}
                        value={vehicleId || null}
                        onChange={val => setVehicleId(val || '')}
                        placeholder="Select vehicle by plate..."
                        searchPlaceholder="Type plate number or code..."
                        renderOption={(opt) => {
                          const v = opt.data as Vehicle;
                          if (!v) return <span className="truncate">{opt.label}</span>;
                          return (
                            <div className="flex items-center gap-3 py-1">
                              <BahrainLicensePlate
                                plateNumber={v.plateNumber || v.vehicleCode}
                                size="sm"
                                enableCopy={false}
                              />
                              <span className="font-black text-slate-900 text-base dir-ltr tracking-wider font-mono">
                                {v.plateNumber || v.vehicleCode}
                              </span>
                            </div>
                          );
                        }}
                        renderSelected={(opt) => {
                          const v = opt.data as Vehicle;
                          if (!v) return <span>{opt.label}</span>;
                          return (
                            <div className="flex items-center gap-2.5">
                              <BahrainLicensePlate
                                plateNumber={v.plateNumber || v.vehicleCode}
                                size="sm"
                                enableCopy={false}
                              />
                              <span className="font-black text-slate-900 text-base dir-ltr tracking-wider font-mono">
                                {v.plateNumber || v.vehicleCode}
                              </span>
                            </div>
                          );
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Driver *</label>
                      <SearchableSelect
                        options={driverOptions}
                        value={driverId || null}
                        onChange={val => {
                          const selectedId = val || '';
                          setDriverId(selectedId);
                          if (selectedId) {
                            const drv = drivers.find(d => d.id === selectedId);
                            if (drv) {
                              setPaidTo(drv.name);
                            }
                          }
                        }}
                        placeholder="Search driver..."
                        searchPlaceholder="Type driver name..."
                        renderOption={(opt) => (
                          <div className="flex items-center gap-2.5 py-1">
                            <div className="w-7 h-7 shrink-0 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-bold text-xs">
                              👤
                            </div>
                            <span className="font-bold text-slate-900 text-sm">{opt.label}</span>
                          </div>
                        )}
                        renderSelected={(opt) => (
                          <div className="flex items-center gap-2 py-0.5">
                            <div className="w-6.5 h-6.5 shrink-0 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-bold text-xs">
                              👤
                            </div>
                            <span className="font-extrabold text-slate-900 text-sm">{opt.label}</span>
                          </div>
                        )}
                      />
                    </div>
                  </div>

                  {/* Odometer Tracker (Fuel category only) */}
                  {isFuel && (
                    <>
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 space-y-3">
                        <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Odometer Tracker</h5>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Last Reading</label>
                            <div className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700">
                              {previousOdometer.toLocaleString()} km
                            </div>
                            {previousOdometerDate && (
                              <p className="text-[10px] font-bold text-amber-600 mt-1">
                                {new Date(previousOdometerDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 mb-1">Current *</label>
                            <input
                              type="number"
                              value={currentOdometer}
                              onChange={e => setCurrentOdometer(e.target.value)}
                              min={previousOdometer}
                              step="0.1"
                              required
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-brand focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Distance</label>
                            <div className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-black text-brand">
                              {distance.toLocaleString()} km
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-2">Liters</label>
                          <input
                            type="number"
                            value={liters}
                            onChange={e => setLiters(e.target.value)}
                            step="0.01"
                            min="0"
                            placeholder="Optional"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-2">Price per Liter</label>
                          <input
                            type="number"
                            value={fuelPricePerLiter}
                            onChange={e => setFuelPricePerLiter(e.target.value)}
                            step="0.001"
                            min="0"
                            placeholder="Optional"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {/* Receipt Provided Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                <div>
                  <label className="text-xs font-bold text-slate-800">Receipt Provided to Accounts</label>
                  <p className="text-[10px] text-slate-500 mt-0.5">Mark when physical receipt is handed over</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReceiptProvided(!receiptProvided)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${receiptProvided ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`block w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-transform ${receiptProvided ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Action Bar */}
        <div className="flex items-center justify-end gap-4 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-brand text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-brand/20 hover:bg-brand-hover transition-all disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : editExpenseId ? 'Update Expense' : 'Record Expense'}
          </button>
        </div>
      </form>
    </div>
  );
};
