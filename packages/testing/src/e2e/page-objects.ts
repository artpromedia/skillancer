/**
 * E2E Test Page Objects
 *
 * Page object models for Playwright E2E tests.
 */

import { type Page, type Locator, expect } from '@playwright/test';

// ==================== Base Page ====================

/**
 * Base page object with common functionality
 */
export abstract class BasePage {
  constructor(protected page: Page) {}

  /**
   * Navigate to the page
   */
  abstract goto(): Promise<void>;

  /**
   * Check if page is loaded
   */
  abstract isLoaded(): Promise<boolean>;

  /**
   * Wait for page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return this.page.title();
  }

  /**
   * Get page URL
   */
  getURL(): string {
    return this.page.url();
  }

  /**
   * Take a screenshot
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  }

  /**
   * Get toast notification
   */
  async getToast(): Promise<Locator> {
    return this.page.locator('[role="alert"], .toast, [data-testid="toast"]').first();
  }

  /**
   * Wait for and verify toast message
   */
  async expectToast(message: string | RegExp): Promise<void> {
    const toast = await this.getToast();
    await expect(toast).toContainText(message);
  }

  /**
   * Click and wait for navigation
   */
  async clickAndNavigate(locator: Locator): Promise<void> {
    await Promise.all([this.page.waitForNavigation({ waitUntil: 'networkidle' }), locator.click()]);
  }
}

// ==================== Login Page ====================

/**
 * Login page object
 */
export class LoginPage extends BasePage {
  // Locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signUpLink: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('input[name="email"], input[type="email"]');
    this.passwordInput = page.locator('input[name="password"], input[type="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.forgotPasswordLink = page.locator('a[href*="forgot"], a:has-text("Forgot")');
    this.signUpLink = page.locator('a[href*="signup"], a[href*="register"]');
    this.errorMessage = page.locator('[data-testid="error-message"], .error-message');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.waitForLoad();
  }

  async isLoaded(): Promise<boolean> {
    await this.emailInput.waitFor({ state: 'visible' });
    return true;
  }

  /**
   * Login with credentials
   */
  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /**
   * Login and expect success
   */
  async loginAndExpectSuccess(email: string, password: string): Promise<void> {
    await this.login(email, password);
    await this.page.waitForURL((url) => !url.pathname.includes('/login'));
  }

  /**
   * Login and expect error
   */
  async loginAndExpectError(
    email: string,
    password: string,
    expectedError?: string | RegExp
  ): Promise<void> {
    await this.login(email, password);
    await expect(this.errorMessage).toBeVisible();
    if (expectedError) {
      await expect(this.errorMessage).toContainText(expectedError);
    }
  }
}

// ==================== Dashboard Page ====================

/**
 * Dashboard page object
 */
export class DashboardPage extends BasePage {
  // Locators
  readonly header: Locator;
  readonly sidebar: Locator;
  readonly userMenu: Locator;
  readonly searchInput: Locator;
  readonly notifications: Locator;
  readonly statsCards: Locator;

