import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { clientConfig, isModuleEnabled } from '../../config/clientConfig';
import { buildPermissionChecker } from '../../lib/access';
import { FeaturePermission, MaintenanceSettings, RolePermission } from '../../types';

export interface FooterProps {
    onNavigate?: (tab: any) => void;
    permissions?: FeaturePermission[];
    rolePermissions?: RolePermission[];
    user?: any;
    settings?: MaintenanceSettings | null;
}

export const Footer: React.FC<FooterProps> = ({ permissions = [], rolePermissions = [], user, settings }) => {
    const role = user?.role;
    const isManager = role === 'manager';
    const isOwner = role === 'owner';
    const isWarehouse = role === 'warehouse';
    const canApproveBranchLogins = role === 'admin' || role === 'manager' || role === 'owner';
    const footerLogoUrl = settings?.footerLogoUrl ?? '';
    const footerText = settings?.footerText ?? 'HUB';

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

    // 8. Settings / permissions, plus branch login approval queue
    if (isModuleEnabled('settings') && (isManager || canApproveBranchLogins)) {
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
        <footer className="w-full border-t border-white/10 mt-10 text-white print:hidden" style={{ backgroundColor: clientConfig.accentColor }}>
            <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-4">
                <div className="flex flex-col gap-3 text-sm text-white md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        {footerLogoUrl && (
                            <div className="w-8 h-8 bg-brand rounded-lg overflow-hidden shadow-sm">
                                <img src={footerLogoUrl} alt="Footer logo" className="w-full h-full object-cover" />
                            </div>
                        )}
                        {footerText && <p className="text-2xl font-black leading-none text-white">{footerText}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-white">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Online
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-white" />
                            {enabledModuleCount} modules enabled
                        </span>
                        <span>{clientConfig.country}</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};
