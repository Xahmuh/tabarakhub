import React from 'react';
import { Sparkles, TrendingUp, TrendingDown, MessageSquare, Loader2, RefreshCw } from 'lucide-react';
import { feedbackService } from '../../services/feedbackService';

interface SentimentStats {
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  top_keywords: string[];
  key_insights: string[];
  last_analyzed?: string;
}

interface Props {
  stats?: SentimentStats;
  onRefresh: () => void;
  isLoading: boolean;
}

export const AIInsightsPanel: React.FC<Props> = ({ stats, onRefresh, isLoading }) => {
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await feedbackService.triggerSentimentAnalysis();
      onRefresh();
    } catch (err) {
      console.error('Sentiment analysis failed:', err);
      alert('Failed to trigger analysis. Please try again later.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const total = (stats?.positive_count || 0) + (stats?.negative_count || 0) + (stats?.neutral_count || 0);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-brand/10 text-brand rounded-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">AI Sentiment Insights</h3>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={isLoading || isAnalyzing}
          className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 transition-all"
        >
          {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Analyze Comments
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="flex items-center justify-center gap-1 text-emerald-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-lg font-black">{total > 0 ? Math.round(((stats?.positive_count || 0) / total) * 100) : 0}%</span>
            </div>
            <p className="text-[10px] font-black text-emerald-700 uppercase">Positive</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center justify-center gap-1 text-slate-600 mb-1">
              <MessageSquare className="w-4 h-4" />
              <span className="text-lg font-black">{total > 0 ? Math.round(((stats?.neutral_count || 0) / total) * 100) : 0}%</span>
            </div>
            <p className="text-[10px] font-black text-slate-700 uppercase">Neutral</p>
          </div>
          <div className="text-center p-3 bg-rose-50 rounded-xl border border-rose-100">
            <div className="flex items-center justify-center gap-1 text-rose-600 mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-lg font-black">{total > 0 ? Math.round(((stats?.negative_count || 0) / total) * 100) : 0}%</span>
            </div>
            <p className="text-[10px] font-black text-rose-700 uppercase">Negative</p>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Key Themes</h4>
          <div className="flex flex-wrap gap-2">
            {stats?.top_keywords?.map((word, i) => (
              <span key={i} className="px-2.5 py-1 bg-brand/5 text-brand text-[10px] font-black rounded-lg border border-brand/10">
                #{word}
              </span>
            ))}
            {!stats?.top_keywords?.length && <p className="text-xs text-slate-400 italic">No themes identified yet</p>}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Executive Summary</h4>
          {stats?.key_insights?.map((insight, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-medium text-slate-600 leading-relaxed">
              {insight}
            </div>
          ))}
          {!stats?.key_insights?.length && (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-400 font-medium italic">Click "Analyze Comments" to generate AI insights from the current dataset.</p>
            </div>
          )}
        </div>
      </div>

      {stats?.last_analyzed && (
        <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] font-bold text-slate-400">
          Last analysis: {new Date(stats.last_analyzed).toLocaleString()}
        </div>
      )}
    </div>
  );
};
