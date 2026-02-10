/**
 * @module @skillancer/auth-svc/routes/auth
 * Authentication routes for email/password auth
 */

import { NotificationServiceClient } from '@skillancer/service-client';

import { InvalidTokenError as _InvalidTokenError } from '../errors/index.js';
import {
  getClientIp,
  loginRateLimitHook,
  registrationRateLimitHook,
  passwordResetRateLimitHook,
} from '../middleware/rate-limit.js';
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
import { getAuthService, type LoginResult } from '../services/auth.service.js';
import { getTokenService } from '../services/token.service.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

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

// Notification client singleton
let notificationClient: NotificationServiceClient | null = null;

function getNotificationClient(): NotificationServiceClient {
  if (!notificationClient) {
    notificationClient = new NotificationServiceClient();
  }
  return notificationClient;
}

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

  // Send verification email via notification service (fire-and-forget, don't block registration)
  getNotificationClient()
    .sendEmailVerification(user.id, user.email, verificationToken)
    .then(() => {
      request.log.info({ userId: user.id }, 'Verification email sent');
    })
    .catch((error: unknown) => {
      // Log error but don't fail registration
      request.log.error(
        { userId: user.id, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to send verification email'
      );
    });

  // Send welcome email (fire-and-forget)
  getNotificationClient()
    .sendWelcomeEmail(user.id, user.email, user.firstName)
    .catch(() => {
      // Welcome email is non-critical
    });

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

  const result = await authService.login(data.email, data.password, deviceInfo);

  // Check if MFA is required
  if ('mfaRequired' in result && result.mfaRequired) {
    const mfaPending = result;
    void reply.status(200).send({
      mfaRequired: true,
      pendingSessionId: mfaPending.pendingSessionId,
      availableMethods: mfaPending.availableMethods,
      expiresAt: mfaPending.expiresAt.toISOString(),
      message: 'MFA verification required to complete login',
    });
    return;
  }

  // MFA not required or already verified - complete login
  const loginResult = result as LoginResult;
  const { user, tokens, session: _session } = loginResult;

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
      id: loginResult.session.sessionId,
      expiresAt: loginResult.session.expiresAt.toISOString(),
    },
    mfaVerified: loginResult.mfaVerified ?? false,
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

  const { tokens, session: _session } = await authService.refreshToken(
    data.refreshToken,
    deviceInfo
  );

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

  // Send password reset email via notification service
  if (token) {
    try {
      await getNotificationClient().sendPasswordReset(data.email, token);
      request.log.info({ email: data.email }, 'Password reset email sent');
    } catch (error) {
      request.log.error(
        { email: data.email, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to send password reset email'
      );
    }
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

  // Send verification email via notification service
  if (token) {
    try {
      // We need to get the user ID for the email - but we don't expose it to prevent enumeration
      // The notification service will handle this by looking up the user
      await getNotificationClient().sendEmail({
        to: data.email,
        templateId: 'email-verification',
        data: {
          verifyUrl: `${process.env.APP_URL}/verify-email?token=${token}`,
        },
      });
      request.log.info({ email: data.email }, 'Verification email resent');
    } catch (error) {
      request.log.error(
        { email: data.email, error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to resend verification email'
      );
    }
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
  await Promise.resolve();
  // Registration
  fastify.post<{ Body: RegisterRequest }>(
    '/register',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
    registerHandler
  );

  // Login
  fastify.post<{ Body: LoginRequest }>(
    '/login',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
    loginHandler
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
    logoutHandler
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
    refreshHandler
  );

  // Forgot password
  fastify.post<{ Body: ForgotPasswordRequest }>(
    '/forgot-password',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
    forgotPasswordHandler
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
    resetPasswordHandler
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
    verifyEmailHandler
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
    resendVerificationHandler
  );

  // Complete MFA login after verification
  fastify.post(
    '/login/mfa/complete',
    {
      schema: {
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['pendingSessionId', 'challengeId'],
          properties: {
            pendingSessionId: { type: 'string' },
            challengeId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              user: { type: 'object' },
              tokens: { type: 'object' },
              session: { type: 'object' },
              mfaVerified: { type: 'boolean' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { pendingSessionId, challengeId } = request.body as {
        pendingSessionId: string;
        challengeId: string;
      };
      const authService = getAuthService();

      const { user, tokens, session, mfaVerified } = await authService.completeMfaLogin(
        pendingSessionId,
        challengeId
      );

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
        mfaVerified,
      });
    }
  );
}