  constructor(page: Page) {
    super(page);
    this.header = page.locator('header, [data-testid="header"]');
    this.sidebar = page.locator('nav, aside, [data-testid="sidebar"]');
    this.userMenu = page.locator('[data-testid="user-menu"], .user-menu');
    this.searchInput = page.locator('input[type="search"], [data-testid="search"]');
    this.notifications = page.locator('[data-testid="notifications"]');
    this.statsCards = page.locator('[data-testid="stats-card"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.waitForLoad();
  }

  async isLoaded(): Promise<boolean> {
    await this.header.waitFor({ state: 'visible' });
    return true;
  }

  /**
   * Get stat card value
   */
  async getStatValue(cardIndex: number): Promise<string> {
    const card = this.statsCards.nth(cardIndex);
    const value = card.locator('.value, [data-testid="stat-value"]');
    return value.textContent() ?? '';
  }

  /**
   * Open user menu
   */
  async openUserMenu(): Promise<void> {
    await this.userMenu.click();
  }

  /**
   * Logout from user menu
   */
  async logout(): Promise<void> {
    await this.openUserMenu();
    const logoutButton = this.page.locator('button:has-text("Logout"), a:has-text("Logout")');
    await this.clickAndNavigate(logoutButton);
  }

  /**
   * Search for content
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
  }
}

// ==================== Course Page ====================

/**
 * Course page object
 */
export class CoursePage extends BasePage {
  // Locators
  readonly title: Locator;
  readonly description: Locator;
  readonly instructor: Locator;
  readonly enrollButton: Locator;
  readonly lessonList: Locator;
  readonly progressBar: Locator;

  constructor(page: Page) {
    super(page);
    this.title = page.locator('h1, [data-testid="course-title"]');
    this.description = page.locator('[data-testid="course-description"]');
    this.instructor = page.locator('[data-testid="instructor"]');
    this.enrollButton = page.locator('button:has-text("Enroll"), [data-testid="enroll-button"]');
    this.lessonList = page.locator('[data-testid="lesson-list"]');
    this.progressBar = page.locator('[data-testid="progress-bar"]');
  }

  async goto(courseId?: string): Promise<void> {
    const path = courseId ? `/courses/${courseId}` : '/courses';
    await this.page.goto(path);
    await this.waitForLoad();
  }

  async isLoaded(): Promise<boolean> {
    await this.title.waitFor({ state: 'visible' });
    return true;
  }

  /**
   * Enroll in course
   */
  async enroll(): Promise<void> {
    await this.enrollButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get lesson count
   */
  async getLessonCount(): Promise<number> {
    const lessons = this.lessonList.locator('[data-testid="lesson-item"]');
    return lessons.count();
  }

  /**
   * Navigate to lesson
   */
  async goToLesson(lessonIndex: number): Promise<void> {
    const lessons = this.lessonList.locator('[data-testid="lesson-item"]');
    await lessons.nth(lessonIndex).click();
  }
}

// ==================== Job Listing Page ====================

/**
 * Job listing page object
 */
export class JobListingPage extends BasePage {
  // Locators
  readonly jobList: Locator;
  readonly filters: Locator;
  readonly searchInput: Locator;
  readonly pagination: Locator;
  readonly sortSelect: Locator;

  constructor(page: Page) {
    super(page);
    this.jobList = page.locator('[data-testid="job-list"]');
    this.filters = page.locator('[data-testid="job-filters"]');
    this.searchInput = page.locator('input[name="search"], [data-testid="job-search"]');
    this.pagination = page.locator('[data-testid="pagination"]');
    this.sortSelect = page.locator('[data-testid="sort-select"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/jobs');
    await this.waitForLoad();
  }

  async isLoaded(): Promise<boolean> {
    await this.jobList.waitFor({ state: 'visible' });
    return true;
  }

  /**
   * Search for jobs
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get job count
   */
  async getJobCount(): Promise<number> {
    const jobs = this.jobList.locator('[data-testid="job-card"]');
    return jobs.count();
  }

  /**
   * Click on a job card
   */
  async clickJob(index: number): Promise<void> {
    const jobs = this.jobList.locator('[data-testid="job-card"]');
    await jobs.nth(index).click();
  }

  /**
   * Apply filter
   */
  async applyFilter(filterName: string, value: string): Promise<void> {
    const filter = this.filters.locator(`[data-testid="filter-${filterName}"]`);
    await filter.selectOption(value);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Go to next page
   */
  async nextPage(): Promise<void> {
    const nextButton = this.pagination.locator('button:has-text("Next")');
    await nextButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}

// ==================== Page Object Factory ====================

/**
 * Create page objects for a page
 */
export function createPageObjects(page: Page) {
  return {
    login: new LoginPage(page),
    dashboard: new DashboardPage(page),
    course: new CoursePage(page),
    jobListing: new JobListingPage(page),
  };
}
