/**
 * @module @skillancer/admin/services/ops
 * System health monitoring service
 */

import axios from 'axios';

import type { Redis } from 'ioredis';

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime: number;
  lastCheck: Date;
  details?: Record<string, unknown>;
  error?: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  infrastructure: {
    database: ServiceHealth;
    cache: ServiceHealth;
    queue: ServiceHealth;
    storage: ServiceHealth;
  };
  metrics: {
    uptime: number;
    requestsPerMinute: number;
    errorRate: number;
    avgResponseTime: number;
  };
  lastUpdated: Date;
}

export interface HealthEndpoint {
  name: string;
  url: string;
  type: 'http' | 'tcp' | 'custom';
  timeout: number;
  interval: number;
  expectedStatus?: number;
  expectedBody?: string;
}

export interface SystemAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  service: string;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  affectedServices: string[];
  createdAt: Date;
  createdBy: string;
  updates: IncidentUpdate[];
}

export interface IncidentUpdate {
  id: string;
  message: string;
  status: Incident['status'];
  createdAt: Date;
  createdBy: string;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export class SystemHealthService {
  private endpoints: HealthEndpoint[] = [
    {
      name: 'skillpod-api',
      url: 'http://skillpod-api:3000/health',
      type: 'http',
      timeout: 5000,
      interval: 30000,
    },
    {
      name: 'market-api',
      url: 'http://market-api:3000/health',
      type: 'http',
      timeout: 5000,
      interval: 30000,
    },
    {
      name: 'cockpit-api',
      url: 'http://cockpit-api:3000/health',
      type: 'http',
      timeout: 5000,
      interval: 30000,
    },
    {
      name: 'auth-service',
      url: 'http://auth-service:3000/health',
      type: 'http',
      timeout: 5000,
      interval: 30000,
    },
  ];

  constructor(
    private redis: Redis,
    private logger: Logger,
    private alertmanagerUrl?: string
  ) {}

  async getSystemHealth(): Promise<SystemHealth> {
    const [services, infrastructure, metrics] = await Promise.all([
      this.checkAllServices(),
      this.checkInfrastructure(),
      this.getSystemMetrics(),
    ]);

    const unhealthyCount =
      services.filter((s) => s.status === 'unhealthy').length +
      Object.values(infrastructure).filter((s) => s.status === 'unhealthy').length;

    const degradedCount =
      services.filter((s) => s.status === 'degraded').length +
      Object.values(infrastructure).filter((s) => s.status === 'degraded').length;

    let overall: SystemHealth['overall'] = 'healthy';
    if (unhealthyCount > 0) overall = 'unhealthy';
    else if (degradedCount > 0) overall = 'degraded';

    const health: SystemHealth = {
      overall,
      services,
      infrastructure,
      metrics,
      lastUpdated: new Date(),
    };

    await this.redis.setex('system:health', 30, JSON.stringify(health));

    return health;
  }

  private async checkAllServices(): Promise<ServiceHealth[]> {
    return Promise.all(this.endpoints.map((endpoint) => this.checkService(endpoint)));
  }

  async checkService(endpoint: HealthEndpoint): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      const response = await axios.get(endpoint.url, {
        timeout: endpoint.timeout,
        validateStatus: () => true,
      });

      const responseTime = Date.now() - startTime;
      const expectedStatus = endpoint.expectedStatus || 200;

      let status: ServiceHealth['status'] = 'healthy';
      if (response.status !== expectedStatus) {
        status = 'unhealthy';
      } else if (responseTime > endpoint.timeout * 0.8) {
        status = 'degraded';
      }

      return {
        name: endpoint.name,
        status,
        responseTime,
        lastCheck: new Date(),
        details: response.data,
      };
    } catch (error) {
      return {
        name: endpoint.name,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: (error as Error).message,
      };
    }
  }

  private async checkInfrastructure(): Promise<SystemHealth['infrastructure']> {
    const [database, cache, queue, storage] = await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
      this.checkQueue(),
      this.checkStorage(),
    ]);

    return { database, cache, queue, storage };
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // Check via health endpoint or direct connection
      const response = await axios.get('http://localhost:3000/health/db', { timeout: 5000 });
      return {
        name: 'database',
        status: response.data.healthy ? 'healthy' : 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: response.data,
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: (error as Error).message,
      };
    }
  }

  private async checkCache(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      await this.redis.ping();
      const info = await this.redis.info('server');
      return {
        name: 'cache',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: { info: info.substring(0, 200) },
      };
    } catch (error) {
      return {
        name: 'cache',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: (error as Error).message,
      };
    }
  }

  private async checkQueue(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // Check BullMQ via Redis
      const queueKeys = await this.redis.keys('bull:*:waiting');
      return {
        name: 'queue',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: { queuesFound: queueKeys.length },
      };
    } catch (error) {
      return {
        name: 'queue',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: (error as Error).message,
      };
    }
  }

  private async checkStorage(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // Would check S3/storage health
      return {
        name: 'storage',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        name: 'storage',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: (error as Error).message,
      };
    }
  }

  private async getSystemMetrics(): Promise<SystemHealth['metrics']> {
    const uptime = process.uptime();

    // Get from metrics store
    const [rpmValue, errorRateValue, avgResponseValue] = await Promise.all([
      this.redis.get('metrics:rpm'),
      this.redis.get('metrics:error_rate'),
      this.redis.get('metrics:avg_response_time'),
    ]);

    return {
      uptime,
      requestsPerMinute: parseFloat(rpmValue ?? '0'),
      errorRate: parseFloat(errorRateValue ?? '0'),
      avgResponseTime: parseFloat(avgResponseValue ?? '0'),
    };
  }

  // ==================== Alerts ====================

  async getActiveAlerts(): Promise<SystemAlert[]> {
    const alertsJson = (await this.redis.get('system:alerts')) || '[]';
    return JSON.parse(alertsJson);
  }

  async acknowledgeAlert(alertId: string, adminUserId: string, duration?: number): Promise<void> {
    const alerts = await this.getActiveAlerts();
    const alert = alerts.find((a) => a.id === alertId);

    if (alert) {
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = adminUserId;

      await this.redis.set('system:alerts', JSON.stringify(alerts));

      if (duration) {
        // Auto-unacknowledge after duration
        setTimeout(async () => {
          const currentAlerts = await this.getActiveAlerts();
          const currentAlert = currentAlerts.find((a) => a.id === alertId);
          if (currentAlert && !currentAlert.resolvedAt) {
            currentAlert.acknowledgedAt = undefined;
            currentAlert.acknowledgedBy = undefined;
            await this.redis.set('system:alerts', JSON.stringify(currentAlerts));
          }
        }, duration);
      }
    }
  }

  async createAlert(alert: Omit<SystemAlert, 'id' | 'createdAt'>): Promise<SystemAlert> {
    const newAlert: SystemAlert = {
      ...alert,
      id: `alert-${Date.now()}`,
      createdAt: new Date(),
    };

    const alerts = await this.getActiveAlerts();
    alerts.push(newAlert);
    await this.redis.set('system:alerts', JSON.stringify(alerts));

    // Send to Alertmanager if configured
    if (this.alertmanagerUrl) {
      await this.sendToAlertmanager(newAlert);
    }

    return newAlert;
  }

  private async sendToAlertmanager(alert: SystemAlert): Promise<void> {
    try {
      await axios.post(`${this.alertmanagerUrl}/api/v1/alerts`, [
        {
          labels: {
            alertname: alert.title,
            severity: alert.severity,
            service: alert.service,
          },
          annotations: {
            summary: alert.title,
            description: alert.message,
          },
        },
      ]);
    } catch (error) {
      this.logger.error('Failed to send alert to Alertmanager', { error });
    }
  }

  // ==================== Incidents ====================

  async getActiveIncidents(): Promise<Incident[]> {
    const incidentsJson = (await this.redis.get('system:incidents')) || '[]';
    const incidents: Incident[] = JSON.parse(incidentsJson);
    return incidents.filter((i) => i.status !== 'resolved');
  }

  async createIncident(
    data: Omit<Incident, 'id' | 'createdAt' | 'updates'>,
    adminUserId: string
  ): Promise<Incident> {
    const incident: Incident = {
      ...data,
      id: `incident-${Date.now()}`,
      createdAt: new Date(),
      createdBy: adminUserId,
      updates: [],
    };

    const incidentsJson = (await this.redis.get('system:incidents')) || '[]';
    const incidents: Incident[] = JSON.parse(incidentsJson);
    incidents.push(incident);
    await this.redis.set('system:incidents', JSON.stringify(incidents));

    this.logger.warn('Incident created', { incidentId: incident.id, title: incident.title });

    return incident;
  }

  async updateIncident(
    incidentId: string,
    update: { message: string; status?: Incident['status'] },
    adminUserId: string
  ): Promise<Incident> {
    const incidentsJson = (await this.redis.get('system:incidents')) || '[]';
    const incidents: Incident[] = JSON.parse(incidentsJson);
    const incident = incidents.find((i) => i.id === incidentId);

    if (!incident) {
      throw new Error('Incident not found');
    }

    const incidentUpdate: IncidentUpdate = {
      id: `update-${Date.now()}`,
      message: update.message,
      status: update.status || incident.status,
      createdAt: new Date(),
      createdBy: adminUserId,
    };

    incident.updates.push(incidentUpdate);
    if (update.status) {
      incident.status = update.status;
    }

    await this.redis.set('system:incidents', JSON.stringify(incidents));

    return incident;
  }
}
