import React from 'react';
import { Info, X } from 'lucide-react';
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

  const guidelineItems = [
    {
      title: 'Lost Sales',
      english: copy.lostSalesEn,
      arabic: copy.lostSalesAr
    },
    {
      title: 'Shortage',
      english: copy.shortageEn,
      arabic: copy.shortageAr
    }
  ];

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-guideline-title"
      aria-describedby="pos-guideline-description"
    >
      <div className="relative w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-900/15 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-brand">
              <Info className="h-5 w-5" strokeWidth={2.4} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Before logging records</p>
              <h3 id="pos-guideline-title" className="mt-1 text-xl font-black tracking-tight text-slate-950">
                {copy.title}
              </h3>
              <p id="pos-guideline-description" className="mt-1.5 text-sm font-semibold leading-6 text-slate-500">
                {copy.intro}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-ring"
            aria-label="Close attention message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {guidelineItems.map((item) => (
            <section key={item.title} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand" />
                <h4 className="text-sm font-black text-slate-950">{item.title}</h4>
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{item.english}</p>
              <p className="mt-1 text-sm font-bold leading-6 text-slate-500" dir="rtl">{item.arabic}</p>
            </section>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary min-h-10 px-5 text-xs uppercase tracking-[0.14em]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
