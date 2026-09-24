import React, { useState, useMemo, useEffect } from 'react';
import {
  Trophy,
  Medal,
  Award,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  Building2,
  UserCheck,
  Calendar,
  ArrowUpRight,
  TrendingUp,
  BarChart3,
  Users,
  Search,
  ExternalLink,
  ChevronRight,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import {
  Area,
  Branch,
  CAPA_Task,
  NHRA_Audit,
  Pharmacist_Appraisal,
  User
} from '../../types';
import {
  MOCK_AREAS,
  MOCK_BRANCHES,
  MOCK_USERS
} from '../../data';
import { mockAuditStore } from '../../services/mockAuditStore';
import { supabaseTqphService } from '../../services/supabaseTqphService';
import { SUPERVISOR_MONTHLY_VISIT_TARGET } from '../../config/tqphConfig';
import { getComplianceColorBand } from '../../services/scoringService';
import { DropdownSearch } from '../ui/DropdownSearch';
import { StatusBadge } from '../ui/StatusBadge';
import { KPIStat } from '../ui/KPIStat';

interface PeriodOption {
  value: string;
  label: string;
  year?: number;
  month?: number;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { value: '2026-09', label: 'September 2026 (Active Cycle)', year: 2026, month: 9 },
  { value: '2026-08', label: 'August 2026 (Historical)', year: 2026, month: 8 },
  { value: 'all', label: 'All Recorded Cycles' }
];

interface AreaOption {
  value: string;
  label: string;
}

const AREA_OPTIONS: AreaOption[] = [
  { value: 'all', label: 'All Areas (National Network)' },
  { value: 'area-1', label: 'Area 1 (Capital & Northern)' },
  { value: 'area-2', label: 'Area 2 (Muharraq & Southern)' }
];

interface AdminTQPHDashboardViewProps {
  onNavigateToBranch?: (branchId: string) => void;
  onNavigateToPharmacist?: (pharmacistId: string) => void;
}

/**
 * Executive Command & Ranking Board (Section 7.3.4)
 * URL: /admin/tqph-dashboard
 *
 * Provides executive quality intelligence across the entire Tabarak 20-branch network:
 * - KPI Ribbon (Overall Compliance, Appraisal Pass %, Pending CAPAs, Area 1 vs 2)
 * - Monthly Ranking Leaderboard (Branches ranked 1–20 by compliance_score)
 * - Pharmacists Wall of Fame (Top performers ranked by total_credit_score)
 * - Supervisor Completion Tracker (Visits completed vs target of 12)
 * - Strict Invariant: DropdownSearch exclusively for month/year and area selection.
 */
export const AdminTQPHDashboardView: React.FC<AdminTQPHDashboardViewProps> = ({
  onNavigateToBranch,
  onNavigateToPharmacist
}) => {
  // State for DropdownSearch selections (no native <select>)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-09');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [branchSearchTerm, setBranchSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'branches' | 'pharmacists' | 'supervisors'>('all');

  // Load live data from Supabase with instant store fallback
  const [audits, setAudits] = useState<NHRA_Audit[]>(() => mockAuditStore.getAudits());
  const [appraisals, setAppraisals] = useState<Pharmacist_Appraisal[]>(() => mockAuditStore.getAppraisals());
  const [capas, setCapas] = useState<CAPA_Task[]>(() => mockAuditStore.getCapaTasks());
  const [branches, setBranches] = useState<Branch[]>(() => MOCK_BRANCHES);
  const [areas, setAreas] = useState<Area[]>(() => MOCK_AREAS);
  const [users, setUsers] = useState<User[]>(() => MOCK_USERS);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      supabaseTqphService.getAudits(),
      supabaseTqphService.getAppraisals(),
      supabaseTqphService.getCapaTasks(),
      supabaseTqphService.getBranches(),
      supabaseTqphService.getAreas(),
      supabaseTqphService.getPharmacists()
    ]).then(([liveAudits, liveAppraisals, liveCapas, liveBranches, liveAreas, livePharmacists]) => {
      if (!isMounted) return;
      if (liveAudits && liveAudits.length > 0) setAudits(liveAudits);
      if (liveAppraisals && liveAppraisals.length > 0) setAppraisals(liveAppraisals);
      if (liveCapas && liveCapas.length > 0) setCapas(liveCapas);
      if (liveBranches && liveBranches.length > 0) setBranches(liveBranches);
      if (liveAreas && liveAreas.length > 0) setAreas(liveAreas);
      if (livePharmacists && livePharmacists.length > 0) {
        setUsers(prev => [
          ...prev.filter(u => u.role !== 'pharmacist'),
          ...livePharmacists
        ]);
      }
    }).catch(err => {
      console.warn('TQPH live fetch fallback:', err);
    });
    return () => { isMounted = false; };
  }, []);

  // ── 1. Period & Area Filtering ─────────────────────────────
  const currentPeriod = PERIOD_OPTIONS.find(p => p.value === selectedPeriod) || PERIOD_OPTIONS[0];

  const filteredAudits = useMemo(() => {
    return audits.filter(audit => {
      // Must be locked/submitted for executive dashboard
      if (audit.status !== 'locked_submitted') return false;

      // Filter by period
      if (currentPeriod.year && currentPeriod.month) {
        const auditDate = new Date(audit.date);
        const matchYear = auditDate.getUTCFullYear() === currentPeriod.year;
        const matchMonth = auditDate.getUTCMonth() + 1 === currentPeriod.month;
        if (!matchYear || !matchMonth) return false;
      }

      // Filter by Area if specified
      if (selectedArea !== 'all') {
        const branch = branches.find(b => b.id === audit.branch_id);
        if (!branch || branch.area_id !== selectedArea) return false;
      }

      return true;
    });
  }, [audits, currentPeriod, selectedArea, branches]);

  const filteredAppraisals = useMemo(() => {
    return appraisals.filter(app => {
      if (app.status !== 'locked_submitted') return false;

      if (currentPeriod.year && currentPeriod.month) {
        if (app.year !== currentPeriod.year || app.month !== currentPeriod.month) return false;
      }

      if (selectedArea !== 'all') {
        const branch = branches.find(b => b.id === app.branch_id);
        if (!branch || branch.area_id !== selectedArea) return false;
      }

      return true;
    });
  }, [appraisals, currentPeriod, selectedArea, branches]);

  const openCapas = useMemo(() => {
    return capas.filter(c => {
      if (c.status === 'resolved') return false;

      if (selectedArea !== 'all') {
        const audit = audits.find(a => a.id === c.audit_id);
        if (audit) {
          const branch = branches.find(b => b.id === audit.branch_id);
          if (branch && branch.area_id !== selectedArea) return false;
        }
      }
      return true;
    });
  }, [capas, audits, selectedArea, branches]);

  // ── 2. KPI Ribbon Computations ─────────────────────────────

  // KPI 1: Overall Network Compliance %
  const networkAvgCompliance = useMemo(() => {
    if (filteredAudits.length === 0) return 0;
    const sum = filteredAudits.reduce((acc, a) => acc + a.compliance_score, 0);
    return Number((sum / filteredAudits.length).toFixed(1));
  }, [filteredAudits]);

  // KPI 2: Passed Appraisals %
  const appraisalPassRate = useMemo(() => {
    if (filteredAppraisals.length === 0) return { pct: 0, passed: 0, total: 0 };
    const passedCount = filteredAppraisals.filter(a => a.passed).length;
    const pct = Number(((passedCount / filteredAppraisals.length) * 100).toFixed(1));
    return { pct, passed: passedCount, total: filteredAppraisals.length };
  }, [filteredAppraisals]);

  // KPI 3: Pending CAPAs Breakdown
  const capaBreakdown = useMemo(() => {
    const critical = openCapas.filter(c => c.severity === 'Critical').length;
    const major = openCapas.filter(c => c.severity === 'Major').length;
    const minor = openCapas.filter(c => c.severity === 'Minor').length;
    return { total: openCapas.length, critical, major, minor };
  }, [openCapas]);

  // KPI 4: Area 1 vs Area 2 Comparative Index
  const areaComparison = useMemo(() => {
    const area1Id = areas[0]?.id;
    const area2Id = areas[1]?.id;

    // Area 1 audits in current period
    const area1Audits = audits.filter(a => {
      if (a.status !== 'locked_submitted') return false;
      if (currentPeriod.year && currentPeriod.month) {
        const d = new Date(a.date);
        if (d.getUTCFullYear() !== currentPeriod.year || d.getUTCMonth() + 1 !== currentPeriod.month) return false;
      }
      const b = branches.find(branch => branch.id === a.branch_id);
      return b?.area_id === area1Id;
    });

    // Area 2 audits in current period
    const area2Audits = audits.filter(a => {
      if (a.status !== 'locked_submitted') return false;
      if (currentPeriod.year && currentPeriod.month) {
        const d = new Date(a.date);
        if (d.getUTCFullYear() !== currentPeriod.year || d.getUTCMonth() + 1 !== currentPeriod.month) return false;
      }
      const b = branches.find(branch => branch.id === a.branch_id);
      return b?.area_id === area2Id;
    });

    const avgArea1 = area1Audits.length > 0
      ? Number((area1Audits.reduce((acc, a) => acc + a.compliance_score, 0) / area1Audits.length).toFixed(1))
      : 0;

    const avgArea2 = area2Audits.length > 0
      ? Number((area2Audits.reduce((acc, a) => acc + a.compliance_score, 0) / area2Audits.length).toFixed(1))
      : 0;

    return {
      area1: { avg: avgArea1, count: area1Audits.length, name: areas[0]?.name || 'Area 1 (Capital & Northern)' },
      area2: { avg: avgArea2, count: area2Audits.length, name: areas[1]?.name || 'Area 2 (Muharraq & Southern)' }
    };
  }, [audits, currentPeriod, branches, areas]);

  // ── 3. Branch Leaderboard Ranking (1 to 20) ────────────────
  const rankedBranches = useMemo(() => {
    // Map all branches or filtered branches with their latest audit in period
    const list = branches.filter(branch => {
      if (selectedArea !== 'all' && branch.area_id !== selectedArea) return false;
      if (branchSearchTerm.trim()) {
        const term = branchSearchTerm.toLowerCase();
        const matchesName = branch.name.toLowerCase().includes(term);
        const matchesManager = branch.manager_name.toLowerCase().includes(term);
        const matchesLicense = branch.license_no.toLowerCase().includes(term);
        if (!matchesName && !matchesManager && !matchesLicense) return false;
      }
      return true;
    }).map(branch => {
      // Find audit for this branch in selected period (or latest)
      const branchAudit = filteredAudits.find(a => a.branch_id === branch.id);
      const openCapaCount = openCapas.filter(c => {
        const audit = audits.find(a => a.id === c.audit_id);
        return audit?.branch_id === branch.id;
      }).length;

      const area = areas.find(a => a.id === branch.area_id);
      const score = branchAudit ? branchAudit.compliance_score : 0;

      return {
        branch,
        area,
        audit: branchAudit,
        score,
        hasAudit: Boolean(branchAudit),
        openCapaCount
      };
    });

    // Rank strictly by compliance_score descending
    list.sort((a, b) => b.score - a.score);
    return list;
  }, [filteredAudits, selectedArea, branchSearchTerm, openCapas, audits, branches, areas]);

  // ── 4. Pharmacists Wall of Fame (Ranked by credit score) ───
  const wallOfFame = useMemo(() => {
    const list = filteredAppraisals.map(app => {
      const pharmacist = users.find(u => u.id === app.pharmacist_id);
      const branch = branches.find(b => b.id === app.branch_id);
      const area = branch ? areas.find(a => a.id === branch.area_id) : undefined;
      const supervisor = users.find(u => u.id === app.supervisor_id);

      return {
        appraisal: app,
        pharmacist,
        branch,
        area,
        supervisor,
        score: app.total_credit_score
      };
    });

    // Sort strictly by total_credit_score descending
    list.sort((a, b) => b.score - a.score);
    return list;
  }, [filteredAppraisals, branches, users, areas]);

  // ── 5. Supervisor Completion Tracker (Visits vs Target 12) ─
  const supervisorTrackers = useMemo(() => {
    const supervisors = users.filter(u => u.role === 'supervisor');

    return supervisors.map(sup => {
      const area = areas.find(a => a.supervisor_id === sup.id);

      // Count of locked visits completed this month per supervisor
      const completedVisits = audits.filter(a => {
        if (a.status !== 'locked_submitted') return false;
        if (a.submitted_by !== sup.id && a.supervisor_id !== sup.id) return false;

        if (currentPeriod.year && currentPeriod.month) {
          const d = new Date(a.date);
          if (d.getUTCFullYear() !== currentPeriod.year || d.getUTCMonth() + 1 !== currentPeriod.month) return false;
        }
        return true;
      });

      const count = completedVisits.length;
      const target = SUPERVISOR_MONTHLY_VISIT_TARGET;
      const pct = Math.min(100, Math.round((count / target) * 100));

      return {
        supervisor: sup,
        area,
        completedCount: count,
        target,
        pct,
        recentAudits: completedVisits.slice(0, 3)
      };
    });
  }, [audits, currentPeriod, users, areas]);

  // Helper to mask sensitive Bahrain CPR (Section 9 PII protection)
  const maskCPR = (cpr: string) => {
    if (!cpr || cpr.length < 4) return '*********';
    return `******${cpr.slice(-3)}`;
  };

  const complianceBand = getComplianceColorBand(networkAvgCompliance);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* ── Dashboard Header ───────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700 shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
                TQPH Executive Command Board
              </span>
              <h1 className="text-2xl font-black text-slate-950 tracking-tight">
                Tabarak Quality &amp; Performance Hub
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl font-medium">
            National quality audit rankings, pharmacist appraisal indices, and supervisor SLA tracking across all 20 branches.
          </p>
        </div>

        {/* Period & Area Filters (Strictly DropdownSearch, No native <select>) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Period Picker */}
          <div className="w-full sm:w-64">
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1">
              <Calendar className="w-3.5 h-3.5 text-red-700" />
              Evaluation Cycle:
            </label>
            <DropdownSearch<PeriodOption>
              items={PERIOD_OPTIONS}
              getLabel={p => p.label}
              getValue={p => p.value}
              value={selectedPeriod}
              onChange={val => setSelectedPeriod(val || '2026-09')}
              placeholder="Select cycle..."
            />
          </div>

          {/* Area Filter */}
          <div className="w-full sm:w-60">
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mb-1">
              <Building2 className="w-3.5 h-3.5 text-red-700" />
              Geographic Scope:
            </label>
            <DropdownSearch<AreaOption>
              items={AREA_OPTIONS}
              getLabel={a => a.label}
              getValue={a => a.value}
              value={selectedArea}
              onChange={val => setSelectedArea(val || 'all')}
              placeholder="All Areas"
            />
          </div>
        </div>
      </div>

      {/* ── KPI Ribbon (Section 7.3.4) ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* KPI 1: Overall Network Compliance */}
        <KPIStat
          title="Network Compliance Score"
          value={`${networkAvgCompliance}%`}
          subtitle={`Averaged across ${filteredAudits.length} locked NHRA audits in period`}
          icon={<ShieldCheck className="w-5 h-5" />}
          variant={
            complianceBand.band === 'Green'
              ? 'emerald'
              : complianceBand.band === 'Amber'
              ? 'amber'
              : 'rose'
          }
          trend={{
            value: complianceBand.band,
            label: complianceBand.band === 'Green' ? 'Target Met (≥95%)' : 'Attention Needed',
            positive: complianceBand.band === 'Green'
          }}
          badge="Section 5.1"
        />

        {/* KPI 2: Passed Appraisals % */}
        <KPIStat
          title="Appraisal Pass Rate"
          value={`${appraisalPassRate.pct}%`}
          subtitle={`${appraisalPassRate.passed} of ${appraisalPassRate.total} evaluated staff passed (≥95 pts)`}
          icon={<Award className="w-5 h-5" />}
          variant={appraisalPassRate.pct >= 85 ? 'emerald' : 'amber'}
          progress={{
            current: appraisalPassRate.passed,
            total: appraisalPassRate.total || 1,
            unit: 'passed'
          }}
          badge="Section 5.2"
        />

        {/* KPI 3: Pending CAPAs */}
        <KPIStat
          title="Open CAPA Tasks"
          value={capaBreakdown.total}
          subtitle={`${capaBreakdown.critical} Critical · ${capaBreakdown.major} Major · ${capaBreakdown.minor} Minor`}
          icon={<AlertCircle className="w-5 h-5" />}
          variant={capaBreakdown.critical > 0 ? 'rose' : capaBreakdown.total > 0 ? 'amber' : 'emerald'}
          trend={{
            value: capaBreakdown.critical > 0 ? `${capaBreakdown.critical} Critical` : '0 Critical',
            label: 'Requires Action',
            positive: capaBreakdown.critical === 0
          }}
          badge="48h SLA"
        />

        {/* KPI 4: Area 1 vs Area 2 Comparative Index */}
        <div className="relative overflow-hidden rounded-xl p-5 bg-white border border-slate-200 shadow-sm transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 mb-3">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Area Comparative Index
              </span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border bg-slate-50 text-slate-700 border-slate-200">
                <TrendingUp className="w-4 h-4 text-red-700" />
              </div>
            </div>

            {/* Side-by-side area scores */}
            <div className="space-y-3 mt-1">
              {/* Area 1 */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                  <span className="truncate">Area 1 (Capital):</span>
                  <span className="text-slate-950 font-black tabular-nums">{areaComparison.area1.avg}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-900 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, areaComparison.area1.avg)}%` }}
                  />
                </div>
              </div>

              {/* Area 2 */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                  <span className="truncate">Area 2 (Muharraq/South):</span>
                  <span className="text-red-700 font-black tabular-nums">{areaComparison.area2.avg}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-red-700 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, areaComparison.area2.avg)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] font-semibold text-slate-500 mt-4 pt-2.5 border-t border-slate-100">
            {areaComparison.area2.avg >= areaComparison.area1.avg
              ? `Area 2 leads by +${(areaComparison.area2.avg - areaComparison.area1.avg).toFixed(1)}%`
              : `Area 1 leads by +${(areaComparison.area1.avg - areaComparison.area2.avg).toFixed(1)}%`}
          </p>
        </div>
      </div>

      {/* ── Section Navigation Tabs ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="inline-flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-white text-slate-950 font-black shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-red-700" />
            Unified Dashboard
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'branches'
                ? 'bg-white text-slate-950 font-black shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-red-700" />
            Branches Ranking ({rankedBranches.length})
          </button>
          <button
            onClick={() => setActiveTab('pharmacists')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'pharmacists'
                ? 'bg-white text-slate-950 font-black shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-red-700" />
            Wall of Fame ({wallOfFame.length})
          </button>
          <button
            onClick={() => setActiveTab('supervisors')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'supervisors'
                ? 'bg-white text-slate-950 font-black shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-red-700" />
            Supervisor Quotas (12 Visits)
          </button>
        </div>

        {/* Quick Branch search filter */}
        {(activeTab === 'all' || activeTab === 'branches') && (
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search branch or manager..."
              value={branchSearchTerm}
              onChange={e => setBranchSearchTerm(e.target.value)}
              className="w-full h-9 bg-white border border-slate-200 rounded-lg pl-8 pr-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 shadow-sm"
            />
          </div>
        )}
      </div>

      {/* ── 1. Branches Ranking Leaderboard (Section 7.3.4) ────── */}
      {(activeTab === 'all' || activeTab === 'branches') && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-red-700" />
                <h2 className="text-lg font-black text-slate-950">
                  National Branches Leaderboard (Ranked 1–20)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Ranked strictly by locked NHRA compliance score. Color bands: Green (≥95%), Amber (80–94%), Red (&lt;80%).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                {rankedBranches.filter(b => b.score >= 95).length} Green
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                {rankedBranches.filter(b => b.score >= 80 && b.score < 95).length} Amber
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200">
                {rankedBranches.filter(b => b.score < 80).length} Red
              </span>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                  <th className="py-3.5 px-4">Branch &amp; License</th>
                  <th className="py-3.5 px-4">Area</th>
                  <th className="py-3.5 px-4">Branch Manager</th>
                  <th className="py-3.5 px-4 text-center">Compliance Score</th>
                  <th className="py-3.5 px-4 text-center">Pending CAPAs</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rankedBranches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                      No branches found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  rankedBranches.map((item, index) => {
                    const rank = index + 1;
                    const isTop1 = rank === 1;
                    const isTop2 = rank === 2;
                    const isTop3 = rank === 3;

                    return (
                      <tr
                        key={item.branch.id}
                        className={`
                          hover:bg-slate-50/80 transition-colors
                          ${isTop1 ? 'bg-amber-50/20' : ''}
                        `}
                      >
                        {/* Rank Badge */}
                        <td className="py-3.5 px-4 text-center">
                          {isTop1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-900 font-black border border-amber-300 text-xs shadow-sm">
                              🥇 1
                            </span>
                          ) : isTop2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-800 font-black border border-slate-300 text-xs">
                              🥈 2
                            </span>
                          ) : isTop3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 text-amber-800 font-black border border-amber-200 text-xs">
                              🥉 3
                            </span>
                          ) : (
                            <span className="inline-block text-slate-400 font-bold text-xs">
                              #{rank}
                            </span>
                          )}
                        </td>

                        {/* Branch Details */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            {item.branch.name}
                            {isTop1 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-black border border-red-200">
                                LEADER
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {item.branch.license_no}
                          </div>
                        </td>

                        {/* Area */}
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border bg-slate-50 text-slate-700 border-slate-200">
                            {item.area?.name.split(' ')[0]} {item.area?.name.split(' ')[1]}
                          </span>
                        </td>

                        {/* Manager */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-700">
                            {item.branch.manager_name}
                          </div>
                        </td>

                        {/* Compliance Score with Section 5.3 StatusBadge */}
                        <td className="py-3.5 px-4 text-center">
                          {item.hasAudit ? (
                            <StatusBadge
                              variant={{ type: 'compliance', score: item.score }}
                              size="md"
                            />
                          ) : (
                            <span className="text-slate-400 text-xs italic">
                              Pending Audit
                            </span>
                          )}
                        </td>

                        {/* Open CAPA count */}
                        <td className="py-3.5 px-4 text-center">
                          {item.openCapaCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                              <AlertTriangle className="w-3 h-3" />
                              {item.openCapaCount} Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              0 Open
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => onNavigateToBranch && onNavigateToBranch(item.branch.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all text-xs font-bold border border-slate-200 shadow-sm"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 2. Two-Column Row: Wall of Fame & Supervisor Quotas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Pharmacists Wall of Fame (Section 7.3.4) */}
        {(activeTab === 'all' || activeTab === 'pharmacists') && (
          <div
            className={`
              bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4
              ${activeTab === 'pharmacists' ? 'lg:col-span-12' : 'lg:col-span-7'}
            `}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-600" />
                <div>
                  <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                    Pharmacists Wall of Fame
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Staff ranked by total appraisal credit score (out of 150 points). Pass threshold: ≥95 pts.
                  </p>
                </div>
              </div>
            </div>

            {/* Wall of Fame List */}
            <div className="space-y-3">
              {wallOfFame.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs font-medium">
                  No pharmacist appraisals on file for this period.
                </div>
              ) : (
                wallOfFame.map((item, idx) => {
                  const rank = idx + 1;
                  const isTop1 = rank === 1;
                  const isTop2 = rank === 2;
                  const isTop3 = rank === 3;
                  const pctOfMax = Math.round((item.score / 150) * 100);

                  return (
                    <div
                      key={item.appraisal.id}
                      className={`
                        p-4 rounded-xl border transition-all
                        ${
                          isTop1
                            ? 'bg-amber-50/30 border-amber-200 shadow-sm'
                            : isTop2
                            ? 'bg-slate-50/60 border-slate-200 shadow-sm'
                            : isTop3
                            ? 'bg-white border-slate-200 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Rank + Pharmacist info */}
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`
                              w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0
                              ${
                                isTop1
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm'
                                  : isTop2
                                  ? 'bg-slate-100 text-slate-800 border border-slate-300'
                                  : isTop3
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }
                            `}
                          >
                            #{rank}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm truncate">
                                {item.pharmacist?.name || 'Licensed Pharmacist'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                CPR: {maskCPR(item.pharmacist?.cpr || '')}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                              <span className="truncate">{item.branch?.name}</span>
                              <span>•</span>
                              <span>{item.area?.name.split(' ')[0]} {item.area?.name.split(' ')[1]}</span>
                            </div>
                          </div>
                        </div>

                        {/* Score & Pass Badge */}
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-black text-slate-950 flex items-baseline justify-end gap-1 tabular-nums">
                            <span className={item.appraisal.passed ? 'text-slate-950' : 'text-red-700'}>
                              {item.score}
                            </span>
                            <span className="text-xs text-slate-400 font-normal">/ 150 pts</span>
                          </div>
                          <div className="mt-0.5">
                            <StatusBadge
                              variant={{ type: 'appraisal', passed: item.appraisal.passed }}
                              size="sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar of 150 points */}
                      <div className="mt-3">
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.score >= 135
                                ? 'bg-amber-500'
                                : item.score >= 95
                                ? 'bg-emerald-600'
                                : 'bg-red-700'
                            }`}
                            style={{ width: `${pctOfMax}%` }}
                          />
                        </div>
                      </div>

                      {/* Supervisor comments highlight */}
                      {item.appraisal.comments_and_improvement && (
                        <p className="text-[11px] text-slate-600 mt-2.5 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200 line-clamp-2">
                          "{item.appraisal.comments_and_improvement}"
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Supervisor Completion Tracker (Section 7.3.4) */}
        {(activeTab === 'all' || activeTab === 'supervisors') && (
          <div
            className={`
              bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5
              ${activeTab === 'supervisors' ? 'lg:col-span-12' : 'lg:col-span-5'}
            `}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-red-700" />
                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    Supervisor Quota Tracker
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Field audit quota target: 12 locked visits / month.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                Target: {SUPERVISOR_MONTHLY_VISIT_TARGET} Visits
              </span>
            </div>

            <div className="space-y-4">
              {supervisorTrackers.map(tracker => {
                const isOnTrack = tracker.completedCount >= tracker.target * 0.75;
                const isCompleted = tracker.completedCount >= tracker.target;

                return (
                  <div
                    key={tracker.supervisor.id}
                    className="p-4 rounded-xl bg-slate-50/60 border border-slate-200 space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {tracker.supervisor.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {tracker.area?.name || 'Area Supervisor'}
                        </p>
                      </div>

                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isOnTrack
                            ? 'bg-slate-100 text-slate-800 border-slate-300'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {isCompleted ? 'Quota Met' : isOnTrack ? 'On Track' : 'In Progress'}
                      </span>
                    </div>

                    {/* Progress details */}
                    <div>
                      <div className="flex justify-between text-xs mb-1.5 font-bold">
                        <span className="text-slate-700">
                          {tracker.completedCount} of {tracker.target} Visits Completed
                        </span>
                        <span className="text-slate-950 font-black tabular-nums">{tracker.pct}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCompleted ? 'bg-emerald-600' : 'bg-red-700'
                          }`}
                          style={{ width: `${tracker.pct}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-1.5">
                        {tracker.target - tracker.completedCount > 0
                          ? `${tracker.target - tracker.completedCount} more visits needed to fulfill monthly quota`
                          : 'Monthly target successfully fulfilled!'}
                      </p>
                    </div>

                    {/* Recent Audits by this supervisor */}
                    {tracker.recentAudits.length > 0 && (
                      <div className="pt-2 border-t border-slate-200">
                        <div className="text-[11px] font-bold text-slate-500 mb-1.5">
                          Recent Completed Audits:
                        </div>
                        <div className="space-y-1">
                          {tracker.recentAudits.map(aud => {
                            const br = MOCK_BRANCHES.find(b => b.id === aud.branch_id);
                            return (
                              <div
                                key={aud.id}
                                className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-800 font-medium shadow-sm"
                              >
                                <span className="truncate">{br?.name}</span>
                                <span className="text-red-700 font-black tabular-nums ml-2">
                                  {aud.compliance_score.toFixed(1)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
