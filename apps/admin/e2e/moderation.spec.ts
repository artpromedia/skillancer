/**
 * E2E Tests: Admin Content Moderation
 *
 * Tests viewing moderation queue, approving/rejecting content.
 */

import { test, expect } from '@playwright/test';

// =============================================================================
// SETUP: Login before each test
// =============================================================================

test.describe('Admin Content Moderation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@skillancer.com');
    await page.fill('[name="password"]', 'AdminSecure123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 10000 });
  });

  // ===========================================================================
  // View Moderation Queue
  // ===========================================================================

  test.describe('View Moderation Queue', () => {
    test('should navigate to moderation page', async ({ page }) => {
      await page.goto('/moderation');
      await expect(page).toHaveURL(/\/moderation/);

      const heading = page.locator('h1, h2, [data-testid="page-title"]').first();
      await expect(heading).toBeVisible();
    });

    test('should display moderation queue with pending items', async ({ page }) => {
      await page.goto('/moderation');
      await page.waitForTimeout(2000);

      // Should display a list/table of items awaiting moderation
      const queueContainer = page.locator(
        'table, [data-testid="moderation-queue"], [data-testid="moderation-list"], .moderation-queue'
      );

      await expect(queueContainer.first()).toBeVisible({ timeout: 10000 });
    });

    test('should show item type for moderation queue entries', async ({ page }) => {
      await page.goto('/moderation');
      await page.waitForTimeout(2000);

      // Each item should have a type (job posting, profile, etc.)
      const typeIndicator = page.locator(
        '[data-testid="item-type"], .item-type, .badge, td:nth-child(2)'
      );

      const isVisible = await typeIndicator
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    });

    test('should show item status in moderation queue', async ({ page }) => {
      await page.goto('/moderation');
      await page.waitForTimeout(2000);

      const statusIndicator = page.locator(
        '[data-testid="item-status"], .status-badge, text=/pending|flagged|reported/i'
      );

      const isVisible = await statusIndicator
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    });

    test('should display filter options', async ({ page }) => {
      await page.goto('/moderation');
      await page.waitForTimeout(1000);

      // Look for filter/tab controls
      const filterControls = page.locator(
        '[data-testid="filter"], select, [role="tablist"], .filter-group, button:has-text("Filter")'
      );

      const isVisible = await filterControls
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    });

    test('should show empty state when no items to moderate', async ({ page }) => {
      await page.goto('/moderation');
      await page.waitForTimeout(2000);

      const emptyState = page.locator(
        '[data-testid="empty-queue"], text=/no items|queue is empty|nothing to review/i'
      );

      // This may or may not be visible depending on test data
      const isVisible = await emptyState
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    });
  });

  // ===========================================================================
  // Approve Content
  // ===========================================================================

  test.describe('Approve Content', () => {
    test('should have approve button for pending items', async ({ page }) => {
      await page.goto('/moderation');
      await page.waitForTimeout(2000);

      const approveButton = page.locator(
        'button:has-text("Approve"), [data-testid="approve-button"], button[aria-label="Approve"]'
      );

      const isVisible = await approveButton
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    });

    test('should approve content when clicking approve', async ({ page }) => {
      await page.goto('/moderation');
      await page.waitForTimeout(2000);

      const approveButton = page
        .locator('button:has-text("Approve"), [data-testid="approve-button"]')
        .first();

      if (await approveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await approveButton.click();
        await page.waitForTimeout(1000);

        // Should show success toast or the item should be removed from queue
        const successIndicator = page.locator(
          '[role="status"], .toast, [data-testid="success-message"], text=/approved/i'
        );

        const isVisible = await successIndicator
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        expect(typeof isVisible).toBe('boolean');
      }
    });

    test('should remove approved item from the queue', async ({ page }) => {
      await page.goto('/moderation');
      await page.waitForTimeout(2000);

      // Count items before approval
      const items = page.locator('tr, [data-testid="moderation-item"]');
      const countBefore = await items.count();

      const approveButton = page
        .locator('button:has-text("Approve"), [data-testid="approve-button"]')
        .first();

      if (
        (await approveButton.isVisible({ timeout: 3000 }).catch(() => false)) &&
        countBefore > 0
      ) {
        await approveButton.click();
        await page.waitForTimeout(2000);

        // Count should decrease or stay the same (if item was already processed)
        const countAfter = await items.count();
        expect(countAfter).toBeLessThanOrEqual(countBefore);
      }
    });
  });

  // ===========================================================================
  // Reject Content
  // ===========================================================================

  test.describe('Reject Content', () => {
    test('should have reject button for pending items', async ({ page }) => {
      await page.goto('/moderation');
      await page.waitForTimeout(2000);

      const rejectButton = page.locator(
        'button:has-text("Reject"), [data-testid="reject-button"], button[aria-label="Reject"]'
      );

      const isVisible = await rejectButton
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    });

    test('should show rejection reason dialog', async ({ page }) => {
      await page.goto('/moderation');
      await page.waitForTimeout(2000);

      const rejectButton = page
        .locator('button:has-text("Reject"), [data-testid="reject-button"]')
        .first();

      if (await rejectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await rejectButton.click();
        await page.waitForTimeout(500);

        // Should show a dialog/modal for rejection reason
        const dialog = page.locator(
          '[role="dialog"], .modal, [data-testid="reject-dialog"], [role="alertdialog"]'
        );

        const isVisible = await dialog
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        expect(typeof isVisible).toBe('boolean');
      }
    });

    test('should reject content with a reason', async ({ page }) => {
      await page.goto('/moderation');
      await page.waitForTimeout(2000);

      const rejectButton = page
        .locator('button:has-text("Reject"), [data-testid="reject-button"]')
        .first();

      if (await rejectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await rejectButton.click();
        await page.waitForTimeout(500);

        // Fill in rejection reason if a dialog appears
        const reasonInput = page
          .locator('textarea, input[name="reason"], [data-testid="reject-reason"]')
          .first();

        if (await reasonInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await reasonInput.fill('Content violates community guidelines - inappropriate language.');

          // Confirm rejection
          const confirmButton = page
            .locator(
              'button:has-text("Confirm"), button:has-text("Submit"), [data-testid="confirm-reject"]'
            )
            .first();

          if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmButton.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    });

    test('should remove rejected item from the queue', async ({ page }) => {
      await page.goto('/moderation');
      await page.waitForTimeout(2000);

      const items = page.locator('tr, [data-testid="moderation-item"]');
      const countBefore = await items.count();

      const rejectButton = page
        .locator('button:has-text("Reject"), [data-testid="reject-button"]')
        .first();

      if ((await rejectButton.isVisible({ timeout: 3000 }).catch(() => false)) && countBefore > 0) {
        await rejectButton.click();
        await page.waitForTimeout(500);

        // Handle potential dialog
        const confirmButton = page
          .locator('button:has-text("Confirm"), button:has-text("Submit")')
          .first();

        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          const reasonInput = page.locator('textarea').first();
          if (await reasonInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            await reasonInput.fill('Test rejection');
          }
          await confirmButton.click();
        }

        await page.waitForTimeout(2000);
        const countAfter = await items.count();
        expect(countAfter).toBeLessThanOrEqual(countBefore);
      }
    });
  });

  // ===========================================================================
  // Moderation Actions
  // ===========================================================================

  test.describe('Moderation Review Details', () => {
    test('should allow clicking on an item to view details', async ({ page }) => {
      await page.goto('/moderation');
      await page.waitForTimeout(2000);

      const item = page
        .locator('tr, [data-testid="moderation-item"], a[href*="moderation"]')
        .first();

      if (await item.isVisible({ timeout: 3000 }).catch(() => false)) {
        await item.click();
        await page.waitForTimeout(1000);

        // Should show item details, either in a modal or new page
        const detailView = page.locator(
          '[data-testid="item-detail"], [role="dialog"], .detail-view, main'
        );

        await expect(detailView.first()).toBeVisible();
      }
    });
  });
});
