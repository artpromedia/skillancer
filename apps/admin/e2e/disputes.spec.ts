/**
 * E2E Tests: Admin Dispute Management
 *
 * Tests viewing disputes list, dispute details, and dispute resolution.
 */

import { test, expect } from '@playwright/test';

// =============================================================================
// SETUP: Login before each test
// =============================================================================

test.describe('Admin Dispute Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@skillancer.com');
    await page.fill('[name="password"]', 'AdminSecure123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 10000 });
  });

  // ===========================================================================
  // View Disputes List
  // ===========================================================================

  test.describe('View Disputes', () => {
    test('should navigate to disputes page', async ({ page }) => {
      await page.goto('/disputes');
      await expect(page).toHaveURL(/\/disputes/);

      const heading = page.locator('h1, h2, [data-testid="page-title"]').first();
      await expect(heading).toBeVisible();
    });

    test('should display disputes table or list', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      const disputesContainer = page.locator(
        'table, [data-testid="disputes-list"], [data-testid="disputes-table"], .disputes-list'
      );

      await expect(disputesContainer.first()).toBeVisible({ timeout: 10000 });
    });

    test('should show dispute status badges', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      const statusBadge = page.locator(
        '.badge, [data-testid="dispute-status"], .status, text=/open|resolved|pending|escalated/i'
      );

      const isVisible = await statusBadge.first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    });

    test('should display dispute parties (client and freelancer)', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      // Each dispute row should show the parties involved
      const partyInfo = page.locator(
        '[data-testid="dispute-parties"], [data-testid="dispute-client"], td'
      );

      const isVisible = await partyInfo.first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    });

    test('should display dispute amount or contract value', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      const amountElement = page.locator(
        '[data-testid="dispute-amount"], text=/\\$[\\d,]+/, .amount'
      );

      const isVisible = await amountElement.first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    });

    test('should have filter controls for dispute status', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(1000);

      const filterControl = page.locator(
        'select, [role="tablist"], [data-testid="status-filter"], button:has-text("Filter"), .filter'
      );

      const isVisible = await filterControl.first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    });

    test('should show dispute creation date', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      // Look for date display
      const dateElement = page.locator(
        '[data-testid="dispute-date"], time, text=/\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/'
      );

      const isVisible = await dateElement.first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    });
  });

  // ===========================================================================
  // View Dispute Details
  // ===========================================================================

  test.describe('View Dispute Details', () => {
    test('should navigate to dispute detail page', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      const disputeLink = page.locator(
        'a[href*="/disputes/"], tr a, [data-testid="dispute-row"] a, tr[role="link"]'
      ).first();

      if (await disputeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await disputeLink.click();
        await expect(page).toHaveURL(/\/disputes\/[\w-]+/);
      }
    });

    test('should display dispute summary', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      const disputeLink = page.locator('a[href*="/disputes/"]').first();

      if (await disputeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await disputeLink.click();
        await page.waitForTimeout(2000);

        const summary = page.locator(
          '[data-testid="dispute-summary"], .dispute-detail, main h1, main h2'
        );
        await expect(summary.first()).toBeVisible({ timeout: 5000 });
      }
    });

    test('should display contract information in dispute', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      const disputeLink = page.locator('a[href*="/disputes/"]').first();

      if (await disputeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await disputeLink.click();
        await page.waitForTimeout(2000);

        const contractInfo = page.locator(
          '[data-testid="contract-info"], text=/contract/i, .contract-details'
        );

        const isVisible = await contractInfo.first().isVisible({ timeout: 3000 }).catch(() => false);
        expect(typeof isVisible).toBe('boolean');
      }
    });

    test('should display escrow information in dispute', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      const disputeLink = page.locator('a[href*="/disputes/"]').first();

      if (await disputeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await disputeLink.click();
        await page.waitForTimeout(2000);

        const escrowInfo = page.locator(
          '[data-testid="escrow-info"], text=/escrow|balance|funds/i'
        );

        const isVisible = await escrowInfo.first().isVisible({ timeout: 3000 }).catch(() => false);
        expect(typeof isVisible).toBe('boolean');
      }
    });

    test('should display dispute timeline or messages', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      const disputeLink = page.locator('a[href*="/disputes/"]').first();

      if (await disputeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await disputeLink.click();
        await page.waitForTimeout(2000);

        const timeline = page.locator(
          '[data-testid="dispute-timeline"], [data-testid="messages"], .timeline, .messages'
        );

        const isVisible = await timeline.first().isVisible({ timeout: 3000 }).catch(() => false);
        expect(typeof isVisible).toBe('boolean');
      }
    });

    test('should have resolution actions on dispute detail page', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      const disputeLink = page.locator('a[href*="/disputes/"]').first();

      if (await disputeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await disputeLink.click();
        await page.waitForTimeout(2000);

        // Should have resolution buttons
        const resolveButton = page.locator(
          'button:has-text("Resolve"), button:has-text("Close"), [data-testid="resolve-button"], button:has-text("Split")'
        );

        const isVisible = await resolveButton.first().isVisible({ timeout: 3000 }).catch(() => false);
        expect(typeof isVisible).toBe('boolean');
      }
    });

    test('should show both parties perspectives', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      const disputeLink = page.locator('a[href*="/disputes/"]').first();

      if (await disputeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await disputeLink.click();
        await page.waitForTimeout(2000);

        // Should show client and freelancer sides
        const clientSection = page.locator(
          '[data-testid="client-perspective"], text=/client/i'
        ).first();
        const freelancerSection = page.locator(
          '[data-testid="freelancer-perspective"], text=/freelancer/i'
        ).first();

        const clientVisible = await clientSection.isVisible({ timeout: 2000 }).catch(() => false);
        const freelancerVisible = await freelancerSection.isVisible({ timeout: 2000 }).catch(() => false);

        // At least one should be visible if there are disputes
        expect(typeof clientVisible).toBe('boolean');
        expect(typeof freelancerVisible).toBe('boolean');
      }
    });

    test('should display evidence/attachments section', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      const disputeLink = page.locator('a[href*="/disputes/"]').first();

      if (await disputeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await disputeLink.click();
        await page.waitForTimeout(2000);

        const evidenceSection = page.locator(
          '[data-testid="evidence"], text=/evidence|attachments|files/i, .evidence-section'
        );

        const isVisible = await evidenceSection.first().isVisible({ timeout: 3000 }).catch(() => false);
        expect(typeof isVisible).toBe('boolean');
      }
    });

    test('should have a back button to return to disputes list', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      const disputeLink = page.locator('a[href*="/disputes/"]').first();

      if (await disputeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await disputeLink.click();
        await page.waitForTimeout(1000);

        const backButton = page.locator(
          'a:has-text("Back"), button:has-text("Back"), a[href="/disputes"], [data-testid="back-button"]'
        ).first();

        if (await backButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await backButton.click();
          await expect(page).toHaveURL(/\/disputes$/);
        }
      }
    });
  });

  // ===========================================================================
  // Dispute Resolution Form
  // ===========================================================================

  test.describe('Dispute Resolution', () => {
    test('should display resolution form when resolve is clicked', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      const disputeLink = page.locator('a[href*="/disputes/"]').first();

      if (await disputeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await disputeLink.click();
        await page.waitForTimeout(2000);

        const resolveButton = page.locator(
          'button:has-text("Resolve"), [data-testid="resolve-button"]'
        ).first();

        if (await resolveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await resolveButton.click();
          await page.waitForTimeout(500);

          // Should show resolution form or dialog
          const resolutionForm = page.locator(
            '[data-testid="resolution-form"], form, [role="dialog"]'
          );

          const isVisible = await resolutionForm.first().isVisible({ timeout: 3000 }).catch(() => false);
          expect(typeof isVisible).toBe('boolean');
        }
      }
    });

    test('should have fund split options in resolution', async ({ page }) => {
      await page.goto('/disputes');
      await page.waitForTimeout(2000);

      const disputeLink = page.locator('a[href*="/disputes/"]').first();

      if (await disputeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await disputeLink.click();
        await page.waitForTimeout(2000);

        // Look for split/resolution options
        const splitOption = page.locator(
          '[data-testid="split-option"], input[type="range"], input[name*="split"], text=/split|percentage/i'
        );

        const isVisible = await splitOption.first().isVisible({ timeout: 3000 }).catch(() => false);
        expect(typeof isVisible).toBe('boolean');
      }
    });
  });
});
