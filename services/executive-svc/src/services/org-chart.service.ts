import { prisma } from '@skillancer/database';
import { RACIRole } from '@prisma/client';
import { EventEmitter } from 'events';

// Org Chart & RACI Service for COO Suite
// Manages organizational structure and responsibility matrices

export interface PositionInput {
  title: string;
  department?: string;
  parentPositionId?: string;
  personName?: string;
  personEmail?: string;
}

export interface PositionUpdate {
  title?: string;
  department?: string;
  parentPositionId?: string | null;
  personName?: string | null;
  personEmail?: string | null;
}

export interface Position {
  id: string;
  title: string;
  department: string | null;
  parentPositionId: string | null;
  personName: string | null;
  personEmail: string | null;
  childPositions?: Position[];
}

// Re-export RACIRole for consumers of this service
export { RACIRole };

export interface RACIAssignment {
  positionId: string;
  role: RACIRole;
}

export interface RACIRow {
  id: string;
  activity: string;
  assignments: RACIAssignment[];
}

export interface RACIMatrix {
  id: string;
  processName: string;
  rows: RACIRow[];
  positions: Position[];
}

class OrgChartService extends EventEmitter {
  // Create org chart for an engagement
  async createOrgChart(engagementId: string, name: string = 'Organization Chart') {
    const existing = await prisma.orgChart.findUnique({
      where: { engagementId },
    });

    if (existing) return existing;

    return prisma.orgChart.create({
      data: { engagementId, name },
    });
  }

  // Get org chart with positions
  async getOrgChart(engagementId: string) {
    const orgChart = await prisma.orgChart.findUnique({
      where: { engagementId },
      include: {
        positions: {
          orderBy: { title: 'asc' },
        },
      },
    });

    if (!orgChart) return null;

    // Build hierarchy
    const hierarchy = this.buildHierarchy(orgChart.positions as unknown as Position[]);

    return {
      ...orgChart,
      hierarchy,
    };
  }

  // Add a position
  async addPosition(orgChartId: string, position: PositionInput): Promise<Position> {
    const created = await prisma.orgPosition.create({
      data: {
        orgChartId,
        title: position.title,
        department: position.department,
        parentPositionId: position.parentPositionId,
        personName: position.personName,
        personEmail: position.personEmail,
      },
    });

    this.emit('position:added', { orgChartId, positionId: created.id });
    return created as unknown as Position;
  }

  // Update a position
  async updatePosition(positionId: string, updates: PositionUpdate): Promise<Position> {
    const updated = await prisma.orgPosition.update({
      where: { id: positionId },
      data: updates,
    });

    this.emit('position:updated', { positionId, updates });
    return updated as unknown as Position;
  }

  // Delete a position
  async deletePosition(positionId: string): Promise<void> {
    // First, update any positions that report to this one
    await prisma.orgPosition.updateMany({
      where: { parentPositionId: positionId },
      data: { parentPositionId: null },
    });

    await prisma.orgPosition.delete({
      where: { id: positionId },
    });

    this.emit('position:deleted', { positionId });
  }

  // Get direct reports for a position
  async getDirectReports(positionId: string): Promise<Position[]> {
    const reports = await prisma.orgPosition.findMany({
      where: { parentPositionId: positionId },
      orderBy: { title: 'asc' },
    });
    return reports as unknown as Position[];
  }

  // Build hierarchical tree from flat positions
  private buildHierarchy(positions: Position[]): Position[] {
    const positionMap = new Map<string, Position>();
    const roots: Position[] = [];

    // Create map of all positions
    for (const pos of positions) {
      positionMap.set(pos.id, { ...pos, childPositions: [] });
    }

    // Build tree
    for (const pos of positions) {
      const position = positionMap.get(pos.id)!;
      if (pos.parentPositionId && positionMap.has(pos.parentPositionId)) {
        positionMap.get(pos.parentPositionId)!.childPositions!.push(position);
      } else {
        roots.push(position);
      }
    }

    return roots;
  }

  // RACI Matrix Management

  // Create RACI matrix
  async createRACIMatrix(orgChartId: string, name: string) {
    return prisma.rACIMatrix.create({
      data: {
        orgChartId,
        name,
      },
    });
  }

  // Get RACI matrices for org chart
  async getRACIMatrices(orgChartId: string) {
    return prisma.rACIMatrix.findMany({
      where: { orgChartId },
      include: {
        rows: {
          include: {
            assignments: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // Get RACI matrix by ID
  async getRACIMatrix(matrixId: string) {
    const matrix = await prisma.rACIMatrix.findUnique({
      where: { id: matrixId },
      include: {
        rows: {
          include: {
            assignments: {
              include: {
                position: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        orgChart: {
          include: {
            positions: true,
          },
        },
      },
    });

    if (!matrix) return null;

    return matrix;
  }

  // Add row to RACI matrix
  async addRACIRow(matrixId: string, activity: string, description?: string) {
    const matrix = await prisma.rACIMatrix.findUnique({
      where: { id: matrixId },
      include: { rows: true },
    });

    if (!matrix) throw new Error('Matrix not found');

    const sortOrder = matrix.rows.length;

    return prisma.rACIRow.create({
      data: {
        raciMatrixId: matrixId,
        activity,
        description,
        sortOrder,
      },
      include: {
        assignments: true,
      },
    });
  }

  // Update RACI assignment
  async updateRACIAssignment(
    rowId: string,
    positionId: string,
    role: RACIRole | null
  ): Promise<void> {
    // Remove existing assignment for this position in this row
    await prisma.rACIAssignment.deleteMany({
      where: {
        raciRowId: rowId,
        positionId,
      },
    });

    // Add new assignment if role provided
    if (role) {
      await prisma.rACIAssignment.create({
        data: {
          raciRowId: rowId,
          positionId,
          role,
        },
      });
    }
  }

  // Delete RACI row
  async deleteRACIRow(rowId: string): Promise<void> {
    await prisma.rACIRow.delete({
      where: { id: rowId },
    });
  }

  // Get org chart summary for widget
  async getOrgChartSummary(engagementId: string) {
    const orgChart = await this.getOrgChart(engagementId);

    if (!orgChart) {
      return {
        totalPositions: 0,
        filledPositions: 0,
        vacantPositions: 0,
        departments: [],
      };
    }

    const positions = orgChart.positions as unknown as Position[];
    const departments = new Set<string>();
    let vacantCount = 0;

    for (const pos of positions) {
      if (pos.department) departments.add(pos.department);
      // A position is vacant if personName is not set
      if (!pos.personName) vacantCount++;
    }

    return {
      totalPositions: positions.length,
      filledPositions: positions.length - vacantCount,
      vacantPositions: vacantCount,
      departments: Array.from(departments),
    };
  }
}

export const orgChartService = new OrgChartService();
