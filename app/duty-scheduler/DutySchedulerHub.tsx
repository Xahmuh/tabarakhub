import React, { useState } from 'react';
import { AppUser } from '../../types';
import { BackToModulesButton } from '../shared';
import { Calendar, Settings2, Users, CalendarDays, ExternalLink } from 'lucide-react';
import { PharmacistProfilesView } from './PharmacistProfilesView';
import { ScheduleMatrixView } from './ScheduleMatrixView';
import { LeaveManagementView } from './LeaveManagementView';
import { DutySchedulerConfigView } from './DutySchedulerConfigView';

interface DutySchedulerHubProps {
  user: AppUser;
  onBack: () => void;
  checkPermission: (feature: string, minimum?: 'edit' | 'read') => boolean;
  onNavigateToLeave?: () => void;
}

type TabId = 'schedules' | 'profiles' | 'leave' | 'configuration';

export const DutySchedulerHub: React.FC<DutySchedulerHubProps> = ({ user, onBack, checkPermission, onNavigateToLeave }) => {
  const [activeTab, setActiveTab] = useState<TabId>('schedules');

  const canEdit = checkPermission('duty_scheduler:edit_draft') || checkPermission('duty_scheduler', 'edit');
  const canManageRules = checkPermission('duty_scheduler:manage_rules') || checkPermission('duty_scheduler', 'edit');
  const canSubmitLeave = checkPermission('duty_scheduler:submit_leave') || checkPermission('duty_scheduler', 'edit') || canEdit;
  const canDecideLeave = checkPermission('duty_scheduler:decide_leave') || checkPermission('duty_scheduler', 'edit') || canEdit;

  const tabs = [
    { id: 'schedules', label: 'Schedules', icon: Calendar },
    { id: 'profiles', label: 'Pharmacist Profiles', icon: Users },
    { id: 'leave', label: 'Leave Management', icon: CalendarDays },
    { id: 'configuration', label: 'Configuration', icon: Settings2 }
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-col gap-4 rounded-xl border border-brand/5 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Operations module</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Automated Duty Scheduler</h2>
          </div>
          <BackToModulesButton onClick={onBack} />
        </div>

        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-brand/5">
          <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-brand/10 text-brand font-bold'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
           {activeTab === 'schedules' && <ScheduleMatrixView />}
           {activeTab === 'profiles' && <PharmacistProfilesView />}
           {activeTab === 'leave' && (
             <div className="space-y-4">
               {onNavigateToLeave && (
                 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-red-50/60 border border-red-200/80 rounded-xl text-xs text-red-950">
                   <div className="flex items-center gap-2">
                     <span className="p-1.5 bg-red-100 text-red-700 rounded-lg">
                       <CalendarDays className="h-4 w-4" />
                     </span>
                     <span>
                       <strong>Leave Management & Compliance</strong> is also accessible as a separate standalone module from the TabarakHub Suite.
                     </span>
                   </div>
                   <button
                     onClick={onNavigateToLeave}
                     className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-red-700 bg-white hover:bg-red-100 border border-red-200 rounded-lg shadow-2xs transition-colors shrink-0"
                   >
                     <span>Launch Standalone Module</span>
                     <ExternalLink className="h-3 w-3" />
                   </button>
                 </div>
               )}
               <LeaveManagementView
                 user={user}
                 canSubmit={canSubmitLeave}
                 canDecide={canDecideLeave}
               />
             </div>
           )}
           {activeTab === 'configuration' && (
             <DutySchedulerConfigView user={user} canEdit={canManageRules} />
           )}
        </div>
      </div>
    </div>
  );
};
