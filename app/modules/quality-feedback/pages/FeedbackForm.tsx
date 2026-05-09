import React, { useState, useEffect } from 'react';
import { FormProgress } from '../components/form/FormProgress';
import { SectionRating } from '../components/form/SectionRating';
import { CommentField } from '../components/form/CommentField';
import { useFeedbackSubmit } from '../hooks/useFeedbackSubmit';
import { feedbackService } from '../services/feedbackService';
import { FeedbackFormData, Question, ModuleSettings, FeedbackSection } from '../types/feedback.types';
import { ThankYouPage } from './ThankYouPage';
import { ShieldCheck, ChevronRight, ChevronLeft, Loader2, AlertTriangle, Lock, Globe } from 'lucide-react';
import { useAnonymityGuard } from '../hooks/useAnonymityGuard';

interface Props {
  onBack: () => void;
}

const INITIAL_DATA: FeedbackFormData = {
  branch_cluster: '',
  role: '',
  experience_range: '',
  submission_month: '',
};

export const FeedbackForm: React.FC<Props> = ({ onBack }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FeedbackFormData>(INITIAL_DATA);
  const [submitted, setSubmitted] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<ModuleSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lang, setLang] = useState<'en' | 'ar'>('en');

  const { submitFeedback, isSubmitting, error: submitError } = useFeedbackSubmit();
  const maxPerPeriod = settings?.max_submissions_per_month ?? 4;
  const period = settings?.submission_period ?? 'monthly';
  const { hasReachedLimit, submissionsThisPeriod, remainingSubmissions, recordSubmission, periodLabel } = useAnonymityGuard(maxPerPeriod, period);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const [qstns, sett] = await Promise.all([
          feedbackService.fetchActiveQuestions(),
          feedbackService.getModuleSettings()
        ]);
        setQuestions(qstns);
        setSettings(sett);
      } catch (err) {
        setFetchError('Failed to load form. Please check your connection.');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand" />
        <p className="text-slate-500 font-medium">Loading form...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-2xl mx-auto p-8 mt-12 bg-white rounded-3xl shadow-xl border border-red-100 text-center space-y-6">
        <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Connection Error</h2>
        <p className="text-slate-600">{fetchError}</p>
        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-brand text-white font-bold rounded-xl">
          Try Again
        </button>
      </div>
    );
  }

  if (settings && !settings.is_enabled) {
    return (
      <div className="max-w-2xl mx-auto p-8 mt-12 bg-white rounded-3xl shadow-xl border border-slate-200 text-center space-y-8">
        <div className="w-24 h-24 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black text-slate-900">Form Closed</h2>
        <p className="text-slate-600 font-medium">
          The feedback form is currently closed. Please check back later.
        </p>
        <button onClick={onBack} className="px-10 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all mx-auto flex items-center justify-center">
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (hasReachedLimit() && !submitted) {
    return (
      <div className="max-w-2xl mx-auto p-8 mt-12 bg-white rounded-3xl shadow-xl border border-slate-200 text-center space-y-6">
        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Limit Reached</h2>
        <p className="text-slate-600">
          You have submitted <strong>{submissionsThisPeriod()}</strong> of <strong>{maxPerPeriod}</strong> allowed responses this {periodLabel}. You can submit again next {periodLabel}.
        </p>
        <button onClick={onBack} className="px-8 py-3 bg-brand text-white font-bold rounded-xl">
          Return to Home
        </button>
      </div>
    );
  }

  if (submitted) {
    return <ThankYouPage onBackToHome={onBack} />;
  }

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const sections: FeedbackSection[] = ['Operations', 'Purchasing', 'HR', 'IT', 'Overall'];
  const totalSteps = sections.length + 3;

  const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const canProceed = () => {
    if (step === 1) return true;
    if (step === 2) return formData.branch_cluster && formData.role && formData.experience_range;
    const sectionIndex = step - 3;
    if (sectionIndex >= 0 && sectionIndex < sections.length) {
      const sectionQuestions = questions.filter(q => q.section === sections[sectionIndex]);
      return sectionQuestions.every(q => {
        if (formData[q.field_key] <= 0) return false;
        if (formData[q.field_key] < 3) {
          const note = formData[`note_${q.field_key}`];
          return note && note.trim().length > 0;
        }
        return true;
      });
    }
    if (step === totalSteps - 1) {
      const hasLowScore = questions.some(q => formData[q.field_key] > 0 && formData[q.field_key] <= 2);
      return !hasLowScore || formData.biggest_issue?.trim().length > 0;
    }
    return true;
  };

  const handleSubmit = async () => {
    const success = await submitFeedback(formData);
    if (success) {
      recordSubmission();
      setSubmitted(true);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
          ← Cancel
        </button>
        <button
          onClick={() => setLang(l => l === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <Globe className="w-4 h-4" />
          {lang === 'en' ? 'عربي' : 'English'}
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200 overflow-hidden">
        {step > 1 && step < totalSteps && (
          <div className="px-8 pt-8">
            <FormProgress currentStep={step - 1} totalSteps={totalSteps - 2} />
          </div>
        )}

        <div className="p-8 sm:p-10 min-h-[400px]">
          {submitError && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="font-medium text-sm">{submitError}</p>
            </div>
          )}

          {step === 1 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">QC Insights Survey</h2>
              <div className="max-w-xl mx-auto p-6 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 font-medium leading-relaxed text-left space-y-3">
                <p>This survey is completely anonymous. We do not collect your name, employee ID, or any personal information.</p>
                <p>Your honest feedback helps us improve operations for everyone.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-slate-900 mb-6">Basic Information</h2>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Branch Area</span>
                  <select
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 focus:border-brand outline-none"
                    value={formData.branch_cluster}
                    onChange={e => updateField('branch_cluster', e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option value="North Cluster">North Cluster</option>
                    <option value="Central Cluster">Central Cluster</option>
                    <option value="South Cluster">South Cluster</option>
                    <option value="East Cluster">East Cluster</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Your Role</span>
                  <select
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 focus:border-brand outline-none"
                    value={formData.role}
                    onChange={e => updateField('role', e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option value="Pharmacist">Pharmacist</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Warehouse Staff">Warehouse Staff</option>
                    <option value="Delivery">Delivery</option>
                    <option value="Supervisor">Supervisor</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Years of Experience</span>
                  <select
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 focus:border-brand outline-none"
                    value={formData.experience_range}
                    onChange={e => updateField('experience_range', e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option value="0-1 Years">0–1 Years</option>
                    <option value="1-3 Years">1–3 Years</option>
                    <option value="3-5 Years">3–5 Years</option>
                    <option value="5+ Years">5+ Years</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {step >= 3 && step < totalSteps - 1 && (() => {
            const sectionIndex = step - 3;
            const sectionName = sections[sectionIndex];
            const sectionQuestions = questions.filter(q => q.section === sectionName);
            return (
              <div className="space-y-5">
                <h2 className="text-2xl font-black text-slate-900 border-b border-slate-100 pb-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                  {sectionName} Department
                </h2>
                {sectionQuestions.map(q => (
                  <SectionRating
                    key={q.id}
                    questionEn={q.text_en}
                    questionAr={q.text_ar}
                    lang={lang}
                    value={formData[q.field_key] || 0}
                    onChange={v => updateField(q.field_key, v)}
                    comment={formData[`note_${q.field_key}`] || ''}
                    onCommentChange={text => updateField(`note_${q.field_key}`, text)}
                  />
                ))}
                {sectionQuestions.length === 0 && (
                  <div className="p-8 text-center text-slate-400 font-medium">
                    No questions active in this section.
                  </div>
                )}
              </div>
            );
          })()}

          {step === totalSteps - 1 && (
            <div className="space-y-8">
              <h2 className="text-xl font-black text-slate-900 border-b border-slate-100 pb-4">Open Comments</h2>
              <CommentField
                label="What is the biggest operational challenge you face?"
                value={formData.biggest_issue || ''}
                onChange={v => updateField('biggest_issue', v)}
                required={questions.some(q => formData[q.field_key] > 0 && formData[q.field_key] <= 2)}
                showPiiWarning
              />
              <CommentField
                label="What does management do best? (Optional)"
                value={formData.best_thing || ''}
                onChange={v => updateField('best_thing', v)}
              />
              <CommentField
                label="What is one thing management should improve immediately? (Optional)"
                value={formData.improvement_suggestion || ''}
                onChange={v => updateField('improvement_suggestion', v)}
              />
            </div>
          )}

          {step === totalSteps && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Ready to Submit</h2>
              <div className="max-w-xl mx-auto p-6 bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 font-medium">
                Please review your feedback. This is completely anonymous and cannot be edited after submission.
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={prevStep}
              disabled={isSubmitting}
              className="px-6 py-3 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center space-x-2 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : <div />}

          {step < totalSteps ? (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="px-6 py-3 bg-brand text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors hover:bg-brand/90"
            >
              <span>{step === 1 ? 'Start Survey' : 'Next'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-3 bg-brand text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg shadow-brand/20 transition-all w-40"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Submit</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
