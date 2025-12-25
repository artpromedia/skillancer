'use client';

import { Button, cn, Input } from '@skillancer/ui';
import { Search, Mic, X, Clock, TrendingUp } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback, useEffect, useRef } from 'react';

import { useDebounce } from '@/hooks/use-debounce';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  onSearch?: (query: string) => void;
}

// Popular searches for autocomplete
const popularSearches = [
  'React Developer',
  'Web Design',
  'Mobile App Development',
  'WordPress',
  'Logo Design',
  'Data Entry',
  'Content Writing',
  'Video Editing',
];

export function SearchBar({
  className,
  placeholder = 'Search for jobs...',
  onSearch,
}: Readonly<SearchBarProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const debouncedQuery = useDebounce(query, 300);

  // Load recent searches from localStorage
  useEffect(() => {
    if (globalThis.window !== undefined) {
      const saved = localStorage.getItem('skillancer-recent-searches');
      if (saved) {
        try {
          setRecentSearches((JSON.parse(saved) as string[]).slice(0, 5));
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
  }, []);

  // Generate suggestions based on query
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      // Filter popular searches that match the query
      const filtered = popularSearches.filter((s) =>
        s.toLowerCase().includes(debouncedQuery.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut to focus search
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        // Check if not focused on an input/textarea
        if (
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          event.preventDefault();
          inputRef.current?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const saveRecentSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) return;

      const updated = [
        searchQuery,
        ...recentSearches.filter((s) => s.toLowerCase() !== searchQuery.toLowerCase()),
      ].slice(0, 5);

      setRecentSearches(updated);
      if (globalThis.window !== undefined) {
        localStorage.setItem('skillancer-recent-searches', JSON.stringify(updated));
      }
    },
    [recentSearches]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        saveRecentSearch(query.trim());
        setIsOpen(false);
        onSearch?.(query.trim());
        router.push(`/jobs?q=${encodeURIComponent(query.trim())}`);
      }
    },
    [query, router, saveRecentSearch, onSearch]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setQuery(suggestion);
      saveRecentSearch(suggestion);
      setIsOpen(false);
      onSearch?.(suggestion);
      router.push(`/jobs?q=${encodeURIComponent(suggestion)}`);
    },
    [router, saveRecentSearch, onSearch]
  );

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    if (globalThis.window !== undefined) {
      localStorage.removeItem('skillancer-recent-searches');
    }
  }, []);

  // Voice search is disabled due to limited browser support
  // Enable this when Web Speech API has broader TypeScript support
  const handleVoiceSearch = useCallback(() => {
    // Voice search placeholder - would use Web Speech API
    // For now, just focus the input
    inputRef.current?.focus();
  }, []);

  const showDropdown =
    isOpen && (recentSearches.length > 0 || suggestions.length > 0 || query.length === 0);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <form className="relative" onSubmit={handleSubmit}>
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          ref={inputRef}
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-label="Search jobs"
          autoComplete="off"
          className="pl-10 pr-20"
          placeholder={placeholder}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {query && (
            <Button
              aria-label="Clear search"
              className="h-7 w-7"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => setQuery('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          {'webkitSpeechRecognition' in globalThis && (
            <Button
              aria-label="Voice search"
              className="h-7 w-7"
              size="icon"
              type="button"
              variant="ghost"
              onClick={handleVoiceSearch}
            >
              <Mic className="h-3 w-3" />
            </Button>
          )}
          <kbd className="bg-muted text-muted-foreground hidden h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
            /
          </kbd>
        </div>
      </form>

      {/* Search Dropdown */}
      {showDropdown && (
        <div className="bg-popover absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border shadow-lg">
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-2">
              <div className="text-muted-foreground px-2 py-1 text-xs font-medium">Suggestions</div>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors"
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <Search className="text-muted-foreground h-4 w-4" />
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          )}

          {/* Recent Searches */}
          {recentSearches.length > 0 && suggestions.length === 0 && (
            <div className="p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-muted-foreground text-xs font-medium">Recent Searches</span>
                <Button
                  className="text-muted-foreground hover:text-foreground h-auto p-0 text-xs"
                  size="sm"
                  variant="ghost"
                  onClick={clearRecentSearches}
                >
                  Clear all
                </Button>
              </div>
              {recentSearches.map((search) => (
                <button
                  key={search}
                  className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors"
                  type="button"
                  onClick={() => handleSuggestionClick(search)}
                >
                  <Clock className="text-muted-foreground h-4 w-4" />
                  <span>{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* Popular Searches (when empty) */}
          {query.length === 0 && suggestions.length === 0 && recentSearches.length === 0 && (
            <div className="p-2">
              <div className="text-muted-foreground px-2 py-1 text-xs font-medium">
                <TrendingUp className="mr-1 inline-block h-3 w-3" />
                Popular Searches
              </div>
              {popularSearches.slice(0, 5).map((search) => (
                <button
                  key={search}
                  className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors"
                  type="button"
                  onClick={() => handleSuggestionClick(search)}
                >
                  <TrendingUp className="text-muted-foreground h-4 w-4" />
                  <span>{search}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
