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
  { value: 1, label: 'Poor',          color: 'bg-red-500',    border: 'border-red-500',    text: 'text-red-500',    track: 'bg-red-500' },
  { value: 2, label: 'Below Average', color: 'bg-orange-400', border: 'border-orange-400', text: 'text-orange-400', track: 'bg-orange-400' },
  { value: 3, label: 'Average',       color: 'bg-amber-400',  border: 'border-amber-400',  text: 'text-amber-400',  track: 'bg-amber-400' },
  { value: 4, label: 'Good',          color: 'bg-blue-500',   border: 'border-blue-500',   text: 'text-blue-500',   track: 'bg-blue-500' },
  { value: 5, label: 'Excellent',     color: 'bg-emerald-500',border: 'border-emerald-500',text: 'text-emerald-500',track: 'bg-emerald-500' },
];

export const SectionRating: React.FC<SectionRatingProps> = ({ questionEn, questionAr, lang = 'en', value, onChange, comment, onCommentChange }) => {
  const selected = SCALE.find(s => s.value === value);
  const trackWidth = value > 0 ? `${((value - 1) / 4) * 100}%` : '0%';
  const isAr = lang === 'ar';
  const questionText = isAr && questionAr ? questionAr : questionEn;
  const needsComment = value > 0 && value < 3;
  const commentMissing = needsComment && (!comment || comment.trim().length === 0);

  return (
    <div className="space-y-5 p-6 bg-white rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors shadow-sm" dir={isAr ? 'rtl' : 'ltr'}>
      <p className={`text-sm font-bold text-slate-800 leading-snug ${isAr ? 'text-right' : ''}`}>{questionText}</p>

      <div className="space-y-3">
        {/* Track + Buttons */}
        <div className="relative flex items-center justify-between" style={{ paddingTop: '2px', paddingBottom: '2px' }}>
          {/* Base track */}
          <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-1 bg-slate-100 rounded-full z-0" />
          {/* Filled track */}
          {value > 0 && (
            <div
              className={`absolute left-[10%] top-1/2 -translate-y-1/2 h-1 rounded-full z-0 transition-all duration-400 ${selected?.track}`}
              style={{ width: trackWidth }}
            />
          )}

          {/* Buttons */}
          {SCALE.map(item => {
            const isSelected = value === item.value;
            const isPast = value > item.value;
            return (
              <button
                key={item.value}
                onClick={() => onChange(item.value)}
                className={`relative z-10 w-10 h-10 rounded-full border-2 font-black text-sm transition-all duration-200 flex items-center justify-center
                  ${isSelected
                    ? `${item.color} ${item.border} text-white scale-110 shadow-lg`
                    : isPast
                    ? `${item.color} ${item.border} text-white opacity-60`
                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600'
                  }`}
              >
                {item.value}
              </button>
            );
          })}
        </div>

        {/* Labels row */}
        <div className="flex justify-between">
          {SCALE.map(item => (
            <div key={item.value} className="flex-1 text-center">
              <span className={`text-[9px] font-bold uppercase tracking-wide transition-colors ${
                value === item.value ? item.text : 'text-slate-300'
              }`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {value > 0 && (
        <div className={`text-xs font-bold ${selected?.text} flex items-center gap-1.5 animate-in fade-in`}>
          <span className={`w-2 h-2 rounded-full ${selected?.color}`} />
          Score {value} — {selected?.label}
        </div>
      )}

      {needsComment && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 pt-1">
          <div className={`flex items-center gap-1.5 mb-2 ${isAr ? 'flex-row-reverse' : ''}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <label className={`text-xs font-bold text-rose-600 ${isAr ? 'text-right' : ''}`}>
              {isAr
                ? 'مطلوب — يرجى توضيح سبب تقييمك المنخفض'
                : 'Required — please explain the reason for this low score'}
            </label>
          </div>
          <textarea
            dir={isAr ? 'rtl' : 'ltr'}
            value={comment || ''}
            onChange={e => onCommentChange?.(e.target.value)}
            rows={3}
            placeholder={isAr ? 'اكتب ملاحظاتك هنا...' : 'Share your feedback here...'}
            className={`w-full text-sm p-3 rounded-xl border-2 outline-none resize-none transition-colors
              ${commentMissing
                ? 'border-rose-300 bg-rose-50 focus:border-rose-500 placeholder:text-rose-300'
                : 'border-emerald-300 bg-emerald-50 focus:border-emerald-500'
              } ${isAr ? 'text-right' : ''}`}
          />
          {commentMissing && (
            <p className={`text-[11px] text-rose-500 font-bold mt-1 ${isAr ? 'text-right' : ''}`}>
              {isAr ? 'هذا الحقل إلزامي للمتابعة' : 'This field is required to proceed'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
