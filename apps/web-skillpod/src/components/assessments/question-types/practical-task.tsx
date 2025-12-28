'use client';

import { cn } from '@skillancer/ui';
import { Upload, Link as LinkIcon, FileText, X, CheckCircle2, ExternalLink } from 'lucide-react';
import { useState, useRef } from 'react';

interface PracticalTaskProps {
  question: {
    id: string;
    text: string;
    requirements?: string[];
    acceptedFileTypes?: string[];
    maxFileSize?: number; // in MB
    allowLink?: boolean;
    allowDescription?: boolean;
  };
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

interface Submission {
  type: 'file' | 'link' | 'description';
  file?: File;
  link?: string;
  description?: string;
}

export function PracticalTask({
  question,
  value,
  onChange,
  disabled = false,
}: Readonly<PracticalTaskProps>) {
  const [submission, setSubmission] = useState<Submission | null>(() => {
    if (value) {
      try {
        return JSON.parse(value) as Submission;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [submissionType, setSubmissionType] = useState<'file' | 'link' | 'description'>('file');
  const [linkInput, setLinkInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requirements = question.requirements || [];
  const acceptedTypes = question.acceptedFileTypes || ['.pdf', '.zip', '.png', '.jpg'];
  const maxSize = question.maxFileSize || 10; // MB
  const allowLink = question.allowLink !== false;
  const allowDescription = question.allowDescription !== false;

  const handleFileSelect = (file: File) => {
    if (file.size > maxSize * 1024 * 1024) {
      alert(`File size must be less than ${maxSize}MB`);
      return;
    }

    const newSubmission: Submission = {
      type: 'file',
      file,
    };
    setSubmission(newSubmission);
    onChange(JSON.stringify({ type: 'file', fileName: file.name, fileSize: file.size }));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleLinkSubmit = () => {
    if (!linkInput.trim()) return;

    try {
      new URL(linkInput);
      const newSubmission: Submission = {
        type: 'link',
        link: linkInput,
      };
      setSubmission(newSubmission);
      onChange(JSON.stringify(newSubmission));
    } catch {
      alert('Please enter a valid URL');
    }
  };

  const handleDescriptionSubmit = () => {
    if (!descriptionInput.trim()) return;

    const newSubmission: Submission = {
      type: 'description',
      description: descriptionInput,
    };
    setSubmission(newSubmission);
    onChange(JSON.stringify(newSubmission));
  };

  const clearSubmission = () => {
    setSubmission(null);
    onChange('');
    setLinkInput('');
    setDescriptionInput('');
  };

  return (
    <div className="space-y-4">
      {/* Task Description */}
      <div className="prose prose-sm max-w-none">
        <p className="text-lg text-gray-900">{question.text}</p>
      </div>

      {/* Requirements Checklist */}
      {requirements.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="mb-2 font-medium text-blue-900">Requirements</h4>
          <ul className="space-y-1">
            {requirements.map((req) => (
              <li key={req} className="flex items-start gap-2 text-sm text-blue-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-500" />
                {req}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Submission Area */}
      {submission === null ? (
        <div className="space-y-4">
          {/* Submission Type Tabs */}
          <div className="flex gap-2">
            <button
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                submissionType === 'file'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
              disabled={disabled}
              onClick={() => setSubmissionType('file')}
            >
              <Upload className="mr-1 inline h-4 w-4" />
              Upload File
            </button>
            {allowLink && (
              <button
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  submissionType === 'link'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
                disabled={disabled}
                onClick={() => setSubmissionType('link')}
              >
                <LinkIcon className="mr-1 inline h-4 w-4" />
                Submit Link
              </button>
            )}
            {allowDescription && (
              <button
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  submissionType === 'description'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
                disabled={disabled}
                onClick={() => setSubmissionType('description')}
              >
                <FileText className="mr-1 inline h-4 w-4" />
                Describe Evidence
              </button>
            )}
          </div>

          {/* File Upload */}
          {submissionType === 'file' && (
            <div
              className={cn(
                'rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300',
                disabled && 'cursor-not-allowed opacity-50'
              )}
              role="button"
              tabIndex={0}
              onDragLeave={() => setDragOver(false)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                accept={acceptedTypes.join(',')}
                className="hidden"
                disabled={disabled}
                type="file"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              <Upload className="mx-auto mb-3 h-10 w-10 text-gray-400" />
              <p className="mb-1 text-gray-600">
                Drag and drop your file here, or{' '}
                <button
                  className="font-medium text-indigo-600 hover:underline"
                  disabled={disabled}
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse
                </button>
              </p>
              <p className="text-xs text-gray-400">
                Accepted: {acceptedTypes.join(', ')} • Max size: {maxSize}MB
              </p>
            </div>
          )}

          {/* Link Input */}
          {submissionType === 'link' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                  disabled={disabled}
                  placeholder="https://github.com/username/project"
                  type="url"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                />
                <button
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                  disabled={disabled || !linkInput.trim()}
                  onClick={handleLinkSubmit}
                >
                  Submit
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Submit a link to your project (GitHub, CodeSandbox, Figma, etc.)
              </p>
            </div>
          )}

          {/* Description Input */}
          {submissionType === 'description' && (
            <div className="space-y-2">
              <textarea
                className="h-32 w-full resize-none rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                disabled={disabled}
                placeholder="Describe how you completed this task and provide evidence of your work..."
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                  disabled={disabled || !descriptionInput.trim()}
                  onClick={handleDescriptionSubmit}
                >
                  Submit Evidence
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Submission Preview */
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900">
                  {submission.type === 'file' && 'File Uploaded'}
                  {submission.type === 'link' && 'Link Submitted'}
                  {submission.type === 'description' && 'Evidence Described'}
                </p>
                <p className="mt-1 text-sm text-green-700">
                  {submission.type === 'file' && submission.file?.name}
                  {submission.type === 'link' && (
                    <a
                      className="flex items-center gap-1 hover:underline"
                      href={submission.link}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {submission.link}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {submission.type === 'description' && (
                    <span className="line-clamp-2">{submission.description}</span>
                  )}
                </p>
              </div>
            </div>
            {!disabled && (
              <button className="rounded p-1 hover:bg-green-100" onClick={clearSubmission}>
                <X className="h-4 w-4 text-green-600" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PracticalTask;
