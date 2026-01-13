'use client';

import { cn } from '@skillancer/ui';
import { AlertTriangle, Flag, ChevronLeft, ChevronRight, Send, Maximize2, X } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

import ProctoringStatus from '../../../../components/assessments/proctoring-status';
import QuestionNavigator from '../../../../components/assessments/question-navigator';
import CodeChallenge from '../../../../components/assessments/question-types/code-challenge';
import MultipleChoice from '../../../../components/assessments/question-types/multiple-choice';
import PracticalTask from '../../../../components/assessments/question-types/practical-task';
import ShortAnswer from '../../../../components/assessments/question-types/short-answer';
import AssessmentTimer from '../../../../components/assessments/timer';

// Mock questions
const mockQuestions = [
  {
    id: 'q1',
    type: 'multiple-choice',
    text: 'Which React hook is best suited for implementing a subscription to an external data source?',
    code: null,
    options: [
      { id: 'a', text: 'useEffect' },
      { id: 'b', text: 'useSyncExternalStore' },
      { id: 'c', text: 'useLayoutEffect' },
      { id: 'd', text: 'useReducer' },
    ],
    multiple: false,
  },
  {
    id: 'q2',
    type: 'multiple-choice',
    text: 'What are the main benefits of using the Compound Component pattern?',
    code: `// Example of compound component usage:
<Menu>
  <Menu.Button>Options</Menu.Button>
  <Menu.List>
    <Menu.Item>Edit</Menu.Item>
    <Menu.Item>Delete</Menu.Item>
  </Menu.List>
</Menu>`,
    options: [
      { id: 'a', text: 'Flexible and implicit state sharing between components' },
      { id: 'b', text: 'Better performance due to memoization' },
      { id: 'c', text: 'Easier testing with isolated unit tests' },
      { id: 'd', text: 'Declarative API with clear component relationships' },
    ],
    multiple: true,
  },
  {
    id: 'q3',
    type: 'code-challenge',
    text: 'Implement a custom hook `useDebounce` that debounces a value. The hook should accept a value and delay in milliseconds, returning the debounced value.',
    testCases: [
      { input: 'value: "hello", delay: 500', output: '"hello" after 500ms' },
      { input: 'value changes rapidly', output: 'Only latest value returned' },
    ],
    hiddenTestCount: 3,
    starterCode: `function useDebounce<T>(value: T, delay: number): T {
  // Your implementation here
}`,
  },
  {
    id: 'q4',
    type: 'short-answer',
    text: 'Explain the difference between `useMemo` and `useCallback` hooks. When would you use each one?',
    maxLength: 500,
  },
  {
    id: 'q5',
    type: 'multiple-choice',
    text: 'What is the purpose of `React.memo()`?',
    options: [
      { id: 'a', text: 'To memoize computed values inside a component' },
      { id: 'b', text: 'To prevent unnecessary re-renders of functional components' },
      { id: 'c', text: 'To cache API responses' },
      { id: 'd', text: 'To create a ref that persists across renders' },
    ],
    multiple: false,
  },
];

interface Answer {
  questionId: string;
  value: string | string[];
  flagged: boolean;
  visited: boolean;
}

