import React, { useEffect, useMemo, useState } from 'react';
import { DropdownSearch } from '../ui/DropdownSearch';
import { StatusBadge } from '../ui/StatusBadge';
import { CAPACard } from '../capa/CAPACard';
import { mockAuditStore } from '../../services/mockAuditStore';
import { supabaseTqphService } from '../../services/supabaseTqphService';
import { MOCK_AREAS, MOCK_BRANCHES, MOCK_USERS } from '../../data';
import { Area, Branch, CAPA_Task, NHRA_Audit, User } from '../../types';
import { exportNHRAReport } from '../../services/pdfExportService';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileCheck2,
  Filter,
  Loader2,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

interface BranchInspectionsViewProps {
  initialBranchId?: string;
  currentUser?: User;
  onExit?: () => void;
  className?: string;
}

export const BranchInspectionsView: React.FC<BranchInspectionsViewProps> = ({
  initialBranchId = MOCK_BRANCHES[0]?.id || '1b3b2924-ef34-4626-a77f-33227f2915ad',
  currentUser,
  onExit,
  className = ''
}) => {
  const [branches, setBranches] = useState<Branch[]>(MOCK_BRANCHES);
  const [areas, setAreas] = useState<Area[]>(MOCK_AREAS);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(initialBranchId);
  const [activeTab, setActiveTab] = useState<'capa' | 'audits'>('capa');
  const [capaFilter, setCapaFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  // Trigger state refresh when store updates
  const [storeTick, setStoreTick] = useState(0);
  const refreshStore = () => setStoreTick(t => t + 1);

  // Fetch real branches and areas from database
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
      console.warn('Live branches/areas fetch warning:', err);
    });
    return () => { isMounted = false; };
  }, []);

  // Find active branch
  const activeBranch = useMemo(() => {
    return branches.find(b => b.id === selectedBranchId) || branches[0] || MOCK_BRANCHES[0];
  }, [branches, selectedBranchId]);

  // Area name lookup map
  const areaNameMap = useMemo(() => {
    return new Map(areas.map(a => [a.id, a.name]));
  }, [areas]);

  // Audits for this branch (sorted newest first)
  const branchAudits = useMemo(() => {
    if (!selectedBranchId) return [];
    const list = mockAuditStore.getAuditsByBranch(selectedBranchId);
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedBranchId, storeTick]);

  // Latest audit
  const latestAudit = branchAudits[0] || null;

  // CAPA tasks for this branch
  const branchCapas = useMemo(() => {
    if (!selectedBranchId) return [];
    return mockAuditStore.getCapaTasks(selectedBranchId);
  }, [selectedBranchId, storeTick]);

  // Filtered CAPA tasks
  const filteredCapas = useMemo(() => {
    if (capaFilter === 'open') return branchCapas.filter(c => c.status === 'open');
    if (capaFilter === 'resolved') return branchCapas.filter(c => c.status === 'resolved');
    return branchCapas;
  }, [branchCapas, capaFilter]);

  // Group filtered CAPAs by severity
  const groupedCapas = useMemo(() => {
    const critical = filteredCapas.filter(c => c.severity === 'Critical');
    const major = filteredCapas.filter(c => c.severity === 'Major');
    const minor = filteredCapas.filter(c => c.severity === 'Minor');
    return { critical, major, minor };
  }, [filteredCapas]);

  // Overdue count (due date < now and status === 'open')
  const overdueCapasCount = useMemo(() => {
    const now = Date.now();
    return branchCapas.filter(
      c => c.status === 'open' && new Date(c.due_date).getTime() < now
    ).length;
  }, [branchCapas]);

  const openCapasCount = useMemo(() => {
    return branchCapas.filter(c => c.status === 'open').length;
  }, [branchCapas]);

  // Sync live branch data from Supabase
  useEffect(() => {
    if (!selectedBranchId) return;
    let isMounted = true;
    Promise.all([
      supabaseTqphService.getAudits(selectedBranchId),
      supabaseTqphService.getCapaTasks(selectedBranchId)
    ]).then(([liveAudits, liveCapas]) => {
      if (!isMounted) return;
      if (liveAudits && liveAudits.length > 0) {
        liveAudits.forEach(a => mockAuditStore.saveAudit(a));
      }
      if (liveCapas && liveCapas.length > 0) {
        liveCapas.forEach(c => mockAuditStore.updateCapaTask(c));
      }
      refreshStore();
    }).catch(err => {
      console.warn('Branch live fetch fallback:', err);
    });
    return () => { isMounted = false; };
  }, [selectedBranchId]);

  // Handle CAPA Resolution
  const handleResolveCapa = (taskId: string, proofUrl: string, resolutionComment: string) => {
    const updatePayload = {
      id: taskId,
      status: 'resolved' as const,
      resolved_by: currentUser?.name || activeBranch.manager_name,
      resolved_at: new Date().toISOString(),
      resolution_proof_url: proofUrl
    };
    mockAuditStore.updateCapaTask(updatePayload);
    supabaseTqphService.updateCapaTask(updatePayload);
    refreshStore();
  };

  const [generatingPdfAuditId, setGeneratingPdfAuditId] = useState<string | null>(null);

  const handleDownloadPdf = async (audit: NHRA_Audit) => {
    try {
      setGeneratingPdfAuditId(audit.id);
      const supervisor =
        users.find(u => u.id === audit.supervisor_id) ||
        users.find(u => u.role === 'supervisor') ||
        MOCK_USERS[0];
      const auditCapas = branchCapas.filter(c => c.audit_id === audit.id);
      await exportNHRAReport(audit, activeBranch, supervisor, auditCapas);
    } catch (err) {
      console.error('Failed to generate NHRA PDF:', err);
    } finally {
      setGeneratingPdfAuditId(null);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50/60 text-slate-900 p-4 sm:p-6 md:p-8 font-sans ${className}`}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
              <ShieldCheck className="w-4 h-4" />
              <span>Branch Management Portal</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-950 mt-1">
              Branch Inspections &amp; CAPA Action Center (/branch/inspections)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
              Official NHRA Compliance History &amp; Corrective Actions SLA Tracker
            </p>
          </div>

          {/* Branch Switcher (Section 7.2 DropdownSearch) */}
          <div className="w-full sm:w-80">
            <DropdownSearch<Branch>
              items={branches}
              getLabel={b => b.name}
              getValue={b => b.id}
              value={selectedBranchId}
              onChange={setSelectedBranchId}
              placeholder="Switch Pharmacy Branch..."
              groupBy={b => areaNameMap.get(b.area_id) || 'General'}
              clearable={false}
              emptyStateLabel="No branches found"
            />
          </div>
        </div>

        {/* Branch Overview KPI Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block">
              Latest NHRA Score
            </span>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-2xl font-black font-mono text-slate-950 tabular-nums">
                {latestAudit ? `${latestAudit.compliance_score.toFixed(1)}%` : 'N/A'}
              </span>
              {latestAudit && (
                <StatusBadge
                  variant={{ type: 'compliance', score: latestAudit.compliance_score }}
                  size="sm"
                  className="hidden sm:inline-flex"
                />
              )}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">
              {latestAudit ? `Inspected on ${latestAudit.date}` : 'No audits on record'}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block">
              Total Inspections
            </span>
            <span className="text-2xl font-black font-mono text-slate-950 mt-1.5 block tabular-nums">
              {branchAudits.length}
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">
              Archive across all cycles
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block">
              Open CAPA Actions
            </span>
            <span className={`text-2xl font-black font-mono mt-1.5 block tabular-nums ${openCapasCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {openCapasCount}
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">
              Corrective tasks pending
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block">
              Overdue SLA (&gt;48h)
            </span>
            <span className={`text-2xl font-black font-mono mt-1.5 block tabular-nums ${overdueCapasCount > 0 ? 'text-red-700 font-black' : 'text-slate-400'}`}>
              {overdueCapasCount}
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">
              Immediate escalation risk
            </span>
          </div>
        </div>

        {/* View Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="inline-flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('capa')}
              className={`
                px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all
                ${
                  activeTab === 'capa'
                    ? 'bg-white text-slate-950 font-black shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }
              `}
            >
              CAPA Action Center ({openCapasCount} Open)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audits')}
              className={`
                px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all
                ${
                  activeTab === 'audits'
                    ? 'bg-white text-slate-950 font-black shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }
              `}
            >
              Inspection History ({branchAudits.length})
            </button>
          </div>

          {activeTab === 'capa' && (
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setCapaFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all text-xs font-bold ${
                  capaFilter === 'all' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({branchCapas.length})
              </button>
              <button
                type="button"
                onClick={() => setCapaFilter('open')}
                className={`px-3 py-1 rounded-lg transition-all text-xs font-bold ${
                  capaFilter === 'open' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Open ({openCapasCount})
              </button>
              <button
                type="button"
                onClick={() => setCapaFilter('resolved')}
                className={`px-3 py-1 rounded-lg transition-all text-xs font-bold ${
                  capaFilter === 'resolved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Resolved ({branchCapas.length - openCapasCount})
              </button>
            </div>
          )}
        </div>

        {/* ── TAB 1: CAPA Action Center ─────────────────────── */}
        {activeTab === 'capa' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {filteredCapas.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2 shadow-sm">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h3 className="text-base font-bold text-slate-950">
                  No Corrective Action Tasks in this filter
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                  All compliance violations for {activeBranch.name} have either been successfully resolved or none were detected.
                </p>
              </div>
            ) : (
              <>
                {/* 1. Critical Tasks */}
                {groupedCapas.critical.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5 font-mono">
                        <AlertCircle className="w-4 h-4" />
                        <span>Critical Severity ({groupedCapas.critical.length})</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        License &amp; Approvals (1.0), Controlled Registers (7.0, 8.0)
                      </span>
                    </div>

                    <div className="space-y-3">
                      {groupedCapas.critical.map(capa => (
                        <CAPACard
                          key={capa.id}
                          capa={capa}
                          onResolve={handleResolveCapa}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Major Tasks */}
                {groupedCapas.major.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5 font-mono">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Major Severity ({groupedCapas.major.length})</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Records (5.0), Storage &amp; Cold Chain (6.0)
                      </span>
                    </div>

                    <div className="space-y-3">
                      {groupedCapas.major.map(capa => (
                        <CAPACard
                          key={capa.id}
                          capa={capa}
                          onResolve={handleResolveCapa}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Minor Tasks */}
                {groupedCapas.minor.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 font-mono">
                        <Clock className="w-4 h-4" />
                        <span>Minor Severity ({groupedCapas.minor.length})</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Workplace (2.0), Policies (3.0), Pricing (4.0)
                      </span>
                    </div>

                    <div className="space-y-3">
                      {groupedCapas.minor.map(capa => (
                        <CAPACard
                          key={capa.id}
                          capa={capa}
                          onResolve={handleResolveCapa}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB 2: Inspection History ─────────────────────── */}
        {activeTab === 'audits' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {branchAudits.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-500 font-medium shadow-sm">
                No official inspection reports recorded for this facility yet.
              </div>
            ) : (
              branchAudits.map(audit => {
                const isExpanded = expandedAuditId === audit.id;

                return (
                  <div
                    key={audit.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all"
                  >
                    {/* Audit Summary Header */}
                    <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-slate-950">
                            Inspection: {audit.date}
                          </span>
                          <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-bold">
                            {audit.id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          Audited by <strong className="text-slate-900">{audit.supervisor_id}</strong> · Status: <span className="capitalize text-emerald-700 font-bold font-mono">{audit.status.replace('_', ' ')}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <StatusBadge
                          variant={{ type: 'compliance', score: audit.compliance_score }}
                          size="md"
                        />

                        {/* Download Official NHRA PDF Action */}
                        <button
                          type="button"
                          disabled={generatingPdfAuditId === audit.id}
                          onClick={() => handleDownloadPdf(audit)}
                          className="
                            inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all
                            bg-red-700 text-white hover:bg-red-800 active:scale-95 shadow-md shadow-red-700/20
                            disabled:opacity-60 disabled:cursor-not-allowed
                          "
                        >
                          {generatingPdfAuditId === audit.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Generating PDF...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>Download Official NHRA PDF</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setExpandedAuditId(isExpanded ? null : audit.id)}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Section Breakdown */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 space-y-3">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono block">
                          8-Section Checklist Breakdown:
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {audit.sections.map(sec => {
                            const applicable = sec.items.filter(it => it.status !== 'not_applicable');
                            const full = sec.items.filter(it => it.status === 'fully_compliant');
                            const partial = sec.items.filter(it => it.status === 'partially_compliant');
                            const secScore = applicable.length > 0
                              ? ((full.length * 1.0 + partial.length * 0.5) / applicable.length) * 100
                              : 100;

                            return (
                              <div
                                key={sec.section_code}
                                className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-sm"
                              >
                                <div className="truncate pr-2">
                                  <span className="font-mono text-red-700 font-bold mr-1.5">
                                    {sec.section_code}
                                  </span>
                                  <span className="text-slate-800 font-medium">{sec.title}</span>
                                </div>
                                <StatusBadge
                                  variant={{ type: 'compliance', score: secScore }}
                                  size="sm"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
