/**
 * @module @skillancer/auth-svc/routes/auth
 * Authentication routes for email/password auth
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getAuthService } from '../services/auth.service.js';
import {
  registerRequestSchema,
  loginRequestSchema,
  refreshTokenRequestSchema,
  logoutRequestSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
  verifyEmailParamsSchema,
  resendVerificationRequestSchema,
  type RegisterRequest,
  type LoginRequest,
  type RefreshTokenRequest,
  type LogoutRequest,
  type ForgotPasswordRequest,
  type ResetPasswordRequest,
  type VerifyEmailParams,
  type ResendVerificationRequest,
  type DeviceInfo,
} from '../schemas/index.js';
import {
  getClientIp,
  loginRateLimitHook,
  registrationRateLimitHook,
  passwordResetRateLimitHook,
} from '../middleware/rate-limit.js';
import { getTokenService } from '../services/token.service.js';
import { InvalidTokenError } from '../errors/index.js';

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
  };
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * POST /auth/register - Register new user
 */
async function registerHandler(
  request: FastifyRequest<{ Body: RegisterRequest }>,
  reply: FastifyReply
): Promise<void> {
  const data = registerRequestSchema.parse(request.body);
  const authService = getAuthService();

  const { user, verificationToken } = await authService.register(data);

  // TODO: Send verification email via notification service
  request.log.info(
    { userId: user.id, token: verificationToken },
    'User registered, verification email pending'
  );

  void reply.status(201).send({
    success: true,
    message: 'Registration successful. Please check your email to verify your account.',
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
    },
  });
}

/**
 * POST /auth/login - Login with email/password
 */
async function loginHandler(
  request: FastifyRequest<{ Body: LoginRequest }>,
  reply: FastifyReply
): Promise<void> {
  const data = loginRequestSchema.parse(request.body);
  const authService = getAuthService();
  const deviceInfo = getDeviceInfo(request);

  const { user, tokens, session } = await authService.login(data.email, data.password, deviceInfo);

  // Reset rate limit on successful login
  await request.server.rateLimit.resetLogin(data.email.toLowerCase());

  void reply.status(200).send({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      verificationLevel: user.verificationLevel,
    },
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: tokens.tokenType,
    },
    session: {
      id: session.sessionId,
      expiresAt: session.expiresAt.toISOString(),
    },
  });
}

/**
 * POST /auth/logout - Logout current session
 */
async function logoutHandler(
  request: FastifyRequest<{ Body: LogoutRequest }>,
  reply: FastifyReply
): Promise<void> {
  const data = logoutRequestSchema.parse(request.body || {});
  const authService = getAuthService();
  const tokenService = getTokenService();

  // Get user from authorization header
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    void reply.status(200).send({
      success: true,
      message: 'Logged out successfully',
    });
    return;
  }

  try {
    const token = authHeader.substring(7);
    const payload = tokenService.verifyAccessToken(token);

    if (data.allSessions) {
      await authService.logoutAll(payload.sub);
    } else {
      const sessionId = data.sessionId || payload.sessionId;
      await authService.logout(sessionId, payload.sub);
    }
  } catch {
    // Token might be expired, that's okay for logout
  }

  void reply.status(200).send({
    success: true,
    message: data.allSessions ? 'Logged out from all sessions' : 'Logged out successfully',
  });
}

/**
 * POST /auth/refresh - Refresh access token
 */
async function refreshHandler(
  request: FastifyRequest<{ Body: RefreshTokenRequest }>,
  reply: FastifyReply
): Promise<void> {
  const data = refreshTokenRequestSchema.parse(request.body);
  const authService = getAuthService();
  const deviceInfo = getDeviceInfo(request);

  const { tokens, session } = await authService.refreshToken(data.refreshToken, deviceInfo);

  void reply.status(200).send({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    tokenType: tokens.tokenType,
  });
}

/**
 * POST /auth/forgot-password - Request password reset
 */
async function forgotPasswordHandler(
  request: FastifyRequest<{ Body: ForgotPasswordRequest }>,
  reply: FastifyReply
): Promise<void> {
  const data = forgotPasswordRequestSchema.parse(request.body);
  const authService = getAuthService();

  const token = await authService.forgotPassword(data.email);

  // TODO: Send password reset email via notification service
  if (token) {
    request.log.info({ email: data.email, token }, 'Password reset requested');
  }

  // Always return success to prevent email enumeration
  void reply.status(200).send({
    success: true,
    message: 'If an account exists with this email, you will receive a password reset link.',
  });
}

