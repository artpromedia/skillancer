/**
 * Hooks Index
 *
 * Re-exports all custom hooks for easy importing.
 */

// API hooks (TanStack Query)
export * from './api';

// Job hooks
export * from './use-job';
export * from './use-job-search';
export * from './use-job-mutations';
export * from './use-client-jobs';

// Proposal hooks
export * from './use-proposal-form';
export * from './use-proposals';
export * from './use-client-proposals';

// Contract hooks
export * from './use-contracts';

// Messaging hooks
export * from './use-messaging';
// Explicitly re-export from useRealtimeMessages to avoid conflict with TypingUser
export {
  useRealtimeMessages,
  type UseRealtimeMessagesOptions,
  type UseRealtimeMessagesReturn,
} from './useRealtimeMessages';
export * from './useNotifications';

// Search hooks
export * from './use-search-analytics';
export * from './use-saved-searches';
export * from './use-freelancer-search';

// Verification hooks
export * from './use-verification';

// Utility hooks
export * from './use-debounce';
