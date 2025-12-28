/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-floating-promises, react-hooks/exhaustive-deps */
'use client';

/**
 * useMessaging Hook
 *
 * Manages real-time messaging state with WebSocket integration,
 * optimistic UI updates, typing indicators, and read receipts.
 */

import { useToast } from '@skillancer/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type Message,
  type Conversation,
  type SendMessageData,
  getConversations,
  getMessages,
  sendMessage as sendMessageAPI,
  markAsRead,
  deleteMessage as deleteMessageAPI,
  editMessage as editMessageAPI,
  addReaction,
  removeReaction,
  type PaginatedMessages,
} from '@/lib/api/messages';
import {
  type MessagingClient,
  getMessagingClient,
  type NewMessageEvent,
  type TypingEvent,
  type PresenceEvent,
  type ReadReceiptEvent,
  type WebSocketStatus,
} from '@/lib/websocket/messaging-client';

// ============================================================================
// Types
// ============================================================================

export interface TypingUser {
  userId: string;
  userName: string;
  conversationId: string;
  startedAt: number;
}

export interface UseMessagingOptions {
  conversationId?: string;
  autoConnect?: boolean;
}

export interface UseMessagingReturn {
  // Conversations
  conversations: Conversation[];
  activeConversation: Conversation | null;
  loadingConversations: boolean;

  // Messages
  messages: Message[];
  loadingMessages: boolean;
  hasMoreMessages: boolean;
  loadMoreMessages: () => Promise<void>;

  // Actions
  sendMessage: (data: SendMessageData) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  reactToMessage: (messageId: string, emoji: string) => Promise<void>;
  removeReactionFromMessage: (messageId: string, emoji: string) => Promise<void>;

  // Typing
  typingUsers: TypingUser[];
  setIsTyping: (isTyping: boolean) => void;

  // Connection
  connectionStatus: WebSocketStatus;
  reconnect: () => Promise<void>;

