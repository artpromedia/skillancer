// @ts-nocheck - Known type issues pending refactor
/* eslint-disable @typescript-eslint/return-await */
/**
 * @module @skillancer/billing-svc/routes/connect
 * Stripe Connect Onboarding Routes
 *
 * REST API endpoints for Stripe Connect account management:
 * - Create Express accounts
 * - Generate onboarding links
 * - Check account status
 * - Get dashboard access
 */

import { prisma } from '@skillancer/database';
import { z } from 'zod';

import { getConfig } from '../config/index.js';
import { logger } from '../lib/logger.js';
import {
  getStripe,
  createConnectAccount,
  createAccountLink,
  retrieveConnectAccount,
  createDashboardLink,
} from '../providers/stripe.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type Stripe from 'stripe';

// =============================================================================
// SCHEMAS
// =============================================================================

const CreateAccountSchema = z.object({
  country: z.string().length(2).default('US'),
  businessType: z.enum(['individual', 'company']).default('individual'),
  returnUrl: z.string().url().optional(),
  refreshUrl: z.string().url().optional(),
});

const CreateAccountLinkSchema = z.object({
  returnUrl: z.string().url(),
  refreshUrl: z.string().url(),
});

// =============================================================================
// TYPES
// =============================================================================

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

type OnboardingStatus =
  | 'NOT_STARTED'
  | 'ONBOARDING'
  | 'PENDING'
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'DISABLED';

interface AccountStatusResponse {
  status: OnboardingStatus;
  accountId: string | null;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
  };
  externalAccount: {
    type: string | null;
    last4: string | null;
    bank: string | null;
  } | null;
  payoutSchedule: {
    interval: string;
    delayDays: number;
  } | null;
}

// =============================================================================
// ROUTES
// =============================================================================

