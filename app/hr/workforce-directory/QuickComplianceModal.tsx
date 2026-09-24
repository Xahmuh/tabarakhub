import React from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, X, Check, Award, RefreshCw } from 'lucide-react';
import { VectorDriver } from './WorkforceVectors';

export interface QuickComplianceModalProps {
  quickComplianceEmp: any | null;
  isRtl: boolean;
  quickPassport: string;
  setQuickPassport: (val: string) => void;
  quickPpExpiry: string;
  setQuickPpExpiry: (val: string) => void;
  quickWpExpiry: string;
  setQuickWpExpiry: (val: string) => void;
  quickNhraLicense: string;
  setQuickNhraLicense: (val: string) => void;
  quickNhraExpiry: string;
  setQuickNhraExpiry: (val: string) => void;
  originalPpExpiry: string;
  originalWpExpiry: string;
  originalNhraExpiry: string;
  selectedPpPresetMonths: number | null;
  setSelectedPpPresetMonths: (val: number | null) => void;
  applyPpPreset: (months: number) => void;
  selectedWpPresetMonths: number | null;
  setSelectedWpPresetMonths: (val: number | null) => void;
  applyWpPreset: (months: number) => void;
  selectedNhraPresetMonths: number | null;
  setSelectedNhraPresetMonths: (val: number | null) => void;
  applyNhraPreset: (months: number) => void;
  quickComplianceLoading: boolean;
  getExpiryStatus: (dateStr: string | null | undefined, thresholdDays?: number) => any;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
}

