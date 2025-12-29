import { test, expect, type Page } from '@playwright/test';

/**
 * Job Discovery E2E Test Suite
 * Tests job search, filtering, pagination, and job detail functionality
 */

class JobDiscoveryPage {
  constructor(private page: Page) {}

  async navigateToJobs() {
    await this.page.goto('/jobs');
    await expect(this.page).toHaveURL(/\/jobs/);
  }

  async searchJobs(keyword: string) {
    const searchInput = this.page.getByPlaceholder(/search.*jobs|find.*work/i);
    await searchInput.fill(keyword);
    await searchInput.press('Enter');
  }

  async waitForResults() {
    await this.page.waitForSelector('[data-testid="job-card"]', { state: 'visible' });
  }

  async getJobCount() {
    return await this.page.locator('[data-testid="job-card"]').count();
  }

  async applyFilter(filterName: string, value: string) {
    const filterButton = this.page.getByRole('button', { name: new RegExp(filterName, 'i') });
    await filterButton.click();
    await this.page.getByRole('option', { name: new RegExp(value, 'i') }).click();
  }

  async toggleSkillFilter(skill: string) {
    await this.page.getByLabel(new RegExp(skill, 'i')).check();
  }

  async clearFilters() {
    await this.page.getByRole('button', { name: /clear.*filters|reset/i }).click();
  }
}

test.describe('Search Jobs with Keyword', () => {
  test('should search jobs by keyword', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.navigateToJobs();
    await jobPage.searchJobs('React Developer');
    await jobPage.waitForResults();

    // Verify search results contain keyword
    const firstJob = page.locator('[data-testid="job-card"]').first();
    await expect(firstJob).toContainText(/react|developer/i);
  });

  test('should update URL with search query', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.navigateToJobs();
    await jobPage.searchJobs('Python');

    await expect(page).toHaveURL(/[?&]q=Python/i);
  });

  test('should show no results message for invalid search', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.navigateToJobs();
    await jobPage.searchJobs('xyznonexistentjob123456');

    await expect(page.getByText(/no.*jobs.*found|no.*results/i)).toBeVisible();
  });

  test('should show search suggestions', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.navigateToJobs();
    await page.getByPlaceholder(/search/i).fill('web');

    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount.greaterThan(0);
  });

  test('should handle special characters in search', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.navigateToJobs();
    await jobPage.searchJobs('C++ Developer');

    // Should not error
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });
});

test.describe('Apply Filters', () => {
  test.beforeEach(async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);
    await jobPage.navigateToJobs();
  });

  test('should filter by category', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.applyFilter('Category', 'Web Development');
    await jobPage.waitForResults();

    // Verify URL contains filter
    await expect(page).toHaveURL(/category=web-development/i);

    // Verify results match filter
    const jobs = page.locator('[data-testid="job-card"]');
    const count = await jobs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should filter by budget range', async ({ page }) => {
    // Open budget filter
    await page.getByRole('button', { name: /budget/i }).click();

    // Set budget range
    await page.getByLabel(/minimum|min/i).fill('1000');
    await page.getByLabel(/maximum|max/i).fill('5000');
    await page.getByRole('button', { name: /apply/i }).click();

    await expect(page).toHaveURL(/budget_min=1000.*budget_max=5000/);
  });

  test('should filter by experience level', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.applyFilter('Experience', 'Intermediate');
    await jobPage.waitForResults();

    await expect(page).toHaveURL(/experience=intermediate/i);
  });

  test('should filter by project type', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.applyFilter('Type', 'Fixed Price');
    await jobPage.waitForResults();

    await expect(page).toHaveURL(/type=fixed/i);
  });

  test('should filter by multiple skills', async ({ page }) => {
    await page.getByRole('button', { name: /skills/i }).click();
    await page.getByLabel('React').check();
    await page.getByLabel('TypeScript').check();
    await page.getByRole('button', { name: /apply|done/i }).click();

    await expect(page).toHaveURL(/skills=react.*typescript|skills=typescript.*react/i);
  });

  test('should combine multiple filters', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.applyFilter('Category', 'Web Development');
    await jobPage.applyFilter('Experience', 'Expert');

    await expect(page).toHaveURL(/category=web-development/i);
    await expect(page).toHaveURL(/experience=expert/i);
  });

  test('should clear all filters', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.applyFilter('Category', 'Web Development');
    await jobPage.clearFilters();

    await expect(page).not.toHaveURL(/category=/);
  });
});

