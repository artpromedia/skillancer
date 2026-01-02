'use client';

/**
 * AI Assistant Panel for SkillPod
 * Sprint M7: AI Work Assistant
 *
 * Provides in-context AI assistance during SkillPod sessions
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Input, ScrollArea, cn } from '@skillancer/ui';
import {
  Sparkles,
  X,
  Send,
  Code,
  FileText,
  Lightbulb,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  Loader2,
  ChevronDown,
  Bot,
  User,
} from 'lucide-react';
import { useSkillPodAssistant } from '@/lib/ai/assistant-client';

// =============================================================================
// TYPES
// =============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  codeBlocks?: Array<{
    language: string;
    code: string;
  }>;
  feedback?: 'helpful' | 'not_helpful';
}

interface AIAssistantPanelProps {
  sessionId: string;
  onClose: () => void;
  className?: string;
}

// =============================================================================
// QUICK ACTIONS
// =============================================================================

const QUICK_ACTIONS = [
  { id: 'explain', label: 'Explain this', icon: Lightbulb },
  { id: 'review', label: 'Review code', icon: Code },
  { id: 'document', label: 'Add docs', icon: FileText },
  { id: 'suggest', label: 'Suggest fixes', icon: Sparkles },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function AIAssistantPanel({ sessionId, onClose, className }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! I'm your AI Work Assistant. I can help you with code explanations, reviews, documentation, and more. How can I help you today?",
      timestamp: new Date(),
      suggestions: [
        'Explain the selected code',
        'Review for best practices',
        'Help me debug an issue',
      ],
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { sendMessage, isConnected } = useSkillPodAssistant(sessionId);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle send message
  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = text || inputValue.trim();
      if (!messageText || isLoading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: messageText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setIsLoading(true);

      try {
        const response = await sendMessage(messageText);

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
          suggestions: response.suggestions,
          codeBlocks: response.codeBlocks,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [inputValue, isLoading, sendMessage]
  );

  // Handle quick action
  const handleQuickAction = useCallback(
    (actionId: string) => {
      const prompts: Record<string, string> = {
        explain: 'Please explain the selected code in detail',
        review: 'Review the current code for best practices and potential issues',
        document: 'Help me add documentation comments to this code',
        suggest: 'Suggest improvements and fixes for this code',
      };
      void handleSend(prompts[actionId] || actionId);
    },
    [handleSend]
  );

  // Handle feedback
  const handleFeedback = useCallback((messageId: string, feedback: 'helpful' | 'not_helpful') => {
    setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, feedback } : msg)));
    // TODO: Send feedback to backend
  }, []);

  // Handle copy code
  const handleCopyCode = useCallback(async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      void handleSend(suggestion);
    },
    [handleSend]
  );

  // Handle key press
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className={cn('flex h-full flex-col bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
            <Sparkles className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Assistant</h3>
            <p className="text-xs text-gray-500">{isConnected ? 'Connected' : 'Connecting...'}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="border-b px-3 py-2">
        <div className="flex gap-1 overflow-x-auto">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action.id)}
              disabled={isLoading}
              className="flex-shrink-0 text-xs"
            >
              <action.icon className="mr-1 h-3 w-3" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}
            >
              {/* Avatar */}
              <div
                className={cn(
                  'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
                  message.role === 'assistant' ? 'bg-purple-100' : 'bg-gray-100'
                )}
              >
                {message.role === 'assistant' ? (
                  <Bot className="h-4 w-4 text-purple-600" />
                ) : (
                  <User className="h-4 w-4 text-gray-600" />
                )}
              </div>

              {/* Content */}
              <div className={cn('max-w-[85%] space-y-2', message.role === 'user' && 'text-right')}>
                <div
                  className={cn(
                    'inline-block rounded-lg px-3 py-2 text-sm',
                    message.role === 'assistant'
                      ? 'bg-gray-100 text-gray-900'
                      : 'bg-purple-600 text-white'
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>

                {/* Code Blocks */}
                {message.codeBlocks?.map((block, idx) => (
                  <div
                    key={`${message.id}-code-${idx}`}
                    className="relative rounded-lg bg-gray-900 text-white"
                  >
                    <div className="flex items-center justify-between border-b border-gray-700 px-3 py-1.5">
                      <span className="text-xs text-gray-400">{block.language}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyCode(block.code, `${message.id}-${idx}`)}
                        className="h-6 px-2 text-gray-400 hover:text-white"
                      >
                        {copiedId === `${message.id}-${idx}` ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <pre className="overflow-x-auto p-3 text-xs">
                      <code>{block.code}</code>
                    </pre>
                  </div>
                ))}

                {/* Suggestions */}
                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {message.suggestions.map((suggestion, idx) => (
                      <button
                        key={`${message.id}-sug-${idx}`}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs text-purple-700 transition-colors hover:bg-purple-100"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                {/* Feedback */}
                {message.role === 'assistant' && message.id !== 'welcome' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleFeedback(message.id, 'helpful')}
                      className={cn(
                        'rounded p-1 transition-colors',
                        message.feedback === 'helpful'
                          ? 'bg-green-100 text-green-600'
                          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                      )}
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleFeedback(message.id, 'not_helpful')}
                      className={cn(
                        'rounded p-1 transition-colors',
                        message.feedback === 'not_helpful'
                          ? 'bg-red-100 text-red-600'
                          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                      )}
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-purple-100">
                <Bot className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                <span className="text-sm text-gray-500">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={() => void handleSend()}
            disabled={isLoading || !inputValue.trim()}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1 text-center text-xs text-gray-400">
          Press Ctrl+Shift+A to toggle • AI may make mistakes
        </p>
      </div>
    </div>
  );
}
