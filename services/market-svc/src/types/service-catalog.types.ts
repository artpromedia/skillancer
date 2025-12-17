/**
 * @module @skillancer/market-svc/types/service-catalog
 * Service Catalog System types and interfaces
 */

// =============================================================================
// ENUMS (matching Prisma schema)
// =============================================================================

export type ServiceCategory =
  | 'DEVELOPMENT'
  | 'DESIGN'
  | 'WRITING'
  | 'MARKETING'
  | 'VIDEO'
  | 'MUSIC'
  | 'BUSINESS'
  | 'DATA'
  | 'LIFESTYLE'
  | 'OTHER';

export type ServiceStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'ACTIVE'
  | 'PAUSED'
  | 'REJECTED'
  | 'ARCHIVED';

export type PackageTier = 'BASIC' | 'STANDARD' | 'PREMIUM';

export type ServiceOrderStatus =
  | 'PENDING_REQUIREMENTS'
  | 'PENDING_PAYMENT'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'REVISION_REQUESTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export type ServicePaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type ServiceEscrowStatus = 'NOT_FUNDED' | 'FUNDED' | 'RELEASED' | 'REFUNDED' | 'DISPUTED';

export type ServiceDeliveryStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REVISION_REQUESTED';

export type ServiceMessageType = 'TEXT' | 'DELIVERY' | 'REVISION_REQUEST' | 'SYSTEM';

export type RequirementType = 'TEXT' | 'TEXTAREA' | 'SELECT' | 'FILE' | 'MULTIPLE_SELECT';

// =============================================================================
// SERVICE TYPES
// =============================================================================

export interface Deliverable {
  title: string;
  description?: string | undefined;
}