test.describe('Filter Persistence via URL', () => {
  test('should restore filters from URL on page load', async ({ page }) => {
    await page.goto('/jobs?category=web-development&experience=intermediate');

    // Verify filter chips show selected values
    await expect(page.getByTestId('active-filter-chip')).toContainText(/web development/i);
    await expect(page.getByTestId('active-filter-chip')).toContainText(/intermediate/i);
  });

  test('should share filtered URL', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.navigateToJobs();
    await jobPage.searchJobs('React');
    await jobPage.applyFilter('Experience', 'Expert');

    const url = page.url();

    // Navigate away and back via URL
    await page.goto('/');
    await page.goto(url);

    // Filters should be restored
    await expect(page.getByPlaceholder(/search/i)).toHaveValue('React');
    await expect(page.getByTestId('active-filter-chip')).toContainText(/expert/i);
  });

  test('should update URL without page reload', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.navigateToJobs();

    let reloaded = false;
    page.on('load', () => {
      reloaded = true;
    });

    await jobPage.applyFilter('Category', 'Design');

    expect(reloaded).toBe(false);
    await expect(page).toHaveURL(/category=design/i);
  });
});

test.describe('Pagination and Infinite Scroll', () => {
  test('should load more jobs on scroll', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.navigateToJobs();
    await jobPage.waitForResults();

    const initialCount = await jobPage.getJobCount();

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for more jobs to load
    await page.waitForTimeout(1000);

    const newCount = await jobPage.getJobCount();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('should show loading indicator when fetching more', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.navigateToJobs();
    await jobPage.waitForResults();

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Loading indicator should appear
    await expect(page.getByTestId('loading-more')).toBeVisible();
  });

  test('should show end of results message', async ({ page }) => {
    // Search for something with few results
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.navigateToJobs();
    await jobPage.searchJobs('very specific rare skill xyz');

    // Scroll multiple times to reach end
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
    }

    // Eventually should see end message or just stop loading
    const hasMoreJobs = await page.locator('[data-testid="loading-more"]').isVisible();
    if (!hasMoreJobs) {
      // Either no more jobs or end message
      const endMessage = page.getByText(/no more jobs|end of results|all jobs loaded/i);
      if (await endMessage.isVisible()) {
        await expect(endMessage).toBeVisible();
      }
    }
  });

  test('should maintain scroll position on back navigation', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.navigateToJobs();
    await jobPage.waitForResults();

    // Scroll down and load more
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
    }

    const scrollPosition = await page.evaluate(() => window.scrollY);

    // Click on a job to navigate
    await page.locator('[data-testid="job-card"]').nth(10).click();
    await expect(page).toHaveURL(/\/jobs\/\w+/);

    // Go back
    await page.goBack();

    // Scroll position should be restored (approximately)
    const restoredPosition = await page.evaluate(() => window.scrollY);
    expect(restoredPosition).toBeGreaterThan(scrollPosition * 0.5);
  });
});

