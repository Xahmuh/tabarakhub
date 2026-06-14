import React from 'react';
import { BranchCashDifferenceTracker } from './BranchCashDifferenceTracker';
import { Role } from '../../types';
import { BackToModulesButton } from '../shared';

interface BranchCashTrackerPageProps {
    onBack: () => void;
    branchId?: string;
    userRole?: Role;
    pharmacistName?: string;
}

export const BranchCashTrackerPage: React.FC<BranchCashTrackerPageProps> = ({
    onBack,
    branchId,
    userRole = 'branch',
    pharmacistName
}) => {
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-[1600px] px-5 py-8 md:px-8">
                {/* Header Section */}
                <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Finance module</p>
                        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                            Branch Cash Discrepancies
                        </h1>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                            Log and reconcile daily differences between POS cash and drawer count.
                        </p>
                    </div>

                    <BackToModulesButton onClick={onBack} />
                </div>

                {/* Main Content */}
                <BranchCashDifferenceTracker
                    key={branchId || 'no-branch'} // Force remount when branchId changes
                    branchId={branchId}
                    role={userRole}
                    pharmacistName={pharmacistName}
                />
            </div>
        </div>
    );
};
