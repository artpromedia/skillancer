/**
 * Notification Service - Push Provider
 * Multi-platform push notification delivery with Firebase integration
 */

import admin from 'firebase-admin';
import { createLogger } from '@skillancer/logger';

const logger = createLogger({ name: 'PushProvider' });

export interface PushConfig {
  firebaseProjectId?: string;
  firebasePrivateKey?: string;
  firebaseClientEmail?: string;
  fcmServiceAccount?: Record<string, unknown>;
  apnsKeyId?: string;
  apnsTeamId?: string;
  apnsKey?: string;
  webPushVapidPublic?: string;
  webPushVapidPrivate?: string;
}

export interface PushMessage {
  userId: string;
  title: string;
  body: string;
  icon?: string;
  image?: string;
  badge?: string;
  sound?: string;
  data?: Record<string, string>;
  action?: {
    url: string;
    label?: string;
  };
  priority?: 'high' | 'normal' | 'low';
  ttl?: number; // Time to live in seconds
  collapseKey?: string; // For grouping notifications
  targetPlatforms?: ('ios' | 'android' | 'web')[];
}

export interface PushSubscription {
  userId: string;
  platform: 'ios' | 'android' | 'web';
  token: string;
  deviceId: string;
  deviceName?: string;
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

export interface PushResult {
  id: string;
  userId: string;
  success: boolean;
  deliveredTo: string[];
  failedDevices: { deviceId: string; error: string }[];
  sentAt: Date;
}

// In-memory stores
const subscriptions: Map<string, PushSubscription> = new Map();
const userSubscriptions: Map<string, Set<string>> = new Map(); // userId -> subscription IDs
const pushLog: PushResult[] = [];

export class PushProvider {
  private initialized = false;
  private config: PushConfig;

  constructor(config?: PushConfig) {
    this.config = config || {
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };
    this.initialize();
  }

