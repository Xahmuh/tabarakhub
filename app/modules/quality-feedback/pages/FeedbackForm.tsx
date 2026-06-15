import React, { useEffect, useState } from 'react';
import { FormProgress } from '../components/form/FormProgress';
import { SectionRating } from '../components/form/SectionRating';
import { CommentField } from '../components/form/CommentField';
import { useFeedbackSubmit } from '../hooks/useFeedbackSubmit';
import { feedbackService } from '../services/feedbackService';
import { FeedbackFormData, Question, ModuleSettings, FeedbackSection } from '../types/feedback.types';
import { ThankYouPage } from './ThankYouPage';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClipboardCheck,
  Globe,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  User
} from 'lucide-react';
import { useAnonymityGuard } from '../hooks/useAnonymityGuard';
import { BackToModulesButton } from '../../../shared';

interface Props {
  onBack: () => void;
}

const INITIAL_DATA: FeedbackFormData = {
  branch_cluster: '',
  role: '',
  experience_range: '',
  submission_month: '',
};

const SECTIONS: FeedbackSection[] = ['Operations', 'Purchasing', 'HR', 'IT', 'Overall'];

const ROLE_OPTIONS = [
  'Pharmacist',
  'Cashier',
  'Warehouse Staff',
  'Delivery',
  'Supervisor'
].map(value => ({ value, label: value }));

const EXPERIENCE_OPTIONS = [
  { value: '0-1 Years', label: '0-1 Years' },
  { value: '1-3 Years', label: '1-3 Years' },
  { value: '3-5 Years', label: '3-5 Years' },
  { value: '5+ Years', label: '5+ Years' },
];

const CenteredState: React.FC<{
  icon: React.ReactNode;
  title: string;
  message: React.ReactNode;
  action?: React.ReactNode;
}> = ({ icon, title, message, action }) => (
  <div className="mx-auto mt-12 flex max-w-2xl flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-brand ring-1 ring-slate-200">
      {icon}
    </div>
    <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
    <div className="mt-3 text-sm font-bold leading-6 text-slate-500">{message}</div>
    {action && <div className="mt-6">{action}</div>}
  </div>
);

const FieldSelect: React.FC<{
  label: string;
  value: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  icon: React.ReactNode;
  onChange: (value: string) => void;
}> = ({ label, value, placeholder, options, icon, onChange }) => (
  <label className="block">
    <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
      {icon}
      {label}
    </span>
    <select
      className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 shadow-sm outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </label>
);

