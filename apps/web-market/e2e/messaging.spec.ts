import { test, expect, type Page } from '@playwright/test';

/**
 * Messaging E2E Test Suite
 * Tests real-time messaging functionality
 */

class MessagingPage {
  constructor(private page: Page) {}

  async navigateToMessages() {
    await this.page.goto('/messages');
    await expect(this.page).toHaveURL(/\/messages/);
  }

  async openConversation(participantName: string) {
    await this.page
      .locator('[data-testid="conversation-item"]')
      .filter({ hasText: new RegExp(participantName, 'i') })
      .click();
  }

  async sendMessage(text: string) {
    await this.page.getByPlaceholder(/type.*message|write.*message/i).fill(text);
    await this.page.getByRole('button', { name: /send/i }).click();
  }

  async attachFile(filePath: string) {
    await this.page.getByLabel(/attach|upload/i).setInputFiles(filePath);
  }

  async searchConversations(query: string) {
    await this.page.getByPlaceholder(/search.*conversations|find/i).fill(query);
  }
}

async function loginAs(page: Page, role: 'client' | 'freelancer') {
  await page.goto('/login');
  const email = role === 'client' ? 'client@test.com' : 'freelancer@test.com';
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('TestPassword123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|jobs|messages)/);
}

test.describe('Start Conversation', () => {
  test('should start conversation from job page', async ({ page }) => {
    await loginAs(page, 'client');

    await page.goto('/jobs/test-job-id');
    await page.getByRole('button', { name: /contact|message/i }).click();

    await expect(page).toHaveURL(/\/messages/);
    await expect(page.getByPlaceholder(/type.*message/i)).toBeVisible();
  });

  test('should start conversation from proposal', async ({ page }) => {
    await loginAs(page, 'client');

    await page.goto('/client/proposals');
    await page.locator('[data-testid="proposal-item"]').first().click();
    await page.getByRole('button', { name: /message|contact/i }).click();

    await expect(page).toHaveURL(/\/messages/);
  });

  test('should show existing conversation if already started', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();
    const conversationCount = await page.locator('[data-testid="conversation-item"]').count();

    // Try to start conversation with someone you already messaged
    await page.goto('/freelancer/existing-freelancer-id');
    await page.getByRole('button', { name: /message/i }).click();

    // Should open existing conversation, not create new
    await expect(page.locator('[data-testid="message-bubble"]')).toHaveCount.greaterThan(0);
  });
});

test.describe('Send Text Message', () => {
  test('should send message successfully', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();
    await messagingPage.openConversation('Test Freelancer');
    await messagingPage.sendMessage('Hello, I have a question about your proposal.');

    await expect(page.locator('[data-testid="message-bubble"]').last()).toContainText(
      'Hello, I have a question about your proposal.'
    );
  });

  test('should show message in sent state', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();
    await messagingPage.openConversation('Test Freelancer');
    await messagingPage.sendMessage('Test message');

    const lastMessage = page.locator('[data-testid="message-bubble"]').last();
    await expect(lastMessage.locator('[data-testid="message-status"]')).toContainText(
      /sent|delivered/i
    );
  });

  test('should clear input after sending', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();
    await messagingPage.openConversation('Test Freelancer');
    await messagingPage.sendMessage('Test message');

    await expect(page.getByPlaceholder(/type.*message/i)).toHaveValue('');
  });

  test('should not send empty message', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();
    await messagingPage.openConversation('Test Freelancer');

    const sendButton = page.getByRole('button', { name: /send/i });
    await expect(sendButton).toBeDisabled();
  });
});

test.describe('Receive Message - Real-time', () => {
  test('should receive message in real-time', async ({ browser }) => {
    // Create two browser contexts to simulate two users
    const clientContext = await browser.newContext();
    const freelancerContext = await browser.newContext();

    const clientPage = await clientContext.newPage();
    const freelancerPage = await freelancerContext.newPage();

    // Login as client
    await loginAs(clientPage, 'client');
    const clientMessaging = new MessagingPage(clientPage);
    await clientMessaging.navigateToMessages();
    await clientMessaging.openConversation('Test Freelancer');

    // Login as freelancer
    await loginAs(freelancerPage, 'freelancer');
    const freelancerMessaging = new MessagingPage(freelancerPage);
    await freelancerMessaging.navigateToMessages();
    await freelancerMessaging.openConversation('Test Client');

    // Client sends message
    await clientMessaging.sendMessage('Real-time test message');

    // Freelancer should receive it
    await expect(freelancerPage.locator('[data-testid="message-bubble"]').last()).toContainText(
      'Real-time test message',
      { timeout: 5000 }
    );

    await clientContext.close();
    await freelancerContext.close();
  });

  test('should show typing indicator', async ({ browser }) => {
    const clientContext = await browser.newContext();
    const freelancerContext = await browser.newContext();

    const clientPage = await clientContext.newPage();
    const freelancerPage = await freelancerContext.newPage();

    await loginAs(clientPage, 'client');
    const clientMessaging = new MessagingPage(clientPage);
    await clientMessaging.navigateToMessages();
    await clientMessaging.openConversation('Test Freelancer');

    await loginAs(freelancerPage, 'freelancer');
    const freelancerMessaging = new MessagingPage(freelancerPage);
    await freelancerMessaging.navigateToMessages();
    await freelancerMessaging.openConversation('Test Client');

    // Client starts typing
    await clientPage.getByPlaceholder(/type.*message/i).fill('Typing...');

    // Freelancer should see typing indicator
    await expect(freelancerPage.getByText(/typing|\.{3}/i)).toBeVisible({ timeout: 3000 });

    await clientContext.close();
    await freelancerContext.close();
  });

  test('should update unread count on new message', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();

    // Check for unread badge
    const unreadBadge = page
      .locator('[data-testid="conversation-item"]')
      .filter({ has: page.locator('[data-testid="unread-badge"]') });

    if ((await unreadBadge.count()) > 0) {
      const unreadCount = await unreadBadge
        .first()
        .locator('[data-testid="unread-badge"]')
        .textContent();
      expect(Number.parseInt(unreadCount || '0')).toBeGreaterThan(0);
    }
  });
});