  private initialize(): void {
    try {
      if (
        this.config.firebaseProjectId &&
        this.config.firebasePrivateKey &&
        this.config.firebaseClientEmail
      ) {
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: this.config.firebaseProjectId,
              privateKey: this.config.firebasePrivateKey,
              clientEmail: this.config.firebaseClientEmail,
            }),
          });
        }
        this.initialized = true;
        logger.info('Firebase push provider initialized');
      } else {
        logger.warn('Firebase push provider not configured - missing credentials');
      }
    } catch (error: any) {
      logger.error({ error: error.message }, 'Firebase initialization failed');
    }
  }

  /**
   * Register a device for push notifications
   */
  async registerDevice(
    userId: string,
    platform: PushSubscription['platform'],
    token: string,
    deviceId: string,
    deviceName?: string
  ): Promise<PushSubscription> {
    const id = `push_${deviceId}`;

    // Check for existing subscription with same token
    const existing = Array.from(subscriptions.values()).find((s) => s.token === token);
    if (existing) {
      // Update existing subscription
      existing.userId = userId;
      existing.lastUsed = new Date();
      existing.isActive = true;
      subscriptions.set(existing.deviceId, existing);
      return existing;
    }

    const subscription: PushSubscription = {
      userId,
      platform,
      token,
      deviceId,
      deviceName,
      createdAt: new Date(),
      isActive: true,
    };

    subscriptions.set(id, subscription);

    // Track by user
    if (!userSubscriptions.has(userId)) {
      userSubscriptions.set(userId, new Set());
    }
    userSubscriptions.get(userId)!.add(id);

    logger.info(
      { deviceId, userId, platform },
      `Device registered for push notifications`
    );

    return subscription;
  }

  /**
   * Unregister a device
   */
  async unregisterDevice(deviceId: string): Promise<boolean> {
    const subscription = subscriptions.get(`push_${deviceId}`);
    if (!subscription) return false;

    subscription.isActive = false;
    subscriptions.set(`push_${deviceId}`, subscription);

    userSubscriptions.get(subscription.userId)?.delete(`push_${deviceId}`);

    return true;
  }

  /**
   * Send a push notification to a user
   */
  async send(message: PushMessage): Promise<PushResult> {
    const id = `pn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get user's active subscriptions
    const subIds = userSubscriptions.get(message.userId);
    if (!subIds || subIds.size === 0) {
      return {
        id,
        userId: message.userId,
        success: false,
        deliveredTo: [],
        failedDevices: [{ deviceId: 'none', error: 'No registered devices' }],
        sentAt: new Date(),
      };
    }

    const deliveredTo: string[] = [];
    const failedDevices: { deviceId: string; error: string }[] = [];

    for (const subId of subIds) {
      const sub = subscriptions.get(subId);
      if (!sub || !sub.isActive) continue;

      // Check platform filter
      if (message.targetPlatforms && !message.targetPlatforms.includes(sub.platform)) {
        continue;
      }

      try {
        await this.sendToDevice(sub, message);
        deliveredTo.push(sub.deviceId);
        sub.lastUsed = new Date();
        subscriptions.set(subId, sub);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        failedDevices.push({ deviceId: sub.deviceId, error: errorMsg });

        // Deactivate if token is invalid
        if (errorMsg.includes('invalid') || errorMsg.includes('unregistered')) {
          sub.isActive = false;
          subscriptions.set(subId, sub);
        }
      }
    }

    const result: PushResult = {
      id,
      userId: message.userId,
      success: deliveredTo.length > 0,
      deliveredTo,
      failedDevices,
      sentAt: new Date(),
    };

    pushLog.push(result);

    logger.info(
      {
        userId: message.userId,
        pushId: id,
        deliveredCount: deliveredTo.length,
        failedCount: failedDevices.length,
      },
      `Push notification sent: ${deliveredTo.length} delivered, ${failedDevices.length} failed`
    );

    return result;
  }

  /**
   * Send to multiple users
   */
  async sendBulk(message: Omit<PushMessage, 'userId'>, userIds: string[]): Promise<PushResult[]> {
    return Promise.all(userIds.map(async (userId) => this.send({ ...message, userId })));
  }

  /**
   * Send to topic (all subscribed users)
   */
  async sendToTopic(
    topic: string,
    message: Omit<PushMessage, 'userId'>
  ): Promise<{ sent: number; failed: number }> {
    // In production, use FCM topics
    // For now, simulate by sending to all users
    const allUserIds = Array.from(userSubscriptions.keys());
    const results = await this.sendBulk(message, allUserIds);

    return {
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };
  }

  /**
   * Get user's devices
   */
  async getUserDevices(userId: string): Promise<PushSubscription[]> {
    const subIds = userSubscriptions.get(userId);
    if (!subIds) return [];

    return Array.from(subIds)
      .map((id) => subscriptions.get(id))
      .filter((s): s is PushSubscription => s !== undefined);
  }

  /**
   * Get push metrics
   */
  async getMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSent: number;
    successful: number;
    failed: number;
    deliveryRate: number;
    byPlatform: Record<string, { sent: number; delivered: number }>;
    activeDevices: number;
  }> {
    const inRange = pushLog.filter((p) => p.sentAt >= startDate && p.sentAt <= endDate);

    let totalDelivered = 0;
    let totalFailed = 0;

    for (const result of inRange) {
      totalDelivered += result.deliveredTo.length;
      totalFailed += result.failedDevices.length;
    }

    const activeDevices = Array.from(subscriptions.values()).filter((s) => s.isActive).length;

    // Group by platform
    const byPlatform: Record<string, { sent: number; delivered: number }> = {};
    for (const sub of subscriptions.values()) {
      if (!byPlatform[sub.platform]) {
        byPlatform[sub.platform] = { sent: 0, delivered: 0 };
      }
      if (sub.isActive) {
        byPlatform[sub.platform].sent++;
      }
    }

    return {
      totalSent: totalDelivered + totalFailed,
      successful: totalDelivered,
      failed: totalFailed,
      deliveryRate:
        totalDelivered + totalFailed > 0
          ? (totalDelivered / (totalDelivered + totalFailed)) * 100
          : 0,
      byPlatform,
      activeDevices,
    };
  }

  // Private helpers

  private async sendToDevice(subscription: PushSubscription, message: PushMessage): Promise<void> {
    if (!this.initialized) {
      // Fallback to mock for uninitialized provider
      logger.warn('Using mock push provider - Firebase not initialized');
      await new Promise((resolve) => setTimeout(resolve, 20));
      return;
    }

    // Use Firebase for all platforms (FCM supports iOS via APNs, Android, and Web)
    const fcmMessage: admin.messaging.Message = {
      token: subscription.token,
      notification: {
        title: message.title,
        body: message.body,
        imageUrl: message.image,
      },
      data: message.data,
    };

    // Platform-specific options
    if (subscription.platform === 'android') {
      fcmMessage.android = {
        priority: message.priority === 'high' ? 'high' : 'normal',
        notification: {
          icon: message.icon || 'ic_notification',
          sound: message.sound || 'default',
          channelId: 'skillancer_notifications',
        },
        ttl: message.ttl ? message.ttl * 1000 : undefined,
        collapseKey: message.collapseKey,
      };
    } else if (subscription.platform === 'ios') {
      fcmMessage.apns = {
        payload: {
          aps: {
            alert: {
              title: message.title,
              body: message.body,
            },
            sound: message.sound || 'default',
            badge: 1,
          },
        },
        headers: {
          'apns-priority': message.priority === 'high' ? '10' : '5',
          'apns-collapse-id': message.collapseKey,
        },
      };
    } else if (subscription.platform === 'web') {
      fcmMessage.webpush = {
        notification: {
          title: message.title,
          body: message.body,
          icon: message.icon,
          image: message.image,
          badge: message.badge,
        },
        fcmOptions: {
          link: message.action?.url,
        },
      };
    }

    try {
      const messageId = await admin.messaging().send(fcmMessage);
      logger.debug(
        { messageId, token: subscription.token.slice(0, 20) + '...', platform: subscription.platform },
        'Push notification sent via FCM'
      );
    } catch (error: any) {
      logger.error(
        { error: error.message, code: error.code, platform: subscription.platform },
        'FCM push send failed'
      );
      throw error;
    }
  }

  /**
   * Check if the push provider is configured and ready
   */
  isConfigured(): boolean {
    return this.initialized;
  }

  /**
   * Validate a device token
   */
  async validateToken(token: string): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      // Use dry run to validate the token
      await admin.messaging().send(
        {
          token,
          notification: { title: 'Test', body: 'Test' },
        },
        true // dry run
      );
      return true;
    } catch {
      return false;
    }
  }
}

export const pushProvider = new PushProvider();
