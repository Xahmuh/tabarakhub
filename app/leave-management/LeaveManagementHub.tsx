import React from 'react';
import { AppUser } from '../../types';
import { BackToModulesButton } from '../shared';
import { CalendarCheck, Calendar, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { LeaveManagementView } from '../duty-scheduler/LeaveManagementView';
import { isManagerRole } from '../../lib/access';

interface LeaveManagementHubProps {
  user: AppUser;
  onBack: () => void;
  checkPermission: (feature: string, minimum?: 'edit' | 'read') => boolean;
  onNavigateToScheduler?: () => void;
}

export const LeaveManagementHub: React.FC<LeaveManagementHubProps> = ({
  user,
  onBack,
  checkPermission,
  onNavigateToScheduler
}) => {
  const isManager = isManagerRole(user.role);

  const canSubmit =
    isManager ||
    checkPermission('leave_management:submit_leave', 'edit') ||
    checkPermission('leave_management', 'edit') ||
    checkPermission('duty_scheduler:submit_leave', 'edit') ||
    checkPermission('duty_scheduler', 'edit');

  const canDecide =
    isManager ||
    checkPermission('leave_management:decide_leave', 'edit') ||
    checkPermission('leave_management', 'edit') ||
    checkPermission('duty_scheduler:decide_leave', 'edit') ||
    checkPermission('duty_scheduler', 'edit');

  const canAdjust =
    isManager ||
    checkPermission('leave_management:manage_ledger', 'edit') ||
    checkPermission('leave_management', 'edit') ||
    checkPermission('duty_scheduler:view_ledger', 'edit') ||
    checkPermission('duty_scheduler', 'edit');

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Module Header */}
        <div className="flex flex-col gap-4 rounded-xl border border-brand/5 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center justify-center shadow-inner">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-brand">Compliance & Workforce</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                  <ShieldCheck className="h-3 w-3" /> Bahrain Labor Law
                </span>
              </div>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Leave Management & Compliance</h2>
              <p className="text-xs text-slate-500 font-medium">
                Annual leave request approvals, dynamic daily accruals & balance ledgers, and weekly rest reconciliation.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 self-end sm:self-center">
            {onNavigateToScheduler && (
              <button
                onClick={onNavigateToScheduler}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 shadow-sm"
                title="Switch to Automated Duty Scheduler"
              >
                <Calendar className="h-3.5 w-3.5 text-brand" />
                <span>Duty Scheduler</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
            )}
            <BackToModulesButton onClick={onBack} />
          </div>
        </div>

        {/* Core Leave Management & Compliance Workspace */}
        <div className="flex-1">
          <LeaveManagementView
            user={user}
            canSubmit={canSubmit}
            canDecide={canDecide}
            canAdjust={canAdjust}
          />
        </div>
      </div>
    </div>
  );
};

export default LeaveManagementHub;
