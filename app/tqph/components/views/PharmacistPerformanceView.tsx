import React, { useEffect, useMemo, useState } from 'react';
import { DropdownSearch } from '../ui/DropdownSearch';
import { StatusBadge } from '../ui/StatusBadge';
import { supabaseTqphService } from '../../services/supabaseTqphService';
import { AppraisalSection, Branch, Pharmacist_Appraisal, User } from '../../types';
import { exportAppraisalReport } from '../../services/pdfExportService';
import {
  Award,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  FileCheck2,
  Loader2,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  XCircle
} from 'lucide-react';

interface PharmacistPerformanceViewProps {
  initialPharmacistId?: string;
  onExit?: () => void;
  className?: string;
}

export const PharmacistPerformanceView: React.FC<PharmacistPerformanceViewProps> = ({
  initialPharmacistId,
  onExit,
  className = ''
}) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedPharmacistId, setSelectedPharmacistId] = useState<string | null>(initialPharmacistId || null);
  const [selectedAppraisalId, setSelectedAppraisalId] = useState<string | null>(null);
  const [appraisals, setAppraisals] = useState<Pharmacist_Appraisal[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pharmacists list
  const pharmacists = useMemo(() => {
    return allUsers.filter(u => u.role === 'pharmacist');
  }, [allUsers]);

  // Active pharmacist
  const activePharmacist = useMemo(() => {
    return selectedPharmacistId ? allUsers.find(u => u.id === selectedPharmacistId) : pharmacists[0];
  }, [selectedPharmacistId, pharmacists, allUsers]);

  // Fetch real pharmacists and branches from database
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      supabaseTqphService.getPharmacists(),
      supabaseTqphService.getBranches()
    ]).then(([livePharmacists, liveBranches]) => {
      if (!isMounted) return;
      setBranches(liveBranches);
      setAllUsers(livePharmacists);
      if (!selectedPharmacistId && livePharmacists[0]) setSelectedPharmacistId(livePharmacists[0].id);
    }).catch(err => {
      if (isMounted) setLoadError(err instanceof Error ? err.message : 'Failed to load pharmacists');
    });
    return () => { isMounted = false; };
  }, []);

  // Sync live appraisals from Supabase
  useEffect(() => {
    if (!selectedPharmacistId) return;
    let isMounted = true;
    setAppraisals([]);
    supabaseTqphService.getAppraisals(selectedPharmacistId).then(liveList => {
      if (!isMounted) return;
      setAppraisals(liveList);
    }).catch(err => {
      if (isMounted) setLoadError(err instanceof Error ? err.message : 'Failed to load appraisals');
    });
    return () => { isMounted = false; };
  }, [selectedPharmacistId]);

  // Appraisals for this pharmacist (sorted newest first)
  const pharmacistAppraisals = useMemo(() => {
    if (!selectedPharmacistId) return [];
    const list = appraisals.filter(a => a.pharmacist_id === selectedPharmacistId);
    return list.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [selectedPharmacistId, appraisals]);

  // Active appraisal (defaults to most recent)
  const activeAppraisal = useMemo(() => {
    if (selectedAppraisalId) {
      const found = pharmacistAppraisals.find(a => a.id === selectedAppraisalId);
      if (found) return found;
    }
    return pharmacistAppraisals[0] || null;
  }, [selectedAppraisalId, pharmacistAppraisals]);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  const handleDownloadPdf = async (appraisal: Pharmacist_Appraisal) => {
    try {
      setIsGeneratingPdf(true);
      const branch = branches.find(b => b.id === appraisal.branch_id);
      if (!activePharmacist || !branch || !appraisal.supervisor_name_snapshot?.trim()) {
        throw new Error('Verified pharmacist, branch and supervisor details are required for this PDF. Older records need review.');
      }
      const supervisor: User = {
        id: appraisal.supervisor_id,
        name: appraisal.supervisor_name_snapshot,
        cpr: '',
        role: 'supervisor'
      };
      await exportAppraisalReport(appraisal, activePharmacist, branch, supervisor);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to export appraisal PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getMonthName = (monthNum: number) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[monthNum - 1] || `Month ${monthNum}`;
  };

  if (!activePharmacist) {
    return <div className="p-6" role={loadError ? 'alert' : 'status'}>{loadError || 'No pharmacist is available for this account.'}</div>;
  }

  return (
    <div className={`min-h-screen bg-slate-50/60 text-slate-900 p-4 sm:p-6 md:p-8 font-sans ${className}`}>
      {loadError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</p>}
      {!activePharmacist && <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm">No pharmacist is available for this account.</p>}
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
              <ShieldCheck className="w-4 h-4" />
              <span>Pharmacist Personal Portal</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-950 mt-1">
              Performance Appraisals (/pharmacist/performance)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
              6-Pillar Operational &amp; Clinical Evaluation Record (150 Points Scale)
            </p>
          </div>

          {/* Pharmacist Switcher (Section 7.2 DropdownSearch) */}
          <div className="w-full sm:w-80">
            <DropdownSearch<User>
              items={pharmacists}
              getLabel={u => `${u.name}${u.cpr ? ` (CPR: ***${u.cpr.slice(-4)})` : ''}`}
              getValue={u => u.id}
              value={selectedPharmacistId}
              onChange={setSelectedPharmacistId}
              placeholder="Switch Pharmacist..."
              clearable={false}
              emptyStateLabel="No pharmacists found"
            />
          </div>
        </div>

        {/* Content Layout: Left Sidebar Timeline + Right Detailed View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Appraisal History Timeline (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono">
                Evaluation History ({pharmacistAppraisals.length})
              </span>
            </div>

            {pharmacistAppraisals.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500 font-medium shadow-sm">
                No performance records for this pharmacist yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {pharmacistAppraisals.map(appraisal => {
                  const isSelected = activeAppraisal?.id === appraisal.id;

                  return (
                    <div
                      key={appraisal.id}
                      onClick={() => setSelectedAppraisalId(appraisal.id)}
                      className={`
                        p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer select-none
                        ${
                          isSelected
                            ? 'bg-white border-2 border-red-700 shadow-md ring-1 ring-red-600/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-sm'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-950">
                          {getMonthName(appraisal.month)} {appraisal.year}
                        </span>
                        <StatusBadge
                          variant={{
                            type: 'appraisal',
                            passed: appraisal.passed,
                            score: appraisal.total_credit_score
                          }}
                          size="sm"
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 mt-2 font-medium">
                        <span className="font-mono">
                          Score: <strong className="text-slate-950 font-black tabular-nums">{appraisal.total_credit_score}</strong> / 150
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono font-bold">
                          {appraisal.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: 6-Pillar Breakdown & Comments (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {activeAppraisal ? (
              <>
                {/* Appraisal Header Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-red-700 font-bold uppercase bg-red-50 px-2 py-0.5 rounded border border-red-200">
                          {getMonthName(activeAppraisal.month)} {activeAppraisal.year} Appraisal
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          ID: {activeAppraisal.id}
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-950 mt-1">
                        {activePharmacist.name}
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Bahrain CPR: <span className="font-mono text-slate-900 font-bold">{activePharmacist.cpr ? `******${activePharmacist.cpr.slice(-3)}` : 'Not available'}</span> · Evaluated by {activeAppraisal.supervisor_name_snapshot || 'Unverified historical record'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge
                        variant={{
                          type: 'appraisal',
                          passed: activeAppraisal.passed,
                          score: activeAppraisal.total_credit_score
                        }}
                        size="lg"
                      />

                      {/* Download Performance Sheet PDF Button */}
                      <button
                        type="button"
                        disabled={isGeneratingPdf || !activeAppraisal.supervisor_name_snapshot?.trim()}
                        title={!activeAppraisal.supervisor_name_snapshot?.trim() ? 'Verified supervisor name required for older records' : undefined}
                        onClick={() => handleDownloadPdf(activeAppraisal)}
                        className="
                          inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs transition-all
                          bg-red-700 text-white hover:bg-red-800 active:scale-95 shadow-md shadow-red-700/20
                          disabled:opacity-60 disabled:cursor-not-allowed
                        "
                      >
                        {isGeneratingPdf ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Generating PDF...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Performance Sheet (PDF)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Score KPI Matrix */}
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Total Points</span>
                      <span className="text-2xl font-black font-mono text-slate-950 mt-0.5 block tabular-nums">
                        {activeAppraisal.total_credit_score} <span className="text-xs font-normal text-slate-500">/ 150</span>
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Pass Benchmark</span>
                      <span className="text-2xl font-black font-mono text-amber-600 mt-0.5 block tabular-nums">
                        95 pts
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Outcome</span>
                      <span className={`text-2xl font-black font-mono mt-0.5 block ${activeAppraisal.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                        {activeAppraisal.passed ? 'Passed' : 'Not Passed'}
                      </span>
                    </div>
                  </div>

                  {/* Supervisor Comments & Improvement Directives */}
                  {activeAppraisal.comments_and_improvement && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-red-700 font-bold">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Supervisor Improvement Directives &amp; Feedback:</span>
                      </div>
                      <p className="text-slate-700 font-medium leading-relaxed pl-5">
                        {activeAppraisal.comments_and_improvement}
                      </p>
                    </div>
                  )}
                </div>

                {/* 6 Pillars Breakdown (Section 7.3.3) */}
                <div className="space-y-4">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono block">
                    6-Pillar Evaluation Breakdown (30 Criteria):
                  </span>

                  {activeAppraisal.sections.map(section => {
                    const pillarScore = section.criteria.reduce((sum, c) => sum + c.points, 0);
                    const pillarMax = section.criteria.length * 5;

                    return (
                      <div
                        key={section.section_id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 font-mono text-xs font-bold flex items-center justify-center">
                              {section.section_id}
                            </span>
                            <span className="text-sm font-black text-slate-950">
                              {section.title}
                            </span>
                          </div>

                          <span className="font-mono text-xs font-black text-slate-950 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 tabular-nums">
                            {pillarScore} / {pillarMax} pts
                          </span>
                        </div>

                        {/* Criteria Grid */}
                        <div className="space-y-2">
                          {section.criteria.map(criterion => (
                            <div
                              key={criterion.code}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs shadow-sm"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-3">
                                <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded flex-shrink-0">
                                  {criterion.code}
                                </span>
                                <span className="text-slate-800 font-semibold truncate">
                                  {criterion.label}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0 font-mono">
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                                  {criterion.grade}
                                </span>
                                <span className="text-slate-500 text-[11px] font-bold">
                                  {criterion.points} pts
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500 font-medium shadow-sm">
                Please select an appraisal from the left timeline to view its detailed breakdown.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