export async function connectRoutes(fastify: FastifyInstance): Promise<void> {
  const config = getConfig();

  /**
   * POST /connect/account
   * Create a new Stripe Connect Express account for the user
   */
  fastify.post<{ Body: z.infer<typeof CreateAccountSchema> }>(
    '/account',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            country: { type: 'string', minLength: 2, maxLength: 2 },
            businessType: { type: 'string', enum: ['individual', 'company'] },
            returnUrl: { type: 'string', format: 'uri' },
            refreshUrl: { type: 'string', format: 'uri' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              accountId: { type: 'string' },
              onboardingUrl: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      const userEmail = request.user?.email;

      if (!userId || !userEmail) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      try {
        const body = CreateAccountSchema.parse(request.body);

        // Check for existing account
        const existingAccount = await prisma.payoutAccount.findUnique({
          where: { userId },
        });

        const baseUrl = config.appUrl || 'http://localhost:3000';
        const returnUrl = body.returnUrl || `${baseUrl}/settings/payments?connected=true`;
        const refreshUrl = body.refreshUrl || `${baseUrl}/settings/payments?refresh=true`;

        let stripeAccountId: string;

        if (existingAccount?.stripeConnectAccountId) {
          // Resume existing onboarding
          stripeAccountId = existingAccount.stripeConnectAccountId;

          logger.info({ userId, stripeAccountId }, 'Resuming Connect onboarding');
        } else {
          // Create new Express account
          const account = await createConnectAccount({
            email: userEmail,
            country: body.country,
            businessType: body.businessType,
            metadata: {
              userId,
            },
          });

          stripeAccountId = account.id;

          // Save to database
          if (existingAccount) {
            await prisma.payoutAccount.update({
              where: { userId },
              data: {
                stripeConnectAccountId: account.id,
                status: 'ONBOARDING',
                country: body.country,
                businessType: body.businessType,
                updatedAt: new Date(),
              },
            });
          } else {
            await prisma.payoutAccount.create({
              data: {
                userId,
                stripeConnectAccountId: account.id,
                accountType: 'EXPRESS',
                status: 'ONBOARDING',
                country: body.country,
                businessType: body.businessType,
              },
            });
          }

          logger.info(
            { userId, stripeAccountId, country: body.country },
            'Created new Connect account'
          );
        }

        // Create account link for onboarding
        const accountLink = await createAccountLink({
          accountId: stripeAccountId,
          returnUrl,
          refreshUrl,
        });

        return reply.send({
          success: true,
          accountId: stripeAccountId,
          onboardingUrl: accountLink.url,
        });
      } catch (error) {
        const stripeError = error as Stripe.StripeError;
        logger.error(
          { userId, error: stripeError?.message || error },
          'Failed to create Connect account'
        );

        return reply.status(500).send({
          success: false,
          error: stripeError?.message || 'Failed to create Connect account',
        });
      }
    }
  );

  /**
   * GET /connect/status
   * Get current Connect account status for the user
   */
  fastify.get(
    '/status',
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              accountId: { type: 'string', nullable: true },
              detailsSubmitted: { type: 'boolean' },
              chargesEnabled: { type: 'boolean' },
              payoutsEnabled: { type: 'boolean' },
              requirements: {
                type: 'object',
                properties: {
                  currentlyDue: { type: 'array', items: { type: 'string' } },
                  eventuallyDue: { type: 'array', items: { type: 'string' } },
                  pastDue: { type: 'array', items: { type: 'string' } },
                  pendingVerification: { type: 'array', items: { type: 'string' } },
                },
              },
              externalAccount: {
                type: 'object',
                nullable: true,
                properties: {
                  type: { type: 'string', nullable: true },
                  last4: { type: 'string', nullable: true },
                  bank: { type: 'string', nullable: true },
                },
              },
              payoutSchedule: {
                type: 'object',
                nullable: true,
                properties: {
                  interval: { type: 'string' },
                  delayDays: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      try {
        // Get local account record
        const payoutAccount = await prisma.payoutAccount.findUnique({
          where: { userId },
        });

        if (!payoutAccount || !payoutAccount.stripeConnectAccountId) {
          const response: AccountStatusResponse = {
            status: 'NOT_STARTED',
            accountId: null,
            detailsSubmitted: false,
            chargesEnabled: false,
            payoutsEnabled: false,
            requirements: {
              currentlyDue: [],
              eventuallyDue: [],
              pastDue: [],
              pendingVerification: [],
            },
            externalAccount: null,
            payoutSchedule: null,
          };

          return reply.send(response);
        }

        // Fetch fresh data from Stripe
        const account = await retrieveConnectAccount(payoutAccount.stripeConnectAccountId);

        // Determine status
        const status = determineAccountStatus(account);

        // Extract external account info
        const externalAccount = account.external_accounts?.data?.[0];
        let externalAccountInfo = null;

        if (externalAccount) {
          if (externalAccount.object === 'bank_account') {
            const bankAccount = externalAccount as Stripe.BankAccount;
            externalAccountInfo = {
              type: 'bank_account',
              last4: bankAccount.last4,
              bank: bankAccount.bank_name || null,
            };
          } else if (externalAccount.object === 'card') {
            const card = externalAccount as Stripe.Card;
            externalAccountInfo = {
              type: 'card',
              last4: card.last4,
              bank: card.brand || null,
            };
          }
        }

        // Extract payout schedule
        const payoutSchedule = account.settings?.payouts?.schedule
          ? {
              interval: account.settings.payouts.schedule.interval || 'daily',
              delayDays: account.settings.payouts.schedule.delay_days || 2,
            }
          : null;

        // Update local record if status changed
        if (status !== payoutAccount.status) {
          await prisma.payoutAccount.update({
            where: { userId },
            data: {
              status,
              detailsSubmitted: account.details_submitted || false,
              chargesEnabled: account.charges_enabled || false,
              payoutsEnabled: account.payouts_enabled || false,
              currentlyDue: account.requirements?.currently_due || [],
              eventuallyDue: account.requirements?.eventually_due || [],
              pastDue: account.requirements?.past_due || [],
              externalAccountType: externalAccountInfo?.type || null,
              externalAccountLast4: externalAccountInfo?.last4 || null,
              externalAccountBank: externalAccountInfo?.bank || null,
              updatedAt: new Date(),
            },
          });
        }

        const response: AccountStatusResponse = {
          status,
          accountId: payoutAccount.stripeConnectAccountId,
          detailsSubmitted: account.details_submitted || false,
          chargesEnabled: account.charges_enabled || false,
          payoutsEnabled: account.payouts_enabled || false,
          requirements: {
            currentlyDue: account.requirements?.currently_due || [],
            eventuallyDue: account.requirements?.eventually_due || [],
            pastDue: account.requirements?.past_due || [],
            pendingVerification: account.requirements?.pending_verification || [],
          },
          externalAccount: externalAccountInfo,
          payoutSchedule,
        };

        return reply.send(response);
      } catch (error) {
        logger.error({ userId, error }, 'Failed to get Connect status');
        return reply.status(500).send({
          success: false,
          error: 'Failed to get account status',
        });
      }
    }
  );

  /**
   * POST /connect/account-link
   * Generate a new account link for onboarding/updating
   */
  fastify.post<{ Body: z.infer<typeof CreateAccountLinkSchema> }>(
    '/account-link',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['returnUrl', 'refreshUrl'],
          properties: {
            returnUrl: { type: 'string', format: 'uri' },
            refreshUrl: { type: 'string', format: 'uri' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              url: { type: 'string' },
              expiresAt: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      try {
        const body = CreateAccountLinkSchema.parse(request.body);

        const payoutAccount = await prisma.payoutAccount.findUnique({
          where: { userId },
        });

        if (!payoutAccount?.stripeConnectAccountId) {
          return reply.status(404).send({
            success: false,
            error: 'No Connect account found. Please create one first.',
          });
        }

        const accountLink = await createAccountLink({
          accountId: payoutAccount.stripeConnectAccountId,
          returnUrl: body.returnUrl,
          refreshUrl: body.refreshUrl,
          type: payoutAccount.status === 'ACTIVE' ? 'account_update' : 'account_onboarding',
        });

        return reply.send({
          success: true,
          url: accountLink.url,
          expiresAt: accountLink.expires_at,
        });
      } catch (error) {
        logger.error({ userId, error }, 'Failed to create account link');
        return reply.status(500).send({
          success: false,
          error: 'Failed to create account link',
        });
      }
    }
  );

  /**
   * GET /connect/dashboard
   * Get Stripe dashboard login link for the user
   */
  fastify.get(
    '/dashboard',
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              url: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      try {
        const payoutAccount = await prisma.payoutAccount.findUnique({
          where: { userId },
        });

        if (!payoutAccount?.stripeConnectAccountId) {
          return reply.status(404).send({
            success: false,
            error: 'No Connect account found',
          });
        }

        // Dashboard link only works for active accounts
        if (payoutAccount.status !== 'ACTIVE' && !payoutAccount.detailsSubmitted) {
          return reply.status(400).send({
            success: false,
            error: 'Complete onboarding before accessing the dashboard',
          });
        }

        const loginLink = await createDashboardLink(payoutAccount.stripeConnectAccountId);

        return reply.send({
          success: true,
          url: loginLink.url,
        });
      } catch (error) {
        logger.error({ userId, error }, 'Failed to create dashboard link');
        return reply.status(500).send({
          success: false,
          error: 'Failed to create dashboard link',
        });
      }
    }
  );

  /**
   * DELETE /connect/account
   * Deauthorize/disconnect the Connect account
   */
  fastify.delete(
    '/account',
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      try {
        const payoutAccount = await prisma.payoutAccount.findUnique({
          where: { userId },
        });

        if (!payoutAccount?.stripeConnectAccountId) {
          return reply.status(404).send({
            success: false,
            error: 'No Connect account found',
          });
        }

        // Update local record (keep for audit trail, mark as disabled)
        await prisma.payoutAccount.update({
          where: { userId },
          data: {
            status: 'DISABLED',
            payoutsEnabled: false,
            chargesEnabled: false,
            updatedAt: new Date(),
          },
        });

        logger.info(
          { userId, stripeAccountId: payoutAccount.stripeConnectAccountId },
          'Connect account disconnected'
        );

        return reply.send({
          success: true,
          message: 'Connect account disconnected successfully',
        });
      } catch (error) {
        logger.error({ userId, error }, 'Failed to disconnect account');
        return reply.status(500).send({
          success: false,
          error: 'Failed to disconnect account',
        });
      }
    }
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function determineAccountStatus(account: Stripe.Account): OnboardingStatus {
  if (account.requirements?.disabled_reason) {
    return 'DISABLED';
  }

  if (account.payouts_enabled && account.charges_enabled) {
    return 'ACTIVE';
  }

  if ((account.requirements?.past_due?.length || 0) > 0) {
    return 'RESTRICTED';
  }

  if (account.details_submitted) {
    if ((account.requirements?.pending_verification?.length || 0) > 0) {
      return 'PENDING';
    }
    return 'RESTRICTED';
  }

  if ((account.requirements?.currently_due?.length || 0) > 0) {
    return 'ONBOARDING';
  }

  return 'PENDING';
}

export default connectRoutes;
