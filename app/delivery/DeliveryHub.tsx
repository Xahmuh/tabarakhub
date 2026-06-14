import React, { useState } from 'react';
import { BarChart3, ClipboardList, Coins, LayoutDashboard, MapPinned, Settings2 } from 'lucide-react';
import { Branch, Role } from '../../types';
import { isManagerRole } from '../../lib/access';
import { BranchRecordingPage } from './BranchRecordingPage';
import { BranchDeliveryDashboard } from './BranchDeliveryDashboard';
import { AdminDeliveryAnalytics } from './AdminDeliveryAnalytics';
import { DeliveryCoverage } from './DeliveryCoverage';
import { DeliveryProfitability } from './DeliveryProfitability';
import { DeliverySettings } from './DeliverySettings';
import { BackToModulesButton } from '../shared';

type HubTab = 'record' | 'dashboard' | 'analytics' | 'coverage' | 'profitability' | 'settings';

interface DeliveryHubProps {
  user: Branch;
  onBack: () => void;
  checkPermission: (feature: string, minimum?: 'edit' | 'read') => boolean;
}

export const DeliveryHub: React.FC<DeliveryHubProps> = ({ user, onBack, checkPermission }) => {
  const role: Role = user.role;
  const isManager = isManagerRole(role);
  const isOwner = role === 'owner';
  const isBranch = role === 'branch';
  const canManageDelivery = isManager;
  const canReadDeliveryAnalytics = canManageDelivery || isOwner || role === 'supervisor';
  const canReadDeliveryCoverage = canReadDeliveryAnalytics || isBranch;
  const canRecord = isBranch && checkPermission('delivery', 'edit');

  const tabs: Array<{ id: HubTab; label: string; icon: React.ElementType; visible: boolean }> = [
    { id: 'record', label: 'Record', icon: ClipboardList, visible: canRecord },
    { id: 'dashboard', label: 'Branch Dashboard', icon: LayoutDashboard, visible: isBranch },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, visible: canReadDeliveryAnalytics },
    { id: 'coverage', label: 'Block Coverage', icon: MapPinned, visible: canReadDeliveryCoverage },
    { id: 'profitability', label: 'Profitability', icon: Coins, visible: canManageDelivery || isOwner },
    { id: 'settings', label: 'Delivery Settings', icon: Settings2, visible: canManageDelivery }
  ];

  const visibleTabs = tabs.filter(t => t.visible);
  const [activeTab, setActiveTab] = useState<HubTab>(visibleTabs[0]?.id || 'dashboard');

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Operations module</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Delivery Recording &amp; Traceability</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {isBranch
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
        <BranchRecordingPage branch={user} canEdit={canRecord} isManager={isManager} />
      )}
      {activeTab === 'dashboard' && isBranch && (
        <BranchDeliveryDashboard branch={user} />
      )}
      {activeTab === 'analytics' && canReadDeliveryAnalytics && (
        <AdminDeliveryAnalytics />
      )}
      {activeTab === 'coverage' && canReadDeliveryCoverage && (
        <DeliveryCoverage lockedBranchId={isBranch ? user.id : null} canCreateTask={!isBranch && canManageDelivery} />
      )}
      {activeTab === 'profitability' && (canManageDelivery || isOwner) && (
        <DeliveryProfitability canEdit={canManageDelivery} />
      )}
      {activeTab === 'settings' && canManageDelivery && (
        <DeliverySettings />
      )}
    </div>
  );
};
