/**
 * Push Notification Service using Firebase Cloud Messaging
 */

import admin from 'firebase-admin';
import { getConfig } from '../config/index.js';
import {
  PushNotificationInput,
  PushSendResult,
  DeviceToken,
} from '../types/notification.types.js';

export class PushService {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      const config = getConfig();

      if (config.firebaseProjectId && config.firebasePrivateKey && config.firebaseClientEmail) {
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: config.firebaseProjectId,
              privateKey: config.firebasePrivateKey,
              clientEmail: config.firebaseClientEmail,
            }),
          });
        }
        this.initialized = true;
      }
    } catch {
      // Config not ready yet or Firebase not configured
    }
  }

  private ensureInitialized(): boolean {
    if (!this.initialized) {
      this.initialize();
    }
    return this.initialized;
  }

  /**
   * Send push notification to specific devices
   */
  async sendToDevices(input: PushNotificationInput): Promise<PushSendResult> {
    if (!this.ensureInitialized()) {
      return {
        success: false,
        successCount: 0,
        failureCount: input.deviceTokens?.length || 0,
        errors: [{ token: 'all', error: 'Firebase not configured' }],
      };
    }

    if (!input.deviceTokens?.length) {
      return {
        success: false,
        successCount: 0,
        failureCount: 0,
        errors: [{ token: 'none', error: 'No device tokens provided' }],
      };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: input.deviceTokens,
        notification: {
          title: input.title,
          body: input.body,
          imageUrl: input.imageUrl,
        },
        data: input.data,
        android: {
          priority: input.priority === 'URGENT' ? 'high' : 'normal',
          notification: {
            icon: input.icon || 'ic_notification',
            clickAction: input.clickAction,
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: input.title,
                body: input.body,
              },
              sound: input.priority === 'URGENT' ? 'default' : undefined,
              badge: 1,
            },
          },
        },
        webpush: {
          notification: {
            title: input.title,
            body: input.body,
            icon: input.icon,
            image: input.imageUrl,
          },
          fcmOptions: {
            link: input.clickAction,
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      const errors: Array<{ token: string; error: string }> = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          errors.push({
            token: input.deviceTokens![idx],
            error: resp.error.message,
          });
        }
      });

      return {
        success: response.failureCount === 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        messageIds: response.responses
          .filter((r) => r.success)
          .map((r) => r.messageId!),
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      console.error('Firebase push error:', error.message);
      return {
        success: false,
        successCount: 0,
        failureCount: input.deviceTokens.length,
        errors: [{ token: 'all', error: error.message }],
      };
    }
  }

  /**
   * Send push notification to a topic
   */
  async sendToTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<PushSendResult> {
    if (!this.ensureInitialized()) {
      return {
        success: false,
        successCount: 0,
        failureCount: 1,
        errors: [{ token: topic, error: 'Firebase not configured' }],
      };
    }

    try {
      const message: admin.messaging.Message = {
        topic,
        notification: {
          title,
          body,
        },
        data,
      };

      const messageId = await admin.messaging().send(message);

      return {
        success: true,
        successCount: 1,
        failureCount: 0,
        messageIds: [messageId],
      };
    } catch (error: any) {
      console.error('Firebase topic push error:', error.message);
      return {
        success: false,
        successCount: 0,
        failureCount: 1,
        errors: [{ token: topic, error: error.message }],
      };
    }
  }

  /**
   * Send push notification based on condition
   */
  async sendToCondition(
    condition: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<PushSendResult> {
    if (!this.ensureInitialized()) {
      return {
        success: false,
        successCount: 0,
        failureCount: 1,
        errors: [{ token: condition, error: 'Firebase not configured' }],
      };
    }

    try {
      const message: admin.messaging.Message = {
        condition,
        notification: {
          title,
          body,
        },
        data,
      };

      const messageId = await admin.messaging().send(message);

      return {
        success: true,
        successCount: 1,
        failureCount: 0,
        messageIds: [messageId],
      };
    } catch (error: any) {
      console.error('Firebase condition push error:', error.message);
      return {
        success: false,
        successCount: 0,
        failureCount: 1,
        errors: [{ token: condition, error: error.message }],
      };
    }
  }

  /**
   * Subscribe device to a topic
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<boolean> {
    if (!this.ensureInitialized()) {
      return false;
    }

    try {
      const response = await admin.messaging().subscribeToTopic(tokens, topic);
      return response.failureCount === 0;
    } catch (error: any) {
      console.error('Topic subscription error:', error.message);
      return false;
    }
  }

  /**
   * Unsubscribe device from a topic
   */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<boolean> {
    if (!this.ensureInitialized()) {
      return false;
    }

    try {
      const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
      return response.failureCount === 0;
    } catch (error: any) {
      console.error('Topic unsubscription error:', error.message);
      return false;
    }
  }

  /**
   * Validate a device token
   */
  async validateToken(token: string): Promise<boolean> {
    if (!this.ensureInitialized()) {
      return false;
    }

    try {
      // Try to send a dry run message
      await admin.messaging().send(
        {
          token,
          notification: {
            title: 'Test',
            body: 'Test',
          },
        },
        true // dry run
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get service status
   */
  isConfigured(): boolean {
    return this.initialized;
  }
}
