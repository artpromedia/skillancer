/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-non-null-assertion */
'use client';

/**
 * Virtual Keyboard Component
 *
 * On-screen keyboard for mobile/tablet VDI sessions:
 * - Full keyboard layout (QWERTY)
 * - Modifier keys (Shift, Ctrl, Alt, Meta)
 * - Special keys (Esc, Tab, Enter, Arrow keys)
 * - Function keys
 * - Customizable layouts
 */

import { Button } from '@skillancer/ui/components/button';
import { cn } from '@skillancer/ui/lib/utils';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  CornerDownLeft,
  Delete,
  Keyboard,
  Space,
} from 'lucide-react';
import { useCallback, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type KeyboardLayout = 'qwerty' | 'numeric' | 'function' | 'navigation';

interface KeyDef {
  key: string;
  code: string;
  label?: string | React.ReactNode;
  width?: number;
  isModifier?: boolean;
  isSpacer?: boolean;
}

export interface VirtualKeyboardProps {
  onKeyDown?: (key: string, code: string, modifiers: KeyModifiers) => void;
  onKeyUp?: (key: string, code: string, modifiers: KeyModifiers) => void;
  layout?: KeyboardLayout;
  onLayoutChange?: (layout: KeyboardLayout) => void;
  isVisible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  className?: string;
}

interface KeyModifiers {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

// ============================================================================
// LAYOUTS
// ============================================================================

const QWERTY_ROWS: KeyDef[][] = [
  // Row 1 - Numbers
  [
    { key: 'Escape', code: 'Escape', label: 'Esc', width: 1 },
    { key: '`', code: 'Backquote', width: 1 },
    { key: '1', code: 'Digit1', width: 1 },
    { key: '2', code: 'Digit2', width: 1 },
    { key: '3', code: 'Digit3', width: 1 },
    { key: '4', code: 'Digit4', width: 1 },
    { key: '5', code: 'Digit5', width: 1 },
    { key: '6', code: 'Digit6', width: 1 },
    { key: '7', code: 'Digit7', width: 1 },
    { key: '8', code: 'Digit8', width: 1 },
    { key: '9', code: 'Digit9', width: 1 },
    { key: '0', code: 'Digit0', width: 1 },
    { key: '-', code: 'Minus', width: 1 },
    { key: '=', code: 'Equal', width: 1 },
    { key: 'Backspace', code: 'Backspace', label: <Delete className="h-4 w-4" />, width: 1.5 },
  ],
  // Row 2 - QWERTY
  [
    { key: 'Tab', code: 'Tab', label: 'Tab', width: 1.5 },
    { key: 'q', code: 'KeyQ', width: 1 },
    { key: 'w', code: 'KeyW', width: 1 },
    { key: 'e', code: 'KeyE', width: 1 },
    { key: 'r', code: 'KeyR', width: 1 },
    { key: 't', code: 'KeyT', width: 1 },
    { key: 'y', code: 'KeyY', width: 1 },
    { key: 'u', code: 'KeyU', width: 1 },
    { key: 'i', code: 'KeyI', width: 1 },
    { key: 'o', code: 'KeyO', width: 1 },
    { key: 'p', code: 'KeyP', width: 1 },
    { key: '[', code: 'BracketLeft', width: 1 },
    { key: ']', code: 'BracketRight', width: 1 },
    { key: '\\', code: 'Backslash', width: 1.5 },
  ],
  // Row 3 - ASDF
  [
    { key: 'CapsLock', code: 'CapsLock', label: 'Caps', width: 1.75, isModifier: true },
    { key: 'a', code: 'KeyA', width: 1 },
    { key: 's', code: 'KeyS', width: 1 },
    { key: 'd', code: 'KeyD', width: 1 },
    { key: 'f', code: 'KeyF', width: 1 },
    { key: 'g', code: 'KeyG', width: 1 },
    { key: 'h', code: 'KeyH', width: 1 },
    { key: 'j', code: 'KeyJ', width: 1 },
    { key: 'k', code: 'KeyK', width: 1 },
    { key: 'l', code: 'KeyL', width: 1 },
    { key: ';', code: 'Semicolon', width: 1 },
    { key: "'", code: 'Quote', width: 1 },
    { key: 'Enter', code: 'Enter', label: <CornerDownLeft className="h-4 w-4" />, width: 2.25 },
  ],
  // Row 4 - ZXCV
  [
    { key: 'Shift', code: 'ShiftLeft', label: '⇧ Shift', width: 2.25, isModifier: true },
    { key: 'z', code: 'KeyZ', width: 1 },
    { key: 'x', code: 'KeyX', width: 1 },
    { key: 'c', code: 'KeyC', width: 1 },
    { key: 'v', code: 'KeyV', width: 1 },
    { key: 'b', code: 'KeyB', width: 1 },
    { key: 'n', code: 'KeyN', width: 1 },
    { key: 'm', code: 'KeyM', width: 1 },
    { key: ',', code: 'Comma', width: 1 },
    { key: '.', code: 'Period', width: 1 },
    { key: '/', code: 'Slash', width: 1 },
    { key: 'Shift', code: 'ShiftRight', label: '⇧ Shift', width: 2.75, isModifier: true },
  ],
  // Row 5 - Space bar
  [
    { key: 'Control', code: 'ControlLeft', label: 'Ctrl', width: 1.5, isModifier: true },
    { key: 'Meta', code: 'MetaLeft', label: '⌘', width: 1.25, isModifier: true },
    { key: 'Alt', code: 'AltLeft', label: 'Alt', width: 1.25, isModifier: true },
    { key: ' ', code: 'Space', label: <Space className="h-4 w-4" />, width: 6 },
    { key: 'Alt', code: 'AltRight', label: 'Alt', width: 1.25, isModifier: true },
    { key: 'Meta', code: 'MetaRight', label: '⌘', width: 1.25, isModifier: true },
    { key: 'Control', code: 'ControlRight', label: 'Ctrl', width: 1.5, isModifier: true },
  ],
];

const NAVIGATION_ROWS: KeyDef[][] = [
  [
    { key: 'Insert', code: 'Insert', label: 'Ins', width: 1 },
    { key: 'Home', code: 'Home', label: 'Home', width: 1 },
    { key: 'PageUp', code: 'PageUp', label: 'PgUp', width: 1 },
  ],
  [
    { key: 'Delete', code: 'Delete', label: 'Del', width: 1 },
    { key: 'End', code: 'End', label: 'End', width: 1 },
    { key: 'PageDown', code: 'PageDown', label: 'PgDn', width: 1 },
  ],
  [
    { key: '', code: '', isSpacer: true, width: 1 },
    { key: 'ArrowUp', code: 'ArrowUp', label: <ArrowUp className="h-4 w-4" />, width: 1 },
    { key: '', code: '', isSpacer: true, width: 1 },
  ],
  [
    { key: 'ArrowLeft', code: 'ArrowLeft', label: <ArrowLeft className="h-4 w-4" />, width: 1 },
    { key: 'ArrowDown', code: 'ArrowDown', label: <ArrowDown className="h-4 w-4" />, width: 1 },
    { key: 'ArrowRight', code: 'ArrowRight', label: <ArrowRight className="h-4 w-4" />, width: 1 },
  ],
];

const FUNCTION_ROWS: KeyDef[][] = [
  [
    { key: 'F1', code: 'F1', width: 1 },
    { key: 'F2', code: 'F2', width: 1 },
    { key: 'F3', code: 'F3', width: 1 },
    { key: 'F4', code: 'F4', width: 1 },
  ],
  [
    { key: 'F5', code: 'F5', width: 1 },
    { key: 'F6', code: 'F6', width: 1 },
    { key: 'F7', code: 'F7', width: 1 },
    { key: 'F8', code: 'F8', width: 1 },
  ],
  [
    { key: 'F9', code: 'F9', width: 1 },
    { key: 'F10', code: 'F10', width: 1 },
    { key: 'F11', code: 'F11', width: 1 },
    { key: 'F12', code: 'F12', width: 1 },
  ],
];

const NUMERIC_ROWS: KeyDef[][] = [
  [
    { key: '7', code: 'Numpad7', width: 1 },
    { key: '8', code: 'Numpad8', width: 1 },
    { key: '9', code: 'Numpad9', width: 1 },
    { key: '/', code: 'NumpadDivide', width: 1 },
  ],
  [
    { key: '4', code: 'Numpad4', width: 1 },
    { key: '5', code: 'Numpad5', width: 1 },
    { key: '6', code: 'Numpad6', width: 1 },
    { key: '*', code: 'NumpadMultiply', width: 1 },
  ],
  [
    { key: '1', code: 'Numpad1', width: 1 },
    { key: '2', code: 'Numpad2', width: 1 },
    { key: '3', code: 'Numpad3', width: 1 },
    { key: '-', code: 'NumpadSubtract', width: 1 },
  ],
  [
    { key: '0', code: 'Numpad0', width: 2 },
    { key: '.', code: 'NumpadDecimal', width: 1 },
    { key: '+', code: 'NumpadAdd', width: 1 },
  ],
  [{ key: 'Enter', code: 'NumpadEnter', label: 'Enter', width: 4 }],
];

// ============================================================================
// COMPONENT
// ============================================================================

export function VirtualKeyboard({
  onKeyDown,
  onKeyUp,
  layout = 'qwerty',
  onLayoutChange,
  isVisible = true,
  onVisibilityChange,
  className,
}: VirtualKeyboardProps) {
  const [currentLayout, setCurrentLayout] = useState<KeyboardLayout>(layout);
  const [modifiers, setModifiers] = useState<KeyModifiers>({
    shift: false,
    ctrl: false,
    alt: false,
    meta: false,
  });
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleKeyPress = useCallback(
    (keyDef: KeyDef) => {
      if (keyDef.isSpacer) return;

      const { key, code, isModifier } = keyDef;

      if (isModifier) {
        // Toggle modifier state
        const newModifiers = { ...modifiers };

        switch (key) {
          case 'Shift':
            newModifiers.shift = !modifiers.shift;
            break;
          case 'Control':
            newModifiers.ctrl = !modifiers.ctrl;
            break;
          case 'Alt':
            newModifiers.alt = !modifiers.alt;
            break;
          case 'Meta':
            newModifiers.meta = !modifiers.meta;
            break;
          case 'CapsLock':
            newModifiers.shift = !modifiers.shift;
            break;
        }

        setModifiers(newModifiers);
        return;
      }

      // Apply shift to key if needed
      let finalKey = key;
      if (modifiers.shift && key.length === 1) {
        finalKey = key.toUpperCase();
      }

      // Fire key events
      onKeyDown?.(finalKey, code, modifiers);

      // Mark key as pressed
      setPressedKeys((prev) => new Set(prev).add(code));

      // Simulate key up after short delay
      setTimeout(() => {
        onKeyUp?.(finalKey, code, modifiers);
        setPressedKeys((prev) => {
          const next = new Set(prev);
          next.delete(code);
          return next;
        });

        // Clear non-sticky modifiers
        if (!key.startsWith('F') && key !== 'CapsLock') {
          setModifiers({
            shift: false,
            ctrl: false,
            alt: false,
            meta: false,
          });
        }
      }, 100);
    },
    [modifiers, onKeyDown, onKeyUp]
  );

  const switchLayout = useCallback(
    (newLayout: KeyboardLayout) => {
      setCurrentLayout(newLayout);
      onLayoutChange?.(newLayout);
    },
    [onLayoutChange]
  );

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const getKeyRows = (): KeyDef[][] => {
    switch (currentLayout) {
      case 'qwerty':
        return QWERTY_ROWS;
      case 'numeric':
        return NUMERIC_ROWS;
      case 'function':
        return FUNCTION_ROWS;
      case 'navigation':
        return NAVIGATION_ROWS;
      default:
        return QWERTY_ROWS;
    }
  };

  const renderKey = (keyDef: KeyDef, index: number) => {
    if (keyDef.isSpacer) {
      return (
        <div
          key={`spacer-${index}`}
          className="flex-shrink-0"
          style={{ width: `${keyDef.width! * 40}px` }}
        />
      );
    }

    const { key, code, label, width = 1, isModifier } = keyDef;
    const isPressed = pressedKeys.has(code);
    const isModifierActive =
      isModifier &&
      ((key === 'Shift' && modifiers.shift) ||
        (key === 'Control' && modifiers.ctrl) ||
        (key === 'Alt' && modifiers.alt) ||
        (key === 'Meta' && modifiers.meta) ||
        (key === 'CapsLock' && modifiers.shift));

    // Apply shift to display
    let displayLabel = label || key;
    if (typeof displayLabel === 'string' && modifiers.shift && displayLabel.length === 1) {
      displayLabel = displayLabel.toUpperCase();
    }

    return (
      <button
        key={code || `key-${index}`}
        className={cn(
          'flex items-center justify-center rounded-md border border-white/20 bg-gray-800 text-white transition-all',
          'hover:bg-gray-700 active:scale-95 active:bg-gray-600',
          isPressed && 'scale-95 bg-gray-600',
          isModifierActive && 'border-blue-400 bg-blue-600',
          'text-xs sm:text-sm',
          'h-10 sm:h-12'
        )}
        style={{ width: `${width * 40}px`, minWidth: `${width * 40}px` }}
        onClick={() => handleKeyPress(keyDef)}
        onTouchStart={(e) => {
          e.preventDefault();
          handleKeyPress(keyDef);
        }}
      >
        {displayLabel}
      </button>
    );
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (!isVisible) {
    return (
      <Button
        className="fixed bottom-4 right-4 z-50 rounded-full bg-gray-800 text-white shadow-lg"
        size="icon"
        variant="ghost"
        onClick={() => onVisibilityChange?.(true)}
      >
        <Keyboard className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 bg-gray-900/95 backdrop-blur-sm',
        'border-t border-white/10 p-2 sm:p-4',
        'animate-in slide-in-from-bottom',
        className
      )}
    >
      {/* Layout switcher and close button */}
      <div className="mb-2 flex items-center justify-between px-2">
        <div className="flex gap-1">
          {(['qwerty', 'numeric', 'function', 'navigation'] as KeyboardLayout[]).map((l) => (
            <button
              key={l}
              className={cn(
                'rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10',
                currentLayout === l && 'bg-white/20 text-white'
              )}
              onClick={() => switchLayout(l)}
            >
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>
        <button
          className="rounded p-1 text-white/70 hover:bg-white/10"
          onClick={() => onVisibilityChange?.(false)}
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Keyboard rows */}
      <div className="flex flex-col items-center gap-1">
        {getKeyRows().map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1">
            {row.map((keyDef, keyIndex) => renderKey(keyDef, keyIndex))}
          </div>
        ))}
      </div>
    </div>
  );
}
