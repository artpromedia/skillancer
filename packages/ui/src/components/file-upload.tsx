/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-floating-promises, jsx-a11y/click-events-have-key-events */
'use client';

import * as React from 'react';

import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  progress?: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

export interface FileUploadProps {
  value?: UploadedFile[];
  onChange?: (files: UploadedFile[]) => void;
  onUpload?: (file: File) => Promise<{ id: string; url: string }>;
  accept?: string;
  maxSize?: number; // in bytes
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'compact' | 'avatar';
  className?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(type: string): string {
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type.includes('pdf')) return '📄';
  if (type.includes('word') || type.includes('document')) return '📝';
  if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
  if (type.includes('powerpoint') || type.includes('presentation')) return '📽️';
  if (type.includes('zip') || type.includes('compressed')) return '📦';
  return '📎';
}

// ============================================================================
// FileUpload Component
// ============================================================================

export function FileUpload({
  value = [],
  onChange,
  onUpload,
  accept,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 10,
  multiple = true,
  disabled = false,
  variant = 'default',
  className,
}: FileUploadProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const [localFiles, setLocalFiles] = React.useState<UploadedFile[]>(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setLocalFiles(value);
  }, [value]);

  const updateFiles = (files: UploadedFile[]) => {
    setLocalFiles(files);
    onChange?.(files);
  };

  const handleFiles = async (fileList: FileList) => {
    const newFiles = Array.from(fileList);
    const remainingSlots = maxFiles - localFiles.length;

    if (remainingSlots <= 0) {
      return;
    }

    const filesToProcess = newFiles.slice(0, remainingSlots);
    const pendingFiles: UploadedFile[] = filesToProcess.map((file) => ({
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: 'pending' as const,
      error: file.size > maxSize ? `File exceeds ${formatFileSize(maxSize)} limit` : undefined,
    }));

    // Mark files that are too large as errors
    const filesWithErrors = pendingFiles.map((f) => ({
      ...f,
      status: f.error ? ('error' as const) : ('pending' as const),
    }));

    updateFiles([...localFiles, ...filesWithErrors]);

    // Upload each file that doesn't have errors
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const pendingFile = filesWithErrors[i];

      if (pendingFile.error || !onUpload) {
        continue;
      }

      try {
        // Update status to uploading
        updateFiles((prev) =>
          prev.map((f) =>
            f.id === pendingFile.id ? { ...f, status: 'uploading' as const, progress: 0 } : f
          )
        );

        const result = await onUpload(file);

        // Update with completed status
        updateFiles((prev) =>
          prev.map((f) =>
            f.id === pendingFile.id
              ? { ...f, id: result.id, url: result.url, status: 'complete' as const, progress: 100 }
              : f
          )
        );
      } catch (error) {
        // Update with error status
        updateFiles((prev) =>
          prev.map((f) =>
            f.id === pendingFile.id
              ? {
                  ...f,
                  status: 'error' as const,
                  error: error instanceof Error ? error.message : 'Upload failed',
                }
              : f
          )
        );
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (id: string) => {
    updateFiles(localFiles.filter((f) => f.id !== id));
  };

  const openFileDialog = () => {
    inputRef.current?.click();
  };

  const canAddMore = localFiles.length < maxFiles;

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={className}>
        <input
          ref={inputRef}
          accept={accept}
          className="hidden"
          disabled={disabled}
          multiple={multiple}
          type="file"
          onChange={handleChange}
        />
        <button
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
            'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors'
          )}
          disabled={disabled || !canAddMore}
          type="button"
          onClick={openFileDialog}
        >
          <span>📎</span>
          Attach Files
          {localFiles.length > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
              {localFiles.length}
            </span>
          )}
        </button>
        {localFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {localFiles.map((file) => (
              <span
                key={file.id}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs',
                  file.status === 'error'
                    ? 'bg-red-100 text-red-700'
                    : file.status === 'uploading'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {getFileIcon(file.type)}
                <span className="max-w-[100px] truncate">{file.name}</span>
                <button
                  className="hover:text-red-500"
                  type="button"
                  onClick={() => removeFile(file.id)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Avatar variant (single image upload)
  if (variant === 'avatar') {
    const currentFile = localFiles[0];
    return (
      <div className={cn('relative', className)}>
        <input
          ref={inputRef}
          accept={accept || 'image/*'}
          className="hidden"
          disabled={disabled}
          type="file"
          onChange={handleChange}
        />
        <button
          className={cn(
            'relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed',
            'hover:border-primary transition-colors',
            disabled && 'cursor-not-allowed opacity-50',
            currentFile?.url && 'border-muted border-solid'
          )}
          disabled={disabled}
          type="button"
          onClick={openFileDialog}
        >
          {currentFile?.url ? (
            <img
              alt="Avatar"
              className="h-full w-full rounded-full object-cover"
              src={currentFile.url}
            />
          ) : (
            <span className="text-2xl">📷</span>
          )}
          <span className="bg-primary text-primary-foreground absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full text-xs">
            ✏️
          </span>
        </button>
      </div>
    );
  }

  // Default variant
  return (
    <div className={className}>
      <input
        ref={inputRef}
        accept={accept}
        className="hidden"
        disabled={disabled}
        multiple={multiple}
        type="file"
        onChange={handleChange}
      />

      {/* Drop zone */}
      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          dragActive && 'border-primary bg-primary/5',
          !dragActive && 'border-muted-foreground/25 hover:border-muted-foreground/50',
          disabled && 'cursor-not-allowed opacity-50',
          canAddMore && !disabled && 'cursor-pointer'
        )}
        onClick={canAddMore && !disabled ? openFileDialog : undefined}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl">📁</span>
          <div>
            <p className="font-medium">
              {dragActive ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-muted-foreground text-sm">
              or <span className="text-primary underline">browse</span> to upload
            </p>
          </div>
          <p className="text-muted-foreground text-xs">
            Max {formatFileSize(maxSize)} per file • {maxFiles - localFiles.length} slots remaining
          </p>
        </div>
      </div>

      {/* File list */}
      {localFiles.length > 0 && (
        <ul className="mt-4 space-y-2">
          {localFiles.map((file) => (
            <li
              key={file.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3',
                file.status === 'error' && 'border-red-200 bg-red-50'
              )}
            >
              <span className="text-2xl">{getFileIcon(file.type)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-muted-foreground text-xs">
                  {formatFileSize(file.size)}
                  {file.status === 'uploading' && file.progress !== undefined && (
                    <span className="ml-2">• {file.progress}%</span>
                  )}
                  {file.status === 'error' && file.error && (
                    <span className="ml-2 text-red-500">• {file.error}</span>
                  )}
                </p>
                {file.status === 'uploading' && (
                  <div className="bg-muted mt-1 h-1 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full transition-all"
                      style={{ width: `${file.progress || 0}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {file.status === 'complete' && <span className="text-green-500">✓</span>}
                {file.status === 'uploading' && (
                  <span className="animate-spin text-blue-500">⟳</span>
                )}
                {file.status === 'error' && <span className="text-red-500">⚠</span>}
                <button
                  className="text-muted-foreground transition-colors hover:text-red-500"
                  type="button"
                  onClick={() => removeFile(file.id)}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
