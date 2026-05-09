import React from 'react';
import { ScoreBadge } from '../shared/ScoreBadge';
import { MessageSquare, Calendar } from 'lucide-react';

interface Comment {
  id: string;
  created_at: string;
  overall_avg: number;
  subject: string;
  subject_ar?: string;
  comment: string;
  sentiment?: string;
}

interface Props {
  comments: Comment[];
  lang?: 'en' | 'ar';
}

export const CommentsTable: React.FC<Props> = ({ comments, lang = 'en' }) => {
  if (!comments || comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
        <p className="font-medium text-sm italic">No comments available for this filter</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pr-2 pb-4">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="p-5 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50/50 hover:shadow-lg hover:border-brand/10 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ScoreBadge score={comment.overall_avg} />
              {comment.sentiment && (
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                  comment.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700' :
                  comment.sentiment === 'negative' ? 'bg-rose-100 text-rose-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {comment.sentiment}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-tight">
              <Calendar className="w-3.5 h-3.5" />
              {comment.created_at ? new Date(comment.created_at).toLocaleDateString() : '—'}
            </div>
          </div>
          
          <div className="mb-2">
            <span className="text-[10px] font-black text-brand uppercase tracking-widest bg-brand/5 px-2 py-0.5 rounded-lg border border-brand/10">
              {lang === 'ar' && comment.subject_ar ? comment.subject_ar : comment.subject}
            </span>
          </div>

          <p className="text-sm font-medium text-slate-700 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all italic">
            "{comment.comment}"
          </p>
        </div>
      ))}
    </div>
  );
};
