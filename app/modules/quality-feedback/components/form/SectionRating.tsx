import React from 'react';

interface SectionRatingProps {
  questionEn: string;
  questionAr?: string;
  lang?: 'en' | 'ar';
  value: number;
  onChange: (value: number) => void;
  comment?: string;
  onCommentChange?: (text: string) => void;
}

const SCALE = [
  { value: 1, label: 'Poor', active: 'border-rose-500 bg-rose-500 text-white shadow-rose-500/20', text: 'text-rose-600', dot: 'bg-rose-500' },
  { value: 2, label: 'Low', active: 'border-orange-400 bg-orange-400 text-white shadow-orange-400/20', text: 'text-orange-600', dot: 'bg-orange-400' },
  { value: 3, label: 'Okay', active: 'border-amber-400 bg-amber-400 text-slate-950 shadow-amber-400/20', text: 'text-amber-700', dot: 'bg-amber-400' },
  { value: 4, label: 'Good', active: 'border-sky-500 bg-sky-500 text-white shadow-sky-500/20', text: 'text-sky-600', dot: 'bg-sky-500' },
  { value: 5, label: 'Excellent', active: 'border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/20', text: 'text-emerald-600', dot: 'bg-emerald-500' },
];

export const SectionRating: React.FC<SectionRatingProps> = ({
  questionEn,
  questionAr,
  lang = 'en',
  value,
  onChange,
  comment,
  onCommentChange
}) => {
  const selected = SCALE.find(s => s.value === value);
  const isAr = lang === 'ar';
  const questionText = isAr && questionAr ? questionAr : questionEn;
  const needsComment = value > 0 && value < 3;
  const commentMissing = needsComment && (!comment || comment.trim().length === 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md sm:p-5" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className={`text-sm font-black leading-6 text-slate-900 ${isAr ? 'text-right' : ''}`}>{questionText}</p>
        {value > 0 && selected && (
          <span className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black ${selected.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${selected.dot}`} />
            {value}/5
          </span>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <div className="grid grid-cols-5 gap-2">
          {SCALE.map(item => {
            const isSelected = value === item.value;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={isSelected}
                aria-label={`Rate ${item.value}: ${item.label}`}
                onClick={() => onChange(item.value)}
                className={`flex min-h-[64px] flex-col items-center justify-center rounded-xl border text-center transition-all duration-200 ${
                  isSelected
                    ? `${item.active} shadow-lg`
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-800'
                }`}
              >
                <span className="text-base font-black leading-none">{item.value}</span>
                <span className="mt-1 max-w-full text-[10px] font-black uppercase leading-tight tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
          <span className={isAr ? 'text-right' : ''}>Needs work</span>
          <span className="h-px w-12 bg-slate-200" />
          <span className={isAr ? 'text-left' : 'text-right'}>Strong</span>
        </div>
      </div>

      {needsComment && (
        <div className="mt-5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={`mb-2 flex items-center gap-1.5 ${isAr ? 'flex-row-reverse' : ''}`}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            <label className={`text-xs font-bold text-rose-600 ${isAr ? 'text-right' : ''}`}>
              Required - please explain the reason for this low score
            </label>
          </div>
          <textarea
            dir={isAr ? 'rtl' : 'ltr'}
            value={comment || ''}
            onChange={e => onCommentChange?.(e.target.value)}
            rows={3}
            placeholder="Share your feedback here..."
            className={`w-full resize-none rounded-xl border-2 p-3 text-sm outline-none transition-colors ${
              commentMissing
                ? 'border-rose-300 bg-rose-50 placeholder:text-rose-300 focus:border-rose-500'
                : 'border-emerald-300 bg-emerald-50 focus:border-emerald-500'
            } ${isAr ? 'text-right' : ''}`}
          />
          {commentMissing && (
            <p className={`mt-1 text-[11px] font-bold text-rose-500 ${isAr ? 'text-right' : ''}`}>
              This field is required to proceed.
            </p>
          )}
        </div>
      )}
    </section>
  );
};
