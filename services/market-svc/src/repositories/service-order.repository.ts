/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * @module @skillancer/market-svc/repositories/service-order
 * Service Order data access layer
 */

import type {
  ServiceOrderStatus,
  ServicePaymentStatus,
  ServiceEscrowStatus,
  DeliveryFile,
  OrderListParams,
} from '../types/service-catalog.types.js';
import {
  type PrismaClient,
  type Prisma,
  PackageTier,
  ServiceMessageType,
} from '@skillancer/database';

/**
 * Service Order Repository
 *
 * Handles database operations for service orders, deliveries, and revisions.
 * Uses Prisma client for all database interactions.
 */
export class ServiceOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ===========================================================================
  // ORDER CRUD OPERATIONS
  // ===========================================================================

  /**
   * Create a new service order
   */
  async create(data: {
    orderNumber: string;
    serviceId: string;
    buyerId: string;
    sellerId: string;
    packageId: string;
    packageName: string;
    packageTier: PackageTier;
    packagePrice: number;
    packageDeliveryDays: number;
    packageRevisionsIncluded: number;
    packageFeatures: unknown;
    packageDeliverables: unknown;
    addOns?: Array<{
      addOnId: string;
      title: string;
      price: number;
      additionalDays: number;
      quantity: number;
    }>;
    subtotal: number;
    addOnsTotal: number;
    discount: number;
    platformFee: number;
    total: number;
    currency: string;
    deliveryDays: number;
    revisionsIncluded: number;
  }) {
    const { addOns, packageId, ...orderData } = data;

    return this.prisma.serviceOrder.create({
      data: {
        orderNumber: orderData.orderNumber,
        service: { connect: { id: orderData.serviceId } },
        buyer: { connect: { id: orderData.buyerId } },
        seller: { connect: { id: orderData.sellerId } },
        status: 'PENDING_REQUIREMENTS',
        subtotal: orderData.subtotal,
        addOnsTotal: orderData.addOnsTotal,
        discount: orderData.discount,
        platformFee: orderData.platformFee,
        total: orderData.total,
        currency: orderData.currency,
        paymentStatus: 'PENDING',
        escrowStatus: 'NOT_FUNDED',
        deliveryDays: orderData.deliveryDays,
        revisionsIncluded: orderData.revisionsIncluded,
        revisionsUsed: 0,
        items: {
          create: {
            packageId,
            packageName: orderData.packageName,
            packageTier: orderData.packageTier,
            price: orderData.packagePrice,
            deliveryDays: orderData.packageDeliveryDays,
            revisionsIncluded: orderData.packageRevisionsIncluded,
            features: orderData.packageFeatures as Prisma.InputJsonValue,
            deliverables: orderData.packageDeliverables as Prisma.InputJsonValue,
            quantity: 1,
          },
        },
        ...(addOns && addOns.length > 0
          ? {
              addOns: {
                create: addOns.map((addOn) => ({
                  addOnId: addOn.addOnId,
                  title: addOn.title,
                  price: addOn.price,
                  additionalDays: addOn.additionalDays,
                  quantity: addOn.quantity,
                })),
              },
            }
          : {}),
      },
      include: this.getOrderIncludes(),
    });
  }

  /**
   * Find an order by ID
   */
  async findById(id: string) {
    return this.prisma.serviceOrder.findUnique({
      where: { id },
      include: this.getOrderIncludes(),
    });
  }

  /**
   * Find an order by order number
   */
  async findByOrderNumber(orderNumber: string) {
    return this.prisma.serviceOrder.findUnique({
      where: { orderNumber },
      include: this.getOrderIncludes(),
    });
  }

  /**
   * Find orders by buyer ID
   */
  async findByBuyerId(buyerId: string, params?: OrderListParams) {
    const { status, page = 1, limit = 20 } = params || {};

    const where: Prisma.ServiceOrderWhereInput = {
      buyerId,
      ...(status && { status: Array.isArray(status) ? { in: status } : status }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where,
        include: this.getOrderListIncludes(),
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    };
  }

  /**
   * Find orders by seller ID
   */
  async findBySellerId(sellerId: string, params?: OrderListParams) {
    const { status, page = 1, limit = 20 } = params || {};

    const where: Prisma.ServiceOrderWhereInput = {
      sellerId,
      ...(status && { status: Array.isArray(status) ? { in: status } : status }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where,
        include: this.getOrderListIncludes(),
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    };
  }

  /**
   * Find orders by service ID
   */
  async findByServiceId(serviceId: string, params?: OrderListParams) {
    const { status, page = 1, limit = 20 } = params || {};

    const where: Prisma.ServiceOrderWhereInput = {
      serviceId,
      ...(status && { status: Array.isArray(status) ? { in: status } : status }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where,
        include: this.getOrderListIncludes(),
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    };
  }

  /**
   * Update order status
   */
  async updateStatus(id: string, status: ServiceOrderStatus) {
    const updates: Prisma.ServiceOrderUpdateInput = { status };

    // Add timestamps based on status changes
    switch (status) {
      case 'COMPLETED':
        updates.completedAt = new Date();
        break;
      case 'CANCELLED':
        updates.cancelledAt = new Date();
        break;
      case 'DELIVERED':
        updates.deliveredAt = new Date();
        break;
    }

    return this.prisma.serviceOrder.update({
      where: { id },
      data: updates,
      include: this.getOrderIncludes(),
    });
  }

  /**
   * Submit requirements for an order
   */
  async submitRequirements(id: string, answers: Record<string, unknown>) {
    const order = await this.findById(id);
    if (!order) return null;

    // Calculate expected delivery date
    const now = new Date();
    const expectedDeliveryAt = new Date(now);
    expectedDeliveryAt.setDate(expectedDeliveryAt.getDate() + order.deliveryDays);

    return this.prisma.serviceOrder.update({
      where: { id },
      data: {
        requirementAnswers: answers as Prisma.InputJsonValue,
        requirementsSubmittedAt: now,
        status: 'PENDING_PAYMENT',
      },
      include: this.getOrderIncludes(),
    });
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(id: string, status: ServicePaymentStatus, paymentIntentId?: string) {
    const updates: Prisma.ServiceOrderUpdateInput = {
      paymentStatus: status,
    };

    if (paymentIntentId) {
      updates.paymentIntentId = paymentIntentId;
    }

    if (status === 'PAID') {
      updates.paidAt = new Date();
      updates.escrowStatus = 'FUNDED';
      updates.status = 'IN_PROGRESS';

      // Calculate expected delivery date
      const order = await this.findById(id);
      if (order) {
        const expectedDeliveryAt = new Date();
        expectedDeliveryAt.setDate(expectedDeliveryAt.getDate() + order.deliveryDays);
        updates.expectedDeliveryAt = expectedDeliveryAt;
      }
    }

    return this.prisma.serviceOrder.update({
      where: { id },
      data: updates,
      include: this.getOrderIncludes(),
    });
  }

  /**
   * Update escrow status
   */
  async updateEscrowStatus(id: string, status: ServiceEscrowStatus) {
    const updates: Prisma.ServiceOrderUpdateInput = { escrowStatus: status };

    if (status === 'RELEASED') {
      updates.escrowReleasedAt = new Date();
    }

    return this.prisma.serviceOrder.update({
      where: { id },
      data: updates,
      include: this.getOrderIncludes(),
    });
  }

  /**
   * Cancel an order
   */
  async cancel(id: string, reason: string, cancelledBy: string) {
    return this.prisma.serviceOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
        cancelledBy,
      },
      include: this.getOrderIncludes(),
    });
  }

  /**
   * Complete an order
   */
  async complete(id: string) {
    return this.prisma.serviceOrder.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        escrowStatus: 'RELEASED',
        escrowReleasedAt: new Date(),
      },
      include: this.getOrderIncludes(),
    });
  }

  /**
   * Set auto-complete date
   */
  async setAutoCompleteDate(id: string, autoCompletesAt: Date) {
    return this.prisma.serviceOrder.update({
      where: { id },
      data: { autoCompletesAt },
    });
  }

  /**
   * Find orders that should auto-complete
   */
  async findOrdersToAutoComplete() {
    return this.prisma.serviceOrder.findMany({
      where: {
        status: 'DELIVERED',
        autoCompletesAt: { lte: new Date() },
      },
      include: this.getOrderIncludes(),
    });
  }

  /**
   * Generate unique order number
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async generateOrderNumber(): Promise<string> {
    const prefix = 'SVC';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  // ===========================================================================
  // DELIVERY OPERATIONS
  // ===========================================================================

  /**
   * Create a delivery
   */
  async createDelivery(orderId: string, data: { message?: string; files: DeliveryFile[] }) {
    // Get the next delivery number
    const lastDelivery = await this.prisma.serviceDelivery.findFirst({
      where: { orderId },
      orderBy: { deliveryNumber: 'desc' },
    });
    const deliveryNumber = (lastDelivery?.deliveryNumber ?? 0) + 1;

    // Create delivery and update order status in transaction
    const [delivery] = await this.prisma.$transaction([
      this.prisma.serviceDelivery.create({
        data: {
          orderId,
          deliveryNumber,
          message: data.message ?? null,
          files: data.files as unknown as Prisma.InputJsonValue,
          status: 'PENDING_REVIEW',
        },
      }),
      this.prisma.serviceOrder.update({
        where: { id: orderId },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          // Auto-complete after 3 days if buyer doesn't respond
          autoCompletesAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    return delivery;
  }

  /**
   * Find deliveries by order ID
   */
  async findDeliveriesByOrderId(orderId: string) {
    return this.prisma.serviceDelivery.findMany({
      where: { orderId },
      orderBy: { deliveryNumber: 'asc' },
    });
  }

  /**
   * Find a delivery by ID
   */
  async findDeliveryById(id: string) {
    return this.prisma.serviceDelivery.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            buyerId: true,
            sellerId: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Accept a delivery
   */
  async acceptDelivery(id: string) {
    const delivery = await this.prisma.serviceDelivery.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
      include: {
        order: true,
      },
    });

    // Complete the order
    await this.complete(delivery.orderId);

    return delivery;
  }

  /**
   * Request revision for a delivery
   */
  async requestRevisionForDelivery(id: string) {
    return this.prisma.serviceDelivery.update({
      where: { id },
      data: {
        status: 'REVISION_REQUESTED',
        revisionRequestedAt: new Date(),
      },
    });
  }

  // ===========================================================================
  // REVISION OPERATIONS
  // ===========================================================================

  /**
   * Create a revision request
   */
  async createRevisionRequest(
    orderId: string,
    deliveryId: string,
    data: { description: string; attachments?: Array<{ name: string; url: string }> }
  ) {
    // Get the next revision number
    const lastRevision = await this.prisma.serviceRevisionRequest.findFirst({
      where: { orderId },
      orderBy: { revisionNumber: 'desc' },
    });
    const revisionNumber = (lastRevision?.revisionNumber ?? 0) + 1;

    // Create revision and update order in transaction
    const [revision] = await this.prisma.$transaction([
      this.prisma.serviceRevisionRequest.create({
        data: {
          orderId,
          deliveryId,
          revisionNumber,
          description: data.description,
          attachments: (data.attachments || []) as unknown as Prisma.InputJsonValue,
        },
      }),
      this.prisma.serviceOrder.update({
        where: { id: orderId },
        data: {
          status: 'REVISION_REQUESTED',
          revisionsUsed: { increment: 1 },
          autoCompletesAt: null, // Clear auto-complete
        },
      }),
    ]);

    return revision;
  }

  /**
   * Find revision requests by order ID
   */
  async findRevisionRequestsByOrderId(orderId: string) {
    return this.prisma.serviceRevisionRequest.findMany({
      where: { orderId },
      orderBy: { revisionNumber: 'asc' },
    });
  }

  /**
   * Respond to a revision request
   */
  async respondToRevisionRequest(id: string, response: string) {
    const revision = await this.prisma.serviceRevisionRequest.update({
      where: { id },
      data: {
        response,
        respondedAt: new Date(),
      },
      include: {
        order: true,
      },
    });

    // Set order back to in-progress
    await this.prisma.serviceOrder.update({
      where: { id: revision.orderId },
      data: { status: 'IN_PROGRESS' },
    });

    return revision;
  }

  // ===========================================================================
  // MESSAGE OPERATIONS
  // ===========================================================================

  /**
   * Create a message
   */
  async createMessage(
    orderId: string,
    senderId: string,
    data: {
      content: string;
      attachments?: unknown;
      messageType?: ServiceMessageType;
    }
  ) {
    return this.prisma.serviceOrderMessage.create({
      data: {
        orderId,
        senderId,
        content: data.content,
        attachments: (data.attachments || []) as Prisma.InputJsonValue,
        messageType: data.messageType ?? 'TEXT',
        isRead: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Find messages by order ID
   */
  async findMessagesByOrderId(orderId: string, limit = 50, before?: string) {
    return this.prisma.serviceOrderMessage.findMany({
      where: {
        orderId,
        ...(before && { createdAt: { lt: new Date(before) } }),
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(orderId: string, userId: string) {
    return this.prisma.serviceOrderMessage.updateMany({
      where: {
        orderId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Get unread message count
   */
  async getUnreadMessageCount(orderId: string, userId: string) {
    return this.prisma.serviceOrderMessage.count({
      where: {
        orderId,
        senderId: { not: userId },
        isRead: false,
      },
    });
  }

  // ===========================================================================
  // STATS
  // ===========================================================================

  /**
   * Get seller stats
   */
  async getSellerStats(sellerId: string) {
    const [totalOrders, activeOrders, completedOrders, pendingEarnings, totalEarnings] =
      await Promise.all([
        this.prisma.serviceOrder.count({ where: { sellerId } }),
        this.prisma.serviceOrder.count({
          where: {
            sellerId,
            status: {
              in: [
                'PENDING_REQUIREMENTS',
                'PENDING_PAYMENT',
                'IN_PROGRESS',
                'DELIVERED',
                'REVISION_REQUESTED',
              ],
            },
          },
        }),
        this.prisma.serviceOrder.count({
          where: { sellerId, status: 'COMPLETED' },
        }),
        this.prisma.serviceOrder.aggregate({
          where: {
            sellerId,
            status: { in: ['IN_PROGRESS', 'DELIVERED', 'REVISION_REQUESTED'] },
            escrowStatus: 'FUNDED',
          },
          _sum: { total: true },
        }),
        this.prisma.serviceOrder.aggregate({
          where: {
            sellerId,
            status: 'COMPLETED',
            escrowStatus: 'RELEASED',
          },
          _sum: { total: true },
        }),
      ]);

    return {
      totalOrders,
      activeOrders,
      completedOrders,
      pendingEarnings: pendingEarnings._sum.total ?? 0,
      totalEarnings: totalEarnings._sum.total ?? 0,
    };
  }

  // ===========================================================================
  // PRIVATE HELPER METHODS
  // ===========================================================================

  private getOrderIncludes() {
    return {
      service: {
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailUrl: true,
        },
      },
      buyer: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      seller: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      items: true,
      orderAddOns: true,
      deliveries: {
        orderBy: { deliveryNumber: 'asc' as const },
      },
      revisionRequests: {
        orderBy: { revisionNumber: 'asc' as const },
      },
    };
  }

  private getOrderListIncludes() {
    return {
      service: {
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailUrl: true,
        },
      },
      buyer: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      seller: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      items: true,
      _count: {
        select: {
          deliveries: true,
          revisionRequests: true,
        },
      },
    };
  }
}
