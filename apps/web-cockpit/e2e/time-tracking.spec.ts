import { test, expect, type Page } from '@playwright/test';

/**
 * Time Tracking E2E Test Suite
 * Tests timer functionality and time entry management
 */

class TimeTrackingPage {
  constructor(private page: Page) {}

  async navigateToTimeTracking() {
    await this.page.goto('/time-tracking');
  }

  async startTimer(contractId?: string) {
    if (contractId) {
      await this.page.getByRole('combobox', { name: /contract|project/i }).selectOption(contractId);
    }
    await this.page.getByRole('button', { name: /start.*timer|start/i }).click();
  }

  async pauseTimer() {
    await this.page.getByRole('button', { name: /pause/i }).click();
  }

  async resumeTimer() {
    await this.page.getByRole('button', { name: /resume|continue/i }).click();
  }

  async stopTimer() {
    await this.page.getByRole('button', { name: /stop/i }).click();
  }

  async saveTimeEntry(description?: string) {
    if (description) {
      await this.page.getByLabel(/description|notes|memo/i).fill(description);
    }
    await this.page.getByRole('button', { name: /save/i }).click();
  }

  async discardTimeEntry() {
    await this.page.getByRole('button', { name: /discard|cancel/i }).click();
  }
}

async function loginAsFreelancer(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('freelancer@test.com');
  await page.getByLabel('Password').fill('TestPassword123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|time)/);
}

test.describe('Start Timer', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should display start timer button', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();

    await expect(page.getByRole('button', { name: /start.*timer|start/i })).toBeVisible();
  });

  test('should start timer and show elapsed time', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();
    await timeTrackingPage.startTimer();

    await expect(page.getByTestId('timer-display')).toBeVisible();
    await expect(page.getByText(/00:00:0[0-9]/)).toBeVisible();

    // Wait and verify time increases
    await page.waitForTimeout(2000);
    await expect(page.getByText(/00:00:0[2-9]|00:00:1/)).toBeVisible();
  });

  test('should require contract selection before starting', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();

    const startButton = page.getByRole('button', { name: /start.*timer/i });

    // Should be disabled without contract selection
    await expect(startButton).toBeDisabled();

    // Select a contract
    await page.getByRole('combobox', { name: /contract|project/i }).selectOption({ index: 1 });
    await expect(startButton).toBeEnabled();
  });

  test('should show timer in navigation/header', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();
    await page.getByRole('combobox', { name: /contract/i }).selectOption({ index: 1 });
    await timeTrackingPage.startTimer();

    // Navigate to another page
    await page.goto('/dashboard');

    // Timer should still be visible
    await expect(page.getByTestId('floating-timer')).toBeVisible();
  });
});

test.describe('Pause/Resume Timer', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();
    await page.getByRole('combobox', { name: /contract/i }).selectOption({ index: 1 });
    await timeTrackingPage.startTimer();
  });

  test('should pause timer', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);

    await page.waitForTimeout(2000);
    await timeTrackingPage.pauseTimer();

    const timeBeforePause = await page.getByTestId('timer-display').textContent();
    await page.waitForTimeout(2000);
    const timeAfterPause = await page.getByTestId('timer-display').textContent();

    expect(timeBeforePause).toBe(timeAfterPause);
  });

  test('should resume timer after pause', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);

    await page.waitForTimeout(2000);
    await timeTrackingPage.pauseTimer();

    const pausedTime = await page.getByTestId('timer-display').textContent();

    await timeTrackingPage.resumeTimer();
    await page.waitForTimeout(2000);

    const resumedTime = await page.getByTestId('timer-display').textContent();
    expect(resumedTime).not.toBe(pausedTime);
  });

  test('should show paused state indicator', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.pauseTimer();

    await expect(page.getByText(/paused/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /resume/i })).toBeVisible();
  });
});

test.describe('Stop and Save Entry', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();
    await page.getByRole('combobox', { name: /contract/i }).selectOption({ index: 1 });
    await timeTrackingPage.startTimer();
    await page.waitForTimeout(3000);
  });

  test('should stop timer and show save dialog', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.stopTimer();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/description|notes/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
  });

  test('should save time entry', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.stopTimer();
    await timeTrackingPage.saveTimeEntry('Worked on API integration');

    await expect(page.getByText(/saved|entry.*added/i)).toBeVisible();
  });

  test('should discard time entry', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.stopTimer();
    await timeTrackingPage.discardTimeEntry();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByTestId('timer-display')).not.toBeVisible();
  });

  test('should show saved entry in list', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.stopTimer();
    await timeTrackingPage.saveTimeEntry('Test entry description');

    await expect(
      page.locator('[data-testid="time-entry"]').filter({ hasText: 'Test entry description' })
    ).toBeVisible();
  });
});

