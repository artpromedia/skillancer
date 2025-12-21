/**
 * @module @skillancer/cockpit-svc/errors/invoice
 * Error definitions for Professional Invoicing System
 */

export enum InvoiceErrorCode {
  // Invoice errors
  INVOICE_NOT_FOUND = 'INVOICE_NOT_FOUND',
  INVOICE_ALREADY_SENT = 'INVOICE_ALREADY_SENT',
  INVOICE_ALREADY_PAID = 'INVOICE_ALREADY_PAID',
  INVOICE_VOIDED = 'INVOICE_VOIDED',
  INVOICE_CANNOT_EDIT = 'INVOICE_CANNOT_EDIT',
  INVOICE_CANNOT_DELETE = 'INVOICE_CANNOT_DELETE',
  INVOICE_CANNOT_VOID = 'INVOICE_CANNOT_VOID',
  INVOICE_NO_LINE_ITEMS = 'INVOICE_NO_LINE_ITEMS',
  INVOICE_DUPLICATE_NUMBER = 'INVOICE_DUPLICATE_NUMBER',
  INVALID_INVOICE_DATES = 'INVALID_INVOICE_DATES',
  INVALID_INVOICE_AMOUNT = 'INVALID_INVOICE_AMOUNT',

  // Line item errors
  LINE_ITEM_NOT_FOUND = 'LINE_ITEM_NOT_FOUND',
  INVALID_LINE_ITEM = 'INVALID_LINE_ITEM',
  INVALID_QUANTITY = 'INVALID_QUANTITY',
  INVALID_UNIT_PRICE = 'INVALID_UNIT_PRICE',

  // Payment errors
  PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
  PAYMENT_EXCEEDS_AMOUNT_DUE = 'PAYMENT_EXCEEDS_AMOUNT_DUE',
  PAYMENT_ALREADY_REFUNDED = 'PAYMENT_ALREADY_REFUNDED',
  PAYMENT_PROCESSING_FAILED = 'PAYMENT_PROCESSING_FAILED',
  INVALID_PAYMENT_AMOUNT = 'INVALID_PAYMENT_AMOUNT',
  DUPLICATE_PAYMENT = 'DUPLICATE_PAYMENT',

  // Template errors
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  TEMPLATE_IN_USE = 'TEMPLATE_IN_USE',
  CANNOT_DELETE_DEFAULT_TEMPLATE = 'CANNOT_DELETE_DEFAULT_TEMPLATE',
  INVALID_TEMPLATE_DATA = 'INVALID_TEMPLATE_DATA',

  // Recurring invoice errors
  RECURRING_INVOICE_NOT_FOUND = 'RECURRING_INVOICE_NOT_FOUND',
  RECURRING_INVOICE_INACTIVE = 'RECURRING_INVOICE_INACTIVE',
  RECURRING_INVOICE_PAUSED = 'RECURRING_INVOICE_PAUSED',
  RECURRING_INVOICE_ENDED = 'RECURRING_INVOICE_ENDED',
  RECURRING_INVOICE_MAX_REACHED = 'RECURRING_INVOICE_MAX_REACHED',
  INVALID_RECURRENCE_CONFIG = 'INVALID_RECURRENCE_CONFIG',

  // PDF errors
  PDF_GENERATION_FAILED = 'PDF_GENERATION_FAILED',
  PDF_UPLOAD_FAILED = 'PDF_UPLOAD_FAILED',
  PDF_NOT_FOUND = 'PDF_NOT_FOUND',

  // Email errors
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  INVALID_EMAIL_RECIPIENT = 'INVALID_EMAIL_RECIPIENT',
  EMAIL_BOUNCE = 'EMAIL_BOUNCE',

  // Stripe errors
  STRIPE_NOT_CONFIGURED = 'STRIPE_NOT_CONFIGURED',
  STRIPE_PAYMENT_FAILED = 'STRIPE_PAYMENT_FAILED',
  STRIPE_ACCOUNT_NOT_FOUND = 'STRIPE_ACCOUNT_NOT_FOUND',
  STRIPE_WEBHOOK_ERROR = 'STRIPE_WEBHOOK_ERROR',
  STRIPE_REFUND_FAILED = 'STRIPE_REFUND_FAILED',

