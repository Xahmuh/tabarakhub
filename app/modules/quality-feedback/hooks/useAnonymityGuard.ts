import { SubmissionPeriod } from '../types/feedback.types';

const STORAGE_KEY = 'feedback_monthly_submissions';

const getCurrentPeriodKey = (period: SubmissionPeriod): string => {
  const now = new Date();
  const year = now.getFullYear();
  if (period === 'quarterly') {
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    return `${year}-Q${quarter}`;
  }
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getData = (): Record<string, number> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveData = (data: Record<string, number>) => {
  const recent = Object.keys(data).sort().slice(-6)
    .reduce<Record<string, number>>((acc, k) => { acc[k] = data[k]; return acc; }, {});
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
};

export const useAnonymityGuard = (maxPerPeriod: number = 4, period: SubmissionPeriod = 'monthly') => {
  const periodKey = getCurrentPeriodKey(period);

  const getCount = () => getData()[periodKey] || 0;

  const hasReachedLimit = () => getCount() >= maxPerPeriod;

  const submissionsThisPeriod = () => getCount();

  const remainingSubmissions = () => Math.max(0, maxPerPeriod - getCount());

  const recordSubmission = () => {
    const data = getData();
    data[periodKey] = (data[periodKey] || 0) + 1;
    saveData(data);
  };

  const periodLabel = period === 'quarterly' ? 'quarter' : 'month';

  return { hasReachedLimit, submissionsThisPeriod, remainingSubmissions, recordSubmission, periodLabel };
};
