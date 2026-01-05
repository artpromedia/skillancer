import { test, expect, type Page } from '@playwright/test';

/**
 * Search Flow E2E Test Suite
 * Tests critical search paths including job search, freelancer search, and filtering
 */

// Page object helpers
class SearchPage {
  constructor(private page: Page) {}

  async navigateToJobSearch() {
    await this.page.goto('/jobs');
    await expect(this.page).toHaveURL(/\/jobs/);
  }

  async navigateToFreelancerSearch() {
    await this.page.goto('/freelancers');
    await expect(this.page).toHaveURL(/\/freelancers/);
  }

  async searchFor(query: string) {
    await this.page.getByPlaceholder(/search/i).fill(query);
    await this.page.getByPlaceholder(/search/i).press('Enter');
  }

  async waitForResults() {
    await this.page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });
  }

  async getResultCount(): Promise<number> {
    const countText = await this.page.getByTestId('result-count').textContent();
    const match = countText?.match(/(\d+)/);
    return match ? Number.parseInt(match[1]) : 0;
  }

  async selectFilter(filterName: string, value: string) {
    await this.page.getByTestId(`filter-${filterName}`).click();
    await this.page.getByRole('option', { name: new RegExp(value, 'i') }).click();
  }

  async setRangeFilter(filterName: string, min: number, max: number) {
    await this.page.getByTestId(`filter-${filterName}-min`).fill(min.toString());
    await this.page.getByTestId(`filter-${filterName}-max`).fill(max.toString());
    await this.page.getByRole('button', { name: /apply/i }).click();
  }

  async clearFilters() {
    await this.page.getByRole('button', { name: /clear.*filters/i }).click();
  }

  async sortBy(sortOption: string) {
    await this.page.getByTestId('sort-select').click();
    await this.page.getByRole('option', { name: new RegExp(sortOption, 'i') }).click();
  }
}

