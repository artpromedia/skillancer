/**
 * @module @skillancer/integration-hub-svc/config
 * Service configuration
 */

import { z } from 'zod';

// ============================================================================
// CONFIGURATION SCHEMA
// ============================================================================

const configSchema = z.object({
  env: z.enum(['development', 'test', 'production']).default('development'),
  port: z.coerce.number().default(3006),
  host: z.string().default('0.0.0.0'),

  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    pretty: z.coerce.boolean().default(true),
  }),

  jwt: z
    .object({
      secret: z.string().optional(),
      issuer: z.string().default('skillancer'),
    })
    .optional(),

  redis: z.object({
    url: z.string().default('redis://localhost:6379'),
    keyPrefix: z.string().default('integration-hub:'),
  }),

  database: z.object({
    url: z.string(),
  }),

  encryption: z.object({
    tokenKey: z.string().min(32), // AES-256 requires 32 bytes
  }),

  oauth: z.object({
    stateExpirySeconds: z.coerce.number().default(300), // 5 minutes
    callbackBaseUrl: z.string().default('http://localhost:3006'),
  }),

  // OAuth Provider Credentials
  providers: z.object({
    slack: z
      .object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      })
      .optional(),
    google: z
      .object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      })
      .optional(),
    notion: z
      .object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      })
      .optional(),
    jira: z
      .object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      })
      .optional(),
    github: z
      .object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      })
      .optional(),
  }),
});

export type Config = z.infer<typeof configSchema>;

// ============================================================================
// CONFIGURATION LOADER
// ============================================================================

let config: Config | null = null;

export function getConfig(): Config {
  if (config) {
    return config;
  }

  config = configSchema.parse({
    env: process.env.NODE_ENV,
    port: process.env.PORT || process.env.INTEGRATION_HUB_PORT,
    host: process.env.HOST,

    logging: {
      level: process.env.LOG_LEVEL,
      pretty: process.env.LOG_PRETTY !== 'false',
    },

    jwt: {
      secret: process.env.JWT_SECRET,
      issuer: process.env.JWT_ISSUER,
    },

    redis: {
      url: process.env.REDIS_URL,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'integration-hub:',
    },

    database: {
      url: process.env.DATABASE_URL,
    },

    encryption: {
      tokenKey: (() => {
        const key = process.env.TOKEN_ENCRYPTION_KEY;
        if (!key) {
          throw new Error(
            'TOKEN_ENCRYPTION_KEY environment variable is required. ' +
            'Please set a secure 32+ character encryption key (64 hex chars for 32 bytes).'
          );
        }
        return key;
      })(),
    },

    oauth: {
      stateExpirySeconds: process.env.OAUTH_STATE_EXPIRY_SECONDS,
      callbackBaseUrl: process.env.OAUTH_CALLBACK_BASE_URL || process.env.PUBLIC_URL,
    },

    providers: {
      slack: {
        clientId: process.env.SLACK_CLIENT_ID,
        clientSecret: process.env.SLACK_CLIENT_SECRET,
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
      notion: {
        clientId: process.env.NOTION_CLIENT_ID,
        clientSecret: process.env.NOTION_CLIENT_SECRET,
      },
      jira: {
        clientId: process.env.JIRA_CLIENT_ID,
        clientSecret: process.env.JIRA_CLIENT_SECRET,
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      },
    },
  });

  return config;
}

export function resetConfig(): void {
  config = null;
}
