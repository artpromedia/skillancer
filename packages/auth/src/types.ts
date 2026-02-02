/**
 * @skillancer/auth - Shared Types
 *
 * Common authentication types used across all applications.
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
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: string;
  roles: string[];
  permissions: string[];
  emailVerified: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  verificationLevel?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Admin user interface with admin-specific fields
 */
export interface AdminUser extends AuthUser {
  adminRole: string;
  department?: string;
  lastLogin?: string;
}

/**
 * Cockpit user with executive-specific fields
 */
export interface CockpitUser extends AuthUser {
  executiveId?: string;
  tenantId?: string;
  tenants?: string[];
}

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
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions?: string[];
  sessionId?: string;
  tenantId?: string;
  executiveId?: string;
  verificationLevel?: string;
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
  deviceInfo?: string;
  ipAddress?: string;
  location?: string;
  userAgent?: string;
  lastActivity: string;
  createdAt: string;
  expiresAt: string;
  isCurrent?: boolean;
}

// =============================================================================
// Auth Response Types
// =============================================================================

/**
 * Login response with user and tokens
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
 * Register response
 */
export interface RegisterResponse {
  success: boolean;
  message: string;
  user?: AuthUser;
  requiresVerification?: boolean;
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
 * Auth context value interface
 */
export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; mfaRequired?: boolean; pendingSessionId?: string }>;
  verifyMFA: (
    pendingSessionId: string,
    code: string,
    method: string
  ) => Promise<{ success: boolean }>;
  register: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  logout: (allSessions?: boolean) => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
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
  switchTenant: (tenantId: string) => Promise<void>;
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
