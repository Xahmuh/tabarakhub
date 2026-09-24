import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AuthState,
  Branch,
  BenefitPayTransfer,
  DeliveryOrder,
  DeliveryNotification,
  MaintenanceSettings
} from './types';
import { isManagerRole } from './lib/access';

// Core immediately-rendered modules
import { POSPage } from './app/pos';
import { DashboardPage, HRRequestsSection } from './app/dashboard';
import { SpinWinHub } from './app/spin-win';
import { BackToModulesButton } from './app/shared';

// Lazy-loaded secondary & heavy modules
const OwnerDashboardPage = lazy(() => import('./app/owner-dashboard').then(m => ({ default: m.OwnerDashboardPage })));
const HRPortalPage = lazy(() => import('./app/hr').then(m => ({ default: m.HRPortalPage })));
const WorkforceDirectory = lazy(() => import('./app/hr').then(m => ({ default: m.WorkforceDirectory })));
const WorkforcePage = lazy(() => import('./app/workforce').then(m => ({ default: m.WorkforcePage })));
const OfficialHrLetterGenerator = lazy(() => import('./app/hr-letter-generator/OfficialHrLetterGenerator').then(m => ({ default: m.OfficialHrLetterGenerator })));
const CashFlowPlanner = lazy(() => import('./app/cash-flow').then(m => ({ default: m.CashFlowPlanner })));
const BranchCashTrackerPage = lazy(() => import('./app/cash-flow').then(m => ({ default: m.BranchCashTrackerPage })));
const CorporateCodex = lazy(() => import('./app/corporate-codex').then(m => ({ default: m.CorporateCodex })));
const ProjectSettings = lazy(() => import('./app/project-settings').then(m => ({ default: m.ProjectSettings })));
const FeedbackForm = lazy(() => import('./app/modules/quality-feedback/pages/FeedbackForm').then(m => ({ default: m.FeedbackForm })));
const QualityFeedbackAdmin = lazy(() => import('./app/modules/quality-feedback/pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const EmployeeContributionsPage = lazy(() => import('./app/employee-contributions').then(m => ({ default: m.EmployeeContributionsPage })));
const WorkflowTodoPage = lazy(() => import('./app/workflow-todo').then(m => ({ default: m.WorkflowTodoPage })));
const BlockCoverageAnalyzer = lazy(() => import('./app/block-analyzer').then(m => ({ default: m.BlockCoverageAnalyzer })));
const DeliveryHub = lazy(() => import('./app/delivery/DeliveryHub').then(m => ({ default: m.DeliveryHub })));
const BenefitPayLedger = lazy(() => import('./app/benefit-pay').then(m => ({ default: m.BenefitPayLedger })));
const OperationalExpensesHub = lazy(() => import('./app/operational-expenses').then(m => ({ default: m.OperationalExpensesHub })));
const OperationalRenewalsHub = lazy(() => import('./app/operational-renewals/OperationalRenewalsHub').then(m => ({ default: m.OperationalRenewalsHub })));
const DutySchedulerHub = lazy(() => import('./app/duty-scheduler/DutySchedulerHub').then(m => ({ default: m.DutySchedulerHub })));
const LeaveManagementHub = lazy(() => import('./app/leave-management/LeaveManagementHub').then(m => ({ default: m.LeaveManagementHub })));
const DeliveryNotificationsPage = lazy(() => import('./app/notifications').then(m => ({ default: m.DeliveryNotificationsPage })));
const PayrollModuleHub = lazy(() => import('./app/payroll').then(m => ({ default: m.PayrollModuleHub })));
const AttendanceHub = lazy(() => import('./app/attendance/AttendanceHub').then(m => ({ default: m.AttendanceHub })));
const TQPHHubView = lazy(() => import('./app/tqph').then(m => ({ default: m.TQPHHubView })));

export type AppTab =
  | 'owner-dashboard'
  | 'pos'
  | 'dashboard'
  | 'selector'
  | 'spin-win'
  | 'hr'
  | 'hr-manager'
  | 'hr-directory'
  | 'hr-letter'
  | 'workforce'
  | 'cash-flow'
  | 'cash-tracker'
  | 'corporate-codex'
  | 'settings'
  | 'system-settings'
  | 'access-control'
  | 'feedback-form'
  | 'feedback-admin'
  | 'employee-contributions'
  | 'workflow-todo'
  | 'block-analyzer'
  | 'delivery'
  | 'benefit-pay-ledger'
  | 'operational-expenses'
  | 'operational-renewals'
  | 'duty-scheduler'
  | 'leave-management'
  | 'notifications'
  | 'payroll'
  | 'attendance'
  | 'tqph';

export type DeliveryFocusTarget = { orderId: string; orderDate?: string | null; branchId?: string | null };
export type BenefitPayFocusTarget = { deliveryOrderId: string; transferDate?: string | null; branchId?: string | null };

export interface AppRouterProps {
  activeTab: AppTab;
  authState: AuthState;
  activePOSBranch: Branch | null;
  pharmacyLogoUrl: string;
  hrLetterInitialData: any;
  deliveryFocusTarget: DeliveryFocusTarget | null;
  benefitPayFocusTarget: BenefitPayFocusTarget | null;
  checkPermission: (feature: string, minimum?: 'read' | 'edit') => boolean;
  onTabChange: (tab: AppTab) => void;
  onBackToPharmacist: () => void;
  onSetDeliveryFocusTarget: (target: DeliveryFocusTarget | null) => void;
  onSetBenefitPayFocusTarget: (target: BenefitPayFocusTarget | null) => void;
  onSetHrLetterInitialData: (data: any) => void;
  onDeliveryNotificationUnreadCountChange: (count: number) => void;
  onOpenBenefitPayFromDelivery: (transfer: BenefitPayTransfer) => void;
  onOpenDeliveryFromBenefitPay: (transfer: BenefitPayTransfer) => void;
  onOpenDeliveryFromNotification: (notification: DeliveryNotification) => void;
  onSettingsChange: (settings: MaintenanceSettings | null) => void;
}

const RouteLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] w-full py-16">
    <Loader2 className="w-8 h-8 text-brand animate-spin mb-3" />
    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Module...</p>
  </div>
);

