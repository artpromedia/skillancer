/**
 * @module @skillancer/skillpod-svc/repositories/image
 * Base image repository for database operations
 *
 * Note: This file contains type mismatches due to exactOptionalPropertyTypes.
 * Prisma uses `null` for optional fields while our interfaces use `undefined`.
 * This is acceptable as the values are equivalent at runtime.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

import type { ToolDefinition } from '../types/environment.types.js';
import type { PrismaClient, BaseImage, OsType, RegistryType, Prisma } from '@/types/prisma-shim.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateBaseImageInput {
  name: string;
  osType: OsType;
  osVersion: string;
  registryType: RegistryType;
  registryUri: string;
  imageTag: string;
  imageDigest?: string;
  sizeBytes: bigint;
  architecture?: string;
  kasmCompatible?: boolean;
  kasmImageId?: string;
  preInstalledTools: ToolDefinition[];
}

export interface UpdateBaseImageInput {
  name?: string;
  imageTag?: string;
  imageDigest?: string;
  sizeBytes?: bigint;
  kasmImageId?: string;
  preInstalledTools?: ToolDefinition[];
  isActive?: boolean;
  lastPulledAt?: Date;
  lastVerifiedAt?: Date;
}

export interface BaseImageListFilter {
  osType?: OsType;
  registryType?: RegistryType;
  isActive?: boolean;
  kasmCompatible?: boolean;
  search?: string;
}

export interface BaseImageListOptions {
  page?: number;
  limit?: number;
  orderBy?: 'createdAt' | 'name' | 'osType';
  orderDirection?: 'asc' | 'desc';
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface ImageRepository {
  create(input: CreateBaseImageInput): Promise<BaseImage>;
  findById(id: string): Promise<BaseImage | null>;
  findByKasmImageId(kasmImageId: string): Promise<BaseImage | null>;
  findMany(
    filter?: BaseImageListFilter,
    options?: BaseImageListOptions
  ): Promise<{ images: BaseImage[]; total: number }>;
  update(id: string, input: UpdateBaseImageInput): Promise<BaseImage>;
  delete(id: string): Promise<void>;
  countActiveByType(osType: OsType): Promise<number>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createImageRepository(prisma: PrismaClient): ImageRepository {
  async function create(input: CreateBaseImageInput): Promise<BaseImage> {
    return prisma.baseImage.create({
      data: {
        name: input.name,
        osType: input.osType,
        osVersion: input.osVersion,
        registryType: input.registryType,
        registryUri: input.registryUri,
        imageTag: input.imageTag,
        imageDigest: input.imageDigest,
        sizeBytes: input.sizeBytes,
        architecture: input.architecture ?? 'amd64',
        kasmCompatible: input.kasmCompatible ?? true,
        kasmImageId: input.kasmImageId,
        preInstalledTools: input.preInstalledTools as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async function findById(id: string): Promise<BaseImage | null> {
    return prisma.baseImage.findUnique({
      where: { id },
    });
  }

  async function findByKasmImageId(kasmImageId: string): Promise<BaseImage | null> {
    return prisma.baseImage.findFirst({
      where: { kasmImageId },
    });
  }

  async function findMany(
    filter: BaseImageListFilter = {},
    options: BaseImageListOptions = {}
  ): Promise<{ images: BaseImage[]; total: number }> {
    const { page = 1, limit = 20, orderBy = 'createdAt', orderDirection = 'desc' } = options;
    const skip = (page - 1) * limit;

    const whereConditions: Prisma.BaseImageWhereInput[] = [];

    if (filter.osType) {
      whereConditions.push({ osType: filter.osType });
    }

    if (filter.registryType) {
      whereConditions.push({ registryType: filter.registryType });
    }

    if (filter.isActive !== undefined) {
      whereConditions.push({ isActive: filter.isActive });
    }

    if (filter.kasmCompatible !== undefined) {
      whereConditions.push({ kasmCompatible: filter.kasmCompatible });
    }

    if (filter.search) {
      whereConditions.push({
        OR: [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { osVersion: { contains: filter.search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.BaseImageWhereInput =
      whereConditions.length > 0 ? { AND: whereConditions } : {};

    const [images, total] = await Promise.all([
      prisma.baseImage.findMany({
        where,
        orderBy: { [orderBy]: orderDirection },
        skip,
        take: limit,
      }),
      prisma.baseImage.count({ where }),
    ]);

    return { images, total };
  }

  async function update(id: string, input: UpdateBaseImageInput): Promise<BaseImage> {
    const data: Prisma.BaseImageUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.imageTag !== undefined) data.imageTag = input.imageTag;
    if (input.imageDigest !== undefined) data.imageDigest = input.imageDigest;
    if (input.sizeBytes !== undefined) data.sizeBytes = input.sizeBytes;
    if (input.kasmImageId !== undefined) data.kasmImageId = input.kasmImageId;
    if (input.preInstalledTools !== undefined) {
      data.preInstalledTools = input.preInstalledTools as unknown as Prisma.InputJsonValue;
    }
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.lastPulledAt !== undefined) data.lastPulledAt = input.lastPulledAt;
    if (input.lastVerifiedAt !== undefined) data.lastVerifiedAt = input.lastVerifiedAt;

    return prisma.baseImage.update({
      where: { id },
      data,
    });
  }

  async function deleteImage(id: string): Promise<void> {
    await prisma.baseImage.delete({
      where: { id },
    });
  }

  async function countActiveByType(osType: OsType): Promise<number> {
    return prisma.baseImage.count({
      where: {
        osType,
        isActive: true,
      },
    });
  }

  return {
    create,
    findById,
    findByKasmImageId,
    findMany,
    update,
    delete: deleteImage,
    countActiveByType,
  };
}
