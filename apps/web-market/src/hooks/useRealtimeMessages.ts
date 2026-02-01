/* eslint-disable @typescript-eslint/no-floating-promises, no-console */
'use client';

/**
 * useRealtimeMessages Hook
 *
 * Handles real-time messaging via WebSocket with TanStack Query integration.
 * Subscribes to message events and updates the query cache accordingly.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getMessagingClient,
  type MessagingClient,
  type NewMessageEvent,
  type TypingEvent,
  type ReadReceiptEvent,
  type WebSocketStatus,
  type MessageReactionEvent,
} from '@/lib/websocket/messaging-client';

import { conversationQueryKeys } from './api/use-conversations';
import { messageQueryKeys } from './api/use-messages';

import type { Message, PaginatedMessages } from '@/lib/api/messages';

// ============================================================================
// Types
// ============================================================================

export interface TypingUser {
  userId: string;
  userName: string;
  conversationId: string;
  startedAt: number;
}

export interface UseRealtimeMessagesOptions {
  /** The conversation ID to subscribe to */
  conversationId: string;
  /** Current user ID for filtering own messages/typing */
  currentUserId: string;
  /** Whether to auto-connect to WebSocket (default: true) */
  autoConnect?: boolean;
  /** Callback when new message received */
  onNewMessage?: (message: Message) => void;
  /** Callback when message read receipt received */
  onReadReceipt?: (event: ReadReceiptEvent) => void;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

