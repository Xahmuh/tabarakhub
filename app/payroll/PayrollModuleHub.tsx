import React, { useState } from 'react';
import { Banknote, Building2, Calculator, CalendarCheck, Coins, CreditCard, Download, FileSpreadsheet, FileText, Layers, ShieldCheck, Sparkles, Truck, Users, UsersRound, Wallet, Sliders } from 'lucide-react';
import { Branch, Role } from '../../types';
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
  checkPermission: _checkPermission
}) => {
  const role: Role = user.role;
  const isOwner = role === 'owner';
  const isAccounts = role === 'accounts';
  const isDriver = role === 'driver';
  const canViewCompanyPayroll = isOwner || isAccounts;

  const [activeTab, setActiveTab] = useState<PayrollTab>(isDriver ? 'driver-payroll' : 'staff-payroll');
  const [showAttendanceConfigModal, setShowAttendanceConfigModal] = useState<boolean>(false);

  const tabs: Array<{ id: PayrollTab; label: string; icon: React.ElementType; visible: boolean; badge?: string }> = [
    { id: 'staff-payroll', label: 'Staff & Pharmacist Payroll', icon: UsersRound, visible: canViewCompanyPayroll, badge: 'Live Scheduler' },
    { id: 'driver-payroll', label: 'Driver Payroll & Commissions', icon: Truck, visible: canViewCompanyPayroll || isDriver, badge: 'Active' },
    { id: 'salary-structure', label: 'Incentive & Rule Engine', icon: Calculator, visible: isOwner },
    { id: 'payroll-archive', label: 'Disbursal & Bank Exports', icon: FileSpreadsheet, visible: canViewCompanyPayroll }
  ];

  const visibleTabs = tabs.filter(t => t.visible);

  if (!canViewCompanyPayroll && !isDriver) {
    return (
      <div className="operational-panel p-6 text-sm text-slate-700">
        Payroll is restricted to Owner and Accounts.
        <BackToModulesButton onClick={onBack} />
      </div>
    );
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Enterprise HR &amp; Finance</p>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200">
              Payroll Preview
            </span>
          </div>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Payroll &amp; Incentive Engine</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Review payroll source records while salary rules, approval workflow, and bank transfer format are being finalized.
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
      {activeTab === 'staff-payroll' && canViewCompanyPayroll && (
        <StaffPayrollHub canEditRules={isOwner} />
      )}

      {/* Tab 2: Driver Payroll */}
      {activeTab === 'driver-payroll' && (canViewCompanyPayroll || isDriver) && (
        <DriverPayrollHub selfOnly={isDriver} />
      )}

      {/* Tab 3: Salary & Incentive Rules */}
      {activeTab === 'salary-structure' && isOwner && (
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
                  Driver commission and target rules require the company's approved payroll policy.
                </p>
                <div className="rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-700 space-y-1">
                  <p>No driver commission or punch penalty is authorized from these example values.</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                  <Building2 className="h-4 w-4 text-brand" /> Branch Pharmacist Tiers
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Shift bonuses, overtime, leave and insurance calculations need an approved rule set before payment.
                </p>
                <div className="rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-700 space-y-1">
                  <p>Rates shown in older previews are not approved payroll policy.</p>
                </div>
              </div>

              {/* Attendance & Geofencing Penalties Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                    <Sliders className="h-4 w-4 text-sky-600" /> Attendance Geofencing &amp; Disciplinary Penalties Engine
                  </div>
                  <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full font-bold">
                    Requires Policy Review
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Attendance and geofencing settings are under review. Attendance records must be verified and deductions separately approved before they affect payroll.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-600 font-bold">
                    Only approved deductions from the database may appear in the payroll estimate.
                  </div>
                  <button
                    type="button"
                    disabled
                    title="Monetary rules require owner entry and two-person approval."
                    className="btn-primary text-xs font-bold opacity-50 cursor-not-allowed"
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
      {activeTab === 'payroll-archive' && canViewCompanyPayroll && (
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
              Bank export and official payslips are unavailable until the payroll policy and dual approval workflow are implemented and verified.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-5 bg-white space-y-3">
                <h4 className="text-sm font-black text-slate-900">Bahrain Salary Transfer File (IBAN)</h4>
                <p className="text-xs text-slate-500 font-medium">Review the staff payroll estimate. No bank payment file can be exported yet.</p>
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
                <p className="text-xs text-slate-500 font-medium">Official payslips require an approved, published payroll run.</p>
                <button
                  type="button"
                  disabled
                  className="btn-secondary text-xs font-bold opacity-50 cursor-not-allowed"
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
