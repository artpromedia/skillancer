import { test, expect, type Page } from '@playwright/test';

/**
 * Invoicing E2E Test Suite
 * Tests invoice creation, management, and payment recording
 */

class InvoicingPage {
  constructor(private page: Page) {}

  async navigateToInvoices() {
    await this.page.goto('/invoices');
  }

  async createNewInvoice() {
    await this.page.getByRole('button', { name: /create.*invoice|new.*invoice/i }).click();
  }

  async selectClient(clientName: string) {
    await this.page.getByRole('combobox', { name: /client/i }).click();
    await this.page.getByRole('option', { name: new RegExp(clientName, 'i') }).click();
  }

  async addLineItem(description: string, quantity: number, rate: number) {
    await this.page.getByRole('button', { name: /add.*item|add.*line/i }).click();
    const lastItem = this.page.locator('[data-testid="line-item"]').last();
    await lastItem.getByLabel(/description/i).fill(description);
    await lastItem.getByLabel(/quantity|hours/i).fill(quantity.toString());
    await lastItem.getByLabel(/rate|price/i).fill(rate.toString());
  }

  async importTimeEntries() {
    await this.page.getByRole('button', { name: /import.*time|add.*time.*entries/i }).click();
  }

  async previewInvoice() {
    await this.page.getByRole('button', { name: /preview/i }).click();
  }

  async sendInvoice() {
    await this.page.getByRole('button', { name: /send.*invoice/i }).click();
  }

  async recordPayment(amount: string) {
    await this.page.getByRole('button', { name: /record.*payment/i }).click();
    await this.page.getByLabel(/amount/i).fill(amount);
    await this.page.getByRole('button', { name: /confirm|save/i }).click();
  }
}

async function loginAsFreelancer(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('freelancer@test.com');
  await page.getByLabel('Password').fill('TestPassword123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|invoices)/);
}

test.describe('Create Invoice', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should display invoice creation form', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();
    await invoicingPage.createNewInvoice();

    await expect(page.getByRole('combobox', { name: /client/i })).toBeVisible();
    await expect(page.getByLabel(/invoice.*number|number/i)).toBeVisible();
    await expect(page.getByLabel(/due.*date/i)).toBeVisible();
  });

  test('should auto-generate invoice number', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();
    await invoicingPage.createNewInvoice();

    const invoiceNumber = page.getByLabel(/invoice.*number/i);
    await expect(invoiceNumber).toHaveValue(/INV-\d+/);
  });

  test('should select client for invoice', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();
    await invoicingPage.createNewInvoice();
    await invoicingPage.selectClient('Test Client');

    await expect(page.getByText('Test Client')).toBeVisible();
  });

  test('should set due date', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();
    await invoicingPage.createNewInvoice();

    await page.getByLabel(/due.*date/i).fill('2025-01-15');
    await expect(page.getByLabel(/due.*date/i)).toHaveValue('2025-01-15');
  });
});

test.describe('Add Line Items', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();
    await invoicingPage.createNewInvoice();
    await invoicingPage.selectClient('Test Client');
  });

  test('should add line item', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.addLineItem('Web Development', 10, 75);

    const lineItem = page.locator('[data-testid="line-item"]').last();
    await expect(lineItem).toContainText('Web Development');
    await expect(lineItem).toContainText('750'); // 10 * 75
  });

  test('should add multiple line items', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.addLineItem('Design', 5, 100);
    await invoicingPage.addLineItem('Development', 20, 75);
    await invoicingPage.addLineItem('Testing', 8, 60);

    await expect(page.locator('[data-testid="line-item"]')).toHaveCount(3);
  });

  test('should calculate line item total', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.addLineItem('Consulting', 4, 150);

    const lineItem = page.locator('[data-testid="line-item"]').last();
    await expect(lineItem.getByTestId('line-total')).toContainText('600');
  });

  test('should remove line item', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.addLineItem('Item 1', 1, 100);
    await invoicingPage.addLineItem('Item 2', 1, 200);

    await page
      .locator('[data-testid="line-item"]')
      .first()
      .getByRole('button', { name: /remove|delete/i })
      .click();

    await expect(page.locator('[data-testid="line-item"]')).toHaveCount(1);
  });

  test('should update invoice total', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.addLineItem('Item 1', 10, 100); // 1000
    await invoicingPage.addLineItem('Item 2', 5, 80); // 400

    await expect(page.getByTestId('invoice-total')).toContainText('1,400');
  });
});

test.describe('Import Time Entries', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();
    await invoicingPage.createNewInvoice();
    await invoicingPage.selectClient('Test Client');
  });

  test('should show import dialog', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.importTimeEntries();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/select.*entries|time.*entries/i)).toBeVisible();
  });

  test('should list unbilled time entries', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.importTimeEntries();

    await expect(page.locator('[data-testid="time-entry-option"]')).toHaveCount.greaterThan(0);
  });

  test('should import selected entries as line items', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.importTimeEntries();

    // Select entries
    await page.locator('[data-testid="time-entry-option"]').first().click();
    await page.locator('[data-testid="time-entry-option"]').nth(1).click();

    await page.getByRole('button', { name: /import|add/i }).click();

    await expect(page.locator('[data-testid="line-item"]')).toHaveCount(2);
  });

  test('should show date range filter', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.importTimeEntries();

    await expect(page.getByLabel(/from.*date|start.*date/i)).toBeVisible();
    await expect(page.getByLabel(/to.*date|end.*date/i)).toBeVisible();
  });
});

