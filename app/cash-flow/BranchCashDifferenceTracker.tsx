import React, { useState, useEffect } from 'react';
import {
    Calendar,
    Search,
    Plus,
    Trash2,
    FileEdit,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    CheckCircle2,
    AlertCircle,
    MessageSquare,
    User,
    Building2,
    Wallet,
    FileCheck,
    FileDown,
    Bell,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    MapPin,
    CalendarDays
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CashDifference, Role, DifferenceStatus, DifferenceType, Branch } from '../../types';
import Swal from 'sweetalert2';

interface BranchCashDifferenceTrackerProps {
    branchId?: string;
    role?: Role;
    pharmacistName?: string;
    onRefresh?: () => void;
}

const escapeHtml = (value: string | null | undefined) =>
    String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

export const BranchCashDifferenceTracker: React.FC<BranchCashDifferenceTrackerProps> = ({
    branchId,
    role = 'branch',
    pharmacistName,
    onRefresh
}) => {
    const [differences, setDifferences] = useState<CashDifference[]>([]);
    const [pharmacists, setPharmacists] = useState<string[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [currentBranchName, setCurrentBranchName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<DifferenceStatus | 'All'>('All');
    const [expandedBranches, setExpandedBranches] = useState<string[]>([]);
    const [showAllLogsBranches, setShowAllLogsBranches] = useState<string[]>([]); // Track which branches show all logs
    const [alertsPage, setAlertsPage] = useState(1); // Pagination for alerts

    // --- Date Filter States ---
    const [dateType, setDateType] = useState<'all' | 'today' | 'yesterday' | '7d' | 'month' | 'custom'>(role === 'manager' || role === 'owner' ? 'all' : 'today');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [manualStart, setManualStart] = useState('');
    const [manualEnd, setManualEnd] = useState('');

    const parseManualDate = (dateStr: string) => {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            if (day && month && year && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
        return null;
    };

    const canEdit = (createdAt: string) => {
        if (role !== 'branch' || !createdAt) return false;
        const created = new Date(createdAt).getTime();
        const now = new Date().getTime();
        const diffHours = (now - created) / (1000 * 60 * 60);
        return diffHours <= 12;
    };

    const canDelete = (createdAt: string) => {
        if (role !== 'branch' || !createdAt) return false;
        const created = new Date(createdAt).getTime();
        const now = new Date().getTime();
        const diffHours = (now - created) / (1000 * 60 * 60);
        return diffHours <= 2;
    };

    useEffect(() => {
        const fetchMetadata = async () => {
            if (branchId) {
                try {
                    const data = await supabase.pharmacists.listByBranch(branchId);
                    setPharmacists(data.map(p => p.name));

                    if (role === 'branch') {
                        const { data: bData } = await supabase.client.from('branches').select('name').eq('id', branchId).single();
                        if (bData) setCurrentBranchName(bData.name);
                    }
                } catch (e) {
                    console.error("Failed to fetch metadata", e);
                }
            }
            if (role === 'manager' || role === 'owner') {
                const bList = await supabase.branches.list();
                setBranches(bList);
            }
        };
        fetchMetadata();
    }, [branchId, role]);

    // Reset state when branchId changes to prevent showing data from previous branch
    useEffect(() => {
        setDifferences([]);
        setSearchTerm('');
        setFilterStatus('All');
        setExpandedBranches([]);
        setShowAllLogsBranches([]);
        setLoading(true);
    }, [branchId]);

    useEffect(() => {
        fetchDifferences();
    }, [branchId, role]);

    const fetchDifferences = async () => {
        setLoading(true);
        const data = await supabase.cashDifferences.list(branchId, role as Role);
        setDifferences(data);
        setLoading(false);
    };

    const handleAddLog = async (existingData?: CashDifference) => {
        const isBranchScopedEntry = role === 'branch' && Boolean(branchId);
        const assignedPharmacistNames = new Set(pharmacists);

        const { value: formValues } = await Swal.fire({
            title: `<span class="text-2xl font-black uppercase tracking-tighter">${existingData ? 'Edit' : 'Log'} Cash Difference</span>`,
            html: `
        <div class="space-y-4 text-left p-4">
          <datalist id="pharmacists-list">
            ${pharmacists.map(p => `<option value="${escapeHtml(p)}"></option>`).join('')}
          </datalist>

          ${(role === 'manager' || role === 'owner') && !branchId ? `
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Branch</label>
              <select id="swal-branch" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold appearance-none">
                <option value="">Select Branch</option>
                ${branches.map(b => `<option value="${b.id}" ${existingData?.branchId === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
              </select>
            </div>
          ` : `
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Branch</label>
              <input type="text" class="w-full p-3 bg-slate-100 border border-slate-200 rounded-lg text-sm font-black text-slate-400" value="${currentBranchName || 'Loading...'}" readonly>
            </div>
          `}
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date</label>
              <input id="swal-date" type="date" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold" value="${existingData ? existingData.date : new Date().toISOString().split('T')[0]}">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pharmacist Name</label>
              <input id="swal-pharmacist" type="text" list="pharmacists-list" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold" value="${existingData ? existingData.pharmacistName : (pharmacistName || '')}" placeholder="Search or enter name">
              ${isBranchScopedEntry && pharmacists.length === 0 ? `
                <p class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-700">
                  No pharmacists are assigned to this branch yet. Please ask a manager to update pharmacist assignments.
                </p>
              ` : ''}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">System Cash (BHD)</label>
              <input id="swal-system" type="number" step="0.001" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold" placeholder="0.000" value="${existingData ? existingData.systemCash : ''}">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Actual Cash (BHD)</label>
              <input id="swal-actual" type="number" step="0.001" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold" placeholder="0.000" value="${existingData ? existingData.actualCash : ''}">
            </div>
          </div>

          <div id="drawer-balance-container" class="animate-in fade-in slide-in-from-top-2">
            <label class="block text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">Cash in Drawer (BHD) *</label>
            <input id="swal-drawer-balance" type="number" step="0.001" class="w-full p-3 bg-slate-50 border border-red-200 rounded-lg text-sm font-bold" placeholder="Required: Current cash in drawer" value="${existingData?.drawerBalance || ''}" required>
            <p class="text-[8px] text-red-500 font-bold mt-1">⚠️ This field is mandatory</p>
          </div>

          <div class="p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center space-x-3 cursor-pointer select-none" onclick="document.getElementById('swal-has-invoices').click()">
            <input id="swal-has-invoices" type="checkbox" ${existingData?.hasInvoices ? 'checked' : ''} class="w-5 h-5 rounded-lg border-emerald-200 text-emerald-600 focus:ring-emerald-500">
            <div class="flex-1">
              <label class="block text-[10px] font-black text-emerald-900 uppercase tracking-widest leading-none">Invoices Forwarded to Accounts</label>
              <p class="text-[9px] text-emerald-600 font-bold mt-1">Select if this difference is offset by submitted invoices</p>
            </div>
          </div>

          <div id="invoice-ref-container" class="${existingData?.hasInvoices ? '' : 'hidden'} animate-in fade-in slide-in-from-top-2">
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Invoice Reference / Receipt #</label>
            <input id="swal-invoice-ref" type="text" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold" placeholder="Enter reference numbers" value="${existingData?.invoiceReference || ''}">
          </div>

          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reason / Notes</label>
            <textarea id="swal-reason" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold h-24" placeholder="Optional explanation...">${existingData?.reason || ''}</textarea>
          </div>
        </div>
      `,
            didOpen: () => {
                const checkbox = document.getElementById('swal-has-invoices') as HTMLInputElement;
                const container = document.getElementById('invoice-ref-container');
                checkbox.addEventListener('change', (e) => {
                    if ((e.target as HTMLInputElement).checked) {
                        container?.classList.remove('hidden');
                    } else {
                        container?.classList.add('hidden');
                    }
                });
            },
            showCancelButton: true,
            confirmButtonText: existingData ? 'Update Record' : 'Record Difference',
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#f8fafc',
            customClass: {
                container: 'rounded-lg',
                popup: 'rounded-lg border-0 shadow-xl',
                confirmButton: 'rounded-lg px-4 py-2.5 font-bold text-sm',
                cancelButton: 'rounded-lg px-4 py-2.5 font-bold text-sm text-slate-500'
            },
            preConfirm: () => {
                const date = (document.getElementById('swal-date') as HTMLInputElement).value;
                const phName = (document.getElementById('swal-pharmacist') as HTMLInputElement).value.trim();
                const targetBranchId = (document.getElementById('swal-branch') as HTMLSelectElement)?.value || branchId;
                const systemCash = parseFloat((document.getElementById('swal-system') as HTMLInputElement).value);
                const actualCash = parseFloat((document.getElementById('swal-actual') as HTMLInputElement).value);
                const hasInvoices = (document.getElementById('swal-has-invoices') as HTMLInputElement).checked;
                const invoiceReference = (document.getElementById('swal-invoice-ref') as HTMLInputElement).value;
                const drawerBalanceStr = (document.getElementById('swal-drawer-balance') as HTMLInputElement).value;
                const drawerBalance = drawerBalanceStr ? parseFloat(drawerBalanceStr) : undefined;
                const reason = (document.getElementById('swal-reason') as HTMLTextAreaElement).value;

                if (!date || !phName || !targetBranchId || isNaN(systemCash) || isNaN(actualCash)) {
                    Swal.showValidationMessage('Please fill in all required fields (Branch, Pharmacist, Financials)');
                    return false;
                }

                if (isBranchScopedEntry && pharmacists.length === 0) {
                    Swal.showValidationMessage('No pharmacists are assigned to this branch yet. Please ask a manager to update pharmacist assignments.');
                    return false;
                }

                if (isBranchScopedEntry && !assignedPharmacistNames.has(phName)) {
                    Swal.showValidationMessage('Select an assigned pharmacist for this branch.');
                    return false;
                }

                if (!drawerBalanceStr || isNaN(drawerBalance!)) {
                    Swal.showValidationMessage('Cash in Drawer is mandatory. Please enter the current cash amount in the drawer.');
                    return false;
                }

                const difference = actualCash - systemCash;
                const differenceType: DifferenceType = difference >= 0 ? 'Increase' : 'Shortage';

                const bName = role === 'branch'
                    ? currentBranchName
                    : (branches.find(b => b.id === targetBranchId)?.name || 'Unknown Branch');

                return {
                    id: existingData?.id,
                    date,
                    branchId: targetBranchId,
                    branchName: bName,
                    pharmacistName: phName,
                    systemCash,
                    actualCash,
                    difference,
                    differenceType,
                    reason,
                    hasInvoices,
                    invoiceReference: hasInvoices ? invoiceReference : null,
                    drawerBalance,
                    status: existingData?.status || 'Open' as DifferenceStatus
                };
            }
        });

        if (formValues) {
            try {
                await supabase.cashDifferences.upsert(formValues);
                Swal.fire({
                    icon: 'success',
                    title: existingData ? 'Updated!' : 'Recorded!',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
                fetchDifferences();
                onRefresh?.();
            } catch (error: any) {
                console.error('❌ Supabase Save Error:', error);
                Swal.fire('Database Error', error.message || 'Failed to save record to Supabase', 'error');
            }
        }
    };

    const handleUpdateStatus = async (diff: CashDifference) => {
        if (role !== 'manager') return;

        const { value: result } = await Swal.fire({
            title: `<span class="text-2xl font-black uppercase tracking-tighter">Review Difference</span>`,
            html: `
        <div class="space-y-4 text-left p-4">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Decision</label>
            <select id="swal-status" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold appearance-none">
              <option value="Open" ${diff.status === 'Open' ? 'selected' : ''}>Pending</option>
              <option value="Reviewed" ${diff.status === 'Reviewed' ? 'selected' : ''}>Reviewed (Manager)</option>
              <option value="Closed" ${diff.status === 'Closed' ? 'selected' : ''}>Approved & Reconciled (Accounts)</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Manager Comment</label>
            <textarea id="swal-comment" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold h-24" placeholder="Add your notes...">${diff.managerComment || ''}</textarea>
          </div>
          <p class="text-[9px] text-emerald-600 font-bold bg-emerald-50 p-3 rounded-xl border border-emerald-100">By closing this, you confirm the reconciliation with the branch.</p>
        </div>
      `,
            showCancelButton: true,
            confirmButtonText: 'Save Update',
            confirmButtonColor: '#ef4444',
            customClass: {
                container: 'rounded-lg',
                popup: 'rounded-lg border-0 shadow-xl',
                confirmButton: 'rounded-lg px-4 py-2.5 font-bold text-sm'
            },
            preConfirm: () => {
                return {
                    status: (document.getElementById('swal-status') as HTMLSelectElement).value as DifferenceStatus,
                    managerComment: (document.getElementById('swal-comment') as HTMLTextAreaElement).value
                };
            }
        });

        if (result) {
            try {
                await supabase.cashDifferences.upsert({
                    ...diff,
                    status: result.status,
                    managerComment: result.managerComment
                });
                fetchDifferences();
                onRefresh?.();
            } catch (error) {
                Swal.fire('Error', 'Failed to update record', 'error');
            }
        }
    };

    const handleDeleteLog = async (id: string) => {
        const { isConfirmed } = await Swal.fire({
            title: 'Are you sure?',
            text: "This will permanently delete this record.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#f8fafc',
            confirmButtonText: 'Yes, delete it!',
            customClass: {
                container: 'rounded-lg',
                popup: 'rounded-lg',
                confirmButton: 'rounded-lg px-4 py-2.5 font-bold text-sm',
                cancelButton: 'rounded-lg px-4 py-2.5 font-bold text-sm text-slate-500'
            }
        });

        if (isConfirmed) {
            try {
                await supabase.cashDifferences.delete(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
                fetchDifferences();
                onRefresh?.();
            } catch (error) {
                Swal.fire('Error', 'Failed to delete record', 'error');
            }
        }
    };

    const handleExportExcel = () => {
        // Headers for CSV
        const headers = ['Date', 'Branch', 'Pharmacist', 'System Cash', 'Actual Cash', 'Difference', 'Type', 'Status', 'Invoices', 'Notes'];
        const rows = (filteredDifferences as CashDifference[]).map(d => [
            d.date,
            d.branchName || '',
            d.pharmacistName,
            d.systemCash.toFixed(3),
            d.actualCash.toFixed(3),
            d.difference.toFixed(3),
            d.differenceType,
            d.status,
            d.hasInvoices ? `YES (${d.invoiceReference || ''})` : 'NO',
            d.reason || ''
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Cash_Tracker_Export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredDifferences = differences.filter(d => {
        // 1. Search Filter
        const matchesSearch = d.pharmacistName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.branchName && d.branchName.toLowerCase().includes(searchTerm.toLowerCase()));

        // 2. Status Filter
        const matchesStatus = filterStatus === 'All' || d.status === filterStatus;

        // 3. Date Filter
        let matchesDate = true;
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        if (dateType === 'today') {
            matchesDate = d.date === todayStr;
        } else if (dateType === 'yesterday') {
            const y = new Date();
            y.setDate(y.getDate() - 1);
            const yStr = y.toISOString().split('T')[0];
            matchesDate = d.date === yStr;
        } else if (dateType === '7d') {
            const limit = new Date();
            limit.setDate(limit.getDate() - 7);
            const limitStr = limit.toISOString().split('T')[0];
            matchesDate = d.date >= limitStr;
        } else if (dateType === 'month') {
            const limit = new Date();
            limit.setDate(limit.getDate() - 30);
            const limitStr = limit.toISOString().split('T')[0];
            matchesDate = d.date >= limitStr;
        } else if (dateType === 'custom' && startDate && endDate) {
            matchesDate = d.date >= startDate && d.date <= endDate;
        }

        return matchesSearch && matchesStatus && matchesDate;
    });

    const groupedByBranch = filteredDifferences.reduce((acc, curr) => {
        let branch = curr.branchName;
        if (!branch || branch === 'Unknown Branch') {
            const foundBranch = branches.find(b => b.id === curr.branchId);
            branch = foundBranch?.name || 'Unknown Branch';
        }
        if (!acc[branch]) acc[branch] = [];
        acc[branch].push(curr);
        return acc;
    }, {} as Record<string, CashDifference[]>);

    // Add all branches to groupedByBranch even if they have no logs (for accounts dashboard)
    // Filter to show only branches with role='branch'
    if (role === 'manager' || role === 'owner') {
        branches
            .filter(branch => branch.role === 'branch')
            .forEach(branch => {
                if (!groupedByBranch[branch.name]) {
                    groupedByBranch[branch.name] = [];
                }
            });
    }

    // Sort branches by number of logs (descending), then by prefix and name
    const sortedBranches = Object.keys(groupedByBranch).sort((a, b) => {
        const logsA = groupedByBranch[a].length;
        const logsB = groupedByBranch[b].length;

        // First sort by number of logs (descending - most logs first)
        if (logsA !== logsB) {
            return logsB - logsA;
        }

        // If same number of logs, sort by prefix
        const getPrefix = (name: string) => name.split('-')[0].trim();
        const prefixA = getPrefix(a);
        const prefixB = getPrefix(b);

        // First sort by prefix
        if (prefixA !== prefixB) {
            return prefixA.localeCompare(prefixB);
        }
        // Then sort by full name within same prefix
        return a.localeCompare(b);
    });

    // Check if branch has new unviewed logs (status='Open')
    const hasNewLogs = (branchName: string) => {
        const logs = groupedByBranch[branchName] || [];
        return logs.some(log => log.status === 'Open');
    };

    const pendingLogs = differences.filter(d => d.status === 'Open').sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const toggleBranch = (branch: string) => {
        setExpandedBranches(prev =>
            prev.includes(branch) ? prev.filter(b => b !== branch) : [...prev, branch]
        );
    };

    const formatTime = (dateStr?: string) => {
        if (!dateStr) return '--:--';
        return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header & Actions */}
            <div className="operational-panel p-5 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="flex items-center space-x-4">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 mb-1 uppercase">Financial Registry</h2>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
                    <div className="relative group flex-1 sm:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand transition-colors" />
                        <input
                            type="text"
                            placeholder="Find records..."
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black tracking-widest uppercase focus:bg-white focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="relative">
                        <button onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                            className="btn-secondary text-[10px] uppercase tracking-widest">
                            <CalendarDays size={16} className="text-brand" />
                            <span>{dateType === 'today' ? 'Today' : dateType === 'yesterday' ? 'Yesterday' : dateType === '7d' ? 'Last 7 Days' : dateType === 'month' ? 'Last Month' : dateType === 'custom' ? 'Custom' : 'Archive'}</span>
                            <ChevronDown size={14} />
                        </button>
                        {isDatePickerOpen && (
                            <div className={`absolute top-full right-0 mt-3 bg-white rounded-lg shadow-xl border border-slate-100 p-3 z-[100] animate-in slide-in-from-top-5 duration-300 ${dateType === 'custom' ? 'w-auto' : 'w-72'}`}>
                                {dateType !== 'custom' ? (
                                    <div className="grid grid-cols-1 gap-1.5">
                                        {[
                                            { id: 'all', label: 'All Time', sub: 'Total Historical Archive' },
                                            { id: 'today', label: 'Today', sub: 'Active Duty Records' },
                                            { id: 'yesterday', label: 'Yesterday', sub: 'Previous Day Performance' },
                                            { id: '7d', label: 'Last 7 Days', sub: 'Weekly Performance' },
                                            { id: 'month', label: 'Last Month', sub: '30-Day Fiscal Cycle' },
                                            { id: 'custom', label: 'Choose Period', sub: 'Manual Calendar Protocol' }
                                        ].map(t => (
                                            <button key={t.id} onClick={() => {
                                                if (dateType === 'custom' && t.id !== 'custom') {
                                                    setStartDate(''); setEndDate(''); setManualStart(''); setManualEnd('');
                                                }
                                                setDateType(t.id as any);
                                                if (t.id !== 'custom') setIsDatePickerOpen(false);
                                            }}
                                                className={`w-full text-left p-3 rounded-lg transition-colors ${dateType === t.id ? 'bg-brand text-white shadow-sm shadow-brand/10' : 'hover:bg-slate-50'}`}>
                                                <p className="text-[10px] font-black uppercase tracking-widest">{t.label}</p>
                                                <p className={`text-[8px] font-bold ${dateType === t.id ? 'text-white/60' : 'text-slate-400'} uppercase mt-1 tracking-tighter`}>{t.sub}</p>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="w-[280px] p-2 space-y-4">
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">From (DD-MM-YYYY)</label>
                                                <input type="text" placeholder="01-01-2026" value={manualStart} onChange={(e) => setManualStart(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg text-[10px] font-black outline-none focus:border-brand/40 transition-all" />
                                            </div>
                                            <div>
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">To (DD-MM-YYYY)</label>
                                                <input type="text" placeholder="31-01-2026" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg text-[10px] font-black outline-none focus:border-brand/40 transition-all" />
                                            </div>
                                        </div>
                                        <button onClick={() => {
                                            const s = parseManualDate(manualStart);
                                            const e = parseManualDate(manualEnd);
                                            if (s && e) { setStartDate(s); setEndDate(e); setIsDatePickerOpen(false); }
                                            else { Swal.fire('Error', 'Invalid date format (DD-MM-YYYY)', 'error'); }
                                        }}
                                            className="btn-primary w-full text-[9px] uppercase tracking-widest">
                                            Confirm Period
                                        </button>
                                        <button onClick={() => { setManualStart(''); setManualEnd(''); setStartDate(''); setEndDate(''); setDateType('all'); setIsDatePickerOpen(false); }}
                                            className="w-full text-slate-400 text-[8px] font-black uppercase tracking-widest hover:text-brand transition-colors">
                                            Reset Filter
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {role !== 'owner' && (
                        <button
                            onClick={() => handleAddLog()}
                            className="btn-primary text-[10px] uppercase tracking-widest"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Log Difference</span>
                        </button>
                    )}

                    {(role === 'manager' || role === 'owner') && (
                        <button
                            onClick={handleExportExcel}
                            className="btn-secondary text-[10px] uppercase tracking-widest"
                        >
                            <FileDown className="w-4 h-4" />
                            <span>Bulk Export</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Accounts Notification & Pending Center */}
            {role === 'manager' && pendingLogs.length > 0 && (
                <div className="operational-panel p-5 md:p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                                <Bell className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black tracking-tight uppercase text-slate-900">New Submission Alerts</h3>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Awaiting reconciliation from branches</p>
                            </div>
                        </div>
                        <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-md text-xs font-black border border-emerald-100">
                            {pendingLogs.length} PENDING
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendingLogs.slice((alertsPage - 1) * 6, alertsPage * 6).map(log => (
                                <div key={log.id} className="bg-slate-50 border border-slate-100 rounded-lg p-4 hover:border-brand/30 transition-colors cursor-pointer" onClick={() => handleUpdateStatus(log)}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-8 h-8 bg-emerald-400/20 rounded-lg flex items-center justify-center">
                                                <Building2 className="w-4 h-4 text-emerald-400" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-tighter text-slate-900">{log.branchName}</span>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400">{formatTime(log.createdAt)}</span>
                                    </div>
                                    <div className="mb-4">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Financial Impact</p>
                                        <p className={`text-lg font-black ${log.differenceType === 'Shortage' ? 'text-orange-400' : 'text-emerald-400'}`}>
                                            {log.differenceType === 'Shortage' ? '-' : '+'}{Math.abs(log.difference).toFixed(3)} BHD
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <User className="w-3 h-3 text-emerald-400" />
                                        <span className="text-[11px] font-bold text-slate-600">{log.pharmacistName}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        {pendingLogs.length > 6 && (
                            <div className="flex items-center justify-center gap-3 mt-6">
                                <button
                                    onClick={() => setAlertsPage(prev => Math.max(1, prev - 1))}
                                    disabled={alertsPage === 1}
                                    className="px-4 py-2 bg-slate-50 hover:bg-white border border-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-black uppercase tracking-widest transition-colors text-slate-600"
                                >
                                    Previous
                                </button>

                                <div className="flex items-center gap-2">
                                    {Array.from({ length: Math.ceil(pendingLogs.length / 6) }, (_, i) => i + 1).map(page => (
                                        <button
                                            key={page}
                                            onClick={() => setAlertsPage(page)}
                                            className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${page === alertsPage
                                                ? 'bg-brand text-white'
                                                : 'bg-slate-50 hover:bg-white border border-slate-100 text-slate-500'
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setAlertsPage(prev => Math.min(Math.ceil(pendingLogs.length / 6), prev + 1))}
                                    disabled={alertsPage === Math.ceil(pendingLogs.length / 6)}
                                    className="px-4 py-2 bg-slate-50 hover:bg-white border border-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-black uppercase tracking-widest transition-colors text-slate-600"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Summary Cards (Quick Stats) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="operational-panel p-5 flex items-center space-x-4">
                    <div className="p-3 bg-red-50 rounded-lg text-red-500">
                        <ArrowDownRight className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Shortages</p>
                        <p className="text-xl font-black text-slate-900">
                            {filteredDifferences.filter(d => d.differenceType === 'Shortage').reduce((acc, curr) => acc + Math.abs(curr.difference), 0).toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD
                        </p>
                    </div>
                </div>
                <div className="operational-panel p-5 flex items-center space-x-4">
                    <div className="p-3 bg-emerald-50 rounded-lg text-emerald-500">
                        <ArrowUpRight className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Increases</p>
                        <p className="text-xl font-black text-slate-900">
                            {filteredDifferences.filter(d => d.differenceType === 'Increase').reduce((acc, curr) => acc + curr.difference, 0).toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD
                        </p>
                    </div>
                </div>
                <div className="operational-panel p-5 flex items-center space-x-4">
                    <div className="p-3 bg-amber-50 rounded-lg text-amber-500">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Reviews</p>
                        <p className="text-xl font-black text-slate-900">
                            {filteredDifferences.filter(d => d.status === 'Open').length} Cases
                        </p>
                    </div>
                </div>
                <div className="operational-panel p-5 flex items-center space-x-4">
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-500">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Closed Cases</p>
                        <p className="text-xl font-black text-slate-900">
                            {filteredDifferences.filter(d => d.status === 'Closed').length} Cases
                        </p>
                    </div>
                </div>
            </div>

            {(role === 'manager' || role === 'owner') ? (
                <div className="space-y-4">
                    {sortedBranches.map((branch, index) => {
                        const logs = groupedByBranch[branch];
                        const isNew = hasNewLogs(branch);
                        return (
                            <div key={branch} className={`rounded-lg border shadow-sm overflow-hidden transition-colors ${isNew ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'}`}>
                                <div
                                    onClick={() => toggleBranch(branch)}
                                    className={`w-full flex items-center justify-between p-6 hover:bg-slate-100/50 transition-all border-b border-slate-100 cursor-pointer ${isNew ? 'bg-red-50/50' : 'bg-slate-50'}`}
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm ${isNew ? 'bg-red-100 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                            #{index + 1}
                                        </div>
                                        <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">{branch}</h3>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                {logs.length} Total Records
                                                {isNew && <span className="ml-2 px-2 py-0.5 bg-red-500 text-white rounded-full text-[8px]">NEW</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={(e) => {
                                                    const branchLogs = logs;
                                                    const headers = ['Date', 'Branch', 'Pharmacist', 'System Cash', 'Actual Cash', 'Difference', 'Type', 'Status', 'Invoices', 'Notes'];
                                                    const rows = branchLogs.map(d => [
                                                        d.date,
                                                        d.branchName || '',
                                                        d.pharmacistName,
                                                        d.systemCash.toFixed(3),
                                                        d.actualCash.toFixed(3),
                                                        d.difference.toFixed(3),
                                                        d.differenceType,
                                                        d.status,
                                                        d.hasInvoices ? `YES (${d.invoiceReference || ''})` : 'NO',
                                                        d.reason || ''
                                                    ]);
                                                    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
                                                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                                    const link = document.createElement("a");
                                                    const url = URL.createObjectURL(blob);
                                                    link.setAttribute("href", url);
                                                    link.setAttribute("download", `Cash_Tracker_${branch}_${new Date().toISOString().split('T')[0]}.csv`);
                                                    link.click();
                                                }}
                                                className="px-4 py-2 bg-slate-100 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-all flex items-center gap-2"
                                            >
                                                <FileDown size={14} />
                                                <span>Export</span>
                                            </button>
                                        </div>
                                        {expandedBranches.includes(branch) ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                                    </div>
                                </div>

                                {
                                    expandedBranches.includes(branch) && (
                                        logs.length === 0 ? (
                                            <div className="p-12 text-center">
                                                <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-2xl mb-4">
                                                    <FileCheck className="w-8 h-8 text-slate-400" />
                                                </div>
                                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-2">No Records Yet</h3>
                                                <p className="text-[10px] text-slate-500 font-bold">This branch hasn't submitted any cash difference logs in the selected period.</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead className="bg-slate-50/50">
                                                        <tr className="border-b border-slate-100">
                                                            <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Date / Time</th>
                                                            <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Pharmacist</th>
                                                            <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">System Cash</th>
                                                            <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Actual Cash</th>
                                                            <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Difference</th>
                                                            <th className="px-8 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Invoices</th>
                                                            <th className="px-8 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                                            <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Notes</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {(showAllLogsBranches.includes(branch) ? logs : logs.slice(0, 5)).map(d => (
                                                            <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="px-8 py-4">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-black text-slate-900">{new Date(d.date).toLocaleDateString()}</span>
                                                                        <div className="flex items-center text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-0.5">
                                                                            <Clock className="w-2.5 h-2.5 mr-1" />
                                                                            {formatTime(d.createdAt)}
                                                                        </div>
                                                                        {branch !== 'Unknown Branch' ? (
                                                                            <div className="flex items-center text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                                                                                <Building2 className="w-2.5 h-2.5 mr-1" />
                                                                                {branch}
                                                                            </div>
                                                                        ) : d.branchName && (
                                                                            <div className="flex items-center text-[9px] font-black text-red-500 uppercase tracking-widest mt-1">
                                                                                <Building2 className="w-2.5 h-2.5 mr-1" />
                                                                                {d.branchName}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-4">
                                                                    <span className="text-xs font-bold text-slate-700">{d.pharmacistName}</span>
                                                                </td>
                                                                <td className="px-8 py-4 text-right">
                                                                    <div className="text-xs font-black text-slate-900">
                                                                        {d.systemCash.toFixed(3)} BHD
                                                                    </div>
                                                                    <div className="text-[8px] font-bold text-slate-400 mt-0.5">
                                                                        System
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-4 text-right">
                                                                    <div className="text-xs font-black text-slate-900">
                                                                        {d.actualCash.toFixed(3)} BHD
                                                                    </div>
                                                                    <div className="text-[8px] font-bold text-slate-400 mt-0.5">
                                                                        In Drawer
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-4 text-right">
                                                                    <div className={`text-xs font-black ${d.differenceType === 'Shortage' ? 'text-red-600' : 'text-emerald-600'}`}>
                                                                        {d.differenceType === 'Shortage' ? '-' : '+'}{Math.abs(d.difference).toFixed(3)} BHD
                                                                    </div>
                                                                    <div className="text-[8px] font-bold text-slate-400 mt-0.5">
                                                                        {d.differenceType}
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-4">
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        {d.hasInvoices ? (
                                                                            <>
                                                                                <div className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[8px] font-black uppercase tracking-widest">
                                                                                    ✓ Yes
                                                                                </div>
                                                                                {d.invoiceReference && (
                                                                                    <span className="text-[8px] font-bold text-slate-400">#{d.invoiceReference}</span>
                                                                                )}
                                                                            </>
                                                                        ) : (
                                                                            <div className="px-2 py-1 bg-slate-50 text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-widest">
                                                                                No
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-4">
                                                                    <div className="flex justify-center">
                                                                        <button
                                                                            onClick={() => handleUpdateStatus(d)}
                                                                            className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${d.status === 'Open' ? 'bg-amber-50 text-amber-600' : d.status === 'Reviewed' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}
                                                                        >
                                                                            {d.status}
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-4 max-w-xs">
                                                                    <p className="text-[10px] text-slate-500 line-clamp-2 italic">{d.reason || 'No details provided'}</p>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                {logs.length > 5 && (
                                                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
                                                        <button
                                                            onClick={() => {
                                                                if (showAllLogsBranches.includes(branch)) {
                                                                    // Collapse: show only 5
                                                                    setShowAllLogsBranches(prev => prev.filter(b => b !== branch));
                                                                } else {
                                                                    // Expand: show all
                                                                    setShowAllLogsBranches(prev => [...prev, branch]);
                                                                }
                                                            }}
                                                            className="btn-primary text-[10px] uppercase tracking-widest"
                                                        >
                                                            {showAllLogsBranches.includes(branch) ? (
                                                                <>
                                                                    <ChevronUp className="w-4 h-4" />
                                                                    <span>Show Less</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span>View All {logs.length} Records</span>
                                                                    <ChevronDown className="w-4 h-4" />
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    )
                                }
                            </div >
                        );
                    })}
                </div >
            ) : (
                <div className="operational-panel overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-xs font-black uppercase tracking-widest">
                            <div className="tab-nav">
                                <button
                                    onClick={() => setFilterStatus('All')}
                                    className={`tab-item text-[10px] uppercase tracking-widest ${filterStatus === 'All' ? 'tab-item-brand' : ''}`}
                                >
                                    All Records
                                </button>
                                <button
                                    onClick={() => setFilterStatus('Open')}
                                    className={`tab-item text-[10px] uppercase tracking-widest ${filterStatus === 'Open' ? 'tab-item-brand' : ''}`}
                                >
                                    Pending
                                </button>
                                <button
                                    onClick={() => setFilterStatus('Closed')}
                                    className={`tab-item text-[10px] uppercase tracking-widest ${filterStatus === 'Closed' ? 'tab-item-brand' : ''}`}
                                >
                                    Reconciled
                                </button>
                            </div>

                            <div className="h-4 w-px bg-slate-200" />

                            <button
                                onClick={handleExportExcel}
                                className="btn-secondary text-[9px] uppercase tracking-widest"
                            >
                                <FileDown className="w-3.5 h-3.5" />
                                <span>Export CSV</span>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-50">
                                    <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Branch</th>
                                    <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Pharmacist</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Financials</th>
                                    <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="hidden lg:table-cell px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center space-y-4">
                                                <div className="w-12 h-12 border-4 border-slate-100 border-t-brand rounded-full animate-spin" />
                                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading records...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredDifferences.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center text-slate-400">
                                            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                            <p className="text-xs font-black uppercase tracking-widest">No records found</p>
                                        </td>
                                    </tr>
                                ) : filteredDifferences.map((d) => (
                                    <tr key={d.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center space-x-3">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">{new Date(d.date).toLocaleDateString()}</p>
                                                    {d.branchName && (
                                                        <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                            <Building2 className="w-3 h-3 mr-1" />
                                                            {d.branchName}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                                                    <User className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <span className="text-sm font-bold text-slate-700">{d.pharmacistName}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="space-y-1">
                                                <div className={`text-sm font-black flex items-center justify-end ${d.differenceType === 'Shortage' ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {d.differenceType === 'Shortage' ? '-' : '+'}
                                                    {Math.abs(d.difference).toLocaleString(undefined, { minimumFractionDigits: 3 })} BHD
                                                    {d.differenceType === 'Shortage' ? <ArrowDownRight className="w-3 h-3 ml-1" /> : <ArrowUpRight className="w-3 h-3 ml-1" />}
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-400 tracking-tight uppercase">
                                                    Sys: {d.systemCash.toLocaleString(undefined, { minimumFractionDigits: 3 })} | Act: {d.actualCash.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                                                </p>
                                                {d.drawerBalance !== undefined && (
                                                    <div className="flex items-center justify-end text-[9px] font-black text-slate-500 uppercase tracking-tighter mt-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 w-fit ml-auto">
                                                        <Wallet className="w-2.5 h-2.5 mr-1" />
                                                        Drawer: {d.drawerBalance.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-center flex-col items-center space-y-2">
                                                <button
                                                    onClick={() => handleUpdateStatus(d)}
                                                    disabled={role !== 'manager'}
                                                    className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center space-x-1.5 transition-all
                                ${d.status === 'Open' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                             d.status === 'Reviewed' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                                 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:opacity-100 opacity-80'}`}
                                                >
                                                    {d.status === 'Open' && <AlertCircle className="w-3 h-3" />}
                                                    {d.status === 'Reviewed' && <Clock className="w-3 h-3" />}
                                                    {d.status === 'Closed' && <CheckCircle2 className="w-3 h-3" />}
                                                    <span>{d.status === 'Open' ? 'Pending' : d.status === 'Closed' ? 'Reconciled' : d.status}</span>
                                                </button>

                                                {canEdit(d.createdAt || '') && d.status === 'Open' && (
                                                    <div className="flex flex-col items-center space-y-1">
                                                        <button
                                                            onClick={() => handleAddLog(d)}
                                                            className="text-[9px] font-black text-brand uppercase tracking-widest hover:underline"
                                                        >
                                                            Edit Record
                                                        </button>
                                                        {canDelete(d.createdAt || '') && (
                                                            <button
                                                                onClick={() => handleDeleteLog(d.id!)}
                                                                className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline"
                                                            >
                                                                Remove Log
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 max-w-xs">
                                            <div className="space-y-1">
                                                {d.reason && (
                                                    <div className="flex items-start space-x-2">
                                                        <AlertCircle className="w-3 h-3 text-slate-400 mt-1 shrink-0" />
                                                        <p className="text-[11px] font-medium text-slate-600 line-clamp-2">{d.reason}</p>
                                                    </div>
                                                )}
                                                {d.hasInvoices && (
                                                    <div className="flex items-center space-x-2 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 w-fit">
                                                        <FileCheck className="w-3 h-3 text-emerald-600" />
                                                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-tighter">
                                                            Sent to Accounts: {d.invoiceReference || 'Submitted'}
                                                        </p>
                                                    </div>
                                                )}
                                                {d.managerComment && (
                                                    <div className="flex items-start space-x-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                        <MessageSquare className="w-3 h-3 text-brand mt-1 shrink-0" />
                                                        <p className="text-[11px] font-bold text-slate-700 italic">
                                                            <span className="text-[9px] uppercase tracking-tighter text-slate-400 block mb-0.5">Note from Accounts/Manager:</span>
                                                            {d.managerComment}
                                                        </p>
                                                    </div>
                                                )}
                                                {!d.reason && !d.managerComment && (
                                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No notes</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
            }
        </div >
    );
};
