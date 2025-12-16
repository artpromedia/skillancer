/**
 * @module @skillancer/skillpod-svc/services/storage
 * Storage service for managing persistent volumes
 */

import { config } from '../config/index.js';

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
// SERVICE IMPLEMENTATION
// =============================================================================

export function createStorageService(): StorageService {
  const region = config.aws?.region || 'us-east-1';
  const availabilityZone = `${region}a`;

  /**
   * Make request to EC2 API
   */
  async function ec2Request<T>(action: string, params: Record<string, string>): Promise<T> {
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
   * Simple XML response parser (for demo - use proper parser in production)
   */
  function parseXmlResponse(xml: string): Record<string, unknown> {
    // This is a simplified parser - in production use xml2js or similar
    const result: Record<string, unknown> = {};

    const volumeIdMatch = xml.match(/<volumeId>([^<]+)<\/volumeId>/);
    if (volumeIdMatch) result.VolumeId = volumeIdMatch[1];

    const sizeMatch = xml.match(/<size>([^<]+)<\/size>/);
    if (sizeMatch) result.Size = parseInt(sizeMatch[1], 10);

    const stateMatch = xml.match(/<status>([^<]+)<\/status>/);
    if (stateMatch) result.State = stateMatch[1];

    const createTimeMatch = xml.match(/<createTime>([^<]+)<\/createTime>/);
    if (createTimeMatch) result.CreateTime = createTimeMatch[1];

    return result;
  }

  /**
   * Create a new EBS volume
   */
  async function createVolume(params: CreateVolumeParams): Promise<string> {
    // In production, this would call the EC2 API to create an EBS volume
    // For now, we'll simulate it

    const volumeId = `vol-${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;

    console.log(`Creating EBS volume: ${volumeId}`);
    console.log(`  Tenant: ${params.tenantId}`);
    console.log(`  Name: ${params.name}`);
    console.log(`  Size: ${params.sizeGb} GB`);
    console.log(`  Type: ${params.type || 'gp3'}`);

    // In production:
    // await ec2Request('CreateVolume', {
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
  async function getVolume(volumeId: string): Promise<VolumeInfo | null> {
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
  async function deleteVolume(volumeId: string): Promise<void> {
    console.log(`Deleting volume: ${volumeId}`);

    // In production:
    // await ec2Request('DeleteVolume', {
    //   VolumeId: volumeId,
    // });
  }

  /**
   * Resize a volume
   */
  async function resizeVolume(volumeId: string, newSizeGb: number): Promise<void> {
    console.log(`Resizing volume ${volumeId} to ${newSizeGb} GB`);

    // In production:
    // await ec2Request('ModifyVolume', {
    //   VolumeId: volumeId,
    //   Size: newSizeGb.toString(),
    // });
  }

  /**
   * Attach volume to an instance
   */
  async function attachVolume(
    volumeId: string,
    instanceId: string,
    devicePath: string
  ): Promise<void> {
    console.log(`Attaching volume ${volumeId} to ${instanceId} at ${devicePath}`);

    // In production:
    // await ec2Request('AttachVolume', {
    //   VolumeId: volumeId,
    //   InstanceId: instanceId,
    //   Device: devicePath,
    // });
  }

  /**
   * Detach volume from instance
   */
  async function detachVolume(volumeId: string): Promise<void> {
    console.log(`Detaching volume: ${volumeId}`);

    // In production:
    // await ec2Request('DetachVolume', {
    //   VolumeId: volumeId,
    // });
  }

  /**
   * List volumes for a tenant
   */
  async function listVolumes(tenantId: string): Promise<VolumeInfo[]> {
    console.log(`Listing volumes for tenant: ${tenantId}`);

    // In production, this would call DescribeVolumes with tag filter
    // For now, return empty array
    return [];
  }

  /**
   * Get volume status
   */
  async function getVolumeStatus(volumeId: string): Promise<string> {
    const volume = await getVolume(volumeId);
    return volume?.status || 'unknown';
  }

  return {
    createVolume,
    getVolume,
    deleteVolume,
    resizeVolume,
    attachVolume,
    detachVolume,
    listVolumes,
    getVolumeStatus,
  };
}
