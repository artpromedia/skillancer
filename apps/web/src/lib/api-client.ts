/**
 * API Client for web application
 *
 * Provides a typed interface for making API requests.
 * TODO: Replace mock implementation with actual API integration.
 */

interface FetchOptions {
  headers?: Record<string, string>;
  cache?: RequestCache;
}

interface ApiClient {
  get<T>(path: string, options?: FetchOptions): Promise<T>;
  post<T, D = unknown>(path: string, data?: D, options?: FetchOptions): Promise<T>;
  put<T, D = unknown>(path: string, data?: D, options?: FetchOptions): Promise<T>;
  patch<T, D = unknown>(path: string, data?: D, options?: FetchOptions): Promise<T>;
  delete<T>(path: string, options?: FetchOptions): Promise<T>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

async function fetchWithAuth<T>(
  path: string,
  init?: RequestInit & { cache?: RequestCache }
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export const apiClient: ApiClient = {
  async get<T>(path: string, options?: FetchOptions): Promise<T> {
    return fetchWithAuth<T>(path, {
      method: 'GET',
      ...(options?.headers && { headers: options.headers }),
      ...(options?.cache && { cache: options.cache }),
    });
  },

  async post<T, D = unknown>(path: string, data?: D, options?: FetchOptions): Promise<T> {
    return fetchWithAuth<T>(path, {
      method: 'POST',
      ...(data !== undefined && { body: JSON.stringify(data) }),
      ...(options?.headers && { headers: options.headers }),
      ...(options?.cache && { cache: options.cache }),
    });
  },

  async put<T, D = unknown>(path: string, data?: D, options?: FetchOptions): Promise<T> {
    return fetchWithAuth<T>(path, {
      method: 'PUT',
      ...(data !== undefined && { body: JSON.stringify(data) }),
      ...(options?.headers && { headers: options.headers }),
      ...(options?.cache && { cache: options.cache }),
    });
  },

  async patch<T, D = unknown>(path: string, data?: D, options?: FetchOptions): Promise<T> {
    return fetchWithAuth<T>(path, {
      method: 'PATCH',
      ...(data !== undefined && { body: JSON.stringify(data) }),
      ...(options?.headers && { headers: options.headers }),
      ...(options?.cache && { cache: options.cache }),
    });
  },

  async delete<T>(path: string, options?: FetchOptions): Promise<T> {
    return fetchWithAuth<T>(path, {
      method: 'DELETE',
      ...(options?.headers && { headers: options.headers }),
      ...(options?.cache && { cache: options.cache }),
    });
  },
};