  // PayPal errors
  PAYPAL_NOT_CONFIGURED = 'PAYPAL_NOT_CONFIGURED',
  PAYPAL_PAYMENT_FAILED = 'PAYPAL_PAYMENT_FAILED',
  PAYPAL_ORDER_NOT_FOUND = 'PAYPAL_ORDER_NOT_FOUND',
  PAYPAL_CAPTURE_FAILED = 'PAYPAL_CAPTURE_FAILED',
  PAYPAL_WEBHOOK_ERROR = 'PAYPAL_WEBHOOK_ERROR',

  // Settings errors
  SETTINGS_NOT_FOUND = 'SETTINGS_NOT_FOUND',
  INVALID_SETTINGS = 'INVALID_SETTINGS',

  // Client portal errors
  INVALID_VIEW_TOKEN = 'INVALID_VIEW_TOKEN',
  VIEW_TOKEN_EXPIRED = 'VIEW_TOKEN_EXPIRED',
  CLIENT_PORTAL_DISABLED = 'CLIENT_PORTAL_DISABLED',

  // Late fee errors
  LATE_FEE_ALREADY_APPLIED = 'LATE_FEE_ALREADY_APPLIED',
  LATE_FEE_NOT_ENABLED = 'LATE_FEE_NOT_ENABLED',

  // Authorization errors
  ACCESS_DENIED = 'ACCESS_DENIED',
  UNAUTHORIZED = 'UNAUTHORIZED',
}

