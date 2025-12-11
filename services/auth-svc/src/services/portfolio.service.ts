/**
 * @module @skillancer/auth-svc/services/portfolio
 * Portfolio item management service
 */

import crypto from 'crypto';

import { S3Client, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { CacheService } from '@skillancer/cache';
import { prisma, type PortfolioItem, type Prisma } from '@skillancer/database';
import sharp from 'sharp';

import { getConfig } from '../config/index.js';
import {
  NotFoundError,
  InvalidFileTypeError,
  FileTooLargeError,
  ImageProcessingError,
} from '../errors/index.js';

import type { MultipartFile } from '@fastify/multipart';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface CreatePortfolioItemDto {
  title: string;
  description?: string | null | undefined;
  projectUrl?: string | null | undefined;
  skills?: string[] | undefined;
  completedAt?: Date | null | undefined;
  clientName?: string | null | undefined;
  isConfidential?: boolean | undefined;
  isFeatured?: boolean | undefined;
}

export interface UpdatePortfolioItemDto {
  title?: string | undefined;
  description?: string | null | undefined;
  projectUrl?: string | null | undefined;
  skills?: string[] | undefined;
  completedAt?: Date | null | undefined;
  clientName?: string | null | undefined;
  isConfidential?: boolean | undefined;
  isFeatured?: boolean | undefined;
  displayOrder?: number | undefined;
}

export interface PortfolioImageUpload {
  portfolioItemId: string;
  file: MultipartFile;
  isThumbnail?: boolean;
}

export interface ProcessedPortfolioImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
}

export interface PortfolioImageUrls {
  original: string;
  thumbnail: string;
  medium: string;
  large: string;
}

export interface PortfolioItemWithImages extends PortfolioItem {
  imageUrls: string[];
}

export interface PaginatedPortfolioItems {
  data: PortfolioItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const _ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB
const _MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_IMAGES_PER_ITEM = 10;
const CACHE_TTL = 5 * 60; // 5 minutes

const IMAGE_SIZES = {
  thumbnail: { width: 200, height: 150 },
  medium: { width: 600, height: 450 },
  large: { width: 1200, height: 900 },
};

const CacheKeys = {
  portfolioItem: (id: string) => `portfolio:item:${id}`,
  userPortfolio: (userId: string) => `portfolio:user:${userId}`,
};

// =============================================================================
// PORTFOLIO SERVICE
// =============================================================================

let portfolioServiceInstance: PortfolioService | null = null;

/**
 * Portfolio management service
 *
 * Features:
 * - CRUD operations for portfolio items
 * - Image upload and processing with multiple sizes
 * - Video URL support (external hosting)
 * - Ordering and featuring items
 * - Skills tagging
 * - Caching for performance
 */
export class PortfolioService {
  private readonly config = getConfig();
  private readonly cache: CacheService;
  private readonly s3Client: S3Client;

