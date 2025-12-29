import { test, expect, type Page } from '@playwright/test';

/**
 * Bidding Flow E2E Test Suite
 * Tests complete proposal submission, editing, and management
 */

class BiddingPage {
  constructor(private page: Page) {}

  async navigateToJob(jobId: string) {
    await this.page.goto(`/jobs/${jobId}`);
    await expect(this.page).toHaveURL(new RegExp(`/jobs/${jobId}`));
  }

  async clickApply() {
    await this.page.getByRole('button', { name: /apply|submit proposal/i }).click();
    await expect(this.page).toHaveURL(/\/apply|\/proposal/);
  }

  async fillCoverLetter(text: string) {
    await this.page.getByLabel(/cover letter/i).fill(text);
  }

  async setBidAmount(amount: string) {
    await this.page.getByLabel(/bid.*amount|your.*rate|price/i).fill(amount);
  }

  async selectPricingType(type: 'fixed' | 'hourly') {
    await this.page.getByRole('radio', { name: new RegExp(type, 'i') }).check();
  }

  async addMilestone(title: string, amount: string, description: string) {
    await this.page.getByRole('button', { name: /add milestone/i }).click();
    const milestoneSection = this.page.locator('[data-testid="milestone-item"]').last();
    await milestoneSection.getByLabel(/title/i).fill(title);
    await milestoneSection.getByLabel(/amount/i).fill(amount);
    await milestoneSection.getByLabel(/description/i).fill(description);
  }

  async uploadAttachment(filePath: string) {
    await this.page.getByLabel(/attach.*file|upload/i).setInputFiles(filePath);
  }

  async saveDraft() {
    await this.page.getByRole('button', { name: /save.*draft/i }).click();
  }

  async submitProposal() {
    await this.page.getByRole('button', { name: /submit.*proposal/i }).click();
  }

  async navigateToMyProposals() {
    await this.page.goto('/proposals');
    await expect(this.page).toHaveURL(/\/proposals/);
  }
}

test.describe('Navigate to Job from Search', () => {
  test('should navigate to job detail from search results', async ({ page }) => {
    await page.goto('/jobs');
    await page.getByPlaceholder(/search/i).fill('React');
    await page.getByPlaceholder(/search/i).press('Enter');

    await page.waitForSelector('[data-testid="job-card"]');
    const firstJob = page.locator('[data-testid="job-card"]').first();
    const jobTitle = await firstJob.locator('h3, h4, [data-testid="job-title"]').textContent();

    await firstJob.click();
    await expect(page).toHaveURL(/\/jobs\/[\w-]+/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(jobTitle || '');
  });

  test('should show apply button for authenticated freelancer', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@test.com');
    await page.getByLabel('Password').fill('TestPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.goto('/jobs/test-job-id');
    await expect(page.getByRole('button', { name: /apply|submit proposal/i })).toBeVisible();
  });
});

test.describe('Submit Proposal - Cover Letter', () => {
  test.beforeEach(async ({ page }) => {
    // Login as freelancer
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@test.com');
    await page.getByLabel('Password').fill('TestPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard|jobs)/);
  });

  test('should require cover letter', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();

    await biddingPage.setBidAmount('500');
    await biddingPage.submitProposal();

    await expect(page.getByText(/cover letter.*required/i)).toBeVisible();
  });

  test('should validate cover letter minimum length', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();

    await biddingPage.fillCoverLetter('Too short');
    await biddingPage.setBidAmount('500');
    await biddingPage.submitProposal();

    await expect(page.getByText(/at least \d+ characters/i)).toBeVisible();
  });

  test('should accept valid cover letter', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();

    const coverLetter = `I am excited to apply for this position. 
      With over 5 years of experience in web development, I have worked on 
      numerous projects involving React, TypeScript, and Node.js. 
      I am confident I can deliver high-quality work within your timeline.`;

    await biddingPage.fillCoverLetter(coverLetter);
    await expect(page.getByLabel(/cover letter/i)).toHaveValue(coverLetter);
  });
});

test.describe('Submit Proposal - Pricing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@test.com');
    await page.getByLabel('Password').fill('TestPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
  });

  test('should allow fixed price bidding', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();

    await biddingPage.selectPricingType('fixed');
    await biddingPage.setBidAmount('1500');

    await expect(page.getByText(/\$1,?500/)).toBeVisible();
  });

  test('should allow hourly rate bidding', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();

    await biddingPage.selectPricingType('hourly');
    await biddingPage.setBidAmount('75');

    await expect(page.getByText(/\$75.*hour|hourly/i)).toBeVisible();
  });

  test('should validate minimum bid amount', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();

    await biddingPage.setBidAmount('1');
    await biddingPage.submitProposal();

    await expect(page.getByText(/minimum.*amount|too low/i)).toBeVisible();
  });
});

test.describe('Submit Proposal - Milestones', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@test.com');
    await page.getByLabel('Password').fill('TestPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
  });

  test('should add multiple milestones', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();

    await biddingPage.addMilestone('Design Phase', '500', 'Complete UI/UX design');
    await biddingPage.addMilestone('Development Phase', '1000', 'Build core features');
    await biddingPage.addMilestone('Testing & Launch', '500', 'QA and deployment');

    const milestones = page.locator('[data-testid="milestone-item"]');
    await expect(milestones).toHaveCount(3);
  });

  test('should calculate total from milestones', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();

    await biddingPage.addMilestone('Phase 1', '500', 'First phase');
    await biddingPage.addMilestone('Phase 2', '750', 'Second phase');

    await expect(page.getByText(/total.*\$1,?250/i)).toBeVisible();
  });

  test('should remove milestone', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();

    await biddingPage.addMilestone('Phase 1', '500', 'First phase');
    await biddingPage.addMilestone('Phase 2', '750', 'Second phase');

    await page
      .locator('[data-testid="milestone-item"]')
      .first()
      .getByRole('button', { name: /remove|delete/i })
      .click();

    const milestones = page.locator('[data-testid="milestone-item"]');
    await expect(milestones).toHaveCount(1);
  });
});

