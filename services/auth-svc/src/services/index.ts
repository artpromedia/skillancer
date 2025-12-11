/**
 * @module @skillancer/auth-svc/services
 * Service layer exports
 */

export * from './token.service.js';
export * from './session.service.js';
export * from './auth.service.js';
export * from './oauth.service.js';
export * from './totp.service.js';
export * from './mfa.service.js';
export * from './step-up-auth.service.js';
export * from './persona.service.js';
export * from './verification.service.js';

// SMS service - avoid SmsService conflict with mfa.service.js
export {
  TwilioSmsService,
  MockSmsService,
  getSmsService,
  initializeSmsService,
  resetSmsService,
  type SmsResult,
} from './sms.service.js';

// Trusted devices service - use renamed TrustDeviceInfo to avoid conflict with schemas
export {
  TrustedDevicesService,
  initializeTrustedDevicesService,
  getTrustedDevicesService,
  resetTrustedDevicesService,
  type TrustDeviceInfo,
  type TrustedDeviceResult,
  type TrustDeviceResult,
  type DeviceTrustVerification,
} from './trusted-devices.service.js';

export * from './mfa-recovery.service.js';
export * from './tenant-mfa-policy.service.js';
export * from './profile.service.js';
export * from './freelancer-profile.service.js';
export * from './client-profile.service.js';
export * from './skills.service.js';
export * from './avatar.service.js';
export * from './portfolio.service.js';
export * from './work-history.service.js';
export * from './education.service.js';
export * from './certification.service.js';
export * from './profile-completion.service.js';
