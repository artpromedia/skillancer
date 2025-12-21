/**
 * @module @skillancer/cockpit-svc/services/invoice-pdf
 * Invoice PDF Service - PDF generation for invoices
 */

import { pdfErrors } from '../errors/invoice.errors.js';
import {
  InvoiceRepository,
  InvoiceTemplateRepository,
  InvoiceActivityRepository,
} from '../repositories/index.js';

import type {
  PdfGenerationParams,
  BusinessAddress,
  InvoiceWithDetails,
} from '../types/invoice.types.js';
import type { Invoice, InvoiceLineItem, InvoicePayment, InvoiceTemplate } from '@prisma/client';
import type { PrismaClient, Client } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

/**
 * Helper to get client display name
 */
function getClientDisplayName(client: Client | null | undefined): string {
  if (!client) return '';
  if (client.companyName) return client.companyName;
  const parts = [client.firstName, client.lastName].filter(Boolean);
  return parts.join(' ') || '';
}

// TODO: Import actual libraries when integrated
// import puppeteer from 'puppeteer';
// import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export class InvoicePdfService {
  private readonly invoiceRepository: InvoiceRepository;
  private readonly templateRepository: InvoiceTemplateRepository;
  private readonly activityRepository: InvoiceActivityRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.invoiceRepository = new InvoiceRepository(prisma);
    this.templateRepository = new InvoiceTemplateRepository(prisma);
    this.activityRepository = new InvoiceActivityRepository(prisma);
  }

  /**
   * Generate PDF for an invoice
   */
  async generatePdf(invoiceId: string, userId: string): Promise<string> {
    const invoiceRaw = await this.invoiceRepository.findByIdWithDetails(invoiceId);

    if (!invoiceRaw || invoiceRaw.freelancerUserId !== userId) {
      throw pdfErrors.notFound(invoiceId);
    }

    // Cast to type with relations
    const invoice = invoiceRaw as InvoiceWithDetails;

    try {
      // Get template
      const template = invoice.templateId
        ? await this.templateRepository.findById(invoice.templateId)
        : await this.templateRepository.findDefault(userId);

      // Generate HTML
      const html = this.generateInvoiceHtml({
        invoice,
        lineItems: invoice.lineItems ?? [],
        payments: invoice.payments ?? [],
        template,
        client: invoice.client ?? null,
      });

      // Generate PDF buffer
      const pdfBuffer = await this.htmlToPdf(html);

      // Upload to S3
      const pdfUrl = await this.uploadPdf(pdfBuffer, invoice);

      // Update invoice with PDF URL
      await this.invoiceRepository.updatePdfUrl(invoiceId, pdfUrl);

      // Log activity
      await this.activityRepository.logPdfGenerated(invoiceId);

      this.logger.info({ invoiceId, pdfUrl }, 'Invoice PDF generated');

      return pdfUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ invoiceId, error: message }, 'PDF generation failed');
      throw pdfErrors.generationFailed(message);
    }
  }

  /**
   * Regenerate PDF (for updates)
   */
  async regeneratePdf(invoiceId: string, userId: string): Promise<string> {
    return this.generatePdf(invoiceId, userId);
  }

  /**
   * Generate HTML for invoice
   */
  private generateInvoiceHtml(params: PdfGenerationParams): string {
    const { invoice, lineItems, payments, template, client } = params;

    const businessAddress = template?.businessAddress as BusinessAddress | null;
    const clientAddress = client?.address as BusinessAddress | null;

    const accentColor = template?.accentColor ?? '#3B82F6';
    const fontFamily = template?.fontFamily ?? 'Inter, system-ui, sans-serif';

    // Format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: invoice.currency,
      }).format(amount);
    };

    // Format date
    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    };

    // Generate line items HTML
    const lineItemsHtml = lineItems
      .map(
        (item) => `
        <tr>
          <td class="description">${this.escapeHtml(item.description)}</td>
          <td class="quantity">${item.quantity} ${item.unitType ?? ''}</td>
          <td class="rate">${formatCurrency(Number(item.unitPrice))}</td>
          <td class="amount">${formatCurrency(Number(item.amount))}</td>
        </tr>
      `
      )
      .join('');

    // Generate payments HTML
    const paymentsHtml = payments
      .filter((p) => p.status === 'COMPLETED')
      .map(
        (p) => `
        <tr class="payment">
          <td colspan="3">Payment (${p.paymentMethod}) - ${formatDate(p.paymentDate)}</td>
          <td class="amount">-${formatCurrency(Number(p.amount))}</td>
        </tr>
      `
      )
      .join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: ${fontFamily};
      font-size: 12px;
      line-height: 1.5;
      color: #1f2937;
      background: #fff;
    }
    
    .invoice {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid ${accentColor};
    }
    
    .logo img {
      max-height: 60px;
      max-width: 200px;
    }
    
    .invoice-title {
      text-align: right;
    }
    
    .invoice-title h1 {
      font-size: 32px;
      font-weight: 700;
      color: ${accentColor};
      margin-bottom: 8px;
    }
    
    .invoice-number {
      font-size: 14px;
      color: #6b7280;
    }
    
    .parties {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    
    .party {
      flex: 1;
    }
    
    .party h3 {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    
    .party-name {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .party-details {
      color: #4b5563;
      font-size: 11px;
    }
    
    .dates {
      display: flex;
      gap: 40px;
      margin-bottom: 30px;
    }
    
    .date-item {
      padding: 12px 16px;
      background: #f9fafb;
      border-radius: 6px;
    }
    
    .date-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 4px;
    }
    
    .date-value {
      font-size: 14px;
      font-weight: 600;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    
    .items-table th {
      background: ${accentColor};
      color: #fff;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
    }
    
    .items-table th:last-child,
    .items-table td:last-child {
      text-align: right;
    }
    
    .items-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .items-table .description {
      max-width: 300px;
    }
    
    .items-table .quantity,
    .items-table .rate {
      text-align: center;
    }
    
    .items-table .payment td {
      color: #059669;
      font-style: italic;
    }
    
    .totals {
      margin-left: auto;
      width: 280px;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .total-row.grand-total {
      border-bottom: none;
      border-top: 2px solid ${accentColor};
      padding-top: 12px;
      margin-top: 4px;
      font-size: 18px;
      font-weight: 700;
      color: ${accentColor};
    }
    
    .total-row.amount-due {
      background: ${accentColor};
      color: #fff;
      margin: 12px -12px 0;
      padding: 12px;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 700;
    }
    
    .notes-section {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    
    .notes-section h4 {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #374151;
    }
    
    .notes-section p {
      color: #6b7280;
      font-size: 11px;
      white-space: pre-wrap;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 10px;
    }
    
    ${template?.customCss ?? ''}
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="logo">
        ${template?.showLogo && template?.logoUrl ? `<img src="${template.logoUrl}" alt="Logo">` : ''}
      </div>
      <div class="invoice-title">
        <h1>INVOICE</h1>
        <div class="invoice-number">${invoice.invoiceNumber}</div>
      </div>
    </div>
    
    <div class="parties">
      <div class="party from">
        <h3>From</h3>
        <div class="party-name">${this.escapeHtml(template?.businessName ?? '')}</div>
        <div class="party-details">
          ${businessAddress?.street ? `${this.escapeHtml(businessAddress.street)}<br>` : ''}
          ${businessAddress?.city ? `${this.escapeHtml(businessAddress.city)}, ` : ''}
          ${businessAddress?.state ?? ''} ${businessAddress?.postalCode ?? ''}<br>
          ${businessAddress?.country ?? ''}
          ${template?.businessEmail ? `<br>${this.escapeHtml(template.businessEmail)}` : ''}
          ${template?.businessPhone ? `<br>${this.escapeHtml(template.businessPhone)}` : ''}
          ${template?.taxNumber ? `<br>Tax ID: ${this.escapeHtml(template.taxNumber)}` : ''}
        </div>
      </div>
      
      <div class="party to">
        <h3>Bill To</h3>
        <div class="party-name">${this.escapeHtml(getClientDisplayName(client))}</div>
        <div class="party-details">
          ${clientAddress?.street ? `${this.escapeHtml(clientAddress.street)}<br>` : ''}
          ${clientAddress?.city ? `${this.escapeHtml(clientAddress.city)}, ` : ''}
          ${clientAddress?.state ?? ''} ${clientAddress?.postalCode ?? ''}<br>
          ${clientAddress?.country ?? ''}
          ${client?.email ? `<br>${this.escapeHtml(client.email)}` : ''}
        </div>
      </div>
    </div>
    
    <div class="dates">
      <div class="date-item">
        <div class="date-label">Issue Date</div>
        <div class="date-value">${formatDate(invoice.issueDate)}</div>
      </div>
      <div class="date-item">
        <div class="date-label">Due Date</div>
        <div class="date-value">${formatDate(invoice.dueDate)}</div>
      </div>
    </div>
    
    ${invoice.title ? `<h2 style="margin-bottom: 8px;">${this.escapeHtml(invoice.title)}</h2>` : ''}
    ${invoice.summary ? `<p style="color: #6b7280; margin-bottom: 20px;">${this.escapeHtml(invoice.summary)}</p>` : ''}
    
    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHtml}
        ${paymentsHtml}
      </tbody>
    </table>
    
    <div class="totals">
      <div class="total-row">
        <span>Subtotal</span>
        <span>${formatCurrency(Number(invoice.subtotal))}</span>
      </div>
      ${
        Number(invoice.discountAmount) > 0
          ? `
      <div class="total-row">
        <span>Discount</span>
        <span>-${formatCurrency(Number(invoice.discountAmount))}</span>
      </div>
      `
          : ''
      }
      ${
        Number(invoice.taxAmount) > 0
          ? `
      <div class="total-row">
        <span>${invoice.taxLabel ?? 'Tax'} (${invoice.taxRate}%)</span>
        <span>${formatCurrency(Number(invoice.taxAmount))}</span>
      </div>
      `
          : ''
      }
      ${
        Number(invoice.lateFeeAmount) > 0
          ? `
      <div class="total-row">
        <span>Late Fee</span>
        <span>${formatCurrency(Number(invoice.lateFeeAmount))}</span>
      </div>
      `
          : ''
      }
      <div class="total-row grand-total">
        <span>Total</span>
        <span>${formatCurrency(Number(invoice.total))}</span>
      </div>
      <div class="total-row amount-due">
        <span>Amount Due</span>
        <span>${formatCurrency(Number(invoice.amountDue))}</span>
      </div>
    </div>
    
    ${
      invoice.notes
        ? `
    <div class="notes-section">
      <h4>Notes</h4>
      <p>${this.escapeHtml(invoice.notes)}</p>
    </div>
    `
        : ''
    }
    
    ${
      invoice.terms
        ? `
    <div class="notes-section">
      <h4>Terms & Conditions</h4>
      <p>${this.escapeHtml(invoice.terms)}</p>
    </div>
    `
        : ''
    }
    
    ${
      invoice.paymentInstructions
        ? `
    <div class="notes-section">
      <h4>Payment Instructions</h4>
      <p>${this.escapeHtml(invoice.paymentInstructions)}</p>
    </div>
    `
        : ''
    }
    
    ${
      template?.defaultFooter
        ? `
    <div class="footer">
      ${this.escapeHtml(template.defaultFooter)}
    </div>
    `
        : ''
    }
  </div>
</body>
</html>
    `;
  }

  /**
   * Convert HTML to PDF using Puppeteer
   */
  private async htmlToPdf(html: string): Promise<Buffer> {
    // TODO: Integrate actual Puppeteer
    // const browser = await puppeteer.launch({
    //   headless: true,
    //   args: ['--no-sandbox', '--disable-setuid-sandbox'],
    // });
    //
    // try {
    //   const page = await browser.newPage();
    //   await page.setContent(html, { waitUntil: 'networkidle0' });
    //
    //   const pdf = await page.pdf({
    //     format: 'A4',
    //     printBackground: true,
    //     margin: {
    //       top: '20mm',
    //       right: '20mm',
    //       bottom: '20mm',
    //       left: '20mm',
    //     },
    //   });
    //
    //   return Buffer.from(pdf);
    // } finally {
    //   await browser.close();
    // }

    // Placeholder implementation
    return Buffer.from(html);
  }

  /**
   * Upload PDF to S3
   */
  private async uploadPdf(pdfBuffer: Buffer, invoice: Invoice): Promise<string> {
    // TODO: Integrate actual S3
    // const s3 = new S3Client({ region: process.env.AWS_REGION });
    //
    // const key = `invoices/${invoice.freelancerUserId}/${invoice.id}/${invoice.invoiceNumber}.pdf`;
    //
    // await s3.send(new PutObjectCommand({
    //   Bucket: process.env.S3_BUCKET,
    //   Key: key,
    //   Body: pdfBuffer,
    //   ContentType: 'application/pdf',
    //   ACL: 'private',
    // }));
    //
    // return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;

    // Placeholder URL
    return `https://storage.skillancer.app/invoices/${invoice.id}/${invoice.invoiceNumber}.pdf`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m] ?? m);
  }
}
