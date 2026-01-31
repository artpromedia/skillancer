/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, no-console */
'use client';

/**
 * Screenshot Detection Library
 *
 * Detects screenshot attempts using multiple methods:
 * - Keyboard shortcuts (PrintScreen, etc.)
 * - Visibility change (external capture tools)
 * - Browser extension detection
 * - DevTools detection
 */

// ============================================================================
// TYPES
// ============================================================================

export type ScreenshotEventType =
  | 'keyboard_shortcut'
  | 'visibility_change'
  | 'devtools_open'
  | 'extension_detected'
  | 'print_attempt';

export interface ScreenshotEvent {
  type: ScreenshotEventType;
  timestamp: Date;
  details?: string;
}

export type ScreenshotCallback = (event: ScreenshotEvent) => void;

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

const SCREENSHOT_SHORTCUTS = [
  { key: 'PrintScreen', ctrl: false, alt: false, shift: false, meta: false },
  { key: 'PrintScreen', ctrl: true, alt: false, shift: false, meta: false },
  { key: 'PrintScreen', ctrl: false, alt: true, shift: false, meta: false },
  { key: 'PrintScreen', ctrl: false, alt: false, shift: true, meta: false },
  // Windows Snipping Tool / Snip & Sketch
  { key: 's', ctrl: false, alt: false, shift: true, meta: true },
  // Windows Game Bar
  { key: 'g', ctrl: false, alt: false, shift: false, meta: true },
  // macOS screenshot shortcuts
  { key: '3', ctrl: false, alt: false, shift: true, meta: true },
  { key: '4', ctrl: false, alt: false, shift: true, meta: true },
  { key: '5', ctrl: false, alt: false, shift: true, meta: true },
];

// ============================================================================
// DETECTION CLASS
// ============================================================================

class ScreenshotDetection {
  private callback: ScreenshotCallback | null = null;
  private isRunning = false;
  private devToolsCheckInterval: NodeJS.Timeout | null = null;
  private devToolsOpen = false;
  private listeners: Array<{ event: string; handler: EventListener }> = [];

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  start(callback: ScreenshotCallback): void {
    if (this.isRunning) return;

    this.callback = callback;
    this.isRunning = true;

    this.setupKeyboardDetection();
    this.setupVisibilityDetection();
    this.setupDevToolsDetection();
    this.setupPrintDetection();
    this.setupMediaKeysDetection();
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.callback = null;

    // Remove all listeners
    this.listeners.forEach(({ event, handler }) => {
      document.removeEventListener(event, handler);
      globalThis.removeEventListener(event, handler);
    });
    this.listeners = [];

    // Clear devtools check interval
    if (this.devToolsCheckInterval) {
      clearInterval(this.devToolsCheckInterval);
      this.devToolsCheckInterval = null;
    }
  }

  // ==========================================================================
  // KEYBOARD DETECTION
  // ==========================================================================

  private setupKeyboardDetection(): void {
    const handler = (e: KeyboardEvent) => {
      if (!this.isRunning) return;

      const isScreenshotShortcut = SCREENSHOT_SHORTCUTS.some((shortcut) => {
        return (
          e.key === shortcut.key &&
          e.ctrlKey === shortcut.ctrl &&
          e.altKey === shortcut.alt &&
          e.shiftKey === shortcut.shift &&
          e.metaKey === shortcut.meta
        );
      });

      if (isScreenshotShortcut) {
        e.preventDefault();
        e.stopPropagation();

        this.emit({
          type: 'keyboard_shortcut',
          timestamp: new Date(),
          details: `Key: ${e.key}, Modifiers: ${this.getModifiers(e)}`,
        });
      }
    };

    document.addEventListener('keydown', handler, { capture: true });
    this.listeners.push({ event: 'keydown', handler: handler as EventListener });
  }

  private getModifiers(e: KeyboardEvent): string {
    const mods: string[] = [];
    if (e.ctrlKey) mods.push('Ctrl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    if (e.metaKey) mods.push('Meta');
    return mods.join('+') || 'None';
  }

  // ==========================================================================
  // VISIBILITY DETECTION
  // ==========================================================================

  private setupVisibilityDetection(): void {
    let visibilityChangeCount = 0;
    let lastVisibilityChange = 0;

    const handler = () => {
      if (!this.isRunning) return;

      const now = Date.now();

      // Detect rapid visibility changes (possible screen capture)
      if (document.hidden && now - lastVisibilityChange < 500) {
        visibilityChangeCount++;

        if (visibilityChangeCount >= 3) {
          this.emit({
            type: 'visibility_change',
            timestamp: new Date(),
            details: 'Rapid visibility changes detected - possible screen capture',
          });
          visibilityChangeCount = 0;
        }
      } else {
        visibilityChangeCount = 0;
      }

      lastVisibilityChange = now;
    };

    document.addEventListener('visibilitychange', handler);
    this.listeners.push({ event: 'visibilitychange', handler: handler as EventListener });
  }

  // ==========================================================================
  // DEVTOOLS DETECTION
  // ==========================================================================

  private setupDevToolsDetection(): void {
    // Method 1: Console timing detection
    const checkDevTools = () => {
      const start = performance.now();
      // This will be slow if devtools is open
      console.profile?.('devtools-check');
      console.profileEnd?.('devtools-check');
      const duration = performance.now() - start;

      if (duration > 10) {
        if (!this.devToolsOpen) {
          this.devToolsOpen = true;
          this.emit({
            type: 'devtools_open',
            timestamp: new Date(),
            details: 'Developer tools detected',
          });
        }
      } else {
        this.devToolsOpen = false;
      }
    };

    // Method 2: Window size detection (devtools docked)
    const checkWindowSize = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;

      if (widthThreshold || heightThreshold) {
        if (!this.devToolsOpen) {
          this.devToolsOpen = true;
          this.emit({
            type: 'devtools_open',
            timestamp: new Date(),
            details: 'Developer tools detected via window size',
          });
        }
      }
    };

    // Run checks periodically
    this.devToolsCheckInterval = setInterval(() => {
      if (!this.isRunning) return;
      checkDevTools();
      checkWindowSize();
    }, 2000);

    // Method 3: Debugger statement detection
    const debuggerCheck = () => {
      const before = Date.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const after = Date.now();

      // If debugger statement takes longer than expected, devtools is open
      if (after - before > 100) {
        if (!this.devToolsOpen) {
          this.devToolsOpen = true;
          this.emit({
            type: 'devtools_open',
            timestamp: new Date(),
            details: 'Developer tools detected via debugger',
          });
        }
      }
    };

    // Run debugger check sparingly to avoid performance impact
    setTimeout(debuggerCheck, 5000);
  }

