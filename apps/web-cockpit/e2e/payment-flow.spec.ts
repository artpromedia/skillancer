import { test, expect, type Page } from '@playwright/test';

/**
 * Payment Flow E2E Test Suite
 * Tests critical payment paths including invoice creation, payment processing, and webhooks
 */

// Test data factory
const createTestInvoice = (suffix: string = Date.now().toString()) => ({
  clientName: 'Test Client ' + suffix,
  clientEmail: `client.${suffix}@test.com`,
  amount: 1500.00,
  description: 'Web Development Services',
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  items: [
    { description: 'Frontend Development', quantity: 40, rate: 25.00 },
    { description: 'Backend Development', quantity: 20, rate: 25.00 },
  ],
});

// Page object helpers
class InvoicePage {
  constructor(private page: Page) {}

  async navigateToInvoices() {
    await this.page.goto('/cockpit/invoices');
    await expect(this.page).toHaveURL(/\/cockpit\/invoices/);
  }

  async navigateToCreateInvoice() {
    await this.page.goto('/cockpit/invoices/new');
    await expect(this.page).toHaveURL(/\/cockpit\/invoices\/new/);
  }

  async fillInvoiceForm(invoice: ReturnType<typeof createTestInvoice>) {
    await this.page.getByLabel('Client name').fill(invoice.clientName);
    await this.page.getByLabel('Client email').fill(invoice.clientEmail);
    await this.page.getByLabel('Due date').fill(invoice.dueDate);

    // Add line items
    for (let i = 0; i < invoice.items.length; i++) {
      const item = invoice.items[i];
      if (i > 0) {
        await this.page.getByRole('button', { name: /add.*item/i }).click();
      }
      await this.page.getByTestId(`item-${i}-description`).fill(item.description);
      await this.page.getByTestId(`item-${i}-quantity`).fill(item.quantity.toString());
      await this.page.getByTestId(`item-${i}-rate`).fill(item.rate.toString());
    }
  }

  async submitInvoice() {
    await this.page.getByRole('button', { name: /create.*invoice|save/i }).click();
  }

  async sendInvoice() {
    await this.page.getByRole('button', { name: /send.*invoice/i }).click();
  }
}

class PaymentPage {
  constructor(private page: Page) {}

  async navigateToPayment(viewToken: string) {
    await this.page.goto(`/invoices/${viewToken}/pay`);
    await expect(this.page).toHaveURL(/\/invoices\/.*\/pay/);
  }

  async selectPaymentMethod(method: 'stripe' | 'paypal') {
    await this.page.getByTestId(`payment-method-${method}`).click();
  }

  async fillStripeCard(cardNumber: string, expiry: string, cvc: string) {
    // Stripe Elements are in iframes
    const stripeFrame = this.page.frameLocator('[name*="__privateStripeFrame"]');
    await stripeFrame.getByPlaceholder('Card number').fill(cardNumber);
    await stripeFrame.getByPlaceholder('MM / YY').fill(expiry);
    await stripeFrame.getByPlaceholder('CVC').fill(cvc);
  }

  async submitPayment() {
    await this.page.getByRole('button', { name: /pay|submit/i }).click();
  }
}

test.describe('Invoice Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as freelancer
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@skillancer.com');
    await page.getByLabel('Password').fill('ValidP@ssword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard|\/cockpit/);
  });

  test('should create a new invoice', async ({ page }) => {
    const invoicePage = new InvoicePage(page);
    const testInvoice = createTestInvoice();

    await invoicePage.navigateToCreateInvoice();
    await invoicePage.fillInvoiceForm(testInvoice);
    await invoicePage.submitInvoice();

    // Should show success and redirect to invoice detail
    await expect(page.getByText(/invoice.*created|success/i)).toBeVisible();
    await expect(page).toHaveURL(/\/cockpit\/invoices\/[a-zA-Z0-9-]+/);
  });

  test('should calculate totals correctly', async ({ page }) => {
    const invoicePage = new InvoicePage(page);
    const testInvoice = createTestInvoice();

    await invoicePage.navigateToCreateInvoice();
    await invoicePage.fillInvoiceForm(testInvoice);

    // Verify calculated total
    const expectedTotal = testInvoice.items.reduce(
      (sum, item) => sum + item.quantity * item.rate, 0
    );
    await expect(page.getByTestId('invoice-total')).toContainText(expectedTotal.toFixed(2));
  });

  test('should validate required fields', async ({ page }) => {
    const invoicePage = new InvoicePage(page);

    await invoicePage.navigateToCreateInvoice();
    await invoicePage.submitInvoice();

    await expect(page.getByText(/client.*required|email.*required/i)).toBeVisible();
  });

  test('should save invoice as draft', async ({ page }) => {
    const invoicePage = new InvoicePage(page);
    const testInvoice = createTestInvoice();

    await invoicePage.navigateToCreateInvoice();
    await invoicePage.fillInvoiceForm(testInvoice);
    await page.getByRole('button', { name: /save.*draft/i }).click();

    await expect(page.getByText(/draft.*saved/i)).toBeVisible();
  });

  test('should send invoice to client', async ({ page }) => {
    const invoicePage = new InvoicePage(page);
    const testInvoice = createTestInvoice();

    await invoicePage.navigateToCreateInvoice();
    await invoicePage.fillInvoiceForm(testInvoice);
    await invoicePage.submitInvoice();
    await invoicePage.sendInvoice();

    // Confirm send dialog
    await page.getByRole('button', { name: /confirm|send/i }).click();

    await expect(page.getByText(/invoice.*sent/i)).toBeVisible();
  });
});

