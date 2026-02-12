/**
 * @module @skillancer/skillpod-svc/services/storage
 * Storage service for managing persistent volumes with Hetzner Cloud
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import type { CreateVolumeParams, VolumeInfo } from '../types/environment.types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface StorageService {
  createVolume(params: CreateVolumeParams): Promise<string>;
  getVolume(volumeId: string): Promise<VolumeInfo | null>;
  deleteVolume(volumeId: string): Promise<void>;
  resizeVolume(volumeId: string, newSizeGb: number): Promise<void>;
  attachVolume(volumeId: string, instanceId: string, devicePath: string): Promise<void>;
  detachVolume(volumeId: string): Promise<void>;
  listVolumes(tenantId: string): Promise<VolumeInfo[]>;
  getVolumeStatus(volumeId: string): Promise<string>;
}

interface HetznerVolume {
  id: number;
  name: string;
  size: number;
  location: { name: string };
  server: number | null;
  status: string;
  created: string;
  labels: Record<string, string>;
}

interface HetznerApiResponse<T> {
  [key: string]: T;
}

// =============================================================================
// HETZNER CLOUD API CLIENT
// =============================================================================

class HetznerCloudClient {
  private readonly apiToken: string;
  private readonly baseUrl = 'https://api.hetzner.cloud/v1';

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hetzner API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  async createVolume(params: {
    name: string;
    size: number;
    location: string;
    labels: Record<string, string>;
  }): Promise<HetznerVolume> {
    const response = await this.request<HetznerApiResponse<HetznerVolume>>('POST', '/volumes', {
      name: params.name,
      size: params.size,
      location: params.location,
      labels: params.labels,
      format: 'ext4',
      automount: false,
    });
    return response.volume;
  }

  async getVolume(volumeId: number): Promise<HetznerVolume> {
    const response = await this.request<HetznerApiResponse<HetznerVolume>>(
      'GET',
      `/volumes/${volumeId}`
    );
    return response.volume;
  }

  async deleteVolume(volumeId: number): Promise<void> {
    await this.request('DELETE', `/volumes/${volumeId}`);
  }

  async resizeVolume(volumeId: number, size: number): Promise<void> {
    await this.request('POST', `/volumes/${volumeId}/actions/resize`, { size });
  }

  async attachVolume(volumeId: number, serverId: number): Promise<void> {
    await this.request('POST', `/volumes/${volumeId}/actions/attach`, {
      server: serverId,
      automount: false,
    });
  }

  async detachVolume(volumeId: number): Promise<void> {
    await this.request('POST', `/volumes/${volumeId}/actions/detach`);
  }

  async listVolumes(labelSelector?: string): Promise<HetznerVolume[]> {
    const endpoint = labelSelector
      ? `/volumes?label_selector=${encodeURIComponent(labelSelector)}`
      : '/volumes';

    const response = await this.request<{ volumes: HetznerVolume[] }>('GET', endpoint);
    return response.volumes;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getHetznerClient(): HetznerCloudClient {
  const apiToken = process.env.HETZNER_API_TOKEN;

  if (!apiToken) {
    throw new Error('HETZNER_API_TOKEN environment variable not set');
  }

  return new HetznerCloudClient(apiToken);
}

function getHetznerLocation(): string {
  return process.env.HETZNER_LOCATION || 'fsn1'; // Default: Falkenstein, Germany
}

function convertHetznerVolumeToVolumeInfo(volume: HetznerVolume): VolumeInfo {
  return {
    volumeId: volume.id.toString(),
    name: volume.name,
    sizeGb: volume.size,
    status: volume.status,
    createdAt: new Date(volume.created),
  };
}

/**
 * Create a new Hetzner Cloud volume
 */
async function createVolumeImpl(_region: string, params: CreateVolumeParams): Promise<string> {
  console.log(`Creating Hetzner Cloud volume`);
  console.log(`  Tenant: ${params.tenantId}`);
  console.log(`  Name: ${params.name}`);
  console.log(`  Size: ${params.sizeGb} GB`);
  console.log(`  Location: ${getHetznerLocation()}`);

  const client = getHetznerClient();

  const volume = await client.createVolume({
    name: params.name,
    size: params.sizeGb,
    location: getHetznerLocation(),
    labels: {
      tenant_id: params.tenantId,
      environment: params.environment || 'production',
      managed_by: 'skillancer',
      purpose: 'skillpod-storage',
    },
  });

  console.log(`  Created volume ID: ${volume.id}`);

  return volume.id.toString();
}

