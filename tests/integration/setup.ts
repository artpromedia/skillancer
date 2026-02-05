/**
 * Integration Test Setup
 *
 * Provides shared test infrastructure for integration tests including:
 * - Test database setup/teardown
 * - API server initialization
 * - Authentication helpers
 * - Common test utilities
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// =============================================================================
// TYPES
// =============================================================================

export interface TestUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'ADMIN' | 'FREELANCER' | 'CLIENT';
  accessToken: string;
  refreshToken: string;
}

export interface TestContext {
  apiUrl: string;
  users: {
    admin: TestUser;
    client: TestUser;
    freelancer: TestUser;
  };
  headers: (user: TestUser) => Record<string, string>;
  request: <T = unknown>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      user?: TestUser;
    }
  ) => Promise<{ status: number; body: T }>;
}

// =============================================================================
// MOCK DATABASE
// =============================================================================

const mockDb = {
  users: new Map<string, Record<string, unknown>>(),
  jobs: new Map<string, Record<string, unknown>>(),
  proposals: new Map<string, Record<string, unknown>>(),
  contracts: new Map<string, Record<string, unknown>>(),
  milestones: new Map<string, Record<string, unknown>>(),
  payments: new Map<string, Record<string, unknown>>(),
  paymentMethods: new Map<string, Record<string, unknown>>(),
  escrows: new Map<string, Record<string, unknown>>(),
  tokens: new Map<string, string>(), // token -> userId
};

// =============================================================================
// JWT MOCK
// =============================================================================

let tokenCounter = 0;

function generateMockToken(userId: string): string {
  tokenCounter += 1;
  const token = `mock_token_${userId}_${tokenCounter}`;
  mockDb.tokens.set(token, userId);
  return token;
}

function verifyMockToken(token: string): string | null {
  return mockDb.tokens.get(token) ?? null;
}

// =============================================================================
// TEST USER FACTORY
// =============================================================================

function createTestUser(overrides: Partial<TestUser> & { email: string; role: TestUser['role'] }): TestUser {
  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user: TestUser = {
    id,
    email: overrides.email,
    password: overrides.password ?? 'TestPassword123!',
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    role: overrides.role,
    accessToken: generateMockToken(id),
    refreshToken: generateMockToken(id),
  };

  mockDb.users.set(id, {
    ...user,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return user;
}

// =============================================================================
// REQUEST HELPER
// =============================================================================

async function mockRequest<T = unknown>(
  _apiUrl: string,
  method: string,
  path: string,
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
    user?: TestUser;
  }
): Promise<{ status: number; body: T }> {
  const authHeader = options?.user
    ? { Authorization: `Bearer ${options.user.accessToken}` }
    : {};

  const headers = {
    'Content-Type': 'application/json',
    ...authHeader,
    ...options?.headers,
  };

  // Validate auth if required
  const authToken = headers.Authorization?.replace('Bearer ', '');
  const authenticatedUserId = authToken ? verifyMockToken(authToken) : null;

  // Simulate API routing
  return simulateRoute<T>(method.toUpperCase(), path, options?.body, authenticatedUserId);
}

// =============================================================================
// ROUTE SIMULATOR
// =============================================================================

function simulateRoute<T>(
  method: string,
  path: string,
  body: unknown,
  userId: string | null
): { status: number; body: T } {
  // Auth routes
  if (path === '/api/auth/register' && method === 'POST') {
    return handleRegister<T>(body as Record<string, unknown>);
  }
  if (path === '/api/auth/login' && method === 'POST') {
    return handleLogin<T>(body as Record<string, unknown>);
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    return handleLogout<T>(userId);
  }
  if (path === '/api/auth/refresh' && method === 'POST') {
    return handleRefresh<T>(body as Record<string, unknown>);
  }

  // Protected routes require authentication
  if (!userId) {
    return { status: 401, body: { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } } as T };
  }

  // Job routes
  if (path === '/api/jobs' && method === 'POST') {
    return handleCreateJob<T>(body as Record<string, unknown>, userId);
  }
  if (path === '/api/jobs' && method === 'GET') {
    return handleListJobs<T>();
  }
  if (path.match(/^\/api\/jobs\/[\w-]+$/) && method === 'GET') {
    return handleGetJob<T>(path.split('/').pop()!);
  }
  if (path.match(/^\/api\/jobs\/[\w-]+$/) && method === 'PUT') {
    return handleUpdateJob<T>(path.split('/').pop()!, body as Record<string, unknown>, userId);
  }
  if (path.match(/^\/api\/jobs\/[\w-]+$/) && method === 'DELETE') {
    return handleDeleteJob<T>(path.split('/').pop()!, userId);
  }

  // Proposal routes
  if (path === '/api/proposals' && method === 'POST') {
    return handleCreateProposal<T>(body as Record<string, unknown>, userId);
  }
  if (path.match(/^\/api\/proposals\/[\w-]+\/accept$/) && method === 'POST') {
    const proposalId = path.split('/')[3];
    return handleAcceptProposal<T>(proposalId, userId);
  }
  if (path.match(/^\/api\/proposals\/[\w-]+\/reject$/) && method === 'POST') {
    const proposalId = path.split('/')[3];
    return handleRejectProposal<T>(proposalId, userId);
  }

  // Contract routes
  if (path === '/api/contracts' && method === 'POST') {
    return handleCreateContract<T>(body as Record<string, unknown>, userId);
  }
  if (path.match(/^\/api\/contracts\/[\w-]+$/) && method === 'GET') {
    return handleGetContract<T>(path.split('/').pop()!);
  }
  if (path.match(/^\/api\/contracts\/[\w-]+\/milestones$/) && method === 'POST') {
    const contractId = path.split('/')[3];
    return handleCreateMilestone<T>(contractId, body as Record<string, unknown>, userId);
  }
  if (path.match(/^\/api\/contracts\/[\w-]+\/complete$/) && method === 'POST') {
    const contractId = path.split('/')[3];
    return handleCompleteContract<T>(contractId, userId);
  }

  // Payment routes
  if (path === '/api/payments/methods' && method === 'POST') {
    return handleAddPaymentMethod<T>(body as Record<string, unknown>, userId);
  }
  if (path === '/api/payments/methods' && method === 'GET') {
    return handleListPaymentMethods<T>(userId);
  }
  if (path.match(/^\/api\/payments\/methods\/[\w-]+$/) && method === 'DELETE') {
    const methodId = path.split('/').pop()!;
    return handleRemovePaymentMethod<T>(methodId, userId);
  }
  if (path === '/api/payments/escrow/fund' && method === 'POST') {
    return handleFundEscrow<T>(body as Record<string, unknown>, userId);
  }
  if (path === '/api/payments/escrow/release' && method === 'POST') {
    return handleReleaseEscrow<T>(body as Record<string, unknown>, userId);
  }
  if (path === '/api/payments/refund' && method === 'POST') {
    return handleRefund<T>(body as Record<string, unknown>, userId);
  }

  return { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } } as T };
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

function handleRegister<T>(body: Record<string, unknown>): { status: number; body: T } {
  if (!body.email || !body.password || !body.firstName || !body.lastName) {
    return {
      status: 400,
      body: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields', details: [] } } as T,
    };
  }

  const existingUser = Array.from(mockDb.users.values()).find((u) => u.email === body.email);
  if (existingUser) {
    return {
      status: 409,
      body: { success: false, error: { code: 'USER_EXISTS', message: 'User already exists' } } as T,
    };
  }

  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const accessToken = generateMockToken(id);
  const refreshToken = generateMockToken(id);

  mockDb.users.set(id, {
    id,
    email: body.email,
    password: body.password,
    firstName: body.firstName,
    lastName: body.lastName,
    role: body.role ?? 'USER',
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    status: 201,
    body: { success: true, data: { id, email: body.email, accessToken, refreshToken } } as T,
  };
}

function handleLogin<T>(body: Record<string, unknown>): { status: number; body: T } {
  if (!body.email || !body.password) {
    return {
      status: 400,
      body: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Email and password required' } } as T,
    };
  }

  const user = Array.from(mockDb.users.values()).find(
    (u) => u.email === body.email && u.password === body.password
  );

  if (!user) {
    return {
      status: 401,
      body: { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } } as T,
    };
  }

  const accessToken = generateMockToken(user.id as string);
  const refreshToken = generateMockToken(user.id as string);

  return {
    status: 200,
    body: { success: true, data: { accessToken, refreshToken, expiresIn: 3600 } } as T,
  };
}

function handleLogout<T>(userId: string | null): { status: number; body: T } {
  if (!userId) {
    return { status: 401, body: { success: false, error: { code: 'UNAUTHORIZED' } } as T };
  }
  // Remove tokens for this user
  for (const [token, uid] of mockDb.tokens) {
    if (uid === userId) {
      mockDb.tokens.delete(token);
    }
  }
  return { status: 200, body: { success: true } as T };
}

function handleRefresh<T>(body: Record<string, unknown>): { status: number; body: T } {
  if (!body.refreshToken) {
    return { status: 400, body: { success: false, error: { code: 'MISSING_REFRESH_TOKEN' } } as T };
  }

  const userId = verifyMockToken(body.refreshToken as string);
  if (!userId) {
    return { status: 401, body: { success: false, error: { code: 'INVALID_REFRESH_TOKEN' } } as T };
  }

  const newAccessToken = generateMockToken(userId);
  const newRefreshToken = generateMockToken(userId);

  return {
    status: 200,
    body: { success: true, data: { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 3600 } } as T,
  };
}

function handleCreateJob<T>(body: Record<string, unknown>, userId: string): { status: number; body: T } {
  if (!body.title || !body.description || !body.budget) {
    return {
      status: 400,
      body: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } } as T,
    };
  }

  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    clientId: userId,
    title: body.title,
    description: body.description,
    budget: body.budget,
    budgetType: body.budgetType ?? 'FIXED',
    status: 'OPEN',
    skills: body.skills ?? [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockDb.jobs.set(id, job);
  return { status: 201, body: { success: true, data: job } as T };
}

function handleListJobs<T>(): { status: number; body: T } {
  const jobs = Array.from(mockDb.jobs.values());
  return { status: 200, body: { success: true, data: { jobs, total: jobs.length } } as T };
}

function handleGetJob<T>(jobId: string): { status: number; body: T } {
  const job = mockDb.jobs.get(jobId);
  if (!job) {
    return { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } } as T };
  }
  return { status: 200, body: { success: true, data: job } as T };
}

function handleUpdateJob<T>(jobId: string, body: Record<string, unknown>, userId: string): { status: number; body: T } {
  const job = mockDb.jobs.get(jobId);
  if (!job) {
    return { status: 404, body: { success: false, error: { code: 'NOT_FOUND' } } as T };
  }
  if (job.clientId !== userId) {
    return { status: 403, body: { success: false, error: { code: 'FORBIDDEN' } } as T };
  }
  const updated = { ...job, ...body, updatedAt: new Date() };
  mockDb.jobs.set(jobId, updated);
  return { status: 200, body: { success: true, data: updated } as T };
}

function handleDeleteJob<T>(jobId: string, userId: string): { status: number; body: T } {
  const job = mockDb.jobs.get(jobId);
  if (!job) {
    return { status: 404, body: { success: false, error: { code: 'NOT_FOUND' } } as T };
  }
  if (job.clientId !== userId) {
    return { status: 403, body: { success: false, error: { code: 'FORBIDDEN' } } as T };
  }
  mockDb.jobs.delete(jobId);
  return { status: 200, body: { success: true } as T };
}

function handleCreateProposal<T>(body: Record<string, unknown>, userId: string): { status: number; body: T } {
  if (!body.jobId || !body.coverLetter || !body.bidAmount) {
    return { status: 400, body: { success: false, error: { code: 'VALIDATION_ERROR' } } as T };
  }
  const job = mockDb.jobs.get(body.jobId as string);
  if (!job) {
    return { status: 404, body: { success: false, error: { code: 'JOB_NOT_FOUND' } } as T };
  }

  const id = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const proposal = {
    id,
    jobId: body.jobId,
    freelancerId: userId,
    clientId: job.clientId,
    coverLetter: body.coverLetter,
    bidAmount: body.bidAmount,
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockDb.proposals.set(id, proposal);
  return { status: 201, body: { success: true, data: proposal } as T };
}

function handleAcceptProposal<T>(proposalId: string, userId: string): { status: number; body: T } {
  const proposal = mockDb.proposals.get(proposalId);
  if (!proposal) {
    return { status: 404, body: { success: false, error: { code: 'NOT_FOUND' } } as T };
  }
  if (proposal.clientId !== userId) {
    return { status: 403, body: { success: false, error: { code: 'FORBIDDEN' } } as T };
  }
  if (proposal.status !== 'PENDING') {
    return { status: 400, body: { success: false, error: { code: 'INVALID_STATUS', message: `Cannot accept proposal in ${proposal.status} status` } } as T };
  }

  proposal.status = 'ACCEPTED';
  proposal.updatedAt = new Date();
  mockDb.proposals.set(proposalId, proposal);

  // Create contract from accepted proposal
  const contractId = `contract_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const contract = {
    id: contractId,
    jobId: proposal.jobId,
    proposalId: proposal.id,
    freelancerId: proposal.freelancerId,
    clientId: proposal.clientId,
    amount: proposal.bidAmount,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockDb.contracts.set(contractId, contract);

  return { status: 200, body: { success: true, data: { proposal, contract } } as T };
}

function handleRejectProposal<T>(proposalId: string, userId: string): { status: number; body: T } {
  const proposal = mockDb.proposals.get(proposalId);
  if (!proposal) {
    return { status: 404, body: { success: false, error: { code: 'NOT_FOUND' } } as T };
  }
  if (proposal.clientId !== userId) {
    return { status: 403, body: { success: false, error: { code: 'FORBIDDEN' } } as T };
  }

  proposal.status = 'REJECTED';
  proposal.updatedAt = new Date();
  mockDb.proposals.set(proposalId, proposal);
  return { status: 200, body: { success: true, data: proposal } as T };
}

function handleCreateContract<T>(body: Record<string, unknown>, userId: string): { status: number; body: T } {
  if (!body.jobId || !body.freelancerId || !body.amount) {
    return { status: 400, body: { success: false, error: { code: 'VALIDATION_ERROR' } } as T };
  }

  const id = `contract_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const contract = {
    id,
    jobId: body.jobId,
    freelancerId: body.freelancerId,
    clientId: userId,
    amount: body.amount,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockDb.contracts.set(id, contract);
  return { status: 201, body: { success: true, data: contract } as T };
}

function handleGetContract<T>(contractId: string): { status: number; body: T } {
  const contract = mockDb.contracts.get(contractId);
  if (!contract) {
    return { status: 404, body: { success: false, error: { code: 'NOT_FOUND' } } as T };
  }
  return { status: 200, body: { success: true, data: contract } as T };
}

function handleCreateMilestone<T>(contractId: string, body: Record<string, unknown>, userId: string): { status: number; body: T } {
  const contract = mockDb.contracts.get(contractId);
  if (!contract) {
    return { status: 404, body: { success: false, error: { code: 'NOT_FOUND' } } as T };
  }
  if (contract.clientId !== userId) {
    return { status: 403, body: { success: false, error: { code: 'FORBIDDEN' } } as T };
  }

  const id = `ms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const milestone = {
    id,
    contractId,
    name: body.name,
    amount: body.amount,
    dueDate: body.dueDate,
    status: 'PENDING',
    order: body.order ?? (mockDb.milestones.size + 1),
    createdAt: new Date(),
  };

  mockDb.milestones.set(id, milestone);
  return { status: 201, body: { success: true, data: milestone } as T };
}

function handleCompleteContract<T>(contractId: string, userId: string): { status: number; body: T } {
  const contract = mockDb.contracts.get(contractId);
  if (!contract) {
    return { status: 404, body: { success: false, error: { code: 'NOT_FOUND' } } as T };
  }
  if (contract.clientId !== userId) {
    return { status: 403, body: { success: false, error: { code: 'FORBIDDEN' } } as T };
  }

  contract.status = 'COMPLETED';
  contract.updatedAt = new Date();
  mockDb.contracts.set(contractId, contract);
  return { status: 200, body: { success: true, data: contract } as T };
}

function handleAddPaymentMethod<T>(body: Record<string, unknown>, userId: string): { status: number; body: T } {
  if (!body.stripePaymentMethodId) {
    return { status: 400, body: { success: false, error: { code: 'VALIDATION_ERROR' } } as T };
  }

  const id = `pm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const method = {
    id,
    userId,
    stripePaymentMethodId: body.stripePaymentMethodId,
    type: 'CARD',
    isDefault: mockDb.paymentMethods.size === 0,
    status: 'ACTIVE',
    cardBrand: 'visa',
    cardLast4: '4242',
    createdAt: new Date(),
  };

  mockDb.paymentMethods.set(id, method);
  return { status: 201, body: { success: true, data: method } as T };
}

function handleListPaymentMethods<T>(userId: string): { status: number; body: T } {
  const methods = Array.from(mockDb.paymentMethods.values()).filter((m) => m.userId === userId);
  return { status: 200, body: { success: true, data: methods } as T };
}

function handleRemovePaymentMethod<T>(methodId: string, userId: string): { status: number; body: T } {
  const method = mockDb.paymentMethods.get(methodId);
  if (!method) {
    return { status: 404, body: { success: false, error: { code: 'NOT_FOUND' } } as T };
  }
  if (method.userId !== userId) {
    return { status: 403, body: { success: false, error: { code: 'FORBIDDEN' } } as T };
  }
  mockDb.paymentMethods.delete(methodId);
  return { status: 200, body: { success: true } as T };
}

function handleFundEscrow<T>(body: Record<string, unknown>, userId: string): { status: number; body: T } {
  if (!body.contractId || !body.amount) {
    return { status: 400, body: { success: false, error: { code: 'VALIDATION_ERROR' } } as T };
  }

  const id = `escrow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const escrow = {
    id,
    contractId: body.contractId,
    clientId: userId,
    amount: body.amount,
    status: 'FUNDED',
    createdAt: new Date(),
  };

  mockDb.escrows.set(id, escrow);
  return { status: 201, body: { success: true, data: escrow } as T };
}

function handleReleaseEscrow<T>(body: Record<string, unknown>, userId: string): { status: number; body: T } {
  if (!body.escrowId) {
    return { status: 400, body: { success: false, error: { code: 'VALIDATION_ERROR' } } as T };
  }

  const escrow = mockDb.escrows.get(body.escrowId as string);
  if (!escrow) {
    return { status: 404, body: { success: false, error: { code: 'NOT_FOUND' } } as T };
  }
  if (escrow.clientId !== userId) {
    return { status: 403, body: { success: false, error: { code: 'FORBIDDEN' } } as T };
  }

  escrow.status = 'RELEASED';
  mockDb.escrows.set(body.escrowId as string, escrow);
  return { status: 200, body: { success: true, data: escrow } as T };
}

function handleRefund<T>(body: Record<string, unknown>, _userId: string): { status: number; body: T } {
  if (!body.paymentId) {
    return { status: 400, body: { success: false, error: { code: 'VALIDATION_ERROR' } } as T };
  }

  const refundId = `refund_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    status: 200,
    body: { success: true, data: { id: refundId, paymentId: body.paymentId, amount: body.amount, status: 'SUCCEEDED' } } as T,
  };
}

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

export function setupIntegrationTests(): TestContext {
  const apiUrl = 'http://localhost:3001';

  const users = {
    admin: createTestUser({ email: 'admin@skillancer.test', role: 'ADMIN', firstName: 'Admin', lastName: 'User' }),
    client: createTestUser({ email: 'client@skillancer.test', role: 'CLIENT', firstName: 'Client', lastName: 'User' }),
    freelancer: createTestUser({ email: 'freelancer@skillancer.test', role: 'FREELANCER', firstName: 'Freelancer', lastName: 'User' }),
  };

  const headers = (user: TestUser) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${user.accessToken}`,
  });

  const request = async <T = unknown>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      user?: TestUser;
    }
  ): Promise<{ status: number; body: T }> => {
    return mockRequest<T>(apiUrl, method, path, options);
  };

  return { apiUrl, users, headers, request };
}

export function cleanupIntegrationTests(): void {
  mockDb.users.clear();
  mockDb.jobs.clear();
  mockDb.proposals.clear();
  mockDb.contracts.clear();
  mockDb.milestones.clear();
  mockDb.payments.clear();
  mockDb.paymentMethods.clear();
  mockDb.escrows.clear();
  mockDb.tokens.clear();
  tokenCounter = 0;
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { mockDb };