export interface Requirement {
  question: string;
  type: RequirementType;
  required: boolean;
  options?: string[] | undefined;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface PackageFeature {
  feature: string;
  included: boolean;
}

export interface PackageDeliverable {
  title: string;
  description?: string | undefined;
  quantity: number;
}

export interface CreateServiceInput {
  title: string;
  description: string;
  shortDescription: string;
  category: ServiceCategory;
  subcategory?: string | undefined;
  tags?: string[] | undefined;
  skills?: string[] | undefined;
  basePrice: number;
  currency?: string | undefined;
  deliveryDays: number;
  revisionsIncluded?: number | undefined;
  deliverables: Deliverable[];
  requirements?: Requirement[] | undefined;
  thumbnailUrl?: string | undefined;
  galleryUrls?: string[] | undefined;
  videoUrl?: string | undefined;
  faqs?: FAQ[] | undefined;
  packages?: CreatePackageInput[] | undefined;
  addOns?: CreateAddOnInput[] | undefined;
}

export interface UpdateServiceInput {
  title?: string | undefined;
  description?: string | undefined;
  shortDescription?: string | undefined;
  category?: ServiceCategory | undefined;
  subcategory?: string | undefined;
  tags?: string[] | undefined;
  skills?: string[] | undefined;
  basePrice?: number | undefined;
  currency?: string | undefined;
  deliveryDays?: number | undefined;
  revisionsIncluded?: number | undefined;
  deliverables?: Deliverable[] | undefined;
  requirements?: Requirement[] | undefined;
  thumbnailUrl?: string | undefined;
  galleryUrls?: string[] | undefined;
  videoUrl?: string | undefined;
  faqs?: FAQ[] | undefined;
  isActive?: boolean | undefined;
}

export interface CreatePackageInput {
  name: string;
  tier: PackageTier;
  description?: string | undefined;
  price: number;
  deliveryDays: number;
  revisionsIncluded: number;
  features: PackageFeature[];
  deliverables: PackageDeliverable[];
  maxRevisions?: number | undefined;
}

export interface UpdatePackageInput {
  name?: string | undefined;
  description?: string | undefined;
  price?: number | undefined;
  deliveryDays?: number | undefined;
  revisionsIncluded?: number | undefined;
  features?: PackageFeature[] | undefined;
  deliverables?: PackageDeliverable[] | undefined;
  maxRevisions?: number | undefined;
  isActive?: boolean | undefined;
}

export interface CreateAddOnInput {
  title: string;
  description?: string | undefined;
  price: number;
  additionalDays?: number | undefined;
  allowQuantity?: boolean | undefined;
  maxQuantity?: number | undefined;
}

export interface UpdateAddOnInput {
  title?: string | undefined;
  description?: string | undefined;
  price?: number | undefined;
  additionalDays?: number | undefined;
  allowQuantity?: boolean | undefined;
  maxQuantity?: number | undefined;
  isActive?: boolean | undefined;
}

// =============================================================================
// SERVICE SEARCH
// =============================================================================

export interface ServiceSearchParams {
  query?: string | undefined;
  category?: ServiceCategory | undefined;
  subcategory?: string | undefined;
  priceMin?: number | undefined;
  priceMax?: number | undefined;
  deliveryDays?: number | undefined;
  minRating?: number | undefined;
  skills?: string[] | undefined;
  sellerId?: string | undefined;
  sortBy?:
    | 'relevance'
    | 'bestselling'
    | 'newest'
    | 'price_low'
    | 'price_high'
    | 'rating'
    | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface ServiceSummary {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  thumbnailUrl?: string | undefined;
  basePrice: number;
  currency: string;
  deliveryDays: number;
  avgRating?: number | undefined;
  ratingCount: number;
  orderCount: number;
  seller: SellerInfo;
}

export interface SellerInfo {
  id: string;
  displayName: string;
  avatarUrl?: string | undefined;
  verificationLevel?: string | undefined;
  avgRating?: number | undefined;
  reviewCount?: number | undefined;
  totalProjects?: number | undefined;
}

export interface ServiceWithDetails {
  id: string;
  freelancerId: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  category: ServiceCategory;
  subcategory?: string | undefined;
  tags: string[];
  basePrice: number;
  currency: string;
  deliveryDays: number;
  revisionsIncluded: number;
  deliverables: Deliverable[];
  requirements?: Requirement[] | undefined;
  thumbnailUrl?: string | undefined;
  galleryUrls: string[];
  videoUrl?: string | undefined;
  faqs?: FAQ[] | undefined;
  status: ServiceStatus;
  isActive: boolean;
  isFeatured: boolean;
  viewCount: number;
  orderCount: number;
  completedCount: number;
  avgRating?: number | undefined;
  ratingCount: number;
  avgResponseHours?: number | undefined;
  publishedAt?: Date | undefined;
  createdAt: Date;
  packages: ServicePackageInfo[];
  addOns: ServiceAddOnInfo[];
  skills: SkillInfo[];
  seller: SellerProfile;
  reviews?: ServiceReviewInfo[] | undefined;
  reviewStats?: ReviewStats | undefined;
}

export interface ServicePackageInfo {
  id: string;
  name: string;
  tier: PackageTier;
  description?: string | undefined;
  price: number;
  deliveryDays: number;
  revisionsIncluded: number;
  features: PackageFeature[];
  deliverables: PackageDeliverable[];
  maxRevisions?: number | undefined;
  isActive: boolean;
  sortOrder: number;
}

export interface ServiceAddOnInfo {
  id: string;
  title: string;
  description?: string | undefined;
  price: number;
  additionalDays: number;
  allowQuantity: boolean;
  maxQuantity?: number | undefined;
  isActive: boolean;
  sortOrder: number;
}

export interface SkillInfo {
  id: string;
  name: string;
  slug: string;
  category?: string | undefined;
}

export interface SellerProfile {
  id: string;
  displayName: string;
  avatarUrl?: string | undefined;
  bio?: string | undefined;
  title?: string | undefined;
  memberSince: Date;
  verificationLevel: string;
  avgRating?: number | undefined;
  reviewCount?: number | undefined;
  totalProjects?: number | undefined;
  avgResponseTime?: string | undefined;
  country?: string | undefined;
}

// =============================================================================
// ORDER TYPES
// =============================================================================

export interface CreateOrderInput {
  serviceId: string;
  packageId: string;
  addOnIds?: Array<{ addOnId: string; quantity: number }> | undefined;
  requirementAnswers?: Record<string, unknown> | undefined;
  couponCode?: string | undefined;
}

export interface SubmitRequirementsInput {
  answers: Record<string, unknown>;
}

export interface ProcessPaymentInput {
  paymentMethodId: string;
}

export interface SubmitDeliveryInput {
  message?: string | undefined;
  files: DeliveryFile[];
}

export interface DeliveryFile {
  name: string;
  url: string;
  size: number;
  type: string;
}

export interface RequestRevisionInput {
  description: string;
  attachments?: Array<{ name: string; url: string }> | undefined;
}

export interface CancelOrderInput {
  reason: string;
}

export interface OrderWithDetails {
  id: string;
  orderNumber: string;
  serviceId: string;
  buyerId: string;
  sellerId: string;
  status: ServiceOrderStatus;
  subtotal: number;
  addOnsTotal: number;
  discount: number;
  platformFee: number;
  total: number;
  currency: string;
  paymentStatus: ServicePaymentStatus;
  paymentIntentId?: string | undefined;
  paidAt?: Date | undefined;
  escrowStatus: ServiceEscrowStatus;
  escrowReleasedAt?: Date | undefined;
  deliveryDays: number;
  expectedDeliveryAt?: Date | undefined;
  deliveredAt?: Date | undefined;
  revisionsIncluded: number;
  revisionsUsed: number;
  requirementAnswers?: Record<string, unknown> | undefined;
  requirementsSubmittedAt?: Date | undefined;
  completedAt?: Date | undefined;
  autoCompletesAt?: Date | undefined;
  cancelledAt?: Date | undefined;
  cancellationReason?: string | undefined;
  cancelledBy?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
  service: ServiceBasicInfo;
  buyer: UserBasicInfo;
  seller: UserBasicInfo;
  items: OrderItemInfo[];
  orderAddOns: OrderAddOnInfo[];
  deliveries: DeliveryInfo[];
  revisionRequests: RevisionRequestInfo[];
}

export interface ServiceBasicInfo {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl?: string | undefined;
}

export interface UserBasicInfo {
  id: string;
  displayName: string;
  avatarUrl?: string | undefined;
}

export interface OrderItemInfo {
  id: string;
  packageName: string;
  packageTier: PackageTier;
  price: number;
  deliveryDays: number;
  revisionsIncluded: number;
  features: PackageFeature[];
  deliverables: PackageDeliverable[];
  quantity: number;
}

export interface OrderAddOnInfo {
  id: string;
  title: string;
  price: number;
  additionalDays: number;
  quantity: number;
}

export interface DeliveryInfo {
  id: string;
  deliveryNumber: number;
  message?: string | undefined;
  files: DeliveryFile[];
  status: ServiceDeliveryStatus;
  acceptedAt?: Date | undefined;
  revisionRequestedAt?: Date | undefined;
  createdAt: Date;
}

export interface RevisionRequestInfo {
  id: string;
  revisionNumber: number;
  description: string;
  attachments?: Array<{ name: string; url: string }> | undefined;
  respondedAt?: Date | undefined;
  response?: string | undefined;
  createdAt: Date;
}

// =============================================================================
// REVIEW TYPES
// =============================================================================

export interface CreateReviewInput {
  overallRating: number;
  communicationRating?: number | undefined;
  qualityRating?: number | undefined;
  deliveryRating?: number | undefined;
  valueRating?: number | undefined;
  title?: string | undefined;
  content?: string | undefined;
}

export interface AddSellerResponseInput {
  response: string;
}

export interface ServiceReviewInfo {
  id: string;
  orderId: string;
  serviceId: string;
  reviewerId: string;
  overallRating: number;
  communicationRating?: number | undefined;
  qualityRating?: number | undefined;
  deliveryRating?: number | undefined;
  valueRating?: number | undefined;
  title?: string | undefined;
  content?: string | undefined;
  sellerResponse?: string | undefined;
  sellerRespondedAt?: Date | undefined;
  isPublic: boolean;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: Date;
  reviewer: UserBasicInfo;
}

export interface ReviewStats {
  avgRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  avgCommunication: number;
  avgQuality: number;
  avgDelivery: number;
  avgValue: number;
}

// =============================================================================
// MESSAGE TYPES
// =============================================================================

export interface SendMessageInput {
  content: string;
  attachments?: Array<{ name: string; url: string; size?: number; type?: string }> | undefined;
  messageType?: ServiceMessageType | undefined;
}

export interface OrderMessageInfo {
  id: string;
  orderId: string;
  senderId: string;
  content: string;
  attachments?: Array<{ name: string; url: string; size?: number; type?: string }> | undefined;
  messageType: ServiceMessageType;
  isRead: boolean;
  readAt?: Date | undefined;
  createdAt: Date;
  sender: UserBasicInfo;
}

// =============================================================================
// PAGINATION
// =============================================================================

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface SearchFacets {
  categories: Array<{ value: string; count: number }>;
  priceRanges: Array<{ min: number; max: number; count: number }>;
  deliveryDays: Array<{ value: number; count: number }>;
  ratings: Array<{ value: number; count: number }>;
}

// =============================================================================
// SELLER DASHBOARD
// =============================================================================

export interface SellerDashboardStats {
  totalServices: number;
  activeServices: number;
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalEarnings: number;
  pendingEarnings: number;
  avgRating: number;
  totalReviews: number;
}

export interface OrderListParams {
  status?: ServiceOrderStatus | ServiceOrderStatus[] | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}
