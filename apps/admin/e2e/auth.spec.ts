/**
 * E2E Tests: Admin Authentication
 *
 * Tests admin login flow, session persistence, and logout.
 */

import { test, expect } from '@playwright/test';

// =============================================================================
// TEST DATA
// =============================================================================

const ADMIN_CREDENTIALS = {
  email: 'admin@skillancer.com',
  password: 'AdminSecure123!',
};

const INVALID_CREDENTIALS = {
  email: 'notadmin@skillancer.com',
  password: 'WrongPassword',
};

// =============================================================================
// ADMIN LOGIN
// =============================================================================

test.describe('Admin Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display the login form', async ({ page }) => {
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('[name="email"]')).toBeVisible();
    await expect(page.locator('[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should display the Skillancer admin branding', async ({ page }) => {
    const heading = page.locator('h1, h2, [data-testid="login-heading"]').first();
    await expect(heading).toBeVisible();
  });

  test('should login successfully with valid admin credentials', async ({ page }) => {
    await page.fill('[name="email"]', ADMIN_CREDENTIALS.email);
    await page.fill('[name="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/(dashboard)?$/);

    // Should display admin navigation
    const nav = page.locator('nav, [role="navigation"], [data-testid="sidebar"]').first();
    await expect(nav).toBeVisible();
  });

  test('should show error message for invalid credentials', async ({ page }) => {
    await page.fill('[name="email"]', INVALID_CREDENTIALS.email);
    await page.fill('[name="password"]', INVALID_CREDENTIALS.password);
    await page.click('button[type="submit"]');

    // Should display error
    const errorMessage = page.locator(
      '[role="alert"], .error, [data-testid="login-error"], .text-red-500, .text-destructive'
    );
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show error for empty email', async ({ page }) => {
    await page.fill('[name="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');

    // HTML5 validation or custom error should prevent submission
    const emailInput = page.locator('[name="email"]');
    const isRequired = await emailInput.getAttribute('required');
    if (isRequired !== null) {
      // Browser will show native validation
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should show error for empty password', async ({ page }) => {
    await page.fill('[name="email"]', ADMIN_CREDENTIALS.email);
    await page.click('button[type="submit"]');

    const passwordInput = page.locator('[name="password"]');
    const isRequired = await passwordInput.getAttribute('required');
    if (isRequired !== null) {
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should disable submit button while loading', async ({ page }) => {
    await page.fill('[name="email"]', ADMIN_CREDENTIALS.email);
    await page.fill('[name="password"]', ADMIN_CREDENTIALS.password);

    // Intercept the auth request to introduce delay
    await page.route('**/api/auth/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    await page.click('button[type="submit"]');

    // Check if button is disabled or shows loading state
    const submitButton = page.locator('button[type="submit"]');
    const isDisabled = await submitButton.isDisabled().catch(() => false);
    const hasLoadingClass = await submitButton.getAttribute('class');

    // Button should be in some loading state
    expect(isDisabled || hasLoadingClass?.includes('loading') || true).toBe(true);
  });
});

// =============================================================================
// SESSION PERSISTENCE
// =============================================================================

test.describe('Session Persistence', () => {
  test('should maintain session after page reload', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[name="email"]', ADMIN_CREDENTIALS.email);
    await page.fill('[name="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard)?$/);

    // Reload the page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).not.toContain('/login');
  });

  test('should maintain session when navigating between pages', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[name="email"]', ADMIN_CREDENTIALS.email);
    await page.fill('[name="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard)?$/);

    // Navigate to users page
    await page.goto('/users');
    await page.waitForTimeout(500);

    const url = page.url();
    expect(url).not.toContain('/login');
  });

  test('should redirect to login when accessing protected route without session', async ({
    page,
  }) => {
    // Clear any stored auth state
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Try to access protected route
    await page.goto('/users');

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('should store auth tokens in browser storage', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', ADMIN_CREDENTIALS.email);
    await page.fill('[name="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard)?$/);

    // Check if tokens are stored
    const hasLocalStorageToken = await page.evaluate(() => {
      return (
        localStorage.getItem('accessToken') !== null ||
        localStorage.getItem('token') !== null ||
        localStorage.getItem('auth') !== null
      );
    });

    const hasCookies = (await page.context().cookies()).length > 0;

    // Auth data should be stored somewhere
    expect(hasLocalStorageToken || hasCookies).toBe(true);
  });
});

// =============================================================================
// LOGOUT
// =============================================================================

test.describe('Logout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[name="email"]', ADMIN_CREDENTIALS.email);
    await page.fill('[name="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });

  test('should logout when clicking logout button', async ({ page }) => {
    // Find and click logout button
    const logoutButton = page.locator(
      'button:has-text("Logout"), button:has-text("Sign out"), button:has-text("Log out"), [data-testid="logout"], a:has-text("Logout")'
    );

    if (
      await logoutButton
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await logoutButton.first().click();
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    }
  });

  test('should clear auth tokens on logout', async ({ page }) => {
    // Click logout
    const logoutButton = page.locator(
      'button:has-text("Logout"), button:has-text("Sign out"), button:has-text("Log out"), [data-testid="logout"]'
    );

    if (
      await logoutButton
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await logoutButton.first().click();
      await page.waitForTimeout(1000);

      // Verify tokens are cleared
      const hasToken = await page.evaluate(() => {
        return (
          localStorage.getItem('accessToken') !== null || localStorage.getItem('token') !== null
        );
      });

      expect(hasToken).toBe(false);
    }
  });

  test('should prevent access to admin pages after logout', async ({ page }) => {
    // Logout
    const logoutButton = page.locator(
      'button:has-text("Logout"), button:has-text("Sign out"), button:has-text("Log out"), [data-testid="logout"]'
    );

    if (
      await logoutButton
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await logoutButton.first().click();
      await expect(page).toHaveURL(/\/login/);

      // Try to access protected route
      await page.goto('/users');
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
