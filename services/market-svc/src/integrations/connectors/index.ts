// @ts-nocheck
/**
 * Platform Connectors Index
 * Sprint M4: Portable Verified Work History
 */

export { getUpworkConnector, UpworkConnector } from './upwork-connector';
export { getFiverrConnector, FiverrConnector } from './fiverr-connector';
export { getFreelancerConnector, FreelancerConnector } from './freelancer-connector';

// Initialize all connectors on import
import './upwork-connector';
import './fiverr-connector';
import './freelancer-connector';
