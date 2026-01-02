/**
 * Brute Force Protection Module
 * @module @skillancer/security/brute-force
 */

export {
  BruteForceProtection,
  initializeBruteForceProtection,
  getBruteForceProtection,
  resetBruteForceProtection,
  type BruteForceConfig,
  type LoginAttemptResult,
  type LockoutInfo,
  type NotificationCallback,
} from './brute-force-protection.js';
