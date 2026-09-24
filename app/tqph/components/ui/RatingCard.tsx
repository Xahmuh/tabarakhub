import React from 'react';
import { ComplianceStatus, LetterGrade } from '../../types';
import { Check, AlertTriangle, X, Minus } from 'lucide-react';

export type RatingCardProps =
  | {
      variant: 'compliance';
      value: ComplianceStatus;
      onChange: (value: ComplianceStatus) => void;
      disabled?: boolean;
      size?: 'sm' | 'md';
      className?: string;
    }
  | {
      variant: 'grade';
      value: LetterGrade;
      onChange: (value: LetterGrade) => void;
      disabled?: boolean;
      size?: 'sm' | 'md';
      className?: string;
    };

const COMPLIANCE_OPTIONS: {
  status: ComplianceStatus;
  label: string;
  shortLabel: string;
  scoreLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClasses: string;
  borderClasses: string;
}[] = [
  {
    status: 'fully_compliant',
    label: 'Fully Compliant',
    shortLabel: 'Full',
    scoreLabel: '100%',
    icon: Check,
    activeClasses: 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-bold',
    borderClasses: 'hover:border-emerald-300 hover:bg-emerald-50/50'
  },
  {
    status: 'partially_compliant',
    label: 'Partially Compliant',
    shortLabel: 'Partial',
    scoreLabel: '50%',
    icon: AlertTriangle,
    activeClasses: 'bg-amber-600 text-white border-amber-600 shadow-sm font-bold',
    borderClasses: 'hover:border-amber-300 hover:bg-amber-50/50'
  },
  {
    status: 'non_compliant',
    label: 'Non-Compliant',
    shortLabel: 'Non',
    scoreLabel: '0%',
    icon: X,
    activeClasses: 'bg-red-700 text-white border-red-700 shadow-sm font-bold',
    borderClasses: 'hover:border-red-300 hover:bg-red-50/50'
  },
  {
    status: 'not_applicable',
    label: 'Not Applicable',
    shortLabel: 'N/A',
    scoreLabel: 'Excl.',
    icon: Minus,
    activeClasses: 'bg-slate-700 text-white border-slate-700 shadow-sm font-bold',
    borderClasses: 'hover:border-slate-300 hover:bg-slate-100'
  }
];

const GRADE_OPTIONS: {
  grade: LetterGrade;
  points: number;
  label: string;
  activeClasses: string;
  borderClasses: string;
}[] = [
  {
    grade: 'A*',
    points: 5,
    label: 'A* (5 pts)',
    activeClasses: 'bg-emerald-700 text-white border-emerald-700 font-black shadow-sm',
    borderClasses: 'hover:border-emerald-300 hover:bg-emerald-50'
  },
  {
    grade: 'A',
    points: 4,
    label: 'A (4 pts)',
    activeClasses: 'bg-emerald-600 text-white border-emerald-600 font-black shadow-sm',
    borderClasses: 'hover:border-emerald-300 hover:bg-emerald-50'
  },
  {
    grade: 'B',
    points: 3,
    label: 'B (3 pts)',
    activeClasses: 'bg-slate-800 text-white border-slate-800 font-black shadow-sm',
    borderClasses: 'hover:border-slate-300 hover:bg-slate-100'
  },
  {
    grade: 'C',
    points: 2,
    label: 'C (2 pts)',
    activeClasses: 'bg-amber-600 text-white border-amber-600 font-black shadow-sm',
    borderClasses: 'hover:border-amber-300 hover:bg-amber-50'
  },
  {
    grade: 'F',
    points: 1,
    label: 'F (1 pt)',
    activeClasses: 'bg-red-700 text-white border-red-700 font-black shadow-sm',
    borderClasses: 'hover:border-red-300 hover:bg-red-50'
  }
];

/**
 * Unified RatingCard Component (Section 7.5)
 * Handles both NHRA 3-state toggles (compliance) and 5-point appraisal grades (grade).
 */
export const RatingCard: React.FC<RatingCardProps> = (props) => {
  const { disabled = false, size = 'md', className = '' } = props;

  if (props.variant === 'compliance') {
    const { value, onChange } = props;

    return (
      <div
        className={`grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100/90 border border-slate-200 rounded-xl ${className}`}
        role="radiogroup"
        aria-label="Compliance Status"
      >
        {COMPLIANCE_OPTIONS.map(opt => {
          const isSelected = value === opt.status;
          const Icon = opt.icon;

          return (
            <button
              key={opt.status}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(opt.status)}
              className={`
                flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all duration-150 select-none
                ${size === 'sm' ? 'py-1 px-2 text-[11px]' : ''}
                ${
                  isSelected
                    ? opt.activeClasses
                    : `bg-white text-slate-700 border-slate-200 shadow-xs ${opt.borderClasses}`
                }
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}
              `}
            >
              <div className="flex items-center gap-1.5 truncate">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{opt.label}</span>
              </div>
              <span className={`text-[10px] font-mono flex-shrink-0 ml-1 ${isSelected ? 'text-white/90' : 'text-slate-400'}`}>
                {opt.scoreLabel}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // Variant: grade
  const { value, onChange } = props;

  return (
    <div
      className={`inline-flex items-center gap-1.5 p-1 bg-slate-100/90 border border-slate-200 rounded-xl ${className}`}
      role="radiogroup"
      aria-label="Grade Rating"
    >
      {GRADE_OPTIONS.map(opt => {
        const isSelected = value === opt.grade;

        return (
          <button
            key={opt.grade}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(opt.grade)}
            className={`
              flex flex-col items-center justify-center min-w-[42px] px-2 py-1.5 rounded-lg border text-xs transition-all duration-150 select-none
              ${size === 'sm' ? 'min-w-[34px] py-1 px-1 text-[11px]' : ''}
              ${
                isSelected
                  ? opt.activeClasses
                  : `bg-white text-slate-700 border-slate-200 shadow-xs ${opt.borderClasses}`
              }
              ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-[0.97]'}
            `}
          >
            <span className="text-sm font-black leading-none">{opt.grade}</span>
            <span className={`text-[10px] mt-0.5 leading-none font-mono ${isSelected ? 'text-white/90' : 'text-slate-400'}`}>
              {opt.points}p
            </span>
          </button>
        );
      })}
    </div>
  );
};
