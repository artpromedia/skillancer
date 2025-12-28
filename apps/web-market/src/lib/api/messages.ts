/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars, no-console */
/**
 * Messages API Client
 *
 * Handles real-time messaging between clients and freelancers.
 * Integrates with notification-svc WebSocket for instant delivery.
 */

// ============================================================================
// Types
// ============================================================================

export type MessageStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export type MessageType = 'TEXT' | 'FILE' | 'IMAGE' | 'VOICE' | 'SYSTEM' | 'CONTRACT_EVENT';
export type ConversationStatus = 'ACTIVE' | 'ARCHIVED' | 'BLOCKED';
export type ConversationType = 'JOB' | 'CONTRACT' | 'PROPOSAL';

export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  thumbnail?: string;
  duration?: number; // for voice/video
  uploadedAt: string;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  type: MessageType;
  content: string;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  linkPreviews: LinkPreview[];
  replyTo?: {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
  };
  status: MessageStatus;
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  role: 'CLIENT' | 'FREELANCER';
  isOnline: boolean;
  lastSeenAt?: string;
  joinedAt: string;
}

export interface Conversation {
  id: string;
  title?: string;
  participants: Participant[];
  lastMessage?: Message;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  status: ConversationStatus;
  context?: {
    type: ConversationType;
    id: string;
    title: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface ConversationFilters {
  status?: ConversationStatus;
  unreadOnly?: boolean;
  search?: string;
  contextType?: ConversationType;
  contextId?: string;
}

export interface SendMessageData {
  content: string;
  type?: MessageType;
  attachments?: File[];
  replyToId?: string;
}

export interface MessagePagination {
  before?: string;
  after?: string;
  limit?: number;
}

export interface PaginatedMessages {
  messages: Message[];
  hasMore: boolean;
  cursor?: string;
}

// ============================================================================
// API Functions
// ============================================================================

const API_BASE = '/api/v1/messages';

/**
 * Get all conversations for current user
 */
export async function getConversations(filters?: ConversationFilters): Promise<Conversation[]> {
  await new Promise((r) => setTimeout(r, 300));

  let conversations = getMockConversations();

  if (filters?.unreadOnly) {
    conversations = conversations.filter((c) => c.unreadCount > 0);
  }

  if (filters?.search) {
    const search = filters.search.toLowerCase();
    conversations = conversations.filter(
      (c) =>
        c.title?.toLowerCase().includes(search) ||
        c.participants.some((p) => p.name.toLowerCase().includes(search)) ||
        c.lastMessage?.content.toLowerCase().includes(search)
    );
  }

  if (filters?.status) {
    conversations = conversations.filter((c) => c.status === filters.status);
  }

  // Sort by pinned first, then by last message time
  return conversations.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const aTime = a.lastMessage?.createdAt || a.createdAt;
    const bTime = b.lastMessage?.createdAt || b.createdAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

/**
 * Get conversation by ID
 */
export async function getConversationById(conversationId: string): Promise<Conversation> {
  await new Promise((r) => setTimeout(r, 200));

  const conversations = getMockConversations();
  const conversation = conversations.find((c) => c.id === conversationId);

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  return conversation;
}

/**
 * Get messages for a conversation with pagination
 */
export async function getMessages(
  conversationId: string,
  pagination?: MessagePagination
): Promise<PaginatedMessages> {
  await new Promise((r) => setTimeout(r, 300));

  const allMessages = getMockMessages(conversationId);
  const limit = pagination?.limit || 50;

  let messages = allMessages;

  if (pagination?.before) {
    const beforeIndex = messages.findIndex((m) => m.id === pagination.before);
    if (beforeIndex > 0) {
      messages = messages.slice(Math.max(0, beforeIndex - limit), beforeIndex);
    }
  } else if (pagination?.after) {
    const afterIndex = messages.findIndex((m) => m.id === pagination.after);
    if (afterIndex >= 0) {
      messages = messages.slice(afterIndex + 1, afterIndex + 1 + limit);
    }
  } else {
    // Get most recent messages
    messages = messages.slice(-limit);
  }

  return {
    messages,
    hasMore: allMessages.length > limit,
    cursor: messages[0]?.id,
  };
}

/**
 * Send a new message
 */
export async function sendMessage(conversationId: string, data: SendMessageData): Promise<Message> {
  await new Promise((r) => setTimeout(r, 200));

  const attachments: MessageAttachment[] = [];

  // Handle file uploads
  if (data.attachments) {
    for (const file of data.attachments) {
      attachments.push({
        id: `attachment-${Date.now()}-${Math.random()}`,
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });
    }
  }

  const message: Message = {
    id: `msg-${Date.now()}`,
    conversationId,
    senderId: 'current-user',
    senderName: 'You',
    type: data.type || 'TEXT',
    content: data.content,
    attachments,
    reactions: [],
    linkPreviews: extractLinkPreviews(data.content),
    status: 'SENT',
    isEdited: false,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (data.replyToId) {
    message.replyTo = {
      id: data.replyToId,
      senderId: 'other-user',
      senderName: 'Sarah Johnson',
      content: 'Previous message content...',
    };
  }

  return message;
}

/**
 * Mark conversation as read
 */
export async function markAsRead(conversationId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 100));
  // In real implementation, this would update server state
}

/**
 * Mark specific messages as read
 */
export async function markMessagesAsRead(messageIds: string[]): Promise<void> {
  await new Promise((r) => setTimeout(r, 100));
}

/**
 * Delete a message
 */
export async function deleteMessage(messageId: string): Promise<Message> {
  await new Promise((r) => setTimeout(r, 200));

  return {
    id: messageId,
    conversationId: 'conv-1',
    senderId: 'current-user',
    senderName: 'You',
    type: 'TEXT',
    content: '',
    attachments: [],
    reactions: [],
    linkPreviews: [],
    status: 'SENT',
    isEdited: false,
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Edit a message
 */
export async function editMessage(messageId: string, content: string): Promise<Message> {
  await new Promise((r) => setTimeout(r, 200));

  return {
    id: messageId,
    conversationId: 'conv-1',
    senderId: 'current-user',
    senderName: 'You',
    type: 'TEXT',
    content,
    attachments: [],
    reactions: [],
    linkPreviews: extractLinkPreviews(content),
    status: 'SENT',
    isEdited: true,
    editedAt: new Date().toISOString(),
    isDeleted: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Add reaction to message
 */
export async function addReaction(messageId: string, emoji: string): Promise<MessageReaction> {
  await new Promise((r) => setTimeout(r, 100));

  return {
    emoji,
    userId: 'current-user',
    userName: 'You',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Remove reaction from message
 */
export async function removeReaction(messageId: string, emoji: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 100));
}

/**
 * Search messages across all conversations
 */
export async function searchMessages(query: string, conversationId?: string): Promise<Message[]> {
  await new Promise((r) => setTimeout(r, 400));

  const allMessages = conversationId
    ? getMockMessages(conversationId)
    : [...getMockMessages('conv-1'), ...getMockMessages('conv-2'), ...getMockMessages('conv-3')];

  const lowerQuery = query.toLowerCase();
  return allMessages.filter((m) => m.content.toLowerCase().includes(lowerQuery));
}

/**
 * Upload attachment for message
 */
export async function uploadAttachment(
  file: File,
  onProgress?: (progress: number) => void
): Promise<MessageAttachment> {
  // Simulate upload progress
  for (let i = 0; i <= 100; i += 10) {
    await new Promise((r) => setTimeout(r, 100));
    onProgress?.(i);
  }

  return {
    id: `attachment-${Date.now()}`,
    name: file.name,
    url: URL.createObjectURL(file),
    type: file.type,
    size: file.size,
    thumbnail: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Start a new conversation with a user
 */
export async function startConversation(
  userId: string,
  context?: { type: ConversationType; id: string; title: string }
): Promise<Conversation> {
  await new Promise((r) => setTimeout(r, 300));

  return {
    id: `conv-${Date.now()}`,
    participants: [
      {
        id: 'participant-1',
        userId: 'current-user',
        name: 'You',
        role: 'CLIENT',
        isOnline: true,
        joinedAt: new Date().toISOString(),
      },
      {
        id: 'participant-2',
        userId,
        name: 'New Contact',
        role: 'FREELANCER',
        isOnline: false,
        joinedAt: new Date().toISOString(),
      },
    ],
    unreadCount: 0,
    isPinned: false,
    isMuted: false,
    status: 'ACTIVE',
    context,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Pin/unpin conversation
 */
export async function togglePinConversation(
  conversationId: string,
  pinned: boolean
): Promise<void> {
  await new Promise((r) => setTimeout(r, 100));
}

/**
 * Mute/unmute conversation
 */
export async function toggleMuteConversation(
  conversationId: string,
  muted: boolean
): Promise<void> {
  await new Promise((r) => setTimeout(r, 100));
}

/**
 * Archive conversation
 */
export async function archiveConversation(conversationId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 200));
}

/**
 * Block user in conversation
 */
export async function blockUser(conversationId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 200));
}

/**
 * Report conversation
 */
export async function reportConversation(
  conversationId: string,
  reason: string,
  details: string
): Promise<void> {
  await new Promise((r) => setTimeout(r, 300));
}

/**
 * Get total unread count across all conversations
 */
export async function getTotalUnreadCount(): Promise<number> {
  await new Promise((r) => setTimeout(r, 100));

  const conversations = getMockConversations();
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

/**
 * Send typing indicator
 */
export function sendTypingIndicator(_conversationId: string, _isTyping: boolean): void {
  // Feature: Send typing indicator via WebSocket - not yet implemented
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractLinkPreviews(content: string): LinkPreview[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = content.match(urlRegex);

  if (!urls) return [];

  // In real implementation, fetch metadata for each URL
  return urls.slice(0, 3).map((url) => ({
    url,
    title: 'Link Preview',
    description: 'Preview description would be fetched from the URL',
  }));
}

export function formatMessageTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getOtherParticipant(
  conversation: Conversation,
  currentUserId = 'current-user'
): Participant | undefined {
  return conversation.participants.find((p) => p.userId !== currentUserId);
}

// ============================================================================
// Mock Data
// ============================================================================

function getMockConversations(): Conversation[] {
  return [
    {
      id: 'conv-1',
      participants: [
        {
          id: 'p1',
          userId: 'current-user',
          name: 'You',
          role: 'CLIENT',
          isOnline: true,
          joinedAt: new Date(Date.now() - 2592000000).toISOString(),
        },
        {
          id: 'p2',
          userId: 'sarah-1',
          name: 'Sarah Johnson',
          avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
          role: 'FREELANCER',
          isOnline: true,
          lastSeenAt: new Date().toISOString(),
          joinedAt: new Date(Date.now() - 2592000000).toISOString(),
        },
      ],
      lastMessage: {
        id: 'msg-last-1',
        conversationId: 'conv-1',
        senderId: 'sarah-1',
        senderName: 'Sarah Johnson',
        type: 'TEXT',
        content: "I've completed the product catalog. Ready for review!",
        attachments: [],
        reactions: [],
        linkPreviews: [],
        status: 'DELIVERED',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        updatedAt: new Date(Date.now() - 1800000).toISOString(),
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
      createdAt: new Date(Date.now() - 2592000000).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'conv-2',
      participants: [
        {
          id: 'p3',
          userId: 'current-user',
          name: 'You',
          role: 'CLIENT',
          isOnline: true,
          joinedAt: new Date(Date.now() - 604800000).toISOString(),
        },
        {
          id: 'p4',
          userId: 'mike-1',
          name: 'Michael Chen',
          avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
          role: 'FREELANCER',
          isOnline: false,
          lastSeenAt: new Date(Date.now() - 7200000).toISOString(),
          joinedAt: new Date(Date.now() - 604800000).toISOString(),
        },
      ],
      lastMessage: {
        id: 'msg-last-2',
        conversationId: 'conv-2',
        senderId: 'current-user',
        senderName: 'You',
        type: 'TEXT',
        content: 'Thanks for the update. Looking forward to the next milestone.',
        attachments: [],
        reactions: [],
        linkPreviews: [],
        status: 'READ',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
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
      createdAt: new Date(Date.now() - 604800000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'conv-3',
      participants: [
        {
          id: 'p5',
          userId: 'current-user',
          name: 'You',
          role: 'CLIENT',
          isOnline: true,
          joinedAt: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id: 'p6',
          userId: 'emma-1',
          name: 'Emma Wilson',
          avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
          role: 'FREELANCER',
          isOnline: true,
          lastSeenAt: new Date().toISOString(),
          joinedAt: new Date(Date.now() - 172800000).toISOString(),
        },
      ],
      lastMessage: {
        id: 'msg-last-3',
        conversationId: 'conv-3',
        senderId: 'emma-1',
        senderName: 'Emma Wilson',
        type: 'TEXT',
        content: 'I would be happy to discuss the project requirements in detail.',
        attachments: [],
        reactions: [],
        linkPreviews: [],
        status: 'DELIVERED',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      unreadCount: 1,
      isPinned: false,
      isMuted: false,
      status: 'ACTIVE',
      context: {
        type: 'PROPOSAL',
        id: 'proposal-5',
        title: 'API Integration Project',
      },
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'conv-4',
      participants: [
        {
          id: 'p7',
          userId: 'current-user',
          name: 'You',
          role: 'CLIENT',
          isOnline: true,
          joinedAt: new Date(Date.now() - 5184000000).toISOString(),
        },
        {
          id: 'p8',
          userId: 'david-1',
          name: 'David Thompson',
          avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
          role: 'FREELANCER',
          isOnline: false,
          lastSeenAt: new Date(Date.now() - 604800000).toISOString(),
          joinedAt: new Date(Date.now() - 5184000000).toISOString(),
        },
      ],
      lastMessage: {
        id: 'msg-last-4',
        conversationId: 'conv-4',
        senderId: 'david-1',
        senderName: 'David Thompson',
        type: 'TEXT',
        content: 'Great working with you! Feel free to reach out for future projects.',
        attachments: [],
        reactions: [],
        linkPreviews: [],
        status: 'READ',
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(Date.now() - 864000000).toISOString(),
        updatedAt: new Date(Date.now() - 864000000).toISOString(),
      },
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      status: 'ACTIVE',
      context: {
        type: 'CONTRACT',
        id: 'contract-4',
        title: 'Website Redesign',
      },
      createdAt: new Date(Date.now() - 5184000000).toISOString(),
      updatedAt: new Date(Date.now() - 864000000).toISOString(),
    },
  ];
}

function getMockMessages(conversationId: string): Message[] {
  const baseMessages: Message[] = [
    {
      id: 'msg-1',
      conversationId,
      senderId: 'other-user',
      senderName: 'Sarah Johnson',
      senderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
      type: 'TEXT',
      content: 'Hi! I just accepted the contract. Excited to get started on this project!',
      attachments: [],
      reactions: [
        {
          emoji: '🎉',
          userId: 'current-user',
          userName: 'You',
          createdAt: new Date(Date.now() - 2592000000).toISOString(),
        },
      ],
      linkPreviews: [],
      status: 'READ',
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(Date.now() - 2592000000).toISOString(),
      updatedAt: new Date(Date.now() - 2592000000).toISOString(),
    },
    {
      id: 'msg-2',
      conversationId,
      senderId: 'current-user',
      senderName: 'You',
      type: 'TEXT',
      content:
        'Welcome aboard! Looking forward to working with you. Here are some resources to get you started.',
      attachments: [],
      reactions: [],
      linkPreviews: [],
      status: 'READ',
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(Date.now() - 2505600000).toISOString(),
      updatedAt: new Date(Date.now() - 2505600000).toISOString(),
    },
    {
      id: 'msg-3',
      conversationId,
      senderId: 'current-user',
      senderName: 'You',
      type: 'FILE',
      content: 'Project requirements document',
      attachments: [
        {
          id: 'att-1',
          name: 'requirements.pdf',
          url: '/files/requirements.pdf',
          type: 'application/pdf',
          size: 2457600,
          uploadedAt: new Date(Date.now() - 2505600000).toISOString(),
        },
      ],
      reactions: [],
      linkPreviews: [],
      status: 'READ',
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(Date.now() - 2505500000).toISOString(),
      updatedAt: new Date(Date.now() - 2505500000).toISOString(),
    },
    {
      id: 'msg-4',
      conversationId,
      senderId: 'other-user',
      senderName: 'Sarah Johnson',
      senderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
      type: 'TEXT',
      content:
        "Thanks for sharing! I've reviewed the requirements. A few questions:\n\n1. What's the preferred tech stack?\n2. Do you have brand guidelines?\n3. Is there an existing codebase?",
      attachments: [],
      reactions: [],
      linkPreviews: [],
      status: 'READ',
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(Date.now() - 2419200000).toISOString(),
      updatedAt: new Date(Date.now() - 2419200000).toISOString(),
    },
    {
      id: 'msg-5',
      conversationId,
      senderId: 'current-user',
      senderName: 'You',
      type: 'TEXT',
      content:
        "Great questions!\n\n1. React + Node.js + PostgreSQL\n2. Yes, I'll share the brand kit\n3. Starting fresh, but we have some reference projects",
      attachments: [],
      reactions: [
        {
          emoji: '👍',
          userId: 'other-user',
          userName: 'Sarah Johnson',
          createdAt: new Date(Date.now() - 2332800000).toISOString(),
        },
      ],
      linkPreviews: [],
      status: 'READ',
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(Date.now() - 2332800000).toISOString(),
      updatedAt: new Date(Date.now() - 2332800000).toISOString(),
    },
    {
      id: 'msg-6',
      conversationId,
      senderId: 'other-user',
      senderName: 'Sarah Johnson',
      senderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
      type: 'SYSTEM',
      content: '🎯 Milestone 1 "Project Setup & Authentication" has been completed',
      attachments: [],
      reactions: [],
      linkPreviews: [],
      status: 'READ',
      isEdited: false,
      isDeleted: false,
      metadata: { milestoneId: 'milestone-1', event: 'MILESTONE_COMPLETED' },
      createdAt: new Date(Date.now() - 1296000000).toISOString(),
      updatedAt: new Date(Date.now() - 1296000000).toISOString(),
    },
    {
      id: 'msg-7',
      conversationId,
      senderId: 'current-user',
      senderName: 'You',
      type: 'TEXT',
      content:
        'Excellent work on the first milestone! The auth system looks solid. Payment released! 🎉',
      attachments: [],
      reactions: [
        {
          emoji: '❤️',
          userId: 'other-user',
          userName: 'Sarah Johnson',
          createdAt: new Date(Date.now() - 1209600000).toISOString(),
        },
      ],
      linkPreviews: [],
      status: 'READ',
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(Date.now() - 1209600000).toISOString(),
      updatedAt: new Date(Date.now() - 1209600000).toISOString(),
    },
    {
      id: 'msg-8',
      conversationId,
      senderId: 'other-user',
      senderName: 'Sarah Johnson',
      senderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
      type: 'IMAGE',
      content:
        "Here's the current progress on the product catalog. What do you think of the design?",
      attachments: [
        {
          id: 'att-2',
          name: 'catalog-preview.png',
          url: 'https://via.placeholder.com/800x600',
          thumbnail: 'https://via.placeholder.com/200x150',
          type: 'image/png',
          size: 1245184,
          uploadedAt: new Date(Date.now() - 259200000).toISOString(),
        },
      ],
      reactions: [],
      linkPreviews: [],
      status: 'READ',
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      updatedAt: new Date(Date.now() - 259200000).toISOString(),
    },
    {
      id: 'msg-9',
      conversationId,
      senderId: 'current-user',
      senderName: 'You',
      type: 'TEXT',
      content:
        'This looks amazing! Love the clean layout. Just a few minor tweaks needed on the filter sidebar.',
      attachments: [],
      reactions: [],
      linkPreviews: [],
      status: 'READ',
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: 'msg-10',
      conversationId,
      senderId: 'other-user',
      senderName: 'Sarah Johnson',
      senderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
      type: 'TEXT',
      content: "I've completed the product catalog. Ready for review!",
      attachments: [],
      reactions: [],
      linkPreviews: [],
      status: 'DELIVERED',
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString(),
    },
  ];

  return baseMessages;
}