const ERROR_MESSAGES: Record<InvoiceErrorCode, string> = {
  // Invoice errors
  [InvoiceErrorCode.INVOICE_NOT_FOUND]: 'Invoice not found.',
  [InvoiceErrorCode.INVOICE_ALREADY_SENT]: 'This invoice has already been sent.',
  [InvoiceErrorCode.INVOICE_ALREADY_PAID]: 'This invoice has already been paid.',
  [InvoiceErrorCode.INVOICE_VOIDED]: 'This invoice has been voided.',
  [InvoiceErrorCode.INVOICE_CANNOT_EDIT]:
    'This invoice cannot be edited. Only draft invoices can be modified.',
  [InvoiceErrorCode.INVOICE_CANNOT_DELETE]:
    'This invoice cannot be deleted. Only draft invoices can be deleted.',
  [InvoiceErrorCode.INVOICE_CANNOT_VOID]:
    'This invoice cannot be voided. Only sent invoices can be voided.',
  [InvoiceErrorCode.INVOICE_NO_LINE_ITEMS]: 'Invoice must have at least one line item.',
  [InvoiceErrorCode.INVOICE_DUPLICATE_NUMBER]: 'An invoice with this number already exists.',
  [InvoiceErrorCode.INVALID_INVOICE_DATES]: 'Due date must be on or after issue date.',
  [InvoiceErrorCode.INVALID_INVOICE_AMOUNT]: 'Invoice amount must be greater than zero.',

  // Line item errors
  [InvoiceErrorCode.LINE_ITEM_NOT_FOUND]: 'Line item not found.',
  [InvoiceErrorCode.INVALID_LINE_ITEM]: 'Invalid line item data.',
  [InvoiceErrorCode.INVALID_QUANTITY]: 'Quantity must be greater than zero.',
  [InvoiceErrorCode.INVALID_UNIT_PRICE]: 'Unit price must be a valid amount.',

  // Payment errors
  [InvoiceErrorCode.PAYMENT_NOT_FOUND]: 'Payment not found.',
  [InvoiceErrorCode.PAYMENT_EXCEEDS_AMOUNT_DUE]: 'Payment amount exceeds the amount due.',
  [InvoiceErrorCode.PAYMENT_ALREADY_REFUNDED]: 'This payment has already been refunded.',
  [InvoiceErrorCode.PAYMENT_PROCESSING_FAILED]: 'Payment processing failed. Please try again.',
  [InvoiceErrorCode.INVALID_PAYMENT_AMOUNT]: 'Payment amount must be greater than zero.',
  [InvoiceErrorCode.DUPLICATE_PAYMENT]: 'A payment with this transaction ID already exists.',

  // Template errors
  [InvoiceErrorCode.TEMPLATE_NOT_FOUND]: 'Invoice template not found.',
  [InvoiceErrorCode.TEMPLATE_IN_USE]: 'This template is in use by existing invoices.',
  [InvoiceErrorCode.CANNOT_DELETE_DEFAULT_TEMPLATE]:
    'Cannot delete the default template. Set another template as default first.',
  [InvoiceErrorCode.INVALID_TEMPLATE_DATA]: 'Invalid template data provided.',

  // Recurring invoice errors
  [InvoiceErrorCode.RECURRING_INVOICE_NOT_FOUND]: 'Recurring invoice not found.',
  [InvoiceErrorCode.RECURRING_INVOICE_INACTIVE]: 'This recurring invoice is inactive.',
  [InvoiceErrorCode.RECURRING_INVOICE_PAUSED]: 'This recurring invoice is paused.',
  [InvoiceErrorCode.RECURRING_INVOICE_ENDED]: 'This recurring invoice has ended.',
  [InvoiceErrorCode.RECURRING_INVOICE_MAX_REACHED]:
    'Maximum number of invoices has been reached for this recurring invoice.',
  [InvoiceErrorCode.INVALID_RECURRENCE_CONFIG]: 'Invalid recurrence configuration.',

  // PDF errors
  [InvoiceErrorCode.PDF_GENERATION_FAILED]: 'Failed to generate PDF. Please try again.',
  [InvoiceErrorCode.PDF_UPLOAD_FAILED]: 'Failed to upload PDF. Please try again.',
  [InvoiceErrorCode.PDF_NOT_FOUND]: 'PDF not found. Please regenerate the invoice.',

  // Email errors
  [InvoiceErrorCode.EMAIL_SEND_FAILED]: 'Failed to send email. Please try again.',
  [InvoiceErrorCode.INVALID_EMAIL_RECIPIENT]: 'Invalid email recipient.',
  [InvoiceErrorCode.EMAIL_BOUNCE]: 'Email could not be delivered.',

  // Stripe errors
  [InvoiceErrorCode.STRIPE_NOT_CONFIGURED]:
    'Stripe is not configured. Please add your Stripe account in settings.',
  [InvoiceErrorCode.STRIPE_PAYMENT_FAILED]: 'Stripe payment failed.',
  [InvoiceErrorCode.STRIPE_ACCOUNT_NOT_FOUND]: 'Stripe account not found.',
  [InvoiceErrorCode.STRIPE_WEBHOOK_ERROR]: 'Error processing Stripe webhook.',
  [InvoiceErrorCode.STRIPE_REFUND_FAILED]: 'Failed to process Stripe refund.',

  // PayPal errors
  [InvoiceErrorCode.PAYPAL_NOT_CONFIGURED]:
    'PayPal is not configured. Please add your PayPal email in settings.',
  [InvoiceErrorCode.PAYPAL_PAYMENT_FAILED]: 'PayPal payment failed.',
  [InvoiceErrorCode.PAYPAL_ORDER_NOT_FOUND]: 'PayPal order not found.',
  [InvoiceErrorCode.PAYPAL_CAPTURE_FAILED]: 'Failed to capture PayPal payment.',
  [InvoiceErrorCode.PAYPAL_WEBHOOK_ERROR]: 'Error processing PayPal webhook.',

  // Settings errors
  [InvoiceErrorCode.SETTINGS_NOT_FOUND]: 'Invoice settings not found.',
  [InvoiceErrorCode.INVALID_SETTINGS]: 'Invalid settings provided.',

  // Client portal errors
  [InvoiceErrorCode.INVALID_VIEW_TOKEN]: 'Invalid invoice access link.',
  [InvoiceErrorCode.VIEW_TOKEN_EXPIRED]: 'This invoice link has expired.',
  [InvoiceErrorCode.CLIENT_PORTAL_DISABLED]: 'Client portal is disabled for this invoice.',

  // Late fee errors
  [InvoiceErrorCode.LATE_FEE_ALREADY_APPLIED]: 'Late fee has already been applied to this invoice.',
  [InvoiceErrorCode.LATE_FEE_NOT_ENABLED]: 'Late fees are not enabled for this invoice.',

  // Authorization errors
  [InvoiceErrorCode.ACCESS_DENIED]: 'Access denied.',
  [InvoiceErrorCode.UNAUTHORIZED]: 'You are not authorized to access this resource.',
};

