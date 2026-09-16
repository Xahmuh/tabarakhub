import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Save,
  User,
  Building2,
  ShieldCheck,
  Wallet
} from 'lucide-react';
import Swal from 'sweetalert2';
import { pharmacistService, deliveryService, permissionService } from '../../services';
import {
  PharmacistAvatar,
  DriverAvatar,
  WorkerAvatar,
  ManagementAvatar
} from '../shared';

export interface EmployeeComplianceTarget {
  type: 'pharmacist' | 'driver' | 'user';
  id: string;
  name: string;
  code?: string | null;
  roleLabel: string;
  passportNumber?: string | null;
  ppExpiryDate?: string | null;
  wpExpiryDate?: string | null;
  fullName?: string | null;
  sponsor?: string | null;
  lmraMonthlyFee?: number | null;
}

interface EmployeeComplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: EmployeeComplianceTarget | null;
  onSaveSuccess: (updatedTarget: EmployeeComplianceTarget) => void;
}

export interface ExpiryStatus {
  status: 'none' | 'invalid' | 'expired' | 'expiring' | 'valid';
  label: string;
  days: number | null;
  badgeClass: string;
  pillClass: string;
  description: string;
}

export const getExpiryStatus = (dateStr?: string | null): ExpiryStatus => {
  if (!dateStr || !dateStr.trim()) {
    return {
      status: 'none',
      label: 'Not set',
      days: null,
      badgeClass: 'border-slate-200 bg-slate-50 text-slate-400',
      pillClass: 'bg-slate-100 text-slate-500',
      description: 'Expiry date not specified'
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);

  if (isNaN(targetDate.getTime())) {
    return {
      status: 'invalid',
      label: 'Invalid date',
      days: null,
      badgeClass: 'border-slate-200 bg-slate-50 text-slate-400',
      pillClass: 'bg-slate-100 text-slate-500',
      description: 'Invalid date format'
    };
  }

  const diffMs = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'expired',
      label: `Expired (${Math.abs(diffDays)}d ago)`,
      days: diffDays,
      badgeClass: 'border-red-200 bg-red-50 text-red-700 font-bold',
      pillClass: 'bg-red-500 text-white font-bold',
      description: `Expired ${Math.abs(diffDays)} days ago (Immediate renewal required)`
    };
  }

  if (diffDays <= 60) {
    return {
      status: 'expiring',
      label: `Expiring (${diffDays}d)`,
      days: diffDays,
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-800 font-bold',
      pillClass: 'bg-amber-500 text-white font-bold',
      description: `Expiring soon in ${diffDays} days (Attention recommended)`
    };
  }

  return {
    status: 'valid',
    label: `Valid (${diffDays}d)`,
    days: diffDays,
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800 font-medium',
    pillClass: 'bg-emerald-600 text-white font-medium',
    description: `Valid for ${diffDays} days`
  };
};

