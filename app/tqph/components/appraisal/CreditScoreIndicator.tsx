import React from 'react';
import { AppraisalScoreResult } from '../../services/scoringService';
import { Award, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';

interface CreditScoreIndicatorProps {
  scoreResult: AppraisalScoreResult;
  className?: string;
}

export const CreditScoreIndicator: React.FC<CreditScoreIndicatorProps> = ({
  scoreResult,
  className = ''
}) => {
  const { totalCreditScore, maxPossibleScore, passed, criteriaCount, sectionScores } = scoreResult;
  const progressPercent = Math.min(100, Math.round((totalCreditScore / maxPossibleScore) * 100));
  const passThresholdPercent = (95 / maxPossibleScore) * 100; // 63.33%

  return (
    <div
      className={`
        bg-white border border-slate-200 rounded-xl p-5
        shadow-sm transition-all ${className}
      `}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Total Credit Score */}
        <div className="flex items-center gap-3.5">
          <div
            className={`
              p-3 rounded-xl border flex items-center justify-center transition-colors
              ${
                passed
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }
            `}
          >
            <Award className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Staff Appraisal Running Score
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-400">
                ({criteriaCount} criteria rated)
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-950 tabular-nums">
                {totalCreditScore}
              </span>
              <span className="text-sm font-bold text-slate-400">
                / {maxPossibleScore} pts
              </span>
            </div>
          </div>
        </div>

        {/* Right: Pass / Fail Threshold Badge */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Passing Threshold</span>
            <span className="text-xs font-mono font-bold text-slate-700 block">
              95 points minimum
            </span>
          </div>

          <StatusBadge
            variant={{ type: 'appraisal', passed, score: totalCreditScore }}
            size="lg"
          />
        </div>
      </div>

      {/* Progress Bar with 95-point Threshold Line */}
      <div className="mt-4 space-y-1.5">
        <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          {/* Active Fill */}
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              passed
                ? 'bg-emerald-600'
                : 'bg-red-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          />

          {/* 95-point Target Marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10"
            style={{ left: `${passThresholdPercent}%` }}
            title="Passing Threshold: 95 points"
          />
        </div>

        <div className="flex justify-between text-[11px] text-slate-400 font-mono font-bold pt-0.5">
          <span>0 pts</span>
          <span className="text-slate-800 font-black flex items-center gap-1">
            ▲ Pass: 95 pts
          </span>
          <span>Max: 150 pts</span>
        </div>
      </div>

      {/* 6-Pillar Mini Scores */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
        {(['I', 'II', 'III', 'IV', 'V', 'VI'] as const).map(secKey => {
          const sec = sectionScores[secKey];
          if (!sec) return null;
          return (
            <div
              key={sec.sectionId}
              className="bg-slate-50 border border-slate-200 rounded-lg p-2"
            >
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
                Pillar {sec.sectionId}
              </span>
              <span className="text-xs font-black font-mono text-slate-950 mt-0.5 block tabular-nums">
                {sec.points} <span className="text-slate-400 font-normal">/ {sec.maxPoints}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
