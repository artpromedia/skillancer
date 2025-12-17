/**
 * @module @skillancer/market-svc/services/__tests__/service-catalog
 * Unit tests for the service catalog service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('@skillancer/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock ServiceRepository
const mockServiceRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  findByFreelancerId: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  hardDelete: vi.fn(),
  updateStatus: vi.fn(),
  incrementViewCount: vi.fn(),
  updateStatsAfterOrder: vi.fn(),
  createPackage: vi.fn(),
  findPackageById: vi.fn(),
  findPackagesByServiceId: vi.fn(),
  updatePackage: vi.fn(),
  deletePackage: vi.fn(),
  createAddOn: vi.fn(),
  findAddOnById: vi.fn(),
  findAddOnsByServiceId: vi.fn(),
  updateAddOn: vi.fn(),
  deleteAddOn: vi.fn(),
  search: vi.fn(),
  getFeatured: vi.fn(),
  getTrending: vi.fn(),
  getByCategory: vi.fn(),
  slugExists: vi.fn(),
};

vi.mock('../../repositories/service.repository.js', () => ({
  ServiceRepository: vi.fn().mockImplementation(() => mockServiceRepository),
}));

// Create mock instances
const mockPrisma = {
  service: {
    findFirst: vi.fn(),
    count: vi.fn(),
  },
} as any;

const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
} as any;

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as any;

import { ServiceCatalogService } from '../service-catalog.service.js';

describe('ServiceCatalogService', () => {
  let service: ServiceCatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    service = new ServiceCatalogService(mockPrisma, mockRedis, mockLogger);
  });

  describe('createService', () => {
    const validInput = {
      title: 'Professional Web Development',
      description: 'I will build a modern, responsive website for your business.',
      shortDescription: 'Modern website development',
      category: 'DEVELOPMENT' as const,
      basePrice: 500,
      deliveryDays: 7,
      deliverables: [{ title: 'Complete website', description: 'Fully functional website' }],
    };

    it('should create a service successfully', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(null);
      const createdService = {
        id: 'service-123',
        slug: 'professional-web-development',
        status: 'DRAFT',
        freelancerId: 'freelancer-123',
        ...validInput,
        packages: [],
        addOns: [],
        skills: [],
      };
      mockServiceRepository.create.mockResolvedValue(createdService);

      const result = await service.createService('freelancer-123', validInput);

      expect(result.id).toBe('service-123');
      expect(result.status).toBe('DRAFT');
      expect(mockServiceRepository.create).toHaveBeenCalled();
    });

    it('should generate unique slug when duplicate exists', async () => {
      mockPrisma.service.findFirst
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValue(null);

      const createdService = {
        id: 'service-123',
        slug: 'professional-web-development-2',
        status: 'DRAFT',
        freelancerId: 'freelancer-123',
        ...validInput,
        packages: [],
        addOns: [],
        skills: [],
      };
      mockServiceRepository.create.mockResolvedValue(createdService);

      await service.createService('freelancer-123', validInput);

      expect(mockServiceRepository.create).toHaveBeenCalled();
    });
  });

  describe('getService', () => {
    it('should return service when found', async () => {
      const mockService = {
        id: 'service-123',
        title: 'Test Service',
        status: 'ACTIVE',
        isActive: true,
      };
      mockServiceRepository.findById.mockResolvedValue(mockService);

      const result = await service.getService('service-123');

      expect(result).toEqual(mockService);
      expect(mockServiceRepository.findById).toHaveBeenCalledWith('service-123');
    });

    it('should throw error when service not found', async () => {
      mockServiceRepository.findById.mockResolvedValue(null);

      await expect(service.getService('non-existent')).rejects.toThrow();
    });

    it('should use cache when available', async () => {
      const mockService = { id: 'service-123', title: 'Test Service' };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockService));

      const result = await service.getService('service-123');

      expect(result).toEqual(mockService);
      expect(mockServiceRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('getServiceBySlug', () => {
    it('should return service when found by slug', async () => {
      const mockService = {
        id: 'service-123',
        slug: 'test-service',
        title: 'Test Service',
        status: 'ACTIVE',
        isActive: true,
      };
      mockServiceRepository.findBySlug.mockResolvedValue(mockService);
      mockServiceRepository.incrementViewCount.mockResolvedValue(undefined);

      const result = await service.getServiceBySlug('test-service');

      expect(result).toEqual(mockService);
      expect(mockServiceRepository.findBySlug).toHaveBeenCalledWith('test-service');
    });
  });

  describe('updateService', () => {
    it('should update service successfully when owner', async () => {
      const mockExistingService = {
        id: 'service-123',
        freelancerId: 'freelancer-123',
        title: 'Old Title',
        status: 'DRAFT',
      };
      const updatedService = { ...mockExistingService, title: 'New Title' };
      mockServiceRepository.findById.mockResolvedValue(mockExistingService);
      mockServiceRepository.update.mockResolvedValue(updatedService);

      const result = await service.updateService('service-123', 'freelancer-123', {
        title: 'New Title',
      });

      expect(result.title).toBe('New Title');
    });

    it('should throw error when not owner', async () => {
      const mockExistingService = {
        id: 'service-123',
        freelancerId: 'freelancer-123',
        title: 'Test Service',
      };
      mockServiceRepository.findById.mockResolvedValue(mockExistingService);

      await expect(
        service.updateService('service-123', 'other-user', { title: 'New Title' })
      ).rejects.toThrow();
    });

    it('should throw error when service not found', async () => {
      mockServiceRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateService('non-existent', 'freelancer-123', { title: 'New Title' })
      ).rejects.toThrow();
    });
  });

  describe('submitForReview', () => {
    it('should submit a draft service for review', async () => {
      const mockService = {
        id: 'service-123',
        freelancerId: 'freelancer-123',
        status: 'DRAFT',
        title: 'Professional Web Development Service',
        description:
          'I will build a modern, responsive website for your business. This includes custom design, development, and deployment.',
        shortDescription: 'Modern website development for your business',
        basePrice: 500,
        deliveryDays: 7,
        packages: [{ id: 'pkg-1', isActive: true, tier: 'BASIC' }],
      };
      const submittedService = { ...mockService, status: 'PENDING_REVIEW' };
      mockServiceRepository.findById.mockResolvedValue(mockService);
      mockServiceRepository.updateStatus.mockResolvedValue(submittedService);

      const result = await service.submitForReview('service-123', 'freelancer-123');

      expect(result.status).toBe('PENDING_REVIEW');
    });

    it('should throw error when service has no packages', async () => {
      const mockService = {
        id: 'service-123',
        freelancerId: 'freelancer-123',
        status: 'DRAFT',
        packages: [],
      };
      mockServiceRepository.findById.mockResolvedValue(mockService);

      await expect(service.submitForReview('service-123', 'freelancer-123')).rejects.toThrow();
    });

    it('should throw error when not owner', async () => {
      const mockService = {
        id: 'service-123',
        freelancerId: 'freelancer-123',
        status: 'DRAFT',
        packages: [{ id: 'pkg-1' }],
      };
      mockServiceRepository.findById.mockResolvedValue(mockService);

      await expect(service.submitForReview('service-123', 'other-user')).rejects.toThrow();
    });
  });

  describe('publishService', () => {
    it('should publish a pending service (admin)', async () => {
      const mockService = {
        id: 'service-123',
        freelancerId: 'freelancer-123',
        status: 'PENDING_REVIEW',
        packages: [{ id: 'pkg-1', isActive: true }],
      };
      const publishedService = { ...mockService, status: 'ACTIVE', publishedAt: new Date() };
      mockServiceRepository.findById.mockResolvedValue(mockService);
      mockServiceRepository.updateStatus.mockResolvedValue(publishedService);

      const result = await service.publishService('service-123', 'admin-123');

      expect(result.status).toBe('ACTIVE');
    });

    it('should throw error when service is not pending review', async () => {
      const mockService = {
        id: 'service-123',
        freelancerId: 'freelancer-123',
        status: 'DRAFT',
        packages: [{ id: 'pkg-1' }],
      };
      mockServiceRepository.findById.mockResolvedValue(mockService);

      await expect(service.publishService('service-123', 'admin-123')).rejects.toThrow();
    });
  });

  describe('searchServices', () => {
    it('should return paginated results', async () => {
      const mockResults = {
        services: [
          { id: 'service-1', title: 'Service 1' },
          { id: 'service-2', title: 'Service 2' },
        ],
        total: 10,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
      };
      mockServiceRepository.search.mockResolvedValue(mockResults);

      const result = await service.searchServices({ query: 'web' });

      expect(result.services).toHaveLength(2);
      expect(result.total).toBe(10);
    });

    it('should filter by category', async () => {
      mockServiceRepository.search.mockResolvedValue({
        services: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasMore: false,
      });

      await service.searchServices({ category: 'DEVELOPMENT' });

      expect(mockServiceRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'DEVELOPMENT' })
      );
    });
  });

  describe('addPackage', () => {
    it('should add package for owned service', async () => {
      const mockService = { id: 'service-123', freelancerId: 'freelancer-123' };
      const packageInput = {
        name: 'Basic Package',
        tier: 'BASIC' as const,
        price: 100,
        deliveryDays: 3,
        revisionsIncluded: 1,
        features: [{ feature: 'Logo design', included: true }],
        deliverables: [{ title: 'Logo', quantity: 1 }],
      };
      const createdPackage = { id: 'pkg-123', ...packageInput, serviceId: 'service-123' };
      mockServiceRepository.findById.mockResolvedValue(mockService);
      mockServiceRepository.findPackagesByServiceId.mockResolvedValue([]);
      mockServiceRepository.createPackage.mockResolvedValue(createdPackage);

      const result = await service.addPackage('service-123', 'freelancer-123', packageInput);

      expect(result.id).toBe('pkg-123');
    });

    it('should throw error when not owner', async () => {
      const mockService = { id: 'service-123', freelancerId: 'freelancer-123' };
      mockServiceRepository.findById.mockResolvedValue(mockService);

      await expect(
        service.addPackage('service-123', 'other-user', {
          name: 'Basic',
          tier: 'BASIC',
          price: 100,
          deliveryDays: 3,
          revisionsIncluded: 1,
          features: [],
          deliverables: [],
        })
      ).rejects.toThrow();
    });
  });

  describe('addAddOn', () => {
    it('should add add-on for owned service', async () => {
      const mockService = { id: 'service-123', freelancerId: 'freelancer-123' };
      const addOnInput = { title: 'Express Delivery', price: 50, additionalDays: -2 };
      const createdAddOn = { id: 'addon-123', ...addOnInput, serviceId: 'service-123' };
      mockServiceRepository.findById.mockResolvedValue(mockService);
      mockServiceRepository.createAddOn.mockResolvedValue(createdAddOn);

      const result = await service.addAddOn('service-123', 'freelancer-123', addOnInput);

      expect(result.id).toBe('addon-123');
    });
  });

  describe('getFeaturedServices', () => {
    it('should return featured services', async () => {
      const mockServices = [
        { id: 'service-1', isFeatured: true },
        { id: 'service-2', isFeatured: true },
      ];
      mockServiceRepository.getFeatured.mockResolvedValue(mockServices);

      const result = await service.getFeaturedServices(10);

      expect(result).toHaveLength(2);
    });
  });

  describe('getTrendingServices', () => {
    it('should return trending services', async () => {
      const mockServices = [
        { id: 'service-1', orderCount: 100 },
        { id: 'service-2', orderCount: 50 },
      ];
      mockServiceRepository.getTrending.mockResolvedValue(mockServices);

      const result = await service.getTrendingServices(10);

      expect(result).toHaveLength(2);
    });
  });

  describe('pauseService', () => {
    it('should pause an active service', async () => {
      const mockService = { id: 'service-123', freelancerId: 'freelancer-123', status: 'ACTIVE' };
      const pausedService = { ...mockService, status: 'PAUSED' };
      mockServiceRepository.findById.mockResolvedValue(mockService);
      mockServiceRepository.updateStatus.mockResolvedValue(pausedService);

      const result = await service.pauseService('service-123', 'freelancer-123');

      expect(result.status).toBe('PAUSED');
    });
  });

  describe('archiveService', () => {
    it('should archive a service', async () => {
      const mockService = { id: 'service-123', freelancerId: 'freelancer-123', status: 'ACTIVE' };
      const archivedService = { ...mockService, status: 'ARCHIVED' };
      mockServiceRepository.findById.mockResolvedValue(mockService);
      mockServiceRepository.delete.mockResolvedValue(archivedService);

      await service.archiveService('service-123', 'freelancer-123');

      expect(mockServiceRepository.delete).toHaveBeenCalledWith('service-123');
    });
  });
});
