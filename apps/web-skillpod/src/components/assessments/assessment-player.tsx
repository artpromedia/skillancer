'use client';

import { Save } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

interface Question {
  id: string;
  type: 'multiple-choice' | 'code-challenge' | 'short-answer' | 'practical-task';
  text: string;
  code?: string | null;
  options?: { id: string; text: string }[];
  multiple?: boolean;
  testCases?: { input: string; output: string }[];
  hiddenTestCount?: number;
  starterCode?: string;
  maxLength?: number;
}

interface Answer {
  questionId: string;
  value: string | string[];
  flagged: boolean;
  visited: boolean;
  savedAt?: Date;
}

interface AssessmentPlayerProps {
  assessmentId: string;
  attemptId: string;
  questions: Question[];
  timeLimit: number; // in seconds
  onSubmit: (answers: Record<string, Answer>) => Promise<void>;
  onTimeUp: () => void;
  initialAnswers?: Record<string, Answer>;
}

export function AssessmentPlayer({
  assessmentId: _assessmentId,
  attemptId: _attemptId,
  questions,
  timeLimit,
  onSubmit,
  onTimeUp,
  initialAnswers = {},
}: Readonly<AssessmentPlayerProps>) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>(initialAnswers);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];

  // Initialize answers for all questions
  useEffect(() => {
    const initial: Record<string, Answer> = {};
    questions.forEach((q) => {
      if (!answers[q.id]) {
        initial[q.id] = {
          questionId: q.id,
          value: q.type === 'multiple-choice' && q.multiple ? [] : '',
          flagged: false,
          visited: false,
        };
      }
    });
    if (Object.keys(initial).length > 0) {
      setAnswers((prev) => ({ ...prev, ...initial }));
    }
  }, [questions]);

  // Mark current question as visited
  useEffect(() => {
    if (currentQuestion && answers[currentQuestion.id]) {
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          ...prev[currentQuestion.id],
          visited: true,
        },
      }));
    }
  }, [currentQuestionIndex]);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onTimeUp]);

  // Auto-save answers periodically
  useEffect(() => {
    const saveInterval = setInterval(() => {
      void autoSaveAnswers();
    }, 30000); // Save every 30 seconds

    return () => clearInterval(saveInterval);
  }, [answers]);

  const autoSaveAnswers = useCallback(async () => {
    if (Object.keys(answers).length === 0) return;

    setIsSaving(true);
    try {
      // In real app, save to API
      await new Promise((resolve) => setTimeout(resolve, 500));
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to auto-save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [answers]);

  const updateAnswer = useCallback((questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        value,
        savedAt: new Date(),
      },
    }));
  }, []);

  const toggleFlag = useCallback((questionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        flagged: !prev[questionId]?.flagged,
      },
    }));
  }, []);

  const navigateToQuestion = useCallback(
    (index: number) => {
      if (index >= 0 && index < questions.length) {
        setCurrentQuestionIndex(index);
      }
    },
    [questions.length]
  );

  const submitAssessment = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(answers);
    } catch (error) {
      console.error('Failed to submit:', error);
      setIsSubmitting(false);
    }
  }, [answers, onSubmit]);

  const getQuestionStatus = useCallback(
    (questionId: string): 'not-visited' | 'visited' | 'answered' | 'flagged' | 'current' => {
      const answer = answers[questionId];
      const question = questions.find((q) => q.id === questionId);
      const isCurrent = question && questions[currentQuestionIndex]?.id === questionId;

      if (isCurrent) return 'current';
      if (answer?.flagged) return 'flagged';
      if (answer?.value && (Array.isArray(answer.value) ? answer.value.length > 0 : answer.value))
        return 'answered';
      if (answer?.visited) return 'visited';
      return 'not-visited';
    },
    [answers, questions, currentQuestionIndex]
  );

  const answeredCount = Object.values(answers).filter(
    (a) => a.value && (Array.isArray(a.value) ? a.value.length > 0 : a.value)
  ).length;

  const flaggedCount = Object.values(answers).filter((a) => a.flagged).length;

  return {
    // State
    currentQuestion,
    currentQuestionIndex,
    answers,
    timeRemaining,
    isSaving,
    lastSaved,
    isSubmitting,
    answeredCount,
    flaggedCount,
    totalQuestions: questions.length,

    // Actions
    updateAnswer,
    toggleFlag,
    navigateToQuestion,
    submitAssessment,
    getQuestionStatus,

    // Helpers
    canNavigatePrev: currentQuestionIndex > 0,
    canNavigateNext: currentQuestionIndex < questions.length - 1,
    nextQuestion: () => navigateToQuestion(currentQuestionIndex + 1),
    prevQuestion: () => navigateToQuestion(currentQuestionIndex - 1),
  };
}

// Status indicator component
export function SaveStatus({
  isSaving,
  lastSaved,
}: Readonly<{ isSaving: boolean; lastSaved: Date | null }>) {
  if (isSaving) {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-500">
        <Save className="h-3 w-3 animate-pulse" />
        Saving...
      </span>
    );
  }

  if (lastSaved) {
    const timeAgo = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    const label = timeAgo < 60 ? 'just now' : `${Math.floor(timeAgo / 60)}m ago`;

    return (
      <span className="flex items-center gap-1 text-xs text-gray-500">
        <Save className="h-3 w-3" />
        Saved {label}
      </span>
    );
  }

  return null;
}

export default AssessmentPlayer;