const HTTP_STATUS: Record<InvoiceErrorCode, number> = {
  // Invoice errors - 400-404
  [InvoiceErrorCode.INVOICE_NOT_FOUND]: 404,
  [InvoiceErrorCode.INVOICE_ALREADY_SENT]: 409,
  [InvoiceErrorCode.INVOICE_ALREADY_PAID]: 409,
  [InvoiceErrorCode.INVOICE_VOIDED]: 409,
  [InvoiceErrorCode.INVOICE_CANNOT_EDIT]: 409,
  [InvoiceErrorCode.INVOICE_CANNOT_DELETE]: 409,
  [InvoiceErrorCode.INVOICE_CANNOT_VOID]: 409,
  [InvoiceErrorCode.INVOICE_NO_LINE_ITEMS]: 400,
  [InvoiceErrorCode.INVOICE_DUPLICATE_NUMBER]: 409,
  [InvoiceErrorCode.INVALID_INVOICE_DATES]: 400,
  [InvoiceErrorCode.INVALID_INVOICE_AMOUNT]: 400,

  // Line item errors - 400-404
  [InvoiceErrorCode.LINE_ITEM_NOT_FOUND]: 404,
  [InvoiceErrorCode.INVALID_LINE_ITEM]: 400,
  [InvoiceErrorCode.INVALID_QUANTITY]: 400,
  [InvoiceErrorCode.INVALID_UNIT_PRICE]: 400,

  // Payment errors - 400-409
  [InvoiceErrorCode.PAYMENT_NOT_FOUND]: 404,
  [InvoiceErrorCode.PAYMENT_EXCEEDS_AMOUNT_DUE]: 400,
  [InvoiceErrorCode.PAYMENT_ALREADY_REFUNDED]: 409,
  [InvoiceErrorCode.PAYMENT_PROCESSING_FAILED]: 502,
  [InvoiceErrorCode.INVALID_PAYMENT_AMOUNT]: 400,
  [InvoiceErrorCode.DUPLICATE_PAYMENT]: 409,

  // Template errors - 400-409
  [InvoiceErrorCode.TEMPLATE_NOT_FOUND]: 404,
  [InvoiceErrorCode.TEMPLATE_IN_USE]: 409,
  [InvoiceErrorCode.CANNOT_DELETE_DEFAULT_TEMPLATE]: 409,
  [InvoiceErrorCode.INVALID_TEMPLATE_DATA]: 400,

  // Recurring invoice errors - 400-409
  [InvoiceErrorCode.RECURRING_INVOICE_NOT_FOUND]: 404,
  [InvoiceErrorCode.RECURRING_INVOICE_INACTIVE]: 409,
  [InvoiceErrorCode.RECURRING_INVOICE_PAUSED]: 409,
  [InvoiceErrorCode.RECURRING_INVOICE_ENDED]: 409,
  [InvoiceErrorCode.RECURRING_INVOICE_MAX_REACHED]: 409,
  [InvoiceErrorCode.INVALID_RECURRENCE_CONFIG]: 400,

  // PDF errors - 500
  [InvoiceErrorCode.PDF_GENERATION_FAILED]: 500,
  [InvoiceErrorCode.PDF_UPLOAD_FAILED]: 500,
  [InvoiceErrorCode.PDF_NOT_FOUND]: 404,

  // Email errors - 500
  [InvoiceErrorCode.EMAIL_SEND_FAILED]: 502,
  [InvoiceErrorCode.INVALID_EMAIL_RECIPIENT]: 400,
  [InvoiceErrorCode.EMAIL_BOUNCE]: 502,

  // Stripe errors - 400-502
  [InvoiceErrorCode.STRIPE_NOT_CONFIGURED]: 400,
  [InvoiceErrorCode.STRIPE_PAYMENT_FAILED]: 502,
  [InvoiceErrorCode.STRIPE_ACCOUNT_NOT_FOUND]: 404,
  [InvoiceErrorCode.STRIPE_WEBHOOK_ERROR]: 400,
  [InvoiceErrorCode.STRIPE_REFUND_FAILED]: 502,

  // PayPal errors - 400-502
  [InvoiceErrorCode.PAYPAL_NOT_CONFIGURED]: 400,
  [InvoiceErrorCode.PAYPAL_PAYMENT_FAILED]: 502,
  [InvoiceErrorCode.PAYPAL_ORDER_NOT_FOUND]: 404,
  [InvoiceErrorCode.PAYPAL_CAPTURE_FAILED]: 502,
  [InvoiceErrorCode.PAYPAL_WEBHOOK_ERROR]: 400,

  // Settings errors - 400-404
  [InvoiceErrorCode.SETTINGS_NOT_FOUND]: 404,
  [InvoiceErrorCode.INVALID_SETTINGS]: 400,

  // Client portal errors - 400-403
  [InvoiceErrorCode.INVALID_VIEW_TOKEN]: 400,
  [InvoiceErrorCode.VIEW_TOKEN_EXPIRED]: 400,
  [InvoiceErrorCode.CLIENT_PORTAL_DISABLED]: 403,

  // Late fee errors - 409
  [InvoiceErrorCode.LATE_FEE_ALREADY_APPLIED]: 409,
  [InvoiceErrorCode.LATE_FEE_NOT_ENABLED]: 400,

  // Authorization errors - 401-403
  [InvoiceErrorCode.ACCESS_DENIED]: 403,
  [InvoiceErrorCode.UNAUTHORIZED]: 401,
};