test.describe('Draft Saving', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@test.com');
    await page.getByLabel('Password').fill('TestPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
  });

  test('should save proposal as draft', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();

    await biddingPage.fillCoverLetter('This is a draft proposal...');
    await biddingPage.setBidAmount('1000');
    await biddingPage.saveDraft();

    await expect(page.getByText(/draft saved|saved/i)).toBeVisible();
  });

  test('should restore draft on revisit', async ({ page }) => {
    const biddingPage = new BiddingPage(page);

    // Create draft
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();
    await biddingPage.fillCoverLetter('Draft content to restore');
    await biddingPage.setBidAmount('2000');
    await biddingPage.saveDraft();

    // Navigate away and return
    await page.goto('/jobs');
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();

    await expect(page.getByLabel(/cover letter/i)).toContainText('Draft content to restore');
    await expect(page.getByLabel(/bid.*amount|price/i)).toHaveValue('2000');
  });

  test('should auto-save draft periodically', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();

    await biddingPage.fillCoverLetter('Auto-saving this content...');

    // Wait for auto-save
    await page.waitForTimeout(5000);
    await expect(page.getByText(/auto.*saved|saving/i)).toBeVisible();
  });
});

test.describe('Proposal Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@test.com');
    await page.getByLabel('Password').fill('TestPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
  });

  test('should submit proposal successfully', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();

    await biddingPage.fillCoverLetter(`I am excited to apply for this opportunity. 
      My experience in full-stack development makes me an ideal candidate.
      I have delivered over 50 successful projects with a 98% satisfaction rate.`);
    await biddingPage.setBidAmount('1500');
    await biddingPage.submitProposal();

    await expect(page.getByText(/proposal submitted|success/i)).toBeVisible();
    await expect(page).toHaveURL(/\/proposals|\/confirmation/);
  });

  test('should show confirmation with proposal details', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToJob('test-job-id');
    await biddingPage.clickApply();

    await biddingPage.fillCoverLetter('Detailed proposal content for confirmation test...');
    await biddingPage.setBidAmount('2500');
    await biddingPage.submitProposal();

    await expect(page.getByText(/\$2,?500/)).toBeVisible();
    await expect(page.getByRole('link', { name: /view proposal/i })).toBeVisible();
  });
});

test.describe('View Submitted Proposal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@test.com');
    await page.getByLabel('Password').fill('TestPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
  });

  test('should view submitted proposal', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToMyProposals();

    const firstProposal = page.locator('[data-testid="proposal-item"]').first();
    await firstProposal.click();

    await expect(page.getByText(/cover letter/i)).toBeVisible();
    await expect(page.getByText(/bid amount|proposed/i)).toBeVisible();
    await expect(page.getByText(/status/i)).toBeVisible();
  });

  test('should show proposal status', async ({ page }) => {
    const biddingPage = new BiddingPage(page);
    await biddingPage.navigateToMyProposals();

    await expect(page.getByText(/pending|submitted|viewed|shortlisted/i)).toBeVisible();
  });
});

test.describe('Edit Proposal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@test.com');
    await page.getByLabel('Password').fill('TestPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
  });

  test('should edit pending proposal', async ({ page }) => {
    await page.goto('/proposals');

    const pendingProposal = page
      .locator('[data-testid="proposal-item"]')
      .filter({ hasText: /pending/i })
      .first();
    await pendingProposal.click();

    await page.getByRole('button', { name: /edit/i }).click();
    await page.getByLabel(/cover letter/i).fill('Updated cover letter content...');
    await page.getByRole('button', { name: /save|update/i }).click();

    await expect(page.getByText(/updated|saved/i)).toBeVisible();
  });

  test('should not allow editing accepted proposal', async ({ page }) => {
    await page.goto('/proposals');

    const acceptedProposal = page
      .locator('[data-testid="proposal-item"]')
      .filter({ hasText: /accepted/i })
      .first();

    if ((await acceptedProposal.count()) > 0) {
      await acceptedProposal.click();
      await expect(page.getByRole('button', { name: /edit/i })).not.toBeVisible();
    }
  });
});

test.describe('Withdraw Proposal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@test.com');
    await page.getByLabel('Password').fill('TestPassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
  });

  test('should withdraw pending proposal', async ({ page }) => {
    await page.goto('/proposals');

    const pendingProposal = page
      .locator('[data-testid="proposal-item"]')
      .filter({ hasText: /pending/i })
      .first();
    await pendingProposal.click();

    await page.getByRole('button', { name: /withdraw/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/withdrawn|proposal withdrawn/i)).toBeVisible();
  });

  test('should show withdrawal confirmation dialog', async ({ page }) => {
    await page.goto('/proposals');

    const pendingProposal = page
      .locator('[data-testid="proposal-item"]')
      .filter({ hasText: /pending/i })
      .first();
    await pendingProposal.click();

    await page.getByRole('button', { name: /withdraw/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/are you sure|confirm withdrawal/i)).toBeVisible();
  });
});
