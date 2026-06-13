import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { MaintenanceSettings } from '../../types';

interface POSGuidelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: MaintenanceSettings | null;
}

const DEFAULT_GUIDELINE_COPY = {
  title: 'Attention / تنبيه',
  intro: 'Choose the correct type before submitting to keep reports accurate.',
  lostSalesEn: 'Actual customer request + item unavailable in branch.',
  shortageEn: 'Daily missing stock, even without a customer request.',
  lostSalesAr: 'طلب فعلي من عميل + الصنف غير متوفر داخل الفرع.',
  shortageAr: 'نواقص يومية داخل الفرع حتى بدون طلب من عميل.'
};

export const POSGuidelineModal: React.FC<POSGuidelineModalProps> = ({ isOpen, onClose, settings }) => {
  if (!isOpen || settings?.posGuidelineEnabled === false) return null;

  const copy = {
    title: settings?.posGuidelineTitle || DEFAULT_GUIDELINE_COPY.title,
    intro: settings?.posGuidelineIntro || DEFAULT_GUIDELINE_COPY.intro,
    lostSalesEn: settings?.posGuidelineLostSalesEn || DEFAULT_GUIDELINE_COPY.lostSalesEn,
    shortageEn: settings?.posGuidelineShortageEn || DEFAULT_GUIDELINE_COPY.shortageEn,
    lostSalesAr: settings?.posGuidelineLostSalesAr || DEFAULT_GUIDELINE_COPY.lostSalesAr,
    shortageAr: settings?.posGuidelineShortageAr || DEFAULT_GUIDELINE_COPY.shortageAr
  };

  const englishGuidelines = [
    { title: 'Lost Sales', detail: copy.lostSalesEn },
    { title: 'Shortage', detail: copy.shortageEn }
  ];
  const arabicGuidelines = [
    { title: 'Lost Sales', detail: copy.lostSalesAr },
    { title: 'Shortage', detail: copy.shortageAr }
  ];

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-guideline-title"
      aria-describedby="pos-guideline-description"
    >
      <div className="relative w-full max-w-4xl overflow-hidden rounded-xl border border-brand/10 bg-white shadow-[0_28px_90px_-28px_rgba(0,0,0,0.55)] animate-in zoom-in-95 duration-300">
        <div className="pointer-events-none absolute -right-10 -top-12 text-brand/5">
          <AlertTriangle size={220} strokeWidth={2.8} />
        </div>

        <div className="relative flex items-start justify-between gap-4 border-b border-brand/10 bg-brand/5 px-5 py-4 md:px-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <AlertTriangle className="h-6 w-6" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Before logging records</p>
              <h3 id="pos-guideline-title" className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                {copy.title}
              </h3>
              <p id="pos-guideline-description" className="mt-1.5 text-sm font-semibold leading-relaxed text-slate-500">
                {copy.intro}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-brand/30 hover:bg-brand/5 hover:text-brand focus-ring"
            aria-label="Close attention message"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative px-5 py-4 md:px-7">
          <div className="mx-auto flex w-fit items-center rounded-full border border-brand/10 bg-slate-50 p-1">
            <div className="rounded-full bg-brand px-5 py-2 text-center shadow-sm">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-white">Lost Sales</span>
            </div>
            <div className="px-5 py-2 text-center">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Shortage</span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">English guide</p>
              <h4 className="mt-1 text-lg font-black text-slate-950">Dear Pharmacist</h4>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
                Please distinguish between Lost Sales and Shortage to avoid inaccurate records.
              </p>
              <div className="mt-3 space-y-2">
                {englishGuidelines.map((item) => (
                  <div key={item.title} className="rounded-lg border border-brand/10 bg-brand/5 px-3 py-2">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-brand">{item.title}</p>
                    <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 text-right shadow-sm" dir="rtl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">الدليل العربي</p>
              <h4 className="mt-1 text-lg font-black text-slate-950">عزيزي الصيدلي</h4>
              <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">
                برجاء التفرقة بين Lost Sales و Shortage لتجنب تسجيل بيانات غير دقيقة.
              </p>
              <div className="mt-3 space-y-2">
                {arabicGuidelines.map((item) => (
                  <div key={item.title} className="rounded-lg border border-brand/10 bg-brand/5 px-3 py-2">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-brand">{item.title}</p>
                    <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center">
            <p className="text-sm font-black text-amber-900">
              {copy.lostSalesEn} = Lost Sales. {copy.shortageEn} = Shortage.
            </p>
            <p className="mt-1 text-sm font-black text-amber-900" dir="rtl">
              {copy.lostSalesAr} = Lost Sales. {copy.shortageAr} = Shortage.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4 md:px-7">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Tabarak Hub 2026</p>
          <button
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand/90 px-6 py-2.5 text-center text-sm font-black text-white shadow-sm shadow-brand/20 transition-all hover:bg-brand active:scale-[0.98] focus-ring"
          >
            Acknowledged / تم الإطلاع
          </button>
        </div>
      </div>
    </div>
  );
};