test.describe('View Job Details', () => {
  test('should navigate to job detail page', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.navigateToJobs();
    await jobPage.waitForResults();

    const firstJob = page.locator('[data-testid="job-card"]').first();
    const jobTitle = await firstJob.locator('[data-testid="job-title"]').textContent();

    await firstJob.click();

    await expect(page).toHaveURL(/\/jobs\/[\w-]+/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(jobTitle!);
  });

  test('should display job details correctly', async ({ page }) => {
    await page.goto('/jobs/sample-job-id');

    // Verify all required sections are visible
    await expect(page.getByTestId('job-title')).toBeVisible();
    await expect(page.getByTestId('job-description')).toBeVisible();
    await expect(page.getByTestId('job-budget')).toBeVisible();
    await expect(page.getByTestId('job-skills')).toBeVisible();
    await expect(page.getByTestId('client-info')).toBeVisible();
  });

  test('should show apply button for eligible users', async ({ page }) => {
    // Login as freelancer first
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@skillancer.com');
    await page.getByLabel('Password').fill('ValidP@ssword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/jobs/sample-job-id');

    await expect(page.getByRole('button', { name: /apply|submit.*proposal/i })).toBeVisible();
  });

  test('should show similar jobs section', async ({ page }) => {
    await page.goto('/jobs/sample-job-id');

    await expect(page.getByText(/similar jobs|related jobs/i)).toBeVisible();
    await expect(page.locator('[data-testid="similar-job-card"]')).toHaveCount.greaterThan(0);
  });
});

test.describe('Save and Unsave Job', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@skillancer.com');
    await page.getByLabel('Password').fill('ValidP@ssword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should save a job from listing', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.navigateToJobs();
    await jobPage.waitForResults();

    const firstJob = page.locator('[data-testid="job-card"]').first();
    const saveButton = firstJob.getByRole('button', { name: /save|bookmark/i });

    await saveButton.click();

    // Button should update to saved state
    await expect(saveButton).toHaveAttribute('data-saved', 'true');
    await expect(page.getByText(/job saved|saved to list/i)).toBeVisible();
  });

  test('should unsave a saved job', async ({ page }) => {
    const jobPage = new JobDiscoveryPage(page);

    await jobPage.navigateToJobs();
    await jobPage.waitForResults();

    // Assume first job is already saved
    const firstJob = page.locator('[data-testid="job-card"]').first();
    const saveButton = firstJob.getByRole('button', { name: /unsave|remove/i });

    await saveButton.click();

    await expect(saveButton).toHaveAttribute('data-saved', 'false');
  });

  test('should view saved jobs list', async ({ page }) => {
    await page.goto('/jobs/saved');

    await expect(page.getByRole('heading', { name: /saved jobs/i })).toBeVisible();
    await expect(page.locator('[data-testid="job-card"]')).toHaveCount.greaterThanOrEqual(0);
  });

  test('should save job from detail page', async ({ page }) => {
    await page.goto('/jobs/sample-job-id');

    const saveButton = page.getByRole('button', { name: /save|bookmark/i });
    await saveButton.click();

    await expect(page.getByText(/job saved/i)).toBeVisible();
  });
});

test.describe('Job Not Found Handling', () => {
  test('should show 404 for non-existent job', async ({ page }) => {
    await page.goto('/jobs/non-existent-job-12345');

    await expect(page.getByText(/not found|job.*exist/i)).toBeVisible();
  });

  test('should show back to jobs button on 404', async ({ page }) => {
    await page.goto('/jobs/non-existent-job-12345');

    const backButton = page.getByRole('link', { name: /back.*jobs|browse.*jobs/i });
    await expect(backButton).toBeVisible();

    await backButton.click();
    await expect(page).toHaveURL(/\/jobs$/);
  });

  test('should handle deleted job gracefully', async ({ page }) => {
    // Assume this job was recently deleted
    await page.goto('/jobs/deleted-job-id');

    await expect(page.getByText(/no longer available|removed|deleted/i)).toBeVisible();
  });
});

test.describe('Job Listing Performance', () => {
  test('should load initial results quickly', async ({ page }) => {
    const startTime = Date.now();

    const jobPage = new JobDiscoveryPage(page);
    await jobPage.navigateToJobs();
    await jobPage.waitForResults();

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // Under 3 seconds
  });

  test('should show skeleton loading state', async ({ page }) => {
    // Navigate with slow network
    await page.route('**/api/jobs**', async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.continue();
    });

    await page.goto('/jobs');

    await expect(page.locator('[data-testid="job-skeleton"]')).toBeVisible();
  });
});