export interface UseRealtimeMessagesReturn {
  /** Current WebSocket connection status */
  connectionStatus: WebSocketStatus;
  /** Users currently typing in this conversation */
  typingUsers: TypingUser[];
  /** Send typing indicator */
  sendTyping: (isTyping: boolean) => void;
  /** Send read receipt for a message */
  sendReadReceipt: (messageId: string) => void;
  /** Manually connect to WebSocket */
  connect: () => Promise<void>;
  /** Disconnect from WebSocket */
  disconnect: () => void;
  /** Check if connected */
  isConnected: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TYPING_TIMEOUT_MS = 10000; // Clear typing indicator after 10s of no updates
const TYPING_DEBOUNCE_MS = 2000; // Stop typing indicator after 2s of inactivity

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a Message object from a WebSocket NewMessageEvent
 */
function createMessageFromEvent(event: NewMessageEvent): Message {
  return {
    id: event.id,
    conversationId: event.conversationId,
    senderId: event.senderId,
    senderName: event.senderName,
    senderAvatar: event.senderAvatar,
    type: event.type,
    content: event.content,
    attachments: event.attachments.map((a) => ({
      ...a,
      uploadedAt: event.createdAt,
    })),
    reactions: [],
    linkPreviews: [],
    status: 'DELIVERED',
    isEdited: false,
    isDeleted: false,
    createdAt: event.createdAt,
    updatedAt: event.createdAt,
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useRealtimeMessages(
  options: UseRealtimeMessagesOptions
): UseRealtimeMessagesReturn {
  const {
    conversationId,
    currentUserId,
    autoConnect = true,
    onNewMessage,
    onReadReceipt,
    debug = false,
  } = options;

  const queryClient = useQueryClient();

  // State
  const [connectionStatus, setConnectionStatus] = useState<WebSocketStatus>('DISCONNECTED');
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // Refs
  const clientRef = useRef<MessagingClient | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupFnsRef = useRef<Array<() => void>>([]);

  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log('[useRealtimeMessages]', ...args);
      }
    },
    [debug]
  );

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle new message event - add to TanStack Query cache
   */
  const handleNewMessage = useCallback(
    (event: NewMessageEvent) => {
      log('New message received:', event.id);

      // Skip if message is from current user (already handled optimistically)
      if (event.senderId === currentUserId) {
        log('Skipping own message');
        return;
      }

      // Only handle messages for the current conversation
      if (event.conversationId !== conversationId) {
        log('Message for different conversation, skipping cache update');
        return;
      }

      const newMessage = createMessageFromEvent(event);

      // Update messages cache
      queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
        messageQueryKeys.infinite(conversationId),
        (old) => {
          if (!old) return old;

          // Check for duplicates
          const exists = old.pages.some((page) =>
            page.messages.some((msg) => msg.id === newMessage.id)
          );
          if (exists) {
            log('Message already exists in cache');
            return old;
          }

          // Add to first page (most recent messages)
          return {
            ...old,
            pages: old.pages.map((page, index) =>
              index === 0 ? { ...page, messages: [newMessage, ...page.messages] } : page
            ),
          };
        }
      );

      // Update conversation's last message and unread count
      void queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.detail(conversationId),
      });
      void queryClient.invalidateQueries({
        queryKey: conversationQueryKeys.lists(),
      });

      // Callback
      onNewMessage?.(newMessage);
    },
    [conversationId, currentUserId, queryClient, onNewMessage, log]
  );

  /**
   * Handle message updated event
   */
  const handleUpdatedMessage = useCallback(
    (event: NewMessageEvent) => {
      log('Message updated:', event.id);

      if (event.conversationId !== conversationId) return;

      queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
        messageQueryKeys.infinite(conversationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg.id === event.id
                  ? {
                      ...msg,
                      content: event.content,
                      isEdited: true,
                      editedAt: new Date().toISOString(),
                    }
                  : msg
              ),
            })),
          };
        }
      );
    },
    [conversationId, queryClient, log]
  );

  /**
   * Handle message deleted event
   */
  const handleDeletedMessage = useCallback(
    (event: { messageId: string; conversationId: string }) => {
      log('Message deleted:', event.messageId);

      if (event.conversationId !== conversationId) return;

      queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
        messageQueryKeys.infinite(conversationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg.id === event.messageId
                  ? {
                      ...msg,
                      content: '',
                      isDeleted: true,
                      deletedAt: new Date().toISOString(),
                    }
                  : msg
              ),
            })),
          };
        }
      );
    },
    [conversationId, queryClient, log]
  );

  /**
   * Handle message reaction event
   */
  const handleReaction = useCallback(
    (event: MessageReactionEvent) => {
      log('Reaction event:', event);

      if (event.conversationId !== conversationId) return;

      queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
        messageQueryKeys.infinite(conversationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) => {
                if (msg.id !== event.messageId) return msg;

                if (event.action === 'add') {
                  // Add reaction
                  const exists = msg.reactions.some(
                    (r) => r.userId === event.userId && r.emoji === event.emoji
                  );
                  if (exists) return msg;

                  return {
                    ...msg,
                    reactions: [
                      ...msg.reactions,
                      {
                        emoji: event.emoji,
                        userId: event.userId,
                        userName: event.userName,
                        createdAt: new Date().toISOString(),
                      },
                    ],
                  };
                } else {
                  // Remove reaction
                  return {
                    ...msg,
                    reactions: msg.reactions.filter(
                      (r) => !(r.userId === event.userId && r.emoji === event.emoji)
                    ),
                  };
                }
              }),
            })),
          };
        }
      );
    },
    [conversationId, queryClient, log]
  );

  /**
   * Handle typing start event
   */
  const handleTypingStart = useCallback(
    (event: TypingEvent) => {
      // Don't show own typing indicator
      if (event.userId === currentUserId) return;
      if (event.conversationId !== conversationId) return;

      log('Typing start:', event.userName);

      setTypingUsers((prev) => {
        const existing = prev.find((u) => u.userId === event.userId);
        if (existing) {
          // Update timestamp
          return prev.map((u) => (u.userId === event.userId ? { ...u, startedAt: Date.now() } : u));
        }

        return [
          ...prev,
          {
            userId: event.userId,
            userName: event.userName,
            conversationId: event.conversationId,
            startedAt: Date.now(),
          },
        ];
      });
    },
    [conversationId, currentUserId, log]
  );

  /**
   * Handle typing stop event
   */
  const handleTypingStop = useCallback(
    (event: TypingEvent) => {
      if (event.conversationId !== conversationId) return;

      log('Typing stop:', event.userName);

      setTypingUsers((prev) => prev.filter((u) => u.userId !== event.userId));
    },
    [conversationId, log]
  );

  /**
   * Handle read receipt event
   */
  const handleReadReceipt = useCallback(
    (event: ReadReceiptEvent) => {
      log('Read receipt:', event);

      if (event.conversationId !== conversationId) return;

      // Update message status in cache
      queryClient.setQueryData<{ pages: PaginatedMessages[]; pageParams: unknown[] }>(
        messageQueryKeys.infinite(conversationId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg.id === event.messageId ? { ...msg, status: 'READ' as const } : msg
              ),
            })),
          };
        }
      );

      // Callback
      onReadReceipt?.(event);
    },
    [conversationId, queryClient, onReadReceipt, log]
  );

  // ============================================================================
  // WebSocket Connection
  // ============================================================================

  const connect = useCallback(async () => {
    log('Connecting...');
    const client = getMessagingClient({
      debug: debug || process.env.NODE_ENV === 'development',
    });
    clientRef.current = client;

    try {
      await client.connect();
    } catch (error) {
      console.error('Failed to connect to messaging server:', error);
      throw error;
    }
  }, [debug, log]);

  const disconnect = useCallback(() => {
    log('Disconnecting...');
    if (clientRef.current) {
      clientRef.current.unsubscribeFromConversation(conversationId);
    }
  }, [conversationId, log]);

  // Setup WebSocket connection and event handlers
  useEffect(() => {
    if (!autoConnect) return;

    const client = getMessagingClient({
      debug: debug || process.env.NODE_ENV === 'development',
    });
    clientRef.current = client;

    // Status handler
    const unsubStatus = client.onStatusChange(setConnectionStatus);
    cleanupFnsRef.current.push(unsubStatus);

    // Event handlers
    const unsubNewMessage = client.on('message.new', handleNewMessage);
    const unsubUpdatedMessage = client.on('message.updated', handleUpdatedMessage);
    const unsubDeletedMessage = client.on('message.deleted', handleDeletedMessage);
    const unsubReaction = client.on('message.reaction', handleReaction);
    const unsubTypingStart = client.on('typing.start', handleTypingStart);
    const unsubTypingStop = client.on('typing.stop', handleTypingStop);
    const unsubReadReceipt = client.on('read.receipt', handleReadReceipt);

    cleanupFnsRef.current.push(
      unsubNewMessage,
      unsubUpdatedMessage,
      unsubDeletedMessage,
      unsubReaction,
      unsubTypingStart,
      unsubTypingStop,
      unsubReadReceipt
    );

    // Connect
    client.connect().catch((error) => {
      console.error('Failed to connect to messaging server:', error);
    });

    return () => {
      cleanupFnsRef.current.forEach((fn) => fn());
      cleanupFnsRef.current = [];
    };
  }, [
    autoConnect,
    debug,
    handleNewMessage,
    handleUpdatedMessage,
    handleDeletedMessage,
    handleReaction,
    handleTypingStart,
    handleTypingStop,
    handleReadReceipt,
  ]);

  // Subscribe to conversation when connected
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !conversationId) return;

    log('Subscribing to conversation:', conversationId);
    client.subscribeToConversation(conversationId);

    return () => {
      log('Unsubscribing from conversation:', conversationId);
      client.unsubscribeFromConversation(conversationId);
    };
  }, [conversationId, log]);

  // Cleanup stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => prev.filter((u) => now - u.startedAt < TYPING_TIMEOUT_MS));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Send typing indicator with debounce
   */
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      const client = clientRef.current;
      if (!client?.isConnected()) return;

      client.sendTyping(conversationId, isTyping);

      // Auto-stop typing after debounce period
      if (isTyping) {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          client.sendTyping(conversationId, false);
        }, TYPING_DEBOUNCE_MS);
      } else if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    },
    [conversationId]
  );

  /**
   * Send read receipt for a message
   */
  const sendReadReceipt = useCallback(
    (messageId: string) => {
      const client = clientRef.current;
      if (!client?.isConnected()) return;

      log('Sending read receipt for:', messageId);
      client.sendReadReceipt(conversationId, messageId);
    },
    [conversationId, log]
  );

  return {
    connectionStatus,
    typingUsers: typingUsers.filter((u) => u.conversationId === conversationId),
    sendTyping,
    sendReadReceipt,
    connect,
    disconnect,
    isConnected: connectionStatus === 'CONNECTED',
  };
}

// ============================================================================
// Utility Hook: useTypingIndicator
// ============================================================================

export interface UseTypingIndicatorOptions {
  conversationId: string;
  onTypingChange: (isTyping: boolean) => void;
  debounceMs?: number;
}

/**
 * Hook to manage typing indicator emission with debounce
 */
export function useTypingIndicator(options: UseTypingIndicatorOptions) {
  const { conversationId, onTypingChange, debounceMs = TYPING_DEBOUNCE_MS } = options;

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const startTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingChange(true);
    }

    // Reset timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTypingChange(false);
    }, debounceMs);
  }, [onTypingChange, debounceMs]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingChange(false);
    }
  }, [onTypingChange]);

  // Cleanup on unmount or conversation change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        onTypingChange(false);
      }
    };
  }, [conversationId, onTypingChange]);

  return { startTyping, stopTyping };
}
