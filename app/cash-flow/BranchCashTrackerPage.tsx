import React from 'react';
import { Wallet, Landmark } from 'lucide-react';
import { BranchCashDifferenceTracker } from './BranchCashDifferenceTracker';
import { Role } from '../../types';

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
        <div className="min-h-screen bg-white">
            <div className="max-w-[1600px] mx-auto px-5 md:px-8 py-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-8">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-brand rounded-lg flex items-center justify-center text-white shadow-sm shadow-brand/10">
                            <Wallet size={24} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">
                                Branch Cash Discrepancies
                            </h1>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 italic">
                                Log and track daily cash discrepancies between POS and cash count
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        <button
                            onClick={onBack}
                            className="btn-secondary text-[10px] uppercase tracking-widest"
                        >
                            <span>Back to Operational Suite</span>
                        </button>
                    </div>
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
