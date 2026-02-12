// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Project Routes
 *
 * API endpoints for project management
 */

import { z } from 'zod';

import { ProjectError, getStatusCode } from '../errors/project.errors.js';
import {
  ProjectService,
  TaskService,
  MilestoneService,
  TimeEntryService,
  TemplateService,
  WorkloadService,
} from '../services/index.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const ProjectSourceEnum = z.enum([
  'MANUAL',
  'SKILLANCER_MARKET',
  'UPWORK',
  'FIVERR',
  'TOPTAL',
  'OTHER_PLATFORM',
]);
const ProjectTypeEnum = z.enum(['CLIENT_WORK', 'INTERNAL', 'PERSONAL', 'RETAINER', 'MAINTENANCE']);
const ProjectStatusEnum = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
]);
const BudgetTypeEnum = z.enum(['HOURLY', 'FIXED', 'RETAINER', 'NO_BUDGET']);
const TaskStatusEnum = z.enum([
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
]);
const MilestoneStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

// Project Schemas
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(10000).optional(),
  source: ProjectSourceEnum,
  projectType: ProjectTypeEnum,
  clientId: z.string().uuid().optional(),
  budgetType: BudgetTypeEnum.optional(),
  budgetAmount: z.number().positive().optional(),
  hourlyRate: z.number().positive().optional(),
  estimatedHours: z.number().positive().optional(),
  startDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  deadline: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  tags: z.array(z.string()).optional(),
  priority: PriorityEnum.optional(),
  templateId: z.string().uuid().optional(),
  externalProjectId: z.string().max(100).optional(),
  externalUrl: z.string().url().optional(),
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(10000).optional(),
  status: ProjectStatusEnum.optional(),
  budgetType: BudgetTypeEnum.optional(),
  budgetAmount: z.number().positive().optional(),
  hourlyRate: z.number().positive().optional(),
  estimatedHours: z.number().positive().optional(),
  startDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  deadline: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  tags: z.array(z.string()).optional(),
  priority: PriorityEnum.optional(),
  progressPercent: z.number().min(0).max(100).optional(),
  isFavorite: z.boolean().optional(),
});

const ProjectFiltersSchema = z.object({
  status: z.array(ProjectStatusEnum).optional(),
  source: z.array(ProjectSourceEnum).optional(),
  clientId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  isFavorite: z
    .string()
    .transform((s) => s === 'true')
    .optional(),
  isArchived: z
    .string()
    .transform((s) => s === 'true')
    .optional(),
  startDateFrom: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  startDateTo: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  deadlineFrom: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  deadlineTo: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'deadline', 'created', 'updated', 'progress', 'priority']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

// Task Schemas
const CreateTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(10000).optional(),
  parentTaskId: z.string().uuid().optional(),
  estimatedMinutes: z.number().positive().optional(),
  dueDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  priority: PriorityEnum.optional(),
  labels: z.array(z.string()).optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(10000).optional(),
  status: TaskStatusEnum.optional(),
  estimatedMinutes: z.number().positive().optional(),
  dueDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  priority: PriorityEnum.optional(),
  labels: z.array(z.string()).optional(),
});

const ReorderTasksSchema = z.object({
  orders: z.array(
    z.object({
      taskId: z.string().uuid(),
      orderIndex: z.number().min(0),
    })
  ),
});

// Milestone Schemas
const CreateMilestoneSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(10000).optional(),
  dueDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  amount: z.number().positive().optional(),
  deliverables: z
    .array(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
      })
    )
    .optional(),
});

const UpdateMilestoneSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(10000).optional(),
  status: MilestoneStatusEnum.optional(),
  dueDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  amount: z.number().positive().optional(),
  deliverables: z
    .array(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        completed: z.boolean().default(false),
        orderIndex: z.number().min(0),
      })
    )
    .optional(),
});

const ReorderMilestonesSchema = z.object({
  orders: z.array(
    z.object({
      milestoneId: z.string().uuid(),
      orderIndex: z.number().min(0),
    })
  ),
});

// Time Entry Schemas
const CreateTimeEntrySchema = z.object({
  taskId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  startTime: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  endTime: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  durationMinutes: z.number().positive().optional(),
  isBillable: z.boolean().optional(),
});

const UpdateTimeEntrySchema = z.object({
  description: z.string().max(500).optional(),
  startTime: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  endTime: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  durationMinutes: z.number().positive().optional(),
  isBillable: z.boolean().optional(),
});

