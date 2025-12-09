/**
 * @module @skillancer/service-template
 * Skillancer Service Template
 */

// Application
export { buildApp, buildTestApp, type BuildAppOptions } from './app.js';

// Configuration
export {
  getConfig,
  clearConfigCache,
  validateConfig,
  loadEnv,
  configSchema,
  type Config,
  type Environment,
  type LogLevel,
} from './config/index.js';

// Plugins
export {
  registerPlugins,
  corsPlugin,
  helmetPlugin,
  sensiblePlugin,
  rateLimitPlugin,
  jwtPlugin,
  swaggerPlugin,
  underPressurePlugin,
  requestContextPlugin,
  type PluginOptions,
} from './plugins/index.js';

// Middleware
export { errorHandler, type ErrorResponse } from './middleware/error-handler.js';

// Routes
export { registerRoutes, healthRoutes, exampleRoutes } from './routes/index.js';

// Schemas
export {
  // Common
  uuidSchema,
  emailSchema,
  urlSchema,
  dateStringSchema,
  phoneSchema,
  // Pagination
  paginationSchema,
  sortSchema,
  searchSchema,
  listQuerySchema,
  // Params
  idParamSchema,
  idsBodySchema,
  // Date range
  dateRangeSchema,
  // Entities
  addressSchema,
  moneySchema,
  priceRangeSchema,
  // Status
  statusSchema,
  prioritySchema,
  // Utilities
  makeOptional,
  withId,
  withTimestamps,
  // Types
  type UUID,
  type Email,
  type Pagination,
  type Sort,
  type ListQuery,
  type Address,
  type Money,
  type Status,
  type Priority,
} from './schemas/index.js';

// Utils
export {
  // Logger
  getLogger,
  createChildLogger,
  logOperation,
  // Errors
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
  DatabaseError,
  ExternalServiceError,
  isAppError,
  isOperationalError,
  wrapError,
  type AppErrorOptions,
  // Validation
  validate,
  validateOrThrow,
  validateAsync,
  validateOrThrowAsync,
  formatZodErrors,
  getFirstZodError,
  emptyStringToUndefined,
  trimmedString,
  nullable,
  optionalNullish,
  coerceBoolean,
  commaSeparatedArray,
  jsonString,
  parsePagination,
  calculateOffset,
  calculateTotalPages,
  buildPaginationMeta,
  zodToFastifySchema,
  z,
  type ValidationResult,
  type ZodSchema,
  type ZodError,
  type ZodIssue,
  // HTTP
  createHttpClient,
  withRetry,
  createCircuitBreaker,
  sleep,
  timeout,
  buildQueryString,
  parseQueryString,
  type HttpClientOptions,
  type RequestOptions,
  type HttpResponse,
  type RetryOptions,
  type CircuitBreakerOptions,
  type HttpClient,
  type CircuitBreaker,
} from './utils/index.js';

// Types
export type {
  PaginationQuery,
  SortQuery,
  SearchQuery,
  ListQuery as ListQueryType,
  PaginationMeta,
  ListResponse,
  RouteHandler,
  ServiceContext,
  BaseEntity,
  SoftDeleteEntity,
  Nullable,
  Optional,
  DeepPartial,
  RequireAtLeastOne,
} from './types/index.js';