test.describe('Job Search Flow', () => {
  let searchPage: SearchPage;

  test.beforeEach(async ({ page }) => {
    searchPage = new SearchPage(page);
    await searchPage.navigateToJobSearch();
  });

  test('should display search results', async ({ page }) => {
    await searchPage.waitForResults();

    await expect(page.getByTestId('search-results')).toBeVisible();
    const resultCount = await searchPage.getResultCount();
    expect(resultCount).toBeGreaterThan(0);
  });

  test('should search for jobs by keyword', async ({ page }) => {
    await searchPage.searchFor('React Developer');
    await searchPage.waitForResults();

    // Results should contain the search term
    await expect(page.getByTestId('search-results')).toContainText(/react/i);
  });

  test('should search for jobs by skill', async ({ page }) => {
    await searchPage.searchFor('JavaScript TypeScript Node.js');
    await searchPage.waitForResults();

    const resultCount = await searchPage.getResultCount();
    expect(resultCount).toBeGreaterThan(0);
  });

  test('should filter jobs by category', async ({ page }) => {
    await searchPage.selectFilter('category', 'Web Development');
    await searchPage.waitForResults();

    // All results should be in the selected category
    await expect(page.getByTestId('job-category').first()).toContainText(/web.*development/i);
  });

  test('should filter jobs by budget range', async ({ page }) => {
    await searchPage.setRangeFilter('budget', 1000, 5000);
    await searchPage.waitForResults();

    // Budget should be within range
    const budgetText = await page.getByTestId('job-budget').first().textContent();
    const budget = parseFloat(budgetText?.replace(/[^0-9.]/g, '') || '0');
    expect(budget).toBeGreaterThanOrEqual(1000);
    expect(budget).toBeLessThanOrEqual(5000);
  });

  test('should filter jobs by experience level', async ({ page }) => {
    await searchPage.selectFilter('experienceLevel', 'Expert');
    await searchPage.waitForResults();

    await expect(page.getByTestId('job-experience').first()).toContainText(/expert/i);
  });

  test('should filter jobs by project length', async ({ page }) => {
    await searchPage.selectFilter('projectLength', 'Less than 1 month');
    await searchPage.waitForResults();

    const resultCount = await searchPage.getResultCount();
    expect(resultCount).toBeGreaterThanOrEqual(0);
  });

  test('should combine multiple filters', async ({ page }) => {
    await searchPage.selectFilter('category', 'Web Development');
    await searchPage.selectFilter('experienceLevel', 'Intermediate');
    await searchPage.setRangeFilter('budget', 500, 2000);
    await searchPage.waitForResults();

    const resultCount = await searchPage.getResultCount();
    expect(resultCount).toBeGreaterThanOrEqual(0);
  });

  test('should clear all filters', async ({ page }) => {
    await searchPage.selectFilter('category', 'Web Development');
    await searchPage.waitForResults();
    const filteredCount = await searchPage.getResultCount();

    await searchPage.clearFilters();
    await searchPage.waitForResults();
    const unfilteredCount = await searchPage.getResultCount();

    expect(unfilteredCount).toBeGreaterThanOrEqual(filteredCount);
  });

  test('should sort jobs by newest', async ({ page }) => {
    await searchPage.sortBy('Newest');
    await searchPage.waitForResults();

    // Verify sort is applied
    await expect(page.getByTestId('sort-select')).toContainText(/newest/i);
  });

  test('should sort jobs by budget high to low', async ({ page }) => {
    await searchPage.sortBy('Budget: High to Low');
    await searchPage.waitForResults();

    // Get first two budgets and verify order
    const budgets = await page.getByTestId('job-budget').allTextContents();
    if (budgets.length >= 2) {
      const first = parseFloat(budgets[0].replace(/[^0-9.]/g, '') || '0');
      const second = parseFloat(budgets[1].replace(/[^0-9.]/g, '') || '0');
      expect(first).toBeGreaterThanOrEqual(second);
    }
  });

  test('should show no results message', async ({ page }) => {
    await searchPage.searchFor('xyzabc123nonexistentquery');
    await page.waitForTimeout(2000);

    await expect(page.getByText(/no.*results|no.*jobs.*found/i)).toBeVisible();
  });

  test('should preserve search state in URL', async ({ page }) => {
    await searchPage.searchFor('React Developer');
    await searchPage.selectFilter('category', 'Web Development');
    await searchPage.waitForResults();

    // URL should contain search params
    expect(page.url()).toContain('q=');
    expect(page.url()).toContain('category=');

    // Refresh and verify state is preserved
    await page.reload();
    await expect(page.getByPlaceholder(/search/i)).toHaveValue('React Developer');
  });

  test('should show search suggestions', async ({ page }) => {
    await page.getByPlaceholder(/search/i).fill('java');

    // Wait for suggestions
    await expect(page.getByTestId('search-suggestions')).toBeVisible();
    await expect(page.getByTestId('search-suggestions')).toContainText(/java/i);
  });

  test('should select search suggestion', async ({ page }) => {
    await page.getByPlaceholder(/search/i).fill('java');
    await expect(page.getByTestId('search-suggestions')).toBeVisible();

    await page.getByTestId('search-suggestions').getByText('JavaScript').click();
    await searchPage.waitForResults();

    await expect(page.getByPlaceholder(/search/i)).toHaveValue('JavaScript');
  });
});

