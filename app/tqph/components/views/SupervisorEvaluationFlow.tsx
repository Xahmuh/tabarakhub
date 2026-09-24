import React, { useEffect, useMemo, useState } from 'react';
import { Stepper, StepperTabId } from '../ui/Stepper';
import { DropdownSearch } from '../ui/DropdownSearch';
import { StatusBadge } from '../ui/StatusBadge';
import { ConfirmModal } from '../ui/ConfirmModal';
import { NHRAChecklistSection } from '../audit/NHRAChecklistSection';
import { AppraisalSectionCard } from '../appraisal/AppraisalSectionCard';
import { CreditScoreIndicator } from '../appraisal/CreditScoreIndicator';
import { useAuditDraft } from '../../hooks/useAuditDraft';
import { useAppraisalDraft } from '../../hooks/useAppraisalDraft';
import { mockAuditStore } from '../../services/mockAuditStore';
import { supabaseTqphService } from '../../services/supabaseTqphService';
import { distributeLockedEvaluation } from '../../services/distributionService';
import { generateCapaTasksFromAudit } from '../../services/capaService';
import { MOCK_AREAS, MOCK_BRANCHES, MOCK_USERS } from '../../data';
import { Area, Branch, CAPA_Task, DistributionLog, NHRA_Audit, Pharmacist_Appraisal, User } from '../../types';
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  History,
  Lock,
  RotateCcw,
  Send,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  Award
} from 'lucide-react';

interface SupervisorEvaluationFlowProps {
  currentSupervisor?: User;
  currentUser?: User;
  onExit?: () => void;
  onCompleted?: () => void;
  className?: string;
}

