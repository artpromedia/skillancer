import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.describe('Homepage', () => {
    test('homepage matches snapshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot('homepage.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    });

    test('homepage dark mode matches snapshot', async ({ page }) => {
      await page.goto('/');
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot('homepage-dark.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    });
  });

  test.describe('Job Listing', () => {
    test('job listing page matches snapshot', async ({ page }) => {
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot('job-listing.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    });

    test('job listing with filters matches snapshot', async ({ page }) => {
      await page.goto('/jobs?category=development&budget=1000-5000');
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot('job-listing-filtered.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    });
  });

  test.describe('Job Detail', () => {
    test('job detail page matches snapshot', async ({ page }) => {
      await page.goto('/jobs/sample-job-id');
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot('job-detail.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    });
  });

  test.describe('Profile', () => {
    test('profile page matches snapshot', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.fill('[name="email"]', 'test@example.com');
      await page.fill('[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot('profile.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    });
  });

  test.describe('Dashboard', () => {
    test('dashboard matches snapshot', async ({ page }) => {
      await page.goto('/login');
      await page.fill('[name="email"]', 'test@example.com');
      await page.fill('[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot('dashboard.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    });
  });

  test.describe('Responsive Breakpoints', () => {
    const breakpoints = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 800 },
      { name: 'wide', width: 1920, height: 1080 },
    ];

    for (const bp of breakpoints) {
      test(`homepage at ${bp.name} breakpoint`, async ({ page }) => {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        await expect(page).toHaveScreenshot(`homepage-${bp.name}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.01,
        });
      });

      test(`job listing at ${bp.name} breakpoint`, async ({ page }) => {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await page.goto('/jobs');
        await page.waitForLoadState('networkidle');
        
        await expect(page).toHaveScreenshot(`job-listing-${bp.name}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  });

  test.describe('Component Snapshots', () => {
    test('navigation component', async ({ page }) => {
      await page.goto('/');
      
      const nav = page.locator('header nav, nav[role="navigation"]').first();
      await expect(nav).toHaveScreenshot('nav-component.png');
    });

    test('footer component', async ({ page }) => {
      await page.goto('/');
      
      const footer = page.locator('footer');
      await expect(footer).toHaveScreenshot('footer-component.png');
    });

    test('job card component', async ({ page }) => {
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle');
      
      const jobCard = page.locator('[data-testid="job-card"]').first();
      if (await jobCard.isVisible()) {
        await expect(jobCard).toHaveScreenshot('job-card-component.png');
      }
    });
  });

  test.describe('Interactive States', () => {
    test('button hover states', async ({ page }) => {
      await page.goto('/');
      
      const button = page.locator('button').first();
      await button.hover();
      
      await expect(button).toHaveScreenshot('button-hover.png');
    });

    test('input focus states', async ({ page }) => {
      await page.goto('/login');
      
      const input = page.locator('input[type="email"]');
      await input.focus();
      
      await expect(input).toHaveScreenshot('input-focus.png');
    });
  });

  test.describe('Error States', () => {
    test('404 page matches snapshot', async ({ page }) => {
      await page.goto('/non-existent-page');
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot('404-page.png', {
        fullPage: true,
      });
    });

    test('form validation error states', async ({ page }) => {
      await page.goto('/login');
      
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500); // Wait for validation
      
      await expect(page).toHaveScreenshot('form-validation-errors.png', {
        fullPage: true,
      });
    });
  });
});