const TimeEntryFiltersSchema = z.object({
  taskId: z.string().uuid().optional(),
  startDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  endDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  isBillable: z
    .string()
    .transform((s) => s === 'true')
    .optional(),
});

// Template Schemas
const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  projectType: ProjectTypeEnum.optional(),
  budgetType: BudgetTypeEnum.optional(),
  defaultHourlyRate: z.number().positive().optional(),
  estimatedHours: z.number().positive().optional(),
  tags: z.array(z.string()).optional(),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        estimatedMinutes: z.number().positive().optional(),
        subtasks: z
          .array(
            z.object({
              title: z.string().min(1).max(255),
              description: z.string().max(2000).optional(),
              estimatedMinutes: z.number().positive().optional(),
            })
          )
          .optional(),
      })
    )
    .optional(),
  milestones: z
    .array(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        daysFromStart: z.number().min(0).optional(),
        deliverables: z
          .array(
            z.object({
              title: z.string().min(1).max(255),
              description: z.string().max(2000).optional(),
            })
          )
          .optional(),
      })
    )
    .optional(),
});

const UpdateTemplateSchema = CreateTemplateSchema.partial();

const CreateTemplateFromProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
});

// Workload Schemas
const WorkloadQuerySchema = z.object({
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
  hoursPerDay: z.string().transform(Number).optional(),
  bufferPercent: z.string().transform(Number).optional(),
});