export default function TakeAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [timeRemaining, setTimeRemaining] = useState(60 * 60); // 60 minutes in seconds
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // Track fullscreen state for proctoring - used in toggleFullscreen callback
  // eslint-disable-next-line react/hook-use-state -- setter used, value tracked for proctoring purposes
  const [, setIsFullscreen] = useState(false);

  const questions = mockQuestions;
  const currentQuestion = questions[currentQuestionIndex];

  // Initialize answers
  useEffect(() => {
    const initialAnswers: Record<string, Answer> = {};
    questions.forEach((q) => {
      initialAnswers[q.id] = {
        questionId: q.id,
        value: q.type === 'multiple-choice' && q.multiple ? [] : '',
        flagged: false,
        visited: false,
      };
    });
    setAnswers(initialAnswers);
  }, []);

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
        if (prev <= 0) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fullscreen handling
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      void document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    }
  }, []);

  const handleAnswerChange = (value: string | string[]) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        value,
      },
    }));
  };

  const handleFlagQuestion = () => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        flagged: !prev[currentQuestion.id]?.flagged,
      },
    }));
  };

  const handleNavigate = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
    }
  };

  const handleSubmit = () => {
    // In real app, submit answers to API
    router.push(`/assessments/${String(params.assessmentId)}/results`);
  };

  const getQuestionStatus = (
    questionId: string
  ): 'not-visited' | 'visited' | 'answered' | 'flagged' | 'current' => {
    const answer = answers[questionId];
    const question = questions.find((q) => q.id === questionId);
    const isCurrentQuestion = question && questions[currentQuestionIndex].id === questionId;

    if (isCurrentQuestion) return 'current';
    if (answer?.flagged) return 'flagged';
    if (answer?.value && (Array.isArray(answer.value) ? answer.value.length > 0 : answer.value))
      return 'answered';
    if (answer?.visited) return 'visited';
    return 'not-visited';
  };

  const answeredCount = Object.values(answers).filter(
    (a) => a.value && (Array.isArray(a.value) ? a.value.length > 0 : a.value)
  ).length;
  const flaggedCount = Object.values(answers).filter((a) => a.flagged).length;

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      {/* Top Bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <button
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
            onClick={() => setShowExitConfirm(true)}
          >
            <X className="h-5 w-5" />
            <span className="text-sm">Exit</span>
          </button>
          <div className="h-6 w-px bg-gray-200" />
          <h1 className="font-medium text-gray-900">React Advanced Patterns</h1>
        </div>

        <div className="flex items-center gap-4">
          <ProctoringStatus
            cameraEnabled={true}
            screenShareEnabled={false}
            fullscreenActive={false}
            connectionStatus="connected"
            compact
          />
          <div className="h-6 w-px bg-gray-200" />
          <AssessmentTimer
            timeRemaining={timeRemaining}
            totalTime={60 * 60}
            onTimeUp={handleSubmit}
          />
          <button
            className="rounded-lg p-2 hover:bg-gray-100"
            title="Toggle fullscreen"
            onClick={toggleFullscreen}
          >
            <Maximize2 className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="mx-auto max-w-4xl">
            {/* Question Header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-indigo-100 px-2 py-1 text-sm font-medium text-indigo-700">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <span className="text-sm capitalize text-gray-500">
                  {currentQuestion.type.replace('-', ' ')}
                </span>
              </div>
              <button
                className={cn(
                  'flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  answers[currentQuestion.id]?.flagged
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
                onClick={handleFlagQuestion}
              >
                <Flag className="h-4 w-4" />
                {answers[currentQuestion.id]?.flagged ? 'Flagged' : 'Flag for Review'}
              </button>
            </div>

            {/* Question Content */}
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
              {currentQuestion.type === 'multiple-choice' && (
                <MultipleChoice
                  question={currentQuestion}
                  value={answers[currentQuestion.id]?.value || (currentQuestion.multiple ? [] : '')}
                  onChange={handleAnswerChange}
                />
              )}
              {currentQuestion.type === 'code-challenge' && (
                <CodeChallenge
                  question={currentQuestion}
                  value={(answers[currentQuestion.id]?.value as string) || ''}
                  onChange={handleAnswerChange}
                />
              )}
              {currentQuestion.type === 'short-answer' && (
                <ShortAnswer
                  question={currentQuestion}
                  value={(answers[currentQuestion.id]?.value as string) || ''}
                  onChange={handleAnswerChange}
                />
              )}
              {currentQuestion.type === 'practical-task' && (
                <PracticalTask
                  question={currentQuestion}
                  value={(answers[currentQuestion.id]?.value as string) || ''}
                  onChange={handleAnswerChange}
                />
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 font-medium',
                  currentQuestionIndex === 0
                    ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
                disabled={currentQuestionIndex === 0}
                onClick={() => handleNavigate(currentQuestionIndex - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
                  onClick={() => setShowSubmitConfirm(true)}
                >
                  <Send className="h-4 w-4" />
                  Submit Assessment
                </button>
              </div>

              <button
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 font-medium',
                  currentQuestionIndex === questions.length - 1
                    ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                )}
                disabled={currentQuestionIndex === questions.length - 1}
                onClick={() => handleNavigate(currentQuestionIndex + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar - Question Navigator */}
        <div className="w-72 border-l border-gray-200 bg-white p-4">
          <QuestionNavigator
            answeredCount={answeredCount}
            currentIndex={currentQuestionIndex}
            flaggedCount={flaggedCount}
            getQuestionStatus={getQuestionStatus}
            questions={questions}
            onNavigate={handleNavigate}
          />
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Submit Assessment?</h3>
            </div>

            <div className="mb-6 space-y-2">
              <p className="text-gray-600">
                You have answered <strong>{answeredCount}</strong> of{' '}
                <strong>{questions.length}</strong> questions.
              </p>
              {flaggedCount > 0 && (
                <p className="text-amber-600">
                  <Flag className="mr-1 inline h-4 w-4" />
                  {flaggedCount} question{flaggedCount > 1 ? 's' : ''} flagged for review
                </p>
              )}
              {answeredCount < questions.length && (
                <p className="text-red-600">
                  {questions.length - answeredCount} question
                  {questions.length - answeredCount > 1 ? 's' : ''} unanswered
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50"
                onClick={() => setShowSubmitConfirm(false)}
              >
                Review Answers
              </button>
              <button
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
                onClick={handleSubmit}
              >
                Submit Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Exit Assessment?</h3>
            </div>

            <p className="mb-6 text-gray-600">
              Your progress will be saved, but leaving the assessment may count against your
              proctoring score. Are you sure you want to exit?
            </p>

            <div className="flex gap-3">
              <button
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
                onClick={() => setShowExitConfirm(false)}
              >
                Continue Assessment
              </button>
              <button
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50"
                onClick={() => router.push('/assessments')}
              >
                Exit Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
