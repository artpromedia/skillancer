/**
 * @module @skillancer/api-client/storage
 * Token storage implementations for different environments
 */

import type { TokenStorage } from '../http/base-client';

// =============================================================================
// Constants
// =============================================================================

const ACCESS_TOKEN_KEY = 'skillancer_access_token';
const REFRESH_TOKEN_KEY = 'skillancer_refresh_token';

// =============================================================================
// Browser LocalStorage Implementation
// =============================================================================

/**
 * Token storage using browser localStorage
 * Best for web applications where persistence across tabs is needed
 */
export class LocalStorageTokenStorage implements TokenStorage {
  private accessTokenKey: string;
  private refreshTokenKey: string;
  private onRefreshed?: (accessToken: string, refreshToken: string) => void;

  constructor(
    accessTokenKey: string = ACCESS_TOKEN_KEY,
    refreshTokenKey: string = REFRESH_TOKEN_KEY
  ) {
    this.accessTokenKey = accessTokenKey;
    this.refreshTokenKey = refreshTokenKey;
  }

  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.refreshTokenKey);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.accessTokenKey, accessToken);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
  }

  onTokenRefreshed(accessToken: string, refreshToken: string): void {
    this.onRefreshed?.(accessToken, refreshToken);
  }

  setOnRefreshedCallback(callback: (accessToken: string, refreshToken: string) => void): void {
    this.onRefreshed = callback;
  }
}

// =============================================================================
// In-Memory Storage Implementation
// =============================================================================

/**
 * Token storage using in-memory variables
 * Best for SSR, CLI tools, or when persistence is not needed
 */
export class MemoryTokenStorage implements TokenStorage {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onRefreshed?: (accessToken: string, refreshToken: string) => void;

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }

  onTokenRefreshed(accessToken: string, refreshToken: string): void {
    this.onRefreshed?.(accessToken, refreshToken);
  }

  setOnRefreshedCallback(callback: (accessToken: string, refreshToken: string) => void): void {
    this.onRefreshed = callback;
  }
}

// =============================================================================
// Cookie-based Storage Implementation
// =============================================================================

interface CookieOptions {
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  domain?: string;
  path?: string;
  maxAge?: number;
}

/**
 * Token storage using HTTP cookies
 * Best for applications that need server-side access to tokens
 */
export class CookieTokenStorage implements TokenStorage {
  private accessTokenKey: string;
  private refreshTokenKey: string;
  private options: CookieOptions;
  private onRefreshed?: (accessToken: string, refreshToken: string) => void;

  constructor(
    accessTokenKey: string = ACCESS_TOKEN_KEY,
    refreshTokenKey: string = REFRESH_TOKEN_KEY,
    options: CookieOptions = {}
  ) {
    this.accessTokenKey = accessTokenKey;
    this.refreshTokenKey = refreshTokenKey;
    this.options = {
      secure: true,
      sameSite: 'lax',
      path: '/',
      ...options,
    };
  }

  getAccessToken(): string | null {
    if (typeof document === 'undefined') return null;
    return this.getCookie(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    if (typeof document === 'undefined') return null;
    return this.getCookie(this.refreshTokenKey);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof document === 'undefined') return;
    this.setCookie(this.accessTokenKey, accessToken, 3600); // 1 hour
    this.setCookie(this.refreshTokenKey, refreshToken, 604800); // 7 days
  }

  clearTokens(): void {
    if (typeof document === 'undefined') return;
    this.deleteCookie(this.accessTokenKey);
    this.deleteCookie(this.refreshTokenKey);
  }

  onTokenRefreshed(accessToken: string, refreshToken: string): void {
    this.onRefreshed?.(accessToken, refreshToken);
  }

  setOnRefreshedCallback(callback: (accessToken: string, refreshToken: string) => void): void {
    this.onRefreshed = callback;
  }

  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift();
      return cookieValue ?? null;
    }
    return null;
  }

  private setCookie(name: string, value: string, maxAge?: number): void {
    let cookie = `${name}=${encodeURIComponent(value)}`;

    if (this.options.path) cookie += `; path=${this.options.path}`;
    if (this.options.domain) cookie += `; domain=${this.options.domain}`;
    if (this.options.secure) cookie += '; secure';
    if (this.options.sameSite) cookie += `; samesite=${this.options.sameSite}`;
    if (maxAge ?? this.options.maxAge) cookie += `; max-age=${maxAge ?? this.options.maxAge}`;

    document.cookie = cookie;
  }

  private deleteCookie(name: string): void {
    this.setCookie(name, '', -1);
  }
}

// =============================================================================
// Session Storage Implementation
// =============================================================================

/**
 * Token storage using browser sessionStorage
 * Best for temporary sessions that should clear when browser closes
 */
export class SessionStorageTokenStorage implements TokenStorage {
  private accessTokenKey: string;
  private refreshTokenKey: string;
  private onRefreshed?: (accessToken: string, refreshToken: string) => void;

  constructor(
    accessTokenKey: string = ACCESS_TOKEN_KEY,
    refreshTokenKey: string = REFRESH_TOKEN_KEY
  ) {
    this.accessTokenKey = accessTokenKey;
    this.refreshTokenKey = refreshTokenKey;
  }

  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(this.accessTokenKey);
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(this.refreshTokenKey);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(this.accessTokenKey, accessToken);
    sessionStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(this.accessTokenKey);
    sessionStorage.removeItem(this.refreshTokenKey);
  }

  onTokenRefreshed(accessToken: string, refreshToken: string): void {
    this.onRefreshed?.(accessToken, refreshToken);
  }

  setOnRefreshedCallback(callback: (accessToken: string, refreshToken: string) => void): void {
    this.onRefreshed = callback;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

export function createLocalStorageTokenStorage(
  accessTokenKey?: string,
  refreshTokenKey?: string
): LocalStorageTokenStorage {
  return new LocalStorageTokenStorage(accessTokenKey, refreshTokenKey);
}

export function createMemoryTokenStorage(): MemoryTokenStorage {
  return new MemoryTokenStorage();
}

export function createCookieTokenStorage(
  accessTokenKey?: string,
  refreshTokenKey?: string,
  options?: CookieOptions
): CookieTokenStorage {
  return new CookieTokenStorage(accessTokenKey, refreshTokenKey, options);
}

export function createSessionStorageTokenStorage(
  accessTokenKey?: string,
  refreshTokenKey?: string
): SessionStorageTokenStorage {
  return new SessionStorageTokenStorage(accessTokenKey, refreshTokenKey);
}