export const QuickComplianceModal: React.FC<QuickComplianceModalProps> = ({
  quickComplianceEmp,
  isRtl,
  quickPassport,
  setQuickPassport,
  quickPpExpiry,
  setQuickPpExpiry,
  quickWpExpiry,
  setQuickWpExpiry,
  quickNhraLicense,
  setQuickNhraLicense,
  quickNhraExpiry,
  setQuickNhraExpiry,
  originalPpExpiry,
  originalWpExpiry,
  originalNhraExpiry,
  selectedPpPresetMonths,
  setSelectedPpPresetMonths,
  applyPpPreset,
  selectedWpPresetMonths,
  setSelectedWpPresetMonths,
  applyWpPreset,
  selectedNhraPresetMonths,
  setSelectedNhraPresetMonths,
  applyNhraPreset,
  quickComplianceLoading,
  getExpiryStatus,
  onClose,
  onSave
}) => {
  if (!quickComplianceEmp || typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight">
                {isRtl ? 'تعديل وثائق الامتثال والإقامة' : 'Quick Compliance & Expiry Editor'}
              </h3>
              <p className="text-[10px] text-slate-300 font-medium">
                {isRtl ? 'تعديل تواريخ الجواز والإقامة مباشرة' : 'Directly edit passport & work permit expiry'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Employee Summary Chip */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs overflow-hidden ${
              quickComplianceEmp.category === 'Driver'
                ? 'bg-red-500/10 border-red-300/80 text-red-600 ring-1 ring-red-500/20'
                : 'bg-white border-slate-200'
            }`}>
              {quickComplianceEmp.category === 'Driver' ? (
                <VectorDriver className="w-6 h-6 text-red-600" />
              ) : (
                <img src="/logo.jpg" alt={quickComplianceEmp.category} className="w-full h-full object-cover" />
              )}
            </div>
            <div>
              <span className="font-black text-xs text-slate-900 block">{quickComplianceEmp.full_name}</span>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                <span className="font-mono font-bold">{quickComplianceEmp.code}</span>
                <span>•</span>
                <span>CPR: {quickComplianceEmp.cpr_no || '-'}</span>
              </div>
            </div>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
            quickComplianceEmp.category === 'Pharmacist'
              ? 'bg-blue-600 text-white'
              : quickComplianceEmp.category === 'Driver'
              ? 'bg-emerald-600 text-white'
              : quickComplianceEmp.category === 'Worker'
              ? 'bg-amber-600 text-white'
              : 'bg-purple-600 text-white'
          }`}>
            {quickComplianceEmp.category}
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={onSave} className="p-5 space-y-4 text-xs">
          {/* 1. Passport Number */}
          <div>
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1">
              {isRtl ? 'رقم جواز السفر (Passport No):' : 'Passport Number (PP):'}
            </label>
            <input
              type="text"
              value={quickPassport}
              onChange={e => setQuickPassport(e.target.value)}
              placeholder={isRtl ? 'أدخل رقم الجواز...' : 'e.g. A12345678'}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all"
            />
          </div>

          {/* 2. PP Expiry Date */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                {isRtl ? 'تاريخ انتهاء الجواز (PP Expiry Date):' : 'Passport Expiry Date (PP Expiry):'}
              </label>
              {(() => {
                const st = getExpiryStatus(quickPpExpiry, 60);
                if (!st) return null;
                return (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${st.color}`}>
                    {isRtl ? st.badgeTextAr : st.badgeText}
                  </span>
                );
              })()}
            </div>
            <input
              type="date"
              value={quickPpExpiry}
              onChange={e => {
                setQuickPpExpiry(e.target.value);
                setSelectedPpPresetMonths(null);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all cursor-pointer"
            />

            {/* Previous vs New Comparison Pill */}
            {originalPpExpiry && quickPpExpiry !== originalPpExpiry && (
              <div className="flex items-center justify-between text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2.5 py-1 rounded-lg mt-1.5 font-bold">
                <span className="truncate">
                  {isRtl
                    ? `السابق: ${originalPpExpiry} ← الجديد: ${quickPpExpiry}`
                    : `Previous: ${originalPpExpiry} → New: ${quickPpExpiry}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setQuickPpExpiry(originalPpExpiry);
                    setSelectedPpPresetMonths(null);
                  }}
                  className="underline font-black hover:text-emerald-950 cursor-pointer ml-2 shrink-0"
                >
                  {isRtl ? 'استعادة الأصلي' : 'Reset'}
                </button>
              </div>
            )}

            {/* Preset Shortcuts */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[9px] text-slate-400 font-bold">{isRtl ? 'اختصارات:' : 'Presets:'}</span>
              <button
                type="button"
                onClick={() => applyPpPreset(6)}
                className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all cursor-pointer border flex items-center gap-1 ${
                  selectedPpPresetMonths === 6
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                }`}
              >
                {selectedPpPresetMonths === 6 && <Check className="w-2.5 h-2.5" />}
                <span>+6 {isRtl ? 'أشهر' : 'Months'}</span>
              </button>
              <button
                type="button"
                onClick={() => applyPpPreset(12)}
                className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all cursor-pointer border flex items-center gap-1 ${
                  selectedPpPresetMonths === 12
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                }`}
              >
                {selectedPpPresetMonths === 12 && <Check className="w-2.5 h-2.5" />}
                <span>+1 {isRtl ? 'سنة' : 'Year'}</span>
              </button>
              <button
                type="button"
                onClick={() => applyPpPreset(24)}
                className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all cursor-pointer border flex items-center gap-1 ${
                  selectedPpPresetMonths === 24
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                }`}
              >
                {selectedPpPresetMonths === 24 && <Check className="w-2.5 h-2.5" />}
                <span>+2 {isRtl ? 'سنوات' : 'Years'}</span>
              </button>
              <button
                type="button"
                onClick={() => applyPpPreset(60)}
                className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all cursor-pointer border flex items-center gap-1 ${
                  selectedPpPresetMonths === 60
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                }`}
              >
                {selectedPpPresetMonths === 60 && <Check className="w-2.5 h-2.5" />}
                <span>+5 {isRtl ? 'سنوات' : 'Years'}</span>
              </button>
            </div>
          </div>

          {/* 3. WP Expiry Date */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                {isRtl ? 'تاريخ انتهاء الإقامة والتصريح (WP / Visa Expiry):' : 'Work Permit / Visa Expiry (WP Expiry):'}
              </label>
              {(() => {
                const st = getExpiryStatus(quickWpExpiry, 60);
                if (!st) return null;
                return (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${st.color}`}>
                    {isRtl ? st.badgeTextAr : st.badgeText}
                  </span>
                );
              })()}
            </div>
            <input
              type="date"
              value={quickWpExpiry}
              onChange={e => {
                setQuickWpExpiry(e.target.value);
                setSelectedWpPresetMonths(null);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all cursor-pointer"
            />

            {/* Previous vs New Comparison Pill */}
            {originalWpExpiry && quickWpExpiry !== originalWpExpiry && (
              <div className="flex items-center justify-between text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2.5 py-1 rounded-lg mt-1.5 font-bold">
                <span className="truncate">
                  {isRtl
                    ? `السابق: ${originalWpExpiry} ← الجديد: ${quickWpExpiry}${selectedWpPresetMonths ? ` (+${selectedWpPresetMonths === 6 ? '6 أشهر' : selectedWpPresetMonths === 12 ? 'سنة' : 'سنتين'})` : ''}`
                    : `Previous: ${originalWpExpiry} → New: ${quickWpExpiry}${selectedWpPresetMonths ? ` (+${selectedWpPresetMonths}M)` : ''}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setQuickWpExpiry(originalWpExpiry);
                    setSelectedWpPresetMonths(null);
                  }}
                  className="underline font-black hover:text-emerald-950 cursor-pointer ml-2 shrink-0"
                >
                  {isRtl ? 'استعادة الأصلي' : 'Reset'}
                </button>
              </div>
            )}

            {/* Preset Shortcuts */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[9px] text-slate-400 font-bold">{isRtl ? 'اختصارات:' : 'Presets:'}</span>
              <button
                type="button"
                onClick={() => applyWpPreset(6)}
                className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all cursor-pointer border flex items-center gap-1 ${
                  selectedWpPresetMonths === 6
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-1 ring-emerald-500/30'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                }`}
              >
                {selectedWpPresetMonths === 6 && <Check className="w-2.5 h-2.5" />}
                <span>+6 {isRtl ? 'أشهر' : 'Months'}</span>
              </button>
              <button
                type="button"
                onClick={() => applyWpPreset(12)}
                className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all cursor-pointer border flex items-center gap-1 ${
                  selectedWpPresetMonths === 12
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-1 ring-emerald-500/30'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                }`}
              >
                {selectedWpPresetMonths === 12 && <Check className="w-2.5 h-2.5" />}
                <span>+1 {isRtl ? 'سنة' : 'Year'}</span>
              </button>
              <button
                type="button"
                onClick={() => applyWpPreset(24)}
                className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all cursor-pointer border flex items-center gap-1 ${
                  selectedWpPresetMonths === 24
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-1 ring-emerald-500/30'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60'
                }`}
              >
                {selectedWpPresetMonths === 24 && <Check className="w-2.5 h-2.5" />}
                <span>+2 {isRtl ? 'سنوات' : 'Years'}</span>
              </button>
            </div>
          </div>

          {/* 4. Pharmacist NHRA License & Expiry */}
          {quickComplianceEmp.category === 'Pharmacist' && (
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/80 space-y-3">
              <div className="flex items-center gap-1.5 text-purple-900 font-black text-xs border-b border-purple-200/60 pb-1.5">
                <Award className="w-4 h-4 text-purple-600 shrink-0" />
                <span>{isRtl ? 'ترخيص مزاولة المهنة (NHRA License):' : 'NHRA License & Expiry (Pharmacist):'}</span>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1">
                  {isRtl ? 'رقم ترخيص NHRA:' : 'NHRA License Number:'}
                </label>
                <input
                  type="text"
                  value={quickNhraLicense}
                  onChange={e => setQuickNhraLicense(e.target.value)}
                  placeholder="NHRA-PH-XXXX"
                  className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs font-mono font-bold text-purple-950 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                    {isRtl ? 'تاريخ انتهاء ترخيص NHRA:' : 'NHRA Expiry Date:'}
                  </label>
                  {(() => {
                    const st = getExpiryStatus(quickNhraExpiry, 60);
                    if (!st) return null;
                    return (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${st.color}`}>
                        {isRtl ? st.badgeTextAr : st.badgeText}
                      </span>
                    );
                  })()}
                </div>
                <input
                  type="date"
                  value={quickNhraExpiry}
                  onChange={e => {
                    setQuickNhraExpiry(e.target.value);
                    setSelectedNhraPresetMonths(null);
                  }}
                  className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs font-mono font-bold text-purple-950 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-all cursor-pointer"
                />

                {/* Previous vs New Comparison Pill */}
                {originalNhraExpiry && quickNhraExpiry !== originalNhraExpiry && (
                  <div className="flex items-center justify-between text-[10px] bg-purple-100 text-purple-900 border border-purple-200 px-2.5 py-1 rounded-lg mt-1.5 font-bold">
                    <span className="truncate">
                      {isRtl
                        ? `السابق: ${originalNhraExpiry} ← الجديد: ${quickNhraExpiry}`
                        : `Previous: ${originalNhraExpiry} → New: ${quickNhraExpiry}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickNhraExpiry(originalNhraExpiry);
                        setSelectedNhraPresetMonths(null);
                      }}
                      className="underline font-black hover:text-purple-950 cursor-pointer ml-2 shrink-0"
                    >
                      {isRtl ? 'استعادة الأصلي' : 'Reset'}
                    </button>
                  </div>
                )}

                {/* Presets: only +2 Years */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[9px] text-purple-700 font-bold">{isRtl ? 'اختصارات:' : 'Presets:'}</span>
                  <button
                    type="button"
                    onClick={() => applyNhraPreset(24)}
                    className={`px-2.5 py-1 rounded-md text-[9px] font-black shadow-xs transition-all cursor-pointer flex items-center gap-1 ${
                      selectedNhraPresetMonths === 24
                        ? 'bg-purple-800 text-white ring-2 ring-purple-400'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    <span>★</span>
                    <span>+2 {isRtl ? 'سنتين (ترخيص NHRA)' : 'Years (NHRA Standard)'}</span>
                    {selectedNhraPresetMonths === 24 && <Check className="w-2.5 h-2.5 ml-1" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={quickComplianceLoading}
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={quickComplianceLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {quickComplianceLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{isRtl ? 'جاري الحفظ...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'حفظ التحديثات' : 'Save Changes'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
