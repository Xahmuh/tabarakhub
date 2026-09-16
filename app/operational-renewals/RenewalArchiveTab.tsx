import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Archive, History, Banknote, Calendar, UserCheck, Shield,
  Search, Filter, Download, ArrowUpDown, RefreshCw, CheckCircle2,
  AlertTriangle, RotateCcw, Building2, Truck, ExternalLink,
  ChevronRight, FileSpreadsheet, Eye, Sparkles, Layers
} from 'lucide-react';
import Swal from 'sweetalert2';
import {
  Branch,
  OperationalRenewalRecord,
  OperationalRenewalHistory,
  OperationalRenewalType
} from '../../types';
import { operationalRenewalService, getOperationalEntityDisplayName } from '../../services/operationalRenewalService';

interface RenewalArchiveTabProps {
  user: Branch;
  currentUser?: { id?: string; name?: string; code?: string; role?: string };
  allRecords: OperationalRenewalRecord[];
  canEdit?: boolean;
  canManage?: boolean;
  canDelete?: boolean;
  onViewDetails: (record: OperationalRenewalRecord) => void;
  onRecordRestored: () => Promise<void>;
}

export const RenewalArchiveTab: React.FC<RenewalArchiveTabProps> = ({
  user,
  currentUser,
  allRecords,
  canEdit = true,
  canManage = true,
  canDelete = false,
  onViewDetails,
  onRecordRestored
}) => {
  // Mode: 'history' (renewal & payment log) vs 'archived' (soft-deleted records)
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'archived'>('history');

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyList, setHistoryList] = useState<OperationalRenewalHistory[]>([]);
  const [archivedRecords, setArchivedRecords] = useState<OperationalRenewalRecord[]>([]);

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'ALL' | 'ADMIN' | 'ACCOUNTS'>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<OperationalRenewalType | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Fetch Global History
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const hist = await operationalRenewalService.listAllHistory();
      // Enrich history entries with parent record entity name if missing
      const recordMap = new Map<string, OperationalRenewalRecord>();
      allRecords.forEach(r => recordMap.set(r.id, r));

      const enriched = hist.map(h => {
        const parent = recordMap.get(h.renewalId);
        return {
          ...h,
          entityName: h.entityName || parent?.entityName || 'Unnamed Entity',
          renewalType: h.renewalType || parent?.renewalType || 'OTHER',
          documentNumber: h.documentNumber || parent?.documentNumber || '—'
        };
      });

      setHistoryList(enriched);
    } catch (err) {
      console.error('Failed to load renewal history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [allRecords]);

  // Fetch Archived (inactive) records
  const fetchArchived = useCallback(async () => {
    try {
      const arch = await operationalRenewalService.listArchived();
      setArchivedRecords(arch);
    } catch (err) {
      console.error('Failed to load archived records:', err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchArchived();
  }, [fetchHistory, fetchArchived]);

  // Handle Restore Record
  const handleRestore = async (record: OperationalRenewalRecord) => {
    const confirm = await Swal.fire({
      title: 'Restore Record?',
      text: `Do you want to restore "${record.entityName}" back to active renewals?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Restore'
    });

    if (!confirm.isConfirmed) return;

    try {
      await operationalRenewalService.restore(record.id, currentUser);
      await fetchArchived();
      await onRecordRestored();
      await Swal.fire({
        icon: 'success',
        title: 'Restored Successfully',
        text: `Record has been reactivated and returned to the renewals dashboard.`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire('Error', err?.message || 'Failed to restore record', 'error');
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalRenewals = historyList.length;
    let totalSettledCost = 0;
    let adminOps = 0;
    let accountsOps = 0;

    historyList.forEach(h => {
      if (h.cost && !isNaN(h.cost)) {
        totalSettledCost += Number(h.cost);
      }
      const perf = (h.performedBy || '').toLowerCase();
      if (perf.includes('admin')) adminOps++;
      if (perf.includes('accounts')) accountsOps++;
    });

    return {
      totalRenewals,
      totalSettledCost,
      adminOps,
      accountsOps,
      archivedCount: archivedRecords.length
    };
  }, [historyList, archivedRecords]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    return historyList.filter(h => {
      // Role filter
      if (selectedRoleFilter === 'ADMIN') {
        if (!(h.performedBy || '').toLowerCase().includes('admin')) return false;
      } else if (selectedRoleFilter === 'ACCOUNTS') {
        if (!(h.performedBy || '').toLowerCase().includes('accounts')) return false;
      }

      // Type filter
      if (selectedTypeFilter !== 'ALL' && h.renewalType !== selectedTypeFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesEntity = (h.entityName || '').toLowerCase().includes(q);
        const matchesDoc = (h.newDocumentNumber || h.previousDocumentNumber || h.documentNumber || '').toLowerCase().includes(q);
        const matchesBy = (h.performedBy || '').toLowerCase().includes(q);
        const matchesNotes = (h.notes || '').toLowerCase().includes(q);
        const matchesMethod = (h.paymentMethod || '').toLowerCase().includes(q);
        const matchesRef = (h.paymentReference || '').toLowerCase().includes(q);
        if (!matchesEntity && !matchesDoc && !matchesBy && !matchesNotes && !matchesMethod && !matchesRef) {
          return false;
        }
      }

      return true;
    });
  }, [historyList, selectedRoleFilter, selectedTypeFilter, searchTerm]);

  // Filtered Archived Records
  const filteredArchived = useMemo(() => {
    return archivedRecords.filter(r => {
      if (selectedTypeFilter !== 'ALL' && r.renewalType !== selectedTypeFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesEntity = r.entityName.toLowerCase().includes(q);
        const matchesDoc = r.documentNumber.toLowerCase().includes(q);
        if (!matchesEntity && !matchesDoc) return false;
      }
      return true;
    });
  }, [archivedRecords, selectedTypeFilter, searchTerm]);

  // Pagination slice
  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, page]);

  const paginatedArchived = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredArchived.slice(start, start + pageSize);
  }, [filteredArchived, page]);

  const totalPages = activeSubTab === 'history'
    ? Math.max(1, Math.ceil(filteredHistory.length / pageSize))
    : Math.max(1, Math.ceil(filteredArchived.length / pageSize));

  // Export to CSV
  const handleExportCsv = () => {
    if (activeSubTab === 'history') {
      const headers = ['Entity Name', 'Renewal Type', 'Document Number', 'Previous Expiry', 'New Expiry', 'Amount Paid (BHD)', 'Payment Date', 'Payment Method', 'Payment Reference', 'Recorded By', 'Performed At', 'Notes'];
      const rows = filteredHistory.map(h => [
        `"${(h.entityName || '').replace(/"/g, '""')}"`,
        `"${h.renewalType || ''}"`,
        `"${h.newDocumentNumber || h.previousDocumentNumber || ''}"`,
        `"${h.previousExpiryDate || ''}"`,
        `"${h.newExpiryDate || ''}"`,
        `"${h.cost !== undefined ? h.cost.toFixed(3) : ''}"`,
        `"${h.paidAt || ''}"`,
        `"${h.paymentMethod || ''}"`,
        `"${h.paymentReference || ''}"`,
        `"${(h.performedBy || '').replace(/"/g, '""')}"`,
        `"${h.performedAt || ''}"`,
        `"${(h.notes || '').replace(/"/g, '""')}"`
      ]);
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Renewal_Ledger_Archive_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Tab Control */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <Archive className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Archive & Renewal Ledger</span>
                  <span className="text-xs font-bold text-slate-400 font-sans">
                    (سجل التجديدات والأرشيف والمدفوعات)
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Permanent audit trail of renewed licenses, settled fee payments, role signatures, and archived records.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons & Sub-View Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setActiveSubTab('history');
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                  activeSubTab === 'history'
                    ? 'bg-white text-emerald-800 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="h-4 w-4" />
                <span>Renewal & Payment Ledger</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800 font-mono">
                  {historyList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSubTab('archived');
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                  activeSubTab === 'archived'
                    ? 'bg-white text-rose-800 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Archive className="h-4 w-4" />
                <span>Archived Records</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800 font-mono">
                  {archivedRecords.length}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                fetchHistory();
                fetchArchived();
              }}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
              title="Refresh ledger"
            >
              <RefreshCw className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black transition-all shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* 5 KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {/* Card 1: Total Renewals */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Renewals Completed
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-slate-900">
                {stats.totalRenewals}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">trans</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block font-medium">Historical audit records</span>
          </div>

          {/* Card 2: Total Paid Fees */}
          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-1 flex items-center gap-1">
              <Banknote className="h-3 w-3" />
              Total Fees Settled
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-emerald-950">
                {stats.totalSettledCost.toFixed(3)}
              </span>
              <span className="text-[10px] text-emerald-800 font-bold">BHD</span>
            </div>
            <span className="text-[10px] text-emerald-700 mt-1 block font-medium">Official tariffs paid</span>
          </div>

          {/* Card 3: Admin Operations */}
          <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200/80">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Admin Actions
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-purple-950">
                {stats.adminOps}
              </span>
              <span className="text-[10px] text-purple-800 font-bold">ops</span>
            </div>
            <span className="text-[10px] text-purple-600 mt-1 block font-medium">Signed by Admin accounts</span>
          </div>

          {/* Card 4: Accounts Operations */}
          <div className="bg-teal-50/70 p-4 rounded-2xl border border-teal-200/80">
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 mb-1 flex items-center gap-1">
              <UserCheck className="h-3 w-3" />
              Accounts Actions
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-teal-950">
                {stats.accountsOps}
              </span>
              <span className="text-[10px] text-teal-800 font-bold">ops</span>
            </div>
            <span className="text-[10px] text-teal-700 mt-1 block font-medium">Signed by Finance accounts</span>
          </div>

          {/* Card 5: Inactive / Archived */}
          <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200/80">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 mb-1 flex items-center gap-1">
              <Archive className="h-3 w-3" />
              Archived Records
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-rose-950">
                {stats.archivedCount}
              </span>
              <span className="text-[10px] text-rose-800 font-bold">items</span>
            </div>
            <span className="text-[10px] text-rose-600 mt-1 block font-medium">Can be restored anytime</span>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by entity name, document number, payment ref, or recorded by..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeSubTab === 'history' && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">Role Filter:</span>
                <button
                  type="button"
                  onClick={() => { setSelectedRoleFilter('ALL'); setPage(1); }}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                    selectedRoleFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedRoleFilter('ADMIN'); setPage(1); }}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                    selectedRoleFilter === 'ADMIN' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedRoleFilter('ACCOUNTS'); setPage(1); }}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                    selectedRoleFilter === 'ACCOUNTS' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Accounts
                </button>
              </div>
            )}

            <select
              value={selectedTypeFilter}
              onChange={e => {
                setSelectedTypeFilter(e.target.value as any);
                setPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="ALL">All Renewal Types</option>
              <option value="WORK_PERMIT">Work Permit (LMRA)</option>
              <option value="CR">Commercial Registration (CR)</option>
              <option value="NHRA_PHARMACY">NHRA Pharmacy Facility</option>
              <option value="NHRA_PHARMACIST">NHRA Pharmacist</option>
              <option value="FLEET_VEHICLE">Fleet Vehicle</option>
              <option value="OTHER">Other Licenses</option>
            </select>
          </div>
        </div>
      </div>

      {/* SUB-VIEW 1: RENEWAL & PAYMENT HISTORY LEDGER */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Renewal & Payment Audit Ledger
              </h4>
              <p className="text-xs text-slate-500">
                Showing {filteredHistory.length} transaction logs · Permanently archived
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-bold text-emerald-800">Audit Guaranteed</span>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <History className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No renewal history entries found.</p>
              <p className="text-xs text-slate-400">When renewals are confirmed in the system, they will appear here with payment and signature details.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[10px] font-black border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Entity & Document</th>
                    <th className="py-3.5 px-4">Validity Transition</th>
                    <th className="py-3.5 px-4">Amount Paid</th>
                    <th className="py-3.5 px-4">Payment Date & Method</th>
                    <th className="py-3.5 px-4">Performed By (Account)</th>
                    <th className="py-3.5 px-4">Action Date</th>
                    <th className="py-3.5 px-4 text-right">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedHistory.map((h, idx) => {
                    const perfLower = (h.performedBy || '').toLowerCase();
                    const isAdmin = perfLower.includes('admin');
                    const isAccounts = perfLower.includes('accounts');

                    return (
                      <tr key={h.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        {/* Entity & Document */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <span className="font-black text-slate-900 block text-xs">
                              {h.entityName || 'Unnamed Entity'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-slate-500">
                                {h.newDocumentNumber || h.previousDocumentNumber || h.documentNumber || '—'}
                              </span>
                              {h.renewalType && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-slate-100 text-slate-600">
                                  {h.renewalType}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Validity Transition */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-rose-600">
                              {h.previousExpiryDate || '—'}
                            </span>
                            <span className="text-slate-400">➔</span>
                            <span className="font-mono text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                              {h.newExpiryDate || '—'}
                            </span>
                          </div>
                        </td>

                        {/* Amount Paid */}
                        <td className="py-3.5 px-4">
                          {h.cost !== undefined ? (
                            <span className="inline-flex items-center gap-1 font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                              <Banknote className="h-3.5 w-3.5 text-emerald-700" />
                              <span>{Number(h.cost).toFixed(3)}</span>
                              <span className="text-[10px] font-sans">BD</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* Payment Date & Method */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <span className="font-mono text-xs font-bold text-slate-800 block">
                              {h.paidAt || (h.performedAt ? h.performedAt.split('T')[0] : '—')}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {h.paymentMethod && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                                  {h.paymentMethod}
                                </span>
                              )}
                              {h.paymentReference && (
                                <span className="text-[10px] font-mono text-slate-500 truncate max-w-[120px]" title={h.paymentReference}>
                                  Ref: {h.paymentReference}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Performed By (Account & Role Stamp) */}
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`p-1 rounded-md ${
                              isAdmin
                                ? 'bg-purple-100 text-purple-700'
                                : isAccounts
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-700'
                            }`}>
                              {isAdmin ? <Shield className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                            </span>
                            <div>
                              <span className={`block font-black text-xs ${
                                isAdmin
                                  ? 'text-purple-900'
                                  : isAccounts
                                    ? 'text-emerald-900'
                                    : 'text-slate-800'
                              }`}>
                                {h.performedBy || 'System'}
                              </span>
                              <span className={`text-[9px] font-bold uppercase tracking-wider ${
                                isAdmin
                                  ? 'text-purple-600'
                                  : isAccounts
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                              }`}>
                                {isAdmin ? 'ADMINISTRATOR' : isAccounts ? 'ACCOUNTS / FINANCE' : 'USER'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Performed At */}
                        <td className="py-3.5 px-4 text-[11px] text-slate-500 font-mono">
                          {new Date(h.performedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>

                        {/* Notes */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="text-[11px] text-slate-600 max-w-xs truncate ml-auto" title={h.notes}>
                            {h.notes || '—'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({filteredHistory.length} total entries)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 2: ARCHIVED / INACTIVE RECORDS REPOSITORY */}
      {activeSubTab === 'archived' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Archived Records Repository (السجلات المؤرشفة)
              </h4>
              <p className="text-xs text-slate-500">
                These operational items were soft-deleted or archived. You can inspect or restore them at any time.
              </p>
            </div>
            <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-xl">
              {filteredArchived.length} Inactive Records
            </span>
          </div>

          {filteredArchived.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Archive className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No archived records found.</p>
              <p className="text-xs text-slate-400">All active renewal documents are currently in the main renewals table.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[10px] font-black border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Entity Name</th>
                    <th className="py-3.5 px-4">Document / Number</th>
                    <th className="py-3.5 px-4">Branch</th>
                    <th className="py-3.5 px-4">Last Expiry Date</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedArchived.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-black text-slate-900 block text-xs">
                          {rec.entityName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          {rec.renewalType}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {rec.documentNumber}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {rec.branchName || rec.branchId || 'All Branches'}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {rec.expiryDate}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                          <Archive className="h-3 w-3" />
                          <span>Archived</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onViewDetails(rec)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Record Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRestore(rec)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                            title="Restore back to active renewals"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Restore to Active</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({filteredArchived.length} archived records)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
