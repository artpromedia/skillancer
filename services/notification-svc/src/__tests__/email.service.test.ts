/**
 * Unit Tests for Email Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from '../services/email.service.js';

// Mock SendGrid
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn(),
  },
}));

// Mock config
vi.mock('../config/index.js', () => ({
  getConfig: vi.fn(() => ({
    sendgridApiKey: 'SG.test-api-key',
    sendgridFromEmail: 'test@skillancer.com',
    sendgridFromName: 'Skillancer Test',
  })),
  EMAIL_TEMPLATES: {
    WELCOME: 'd-welcome-template',
    EMAIL_VERIFICATION: 'd-verification-template',
    PASSWORD_RESET: 'd-password-reset-template',
  },
}));

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    emailService = new EmailService();
  });

  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(emailService.isValidEmail('test@example.com')).toBe(true);
      expect(emailService.isValidEmail('user.name@domain.org')).toBe(true);
      expect(emailService.isValidEmail('user+tag@example.co.uk')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(emailService.isValidEmail('invalid')).toBe(false);
      expect(emailService.isValidEmail('invalid@')).toBe(false);
      expect(emailService.isValidEmail('@domain.com')).toBe(false);
      expect(emailService.isValidEmail('user@.com')).toBe(false);
    });
  });

  describe('sendEmail', () => {
    it('should call SendGrid with correct parameters', async () => {
      const sgMail = await import('@sendgrid/mail');
      (sgMail.default.send as any).mockResolvedValueOnce([
        { statusCode: 202, headers: { 'x-message-id': 'msg-123' } },
      ]);

      const result = await emailService.sendEmail({
        userId: 'user-123',
        channels: ['EMAIL'],
        emailType: 'WELCOME',
        to: 'recipient@example.com',
        subject: 'Welcome!',
        htmlContent: '<h1>Welcome</h1>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(sgMail.default.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: 'Welcome!',
          html: '<h1>Welcome</h1>',
        })
      );
    });

    it('should handle SendGrid errors', async () => {
      const sgMail = await import('@sendgrid/mail');
      (sgMail.default.send as any).mockRejectedValueOnce({
        response: {
          body: {
            errors: [{ message: 'Invalid API key' }],
          },
        },
      });

      const result = await emailService.sendEmail({
        userId: 'user-123',
        channels: ['EMAIL'],
        emailType: 'WELCOME',
        to: 'recipient@example.com',
        subject: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });
  });

  describe('sendTemplatedEmail', () => {
    it('should use template ID when available', async () => {
      const sgMail = await import('@sendgrid/mail');
      (sgMail.default.send as any).mockResolvedValueOnce([
        { statusCode: 202, headers: { 'x-message-id': 'msg-456' } },
      ]);

      const result = await emailService.sendTemplatedEmail(
        'test@example.com',
        'WELCOME',
        { userName: 'John', actionUrl: 'https://example.com' }
      );

      expect(result.success).toBe(true);
      expect(sgMail.default.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          templateId: 'd-welcome-template',
          dynamicTemplateData: { userName: 'John', actionUrl: 'https://example.com' },
        })
      );
    });

    it('should use fallback content for unknown templates', async () => {
      const sgMail = await import('@sendgrid/mail');
      (sgMail.default.send as any).mockResolvedValueOnce([
        { statusCode: 202, headers: { 'x-message-id': 'msg-789' } },
      ]);

      // Use an email type that doesn't have a template configured
      const result = await emailService.sendTemplatedEmail(
        'test@example.com',
        'PROPOSAL_REJECTED' as any,
        { userName: 'John' }
      );

      expect(result.success).toBe(true);
      expect(sgMail.default.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          // Should have html content instead of templateId
          html: expect.any(String),
        })
      );
    });
  });
});