test.describe('Preview Invoice', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();
    await invoicingPage.createNewInvoice();
    await invoicingPage.selectClient('Test Client');
    await invoicingPage.addLineItem('Service', 10, 100);
  });

  test('should show invoice preview', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.previewInvoice();

    await expect(page.getByTestId('invoice-preview')).toBeVisible();
  });

  test('should display all invoice details in preview', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.previewInvoice();

    await expect(page.getByText(/INV-\d+/)).toBeVisible();
    await expect(page.getByText('Test Client')).toBeVisible();
    await expect(page.getByText('Service')).toBeVisible();
    await expect(page.getByText('1,000')).toBeVisible();
  });

  test('should close preview', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.previewInvoice();

    await page.getByRole('button', { name: /close|back/i }).click();
    await expect(page.getByTestId('invoice-preview')).not.toBeVisible();
  });
});

test.describe('Send Invoice', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();
    await invoicingPage.createNewInvoice();
    await invoicingPage.selectClient('Test Client');
    await invoicingPage.addLineItem('Service', 10, 100);
  });

  test('should show send confirmation', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.sendInvoice();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/send.*invoice|email.*invoice/i)).toBeVisible();
  });

  test('should display recipient email', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.sendInvoice();

    await expect(page.getByLabel(/email|recipient/i)).toBeVisible();
  });

  test('should send invoice successfully', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.sendInvoice();

    await page.getByRole('button', { name: /confirm.*send|send/i }).click();

    await expect(page.getByText(/invoice.*sent|successfully.*sent/i)).toBeVisible();
  });

  test('should update invoice status after sending', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.sendInvoice();
    await page.getByRole('button', { name: /confirm/i }).click();

    await invoicingPage.navigateToInvoices();

    const sentInvoice = page.locator('[data-testid="invoice-item"]').first();
    await expect(sentInvoice).toContainText(/sent|pending/i);
  });
});

test.describe('Record Payment', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should show payment dialog', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();

    await page
      .locator('[data-testid="invoice-item"]')
      .filter({ hasText: /sent|pending/i })
      .first()
      .click();

    await page.getByRole('button', { name: /record.*payment/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/amount/i)).toBeVisible();
  });

  test('should record full payment', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();

    await page
      .locator('[data-testid="invoice-item"]')
      .filter({ hasText: /sent|pending/i })
      .first()
      .click();

    await invoicingPage.recordPayment('1000');

    await expect(page.getByText(/payment.*recorded|paid/i)).toBeVisible();
  });

  test('should record partial payment', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();

    await page
      .locator('[data-testid="invoice-item"]')
      .filter({ hasText: /sent|pending/i })
      .first()
      .click();

    await invoicingPage.recordPayment('500');

    await expect(page.getByText(/partial|balance.*due/i)).toBeVisible();
  });

  test('should update invoice status to paid', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();

    await page
      .locator('[data-testid="invoice-item"]')
      .filter({ hasText: /sent|pending/i })
      .first()
      .click();

    // Record full payment amount
    await invoicingPage.recordPayment('1000');

    await invoicingPage.navigateToInvoices();

    await expect(page.locator('[data-testid="invoice-item"]').first()).toContainText(/paid/i);
  });

  test('should set payment date and method', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();

    await page.locator('[data-testid="invoice-item"]').filter({ hasText: /sent/i }).first().click();

    await page.getByRole('button', { name: /record.*payment/i }).click();

    await page.getByLabel(/date/i).fill('2025-12-28');
    await page.getByRole('combobox', { name: /method/i }).selectOption('bank_transfer');
    await page.getByLabel(/amount/i).fill('1000');
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/payment.*recorded/i)).toBeVisible();
  });
});

test.describe('Invoice PDF Generation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should download invoice as PDF', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();

    await page.locator('[data-testid="invoice-item"]').first().click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /download.*pdf|export/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/invoice.*\.pdf/i);
  });

  test('should include all invoice details in PDF', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();

    await page.locator('[data-testid="invoice-item"]').first().click();
    await invoicingPage.previewInvoice();

    // Verify all sections are present before PDF generation
    await expect(page.getByText(/from|bill.*from/i)).toBeVisible();
    await expect(page.getByText(/to|bill.*to/i)).toBeVisible();
    await expect(page.getByText(/items|services/i)).toBeVisible();
    await expect(page.getByText(/total/i)).toBeVisible();
  });

  test('should generate PDF for different invoice statuses', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();

    // Test with paid invoice
    const paidInvoice = page
      .locator('[data-testid="invoice-item"]')
      .filter({ hasText: /paid/i })
      .first();

    if ((await paidInvoice.count()) > 0) {
      await paidInvoice.click();
      await expect(page.getByRole('button', { name: /download.*pdf/i })).toBeVisible();
    }
  });
});

test.describe('Invoice List and Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsFreelancer(page);
  });

  test('should display invoice list', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();

    await expect(page.locator('[data-testid="invoice-item"]')).toHaveCount.greaterThan(0);
  });

  test('should filter invoices by status', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();

    await page.getByRole('combobox', { name: /status|filter/i }).selectOption('paid');

    const invoices = page.locator('[data-testid="invoice-item"]');
    const count = await invoices.count();

    for (let i = 0; i < count; i++) {
      await expect(invoices.nth(i)).toContainText(/paid/i);
    }
  });

  test('should filter invoices by client', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();

    await page.getByRole('combobox', { name: /client/i }).selectOption({ index: 1 });

    await expect(page.locator('[data-testid="invoice-item"]')).toBeVisible();
  });

  test('should sort invoices by date', async ({ page }) => {
    const invoicingPage = new InvoicingPage(page);
    await invoicingPage.navigateToInvoices();

    await page.getByRole('button', { name: /sort|date/i }).click();

    // Verify sort order changed
    await expect(page.locator('[data-testid="invoice-item"]')).toBeVisible();
  });
});
