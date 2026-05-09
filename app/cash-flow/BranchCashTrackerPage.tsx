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
            <div className="max-w-[1600px] mx-auto px-6 md:px-12 py-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                    <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 bg-[#0f172A] rounded-[1.4rem] flex items-center justify-center text-white shadow-2xl shadow-[#0f172A]/20">
                            <Wallet size={28} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
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
                            className="px-8 py-4 bg-white border-2 border-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 hover:border-slate-200 transition-all font-black uppercase text-[10px] tracking-widest flex items-center space-x-2 shadow-sm"
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
