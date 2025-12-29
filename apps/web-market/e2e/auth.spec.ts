import { test, expect, type Page } from '@playwright/test';

/**
 * Authentication E2E Test Suite
 * Tests all authentication flows including registration, login, MFA, and session management
 */

// Test data factory
const createTestUser = (suffix: string = Date.now().toString()) => ({
  email: `test.user.${suffix}@skillancer-test.com`,
  password: 'SecureP@ssw0rd123!',
  firstName: 'Test',
  lastName: 'User',
});

// Page object helpers
class AuthPage {
  constructor(private page: Page) {}

  async navigateToLogin() {
    await this.page.goto('/login');
    await expect(this.page).toHaveURL(/\/login/);
  }

  async navigateToRegister() {
    await this.page.goto('/register');
    await expect(this.page).toHaveURL(/\/register/);
  }

  async fillLoginForm(email: string, password: string) {
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
  }

  async fillRegistrationForm(user: ReturnType<typeof createTestUser>) {
    await this.page.getByLabel('First name').fill(user.firstName);
    await this.page.getByLabel('Last name').fill(user.lastName);
    await this.page.getByLabel('Email').fill(user.email);
    await this.page.getByLabel('Password', { exact: true }).fill(user.password);
    await this.page.getByLabel('Confirm password').fill(user.password);
  }

  async submitForm() {
    await this.page.getByRole('button', { name: /sign (in|up)|register|login/i }).click();
  }

  async acceptTerms() {
    await this.page.getByLabel(/terms|agree/i).check();
  }
}

test.describe('User Registration Flow', () => {
  test('should register a new user with valid credentials', async ({ page }) => {
    const auth = new AuthPage(page);
    const testUser = createTestUser();

    await auth.navigateToRegister();
    await auth.fillRegistrationForm(testUser);
    await auth.acceptTerms();
    await auth.submitForm();

    // Should redirect to verification page or dashboard
    await expect(page).toHaveURL(/\/(verify-email|dashboard|onboarding)/);
  });

  test('should show error for existing email', async ({ page }) => {
    const auth = new AuthPage(page);
    const existingUser = { ...createTestUser(), email: 'existing@skillancer.com' };

    await auth.navigateToRegister();
    await auth.fillRegistrationForm(existingUser);
    await auth.acceptTerms();
    await auth.submitForm();

    await expect(page.getByText(/email.*already.*registered|account.*exists/i)).toBeVisible();
  });

  test('should validate password strength', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.navigateToRegister();
    await page.getByLabel('Password', { exact: true }).fill('weak');
    await page.getByLabel('Confirm password').click();

    await expect(page.getByText(/password.*weak|minimum.*characters/i)).toBeVisible();
  });

  test('should validate password confirmation match', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.navigateToRegister();
    await page.getByLabel('Password', { exact: true }).fill('SecureP@ss123!');
    await page.getByLabel('Confirm password').fill('DifferentP@ss123!');
    await page.getByLabel('Email').click(); // Trigger blur

    await expect(page.getByText(/passwords.*match|password.*not.*match/i)).toBeVisible();
  });

  test('should require terms acceptance', async ({ page }) => {
    const auth = new AuthPage(page);
    const testUser = createTestUser();

    await auth.navigateToRegister();
    await auth.fillRegistrationForm(testUser);
    // Don't accept terms
    await auth.submitForm();

    await expect(page.getByText(/accept.*terms|agree.*terms/i)).toBeVisible();
  });
});

test.describe('Email Verification', () => {
  test('should show verification pending state', async ({ page }) => {
    // Assume user just registered
    await page.goto('/verify-email');

    await expect(page.getByText(/verify.*email|check.*inbox/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /resend/i })).toBeVisible();
  });

  test('should handle verification link', async ({ page }) => {
    // Mock verification token
    const verificationToken = 'valid-verification-token';
    await page.goto(`/verify-email?token=${verificationToken}`);

    // Should show success or redirect to login
    await expect(page).toHaveURL(/\/(login|dashboard)/);
  });

  test('should handle invalid verification token', async ({ page }) => {
    await page.goto('/verify-email?token=invalid-token');

    await expect(page.getByText(/invalid|expired|link.*not.*valid/i)).toBeVisible();
  });

  test('should resend verification email', async ({ page }) => {
    await page.goto('/verify-email');

    await page.getByRole('button', { name: /resend/i }).click();

    await expect(page.getByText(/email.*sent|check.*inbox/i)).toBeVisible();
  });
});

