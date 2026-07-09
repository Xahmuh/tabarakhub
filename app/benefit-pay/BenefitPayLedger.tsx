import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  ArrowUpRight,
  Banknote,
  Clock,
  FileDown,
  Landmark,
  LayoutDashboard,
  Loader2,
  Lock,
  Pencil,
  Printer,
  ReceiptText,
  RefreshCw,
  Trash2,
  Unlock,
  WalletCards
} from 'lucide-react';
import { benefitPayService } from '../../services/benefitPayService';
import { branchService } from '../../services/branchService';
import { pharmacistService } from '../../services/pharmacistService';
import { isModuleEnabled } from '../../config/clientConfig';
import {
  BenefitPayTransfer,
  BenefitPayTransferType,
  Branch,
  Pharmacist,
  Role
} from '../../types';
import { BackToModulesButton, PaginationControls, TIME_24H_PATTERN, TimeInput24 } from '../shared';
import { SearchableSelect } from '../delivery/components/SearchableSelect';
import { PeriodFilter } from '../delivery/components/PeriodFilter';
import { PeriodPreset, formatBhd, getPresetRange, periodLabel, todayKey } from '../delivery/utils';
import { formatBhdAmount } from '../../utils/money';
import {
  benefitPayExportFileName,
  benefitPayConsolidatedExportFileName,
  BenefitPayExportSortMode,
  exportBenefitPayToExcel,
  printBenefitPayReport
} from './exports';

type LedgerTab = 'record' | 'dashboard';
type BenefitPaySourceFilter = 'all' | 'manual' | 'delivery' | 'delivery_active' | 'delivery_cancelled';
const LEDGER_PAGE_SIZE = 20;

interface BenefitPayLedgerProps {
  user: Branch;
  onBack: () => void;
  checkPermission: (feature: string, minimum?: 'edit' | 'read') => boolean;
  focusTarget?: { deliveryOrderId: string; transferDate?: string | null; branchId?: string | null } | null;
  onFocusConsumed?: () => void;
  onOpenDeliveryOrder?: (transfer: BenefitPayTransfer) => void;
}

const TRANSFER_TYPES: Array<{ value: BenefitPayTransferType; label: string; hint: string }> = [
  { value: 'AFS', label: 'AFS', hint: 'AFS receipt' },
  { value: 'CREDIMAX', label: 'Credimax', hint: 'Card terminal transfer' },
  { value: 'IBAN', label: 'IBAN', hint: 'Bank transfer' }
];

const currentTimeValue = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const formatTransferDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
};

const serialDatePart = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-');
  return `${day || ''}${month || ''}${(year || '').slice(-2)}`;
};

const compactRangeLabel = (from: string, to: string) => (from === to ? from : `${from} to ${to}`);

const transferTypeClass = (type: BenefitPayTransferType) => {
  if (type === 'AFS') return 'border-blue-100 bg-blue-50 text-blue-700';
  if (type === 'CREDIMAX') return 'border-violet-100 bg-violet-50 text-violet-700';
  return 'border-emerald-100 bg-emerald-50 text-emerald-700';
};

const isCancelledDeliveryTransfer = (row: BenefitPayTransfer) =>
  row.source === 'delivery' && row.deliveryOrderStatus === 'cancelled';

const canModifyTransfer = (row: BenefitPayTransfer) => row.source === 'manual';

const sourceBadgeClass = (row: BenefitPayTransfer) =>
  isCancelledDeliveryTransfer(row)
    ? 'border-red-200 bg-red-50 text-red-700'
    : row.source === 'delivery'
    ? 'border-brand/10 bg-brand/5 text-brand'
    : 'border-slate-200 bg-slate-50 text-slate-600';

const sourceLabel = (row: BenefitPayTransfer) =>
  isCancelledDeliveryTransfer(row)
    ? `Cancelled Delivery ${row.deliveryOrderNumber || ''}`.trim()
    : row.source === 'delivery'
      ? `Delivery ${row.deliveryOrderNumber || ''}`.trim()
      : 'In-store';

type KpiTone = 'brand' | 'blue' | 'violet' | 'emerald' | 'slate';

const KPI_TONES: Record<KpiTone, { card: string; icon: string }> = {
  brand: {
    card: 'border-brand/10 bg-white',
    icon: 'bg-brand/10 text-brand'
  },
  blue: {
    card: 'border-blue-100 bg-blue-50/40',
    icon: 'bg-blue-100 text-blue-700'
  },
  violet: {
    card: 'border-violet-100 bg-violet-50/40',
    icon: 'bg-violet-100 text-violet-700'
  },
  emerald: {
    card: 'border-emerald-100 bg-emerald-50/40',
    icon: 'bg-emerald-100 text-emerald-700'
  },
  slate: {
    card: 'border-slate-200 bg-white',
    icon: 'bg-slate-100 text-slate-600'
  }
};

const KpiCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone?: KpiTone;
}> = ({
  label,
  value,
  sub,
  icon,
  tone = 'slate'
}) => (
  <div className={`min-h-[112px] rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${KPI_TONES[tone].card}`}>
    <div className="flex items-center justify-between gap-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${KPI_TONES[tone].icon}`}>{icon}</div>
    </div>
    <p className="mt-3 break-words text-[clamp(1.25rem,1.8vw,1.75rem)] font-black leading-none tracking-tight text-slate-950 tabular-nums">{value}</p>
    {sub && <p className="mt-2 line-clamp-2 text-xs font-bold leading-4 text-slate-500">{sub}</p>}
  </div>
);

export const BenefitPayLedger: React.FC<BenefitPayLedgerProps> = ({
  user,
  onBack,
  checkPermission,
  focusTarget,
  onFocusConsumed,
  onOpenDeliveryOrder
}) => {
  const role: Role = user.role;
  const isBranch = role === 'branch';
  const moduleTitle = isBranch ? 'Benefit Pay Recording & Traceability' : 'Benefit Pay Ledger';
  const canRead = checkPermission('benefit_pay_ledger', 'read');
  const canRecord = checkPermission('benefit_pay_ledger', 'edit') && isBranch;
  const canManageRows = canRecord;
  const [activeTab, setActiveTab] = useState<LedgerTab>(canRecord ? 'record' : 'dashboard');
  const [branches, setBranches] = useState<Branch[]>(isBranch ? [user] : []);
  const [recordBranchId, setRecordBranchId] = useState(isBranch ? user.id : '');
  const [dashboardBranchId, setDashboardBranchId] = useState(isBranch ? user.id : 'all');
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [transfers, setTransfers] = useState<BenefitPayTransfer[]>([]);
  const [recordsPage, setRecordsPage] = useState(1);
  const [highlightedDeliveryOrderId, setHighlightedDeliveryOrderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preset, setPreset] = useState<PeriodPreset>('today');
  const [customFrom, setCustomFrom] = useState(todayKey());
  const [customTo, setCustomTo] = useState(todayKey());
  const [dashboardTransferType, setDashboardTransferType] = useState<BenefitPayTransferType | 'all'>('all');
  const [dashboardSource, setDashboardSource] = useState<BenefitPaySourceFilter>('all');
  const [sortMode, setSortMode] = useState<BenefitPayExportSortMode>('time');
  const [transferDate, setTransferDate] = useState(todayKey());
  const [pharmacistId, setPharmacistId] = useState<string | null>(null);
  const [isPharmacistLocked, setIsPharmacistLocked] = useState(false);
  const [locksHydrated, setLocksHydrated] = useState(false);
  const [transferType, setTransferType] = useState<BenefitPayTransferType>('IBAN');
  const [value, setValue] = useState('');
  const [transferTime, setTransferTime] = useState(currentTimeValue());
  const [notes, setNotes] = useState('');
  const [editingTransfer, setEditingTransfer] = useState<BenefitPayTransfer | null>(null);

  const branchOptions = useMemo(
    () => branches.map(branch => ({
      value: branch.id,
      label: `${branch.code} - ${branch.name}`,
      hint: branch.code
    })),
    [branches]
  );
  const dashboardBranchOptions = useMemo(
    () => isBranch
      ? branchOptions
      : [{ value: 'all', label: 'All branches', hint: 'network' }, ...branchOptions],
    [branchOptions, isBranch]
  );
  const selectedRecordBranch = useMemo(
    () => branches.find(branch => branch.id === recordBranchId) || null,
    [branches, recordBranchId]
  );
  const selectedDashboardBranch = useMemo(
    () => dashboardBranchId === 'all'
      ? null
      : branches.find(branch => branch.id === dashboardBranchId) || null,
    [branches, dashboardBranchId]
  );
  const recordsScopeLabel = useMemo(() => {
    if (activeTab === 'record') return selectedRecordBranch?.name || 'Benefit Pay transfers';
    if (dashboardBranchId === 'all') return 'All branches';
    return selectedDashboardBranch?.name || 'Benefit Pay transfers';
  }, [activeTab, dashboardBranchId, selectedDashboardBranch, selectedRecordBranch]);
  const recordsScopeMeta = useMemo(() => {
    if (activeTab === 'record') return selectedRecordBranch?.code || 'Branch recording';
    if (dashboardBranchId === 'all') return 'Network consolidated view';
    return selectedDashboardBranch?.code || 'Filtered branch';
  }, [activeTab, dashboardBranchId, selectedDashboardBranch, selectedRecordBranch]);
  const range = getPresetRange(preset, customFrom, customTo);
  const activeBranchFilter = activeTab === 'record' ? recordBranchId : dashboardBranchId;
  const lockStorageKey = recordBranchId ? `benefit-pay-entry-locks:${recordBranchId}` : null;

  const totals = useMemo(() => transfers.reduce((acc, row) => {
    const isCancelled = isCancelledDeliveryTransfer(row);
    if (isCancelled) {
      acc.cancelledTotal += row.valueBhd;
      acc.cancelledCount += 1;
    } else {
      acc.total += row.valueBhd;
      acc.count += 1;
      acc[row.transferType] += row.valueBhd;
      if (row.source === 'delivery') {
        acc.delivery += row.valueBhd;
        acc.deliveryCount += 1;
      } else {
        acc.manual += row.valueBhd;
        acc.manualCount += 1;
      }
    }
    acc.allTotal += row.valueBhd;
    acc.allCount += 1;
    return acc;
  }, {
    AFS: 0,
    CREDIMAX: 0,
    IBAN: 0,
    manual: 0,
    delivery: 0,
    manualCount: 0,
    deliveryCount: 0,
    total: 0,
    count: 0,
    cancelledTotal: 0,
    cancelledCount: 0,
    allTotal: 0,
    allCount: 0
  }), [transfers]);
  const sortedTransfers = useMemo(() => {
    const byTime = (a: BenefitPayTransfer, b: BenefitPayTransfer) =>
      b.transferDate.localeCompare(a.transferDate)
      || b.transferTime.localeCompare(a.transferTime)
      || b.serialNumber.localeCompare(a.serialNumber);
    const byBranch = (a: BenefitPayTransfer, b: BenefitPayTransfer) =>
      (a.branchCode || '').localeCompare(b.branchCode || '')
      || (a.branchName || '').localeCompare(b.branchName || '')
      || byTime(a, b);
    return [...transfers].sort(sortMode === 'branch' ? byBranch : byTime);
  }, [sortMode, transfers]);
  const totalTransferPages = Math.max(1, Math.ceil(transfers.length / LEDGER_PAGE_SIZE));
  const currentRecordsPage = Math.min(recordsPage, totalTransferPages);
  const paginatedTransfers = useMemo(() => {
    const start = (currentRecordsPage - 1) * LEDGER_PAGE_SIZE;
    return sortedTransfers.slice(start, start + LEDGER_PAGE_SIZE);
  }, [currentRecordsPage, sortedTransfers]);

  const pharmacistOptions = useMemo(
    () => pharmacists.map(pharmacist => ({
      value: pharmacist.id,
      label: pharmacist.code ? `${pharmacist.code} - ${pharmacist.name}` : pharmacist.name,
      hint: pharmacist.code
    })),
    [pharmacists]
  );

  const loadBranches = async () => {
    if (isBranch) {
      setBranches([user]);
      return;
    }
    const data = await branchService.list();
    setBranches(data);
    setRecordBranchId(prev => prev || data[0]?.id || '');
  };

  const loadPharmacists = async () => {
    if (!recordBranchId) {
      setPharmacists([]);
      return;
    }
    const data = await pharmacistService.listByBranch(recordBranchId);
    setPharmacists(data);
  };

  const loadTransfers = async () => {
    if (!canRead) {
      setTransfers([]);
      setIsLoading(false);
      return;
    }
    if (activeTab === 'record' && !recordBranchId) {
      setTransfers([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const sourceFilter = activeTab === 'dashboard' ? dashboardSource : undefined;
      const dbSource = (sourceFilter === 'delivery_active' || sourceFilter === 'delivery_cancelled' || sourceFilter === 'delivery')
        ? 'delivery'
        : (sourceFilter === 'manual' ? 'manual' : undefined);

      const rows = await benefitPayService.transfers.list({
        branchId: activeBranchFilter || 'all',
        dateFrom: range.from,
        dateTo: range.to,
        transferType: activeTab === 'dashboard' ? dashboardTransferType : undefined,
        source: dbSource
      });

      let filteredRows = rows;
      if (activeTab === 'dashboard') {
        if (sourceFilter === 'delivery_active') {
          filteredRows = rows.filter(r => r.source === 'delivery' && r.deliveryOrderStatus !== 'cancelled');
        } else if (sourceFilter === 'delivery_cancelled') {
          filteredRows = rows.filter(r => r.source === 'delivery' && r.deliveryOrderStatus === 'cancelled');
        }
      }
      setTransfers(filteredRows);
    } catch (error) {
      console.error('Benefit Pay Ledger load failed', error);
      setTransfers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadBranches(); }, [isBranch, user.id]);
  useEffect(() => { loadPharmacists(); }, [recordBranchId]);
  useEffect(() => { loadTransfers(); }, [activeTab, activeBranchFilter, range.from, range.to, canRead, dashboardTransferType, dashboardSource]);
  useEffect(() => { setRecordsPage(1); }, [activeTab, activeBranchFilter, range.from, range.to, dashboardTransferType, dashboardSource, sortMode]);
  useEffect(() => {
    if (!focusTarget?.deliveryOrderId) return;
    setHighlightedDeliveryOrderId(focusTarget.deliveryOrderId);
    setActiveTab(canRecord ? 'record' : 'dashboard');
    if (focusTarget.transferDate) {
      setPreset('custom');
      setCustomFrom(focusTarget.transferDate);
      setCustomTo(focusTarget.transferDate);
    }
    if (focusTarget.branchId) {
      if (canRecord) setRecordBranchId(focusTarget.branchId);
      setDashboardBranchId(focusTarget.branchId);
    }
    setDashboardSource('delivery');
    setRecordsPage(1);
    onFocusConsumed?.();
  }, [canRecord, focusTarget?.branchId, focusTarget?.deliveryOrderId, focusTarget?.transferDate, onFocusConsumed]);
  useEffect(() => {
    if (recordsPage > totalTransferPages) setRecordsPage(totalTransferPages);
  }, [recordsPage, totalTransferPages]);
  useEffect(() => {
    if (!highlightedDeliveryOrderId) return;
    const index = sortedTransfers.findIndex(row => row.deliveryOrderId === highlightedDeliveryOrderId);
    if (index >= 0) setRecordsPage(Math.floor(index / LEDGER_PAGE_SIZE) + 1);
  }, [highlightedDeliveryOrderId, sortedTransfers]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTransferDate(current => current === todayKey() ? todayKey() : current);
    }, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setLocksHydrated(false);
    let nextPharmacistId: string | null = null;
    let nextLocked = false;
    if (lockStorageKey) {
      try {
        const saved = localStorage.getItem(lockStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as { pharmacistId?: string | null; isPharmacistLocked?: boolean };
          if (parsed.isPharmacistLocked && parsed.pharmacistId) {
            nextPharmacistId = parsed.pharmacistId;
            nextLocked = true;
          }
        }
      } catch (error) {
        console.warn('Could not restore Benefit Pay entry lock', error);
      }
    }
    setPharmacistId(nextPharmacistId);
    setIsPharmacistLocked(nextLocked);
    setLocksHydrated(true);
  }, [lockStorageKey]);

  useEffect(() => {
    if (!lockStorageKey || !locksHydrated) return;
    if (!isPharmacistLocked || !pharmacistId) {
      localStorage.removeItem(lockStorageKey);
      return;
    }
    localStorage.setItem(lockStorageKey, JSON.stringify({
      isPharmacistLocked,
      pharmacistId
    }));
  }, [lockStorageKey, locksHydrated, isPharmacistLocked, pharmacistId]);

  const handlePeriodChange = (nextPreset: PeriodPreset, from?: string, to?: string) => {
    setPreset(nextPreset);
    if (from !== undefined) setCustomFrom(from);
    if (to !== undefined) setCustomTo(to);
  };

  const resetForm = () => {
    setValue('');
    setTransferTime(currentTimeValue());
    setNotes('');
    setTransferDate(todayKey());
    setEditingTransfer(null);
    if (!isPharmacistLocked) setPharmacistId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recordBranchId) {
      Swal.fire('Branch required', 'Select the branch before saving the Benefit Pay transfer.', 'warning');
      return;
    }
    if (!pharmacistId) {
      Swal.fire('Pharmacist required', 'Select the pharmacist before saving the Benefit Pay transfer.', 'warning');
      return;
    }
    if (!TIME_24H_PATTERN.test(transferTime)) {
      Swal.fire('Invalid transfer time', 'Enter the transfer time in 24-hour format, for example 09:30 or 17:45.', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        branchId: recordBranchId,
        transferDate,
        pharmacistId,
        transferType,
        valueBhd: value,
        transferTime,
        notes
      };
      if (editingTransfer) {
        const updated = await benefitPayService.transfers.update(editingTransfer.id, payload);
        setTransfers(prev => prev.map(item => item.id === updated.id ? updated : item));
        resetForm();
        Swal.fire('Updated', `${updated.serialNumber} was updated.`, 'success');
        return;
      }

      const created = await benefitPayService.transfers.insert(payload);
      resetForm();
      if (activeTab === 'record') {
        setTransfers(prev => [created, ...prev]);
      }
      Swal.fire('Saved', `${created.serialNumber} was added to Benefit Pay Ledger.`, 'success');
    } catch (error: any) {
      Swal.fire('Save failed', error?.message || 'Could not save Benefit Pay transfer.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (row: BenefitPayTransfer) => {
    setActiveTab('record');
    setEditingTransfer(row);
    setRecordBranchId(row.branchId);
    setTransferDate(row.transferDate);
    setPharmacistId(row.pharmacistId || null);
    setTransferType(row.transferType);
    setValue(formatBhdAmount(row.valueBhd));
    setTransferTime(row.transferTime || currentTimeValue());
    setNotes(row.notes || '');
  };

  const handleDelete = async (row: BenefitPayTransfer) => {
    const confirm = await Swal.fire({
      title: 'Delete BP transfer?',
      text: `${row.serialNumber} will be removed from the ledger.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#B91c1c'
    });
    if (!confirm.isConfirmed) return;
    try {
      await benefitPayService.transfers.delete(row.id);
      setTransfers(prev => prev.filter(item => item.id !== row.id));
      if (editingTransfer?.id === row.id) resetForm();
    } catch (error: any) {
      Swal.fire('Delete failed', error?.message || 'Could not delete this Benefit Pay transfer.', 'error');
    }
  };

  const handleExcel = () => {
    const branchCode = selectedDashboardBranch?.code || (isBranch ? user.code : 'ALL');
    const consolidated = activeTab === 'dashboard' && !isBranch && dashboardBranchId === 'all';
    exportBenefitPayToExcel(
      sortedTransfers,
      `${selectedDashboardBranch?.name || (isBranch ? user.name : 'All branches')} - ${moduleTitle} - ${compactRangeLabel(range.from, range.to)}`,
      consolidated
        ? benefitPayConsolidatedExportFileName(range.from, range.to)
        : benefitPayExportFileName(branchCode, range.from, range.to),
      { consolidated, sortMode }
    ).catch(error => Swal.fire('Export failed', error?.message || 'Could not export Benefit Pay sheet.', 'error'));
  };

  const handlePrint = () => {
    const branchCode = selectedDashboardBranch?.code || (isBranch ? user.code : 'ALL');
    try {
      printBenefitPayReport(
        sortedTransfers,
        `${selectedDashboardBranch?.name || (isBranch ? user.name : 'All branches')} - ${moduleTitle} - ${compactRangeLabel(range.from, range.to)}`,
        benefitPayExportFileName(branchCode, range.from, range.to)
      );
    } catch (error: any) {
      Swal.fire('PDF failed', error?.message || 'Could not generate Benefit Pay PDF.', 'error');
    }
  };

  if (!canRead) {
    return (
      <div className="space-y-6 page-enter">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Finance module</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{moduleTitle}</h2>
          </div>
          <BackToModulesButton onClick={onBack} />
        </div>
        <section className="operational-panel p-8 text-center">
          <p className="text-sm font-bold text-slate-500">You do not have access to {moduleTitle}.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Finance module</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{moduleTitle}</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {canRecord
              ? 'Record branch Benefit Pay transfers, audit delivery BP auto-sync, and export daily sheets.'
              : 'Review Benefit Pay activity across branches with KPIs, filters, and consolidated exports.'}
          </p>
        </div>
        <BackToModulesButton onClick={onBack} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        {canRecord && (
          <div className="flex bg-slate-100/60 p-1 rounded-lg border border-slate-200/50 w-fit max-w-full overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('record')}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'record' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ReceiptText className="h-3.5 w-3.5" /> Record
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'dashboard' ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Branch Dashboard
            </button>
          </div>
        )}

        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          <div className="min-w-[260px] flex-1 md:w-[320px] md:flex-none">
            <SearchableSelect
              options={activeTab === 'record' ? branchOptions : dashboardBranchOptions}
              value={activeTab === 'record' ? recordBranchId : dashboardBranchId}
              onChange={value => {
                if (activeTab === 'record') setRecordBranchId(value || '');
                else setDashboardBranchId(value || 'all');
              }}
              placeholder="Select branch"
              disabled={isBranch}
              allowClear={false}
            />
          </div>
          <button
            type="button"
            onClick={loadTransfers}
            className="btn-secondary h-10 text-[10px] uppercase tracking-widest"
            title="Refresh Benefit Pay data"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {activeTab === 'record' && canRecord && (
        <section className="operational-panel p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">{editingTransfer ? 'Edit transfer' : 'New transfer'}</p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">{editingTransfer ? 'Edit Benefit Pay' : 'Record Benefit Pay'}</h3>
              <p className="mt-1 text-xs font-bold text-slate-400">
                {editingTransfer ? `${editingTransfer.serialNumber} / ${sourceLabel(editingTransfer)}` : 'SN is generated automatically per branch and day.'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Next SN</p>
              <p className="mt-0.5 text-sm font-black text-slate-900">
                {editingTransfer ? editingTransfer.serialNumber : selectedRecordBranch ? `BP-${selectedRecordBranch.code}-${serialDatePart(transferDate)}-##` : 'Select branch'}
              </p>
            </div>
          </div>

          {!recordBranchId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800">
              Select a branch first to record Benefit Pay transfers.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-x-8">
              <div className="space-y-1">
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={transferDate}
                  required
                  onChange={event => setTransferDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none focus:border-brand/40"
                />
                <p className="mt-1 text-[10px] font-bold text-slate-400">Defaults to today's date.</p>
              </div>

              <div className="space-y-1 lg:border-l lg:border-slate-100 lg:pl-6">
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Transfer value (BHD) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min="0"
                  placeholder="0.000"
                  value={value}
                  required
                  onChange={event => setValue(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-black outline-none focus:border-brand/40"
                />
              </div>

              <div className="space-y-1">
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Pharmacist <span className="text-red-600">*</span>
                </label>
                <SearchableSelect
                  options={pharmacistOptions}
                  value={pharmacistId}
                  onChange={setPharmacistId}
                  placeholder="Select pharmacist"
                  disabled={pharmacists.length === 0 || isPharmacistLocked}
                  allowClear={!isPharmacistLocked}
                />
                <button
                  type="button"
                  onClick={() => setIsPharmacistLocked(current => !current)}
                  disabled={!pharmacistId && !isPharmacistLocked}
                  className={`mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-black uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    isPharmacistLocked
                      ? 'border-brand/20 bg-brand/5 text-brand'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-brand/30 hover:text-brand'
                  }`}
                >
                  {isPharmacistLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  {isPharmacistLocked ? 'Unlock pharmacist' : 'Lock pharmacist'}
                </button>
                {pharmacists.length === 0 && (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-700">
                    No pharmacists are assigned to this branch yet.
                  </p>
                )}
              </div>

              <div className="space-y-1 lg:border-l lg:border-slate-100 lg:pl-6">
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Type of transfer <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200/50 bg-slate-100/60 p-1">
                  {TRANSFER_TYPES.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTransferType(option.value)}
                      className={`rounded-md px-2 py-2 text-center transition-all ${
                        transferType === option.value ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span className="block text-[10px] font-black uppercase tracking-widest">{option.label}</span>
                      <span className="mt-0.5 block text-[9px] font-bold normal-case tracking-normal opacity-70">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Time of transfer (24H) <span className="text-red-600">*</span>
                </label>
                <div className="flex gap-2">
                  <TimeInput24
                    value={transferTime}
                    required
                    onChange={setTransferTime}
                    ariaLabel="Transfer time"
                  />
                  <button
                    type="button"
                    onClick={() => setTransferTime(currentTimeValue())}
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-slate-600 transition hover:border-brand/30 hover:text-brand"
                  >
                    Now
                  </button>
                </div>
                <p className="text-[10px] font-bold text-slate-400">24-hour format only, example: 17:45</p>
              </div>

              <div className="space-y-1 lg:border-l lg:border-slate-100 lg:pl-6">
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Note
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  placeholder="Optional receipt or audit note"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold outline-none placeholder:text-slate-300 focus:border-brand/40"
                />
              </div>

              <div className="lg:col-span-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:border-brand/30 hover:text-brand"
                >
                  {editingTransfer ? 'Cancel edit' : 'Reset'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm shadow-brand/20 transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}
                  {editingTransfer ? 'Update BP transfer' : 'Save BP transfer'}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {activeTab === 'dashboard' && (
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <PeriodFilter preset={preset} customFrom={customFrom} customTo={customTo} onChange={handlePeriodChange} />
          <div className="flex items-center gap-2">
            {isModuleEnabled('excelExport') && (
              <button type="button" onClick={handleExcel} className="btn-secondary text-[10px] uppercase tracking-widest">
                <FileDown className="h-3.5 w-3.5" /> Excel
              </button>
            )}
            <button type="button" onClick={handlePrint} className="btn-secondary text-[10px] uppercase tracking-widest">
              <Printer className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <section className="operational-panel p-4 print:hidden">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Filters</p>
              <h3 className="mt-1 text-base font-black tracking-tight text-slate-950">{recordsScopeLabel}</h3>
              <p className="mt-0.5 text-xs font-bold text-slate-400">{recordsScopeMeta}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current view</p>
              <p className="mt-0.5 text-xs font-black text-slate-800">
                {dashboardTransferType === 'all' ? 'All types' : dashboardTransferType} / {
                  dashboardSource === 'all'
                    ? 'All sources'
                    : dashboardSource === 'manual'
                    ? 'In-store'
                    : dashboardSource === 'delivery_active'
                    ? 'Active Delivery'
                    : dashboardSource === 'delivery_cancelled'
                    ? 'Cancelled Delivery'
                    : 'Delivery'
                }
              </p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1fr_0.95fr_0.75fr]">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Transfer type</p>
              <div className="grid grid-cols-4 gap-1 rounded-lg border border-slate-200/60 bg-slate-100/70 p-1">
                {([{ value: 'all', label: 'All' }, ...TRANSFER_TYPES] as Array<{ value: BenefitPayTransferType | 'all'; label: string }>).map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDashboardTransferType(option.value)}
                    className={`rounded-md px-2 py-2 text-[10px] font-black uppercase tracking-widest transition ${
                      dashboardTransferType === option.value
                        ? 'bg-white text-brand shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Source</p>
              <div className="grid grid-cols-4 gap-1 rounded-lg border border-slate-200/60 bg-slate-100/70 p-1">
                {([
                  { value: 'all', label: 'All' },
                  { value: 'manual', label: 'In-store' },
                  { value: 'delivery_active', label: 'Active Del' },
                  { value: 'delivery_cancelled', label: 'Cancelled Del' }
                ] as Array<{ value: BenefitPaySourceFilter; label: string }>).map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDashboardSource(option.value)}
                    className={`rounded-md px-2 py-2 text-[10px] font-black uppercase tracking-widest transition ${
                      dashboardSource === option.value
                        ? 'bg-white text-brand shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sort records</p>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200/60 bg-slate-100/70 p-1">
                {([
                  { value: 'time', label: 'Time' },
                  { value: 'branch', label: 'Branch' }
                ] as Array<{ value: BenefitPayExportSortMode; label: string }>).map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSortMode(option.value)}
                    className={`rounded-md px-2 py-2 text-[10px] font-black uppercase tracking-widest transition ${
                      sortMode === option.value
                        ? 'bg-white text-brand shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'dashboard' && (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            label="Active transfers"
            value={String(totals.count)}
            sub={totals.cancelledCount > 0 ? `All: ${totals.allCount} (${totals.cancelledCount} cancelled)` : periodLabel(preset, range.from, range.to)}
            icon={<ReceiptText className="h-4 w-4" />}
            tone="slate"
          />
          <KpiCard
            label="Active total value"
            value={`${formatBhd(totals.total)} BHD`}
            sub={totals.cancelledTotal > 0 ? `Cancelled: ${formatBhd(totals.cancelledTotal)} BHD` : periodLabel(preset, range.from, range.to)}
            icon={<Banknote className="h-4 w-4" />}
            tone="brand"
          />
          <KpiCard
            label="In-store (Active)"
            value={String(totals.manualCount)}
            sub={`${formatBhd(totals.manual)} BHD`}
            icon={<Landmark className="h-4 w-4" />}
            tone="emerald"
          />
          <KpiCard
            label="Delivery BP (Active)"
            value={String(totals.deliveryCount)}
            sub={`${formatBhd(totals.delivery)} BHD`}
            icon={<WalletCards className="h-4 w-4" />}
            tone="blue"
          />
        </section>
      )}

      <section className="operational-panel p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">
              {activeTab === 'record' ? 'Recent records' : 'BP dashboard'}
            </p>
            <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">
              {recordsScopeLabel}
            </h3>
            <p className="mt-0.5 text-xs font-bold text-slate-400">{recordsScopeMeta}</p>
          </div>
          <p className="text-xs font-bold text-slate-400">
            {totals.cancelledCount > 0
              ? `${totals.count} active (${totals.cancelledCount} cancelled) / ${formatBhd(totals.total)} BHD`
              : `${totals.count} transfers / ${formatBhd(totals.total)} BHD`}
          </p>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-100 border-t-brand"></div>
          </div>
        ) : transfers.length === 0 ? (
          <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 text-center">
            <ReceiptText className="h-7 w-7 text-slate-300" />
            <p className="mt-3 text-xs font-bold text-slate-400">No Benefit Pay transfers in this period.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="py-2 pr-3">SN / date</th>
                    <th className="py-2 pr-3">Branch</th>
                    <th className="py-2 pr-3">Transfer</th>
                    <th className="py-2 pr-3 text-right">Value</th>
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Pharmacist</th>
                    <th className="py-2 pr-3">Source</th>
                    {canManageRows && <th className="py-2 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedTransfers.map(row => {
                    const isHighlightedTransfer = highlightedDeliveryOrderId === row.deliveryOrderId;
                    const canOpenDeliveryOrder = row.source === 'delivery' && row.deliveryOrderId && onOpenDeliveryOrder;

                    return (
                    <tr key={row.id} className={`hover:bg-slate-50/50 ${isHighlightedTransfer ? 'bg-brand/5 ring-2 ring-inset ring-brand/20' : ''}`}>
                      <td className="py-2 pr-3 text-xs font-bold text-slate-500">
                        <span className="block break-words font-black text-brand">{row.serialNumber}</span>
                        <span className="block">{formatTransferDate(row.transferDate)}</span>
                      </td>
                      <td className="py-2 pr-3 text-xs font-bold text-slate-500">{row.branchName || row.branchCode || '-'}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${transferTypeClass(row.transferType)}`}>
                          {row.transferType}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-black text-slate-950 tabular-nums">{formatBhdAmount(row.valueBhd)}</td>
                      <td className="py-2 pr-3 text-xs font-bold text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-300" /> {row.transferTime}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs font-bold text-slate-500">{row.pharmacistName || '-'}</td>
                      <td className="py-2 pr-3">
                        {canOpenDeliveryOrder ? (
                          <button
                            type="button"
                            onClick={() => onOpenDeliveryOrder?.(row)}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black transition hover:border-brand/30 hover:bg-brand/10 ${sourceBadgeClass(row)}`}
                            title="Open linked delivery order"
                          >
                            {sourceLabel(row)}
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${sourceBadgeClass(row)}`}>
                            {sourceLabel(row)}
                          </span>
                        )}
                      </td>
                      {canManageRows && (
                        <td className="py-2 text-right">
                          {canModifyTransfer(row) ? (
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleEdit(row)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100"
                                title="Edit transfer"
                                aria-label="Edit transfer"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(row)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100"
                                title="Delete transfer"
                                aria-label="Delete transfer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 text-[10px] font-bold text-slate-400" title="Auto-synced from delivery order. Must edit in delivery order.">
                              <Lock className="h-3 w-3" /> Auto-synced
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 md:hidden">
              {paginatedTransfers.map(row => {
                const isHighlightedTransfer = highlightedDeliveryOrderId === row.deliveryOrderId;
                const canOpenDeliveryOrder = row.source === 'delivery' && row.deliveryOrderId && onOpenDeliveryOrder;

                return (
                <div key={row.id} className={`rounded-lg border bg-white p-3 ${isHighlightedTransfer ? 'border-brand/30 ring-2 ring-brand/20' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-brand">{row.serialNumber}</p>
                      <p className="mt-0.5 text-[11px] font-bold text-slate-400">{formatTransferDate(row.transferDate)} / {row.transferTime}</p>
                    </div>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${transferTypeClass(row.transferType)}`}>
                      {row.transferType}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="font-black uppercase tracking-widest text-slate-400 text-[9px]">Value</p>
                      <p className="mt-1 font-black text-slate-950">{formatBhd(row.valueBhd)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="font-black uppercase tracking-widest text-slate-400 text-[9px]">Pharmacist</p>
                      <p className="mt-1 font-bold text-slate-700">{row.pharmacistName || '-'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {canOpenDeliveryOrder ? (
                      <button
                        type="button"
                        onClick={() => onOpenDeliveryOrder?.(row)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black transition hover:border-brand/30 hover:bg-brand/10 ${sourceBadgeClass(row)}`}
                        title="Open linked delivery order"
                      >
                        {sourceLabel(row)}
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    ) : (
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${sourceBadgeClass(row)}`}>
                        {sourceLabel(row)}
                      </span>
                    )}
                    {canManageRows && (
                      <div className="inline-flex items-center gap-1">
                        {canModifyTransfer(row) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEdit(row)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"
                              aria-label="Edit transfer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700"
                              aria-label="Delete transfer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-2 text-[10px] font-bold text-slate-400" title="Auto-synced from delivery order. Must edit in delivery order.">
                            <Lock className="h-3 w-3" /> Auto-synced
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>

            <PaginationControls
              currentPage={currentRecordsPage}
              totalItems={transfers.length}
              pageSize={LEDGER_PAGE_SIZE}
              onPageChange={setRecordsPage}
              itemLabel="transfers"
            />
          </>
        )}
      </section>
    </div>
  );
};
