/**
 * @module @skillancer/cockpit-svc/services/providers/paypal
 * PayPal payment provider implementation
 */

import type { Logger } from '@skillancer/logger';

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  webhookId: string;
  sandbox: boolean;
}

export interface CreateOrderParams {
  amount: number;
  currency: string;
  payeeEmail: string;
  invoiceId: string;
  invoiceNumber: string;
  description?: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface OrderResult {
  id: string;
  status: string;
  approvalUrl: string;
}

export interface CaptureResult {
  id: string;
  status: string;
  captureId: string;
  amount: number;
  currency: string;
}

interface PayPalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{ rel: string; href: string }>;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{
        id: string;
        amount: { value: string; currency_code: string };
      }>;
    };
  }>;
}

export class PayPalProvider {
  private readonly baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private readonly config: PayPalConfig,
    private readonly logger: Logger
  ) {
    this.baseUrl = config.sandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
    this.logger.info('[PayPal] Provider initialized', { sandbox: config.sandbox });
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    const auth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ error }, 'PayPal OAuth token request failed');
      throw new Error(`PayPal OAuth failed: ${error}`);
    }

    const data = await response.json() as PayPalTokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;

    this.logger.debug('[PayPal] Access token refreshed');
    return this.accessToken;
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `skillancer-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ path, error, status: response.status }, 'PayPal API request failed');
      throw new Error(`PayPal API error: ${error}`);
    }

    return response.json() as T;
  }

  /**
   * Create a payment order
   */
  async createOrder(params: CreateOrderParams): Promise<OrderResult> {
    const {
      amount,
      currency,
      payeeEmail,
      invoiceId,
      invoiceNumber,
      description,
      returnUrl,
      cancelUrl,
    } = params;

    try {
      const order = await this.apiRequest<PayPalOrderResponse>('POST', '/v2/checkout/orders', {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: invoiceId,
            description: description || `Invoice ${invoiceNumber}`,
            invoice_id: invoiceNumber,
            amount: {
              currency_code: currency.toUpperCase(),
              value: amount.toFixed(2),
            },
            payee: {
              email_address: payeeEmail,
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
              brand_name: 'Skillancer',
              locale: 'en-US',
              landing_page: 'LOGIN',
              shipping_preference: 'NO_SHIPPING',
              user_action: 'PAY_NOW',
              return_url: returnUrl,
              cancel_url: cancelUrl,
            },
          },
        },
      });

      const approvalLink = order.links.find((link) => link.rel === 'payer-action');

      if (!approvalLink) {
        throw new Error('No approval URL in PayPal response');
      }

      this.logger.info(
        { orderId: order.id, invoiceId, amount },
        'PayPal order created'
      );

      return {
        id: order.id,
        status: order.status,
        approvalUrl: approvalLink.href,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ invoiceId, error: message }, 'PayPal order creation failed');
      throw new Error(`PayPal error: ${message}`);
    }
  }

  /**
   * Capture an approved order
   */
  async captureOrder(orderId: string): Promise<CaptureResult> {
    try {
      const result = await this.apiRequest<PayPalOrderResponse>(
        'POST',
        `/v2/checkout/orders/${orderId}/capture`
      );

      const capture = result.purchase_units?.[0]?.payments?.captures?.[0];

      if (!capture) {
        throw new Error('No capture data in PayPal response');
      }

      this.logger.info(
        { orderId, captureId: capture.id, status: result.status },
        'PayPal order captured'
      );

      return {
        id: result.id,
        status: result.status,
        captureId: capture.id,
        amount: parseFloat(capture.amount.value),
        currency: capture.amount.currency_code,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ orderId, error: message }, 'PayPal order capture failed');
      throw new Error(`PayPal error: ${message}`);
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string): Promise<PayPalOrderResponse> {
    try {
      return await this.apiRequest<PayPalOrderResponse>(
        'GET',
        `/v2/checkout/orders/${orderId}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ orderId, error: message }, 'Failed to get PayPal order');
      throw new Error(`PayPal error: ${message}`);
    }
  }

  /**
   * Create a refund for a captured payment
   */
  async createRefund(
    captureId: string,
    amount?: number,
    currency?: string,
    reason?: string
  ): Promise<{ id: string; status: string }> {
    try {
      const body: Record<string, unknown> = {};

      if (amount && currency) {
        body.amount = {
          value: amount.toFixed(2),
          currency_code: currency.toUpperCase(),
        };
      }

      if (reason) {
        body.note_to_payer = reason;
      }

      const result = await this.apiRequest<{ id: string; status: string }>(
        'POST',
        `/v2/payments/captures/${captureId}/refund`,
        Object.keys(body).length > 0 ? body : undefined
      );

      this.logger.info(
        { refundId: result.id, captureId, amount },
        'PayPal refund created'
      );

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ captureId, error: message }, 'PayPal refund creation failed');
      throw new Error(`PayPal error: ${message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(
    headers: Record<string, string>,
    body: string
  ): Promise<boolean> {
    try {
      const result = await this.apiRequest<{ verification_status: string }>(
        'POST',
        '/v1/notifications/verify-webhook-signature',
        {
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: this.config.webhookId,
          webhook_event: JSON.parse(body),
        }
      );

      const verified = result.verification_status === 'SUCCESS';

      if (!verified) {
        this.logger.warn('PayPal webhook signature verification failed');
      }

      return verified;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ error: message }, 'PayPal webhook verification error');
      return false;
    }
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(body: string): {
    eventType: string;
    resourceType: string;
    resource: {
      id: string;
      status: string;
      invoice_id?: string;
      amount?: { value: string; currency_code: string };
    };
  } {
    const event = JSON.parse(body);
    return {
      eventType: event.event_type,
      resourceType: event.resource_type,
      resource: event.resource,
    };
  }
}

/**
 * Create PayPal provider instance from environment
 */
export function createPayPalProvider(logger: Logger): PayPalProvider | null {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const sandbox = process.env.PAYPAL_SANDBOX !== 'false';

  if (!clientId || !clientSecret || !webhookId) {
    logger.warn('[PayPal] Missing configuration, provider not initialized');
    return null;
  }

  return new PayPalProvider({ clientId, clientSecret, webhookId, sandbox }, logger);
}