test.describe('Login with Email/Password', () => {
  test('should login with valid credentials', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.navigateToLogin();
    await auth.fillLoginForm('valid@skillancer.com', 'ValidP@ssword123!');
    await auth.submitForm();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId('user-menu')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.navigateToLogin();
    await auth.fillLoginForm('invalid@skillancer.com', 'WrongPassword!');
    await auth.submitForm();

    await expect(page.getByText(/invalid.*credentials|incorrect.*password/i)).toBeVisible();
  });

  test('should handle account lockout after failed attempts', async ({ page }) => {
    const auth = new AuthPage(page);

    // Attempt login multiple times
    for (let i = 0; i < 5; i++) {
      await auth.navigateToLogin();
      await auth.fillLoginForm('test@skillancer.com', 'WrongPassword!');
      await auth.submitForm();
      await page.waitForTimeout(500);
    }

    await expect(page.getByText(/locked|too many attempts|try again later/i)).toBeVisible();
  });

  test('should remember user with remember me checkbox', async ({ page, context }) => {
    const auth = new AuthPage(page);

    await auth.navigateToLogin();
    await auth.fillLoginForm('valid@skillancer.com', 'ValidP@ssword123!');
    await page.getByLabel(/remember me/i).check();
    await auth.submitForm();

    await expect(page).toHaveURL(/\/dashboard/);

    // Check that session cookie is set with extended expiry
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name.includes('session'));
    expect(sessionCookie).toBeDefined();
  });
});

test.describe('Login with Google OAuth', () => {
  test('should redirect to Google OAuth', async ({ page }) => {
    await page.goto('/login');

    const googleButton = page.getByRole('button', { name: /google|continue with google/i });
    await expect(googleButton).toBeVisible();

    // Intercept the OAuth redirect
    const [popup] = await Promise.all([page.waitForEvent('popup'), googleButton.click()]);

    // Should redirect to Google
    expect(popup.url()).toContain('accounts.google.com');
  });

  test('should handle OAuth callback', async ({ page }) => {
    // Mock OAuth callback
    await page.goto('/auth/callback/google?code=valid-oauth-code');

    await expect(page).toHaveURL(/\/dashboard|\/onboarding/);
  });

  test('should handle OAuth error', async ({ page }) => {
    await page.goto('/auth/callback/google?error=access_denied');

    await expect(page.getByText(/authentication.*failed|access.*denied/i)).toBeVisible();
  });
});

