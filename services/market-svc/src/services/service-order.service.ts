/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Service Order Service
 *
 * Core service for managing service orders:
 * - Create and manage orders
 * - Handle payments and escrow
 * - Manage deliveries and revisions
 * - Order lifecycle management
 */

import { ServiceCatalogError, ServiceCatalogErrorCode } from '../errors/service-catalog.errors.js';
import { ServiceOrderRepository } from '../repositories/service-order.repository.js';
import { ServiceRepository } from '../repositories/service.repository.js';

import type {
  CreateOrderInput,
  SubmitRequirementsInput,
  SubmitDeliveryInput,
  RequestRevisionInput,
  CancelOrderInput,
  SendMessageInput,
  OrderListParams,
} from '../types/service-catalog.types.js';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Constants
const PLATFORM_FEE_PERCENT = 10;
const _AUTO_COMPLETE_DAYS = 3; // Used for auto-complete scheduling

export class ServiceOrderService {
  private readonly orderRepository: ServiceOrderRepository;
  private readonly serviceRepository: ServiceRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.orderRepository = new ServiceOrderRepository(prisma);
    this.serviceRepository = new ServiceRepository(prisma);
  }

  // ===========================================================================
  // ORDER CREATION
  // ===========================================================================

  /**
   * Create a new service order
   */
  async createOrder(buyerId: string, input: CreateOrderInput) {
    // Get service
    const service = await this.serviceRepository.findById(input.serviceId);
    if (!service) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SERVICE_NOT_FOUND);
    }

    if (service.status !== 'ACTIVE' || !service.isActive) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SERVICE_NOT_ACTIVE);
    }

    // Cannot order own service
    if (service.freelancerId === buyerId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.CANNOT_ORDER_OWN_SERVICE);
    }

    // Get package
    const pkg = await this.serviceRepository.findPackageById(input.packageId);
    if (!pkg || pkg.serviceId !== input.serviceId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.PACKAGE_NOT_FOUND);
    }

    if (!pkg.isActive) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.PACKAGE_NOT_ACTIVE);
    }

    // Calculate pricing - convert Decimals to numbers for arithmetic
    const subtotal = Number(pkg.price);
    let addOnsTotal = 0;
    let totalDeliveryDays = Number(pkg.deliveryDays);
    const addOnDetails: Array<{
      addOnId: string;
      title: string;
      price: number;
      additionalDays: number;
      quantity: number;
    }> = [];

    // Process add-ons
    if (input.addOnIds && input.addOnIds.length > 0) {
      for (const addOnItem of input.addOnIds) {
        const addOn = await this.serviceRepository.findAddOnById(addOnItem.addOnId);
        if (!addOn || addOn.serviceId !== input.serviceId) {
          throw new ServiceCatalogError(ServiceCatalogErrorCode.ADD_ON_NOT_FOUND);
        }

        if (!addOn.isActive) {
          throw new ServiceCatalogError(ServiceCatalogErrorCode.ADD_ON_NOT_ACTIVE);
        }

        // Validate quantity
        const quantity = addOnItem.quantity || 1;
        if (!addOn.allowQuantity && quantity > 1) {
          throw new ServiceCatalogError(
            ServiceCatalogErrorCode.INVALID_ADD_ON_QUANTITY,
            `Add-on "${addOn.title}" does not allow multiple quantities`
          );
        }

        if (addOn.maxQuantity && quantity > addOn.maxQuantity) {
          throw new ServiceCatalogError(
            ServiceCatalogErrorCode.INVALID_ADD_ON_QUANTITY,
            `Add-on "${addOn.title}" has a maximum quantity of ${addOn.maxQuantity}`
          );
        }

        const addOnPrice = Number(addOn.price) * quantity;
        addOnsTotal += addOnPrice;
        totalDeliveryDays += Number(addOn.additionalDays) * quantity;

        addOnDetails.push({
          addOnId: addOn.id,
          title: addOn.title,
          price: addOn.price,
          additionalDays: addOn.additionalDays,
          quantity,
        });
      }
    }

    // Calculate fees and total
    const discount = 0; // TODO: Handle coupons
    const platformFee = Math.round(
      (subtotal + addOnsTotal - discount) * (PLATFORM_FEE_PERCENT / 100)
    );
    const total = subtotal + addOnsTotal - discount;

    // Generate order number
    const orderNumber = await this.orderRepository.generateOrderNumber();

    // Create order
    const order = await this.orderRepository.create({
      orderNumber,
      serviceId: input.serviceId,
      buyerId,
      sellerId: service.freelancerId,
      packageId: input.packageId,
      packageName: pkg.name,
      packageTier: pkg.tier,
      packagePrice: pkg.price,
      packageDeliveryDays: pkg.deliveryDays,
      packageRevisionsIncluded: pkg.revisionsIncluded,
      packageFeatures: pkg.features,
      packageDeliverables: pkg.deliverables,
      addOns: addOnDetails,
      subtotal,
      addOnsTotal,
      discount,
      platformFee,
      total,
      currency: service.currency,
      deliveryDays: totalDeliveryDays,
      revisionsIncluded: pkg.revisionsIncluded,
    });

    this.logger.info({
      msg: 'Service order created',
      orderId: order.id,
      orderNumber,
      buyerId,
      sellerId: service.freelancerId,
      total,
    });

    return order;
  }

  // ===========================================================================
  // ORDER LIFECYCLE
  // ===========================================================================

  /**
   * Get an order by ID
   */
  async getOrder(orderId: string, userId: string) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ORDER_NOT_FOUND);
    }

    // Check if user is participant
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_ORDER_PARTICIPANT);
    }

    return order;
  }

  /**
   * Get an order by order number
   */
  async getOrderByNumber(orderNumber: string, userId: string) {
    const order = await this.orderRepository.findByOrderNumber(orderNumber);

    if (!order) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ORDER_NOT_FOUND);
    }

    // Check if user is participant
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_ORDER_PARTICIPANT);
    }

    return order;
  }

  /**
   * Get orders for a buyer
   */
  async getBuyerOrders(buyerId: string, params?: OrderListParams) {
    return this.orderRepository.findByBuyerId(buyerId, params);
  }

  /**
   * Get orders for a seller
   */
  async getSellerOrders(sellerId: string, params?: OrderListParams) {
    return this.orderRepository.findBySellerId(sellerId, params);
  }

  /**
   * Submit order requirements
   */
  async submitRequirements(orderId: string, userId: string, input: SubmitRequirementsInput) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ORDER_NOT_FOUND);
    }

    if (order.buyerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_ORDER_BUYER);
    }

    if (order.status !== 'PENDING_REQUIREMENTS') {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.REQUIREMENTS_ALREADY_SUBMITTED,
        'Requirements have already been submitted'
      );
    }

    const updatedOrder = await this.orderRepository.submitRequirements(orderId, input.answers);

    this.logger.info({
      msg: 'Order requirements submitted',
      orderId,
      buyerId: userId,
    });

    // TODO: Notify seller

    return updatedOrder;
  }

  /**
   * Process payment for an order
   */
  async processPayment(orderId: string, userId: string, paymentIntentId: string) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ORDER_NOT_FOUND);
    }

    if (order.buyerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_ORDER_BUYER);
    }

    if (order.paymentStatus === 'PAID') {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ORDER_ALREADY_PAID);
    }

    if (order.status !== 'PENDING_PAYMENT') {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.REQUIREMENTS_NOT_SUBMITTED,
        'Please submit requirements first'
      );
    }

    // TODO: Verify payment with Stripe
    // For now, we'll assume payment is successful

    const updatedOrder = await this.orderRepository.updatePaymentStatus(
      orderId,
      'PAID',
      paymentIntentId
    );

    this.logger.info({
      msg: 'Order payment processed',
      orderId,
      buyerId: userId,
      paymentIntentId,
    });

    // TODO: Notify seller that order is now active

    return updatedOrder;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, userId: string, input: CancelOrderInput) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ORDER_NOT_FOUND);
    }

    // Check if user is participant
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_ORDER_PARTICIPANT);
    }

    // Check if order can be cancelled
    if (['COMPLETED', 'CANCELLED', 'DISPUTED'].includes(order.status)) {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.INVALID_ORDER_STATUS,
        'This order cannot be cancelled'
      );
    }

    // Determine refund policy based on status
    const needsRefund = order.paymentStatus === 'PAID' && order.escrowStatus === 'FUNDED';

    const cancelledOrder = await this.orderRepository.cancel(orderId, input.reason, userId);

    if (needsRefund) {
      // TODO: Process refund via billing service
      await this.orderRepository.updateEscrowStatus(orderId, 'REFUNDED');
      await this.orderRepository.updatePaymentStatus(orderId, 'REFUNDED');
    }

    this.logger.info({
      msg: 'Order cancelled',
      orderId,
      cancelledBy: userId,
      reason: input.reason,
      needsRefund,
    });

    // TODO: Notify other party

    return cancelledOrder;
  }

  // ===========================================================================
  // DELIVERY MANAGEMENT
  // ===========================================================================

  /**
   * Submit a delivery
   */
  async submitDelivery(orderId: string, userId: string, input: SubmitDeliveryInput) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ORDER_NOT_FOUND);
    }

    if (order.sellerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_ORDER_SELLER);
    }

    // Check if order is in deliverable status
    if (!['IN_PROGRESS', 'REVISION_REQUESTED'].includes(order.status)) {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.CANNOT_DELIVER_YET,
        'Order is not in a deliverable status'
      );
    }

    const delivery = await this.orderRepository.createDelivery(orderId, {
      message: input.message,
      files: input.files,
    });

    this.logger.info({
      msg: 'Delivery submitted',
      orderId,
      deliveryId: delivery.id,
      deliveryNumber: delivery.deliveryNumber,
      sellerId: userId,
    });

    // TODO: Notify buyer

    return delivery;
  }

  /**
   * Accept a delivery
   */
  async acceptDelivery(orderId: string, userId: string) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ORDER_NOT_FOUND);
    }

    if (order.buyerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_ORDER_BUYER);
    }

    if (order.status !== 'DELIVERED') {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.ORDER_NOT_DELIVERED,
        'No pending delivery to accept'
      );
    }

    // Get the latest delivery
    const deliveries = await this.orderRepository.findDeliveriesByOrderId(orderId);
    const latestDelivery = deliveries[deliveries.length - 1];

    if (!latestDelivery || latestDelivery.status !== 'PENDING_REVIEW') {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.DELIVERY_NOT_FOUND);
    }

    const acceptedDelivery = await this.orderRepository.acceptDelivery(latestDelivery.id);

    // Update service stats
    await this.serviceRepository.updateStatsAfterOrder(order.serviceId);

    this.logger.info({
      msg: 'Delivery accepted, order completed',
      orderId,
      deliveryId: latestDelivery.id,
      buyerId: userId,
    });

    // TODO: Notify seller of completion
    // TODO: Release escrow

    return acceptedDelivery;
  }

  /**
   * Request a revision
   */
  async requestRevision(orderId: string, userId: string, input: RequestRevisionInput) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ORDER_NOT_FOUND);
    }

    if (order.buyerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_ORDER_BUYER);
    }

    if (order.status !== 'DELIVERED') {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.ORDER_NOT_DELIVERED,
        'Cannot request revision - no pending delivery'
      );
    }

    // Check revision limit
    if (order.revisionsUsed >= order.revisionsIncluded) {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.NO_REVISIONS_LEFT,
        `You have used all ${order.revisionsIncluded} included revisions`
      );
    }

    // Get the latest delivery and mark it for revision
    const deliveries = await this.orderRepository.findDeliveriesByOrderId(orderId);
    const latestDelivery = deliveries[deliveries.length - 1];

    if (latestDelivery) {
      await this.orderRepository.requestRevisionForDelivery(latestDelivery.id);
    }

    // Create revision request
    const revision = await this.orderRepository.createRevisionRequest(orderId, {
      description: input.description,
      attachments: input.attachments,
    });

    this.logger.info({
      msg: 'Revision requested',
      orderId,
      revisionId: revision.id,
      revisionNumber: revision.revisionNumber,
      revisionsUsed: order.revisionsUsed + 1,
      revisionsIncluded: order.revisionsIncluded,
      buyerId: userId,
    });

    // TODO: Notify seller

    return revision;
  }

  /**
   * Get order deliveries
   */
  async getOrderDeliveries(orderId: string, userId: string) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ORDER_NOT_FOUND);
    }

    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_ORDER_PARTICIPANT);
    }

    return this.orderRepository.findDeliveriesByOrderId(orderId);
  }

  /**
   * Get order revision requests
   */
  async getOrderRevisions(orderId: string, userId: string) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ORDER_NOT_FOUND);
    }

    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_ORDER_PARTICIPANT);
    }

    return this.orderRepository.findRevisionRequestsByOrderId(orderId);
  }

  // ===========================================================================
  // MESSAGING
  // ===========================================================================

  /**
   * Send a message in an order
   */
  async sendMessage(orderId: string, userId: string, input: SendMessageInput) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ORDER_NOT_FOUND);
    }

    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_ORDER_PARTICIPANT);
    }

    const message = await this.orderRepository.createMessage(orderId, userId, {
      content: input.content,
      attachments: input.attachments,
      messageType: input.messageType,
    });

    this.logger.info({
      msg: 'Order message sent',
      orderId,
      messageId: message.id,
      senderId: userId,
    });

    // TODO: Notify recipient

    return message;
  }

  /**
   * Get order messages
   */
  async getOrderMessages(orderId: string, userId: string, limit = 50, before?: string) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ORDER_NOT_FOUND);
    }

    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_ORDER_PARTICIPANT);
    }

    // Mark messages as read
    await this.orderRepository.markMessagesAsRead(orderId, userId);

    return this.orderRepository.findMessagesByOrderId(orderId, limit, before);
  }

  /**
   * Get unread message count for an order
   */
  async getUnreadCount(orderId: string, userId: string) {
    return this.orderRepository.getUnreadMessageCount(orderId, userId);
  }

  // ===========================================================================
  // STATS
  // ===========================================================================

  /**
   * Get seller order stats
   */
  async getSellerStats(sellerId: string) {
    const [orderStats, services] = await Promise.all([
      this.orderRepository.getSellerStats(sellerId),
      this.serviceRepository.findByFreelancerId(sellerId),
    ]);

    return {
      ...orderStats,
      totalServices: services.total,
      activeServices: services.services.filter((s) => s.status === 'ACTIVE').length,
    };
  }

  // ===========================================================================
  // BACKGROUND JOBS
  // ===========================================================================

  /**
   * Auto-complete orders that have been delivered and not responded to
   */
  async autoCompleteOrders() {
    const ordersToComplete = await this.orderRepository.findOrdersToAutoComplete();

    for (const order of ordersToComplete) {
      try {
        await this.orderRepository.complete(order.id);

        // Update service stats
        await this.serviceRepository.updateStatsAfterOrder(order.serviceId);

        this.logger.info({
          msg: 'Order auto-completed',
          orderId: order.id,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
        });

        // TODO: Notify both parties
        // TODO: Release escrow
      } catch (error) {
        this.logger.error({
          msg: 'Failed to auto-complete order',
          orderId: order.id,
          error,
        });
      }
    }

    return ordersToComplete.length;
  }
}