export const EmployeeComplianceModal: React.FC<EmployeeComplianceModalProps> = ({
  isOpen,
  onClose,
  target,
  onSaveSuccess
}) => {
  const [passportNumber, setPassportNumber] = useState('');
  const [ppExpiryDate, setPpExpiryDate] = useState('');
  const [wpExpiryDate, setWpExpiryDate] = useState('');
  const [fullName, setFullName] = useState('');
  const [sponsor, setSponsor] = useState('Tabarak Pharmacy W.L.L (CR: 71234)');
  const [lmraMonthlyFee, setLmraMonthlyFee] = useState<number | string>(10.0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setPassportNumber(target.passportNumber || '');
      setPpExpiryDate(target.ppExpiryDate || '');
      setWpExpiryDate(target.wpExpiryDate || '');
      setFullName(target.fullName || target.name || '');
      setSponsor(target.sponsor || 'Tabarak Pharmacy W.L.L (CR: 71234)');
      setLmraMonthlyFee(target.lmraMonthlyFee ?? 10.0);
    }
  }, [target]);

  if (!isOpen || !target) return null;

  const ppStatus = getExpiryStatus(ppExpiryDate);
  const wpStatus = getExpiryStatus(wpExpiryDate);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const cleanPassport = passportNumber.trim() || null;
      const cleanPpExpiry = ppExpiryDate.trim() || null;
      const cleanWpExpiry = wpExpiryDate.trim() || null;
      const cleanFullName = fullName.trim() || target.name;
      const cleanSponsor = sponsor.trim() || 'Tabarak Pharmacy W.L.L (CR: 71234)';
      const cleanFee = Number(lmraMonthlyFee) || 10.0;

      if (target.type === 'pharmacist') {
        await pharmacistService.upsert({
          id: target.id,
          name: cleanFullName,
          code: target.code || undefined,
          passportNumber: cleanPassport,
          ppExpiryDate: cleanPpExpiry,
          wpExpiryDate: cleanWpExpiry,
          sponsor: cleanSponsor,
          lmraMonthlyFee: cleanFee
        });
      } else if (target.type === 'driver') {
        await deliveryService.drivers.upsert({
          id: target.id,
          name: cleanFullName,
          passportNumber: cleanPassport,
          ppExpiryDate: cleanPpExpiry,
          wpExpiryDate: cleanWpExpiry,
          sponsor: cleanSponsor,
          lmraMonthlyFee: cleanFee
        });
      } else if (target.type === 'user') {
        await permissionService.adminUpdateUserCompliance(target.id, {
          passportNumber: cleanPassport,
          ppExpiryDate: cleanPpExpiry,
          wpExpiryDate: cleanWpExpiry,
          fullName: cleanFullName,
          sponsor: cleanSponsor,
          lmraMonthlyFee: cleanFee
        });
      }

      const updated: EmployeeComplianceTarget = {
        ...target,
        name: cleanFullName,
        fullName: cleanFullName,
        passportNumber: cleanPassport,
        ppExpiryDate: cleanPpExpiry,
        wpExpiryDate: cleanWpExpiry,
        sponsor: cleanSponsor,
        lmraMonthlyFee: cleanFee
      };

      onSaveSuccess(updated);

      Swal.fire({
        title: 'LMRA EMS Data Saved',
        text: `Updated LMRA EMS compliance records for ${cleanFullName}.`,
        icon: 'success',
        timer: 1800,
        showConfirmButton: false
      });

      onClose();
    } catch (err: any) {
      console.error('Failed to update employee compliance:', err);
      Swal.fire({
        title: 'Save Failed',
        text: err?.message || 'Failed to update LMRA EMS compliance data.',
        icon: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderAvatar = () => {
    if (target.type === 'driver') return <DriverAvatar size="sm" />;
    if (target.type === 'pharmacist') return <PharmacistAvatar size="sm" />;
    if (target.roleLabel.toLowerCase().includes('manage')) return <ManagementAvatar size="sm" />;
    return <WorkerAvatar size="sm" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
          <div className="flex items-center gap-3">
            {renderAvatar()}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-slate-900">
                  Employee Edit
                </h3>
                <span className="rounded bg-brand/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand">
                  {target.roleLabel}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  تعديل بيانات الموظف
                </span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                {target.name} {target.code ? `(${target.code})` : ''} • Workforce Directory • LMRA EMS Sponsor & Financial Data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            title="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-left max-h-[80vh] overflow-y-auto">
          {/* Full Name */}
          <div>
            <label className="mb-1 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-700">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-400" />
                Employee Name (اسم الموظف)
              </span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-bold text-slate-900 outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {/* LMRA EMS Sponsor & Financial Data Container */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  LMRA EMS Sponsor & Financial Data (بيانات الكفيل وهيئة تنظيم سوق العمل)
                </h4>
              </div>
              <span className="rounded bg-blue-100/70 px-2 py-0.5 text-[9px] font-black uppercase text-blue-800">
                Bahrain Standard
              </span>
            </div>

            {/* Sponsor / Company CR */}
            <div>
              <label className="mb-1 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-500" />
                  Sponsor / Company CR (الكفيل / السجل التجاري)
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Registered Sponsor</span>
              </label>
              <input
                type="text"
                value={sponsor}
                onChange={e => setSponsor(e.target.value)}
                placeholder="e.g. Tabarak Pharmacy W.L.L (CR: 71234)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>

            {/* Side-by-Side: Passport Number & PP Expiry Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Passport Number */}
              <div>
                <label className="mb-1 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                    Passport Number (رقم الجواز)
                  </span>
                </label>
                <input
                  type="text"
                  value={passportNumber}
                  onChange={e => setPassportNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. A12345678"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 font-mono"
                />
              </div>

              {/* PP Expiry Date besides Passport Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    PP Expiry Date (انتهاء الجواز)
                  </label>
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[9px] ${ppStatus.badgeClass}`}>
                    {ppStatus.status === 'expired' && <ShieldAlert className="h-2.5 w-2.5" />}
                    {ppStatus.status === 'expiring' && <AlertTriangle className="h-2.5 w-2.5" />}
                    {ppStatus.status === 'valid' && <CheckCircle2 className="h-2.5 w-2.5" />}
                    {ppStatus.label}
                  </span>
                </div>
                <input
                  type="date"
                  value={ppExpiryDate}
                  onChange={e => setPpExpiryDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>

            {/* Side-by-Side: WP Expiry Date (Visa) & LMRA Monthly Fee */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* WP Expiry Date */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    WP Expiry Date (Visa Expiry / الفيزا)
                  </label>
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[9px] ${wpStatus.badgeClass}`}>
                    {wpStatus.status === 'expired' && <ShieldAlert className="h-2.5 w-2.5" />}
                    {wpStatus.status === 'expiring' && <AlertTriangle className="h-2.5 w-2.5" />}
                    {wpStatus.status === 'valid' && <CheckCircle2 className="h-2.5 w-2.5" />}
                    {wpStatus.label}
                  </span>
                </div>
                <input
                  type="date"
                  value={wpExpiryDate}
                  onChange={e => setWpExpiryDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              {/* LMRA Monthly Fee (Financials) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700">
                    <Wallet className="h-3.5 w-3.5 text-slate-500" />
                    LMRA Monthly Fee (رسوم العمل)
                  </label>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                    Active
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    value={lmraMonthlyFee}
                    onChange={e => setLmraMonthlyFee(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 pr-14"
                  />
                  <span className="absolute right-3 top-2 text-xs font-black text-slate-400">BHD</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-brand/90 transition disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Employee Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
