/**
 * @skillancer/shared-auth - Types
 * Shared authentication types used across all Skillancer apps
 */

// =============================================================================
// User Types
// =============================================================================

/**
 * Base authenticated user interface
 */
export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string; // Optional display name
  displayName?: string;
  avatarUrl?: string;
  role: UserRole;
  roles?: string[];
  permissions: string[];
  emailVerified: boolean;
  status?: UserStatus;
  verificationLevel?: VerificationLevel;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Admin user interface with admin-specific fields
 */
export interface AdminUser extends AuthUser {
  adminRole: AdminRole | string;
  adminPermissions?: string[];
  isSuperAdmin?: boolean;
  department?: string;
  lastLogin?: string;
  mfaEnabled?: boolean;
}

/**
 * Cockpit user with executive-specific fields
 */
export interface CockpitUser extends AuthUser {
  executiveId?: string;
  tenantId?: string;
  tenants?: string[];
  timezone?: string;
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
}

// =============================================================================
// Role & Permission Types
// =============================================================================

/**
 * User roles in the system
 */
export type UserRole = 'USER' | 'FREELANCER' | 'CLIENT' | 'BOTH' | 'ADMIN' | 'SUPER_ADMIN';

/**
 * Admin-specific roles
 */
export type AdminRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'OPERATIONS'
  | 'MODERATOR'
  | 'SUPPORT'
  | 'FINANCE'
  | 'ANALYTICS'
  | 'super_admin'
  | 'admin'
  | 'operations'
  | 'moderator'
  | 'support'
  | 'finance'
  | 'analytics';

/**
 * User account status
 */
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' | 'BANNED';

/**
 * Verification level
 */
export type VerificationLevel = 'NONE' | 'EMAIL' | 'PHONE' | 'ID' | 'FULL';

// =============================================================================
// Token Types
// =============================================================================

/**
 * JWT tokens pair
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * Decoded JWT payload
 */
export interface JwtPayload {
  sub: string;
  userId?: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  roles?: string[];
  adminRole?: AdminRole;
  permissions?: string[];
  sessionId?: string;
  tenantId?: string;
  executiveId?: string;
  verificationLevel?: string;
  emailVerified?: boolean;
  iat: number;
  exp: number;
}

// =============================================================================
// Session Types
// =============================================================================

/**
 * User session information
 */
export interface AuthSession {
  id: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
  permissions?: string[];
  tenantId?: string;
  deviceInfo?: string;
  ipAddress?: string;
  lastActivity: string;
  createdAt: string;
  expiresAt: string;
}

// =============================================================================
// Auth Response Types
// =============================================================================

/**
 * Login response
 */
export interface LoginResponse {
  success: boolean;
  user: AuthUser;
  tokens: AuthTokens;
  message?: string;
}

/**
 * MFA required response
 */
export interface MFARequiredResponse {
  success: boolean;
  mfaRequired: true;
  pendingSessionId: string;
  methods: string[];
  message?: string;
}

/**
 * Token refresh response
 */
export interface RefreshTokenResponse {
  success: boolean;
  tokens: AuthTokens;
}

// =============================================================================
// Auth Context Types
// =============================================================================

/**
 * Base auth context value interface
 */
export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  clearError?: () => void;
}

/**
 * Admin-specific auth context
 */
export interface AdminAuthContextValue extends AuthContextValue {
  user: AdminUser | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isModerator: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
}

/**
 * Cockpit-specific auth context
 */
export interface CockpitAuthContextValue extends AuthContextValue {
  user: CockpitUser | null;
  currentTenant?: string;
  switchTenant?: (tenantId: string) => Promise<void>;
}

// =============================================================================
// Token Storage Interface
// =============================================================================

/**
 * Token storage interface for different storage mechanisms
 */
export interface TokenStorage {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(accessToken: string, refreshToken: string): void;
  clearTokens(): void;
}

// =============================================================================
// Auth Provider & Additional Types
// =============================================================================

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Auth state for providers
 */
export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

/**
 * Auth provider props
 */
export interface AuthProviderProps {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
  apiBaseUrl?: string;
  onAuthStateChange?: (event: AuthStateChangeEvent) => void;
  onLogin?: (user: AuthUser) => void;
  onLogout?: () => void;
  tokenCookieName?: string;
  sessionCookieName?: string;
}

/**
 * Auth state change event
 */
export interface AuthStateChangeEvent {
  type: 'authenticated' | 'unauthenticated' | 'error';
  user?: AuthUser;
  error?: string;
}

/**
 * Auth result from server-side authentication
 */
export interface AuthResult {
  authenticated: boolean;
  user?: AuthUser | AdminUser;
  error?: string;
}

/**
 * Token verification result
 */
export interface TokenVerifyResult {
  valid: boolean;
  payload?: JwtPayload;
  error?: string;
}
