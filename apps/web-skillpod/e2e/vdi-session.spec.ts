import { test, expect, type Page } from '@playwright/test';

/**
 * VDI Session E2E Test Suite
 * Tests SkillPod secure virtual desktop sessions
 */

class VDIPage {
  constructor(private page: Page) {}

  async navigateToSkillPod() {
    await this.page.goto('/skillpod');
  }

  async createPod(name: string, config: { os: string; memory: string; storage: string }) {
    await this.page.getByRole('button', { name: /create.*pod|new.*pod/i }).click();
    await this.page.getByLabel(/pod.*name|name/i).fill(name);
    await this.page.getByLabel(/operating.*system|os/i).selectOption(config.os);
    await this.page.getByLabel(/memory|ram/i).selectOption(config.memory);
    await this.page.getByLabel(/storage/i).selectOption(config.storage);
    await this.page.getByRole('button', { name: /create/i }).click();
  }

  async connectToSession(podId: string) {
    await this.page.goto(`/skillpod/${podId}`);
    await this.page.getByRole('button', { name: /connect|start.*session/i }).click();
  }

  async terminateSession() {
    await this.page.getByRole('button', { name: /end.*session|disconnect/i }).click();
    await this.page.getByRole('button', { name: /confirm/i }).click();
  }
}

async function loginAsFreelancer(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('freelancer@test.com');
  await page.getByLabel('Password').fill('TestPassword123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|skillpod)/);
}

test.describe('Create Pod', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should display pod creation form', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await page.getByRole('button', { name: /create.*pod|new.*pod/i }).click();

    await expect(page.getByLabel(/pod.*name|name/i)).toBeVisible();
    await expect(page.getByLabel(/operating.*system|os/i)).toBeVisible();
    await expect(page.getByLabel(/memory|ram/i)).toBeVisible();
  });

  test('should create pod with valid configuration', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await vdiPage.createPod('Development Pod', {
      os: 'ubuntu-22.04',
      memory: '8gb',
      storage: '50gb',
    });

    await expect(page.getByText(/pod.*created|provisioning/i)).toBeVisible();
  });

  test('should show pod in list after creation', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await vdiPage.createPod('Test Pod', {
      os: 'ubuntu-22.04',
      memory: '4gb',
      storage: '25gb',
    });

    await expect(
      page.locator('[data-testid="pod-item"]').filter({ hasText: 'Test Pod' })
    ).toBeVisible();
  });

  test('should validate pod name uniqueness', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    // Try to create pod with existing name
    await vdiPage.createPod('Existing Pod Name', {
      os: 'ubuntu-22.04',
      memory: '4gb',
      storage: '25gb',
    });

    await expect(page.getByText(/already.*exists|name.*taken/i)).toBeVisible();
  });
});

test.describe('Connect to Session', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should connect to ready pod', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    // Click on a ready pod
    await page
      .locator('[data-testid="pod-item"]')
      .filter({ hasText: /ready|available/i })
      .first()
      .click();

    await page.getByRole('button', { name: /connect|start.*session/i }).click();

    await expect(page.getByText(/connecting|initializing/i)).toBeVisible();
    await expect(page.locator('[data-testid="vdi-canvas"]')).toBeVisible({ timeout: 30000 });
  });

  test('should show connection status', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await page.locator('[data-testid="pod-item"]').filter({ hasText: /ready/i }).first().click();
    await page.getByRole('button', { name: /connect/i }).click();

    await expect(page.getByText(/connected|active/i)).toBeVisible({ timeout: 30000 });
  });

  test('should display session toolbar', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await page.locator('[data-testid="pod-item"]').filter({ hasText: /ready/i }).first().click();
    await page.getByRole('button', { name: /connect/i }).click();

    await page.waitForSelector('[data-testid="vdi-canvas"]');

    await expect(page.getByRole('button', { name: /fullscreen/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /end.*session/i })).toBeVisible();
  });

  test('should handle connection failure gracefully', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    // Try to connect to unavailable pod
    await page
      .locator('[data-testid="pod-item"]')
      .filter({ hasText: /offline|unavailable/i })
      .first()
      .click();

    await page.getByRole('button', { name: /connect/i }).click();

    await expect(page.getByText(/connection.*failed|unable.*connect/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  });
});

test.describe('Containment Policy - Clipboard Blocking', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should block clipboard paste from host', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await page.locator('[data-testid="pod-item"]').filter({ hasText: /ready/i }).first().click();
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForSelector('[data-testid="vdi-canvas"]');

    // Try to paste
    await page.keyboard.press('Control+V');

    await expect(page.getByText(/clipboard.*blocked|paste.*disabled/i)).toBeVisible();
  });

  test('should block clipboard copy to host', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await page.locator('[data-testid="pod-item"]').filter({ hasText: /ready/i }).first().click();
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForSelector('[data-testid="vdi-canvas"]');

    // Try to copy
    await page.keyboard.press('Control+C');

    await expect(page.getByText(/clipboard.*blocked|copy.*disabled/i)).toBeVisible();
  });

  test('should log clipboard violation attempt', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await page.locator('[data-testid="pod-item"]').filter({ hasText: /ready/i }).first().click();
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForSelector('[data-testid="vdi-canvas"]');

    await page.keyboard.press('Control+V');

    // Check violation is logged
    await vdiPage.terminateSession();
    await page.goto('/skillpod/violations');

    await expect(
      page.locator('[data-testid="violation-item"]').filter({ hasText: /clipboard/i })
    ).toBeVisible();
  });
});

