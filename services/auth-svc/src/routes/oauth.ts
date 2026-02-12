/**
 * @module @skillancer/auth-svc/routes/oauth
 * OAuth provider routes
 */

import { getConfig } from '../config/index.js';
import { OAuthError } from '../errors/index.js';
import { getClientIp } from '../middleware/rate-limit.js';
import {
  oauthCallbackQuerySchema,
  appleCallbackBodySchema,
  type OAuthCallbackQuery,
  type AppleCallbackBody,
  type DeviceInfo,
} from '../schemas/index.js';
import { getOAuthService } from '../services/oauth.service.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract device info from request
 */
function getDeviceInfo(request: FastifyRequest): DeviceInfo {
  return {
    userAgent: request.headers['user-agent'] || 'unknown',
    ip: getClientIp(request),
    browser: request.headers['sec-ch-ua'] as string | undefined,
    os: undefined,
    deviceType: undefined,
  };
}

/**
 * Generate success redirect URL with tokens
 */
function getSuccessRedirectUrl(tokens: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): string {
  const config = getConfig();
  const params = new URLSearchParams({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_in: String(tokens.expiresIn),
    token_type: 'Bearer',
  });

  return `${config.appUrl}/auth/callback?${params.toString()}`;
}

/**
 * Generate error redirect URL
 */
