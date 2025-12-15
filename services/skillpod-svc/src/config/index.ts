/**
 * @module @skillancer/skillpod-svc/config
 * Configuration management for SkillPod VDI service
 */

import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export interface SkillPodConfig {
  service: {
    name: string;
    port: number;
    host: string;
    environment: string;
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  vdi: {
    provider: 'kasm' | 'appstream';
    kasmApiUrl: string;
    kasmApiKey: string;
    kasmApiSecret: string;
    appstreamStackName?: string;
    appstreamFleetName?: string;
  };
  security: {
    jwtSecret: string;
    sessionTimeout: number;
    maxSessionDuration: number;
  };
  containment: {
    defaultClipboardPolicy: 'BLOCKED' | 'READ_ONLY' | 'WRITE_ONLY' | 'BIDIRECTIONAL';
    defaultFileDownloadPolicy: 'BLOCKED' | 'ALLOWED' | 'APPROVAL_REQUIRED';
    defaultFileUploadPolicy: 'BLOCKED' | 'ALLOWED' | 'APPROVAL_REQUIRED';
    maxFileSize: number;
    screenCaptureBlockingEnabled: boolean;
    watermarkEnabled: boolean;
    violationAlertThreshold: number;
  };
  logging: {
    level: string;
    pretty: boolean;
  };
  audit: {
    serviceUrl: string;
    enabled: boolean;
  };
}

let configInstance: SkillPodConfig | null = null;

export function getConfig(): SkillPodConfig {
  if (configInstance) {
    return configInstance;
  }

  const vdiConfig: SkillPodConfig['vdi'] = {
    provider: (process.env.VDI_PROVIDER as 'kasm' | 'appstream') || 'kasm',
    kasmApiUrl: process.env.KASM_API_URL || 'https://kasm.example.com/api/public',
    kasmApiKey: process.env.KASM_API_KEY || '',
    kasmApiSecret: process.env.KASM_API_SECRET || '',
  };

  if (process.env.APPSTREAM_STACK_NAME) {
    vdiConfig.appstreamStackName = process.env.APPSTREAM_STACK_NAME;
  }
  if (process.env.APPSTREAM_FLEET_NAME) {
    vdiConfig.appstreamFleetName = process.env.APPSTREAM_FLEET_NAME;
  }

  configInstance = {
    service: {
      name: process.env.SERVICE_NAME || 'skillpod-svc',
      port: Number.parseInt(process.env.PORT || '4004', 10),
      host: process.env.HOST || '0.0.0.0',
      environment: process.env.NODE_ENV || 'development',
    },
    database: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/skillancer',
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    vdi: vdiConfig,
    security: {
      jwtSecret: process.env.JWT_SECRET || 'development-secret',
      sessionTimeout: Number.parseInt(process.env.SESSION_TIMEOUT_MINUTES || '15', 10),
      maxSessionDuration: Number.parseInt(process.env.MAX_SESSION_DURATION_MINUTES || '480', 10),
    },
    containment: {
      defaultClipboardPolicy:
        (process.env
          .DEFAULT_CLIPBOARD_POLICY as SkillPodConfig['containment']['defaultClipboardPolicy']) ||
        'BLOCKED',
      defaultFileDownloadPolicy:
        (process.env
          .DEFAULT_FILE_DOWNLOAD_POLICY as SkillPodConfig['containment']['defaultFileDownloadPolicy']) ||
        'BLOCKED',
      defaultFileUploadPolicy:
        (process.env
          .DEFAULT_FILE_UPLOAD_POLICY as SkillPodConfig['containment']['defaultFileUploadPolicy']) ||
        'ALLOWED',
      maxFileSize: Number.parseInt(process.env.MAX_FILE_SIZE_BYTES || '104857600', 10), // 100MB default
      screenCaptureBlockingEnabled: process.env.SCREEN_CAPTURE_BLOCKING !== 'false',
      watermarkEnabled: process.env.WATERMARK_ENABLED !== 'false',
      violationAlertThreshold: Number.parseInt(process.env.VIOLATION_ALERT_THRESHOLD || '5', 10),
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      pretty: process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV === 'development',
    },
    audit: {
      serviceUrl: process.env.AUDIT_SERVICE_URL || 'http://localhost:4005',
      enabled: process.env.AUDIT_ENABLED !== 'false',
    },
  };

  return configInstance;
}

export function resetConfig(): void {
  configInstance = null;
}

// Convenience accessors
export const config = {
  get service() {
    return getConfig().service;
  },
  get database() {
    return getConfig().database;
  },
  get redis() {
    return getConfig().redis;
  },
  get vdi() {
    return getConfig().vdi;
  },
  get kasm() {
    const cfg = getConfig().vdi;
    return {
      apiUrl: cfg.kasmApiUrl,
      apiKey: cfg.kasmApiKey,
      apiSecret: cfg.kasmApiSecret,
    };
  },
  get security() {
    return getConfig().security;
  },
  get containment() {
    return getConfig().containment;
  },
  get logging() {
    return getConfig().logging;
  },
  get audit() {
    return getConfig().audit;
  },
};