export const SupervisorEvaluationFlow: React.FC<SupervisorEvaluationFlowProps> = ({
  currentSupervisor,
  currentUser,
  onExit,
  onCompleted,
  className = ''
}) => {
  const supervisorUser = currentSupervisor || currentUser || MOCK_USERS.find(u => u.role === 'supervisor') || MOCK_USERS[0];
  const [branches, setBranches] = useState<Branch[]>(MOCK_BRANCHES);
  const [areas, setAreas] = useState<Area[]>(MOCK_AREAS);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);

  const [activeTab, setActiveTab] = useState<StepperTabId>('A');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isLockedSubmitted, setIsLockedSubmitted] = useState(false);
  const [lockedSummary, setLockedSummary] = useState<{
    audit: NHRA_Audit;
    appraisal: Pharmacist_Appraisal;
    capas: CAPA_Task[];
    distributionLogs: DistributionLog[];
  } | null>(null);

  // Fetch real branches, areas, and pharmacists from database
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      supabaseTqphService.getBranches(),
      supabaseTqphService.getAreas(),
      supabaseTqphService.getPharmacists()
    ]).then(([liveBranches, liveAreas, livePharmacists]) => {
      if (!isMounted) return;
      if (liveBranches && liveBranches.length > 0) {
        setBranches(liveBranches);
      }
      if (liveAreas && liveAreas.length > 0) {
        setAreas(liveAreas);
      }
      if (livePharmacists && livePharmacists.length > 0) {
        setUsers(prev => {
          const nonPh = prev.filter(u => u.role !== 'pharmacist');
          return [...nonPh, ...livePharmacists];
        });
      }
    }).catch(err => {
      console.warn('SupervisorFlow live fetch warning:', err);
    });
    return () => { isMounted = false; };
  }, []);

  // Draft persistence hooks
  const {
    draft: auditDraft,
    setBranchId,
    setDate: setAuditDate,
    updateSection: updateAuditSection,
    addAttachment,
    removeAttachment,
    resetDraft: resetAuditDraft,
    scoreResult: complianceScoreResult,
    completedSectionsCount
  } = useAuditDraft(supervisorUser.id);

  const {
    draft: appraisalDraft,
    setPharmacistId,
    setBranchId: setAppraisalBranchId,
    updateSection: updateAppraisalSection,
    setComments,
    resetDraft: resetAppraisalDraft,
    scoreResult: creditScoreResult
  } = useAppraisalDraft(supervisorUser.id);

  // Branches filtered by selected area
  const filteredBranches = useMemo(() => {
    if (!selectedAreaId) return branches;
    return branches.filter(b => b.area_id === selectedAreaId);
  }, [branches, selectedAreaId]);

  // Selected branch object
  const activeBranch = useMemo(() => {
    return branches.find(b => b.id === auditDraft.branchId) || null;
  }, [branches, auditDraft.branchId]);

  // Pharmacists list
  const pharmacists = useMemo(() => {
    return users.filter(u => u.role === 'pharmacist');
  }, [users]);

  // Pharmacists assigned to the selected branch
  const branchPharmacists = useMemo(() => {
    if (!auditDraft.branchId) return pharmacists;
    const assigned = pharmacists.filter(p => p.branch_id === auditDraft.branchId);
    return assigned.length > 0 ? assigned : pharmacists;
  }, [auditDraft.branchId, pharmacists]);

  // Selected pharmacist object
  const activePharmacist = useMemo(() => {
    return users.find(u => u.id === appraisalDraft.pharmacistId) || null;
  }, [users, appraisalDraft.pharmacistId]);

  // Area name map for grouping
  const areaNameMap = useMemo(() => {
    return new Map(areas.map(a => [a.id, a.name]));
  }, [areas]);

  // Step access rules:
  // Tab B unlocked once a branch is selected
  // Tab C unlocked once Tab B is started
  // Tab D unlocked once a pharmacist is selected
  const canAccessTab = (tabId: StepperTabId): boolean => {
    if (tabId === 'A') return true;
    if (tabId === 'B') return !!auditDraft.branchId;
    if (tabId === 'C') return !!auditDraft.branchId;
    if (tabId === 'D') return !!auditDraft.branchId && !!appraisalDraft.pharmacistId;
    return false;
  };

  const completedTabs = useMemo(() => {
    const completed = new Set<StepperTabId>();
    if (auditDraft.branchId) completed.add('A');
    if (completedSectionsCount >= 8) completed.add('B');
    if (appraisalDraft.pharmacistId) completed.add('C');
    if (isLockedSubmitted) completed.add('D');
    return completed;
  }, [auditDraft.branchId, completedSectionsCount, appraisalDraft.pharmacistId, isLockedSubmitted]);

  // Preview generated CAPA tasks
  const previewCapas = useMemo(() => {
    if (!activeBranch) return [];
    return generateCapaTasksFromAudit(
      auditDraft.id,
      auditDraft.sections,
      activeBranch.manager_name,
      new Date().toISOString()
    );
  }, [auditDraft.id, auditDraft.sections, activeBranch]);

  // Handle Branch Selection in Tab A
  const handleSelectBranch = (branchId: string | null) => {
    setBranchId(branchId);
    setAppraisalBranchId(branchId);
    if (branchId) {
      const branch = branches.find(b => b.id === branchId);
      if (branch) {
        setSelectedAreaId(branch.area_id);
      }
    }
  };

  // Execute Lock & Multi-Portal Distribution (Tab D)
  const handleConfirmLock = async () => {
    if (!activeBranch || !activePharmacist) {
      return { success: false, logs: [], error: 'Branch or Pharmacist not selected.' };
    }

    const lockedAt = new Date().toISOString();

    // 1. Generate CAPA tasks
    const generatedCapas = generateCapaTasksFromAudit(
      auditDraft.id,
      auditDraft.sections,
      activeBranch.manager_name,
      lockedAt
    );

    // 2. Build final sealed records
    const finalAudit: NHRA_Audit = {
      id: auditDraft.id,
      branch_id: activeBranch.id,
      supervisor_id: supervisorUser.id,
      date: auditDraft.date,
      status: 'locked_submitted',
      sections: auditDraft.sections,
      compliance_score: complianceScoreResult.score,
      violations_list: generatedCapas.map(c => c.id),
      created_at: auditDraft.lastSavedAt,
      updated_at: lockedAt,
      locked_at: lockedAt,
      submitted_by: supervisorUser.id,
      amended: false
    };

    const finalAppraisal: Pharmacist_Appraisal = {
      id: appraisalDraft.id,
      pharmacist_id: activePharmacist.id,
      branch_id: activeBranch.id,
      supervisor_id: supervisorUser.id,
      month: appraisalDraft.month,
      year: appraisalDraft.year,
      sections: appraisalDraft.sections,
      total_credit_score: creditScoreResult.totalCreditScore,
      passed: creditScoreResult.passed,
      comments_and_improvement: appraisalDraft.commentsAndImprovement,
      status: 'locked_submitted',
      created_at: appraisalDraft.lastSavedAt,
      updated_at: lockedAt,
      locked_at: lockedAt,
      submitted_by: supervisorUser.id,
      amended: false
    };

    // 3. Multi-Portal Distribution (Section 5.6)
    const distResult = await distributeLockedEvaluation(finalAudit, finalAppraisal);
    if (!distResult.success) {
      return { success: false, logs: [], error: distResult.error };
    }

    // 4. Save to Mock Store / Adapter & Live Supabase
    mockAuditStore.saveAudit(finalAudit);
    mockAuditStore.saveAppraisal(finalAppraisal);
    mockAuditStore.saveCapaTasks(generatedCapas);
    mockAuditStore.saveDistributionLogs(distResult.logs);

    try {
      await Promise.all([
        supabaseTqphService.saveAudit(finalAudit),
        supabaseTqphService.saveAppraisal(finalAppraisal),
        supabaseTqphService.saveCapaTasks(generatedCapas),
        supabaseTqphService.saveDistributionLogs(distResult.logs)
      ]);
    } catch (persistErr) {
      console.warn('Supabase live persistence warning:', persistErr);
    }

    // 5. Clear Drafts
    resetAuditDraft();
    resetAppraisalDraft();

    setLockedSummary({
      audit: finalAudit,
      appraisal: finalAppraisal,
      capas: generatedCapas,
      distributionLogs: distResult.logs
    });
    setIsLockedSubmitted(true);

    return {
      success: true,
      logs: distResult.logs
    };
  };

  // Reset entire evaluation flow to start fresh
  const handleStartNewEvaluation = () => {
    resetAuditDraft();
    resetAppraisalDraft();
    setIsLockedSubmitted(false);
    setLockedSummary(null);
    setActiveTab('A');
  };

  // ── Success / Locked State View ─────────────────────────
  if (isLockedSubmitted && lockedSummary) {
    return (
      <div className={`min-h-screen bg-slate-50/60 text-slate-900 p-6 md:p-10 font-sans ${className}`}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-950">
              Evaluation Sealed &amp; Distributed
            </h1>
            <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed font-medium">
              Official audit for <span className="text-slate-900 font-bold">{activeBranch?.name}</span> and appraisal for <span className="text-slate-900 font-bold">{activePharmacist?.name}</span> have been permanently locked and distributed across all 3 portals.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 max-w-2xl mx-auto text-left">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">NHRA Score</span>
                <span className="text-2xl font-black font-mono text-emerald-700 block mt-1 tabular-nums">
                  {lockedSummary.audit.compliance_score.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500 mt-0.5 block font-medium">Audit ID: {lockedSummary.audit.id}</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Staff Credit</span>
                <span className="text-2xl font-black font-mono text-slate-950 block mt-1 tabular-nums">
                  {lockedSummary.appraisal.total_credit_score} / 150
                </span>
                <span className="text-xs text-slate-500 mt-0.5 block font-medium">
                  {lockedSummary.appraisal.passed ? 'Passing (≥95 pts)' : 'Did Not Pass'}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">CAPA Tasks</span>
                <span className="text-2xl font-black font-mono text-red-700 block mt-1 tabular-nums">
                  {lockedSummary.capas.length} Tasks
                </span>
                <span className="text-xs text-slate-500 mt-0.5 block font-medium">48-Hour SLA Assigned</span>
              </div>
            </div>

            {/* Distribution Log Receipts */}
            <div className="pt-4 max-w-2xl mx-auto text-left space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                Official Dispatch Records (DistributionLog):
              </span>
              {lockedSummary.distributionLogs.map(log => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Send className="w-3.5 h-3.5 text-red-700" />
                    <span className="text-slate-900 font-bold capitalize">
                      {log.recipient_type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-emerald-700">
                    Status: {log.status} · Sent: {new Date(log.sent_at || '').toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="pt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={handleStartNewEvaluation}
                className="
                  inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all
                  bg-red-700 text-white hover:bg-red-800 active:scale-95 shadow-lg shadow-red-700/20
                "
              >
                <RotateCcw className="w-4 h-4" />
                <span>Start New Evaluation</span>
              </button>

              {onExit && (
                <button
                  type="button"
                  onClick={onExit}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors shadow-sm"
                >
                  Back to Hub
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Stepper Flow ───────────────────────────────────
  return (
    <div className={`min-h-screen bg-slate-50/60 text-slate-900 p-4 sm:p-6 md:p-8 font-sans ${className}`}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
              <ShieldCheck className="w-4 h-4" />
              <span>Tabarak Quality &amp; Performance Hub</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-950 mt-1">
              Field Evaluation Stepper (/supervisor/audits/new)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
              Supervisor: <span className="text-slate-900 font-bold">{supervisorUser.name}</span> · Bahrain Network
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Score Pill in Header */}
            {auditDraft.branchId && (
              <div className="hidden sm:flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs shadow-sm">
                <span className="text-slate-500 font-bold">NHRA Live:</span>
                <StatusBadge
                  variant={{ type: 'compliance', score: complianceScoreResult.score }}
                  size="sm"
                />
              </div>
            )}

            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:text-red-700 bg-white border border-slate-200 rounded-xl hover:border-red-200 shadow-sm transition-colors"
              >
                Exit to Hub
              </button>
            )}
          </div>
        </div>

        {/* 4-Tab Stepper */}
        <Stepper
          activeTab={activeTab}
          onTabChange={setActiveTab}
          canAccessTab={canAccessTab}
          completedTabs={completedTabs}
        />

        {/* ── TAB A: Branch Selection ──────────────────────── */}
        {activeTab === 'A' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-950 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-red-700" />
                  <span>Tab A — Branch &amp; Facility Selection</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Select the target pharmacy branch for this inspection visit. Selecting a branch is required to unlock Tab B.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Area Filter */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">
                    Filter by Governorate (Optional):
                  </label>
                  <DropdownSearch<Area>
                    items={areas}
                    getLabel={a => a.name}
                    getValue={a => a.id}
                    value={selectedAreaId}
                    onChange={setSelectedAreaId}
                    placeholder="All Bahrain Governorates..."
                    clearable={true}
                    emptyStateLabel="No areas found"
                  />
                </div>

                {/* Branch Selection Dropdown */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-600">
                    Pharmacy Branch <span className="text-red-700">*</span>:
                  </label>
                  <DropdownSearch<Branch>
                    items={filteredBranches}
                    getLabel={b => b.name}
                    getValue={b => b.id}
                    value={auditDraft.branchId}
                    onChange={handleSelectBranch}
                    placeholder="Search 20 Bahrain Branches (e.g. Manama, Riffa, Saar)..."
                    groupBy={b => areaNameMap.get(b.area_id) || 'General'}
                    clearable={true}
                    emptyStateLabel="No branches found matching filter"
                  />
                </div>
              </div>

              {/* Inspection Date */}
              <div className="max-w-xs space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                  <Calendar className="w-3.5 h-3.5 text-red-700" />
                  <span>Inspection Date:</span>
                </label>
                <input
                  type="date"
                  value={auditDraft.date}
                  onChange={e => setAuditDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:ring-2 focus:ring-red-600/20 focus:border-red-600 focus:outline-none shadow-sm"
                />
              </div>

              {/* Selected Branch Inspection Card */}
              {activeBranch ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-black text-slate-950 text-sm">{activeBranch.name}</span>
                    <span className="text-[10px] font-black uppercase font-mono text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      Ready for Audit
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-500 pt-1">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">NHRA Facility License</span>
                      <span className="font-mono text-slate-900 font-bold">{activeBranch.license_no}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Branch Manager</span>
                      <span className="text-slate-900 font-bold">{activeBranch.manager_name}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Territory Area</span>
                      <span className="text-slate-900 font-bold">{areaNameMap.get(activeBranch.area_id)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                  <span className="font-semibold">Please select a branch above to proceed with the simulated checklist (Tab B).</span>
                </div>
              )}

              {/* Bottom Navigation */}
              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  disabled={!auditDraft.branchId}
                  onClick={() => setActiveTab('B')}
                  className="
                    flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all
                    bg-red-700 text-white hover:bg-red-800 active:scale-95
                    shadow-lg shadow-red-700/20 disabled:opacity-40 disabled:cursor-not-allowed
                  "
                >
                  <span>Proceed to NHRA Checklist (Tab B)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB B: NHRA Simulated Checklist ─────────────── */}
        {activeTab === 'B' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header Toolbar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-950 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-red-700" />
                  <span>Tab B — NHRA Simulated 8-Section Checklist</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Simulating official NHRA inspection standard (1.0 to 8.0). Non-compliant items automatically create CAPAs.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-black uppercase tracking-wider">Running Compliance</span>
                  <span className="text-lg font-black font-mono text-slate-950 tabular-nums">
                    {complianceScoreResult.score.toFixed(1)}%
                  </span>
                </div>
                <StatusBadge
                  variant={{ type: 'compliance', score: complianceScoreResult.score }}
                  size="md"
                />
              </div>
            </div>

            {/* Checklist Sections 1.0 to 8.0 */}
            <div className="space-y-4">
              {auditDraft.sections.map(section => (
                <NHRAChecklistSection
                  key={section.section_code}
                  section={section}
                  attachments={auditDraft.attachments}
                  onSectionChange={updateAuditSection}
                  onAddAttachment={addAttachment}
                  onRemoveAttachment={removeAttachment}
                />
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveTab('A')}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← Back to Branch Selection
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('C')}
                className="
                  flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all
                  bg-red-700 text-white hover:bg-red-800 active:scale-95 shadow-lg shadow-red-700/20
                "
              >
                <span>Proceed to Staff Appraisal (Tab C)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── TAB C: Staff Appraisal ──────────────────────── */}
        {activeTab === 'C' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Pharmacist Selection Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-950 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-red-700" />
                  <span>Tab C — On-Duty Pharmacist Appraisal</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Evaluate on-duty staff across 6 pillars (30 criteria, max 150 points). Minimum 95 points required to pass.
                </p>
              </div>

              <div className="max-w-md space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">
                  Select On-Duty Pharmacist <span className="text-red-700">*</span>:
                </label>
                <DropdownSearch<User>
                  items={branchPharmacists}
                  getLabel={u => `${u.name}${u.cpr ? ` (CPR: ***${u.cpr.slice(-4)})` : ''}`}
                  getValue={u => u.id}
                  value={appraisalDraft.pharmacistId}
                  onChange={setPharmacistId}
                  placeholder="Select pharmacist on duty..."
                  clearable={true}
                  emptyStateLabel="No pharmacists found for this branch"
                />
              </div>

              {activePharmacist && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex justify-between">
                  <span className="text-slate-500 font-medium">Pharmacist: <strong className="text-slate-900 font-bold">{activePharmacist.name}</strong></span>
                  <span className="text-slate-500 font-mono">CPR: <strong className="text-slate-900 font-bold">******{activePharmacist.cpr ? activePharmacist.cpr.slice(-3) : '***'}</strong></span>
                </div>
              )}
            </div>

            {/* Sticky Live Credit Score Indicator (Section 7.3.1) */}
            <div className="sticky top-4 z-20">
              <CreditScoreIndicator scoreResult={creditScoreResult} />
            </div>

            {/* 6 Appraisal Sections (I to VI) */}
            <div className="space-y-4">
              {appraisalDraft.sections.map(section => (
                <AppraisalSectionCard
                  key={section.section_id}
                  section={section}
                  onSectionChange={updateAppraisalSection}
                />
              ))}
            </div>

            {/* Supervisor Comments & Improvement */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-sm">
              <label className="block text-xs font-bold text-slate-700">
                Supervisor Improvement Directives &amp; Clinical Notes:
              </label>
              <textarea
                rows={3}
                value={appraisalDraft.commentsAndImprovement}
                onChange={e => setComments(e.target.value)}
                placeholder="Enter clinical recommendations, areas of excellence, or mandatory refresher directives for this pharmacist..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-red-600/20 focus:border-red-600 focus:outline-none placeholder-slate-400 shadow-sm"
              />
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveTab('B')}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← Back to NHRA Checklist
              </button>

              <button
                type="button"
                disabled={!appraisalDraft.pharmacistId}
                onClick={() => setActiveTab('D')}
                className="
                  flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all
                  bg-red-700 text-white hover:bg-red-800 active:scale-95 shadow-lg shadow-red-700/20
                  disabled:opacity-40 disabled:cursor-not-allowed
                "
              >
                <span>Proceed to Confirmation &amp; Lock (Tab D)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── TAB D: Confirmation & Lock ──────────────────── */}
        {activeTab === 'D' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-950 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-red-700" />
                  <span>Tab D — Audit &amp; Appraisal Final Review &amp; Lock</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Review complete evaluation metrics. Sealing triggers immediate irreversible multi-portal dispatch.
                </p>
              </div>

              {/* Side by Side Evaluation Review */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Audit Summary Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <span className="font-bold text-slate-950 text-sm flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-red-700" />
                      <span>NHRA Audit Review</span>
                    </span>
                    <StatusBadge
                      variant={{ type: 'compliance', score: complianceScoreResult.score }}
                      size="sm"
                    />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Facility:</span>
                      <span className="text-slate-900 font-bold">{activeBranch?.name}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>License No:</span>
                      <span className="font-mono text-slate-900 font-bold">{activeBranch?.license_no}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Overall Compliance:</span>
                      <span className="font-mono font-black text-slate-950 tabular-nums">{complianceScoreResult.score.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Non-Compliant Items:</span>
                      <span className="text-red-700 font-black">{complianceScoreResult.nonCompliantCount}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Attached Photos:</span>
                      <span className="text-slate-900 font-bold">{auditDraft.attachments.length} items</span>
                    </div>
                  </div>
                </div>

                {/* Appraisal Summary Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <span className="font-bold text-slate-950 text-sm flex items-center gap-2">
                      <Award className="w-4 h-4 text-red-700" />
                      <span>Staff Appraisal Review</span>
                    </span>
                    <StatusBadge
                      variant={{
                        type: 'appraisal',
                        passed: creditScoreResult.passed,
                        score: creditScoreResult.totalCreditScore
                      }}
                      size="sm"
                    />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Pharmacist:</span>
                      <span className="text-slate-900 font-bold">{activePharmacist?.name}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Total Credit Score:</span>
                      <span className="font-mono font-black text-slate-950 tabular-nums">
                        {creditScoreResult.totalCreditScore} / 150 pts
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Pass Requirement:</span>
                      <span className="text-slate-800 font-semibold">≥95 pts (Current: {creditScoreResult.passed ? 'Passed' : 'Fail'})</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Criteria Evaluated:</span>
                      <span className="text-slate-900 font-bold">30 / 30 rated</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto-Generated CAPA Preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Auto-Generated Corrective Action Tasks ({previewCapas.length})</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 font-medium">
                    48-Hour Resolution Due Date
                  </span>
                </div>

                {previewCapas.length === 0 ? (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold">Zero violations detected. No CAPA tasks will be generated.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {previewCapas.map(capa => (
                      <div
                        key={capa.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-slate-200 text-xs shadow-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {capa.element_code}
                          </span>
                          <span className="text-slate-900 font-bold truncate">{capa.violation}</span>
                        </div>
                        <StatusBadge variant={{ type: 'capa', severity: capa.severity }} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lock Warning Banner */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-2 text-amber-900">
                  <Lock className="w-4 h-4 text-amber-700" />
                  <span>Permanent Seal &amp; Post-Lock Immutability (Section 5.5 &amp; 5.6):</span>
                </p>
                <p className="text-amber-800 leading-relaxed pl-6 font-medium">
                  Once confirmed, this audit cannot be modified or re-submitted. Both the NHRA inspection report and staff appraisal will auto-route to the Branch Account, Pharmacist Personal Portal, and Executive Admin archive.
                </p>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('C')}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  ← Back to Appraisal
                </button>

                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="
                    flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs transition-all
                    bg-red-700 text-white hover:bg-red-800 active:scale-95 shadow-xl shadow-red-700/25
                  "
                >
                  <Lock className="w-4 h-4 text-white" />
                  <span>Lock &amp; Distribute Evaluation</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmLock}
        branchName={activeBranch?.name || 'Selected Branch'}
        pharmacistName={activePharmacist?.name || 'Selected Pharmacist'}
        complianceScore={complianceScoreResult.score}
        creditScore={creditScoreResult.totalCreditScore}
        capaCount={previewCapas.length}
      />
    </div>
  );
};
