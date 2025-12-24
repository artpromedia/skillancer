/**
 * @module @skillancer/admin/services/ops
 * Operations services exports
 */

// Re-export services (Logger interface is duplicated, so export selectively)
export {
  SystemHealthService,
  type SystemHealth,
  type ServiceHealth,
  type InfrastructureHealth,
  type Alert,
  type Incident,
} from './system-health-service.js';

export {
  QueueManagementService,
  type QueueInfo,
  type JobInfo,
} from './queue-management-service.js';

export {
  CacheManagementService,
  type CacheStats,
  type CacheKey,
  type CacheGroup,
  type MemoryAnalysis,
} from './cache-management-service.js';

export {
  DatabaseOpsService,
  type DatabaseStats,
  type ActiveQuery,
  type TableStats,
  type IndexStats,
  type MigrationInfo,
} from './database-ops-service.js';

export {
  DeploymentService,
  type Deployment,
  type DeploymentConfig,
  type ServiceVersion,
} from './deployment-service.js';