test.describe('Manual Time Entry', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should add manual time entry', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();

    await page.getByRole('button', { name: /add.*entry|manual.*entry/i }).click();

    await page.getByRole('combobox', { name: /contract/i }).selectOption({ index: 1 });
    await page.getByLabel(/date/i).fill('2025-12-28');
    await page.getByLabel(/start.*time/i).fill('09:00');
    await page.getByLabel(/end.*time|duration/i).fill('11:30');
    await page.getByLabel(/description/i).fill('Manual entry test');

    await page.getByRole('button', { name: /save|add/i }).click();

    await expect(page.getByText(/entry.*added|saved/i)).toBeVisible();
  });

  test('should validate time entry fields', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();

    await page.getByRole('button', { name: /add.*entry/i }).click();
    await page.getByRole('button', { name: /save|add/i }).click();

    await expect(page.getByText(/required|select.*contract/i)).toBeVisible();
  });

  test('should not allow future dates', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();

    await page.getByRole('button', { name: /add.*entry/i }).click();
    await page.getByLabel(/date/i).fill('2030-01-01');

    await expect(page.getByText(/future.*date|invalid.*date/i)).toBeVisible();
  });
});

test.describe('Edit Time Entry', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should edit existing time entry', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();

    const entry = page.locator('[data-testid="time-entry"]').first();
    await entry.getByRole('button', { name: /edit/i }).click();

    await page.getByLabel(/description/i).fill('Updated description');
    await page.getByRole('button', { name: /save|update/i }).click();

    await expect(page.getByText(/updated|saved/i)).toBeVisible();
    await expect(entry).toContainText('Updated description');
  });

  test('should update duration', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();

    const entry = page.locator('[data-testid="time-entry"]').first();
    await entry.getByRole('button', { name: /edit/i }).click();

    await page.getByLabel(/duration|hours/i).fill('3:00');
    await page.getByRole('button', { name: /save/i }).click();

    await expect(entry).toContainText(/3.*hour|3:00/i);
  });
});

test.describe('Delete Time Entry', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should delete time entry', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();

    const entryCount = await page.locator('[data-testid="time-entry"]').count();

    const entry = page.locator('[data-testid="time-entry"]').first();
    await entry.getByRole('button', { name: /delete|remove/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.locator('[data-testid="time-entry"]')).toHaveCount(entryCount - 1);
  });

  test('should show delete confirmation', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();

    const entry = page.locator('[data-testid="time-entry"]').first();
    await entry.getByRole('button', { name: /delete/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/are you sure|confirm.*delete/i)).toBeVisible();
  });
});

test.describe('Timesheet View', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should display weekly timesheet', async ({ page }) => {
    await page.goto('/time-tracking/timesheet');

    await expect(page.getByTestId('timesheet-grid')).toBeVisible();
    await expect(page.getByText(/mon|tue|wed|thu|fri/i)).toBeVisible();
  });

  test('should show total hours per day', async ({ page }) => {
    await page.goto('/time-tracking/timesheet');

    await expect(page.getByTestId('daily-total')).toHaveCount(7);
  });

  test('should show total hours per week', async ({ page }) => {
    await page.goto('/time-tracking/timesheet');

    await expect(page.getByTestId('weekly-total')).toBeVisible();
  });

  test('should navigate between weeks', async ({ page }) => {
    await page.goto('/time-tracking/timesheet');

    const weekLabel = await page.getByTestId('week-label').textContent();

    await page.getByRole('button', { name: /previous|prev.*week/i }).click();

    const newWeekLabel = await page.getByTestId('week-label').textContent();
    expect(newWeekLabel).not.toBe(weekLabel);
  });

  test('should filter by contract', async ({ page }) => {
    await page.goto('/time-tracking/timesheet');

    await page.getByRole('combobox', { name: /contract|filter/i }).selectOption({ index: 1 });

    // Verify filter is applied
    await expect(page.getByTestId('timesheet-grid')).toBeVisible();
  });
});

test.describe('Timer Persistence Across Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should persist timer when navigating', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();
    await page.getByRole('combobox', { name: /contract/i }).selectOption({ index: 1 });
    await timeTrackingPage.startTimer();

    const initialTime = await page.getByTestId('timer-display').textContent();

    // Navigate away
    await page.goto('/dashboard');
    await page.waitForTimeout(3000);

    // Navigate back
    await timeTrackingPage.navigateToTimeTracking();

    const currentTime = await page.getByTestId('timer-display').textContent();
    expect(currentTime).not.toBe(initialTime);
  });

  test('should show mini timer on all pages', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();
    await page.getByRole('combobox', { name: /contract/i }).selectOption({ index: 1 });
    await timeTrackingPage.startTimer();

    // Check various pages
    const pages = ['/dashboard', '/contracts', '/messages', '/profile'];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await expect(page.getByTestId('floating-timer')).toBeVisible();
    }
  });

  test('should restore timer after page refresh', async ({ page }) => {
    const timeTrackingPage = new TimeTrackingPage(page);
    await timeTrackingPage.navigateToTimeTracking();
    await page.getByRole('combobox', { name: /contract/i }).selectOption({ index: 1 });
    await timeTrackingPage.startTimer();

    await page.waitForTimeout(3000);

    await page.reload();

    await expect(page.getByTestId('timer-display')).toBeVisible();
    // Timer should have continued counting
    await expect(page.getByText(/00:00:[0-9]{2}/)).toBeVisible();
  });
});