  constructor(redis: Redis) {
    this.cache = new CacheService(redis, 'portfolio');

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
  // PORTFOLIO ITEM CRUD
  // ===========================================================================

  /**
   * Create a new portfolio item
   */
  async createItem(userId: string, data: CreatePortfolioItemDto): Promise<PortfolioItem> {
    // Get the next display order
    const lastItem = await prisma.portfolioItem.findFirst({
      where: { userId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });

    const displayOrder: number = (lastItem?.displayOrder ?? 0) + 1;

    const item = await prisma.portfolioItem.create({
      data: {
        userId,
        title: data.title,
        description: data.description ?? null,
        projectUrl: data.projectUrl ?? null,
        skills: data.skills ?? [],
        completedAt: data.completedAt ?? null,
        clientName: data.clientName ?? null,
        isConfidential: data.isConfidential ?? false,
        isFeatured: data.isFeatured ?? false,
        displayOrder,
        images: [],
      },
    });

    // Invalidate user's portfolio cache
    await this.cache.delete(CacheKeys.userPortfolio(userId));

    return item;
  }

  /**
   * Get portfolio item by ID
   */
  async getItem(itemId: string, userId?: string): Promise<PortfolioItem> {
    const cacheKey = CacheKeys.portfolioItem(itemId);
    const cached = await this.cache.get<PortfolioItem>(cacheKey);

    if (cached) {
      // Verify ownership if userId provided
      if (userId && cached.userId !== userId) {
        throw new NotFoundError('Portfolio item not found');
      }
      return cached;
    }

    const item = await prisma.portfolioItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundError('Portfolio item not found');
    }

    // Verify ownership if userId provided
    if (userId && item.userId !== userId) {
      throw new NotFoundError('Portfolio item not found');
    }

    await this.cache.set(cacheKey, item, { ttl: CACHE_TTL });
    return item;
  }

  /**
   * Get all portfolio items for a user
   */
  async getUserPortfolio(
    userId: string,
    options?: {
      page?: number | undefined;
      limit?: number | undefined;
      featuredOnly?: boolean | undefined;
    }
  ): Promise<PaginatedPortfolioItems> {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.PortfolioItemWhereInput = { userId };

    if (options?.featuredOnly) {
      where.isFeatured = true;
    }

    const [items, total] = await Promise.all([
      prisma.portfolioItem.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { displayOrder: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.portfolioItem.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get public portfolio for a user (excludes confidential items)
   */
  async getPublicPortfolio(
    username: string,
    options?: { page?: number; limit?: number }
  ): Promise<PaginatedPortfolioItems> {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const profile = await prisma.userProfile.findUnique({
      where: { username: username.toLowerCase() },
      select: { userId: true },
    });

    const user = profile ? { id: profile.userId } : null;

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const where: Prisma.PortfolioItemWhereInput = {
      userId: user.id,
      isConfidential: false,
    };

    const [items, total] = await Promise.all([
      prisma.portfolioItem.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { displayOrder: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.portfolioItem.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update portfolio item
   */
  async updateItem(
    itemId: string,
    userId: string,
    data: UpdatePortfolioItemDto
  ): Promise<PortfolioItem> {
    // Verify ownership
    await this.getItem(itemId, userId);

    // Build update data, only including defined fields
    const updateData: Prisma.PortfolioItemUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.projectUrl !== undefined) updateData.projectUrl = data.projectUrl;
    if (data.skills !== undefined) updateData.skills = data.skills;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;
    if (data.clientName !== undefined) updateData.clientName = data.clientName;
    if (data.isConfidential !== undefined) updateData.isConfidential = data.isConfidential;
    if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

    const updated = await prisma.portfolioItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CacheKeys.portfolioItem(itemId)),
      this.cache.delete(CacheKeys.userPortfolio(userId)),
    ]);

    return updated;
  }

  /**
   * Delete portfolio item
   */
  async deleteItem(itemId: string, userId: string): Promise<void> {
    // Verify ownership and get item
    const item = await this.getItem(itemId, userId);

    // Delete images from S3
    const s3Keys = this.extractS3Keys(item);
    if (s3Keys.length > 0) {
      await this.deleteFromS3(s3Keys).catch((err) => {
        console.error('Failed to delete portfolio images from S3:', err);
      });
    }

    // Delete the item
    await prisma.portfolioItem.delete({
      where: { id: itemId },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CacheKeys.portfolioItem(itemId)),
      this.cache.delete(CacheKeys.userPortfolio(userId)),
    ]);
  }

  // ===========================================================================
  // ITEM ORDERING
  // ===========================================================================

  /**
   * Reorder portfolio items
   */
  async reorderItems(userId: string, itemIds: string[]): Promise<void> {
    // Verify all items belong to user
    const items = await prisma.portfolioItem.findMany({
      where: { userId, id: { in: itemIds } },
      select: { id: true },
    });

    if (items.length !== itemIds.length) {
      throw new NotFoundError('One or more portfolio items not found');
    }

    // Update order in a transaction using interactive transaction
    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < itemIds.length; index++) {
        const id = itemIds[index];
        if (id) {
          await tx.portfolioItem.update({
            where: { id },
            data: { displayOrder: index + 1 },
          });
        }
      }
    });

    // Invalidate cache
    await this.cache.delete(CacheKeys.userPortfolio(userId));
  }

  // ===========================================================================
  // IMAGE MANAGEMENT
  // ===========================================================================

  /**
   * Upload image to portfolio item
   */
  async uploadImage(
    itemId: string,
    userId: string,
    file: MultipartFile,
    setAsThumbnail?: boolean
  ): Promise<PortfolioItem> {
    // Verify ownership
    const item = await this.getItem(itemId, userId);

    // Check image limit
    const currentImages = item.images ?? [];
    if (currentImages.length >= MAX_IMAGES_PER_ITEM) {
      throw new InvalidFileTypeError(`Maximum ${MAX_IMAGES_PER_ITEM} images per portfolio item`);
    }

    // Validate file type
    if (!file.mimetype || !ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new InvalidFileTypeError(
        `Invalid image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`
      );
    }

    // Read and validate size
    const buffer = await file.toBuffer();
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new FileTooLargeError(`Image too large. Maximum: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
    }

    // Process image
    const processed = await this.processImage(buffer);

    // Generate filename and upload
    const filename = this.generateFilename();
    const urls = await this.uploadImagesToS3(userId, itemId, filename, processed);

    // Update item with new image
    const updatedImages = [...currentImages, urls.large];
    const updateData: Prisma.PortfolioItemUpdateInput = {
      images: updatedImages,
    };

    // Set thumbnail if requested or if first image
    if (setAsThumbnail || !item.thumbnailUrl) {
      updateData.thumbnailUrl = urls.thumbnail;
    }

    const updated = await prisma.portfolioItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CacheKeys.portfolioItem(itemId)),
      this.cache.delete(CacheKeys.userPortfolio(userId)),
    ]);

    return updated;
  }

  /**
   * Remove image from portfolio item
   */
  async removeImage(itemId: string, userId: string, imageUrl: string): Promise<PortfolioItem> {
    // Verify ownership
    const item = await this.getItem(itemId, userId);

    const currentImages = item.images ?? [];
    const index = currentImages.indexOf(imageUrl);

    if (index === -1) {
      throw new NotFoundError('Image not found in portfolio item');
    }

    // Extract S3 key pattern and delete all sizes
    const s3Keys = this.extractImageS3Keys(imageUrl);
    if (s3Keys.length > 0) {
      await this.deleteFromS3(s3Keys).catch((err) => {
        console.error('Failed to delete portfolio image from S3:', err);
      });
    }

    // Remove from array
    const updatedImages = currentImages.filter((_, i) => i !== index);

    const updateData: Prisma.PortfolioItemUpdateInput = {
      images: updatedImages,
    };

    // If we removed the thumbnail, set a new one
    const thumbnailUrl = item.thumbnailUrl;
    if (thumbnailUrl && imageUrl.includes(this.extractFilename(thumbnailUrl))) {
      updateData.thumbnailUrl = updatedImages[0]
        ? updatedImages[0].replace('_large.webp', '_thumbnail.webp')
        : null;
    }

    const updated = await prisma.portfolioItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CacheKeys.portfolioItem(itemId)),
      this.cache.delete(CacheKeys.userPortfolio(userId)),
    ]);

    return updated;
  }

  /**
   * Set video URL for portfolio item
   */
  async setVideoUrl(
    itemId: string,
    userId: string,
    videoUrl: string | null
  ): Promise<PortfolioItem> {
    // Verify ownership
    await this.getItem(itemId, userId);

    const updated = await prisma.portfolioItem.update({
      where: { id: itemId },
      data: { videoUrl },
    });

    // Invalidate caches
    await Promise.all([
      this.cache.delete(CacheKeys.portfolioItem(itemId)),
      this.cache.delete(CacheKeys.userPortfolio(userId)),
    ]);

    return updated;
  }

  // ===========================================================================
  // IMAGE PROCESSING
  // ===========================================================================

  /**
   * Process image into multiple sizes
   */
  private async processImage(buffer: Buffer): Promise<{
    original: ProcessedPortfolioImage;
    thumbnail: ProcessedPortfolioImage;
    medium: ProcessedPortfolioImage;
    large: ProcessedPortfolioImage;
  }> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new ImageProcessingError('Unable to read image dimensions');
      }

      // Process original
      const originalBuffer = await sharp(buffer).rotate().webp({ quality: 90 }).toBuffer();

      const originalMeta = await sharp(originalBuffer).metadata();

      return {
        original: {
          buffer: originalBuffer,
          width: originalMeta.width ?? metadata.width,
          height: originalMeta.height ?? metadata.height,
          format: 'webp',
        },
        thumbnail: await this.resizeImage(buffer, IMAGE_SIZES.thumbnail),
        medium: await this.resizeImage(buffer, IMAGE_SIZES.medium),
        large: await this.resizeImage(buffer, IMAGE_SIZES.large),
      };
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
  ): Promise<ProcessedPortfolioImage> {
    const resized = await sharp(buffer)
      .rotate()
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
  private async uploadImagesToS3(
    userId: string,
    itemId: string,
    filename: string,
    images: {
      original: ProcessedPortfolioImage;
      thumbnail: ProcessedPortfolioImage;
      medium: ProcessedPortfolioImage;
      large: ProcessedPortfolioImage;
    }
  ): Promise<PortfolioImageUrls> {
    const bucket = this.config.storage.s3Bucket;
    const basePath = `portfolio/${userId}/${itemId}`;

    const uploads = [
      { key: `${basePath}/${filename}_original.webp`, image: images.original, size: 'original' },
      { key: `${basePath}/${filename}_thumbnail.webp`, image: images.thumbnail, size: 'thumbnail' },
      { key: `${basePath}/${filename}_medium.webp`, image: images.medium, size: 'medium' },
      { key: `${basePath}/${filename}_large.webp`, image: images.large, size: 'large' },
    ];

    await Promise.all(
      uploads.map(async ({ key, image }) =>
        this.s3Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: image.buffer,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000',
            Metadata: {
              width: String(image.width),
              height: String(image.height),
            },
          })
        )
      )
    );

    const baseUrl = this.getBaseUrl();
    const originalKey = uploads[0]?.key ?? '';
    const thumbnailKey = uploads[1]?.key ?? '';
    const mediumKey = uploads[2]?.key ?? '';
    const largeKey = uploads[3]?.key ?? '';

    return {
      original: `${baseUrl}/${originalKey}`,
      thumbnail: `${baseUrl}/${thumbnailKey}`,
      medium: `${baseUrl}/${mediumKey}`,
      large: `${baseUrl}/${largeKey}`,
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
        },
      })
    );
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Get base URL for S3 objects
   */
  private getBaseUrl(): string {
    if (this.config.storage.s3CdnUrl) {
      return this.config.storage.s3CdnUrl;
    }
    return `https://${this.config.storage.s3Bucket}.s3.${this.config.storage.s3Region}.amazonaws.com`;
  }

  /**
   * Generate unique filename
   */
  private generateFilename(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${timestamp}_${random}`;
  }

  /**
   * Extract S3 keys from portfolio item
   */
  private extractS3Keys(item: PortfolioItem): string[] {
    const keys: string[] = [];
    const baseUrl = this.getBaseUrl();

    // Extract from images array
    const images = item.images ?? [];
    for (const url of images) {
      if (url.startsWith(baseUrl)) {
        const key = url.replace(`${baseUrl}/`, '');
        // Add all sizes
        const baseKey = key.replace(/_[a-z]+\.webp$/, '');
        keys.push(`${baseKey}_original.webp`);
        keys.push(`${baseKey}_thumbnail.webp`);
        keys.push(`${baseKey}_medium.webp`);
        keys.push(`${baseKey}_large.webp`);
      }
    }

    // Extract thumbnail
    const thumbnailUrl = item.thumbnailUrl;
    if (thumbnailUrl?.startsWith(baseUrl)) {
      const key = thumbnailUrl.replace(`${baseUrl}/`, '');
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }

    return [...new Set(keys)];
  }

  /**
   * Extract S3 keys for a single image URL
   */
  private extractImageS3Keys(imageUrl: string): string[] {
    const baseUrl = this.getBaseUrl();
    if (!imageUrl.startsWith(baseUrl)) return [];

    const key = imageUrl.replace(`${baseUrl}/`, '');
    const baseKey = key.replace(/_[a-z]+\.webp$/, '');

    return [
      `${baseKey}_original.webp`,
      `${baseKey}_thumbnail.webp`,
      `${baseKey}_medium.webp`,
      `${baseKey}_large.webp`,
    ];
  }

  /**
   * Extract filename from URL
   */
  private extractFilename(url: string): string {
    const parts = url.split('/');
    const filename = parts[parts.length - 1] ?? '';
    return filename.replace(/_[a-z]+\.webp$/, '');
  }
}

// =============================================================================
// SINGLETON MANAGEMENT
// =============================================================================

export function initializePortfolioService(redis: Redis): void {
  if (!portfolioServiceInstance) {
    portfolioServiceInstance = new PortfolioService(redis);
  }
}

export function getPortfolioService(): PortfolioService {
  if (!portfolioServiceInstance) {
    throw new Error('PortfolioService not initialized. Call initializePortfolioService first.');
  }
  return portfolioServiceInstance;
}

export function resetPortfolioService(): void {
  portfolioServiceInstance = null;
}
