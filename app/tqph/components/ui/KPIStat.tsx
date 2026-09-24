import React from 'react';

export interface KPIStatProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    label?: string;
    positive?: boolean;
    neutral?: boolean;
  };
  variant?: 'lime' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'default';
  progress?: {
    current: number;
    total: number;
    unit?: string;
  };
  badge?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Reusable KPIStat Component (Section 3 Flat 2.0 & Section 7.3.4)
 * Displays executive summary metrics with tinted icon backdrops,
 * trend indicators, and responsive glassmorphism.
 */
export const KPIStat: React.FC<KPIStatProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
  progress,
  badge,
  className = '',
  onClick
}) => {
  const variantStyles = {
    default: {
      iconBg: 'bg-slate-50 text-slate-700 border-slate-200',
      accentGlow: 'hover:border-slate-300',
      valColor: 'text-slate-950',
      barColor: 'bg-slate-900'
    },
    lime: {
      iconBg: 'bg-red-50 text-red-700 border-red-200',
      accentGlow: 'hover:border-red-300',
      valColor: 'text-slate-950',
      barColor: 'bg-red-700'
    },
    emerald: {
      iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      accentGlow: 'hover:border-emerald-300',
      valColor: 'text-slate-950',
      barColor: 'bg-emerald-600'
    },
    amber: {
      iconBg: 'bg-amber-50 text-amber-700 border-amber-200',
      accentGlow: 'hover:border-amber-300',
      valColor: 'text-slate-950',
      barColor: 'bg-amber-500'
    },
    rose: {
      iconBg: 'bg-red-50 text-red-700 border-red-200',
      accentGlow: 'hover:border-red-300',
      valColor: 'text-red-700',
      barColor: 'bg-red-600'
    },
    cyan: {
      iconBg: 'bg-slate-50 text-slate-700 border-slate-200',
      accentGlow: 'hover:border-slate-300',
      valColor: 'text-slate-950',
      barColor: 'bg-slate-900'
    }
  }[variant];

  const pct = progress ? Math.min(100, Math.max(0, (progress.current / progress.total) * 100)) : 0;

  return (
    <div
      onClick={onClick}
      className={`
        min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm
        transition-all duration-200
        ${variantStyles.accentGlow}
        ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300' : ''}
        ${className}
      `}
    >
      {/* Top row: Title and Icon */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 truncate">
              {title}
            </span>
            {badge && (
              <span className="text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest bg-slate-50 text-slate-500 border border-slate-200">
                {badge}
              </span>
            )}
          </div>
        </div>
        <div
          className={`
            w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border
            ${variantStyles.iconBg}
          `}
        >
          {icon}
        </div>
      </div>

      {/* Metric Value */}
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${variantStyles.valColor}`}>
          {value}
        </span>
        {trend && (
          <span
            className={`
              inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border
              ${
                trend.neutral
                  ? 'bg-slate-50 text-slate-600 border-slate-200'
                  : trend.positive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }
            `}
          >
            {trend.value}
            {trend.label && <span className="ml-1 text-[9px] opacity-75">{trend.label}</span>}
          </span>
        )}
      </div>

      {/* Subtitle / Context note */}
      {subtitle && (
        <p className="text-[11px] font-bold text-slate-500 leading-relaxed truncate">
          {subtitle}
        </p>
      )}

      {/* Optional Progress Bar */}
      {progress && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1.5 font-bold">
            <span>
              {progress.current} of {progress.total} {progress.unit || ''}
            </span>
            <span className="font-black text-slate-700">{pct.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${variantStyles.barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
