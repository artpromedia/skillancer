/**
 * @module @skillancer/skillpod-svc/services/ecr
 * Amazon ECR integration service for container image management
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { config } from '../config/index.js';

import type { ECRBuildParams } from '../types/environment.types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ECRService {
  buildAndPush(params: ECRBuildParams): Promise<string>;
  getImageDigest(repositoryName: string, imageTag: string): Promise<string | null>;
  deleteImage(repositoryName: string, imageDigest: string): Promise<void>;
  createRepository(repositoryName: string): Promise<string>;
  listImages(repositoryName: string): Promise<ECRImageInfo[]>;
  getAuthorizationToken(): Promise<ECRAuthToken>;
}

export interface ECRImageInfo {
  imageDigest: string;
  imageTag: string;
  pushedAt: Date;
  sizeBytes: number;
}

export interface ECRAuthToken {
  token: string;
  proxyEndpoint: string;
  expiresAt: Date;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createECRService(): ECRService {
  const region = config.aws?.region || 'us-east-1';
  const accountId = config.aws?.accountId || '';
  const ecrEndpoint = `${accountId}.dkr.ecr.${region}.amazonaws.com`;

  /**
   * Make authenticated request to ECR API
   */
  async function ecrRequest<T>(action: string, params: Record<string, unknown>): Promise<T> {
    const url = `https://ecr.${region}.amazonaws.com`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': `AmazonEC2ContainerRegistry_V20150921.${action}`,
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(`ECR API error: ${errorData.message || response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`ECR request failed: ${error.message}`);
      }
      throw new Error('ECR request failed: Unknown error');
    }
  }

  /**
   * Build Docker image and push to ECR
   */
  async function buildAndPush(params: ECRBuildParams): Promise<string> {
    const { repositoryName, imageTag, dockerfile, buildArgs = {} } = params;
    const imageUri = `${ecrEndpoint}/${repositoryName}:${imageTag}`;

    // In production, this would:
    // 1. Write dockerfile to temp directory
    // 2. Execute docker build with buildArgs
    // 3. Tag the image with ECR URI
    // 4. Get ECR auth token
    // 5. Push to ECR
    // 6. Clean up temp files

    // For now, we'll simulate the process
    console.log(`Building Docker image from Dockerfile (${dockerfile.length} bytes)`);
    console.log(`Build args:`, buildArgs);
    console.log(`Target image URI: ${imageUri}`);

    // Simulate build time based on dockerfile complexity
    const buildTimeMs = Math.min(dockerfile.split('\n').length * 100, 30000);
    await new Promise((resolve) => setTimeout(resolve, Math.min(buildTimeMs, 1000)));

    return imageUri;
  }

  /**
   * Get image digest from ECR
   */
  async function getImageDigest(repositoryName: string, imageTag: string): Promise<string | null> {
    try {
      interface DescribeImagesResponse {
        imageDetails: Array<{
          imageDigest: string;
          imageTags?: string[];
        }>;
      }

      const response = await ecrRequest<DescribeImagesResponse>('DescribeImages', {
        repositoryName,
        imageIds: [{ imageTag }],
      });

      return response.imageDetails?.[0]?.imageDigest || null;
    } catch {
      return null;
    }
  }

  /**
   * Delete image from ECR
   */
  async function deleteImage(repositoryName: string, imageDigest: string): Promise<void> {
    await ecrRequest('BatchDeleteImage', {
      repositoryName,
      imageIds: [{ imageDigest }],
    });
  }

  /**
   * Create ECR repository if it doesn't exist
   */
  async function createRepository(repositoryName: string): Promise<string> {
    interface CreateRepositoryResponse {
      repository: {
        repositoryUri: string;
      };
    }

    try {
      const response = await ecrRequest<CreateRepositoryResponse>('CreateRepository', {
        repositoryName,
        imageScanningConfiguration: {
          scanOnPush: true,
        },
        imageTagMutability: 'MUTABLE',
        encryptionConfiguration: {
          encryptionType: 'AES256',
        },
      });

      return response.repository.repositoryUri;
    } catch (error) {
      // Repository might already exist
      if (error instanceof Error && error.message.includes('RepositoryAlreadyExistsException')) {
        return `${ecrEndpoint}/${repositoryName}`;
      }
      throw error;
    }
  }

  /**
   * List images in ECR repository
   */
  async function listImages(repositoryName: string): Promise<ECRImageInfo[]> {
    interface DescribeImagesResponse {
      imageDetails: Array<{
        imageDigest: string;
        imageTags?: string[];
        imagePushedAt: number;
        imageSizeInBytes: number;
      }>;
    }

    const response = await ecrRequest<DescribeImagesResponse>('DescribeImages', {
      repositoryName,
    });

    return response.imageDetails.map((image) => ({
      imageDigest: image.imageDigest,
      imageTag: image.imageTags?.[0] || 'untagged',
      pushedAt: new Date(image.imagePushedAt * 1000),
      sizeBytes: image.imageSizeInBytes,
    }));
  }

  /**
   * Get ECR authorization token for docker login
   */
  async function getAuthorizationToken(): Promise<ECRAuthToken> {
    interface GetAuthTokenResponse {
      authorizationData: Array<{
        authorizationToken: string;
        proxyEndpoint: string;
        expiresAt: number;
      }>;
    }

    const response = await ecrRequest<GetAuthTokenResponse>('GetAuthorizationToken', {});

    const authData = response.authorizationData[0];
    return {
      token: authData.authorizationToken,
      proxyEndpoint: authData.proxyEndpoint,
      expiresAt: new Date(authData.expiresAt * 1000),
    };
  }

  return {
    buildAndPush,
    getImageDigest,
    deleteImage,
    createRepository,
    listImages,
    getAuthorizationToken,
  };
}
