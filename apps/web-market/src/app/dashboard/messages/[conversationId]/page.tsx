/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await, no-console */
'use client';

import { Button } from '@skillancer/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { MessageThread } from '@/components/messaging/message-thread';
import { useUser } from '@/hooks/useAuth';

import type { TypingUser } from '@/hooks/use-messaging';
import type { Conversation, Message } from '@/lib/api/messages';

// ============================================================================
// Mock Data (Replace with API/WebSocket)
// ============================================================================

// Note: In production, this would be replaced with real API calls
// The mock conversations now use dynamic user IDs from auth context

const mockConversation: Conversation = {
  id: 'conv-1',
  title: undefined,
  participants: [
    {
      id: 'p-1',
      userId: 'user-1',
      name: 'John Developer',
      avatarUrl: undefined,
      role: 'FREELANCER',
      isOnline: true,
      joinedAt: '2024-12-01',
    },
    {
      id: 'p-2',
      userId: 'client-1',
      name: 'Sarah from TechCorp',
      avatarUrl: undefined,
      role: 'CLIENT',
      isOnline: true,
      lastSeenAt: undefined,
      joinedAt: '2024-12-01',
    },
  ],
  lastMessage: undefined,
  unreadCount: 0,
  isPinned: true,
  isMuted: false,
  status: 'ACTIVE',
  context: {
    type: 'CONTRACT',
    id: 'contract-1',
    title: 'E-commerce Platform Development',
  },
  createdAt: '2024-12-01',
  updatedAt: '2024-12-24T10:30:00Z',
};

const mockMessages: Message[] = [
  {
    id: 'msg-1-1',
    conversationId: 'conv-1',
    senderId: 'client-1',
    senderName: 'Sarah from TechCorp',
    type: 'TEXT',
    content: 'Hi John! Thanks for accepting our contract.',
    attachments: [],
    reactions: [],
    linkPreviews: [],
    status: 'READ',
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-12-01T10:00:00Z',
    updatedAt: '2024-12-01T10:00:00Z',
  },
  {
    id: 'msg-1-2',
    conversationId: 'conv-1',
    senderId: 'user-1',
    senderName: 'John Developer',
    type: 'TEXT',
    content:
      "Thank you Sarah! I'm excited to work on this project. I've already started reviewing the requirements.",
    attachments: [],
    reactions: [
      {
        emoji: '👍',
        userId: 'client-1',
        userName: 'Sarah from TechCorp',
        createdAt: '2024-12-01T10:05:00Z',
      },
    ],
    linkPreviews: [],
    status: 'READ',
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-12-01T10:02:00Z',
    updatedAt: '2024-12-01T10:02:00Z',
  },
  {
    id: 'msg-1-3',
    conversationId: 'conv-1',
    senderId: 'client-1',
    senderName: 'Sarah from TechCorp',
    type: 'SYSTEM',
    content: 'Milestone 1 "Project Setup & Authentication" has been funded',
    attachments: [],
    reactions: [],
    linkPreviews: [],
    status: 'READ',
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-11-01T12:00:00Z',
    updatedAt: '2024-11-01T12:00:00Z',
  },
  {
    id: 'msg-1-4',
    conversationId: 'conv-1',
    senderId: 'user-1',
    senderName: 'John Developer',
    type: 'TEXT',
    content:
      "I've completed the authentication system. Here are the test credentials and documentation:",
    attachments: [
      {
        id: 'att-1',
        name: 'auth-documentation.pdf',
        url: '/files/auth-documentation.pdf',
        type: 'application/pdf',
        size: 245000,
        uploadedAt: '2024-11-14T16:00:00Z',
      },
    ],
    reactions: [],
    linkPreviews: [],
    status: 'READ',
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-11-14T16:00:00Z',
    updatedAt: '2024-11-14T16:00:00Z',
  },
  {
    id: 'msg-1-5',
    conversationId: 'conv-1',
    senderId: 'client-1',
    senderName: 'Sarah from TechCorp',
    type: 'TEXT',
    content:
      'This looks great! The login flow works perfectly. I tested it with multiple accounts.',
    attachments: [],
    reactions: [
      {
        emoji: '🎉',
        userId: 'user-1',
        userName: 'John Developer',
        createdAt: '2024-11-14T17:00:00Z',
      },
    ],
    linkPreviews: [],
    status: 'READ',
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-11-14T16:45:00Z',
    updatedAt: '2024-11-14T16:45:00Z',
  },
  {
    id: 'msg-1-6',
    conversationId: 'conv-1',
    senderId: 'client-1',
    senderName: 'Sarah from TechCorp',
    type: 'CONTRACT_EVENT',
    content: 'Milestone 1 has been approved and payment released',
    attachments: [],
    reactions: [],
    linkPreviews: [],
    status: 'READ',
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-11-15T09:00:00Z',
    updatedAt: '2024-11-15T09:00:00Z',
  },
  {
    id: 'msg-1-7',
    conversationId: 'conv-1',
    senderId: 'user-1',
    senderName: 'John Developer',
    type: 'TEXT',
    content:
      "Thank you! Starting work on the product catalog now. I'll have the first version ready by end of week.",
    attachments: [],
    reactions: [],
    linkPreviews: [],
    status: 'READ',
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-11-15T09:15:00Z',
    updatedAt: '2024-11-15T09:15:00Z',
  },
  {
    id: 'msg-1-8',
    conversationId: 'conv-1',
    senderId: 'client-1',
    senderName: 'Sarah from TechCorp',
    type: 'TEXT',
    content:
      "Great work on the latest milestone! Let's discuss the next steps for the checkout integration.",
    attachments: [],
    reactions: [],
    linkPreviews: [],
    status: 'DELIVERED',
    isEdited: false,
    isDeleted: false,
    createdAt: '2024-12-24T10:30:00Z',
    updatedAt: '2024-12-24T10:30:00Z',
  },
];

