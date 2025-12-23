/**
 * @module @skillancer/skillpod-svc/routes
 * Routes index
 */

export { securityPolicyRoutes } from './security-policy.routes.js';
export { containmentRoutes } from './containment.routes.js';
export { violationRoutes } from './violations.routes.js';
export { transferOverrideRoutes } from './transfer-override.routes.js';
export { policyExceptionRoutes } from './policy-exception.routes.js';
export { killSwitchRoutes } from './kill-switch.routes.js';
export { podRoutes } from './pods.routes.js';
export { sessionRoutes } from './sessions.routes.js';
export {
  registerWebSocketRoutes,
  broadcastToSessions,
  getConnectedSessions,
} from './websocket.routes.js';
export { recordingRoutes } from './recording.routes.js';
export { watermarkRoutes } from './watermark.routes.js';

// Environment management routes
export { templateRoutes } from './template.routes.js';
export { environmentPodRoutes } from './environment-pod.routes.js';

// Learning recommendation routes
export { recommendationRoutes } from './recommendation.routes.js';
export type { RecommendationRoutesDeps } from './recommendation.routes.js';
