import React from 'react';
import { getComplianceColorBand } from '../../services/scoringService';
import { CAPASeverity } from '../../types';
import { AlertCircle, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export type StatusBadgeVariant =
  | { type: 'compliance'; score: number; showScore?: boolean }
  | { type: 'appraisal'; passed: boolean; score?: number }
  | { type: 'capa'; severity: CAPASeverity }
  | { type: 'band'; band: 'Green' | 'Amber' | 'Red'; label?: string };

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Unified StatusBadge Component (Section 7.5 & Section 5.3)
 * Single badge for audit compliance scores, appraisal pass/fail, and CAPA severity.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant,
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-semibold',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-bold'
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  }[size];

  if (variant.type === 'compliance') {
    const bandInfo = getComplianceColorBand(variant.score);
    const Icon =
      bandInfo.band === 'Green'
        ? CheckCircle2
        : bandInfo.band === 'Amber'
        ? AlertTriangle
        : XCircle;

    return (
      <span
        className={`
          inline-flex items-center rounded-full border transition-all select-none
          ${bandInfo.bgColor} ${bandInfo.textColor} ${bandInfo.borderColor} ${sizeClasses} ${className}
        `}
      >
        <Icon className={`${iconSizes} flex-shrink-0`} />
        <span>
          {variant.showScore !== false ? `${variant.score.toFixed(1)}% ` : ''}
          {bandInfo.band}
        </span>
      </span>
    );
  }

  if (variant.type === 'appraisal') {
    if (variant.passed) {
      return (
        <span
          className={`
            inline-flex items-center rounded-md border transition-all select-none font-bold
            bg-emerald-50 text-emerald-700 border-emerald-200 ${sizeClasses} ${className}
          `}
        >
          <CheckCircle2 className={`${iconSizes} flex-shrink-0 text-emerald-600`} />
          <span>
            Passed
            {variant.score !== undefined ? ` (${variant.score} pts)` : ''}
          </span>
        </span>
      );
    }

    return (
      <span
        className={`
          inline-flex items-center rounded-md border transition-all select-none font-bold
          bg-red-50 text-red-700 border-red-200 ${sizeClasses} ${className}
        `}
      >
        <XCircle className={`${iconSizes} flex-shrink-0 text-red-600`} />
        <span>
          Did Not Pass
          {variant.score !== undefined ? ` (${variant.score} pts)` : ''}
        </span>
      </span>
    );
  }

  if (variant.type === 'capa') {
    const severityStyles = {
      Critical: 'bg-red-50 text-red-700 border-red-200 font-black',
      Major: 'bg-amber-50 text-amber-700 border-amber-200 font-bold',
      Minor: 'bg-slate-100 text-slate-700 border-slate-200 font-bold'
    }[variant.severity];

    const Icon =
      variant.severity === 'Critical'
        ? AlertCircle
        : variant.severity === 'Major'
        ? AlertTriangle
        : AlertCircle;

    return (
      <span
        className={`
          inline-flex items-center rounded-md border uppercase tracking-wider transition-all select-none
          ${severityStyles} ${sizeClasses} ${className}
        `}
      >
        <Icon className={`${iconSizes} flex-shrink-0`} />
        <span>{variant.severity} CAPA</span>
      </span>
    );
  }

  // Band variant
  const bandColors = {
    Green: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold',
    Amber: 'bg-amber-50 text-amber-700 border-amber-200 font-bold',
    Red: 'bg-red-50 text-red-700 border-red-200 font-bold'
  }[variant.band];

  return (
    <span
      className={`
        inline-flex items-center rounded-md border transition-all select-none
        ${bandColors} ${sizeClasses} ${className}
      `}
    >
      <span>{variant.label || variant.band}</span>
    </span>
  );
};
