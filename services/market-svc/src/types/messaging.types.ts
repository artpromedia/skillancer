// @ts-nocheck
/**
 * @module @skillancer/market-svc/types/messaging
 * Type definitions for the real-time messaging system
 */

import type {
  Conversation,
  ConversationParticipant,
  ConversationMessage,
  ConversationType,
  ParticipantRole,
  ConversationContentType,
  ConversationMessageType,
  SystemMessageEventType,
  PresenceStatus,
} from '@skillancer/database';

// =============================================================================
// CONVERSATION TYPES
// =============================================================================

export interface CreateConversationParams {
  type: ConversationType;
  participantUserIds: string[];
  createdByUserId: string;
  title?: string;
  description?: string;
  jobId?: string;
  contractId?: string;
  bidId?: string;
  serviceOrderId?: string;
  disputeId?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationWithDetails extends Conversation {
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  otherParticipants: ParticipantDetails[];
}

export interface ParticipantDetails {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  role: ParticipantRole;
  status: PresenceStatus;
  lastSeenAt?: Date | null;
}

export interface ConversationListOptions {
  type?: ConversationType;
  isArchived?: boolean;
  archived?: boolean;
  pinned?: boolean;
  unreadOnly?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface ConversationUpdateParams {
  title?: string;
  description?: string;
  avatarUrl?: string;
}

// =============================================================================
// MESSAGE TYPES
// =============================================================================

export interface CreateMessageParams {
  conversationId: string;
  senderUserId: string;
  content?: string;
  contentType?: ConversationContentType;
  richContent?: RichContent;
  attachments?: MessageAttachmentData[];
  parentMessageId?: string;
  mentions?: string[];
}

export interface RichContent {
  blocks: RichContentBlock[];
}

export interface RichContentBlock {
  type: 'text' | 'code' | 'quote' | 'heading' | 'list';
  content: string;
  language?: string; // For code blocks
  level?: number; // For headings
}

export interface MessageAttachmentData {
  id?: string;
  name: string;
  url: string;
  size: number;
  type: string;
  thumbnailUrl?: string;
}

export interface MessageWithSender extends ConversationMessage {
  sender: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
}

export interface MessageListOptions {
  before?: string;
  after?: string;
  limit?: number;
  includeDeleted?: boolean;
}

export interface MessageSearchParams {
  userId: string;
  query: string;
  conversationId?: string;
  fromUserId?: string;
  hasAttachments?: boolean;
  startDate?: Date;
  endDate?: Date;
  after?: string;
  before?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

export interface MessageSearchResult {
  messages: MessageSearchHit[] | MessageForClient[];
  total: number;
  hasMore?: boolean;
}

export interface MessageSearchHit {
  id: string;
  conversationId: string;
  conversationTitle?: string | null;
  content: string;
  sender: {
    id: string;
    name: string;
  };
  createdAt: Date;
  highlight?: string;
}

export interface EditMessageParams {
  messageId: string;
  userId: string;
  newContent: string;
}

export interface DeleteMessageParams {
  messageId: string;
  userId: string;
}

export interface MarkAsReadParams {
  userId: string;
  conversationId: string;
  upToMessageId: string;
}

export interface ReactionParams {
  messageId: string;
  userId: string;
  emoji: string;
}

// =============================================================================
// PRESENCE TYPES
// =============================================================================

export interface PresenceInfo {
  userId: string;
  status: PresenceStatus;
  statusMessage?: string | null;
  lastSeenAt: Date | null;
  lastActiveAt?: Date | null;
  currentConversationId?: string | null;
  isTyping?: boolean;
  typingInConversationId?: string | null;
  typingStartedAt?: Date | null;
}

export interface UpdatePresenceParams {
  status?: PresenceStatus;
  statusMessage?: string;
  currentConversationId?: string | null;
  isTyping?: boolean;
  typingInConversationId?: string | null;
}

export interface PushTokenData {
  token: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
  deviceId?: string;
}

// =============================================================================
// WEBSOCKET EVENT TYPES
// =============================================================================

export interface SocketSendMessageData {
  conversationId: string;
  content?: string;
  contentType?: ConversationContentType;
  richContent?: RichContent;
  attachments?: MessageAttachmentData[];
  parentMessageId?: string;
  mentions?: string[];
}

export interface SocketEditMessageData {
  messageId: string;
  content: string;
}

export interface SocketDeleteMessageData {
  messageId: string;
}

export interface SocketTypingData {
  conversationId: string;
}

export interface SocketReadMessagesData {
  conversationId: string;
  messageId: string;
}

// Alias for compatibility
export type SocketMarkReadData = SocketReadMessagesData;

export interface SocketReactionData {
  messageId: string;
  emoji: string;
}

export interface SocketPresenceData {
  status: PresenceStatus;
  statusMessage?: string;
}

export interface SocketJoinConversationData {
  conversationId: string;
}

// Server -> Client events
export interface ServerNewMessageEvent {
  message: MessageForClient;
  conversationId?: string;
}

export interface ServerMessageEditedEvent {
  message: MessageForClient;
}

export interface ServerMessageDeletedEvent {
  messageId: string;
  conversationId: string;
  deletedBy: string;
}

export interface ServerTypingUpdateEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

// Alias for compatibility
export type ServerTypingEvent = ServerTypingUpdateEvent;

export interface ServerMessagesReadEvent {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  readAt: Date;
}

export interface ServerReactionEvent {
  messageId: string;
  userId: string;
  emoji: string;
  action?: 'add' | 'remove';
  reactionCounts?: Record<string, number>;
}

export interface ServerPresenceUpdateEvent {
  userId: string;
  status: PresenceStatus;
  lastSeenAt: Date;
}

// Alias for compatibility
export type ServerPresenceEvent = ServerPresenceUpdateEvent;

// Alias for compatibility
export type ServerMessageReadEvent = ServerMessagesReadEvent;

export interface ServerConversationUpdatedEvent {
  conversation: Conversation;
}

export interface ServerParticipantEvent {
  conversationId: string;
  participant?: ConversationParticipant;
  userId?: string;
}

// =============================================================================
// CLIENT MESSAGE FORMAT
// =============================================================================

export interface MessageForClient {
  id: string;
  conversationId: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    avatarUrl?: string | null;
  };
  content: string | null;
  contentType: ConversationContentType;
  richContent?: Record<string, unknown> | null;
  attachments: MessageAttachmentData[] | Record<string, unknown>[] | null;
  parentMessageId: string | null;
  threadCount: number;
  mentions: string[];
  messageType?: ConversationMessageType;
  systemEventType?: SystemMessageEventType | null;
  systemEventData?: Record<string, unknown> | null;
  isEdited: boolean;
  editedAt?: Date | null;
  isDeleted: boolean;
  reactionCounts?: Record<string, number> | null;
  isPinned: boolean;
  pinnedAt?: Date | null;
  createdAt: Date;
  deliveredAt?: Date | null;
}

// =============================================================================
// SYSTEM MESSAGE TYPES
// =============================================================================

export interface CreateSystemMessageParams {
  conversationId: string;
  systemEventType: SystemMessageEventType;
  systemEventData: SystemEventData;
}

export type SystemEventData =
  | ParticipantJoinedData
  | ParticipantLeftData
  | ParticipantRemovedData
  | ConversationCreatedData
  | ConversationRenamedData
  | ContractSignedData
  | MilestoneCompletedData
  | PaymentReceivedData
  | DeadlineReminderData;

export interface ParticipantJoinedData {
  userName: string;
  addedByName?: string;
}

export interface ParticipantLeftData {
  userName: string;
}

export interface ParticipantRemovedData {
  userName: string;
  removedByName: string;
}

export interface ConversationCreatedData {
  createdByName: string;
}

export interface ConversationRenamedData {
  oldName?: string | null;
  newName: string;
  changedByName: string;
}

export interface ContractSignedData {
  contractId: string;
}

export interface MilestoneCompletedData {
  milestoneId: string;
  milestoneName: string;
}

export interface PaymentReceivedData {
  amount: number;
  currency: string;
}

export interface DeadlineReminderData {
  message: string;
  deadline: Date;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export type MessageErrorCode =
  | 'CONVERSATION_NOT_FOUND'
  | 'MESSAGE_NOT_FOUND'
  | 'EMPTY_MESSAGE'
  | 'INVALID_PARENT_MESSAGE'
  | 'ACCESS_DENIED'
  | 'MESSAGE_DELETED'
  | 'EDIT_WINDOW_EXPIRED'
  | 'NOT_PARTICIPANT'
  | 'REACTIONS_DISABLED';

export type ConversationErrorCode =
  | 'CONVERSATION_NOT_FOUND'
  | 'INSUFFICIENT_PARTICIPANTS'
  | 'USER_BLOCKED'
  | 'ALREADY_PARTICIPANT'
  | 'NOT_PARTICIPANT'
  | 'ACCESS_DENIED'
  | 'CANNOT_REMOVE_OWNER'
  | 'OWNER_CANNOT_LEAVE';

// =============================================================================
// ATTACHMENT UPLOAD TYPES
// =============================================================================

export interface UploadAttachmentResult {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  size: number;
  type: string;
}

export interface AttachmentUploadOptions {
  messageId?: string;
  conversationId?: string;
  maxSizeBytes?: number;
  allowedTypes?: string[];
}

