/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
'use client';

import { cn } from '@skillancer/ui';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import type { Conversation, Message } from '@/lib/api/messages';

import { ConversationList } from '@/components/messaging/conversation-list';
import { MessageThread } from '@/components/messaging/message-thread';

// ============================================================================
// Mock Data (Replace with API/WebSocket)
// ============================================================================

const mockCurrentUserId = 'user-1';

const mockConversations: Conversation[] = [
  {
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
    lastMessage: {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'client-1',
      senderName: 'Sarah from TechCorp',
      type: 'TEXT',
      content: "Great work on the latest milestone! Let's discuss the next steps.",
      attachments: [],
      reactions: [],
      linkPreviews: [],
      status: 'DELIVERED',
      isEdited: false,
      isDeleted: false,
      createdAt: '2024-12-24T10:30:00Z',
      updatedAt: '2024-12-24T10:30:00Z',
    },
    unreadCount: 2,
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
  },
  {
    id: 'conv-2',
    title: undefined,
    participants: [
      {
        id: 'p-3',
        userId: 'user-1',
        name: 'John Developer',
        avatarUrl: undefined,
        role: 'FREELANCER',
        isOnline: true,
        joinedAt: '2024-12-10',
      },
      {
        id: 'p-4',
        userId: 'client-2',
        name: 'Mike from StartupXYZ',
        avatarUrl: undefined,
        role: 'CLIENT',
        isOnline: false,
        lastSeenAt: '2024-12-23T18:00:00Z',
        joinedAt: '2024-12-10',
      },
    ],
    lastMessage: {
      id: 'msg-2',
      conversationId: 'conv-2',
      senderId: 'user-1',
      senderName: 'John Developer',
      type: 'TEXT',
      content: "I've uploaded the design mockups. Please review when you have a chance.",
      attachments: [],
      reactions: [],
      linkPreviews: [],
      status: 'READ',
      isEdited: false,
      isDeleted: false,
      createdAt: '2024-12-23T15:45:00Z',
      updatedAt: '2024-12-23T15:45:00Z',
    },
    unreadCount: 0,
    isPinned: false,
    isMuted: false,
    status: 'ACTIVE',
    context: {
      type: 'CONTRACT',
      id: 'contract-2',
      title: 'Mobile App UI/UX Design',
    },
    createdAt: '2024-12-10',
    updatedAt: '2024-12-23T15:45:00Z',
  },
  {
    id: 'conv-3',
    title: undefined,
    participants: [
      {
        id: 'p-5',
        userId: 'user-1',
        name: 'John Developer',
        avatarUrl: undefined,
        role: 'FREELANCER',
        isOnline: true,
        joinedAt: '2024-12-20',
      },
      {
        id: 'p-6',
        userId: 'client-3',
        name: 'Lisa Chen',
        avatarUrl: undefined,
        role: 'CLIENT',
        isOnline: false,
        lastSeenAt: '2024-12-22T10:00:00Z',
        joinedAt: '2024-12-20',
      },
    ],
    lastMessage: {
      id: 'msg-3',
      conversationId: 'conv-3',
      senderId: 'client-3',
      senderName: 'Lisa Chen',
      type: 'TEXT',
      content: 'Thanks for the proposal! I will review it this week.',
      attachments: [],
      reactions: [],
      linkPreviews: [],
      status: 'READ',
      isEdited: false,
      isDeleted: false,
      createdAt: '2024-12-22T09:30:00Z',
      updatedAt: '2024-12-22T09:30:00Z',
    },
    unreadCount: 0,
    isPinned: false,
    isMuted: false,
    status: 'ACTIVE',
    context: {
      type: 'PROPOSAL',
      id: 'proposal-5',
      title: 'Website Redesign Project',
    },
    createdAt: '2024-12-20',
    updatedAt: '2024-12-22T09:30:00Z',
  },
];

const mockMessages: Record<string, Message[]> = {
  'conv-1': [
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
      content: "Great work on the latest milestone! Let's discuss the next steps.",
      attachments: [],
      reactions: [],
      linkPreviews: [],
      status: 'DELIVERED',
      isEdited: false,
      isDeleted: false,
      createdAt: '2024-12-24T10:30:00Z',
      updatedAt: '2024-12-24T10:30:00Z',
    },
  ],
};

// ============================================================================
// Messages Page Content
// ============================================================================

function MessagesPageContent() {
  const searchParams = useSearchParams();
  const contractId = searchParams.get('contract');

  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  // Find conversation by contract ID
  useEffect(() => {
    if (contractId) {
      const conv = conversations.find((c) => c.context?.id === contractId);
      if (conv) {
        setActiveConversationId(conv.id);
      }
    }
  }, [contractId, conversations]);

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setMessages(mockMessages[activeConversationId] || []);
        setLoading(false);
      }, 300);
    }
  }, [activeConversationId]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, attachments?: File[]) => {
      if (!activeConversationId) return;

      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId: activeConversationId,
        senderId: mockCurrentUserId,
        senderName: 'John Developer',
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
    },
    [activeConversationId]
  );

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar - Conversation List */}
      <div
        className={cn(
          'w-full flex-shrink-0 border-r sm:w-80 lg:w-96',
          activeConversationId && 'hidden sm:block'
        )}
      >
        <ConversationList
          activeConversationId={activeConversationId || undefined}
          conversations={conversations}
          currentUserId={mockCurrentUserId}
          loading={false}
          onMuteConversation={async (id, muted) => {
            setConversations((prev) =>
              prev.map((c) => (c.id === id ? { ...c, isMuted: muted } : c))
            );
          }}
          onPinConversation={async (id, pinned) => {
            setConversations((prev) =>
              prev.map((c) => (c.id === id ? { ...c, isPinned: pinned } : c))
            );
          }}
          onSelectConversation={handleSelectConversation}
        />
      </div>

      {/* Main Content - Message Thread */}
      <div className="flex-1">
        {activeConversation ? (
          <MessageThread
            conversation={activeConversation}
            currentUserId={mockCurrentUserId}
            hasMore={false}
            loading={loading}
            messages={messages}
            onDeleteMessage={async (messageId) => {
              setMessages((prev) =>
                prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true } : m))
              );
            }}
            onEditMessage={async (messageId, content) => {
              setMessages((prev) =>
                prev.map((m) => (m.id === messageId ? { ...m, content, isEdited: true } : m))
              );
            }}
            onReactToMessage={async (messageId, emoji) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        reactions: [
                          ...m.reactions,
                          {
                            emoji,
                            userId: mockCurrentUserId,
                            userName: 'John Developer',
                            createdAt: new Date().toISOString(),
                          },
                        ],
                      }
                    : m
                )
              );
            }}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="text-muted-foreground mb-4 text-6xl">💬</div>
            <h2 className="text-xl font-semibold">Your Messages</h2>
            <p className="text-muted-foreground mt-1 max-w-md">
              Select a conversation from the list to start messaging, or messages will appear here
              when clients contact you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function MessagesPage() {
  return (
    <Suspense
      fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}
    >
      <MessagesPageContent />
    </Suspense>
  );
}