const SectionHeader: React.FC<{
  eyebrow: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
}> = ({ eyebrow, title, description, icon }) => (
  <div className="mb-7 flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-brand">
        {icon}
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{title}</h2>
      {description && <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-slate-500">{description}</p>}
    </div>
  </div>
);

export const FeedbackForm: React.FC<Props> = ({ onBack }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FeedbackFormData>(INITIAL_DATA);
  const [submitted, setSubmitted] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<ModuleSettings | null>(null);
  const [branchAreaOptions, setBranchAreaOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lang, setLang] = useState<'en' | 'ar'>('en');

  const { submitFeedback, isSubmitting, error: submitError } = useFeedbackSubmit();
  const maxPerPeriod = settings?.max_submissions_per_month ?? 4;
  const period = settings?.submission_period ?? 'monthly';
  const { hasReachedLimit, submissionsThisPeriod, recordSubmission, periodLabel } = useAnonymityGuard(maxPerPeriod, period);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const [qstns, sett, branchAreas] = await Promise.all([
          feedbackService.fetchActiveQuestions(),
          feedbackService.getModuleSettings(),
          feedbackService.fetchBranchAreaOptions()
        ]);
        setQuestions(qstns);
        setSettings(sett);
        setBranchAreaOptions(branchAreas);
      } catch (err) {
        setFetchError('Failed to load form. Please check your connection.');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const totalSteps = SECTIONS.length + 4;
  const workflowSteps = [
    { label: 'Welcome', icon: ShieldCheck },
    { label: 'Profile', icon: User },
    ...SECTIONS.map(section => ({ label: section, icon: ClipboardCheck })),
    { label: 'Comments', icon: MessageSquare },
    { label: 'Submit', icon: Send },
  ];
  const currentStepIndex = Math.min(step - 1, workflowSteps.length - 1);
  const currentStepMeta = workflowSteps[currentStepIndex];
  const CurrentStepIcon = currentStepMeta.icon;

  const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const canProceed = () => {
    if (step === 1) return true;
    if (step === 2) return !!(formData.branch_cluster && formData.role && formData.experience_range);

    const sectionIndex = step - 3;
    if (sectionIndex >= 0 && sectionIndex < SECTIONS.length) {
      const sectionQuestions = questions.filter(q => q.section === SECTIONS[sectionIndex]);
      return sectionQuestions.every(q => {
        const score = Number(formData[q.field_key] || 0);
        if (score <= 0) return false;
        if (score < 3) {
          const note = formData[`note_${q.field_key}`];
          return note && note.trim().length > 0;
        }
        return true;
      });
    }

    if (step === totalSteps - 1) {
      const hasLowScore = questions.some(q => Number(formData[q.field_key] || 0) > 0 && Number(formData[q.field_key] || 0) <= 2);
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

  if (isLoading) {
    return (
      <CenteredState
        icon={<Loader2 className="h-8 w-8 animate-spin" />}
        title="Preparing survey"
        message="Loading active questions and branch area options."
      />
    );
  }

  if (fetchError) {
    return (
      <CenteredState
        icon={<AlertTriangle className="h-8 w-8 text-rose-600" />}
        title="Connection Error"
        message={fetchError}
        action={(
          <button onClick={() => window.location.reload()} className="rounded-xl bg-brand px-6 py-3 text-sm font-black text-white shadow-lg shadow-brand/20 transition-colors hover:bg-brand-hover">
            Try Again
          </button>
        )}
      />
    );
  }

  if (settings && !settings.is_enabled) {
    return (
      <CenteredState
        icon={<Lock className="h-8 w-8 text-slate-500" />}
        title="Form Closed"
        message="The feedback form is currently closed. Please check back later."
        action={<BackToModulesButton onClick={onBack} />}
      />
    );
  }

  if (hasReachedLimit() && !submitted) {
    return (
      <CenteredState
        icon={<ShieldCheck className="h-8 w-8 text-amber-600" />}
        title="Limit Reached"
        message={(
          <>
            You have submitted <strong>{submissionsThisPeriod()}</strong> of <strong>{maxPerPeriod}</strong> allowed responses this {periodLabel}. You can submit again next {periodLabel}.
          </>
        )}
        action={<BackToModulesButton onClick={onBack} />}
      />
    );
  }

  if (submitted) {
    return <ThankYouPage onBackToHome={onBack} />;
  }

  const branchOptions = branchAreaOptions.map(area => ({ value: area, label: area }));
  const currentSectionIndex = step - 3;
  const isSectionStep = currentSectionIndex >= 0 && currentSectionIndex < SECTIONS.length;
  const lowScoreCount = questions.filter(q => Number(formData[q.field_key] || 0) > 0 && Number(formData[q.field_key] || 0) <= 2).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <BackToModulesButton onClick={onBack} />
        <button
          type="button"
          onClick={() => setLang(l => l === 'en' ? 'ar' : 'en')}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition-all hover:border-brand/30 hover:text-brand"
        >
          <Globe className="h-4 w-4" />
          {lang === 'en' ? 'Arabic' : 'English'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Anonymous QC</p>
                <h1 className="mt-1 text-xl font-black tracking-tight text-slate-950">QC Insights</h1>
              </div>
            </div>

            <div className="mt-6">
              <FormProgress currentStep={step} totalSteps={totalSteps} />
            </div>

            <ol className="mt-6 space-y-2">
              {workflowSteps.map((item, index) => {
                const StepIcon = item.icon;
                const isActive = index === currentStepIndex;
                const isDone = index < currentStepIndex;
                return (
                  <li key={item.label}>
                    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                      isActive ? 'bg-brand/10 text-brand' : isDone ? 'text-slate-900' : 'text-slate-400'
                    }`}>
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                        isDone
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                          : isActive
                          ? 'border-brand/20 bg-white text-brand'
                          : 'border-slate-200 bg-white'
                      }`}>
                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                      </span>
                      <span className="text-sm font-black">{item.label}</span>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="flex items-start gap-2 text-xs font-bold leading-5 text-slate-500">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>No names, employee IDs, or personal contact details are requested.</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-8">
            <div className="mb-4 flex items-center justify-between gap-4 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <CurrentStepIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">QC Insights</p>
                  <h1 className="text-lg font-black tracking-tight text-slate-950">{currentStepMeta.label}</h1>
                </div>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-500">
                {step}/{totalSteps}
              </span>
            </div>
            <FormProgress currentStep={step} totalSteps={totalSteps} />
          </div>

          <div className="min-h-[520px] p-5 sm:p-8 lg:p-10">
            {submitError && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm font-bold">{submitError}</p>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full border border-brand/10 bg-brand/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-brand">
                    <Sparkles className="h-3.5 w-3.5" />
                    Anonymous workspace pulse
                  </p>
                  <h2 className="mt-5 max-w-2xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                    QC Insights Survey
                  </h2>
                  <p className="mt-4 max-w-2xl text-base font-bold leading-8 text-slate-500">
                    Share direct feedback about the teams and systems that affect daily branch work. The survey is short, anonymous, and built around practical improvement.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand shadow-sm">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-950">Privacy first</p>
                      <p className="text-xs font-bold text-slate-500">No personal identity fields.</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3 text-sm font-bold text-slate-600">
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Branch area only</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Role and experience band</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> No names or employee IDs</div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <SectionHeader
                  eyebrow="Basic information"
                  title="Tell us where to place your feedback."
                  description="These fields keep reporting useful without identifying you personally."
                  icon={<User className="h-4 w-4" />}
                />
                <div className="grid gap-5 md:grid-cols-3">
                  <FieldSelect
                    label="Branch Area"
                    value={formData.branch_cluster}
                    placeholder="Select governorate"
                    options={branchOptions}
                    icon={<MapPin className="h-4 w-4" />}
                    onChange={value => updateField('branch_cluster', value)}
                  />
                  <FieldSelect
                    label="Your Role"
                    value={formData.role}
                    placeholder="Select role"
                    options={ROLE_OPTIONS}
                    icon={<Briefcase className="h-4 w-4" />}
                    onChange={value => updateField('role', value)}
                  />
                  <FieldSelect
                    label="Experience"
                    value={formData.experience_range}
                    placeholder="Select range"
                    options={EXPERIENCE_OPTIONS}
                    icon={<Clock className="h-4 w-4" />}
                    onChange={value => updateField('experience_range', value)}
                  />
                </div>
              </div>
            )}

            {isSectionStep && (() => {
              const sectionName = SECTIONS[currentSectionIndex];
              const sectionQuestions = questions.filter(q => q.section === sectionName);
              return (
                <div>
                  <SectionHeader
                    eyebrow={`Section ${currentSectionIndex + 1} of ${SECTIONS.length}`}
                    title={`${sectionName} Department`}
                    description={`${sectionQuestions.length} active question${sectionQuestions.length === 1 ? '' : 's'} in this section.`}
                    icon={<ClipboardCheck className="h-4 w-4" />}
                  />
                  <div className="space-y-4">
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
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">
                        No questions active in this section.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {step === totalSteps - 1 && (
              <div>
                <SectionHeader
                  eyebrow="Open comments"
                  title="Add the context behind the scores."
                  description={lowScoreCount > 0 ? `${lowScoreCount} low score response${lowScoreCount === 1 ? '' : 's'} detected. A biggest issue comment is required.` : 'Optional comments help management see the story behind the numbers.'}
                  icon={<MessageSquare className="h-4 w-4" />}
                />
                <div className="space-y-7">
                  <CommentField
                    label="What is the biggest operational challenge you face?"
                    value={formData.biggest_issue || ''}
                    onChange={v => updateField('biggest_issue', v)}
                    required={lowScoreCount > 0}
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
              </div>
            )}

            {step === totalSteps && (
              <div>
                <SectionHeader
                  eyebrow="Ready to submit"
                  title="Review the anonymous summary."
                  description="Your response cannot be edited after submission."
                  icon={<Send className="h-4 w-4" />}
                />
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { label: 'Branch Area', value: formData.branch_cluster || 'Not selected', icon: MapPin },
                    { label: 'Role', value: formData.role || 'Not selected', icon: Briefcase },
                    { label: 'Experience', value: formData.experience_range || 'Not selected', icon: Clock },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </div>
                        <p className="mt-3 text-sm font-black text-slate-950">{item.value}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm font-bold leading-6">
                    This survey stores non-identifying context only. Please make sure comments do not include names, phone numbers, IDs, or personal details.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 p-4 sm:p-6">
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                disabled={isSubmitting}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition-all hover:bg-slate-100 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            ) : <div />}

            {step < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!canProceed()}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-6 text-sm font-black text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {step === 1 ? 'Start Survey' : 'Next'}
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex h-11 w-40 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-black text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4" /> Submit</>}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
