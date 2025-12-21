// @ts-nocheck - Fastify type compatibility issues
/**
 * @module @skillancer/api-gateway/plugins/cors
 * CORS configuration plugin
 */

import cors from '@fastify/cors';
import fp from 'fastify-plugin';

import { getConfig } from '../config/index.js';

import type { FastifyInstance } from 'fastify';

async function corsPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  // Parse allowed origins from config
  const configuredOrigins = config.cors.origins
    ? config.cors.origins.split(',').map((o) => o.trim())
    : [];

  // Default allowed origins
  const defaultOrigins = [
    'https://skillancer.com',
    'https://www.skillancer.com',
    'https://market.skillancer.com',
    'https://cockpit.skillancer.com',
    'https://skillpod.skillancer.com',
  ];

  // Development origins
  const devOrigins =
    config.env === 'development'
      ? [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:4000',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:4000',
        ]
      : [];

  const allowedOrigins = [...new Set([...defaultOrigins, ...configuredOrigins, ...devOrigins])];

  await app.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (config.env === 'development') {
        // In development, allow all origins but log a warning
        app.log.warn({ origin }, 'CORS: allowing unlisted origin in development');
        callback(null, true);
      } else {
        app.log.warn({ origin }, 'CORS: blocked request from unlisted origin');
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Correlation-ID',
      'X-Tenant-ID',
      'Accept',
      'Accept-Language',
      'Origin',
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ],
    maxAge: 86400, // 24 hours
    preflight: true,
    strictPreflight: true,
  });
}

export const corsPlugin = fp(corsPluginImpl, {
  name: 'cors-plugin',
});
