/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Timer Store
 *
 * Global state management for the timer using Zustand.
 * Handles timer state, synchronization, and persistence.
 *
 * @module stores/timer-store
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// Types
// ============================================================================

export interface TimerProject {
  id: string;
  name: string;
  color: string;
  clientName?: string;
}

export interface TimerTask {
  id: string;
  name: string;
  projectId: string;
}

export interface TimerCategory {
  id: string;
  name: string;
  color: string;
}

export interface TimerEntry {
  id: string;
  description: string;
  project?: TimerProject;
  task?: TimerTask;
  category?: TimerCategory;
  startTime: number; // timestamp
  endTime?: number; // timestamp
  pausedAt?: number; // timestamp when paused
  pausedDuration: number; // total paused time in ms
  billable: boolean;
  hourlyRate?: number;
  tags: string[];
}

export interface TimerState {
  // Current timer state
  isRunning: boolean;
  isPaused: boolean;
  currentEntry: TimerEntry | null;

  // Recent entries for quick restart
  recentEntries: TimerEntry[];

  // Sync state
  lastSyncAt: number | null;
  syncError: string | null;

  // UI state
  isExpanded: boolean;
  isModalOpen: boolean;
}

export interface TimerActions {
  // Timer controls
  start: (entry: Omit<TimerEntry, 'id' | 'startTime' | 'pausedDuration'>) => void;
  stop: () => TimerEntry | null;
  pause: () => void;
  resume: () => void;
  discard: () => void;

  // Update current entry
  updateDescription: (description: string) => void;
  updateProject: (project: TimerProject | undefined) => void;
  updateTask: (task: TimerTask | undefined) => void;
  updateCategory: (category: TimerCategory | undefined) => void;
  updateBillable: (billable: boolean) => void;
  updateTags: (tags: string[]) => void;

  // Recent entries
  addRecentEntry: (entry: TimerEntry) => void;
  clearRecentEntries: () => void;

  // Sync
  setSyncStatus: (lastSyncAt: number | null, error?: string | null) => void;

  // UI
  setExpanded: (expanded: boolean) => void;
  setModalOpen: (open: boolean) => void;

  // Hydration
  hydrate: (state: Partial<TimerState>) => void;

  // Utilities
  getElapsedTime: () => number;
  getCurrentDuration: () => string;
}

