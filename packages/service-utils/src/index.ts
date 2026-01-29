/**
 * @module @skillancer/service-utils
 * Shared utilities for Skillancer microservices
 */

// Health check utilities
export {
  registerHealthRoutes,
  healthRoutesPlugin,
  type HealthCheckConfig,
  type HealthCheckResult,
  type HealthResponse,
  type ReadinessResponse,
  type LivenessResponse,
} from './health/index.js';

// API Versioning
export {
  versioningPlugin,
  versionedPrefix,
  createVersionedHandler,
  versioned,
  type VersioningStrategy,
  type ApiVersion,
  type VersioningConfig,
  type VersionedRoute,
} from './versioning/index.js';

// Request Validation
export {
  validationPlugin,
  paginationSchema,
  idParamSchema,
  slugParamSchema,
  dateRangeSchema,
  searchSchema,
  createRouteSchema,
  extendSchema,
  partialSchema,
  type ValidationSchemas,
  type ValidationError,
  type ValidationErrorResponse,
  type ValidatorConfig,
  type PaginationQuery,
  type IdParam,
  type SlugParam,
  type DateRangeQuery,
  type SearchQuery,
} from './validation/index.js';

// Input Sanitization
export {
  sanitizationPlugin,
  sanitizeString,
  sanitizeObject,
  sanitizeUrl,
  sanitizeEmail,
  sanitizeFilename,
  encodeHtmlEntities,
  decodeHtmlEntities,
  stripDangerousHtml,
  stripAllHtml,
  detectSqlInjection,
  escapeSqlString,
  type SanitizationConfig,
  type SanitizedResult,
  type SanitizationPluginConfig,
} from './sanitization/index.js';

// CSRF Protection
export {
  csrfPlugin,
  getCsrfToken,
  createCsrfFetch,
  createExpressCsrfMiddleware,
  csrfClientConfig,
  type CsrfConfig,
  type CsrfToken,
  type CsrfFetchOptions,
} from './csrf/index.js';
