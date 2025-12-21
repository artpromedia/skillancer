/**
 * @module @skillancer/market-svc/messaging/websocket-gateway
 * WebSocket gateway for real-time messaging with Socket.io and Redis adapter
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, type RedisClientType } from 'redis';
import { Server as SocketIOServer, type Socket } from 'socket.io';

import type { ConversationRepository } from '../repositories/conversation.repository.js';
import type { ConversationService } from '../services/conversation.service.js';
import type { MessageService } from '../services/message.service.js';
import type { PresenceService } from '../services/presence.service.js';
import type {
  SocketSendMessageData,
  SocketTypingData,
  SocketMarkReadData,
  SocketReactionData,
  ServerNewMessageEvent,
  ServerTypingEvent,
  ServerPresenceEvent,
  ServerMessageReadEvent,
  ServerReactionEvent,
  MessageForClient,
} from '../types/messaging.types.js';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Server as HttpServer } from 'node:http';

export interface WebSocketGatewayConfig {
  redisUrl: string;
  corsOrigins: string[];
  pingInterval: number;
  pingTimeout: number;
}

export interface WebSocketGatewayDependencies {
  fastify: FastifyInstance;
  httpServer: HttpServer;
  logger: Logger;
  messageService: MessageService;
  conversationService: ConversationService;
  presenceService: PresenceService;
  conversationRepository: ConversationRepository;
  config: WebSocketGatewayConfig;
}

export interface AuthenticatedSocketData {
  userId: string;
  conversationIds: string[];
}

// Use Socket with proper data typing - userId is stored in data
export type AuthenticatedSocket = Socket<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any, // ClientToServerEvents
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any, // ServerToClientEvents
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any, // InterServerEvents
  AuthenticatedSocketData
>;

// Helper to safely get userId from socket
function getSocketUserId(socket: AuthenticatedSocket): string {
  return socket.data.userId;
}

// Helper to safely get socket id
function getSocketId(socket: AuthenticatedSocket): string {
  return socket.id;
}

export interface WebSocketGateway {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  broadcastToConversation<T>(conversationId: string, event: string, data: T): void;
  broadcastToUser<T>(userId: string, event: string, data: T): void;
  getOnlineUsersInConversation(conversationId: string): Promise<string[]>;
}

export function createWebSocketGateway(deps: WebSocketGatewayDependencies): WebSocketGateway {
  const {
    fastify,
    httpServer,
    logger,
    messageService,
    // conversationService is available but not used in this implementation
    presenceService,
    conversationRepository,
    config,
  } = deps;

  let io: SocketIOServer;
  let pubClient: RedisClientType;
  let subClient: RedisClientType;

  // User ID to socket IDs mapping (one user can have multiple connections)
  const userSockets = new Map<string, Set<string>>();

  async function authenticateSocket(socket: Socket): Promise<string | null> {
    try {
      // Get token from auth header or query
      const authToken = socket.handshake.auth?.token as string | undefined;
      const headerToken = socket.handshake.headers.authorization?.replace('Bearer ', '');
      const token: string | undefined = authToken ?? headerToken;

      if (!token) {
        logger.warn({ msg: 'Socket connection without token' });
        return null;
      }

      // Verify JWT token using Fastify's JWT plugin
      const decoded = await (
        fastify as FastifyInstance & {
          jwt: { verify: (token: string) => Promise<{ sub: string }> };
        }
      ).jwt.verify(token);
      return decoded.sub;
    } catch (error) {
      logger.warn({ msg: 'Socket authentication failed', error });
      return null;
    }
  }

  async function handleConnection(socket: AuthenticatedSocket): Promise<void> {
    const userId = getSocketUserId(socket);
    const socketId = getSocketId(socket);
    logger.info({ msg: 'Socket connected', socketId, userId });

    // Track socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    const userSocketSet = userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.add(socketId);
    }

    // Set user online
    await presenceService.setOnline(userId);

    // Join user's conversation rooms
    const conversationIds = await conversationRepository.getUserConversationIds(userId);
    socket.data.conversationIds = conversationIds;
    for (const convId of conversationIds) {
      await socket.join(`conversation:${convId}`);
    }

    // Join personal room for direct messages to user
    await socket.join(`user:${userId}`);

    // Broadcast presence update to all conversation participants
    const presenceUpdate: ServerPresenceEvent = {
      userId,
      status: 'ONLINE',
      lastSeenAt: new Date(),
    };

    for (const convId of conversationIds) {
      io.to(`conversation:${convId}`).emit('presence:update', presenceUpdate);
    }

    // Set up event handlers
    setupEventHandlers(socket);

    // Handle disconnect
    socket.on('disconnect', async () => {
      await handleDisconnect(socket);
    });
  }

  async function handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
    const userId = getSocketUserId(socket);
    const socketId = getSocketId(socket);
    logger.info({ msg: 'Socket disconnected', socketId, userId });

    // Remove from tracking
    const userSocketSet = userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socketId);
      if (userSocketSet.size === 0) {
        userSockets.delete(userId);

        // User has no more connections - set offline
        await presenceService.setOffline(userId);

        // Broadcast offline status
        const conversationIds = socket.data.conversationIds ?? [];
        const presenceUpdate: ServerPresenceEvent = {
          userId,
          status: 'OFFLINE',
          lastSeenAt: new Date(),
        };

        for (const convId of conversationIds) {
          io.to(`conversation:${convId}`).emit('presence:update', presenceUpdate);
        }
      }
    }
  }

  function setupEventHandlers(socket: AuthenticatedSocket): void {
    const userId = getSocketUserId(socket);

    // Handle sending messages
    socket.on(
      'message:send',
      async (
        data: SocketSendMessageData,
        callback?: (response: {
          success: boolean;
          message?: MessageForClient;
          error?: string;
        }) => void
      ) => {
        try {
          const message = await messageService.sendMessage(userId, {
            senderUserId: userId,
            conversationId: data.conversationId,
            content: data.content ?? '',
            ...(data.contentType && { contentType: data.contentType }),
            ...(data.richContent && { richContent: data.richContent }),
            ...(data.attachments && { attachments: data.attachments }),
            ...(data.parentMessageId && { parentMessageId: data.parentMessageId }),
            ...(data.mentions && { mentions: data.mentions }),
          });

          // Broadcast to conversation
          const newMessageEvent: ServerNewMessageEvent = {
            message,
            conversationId: data.conversationId,
          };

          io.to(`conversation:${data.conversationId}`).emit('message:new', newMessageEvent);

          // Send push notifications to offline users
          await sendPushNotificationsForMessage(data.conversationId, message, userId);

          callback?.({ success: true, message });
        } catch (error) {
          logger.error({ msg: 'Error sending message via socket', error, userId });
          callback?.({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send message',
          });
        }
      }
    );

    // Handle typing indicators
    socket.on('typing:start', async (data: SocketTypingData) => {
      try {
        await presenceService.setTyping(userId, data.conversationId, true);

        const typingEvent: ServerTypingEvent = {
          userId,
          conversationId: data.conversationId,
          isTyping: true,
        };

        socket.to(`conversation:${data.conversationId}`).emit('typing:update', typingEvent);
      } catch (error) {
        logger.error({ msg: 'Error handling typing start', error, userId });
      }
    });

    socket.on('typing:stop', async (data: SocketTypingData) => {
      try {
        await presenceService.setTyping(userId, data.conversationId, false);

        const typingEvent: ServerTypingEvent = {
          userId,
          conversationId: data.conversationId,
          isTyping: false,
        };

        socket.to(`conversation:${data.conversationId}`).emit('typing:update', typingEvent);
      } catch (error) {
        logger.error({ msg: 'Error handling typing stop', error, userId });
      }
    });

    // Handle mark as read
    socket.on('message:read', async (data: SocketMarkReadData) => {
      try {
        await messageService.markAsRead(userId, data.conversationId, data.messageId);

        const readEvent: ServerMessageReadEvent = {
          conversationId: data.conversationId,
          userId,
          lastReadMessageId: data.messageId,
          readAt: new Date(),
        };

        socket.to(`conversation:${data.conversationId}`).emit('message:read', readEvent);
      } catch (error) {
        logger.error({ msg: 'Error marking message as read', error, userId });
      }
    });

    // Handle reactions
    socket.on(
      'reaction:add',
      async (
        data: SocketReactionData,
        callback?: (response: { success: boolean; result?: unknown; error?: string }) => void
      ) => {
        try {
          const result = await messageService.addReaction(userId, data.messageId, data.emoji);

          const message = await messageService.getMessage(userId, data.messageId);

          const reactionEvent: ServerReactionEvent = {
            messageId: data.messageId,
            userId,
            emoji: data.emoji,
            action: 'add',
          };

          io.to(`conversation:${message.conversationId}`).emit('reaction:update', reactionEvent);

          callback?.({ success: true, result });
        } catch (error) {
          logger.error({ msg: 'Error adding reaction', error, userId });
          callback?.({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to add reaction',
          });
        }
      }
    );

    socket.on(
      'reaction:remove',
      async (
        data: SocketReactionData,
        callback?: (response: { success: boolean; error?: string }) => void
      ) => {
        try {
          await messageService.removeReaction(userId, data.messageId, data.emoji);

          const message = await messageService.getMessage(userId, data.messageId);

          const reactionEvent: ServerReactionEvent = {
            messageId: data.messageId,
            userId,
            emoji: data.emoji,
            action: 'remove',
          };

          io.to(`conversation:${message.conversationId}`).emit('reaction:update', reactionEvent);

          callback?.({ success: true });
        } catch (error) {
          logger.error({ msg: 'Error removing reaction', error, userId });
          callback?.({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to remove reaction',
          });
        }
      }
    );

    // Handle joining new conversations (when user is added to a conversation)
    socket.on('conversation:join', async (data: { conversationId: string }) => {
      try {
        // Verify user is participant
        const isParticipant = await conversationRepository.isParticipant(
          data.conversationId,
          userId
        );

        if (isParticipant) {
          await socket.join(`conversation:${data.conversationId}`);
          socket.data.conversationIds.push(data.conversationId);
          logger.debug({
            msg: 'User joined conversation room',
            userId,
            conversationId: data.conversationId,
          });
        }
      } catch (error) {
        logger.error({ msg: 'Error joining conversation room', error, userId });
      }
    });

    // Handle leaving conversations
    socket.on('conversation:leave', async (data: { conversationId: string }) => {
      try {
        await socket.leave(`conversation:${data.conversationId}`);
        socket.data.conversationIds = socket.data.conversationIds.filter(
          (id: string) => id !== data.conversationId
        );
        logger.debug({
          msg: 'User left conversation room',
          userId,
          conversationId: data.conversationId,
        });
      } catch (error) {
        logger.error({ msg: 'Error leaving conversation room', error, userId });
      }
    });

    // Handle presence updates
    socket.on(
      'presence:update',
      async (data: { status?: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE' }) => {
        try {
          const status = data.status ?? 'ONLINE';
          await presenceService.updatePresence(userId, { status });

          const presenceUpdate: ServerPresenceEvent = {
            userId,
            status,
            lastSeenAt: new Date(),
          };

          // Broadcast to all user's conversations
          for (const convId of socket.data.conversationIds) {
            io.to(`conversation:${convId}`).emit('presence:update', presenceUpdate);
          }
        } catch (error) {
          logger.error({ msg: 'Error updating presence', error, userId });
        }
      }
    );

    // Handle focus on conversation
    socket.on('conversation:focus', async (data: { conversationId: string | null }) => {
      try {
        await presenceService.setCurrentConversation(userId, data.conversationId);
      } catch (error) {
        logger.error({ msg: 'Error setting current conversation', error, userId });
      }
    });
  }

  async function sendPushNotificationsForMessage(
    conversationId: string,
    message: MessageForClient,
    senderUserId: string
  ): Promise<void> {
    try {
      const participants = await conversationRepository.getParticipants(conversationId);

      for (const participant of participants) {
        // Skip sender
        if (participant.userId === senderUserId) continue;

        // Skip if notifications disabled
        if (!participant.notificationsEnabled) continue;

        // Check if user is online in this conversation
        const presence = await presenceService.getPresence(participant.userId);
        if (presence?.status === 'ONLINE' && presence.currentConversationId === conversationId) {
          // User is viewing the conversation - no push needed
          continue;
        }

        // Get push tokens and send notification
        const pushTokens = await presenceService.getPushTokens(participant.userId);
        if (pushTokens.length > 0) {
          // FUTURE: Integrate with notification service to send push
          // This would typically call a notification microservice
          logger.debug({
            msg: 'Would send push notification',
            userId: participant.userId,
            messageId: message.id,
            tokenCount: pushTokens.length,
          });
        }
      }
    } catch (error) {
      logger.error({ msg: 'Error sending push notifications', error, conversationId });
    }
  }

  return {
    async initialize(): Promise<void> {
      logger.info({ msg: 'Initializing WebSocket gateway' });

      // Create Redis clients for pub/sub
      pubClient = createClient({ url: config.redisUrl });
      subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      // Create Socket.IO server with Redis adapter
      io = new SocketIOServer(httpServer, {
        cors: {
          origin: config.corsOrigins,
          methods: ['GET', 'POST'],
          credentials: true,
        },
        pingInterval: config.pingInterval,
        pingTimeout: config.pingTimeout,
        transports: ['websocket', 'polling'],
      });

      io.adapter(createAdapter(pubClient, subClient));

      // Authentication middleware
      io.use(async (socket: Socket, next: (err?: Error) => void) => {
        const userId = await authenticateSocket(socket);
        if (!userId) {
          next(new Error('Authentication required'));
          return;
        }
        socket.data.userId = userId;
        socket.data.conversationIds = [];
        next();
      });

      // Connection handler
      io.on('connection', (socket: Socket) => {
        handleConnection(socket as AuthenticatedSocket).catch((error) => {
          logger.error({ msg: 'Error handling connection', error });
          socket.disconnect(true);
        });
      });

      // Start presence cleanup interval
      const cleanupInterval = setInterval(async () => {
        try {
          const staleThresholdMs = 5 * 60 * 1000; // 5 minutes
          await presenceService.cleanupStalePresence(staleThresholdMs);
        } catch (error) {
          logger.error({ msg: 'Error cleaning up stale presence', error });
        }
      }, 60 * 1000); // Every minute

      // Clean up on fastify close
      fastify.addHook('onClose', () => {
        clearInterval(cleanupInterval);
      });

      logger.info({ msg: 'WebSocket gateway initialized' });
    },

    async shutdown(): Promise<void> {
      logger.info({ msg: 'Shutting down WebSocket gateway' });

      if (io) {
        // Close all client connections first
        io.disconnectSockets(true);
        // Then close the server - void the Promise as this is fire-and-forget
        void io.close();
      }

      if (pubClient) {
        await pubClient.quit();
      }
      if (subClient) {
        await subClient.quit();
      }

      logger.info({ msg: 'WebSocket gateway shut down' });
    },

    broadcastToConversation<T>(conversationId: string, event: string, data: T): void {
      io.to(`conversation:${conversationId}`).emit(event, data);
    },

    broadcastToUser<T>(userId: string, event: string, data: T): void {
      io.to(`user:${userId}`).emit(event, data);
    },

    async getOnlineUsersInConversation(conversationId: string): Promise<string[]> {
      const participants = await conversationRepository.getParticipants(conversationId);

      const onlineUsers: string[] = [];
      for (const participant of participants) {
        if (userSockets.has(participant.userId)) {
          onlineUsers.push(participant.userId);
        }
      }

      return onlineUsers;
    },
  };
}