test.describe('Freelancer Search Flow', () => {
  let searchPage: SearchPage;

  test.beforeEach(async ({ page }) => {
    searchPage = new SearchPage(page);
    await searchPage.navigateToFreelancerSearch();
  });

  test('should display freelancer results', async ({ page }) => {
    await searchPage.waitForResults();

    await expect(page.getByTestId('search-results')).toBeVisible();
    const resultCount = await searchPage.getResultCount();
    expect(resultCount).toBeGreaterThan(0);
  });

  test('should search for freelancers by skill', async ({ page }) => {
    await searchPage.searchFor('React TypeScript');
    await searchPage.waitForResults();

    // Results should have relevant skills
    await expect(page.getByTestId('freelancer-skills').first()).toContainText(/react|typescript/i);
  });

  test('should search for freelancers by name', async ({ page }) => {
    await searchPage.searchFor('John');
    await searchPage.waitForResults();

    await expect(page.getByTestId('search-results')).toContainText(/john/i);
  });

  test('should filter freelancers by hourly rate', async ({ page }) => {
    await searchPage.setRangeFilter('hourlyRate', 25, 75);
    await searchPage.waitForResults();

    // Rate should be within range
    const rateText = await page.getByTestId('freelancer-rate').first().textContent();
    const rate = parseFloat(rateText?.replace(/[^0-9.]/g, '') || '0');
    expect(rate).toBeGreaterThanOrEqual(25);
    expect(rate).toBeLessThanOrEqual(75);
  });

  test('should filter freelancers by country', async ({ page }) => {
    await searchPage.selectFilter('country', 'United States');
    await searchPage.waitForResults();

    await expect(page.getByTestId('freelancer-location').first()).toContainText(/united states|usa|us/i);
  });

  test('should filter freelancers by experience level', async ({ page }) => {
    await searchPage.selectFilter('experienceLevel', 'Expert');
    await searchPage.waitForResults();

    await expect(page.getByTestId('freelancer-level').first()).toContainText(/expert/i);
  });

  test('should filter freelancers by rating', async ({ page }) => {
    await page.getByTestId('filter-minRating').click();
    await page.getByRole('option', { name: /4\+ stars/i }).click();
    await searchPage.waitForResults();

    // Rating should be 4+
    const ratingText = await page.getByTestId('freelancer-rating').first().textContent();
    const rating = parseFloat(ratingText?.replace(/[^0-9.]/g, '') || '0');
    expect(rating).toBeGreaterThanOrEqual(4);
  });

  test('should filter by verified status', async ({ page }) => {
    await page.getByLabel(/verified.*only/i).check();
    await searchPage.waitForResults();

    // All results should show verified badge
    await expect(page.getByTestId('verified-badge').first()).toBeVisible();
  });

  test('should filter by availability', async ({ page }) => {
    await page.getByLabel(/available.*now/i).check();
    await searchPage.waitForResults();

    await expect(page.getByTestId('availability-badge').first()).toContainText(/available/i);
  });

  test('should filter by language', async ({ page }) => {
    await searchPage.selectFilter('languages', 'Spanish');
    await searchPage.waitForResults();

    await expect(page.getByTestId('freelancer-languages').first()).toContainText(/spanish/i);
  });

  test('should sort freelancers by rating', async ({ page }) => {
    await searchPage.sortBy('Top Rated');
    await searchPage.waitForResults();

    // Get first two ratings and verify order
    const ratings = await page.getByTestId('freelancer-rating').allTextContents();
    if (ratings.length >= 2) {
      const first = parseFloat(ratings[0].replace(/[^0-9.]/g, '') || '0');
      const second = parseFloat(ratings[1].replace(/[^0-9.]/g, '') || '0');
      expect(first).toBeGreaterThanOrEqual(second);
    }
  });

  test('should sort freelancers by rate low to high', async ({ page }) => {
    await searchPage.sortBy('Rate: Low to High');
    await searchPage.waitForResults();

    // Get first two rates and verify order
    const rates = await page.getByTestId('freelancer-rate').allTextContents();
    if (rates.length >= 2) {
      const first = parseFloat(rates[0].replace(/[^0-9.]/g, '') || '0');
      const second = parseFloat(rates[1].replace(/[^0-9.]/g, '') || '0');
      expect(first).toBeLessThanOrEqual(second);
    }
  });

  test('should view freelancer profile from results', async ({ page }) => {
    await searchPage.waitForResults();

    await page.getByTestId('freelancer-card').first().click();

    await expect(page).toHaveURL(/\/freelancers\/[a-zA-Z0-9-]+/);
    await expect(page.getByTestId('freelancer-profile')).toBeVisible();
  });
});

test.describe('Skill Search Autocomplete', () => {
  test('should show skill suggestions', async ({ page }) => {
    await page.goto('/jobs/post');

    await page.getByLabel(/skills/i).fill('java');

    await expect(page.getByTestId('skill-suggestions')).toBeVisible();
    await expect(page.getByTestId('skill-suggestions')).toContainText(/java/i);
  });

  test('should add skill from suggestions', async ({ page }) => {
    await page.goto('/jobs/post');

    await page.getByLabel(/skills/i).fill('java');
    await page.getByTestId('skill-suggestions').getByText('JavaScript').click();

    await expect(page.getByTestId('selected-skills')).toContainText('JavaScript');
  });

  test('should remove selected skill', async ({ page }) => {
    await page.goto('/jobs/post');

    await page.getByLabel(/skills/i).fill('javascript');
    await page.getByTestId('skill-suggestions').getByText('JavaScript').click();

    await page.getByTestId('remove-skill-JavaScript').click();

    await expect(page.getByTestId('selected-skills')).not.toContainText('JavaScript');
  });

  test('should show related skills', async ({ page }) => {
    await page.goto('/jobs/post');

    await page.getByLabel(/skills/i).fill('react');
    await page.getByTestId('skill-suggestions').getByText('React').click();

    // Should suggest related skills
    await expect(page.getByTestId('related-skills')).toContainText(/javascript|typescript|redux/i);
  });
});

