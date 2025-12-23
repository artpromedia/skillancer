/**
 * @module @skillancer/skillpod-svc/repositories/recommendation
 * Learning Recommendation repositories index
 */

export {
  createLearningProfileRepository,
  type LearningProfileRepository,
  type UserLearningProfileWithRelations,
  type CreateLearningProfileInput,
  type UpdateLearningProfileInput,
  type LearningProfileListFilter,
  type LearningProfileListOptions,
} from './learning-profile.repository.js';

export {
  createSkillGapRepository,
  type SkillGapRepository,
  type SkillGapWithRelations,
  type CreateSkillGapInput,
  type UpdateSkillGapInput,
  type SkillGapListFilter,
  type SkillGapListOptions,
  type SkillGapStats,
} from './skill-gap.repository.js';

export {
  createMarketActivitySignalRepository,
  type MarketActivitySignalRepository,
  type MarketActivitySignalWithRelations,
  type CreateMarketActivitySignalInput,
  type UpdateMarketActivitySignalInput,
  type MarketActivitySignalListFilter,
  type MarketActivitySignalListOptions,
  type SignalAggregation,
} from './market-activity-signal.repository.js';

export {
  createLearningRecommendationRepository,
  type LearningRecommendationRepository,
  type LearningRecommendationWithRelations,
  type CreateLearningRecommendationInput,
  type UpdateLearningRecommendationInput,
  type LearningRecommendationListFilter,
  type LearningRecommendationListOptions,
  type RecommendationStats,
} from './learning-recommendation.repository.js';

export {
  createLearningPathRepository,
  type LearningPathRepository,
  type UserLearningPathWithRelations,
  type PathMilestone,
  type PathMilestoneItem,
  type CreateLearningPathInput,
  type UpdateLearningPathInput,
  type LearningPathListFilter,
  type LearningPathListOptions,
  type LearningPathStats,
} from './learning-path.repository.js';

export {
  createMarketTrendRepository,
  type MarketTrendRepository,
  type MarketTrendWithRelations,
  type CreateMarketTrendInput,
  type UpdateMarketTrendInput,
  type MarketTrendListFilter,
  type MarketTrendListOptions,
  type TrendSummary,
} from './market-trend.repository.js';