export class InvoiceError extends Error {
  public readonly code: InvoiceErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: InvoiceErrorCode, details?: Record<string, unknown>) {
    super(ERROR_MESSAGES[code]);
    this.name = 'InvoiceError';
    this.code = code;
    this.statusCode = HTTP_STATUS[code];
    this.details = details;

    // Set prototype for instanceof
    Object.setPrototypeOf(this, InvoiceError.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
      },
    };
  }
}

// Factory functions for common errors
export const invoiceErrors = {
  notFound: (invoiceId?: string) =>
    new InvoiceError(InvoiceErrorCode.INVOICE_NOT_FOUND, { invoiceId }),

  cannotEdit: (invoiceId: string, status: string) =>
    new InvoiceError(InvoiceErrorCode.INVOICE_CANNOT_EDIT, { invoiceId, status }),

  cannotDelete: (invoiceId: string, status: string) =>
    new InvoiceError(InvoiceErrorCode.INVOICE_CANNOT_DELETE, { invoiceId, status }),

  cannotVoid: (invoiceId: string, status: string) =>
    new InvoiceError(InvoiceErrorCode.INVOICE_CANNOT_VOID, { invoiceId, status }),

  alreadyPaid: (invoiceId: string) =>
    new InvoiceError(InvoiceErrorCode.INVOICE_ALREADY_PAID, { invoiceId }),

  voided: (invoiceId: string) => new InvoiceError(InvoiceErrorCode.INVOICE_VOIDED, { invoiceId }),

  noLineItems: () => new InvoiceError(InvoiceErrorCode.INVOICE_NO_LINE_ITEMS),

  duplicateNumber: (invoiceNumber: string) =>
    new InvoiceError(InvoiceErrorCode.INVOICE_DUPLICATE_NUMBER, { invoiceNumber }),

  invalidDates: (issueDate: Date, dueDate: Date) =>
    new InvoiceError(InvoiceErrorCode.INVALID_INVOICE_DATES, {
      issueDate: issueDate.toISOString(),
      dueDate: dueDate.toISOString(),
    }),
};

export const paymentErrors = {
  notFound: (paymentId?: string) =>
    new InvoiceError(InvoiceErrorCode.PAYMENT_NOT_FOUND, { paymentId }),

  exceedsAmountDue: (amountDue: number, paymentAmount: number) =>
    new InvoiceError(InvoiceErrorCode.PAYMENT_EXCEEDS_AMOUNT_DUE, {
      amountDue,
      paymentAmount,
    }),

  processingFailed: (reason?: string) =>
    new InvoiceError(InvoiceErrorCode.PAYMENT_PROCESSING_FAILED, { reason }),

  duplicate: (transactionId: string) =>
    new InvoiceError(InvoiceErrorCode.DUPLICATE_PAYMENT, { transactionId }),
};