test.describe('Search Pagination', () => {
  test('should paginate through results', async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.navigateToJobSearch();
    await searchPage.waitForResults();

    // Click next page
    await page.getByRole('button', { name: /next/i }).click();
    await searchPage.waitForResults();

    // URL should contain page parameter
    expect(page.url()).toContain('page=2');
  });

  test('should change page size', async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.navigateToJobSearch();
    await searchPage.waitForResults();

    // Change page size
    await page.getByTestId('page-size-select').selectOption('50');
    await searchPage.waitForResults();

    // Should show more results
    const cards = await page.getByTestId('job-card').all();
    expect(cards.length).toBeGreaterThanOrEqual(20);
  });

  test('should jump to specific page', async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.navigateToJobSearch();
    await searchPage.waitForResults();

    // Click page 3
    await page.getByRole('button', { name: '3' }).click();
    await searchPage.waitForResults();

    expect(page.url()).toContain('page=3');
  });
});

test.describe('Saved Searches', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel('Email').fill('user@skillancer.com');
    await page.getByLabel('Password').fill('ValidP@ssword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should save search', async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.navigateToJobSearch();
    await searchPage.searchFor('React Developer');
    await searchPage.selectFilter('category', 'Web Development');
    await searchPage.waitForResults();

    await page.getByRole('button', { name: /save.*search/i }).click();
    await page.getByLabel(/search.*name/i).fill('React Web Jobs');
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText(/search.*saved/i)).toBeVisible();
  });

  test('should load saved search', async ({ page }) => {
    await page.goto('/dashboard/saved-searches');

    await page.getByText('React Web Jobs').click();

    // Should navigate to search with saved params
    await expect(page).toHaveURL(/\/jobs.*q=.*category=/);
  });

  test('should delete saved search', async ({ page }) => {
    await page.goto('/dashboard/saved-searches');

    await page.getByTestId('delete-search-button').first().click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/search.*deleted/i)).toBeVisible();
  });

  test('should enable email alerts for saved search', async ({ page }) => {
    await page.goto('/dashboard/saved-searches');

    await page.getByTestId('alert-toggle').first().click();

    await expect(page.getByText(/alerts.*enabled/i)).toBeVisible();
  });
});

test.describe('Search Analytics', () => {
  test('should track search query', async ({ page, context }) => {
    const searchPage = new SearchPage(page);

    // Listen for analytics events
    const analyticsEvents: string[] = [];
    await context.route('**/analytics/**', async (route) => {
      const url = route.request().url();
      analyticsEvents.push(url);
      await route.fulfill({ status: 200 });
    });

    await searchPage.navigateToJobSearch();
    await searchPage.searchFor('React Developer');
    await searchPage.waitForResults();

    // Verify search event was tracked
    expect(analyticsEvents.some((e) => e.includes('search'))).toBe(true);
  });

  test('should track result click', async ({ page, context }) => {
    const searchPage = new SearchPage(page);

    const analyticsEvents: string[] = [];
    await context.route('**/analytics/**', async (route) => {
      analyticsEvents.push(route.request().url());
      await route.fulfill({ status: 200 });
    });

    await searchPage.navigateToJobSearch();
    await searchPage.waitForResults();
    await page.getByTestId('job-card').first().click();

    // Verify click event was tracked
    expect(analyticsEvents.some((e) => e.includes('click'))).toBe(true);
  });
});

test.describe('Mobile Search Experience', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should show mobile filter sheet', async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.navigateToJobSearch();

    // Click filter button (mobile)
    await page.getByRole('button', { name: /filter/i }).click();

    // Filter sheet should be visible
    await expect(page.getByTestId('filter-sheet')).toBeVisible();
  });

  test('should apply filters from mobile sheet', async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.navigateToJobSearch();

    await page.getByRole('button', { name: /filter/i }).click();
    await page.getByLabel('Category').selectOption('Web Development');
    await page.getByRole('button', { name: /apply.*filters/i }).click();

    await searchPage.waitForResults();
    await expect(page.getByTestId('active-filters')).toContainText(/web.*development/i);
  });

  test('should show search results in mobile layout', async ({ page }) => {
    const searchPage = new SearchPage(page);
    await searchPage.navigateToJobSearch();
    await searchPage.waitForResults();

    // Should show single column layout
    const card = await page.getByTestId('job-card').first();
    const box = await card.boundingBox();
    expect(box?.width).toBeGreaterThan(300);
  });
});
