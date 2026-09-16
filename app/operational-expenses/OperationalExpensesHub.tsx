import React, { useState } from 'react';
import { AlertTriangle, BarChart3, CalendarDays, ClipboardList, LayoutDashboard, Trophy } from 'lucide-react';
import { Branch, Role } from '../../types';
import { isManagerRole } from '../../lib/access';
import { BackToModulesButton } from '../shared';
import { ExpenseDashboard } from './ExpenseDashboard.tsx';
import { ExpenseList } from './ExpenseList.tsx';
import { ExpenseForm } from './ExpenseForm.tsx';
import { ExpenseReports } from './ExpenseReports.tsx';
import { VehicleActionsManager } from './VehicleActionsManager.tsx';
import { VehicleFuelLeaderboard } from './VehicleFuelLeaderboard.tsx';

import { expenseService } from '../../services/expenseService';

type HubTab = 'dashboard' | 'expenses' | 'new-expense' | 'reports' | 'vehicle-actions' | 'fuel-leaderboard';

interface OperationalExpensesHubProps {
  user: Branch;
  pharmacist?: { id: string; name: string; code: string } | null;
  onBack: () => void;
  checkPermission: (feature: string, minimum?: 'edit' | 'read') => boolean;
}

export const OperationalExpensesHub: React.FC<OperationalExpensesHubProps> = ({
  user,
  pharmacist,
  onBack,
  checkPermission
}) => {
  const role: Role = user.role;
  // Privileged roles see all branches: owner, admin, manager, accounts (Finance)
  const isPrivilegedUser = ['owner', 'admin', 'manager', 'accounts'].includes(role) || isManagerRole(role);
  const isManager = isPrivilegedUser;
  const isBranch = !isPrivilegedUser;
  const canEditModule = isBranch || checkPermission('operational_expenses', 'edit');
  const canReadModule = isBranch || checkPermission('operational_expenses', 'read');
  const canEdit = canEditModule;
  const canRead = canReadModule;

  const canRecordExpense = isBranch || ((canEditModule || checkPermission('operational_expenses:new-expense', 'edit')) && ['admin', 'branch'].includes(role) && checkPermission('operational_expenses:new-expense', 'read'));
  const canSeeDashboard = isBranch || checkPermission('operational_expenses:dashboard', 'read');
  const canSeeExpenses = isBranch || checkPermission('operational_expenses:expenses', 'read');
  const canSeeReports = isBranch || checkPermission('operational_expenses:reports', 'read');
  const canSeeActions = !isBranch && (checkPermission('operational_expenses:vehicle-actions', 'read') || canReadModule);
  const canSeeLeaderboard = !isBranch && (checkPermission('operational_expenses:fuel-leaderboard', 'read') || canReadModule);

  const [alertsCount, setAlertsCount] = React.useState<number>(0);

  React.useEffect(() => {
    let mounted = true;
    expenseService.vehicles.getAlertsSummary().then(summary => {
      if (mounted) setAlertsCount(summary.totalAlerts);
    }).catch(console.warn);
    return () => { mounted = false; };
  }, []);

  const tabs: Array<{ id: HubTab; label: string; icon: React.ElementType; visible: boolean; badgeCount?: number }> = [
    { id: 'new-expense', label: 'Record New Expense', icon: CalendarDays, visible: canRecordExpense },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, visible: canSeeDashboard },
    { id: 'expenses', label: 'Expenses List', icon: ClipboardList, visible: canSeeExpenses },
    { id: 'reports', label: 'Reports', icon: BarChart3, visible: canSeeReports },
    { id: 'vehicle-actions', label: 'Actions & Renewals', icon: AlertTriangle, visible: canSeeActions, badgeCount: alertsCount },
    { id: 'fuel-leaderboard', label: 'Fuel Leaderboard', icon: Trophy, visible: canSeeLeaderboard }
  ];

  const visibleTabs = tabs.filter(t => t.visible);
  const [activeTab, setActiveTab] = useState<HubTab>(canRecordExpense ? 'new-expense' : (visibleTabs[0]?.id || 'dashboard'));
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);

  const handleExpenseSaved = () => {
    setEditExpenseId(null);
    setActiveTab('expenses');
  };

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Operations module</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Operational Cash Expenses</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {isBranch
              ? 'Record operational cash expenses for your branch.'
              : 'Track and analyze operational cash expenses across branches.'}
          </p>
        </div>
        <BackToModulesButton onClick={onBack} />
      </div>

      {visibleTabs.length > 1 && (
        <div className="flex bg-slate-100/60 p-1 rounded-lg border border-slate-200/50 w-fit max-w-full overflow-x-auto print:hidden">
          {visibleTabs.map(t => {
            const hasBadge = t.id === 'vehicle-actions' && (t.badgeCount || 0) > 0;

            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); if (t.id !== 'new-expense') setEditExpenseId(null); }}
                className={`relative flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-md text-xs font-bold transition-all ${
                  activeTab === t.id ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <t.icon className={`h-3.5 w-3.5 ${hasBadge ? 'text-rose-500 animate-bounce' : ''}`} />
                <span>{t.label}</span>
                {hasBadge && (
                  <span className="relative flex items-center justify-center ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex items-center justify-center px-1.5 py-0.2 min-w-[18px] text-[10px] font-black text-white bg-rose-500 rounded-full shadow-2xs">
                      {t.badgeCount}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'dashboard' && canRead && (
        <ExpenseDashboard
          user={user}
          isManager={isManager}
          onViewExpense={(expenseId) => {
            setEditExpenseId(expenseId);
            setActiveTab('new-expense');
          }}
        />
      )}
      {activeTab === 'expenses' && canRead && (
        <ExpenseList
          user={user}
          isManager={isManager}
          canEdit={canEdit}
          onEdit={(expenseId) => {
            setEditExpenseId(expenseId);
            setActiveTab('new-expense');
          }}
          onNewExpense={() => setActiveTab('new-expense')}
        />
      )}
      {activeTab === 'new-expense' && (canRecordExpense || (canEdit && editExpenseId)) && (
        <ExpenseForm
          user={user}
          pharmacist={pharmacist}
          editExpenseId={editExpenseId}
          onSaved={handleExpenseSaved}
          onCancel={() => { setEditExpenseId(null); setActiveTab('expenses'); }}
        />
      )}
      {activeTab === 'reports' && canRead && (
        <ExpenseReports user={user} isManager={isManager} />
      )}
      {activeTab === 'vehicle-actions' && canRead && (
        <VehicleActionsManager
          onRecordMaintenance={() => {
            setActiveTab('new-expense');
          }}
        />
      )}
      {activeTab === 'fuel-leaderboard' && canRead && (
        <VehicleFuelLeaderboard />
      )}
    </div>
  );
};
