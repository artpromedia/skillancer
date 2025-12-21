/**
 * @module @skillancer/cockpit-svc/repositories/file
 * Project File data access layer
 */

import type { FileFilters, ProjectFileType } from '../types/project.types.js';
import type { Prisma, PrismaClient, ProjectFile } from '@skillancer/database';

export class FileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new file
   */
  async create(data: {
    projectId: string;
    name: string;
    description?: string | null;
    fileType: ProjectFileType;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    folder?: string | null;
    tags?: string[];
    version?: number;
    previousVersionId?: string | null;
  }): Promise<ProjectFile> {
    return this.prisma.projectFile.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        description: data.description ?? null,
        fileType: data.fileType,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        folder: data.folder ?? null,
        tags: data.tags ?? [],
        version: data.version ?? 1,
        previousVersionId: data.previousVersionId ?? null,
      },
    });
  }

  /**
   * Find a file by ID
   */
  async findById(id: string): Promise<ProjectFile | null> {
    return this.prisma.projectFile.findUnique({
      where: { id },
    });
  }

  /**
   * Find a file by ID with project
   */
  async findByIdWithProject(id: string) {
    return this.prisma.projectFile.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });
  }

  /**
   * Find files by filters
   */
  async findByFilters(params: FileFilters): Promise<ProjectFile[]> {
    const where: Prisma.ProjectFileWhereInput = {
      projectId: params.projectId,
    };

    if (params.fileType && params.fileType.length > 0) {
      where.fileType = { in: params.fileType };
    }

    if (params.folder) {
      where.folder = params.folder;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { fileName: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.projectFile.findMany({
      where,
      orderBy: [{ folder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Find files by project
   */
  async findByProject(projectId: string): Promise<ProjectFile[]> {
    return this.prisma.projectFile.findMany({
      where: { projectId },
      orderBy: [{ folder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Delete a file
   */
  async delete(id: string): Promise<void> {
    await this.prisma.projectFile.delete({
      where: { id },
    });
  }

  /**
   * Get folders for a project
   */
  async getFolders(projectId: string): Promise<string[]> {
    const result = await this.prisma.projectFile.groupBy({
      by: ['folder'],
      where: {
        projectId,
        folder: { not: null },
      },
    });

    return result.map((r) => r.folder).filter((f): f is string => f !== null);
  }

  /**
   * Get total file size for a project
   */
  async getTotalSize(projectId: string): Promise<number> {
    const result = await this.prisma.projectFile.aggregate({
      where: { projectId },
      _sum: {
        fileSize: true,
      },
    });

    return result._sum.fileSize ?? 0;
  }

  /**
   * Count files by type
   */
  async countByType(projectId: string): Promise<Record<ProjectFileType, number>> {
    const result = await this.prisma.projectFile.groupBy({
      by: ['fileType'],
      where: { projectId },
      _count: true,
    });

    const counts: Partial<Record<ProjectFileType, number>> = {};
    for (const item of result) {
      counts[item.fileType] = item._count;
    }

    return counts as Record<ProjectFileType, number>;
  }
}
