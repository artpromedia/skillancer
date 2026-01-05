import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test.describe('Homepage', () => {
    test('should have no accessibility violations', async ({ page }) => {
      await page.goto('/');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');
      
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1);

      // Check heading order
      const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', (elements) =>
        elements.map((el) => Number.parseInt(el.tagName[1]))
      );

      for (let i = 1; i < headings.length; i++) {
        expect(headings[i] - headings[i - 1]).toBeLessThanOrEqual(1);
      }
    });
  });

  test.describe('Job Listing Page', () => {
    test('should pass axe accessibility scan', async ({ page }) => {
      await page.goto('/jobs');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have accessible search input', async ({ page }) => {
      await page.goto('/jobs');
      
      const searchInput = page.getByRole('searchbox');
      await expect(searchInput).toBeVisible();
      
      const label = await searchInput.getAttribute('aria-label');
      const labelledBy = await searchInput.getAttribute('aria-labelledby');
      expect(label || labelledBy).toBeTruthy();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should be navigable with keyboard only', async ({ page }) => {
      await page.goto('/');
      
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON', 'INPUT']).toContain(firstFocused);

      // Continue tabbing
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => document.activeElement);
        expect(focused).toBeTruthy();
      }
    });

    test('should have visible focus indicators', async ({ page }) => {
      await page.goto('/');
      
      await page.keyboard.press('Tab');
      
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
      
      // Check for visible focus ring
      const outlineWidth = await focusedElement.evaluate((el) => 
        getComputedStyle(el).outlineWidth
      );
      expect(outlineWidth).not.toBe('0px');
    });

    test('should support skip links', async ({ page }) => {
      await page.goto('/');
      
      await page.keyboard.press('Tab');
      const skipLink = page.getByText(/skip to/i);
      
      if (await skipLink.isVisible()) {
        await page.keyboard.press('Enter');
        const mainContent = page.locator('main, [role="main"]');
        await expect(mainContent).toBeFocused();
      }
    });
  });

  test.describe('Screen Reader Compatibility', () => {
    test('should have alt text on images', async ({ page }) => {
      await page.goto('/');
      
      const images = await page.locator('img').all();
      
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');
        
        // Either has alt text or is decorative
        expect(alt !== null || role === 'presentation').toBe(true);
      }
    });

    test('should have proper ARIA labels on buttons', async ({ page }) => {
      await page.goto('/');
      
      const buttons = await page.locator('button').all();
      
      for (const button of buttons) {
        const text = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');
        const ariaLabelledBy = await button.getAttribute('aria-labelledby');
        
        // Button should have accessible name
        expect(text?.trim() || ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    });

    test('should have proper form labels', async ({ page }) => {
      await page.goto('/login');
      
      const inputs = await page.locator('input:not([type="hidden"])').all();
      
      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        const placeholder = await input.getAttribute('placeholder');
        
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          const hasLabel = await label.count() > 0;
          expect(hasLabel || ariaLabel || ariaLabelledBy || placeholder).toBeTruthy();
        }
      }
    });
  });

  test.describe('Color Contrast', () => {
    test('should meet WCAG AA contrast requirements', async ({ page }) => {
      await page.goto('/');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .options({ runOnly: ['color-contrast'] })
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });

  test.describe('Focus Management', () => {
    test('should trap focus in modal dialogs', async ({ page }) => {
      await page.goto('/jobs');
      
      // Open a modal (e.g., filter modal)
      const filterButton = page.getByRole('button', { name: /filter/i });
      if (await filterButton.isVisible()) {
        await filterButton.click();
        
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible()) {
          // Tab through modal elements
          await page.keyboard.press('Tab');
          const focusInModal = await page.evaluate(() => {
            const modal = document.querySelector('[role="dialog"]');
            return modal?.contains(document.activeElement);
          });
          expect(focusInModal).toBe(true);
        }
      }
    });

    test('should return focus after modal close', async ({ page }) => {
      await page.goto('/jobs');
      
      const filterButton = page.getByRole('button', { name: /filter/i });
      if (await filterButton.isVisible()) {
        await filterButton.click();
        await page.keyboard.press('Escape');
        
        // Focus should return to trigger button
        await expect(filterButton).toBeFocused();
      }
    });
  });

  test.describe('Responsive Accessibility', () => {
    test('should be accessible on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('mobile menu should be accessible', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      const menuButton = page.getByRole('button', { name: /menu/i });
      if (await menuButton.isVisible()) {
        await menuButton.click();
        
        const nav = page.locator('nav');
        await expect(nav).toBeVisible();
        
        const accessibilityScanResults = await new AxeBuilder({ page })
          .include('nav')
          .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
      }
    });
  });
});
