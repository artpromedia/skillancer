/**
 * Unit Tests for Notification Service Schemas
 */

import { describe, it, expect } from 'vitest';
import {
  SendEmailSchema,
  SendPushSchema,
  SendTemplatedEmailSchema,
  SendMultiChannelSchema,
  RegisterDeviceSchema,
  UpdatePreferencesSchema,
  GetHistoryQuerySchema,
} from '../schemas/notification.schemas.js';

describe('Notification Schemas', () => {
  describe('SendEmailSchema', () => {
    it('should validate a valid email input', () => {
      const input = {
        emailType: 'WELCOME',
        to: 'test@example.com',
        subject: 'Welcome to Skillancer',
        htmlContent: '<h1>Welcome!</h1>',
      };

      const result = SendEmailSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email address', () => {
      const input = {
        emailType: 'WELCOME',
        to: 'invalid-email',
        subject: 'Test',
      };

      const result = SendEmailSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty subject', () => {
      const input = {
        emailType: 'WELCOME',
        to: 'test@example.com',
        subject: '',
      };

      const result = SendEmailSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email type', () => {
      const input = {
        emailType: 'INVALID_TYPE',
        to: 'test@example.com',
        subject: 'Test',
      };

      const result = SendEmailSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should validate attachments correctly', () => {
      const input = {
        emailType: 'CONTRACT_INVITATION',
        to: 'test@example.com',
        subject: 'Contract',
        attachments: [
          {
            filename: 'contract.pdf',
            content: 'base64encodedcontent',
            contentType: 'application/pdf',
          },
        ],
      };

      const result = SendEmailSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject too many attachments', () => {
      const input = {
        emailType: 'WELCOME',
        to: 'test@example.com',
        subject: 'Test',
        attachments: Array(11).fill({
          filename: 'file.pdf',
          content: 'content',
          contentType: 'application/pdf',
        }),
      };

      const result = SendEmailSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('SendPushSchema', () => {
    it('should validate a valid push notification', () => {
      const input = {
        pushType: 'NEW_MESSAGE',
        title: 'New Message',
        body: 'You have a new message from John',
      };

      const result = SendPushSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const input = {
        pushType: 'NEW_MESSAGE',
        title: '',
        body: 'Message body',
      };

      const result = SendPushSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should validate with device tokens', () => {
      const input = {
        pushType: 'PAYMENT_UPDATE',
        title: 'Payment Received',
        body: 'You received $500',
        deviceTokens: ['token1', 'token2'],
      };

      const result = SendPushSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate with topic', () => {
      const input = {
        pushType: 'SYSTEM_ALERT',
        title: 'Maintenance',
        body: 'Scheduled maintenance tonight',
        topic: 'all-users',
      };

      const result = SendPushSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('SendTemplatedEmailSchema', () => {
    it('should validate a valid templated email', () => {
      const input = {
        to: 'test@example.com',
        emailType: 'PASSWORD_RESET',
        templateData: {
          userName: 'John',
          resetLink: 'https://example.com/reset?token=abc',
        },
      };

      const result = SendTemplatedEmailSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow optional subject', () => {
      const input = {
        to: 'test@example.com',
        emailType: 'EMAIL_VERIFICATION',
        templateData: { code: '123456' },
        subject: 'Custom Subject',
      };

      const result = SendTemplatedEmailSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subject).toBe('Custom Subject');
      }
    });
  });

  describe('SendMultiChannelSchema', () => {
    it('should validate multi-channel with email', () => {
      const input = {
        channels: ['EMAIL'],
        email: {
          emailType: 'WELCOME',
          to: 'test@example.com',
          subject: 'Welcome',
        },
      };

      const result = SendMultiChannelSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate multi-channel with both email and push', () => {
      const input = {
        channels: ['EMAIL', 'PUSH'],
        email: {
          emailType: 'PAYMENT_RECEIVED',
          to: 'test@example.com',
          subject: 'Payment',
        },
        push: {
          pushType: 'PAYMENT_UPDATE',
          title: 'Payment',
          body: 'You received a payment',
        },
      };

      const result = SendMultiChannelSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject if channel specified but content missing', () => {
      const input = {
        channels: ['EMAIL', 'PUSH'],
        email: {
          emailType: 'WELCOME',
          to: 'test@example.com',
          subject: 'Welcome',
        },
        // push is missing but PUSH channel specified
      };

      const result = SendMultiChannelSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('RegisterDeviceSchema', () => {
    it('should validate a valid device registration', () => {
      const input = {
        token: 'firebase-fcm-token-here-at-least-10-chars',
        platform: 'IOS',
        deviceId: 'device-123',
      };

      const result = RegisterDeviceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject short token', () => {
      const input = {
        token: 'short',
        platform: 'ANDROID',
        deviceId: 'device-123',
      };

      const result = RegisterDeviceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid platform', () => {
      const input = {
        token: 'valid-token-here-long-enough',
        platform: 'WINDOWS',
        deviceId: 'device-123',
      };

      const result = RegisterDeviceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('UpdatePreferencesSchema', () => {
    it('should validate partial email preferences', () => {
      const input = {
        email: {
          enabled: true,
          marketing: false,
        },
      };

      const result = UpdatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate quiet hours', () => {
      const input = {
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'America/New_York',
        },
      };

      const result = UpdatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid time format', () => {
      const input = {
        quietHours: {
          enabled: true,
          startTime: '25:00', // Invalid hour
          endTime: '08:00',
          timezone: 'UTC',
        },
      };

      const result = UpdatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('GetHistoryQuerySchema', () => {
    it('should use default values', () => {
      const input = {};

      const result = GetHistoryQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should validate channel filter', () => {
      const input = {
        channel: 'EMAIL',
        limit: 20,
      };

      const result = GetHistoryQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject limit over 100', () => {
      const input = {
        limit: 150,
      };

      const result = GetHistoryQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