  // Utilities
  refreshConversations: () => Promise<void>;
  selectConversation: (conversationId: string) => void;
  totalUnreadCount: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a new message object from a NewMessageEvent
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

/**
 * Creates a last message object from a NewMessageEvent for conversation updates
 */
function createLastMessageFromEvent(event: NewMessageEvent): Message {
  return {
    id: event.id,
    conversationId: event.conversationId,
    senderId: event.senderId,
    senderName: event.senderName,
    type: event.type,
    content: event.content,
    attachments: [],
    reactions: [],
    linkPreviews: [],
    status: 'DELIVERED',
    isEdited: false,
    isDeleted: false,
    createdAt: event.createdAt,
    updatedAt: event.createdAt,
  };
}

/**
 * Updates a participant's presence in a conversation
 */
function updateParticipantPresence(conv: Conversation, event: PresenceEvent): Conversation {
  return {
    ...conv,
    participants: conv.participants.map((p) =>
      p.userId === event.userId
        ? { ...p, isOnline: event.isOnline, lastSeenAt: event.lastSeenAt }
        : p
    ),
  };
}

/**
 * Filters out a reaction from a message's reactions list
 */
function filterReaction(
  reactions: Message['reactions'],
  emoji: string,
  userId: string
): Message['reactions'] {
  return reactions.filter((r) => !(r.emoji === emoji && r.userId === userId));
}

/**
 * Filters out typing users that have been idle for too long
 */
function filterIdleTypingUsers(users: TypingUser[], maxIdleTime: number): TypingUser[] {
  const now = Date.now();
  return users.filter((u) => now - u.startedAt < maxIdleTime);
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useMessaging(options: UseMessagingOptions = {}): UseMessagingReturn {
  const { conversationId, autoConnect = true } = options;
  const { toast } = useToast();

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<WebSocketStatus>('DISCONNECTED');
  const [activeConversationId, setActiveConversationId] = useState(conversationId);

  // Refs
  const clientRef = useRef<MessagingClient | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageCursorRef = useRef<string | undefined>(undefined);

  // Computed
  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;
  const totalUnreadCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  // ============================================================================
  // WebSocket Connection
  // ============================================================================

  useEffect(() => {
    if (!autoConnect) return;

    const client = getMessagingClient({ debug: process.env.NODE_ENV === 'development' });
    clientRef.current = client;

    // Status handler
    const unsubStatus = client.onStatusChange(setConnectionStatus);

    // Event handlers
    const unsubNewMessage = client.on('message.new', handleNewMessage);
    const unsubUpdatedMessage = client.on('message.updated', handleUpdatedMessage);
    const unsubDeletedMessage = client.on('message.deleted', handleDeletedMessage);
    const unsubTypingStart = client.on('typing.start', handleTypingStart);
    const unsubTypingStop = client.on('typing.stop', handleTypingStop);
    const unsubPresence = client.on('user.presence', handlePresenceChange);
    const unsubReadReceipt = client.on('read.receipt', handleReadReceipt);

    // Connect
    client.connect().catch((error) => {
      console.error('Failed to connect to messaging server:', error);
    });

    return () => {
      unsubStatus();
      unsubNewMessage();
      unsubUpdatedMessage();
      unsubDeletedMessage();
      unsubTypingStart();
      unsubTypingStop();
      unsubPresence();
      unsubReadReceipt();
    };
  }, [autoConnect]);

  // Subscribe to active conversation
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !activeConversationId) return;

    client.subscribeToConversation(activeConversationId);

    return () => {
      client.unsubscribeFromConversation(activeConversationId);
    };
  }, [activeConversationId]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleNewMessage = useCallback((event: NewMessageEvent) => {
    // Add to messages if in active conversation
    setMessages((prev) => {
      if (prev.length > 0 && prev[0].conversationId !== event.conversationId) {
        return prev;
      }

      // Check for duplicate (optimistic update)
      if (prev.some((m) => m.id === event.id)) {
        return prev;
      }

      return [...prev, createMessageFromEvent(event)];
    });

    // Update conversation last message
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === event.conversationId
          ? {
              ...conv,
              lastMessage: createLastMessageFromEvent(event),
              unreadCount: conv.unreadCount + 1,
              updatedAt: event.createdAt,
            }
          : conv
      )
    );
  }, []);

  const handleUpdatedMessage = useCallback((event: NewMessageEvent) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === event.id
          ? {
              ...msg,
              content: event.content,
              isEdited: true,
              editedAt: new Date().toISOString(),
            }
          : msg
      )
    );
  }, []);

  const handleDeletedMessage = useCallback(
    (event: { messageId: string; conversationId: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === event.messageId
            ? {
                ...msg,
                content: '',
                isDeleted: true,
                deletedAt: new Date().toISOString(),
              }
            : msg
        )
      );
    },
    []
  );

  const handleTypingStart = useCallback((event: TypingEvent) => {
    setTypingUsers((prev) => {
      const existing = prev.find(
        (u) => u.userId === event.userId && u.conversationId === event.conversationId
      );
      if (existing) return prev;

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
  }, []);

  const handleTypingStop = useCallback((event: TypingEvent) => {
    setTypingUsers((prev) =>
      prev.filter((u) => !(u.userId === event.userId && u.conversationId === event.conversationId))
    );
  }, []);

  const handlePresenceChange = useCallback((event: PresenceEvent) => {
    setConversations((prev) => prev.map((conv) => updateParticipantPresence(conv, event)));
  }, []);

  const handleReadReceipt = useCallback((event: ReadReceiptEvent) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === event.messageId ? { ...msg, status: 'READ' } : msg))
    );
  }, []);

  // ============================================================================
  // Load Data
  // ============================================================================

  const refreshConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const data = await getConversations();
      setConversations(data);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Failed to load conversations',
        variant: 'destructive',
      });
    } finally {
      setLoadingConversations(false);
    }
  }, [toast]);

  const loadMessages = useCallback(
    async (conversationId: string, reset = true) => {
      try {
        setLoadingMessages(true);
        const result: PaginatedMessages = await getMessages(conversationId, {
          limit: 50,
          before: reset ? undefined : messageCursorRef.current,
        });

        if (reset) {
          setMessages(result.messages);
        } else {
          setMessages((prev) => [...result.messages, ...prev]);
        }

        setHasMoreMessages(result.hasMore);
        messageCursorRef.current = result.cursor;

        // Mark as read
        if (result.messages.length > 0) {
          await markAsRead(conversationId);
          setConversations((prev) =>
            prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
          );
        }
      } catch (error) {
        console.error(error);
        toast({
          title: 'Error',
          description: 'Failed to load messages',
          variant: 'destructive',
        });
      } finally {
        setLoadingMessages(false);
      }
    },
    [toast]
  );

  const loadMoreMessages = useCallback(async () => {
    if (!activeConversationId || loadingMessages || !hasMoreMessages) return;
    await loadMessages(activeConversationId, false);
  }, [activeConversationId, loadingMessages, hasMoreMessages, loadMessages]);

  // Load conversations on mount
  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      messageCursorRef.current = undefined;
      loadMessages(activeConversationId, true);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, loadMessages]);

  // ============================================================================
  // Actions
  // ============================================================================

  const sendMessage = useCallback(
    async (data: SendMessageData) => {
      if (!activeConversationId) return;

      // Optimistic update
      const optimisticId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        id: optimisticId,
        conversationId: activeConversationId,
        senderId: 'current-user',
        senderName: 'You',
        type: data.type || 'TEXT',
        content: data.content,
        attachments: [],
        reactions: [],
        linkPreviews: [],
        status: 'SENDING',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        const sentMessage = await sendMessageAPI(activeConversationId, data);

        // Replace optimistic message with real one
        setMessages((prev) => prev.map((m) => (m.id === optimisticId ? sentMessage : m)));

        // Update conversation
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId
              ? { ...c, lastMessage: sentMessage, updatedAt: sentMessage.createdAt }
              : c
          )
        );
      } catch (error) {
        console.error(error);
        // Mark as failed
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? { ...m, status: 'FAILED' } : m))
        );

        toast({
          title: 'Error',
          description: 'Failed to send message',
          variant: 'destructive',
        });
      }
    },
    [activeConversationId, toast]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      try {
        await deleteMessageAPI(messageId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: '', isDeleted: true, deletedAt: new Date().toISOString() }
              : m
          )
        );
      } catch (error) {
        console.error(error);
        toast({
          title: 'Error',
          description: 'Failed to delete message',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      try {
        const updated = await editMessageAPI(messageId, content);
        setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
      } catch (error) {
        console.error(error);
        toast({
          title: 'Error',
          description: 'Failed to edit message',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const reactToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      try {
        const reaction = await addReaction(messageId, emoji);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, reactions: [...m.reactions, reaction] } : m
          )
        );
      } catch (error) {
        console.error(error);
        toast({
          title: 'Error',
          description: 'Failed to add reaction',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const removeReactionFromMessage = useCallback(
    async (messageId: string, emoji: string) => {
      try {
        await removeReaction(messageId, emoji);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, reactions: filterReaction(m.reactions, emoji, 'current-user') }
              : m
          )
        );
      } catch (error) {
        console.error(error);
        toast({
          title: 'Error',
          description: 'Failed to remove reaction',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const setIsTyping = useCallback(
    (isTyping: boolean) => {
      if (!activeConversationId || !clientRef.current) return;

      clientRef.current.sendTyping(activeConversationId, isTyping);

      // Auto-stop typing after 5 seconds
      if (isTyping) {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          clientRef.current?.sendTyping(activeConversationId, false);
        }, 5000);
      }
    },
    [activeConversationId]
  );

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  const reconnect = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.connect();
    }
  }, []);

  // Cleanup typing users that have been idle for too long
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers((prev) => filterIdleTypingUsers(prev, 10000));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    // Conversations
    conversations,
    activeConversation,
    loadingConversations,

    // Messages
    messages,
    loadingMessages,
    hasMoreMessages,
    loadMoreMessages,

    // Actions
    sendMessage,
    deleteMessage,
    editMessage,
    reactToMessage,
    removeReactionFromMessage,

    // Typing
    typingUsers: typingUsers.filter((u) => u.conversationId === activeConversationId),
    setIsTyping,

    // Connection
    connectionStatus,
    reconnect,

    // Utilities
    refreshConversations,
    selectConversation,
    totalUnreadCount,
  };
}
