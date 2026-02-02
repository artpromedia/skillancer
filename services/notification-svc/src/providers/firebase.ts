/**
 * Firebase Cloud Messaging Provider
 *
 * Handles push notifications through Firebase Admin SDK.
 * Supports sending to individual devices, multiple devices per user,
 * topics for broadcast, and handles token lifecycle.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { logger } from '@skillancer/logger';
import admin from 'firebase-admin';

import { getConfig } from '../config/index.js';

import type {
  Message,
  MulticastMessage,
  TopicMessage,
  BatchResponse,
} from 'firebase-admin/messaging';

// ============================================================================
// Types
// ============================================================================

export interface FirebaseConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  icon?: string;
  badge?: string;
  sound?: string;
  clickAction?: string;
  data?: Record<string, string>;
}

export interface SendToDeviceOptions {
  token: string;
  notification: PushNotificationPayload;
  android?: AndroidConfig;
  apns?: ApnsConfig;
  webpush?: WebPushConfig;
}

export interface SendToUserOptions {
  userId: string;
  tokens: string[];
  notification: PushNotificationPayload;
  android?: AndroidConfig;
  apns?: ApnsConfig;
  webpush?: WebPushConfig;
}

export interface SendToTopicOptions {
  topic: string;
  notification: PushNotificationPayload;
  android?: AndroidConfig;
  apns?: ApnsConfig;
  webpush?: WebPushConfig;
}

export interface AndroidConfig {
  priority?: 'high' | 'normal';
  ttl?: number;
  collapseKey?: string;
  channelId?: string;
}

export interface ApnsConfig {
  badge?: number;
  sound?: string;
  category?: string;
  threadId?: string;
}

export interface WebPushConfig {
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

export interface FirebaseSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  failedTokens?: string[];
}

export interface BatchSendResult {
  successCount: number;
  failureCount: number;
  results: FirebaseSendResult[];
  invalidTokens: string[];
}

// ============================================================================
// Firebase Provider
// ============================================================================

let firebaseApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK
 */
export function initializeFirebase(config?: FirebaseConfig): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  const appConfig = config || getFirebaseConfig();

  if (!appConfig.projectId || !appConfig.privateKey || !appConfig.clientEmail) {
    logger.warn('Firebase credentials not configured. Push notifications will be disabled.');
    throw new Error('Firebase credentials not configured');
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: appConfig.projectId,
        privateKey: appConfig.privateKey,
        clientEmail: appConfig.clientEmail,
      }),
    });

    logger.info({ projectId: appConfig.projectId }, 'Firebase Admin SDK initialized');
    return firebaseApp;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Firebase Admin SDK');
    throw error;
  }
}

/**
 * Get Firebase config from environment
 */
function getFirebaseConfig(): FirebaseConfig {
  const config = getConfig();
  return {
    projectId: config.firebaseProjectId || '',
    privateKey: config.firebasePrivateKey || '',
    clientEmail: config.firebaseClientEmail || '',
  };
}

/**
 * Get Firebase messaging instance
 */
function getMessaging(): admin.messaging.Messaging {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.messaging(firebaseApp);
}

/**
 * Check if Firebase is configured and ready
 */
export function isFirebaseConfigured(): boolean {
  const config = getFirebaseConfig();
  return !!(config.projectId && config.privateKey && config.clientEmail);
}

// ============================================================================
// Send Methods
// ============================================================================

/**
 * Send push notification to a single device
 */
