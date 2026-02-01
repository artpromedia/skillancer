'use client';

/**
 * ConversationSearch Component
 *
 * Search within a conversation for messages containing specific text.
 * Supports navigation between search results.
 */

import { Button, cn, Input } from '@skillancer/ui';
import { ArrowDown, ArrowUp, Loader2, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Message } from '@/lib/api/messages';

// ============================================================================
// Types
// ============================================================================

export interface SearchResult {
  message: Message;
  matchIndex: number;
  matchCount: number;
}

export interface ConversationSearchProps {
  /** Messages to search through */
  readonly messages: Message[];
  /** Whether the search panel is open */
  readonly isOpen: boolean;
  /** Callback to close the search */
  readonly onClose: () => void;
  /** Callback when a search result is selected */
  readonly onResultSelect: (message: Message) => void;
  /** Custom class name */
  readonly className?: string;
  /** Placeholder text */
  readonly placeholder?: string;
}

export interface UseConversationSearchReturn {
  /** Current search query */
  query: string;
  /** Set the search query */
  setQuery: (query: string) => void;
  /** Search results */
  results: SearchResult[];
  /** Current result index */
  currentIndex: number;
  /** Total number of results */
  totalResults: number;
  /** Is currently searching */
  isSearching: boolean;
  /** Go to next result */
  nextResult: () => void;
  /** Go to previous result */
  prevResult: () => void;
  /** Current result message */
  currentResult: SearchResult | null;
  /** Clear the search */
  clearSearch: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useConversationSearch(messages: Message[]): UseConversationSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Search messages when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setCurrentIndex(0);
      return;
    }

    setIsSearching(true);

    // Debounce search
    const timeout = setTimeout(() => {
      const lowerQuery = query.toLowerCase();
      const searchResults: SearchResult[] = [];

      messages.forEach((message) => {
        if (message.isDeleted) return;

        const content = message.content.toLowerCase();
        let matchIndex = 0;
        let startIndex = 0;

        // Find all matches in this message
        while ((matchIndex = content.indexOf(lowerQuery, startIndex)) !== -1) {
          searchResults.push({
            message,
            matchIndex,
            matchCount: searchResults.filter((r) => r.message.id === message.id).length + 1,
          });
          startIndex = matchIndex + 1;
        }
      });

      setResults(searchResults);
      setCurrentIndex(searchResults.length > 0 ? 0 : -1);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, messages]);

  const nextResult = useCallback(() => {
    if (results.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % results.length);
  }, [results.length]);

  const prevResult = useCallback(() => {
    if (results.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + results.length) % results.length);
  }, [results.length]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setCurrentIndex(0);
  }, []);

  return {
    query,
    setQuery,
    results,
    currentIndex,
    totalResults: results.length,
    isSearching,
    nextResult,
    prevResult,
    currentResult: currentIndex >= 0 ? results[currentIndex] || null : null,
    clearSearch,
  };
}

// ============================================================================
// Component
// ============================================================================

export function ConversationSearch({
  messages,
  isOpen,
  onClose,
  onResultSelect,
  className,
  placeholder = 'Search messages...',
}: ConversationSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    query,
    setQuery,
    currentIndex,
    totalResults,
    isSearching,
    nextResult,
    prevResult,
    currentResult,
    clearSearch,
  } = useConversationSearch(messages);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Navigate to current result
  useEffect(() => {
    if (currentResult) {
      onResultSelect(currentResult.message);
    }
  }, [currentResult, onResultSelect]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          prevResult();
        } else {
          nextResult();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [nextResult, prevResult, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b bg-white px-4 py-2 dark:bg-gray-900',
        className
      )}
    >
      <Search className="text-muted-foreground h-4 w-4 flex-shrink-0" />

      <div className="relative flex-1">
        <Input
          ref={inputRef}
          className="h-8 pr-8"
          placeholder={placeholder}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <Button
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
            size="icon"
            variant="ghost"
            onClick={clearSearch}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-muted-foreground flex items-center gap-1 text-sm">
        {isSearching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : totalResults > 0 ? (
          <span>
            {currentIndex + 1} of {totalResults}
          </span>
        ) : query ? (
          <span>No results</span>
        ) : null}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-0.5">
        <Button
          className="h-7 w-7"
          disabled={totalResults === 0}
          size="icon"
          title="Previous result (Shift+Enter)"
          variant="ghost"
          onClick={prevResult}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          className="h-7 w-7"
          disabled={totalResults === 0}
          size="icon"
          title="Next result (Enter)"
          variant="ghost"
          onClick={nextResult}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Close button */}
      <Button
        className="h-7 w-7"
        size="icon"
        title="Close search"
        variant="ghost"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================================
// Highlight Component
// ============================================================================

export interface HighlightTextProps {
  /** Text to display */
  readonly text: string;
  /** Search query to highlight */
  readonly query: string;
  /** Custom highlight class */
  readonly highlightClassName?: string;
}

/**
 * Highlight matching text within a string
 */
export function HighlightText({
  text,
  query,
  highlightClassName = 'bg-yellow-200 dark:bg-yellow-800',
}: HighlightTextProps) {
  if (!query.trim()) {
    return <>{text}</>;
  }

  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'));

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={index} className={cn('rounded px-0.5', highlightClassName)}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
