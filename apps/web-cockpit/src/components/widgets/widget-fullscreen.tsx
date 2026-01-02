'use client';

/**
 * Widget Fullscreen Mode - Expanded widget view
 */

import { Button } from '@skillancer/ui/components/button';
import { cn } from '@skillancer/ui/lib/utils';
import { X, Maximize2, Download, Settings } from 'lucide-react';
import { useEffect, useCallback, type ReactNode, useState } from 'react';

interface WidgetFullscreenProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onExport?: () => void;
  onSettings?: () => void;
  className?: string;
}

export function WidgetFullscreen({
  open,
  onClose,
  title,
  children,
  onExport,
  onSettings,
  className,
}: WidgetFullscreenProps) {
  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="bg-background fixed inset-0 z-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Maximize2 className="text-muted-foreground h-5 w-5" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {onExport && (
            <Button size="sm" variant="outline" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
          {onSettings && (
            <Button size="sm" variant="outline" onClick={onSettings}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className={cn('h-[calc(100vh-73px)] overflow-auto p-6', className)}>{children}</div>
    </div>
  );
}

// Hook for managing fullscreen state
export function useWidgetFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enterFullscreen = useCallback(() => setIsFullscreen(true), []);
  const exitFullscreen = useCallback(() => setIsFullscreen(false), []);
  const toggleFullscreen = useCallback(() => setIsFullscreen((prev) => !prev), []);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
}

export default WidgetFullscreen;
