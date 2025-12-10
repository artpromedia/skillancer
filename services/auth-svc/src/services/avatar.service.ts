/**
 * @module @skillancer/auth-svc/services/avatar
 * Avatar upload and image processing service
 */

import crypto from 'crypto';

import { S3Client, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

import { getProfileService } from './profile.service.js';
import { getConfig } from '../config/index.js';
import { InvalidFileTypeError, FileTooLargeError, ImageProcessingError } from '../errors/index.js';

import type { MultipartFile } from '@fastify/multipart';

// =============================================================================
// TYPES
// =============================================================================

export type AvatarSize = 'thumbnail' | 'small' | 'medium' | 'large';

export interface AvatarUrls {
  original: string;
  thumbnail: string;
  small: string;
  medium: string;
  large: string;
}

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
}

export interface ProcessedImages {
  original: ProcessedImage;
  thumbnail: ProcessedImage;
  small: ProcessedImage;
  medium: ProcessedImage;
  large: ProcessedImage;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const AVATAR_SIZES: Record<AvatarSize, { width: number; height: number }> = {
  thumbnail: { width: 64, height: 64 },
  small: { width: 128, height: 128 },
  medium: { width: 256, height: 256 },
  large: { width: 512, height: 512 },
};

// =============================================================================
// AVATAR SERVICE
// =============================================================================

/**
 * Avatar upload and image processing service
 *
 * Features:
 * - Image validation (type, size)
 * - Automatic resizing to multiple sizes
 * - WebP conversion for optimal performance
 * - S3 upload with proper caching headers
 * - Cleanup of old avatars on update
 */
export class AvatarService {
  private readonly config = getConfig();
  private readonly s3Client: S3Client;

  constructor() {
    const s3Config: {
      region: string;
      forcePathStyle: boolean;
      endpoint?: string;
      credentials?: { accessKeyId: string; secretAccessKey: string };
    } = {
      region: this.config.storage.s3Region,
      forcePathStyle: this.config.storage.s3ForcePathStyle,
    };

    if (this.config.storage.s3Endpoint) {
      s3Config.endpoint = this.config.storage.s3Endpoint;
    }

    if (this.config.storage.s3AccessKeyId && this.config.storage.s3SecretAccessKey) {
      s3Config.credentials = {
        accessKeyId: this.config.storage.s3AccessKeyId,
        secretAccessKey: this.config.storage.s3SecretAccessKey,
      };
    }

    this.s3Client = new S3Client(s3Config);
  }

  // ===========================================================================
  // AVATAR UPLOAD
  // ===========================================================================

  /**
   * Upload and process avatar for user
   *
   * @param userId - User ID
   * @param file - Multipart file from upload
   * @returns URLs for all avatar sizes
   */
  async uploadAvatar(userId: string, file: MultipartFile): Promise<AvatarUrls> {
    // Validate file type
    if (!file.mimetype || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new InvalidFileTypeError(
        `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
      );
    }

    // Read file buffer
    const buffer = await file.toBuffer();

    // Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
      throw new FileTooLargeError(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Get existing avatar URLs for cleanup
    const profileService = getProfileService();
    const profile = await profileService.getProfile(userId);
    const oldAvatarKeys = this.extractS3Keys(profile);

    // Process images
    const processed = await this.processImage(buffer);

    // Generate unique filename
    const filename = this.generateFilename(userId);

    // Upload all sizes to S3
    const urls = await this.uploadToS3(userId, filename, processed);

    // Update profile with new avatar URLs
    await profileService.updateAvatarUrls(userId, urls);

    // Delete old avatars asynchronously (don't wait)
    if (oldAvatarKeys.length > 0) {
      this.deleteFromS3(oldAvatarKeys).catch((err) => {
        console.error('Failed to delete old avatars:', err);
      });
    }

    return urls;
  }

  /**
   * Delete user's avatar
   */
  async deleteAvatar(userId: string): Promise<void> {
    const profileService = getProfileService();
    const profile = await profileService.getProfile(userId);

    // Get S3 keys
    const keys = this.extractS3Keys(profile);

    // Delete from S3
    if (keys.length > 0) {
      await this.deleteFromS3(keys);
    }

    // Remove URLs from profile
    await profileService.removeAvatarUrls(userId);
  }

  // ===========================================================================
  // IMAGE PROCESSING
  // ===========================================================================

  /**
   * Process image into multiple sizes
   */
  async processImage(buffer: Buffer): Promise<ProcessedImages> {
    try {
      // Validate and get metadata
      const image = sharp(buffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new ImageProcessingError('Unable to read image dimensions');
      }

      // Process original (strip metadata, optimize)
      const originalBuffer = await sharp(buffer)
        .rotate() // Auto-rotate based on EXIF
        .webp({ quality: 90 })
        .toBuffer();

      const originalMeta = await sharp(originalBuffer).metadata();

      if (!originalMeta.width || !originalMeta.height) {
        throw new ImageProcessingError('Unable to read processed image dimensions');
      }

      const results: ProcessedImages = {
        original: {
          buffer: originalBuffer,
          width: originalMeta.width,
          height: originalMeta.height,
          format: 'webp',
        },
        thumbnail: await this.resizeImage(buffer, AVATAR_SIZES.thumbnail),
        small: await this.resizeImage(buffer, AVATAR_SIZES.small),
        medium: await this.resizeImage(buffer, AVATAR_SIZES.medium),
        large: await this.resizeImage(buffer, AVATAR_SIZES.large),
      };

      return results;
    } catch (error) {
      if (error instanceof ImageProcessingError) {
        throw error;
      }
      throw new ImageProcessingError(
        `Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Resize image to specific dimensions
   */
  private async resizeImage(
    buffer: Buffer,
    dimensions: { width: number; height: number }
  ): Promise<ProcessedImage> {
    const resized = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF
      .resize(dimensions.width, dimensions.height, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 })
      .toBuffer();

    return {
      buffer: resized,
      width: dimensions.width,
      height: dimensions.height,
      format: 'webp',
    };
  }

  // ===========================================================================
  // S3 OPERATIONS
  // ===========================================================================

  /**
   * Upload processed images to S3
   */
  private async uploadToS3(
    userId: string,
    filename: string,
    images: ProcessedImages
  ): Promise<AvatarUrls> {
    const bucket = this.config.storage.s3Bucket;
    const basePath = `avatars/${userId}`;

    const uploads = [
      { key: `${basePath}/${filename}_original.webp`, image: images.original },
      { key: `${basePath}/${filename}_64.webp`, image: images.thumbnail },
      { key: `${basePath}/${filename}_128.webp`, image: images.small },
      { key: `${basePath}/${filename}_256.webp`, image: images.medium },
      { key: `${basePath}/${filename}_512.webp`, image: images.large },
    ];

    // Upload all in parallel
    await Promise.all(
      uploads.map(async ({ key, image }) =>
        this.s3Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: image.buffer,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000', // 1 year
            Metadata: {
              width: String(image.width),
              height: String(image.height),
            },
          })
        )
      )
    );

