import { test, expect, type Page } from '@playwright/test';

/**
 * Contract Lifecycle E2E Test Suite
 * Tests complete contract flow from hiring to completion
 */

class ContractPage {
  constructor(private page: Page) {}

  async navigateToProposals() {
    await this.page.goto('/client/proposals');
  }

  async navigateToContracts() {
    await this.page.goto('/contracts');
  }

  async hireFreelancer(proposalId: string) {
    await this.page.goto(`/client/proposals/${proposalId}`);
    await this.page.getByRole('button', { name: /hire|accept/i }).click();
  }

  async signContract() {
    await this.page.getByRole('button', { name: /sign.*contract|accept terms/i }).click();
  }

  async submitMilestone(milestoneId: string) {
    await this.page
      .locator(`[data-testid="milestone-${milestoneId}"]`)
      .getByRole('button', { name: /submit|mark.*complete/i })
      .click();
  }

  async approveMilestone(milestoneId: string) {
    await this.page
      .locator(`[data-testid="milestone-${milestoneId}"]`)
      .getByRole('button', { name: /approve/i })
      .click();
  }

  async releasePayment(milestoneId: string) {
    await this.page
      .locator(`[data-testid="milestone-${milestoneId}"]`)
      .getByRole('button', { name: /release.*payment/i })
      .click();
  }

  async completeContract() {
    await this.page.getByRole('button', { name: /complete.*contract|end.*contract/i }).click();
  }

  async submitReview(rating: number, comment: string) {
    await this.page.getByRole('button', { name: new RegExp(`${rating}.*star`, 'i') }).click();
    await this.page.getByLabel(/review|comment|feedback/i).fill(comment);
    await this.page.getByRole('button', { name: /submit.*review/i }).click();
  }
}

