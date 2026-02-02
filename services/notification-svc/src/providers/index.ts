/**
 * Notification Providers
 */

// Email provider (main email provider)
export {
  EmailProvider,
  type EmailConfig,
  type EmailMessage,
  type EmailAttachment,
  type EmailResult,
  type EmailDeliveryStatus,
} from './email.js';

export * from './push.js';
export * from './sms.js';

// Firebase Cloud Messaging provider
export {
  FirebaseProvider,
  initializeFirebase,
  isFirebaseConfigured,
  sendToDevice,
  sendToUser,
  sendToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
  validateTokens,
  createDeepLink,
  type FirebaseConfig,
  type PushNotificationPayload,
  type SendToDeviceOptions,
  type SendToUserOptions,
  type SendToTopicOptions,
  type AndroidConfig,
  type ApnsConfig,
  type WebPushConfig,
  type FirebaseSendResult,
  type BatchSendResult,
} from './firebase.js';

// SendGrid provider (re-export with unique names to avoid conflicts)
export {
  SendGridProvider,
  getSendGridProvider,
  type SendGridConfig,
  type EmailRecipient,
  type SendGridAttachment,
  type SendEmailOptions,
  type SendEmailResult,
  type BulkEmailResult,
  SENDGRID_ERROR_CODES,
} from './sendgrid.js';
