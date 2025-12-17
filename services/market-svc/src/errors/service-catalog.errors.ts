/**
 * @module @skillancer/market-svc/errors/service-catalog
 * Service Catalog system error definitions
 */

export const ServiceCatalogErrorCode = {
  // Service errors
  SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',
  SERVICE_NOT_ACTIVE: 'SERVICE_NOT_ACTIVE',
  SERVICE_ALREADY_PUBLISHED: 'SERVICE_ALREADY_PUBLISHED',
  SERVICE_NOT_DRAFT: 'SERVICE_NOT_DRAFT',
  SERVICE_PENDING_REVIEW: 'SERVICE_PENDING_REVIEW',
  SERVICE_PAUSED: 'SERVICE_PAUSED',
  SERVICE_ARCHIVED: 'SERVICE_ARCHIVED',
  NOT_SERVICE_OWNER: 'NOT_SERVICE_OWNER',
  INVALID_SERVICE_STATUS: 'INVALID_SERVICE_STATUS',
  CANNOT_ORDER_OWN_SERVICE: 'CANNOT_ORDER_OWN_SERVICE',
  SLUG_ALREADY_EXISTS: 'SLUG_ALREADY_EXISTS',

  // Package errors
  PACKAGE_NOT_FOUND: 'PACKAGE_NOT_FOUND',
  PACKAGE_NOT_ACTIVE: 'PACKAGE_NOT_ACTIVE',
  INVALID_PACKAGE_TIER: 'INVALID_PACKAGE_TIER',
  DUPLICATE_PACKAGE_TIER: 'DUPLICATE_PACKAGE_TIER',

  // Add-on errors
  ADD_ON_NOT_FOUND: 'ADD_ON_NOT_FOUND',
  ADD_ON_NOT_ACTIVE: 'ADD_ON_NOT_ACTIVE',
  INVALID_ADD_ON_QUANTITY: 'INVALID_ADD_ON_QUANTITY',

  // Order errors
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_NOT_PENDING: 'ORDER_NOT_PENDING',
  ORDER_ALREADY_PAID: 'ORDER_ALREADY_PAID',
  ORDER_ALREADY_COMPLETED: 'ORDER_ALREADY_COMPLETED',
  ORDER_ALREADY_CANCELLED: 'ORDER_ALREADY_CANCELLED',
  ORDER_IN_PROGRESS: 'ORDER_IN_PROGRESS',
  ORDER_DISPUTED: 'ORDER_DISPUTED',
  NOT_ORDER_BUYER: 'NOT_ORDER_BUYER',
  NOT_ORDER_SELLER: 'NOT_ORDER_SELLER',
  NOT_ORDER_PARTICIPANT: 'NOT_ORDER_PARTICIPANT',
  INVALID_ORDER_STATUS: 'INVALID_ORDER_STATUS',
  REQUIREMENTS_NOT_SUBMITTED: 'REQUIREMENTS_NOT_SUBMITTED',
  REQUIREMENTS_ALREADY_SUBMITTED: 'REQUIREMENTS_ALREADY_SUBMITTED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',

  // Delivery errors
  DELIVERY_NOT_FOUND: 'DELIVERY_NOT_FOUND',
  DELIVERY_ALREADY_ACCEPTED: 'DELIVERY_ALREADY_ACCEPTED',
  DELIVERY_REVISION_REQUESTED: 'DELIVERY_REVISION_REQUESTED',
  CANNOT_DELIVER_YET: 'CANNOT_DELIVER_YET',
  ORDER_NOT_IN_PROGRESS: 'ORDER_NOT_IN_PROGRESS',

  // Revision errors
  REVISION_NOT_FOUND: 'REVISION_NOT_FOUND',
  NO_REVISIONS_LEFT: 'NO_REVISIONS_LEFT',
  REVISION_ALREADY_RESPONDED: 'REVISION_ALREADY_RESPONDED',
  CANNOT_REQUEST_REVISION: 'CANNOT_REQUEST_REVISION',
  ORDER_NOT_DELIVERED: 'ORDER_NOT_DELIVERED',

  // Review errors
  REVIEW_NOT_FOUND: 'REVIEW_NOT_FOUND',
  REVIEW_ALREADY_EXISTS: 'REVIEW_ALREADY_EXISTS',
  CANNOT_REVIEW_INCOMPLETE_ORDER: 'CANNOT_REVIEW_INCOMPLETE_ORDER',
  NOT_REVIEW_OWNER: 'NOT_REVIEW_OWNER',
  SELLER_RESPONSE_ALREADY_EXISTS: 'SELLER_RESPONSE_ALREADY_EXISTS',
  CANNOT_RESPOND_TO_OWN_REVIEW: 'CANNOT_RESPOND_TO_OWN_REVIEW',

  // Message errors
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  CANNOT_MESSAGE_SELF: 'CANNOT_MESSAGE_SELF',
} as const;