test.describe('Containment Policy - File Transfer Blocking', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should block file download', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await page.locator('[data-testid="pod-item"]').filter({ hasText: /ready/i }).first().click();
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForSelector('[data-testid="vdi-canvas"]');

    // Try to trigger download (simulated)
    await page.evaluate(() => {
      const event = new CustomEvent('download-attempt', { detail: { file: 'test.txt' } });
      document.dispatchEvent(event);
    });

    await expect(page.getByText(/download.*blocked|file.*transfer.*disabled/i)).toBeVisible();
  });

  test('should block file upload', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await page.locator('[data-testid="pod-item"]').filter({ hasText: /ready/i }).first().click();
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForSelector('[data-testid="vdi-canvas"]');

    // Try to upload (drag and drop)
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await page.locator('[data-testid="vdi-canvas"]').dispatchEvent('drop', { dataTransfer });

    await expect(page.getByText(/upload.*blocked|file.*transfer.*disabled/i)).toBeVisible();
  });
});

test.describe('Session Recording Verification', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should show recording indicator', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await page.locator('[data-testid="pod-item"]').filter({ hasText: /ready/i }).first().click();
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForSelector('[data-testid="vdi-canvas"]');

    await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
    await expect(page.getByText(/recording|session.*recorded/i)).toBeVisible();
  });

  test('should save recording on session end', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await page.locator('[data-testid="pod-item"]').filter({ hasText: /ready/i }).first().click();
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForSelector('[data-testid="vdi-canvas"]');

    await vdiPage.terminateSession();

    await expect(page.getByText(/recording.*saved|session.*archived/i)).toBeVisible();
  });

  test('should list recordings in history', async ({ page }) => {
    await page.goto('/skillpod/recordings');

    await expect(page.locator('[data-testid="recording-item"]')).toHaveCount.greaterThan(0);
  });
});

test.describe('Session Termination', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should terminate session gracefully', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await page.locator('[data-testid="pod-item"]').filter({ hasText: /ready/i }).first().click();
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForSelector('[data-testid="vdi-canvas"]');

    await vdiPage.terminateSession();

    await expect(page.getByText(/session.*ended|disconnected/i)).toBeVisible();
    await expect(page.locator('[data-testid="vdi-canvas"]')).not.toBeVisible();
  });

  test('should show session summary on termination', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await page.locator('[data-testid="pod-item"]').filter({ hasText: /ready/i }).first().click();
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForSelector('[data-testid="vdi-canvas"]');

    // Wait some time for session duration
    await page.waitForTimeout(5000);

    await vdiPage.terminateSession();

    await expect(page.getByText(/duration/i)).toBeVisible();
    await expect(page.getByText(/\d+.*minutes?|seconds?/i)).toBeVisible();
  });

  test('should handle unexpected disconnection', async ({ page }) => {
    const vdiPage = new VDIPage(page);
    await vdiPage.navigateToSkillPod();

    await page.locator('[data-testid="pod-item"]').filter({ hasText: /ready/i }).first().click();
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForSelector('[data-testid="vdi-canvas"]');

    // Simulate network disconnect
    await page.context().setOffline(true);

    await expect(page.getByText(/connection.*lost|reconnecting/i)).toBeVisible();

    await page.context().setOffline(false);
  });
});

test.describe('Violation Logging', () => {
  test('should display violation history', async ({ page }) => {
    await loginAsFreelancer(page);
    await page.goto('/skillpod/violations');

    await expect(page.locator('[data-testid="violation-item"]')).toBeVisible();
  });

  test('should show violation details', async ({ page }) => {
    await loginAsFreelancer(page);
    await page.goto('/skillpod/violations');

    await page.locator('[data-testid="violation-item"]').first().click();

    await expect(page.getByText(/type|category/i)).toBeVisible();
    await expect(page.getByText(/timestamp|time/i)).toBeVisible();
    await expect(page.getByText(/session|pod/i)).toBeVisible();
  });

  test('should filter violations by type', async ({ page }) => {
    await loginAsFreelancer(page);
    await page.goto('/skillpod/violations');

    await page.getByRole('combobox', { name: /type|filter/i }).selectOption('clipboard');

    const violations = page.locator('[data-testid="violation-item"]');
    const count = await violations.count();

    for (let i = 0; i < count; i++) {
      await expect(violations.nth(i)).toContainText(/clipboard/i);
    }
  });
});