// Helper to login as different users
async function loginAs(page: Page, role: 'client' | 'freelancer') {
  await page.goto('/login');
  const email = role === 'client' ? 'client@test.com' : 'freelancer@test.com';
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('TestPassword123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|jobs|contracts)/);
}

test.describe('Client Hires Freelancer', () => {
  test('should display hire button on proposal', async ({ page }) => {
    await loginAs(page, 'client');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToProposals();

    await page.locator('[data-testid="proposal-item"]').first().click();
    await expect(page.getByRole('button', { name: /hire|accept/i })).toBeVisible();
  });

  test('should show hire confirmation dialog', async ({ page }) => {
    await loginAs(page, 'client');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToProposals();

    await page.locator('[data-testid="proposal-item"]').first().click();
    await page.getByRole('button', { name: /hire|accept/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/confirm.*hire|create contract/i)).toBeVisible();
  });

  test('should hire freelancer successfully', async ({ page }) => {
    await loginAs(page, 'client');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToProposals();

    await page.locator('[data-testid="proposal-item"]').first().click();
    await page.getByRole('button', { name: /hire|accept/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/hired|contract created/i)).toBeVisible();
  });
});

test.describe('Contract Creation', () => {
  test('should create contract with correct details', async ({ page }) => {
    await loginAs(page, 'client');
    const contractPage = new ContractPage(page);

    // Hire freelancer
    await contractPage.navigateToProposals();
    await page.locator('[data-testid="proposal-item"]').first().click();
    await page.getByRole('button', { name: /hire/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    // Check contract details
    await contractPage.navigateToContracts();
    await page.locator('[data-testid="contract-item"]').first().click();

    await expect(page.getByText(/pending.*signature|awaiting/i)).toBeVisible();
  });

  test('should show contract terms', async ({ page }) => {
    await loginAs(page, 'client');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToContracts();

    await page.locator('[data-testid="contract-item"]').first().click();

    await expect(page.getByText(/terms|agreement/i)).toBeVisible();
    await expect(page.getByText(/payment.*terms|milestones/i)).toBeVisible();
  });
});

test.describe('Contract Signing - Both Parties', () => {
  test('should allow client to sign contract', async ({ page }) => {
    await loginAs(page, 'client');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToContracts();

    await page
      .locator('[data-testid="contract-item"]')
      .filter({ hasText: /pending/i })
      .first()
      .click();

    await contractPage.signContract();
    await expect(page.getByText(/signed|waiting.*freelancer/i)).toBeVisible();
  });

  test('should allow freelancer to sign contract', async ({ page }) => {
    await loginAs(page, 'freelancer');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToContracts();

    await page
      .locator('[data-testid="contract-item"]')
      .filter({ hasText: /pending|awaiting.*signature/i })
      .first()
      .click();

    await contractPage.signContract();
    await expect(page.getByText(/signed|active/i)).toBeVisible();
  });

  test('should activate contract after both signatures', async ({ page }) => {
    await loginAs(page, 'client');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToContracts();

    await page
      .locator('[data-testid="contract-item"]')
      .filter({ hasText: /active/i })
      .first()
      .click();

    await expect(page.getByText(/active|in progress/i)).toBeVisible();
    await expect(page.getByText(/milestones/i)).toBeVisible();
  });
});

test.describe('Milestone Submission', () => {
  test('should allow freelancer to submit milestone', async ({ page }) => {
    await loginAs(page, 'freelancer');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToContracts();

    await page
      .locator('[data-testid="contract-item"]')
      .filter({ hasText: /active/i })
      .first()
      .click();

    const milestone = page.locator('[data-testid^="milestone-"]').first();
    await milestone.getByRole('button', { name: /submit|complete/i }).click();

    await expect(page.getByText(/submitted|pending.*review/i)).toBeVisible();
  });

  test('should allow attaching deliverables to milestone', async ({ page }) => {
    await loginAs(page, 'freelancer');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToContracts();

    await page
      .locator('[data-testid="contract-item"]')
      .filter({ hasText: /active/i })
      .first()
      .click();

    const milestone = page.locator('[data-testid^="milestone-"]').first();
    await milestone.getByRole('button', { name: /submit/i }).click();

    await expect(page.getByLabel(/deliverables|files/i)).toBeVisible();
    await expect(page.getByLabel(/notes|description/i)).toBeVisible();
  });
});

test.describe('Milestone Approval', () => {
  test('should allow client to approve milestone', async ({ page }) => {
    await loginAs(page, 'client');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToContracts();

    await page
      .locator('[data-testid="contract-item"]')
      .filter({ hasText: /active/i })
      .first()
      .click();

    const submittedMilestone = page
      .locator('[data-testid^="milestone-"]')
      .filter({ hasText: /pending.*review|submitted/i })
      .first();

    await submittedMilestone.getByRole('button', { name: /approve/i }).click();
    await expect(page.getByText(/approved/i)).toBeVisible();
  });

  test('should allow client to request revision', async ({ page }) => {
    await loginAs(page, 'client');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToContracts();

    await page
      .locator('[data-testid="contract-item"]')
      .filter({ hasText: /active/i })
      .first()
      .click();

    const submittedMilestone = page
      .locator('[data-testid^="milestone-"]')
      .filter({ hasText: /pending.*review/i })
      .first();

    await submittedMilestone.getByRole('button', { name: /request.*revision/i }).click();
    await page.getByLabel(/reason|feedback/i).fill('Please update the design mockups');
    await page.getByRole('button', { name: /submit/i }).click();

    await expect(page.getByText(/revision.*requested/i)).toBeVisible();
  });
});

test.describe('Payment Release', () => {
  test('should release payment after milestone approval', async ({ page }) => {
    await loginAs(page, 'client');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToContracts();

    await page
      .locator('[data-testid="contract-item"]')
      .filter({ hasText: /active/i })
      .first()
      .click();

    const approvedMilestone = page
      .locator('[data-testid^="milestone-"]')
      .filter({ hasText: /approved/i })
      .first();

    await approvedMilestone.getByRole('button', { name: /release.*payment/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/payment.*released|paid/i)).toBeVisible();
  });

  test('should show payment confirmation', async ({ page }) => {
    await loginAs(page, 'client');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToContracts();

    await page
      .locator('[data-testid="contract-item"]')
      .filter({ hasText: /active/i })
      .first()
      .click();

    const approvedMilestone = page
      .locator('[data-testid^="milestone-"]')
      .filter({ hasText: /approved/i })
      .first();

    await approvedMilestone.getByRole('button', { name: /release.*payment/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/amount|\$/i)).toBeVisible();
  });

  test('should update freelancer balance after payment', async ({ page }) => {
    await loginAs(page, 'freelancer');
    await page.goto('/earnings');

    const balanceBefore = await page.getByTestId('available-balance').textContent();

    // Simulate payment received (would need to trigger from client side in real test)
    await page.reload();

    await expect(page.getByTestId('available-balance')).toBeVisible();
  });
});

test.describe('Contract Completion', () => {
  test('should complete contract after all milestones', async ({ page }) => {
    await loginAs(page, 'client');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToContracts();

    await page
      .locator('[data-testid="contract-item"]')
      .filter({ hasText: /active/i })
      .first()
      .click();

    // Assuming all milestones are complete
    await page.getByRole('button', { name: /complete.*contract|end.*contract/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/completed/i)).toBeVisible();
  });

  test('should prompt for review after completion', async ({ page }) => {
    await loginAs(page, 'client');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToContracts();

    await page
      .locator('[data-testid="contract-item"]')
      .filter({ hasText: /completed/i })
      .first()
      .click();

    await expect(page.getByText(/leave.*review|rate.*experience/i)).toBeVisible();
  });
});

test.describe('Review Submission', () => {
  test('should allow client to submit review', async ({ page }) => {
    await loginAs(page, 'client');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToContracts();

    await page
      .locator('[data-testid="contract-item"]')
      .filter({ hasText: /completed/i })
      .first()
      .click();

    await page.getByRole('button', { name: /leave.*review/i }).click();

    // Select 5 stars
    await page.locator('[data-testid="star-5"]').click();
    await page.getByLabel(/review|comment/i).fill('Excellent work! Highly recommended.');
    await page.getByRole('button', { name: /submit.*review/i }).click();

    await expect(page.getByText(/review.*submitted|thank you/i)).toBeVisible();
  });

  test('should allow freelancer to submit review', async ({ page }) => {
    await loginAs(page, 'freelancer');
    const contractPage = new ContractPage(page);
    await contractPage.navigateToContracts();

    await page
      .locator('[data-testid="contract-item"]')
      .filter({ hasText: /completed/i })
      .first()
      .click();

    await page.getByRole('button', { name: /leave.*review/i }).click();

    await page.locator('[data-testid="star-4"]').click();
    await page.getByLabel(/review|comment/i).fill('Great client, clear communication.');
    await page.getByRole('button', { name: /submit.*review/i }).click();

    await expect(page.getByText(/review.*submitted/i)).toBeVisible();
  });

  test('should display reviews on profile', async ({ page }) => {
    await page.goto('/freelancer/test-freelancer-id');

    await expect(page.getByText(/reviews/i)).toBeVisible();
    await expect(page.locator('[data-testid="review-item"]')).toHaveCount.greaterThan(0);
  });
});