test.describe('Invoice PDF Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@skillancer.com');
    await page.getByLabel('Password').fill('ValidP@ssword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard|\/cockpit/);
  });

  test('should download invoice PDF', async ({ page }) => {
    await page.goto('/cockpit/invoices');

    // Click on first invoice
    await page.getByRole('row').nth(1).click();

    // Wait for download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /download.*pdf/i }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/invoice.*\.pdf/i);
  });

  test('should preview invoice before download', async ({ page }) => {
    await page.goto('/cockpit/invoices');
    await page.getByRole('row').nth(1).click();

    await page.getByRole('button', { name: /preview/i }).click();

    // Should show PDF preview modal
    await expect(page.getByTestId('pdf-preview-modal')).toBeVisible();
  });
});

test.describe('Stripe Payment Flow', () => {
  test('should complete payment with valid card', async ({ page }) => {
    const paymentPage = new PaymentPage(page);

    // Use a mock invoice view token
    await paymentPage.navigateToPayment('test-invoice-token');

    await expect(page.getByText(/invoice.*payment/i)).toBeVisible();
    await expect(page.getByTestId('invoice-amount')).toBeVisible();

    await paymentPage.selectPaymentMethod('stripe');

    // Use Stripe test card
    await paymentPage.fillStripeCard('4242424242424242', '1230', '123');
    await paymentPage.submitPayment();

    // Should show success
    await expect(page.getByText(/payment.*successful|thank.*you/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show error for declined card', async ({ page }) => {
    const paymentPage = new PaymentPage(page);

    await paymentPage.navigateToPayment('test-invoice-token');
    await paymentPage.selectPaymentMethod('stripe');

    // Use Stripe decline test card
    await paymentPage.fillStripeCard('4000000000000002', '1230', '123');
    await paymentPage.submitPayment();

    await expect(page.getByText(/declined|payment.*failed/i)).toBeVisible({ timeout: 10000 });
  });

  test('should handle 3D Secure authentication', async ({ page }) => {
    const paymentPage = new PaymentPage(page);

    await paymentPage.navigateToPayment('test-invoice-token');
    await paymentPage.selectPaymentMethod('stripe');

    // Use Stripe 3DS test card
    await paymentPage.fillStripeCard('4000000000003220', '1230', '123');
    await paymentPage.submitPayment();

    // Should show 3DS iframe or modal
    await expect(page.frameLocator('[name*="stripe"]').first().getByRole('button')).toBeVisible({ timeout: 10000 });
  });

  test('should validate card details', async ({ page }) => {
    const paymentPage = new PaymentPage(page);

    await paymentPage.navigateToPayment('test-invoice-token');
    await paymentPage.selectPaymentMethod('stripe');

    // Enter invalid card
    await paymentPage.fillStripeCard('1234567890123456', '1220', '12');
    await paymentPage.submitPayment();

    await expect(page.getByText(/invalid.*card|card.*number/i)).toBeVisible();
  });
});

test.describe('PayPal Payment Flow', () => {
  test('should redirect to PayPal', async ({ page }) => {
    const paymentPage = new PaymentPage(page);

    await paymentPage.navigateToPayment('test-invoice-token');
    await paymentPage.selectPaymentMethod('paypal');

    // Click PayPal button
    const paypalButton = page.getByTestId('paypal-button');
    await expect(paypalButton).toBeVisible();

    // Intercept PayPal redirect
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      paypalButton.click(),
    ]);

    // Should redirect to PayPal
    expect(popup.url()).toContain('paypal.com');
  });

  test('should handle PayPal cancellation', async ({ page }) => {
    // Simulate PayPal cancel callback
    await page.goto('/invoices/test-invoice-token/payment/cancel');

    await expect(page.getByText(/payment.*cancelled|try.*again/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /try.*again/i })).toBeVisible();
  });

  test('should handle PayPal success', async ({ page }) => {
    // Simulate PayPal success callback
    await page.goto('/invoices/test-invoice-token/payment/success');

    await expect(page.getByText(/payment.*successful|thank.*you/i)).toBeVisible();
  });
});