/** State that gets persisted to localStorage */
interface PersistedState {
  isRunning: boolean;
  isPaused: boolean;
  currentEntry: TimerEntry | null;
  recentEntries: TimerEntry[];
  isExpanded: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `timer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: TimerState = {
  isRunning: false,
  isPaused: false,
  currentEntry: null,
  recentEntries: [],
  lastSyncAt: null,
  syncError: null,
  isExpanded: false,
  isModalOpen: false,
};

// ============================================================================
// Store
// ============================================================================

export const useTimerStore = create<TimerState & TimerActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // -----------------------------------------------------------------------
      // Timer Controls
      // -----------------------------------------------------------------------

      start: (entry) => {
        set((state) => {
          // If timer is already running, stop it first
          if (state.currentEntry && state.isRunning) {
            const completedEntry = {
              ...state.currentEntry,
              endTime: Date.now(),
            };
            state.recentEntries = [completedEntry, ...state.recentEntries].slice(0, 10);
          }

          state.isRunning = true;
          state.isPaused = false;
          state.currentEntry = {
            ...entry,
            id: generateId(),
            startTime: Date.now(),
            pausedDuration: 0,
          };
        });
      },

      stop: () => {
        const state = get();
        if (!state.currentEntry) return null;

        const completedEntry: TimerEntry = {
          ...state.currentEntry,
          endTime: Date.now(),
        };

        set((state) => {
          state.isRunning = false;
          state.isPaused = false;
          state.currentEntry = null;
          state.recentEntries = [completedEntry, ...state.recentEntries].slice(0, 10);
        });

        return completedEntry;
      },

      pause: () => {
        set((state) => {
          if (state.currentEntry && state.isRunning && !state.isPaused) {
            state.isPaused = true;
            state.currentEntry.pausedAt = Date.now();
          }
        });
      },

      resume: () => {
        set((state) => {
          if (state.currentEntry && state.isPaused && state.currentEntry.pausedAt) {
            const pausedTime = Date.now() - state.currentEntry.pausedAt;
            state.currentEntry.pausedDuration += pausedTime;
            state.currentEntry.pausedAt = undefined;
            state.isPaused = false;
          }
        });
      },

      discard: () => {
        set((state) => {
          state.isRunning = false;
          state.isPaused = false;
          state.currentEntry = null;
        });
      },

      // -----------------------------------------------------------------------
      // Update Current Entry
      // -----------------------------------------------------------------------

      updateDescription: (description) => {
        set((state) => {
          if (state.currentEntry) {
            state.currentEntry.description = description;
          }
        });
      },

      updateProject: (project) => {
        set((state) => {
          if (state.currentEntry) {
            state.currentEntry.project = project;
            // Clear task if project changes
            if (!project || state.currentEntry.task?.projectId !== project.id) {
              state.currentEntry.task = undefined;
            }
          }
        });
      },

      updateTask: (task) => {
        set((state) => {
          if (state.currentEntry) {
            state.currentEntry.task = task;
          }
        });
      },

      updateCategory: (category) => {
        set((state) => {
          if (state.currentEntry) {
            state.currentEntry.category = category;
          }
        });
      },

      updateBillable: (billable) => {
        set((state) => {
          if (state.currentEntry) {
            state.currentEntry.billable = billable;
          }
        });
      },

      updateTags: (tags) => {
        set((state) => {
          if (state.currentEntry) {
            state.currentEntry.tags = tags;
          }
        });
      },

      // -----------------------------------------------------------------------
      // Recent Entries
      // -----------------------------------------------------------------------

      addRecentEntry: (entry) => {
        set((state) => {
          state.recentEntries = [entry, ...state.recentEntries].slice(0, 10);
        });
      },

      clearRecentEntries: () => {
        set((state) => {
          state.recentEntries = [];
        });
      },

      // -----------------------------------------------------------------------
      // Sync
      // -----------------------------------------------------------------------

      setSyncStatus: (lastSyncAt, error = null) => {
        set((state) => {
          state.lastSyncAt = lastSyncAt;
          state.syncError = error;
        });
      },

      // -----------------------------------------------------------------------
      // UI
      // -----------------------------------------------------------------------

      setExpanded: (expanded) => {
        set((state) => {
          state.isExpanded = expanded;
        });
      },

      setModalOpen: (open) => {
        set((state) => {
          state.isModalOpen = open;
        });
      },

      // -----------------------------------------------------------------------
      // Hydration
      // -----------------------------------------------------------------------

      hydrate: (newState) => {
        set((state) => {
          Object.assign(state, newState);
        });
      },

      // -----------------------------------------------------------------------
      // Utilities
      // -----------------------------------------------------------------------

      getElapsedTime: () => {
        const state = get();
        if (!state.currentEntry) return 0;

        const now =
          state.isPaused && state.currentEntry.pausedAt ? state.currentEntry.pausedAt : Date.now();

        return now - state.currentEntry.startTime - state.currentEntry.pausedDuration;
      },

      getCurrentDuration: () => {
        const elapsed = get().getElapsedTime();
        return formatDuration(elapsed);
      },
    })),
    {
      name: 'timer-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedState => ({
        isRunning: state.isRunning,
        isPaused: state.isPaused,
        currentEntry: state.currentEntry,
        recentEntries: state.recentEntries,
        isExpanded: state.isExpanded,
      }),
      merge: (persistedState, currentState): TimerState & TimerActions => {
        const persisted = persistedState as PersistedState | undefined;
        return {
          ...currentState,
          ...(persisted ?? {}),
        };
      },
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectIsRunning = (state: TimerState) => state.isRunning;
export const selectIsPaused = (state: TimerState) => state.isPaused;
export const selectCurrentEntry = (state: TimerState) => state.currentEntry;
export const selectRecentEntries = (state: TimerState) => state.recentEntries;
export const selectIsExpanded = (state: TimerState) => state.isExpanded;
export const selectIsModalOpen = (state: TimerState) => state.isModalOpen;

// ============================================================================
// Hooks
// ============================================================================

export function useTimerIsRunning() {
  return useTimerStore(selectIsRunning);
}

export function useTimerIsPaused() {
  return useTimerStore(selectIsPaused);
}

export function useCurrentEntry() {
  return useTimerStore(selectCurrentEntry);
}

export function useRecentEntries() {
  return useTimerStore(selectRecentEntries);
}

export function useTimerExpanded() {
  return useTimerStore(selectIsExpanded);
}

export function useTimerModalOpen() {
  return useTimerStore(selectIsModalOpen);
}

// ============================================================================
// Cross-Tab Sync
// ============================================================================

const BROADCAST_CHANNEL_NAME = 'timer-sync';

let broadcastChannel: BroadcastChannel | null = null;

export function initTimerSync() {
  if (typeof window === 'undefined') return;

  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);

    broadcastChannel.onmessage = (event) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'TIMER_UPDATE':
          useTimerStore.getState().hydrate(payload);
          break;
        case 'TIMER_START':
          useTimerStore.getState().start(payload);
          break;
        case 'TIMER_STOP':
          useTimerStore.getState().stop();
          break;
        case 'TIMER_PAUSE':
          useTimerStore.getState().pause();
          break;
        case 'TIMER_RESUME':
          useTimerStore.getState().resume();
          break;
      }
    };

    // Subscribe to store changes and broadcast
    useTimerStore.subscribe((state, prevState) => {
      if (
        state.isRunning !== prevState.isRunning ||
        state.isPaused !== prevState.isPaused ||
        state.currentEntry !== prevState.currentEntry
      ) {
        broadcastChannel?.postMessage({
          type: 'TIMER_UPDATE',
          payload: {
            isRunning: state.isRunning,
            isPaused: state.isPaused,
            currentEntry: state.currentEntry,
          },
        });
      }
    });
  } catch (error) {
    console.warn('BroadcastChannel not supported, falling back to storage events');

    // Fallback to storage events
    window.addEventListener('storage', (event) => {
      if (event.key === 'timer-storage') {
        const newState = JSON.parse(event.newValue || '{}');
        useTimerStore.getState().hydrate(newState.state || {});
      }
    });
  }
}

export function cleanupTimerSync() {
  broadcastChannel?.close();
  broadcastChannel = null;
}