export async function sendToDevice(options: SendToDeviceOptions): Promise<FirebaseSendResult> {
  const { token, notification, android, apns, webpush } = options;

  const message: Message = {
    token,
    notification: {
      title: notification.title,
      body: notification.body,
      imageUrl: notification.imageUrl,
    },
    data: notification.data,
    android: android
      ? {
          priority: android.priority,
          ttl: android.ttl ? android.ttl * 1000 : undefined,
          collapseKey: android.collapseKey,
          notification: {
            channelId: android.channelId,
            icon: notification.icon,
            sound: notification.sound || 'default',
            clickAction: notification.clickAction,
          },
        }
      : undefined,
    apns: apns
      ? {
          payload: {
            aps: {
              badge: apns.badge,
              sound: apns.sound || 'default',
              category: apns.category,
              threadId: apns.threadId,
            },
          },
        }
      : undefined,
    webpush: webpush
      ? {
          notification: {
            icon: webpush.icon || notification.icon,
            badge: webpush.badge,
            requireInteraction: webpush.requireInteraction,
            actions: webpush.actions,
          },
          fcmOptions: {
            link: notification.clickAction,
          },
        }
      : undefined,
  };

  try {
    const messaging = getMessaging();
    const messageId = await messaging.send(message);

    logger.info({ messageId, token: token.slice(0, 20) + '...' }, 'Push notification sent');

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as { code?: string }).code;

    logger.error({ error, token: token.slice(0, 20) + '...' }, 'Failed to send push notification');

    // Check if token is invalid
    const isInvalidToken =
      errorCode === 'messaging/invalid-registration-token' ||
      errorCode === 'messaging/registration-token-not-registered';

    return {
      success: false,
      error: errorMessage,
      failedTokens: isInvalidToken ? [token] : undefined,
    };
  }
}

/**
 * Send push notification to multiple devices (same user)
 */
