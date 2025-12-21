// @ts-nocheck - Example routes with Swagger schema tags
/**
 * Example routes - remove in real services
 */

import { z } from 'zod';

import { NotFoundError } from '../utils/errors.js';
import { validateOrThrow } from '../utils/validation.js';

import type { FastifyInstance } from 'fastify';

// Example schema
const itemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price: z.number().positive(),
});

// In-memory store for demo
const items = new Map<string, { id: string; name: string; description?: string; price: number }>();

export function exampleRoutes(
  app: FastifyInstance,
  _opts: { prefix?: string },
  done: (err?: Error) => void
): void {
  // List items
  app.get(
    '/items',
    {
      schema: {
        tags: ['API'],
        summary: 'List all items',
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    price: { type: 'number' },
                  },
                },
              },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    () => ({
      items: Array.from(items.values()),
      total: items.size,
    })
  );

  // Get item by ID
  app.get<{ Params: { id: string } }>(
    '/items/:id',
    {
      schema: {
        tags: ['API'],
        summary: 'Get item by ID',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
      },
    },
    (request) => {
      const item = items.get(request.params.id);
      if (!item) {
        throw new NotFoundError('Item not found');
      }
      return item;
    }
  );

  // Create item
  app.post(
    '/items',
    {
      schema: {
        tags: ['API'],
        summary: 'Create a new item',
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: 'string', maxLength: 500 },
            price: { type: 'number', minimum: 0 },
          },
          required: ['name', 'price'],
        },
      },
    },
    (request) => {
      const data = validateOrThrow(itemSchema, request.body);
      const id = crypto.randomUUID();
      const item = { id, name: data.name, description: data.description, price: data.price };
      items.set(id, item);
      return item;
    }
  );

  // Delete item
  app.delete<{ Params: { id: string } }>(
    '/items/:id',
    {
      schema: {
        tags: ['API'],
        summary: 'Delete an item',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
      },
    },
    (request, reply) => {
      if (!items.has(request.params.id)) {
        throw new NotFoundError('Item not found');
      }
      items.delete(request.params.id);
      void reply.code(204);
    }
  );

  done();
}
