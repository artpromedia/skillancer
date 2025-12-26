/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, jsx-a11y/no-autofocus */
'use client';

import { Button, cn, Textarea } from '@skillancer/ui';
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Save,
  Sparkles,
  Undo,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface CoverLetterEditorProps {
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  jobRequirements?: string[];
  suggestions?: CoverLetterSuggestion[];
  onSaveAsTemplate?: (name: string) => void;
  className?: string;
  error?: string;
}

interface CoverLetterSuggestion {
  type: 'tip' | 'highlight' | 'question';
  text: string;
}

// ============================================================================
// Component
// ============================================================================

export function CoverLetterEditor({
  value,
  onChange,
  minLength = 200,
  maxLength = 5000,
  placeholder = "Write a compelling cover letter that showcases your experience and explains why you're the best fit for this project...",
  jobRequirements = [],
  suggestions = [],
  onSaveAsTemplate,
  className,
  error,
}: CoverLetterEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<string[]>([value]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Character count and reading time
  const charCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const readingTime = Math.ceil(wordCount / 200); // Average 200 WPM

  // Progress for minimum length
  const progress = Math.min((charCount / minLength) * 100, 100);
  const isMinMet = charCount >= minLength;
  const isMaxExceeded = charCount > maxLength;

  // Add to history on change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (value !== history[historyIndex]) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(value);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [value, history, historyIndex]);

  // Handle undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      onChange(history[historyIndex - 1]);
    }
  }, [history, historyIndex, onChange]);

  // Handle text formatting
  const insertFormatting = useCallback(
    (prefix: string, suffix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);

      const newValue =
        value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);

      onChange(newValue);

      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      }, 0);
    },
    [value, onChange]
  );

  // Handle bold
  const handleBold = useCallback(() => {
    insertFormatting('**', '**');
  }, [insertFormatting]);

  // Handle italic
  const handleItalic = useCallback(() => {
    insertFormatting('*', '*');
  }, [insertFormatting]);

  // Handle link
  const handleLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (url) {
      insertFormatting('[', `](${url})`);
    }
  }, [insertFormatting]);

  // Handle bullet list
  const handleBulletList = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;

    const newValue = value.substring(0, lineStart) + '• ' + value.substring(lineStart);

    onChange(newValue);
    textarea.focus();
  }, [value, onChange]);

  // Handle numbered list
  const handleNumberedList = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;

    const newValue = value.substring(0, lineStart) + '1. ' + value.substring(lineStart);

    onChange(newValue);
    textarea.focus();
  }, [value, onChange]);

  // AI assistance (mock)
  const handleAIAssist = useCallback(async () => {
    setIsGenerating(true);

    // Simulate AI response
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // In real implementation, this would call an AI API
    const aiSuggestion =
      '\n\nI am particularly excited about this project because of my extensive experience in similar work. My approach would be to first understand your requirements thoroughly, then deliver high-quality results within your timeline.';

    onChange(value + aiSuggestion);
    setIsGenerating(false);
  }, [value, onChange]);

  // Save as template
  const handleSaveTemplate = useCallback(() => {
    if (templateName.trim() && onSaveAsTemplate) {
      onSaveAsTemplate(templateName.trim());
      setTemplateName('');
      setShowTemplateDialog(false);
    }
  }, [templateName, onSaveAsTemplate]);

  // Highlight job requirements mentioned
  const highlightedRequirements = jobRequirements.filter((req) =>
    value.toLowerCase().includes(req.toLowerCase())
  );
  const missingRequirements = jobRequirements.filter(
    (req) => !value.toLowerCase().includes(req.toLowerCase())
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-t-lg border bg-slate-50 p-2">
        <Button
          className="h-8 w-8"
          size="icon"
          title="Bold (Ctrl+B)"
          type="button"
          variant="ghost"
          onClick={handleBold}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8"
          size="icon"
          title="Italic (Ctrl+I)"
          type="button"
          variant="ghost"
          onClick={handleItalic}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8"
          size="icon"
          title="Insert Link"
          type="button"
          variant="ghost"
          onClick={handleLink}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>

        <div className="bg-border mx-1 h-6 w-px" />

        <Button
          className="h-8 w-8"
          size="icon"
          title="Bullet List"
          type="button"
          variant="ghost"
          onClick={handleBulletList}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8"
          size="icon"
          title="Numbered List"
          type="button"
          variant="ghost"
          onClick={handleNumberedList}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <div className="bg-border mx-1 h-6 w-px" />

        <Button
          className="h-8 w-8"
          disabled={historyIndex === 0}
          size="icon"
          title="Undo"
          type="button"
          variant="ghost"
          onClick={handleUndo}
        >
          <Undo className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        {/* AI Assist Button */}
        <Button
          className="h-8 gap-1.5"
          disabled={isGenerating}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => void handleAIAssist()}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isGenerating ? 'Generating...' : 'AI Assist'}
        </Button>

        {/* Save as Template */}
        {onSaveAsTemplate && (
          <Button
            className="h-8 gap-1.5"
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => setShowTemplateDialog(true)}
          >
            <Save className="h-4 w-4" />
            Save Template
          </Button>
        )}
      </div>

      {/* Editor */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          className={cn(
            'min-h-[300px] resize-none rounded-t-none border-t-0 font-mono text-sm',
            isMaxExceeded && 'border-red-500 focus-visible:ring-red-500',
            error && 'border-red-500'
          )}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />

        {/* Character count bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-lg bg-slate-100">
          <div
            className={cn(
              'h-full transition-all',
              isMaxExceeded ? 'bg-red-500' : isMinMet ? 'bg-green-500' : 'bg-yellow-500'
            )}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-4">
          <span
            className={cn(
              'font-medium',
              isMaxExceeded ? 'text-red-600' : isMinMet ? 'text-green-600' : 'text-yellow-600'
            )}
          >
            {charCount.toLocaleString()} / {maxLength.toLocaleString()} characters
          </span>
          <span className="text-muted-foreground">{wordCount} words</span>
          <span className="text-muted-foreground">{readingTime} min read</span>
        </div>

        {!isMinMet && (
          <span className="text-yellow-600">{minLength - charCount} more characters needed</span>
        )}

        {isMaxExceeded && (
          <span className="text-red-600">{charCount - maxLength} characters over limit</span>
        )}
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Suggestions toggle */}
      {(suggestions.length > 0 || jobRequirements.length > 0) && (
        <Button
          className="w-full"
          size="sm"
          type="button"
          variant="outline"
          onClick={() => setShowSuggestions(!showSuggestions)}
        >
          {showSuggestions ? 'Hide Suggestions' : 'Show Writing Suggestions'}
        </Button>
      )}

      {/* Suggestions panel */}
      {showSuggestions && (
        <div className="space-y-4 rounded-lg border bg-blue-50 p-4">
          {/* Job requirements tracking */}
          {jobRequirements.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium text-blue-900">Job Requirements Coverage</h4>

              {highlightedRequirements.length > 0 && (
                <div className="mb-2">
                  <p className="mb-1 text-xs text-green-700">✓ Mentioned:</p>
                  <div className="flex flex-wrap gap-1">
                    {highlightedRequirements.map((req) => (
                      <span
                        key={req}
                        className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800"
                      >
                        {req}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {missingRequirements.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-yellow-700">○ Consider mentioning:</p>
                  <div className="flex flex-wrap gap-1">
                    {missingRequirements.map((req) => (
                      <span
                        key={req}
                        className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800"
                      >
                        {req}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Writing tips */}
          {suggestions.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium text-blue-900">Writing Tips</h4>
              <ul className="space-y-1">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-blue-800">
                    {suggestion.type === 'tip' && '💡 '}
                    {suggestion.type === 'highlight' && '⭐ '}
                    {suggestion.type === 'question' && '❓ '}
                    {suggestion.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Template save dialog */}
      {showTemplateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 font-semibold">Save as Template</h3>
            <input
              autoFocus
              className="mb-4 w-full rounded-lg border px-3 py-2"
              placeholder="Template name..."
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowTemplateDialog(false)}>
                Cancel
              </Button>
              <Button disabled={!templateName.trim()} type="button" onClick={handleSaveTemplate}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
