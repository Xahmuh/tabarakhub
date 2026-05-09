import React, { useState, useEffect } from 'react';
import { feedbackService } from '../../services/feedbackService';
import { ModuleSettings, SubmissionPeriod } from '../../types/feedback.types';
import { Power, Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

export const ModuleSettingsControl: React.FC = () => {
  const [settings, setSettings] = useState<ModuleSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const data = await feedbackService.getModuleSettings();
      setSettings(data);
    } catch {
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const save = async (patch: Partial<ModuleSettings>) => {
    if (!settings) return;
    setIsUpdating(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await feedbackService.updateModuleSettings(patch);
      setSettings(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Failed to update settings');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 animate-pulse space-y-4">
        <div className="h-5 w-40 bg-slate-100 rounded" />
        <div className="h-12 w-full bg-slate-50 rounded-xl" />
        <div className="h-12 w-full bg-slate-50 rounded-xl" />
      </div>
    );
  }

  const isEnabled = settings?.is_enabled ?? false;
  const maxPerMonth = settings?.max_submissions_per_month ?? 4;
  const period = settings?.submission_period ?? 'monthly';

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-900">Module Control</h3>
          <p className="text-sm text-slate-500 font-medium">Manage access and submission limits</p>
        </div>
        <button onClick={fetchSettings} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Enable / Disable */}
      <div className={`p-4 rounded-xl border transition-colors ${isEnabled ? 'bg-emerald-50/60 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Power className={`w-4 h-4 ${isEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className={`text-sm font-black ${isEnabled ? 'text-emerald-700' : 'text-slate-700'}`}>
                {isEnabled ? 'Form Open — Staff can submit' : 'Form Closed — Staff blocked'}
              </span>
            </div>
            <p className="text-xs text-slate-400 ml-6">
              {isEnabled ? 'Disable to show a "Form Closed" message to all staff.' : 'Enable to allow staff to access the feedback form.'}
            </p>
          </div>
          <button
            onClick={() => save({ is_enabled: !isEnabled })}
            disabled={isUpdating}
            className={`relative shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
              isEnabled ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Evaluation period */}
      <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/40 space-y-3">
        <div>
          <p className="text-sm font-black text-slate-700">Evaluation Period</p>
          <p className="text-xs text-slate-400 mt-0.5">When the submission count resets for each account</p>
        </div>
        <div className="flex gap-2">
          {([
            { value: 'monthly', label: 'Monthly', sub: 'Resets every calendar month' },
            { value: 'quarterly', label: 'Quarterly', sub: 'Resets every 3 months' },
          ] as { value: SubmissionPeriod; label: string; sub: string }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => save({ submission_period: opt.value })}
              disabled={isUpdating || period === opt.value}
              className={`flex-1 py-3 px-3 rounded-xl text-sm font-black border-2 transition-all text-left space-y-0.5 ${
                period === opt.value
                  ? 'bg-brand text-white border-brand shadow-lg shadow-brand/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand'
              }`}
            >
              <div>{opt.label}</div>
              <div className={`text-[10px] font-medium ${period === opt.value ? 'text-white/70' : 'text-slate-400'}`}>{opt.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Max submissions per period */}
      <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/40 space-y-3">
        <div>
          <p className="text-sm font-black text-slate-700">Max Submissions Per {period === 'quarterly' ? 'Quarter' : 'Month'}</p>
          <p className="text-xs text-slate-400 mt-0.5">How many times each account may submit within one {period === 'quarterly' ? 'quarter' : 'month'}</p>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => save({ max_submissions_per_month: n })}
              disabled={isUpdating || maxPerMonth === n}
              className={`flex-1 py-3 rounded-xl text-sm font-black border-2 transition-all ${
                maxPerMonth === n
                  ? 'bg-brand text-white border-brand shadow-lg shadow-brand/20 scale-105'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand'
              }`}
            >
              {n}×
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 text-center">
          Currently: <span className="font-black text-brand">{maxPerMonth}×</span> per {period === 'quarterly' ? 'quarter' : 'month'} per account
        </p>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs font-bold bg-red-50 p-3 rounded-lg border border-red-100">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 p-3 rounded-lg border border-emerald-100">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Settings saved successfully</span>
        </div>
      )}
      {isUpdating && (
        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold p-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Saving...</span>
        </div>
      )}
    </div>
  );
};