export type ServiceCatalogErrorCodeType =
  (typeof ServiceCatalogErrorCode)[keyof typeof ServiceCatalogErrorCode];

const errorMessages: Record<ServiceCatalogErrorCodeType, string> = {
  // Service errors
  SERVICE_NOT_FOUND: 'Service not found',
  SERVICE_NOT_ACTIVE: 'This service is not currently active',
  SERVICE_ALREADY_PUBLISHED: 'Service is already published',
  SERVICE_NOT_DRAFT: 'Service must be in draft status',
  SERVICE_PENDING_REVIEW: 'Service is pending review',
  SERVICE_PAUSED: 'This service is currently paused',
  SERVICE_ARCHIVED: 'This service has been archived',
  NOT_SERVICE_OWNER: 'You are not the owner of this service',
  INVALID_SERVICE_STATUS: 'Invalid service status for this operation',
  CANNOT_ORDER_OWN_SERVICE: 'You cannot order your own service',
  SLUG_ALREADY_EXISTS: 'A service with this slug already exists',

  // Package errors
  PACKAGE_NOT_FOUND: 'Package not found',
  PACKAGE_NOT_ACTIVE: 'This package is not currently active',
  INVALID_PACKAGE_TIER: 'Invalid package tier',
  DUPLICATE_PACKAGE_TIER: 'A package with this tier already exists',

  // Add-on errors
  ADD_ON_NOT_FOUND: 'Add-on not found',
  ADD_ON_NOT_ACTIVE: 'This add-on is not currently active',
  INVALID_ADD_ON_QUANTITY: 'Invalid add-on quantity',

  // Order errors
  ORDER_NOT_FOUND: 'Order not found',
  ORDER_NOT_PENDING: 'Order is not in pending status',
  ORDER_ALREADY_PAID: 'Order has already been paid',
  ORDER_ALREADY_COMPLETED: 'Order has already been completed',
  ORDER_ALREADY_CANCELLED: 'Order has already been cancelled',
  ORDER_IN_PROGRESS: 'Order is currently in progress',
  ORDER_DISPUTED: 'Order is under dispute',
  NOT_ORDER_BUYER: 'You are not the buyer of this order',
  NOT_ORDER_SELLER: 'You are not the seller of this order',
  NOT_ORDER_PARTICIPANT: 'You are not a participant in this order',
  INVALID_ORDER_STATUS: 'Invalid order status for this operation',
  REQUIREMENTS_NOT_SUBMITTED: 'Order requirements have not been submitted',
  REQUIREMENTS_ALREADY_SUBMITTED: 'Order requirements have already been submitted',
  PAYMENT_REQUIRED: 'Payment is required to proceed',
  PAYMENT_FAILED: 'Payment processing failed',

  // Delivery errors
  DELIVERY_NOT_FOUND: 'Delivery not found',
  DELIVERY_ALREADY_ACCEPTED: 'Delivery has already been accepted',
  DELIVERY_REVISION_REQUESTED: 'A revision has been requested for this delivery',
  CANNOT_DELIVER_YET: 'Cannot submit delivery at this time',
  ORDER_NOT_IN_PROGRESS: 'Order is not in progress',

  // Revision errors
  REVISION_NOT_FOUND: 'Revision request not found',
  NO_REVISIONS_LEFT: 'No revisions remaining for this order',
  REVISION_ALREADY_RESPONDED: 'This revision request has already been addressed',
  CANNOT_REQUEST_REVISION: 'Cannot request revision at this time',
  ORDER_NOT_DELIVERED: 'Order has not been delivered yet',

  // Review errors
  REVIEW_NOT_FOUND: 'Review not found',
  REVIEW_ALREADY_EXISTS: 'You have already reviewed this order',
  CANNOT_REVIEW_INCOMPLETE_ORDER: 'Cannot review an incomplete order',
  NOT_REVIEW_OWNER: 'You are not the owner of this review',
  SELLER_RESPONSE_ALREADY_EXISTS: 'Seller has already responded to this review',
  CANNOT_RESPOND_TO_OWN_REVIEW: 'Cannot respond to your own review',

  // Message errors
  MESSAGE_NOT_FOUND: 'Message not found',
  CANNOT_MESSAGE_SELF: 'Cannot send message to yourself',
};

