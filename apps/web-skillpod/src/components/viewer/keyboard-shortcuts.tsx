/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Keyboard Shortcuts Component
 *
 * Modal showing keyboard shortcuts:
 * - Common shortcuts for VDI
 * - Custom shortcuts configuration
 * - Print-friendly view
 */

import { Button, cn, Dialog, DialogContent, DialogHeader, DialogTitle } from '@skillancer/ui';
import { Keyboard, Printer } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: 'navigation' | 'system' | 'media' | 'session';
}

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
  customShortcuts?: KeyboardShortcut[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  { keys: ['F11'], description: 'Toggle fullscreen', category: 'navigation' },
  { keys: ['Ctrl', 'Alt', 'End'], description: 'Show/hide toolbar', category: 'navigation' },
  { keys: ['Ctrl', 'Alt', 'Shift'], description: 'Release keyboard grab', category: 'navigation' },
  { keys: ['Esc'], description: 'Exit fullscreen', category: 'navigation' },

  // System
  { keys: ['Ctrl', 'Alt', 'Del'], description: 'Send Ctrl+Alt+Del to remote', category: 'system' },
  { keys: ['Ctrl', 'Alt', 'Backspace'], description: 'Force disconnect', category: 'system' },
  { keys: ['Alt', 'Tab'], description: 'Switch windows in remote', category: 'system' },
  { keys: ['Win', 'L'], description: 'Lock remote session', category: 'system' },

  // Media
  { keys: ['Ctrl', 'M'], description: 'Toggle microphone', category: 'media' },
  { keys: ['Ctrl', 'Shift', 'M'], description: 'Toggle audio', category: 'media' },

  // Session
  { keys: ['Ctrl', 'Shift', 'F'], description: 'Open file transfer', category: 'session' },
  { keys: ['Ctrl', 'Shift', 'I'], description: 'Show session info', category: 'session' },
  { keys: ['Ctrl', 'Shift', 'Q'], description: 'Quality settings', category: 'session' },
  { keys: ['?'], description: 'Show this help', category: 'session' },
];

const CATEGORY_LABELS: Record<KeyboardShortcut['category'], string> = {
  navigation: 'Navigation',
  system: 'System Commands',
  media: 'Audio & Video',
  session: 'Session Controls',
};

// ============================================================================
// KEY DISPLAY
// ============================================================================

interface KeyProps {
  children: React.ReactNode;
}

function Key({ children }: KeyProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center',
        'h-7 min-w-[28px] px-2',
        'text-xs font-medium',
        'bg-muted rounded border',
        'shadow-sm'
      )}
    >
      {children}
    </kbd>
  );
}

// ============================================================================
// SHORTCUT ROW
// ============================================================================

interface ShortcutRowProps {
  shortcut: KeyboardShortcut;
}

function ShortcutRow({ shortcut }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-muted-foreground text-sm">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, index) => (
          <span key={index} className="flex items-center gap-1">
            <Key>{key}</Key>
            {index < shortcut.keys.length - 1 && (
              <span className="text-muted-foreground text-xs">+</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function KeyboardShortcuts({
  isOpen,
  onClose,
  customShortcuts = [],
}: KeyboardShortcutsProps) {
  const allShortcuts = [...DEFAULT_SHORTCUTS, ...customShortcuts];

  const groupedShortcuts = allShortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<KeyboardShortcut['category'], KeyboardShortcut[]>
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="mb-2 text-sm font-semibold">
                {CATEGORY_LABELS[category as KeyboardShortcut['category']]}
              </h3>
              <div className="divide-y">
                {shortcuts.map((shortcut, index) => (
                  <ShortcutRow key={index} shortcut={shortcut} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tips */}
        <div className="bg-muted/50 mt-6 rounded-lg p-3">
          <h4 className="mb-2 text-sm font-medium">Tips</h4>
          <ul className="text-muted-foreground space-y-1 text-xs">
            <li>• Some shortcuts may conflict with local OS shortcuts</li>
            <li>• Use Ctrl+Alt+Shift to release keyboard focus back to local</li>
            <li>• F11 works differently when in browser fullscreen mode</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// COMPACT HELP BUTTON
// ============================================================================

interface KeyboardShortcutsButtonProps {
  onClick: () => void;
  className?: string;
}

export function KeyboardShortcutsButton({ onClick, className }: KeyboardShortcutsButtonProps) {
  return (
    <button
      aria-label="Keyboard shortcuts"
      className={cn(
        'hover:bg-accent rounded-lg p-2 transition-colors',
        'text-muted-foreground hover:text-foreground',
        className
      )}
      onClick={onClick}
    >
      <Keyboard className="h-5 w-5" />
    </button>
  );
}