/**
 * POST /auth/reset-password - Reset password with token
 */
async function resetPasswordHandler(
  request: FastifyRequest<{ Body: ResetPasswordRequest }>,
  reply: FastifyReply
): Promise<void> {
  const data = resetPasswordRequestSchema.parse(request.body);
  const authService = getAuthService();

  await authService.resetPassword(data.token, data.password);

  void reply.status(200).send({
    success: true,
    message: 'Password reset successful. You can now login with your new password.',
  });
}

/**
 * GET /auth/verify-email/:token - Verify email address
 */
async function verifyEmailHandler(
  request: FastifyRequest<{ Params: VerifyEmailParams }>,
  reply: FastifyReply
): Promise<void> {
  const params = verifyEmailParamsSchema.parse(request.params);
  const authService = getAuthService();

  const user = await authService.verifyEmail(params.token);

  void reply.status(200).send({
    success: true,
    message: 'Email verified successfully',
    user: {
      id: user.id,
      email: user.email,
      status: user.status,
      verificationLevel: user.verificationLevel,
    },
  });
}

/**
 * POST /auth/resend-verification - Resend verification email
 */
async function resendVerificationHandler(
  request: FastifyRequest<{ Body: ResendVerificationRequest }>,
  reply: FastifyReply
): Promise<void> {
  const data = resendVerificationRequestSchema.parse(request.body);
  const authService = getAuthService();

  const token = await authService.resendVerificationEmail(data.email);

  // TODO: Send verification email via notification service
  if (token) {
    request.log.info({ email: data.email, token }, 'Verification email resent');
  }

  // Always return success to prevent email enumeration
  void reply.status(200).send({
    success: true,
    message:
      'If an account exists with this email and is pending verification, a new verification link has been sent.',
  });
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

/**
 * Register authentication routes
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Registration
  fastify.post<{ Body: RegisterRequest }>(
    '/register',
    {
      preHandler: registrationRateLimitHook,
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 12 },
            firstName: { type: 'string', minLength: 1, maxLength: 100 },
            lastName: { type: 'string', minLength: 1, maxLength: 100 },
            displayName: { type: 'string', maxLength: 200 },
            timezone: { type: 'string', default: 'UTC' },
            locale: { type: 'string', default: 'en' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  email: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  status: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => registerHandler(request, reply)
  );

  // Login
  fastify.post<{ Body: LoginRequest }>(
    '/login',
    {
      preHandler: loginRateLimitHook,
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
            rememberMe: { type: 'boolean', default: false },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: { type: 'object' },
              tokens: { type: 'object' },
              session: { type: 'object' },
            },
          },
        },
      },
    },
    async (request, reply) => loginHandler(request, reply)
  );

  // Logout
  fastify.post<{ Body: LogoutRequest }>(
    '/logout',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', format: 'uuid' },
            allSessions: { type: 'boolean', default: false },
          },
        },
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
    async (request, reply) => logoutHandler(request, reply)
  );

  // Refresh token
  fastify.post<{ Body: RefreshTokenRequest }>(
    '/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              expiresIn: { type: 'number' },
              tokenType: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => refreshHandler(request, reply)
  );

  // Forgot password
  fastify.post<{ Body: ForgotPasswordRequest }>(
    '/forgot-password',
    {
      preHandler: passwordResetRateLimitHook,
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
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
    async (request, reply) => forgotPasswordHandler(request, reply)
  );

  // Reset password
  fastify.post<{ Body: ResetPasswordRequest }>(
    '/reset-password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['token', 'password', 'confirmPassword'],
          properties: {
            token: { type: 'string' },
            password: { type: 'string', minLength: 12 },
            confirmPassword: { type: 'string' },
          },
        },
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
    async (request, reply) => resetPasswordHandler(request, reply)
  );

  // Verify email
  fastify.get<{ Params: VerifyEmailParams }>(
    '/verify-email/:token',
    {
      schema: {
        params: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              user: { type: 'object' },
            },
          },
        },
      },
    },
    async (request, reply) => verifyEmailHandler(request, reply)
  );

  // Resend verification email
  fastify.post<{ Body: ResendVerificationRequest }>(
    '/resend-verification',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
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
    async (request, reply) => resendVerificationHandler(request, reply)
  );
}