// ============================================================================
// Page Component
// ============================================================================

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;

  // Get current user from auth context
  const { user } = useUser();
  const currentUserId = user?.id || 'user-1'; // Fallback for development
  const currentUserName = user ? `${user.firstName} ${user.lastName}` : 'John Developer';

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // Load conversation and messages
  useEffect(() => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      // In real app, fetch by conversationId
      setConversation(mockConversation);
      setMessages(mockMessages);
      setLoading(false);
    }, 300);
  }, [conversationId]);

  // Simulate typing indicator
  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly show typing indicator
      if (Math.random() > 0.9) {
        setTypingUsers([
          {
            userId: 'client-1',
            userName: 'Sarah',
            conversationId,
            startedAt: Date.now(),
          },
        ]);
        setTimeout(() => setTypingUsers([]), 3000);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [conversationId]);

  const handleSendMessage = useCallback(
    async (content: string, attachments?: File[]) => {
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId,
        senderId: currentUserId,
        senderName: currentUserName,
        type: 'TEXT',
        content,
        attachments:
          attachments?.map((file, i) => ({
            id: `att-${Date.now()}-${i}`,
            name: file.name,
            url: URL.createObjectURL(file),
            type: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString(),
          })) || [],
        reactions: [],
        linkPreviews: [],
        status: 'SENDING',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Optimistic update
      setMessages((prev) => [...prev, newMessage]);

      // Simulate API call
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) => (m.id === newMessage.id ? { ...m, status: 'SENT' as const } : m))
        );
      }, 500);

      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) => (m.id === newMessage.id ? { ...m, status: 'DELIVERED' as const } : m))
        );
      }, 1000);
    },
    [conversationId, currentUserId, currentUserName]
  );

  const handleEditMessage = useCallback(async (messageId: string, content: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content, isEdited: true, updatedAt: new Date().toISOString() }
          : m
      )
    );
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, isDeleted: true, deletedAt: new Date().toISOString() } : m
      )
    );
  }, []);

  const handleReactToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                reactions: [
                  ...m.reactions,
                  {
                    emoji,
                    userId: currentUserId,
                    userName: currentUserName,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : m
        )
      );
    },
    [currentUserId, currentUserName]
  );

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-muted-foreground">Loading conversation...</div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center">
        <div className="text-muted-foreground mb-4 text-6xl">🔍</div>
        <h2 className="text-xl font-semibold">Conversation not found</h2>
        <p className="text-muted-foreground mt-1">
          This conversation may have been deleted or you don&apos;t have access.
        </p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/messages">Back to Messages</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Mobile Back Button */}
      <div className="border-b p-2 sm:hidden">
        <Button size="sm" variant="ghost" onClick={() => router.push('/dashboard/messages')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Messages
        </Button>
      </div>

      {/* Message Thread */}
      <div className="flex-1 overflow-hidden">
        <MessageThread
          conversation={conversation}
          currentUserId={currentUserId}
          hasMore={messages.length > 20}
          loading={false}
          messages={messages}
          typingUsers={typingUsers}
          onDeleteMessage={handleDeleteMessage}
          onEditMessage={handleEditMessage}
          onLoadMore={async () => {
            // Feature: Load more messages via pagination - not yet implemented
          }}
          onReactToMessage={handleReactToMessage}
          onSendMessage={handleSendMessage}
          onTypingChange={(_isTyping) => {
            // Feature: Send typing indicator via WebSocket - not yet implemented
          }}
        />
      </div>
    </div>
  );
}
