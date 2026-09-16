import React, { useState } from 'react';
import { Banknote, Building2, Calculator, CalendarCheck, Coins, CreditCard, Download, FileSpreadsheet, FileText, Layers, ShieldCheck, Sparkles, Truck, Users, UsersRound, Wallet, Sliders } from 'lucide-react';
import { Branch, Role } from '../../types';
import { isManagerRole } from '../../lib/access';
import { DriverPayrollHub } from '../delivery/DriverPayrollHub';
import { StaffPayrollHub } from './StaffPayrollHub';
import { AttendancePenaltyConfigPanel } from '../attendance/AttendancePenaltyConfigPanel';
import { BackToModulesButton } from '../shared';

type PayrollTab = 'staff-payroll' | 'driver-payroll' | 'salary-structure' | 'payroll-archive';

interface PayrollModuleHubProps {
  user: Branch;
  onBack: () => void;
  checkPermission: (feature: string, minimum?: 'edit' | 'read') => boolean;
}

export const PayrollModuleHub: React.FC<PayrollModuleHubProps> = ({
  user,
  onBack,
  checkPermission
}) => {
  const role: Role = user.role;
  const isManager = isManagerRole(role);
  const isOwner = role === 'owner';
  const isDriver = role === 'driver';
  const isBranch = role === 'branch';

  const [activeTab, setActiveTab] = useState<PayrollTab>(isDriver ? 'driver-payroll' : 'staff-payroll');
  const [showAttendanceConfigModal, setShowAttendanceConfigModal] = useState<boolean>(false);

  const tabs: Array<{ id: PayrollTab; label: string; icon: React.ElementType; visible: boolean; badge?: string }> = [
    { id: 'staff-payroll', label: 'Staff & Pharmacist Payroll', icon: UsersRound, visible: !isDriver, badge: 'Live Scheduler' },
    { id: 'driver-payroll', label: 'Driver Payroll & Commissions', icon: Truck, visible: true, badge: 'Active' },
    { id: 'salary-structure', label: 'Incentive & Rule Engine', icon: Calculator, visible: isManager || isOwner },
    { id: 'payroll-archive', label: 'Disbursal & Bank Exports', icon: FileSpreadsheet, visible: isManager || isOwner }
  ];

  const visibleTabs = tabs.filter(t => t.visible);

  return (
    <div className="space-y-6 page-enter">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Enterprise HR &amp; Finance</p>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200">
              Cross-Module Integrated
            </span>
          </div>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Payroll &amp; Incentive Engine</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Automated monthly pharmacist compensation, scheduler relief hours, delivery volume commissions, and official Bahrain IBAN transfers.
          </p>
        </div>
        <BackToModulesButton onClick={onBack} />
      </div>

      {/* Tab Switcher */}
      {visibleTabs.length > 1 && (
        <div className="flex bg-slate-100/60 p-1 rounded-lg border border-slate-200/50 w-fit max-w-full overflow-x-auto print:hidden">
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-md text-xs font-bold transition-all ${
                activeTab === t.id ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
              {t.badge && (
                <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded font-black ${
                  activeTab === t.id ? 'bg-brand/10 text-brand' : 'bg-slate-200 text-slate-600'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tab 1: Staff & Pharmacist Payroll */}
      {activeTab === 'staff-payroll' && !isDriver && (
        <StaffPayrollHub />
      )}

      {/* Tab 2: Driver Payroll */}
      {activeTab === 'driver-payroll' && (
        <DriverPayrollHub selfOnly={isDriver} />
      )}

      {/* Tab 3: Salary & Incentive Rules */}
      {activeTab === 'salary-structure' && (isManager || isOwner) && (
        <div className="space-y-6">
          <div className="operational-panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-brand">Rules Engine</p>
                <h3 className="text-lg font-black text-slate-950">Enterprise Incentive &amp; Commission Tiers</h3>
              </div>
              <Sparkles className="h-6 w-6 text-brand" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                  <Truck className="h-4 w-4 text-brand" /> Driver Delivery Tiers
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Set baseline per-order delivery commission rates (e.g. 0.400 BHD per actual delivery) and monthly delivery count thresholds for target bonuses.
                </p>
                <div className="rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-700 space-y-1">
                  <p>• Standard Commission: <span className="text-brand">0.400 BHD / order</span></p>
                  <p>• Monthly Target Bonus: <span className="text-emerald-700">40.000 BHD (at 250 orders)</span></p>
                  <p>• Missing Punch Penalty: <span className="text-amber-700">5.000 BHD per punch</span></p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                  <Building2 className="h-4 w-4 text-brand" /> Branch Pharmacist Tiers
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Configure branch sales commission percentages, shift attendance bonuses, and overtime multipliers for branch personnel.
                </p>
                <div className="rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-700 space-y-1">
                  <p>• License Allowance: <span className="text-brand">50.000 BHD / month</span></p>
                  <p>• Overtime Multiplier: <span className="text-emerald-700">1.25× Hourly Rate</span></p>
                  <p>• Attendance Grace Period: <span className="text-sky-700 font-black">5 Minutes (Configurable)</span></p>
                </div>
              </div>

              {/* Attendance & Geofencing Penalties Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                    <Sliders className="h-4 w-4 text-sky-600" /> Attendance Geofencing &amp; Disciplinary Penalties Engine
                  </div>
                  <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full font-bold">
                    Bahrain Labor Law
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Authoritative attendance tracking with GPS geofencing radius, tiered lateness/absence deductions, and grace period calculations feeding directly into net salary deductions.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-600 font-bold">
                    Deductions auto-populate into Staff Payroll net payable calculations.
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAttendanceConfigModal(true)}
                    className="btn-primary text-xs font-bold bg-sky-600 hover:bg-sky-500"
                  >
                    <Sliders className="h-3.5 w-3.5" /> Configure Attendance &amp; Penalties Rules
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Config Modal (Fixed Wide Size) */}
      {showAttendanceConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="w-full max-w-[96vw] 2xl:max-w-[1550px] h-[88vh] min-h-[620px] max-h-[88vh] flex flex-col my-auto transition-all duration-200">
            <AttendancePenaltyConfigPanel onClose={() => setShowAttendanceConfigModal(false)} />
          </div>
        </div>
      )}

      {/* Tab 4: Disbursal & Bank Archives */}
      {activeTab === 'payroll-archive' && (isManager || isOwner) && (
        <div className="space-y-6">
          <div className="operational-panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-brand">Bank &amp; Accounting Export</p>
                <h3 className="text-lg font-black text-slate-950">Payroll Disbursal Archives</h3>
              </div>
              <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            </div>

            <p className="text-xs font-medium text-slate-500">
              Generate standardized Excel disbursal files formatted for Bahrain bank salary transfers (IBAN salary batch files) and accounting software integration.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-5 bg-white space-y-3">
                <h4 className="text-sm font-black text-slate-900">Bahrain Salary Transfer File (IBAN)</h4>
                <p className="text-xs text-slate-500 font-medium">Consolidated payout list with driver codes, IBAN numbers, and net BHD amounts.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('staff-payroll')}
                  className="btn-primary text-xs font-bold"
                >
                  <Download className="h-3.5 w-3.5" /> Open Staff &amp; Pharmacist IBAN Batch
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 p-5 bg-white space-y-3">
                <h4 className="text-sm font-black text-slate-900">Bulk Payslip PDF Export</h4>
                <p className="text-xs text-slate-500 font-medium">Export itemized payslips for all drivers and employees for the active month.</p>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-secondary text-xs font-bold"
                >
                  <CreditCard className="h-3.5 w-3.5" /> Batch Print All Payslips
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
