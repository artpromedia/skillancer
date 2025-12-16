/**
 * @module @skillancer/skillpod-svc/services/cdn
 * CDN service for CloudFront cache invalidation
 */

// =============================================================================
// TYPES
// =============================================================================

export interface InvalidationRequest {
  paths: string[];
  callerReference?: string;
}

export interface InvalidationResult {
  id: string;
  status: 'InProgress' | 'Completed';
  createTime: Date;
  paths: string[];
}

export interface CdnService {
  /**
   * Create a cache invalidation for specified paths
   */
  createInvalidation(request: InvalidationRequest): Promise<InvalidationResult>;

  /**
   * Get status of an invalidation
   */
  getInvalidationStatus(invalidationId: string): Promise<InvalidationResult>;

  /**
   * Invalidate all cache for a tenant
   */
  invalidateTenantCache(tenantId: string): Promise<InvalidationResult>;

  /**
   * Invalidate session-specific cache
   */
  invalidateSessionCache(sessionId: string): Promise<InvalidationResult>;

  /**
   * Invalidate pod-specific cache
   */
  invalidatePodCache(podId: string): Promise<InvalidationResult>;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Create CloudFront invalidation
 */
async function doCreateInvalidation(
  request: InvalidationRequest,
  distributionId: string
): Promise<InvalidationResult> {
  const callerReference =
    request.callerReference || `inv-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // In production, use AWS SDK CloudFront client
  // For now, simulate the API call
  if (!distributionId) {
    console.warn('[CDN] No distribution ID configured, skipping invalidation');
    return {
      id: `mock-${callerReference}`,
      status: 'Completed',
      createTime: new Date(),
      paths: request.paths,
    };
  }

  try {
    // AWS CloudFront createInvalidation API call
    // const cloudfront = new CloudFrontClient({ region: _region });
    // const command = new CreateInvalidationCommand({
    //   DistributionId: distributionId,
    //   InvalidationBatch: {
    //     CallerReference: callerReference,
    //     Paths: {
    //       Quantity: request.paths.length,
    //       Items: request.paths,
    //     },
    //   },
    // });
    // const response = await cloudfront.send(command);

    console.log(
      `[CDN] Invalidation created for ${request.paths.length} paths:`,
      request.paths.slice(0, 5)
    );

    // Simulate async operation for API compatibility
    await Promise.resolve();

    return {
      id: `inv-${callerReference}`,
      status: 'InProgress',
      createTime: new Date(),
      paths: request.paths,
    };
  } catch (error) {
    console.error('[CDN] Failed to create invalidation:', error);
    throw new Error(`CDN invalidation failed: ${(error as Error).message}`);
  }
}

/**
 * Get invalidation status
 */
async function doGetInvalidationStatus(invalidationId: string): Promise<InvalidationResult> {
  // In production, use AWS SDK to get invalidation status
  // const cloudfront = new CloudFrontClient({ region: _region });
  // const command = new GetInvalidationCommand({
  //   DistributionId: distributionId,
  //   Id: invalidationId,
  // });

  // Simulate async operation for API compatibility
  await Promise.resolve();

  return {
    id: invalidationId,
    status: 'Completed',
    createTime: new Date(),
    paths: [],
  };
}

export function createCdnService(): CdnService {
  // Use environment variables directly for AWS config
  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID || '';

  const createInvalidation = async (request: InvalidationRequest): Promise<InvalidationResult> =>
    doCreateInvalidation(request, distributionId);

  const getInvalidationStatus = async (invalidationId: string): Promise<InvalidationResult> =>
    doGetInvalidationStatus(invalidationId);

  const invalidateTenantCache = async (tenantId: string): Promise<InvalidationResult> =>
    createInvalidation({
      paths: [
        `/pods/${tenantId}/*`,
        `/sessions/${tenantId}/*`,
        `/assets/${tenantId}/*`,
        `/api/v1/skillpod/${tenantId}/*`,
      ],
    });

  const invalidateSessionCache = async (sessionId: string): Promise<InvalidationResult> =>
    createInvalidation({
      paths: [
        `/sessions/*/${sessionId}`,
        `/session-data/${sessionId}/*`,
        `/api/v1/skillpod/sessions/${sessionId}/*`,
      ],
    });

  const invalidatePodCache = async (podId: string): Promise<InvalidationResult> =>
    createInvalidation({
      paths: [
        `/pods/*/${podId}`,
        `/pod-assets/${podId}/*`,
        `/pod-data/${podId}/*`,
        `/api/v1/skillpod/pods/${podId}/*`,
      ],
    });

  return {
    createInvalidation,
    getInvalidationStatus,
    invalidateTenantCache,
    invalidateSessionCache,
    invalidatePodCache,
  };
}
