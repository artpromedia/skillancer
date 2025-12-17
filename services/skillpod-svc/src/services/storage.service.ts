/**
 * @module @skillancer/skillpod-svc/services/storage
 * Storage service for managing persistent volumes
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

interface EBSVolumeResponse {
  VolumeId: string;
  Size: number;
  State: string;
  CreateTime: string;
  Tags?: Array<{ Key: string; Value: string }>;
}

// =============================================================================
// HELPER FUNCTIONS (outer scope)
// =============================================================================

/**
 * Simple XML response parser (for demo - use proper parser in production)
 */
function parseXmlResponse(xml: string): Record<string, unknown> {
  // This is a simplified parser - in production use xml2js or similar
  const result: Record<string, unknown> = {};

  const volumeIdMatch = /<volumeId>([^<]+)<\/volumeId>/.exec(xml);
  if (volumeIdMatch?.[1]) result.VolumeId = volumeIdMatch[1];

  const sizeMatch = /<size>([^<]+)<\/size>/.exec(xml);
  if (sizeMatch?.[1]) result.Size = Number.parseInt(sizeMatch[1], 10);

  const stateMatch = /<status>([^<]+)<\/status>/.exec(xml);
  if (stateMatch?.[1]) result.State = stateMatch[1];

  const createTimeMatch = /<createTime>([^<]+)<\/createTime>/.exec(xml);
  if (createTimeMatch?.[1]) result.CreateTime = createTimeMatch[1];

  return result;
}

/**
 * Make request to EC2 API
 */
async function ec2Request<T>(
  region: string,
  action: string,
  params: Record<string, string>
): Promise<T> {
  const baseParams = {
    Action: action,
    Version: '2016-11-15',
    ...params,
  };

  const queryString = Object.entries(baseParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const url = `https://ec2.${region}.amazonaws.com?${queryString}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`EC2 API error: ${errorText}`);
    }

    // Parse XML response (simplified - in production use a proper XML parser)
    const text = await response.text();
    return parseXmlResponse(text) as T;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`EC2 request failed: ${error.message}`);
    }
    throw new Error('EC2 request failed: Unknown error');
  }
}

/**
 * Create a new EBS volume
 */
async function createVolumeImpl(_region: string, params: CreateVolumeParams): Promise<string> {
  // In production, this would call the EC2 API to create an EBS volume
  // For now, we'll simulate it

  const volumeId = `vol-${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;

  console.log(`Creating EBS volume: ${volumeId}`);
  console.log(`  Tenant: ${params.tenantId}`);
  console.log(`  Name: ${params.name}`);
  console.log(`  Size: ${params.sizeGb} GB`);
  console.log(`  Type: ${params.type || 'gp3'}`);

  // In production:
  // const availabilityZone = `${region}a`;
  // await ec2Request(region, 'CreateVolume', {
  //   AvailabilityZone: availabilityZone,
  //   Size: params.sizeGb.toString(),
  //   VolumeType: params.type || 'gp3',
  //   'TagSpecification.1.ResourceType': 'volume',
  //   'TagSpecification.1.Tag.1.Key': 'Name',
  //   'TagSpecification.1.Tag.1.Value': params.name,
  //   'TagSpecification.1.Tag.2.Key': 'TenantId',
  //   'TagSpecification.1.Tag.2.Value': params.tenantId,
  // });

  return volumeId;
}

/**
 * Get volume information
 */
async function getVolumeImpl(_region: string, volumeId: string): Promise<VolumeInfo | null> {
  // In production, this would call DescribeVolumes
  // For now, we'll simulate it

  console.log(`Getting volume info: ${volumeId}`);

  // Simulate volume info
  return {
    volumeId,
    name: `volume-${volumeId.slice(-6)}`,
    sizeGb: 50,
    status: 'available',
    createdAt: new Date(),
  };
}

/**
 * Delete a volume
 */
async function deleteVolumeImpl(_region: string, volumeId: string): Promise<void> {
  console.log(`Deleting volume: ${volumeId}`);

  // In production:
  // await ec2Request(region, 'DeleteVolume', {
  //   VolumeId: volumeId,
  // });
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

  // In production:
  // await ec2Request(region, 'ModifyVolume', {
  //   VolumeId: volumeId,
  //   Size: newSizeGb.toString(),
  // });
}

/**
 * Attach volume to an instance
 */
async function attachVolumeImpl(
  _region: string,
  volumeId: string,
  instanceId: string,
  devicePath: string
): Promise<void> {
  console.log(`Attaching volume ${volumeId} to ${instanceId} at ${devicePath}`);

  // In production:
  // await ec2Request(region, 'AttachVolume', {
  //   VolumeId: volumeId,
  //   InstanceId: instanceId,
  //   Device: devicePath,
  // });
}

/**
 * Detach volume from instance
 */
async function detachVolumeImpl(_region: string, volumeId: string): Promise<void> {
  console.log(`Detaching volume: ${volumeId}`);

  // In production:
  // await ec2Request(region, 'DetachVolume', {
  //   VolumeId: volumeId,
  // });
}

/**
 * List volumes for a tenant
 */
async function listVolumesImpl(_region: string, tenantId: string): Promise<VolumeInfo[]> {
  console.log(`Listing volumes for tenant: ${tenantId}`);

  // In production, this would call DescribeVolumes with tag filter
  // For now, return empty array
  return [];
}

// =============================================================================
// SERVICE FACTORY
// =============================================================================

// Default AWS region - in production this should come from environment config
const DEFAULT_AWS_REGION = process.env.AWS_REGION || 'us-east-1';

export function createStorageService(): StorageService {
  const region = DEFAULT_AWS_REGION;

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
