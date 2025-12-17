/**
 * @module @skillancer/market-svc/services/__tests__/service-order
 * Unit tests for the service order service
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

// Mock ServiceOrderRepository
const mockServiceOrderRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByOrderNumber: vi.fn(),
  findByBuyerId: vi.fn(),
  findBySellerId: vi.fn(),
  findByServiceId: vi.fn(),
  updateStatus: vi.fn(),
  submitRequirements: vi.fn(),
  updatePaymentStatus: vi.fn(),
  updateEscrowStatus: vi.fn(),
  cancel: vi.fn(),
  complete: vi.fn(),
  setAutoCompleteDate: vi.fn(),
  findOrdersToAutoComplete: vi.fn(),
  generateOrderNumber: vi.fn(),
  createDelivery: vi.fn(),
  findDeliveriesByOrderId: vi.fn(),
  findDeliveryById: vi.fn(),
  acceptDelivery: vi.fn(),
  requestRevisionForDelivery: vi.fn(),
  createRevisionRequest: vi.fn(),
  findRevisionRequestsByOrderId: vi.fn(),
  respondToRevisionRequest: vi.fn(),
  createMessage: vi.fn(),
  findMessagesByOrderId: vi.fn(),
  markMessagesAsRead: vi.fn(),
  getUnreadMessageCount: vi.fn(),
  getSellerStats: vi.fn(),
};

vi.mock('../../repositories/service-order.repository.js', () => ({
  ServiceOrderRepository: vi.fn().mockImplementation(() => mockServiceOrderRepository),
}));

// Mock ServiceRepository
const mockServiceRepository = {
  findById: vi.fn(),
  findPackageById: vi.fn(),
  findAddOnById: vi.fn(),
  updateStatsAfterOrder: vi.fn(),
};

vi.mock('../../repositories/service.repository.js', () => ({
  ServiceRepository: vi.fn().mockImplementation(() => mockServiceRepository),
}));

// Create mock instances
const mockPrisma = {} as any;

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

import { ServiceOrderService } from '../service-order.service.js';

describe('ServiceOrderService', () => {
  let service: ServiceOrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    service = new ServiceOrderService(mockPrisma, mockRedis, mockLogger);
  });

  describe('createOrder', () => {
    const mockService = {
      id: 'service-123',
      freelancerId: 'seller-123',
      title: 'Web Development',
      status: 'ACTIVE',
      isActive: true,
      basePrice: 500,
      deliveryDays: 7,
      revisionsIncluded: 2,
    };

    const mockPackage = {
      id: 'pkg-123',
      serviceId: 'service-123',
      name: 'Standard',
      tier: 'STANDARD',
      price: 500,
      deliveryDays: 7,
      revisionsIncluded: 2,
      features: [{ feature: 'Responsive design', included: true }],
      deliverables: [{ title: 'Website', quantity: 1 }],
      isActive: true,
    };

    const validInput = {
      serviceId: 'service-123',
      packageId: 'pkg-123',
    };

    it('should create an order successfully', async () => {
      mockServiceRepository.findById.mockResolvedValue(mockService);
      mockServiceRepository.findPackageById.mockResolvedValue(mockPackage);
      mockServiceOrderRepository.generateOrderNumber.mockResolvedValue('SVC-ABC123-XYZ');
      const createdOrder = {
        id: 'order-123',
        orderNumber: 'SVC-ABC123-XYZ',
        serviceId: 'service-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        status: 'PENDING_REQUIREMENTS',
        subtotal: 500,
        addOnsTotal: 0,
        platformFee: 50,
        total: 550,
      };
      mockServiceOrderRepository.create.mockResolvedValue(createdOrder);

      const result = await service.createOrder('buyer-123', validInput);

      expect(result.orderNumber).toBe('SVC-ABC123-XYZ');
      expect(result.status).toBe('PENDING_REQUIREMENTS');
      expect(mockServiceOrderRepository.create).toHaveBeenCalled();
    });

    it('should throw error when service not found', async () => {
      mockServiceRepository.findById.mockResolvedValue(null);

      await expect(service.createOrder('buyer-123', validInput)).rejects.toThrow();
    });

    it('should throw error when service is not active', async () => {
      mockServiceRepository.findById.mockResolvedValue({ ...mockService, isActive: false });

      await expect(service.createOrder('buyer-123', validInput)).rejects.toThrow();
    });

    it('should throw error when package not found', async () => {
      mockServiceRepository.findById.mockResolvedValue(mockService);
      mockServiceRepository.findPackageById.mockResolvedValue(null);

      await expect(service.createOrder('buyer-123', validInput)).rejects.toThrow();
    });

    it('should throw error when buyer is the seller', async () => {
      mockServiceRepository.findById.mockResolvedValue(mockService);
      mockServiceRepository.findPackageById.mockResolvedValue(mockPackage);

      await expect(service.createOrder('seller-123', validInput)).rejects.toThrow();
    });

    it('should include add-ons in order total', async () => {
      const mockAddOn = {
        id: 'addon-123',
        serviceId: 'service-123',
        title: 'Express Delivery',
        price: 50,
        additionalDays: -2,
        allowQuantity: false,
        isActive: true,
      };
      mockServiceRepository.findById.mockResolvedValue(mockService);
      mockServiceRepository.findPackageById.mockResolvedValue(mockPackage);
      mockServiceRepository.findAddOnById.mockResolvedValue(mockAddOn);
      mockServiceOrderRepository.generateOrderNumber.mockResolvedValue('SVC-ABC123-XYZ');
      const createdOrder = {
        id: 'order-123',
        orderNumber: 'SVC-ABC123-XYZ',
        subtotal: 500,
        addOnsTotal: 50,
        platformFee: 55,
        total: 605,
      };
      mockServiceOrderRepository.create.mockResolvedValue(createdOrder);

      const result = await service.createOrder('buyer-123', {
        ...validInput,
        addOnIds: [{ addOnId: 'addon-123', quantity: 1 }],
      });

      expect(result.addOnsTotal).toBe(50);
    });
  });

  describe('getOrder', () => {
    it('should return order when found', async () => {
      const mockOrder = {
        id: 'order-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
      };
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);

      const result = await service.getOrder('order-123', 'buyer-123');

      expect(result).toEqual(mockOrder);
    });

    it('should throw error when user not authorized', async () => {
      const mockOrder = {
        id: 'order-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
      };
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);

      await expect(service.getOrder('order-123', 'other-user')).rejects.toThrow();
    });

    it('should throw error when order not found', async () => {
      mockServiceOrderRepository.findById.mockResolvedValue(null);

      await expect(service.getOrder('non-existent', 'user-123')).rejects.toThrow();
    });
  });

  describe('submitRequirements', () => {
    it('should submit requirements successfully', async () => {
      const mockOrder = {
        id: 'order-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        status: 'PENDING_REQUIREMENTS',
      };
      const updatedOrder = {
        ...mockOrder,
        requirementAnswers: { question1: 'answer1' },
        requirementsSubmittedAt: new Date(),
        status: 'PENDING_PAYMENT',
      };
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);
      mockServiceOrderRepository.submitRequirements.mockResolvedValue(updatedOrder);

      const result = await service.submitRequirements('order-123', 'buyer-123', {
        answers: { question1: 'answer1' },
      });

      expect(result.status).toBe('PENDING_PAYMENT');
    });

    it('should throw error when not buyer', async () => {
      const mockOrder = {
        id: 'order-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        status: 'PENDING_REQUIREMENTS',
      };
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);

      await expect(
        service.submitRequirements('order-123', 'other-user', { answers: {} })
      ).rejects.toThrow();
    });

    it('should throw error when order not in correct status', async () => {
      const mockOrder = {
        id: 'order-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        status: 'IN_PROGRESS',
      };
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);

      await expect(
        service.submitRequirements('order-123', 'buyer-123', { answers: {} })
      ).rejects.toThrow();
    });
  });

  describe('submitDelivery', () => {
    it('should submit delivery successfully', async () => {
      const mockOrder = {
        id: 'order-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        status: 'IN_PROGRESS',
      };
      const mockDelivery = {
        id: 'delivery-123',
        orderId: 'order-123',
        deliveryNumber: 1,
        message: 'Here is your work',
        files: [{ name: 'file.zip', url: 'https://...', size: 1000, type: 'application/zip' }],
        status: 'PENDING_REVIEW',
      };
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);
      mockServiceOrderRepository.createDelivery.mockResolvedValue(mockDelivery);

      const result = await service.submitDelivery('order-123', 'seller-123', {
        message: 'Here is your work',
        files: [{ name: 'file.zip', url: 'https://...', size: 1000, type: 'application/zip' }],
      });

      expect(result.deliveryNumber).toBe(1);
      expect(result.status).toBe('PENDING_REVIEW');
    });

    it('should throw error when not seller', async () => {
      const mockOrder = {
        id: 'order-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        status: 'IN_PROGRESS',
      };
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);

      await expect(
        service.submitDelivery('order-123', 'other-user', { files: [] })
      ).rejects.toThrow();
    });
  });

  describe('acceptDelivery', () => {
    it('should accept delivery and complete order', async () => {
      const mockOrder = {
        id: 'order-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        serviceId: 'service-123',
        status: 'DELIVERED',
      };
      const mockDelivery = {
        id: 'delivery-123',
        orderId: 'order-123',
        status: 'PENDING_REVIEW',
        order: mockOrder,
      };
      const acceptedDelivery = {
        ...mockDelivery,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      };
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);
      mockServiceOrderRepository.findDeliveriesByOrderId.mockResolvedValue([mockDelivery]);
      mockServiceOrderRepository.acceptDelivery.mockResolvedValue(acceptedDelivery);
      mockServiceRepository.updateStatsAfterOrder.mockResolvedValue(undefined);

      const result = await service.acceptDelivery('order-123', 'buyer-123');

      expect(result.status).toBe('ACCEPTED');
      expect(mockServiceRepository.updateStatsAfterOrder).toHaveBeenCalledWith('service-123');
    });
  });

  describe('requestRevision', () => {
    it('should create revision request when revisions available', async () => {
      const mockOrder = {
        id: 'order-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        status: 'DELIVERED',
        revisionsIncluded: 2,
        revisionsUsed: 0,
      };
      const mockDelivery = {
        id: 'delivery-123',
        orderId: 'order-123',
        status: 'PENDING_REVIEW',
      };
      const mockRevision = {
        id: 'revision-123',
        orderId: 'order-123',
        revisionNumber: 1,
        description: 'Please change colors',
      };
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);
      mockServiceOrderRepository.findDeliveriesByOrderId.mockResolvedValue([mockDelivery]);
      mockServiceOrderRepository.requestRevisionForDelivery.mockResolvedValue(mockDelivery);
      mockServiceOrderRepository.createRevisionRequest.mockResolvedValue(mockRevision);

      const result = await service.requestRevision('order-123', 'buyer-123', {
        description: 'Please change colors',
      });

      expect(result.revisionNumber).toBe(1);
    });

    it('should throw error when no revisions left', async () => {
      const mockOrder = {
        id: 'order-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        status: 'DELIVERED',
        revisionsIncluded: 2,
        revisionsUsed: 2,
      };
      const mockDelivery = {
        id: 'delivery-123',
        orderId: 'order-123',
        status: 'PENDING_REVIEW',
        order: mockOrder,
      };
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);
      mockServiceOrderRepository.findDeliveriesByOrderId.mockResolvedValue([mockDelivery]);

      await expect(
        service.requestRevision('order-123', 'buyer-123', { description: 'Change' })
      ).rejects.toThrow();
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order by buyer when pending', async () => {
      const mockOrder = {
        id: 'order-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        status: 'PENDING_REQUIREMENTS',
        paymentStatus: 'PENDING',
      };
      const cancelledOrder = {
        ...mockOrder,
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: 'Changed my mind',
        cancelledBy: 'buyer-123',
      };
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);
      mockServiceOrderRepository.cancel.mockResolvedValue(cancelledOrder);

      const result = await service.cancelOrder('order-123', 'buyer-123', {
        reason: 'Changed my mind',
      });

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error when order already completed', async () => {
      const mockOrder = {
        id: 'order-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        status: 'COMPLETED',
      };
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);

      await expect(
        service.cancelOrder('order-123', 'buyer-123', { reason: 'Cancel' })
      ).rejects.toThrow();
    });
  });

  describe('getBuyerOrders', () => {
    it('should return paginated buyer orders', async () => {
      const mockResult = {
        orders: [{ id: 'order-1' }, { id: 'order-2' }],
        total: 10,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
      };
      mockServiceOrderRepository.findByBuyerId.mockResolvedValue(mockResult);

      const result = await service.getBuyerOrders('buyer-123');

      expect(result.orders).toHaveLength(2);
      expect(result.total).toBe(10);
    });
  });

  describe('getSellerOrders', () => {
    it('should return paginated seller orders', async () => {
      const mockResult = {
        orders: [{ id: 'order-1' }, { id: 'order-2' }],
        total: 5,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
      };
      mockServiceOrderRepository.findBySellerId.mockResolvedValue(mockResult);

      const result = await service.getSellerOrders('seller-123');

      expect(result.orders).toHaveLength(2);
      expect(result.total).toBe(5);
    });
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const mockOrder = {
        id: 'order-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        status: 'IN_PROGRESS',
      };
      const mockMessage = {
        id: 'msg-123',
        orderId: 'order-123',
        senderId: 'buyer-123',
        content: 'Hello',
        messageType: 'TEXT',
      };
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);
      mockServiceOrderRepository.createMessage.mockResolvedValue(mockMessage);

      const result = await service.sendMessage('order-123', 'buyer-123', {
        content: 'Hello',
      });

      expect(result.content).toBe('Hello');
    });

    it('should throw error when user not part of order', async () => {
      const mockOrder = {
        id: 'order-123',
        buyerId: 'buyer-123',
        sellerId: 'seller-123',
        status: 'IN_PROGRESS',
      };
      mockServiceOrderRepository.findById.mockResolvedValue(mockOrder);

      await expect(
        service.sendMessage('order-123', 'other-user', { content: 'Hello' })
      ).rejects.toThrow();
    });
  });
});
