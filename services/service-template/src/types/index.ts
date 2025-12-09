/**
 * @module @skillancer/service-template/types
 * Shared type definitions
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface SortQuery {
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface SearchQuery {
  search?: string;
  q?: string;
}

export interface ListQuery extends PaginationQuery, SortQuery, SearchQuery {}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ListResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ============================================================================
// HANDLER TYPES
// ============================================================================

export type RouteHandler<Params = unknown, Body = unknown, Query = unknown, Response = unknown> = (
  request: FastifyRequest<{
    Params: Params;
    Body: Body;
    Querystring: Query;
  }>,
  reply: FastifyReply
) => Promise<Response>;

// ============================================================================
// SERVICE TYPES
// ============================================================================

export interface ServiceContext {
  requestId: string;
  correlationId: string;
  userId?: string;
}

// ============================================================================
// ENTITY TYPES
// ============================================================================

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDeleteEntity extends BaseEntity {
  deletedAt?: Date;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];
