import React from 'react';
import { Building2, ClipboardCheck, Award, Lock, Check } from 'lucide-react';

export type StepperTabId = 'A' | 'B' | 'C' | 'D';

export interface StepperTab {
  id: StepperTabId;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const STEPPER_TABS: StepperTab[] = [
  { id: 'A', label: 'Branch Selection', sublabel: 'Area & Facility', icon: Building2 },
  { id: 'B', label: 'NHRA Checklist', sublabel: '8 Sections Inspection', icon: ClipboardCheck },
  { id: 'C', label: 'Staff Appraisal', sublabel: '6 Pillars (150 pts)', icon: Award },
  { id: 'D', label: 'Confirmation & Lock', sublabel: 'Audit Trail & Route', icon: Lock }
];

interface StepperProps {
  activeTab: StepperTabId;
  onTabChange: (tab: StepperTabId) => void;
  canAccessTab: (tab: StepperTabId) => boolean;
  completedTabs: Set<StepperTabId>;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  activeTab,
  onTabChange,
  canAccessTab,
  completedTabs,
  className = ''
}) => {
  return (
    <nav
      aria-label="Audit Evaluation Progress"
      className={`bg-white border border-slate-200 rounded-xl p-2 shadow-sm ${className}`}
    >
      <ol className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {STEPPER_TABS.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          const isCompleted = completedTabs.has(tab.id);
          const isAccessible = canAccessTab(tab.id);
          const Icon = tab.icon;

          return (
            <li key={tab.id}>
              <button
                type="button"
                disabled={!isAccessible}
                onClick={() => isAccessible && onTabChange(tab.id)}
                className={`
                  w-full flex items-center gap-3 p-2.5 sm:p-3 rounded-xl text-left transition-all duration-150 select-none border
                  ${
                    isActive
                      ? 'bg-red-50/80 text-red-950 border-red-200 shadow-sm ring-1 ring-red-200'
                      : isCompleted
                      ? 'bg-slate-50/80 text-slate-800 border-slate-200 hover:bg-white hover:border-slate-300'
                      : isAccessible
                      ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed opacity-50'
                  }
                `}
              >
                {/* Step Indicator Badge */}
                <div
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-all font-mono text-xs font-black
                    ${
                      isActive
                        ? 'bg-red-700 text-white shadow-sm shadow-red-700/30'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isAccessible
                        ? 'bg-slate-100 text-slate-700 border border-slate-200'
                        : 'bg-slate-100 text-slate-400'
                    }
                  `}
                >
                  {isCompleted && !isActive ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                  ) : (
                    <span>{tab.id}</span>
                  )}
                </div>

                {/* Text Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon
                      className={`w-3.5 h-3.5 flex-shrink-0 ${
                        isActive ? 'text-red-700' : isCompleted ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    />
                    <p
                      className={`text-xs font-black truncate leading-tight ${
                        isActive ? 'text-red-950' : isCompleted ? 'text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      {tab.label}
                    </p>
                  </div>
                  <p className={`text-[11px] truncate mt-0.5 font-bold hidden sm:block ${
                    isActive ? 'text-red-700/80' : 'text-slate-400'
                  }`}>
                    {tab.sublabel}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
