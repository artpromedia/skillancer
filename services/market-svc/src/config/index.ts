/**
 * Config barrel export
 */

export {
  FREELANCER_RATING_DIMENSIONS,
  CLIENT_RATING_DIMENSIONS,
  SKILLPOD_COMPLIANCE_DIMENSIONS,
  calculateWeightedAverage,
  getDimensionsForReviewType,
  validateDimensionRatings,
  normalizeRatings,
  REVIEW_CONFIG,
} from './rating-dimensions.js';

export type {
  FreelancerDimensionKey,
  ClientDimensionKey,
  ComplianceDimensionKey,
} from './rating-dimensions.js';
