'use client';

import { cn } from '@skillancer/ui';
import { Play, CheckCircle2, XCircle, Loader2, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { useState } from 'react';

interface TestCase {
  input: string;
  output: string;
}

interface CodeChallengeProps {
  question: {
    id: string;
    text: string;
    testCases?: TestCase[];
    hiddenTestCount?: number;
    starterCode?: string;
    language?: string;
  };
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CodeChallenge({
  question,
  value,
  onChange,
  disabled = false,
}: Readonly<CodeChallengeProps>) {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{ passed: boolean; message: string }[] | null>(
    null
  );
  const [showHints, setShowHints] = useState(false);

  const code = value || question.starterCode || '';

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput(null);
    setTestResults(null);

    // Simulate code execution
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock results
    const mockResults = question.testCases?.map((tc, idx) => ({
      passed: Math.random() > 0.3, // Random pass/fail for demo
      message: `Test ${idx + 1}: ${tc.input} → Expected: ${tc.output}`,
    }));

    setTestResults(mockResults || []);
    setIsRunning(false);
  };

  const handleReset = () => {
    onChange(question.starterCode || '');
    setOutput(null);
    setTestResults(null);
  };

  const passedCount = testResults?.filter((r) => r.passed).length || 0;
  const totalTests = (question.testCases?.length || 0) + (question.hiddenTestCount || 0);

  return (
    <div className="space-y-4">
      {/* Problem Statement */}
      <div className="prose prose-sm max-w-none">
        <p className="text-lg text-gray-900">{question.text}</p>
      </div>

      {/* Code Editor */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        {/* Editor Header */}
        <div className="flex items-center justify-between bg-gray-800 px-4 py-2 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <span className="font-mono">{question.language || 'typescript'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-gray-700"
              onClick={() => setShowHints(!showHints)}
            >
              {showHints ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showHints ? 'Hide Hints' : 'Show Hints'}
            </button>
            <button
              className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-gray-700"
              disabled={disabled}
              onClick={handleReset}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>

        {/* Code Area */}
        <textarea
          className={cn(
            'h-64 w-full resize-none bg-gray-900 p-4 font-mono text-sm text-gray-100 focus:outline-none',
            disabled && 'cursor-not-allowed opacity-75'
          )}
          disabled={disabled}
          placeholder="Write your code here..."
          spellCheck={false}
          value={code}
          onChange={(e) => onChange(e.target.value)}
        />

        {/* Hints Section */}
        {showHints && (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            <strong>Hint:</strong> Remember to handle edge cases and consider the return type
            carefully.
          </div>
        )}
      </div>

      {/* Test Cases */}
      {question.testCases && question.testCases.length > 0 && (
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Test Cases</h4>
            {question.hiddenTestCount && (
              <span className="text-xs text-gray-500">
                + {question.hiddenTestCount} hidden tests
              </span>
            )}
          </div>
          <div className="space-y-2">
            {question.testCases.map((tc, idx) => (
              <div
                key={`${tc.input}-${tc.output}`}
                className={cn(
                  'flex items-start gap-3 rounded border bg-white p-3',
                  testResults?.[idx]?.passed === true && 'border-green-200 bg-green-50',
                  testResults?.[idx]?.passed === false && 'border-red-200 bg-red-50'
                )}
              >
                {testResults?.[idx] && (
                  <span className="mt-0.5 shrink-0">
                    {testResults[idx].passed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                  </span>
                )}
                <div className="flex-1 font-mono text-sm">
                  <p className="text-gray-600">
                    <span className="text-gray-400">Input:</span> {tc.input}
                  </p>
                  <p className="text-gray-600">
                    <span className="text-gray-400">Expected:</span> {tc.output}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          {testResults && (
            <span className="text-sm">
              <span
                className={cn(
                  'font-medium',
                  passedCount === totalTests ? 'text-green-600' : 'text-amber-600'
                )}
              >
                {passedCount}/{question.testCases?.length || 0} visible tests passed
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors',
              disabled || isRunning || !code.trim()
                ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                : 'bg-green-600 text-white hover:bg-green-700'
            )}
            disabled={disabled || isRunning || !code.trim()}
            onClick={() => void handleRunCode()}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Code
              </>
            )}
          </button>
        </div>
      </div>

      {/* Output Panel */}
      {output && (
        <div className="rounded-lg bg-gray-900 p-4">
          <p className="mb-2 text-xs text-gray-400">Output:</p>
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-100">{output}</pre>
        </div>
      )}
    </div>
  );
}

export default CodeChallenge;
