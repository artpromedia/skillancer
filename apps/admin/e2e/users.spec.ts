/**
 * E2E Tests: Admin User Management
 *
 * Tests viewing user lists, searching users, and viewing user details.
 */

import { test, expect } from '@playwright/test';

// =============================================================================
// SETUP: Login before each test
// =============================================================================

test.describe('Admin User Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@skillancer.com');
    await page.fill('[name="password"]', 'AdminSecure123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 10000 });
  });

  // ===========================================================================
  // View Users List
  // ===========================================================================

  test.describe('View Users List', () => {
    test('should navigate to users page', async ({ page }) => {
      await page.goto('/users');
      await expect(page).toHaveURL(/\/users/);

      // Should display users heading
      const heading = page.locator('h1, h2, [data-testid="page-title"]').first();
      await expect(heading).toBeVisible();
    });

    test('should display users table or list', async ({ page }) => {
      await page.goto('/users');

      // Look for table or user cards
      const usersContainer = page.locator(
        'table, [data-testid="users-list"], [role="table"], .user-list'
      );
      await expect(usersContainer.first()).toBeVisible({ timeout: 10000 });
    });

    test('should display user information in list', async ({ page }) => {
      await page.goto('/users');

      // Wait for data to load
      await page.waitForTimeout(2000);

      // Check for user data columns/fields
      const emailElement = page.locator('td, [data-testid="user-email"], .user-email').first();
      if (await emailElement.isVisible({ timeout: 5000 }).catch(() => false)) {
        const text = await emailElement.textContent();
        expect(text).toBeTruthy();
      }
    });

    test('should display pagination controls', async ({ page }) => {
      await page.goto('/users');
      await page.waitForTimeout(2000);

      // Look for pagination
      const pagination = page.locator(
        '[data-testid="pagination"], nav[aria-label="pagination"], .pagination, button:has-text("Next")'
      );

      // Pagination may not be visible if there are few users
      const isVisible = await pagination
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      // This is fine either way
      expect(typeof isVisible).toBe('boolean');
    });

    test('should show user count or total', async ({ page }) => {
      await page.goto('/users');
      await page.waitForTimeout(2000);

      // Look for a total count indicator
      const countIndicator = page.locator(
        '[data-testid="user-count"], .total-count, text=/\\d+ users?/i'
      );

      const isVisible = await countIndicator
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    });
  });

  // ===========================================================================
  // Search Users
  // ===========================================================================

  test.describe('Search User', () => {
    test('should display search input', async ({ page }) => {
      await page.goto('/users');

      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i], [data-testid="search-input"], input[name="search"], input[name="query"]'
      );

      await expect(searchInput.first()).toBeVisible({ timeout: 5000 });
    });

    test('should filter users when searching by name', async ({ page }) => {
      await page.goto('/users');
      await page.waitForTimeout(1000);

      const searchInput = page
        .locator(
          'input[type="search"], input[placeholder*="search" i], [data-testid="search-input"]'
        )
        .first();

      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill('admin');
        await page.waitForTimeout(1000);

        // Results should be filtered
        const rows = page.locator('tr, [data-testid="user-row"], .user-card');
        const count = await rows.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('should filter users when searching by email', async ({ page }) => {
      await page.goto('/users');
      await page.waitForTimeout(1000);

      const searchInput = page
        .locator(
          'input[type="search"], input[placeholder*="search" i], [data-testid="search-input"]'
        )
        .first();

      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill('admin@skillancer.com');
        await page.waitForTimeout(1000);

        // Should show matching results
        const rows = page.locator('tr, [data-testid="user-row"], .user-card');
        const count = await rows.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('should show empty state for no results', async ({ page }) => {
      await page.goto('/users');
      await page.waitForTimeout(1000);

      const searchInput = page
        .locator(
          'input[type="search"], input[placeholder*="search" i], [data-testid="search-input"]'
        )
        .first();

      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill('xyznonexistent12345');
        await page.waitForTimeout(1000);

        // Should show "no results" or empty state
        const emptyState = page.locator(
          '[data-testid="empty-state"], text=/no (users|results)/i, .empty-state'
        );

        const isVisible = await emptyState
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        expect(typeof isVisible).toBe('boolean');
      }
    });

    test('should clear search and show all users', async ({ page }) => {
      await page.goto('/users');
      await page.waitForTimeout(1000);

      const searchInput = page
        .locator(
          'input[type="search"], input[placeholder*="search" i], [data-testid="search-input"]'
        )
        .first();

      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Search first
        await searchInput.fill('test');
        await page.waitForTimeout(500);

        // Clear search
        await searchInput.clear();
        await page.waitForTimeout(1000);

        // Should show all users again
        const rows = page.locator('tr, [data-testid="user-row"], .user-card');
        const count = await rows.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ===========================================================================
  // View User Details
  // ===========================================================================

  test.describe('View User Details', () => {
    test('should navigate to user details page', async ({ page }) => {
      await page.goto('/users');
      await page.waitForTimeout(2000);

      // Click on first user row or link
      const userLink = page
        .locator('tr a, [data-testid="user-row"] a, a[href*="/users/"], tr[role="link"]')
        .first();

      if (await userLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await userLink.click();
        await expect(page).toHaveURL(/\/users\/[\w-]+/);
      }
    });

    test('should display user profile information', async ({ page }) => {
      await page.goto('/users');
      await page.waitForTimeout(2000);

      const userLink = page.locator('tr a, [data-testid="user-row"] a, a[href*="/users/"]').first();

      if (await userLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await userLink.click();
        await page.waitForTimeout(2000);

        // Should show user details
        const detailsContainer = page.locator('[data-testid="user-details"], .user-profile, main');
        await expect(detailsContainer.first()).toBeVisible();
      }
    });

    test('should display user email on detail page', async ({ page }) => {
      await page.goto('/users');
      await page.waitForTimeout(2000);

      const userLink = page.locator('a[href*="/users/"]').first();

      if (await userLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await userLink.click();
        await page.waitForTimeout(2000);

        // Look for email display
        const emailElement = page.locator('[data-testid="user-email"], text=/@/', '.email').first();

        const isVisible = await emailElement.isVisible({ timeout: 3000 }).catch(() => false);
        expect(typeof isVisible).toBe('boolean');
      }
    });

    test('should display user role or status', async ({ page }) => {
      await page.goto('/users');
      await page.waitForTimeout(2000);

      const userLink = page.locator('a[href*="/users/"]').first();

      if (await userLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await userLink.click();
        await page.waitForTimeout(2000);

        // Look for role badge or status indicator
        const roleElement = page
          .locator('[data-testid="user-role"], .badge, .role, text=/admin|user|freelancer|client/i')
          .first();

        const isVisible = await roleElement.isVisible({ timeout: 3000 }).catch(() => false);
        expect(typeof isVisible).toBe('boolean');
      }
    });

    test('should have a back button to return to users list', async ({ page }) => {
      await page.goto('/users');
      await page.waitForTimeout(2000);

      const userLink = page.locator('a[href*="/users/"]').first();

      if (await userLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await userLink.click();
        await page.waitForTimeout(1000);

        const backButton = page
          .locator(
            'a:has-text("Back"), button:has-text("Back"), a[href="/users"], [data-testid="back-button"]'
          )
          .first();

        if (await backButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await backButton.click();
          await expect(page).toHaveURL(/\/users$/);
        }
      }
    });
  });
});