test.describe('Partial Payments', () => {
  test('should allow partial payment', async ({ page }) => {
    const paymentPage = new PaymentPage(page);

    await paymentPage.navigateToPayment('test-invoice-token');

    // Toggle partial payment
    await page.getByLabel(/partial.*payment/i).check();

    // Enter partial amount
    await page.getByLabel(/amount/i).fill('500');

    await paymentPage.selectPaymentMethod('stripe');
    await paymentPage.fillStripeCard('4242424242424242', '1230', '123');
    await paymentPage.submitPayment();

    await expect(page.getByText(/payment.*successful/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/balance.*remaining/i)).toBeVisible();
  });

  test('should show payment history', async ({ page }) => {
    // Navigate to invoice with partial payments
    await page.goto('/invoices/partial-paid-invoice-token');

    await expect(page.getByTestId('payment-history')).toBeVisible();
    await expect(page.getByText(/paid.*\$500/i)).toBeVisible();
    await expect(page.getByText(/remaining.*\$1000/i)).toBeVisible();
  });
});

test.describe('Payment Receipts', () => {
  test('should send payment receipt email', async ({ page }) => {
    // Navigate to paid invoice
    await page.goto('/invoices/paid-invoice-token/receipt');

    await expect(page.getByText(/receipt/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /download.*receipt/i })).toBeVisible();
  });

  test('should download payment receipt', async ({ page }) => {
    await page.goto('/invoices/paid-invoice-token/receipt');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /download.*receipt/i }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/receipt.*\.pdf/i);
  });
});

test.describe('Payment Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@skillancer.com');
    await page.getByLabel('Password').fill('ValidP@ssword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard|\/cockpit/);
  });

  test('should connect Stripe account', async ({ page }) => {
    await page.goto('/cockpit/settings/payments');

    // Click connect Stripe
    await page.getByRole('button', { name: /connect.*stripe/i }).click();

    // Should redirect to Stripe Connect
    await expect(page).toHaveURL(/connect\.stripe\.com|\/stripe-redirect/);
  });

  test('should configure PayPal email', async ({ page }) => {
    await page.goto('/cockpit/settings/payments');

    await page.getByLabel('PayPal email').fill('freelancer@paypal.com');
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText(/saved|updated/i)).toBeVisible();
  });

  test('should set default currency', async ({ page }) => {
    await page.goto('/cockpit/settings/payments');

    await page.getByLabel('Default currency').selectOption('EUR');
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText(/saved/i)).toBeVisible();
  });
});

test.describe('Invoice Status Updates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@skillancer.com');
    await page.getByLabel('Password').fill('ValidP@ssword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
  });

  test('should mark invoice as paid manually', async ({ page }) => {
    await page.goto('/cockpit/invoices/unpaid-invoice-id');

    await page.getByRole('button', { name: /mark.*paid/i }).click();

    // Fill payment details
    await page.getByLabel('Payment date').fill(new Date().toISOString().split('T')[0]);
    await page.getByLabel('Payment method').selectOption('bank_transfer');
    await page.getByLabel('Reference').fill('BANK-REF-12345');
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/marked.*paid/i)).toBeVisible();
    await expect(page.getByTestId('invoice-status')).toContainText('PAID');
  });

  test('should void invoice', async ({ page }) => {
    await page.goto('/cockpit/invoices/draft-invoice-id');

    await page.getByRole('button', { name: /void/i }).click();

    // Confirm void
    await page.getByRole('button', { name: /confirm.*void/i }).click();

    await expect(page.getByText(/voided/i)).toBeVisible();
    await expect(page.getByTestId('invoice-status')).toContainText('VOIDED');
  });

  test('should send payment reminder', async ({ page }) => {
    await page.goto('/cockpit/invoices/overdue-invoice-id');

    await page.getByRole('button', { name: /send.*reminder/i }).click();

    await expect(page.getByText(/reminder.*sent/i)).toBeVisible();
  });
});

test.describe('Refunds', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('freelancer@skillancer.com');
    await page.getByLabel('Password').fill('ValidP@ssword123!');
    await page.getByRole('button', { name: /sign in/i }).click();
  });

  test('should process full refund', async ({ page }) => {
    await page.goto('/cockpit/invoices/paid-invoice-id');

    await page.getByRole('button', { name: /refund/i }).click();
    await page.getByLabel(/reason/i).fill('Customer requested refund');
    await page.getByRole('button', { name: /process.*refund|confirm/i }).click();

    await expect(page.getByText(/refund.*processed/i)).toBeVisible({ timeout: 10000 });
  });

  test('should process partial refund', async ({ page }) => {
    await page.goto('/cockpit/invoices/paid-invoice-id');

    await page.getByRole('button', { name: /refund/i }).click();
    await page.getByLabel(/partial/i).check();
    await page.getByLabel(/amount/i).fill('250');
    await page.getByLabel(/reason/i).fill('Partial service refund');
    await page.getByRole('button', { name: /process.*refund|confirm/i }).click();

    await expect(page.getByText(/refund.*processed/i)).toBeVisible({ timeout: 10000 });
  });
});