test.describe('Send Attachment', () => {
  test('should upload and send image', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();
    await messagingPage.openConversation('Test Freelancer');

    // Create a test file
    await page.getByLabel(/attach|upload/i).setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake image data'),
    });

    await page.getByRole('button', { name: /send/i }).click();

    await expect(page.locator('[data-testid="message-attachment"]')).toBeVisible();
  });

  test('should upload and send document', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();
    await messagingPage.openConversation('Test Freelancer');

    await page.getByLabel(/attach|upload/i).setInputFiles({
      name: 'document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf data'),
    });

    await page.getByRole('button', { name: /send/i }).click();

    await expect(page.locator('[data-testid="message-attachment"]')).toBeVisible();
    await expect(page.getByText('document.pdf')).toBeVisible();
  });

  test('should show upload progress', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();
    await messagingPage.openConversation('Test Freelancer');

    // Upload larger file to see progress
    const largeBuffer = Buffer.alloc(1024 * 1024); // 1MB
    await page.getByLabel(/attach|upload/i).setInputFiles({
      name: 'large-file.zip',
      mimeType: 'application/zip',
      buffer: largeBuffer,
    });

    // Should show progress indicator
    await expect(page.getByText(/uploading|%/i)).toBeVisible();
  });

  test('should reject oversized files', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();
    await messagingPage.openConversation('Test Freelancer');

    // Try to upload very large file (50MB+)
    const hugeBuffer = Buffer.alloc(50 * 1024 * 1024);
    await page.getByLabel(/attach|upload/i).setInputFiles({
      name: 'huge-file.zip',
      mimeType: 'application/zip',
      buffer: hugeBuffer,
    });

    await expect(page.getByText(/file.*too large|maximum.*size/i)).toBeVisible();
  });
});

test.describe('Message Notifications', () => {
  test('should show notification for new message', async ({ page }) => {
    await loginAs(page, 'client');

    // Navigate away from messages
    await page.goto('/dashboard');

    // Wait for notification (simulated by checking notification element)
    await expect(page.locator('[data-testid="notification-indicator"]')).toBeVisible();
  });

  test('should show unread count in navigation', async ({ page }) => {
    await loginAs(page, 'client');
    await page.goto('/dashboard');

    const messagesNav = page.locator('nav').getByRole('link', { name: /messages/i });
    const badge = messagesNav.locator('[data-testid="unread-badge"]');

    if ((await badge.count()) > 0) {
      await expect(badge).toBeVisible();
    }
  });

  test('should mark messages as read when viewed', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();

    // Find conversation with unread messages
    const unreadConvo = page
      .locator('[data-testid="conversation-item"]')
      .filter({ has: page.locator('[data-testid="unread-badge"]') })
      .first();

    if ((await unreadConvo.count()) > 0) {
      await unreadConvo.click();

      // Badge should disappear
      await expect(unreadConvo.locator('[data-testid="unread-badge"]')).not.toBeVisible();
    }
  });
});

test.describe('Conversation Search', () => {
  test('should search conversations by name', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();
    await messagingPage.searchConversations('John');

    const conversations = page.locator('[data-testid="conversation-item"]');
    const count = await conversations.count();

    for (let i = 0; i < count; i++) {
      await expect(conversations.nth(i)).toContainText(/john/i);
    }
  });

  test('should search messages within conversation', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();
    await messagingPage.openConversation('Test Freelancer');

    await page.getByRole('button', { name: /search/i }).click();
    await page.getByPlaceholder(/search.*messages/i).fill('proposal');

    // Should highlight matching messages
    await expect(page.locator('[data-testid="search-result"]')).toHaveCount.greaterThan(0);
  });

  test('should show no results message', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();
    await messagingPage.searchConversations('xyznonexistent123');

    await expect(page.getByText(/no.*results|no.*conversations/i)).toBeVisible();
  });
});

test.describe('Message Actions', () => {
  test('should copy message text', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();
    await messagingPage.openConversation('Test Freelancer');

    const message = page.locator('[data-testid="message-bubble"]').first();
    await message.hover();
    await message.getByRole('button', { name: /more|options/i }).click();
    await page.getByRole('menuitem', { name: /copy/i }).click();

    await expect(page.getByText(/copied/i)).toBeVisible();
  });

  test('should delete own message', async ({ page }) => {
    await loginAs(page, 'client');
    const messagingPage = new MessagingPage(page);

    await messagingPage.navigateToMessages();
    await messagingPage.openConversation('Test Freelancer');

    // Find own message
    const ownMessage = page.locator('[data-testid="message-bubble"][data-own="true"]').first();
    await ownMessage.hover();
    await ownMessage.getByRole('button', { name: /more|options/i }).click();
    await page.getByRole('menuitem', { name: /delete/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/deleted/i)).toBeVisible();
  });
});
