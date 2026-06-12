import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { clientConfig, isModuleEnabled } from '../../config/clientConfig';
import { buildPermissionChecker } from '../../lib/access';
import { FeaturePermission, RolePermission } from '../../types';

export interface FooterProps {
    onNavigate?: (tab: any) => void;
    permissions?: FeaturePermission[];
    rolePermissions?: RolePermission[];
    user?: any;
}

export const Footer: React.FC<FooterProps> = ({ permissions = [], rolePermissions = [], user }) => {
    const currentYear = new Date().getFullYear();

    const role = user?.role;
    const isManager = role === 'manager';
    const isOwner = role === 'owner';
    const isWarehouse = role === 'warehouse';

    const checkPermission = buildPermissionChecker(role, permissions, rolePermissions);

    let enabledModuleCount = 0;

    // Mirroring SuitePage display logic

    // Daily Command Center
    if (checkPermission('command_center')) {
        enabledModuleCount += 1;
    }

    // 1. Lost Sales & Shortage
    if (isModuleEnabled('sales') && !isWarehouse && (checkPermission('lost_sales', 'edit') || checkPermission('shortages', 'edit'))) {
        enabledModuleCount += 1;
    }

    // 2. Performance Portal
    if (isModuleEnabled('reports') && isWarehouse && isModuleEnabled('adminDashboard') && (checkPermission('lost_sales') || checkPermission('shortages'))) {
        enabledModuleCount += 1;
    } else if (isModuleEnabled('reports') && (isManager || isOwner || role === 'supervisor') && isModuleEnabled('managerDashboard')) {
        enabledModuleCount += 1;
    } else if (isModuleEnabled('reports') && role === 'branch' && isModuleEnabled('branchDashboard') && (checkPermission('lost_sales') || checkPermission('shortages'))) {
        enabledModuleCount += 1;
    }

    // 3. HR Admin Portal (Manager) / HR Self-Service (Branch)
    if (isModuleEnabled('hr') && isManager && checkPermission('hr_requests')) {
        enabledModuleCount += 1;
    } else if (isModuleEnabled('hr') && role === 'branch' && checkPermission('hr_requests')) {
        enabledModuleCount += 1;
    }

    // 4. Workforce Analytics (Manager only)
    if (isModuleEnabled('hr') && isModuleEnabled('workforce') && isManager && checkPermission('workforce')) {
        enabledModuleCount += 1;
    }

    // 5. Cash Flow Planner / Branch Cash Tracker
    if (isModuleEnabled('cashFlow') && checkPermission('cash_flow')) {
        enabledModuleCount += 1;
    } else if (isModuleEnabled('cashTracker') && !isManager && checkPermission('cash_tracker')) {
        enabledModuleCount += 1;
    }

    // 6. Corporate Codex
    if (isModuleEnabled('corporateCodex') && checkPermission('corporate_codex')) {
        enabledModuleCount += 1;
    }

    // 7. Spin & Win
    if (isModuleEnabled('spinWin') && checkPermission('spin_win')) {
        enabledModuleCount += 1;
    }

    // 8. Settings / permissions (Manager only)
    if (isModuleEnabled('settings') && isManager) {
        enabledModuleCount += 1;
    }

    if (isModuleEnabled('qualityFeedback') && checkPermission('quality_feedback')) {
        enabledModuleCount += 1;
        if (isManager || isOwner) enabledModuleCount += 1;
    }

    if (isModuleEnabled('employeeContributions') && checkPermission('employee_contributions')) {
        enabledModuleCount += 1;
    }

    return (
        <footer className="w-full border-t border-slate-200/80 bg-white/80 mt-10 print:hidden">
            <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-4">
                <div className="flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand rounded-lg overflow-hidden shadow-sm">
                            <img src={clientConfig.logoUrl} alt={`${clientConfig.clientName} logo`} className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <p className="font-black text-slate-900">{clientConfig.appName}</p>
                            <p className="text-xs font-medium text-slate-400">&copy; {currentYear} {clientConfig.clientName}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Online
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                            {enabledModuleCount} modules enabled
                        </span>
                        <span>{clientConfig.country}</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};
