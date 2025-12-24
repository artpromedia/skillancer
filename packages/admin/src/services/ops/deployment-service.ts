/**
 * @module @skillancer/admin/services/ops
 * Deployment management service
 */

import axios from 'axios';

import type { Redis } from 'ioredis';

export interface Deployment {
  id: string;
  service: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  deployedBy: string;
  deployedAt: Date;
  completedAt?: Date;
  commitSha: string;
  commitMessage: string;
  changelog: string[];
  rollbackVersion?: string;
  healthCheckStatus: 'pending' | 'healthy' | 'unhealthy';
  metrics?: {
    errorRateBefore: number;
    errorRateAfter: number;
    latencyBefore: number;
    latencyAfter: number;
  };
}

export interface DeploymentConfig {
  service: string;
  version: string;
  environment: string;
  strategy: 'rolling' | 'blue_green' | 'canary';
  canaryPercentage?: number;
  healthCheckPath: string;
  healthCheckTimeout: number;
  rollbackOnFailure: boolean;
}

export interface ServiceVersion {
  service: string;
  currentVersion: string;
  previousVersion: string;
  availableVersions: string[];
  lastDeployedAt: Date;
  lastDeployedBy: string;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export class DeploymentService {
  constructor(
    private redis: Redis,
    private logger: Logger,
    private k8sApiUrl?: string,
    private argocdUrl?: string
  ) {}

  // ==================== Deployment History ====================

  async getDeployments(filters: {
    service?: string;
    environment?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ deployments: Deployment[]; total: number }> {
    const deploymentsJson = (await this.redis.get('ops:deployments')) || '[]';
    let deployments: Deployment[] = JSON.parse(deploymentsJson);

    if (filters.service) {
      deployments = deployments.filter((d) => d.service === filters.service);
    }
    if (filters.environment) {
      deployments = deployments.filter((d) => d.environment === filters.environment);
    }
    if (filters.status) {
      deployments = deployments.filter((d) => d.status === filters.status);
    }

    const total = deployments.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 20;

    return {
      deployments: deployments.slice(offset, offset + limit),
      total,
    };
  }

  async getDeployment(deploymentId: string): Promise<Deployment | null> {
    const deploymentsJson = (await this.redis.get('ops:deployments')) || '[]';
    const deployments: Deployment[] = JSON.parse(deploymentsJson);
    return deployments.find((d) => d.id === deploymentId) || null;
  }

  async getServiceVersions(): Promise<ServiceVersion[]> {
    try {
      const services = [
        'skillpod-api',
        'market-api',
        'cockpit-api',
        'auth-service',
        'email-worker',
        'video-processor',
        'search-indexer',
      ];

      const versions: ServiceVersion[] = [];

      for (const service of services) {
        const version = await this.getServiceVersion(service);
        if (version) {
          versions.push(version);
        }
      }

      return versions;
    } catch (error) {
      this.logger.error('Failed to get service versions', { error });
      return [];
    }
  }

  private async getServiceVersion(service: string): Promise<ServiceVersion | null> {
    try {
      if (!this.k8sApiUrl) {
        // Return mock data for development
        return {
          service,
          currentVersion: 'v1.0.0',
          previousVersion: 'v0.9.0',
          availableVersions: ['latest', 'v1.0.0', 'v0.9.0', 'v0.8.0'],
          lastDeployedAt: new Date(),
          lastDeployedBy: 'system',
        };
      }

      const response = await axios.get(
        `${this.k8sApiUrl}/apis/apps/v1/namespaces/production/deployments/${service}`,
        {
          headers: { Authorization: `Bearer ${process.env.K8S_TOKEN}` },
        }
      );

      const deployment = response.data;
      const currentVersion =
        deployment.spec.template.spec.containers[0]?.image?.split(':')[1] || 'unknown';

      const availableVersions = await this.getAvailableVersions(service);

      return {
        service,
        currentVersion,
        previousVersion: deployment.metadata.annotations?.['skillancer.com/previous-version'] || '',
        availableVersions,
        lastDeployedAt: new Date(deployment.metadata.creationTimestamp),
        lastDeployedBy: deployment.metadata.annotations?.['skillancer.com/deployed-by'] || 'system',
      };
    } catch (error) {
      this.logger.error(`Failed to get version for ${service}`, { error });
      return null;
    }
  }

  private async getAvailableVersions(_service: string): Promise<string[]> {
    // This would query the container registry
    return ['latest', 'v1.2.3', 'v1.2.2', 'v1.2.1', 'v1.2.0'];
  }

  // ==================== Deployment Operations ====================

  async triggerDeployment(config: DeploymentConfig, adminUserId: string): Promise<Deployment> {
    const deploymentId = `deploy-${Date.now()}`;

    const deployment: Deployment = {
      id: deploymentId,
      service: config.service,
      version: config.version,
      environment: config.environment as Deployment['environment'],
      status: 'pending',
      deployedBy: adminUserId,
      deployedAt: new Date(),
      commitSha: '',
      commitMessage: '',
      changelog: [],
      healthCheckStatus: 'pending',
    };

    await this.storeDeployment(deployment);

    try {
      await this.executeDeployment(config, deployment);
      deployment.status = 'in_progress';
      await this.storeDeployment(deployment);

      this.monitorDeploymentHealth(deployment, config);
    } catch (error) {
      deployment.status = 'failed';
      await this.storeDeployment(deployment);
      throw error;
    }

    this.logger.info('Deployment triggered', {
      deploymentId,
      service: config.service,
      version: config.version,
    });

    return deployment;
  }

  private async executeDeployment(
    config: DeploymentConfig,
    _deployment: Deployment
  ): Promise<void> {
    if (this.argocdUrl) {
      await axios.post(
        `${this.argocdUrl}/api/v1/applications/${config.service}/sync`,
        {
          revision: config.version,
          prune: true,
          dryRun: false,
          strategy: {
            hook: {
              force: false,
            },
          },
        },
        {
          headers: { Authorization: `Bearer ${process.env.ARGOCD_TOKEN}` },
        }
      );
    }
  }

  private async monitorDeploymentHealth(
    deployment: Deployment,
    config: DeploymentConfig
  ): Promise<void> {
    const maxAttempts = 30;
    const interval = 10000;
    let attempts = 0;

    const checkHealth = async () => {
      attempts++;

      try {
        const response = await axios.get(`http://${config.service}:3000${config.healthCheckPath}`, {
          timeout: config.healthCheckTimeout,
        });

        if (response.status === 200) {
          deployment.healthCheckStatus = 'healthy';
          deployment.status = 'completed';
          deployment.completedAt = new Date();
          await this.storeDeployment(deployment);
          this.logger.info('Deployment completed successfully', { deploymentId: deployment.id });
          return;
        }
      } catch (error) {
        // Health check failed
      }

      if (attempts >= maxAttempts) {
        deployment.healthCheckStatus = 'unhealthy';

        if (config.rollbackOnFailure) {
          await this.rollback(deployment.id, 'system', 'Health check failed');
        } else {
          deployment.status = 'failed';
          await this.storeDeployment(deployment);
        }
        return;
      }

      setTimeout(checkHealth, interval);
    };

    setTimeout(checkHealth, interval);
  }

  async rollback(deploymentId: string, adminUserId: string, reason: string): Promise<Deployment> {
    const deployment = await this.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const serviceVersion = await this.getServiceVersion(deployment.service);
    if (!serviceVersion || !serviceVersion.previousVersion) {
      throw new Error('No previous version to rollback to');
    }

    const rollbackDeployment = await this.triggerDeployment(
      {
        service: deployment.service,
        version: serviceVersion.previousVersion,
        environment: deployment.environment,
        strategy: 'rolling',
        healthCheckPath: '/health',
        healthCheckTimeout: 5000,
        rollbackOnFailure: false,
      },
      adminUserId
    );

    deployment.status = 'rolled_back';
    deployment.rollbackVersion = serviceVersion.previousVersion;
    await this.storeDeployment(deployment);

    this.logger.warn('Deployment rolled back', {
      deploymentId,
      rollbackVersion: serviceVersion.previousVersion,
      reason,
    });

    return rollbackDeployment;
  }

  private async storeDeployment(deployment: Deployment): Promise<void> {
    const deploymentsJson = (await this.redis.get('ops:deployments')) || '[]';
    const deployments: Deployment[] = JSON.parse(deploymentsJson);

    const index = deployments.findIndex((d) => d.id === deployment.id);
    if (index >= 0) {
      deployments[index] = deployment;
    } else {
      deployments.unshift(deployment);
    }

    await this.redis.set('ops:deployments', JSON.stringify(deployments.slice(0, 100)));
  }

  // ==================== Canary Deployments ====================

  async enableCanary(service: string, percentage: number): Promise<void> {
    await this.redis.setex(
      `canary:${service}`,
      3600,
      JSON.stringify({ enabled: true, percentage })
    );
    this.logger.info('Canary enabled', { service, percentage });
  }

  async disableCanary(service: string): Promise<void> {
    await this.redis.del(`canary:${service}`);
    this.logger.info('Canary disabled', { service });
  }

  async promoteCanary(service: string): Promise<void> {
    await this.disableCanary(service);
    this.logger.info('Canary promoted', { service });
  }
}