/**
 * Get volume information
 */
async function getVolumeImpl(_region: string, volumeId: string): Promise<VolumeInfo | null> {
  console.log(`Getting volume info: ${volumeId}`);

  try {
    const client = getHetznerClient();
    const volume = await client.getVolume(Number.parseInt(volumeId));
    return convertHetznerVolumeToVolumeInfo(volume);
  } catch (error) {
    console.error(`Failed to get volume ${volumeId}:`, error);
    return null;
  }
}

/**
 * Delete a volume
 */
async function deleteVolumeImpl(_region: string, volumeId: string): Promise<void> {
  console.log(`Deleting volume: ${volumeId}`);

  const client = getHetznerClient();
  await client.deleteVolume(Number.parseInt(volumeId));

  console.log(`  Volume ${volumeId} deleted`);
}

/**
 * Resize a volume
 */
async function resizeVolumeImpl(
  _region: string,
  volumeId: string,
  newSizeGb: number
): Promise<void> {
  console.log(`Resizing volume ${volumeId} to ${newSizeGb} GB`);

  const client = getHetznerClient();
  await client.resizeVolume(Number.parseInt(volumeId), newSizeGb);

  console.log(`  Volume ${volumeId} resized to ${newSizeGb} GB`);
}

/**
 * Attach volume to a server
 */
async function attachVolumeImpl(
  _region: string,
  volumeId: string,
  serverId: string,
  _devicePath: string // devicePath not needed for Hetzner (auto-assigned)
): Promise<void> {
  console.log(`Attaching volume ${volumeId} to server ${serverId}`);

  const client = getHetznerClient();
  await client.attachVolume(Number.parseInt(volumeId), Number.parseInt(serverId));

  console.log(`  Volume ${volumeId} attached to server ${serverId}`);
}

/**
 * Detach volume from a server
 */
async function detachVolumeImpl(_region: string, volumeId: string): Promise<void> {
  console.log(`Detaching volume: ${volumeId}`);

  const client = getHetznerClient();
  await client.detachVolume(Number.parseInt(volumeId));

  console.log(`  Volume ${volumeId} detached`);
}

/**
 * List volumes for a tenant
 */
async function listVolumesImpl(_region: string, tenantId: string): Promise<VolumeInfo[]> {
  console.log(`Listing volumes for tenant: ${tenantId}`);

  const client = getHetznerClient();
  const volumes = await client.listVolumes(`tenant_id=${tenantId}`);

  return volumes.map(convertHetznerVolumeToVolumeInfo);
}

// =============================================================================
// SERVICE FACTORY
// =============================================================================

// Hetzner location from environment (default: Falkenstein)
const HETZNER_LOCATION = process.env.HETZNER_LOCATION || 'fsn1';

export function createStorageService(): StorageService {
  const region = HETZNER_LOCATION;

  return {
    createVolume: async (params: CreateVolumeParams) => createVolumeImpl(region, params),
    getVolume: async (volumeId: string) => getVolumeImpl(region, volumeId),
    deleteVolume: async (volumeId: string) => deleteVolumeImpl(region, volumeId),
    resizeVolume: async (volumeId: string, newSizeGb: number) =>
      resizeVolumeImpl(region, volumeId, newSizeGb),
    attachVolume: async (volumeId: string, instanceId: string, devicePath: string) =>
      attachVolumeImpl(region, volumeId, instanceId, devicePath),
    detachVolume: async (volumeId: string) => detachVolumeImpl(region, volumeId),
    listVolumes: async (tenantId: string) => listVolumesImpl(region, tenantId),
    getVolumeStatus: async (volumeId: string) => {
      const volume = await getVolumeImpl(region, volumeId);
      return volume?.status || 'unknown';
    },
  };
}
