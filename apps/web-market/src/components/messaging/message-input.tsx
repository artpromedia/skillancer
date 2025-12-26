/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises, jsx-a11y/alt-text, @next/next/no-img-element */
'use client';

import { Button, cn, Textarea } from '@skillancer/ui';
import { AtSign, File, Image, Loader2, Mic, Paperclip, Send, Smile, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';

import type { Message } from '@/lib/api/messages';

// ============================================================================
// Types
// ============================================================================

interface MessageInputProps {
  onSend: (content: string, attachments?: File[]) => Promise<void>;
  onTypingChange?: (isTyping: boolean) => void;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

interface AttachmentPreviewProps {
  files: File[];
  onRemove: (index: number) => void;
}

// ============================================================================
// Emoji Picker
// ============================================================================

const QUICK_EMOJIS = ['👍', '❤️', '😊', '🎉', '🔥', '👏', '💪', '🙏'];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  return (
    <div
      className="absolute bottom-full left-0 mb-2 rounded-lg border bg-white p-2 shadow-lg dark:bg-gray-900"
      onMouseLeave={onClose}
    >
      <div className="flex gap-1">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            className="hover:bg-muted rounded p-1 text-xl transition-colors"
            type="button"
            onClick={() => onSelect(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Attachment Preview
// ============================================================================

function AttachmentPreview({ files, onRemove }: AttachmentPreviewProps) {
  if (files.length === 0) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  return (
    <div className="flex flex-wrap gap-2 border-b px-3 py-2">
      {files.map((file, index) => {
        const isImage = file.type.startsWith('image/');
        const preview = isImage ? URL.createObjectURL(file) : null;

        return (
          <div
            key={`${file.name}-${index}`}
            className="group relative flex items-center gap-2 rounded-lg border bg-white p-2 dark:bg-gray-800"
          >
            {preview ? (
              <img alt={file.name} className="h-10 w-10 rounded object-cover" src={preview} />
            ) : (
              <div className="bg-muted flex h-10 w-10 items-center justify-center rounded">
                {getFileIcon(file)}
              </div>
            )}
            <div className="max-w-[120px]">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-muted-foreground text-xs">{formatFileSize(file.size)}</p>
            </div>
            <button
              className="bg-destructive text-destructive-foreground absolute -right-2 -top-2 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
              type="button"
              onClick={() => onRemove(index)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Reply Preview
// ============================================================================

interface ReplyPreviewProps {
  message: Message;
  onCancel: () => void;
}

function ReplyPreview({ message, onCancel }: ReplyPreviewProps) {
  return (
    <div className="flex items-center gap-2 border-b bg-blue-50 px-3 py-2 dark:bg-blue-950/20">
      <div className="bg-primary h-full w-1 rounded-full" />
      <div className="min-w-0 flex-1">
        <p className="text-primary text-sm font-medium">Replying to {message.senderName}</p>
        <p className="text-muted-foreground truncate text-sm">{message.content}</p>
      </div>
      <Button size="icon" variant="ghost" onClick={onCancel}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MessageInput({
  onSend,
  onTypingChange,
  replyingTo,
  onCancelReply,
  placeholder = 'Type a message...',
  disabled = false,
  maxLength = 5000,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [content]);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!onTypingChange) return;

    onTypingChange(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      onTypingChange(false);
    }, 2000);
  }, [onTypingChange]);

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setContent(value);
      handleTyping();
    }
  };

  const handleSend = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent && attachments.length === 0) return;

    setSending(true);
    try {
      await onSend(trimmedContent, attachments.length > 0 ? attachments : undefined);
      setContent('');
      setAttachments([]);
      textareaRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = ''; // Reset input
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEmojiSelect = (emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  const canSend = (content.trim() || attachments.length > 0) && !sending && !disabled;

  return (
    <div className="border-t">
      {/* Reply Preview */}
      {replyingTo && onCancelReply && (
        <ReplyPreview message={replyingTo} onCancel={onCancelReply} />
      )}

      {/* Attachment Preview */}
      <AttachmentPreview files={attachments} onRemove={handleRemoveAttachment} />

      {/* Input Area */}
      <div className="flex items-end gap-2 p-3">
        {/* File Input (hidden) */}
        <input
          ref={fileInputRef}
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
          className="hidden"
          type="file"
          onChange={handleFileSelect}
        />

        {/* Attachment Button */}
        <Button
          disabled={disabled}
          size="icon"
          title="Attach file"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        {/* Input Container */}
        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            className="max-h-[200px] min-h-[40px] resize-none pr-20"
            disabled={disabled || sending}
            placeholder={placeholder}
            rows={1}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />

          {/* Character count */}
          {content.length > maxLength * 0.8 && (
            <span
              className={cn(
                'absolute bottom-2 right-12 text-xs',
                content.length > maxLength * 0.95 ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {content.length}/{maxLength}
            </span>
          )}

          {/* Emoji Button */}
          <div className="absolute bottom-1 right-1">
            <Button
              className="h-8 w-8"
              disabled={disabled}
              size="icon"
              variant="ghost"
              onClick={() => setShowEmoji(!showEmoji)}
            >
              <Smile className="h-4 w-4" />
            </Button>
            {showEmoji && (
              <EmojiPicker onClose={() => setShowEmoji(false)} onSelect={handleEmojiSelect} />
            )}
          </div>
        </div>

        {/* Voice Message Button */}
        <Button
          className={cn(content.trim() && 'hidden')}
          disabled={disabled}
          size="icon"
          title="Voice message"
          variant="ghost"
        >
          <Mic className="h-5 w-5" />
        </Button>

        {/* Send Button */}
        <Button
          className={cn(!content.trim() && attachments.length === 0 && 'hidden')}
          disabled={!canSend}
          size="icon"
          onClick={handleSend}
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}
