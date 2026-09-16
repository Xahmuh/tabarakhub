import React, { useState, useMemo } from 'react';
import { CheckCircle2, AlertCircle, X, Clock, Calendar, ShieldCheck, Banknote, CreditCard, UserCheck, Shield } from 'lucide-react';
import Swal from 'sweetalert2';
import { OperationalRenewalRecord, WPDurationMonths } from '../../types';
import { operationalRenewalService, lookupTariff } from '../../services/operationalRenewalService';

interface MarkRenewedModalProps {
  record: OperationalRenewalRecord;
  currentUser?: { id?: string; name?: string; code?: string; role?: string };
  onClose: () => void;
  onSuccess: (updated: OperationalRenewalRecord) => void;
}

export const MarkRenewedModal: React.FC<MarkRenewedModalProps> = ({
  record,
  currentUser,
  onClose,
  onSuccess
}) => {
  const isWorkPermit = record.renewalType === 'WORK_PERMIT';
  const initialDuration: WPDurationMonths = (record.renewalDurationMonths as WPDurationMonths) || 12;

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper to add exact months to a YYYY-MM-DD date string with proper day overflow handling
  const addMonthsToDate = (baseDateStr?: string, monthsToAdd = 12): string => {
    try {
      const base = (baseDateStr && baseDateStr.trim()) ? baseDateStr.split('T')[0] : todayStr;
      const parts = base.split('-').map(Number);
      if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        throw new Error('Invalid date');
      }

      const year = parts[0];
      const monthIndex = parts[1] - 1; // 0-11
      const day = parts[2];

      const totalMonths = monthIndex + monthsToAdd;
      const targetYear = year + Math.floor(totalMonths / 12);
      const targetMonthIndex = ((totalMonths % 12) + 12) % 12;

      // Calculate days in target month (day 0 of month+1 gives last day of month)
      const daysInTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
      const targetDay = Math.min(day, daysInTargetMonth);

      return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
    } catch {
      const d = new Date();
      d.setMonth(d.getMonth() + monthsToAdd);
      return d.toISOString().split('T')[0];
    }
  };

  const [selectedDurationMonths, setSelectedDurationMonths] = useState<number | undefined>(
    isWorkPermit ? initialDuration : 12
  );
  const [newIssueDate, setNewIssueDate] = useState(todayStr);
  const [newExpiryDate, setNewExpiryDate] = useState(
    addMonthsToDate(record.expiryDate, isWorkPermit ? initialDuration : 12)
  );
  const [newDocumentNumber, setNewDocumentNumber] = useState(record.documentNumber);
  const [notes, setNotes] = useState('');

  // 3 Official Work Permit Duration Tiers with Dynamic Tariff Costs
  const wpOptions = useMemo(() => {
    const durations: Array<{ months: WPDurationMonths; labelEn: string; sublabel: string }> = [
      { months: 6, labelEn: '6 Months', sublabel: 'Half Year' },
      { months: 12, labelEn: '12 Months (1 Year)', sublabel: '1 Year' },
      { months: 24, labelEn: '24 Months (2 Years)', sublabel: '2-Year Extended' }
    ];

    return durations.map(item => {
      const tariff = lookupTariff({
        renewalType: 'WORK_PERMIT',
        durationMonths: item.months,
        entityName: record.entityName,
        documentNumber: record.documentNumber,
        branchCode: record.branchId,
        branchName: record.branchName
      });
      return {
        ...item,
        cost: tariff.cost
      };
    });
  }, [record]);

  // Initial lookup tariff for non-WP or default
  const defaultTariff = useMemo(() => {
    return lookupTariff({
      renewalType: record.renewalType,
      durationMonths: selectedDurationMonths || 12,
      entityName: record.entityName,
      documentNumber: record.documentNumber,
      branchCode: record.branchId,
      branchName: record.branchName
    });
  }, [record, selectedDurationMonths]);

  // Payment Settlement States
  const [recordPayment, setRecordPayment] = useState(true);
  const [actualCost, setActualCost] = useState<number>(
    record.estimatedCost !== undefined ? record.estimatedCost : (defaultTariff.cost || 0)
  );
  const [paidAt, setPaidAt] = useState(todayStr);
  const [paymentMethod, setPaymentMethod] = useState('BenefitPay');
  const [paymentReference, setPaymentReference] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Actor display info
  const actorName = currentUser?.name || 'User';
  const isAdmin = actorName.toLowerCase().startsWith('admin');
  const isAccounts = actorName.toLowerCase().startsWith('accounts');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpiryDate) {
      setErrorMsg('Please enter the new expiration date.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const updated = await operationalRenewalService.completeRenewal(
        record.id,
        {
          newExpiryDate,
          newIssueDate,
          newDocumentNumber: newDocumentNumber.trim() !== record.documentNumber ? newDocumentNumber.trim() : undefined,
          notes: notes.trim() || undefined,
          renewalDurationMonths: selectedDurationMonths,
          settlePayment: recordPayment,
          actualCost: recordPayment ? Number(actualCost) : undefined,
          paidAt: recordPayment ? paidAt : undefined,
          paymentMethod: recordPayment ? paymentMethod : undefined,
          paymentReference: recordPayment && paymentReference.trim() ? paymentReference.trim() : undefined
        },
        currentUser
      );

      await Swal.fire({
        icon: 'success',
        title: 'Renewal Confirmed & Archived',
        html: `
          <div style="font-size: 13px; line-height: 1.6; text-align: start; padding: 4px;">
            <p><strong>Entity:</strong> ${record.entityName}</p>
            <p><strong>New Expiry:</strong> <span style="font-weight: 800; color: #059669; font-family: monospace;">${newExpiryDate}</span></p>
            ${recordPayment ? `
              <div style="margin-top: 8px; padding: 8px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px;">
                <p><strong>Amount Paid:</strong> <span style="font-weight: 800; color: #047857; font-family: monospace;">${Number(actualCost).toFixed(3)} BHD</span></p>
                <p><strong>Payment Date:</strong> ${paidAt}</p>
                <p><strong>Method:</strong> ${paymentMethod} ${paymentReference ? `(Ref: ${paymentReference})` : ''}</p>
              </div>
            ` : ''}
            <p style="color: #475569; font-size: 11px; margin-top: 8px;">
              <strong>Performed By:</strong> <span style="color: #0284c7; font-weight: 700;">${actorName}</span>
            </p>
            <p style="color: #059669; font-size: 12px; margin-top: 6px; font-weight: 600;">✓ Extended successfully, synchronized with master profile, and permanently archived in renewal ledger.</p>
          </div>
        `,
        timer: 3500,
        timerProgressBar: true,
        confirmButtonText: 'OK',
        confirmButtonColor: '#059669'
      });

      onSuccess(updated);
    } catch (err: any) {
      console.error('Failed to mark renewal completed:', err);
      setErrorMsg(err?.message || 'Failed to complete renewal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto my-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shadow-xs">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-900">Mark as Renewed</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Extend license/permit period and preserve previous expiration history into the audit log.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Record Context Card - 3 Columns in Wide Mode */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block font-bold text-[11px] mb-0.5">Entity Name:</span>
              <span className="font-black text-slate-900 text-sm block">{record.entityName}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold text-[11px] mb-0.5">Document Type & Number:</span>
              <span className="font-mono font-bold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs inline-block">
                {record.documentType} ({record.documentNumber})
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold text-[11px] mb-0.5">Current Expiry:</span>
              <span className="font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 text-xs inline-block">
                {record.expiryDate}
              </span>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Work Permit 3 Duration Options Section */}
          {isWorkPermit && (
            <div className="p-4 bg-gradient-to-br from-indigo-50/70 via-indigo-50/40 to-slate-50 rounded-2xl border border-indigo-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950">
                      Work Permit Duration Options
                    </h4>
                    <p className="text-[10px] text-indigo-600/80 font-medium">
                      Select duration to auto-calculate the new expiration date and apply the official tariff fee.
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-black text-indigo-800 bg-indigo-100/90 border border-indigo-200/80 px-2.5 py-0.5 rounded-full">
                  {selectedDurationMonths ? `${selectedDurationMonths} Months Selected` : 'Manual Date'}
                </span>
              </div>

              {/* 3 Work Permit Duration Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {wpOptions.map(opt => {
                  const isSelected = selectedDurationMonths === opt.months;
                  return (
                    <button
                      key={opt.months}
                      type="button"
                      onClick={() => {
                        setSelectedDurationMonths(opt.months);
                        setNewExpiryDate(addMonthsToDate(record.expiryDate, opt.months));
                        setActualCost(opt.cost);
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-500/30 -translate-y-0.5'
                          : 'bg-white hover:bg-indigo-50/40 text-slate-800 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/20 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Active</span>
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <div className="text-xs font-black tracking-tight">
                          {opt.labelEn}
                        </div>
                        <div className={`text-[11px] font-bold ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                          Duration: <span className="font-semibold">{opt.sublabel}</span>
                        </div>
                      </div>

                      <div className={`mt-2.5 pt-2 border-t flex items-center justify-between text-xs font-mono font-black ${
                        isSelected ? 'border-white/20 text-white' : 'border-slate-100 text-indigo-900'
                      }`}>
                        <span className="text-[10px] font-sans font-bold opacity-80">Tariff Fee:</span>
                        <span className="text-sm">{opt.cost.toFixed(3)} BHD</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dates Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* New Issue Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  New Issue Date
                </label>
                <button
                  type="button"
                  onClick={() => setNewIssueDate(todayStr)}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-800 underline"
                >
                  Today
                </button>
              </div>
              <input
                type="date"
                value={newIssueDate}
                onChange={e => setNewIssueDate(e.target.value)}
                className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand font-mono"
              />
            </div>

            {/* New Expiry Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  New Expiry Date *
                </label>

                {/* Quick Presets for non-Work Permit items */}
                {!isWorkPermit && (
                  <div className="flex items-center gap-1">
                    {[
                      { months: 6, labelEn: '+6M' },
                      { months: 12, labelEn: '+1Y' },
                      { months: 24, labelEn: '+2Y' }
                    ].map(p => {
                      const isSelected = selectedDurationMonths === p.months;
                      return (
                        <button
                          key={p.months}
                          type="button"
                          onClick={() => {
                            setSelectedDurationMonths(p.months);
                            setNewExpiryDate(addMonthsToDate(record.expiryDate, p.months));
                          }}
                          className={`text-[10px] font-black px-2 py-0.5 rounded-lg border transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                          title={`Extend ${p.labelEn}`}
                        >
                          {p.labelEn}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <input
                type="date"
                required
                value={newExpiryDate}
                onChange={e => {
                  setNewExpiryDate(e.target.value);
                  setSelectedDurationMonths(undefined); // user manually selected custom date
                }}
                className="w-full text-xs font-black text-emerald-900 bg-emerald-50/60 border border-emerald-300 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono shadow-2xs"
              />

              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                <span>Calculated Expiry: <strong className="text-emerald-700 font-mono">{newExpiryDate || '—'}</strong></span>
                {selectedDurationMonths && (
                  <span className="text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                    +{selectedDurationMonths} Months
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Document Number */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
              Document Number (if renewed with new number)
            </label>
            <input
              type="text"
              value={newDocumentNumber}
              onChange={e => setNewDocumentNumber(e.target.value)}
              placeholder="e.g. 127506-01 or WP-12345"
              className="w-full text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>

          {/* Payment Settlement Section */}
          <div className="bg-emerald-50/50 rounded-2xl border border-emerald-200/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center">
                  <Banknote className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                    Fee Settlement & Payment Log (تسجيل سداد الرسوم)
                  </h4>
                  <p className="text-[10px] text-emerald-700/80 font-medium">
                    Record amount paid, date of settlement, and archive transaction with financial ledger.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={recordPayment}
                  onChange={e => setRecordPayment(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-emerald-900">Record Payment</span>
              </label>
            </div>

            {recordPayment && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                {/* Amount Paid */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Amount Paid (BHD) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      required={recordPayment}
                      value={actualCost}
                      onChange={e => setActualCost(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-black font-mono text-emerald-950 bg-white border border-emerald-300 rounded-xl pl-3 pr-10 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
                    />
                    <span className="absolute right-2.5 top-2 text-[10px] font-mono font-bold text-emerald-600">
                      BD
                    </span>
                  </div>
                </div>

                {/* Payment Date */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Payment Date *
                    </label>
                    <button
                      type="button"
                      onClick={() => setPaidAt(todayStr)}
                      className="text-[9px] font-bold text-emerald-700 hover:underline"
                    >
                      Today
                    </button>
                  </div>
                  <input
                    type="date"
                    required={recordPayment}
                    value={paidAt}
                    onChange={e => setPaidAt(e.target.value)}
                    className="w-full text-xs font-bold font-mono text-slate-800 bg-white border border-emerald-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-emerald-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
                  >
                    <option value="BenefitPay">BenefitPay (Fawri+)</option>
                    <option value="Credit Card">Credit / Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer (Fawri)</option>
                    <option value="Portal Direct">eGovernment Portal</option>
                    <option value="Cheque">Corporate Cheque</option>
                    <option value="Petty Cash">Branch Petty Cash</option>
                    <option value="Other">Other / Cash</option>
                  </select>
                </div>

                {/* Reference / Receipt */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Receipt / Txn Ref #
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={e => setPaymentReference(e.target.value)}
                    placeholder="e.g. TRX-90182 or Rec #112"
                    className="w-full text-xs font-medium text-slate-800 bg-white border border-emerald-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Operator Audit Signature Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${
                isAdmin
                  ? 'bg-purple-100 text-purple-700'
                  : isAccounts
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700'
              }`}>
                {isAdmin ? <Shield className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                  Audit Signature (مسجل العملية)
                </span>
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <span>{actorName}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider ${
                    isAdmin
                      ? 'bg-purple-600 text-white'
                      : isAccounts
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-200 text-slate-800'
                  }`}>
                    {isAdmin ? 'ADMINISTRATOR' : isAccounts ? 'ACCOUNTS / FINANCE' : 'AUTHORIZED USER'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Permanent audit log with account & role stamp
            </div>
          </div>

          {/* Renewal Notes */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
              Renewal Notes & Reference
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Successfully renewed via official portal. Reference #98421."
              className="w-full text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>

          <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
            <Clock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <p>
              <strong>Audit Guarantee:</strong> The current expiry date ({record.expiryDate}) and details will be permanently archived in the renewal history table.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !newExpiryDate}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{saving ? 'Processing Renewal...' : 'Confirm Renewal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