const CanFitProjectSchema = z.object({
  estimatedMinutes: z.number().positive(),
  startDate: z.string().transform((s) => new Date(s)),
  deadline: z.string().transform((s) => new Date(s)),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface ProjectRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Shared Route Helpers
// ============================================================================

// Helper to get authenticated user
const getUser = (request: any) => {
  if (!request.user) {
    throw new Error('Authentication required');
  }
  return request.user as { id: string; email: string; role: string };
};

// Error handler
const handleError = (error: unknown, reply: any) => {
  if (error instanceof ProjectError) {
    return reply.status(getStatusCode(error.code)).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }
  throw error;
};

// ============================================================================
// Route Registration
// ============================================================================

export function registerProjectRoutes(fastify: FastifyInstance, deps: ProjectRouteDeps): void {
  const { prisma, redis, logger } = deps;

  // Initialize services
  const projectService = new ProjectService(prisma, redis, logger);
  const taskService = new TaskService(prisma, logger);
  const milestoneService = new MilestoneService(prisma, logger);
  const timeEntryService = new TimeEntryService(prisma, logger);

  // ============================================================================
  // Project Routes
  // ============================================================================

  // POST /projects - Create a new project
  fastify.post('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateProjectSchema.parse(request.body);

      const project = await projectService.createProject({
        freelancerUserId: user.id,
        ...body,
      });

      logger.info({
        msg: 'Project created',
        projectId: project.id,
        freelancerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        data: project,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /projects - List projects with filters
  fastify.get('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const filters = ProjectFiltersSchema.parse(request.query);
      const page = filters.page;
      const limit = filters.limit;

      const result = await projectService.getProjects({
        ...filters,
        freelancerUserId: user.id,
        page,
        limit,
      });

      return await reply.send({
        success: true,
        data: result.projects,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /projects/stats - Get project statistics
  fastify.get('/stats', async (request, reply) => {
    try {
      const user = getUser(request);
      const stats = await projectService.getProjectStats(user.id);

      return await reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /projects/:id - Get project by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const project = await projectService.getProjectById(request.params.id, user.id);

      return await reply.send({
        success: true,
        data: project,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /projects/:id - Update project
  fastify.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = UpdateProjectSchema.parse(request.body);

      const project = await projectService.updateProject(request.params.id, user.id, body);

      logger.info({
        msg: 'Project updated',
        projectId: project.id,
        updates: Object.keys(body),
      });

      return await reply.send({
        success: true,
        data: project,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /projects/:id/archive - Archive project
  fastify.post<{ Params: { id: string } }>('/:id/archive', async (request, reply) => {
    try {
      const user = getUser(request);
      const project = await projectService.archiveProject(request.params.id, user.id);

      return await reply.send({
        success: true,
        data: project,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /projects/:id/favorite - Toggle favorite
  fastify.post<{ Params: { id: string } }>('/:id/favorite', async (request, reply) => {
    try {
      const user = getUser(request);
      const project = await projectService.toggleFavorite(request.params.id, user.id);

      return await reply.send({
        success: true,
        data: project,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /projects/:id - Delete project
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      await projectService.deleteProject(request.params.id, user.id);

      return await reply.status(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ============================================================================
  // Task Routes
  // ============================================================================

  // POST /projects/:projectId/tasks - Create a task
  fastify.post<{ Params: { projectId: string } }>('/:projectId/tasks', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateTaskSchema.parse(request.body);

      const task = await taskService.createTask({
        projectId: request.params.projectId,
        freelancerUserId: user.id,
        ...body,
      });

      logger.info({
        msg: 'Task created',
        taskId: task.id,
        projectId: request.params.projectId,
      });

      return await reply.status(201).send({
        success: true,
        data: task,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /projects/:projectId/tasks - Get tasks for project
  fastify.get<{ Params: { projectId: string } }>('/:projectId/tasks', async (request, reply) => {
    try {
      const user = getUser(request);
      const tasks = await taskService.getTasksByProject(request.params.projectId, user.id);

      return await reply.send({
        success: true,
        data: tasks,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /projects/:projectId/tasks/:taskId - Update a task
  fastify.patch<{ Params: { projectId: string; taskId: string } }>(
    '/:projectId/tasks/:taskId',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const body = UpdateTaskSchema.parse(request.body);

        const task = await taskService.updateTask(request.params.taskId, user.id, body);

        return await reply.send({
          success: true,
          data: task,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // POST /projects/:projectId/tasks/:taskId/complete - Complete a task
  fastify.post<{ Params: { projectId: string; taskId: string } }>(
    '/:projectId/tasks/:taskId/complete',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const task = await taskService.completeTask(request.params.taskId, user.id);

        return await reply.send({
          success: true,
          data: task,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // POST /projects/:projectId/tasks/:taskId/reopen - Reopen a task
  fastify.post<{ Params: { projectId: string; taskId: string } }>(
    '/:projectId/tasks/:taskId/reopen',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const task = await taskService.reopenTask(request.params.taskId, user.id);

        return await reply.send({
          success: true,
          data: task,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // DELETE /projects/:projectId/tasks/:taskId - Delete a task
  fastify.delete<{ Params: { projectId: string; taskId: string } }>(
    '/:projectId/tasks/:taskId',
    async (request, reply) => {
      try {
        const user = getUser(request);
        await taskService.deleteTask(request.params.taskId, user.id);

        return await reply.status(204).send();
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // PUT /projects/:projectId/tasks/reorder - Reorder tasks
  fastify.put<{ Params: { projectId: string } }>(
    '/:projectId/tasks/reorder',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const body = ReorderTasksSchema.parse(request.body);

        await taskService.reorderTasks(request.params.projectId, user.id, body.orders);

        return await reply.send({
          success: true,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // ============================================================================
  // Milestone Routes
  // ============================================================================

  // POST /projects/:projectId/milestones - Create a milestone
  fastify.post<{ Params: { projectId: string } }>(
    '/:projectId/milestones',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const body = CreateMilestoneSchema.parse(request.body);

        const milestone = await milestoneService.createMilestone({
          projectId: request.params.projectId,
          freelancerUserId: user.id,
          ...body,
        });

        logger.info({
          msg: 'Milestone created',
          milestoneId: milestone.id,
          projectId: request.params.projectId,
        });

        return await reply.status(201).send({
          success: true,
          data: milestone,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // GET /projects/:projectId/milestones - Get milestones for project
  fastify.get<{ Params: { projectId: string } }>(
    '/:projectId/milestones',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const milestones = await milestoneService.getMilestonesByProject(
          request.params.projectId,
          user.id
        );

        return await reply.send({
          success: true,
          data: milestones,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // PATCH /projects/:projectId/milestones/:milestoneId - Update a milestone
  fastify.patch<{ Params: { projectId: string; milestoneId: string } }>(
    '/:projectId/milestones/:milestoneId',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const body = UpdateMilestoneSchema.parse(request.body);

        const milestone = await milestoneService.updateMilestone(
          request.params.milestoneId,
          user.id,
          body
        );

        return await reply.send({
          success: true,
          data: milestone,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // POST /projects/:projectId/milestones/:milestoneId/complete - Complete a milestone
  fastify.post<{ Params: { projectId: string; milestoneId: string } }>(
    '/:projectId/milestones/:milestoneId/complete',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const milestone = await milestoneService.completeMilestone(
          request.params.milestoneId,
          user.id
        );

        return await reply.send({
          success: true,
          data: milestone,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // POST /projects/:projectId/milestones/:milestoneId/deliverables/:index/toggle
  fastify.post<{ Params: { projectId: string; milestoneId: string; index: string } }>(
    '/:projectId/milestones/:milestoneId/deliverables/:index/toggle',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const deliverableIndex = Number.parseInt(request.params.index, 10);

        const milestone = await milestoneService.toggleDeliverable(
          request.params.milestoneId,
          user.id,
          deliverableIndex
        );

        return await reply.send({
          success: true,
          data: milestone,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // DELETE /projects/:projectId/milestones/:milestoneId - Delete a milestone
  fastify.delete<{ Params: { projectId: string; milestoneId: string } }>(
    '/:projectId/milestones/:milestoneId',
    async (request, reply) => {
      try {
        const user = getUser(request);
        await milestoneService.deleteMilestone(request.params.milestoneId, user.id);

        return await reply.status(204).send();
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // PUT /projects/:projectId/milestones/reorder - Reorder milestones
  fastify.put<{ Params: { projectId: string } }>(
    '/:projectId/milestones/reorder',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const body = ReorderMilestonesSchema.parse(request.body);

        await milestoneService.reorderMilestones(request.params.projectId, user.id, body.orders);

        return await reply.send({
          success: true,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // ============================================================================
  // Time Entry Routes
  // ============================================================================

  // POST /projects/:projectId/time-entries - Create a time entry
  fastify.post<{ Params: { projectId: string } }>(
    '/:projectId/time-entries',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const body = CreateTimeEntrySchema.parse(request.body);

        const timeEntry = await timeEntryService.createTimeEntry({
          projectId: request.params.projectId,
          freelancerUserId: user.id,
          ...body,
        });

        return await reply.status(201).send({
          success: true,
          data: timeEntry,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // GET /projects/:projectId/time-entries - Get time entries for project
  fastify.get<{ Params: { projectId: string } }>(
    '/:projectId/time-entries',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const filters = TimeEntryFiltersSchema.parse(request.query);

        const entries = await timeEntryService.getTimeEntries(user.id, {
          projectId: request.params.projectId,
          ...filters,
        });

        return await reply.send({
          success: true,
          data: entries,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // GET /projects/:projectId/time-stats - Get time statistics for project
  fastify.get<{ Params: { projectId: string } }>(
    '/:projectId/time-stats',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const stats = await timeEntryService.getProjectTimeStats(request.params.projectId, user.id);

        return await reply.send({
          success: true,
          data: stats,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // POST /projects/:projectId/timer/start - Start timer
  fastify.post<{ Params: { projectId: string } }>(
    '/:projectId/timer/start',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const body = z
          .object({
            taskId: z.string().uuid().optional(),
            description: z.string().max(500).optional(),
          })
          .parse(request.body);

        const timer = await timeEntryService.startTimer({
          projectId: request.params.projectId,
          freelancerUserId: user.id,
          ...body,
        });

        return await reply.status(201).send({
          success: true,
          data: timer,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // POST /projects/:projectId/timer/stop - Stop timer
  fastify.post<{ Params: { projectId: string } }>(
    '/:projectId/timer/stop',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const entry = await timeEntryService.stopTimer(request.params.projectId, user.id);

        return await reply.send({
          success: true,
          data: entry,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // GET /projects/:projectId/timer - Get running timer
  fastify.get<{ Params: { projectId: string } }>('/:projectId/timer', async (request, reply) => {
    try {
      const user = getUser(request);
      const timer = await timeEntryService.getRunningTimer(request.params.projectId, user.id);

      return await reply.send({
        success: true,
        data: timer,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /projects/:projectId/time-entries/:entryId - Update time entry
  fastify.patch<{ Params: { projectId: string; entryId: string } }>(
    '/:projectId/time-entries/:entryId',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const body = UpdateTimeEntrySchema.parse(request.body);

        const entry = await timeEntryService.updateTimeEntry(request.params.entryId, user.id, body);

        return await reply.send({
          success: true,
          data: entry,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // DELETE /projects/:projectId/time-entries/:entryId - Delete time entry
  fastify.delete<{ Params: { projectId: string; entryId: string } }>(
    '/:projectId/time-entries/:entryId',
    async (request, reply) => {
      try {
        const user = getUser(request);
        await timeEntryService.deleteTimeEntry(request.params.entryId, user.id);

        return await reply.status(204).send();
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );
}

// ============================================================================
// Template Routes (Separate Registration)
// ============================================================================

export function registerTemplateRoutes(fastify: FastifyInstance, deps: ProjectRouteDeps): void {
  const { prisma, logger } = deps;
  const templateService = new TemplateService(prisma, logger);

  // POST /templates - Create a template
  fastify.post('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateTemplateSchema.parse(request.body);

      const template = await templateService.createTemplate({
        freelancerUserId: user.id,
        ...body,
      });

      logger.info({
        msg: 'Template created',
        templateId: template.id,
      });

      return await reply.status(201).send({
        success: true,
        data: template,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /templates/from-project/:projectId - Create template from project
  fastify.post<{ Params: { projectId: string } }>(
    '/from-project/:projectId',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const body = CreateTemplateFromProjectSchema.parse(request.body);

        const template = await templateService.createFromProject(
          request.params.projectId,
          user.id,
          body
        );

        return await reply.status(201).send({
          success: true,
          data: template,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // GET /templates - Get all templates
  fastify.get('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = z
        .object({
          category: z.string().optional(),
          search: z.string().optional(),
        })
        .parse(request.query);

      const templates = await templateService.getTemplates(user.id, {
        category: query.category,
        search: query.search,
      });

      return await reply.send({
        success: true,
        data: templates,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /templates/categories - Get template categories
  fastify.get('/categories', async (request, reply) => {
    try {
      const user = getUser(request);
      const categories = await templateService.getCategories(user.id);

      return await reply.send({
        success: true,
        data: categories,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /templates/:id - Get template by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const template = await templateService.getTemplateById(request.params.id, user.id);

      return await reply.send({
        success: true,
        data: template,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /templates/:id - Update template
  fastify.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = UpdateTemplateSchema.parse(request.body);

      const template = await templateService.updateTemplate(request.params.id, user.id, body);

      return await reply.send({
        success: true,
        data: template,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /templates/:id/duplicate - Duplicate template
  fastify.post<{ Params: { id: string } }>('/:id/duplicate', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = z
        .object({
          name: z.string().max(255).optional(),
        })
        .parse(request.body);

      const template = await templateService.duplicateTemplate(
        request.params.id,
        user.id,
        body.name
      );

      return await reply.status(201).send({
        success: true,
        data: template,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /templates/:id - Delete template
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      await templateService.deleteTemplate(request.params.id, user.id);

      return await reply.status(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  });
}

// ============================================================================
// Workload Routes (Separate Registration)
// ============================================================================

export function registerWorkloadRoutes(fastify: FastifyInstance, deps: ProjectRouteDeps): void {
  const { prisma, logger } = deps;
  const workloadService = new WorkloadService(prisma, logger);

  // GET /workload - Get workload for date range
  fastify.get('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = WorkloadQuerySchema.parse(request.query);

      const workload = await workloadService.getWorkload(user.id, query.startDate, query.endDate, {
        hoursPerDay: query.hoursPerDay,
        bufferPercent: query.bufferPercent,
      });

      return await reply.send({
        success: true,
        data: workload,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /workload/availability/:date - Get availability for specific date
  fastify.get<{ Params: { date: string } }>('/availability/:date', async (request, reply) => {
    try {
      const user = getUser(request);
      const date = new Date(request.params.date);

      const availability = await workloadService.getAvailability(user.id, date);

      return await reply.send({
        success: true,
        data: availability,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /workload/weekly - Get weekly summary
  fastify.get('/weekly', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = z
        .object({
          weekStart: z.string().transform((s) => new Date(s)),
        })
        .parse(request.query);

      const summary = await workloadService.getWeeklySummary(user.id, query.weekStart);

      return await reply.send({
        success: true,
        data: summary,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /workload/can-fit - Check if a project can fit
  fastify.post('/can-fit', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CanFitProjectSchema.parse(request.body);

      const result = await workloadService.canFitProject(
        user.id,
        body.estimatedMinutes,
        body.startDate,
        body.deadline
      );

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /workload/available-slots - Find available slots
  fastify.get('/available-slots', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = z
        .object({
          requiredMinutes: z.string().transform(Number),
          startDate: z.string().transform((s) => new Date(s)),
          maxDays: z.string().transform(Number).optional(),
        })
        .parse(request.query);

      const slots = await workloadService.findAvailableSlots(
        user.id,
        query.requiredMinutes,
        query.startDate,
        query.maxDays || 30
      );

      return await reply.send({
        success: true,
        data: slots,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