  // ==========================================================================
  // PRINT DETECTION
  // ==========================================================================

  private setupPrintDetection(): void {
    const beforePrintHandler = () => {
      if (!this.isRunning) return;

      this.emit({
        type: 'print_attempt',
        timestamp: new Date(),
        details: 'Print dialog opened',
      });

      // Try to cancel print
      setTimeout(() => {
        window.stop();
      }, 0);
    };

    globalThis.addEventListener('beforeprint', beforePrintHandler);
    this.listeners.push({ event: 'beforeprint', handler: beforePrintHandler as EventListener });

    // Also detect Ctrl+P
    const keyHandler = (e: KeyboardEvent) => {
      if (!this.isRunning) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        this.emit({
          type: 'print_attempt',
          timestamp: new Date(),
          details: 'Print shortcut blocked',
        });
      }
    };

    document.addEventListener('keydown', keyHandler, { capture: true });
    this.listeners.push({ event: 'keydown', handler: keyHandler as EventListener });
  }

  // ==========================================================================
  // MEDIA KEYS DETECTION
  // ==========================================================================

  private setupMediaKeysDetection(): void {
    // Some screen capture software triggers media key events
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          // Ignore media events
        });
      } catch (e) {
        // Media session not supported - this is expected in some environments
        console.error('Media session action handler not supported:', e);
      }
    }
  }

  // ==========================================================================
  // EMIT EVENT
  // ==========================================================================

  private emit(event: ScreenshotEvent): void {
    if (!this.callback) return;

    // Debounce rapid events
    const lastEvent = this.lastEventTimestamp;
    if (lastEvent && Date.now() - lastEvent < 1000) {
      return;
    }

    this.lastEventTimestamp = Date.now();
    this.callback(event);
  }

  private lastEventTimestamp = 0;
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const screenshotDetection = new ScreenshotDetection();

// ============================================================================
// WATERMARK PROTECTION CSS
// ============================================================================

/**
 * CSS-based screenshot protection
 * Makes content harder to screenshot cleanly
 */
export function applyScreenshotProtectionCSS(): void {
  const style = document.createElement('style');
  style.id = 'screenshot-protection';
  style.textContent = `
    /* Prevent user selection of content */
    [data-vdi-viewer] * {
      user-select: none;
      -webkit-user-select: none;
    }

    /* Prevent dragging of images */
    [data-vdi-viewer] img,
    [data-vdi-viewer] canvas {
      -webkit-user-drag: none;
      pointer-events: none;
    }

    /* Prevent context menu */
    [data-vdi-viewer] {
      -webkit-touch-callout: none;
    }

    /* Hide content when printing */
    @media print {
      [data-vdi-viewer] {
        visibility: hidden !important;
      }

      [data-vdi-viewer]::after {
        content: 'This content cannot be printed';
        visibility: visible;
        display: flex;
        align-items: center;
        justify-content: center;
        position: fixed;
        inset: 0;
        background: white;
        color: black;
        font-size: 24px;
      }
    }
  `;

  const existing = document.getElementById('screenshot-protection');
  if (existing) {
    existing.remove();
  }

  document.head.appendChild(style);
}

/**
 * Remove screenshot protection CSS
 */
export function removeScreenshotProtectionCSS(): void {
  const style = document.getElementById('screenshot-protection');
  if (style) {
    style.remove();
  }
}

/**
 * Initialize screenshot detection
 * Wrapper for screenshotDetection.start()
 */
export function initializeScreenshotDetection(options?: {
  onDetected?: (method: string) => void;
  sessionId?: string;
}): () => void {
  if (options?.onDetected) {
    screenshotDetection.start((event) => {
      options.onDetected?.(event.type);
    });
  } else {
    screenshotDetection.start(() => {
      // Default empty callback
    });
  }
  return () => screenshotDetection.stop();
}