export const templateErrors = {
  notFound: (templateId?: string) =>
    new InvoiceError(InvoiceErrorCode.TEMPLATE_NOT_FOUND, { templateId }),

  inUse: (templateId: string, invoiceCount: number) =>
    new InvoiceError(InvoiceErrorCode.TEMPLATE_IN_USE, { templateId, invoiceCount }),

  cannotDeleteDefault: (templateId: string) =>
    new InvoiceError(InvoiceErrorCode.CANNOT_DELETE_DEFAULT_TEMPLATE, { templateId }),
};

export const recurringErrors = {
  notFound: (recurringInvoiceId?: string) =>
    new InvoiceError(InvoiceErrorCode.RECURRING_INVOICE_NOT_FOUND, { recurringInvoiceId }),

  inactive: (recurringInvoiceId: string) =>
    new InvoiceError(InvoiceErrorCode.RECURRING_INVOICE_INACTIVE, { recurringInvoiceId }),

  paused: (recurringInvoiceId: string) =>
    new InvoiceError(InvoiceErrorCode.RECURRING_INVOICE_PAUSED, { recurringInvoiceId }),

  ended: (recurringInvoiceId: string) =>
    new InvoiceError(InvoiceErrorCode.RECURRING_INVOICE_ENDED, { recurringInvoiceId }),

  maxReached: (recurringInvoiceId: string, maxInvoices: number) =>
    new InvoiceError(InvoiceErrorCode.RECURRING_INVOICE_MAX_REACHED, {
      recurringInvoiceId,
      maxInvoices,
    }),
};

export const pdfErrors = {
  generationFailed: (reason?: string) =>
    new InvoiceError(InvoiceErrorCode.PDF_GENERATION_FAILED, { reason }),

  uploadFailed: (reason?: string) =>
    new InvoiceError(InvoiceErrorCode.PDF_UPLOAD_FAILED, { reason }),

  notFound: (invoiceId: string) => new InvoiceError(InvoiceErrorCode.PDF_NOT_FOUND, { invoiceId }),
};

export const stripeErrors = {
  notConfigured: () => new InvoiceError(InvoiceErrorCode.STRIPE_NOT_CONFIGURED),

  paymentFailed: (reason?: string) =>
    new InvoiceError(InvoiceErrorCode.STRIPE_PAYMENT_FAILED, { reason }),

  accountNotFound: () => new InvoiceError(InvoiceErrorCode.STRIPE_ACCOUNT_NOT_FOUND),

  webhookError: (reason?: string) =>
    new InvoiceError(InvoiceErrorCode.STRIPE_WEBHOOK_ERROR, { reason }),

  refundFailed: (reason?: string) =>
    new InvoiceError(InvoiceErrorCode.STRIPE_REFUND_FAILED, { reason }),
};

export const paypalErrors = {
  notConfigured: () => new InvoiceError(InvoiceErrorCode.PAYPAL_NOT_CONFIGURED),

  paymentFailed: (reason?: string) =>
    new InvoiceError(InvoiceErrorCode.PAYPAL_PAYMENT_FAILED, { reason }),

  orderNotFound: (orderId?: string) =>
    new InvoiceError(InvoiceErrorCode.PAYPAL_ORDER_NOT_FOUND, { orderId }),

  captureFailed: (reason?: string) =>
    new InvoiceError(InvoiceErrorCode.PAYPAL_CAPTURE_FAILED, { reason }),

  webhookError: (reason?: string) =>
    new InvoiceError(InvoiceErrorCode.PAYPAL_WEBHOOK_ERROR, { reason }),
};

export const clientPortalErrors = {
  invalidToken: () => new InvoiceError(InvoiceErrorCode.INVALID_VIEW_TOKEN),

  tokenExpired: () => new InvoiceError(InvoiceErrorCode.VIEW_TOKEN_EXPIRED),

  disabled: () => new InvoiceError(InvoiceErrorCode.CLIENT_PORTAL_DISABLED),
};

export const authErrors = {
  accessDenied: (resource?: string) =>
    new InvoiceError(InvoiceErrorCode.ACCESS_DENIED, { resource }),

  unauthorized: () => new InvoiceError(InvoiceErrorCode.UNAUTHORIZED),
};