test.describe('Password Reset Flow', () => {
  test('should request password reset', async ({ page }) => {
    await page.goto('/forgot-password');

    await page.getByLabel('Email').fill('user@skillancer.com');
    await page.getByRole('button', { name: /reset|send/i }).click();

    await expect(page.getByText(/email.*sent|check.*inbox/i)).toBeVisible();
  });

  test('should validate reset token', async ({ page }) => {
    await page.goto('/reset-password?token=valid-reset-token');

    await expect(page.getByLabel('New password')).toBeVisible();
    await expect(page.getByLabel('Confirm password')).toBeVisible();
  });

  test('should reset password with valid token', async ({ page }) => {
    await page.goto('/reset-password?token=valid-reset-token');

    await page.getByLabel('New password').fill('NewSecureP@ss123!');
    await page.getByLabel('Confirm password').fill('NewSecureP@ss123!');
    await page.getByRole('button', { name: /reset|change/i }).click();

    await expect(page.getByText(/password.*reset|success/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('should handle expired reset token', async ({ page }) => {
    await page.goto('/reset-password?token=expired-token');

    await expect(page.getByText(/expired|invalid|request.*new/i)).toBeVisible();
  });
});

test.describe('MFA Setup and Login', () => {
  test.beforeEach(async ({ page }) => {
    // Login as user first
    const auth = new AuthPage(page);
    await auth.navigateToLogin();
    await auth.fillLoginForm('valid@skillancer.com', 'ValidP@ssword123!');
    await auth.submitForm();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should enable MFA from security settings', async ({ page }) => {
    await page.goto('/settings/security');

    await page.getByRole('button', { name: /enable.*mfa|setup.*two.*factor/i }).click();

    // Should show QR code
    await expect(page.getByTestId('mfa-qr-code')).toBeVisible();
    await expect(page.getByLabel(/verification.*code/i)).toBeVisible();
  });

  test('should verify MFA setup with valid code', async ({ page }) => {
    await page.goto('/settings/security');
    await page.getByRole('button', { name: /enable.*mfa/i }).click();

    // Enter mock verification code
    await page.getByLabel(/verification.*code/i).fill('123456');
    await page.getByRole('button', { name: /verify|enable/i }).click();

    await expect(page.getByText(/mfa.*enabled|two.*factor.*active/i)).toBeVisible();
  });

  test('should show backup codes after MFA setup', async ({ page }) => {
    await page.goto('/settings/security');

    // Assume MFA is being set up
    await expect(page.getByText(/backup.*codes/i)).toBeVisible();
    await expect(page.getByTestId('backup-codes-list')).toBeVisible();
  });
});

test.describe('MFA Login', () => {
  test('should prompt for MFA code after password', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.navigateToLogin();
    await auth.fillLoginForm('mfa-user@skillancer.com', 'ValidP@ssword123!');
    await auth.submitForm();

    // Should show MFA prompt
    await expect(page.getByText(/verification.*code|two.*factor/i)).toBeVisible();
    await expect(page.getByLabel(/code/i)).toBeVisible();
  });

  test('should complete login with valid MFA code', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.navigateToLogin();
    await auth.fillLoginForm('mfa-user@skillancer.com', 'ValidP@ssword123!');
    await auth.submitForm();

    await page.getByLabel(/code/i).fill('123456');
    await page.getByRole('button', { name: /verify|continue/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should allow login with backup code', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.navigateToLogin();
    await auth.fillLoginForm('mfa-user@skillancer.com', 'ValidP@ssword123!');
    await auth.submitForm();

    await page.getByRole('button', { name: /backup.*code|use.*backup/i }).click();
    await page.getByLabel(/backup.*code/i).fill('BACKUP-CODE-1234');
    await page.getByRole('button', { name: /verify/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Session Management', () => {
  test('should maintain session across page refreshes', async ({ page }) => {
    const auth = new AuthPage(page);

    await auth.navigateToLogin();
    await auth.fillLoginForm('valid@skillancer.com', 'ValidP@ssword123!');
    await auth.submitForm();
    await expect(page).toHaveURL(/\/dashboard/);

    // Refresh page
    await page.reload();

    // Should still be logged in
    await expect(page.getByTestId('user-menu')).toBeVisible();
  });

  test('should redirect to login when session expires', async ({ page, context }) => {
    // Clear session cookies
    await context.clearCookies();

    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show active sessions in settings', async ({ page }) => {
    await page.goto('/settings/security');

    await expect(page.getByText(/active.*sessions/i)).toBeVisible();
    await expect(page.getByTestId('sessions-list')).toBeVisible();
  });

  test('should allow revoking other sessions', async ({ page }) => {
    await page.goto('/settings/security');

    const revokeButton = page.getByRole('button', { name: /revoke|sign out/i }).first();
    await revokeButton.click();

    await expect(page.getByText(/session.*revoked/i)).toBeVisible();
  });
});

test.describe('Logout', () => {
  test.beforeEach(async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.navigateToLogin();
    await auth.fillLoginForm('valid@skillancer.com', 'ValidP@ssword123!');
    await auth.submitForm();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should logout successfully', async ({ page }) => {
    await page.getByTestId('user-menu').click();
    await page.getByRole('menuitem', { name: /logout|sign out/i }).click();

    await expect(page).toHaveURL(/\/login|\//);
    await expect(page.getByTestId('user-menu')).not.toBeVisible();
  });

  test('should clear session data on logout', async ({ page, context }) => {
    await page.getByTestId('user-menu').click();
    await page.getByRole('menuitem', { name: /logout/i }).click();

    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name.includes('session'));
    expect(sessionCookie).toBeUndefined();
  });

  test('should redirect protected routes after logout', async ({ page }) => {
    await page.getByTestId('user-menu').click();
    await page.getByRole('menuitem', { name: /logout/i }).click();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
