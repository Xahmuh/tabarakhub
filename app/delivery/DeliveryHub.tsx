import React, { useState } from 'react';
import { BarChart3, CalendarClock, ClipboardList, Coins, LayoutDashboard, MapPinned, Settings2, Truck } from 'lucide-react';
import { Branch, DeliveryOrder, Role } from '../../types';
import { isManagerRole } from '../../lib/access';
import { BranchRecordingPage } from './BranchRecordingPage';
import { BranchDeliveryDashboard } from './BranchDeliveryDashboard';
import { AdminDeliveryAnalytics } from './AdminDeliveryAnalytics';
import { DeliveryCoverage } from './DeliveryCoverage';
import { DeliveryLifecycleBoard } from './DeliveryLifecycleBoard';
import { DeliveryProfitability } from './DeliveryProfitability';
import { DeliverySettings } from './DeliverySettings';
import { DriverDutyReport } from './DriverDutyReport';
import { BackToModulesButton } from '../shared';

type HubTab = 'record' | 'dashboard' | 'dispatch' | 'analytics' | 'driver-duty' | 'coverage' | 'profitability' | 'settings';

interface DeliveryHubProps {
  user: Branch;
  onBack: () => void;
  checkPermission: (feature: string, minimum?: 'edit' | 'read') => boolean;
  focusTarget?: { orderId: string; orderDate?: string | null; branchId?: string | null } | null;
  onFocusConsumed?: () => void;
  onOpenBenefitPayTransfer?: (order: DeliveryOrder) => void;
}

export const DeliveryHub: React.FC<DeliveryHubProps> = ({
  user,
  onBack,
  checkPermission,
  focusTarget,
  onFocusConsumed,
  onOpenBenefitPayTransfer
}) => {
  const role: Role = user.role;
  const isManager = isManagerRole(role);
  const isOwner = role === 'owner';
  const isBranch = role === 'branch';
  const isDriver = role === 'driver';
  const canManageDelivery = isManager;
  const canReadDelivery = checkPermission('delivery', 'read');
  const canReadDeliveryAnalytics = canReadDelivery && (canManageDelivery || isOwner || role === 'supervisor');
  const canReadDeliveryCoverage = canReadDeliveryAnalytics || (canReadDelivery && isBranch);
  const canReadDriverDuty = canReadDelivery && (canReadDeliveryAnalytics || isDriver);
  const canRecord = isBranch && checkPermission('delivery', 'edit');
  const canTransitionLifecycle = canManageDelivery || canRecord;

  const tabs: Array<{ id: HubTab; label: string; icon: React.ElementType; visible: boolean }> = [
    { id: 'record', label: 'Record', icon: ClipboardList, visible: canRecord },
    { id: 'dashboard', label: 'Branch Dashboard', icon: LayoutDashboard, visible: isBranch && canReadDelivery },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, visible: canReadDeliveryAnalytics },
    { id: 'dispatch', label: 'Dispatch', icon: Truck, visible: canReadDelivery && !isDriver },
    { id: 'driver-duty', label: 'Driver Duties', icon: CalendarClock, visible: canReadDriverDuty },
    { id: 'coverage', label: 'Block Coverage', icon: MapPinned, visible: canReadDeliveryCoverage },
    { id: 'profitability', label: 'Profitability', icon: Coins, visible: canReadDelivery && (canManageDelivery || isOwner) },
    { id: 'settings', label: 'Delivery Settings', icon: Settings2, visible: canManageDelivery }
  ];

  const visibleTabs = tabs.filter(t => t.visible);
  const [activeTab, setActiveTab] = useState<HubTab>(visibleTabs[0]?.id || 'dashboard');
  const [orderToEdit, setOrderToEdit] = useState<DeliveryOrder | null>(null);

  React.useEffect(() => {
    if (!focusTarget?.orderId) return;
    if (canRecord) setActiveTab('record');
    else if (canReadDelivery && !isDriver) setActiveTab('dispatch');
  }, [canReadDelivery, canRecord, focusTarget?.orderId, isDriver]);

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Operations module</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Delivery Recording &amp; Traceability</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {isDriver
              ? 'Review your duty sessions, working hours, and delivery activity.'
              : isBranch
                ? 'Record delivery orders and track your branch delivery activity.'
                : 'Delivery activity, driver performance, geography, and cost efficiency across branches.'}
          </p>
        </div>
        <BackToModulesButton onClick={onBack} />
      </div>

      {visibleTabs.length > 1 && (
        <div className="flex bg-slate-100/60 p-1 rounded-lg border border-slate-200/50 w-fit max-w-full overflow-x-auto print:hidden">
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-md text-xs font-bold transition-all ${
                activeTab === t.id ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'record' && canRecord && (
        <BranchRecordingPage
          branch={user}
          canEdit={canRecord}
          isManager={isManager}
          orderToEdit={orderToEdit}
          onEditDone={() => setOrderToEdit(null)}
          focusOrderId={focusTarget?.orderId || null}
          focusOrderDate={focusTarget?.orderDate || null}
          onFocusConsumed={onFocusConsumed}
          onOpenBenefitPayTransfer={onOpenBenefitPayTransfer}
        />
      )}
      {activeTab === 'dashboard' && isBranch && canReadDelivery && (
        <BranchDeliveryDashboard branch={user} canEdit={canRecord} onEdit={canRecord ? (order) => {
          setOrderToEdit(order);
          setActiveTab('record');
        } : undefined} />
      )}
      {activeTab === 'dispatch' && canReadDelivery && (
        <DeliveryLifecycleBoard
          branch={isBranch ? user : null}
          canTransition={canTransitionLifecycle}
          canManageAll={canManageDelivery}
          focusOrderId={focusTarget?.orderId || null}
          focusOrderDate={focusTarget?.orderDate || null}
          onFocusConsumed={onFocusConsumed}
          onOpenBenefitPayTransfer={onOpenBenefitPayTransfer}
        />
      )}
      {activeTab === 'analytics' && canReadDeliveryAnalytics && (
        <AdminDeliveryAnalytics />
      )}
      {activeTab === 'driver-duty' && canReadDriverDuty && (
        <DriverDutyReport selfOnly={isDriver} />
      )}
      {activeTab === 'coverage' && canReadDeliveryCoverage && (
        <DeliveryCoverage lockedBranchId={isBranch ? user.id : null} canCreateTask={!isBranch && canManageDelivery} branchView={isBranch} />
      )}
      {activeTab === 'profitability' && canReadDelivery && (canManageDelivery || isOwner) && (
        <DeliveryProfitability canEdit={canManageDelivery} />
      )}
      {activeTab === 'settings' && canManageDelivery && (
        <DeliverySettings />
      )}
    </div>
  );
};