const httpStatusCodes: Record<ServiceCatalogErrorCodeType, number> = {
  // 404 Not Found
  SERVICE_NOT_FOUND: 404,
  PACKAGE_NOT_FOUND: 404,
  ADD_ON_NOT_FOUND: 404,
  ORDER_NOT_FOUND: 404,
  DELIVERY_NOT_FOUND: 404,
  REVISION_NOT_FOUND: 404,
  REVIEW_NOT_FOUND: 404,
  MESSAGE_NOT_FOUND: 404,

  // 400 Bad Request
  SERVICE_NOT_ACTIVE: 400,
  SERVICE_ALREADY_PUBLISHED: 400,
  SERVICE_NOT_DRAFT: 400,
  SERVICE_PENDING_REVIEW: 400,
  SERVICE_PAUSED: 400,
  SERVICE_ARCHIVED: 400,
  INVALID_SERVICE_STATUS: 400,
  SLUG_ALREADY_EXISTS: 400,
  PACKAGE_NOT_ACTIVE: 400,
  INVALID_PACKAGE_TIER: 400,
  DUPLICATE_PACKAGE_TIER: 400,
  ADD_ON_NOT_ACTIVE: 400,
  INVALID_ADD_ON_QUANTITY: 400,
  ORDER_NOT_PENDING: 400,
  ORDER_ALREADY_PAID: 400,
  ORDER_ALREADY_COMPLETED: 400,
  ORDER_ALREADY_CANCELLED: 400,
  ORDER_IN_PROGRESS: 400,
  ORDER_DISPUTED: 400,
  INVALID_ORDER_STATUS: 400,
  REQUIREMENTS_NOT_SUBMITTED: 400,
  REQUIREMENTS_ALREADY_SUBMITTED: 400,
  PAYMENT_REQUIRED: 400,
  DELIVERY_ALREADY_ACCEPTED: 400,
  DELIVERY_REVISION_REQUESTED: 400,
  CANNOT_DELIVER_YET: 400,
  ORDER_NOT_IN_PROGRESS: 400,
  NO_REVISIONS_LEFT: 400,
  REVISION_ALREADY_RESPONDED: 400,
  CANNOT_REQUEST_REVISION: 400,
  ORDER_NOT_DELIVERED: 400,
  REVIEW_ALREADY_EXISTS: 400,
  CANNOT_REVIEW_INCOMPLETE_ORDER: 400,
  SELLER_RESPONSE_ALREADY_EXISTS: 400,
  CANNOT_RESPOND_TO_OWN_REVIEW: 400,
  CANNOT_MESSAGE_SELF: 400,

  // 403 Forbidden
  NOT_SERVICE_OWNER: 403,
  NOT_ORDER_BUYER: 403,
  NOT_ORDER_SELLER: 403,
  NOT_ORDER_PARTICIPANT: 403,
  NOT_REVIEW_OWNER: 403,
  CANNOT_ORDER_OWN_SERVICE: 403,

  // 402 Payment Required
  PAYMENT_FAILED: 402,
};

export class ServiceCatalogError extends Error {
  public readonly code: ServiceCatalogErrorCodeType;
  public readonly statusCode: number;

  constructor(code: ServiceCatalogErrorCodeType, customMessage?: string) {
    const message = customMessage || errorMessages[code];
    super(message);
    this.name = 'ServiceCatalogError';
    this.code = code;
    this.statusCode = httpStatusCodes[code];
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}
