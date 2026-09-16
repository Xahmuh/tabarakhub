import React, { useEffect, useState, useMemo } from 'react';
import {
  AnnualLeaveRequest,
  AnnualLeaveLedgerEntry,
  AnnualLeaveAccrualEvent,
  AnnualLeaveRequestStatus,
  WeeklyRestComplianceReport,
  WeeklyRestComplianceRow,
  DutySchedulerLeaveRecord,
  DutySchedulerLeaveStatus,
  AppUser
} from '../../types';
import { leaveManagementService, calculateInclusiveDays, calculateAvailableBalanceAsOf } from '../../services/leaveManagementService';
import { dutySchedulerService } from '../../services/dutySchedulerService';
import { workforceService } from '../../services/workforceService';
import {
  CalendarDays,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  User,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  History,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

interface LeaveManagementViewProps {
  user?: AppUser;
  canSubmit?: boolean;
  canDecide?: boolean;
  canAdjust?: boolean;
}

type SubTab = 'requests' | 'ledgers' | 'rest_compliance' | 'sick_other';

export const LeaveManagementView: React.FC<LeaveManagementViewProps> = ({
  user,
  canSubmit = true,
  canDecide = true,
  canAdjust = true
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('requests');
  const [isLoading, setIsLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);

  // Requests State
  const [requests, setRequests] = useState<AnnualLeaveRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form inputs for new request
  const [newEmpId, setNewEmpId] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newComments, setNewComments] = useState('');
  const [liveBalanceInfo, setLiveBalanceInfo] = useState<{
    available: number;
    opening: number;
    periodAccrual: number;
  } | null>(null);

  // Decision Modal State
  const [selectedRequest, setSelectedRequest] = useState<AnnualLeaveRequest | null>(null);
  const [decisionMode, setDecisionMode] = useState<'APPROVE' | 'REJECT' | 'CANCEL' | null>(null);
  const [decisionComments, setDecisionComments] = useState('');
  const [isProcessingDecision, setIsProcessingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionBalanceCheck, setDecisionBalanceCheck] = useState<{
    available: number;
    isExceeded: boolean;
  } | null>(null);

  // Ledger State
  const [selectedLedgerEmpId, setSelectedLedgerEmpId] = useState<string>('');
  const [ledgerEntries, setLedgerEntries] = useState<AnnualLeaveLedgerEntry[]>([]);
  const [events, setEvents] = useState<AnnualLeaveAccrualEvent[]>([]);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustNote, setAdjustNote] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Weekly Rest Compliance State
  const [complianceStartDate, setComplianceStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [complianceEndDate, setComplianceEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [complianceReport, setComplianceReport] = useState<WeeklyRestComplianceReport | null>(null);
  const [isComplianceLoading, setIsComplianceLoading] = useState(false);
  const [complianceStatusFilter, setComplianceStatusFilter] = useState<string>('ALL');

  // Sick & Other Leave State
  const [interimLeaves, setInterimLeaves] = useState<DutySchedulerLeaveRecord[]>([]);
  const [interimFilter, setInterimFilter] = useState<string>('ALL');
  const [isInterimModalOpen, setIsInterimModalOpen] = useState(false);
  const [interimEmpId, setInterimEmpId] = useState('');
  const [interimType, setInterimType] = useState('SICK');
  const [interimStart, setInterimStart] = useState('');
  const [interimEnd, setInterimEnd] = useState('');
  const [interimNotes, setInterimNotes] = useState('');
  const [isSavingInterim, setIsSavingInterim] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [fetchedEmps, fetchedRequests, fetchedInterim] = await Promise.all([
        workforceService.getAllEmployees(),
        leaveManagementService.getRequests(),
        dutySchedulerService.getAllLeaveRecords()
      ]);

      const pharmacists = (fetchedEmps || []).filter(e => e.category === 'Pharmacist');
      setEmployees(pharmacists);
      setRequests(fetchedRequests);
      setInterimLeaves((fetchedInterim || []).filter(l => l.leaveType !== 'ANNUAL'));

      if (pharmacists.length > 0 && !selectedLedgerEmpId) {
        setSelectedLedgerEmpId(pharmacists[0].id);
        loadEmployeeLedger(pharmacists[0].id);
      }
    } catch (err) {
      console.error('Failed to load initial leave data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmployeeLedger = async (empId: string) => {
    try {
      const [ledgers, evs] = await Promise.all([
        leaveManagementService.getLedger(empId),
        leaveManagementService.getEvents(empId)
      ]);
      setLedgerEntries(ledgers);
      setEvents(evs);
    } catch (err) {
      console.error('Failed to load employee ledger:', err);
    }
  };

  const loadComplianceReport = async (sDate: string, eDate: string) => {
    setIsComplianceLoading(true);
    try {
      const report = await leaveManagementService.getWeeklyRestComplianceReport(sDate, eDate);
      setComplianceReport(report);
    } catch (err) {
      console.error('Failed to load compliance report:', err);
    } finally {
      setIsComplianceLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'rest_compliance') {
      loadComplianceReport(complianceStartDate, complianceEndDate);
    }
  }, [activeSubTab, complianceStartDate, complianceEndDate]);

  // Live available balance computation when submitting modal changes
  useEffect(() => {
    if (!newEmpId || !newStartDate) {
      setLiveBalanceInfo(null);
      return;
    }
    const emp = employees.find(e => e.id === newEmpId);
    if (!emp?.hire_date) {
      setLiveBalanceInfo(null);
      return;
    }

    const empApproved = requests.filter(r => r.employeeId === newEmpId && r.status === 'APPROVED');
    const { availableBalance, openingBalanceOfMonth, accrualUpToDate } = calculateAvailableBalanceAsOf(
      emp.hire_date,
      newStartDate,
      empApproved
    );

    setLiveBalanceInfo({
      available: availableBalance,
      opening: openingBalanceOfMonth,
      periodAccrual: accrualUpToDate
    });
  }, [newEmpId, newStartDate, requests, employees]);

  const getEmployeeName = (id: string) => {
    return employees.find(e => e.id === id)?.full_name || 'Pharmacist';
  };

  const requestedDaysCount = useMemo(() => {
    if (!newStartDate || !newEndDate) return 0;
    return calculateInclusiveDays(newStartDate, newEndDate);
  }, [newStartDate, newEndDate]);

  const handleOpenSubmitModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setNewEmpId(employees[0]?.id || '');
    setNewStartDate(today);
    setNewEndDate(today);
    setNewComments('');
    setSubmitError(null);
    setIsSubmitModalOpen(true);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!newEmpId || !newStartDate || !newEndDate) {
      setSubmitError('Please complete all required fields.');
      return;
    }
    if (newStartDate > newEndDate) {
      setSubmitError('Start date cannot be after end date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await leaveManagementService.submitRequest({
        employeeId: newEmpId,
        startDate: newStartDate,
        endDate: newEndDate,
        requestComments: newComments
      });

      setRequests(prev => [created, ...prev]);
      setIsSubmitModalOpen(false);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit leave request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Decision Modals
  const openApproveModal = (req: AnnualLeaveRequest) => {
    setSelectedRequest(req);
    setDecisionMode('APPROVE');
    setDecisionComments('');
    setDecisionError(null);

    const emp = employees.find(e => e.id === req.employeeId);
    if (emp?.hire_date) {
      const empApproved = requests.filter(r => r.employeeId === req.employeeId && r.status === 'APPROVED');
      const { availableBalance } = calculateAvailableBalanceAsOf(emp.hire_date, req.startDate, empApproved);
      setDecisionBalanceCheck({
        available: availableBalance,
        isExceeded: req.requestedDays > availableBalance
      });
    } else {
      setDecisionBalanceCheck(null);
    }
  };

  const openRejectModal = (req: AnnualLeaveRequest) => {
    setSelectedRequest(req);
    setDecisionMode('REJECT');
    setDecisionComments('');
    setDecisionError(null);
    setDecisionBalanceCheck(null);
  };

  const openCancelModal = (req: AnnualLeaveRequest) => {
    setSelectedRequest(req);
    setDecisionMode('CANCEL');
    setDecisionComments('');
    setDecisionError(null);
    setDecisionBalanceCheck(null);
  };

  const handleExecuteDecision = async () => {
    if (!selectedRequest || !decisionMode) return;
    setDecisionError(null);
    setIsProcessingDecision(true);

    try {
      const actingUser = user?.id || '00000000-0000-0000-0000-000000000000';

      if (decisionMode === 'APPROVE') {
        const updated = await leaveManagementService.approveRequest({
          requestId: selectedRequest.id,
          decidedByUserId: actingUser,
          decisionComments: decisionComments || 'Approved'
        });
        setRequests(prev => prev.map(r => (r.id === updated.id ? updated : r)));
        if (selectedLedgerEmpId === selectedRequest.employeeId) {
          await loadEmployeeLedger(selectedRequest.employeeId);
        }
      } else if (decisionMode === 'REJECT') {
        if (!decisionComments || decisionComments.trim().length === 0) {
          setDecisionError('Decision comments are required when rejecting a request.');
          setIsProcessingDecision(false);
          return;
        }
        const updated = await leaveManagementService.rejectRequest({
          requestId: selectedRequest.id,
          decidedByUserId: actingUser,
          decisionComments
        });
        setRequests(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      } else if (decisionMode === 'CANCEL') {
        const updated = await leaveManagementService.cancelRequest({
          requestId: selectedRequest.id,
          actorUserId: actingUser,
          note: decisionComments
        });
        setRequests(prev => prev.map(r => (r.id === updated.id ? updated : r)));
        if (selectedLedgerEmpId === selectedRequest.employeeId) {
          await loadEmployeeLedger(selectedRequest.employeeId);
        }
      }

      setDecisionMode(null);
      setSelectedRequest(null);
    } catch (err: any) {
      setDecisionError(err.message || 'Operation failed.');
    } finally {
      setIsProcessingDecision(false);
    }
  };

  // Manual Adjustment Handler
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);

    if (!adjustAmount || adjustAmount === 0) {
      setAdjustError('Adjustment amount cannot be zero.');
      return;
    }
    if (!adjustNote || adjustNote.trim().length === 0) {
      setAdjustError('A detailed reason note is required for manual adjustments.');
      return;
    }

    setIsAdjusting(true);
    try {
      await leaveManagementService.addManualAdjustment({
        employeeId: selectedLedgerEmpId,
        amount: adjustAmount,
        note: adjustNote,
        actorUserId: user?.id || '00000000-0000-0000-0000-000000000000'
      });

      setIsAdjustModalOpen(false);
      setAdjustAmount(0);
      setAdjustNote('');
      await loadEmployeeLedger(selectedLedgerEmpId);
    } catch (err: any) {
      setAdjustError(err.message || 'Failed to apply adjustment.');
    } finally {
      setIsAdjusting(false);
    }
  };

  // Sick/Other Leave Handlers
  const handleSaveInterimLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interimEmpId || !interimStart || !interimEnd) return;
    setIsSavingInterim(true);
    try {
      const created = await dutySchedulerService.createLeaveRecord({
        employeeId: interimEmpId,
        leaveType: interimType,
        startDate: interimStart,
        endDate: interimEnd,
        status: 'APPROVED',
        notes: interimNotes
      });
      setInterimLeaves(prev => [created, ...prev]);
      setIsInterimModalOpen(false);
    } catch (err) {
      console.error('Failed to create sick/other leave:', err);
    } finally {
      setIsSavingInterim(false);
    }
  };

  const pendingRequestsCount = useMemo(() => {
    return requests.filter(r => r.status === 'PENDING').length;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'ALL') return requests;
    return requests.filter(r => r.status === statusFilter);
  }, [requests, statusFilter]);

  const selectedPharmacist = employees.find(e => e.id === selectedLedgerEmpId);
  const currentClosingBalance = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].closingBalance : 0;
  const ytdAccrued = ledgerEntries.reduce((sum, l) => sum + l.accruedDays, 0);
  const ytdConsumed = ledgerEntries.reduce((sum, l) => sum + l.consumedDays, 0);

  return (
    <div className="space-y-6">
      {/* Module Header Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Authoritative Leave Engine
              </span>
              <span className="text-xs text-slate-400">§3.3 Duty Scheduler Spec</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 mt-1">Leave Management & Compliance</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Accrual-based annual leave ledger, approval workflows with hard balance checks, and read-only weekly rest reconciliation.
            </p>
          </div>

          {canSubmit && (
            <button
              onClick={handleOpenSubmitModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand text-white text-sm font-bold rounded-lg shadow-sm hover:bg-brand/90 transition-all shadow-brand/10"
            >
              <Plus className="w-4 h-4" />
              Request Annual Leave
            </button>
          )}
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-100 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('requests')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              activeSubTab === 'requests'
                ? 'border-brand text-brand'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Annual Leave Requests
            {pendingRequestsCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-black bg-amber-500 text-white rounded-full">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('ledgers')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              activeSubTab === 'ledgers'
                ? 'border-brand text-brand'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            Annual Leave Ledgers
          </button>

          <button
            onClick={() => setActiveSubTab('rest_compliance')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              activeSubTab === 'rest_compliance'
                ? 'border-brand text-brand'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Weekly Rest Compliance
          </button>

          <button
            onClick={() => setActiveSubTab('sick_other')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              activeSubTab === 'sick_other'
                ? 'border-brand text-brand'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Sick & Other Leave
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: ANNUAL LEAVE REQUESTS                                          */}
      {/* ===================================================================== */}
      {activeSubTab === 'requests' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status:</span>
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400 font-medium">
              Showing {filteredRequests.length} of {requests.length} requests
            </div>
          </div>

          {/* Table of Requests */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Pharmacist</th>
                    <th className="px-4 py-3">Leave Period</th>
                    <th className="px-4 py-3">Days</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Comments / Audit</th>
                    <th className="px-4 py-3">Requested At</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                        <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        No annual leave requests found.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map(req => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const isFutureApproved = req.status === 'APPROVED' && req.startDate > todayStr;
                      const canCancel = req.status === 'PENDING' || isFutureApproved;

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {getEmployeeName(req.employeeId)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                            <span className="font-mono text-xs font-medium">{req.startDate}</span>
                            <span className="mx-1 text-slate-400">→</span>
                            <span className="font-mono text-xs font-medium">{req.endDate}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-xs font-black bg-slate-100 text-slate-800">
                              {req.requestedDays}d
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {req.status === 'APPROVED' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </span>
                            )}
                            {req.status === 'PENDING' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            )}
                            {req.status === 'REJECTED' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                                <XCircle className="w-3 h-3" /> Rejected
                              </span>
                            )}
                            {req.status === 'CANCELLED' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Cancelled
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">
                            {req.decisionComments ? (
                              <span className="text-slate-800 font-medium">{req.decisionComments}</span>
                            ) : req.requestComments ? (
                              <span className="text-slate-500 italic">{req.requestComments}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                            {req.requestedAt ? new Date(req.requestedAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {req.status === 'PENDING' && canDecide && (
                                <>
                                  <button
                                    onClick={() => openApproveModal(req)}
                                    className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-all"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => openRejectModal(req)}
                                    className="px-2.5 py-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-all"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {canCancel && (
                                <button
                                  onClick={() => openCancelModal(req)}
                                  className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-all"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ANNUAL LEAVE LEDGERS                                           */}
      {/* ===================================================================== */}
      {activeSubTab === 'ledgers' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Pharmacist Picker & Action Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Pharmacist:</label>
              <select
                value={selectedLedgerEmpId}
                onChange={e => {
                  setSelectedLedgerEmpId(e.target.value);
                  loadEmployeeLedger(e.target.value);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} ({e.code || 'EMP'})
                  </option>
                ))}
              </select>
            </div>

            {canAdjust && (
              <button
                onClick={() => setIsAdjustModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300/80 transition-all"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Manual Balance Adjustment
              </button>
            )}
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Official Hire Date</div>
              <div className="mt-1 text-lg font-black text-slate-900 font-mono">
                {selectedPharmacist?.hire_date || 'Not configured'}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Accrues 2.5d / month</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Total Accrued (YTD)</div>
              <div className="mt-1 text-lg font-black text-emerald-700 font-mono">
                +{ytdAccrued.toFixed(2)} days
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Daily-prorated formula</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
              <div className="text-xs font-bold text-red-600 uppercase tracking-wider">Total Consumed (YTD)</div>
              <div className="mt-1 text-lg font-black text-red-700 font-mono">
                -{ytdConsumed.toFixed(2)} days
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Approved leave days</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-brand/20 bg-brand/5 shadow-sm">
              <div className="text-xs font-bold text-brand uppercase tracking-wider">Current Closing Balance</div>
              <div className="mt-1 text-2xl font-black text-brand font-mono">
                {currentClosingBalance.toFixed(2)} days
              </div>
              <div className="mt-1 text-[11px] text-brand/80 font-medium">Authoritative available leave</div>
            </div>
          </div>

          {/* Monthly Periods Ledger Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Period-by-Period Monthly Ledger</h3>
                <p className="text-xs text-slate-500">Idempotently generated cumulative ledger from hire date</p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {ledgerEntries.length} periods recorded
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Opening Balance</th>
                    <th className="px-4 py-3 text-emerald-700">Accrued (+)</th>
                    <th className="px-4 py-3 text-red-700">Consumed (-)</th>
                    <th className="px-4 py-3 text-slate-900 font-black">Closing Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {ledgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-sans">
                        No ledger entries generated yet.
                      </td>
                    </tr>
                  ) : (
                    ledgerEntries.map(entry => (
                      <tr key={entry.period} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-bold text-slate-800">{entry.period}</td>
                        <td className="px-4 py-3 text-slate-600">{entry.openingBalance.toFixed(2)}</td>
                        <td className="px-4 py-3 text-emerald-700 font-bold">+{entry.accruedDays.toFixed(2)}</td>
                        <td className="px-4 py-3 text-red-700 font-bold">
                          {entry.consumedDays > 0 ? `-${entry.consumedDays.toFixed(2)}` : '0.00'}
                        </td>
                        <td className="px-4 py-3 font-black text-slate-950 text-sm">
                          {entry.closingBalance.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Events History */}
          {events.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-slate-900 text-sm">Ledger Audit History & Adjustments</h3>
              </div>
              <div className="space-y-2">
                {events.map(ev => (
                  <div key={ev.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 uppercase tracking-wider mr-2">
                        {ev.eventType}
                      </span>
                      <span className="text-slate-600">{ev.note || 'No note'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-mono font-bold ${ev.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {ev.amount >= 0 ? `+${ev.amount}` : ev.amount} days
                      </span>
                      <span className="text-slate-400">{new Date(ev.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: WEEKLY REST COMPLIANCE REPORT                                  */}
      {/* ===================================================================== */}
      {activeSubTab === 'rest_compliance' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Controls & Filter */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Weekly Rest Reconciliation Dashboard</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Observational compliance report (§3). Excludes approved leave days and out-of-employment days. Does not feed into solver constraints or balances.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Start Date</label>
                  <input
                    type="date"
                    value={complianceStartDate}
                    onChange={e => setComplianceStartDate(e.target.value)}
                    className="border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">End Date</label>
                  <input
                    type="date"
                    value={complianceEndDate}
                    onChange={e => setComplianceEndDate(e.target.value)}
                    className="border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold text-slate-800"
                  />
                </div>
                <button
                  onClick={() => loadComplianceReport(complianceStartDate, complianceEndDate)}
                  className="mt-4 px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-bold hover:bg-slate-800 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reconcile
                </button>
              </div>
            </div>

            {/* Quick Status Filters */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500">Filter Status:</span>
              {(['ALL', 'UNDER', 'OK', 'OVER'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setComplianceStatusFilter(st)}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    complianceStatusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                  {complianceReport && st !== 'ALL' && (
                    <span className="ml-1 opacity-70">
                      (
                      {st === 'OK'
                        ? complianceReport.summary.okCount
                        : st === 'UNDER'
                        ? complianceReport.summary.underCount
                        : complianceReport.summary.overCount}
                      )
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Compliance Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
            {isComplianceLoading ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand" />
                Computing rest days reconciliation...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Pharmacist</th>
                      <th className="px-4 py-3">Period Window</th>
                      <th className="px-4 py-3">Weeks</th>
                      <th className="px-4 py-3">Expected Rest Range</th>
                      <th className="px-4 py-3">Actual Rest Days Taken</th>
                      <th className="px-4 py-3">Approved Leave Excluded</th>
                      <th className="px-4 py-3">Compliance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {complianceReport?.rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                          No active pharmacist profiles found for this period.
                        </td>
                      </tr>
                    ) : (
                      (complianceReport?.rows || [])
                        .filter(r => (complianceStatusFilter === 'ALL' ? true : r.status === complianceStatusFilter))
                        .map(row => (
                          <tr key={row.employeeId} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 font-semibold text-slate-900">{row.employeeName}</td>
                            <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                              {complianceStartDate} → {complianceEndDate} ({row.totalCalendarDays}d)
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-700">
                              {row.weeksCount.toFixed(1)} wks
                            </td>
                            <td className="px-4 py-3 text-xs font-mono font-medium text-slate-700">
                              {row.expectedRestDaysMin} – {row.expectedRestDaysMax} days
                            </td>
                            <td className="px-4 py-3 font-black text-sm font-mono text-slate-900">
                              {row.actualRestDaysTaken} days
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                              {row.leaveDaysCount > 0 ? (
                                <span className="text-amber-700 font-semibold">{row.leaveDaysCount}d on leave</span>
                              ) : (
                                '0d'
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.status === 'OK' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" /> OK
                                </span>
                              )}
                              {row.status === 'UNDER' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                                  <AlertTriangle className="w-3 h-3" /> UNDER (Risk)
                                </span>
                              )}
                              {row.status === 'OVER' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                  OVER (Info)
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: SICK & OTHER LEAVE                                             */}
      {/* ===================================================================== */}
      {activeSubTab === 'sick_other' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Interim Leave Table (Sick & Other Leaves)</h3>
              <p className="text-xs text-slate-500">
                Preserved for non-accrual leaves (Sick leave, emergency, study leave) per spec §3.3.
              </p>
            </div>

            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setInterimEmpId(employees[0]?.id || '');
                setInterimType('SICK');
                setInterimStart(today);
                setInterimEnd(today);
                setInterimNotes('');
                setIsInterimModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Sick / Other Leave
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Pharmacist</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {interimLeaves.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No sick or other leaves recorded.
                      </td>
                    </tr>
                  ) : (
                    interimLeaves.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-semibold text-slate-900">{getEmployeeName(l.employeeId)}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {l.leaveType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-700">
                          {l.startDate} → {l.endDate}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700">
                            {l.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{l.notes || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={async () => {
                              if (confirm('Delete this leave record?')) {
                                await dutySchedulerService.deleteLeaveRecord(l.id);
                                setInterimLeaves(prev => prev.filter(r => r.id !== l.id));
                              }
                            }}
                            className="text-xs text-red-600 hover:text-red-800 font-bold"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: SUBMIT ANNUAL LEAVE REQUEST                                    */}
      {/* ===================================================================== */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Request Annual Leave</h3>
                <p className="text-xs text-slate-500">Calculates calendar days & verifies available accrual</p>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {submitError}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Pharmacist</label>
                <select
                  value={newEmpId}
                  onChange={e => setNewEmpId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={e => setNewStartDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={e => setNewEndDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20"
                    required
                  />
                </div>
              </div>

              {/* Live Balance Card */}
              {liveBalanceInfo && (
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Requested Calendar Days:</span>
                    <span className="font-black font-mono text-sm text-slate-900">{requestedDaysCount} days</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Available Balance as of Start Date:</span>
                    <span
                      className={`font-black font-mono text-sm ${
                        requestedDaysCount > liveBalanceInfo.available ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {liveBalanceInfo.available.toFixed(2)} days
                    </span>
                  </div>
                  {requestedDaysCount > liveBalanceInfo.available && (
                    <div className="text-[11px] font-bold text-red-600 pt-1 border-t border-red-100 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Warning: Requested days exceed available balance. Approver will be blocked unless a manual adjustment is made.
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Request Comments</label>
                <textarea
                  value={newComments}
                  onChange={e => setNewComments(e.target.value)}
                  placeholder="Optional notes or context for the manager..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-lg hover:bg-brand/90 transition-all flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: APPROVE / REJECT / CANCEL DECISION                             */}
      {/* ===================================================================== */}
      {decisionMode && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {decisionMode === 'APPROVE' && 'Approve Annual Leave'}
                  {decisionMode === 'REJECT' && 'Reject Annual Leave'}
                  {decisionMode === 'CANCEL' && 'Cancel Leave Request'}
                </h3>
                <p className="text-xs text-slate-500">
                  {getEmployeeName(selectedRequest.employeeId)} ({selectedRequest.startDate} → {selectedRequest.endDate})
                </p>
              </div>
              <button onClick={() => setDecisionMode(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {decisionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {decisionError}
                </div>
              )}

              {/* Hard Balance Check Notice for Approvals */}
              {decisionMode === 'APPROVE' && decisionBalanceCheck && (
                <div
                  className={`p-3.5 rounded-xl border ${
                    decisionBalanceCheck.isExceeded
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Requested Days:</span>
                    <span className="font-mono">{selectedRequest.requestedDays} days</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold mt-1">
                    <span>Available Balance as of {selectedRequest.startDate}:</span>
                    <span className="font-mono">{decisionBalanceCheck.available.toFixed(2)} days</span>
                  </div>

                  {decisionBalanceCheck.isExceeded && (
                    <div className="mt-2.5 pt-2 border-t border-red-200/60 text-[11px] font-semibold text-red-700">
                      Approval blocked by hard rule (§2.3): Requested days exceed available balance. Approving would cause a negative balance. Apply a manual adjustment first if an override is required.
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {decisionMode === 'REJECT' ? (
                    <span>
                      Decision Reason / Comments <span className="text-red-500">* (Mandatory)</span>
                    </span>
                  ) : (
                    'Decision Comments / Note'
                  )}
                </label>
                <textarea
                  value={decisionComments}
                  onChange={e => setDecisionComments(e.target.value)}
                  placeholder={
                    decisionMode === 'REJECT'
                      ? 'Please explain the reason for rejection (required)...'
                      : 'Optional comments or notes...'
                  }
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDecisionMode(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isProcessingDecision || (decisionMode === 'APPROVE' && decisionBalanceCheck?.isExceeded)}
                  onClick={handleExecuteDecision}
                  className={`px-4 py-2 text-xs font-bold rounded-lg text-white transition-all flex items-center gap-1.5 ${
                    decisionMode === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50'
                      : decisionMode === 'REJECT'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {isProcessingDecision && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm {decisionMode}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: MANUAL BALANCE ADJUSTMENT                                      */}
      {/* ===================================================================== */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Manual Balance Adjustment</h3>
                <p className="text-xs text-slate-500">Audited manual adjustment for legacy carry-in or HR corrections</p>
              </div>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4">
              {adjustError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {adjustError}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Pharmacist</label>
                <input
                  type="text"
                  disabled
                  value={getEmployeeName(selectedLedgerEmpId)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Adjustment Amount (Days) <span className="text-slate-400 font-normal">(use + for credit, - for deduction)</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 5 or -2"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand/20"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Mandatory Note / Justification <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                  placeholder="e.g. Carry-in balance from previous HR system..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  required
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdjusting}
                  className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-lg hover:bg-brand/90 transition-all flex items-center gap-1.5"
                >
                  {isAdjusting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ADD SICK / OTHER LEAVE                                         */}
      {/* ===================================================================== */}
      {isInterimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Sick / Other Leave</h3>
                <p className="text-xs text-slate-500">Records non-accrual leaves in duty_scheduler_leave_records</p>
              </div>
              <button onClick={() => setIsInterimModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveInterimLeave} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Pharmacist</label>
                <select
                  value={interimEmpId}
                  onChange={e => setInterimEmpId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Leave Type</label>
                <select
                  value={interimType}
                  onChange={e => setInterimType(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800"
                >
                  <option value="SICK">Sick Leave</option>
                  <option value="EMERGENCY">Emergency Leave</option>
                  <option value="MATERNITY">Maternity / Paternity</option>
                  <option value="STUDY">Study / Exam Leave</option>
                  <option value="OTHER">Other Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={interimStart}
                    onChange={e => setInterimStart(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={interimEnd}
                    onChange={e => setInterimEnd(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Notes / Medical Certificate</label>
                <textarea
                  value={interimNotes}
                  onChange={e => setInterimNotes(e.target.value)}
                  placeholder="e.g. Doctor's note submitted..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInterimModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingInterim}
                  className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-lg hover:bg-brand/90 transition-all flex items-center gap-1.5"
                >
                  {isSavingInterim && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