export const AppRouter: React.FC<AppRouterProps> = ({
  activeTab,
  authState,
  activePOSBranch,
  pharmacyLogoUrl,
  hrLetterInitialData,
  deliveryFocusTarget,
  benefitPayFocusTarget,
  checkPermission,
  onTabChange,
  onBackToPharmacist,
  onSetDeliveryFocusTarget,
  onSetBenefitPayFocusTarget,
  onSetHrLetterInitialData,
  onDeliveryNotificationUnreadCountChange,
  onOpenBenefitPayFromDelivery,
  onOpenDeliveryFromBenefitPay,
  onOpenDeliveryFromNotification,
  onSettingsChange,
}) => {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      {activeTab === 'owner-dashboard' ? (
        <OwnerDashboardPage user={authState.user!} onBack={() => onTabChange('selector')} />
      ) : activeTab === 'pos' ? (
        <POSPage
          branch={activePOSBranch || authState.user!}
          pharmacist={authState.pharmacist!}
          permissions={authState.permissions || []}
          onBackToPharmacist={onBackToPharmacist}
        />
      ) : activeTab === 'spin-win' ? (
        <SpinWinHub
          branch={authState.user!}
          onBack={() => onTabChange('selector')}
          userRole={authState.user?.role || 'branch'}
        />
      ) : activeTab === 'hr' ? (
        <HRPortalPage onBack={() => onTabChange('selector')} logoUrl={pharmacyLogoUrl} />
      ) : activeTab === 'hr-manager' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">HR Admin Portal</h2>
              <p className="text-slate-500 font-medium">Manage employee requests and approvals</p>
            </div>
            <BackToModulesButton onClick={() => onTabChange('selector')} />
          </div>
          <HRRequestsSection
            onOpenInLetterGenerator={(request, lang = 'ar') => {
              onSetHrLetterInitialData({ ...request, initialLang: lang });
              onTabChange('hr-letter');
            }}
          />
        </div>
      ) : activeTab === 'hr-directory' ? (
        <WorkforceDirectory lang="en" onBack={() => onTabChange('selector')} />
      ) : activeTab === 'hr-letter' ? (
        <OfficialHrLetterGenerator
          initialEmployee={hrLetterInitialData}
          onBack={() => {
            const target = hrLetterInitialData ? 'hr-manager' : 'selector';
            onSetHrLetterInitialData(null);
            onTabChange(target);
          }}
          standalone={true}
        />
      ) : activeTab === 'workforce' ? (
        <WorkforcePage onBack={() => onTabChange('selector')} />
      ) : activeTab === 'cash-flow' ? (
        <CashFlowPlanner
          onBack={() => onTabChange('selector')}
          branchId={authState.user?.id}
          userRole={authState.user?.role}
          pharmacistName={authState.pharmacist?.name}
          initialTab="dashboard"
        />
      ) : activeTab === 'cash-tracker' ? (
        <BranchCashTrackerPage
          onBack={() => onTabChange('selector')}
          branchId={authState.user?.id}
          userRole={authState.user?.role}
          pharmacistName={authState.pharmacist?.name}
        />
      ) : activeTab === 'corporate-codex' ? (
        <CorporateCodex
          userRole={authState.user?.role || 'branch'}
          onBack={() => onTabChange('selector')}
        />
      ) : activeTab === 'settings' || activeTab === 'system-settings' || activeTab === 'access-control' ? (
        <ProjectSettings
          onBack={() => onTabChange('selector')}
          onSettingsChange={onSettingsChange}
          currentRole={authState.user?.role}
        />
      ) : activeTab === 'feedback-form' ? (
        <FeedbackForm onBack={() => onTabChange('selector')} />
      ) : activeTab === 'feedback-admin' ? (
        <QualityFeedbackAdmin
          userRole={authState.user?.role}
          onBack={() => onTabChange('selector')}
        />
      ) : activeTab === 'employee-contributions' ? (
        <EmployeeContributionsPage
          userRole={authState.user?.role}
          branchCode={authState.user?.code}
          onBack={() => onTabChange('selector')}
        />
      ) : activeTab === 'workflow-todo' ? (
        <WorkflowTodoPage
          user={authState.user!}
          onBack={() => onTabChange('selector')}
          checkPermission={checkPermission}
        />
      ) : activeTab === 'block-analyzer' ? (
        <BlockCoverageAnalyzer onBack={() => onTabChange('selector')} />
      ) : activeTab === 'delivery' ? (
        <DeliveryHub
          user={authState.user!}
          onBack={() => onTabChange('selector')}
          checkPermission={checkPermission}
          focusTarget={deliveryFocusTarget}
          onFocusConsumed={() => onSetDeliveryFocusTarget(null)}
          onOpenBenefitPayTransfer={onOpenBenefitPayFromDelivery}
        />
      ) : activeTab === 'benefit-pay-ledger' ? (
        <BenefitPayLedger
          user={authState.user!}
          onBack={() => onTabChange('selector')}
          checkPermission={checkPermission}
          focusTarget={benefitPayFocusTarget}
          onFocusConsumed={() => onSetBenefitPayFocusTarget(null)}
          onOpenDeliveryOrder={onOpenDeliveryFromBenefitPay}
        />
      ) : activeTab === 'operational-expenses' ? (
        <OperationalExpensesHub
          user={authState.user!}
          pharmacist={authState.pharmacist}
          onBack={() => onTabChange('selector')}
          checkPermission={checkPermission}
        />
      ) : activeTab === 'operational-renewals' ? (
        <OperationalRenewalsHub
          user={authState.user!}
          onBack={() => onTabChange('selector')}
          checkPermission={checkPermission}
        />
      ) : activeTab === 'duty-scheduler' ? (
        <DutySchedulerHub
          user={authState.user!}
          onBack={() => onTabChange('selector')}
          checkPermission={checkPermission}
          onNavigateToLeave={() => onTabChange('leave-management')}
        />
      ) : activeTab === 'leave-management' ? (
        <LeaveManagementHub
          user={authState.user!}
          onBack={() => onTabChange('selector')}
          checkPermission={checkPermission}
          onNavigateToScheduler={() => onTabChange('duty-scheduler')}
        />
      ) : activeTab === 'notifications' ? (
        <DeliveryNotificationsPage
          onBack={() => onTabChange('selector')}
          onUnreadCountChange={onDeliveryNotificationUnreadCountChange}
          onOpenDeliveryOrder={onOpenDeliveryFromNotification}
        />
      ) : activeTab === 'payroll' ? (
        <PayrollModuleHub
          user={authState.user!}
          onBack={() => onTabChange('selector')}
          checkPermission={checkPermission}
        />
      ) : activeTab === 'attendance' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <BackToModulesButton onClick={() => onTabChange('selector')} />
          </div>
          <AttendanceHub
            currentUserId={authState.user?.id || 'admin'}
            currentUserRole={authState.user?.role || 'Admin'}
          />
        </div>
      ) : activeTab === 'tqph' ? (
        authState.user?.role === 'branch' ? (
          <DashboardPage
            user={authState.user!}
            permissions={authState.permissions || []}
            onBack={() => onTabChange('selector')}
          />
        ) : (
          <TQPHHubView
            onBackToModules={() => onTabChange('selector')}
            currentUser={
              authState.user
                ? {
                    id: authState.user.id,
                    name: authState.user.name,
                    cpr: '990101010',
                    role: isManagerRole(authState.user.role) ? 'admin' : (authState.user.role === 'supervisor' ? 'supervisor' : 'admin'),
                    branch_id: authState.user.id,
                  }
                : undefined
            }
          />
        )
      ) : (
        <DashboardPage
          user={authState.user!}
          permissions={authState.permissions || []}
          onBack={() => onTabChange('selector')}
        />
      )}
    </Suspense>
  );
};
