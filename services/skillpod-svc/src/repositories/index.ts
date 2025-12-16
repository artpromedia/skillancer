/**
 * @module @skillancer/skillpod-svc/repositories
 * Repository index
 */

export { createPodRepository, type PodRepository } from './pod.repository.js';
export { createTransferRepository, type TransferRepository } from './transfer.repository.js';
export { createPolicyRepository, type PolicyRepository } from './policy.repository.js';
export {
  createRecordingRepository,
  type RecordingRepository,
  type SessionRecording,
  type RecordingWithRelations,
  type RecordingChunk,
  type RecordingMarker,
  type RecordingOcrFrame,
  type RecordingAccessLog,
  type RecordingRetentionPolicy,
  type RecordingStatus,
  type ProcessingStatus,
  type OcrStatus,
  type MarkerType,
  type RecordingAccessType,
  type RecordingListFilter,
  type RecordingListOptions,
} from './recording.repository.js';

export {
  createWatermarkRepository,
  type WatermarkRepository,
  type VisibleWatermarkConfig,
  type InvisibleWatermarkConfig,
  type WatermarkPattern,
  type WatermarkContentType,
  type WatermarkMethod,
  type WatermarkStrength,
  type DetectionSourceType,
  type InvestigationStatus,
  type CreateConfigurationInput,
  type CreateInstanceInput,
  type CreateDetectionInput,
} from './watermark.repository.js';

// Environment management repositories
export {
  createTemplateRepository,
  type TemplateRepository,
  type TemplateWithRelations,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type TemplateListFilter,
  type TemplateListOptions,
  type UpsertRatingInput,
} from './template.repository.js';

export {
  createImageRepository,
  type ImageRepository,
  type CreateBaseImageInput,
  type UpdateBaseImageInput,
  type BaseImageListFilter,
  type BaseImageListOptions,
} from './image.repository.js';

export {
  createEnvironmentPodRepository,
  type EnvironmentPodRepository,
  type PodWithRelations,
  type CreatePodInput,
  type UpdatePodInput,
  type PodListFilter,
  type PodListOptions,
  type CreateResourceHistoryInput,
  type CreatePodSessionInput,
} from './environment-pod.repository.js';

export {
  createResourcePoolRepository,
  type ResourcePoolRepository,
  type CreateResourcePoolInput,
  type UpdateResourcePoolInput,
  type CreateQuotaInput,
  type UpdateQuotaInput,
  type ResourcePoolListFilter,
} from './resource-pool.repository.js';
