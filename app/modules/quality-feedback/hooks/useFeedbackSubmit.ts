import { useState } from 'react';
import { feedbackService } from '../services/feedbackService';
import { FeedbackFormData } from '../types/feedback.types';

export const useFeedbackSubmit = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitFeedback = async (data: FeedbackFormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await feedbackService.submitFeedback({
        ...data,
        submission_month: new Date().toISOString().substring(0, 7)
      });
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback. Please try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submitFeedback, isSubmitting, error };
};