    // Build URLs
    const baseUrl = this.getBaseUrl();

    // Destructure array - these are guaranteed to exist since uploads is statically defined above
    const [original, thumbnail, small, medium, large] = uploads;
    if (!original || !thumbnail || !small || !medium || !large) {
      throw new Error('Unexpected: Upload entries missing');
    }

    return {
      original: `${baseUrl}/${original.key}`,
      thumbnail: `${baseUrl}/${thumbnail.key}`,
      small: `${baseUrl}/${small.key}`,
      medium: `${baseUrl}/${medium.key}`,
      large: `${baseUrl}/${large.key}`,
    };
  }

  /**
   * Delete objects from S3
   */
  private async deleteFromS3(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    const bucket = this.config.storage.s3Bucket;

    await this.s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
          Quiet: true,
        },
      })
    );
  }

  /**
   * Extract S3 keys from profile avatar URLs
   */
  private extractS3Keys(profile: {
    avatarOriginal?: string | null;
    avatarThumbnail?: string | null;
    avatarSmall?: string | null;
    avatarMedium?: string | null;
    avatarLarge?: string | null;
  }): string[] {
    const urls = [
      profile.avatarOriginal,
      profile.avatarThumbnail,
      profile.avatarSmall,
      profile.avatarMedium,
      profile.avatarLarge,
    ].filter((url): url is string => !!url);

    const baseUrl = this.getBaseUrl();

    return urls
      .map((url) => {
        if (url.startsWith(baseUrl)) {
          return url.substring(baseUrl.length + 1);
        }
        // Handle different URL formats
        const urlObj = new URL(url);
        return urlObj.pathname.substring(1); // Remove leading /
      })
      .filter(Boolean);
  }

  /**
   * Get base URL for S3 assets
   */
  private getBaseUrl(): string {
    const { s3Endpoint, s3Bucket, s3Region, s3CdnUrl } = this.config.storage;

    // Use CDN URL if configured
    if (s3CdnUrl) {
      return s3CdnUrl;
    }

    // Use custom endpoint (LocalStack, MinIO)
    if (s3Endpoint) {
      return `${s3Endpoint}/${s3Bucket}`;
    }

    // Default AWS S3 URL
    return `https://${s3Bucket}.s3.${s3Region}.amazonaws.com`;
  }

  /**
   * Generate unique filename for avatar
   */
  private generateFilename(_userId: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${timestamp}_${random}`;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let avatarServiceInstance: AvatarService | null = null;

export function initializeAvatarService(): AvatarService {
  avatarServiceInstance = new AvatarService();
  return avatarServiceInstance;
}

export function getAvatarService(): AvatarService {
  if (!avatarServiceInstance) {
    throw new Error('AvatarService not initialized. Call initializeAvatarService first.');
  }
  return avatarServiceInstance;
}
