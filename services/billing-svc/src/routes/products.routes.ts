/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * Product Routes
 * API endpoints for product catalog
 */

import { productService } from '../services/product.service';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface ProductParams {
  slug: string;
}

interface PriceParams {
  priceId: string;
}

export async function registerProductRoutes(fastify: FastifyInstance): Promise<void> {
  // List all products
  fastify.get(
    '/products',
    {
      schema: {
        description: 'List all available products',
        tags: ['Products'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    slug: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    features: { type: 'array', items: { type: 'string' } },
                    prices: { type: 'array' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const products = productService.listProducts();
      return reply.send({ success: true, data: products });
    }
  );

  // Get product by slug
  fastify.get<{ Params: ProductParams }>(
    '/products/:slug',
    {
      schema: {
        description: 'Get a product by slug',
        tags: ['Products'],
        params: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
          },
          required: ['slug'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ProductParams }>, reply: FastifyReply) => {
      const { slug } = request.params;
      const product = productService.getProductBySlug(slug);

      if (!product) {
        return reply.status(404).send({
          success: false,
          error: 'Product not found',
        });
      }

      return reply.send({ success: true, data: product });
    }
  );

  // Get price by ID
  fastify.get<{ Params: PriceParams }>(
    '/prices/:priceId',
    {
      schema: {
        description: 'Get a price by ID',
        tags: ['Products'],
        params: {
          type: 'object',
          properties: {
            priceId: { type: 'string' },
          },
          required: ['priceId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: PriceParams }>, reply: FastifyReply) => {
      const { priceId } = request.params;
      const price = productService.getPriceById(priceId);

      if (!price) {
        return reply.status(404).send({
          success: false,
          error: 'Price not found',
        });
      }

      return reply.send({ success: true, data: price });
    }
  );
}
