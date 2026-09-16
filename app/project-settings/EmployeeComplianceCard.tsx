import React from 'react';
import {
  FileText,
  Calendar,
  Clock,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Building2,
  ShieldCheck,
  Wallet
} from 'lucide-react';
import {
  PharmacistAvatar,
  DriverAvatar,
  WorkerAvatar,
  ManagementAvatar,
  type EmployeeRoleCategory
} from '../shared';
import { FleetVehiclePlate } from '../delivery/components/BahrainLicensePlate';
import { getExpiryStatus } from './EmployeeComplianceModal';

export interface EmployeeComplianceCardData {
  id: string;
  name: string;
  code?: string | null;
  roleCategory: EmployeeRoleCategory;
  roleLabel: string;
  branchName?: string | null;
  branchCode?: string | null;
  plateNumber?: string | null;
  passportNumber?: string | null;
  ppExpiryDate?: string | null;
  wpExpiryDate?: string | null;
  sponsor?: string | null;
  lmraMonthlyFee?: number | null;
  phone?: string | null;
}

interface EmployeeComplianceCardProps {
  employee: EmployeeComplianceCardData;
  onEdit: () => void;
  compact?: boolean;
}

export const EmployeeComplianceCard: React.FC<EmployeeComplianceCardProps> = ({
  employee,
  onEdit,
  compact = false
}) => {
  const ppStatus = getExpiryStatus(employee.ppExpiryDate);
  const wpStatus = getExpiryStatus(employee.wpExpiryDate);

  const renderRoleAvatar = () => {
    switch (employee.roleCategory) {
      case 'driver':
        return <DriverAvatar size={compact ? 'xs' : 'sm'} className="shrink-0" />;
      case 'pharmacist':
        return <PharmacistAvatar size={compact ? 'xs' : 'sm'} className="shrink-0" />;
      case 'management':
        return <ManagementAvatar size={compact ? 'xs' : 'sm'} className="shrink-0" />;
      case 'worker':
      default:
        return <WorkerAvatar size={compact ? 'xs' : 'sm'} className="shrink-0" />;
    }
  };

  const getRoleAccentColor = () => {
    switch (employee.roleCategory) {
      case 'driver':
        return 'border-brand/30 hover:border-brand bg-gradient-to-br from-white to-red-50/20';
      case 'pharmacist':
        return 'border-emerald-200 hover:border-emerald-500 bg-gradient-to-br from-white to-emerald-50/20';
      case 'management':
        return 'border-slate-300 hover:border-slate-800 bg-gradient-to-br from-white to-slate-50/40';
      case 'worker':
      default:
        return 'border-blue-200 hover:border-blue-500 bg-gradient-to-br from-white to-blue-50/20';
    }
  };

  const getRoleTagColor = () => {
    switch (employee.roleCategory) {
      case 'driver':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'pharmacist':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'management':
        return 'bg-slate-900 text-white border-slate-900';
      case 'worker':
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  if (compact) {
    return (
      <div
        onClick={onEdit}
        className={`group relative flex flex-col justify-between rounded-xl border p-3 shadow-2xs transition-all hover:shadow-md cursor-pointer ${getRoleAccentColor()}`}
        title="Click to open Employee Edit"
      >
        {/* Top: Avatar & Name */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {renderRoleAvatar()}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-900 truncate">
                  {employee.name}
                </span>
                {employee.code && (
                  <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] font-black uppercase text-slate-600">
                    {employee.code}
                  </span>
                )}
              </div>
              {employee.plateNumber && (
                <div className="mt-1">
                  <FleetVehiclePlate plateNumber={employee.plateNumber} size="xs" />
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onEdit();
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-brand/20 bg-brand/5 px-2 py-1 text-[9.5px] font-black text-brand hover:bg-brand/10 transition shadow-2xs shrink-0"
            title="Employee Edit"
          >
            <Edit2 className="h-2.5 w-2.5" />
            <span>Employee Edit</span>
          </button>
        </div>

        {/* LMRA EMS Sponsor & Financial Data Row */}
        <div className="mt-2.5 grid grid-cols-1 gap-1.5 border-t border-slate-100 pt-2">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1 text-slate-700">
              <ShieldCheck className="h-3 w-3 text-blue-600" />
              LMRA EMS Sponsor & Financial Data
            </span>
            <span className="text-emerald-700 bg-emerald-50 rounded px-1 text-[8.5px] font-black">Active</span>
          </div>

          {/* Sponsor */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1 font-bold text-slate-500">
              <Building2 className="h-3 w-3 text-slate-400" />
              Sponsor:
            </span>
            <span className="font-bold text-slate-800 truncate max-w-[140px]" title={employee.sponsor || 'Tabarak Pharmacy W.L.L'}>
              {employee.sponsor || 'Tabarak Pharmacy W.L.L'}
            </span>
          </div>

          {/* Passport */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1 font-bold text-slate-500">
              <FileText className="h-3 w-3 text-slate-400" />
              Passport:
            </span>
            <span className="font-mono font-bold text-slate-800">
              {employee.passportNumber || 'Pending'}
            </span>
          </div>

          {/* PP Expiry Date */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1 font-bold text-slate-500">
              <Calendar className="h-3 w-3 text-slate-400" />
              PP Expiry Date:
            </span>
            {employee.ppExpiryDate ? (
              <span className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.2 text-[9.5px] ${ppStatus.badgeClass}`}>
                {ppStatus.status === 'expired' && <ShieldAlert className="h-2.5 w-2.5" />}
                {ppStatus.status === 'expiring' && <AlertTriangle className="h-2.5 w-2.5" />}
                {ppStatus.status === 'valid' && <CheckCircle2 className="h-2.5 w-2.5" />}
                {employee.ppExpiryDate}
              </span>
            ) : (
              <span className="text-slate-400 text-[9px]">Not set</span>
            )}
          </div>

          {/* WP Expiry Date */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1 font-bold text-slate-500">
              <Clock className="h-3 w-3 text-slate-400" />
              WP Expiry Date (Visa):
            </span>
            {employee.wpExpiryDate ? (
              <span className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.2 text-[9.5px] ${wpStatus.badgeClass}`}>
                {wpStatus.status === 'expired' && <ShieldAlert className="h-2.5 w-2.5" />}
                {wpStatus.status === 'expiring' && <AlertTriangle className="h-2.5 w-2.5" />}
                {wpStatus.status === 'valid' && <CheckCircle2 className="h-2.5 w-2.5" />}
                {employee.wpExpiryDate}
              </span>
            ) : (
              <span className="text-slate-400 text-[9px]">Not set</span>
            )}
          </div>

          {/* LMRA Monthly Fee */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1 font-bold text-slate-500">
              <Wallet className="h-3 w-3 text-slate-400" />
              LMRA Monthly:
            </span>
            <span className="font-mono font-bold text-slate-800">
              {employee.lmraMonthlyFee ? `${employee.lmraMonthlyFee.toFixed(3)} BHD` : '10.000 BHD'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Full-size Standalone Employee Card (For directory grid)
  return (
    <article
      onClick={onEdit}
      className={`group relative flex flex-col justify-between rounded-2xl border p-4 shadow-xs transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer ${getRoleAccentColor()}`}
    >
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            {renderRoleAvatar()}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-black tracking-tight text-slate-950 truncate">
                  {employee.name}
                </h4>
                {employee.code && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-700">
                    {employee.code}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider ${getRoleTagColor()}`}>
                  {employee.roleLabel}
                </span>
                {employee.branchName && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500">
                    <Building2 className="h-3 w-3 text-slate-400" />
                    {employee.branchName} {employee.branchCode ? `(${employee.branchCode})` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onEdit();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand/20 bg-brand/5 px-3 py-1.5 text-xs font-black text-brand hover:bg-brand/10 transition shadow-xs shrink-0"
            title="Employee Edit"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Employee Edit</span>
          </button>
        </div>

        {/* Vehicle Plate (if driver) */}
        {employee.plateNumber && (
          <div className="mt-3 flex items-center justify-between bg-slate-50 rounded-xl p-2.5 border border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Fleet Vehicle:
            </span>
            <FleetVehiclePlate plateNumber={employee.plateNumber} size="sm" />
          </div>
        )}

        {/* LMRA EMS Sponsor & Financial Data Section */}
        <div className="mt-3 space-y-2.5 rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                LMRA EMS Sponsor & Financial Data
              </h5>
            </div>
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-blue-700">
              EMS Verified
            </span>
          </div>

          {/* Sponsor / CR */}
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-bold text-slate-600 text-[11px]">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              Sponsor / Company CR
            </span>
            <span className="text-xs font-bold text-slate-800 truncate max-w-[190px]" title={employee.sponsor || 'Tabarak Pharmacy W.L.L (CR: 71234)'}>
              {employee.sponsor || 'Tabarak Pharmacy W.L.L (CR: 71234)'}
            </span>
          </div>

          {/* Passport Number */}
          <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-600 text-[11px]">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              Passport Number
            </span>
            <span className="font-mono text-xs font-black uppercase text-slate-900">
              {employee.passportNumber || 'Pending'}
            </span>
          </div>

          {/* PP Expiry Date */}
          <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-600 text-[11px]">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              PP Expiry Date
            </span>
            {employee.ppExpiryDate ? (
              <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] ${ppStatus.badgeClass}`}>
                {ppStatus.status === 'expired' && <ShieldAlert className="h-3 w-3" />}
                {ppStatus.status === 'expiring' && <AlertTriangle className="h-3 w-3" />}
                {ppStatus.status === 'valid' && <CheckCircle2 className="h-3 w-3" />}
                {employee.ppExpiryDate} ({ppStatus.label})
              </span>
            ) : (
              <span className="text-slate-400 text-xs font-medium">Not set</span>
            )}
          </div>

          {/* WP Expiry Date */}
          <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-600 text-[11px]">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              WP Expiry Date (Visa Expiry)
            </span>
            {employee.wpExpiryDate ? (
              <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] ${wpStatus.badgeClass}`}>
                {wpStatus.status === 'expired' && <ShieldAlert className="h-3 w-3" />}
                {wpStatus.status === 'expiring' && <AlertTriangle className="h-3 w-3" />}
                {wpStatus.status === 'valid' && <CheckCircle2 className="h-3 w-3" />}
                {employee.wpExpiryDate} ({wpStatus.label})
              </span>
            ) : (
              <span className="text-slate-400 text-xs font-medium">Not set</span>
            )}
          </div>

          {/* Financial Data / Monthly LMRA Fees */}
          <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-600 text-[11px]">
              <Wallet className="h-3.5 w-3.5 text-slate-400" />
              LMRA Monthly Fee (Financials)
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              {employee.lmraMonthlyFee ? `${employee.lmraMonthlyFee.toFixed(3)} BHD / Mo` : '10.000 BHD / Mo (Active)'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Quick Action */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] font-bold text-slate-400">
        <span>Click card to update compliance</span>
        <span className="font-black uppercase tracking-wider text-brand group-hover:underline">
          Edit Details →
        </span>
      </div>
    </article>
  );
};
