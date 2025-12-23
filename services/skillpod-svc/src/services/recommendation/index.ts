/**
 * @module @skillancer/skillpod-svc/services/recommendation
 * Learning Recommendation services index
 */

export {
  createSignalProcessor,
  type SignalProcessor,
  type SignalProcessorConfig,
  type ProcessedSignalResult,
  type DetectedGap,
} from './signal-processor.service.js';

export {
  createRecommendationEngine,
  type RecommendationEngine,
  type RecommendationEngineConfig,
  type GenerateRecommendationsParams,
  type GeneratedRecommendation,
  type RecommendationScores,
} from './recommendation-engine.service.js';

export {
  createLearningPathGenerator,
  type LearningPathGenerator,
  type LearningPathGeneratorConfig,
  type GeneratePathParams,
  type GeneratedPath,
} from './learning-path-generator.service.js';