export async function sendToUser(options: SendToUserOptions): Promise<BatchSendResult> {
  const { tokens, notification, android, apns, webpush } = options;

  if (tokens.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      results: [],
      invalidTokens: [],
    };
  }

  // Firebase allows max 500 tokens per multicast
  const chunks = chunkArray(tokens, 500);
  const allResults: FirebaseSendResult[] = [];
  const invalidTokens: string[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const chunk of chunks) {
    const message: MulticastMessage = {
      tokens: chunk,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: notification.data,
      android: android
        ? {
            priority: android.priority,
            ttl: android.ttl ? android.ttl * 1000 : undefined,
            collapseKey: android.collapseKey,
            notification: {
              channelId: android.channelId,
              icon: notification.icon,
              sound: notification.sound || 'default',
              clickAction: notification.clickAction,
            },
          }
        : undefined,
      apns: apns
        ? {
            payload: {
              aps: {
                badge: apns.badge,
                sound: apns.sound || 'default',
                category: apns.category,
                threadId: apns.threadId,
              },
            },
          }
        : undefined,
      webpush: webpush
        ? {
            notification: {
              icon: webpush.icon || notification.icon,
              badge: webpush.badge,
              requireInteraction: webpush.requireInteraction,
              actions: webpush.actions,
            },
            fcmOptions: {
              link: notification.clickAction,
            },
          }
        : undefined,
    };

    try {
      const messaging = getMessaging();
      const response: BatchResponse = await messaging.sendEachForMulticast(message);

      successCount += response.successCount;
      failureCount += response.failureCount;

      response.responses.forEach((res, index) => {
        if (res.success) {
          allResults.push({
            success: true,
            messageId: res.messageId,
          });
        } else {
          const errorCode = res.error?.code;
          const isInvalidToken =
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered';

          if (isInvalidToken) {
            invalidTokens.push(chunk[index]);
          }

          allResults.push({
            success: false,
            error: res.error?.message || 'Unknown error',
            failedTokens: isInvalidToken ? [chunk[index]] : undefined,
          });
        }
      });
    } catch (error) {
      logger.error({ error, tokenCount: chunk.length }, 'Failed to send multicast push');

      // Mark all as failed
      failureCount += chunk.length;
      chunk.forEach((token) => {
        allResults.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }
  }

  logger.info(
    { successCount, failureCount, invalidTokens: invalidTokens.length },
    'Multicast push notification completed'
  );

  return {
    successCount,
    failureCount,
    results: allResults,
    invalidTokens,
  };
}

/**
 * Send push notification to a topic (broadcast)
 */
export async function sendToTopic(options: SendToTopicOptions): Promise<FirebaseSendResult> {
  const { topic, notification, android, apns, webpush } = options;

  const message: TopicMessage = {
    topic,
    notification: {
      title: notification.title,
      body: notification.body,
      imageUrl: notification.imageUrl,
    },
    data: notification.data,
    android: android
      ? {
          priority: android.priority,
          ttl: android.ttl ? android.ttl * 1000 : undefined,
          collapseKey: android.collapseKey,
          notification: {
            channelId: android.channelId,
            icon: notification.icon,
            sound: notification.sound || 'default',
          },
        }
      : undefined,
    apns: apns
      ? {
          payload: {
            aps: {
              badge: apns.badge,
              sound: apns.sound || 'default',
            },
          },
        }
      : undefined,
    webpush: webpush
      ? {
          notification: {
            icon: webpush.icon || notification.icon,
            badge: webpush.badge,
          },
        }
      : undefined,
  };

  try {
    const messaging = getMessaging();
    const messageId = await messaging.send(message);

    logger.info({ messageId, topic }, 'Topic push notification sent');

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    logger.error({ error, topic }, 'Failed to send topic push notification');

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Topic Subscription Management
// ============================================================================

/**
 * Subscribe tokens to a topic
 */
export async function subscribeToTopic(
  tokens: string[],
  topic: string
): Promise<{ successCount: number; failureCount: number }> {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  try {
    const messaging = getMessaging();
    const response = await messaging.subscribeToTopic(tokens, topic);

    logger.info(
      { topic, successCount: response.successCount, failureCount: response.failureCount },
      'Subscribed to topic'
    );

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    logger.error({ error, topic }, 'Failed to subscribe to topic');
    throw error;
  }
}

/**
 * Unsubscribe tokens from a topic
 */
export async function unsubscribeFromTopic(
  tokens: string[],
  topic: string
): Promise<{ successCount: number; failureCount: number }> {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  try {
    const messaging = getMessaging();
    const response = await messaging.unsubscribeFromTopic(tokens, topic);

    logger.info(
      { topic, successCount: response.successCount, failureCount: response.failureCount },
      'Unsubscribed from topic'
    );

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    logger.error({ error, topic }, 'Failed to unsubscribe from topic');
    throw error;
  }
}

// ============================================================================
// Token Validation
// ============================================================================

/**
 * Validate FCM tokens by sending a dry-run message
 */
export async function validateTokens(
  tokens: string[]
): Promise<{ valid: string[]; invalid: string[] }> {
  const valid: string[] = [];
  const invalid: string[] = [];

  // Firebase doesn't have a direct token validation API
  // We use sendEachForMulticast with dryRun option
  const message: MulticastMessage = {
    tokens,
    notification: {
      title: 'Token validation',
      body: 'This is a dry-run message',
    },
  };

  try {
    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast(message, true); // dryRun = true

    response.responses.forEach((res, index) => {
      if (res.success) {
        valid.push(tokens[index]);
      } else {
        invalid.push(tokens[index]);
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to validate tokens');
    // Consider all tokens invalid on error
    invalid.push(...tokens);
  }

  return { valid, invalid };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Create a deep link for notifications
 */
export function createDeepLink(path: string, params?: Record<string, string>): string {
  const config = getConfig();
  const baseUrl = config.appBaseUrl || 'https://skillancer.com';

  let url = `${baseUrl}${path}`;

  if (params && Object.keys(params).length > 0) {
    const queryString = new URLSearchParams(params).toString();
    url += `?${queryString}`;
  }

  return url;
}

// ============================================================================
// Singleton Export
// ============================================================================

export const FirebaseProvider = {
  initialize: initializeFirebase,
  isConfigured: isFirebaseConfigured,
  sendToDevice,
  sendToUser,
  sendToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
  validateTokens,
  createDeepLink,
};

export default FirebaseProvider;