function getErrorRedirectUrl(error: string, description?: string): string {
  const config = getConfig();
  const params = new URLSearchParams({ error });
  if (description) {
    params.set('error_description', description);
  }

  return `${config.appUrl}/auth/error?${params.toString()}`;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /auth/oauth/google - Initiate Google OAuth
 */
async function googleInitHandler(
  request: FastifyRequest<{ Querystring: { redirect_url?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const oauthService = getOAuthService();

  const { url } = await oauthService.getGoogleAuthUrl(request.query.redirect_url);

  void reply.redirect(url);
}

/**
 * GET /auth/oauth/google/callback - Google OAuth callback
 */
async function googleCallbackHandler(
  request: FastifyRequest<{ Querystring: OAuthCallbackQuery }>,
  reply: FastifyReply
): Promise<void> {
  const query = oauthCallbackQuerySchema.parse(request.query);

  // Handle OAuth errors
  if (query.error) {
    request.log.warn(
      { error: query.error, description: query.error_description },
      'Google OAuth error'
    );
    void reply.redirect(getErrorRedirectUrl(query.error, query.error_description));
    return;
  }

  if (!query.code || !query.state) {
    void reply.redirect(getErrorRedirectUrl('invalid_request', 'Missing code or state'));
    return;
  }

  try {
    const oauthService = getOAuthService();
    const deviceInfo = getDeviceInfo(request);

    const result = await oauthService.handleGoogleCallback(query.code, query.state, deviceInfo);

    request.log.info(
      { userId: result.user.id, isNewUser: result.isNewUser },
      'Google OAuth successful'
    );

    void reply.redirect(getSuccessRedirectUrl(result.tokens));
  } catch (error) {
    request.log.error({ error }, 'Google OAuth callback failed');

    if (error instanceof OAuthError) {
      void reply.redirect(getErrorRedirectUrl('oauth_error', error.message));
    } else {
      void reply.redirect(getErrorRedirectUrl('server_error', 'Authentication failed'));
    }
  }
}

/**
 * GET /auth/oauth/microsoft - Initiate Microsoft OAuth
 */
async function microsoftInitHandler(
  request: FastifyRequest<{ Querystring: { redirect_url?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const oauthService = getOAuthService();

  const { url } = await oauthService.getMicrosoftAuthUrl(request.query.redirect_url);

  void reply.redirect(url);
}

/**
 * GET /auth/oauth/microsoft/callback - Microsoft OAuth callback
 */
async function microsoftCallbackHandler(
  request: FastifyRequest<{ Querystring: OAuthCallbackQuery }>,
  reply: FastifyReply
): Promise<void> {
  const query = oauthCallbackQuerySchema.parse(request.query);

  // Handle OAuth errors
  if (query.error) {
    request.log.warn(
      { error: query.error, description: query.error_description },
      'Microsoft OAuth error'
    );
    void reply.redirect(getErrorRedirectUrl(query.error, query.error_description));
    return;
  }

  if (!query.code || !query.state) {
    void reply.redirect(getErrorRedirectUrl('invalid_request', 'Missing code or state'));
    return;
  }

  try {
    const oauthService = getOAuthService();
    const deviceInfo = getDeviceInfo(request);

    const result = await oauthService.handleMicrosoftCallback(query.code, query.state, deviceInfo);

    request.log.info(
      { userId: result.user.id, isNewUser: result.isNewUser },
      'Microsoft OAuth successful'
    );

    void reply.redirect(getSuccessRedirectUrl(result.tokens));
  } catch (error) {
    request.log.error({ error }, 'Microsoft OAuth callback failed');

    if (error instanceof OAuthError) {
      void reply.redirect(getErrorRedirectUrl('oauth_error', error.message));
    } else {
      void reply.redirect(getErrorRedirectUrl('server_error', 'Authentication failed'));
    }
  }
}

/**
 * GET /auth/oauth/apple - Initiate Apple Sign In
 */
async function appleInitHandler(
  request: FastifyRequest<{ Querystring: { redirect_url?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const oauthService = getOAuthService();

  const { url } = await oauthService.getAppleAuthUrl(request.query.redirect_url);

  void reply.redirect(url);
}

/**
 * POST /auth/oauth/apple/callback - Apple Sign In callback (Apple sends POST)
 */
async function appleCallbackHandler(
  request: FastifyRequest<{ Body: AppleCallbackBody }>,
  reply: FastifyReply
): Promise<void> {
  const body = appleCallbackBodySchema.parse(request.body);

  if (!body.code || !body.state) {
    void reply.redirect(getErrorRedirectUrl('invalid_request', 'Missing code or state'));
    return;
  }

  try {
    const oauthService = getOAuthService();
    const deviceInfo = getDeviceInfo(request);

    const result = await oauthService.handleAppleCallback(
      body.code,
      body.id_token,
      body.state,
      body.user,
      deviceInfo
    );

    request.log.info(
      { userId: result.user.id, isNewUser: result.isNewUser },
      'Apple Sign In successful'
    );

    void reply.redirect(getSuccessRedirectUrl(result.tokens));
  } catch (error) {
    request.log.error({ error }, 'Apple Sign In callback failed');

    if (error instanceof OAuthError) {
      void reply.redirect(getErrorRedirectUrl('oauth_error', error.message));
    } else {
      void reply.redirect(getErrorRedirectUrl('server_error', 'Authentication failed'));
    }
  }
}

/**
 * GET /auth/oauth/facebook - Initiate Facebook OAuth
 */
async function facebookInitHandler(
  request: FastifyRequest<{ Querystring: { redirect_url?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const oauthService = getOAuthService();

  const { url } = await oauthService.getFacebookAuthUrl(request.query.redirect_url);

  void reply.redirect(url);
}

/**
 * GET /auth/oauth/facebook/callback - Facebook OAuth callback
 */
async function facebookCallbackHandler(
  request: FastifyRequest<{ Querystring: OAuthCallbackQuery }>,
  reply: FastifyReply
): Promise<void> {
  const query = oauthCallbackQuerySchema.parse(request.query);

  // Handle OAuth errors
  if (query.error) {
    request.log.warn(
      { error: query.error, description: query.error_description },
      'Facebook OAuth error'
    );
    void reply.redirect(getErrorRedirectUrl(query.error, query.error_description));
    return;
  }

  if (!query.code || !query.state) {
    void reply.redirect(getErrorRedirectUrl('invalid_request', 'Missing code or state'));
    return;
  }

  try {
    const oauthService = getOAuthService();
    const deviceInfo = getDeviceInfo(request);

    const result = await oauthService.handleFacebookCallback(query.code, query.state, deviceInfo);

    request.log.info(
      { userId: result.user.id, isNewUser: result.isNewUser },
      'Facebook OAuth successful'
    );

    void reply.redirect(getSuccessRedirectUrl(result.tokens));
  } catch (error) {
    request.log.error({ error }, 'Facebook OAuth callback failed');

    if (error instanceof OAuthError) {
      void reply.redirect(getErrorRedirectUrl('oauth_error', error.message));
    } else {
      void reply.redirect(getErrorRedirectUrl('server_error', 'Authentication failed'));
    }
  }
}

/**
 * GET /auth/oauth/linkedin - Initiate LinkedIn OAuth
 */
async function linkedinInitHandler(
  request: FastifyRequest<{ Querystring: { redirect_url?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const oauthService = getOAuthService();

  const { url } = await oauthService.getLinkedInAuthUrl(request.query.redirect_url);

  void reply.redirect(url);
}

/**
 * GET /auth/oauth/linkedin/callback - LinkedIn OAuth callback
 */
async function linkedinCallbackHandler(
  request: FastifyRequest<{ Querystring: OAuthCallbackQuery }>,
  reply: FastifyReply
): Promise<void> {
  const query = oauthCallbackQuerySchema.parse(request.query);

  // Handle OAuth errors
  if (query.error) {
    request.log.warn(
      { error: query.error, description: query.error_description },
      'LinkedIn OAuth error'
    );
    void reply.redirect(getErrorRedirectUrl(query.error, query.error_description));
    return;
  }

  if (!query.code || !query.state) {
    void reply.redirect(getErrorRedirectUrl('invalid_request', 'Missing code or state'));
    return;
  }

  try {
    const oauthService = getOAuthService();
    const deviceInfo = getDeviceInfo(request);

    const result = await oauthService.handleLinkedInCallback(query.code, query.state, deviceInfo);

    request.log.info(
      { userId: result.user.id, isNewUser: result.isNewUser },
      'LinkedIn OAuth successful'
    );

    void reply.redirect(getSuccessRedirectUrl(result.tokens));
  } catch (error) {
    request.log.error({ error }, 'LinkedIn OAuth callback failed');

    if (error instanceof OAuthError) {
      void reply.redirect(getErrorRedirectUrl('oauth_error', error.message));
    } else {
      void reply.redirect(getErrorRedirectUrl('server_error', 'Authentication failed'));
    }
  }
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

/**
 * Register OAuth routes
 */
export async function oauthRoutes(fastify: FastifyInstance): Promise<void> {
  await Promise.resolve();
  // Google OAuth
  fastify.get(
    '/oauth/google',
    {
      schema: {
        description: 'Initiate Google OAuth flow',
        tags: ['oauth'],
        querystring: {
          type: 'object',
          properties: {
            redirect_url: { type: 'string' },
          },
        },
        response: {
          302: {
            description: 'Redirect to Google OAuth',
            type: 'null',
          },
        },
      },
    },
    googleInitHandler
  );

  fastify.get(
    '/oauth/google/callback',
    {
      schema: {
        description: 'Google OAuth callback',
        tags: ['oauth'],
        querystring: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
            error: { type: 'string' },
            error_description: { type: 'string' },
          },
        },
        response: {
          302: {
            description: 'Redirect to app with tokens or error',
            type: 'null',
          },
        },
      },
    },
    googleCallbackHandler
  );

  // Microsoft OAuth
  fastify.get(
    '/oauth/microsoft',
    {
      schema: {
        description: 'Initiate Microsoft OAuth flow',
        tags: ['oauth'],
        querystring: {
          type: 'object',
          properties: {
            redirect_url: { type: 'string' },
          },
        },
        response: {
          302: {
            description: 'Redirect to Microsoft OAuth',
            type: 'null',
          },
        },
      },
    },
    microsoftInitHandler
  );

  fastify.get(
    '/oauth/microsoft/callback',
    {
      schema: {
        description: 'Microsoft OAuth callback',
        tags: ['oauth'],
        querystring: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
            error: { type: 'string' },
            error_description: { type: 'string' },
          },
        },
        response: {
          302: {
            description: 'Redirect to app with tokens or error',
            type: 'null',
          },
        },
      },
    },
    microsoftCallbackHandler
  );

  // Apple Sign In
  fastify.get(
    '/oauth/apple',
    {
      schema: {
        description: 'Initiate Apple Sign In flow',
        tags: ['oauth'],
        querystring: {
          type: 'object',
          properties: {
            redirect_url: { type: 'string' },
          },
        },
        response: {
          302: {
            description: 'Redirect to Apple Sign In',
            type: 'null',
          },
        },
      },
    },
    appleInitHandler
  );

  // Apple sends POST per their specification
  fastify.post(
    '/oauth/apple/callback',
    {
      schema: {
        description: 'Apple Sign In callback (POST per Apple spec)',
        tags: ['oauth'],
        body: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            id_token: { type: 'string' },
            state: { type: 'string' },
            user: { type: 'string' },
          },
        },
        response: {
          302: {
            description: 'Redirect to app with tokens or error',
            type: 'null',
          },
        },
      },
    },
    appleCallbackHandler
  );

  // Facebook OAuth
  fastify.get(
    '/oauth/facebook',
    {
      schema: {
        description: 'Initiate Facebook OAuth flow',
        tags: ['oauth'],
        querystring: {
          type: 'object',
          properties: {
            redirect_url: { type: 'string' },
          },
        },
        response: {
          302: {
            description: 'Redirect to Facebook OAuth',
            type: 'null',
          },
        },
      },
    },
    facebookInitHandler
  );

  fastify.get(
    '/oauth/facebook/callback',
    {
      schema: {
        description: 'Facebook OAuth callback',
        tags: ['oauth'],
        querystring: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
            error: { type: 'string' },
            error_description: { type: 'string' },
          },
        },
        response: {
          302: {
            description: 'Redirect to app with tokens or error',
            type: 'null',
          },
        },
      },
    },
    facebookCallbackHandler
  );

  // LinkedIn OAuth
  fastify.get(
    '/oauth/linkedin',
    {
      schema: {
        description: 'Initiate LinkedIn OAuth flow',
        tags: ['oauth'],
        querystring: {
          type: 'object',
          properties: {
            redirect_url: { type: 'string' },
          },
        },
        response: {
          302: {
            description: 'Redirect to LinkedIn OAuth',
            type: 'null',
          },
        },
      },
    },
    linkedinInitHandler
  );

  fastify.get(
    '/oauth/linkedin/callback',
    {
      schema: {
        description: 'LinkedIn OAuth callback',
        tags: ['oauth'],
        querystring: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
            error: { type: 'string' },
            error_description: { type: 'string' },
          },
        },
        response: {
          302: {
            description: 'Redirect to app with tokens or error',
            type: 'null',
          },
        },
      },
    },
    linkedinCallbackHandler
  );
}
