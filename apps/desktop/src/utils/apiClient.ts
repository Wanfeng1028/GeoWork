/**
 * API client for GeoWork desktop application.
 * Provides a unified fetch wrapper with authentication, error handling, and timeouts.
 */

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT = 30_000;

/** Base URL for API requests. Can be overridden via VITE_API_URL env variable. */
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/**
 * Standard API response envelope.
 * Mirrors the shape returned by both Go core and Python worker.
 */
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Represents an error returned by the API.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly data?: unknown;
  public readonly code?: string;

  constructor(message: string, status: number, data?: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.code = code;
  }
}

/**
 * Options for API requests.
 */
export interface RequestOptions extends RequestInit {
  /** Request timeout in milliseconds. */
  timeout?: number;
  /** Whether to include the Authorization header. Defaults to true. */
  auth?: boolean;
}

/**
 * Retrieves the stored authentication token from localStorage.
 * @returns The Bearer token string or null if not authenticated.
 */
function getAuthToken(): string | null {
  try {
    return localStorage.getItem('access_token');
  } catch {
    return null;
  }
}

/**
 * Parses an error response from the API.
 * Attempts to extract a message from JSON error responses.
 */
async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.error || data.message || `HTTP ${response.status}`;
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

/**
 * Makes an authenticated API request with timeout and error handling.
 *
 * @param path - The API endpoint path (relative to BASE_URL/api).
 * @param options - Request options including method, body, timeout, and auth flag.
 * @returns The parsed JSON response.
 * @throws {ApiError} When the API returns a non-OK response.
 * @throws {Error} When the request times out or a network error occurs.
 *
 * @example
 * ```ts
 * const user = await apiClient<LoginResponse>('/auth/login', {
 *   method: 'POST',
 *   body: JSON.stringify({ email, password }),
 * });
 * ```
 */
export async function apiClient<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, auth = true, ...fetchOptions } = options;

  // Build headers
  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has('Content-Type') && fetchOptions.body) {
    headers.set('Content-Type', 'application/json');
  }

  // Add authorization header if needed
  if (auth) {
    const token = getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // Build full URL
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const message = await parseErrorResponse(response);
      let data: unknown;
      let code: string | undefined;
      try {
        const parsed = await response.clone().json();
        data = parsed;
        code = parsed?.code;
      } catch {
        // Response body already consumed or not JSON
      }
      throw new ApiError(message, response.status, data, code);
    }

    // Handle empty responses (e.g., 204 No Content)
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timeout: ${path}`);
    }

    throw error;
  }
}

/**
 * Convenience methods for common HTTP verbs.
 */
export const api = {
  get: <T = unknown>(path: string, options?: RequestOptions) =>
    apiClient<T>(path, { ...options, method: 'GET' }),

  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(path, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    apiClient<T>(path, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(path: string, options?: RequestOptions) =>
    apiClient<T>(path, { ...options, method: 'DELETE' }),
};

/**
 * Class-based API client with built-in ApiResponse<T> envelope handling.
 *
 * Usage:
 * ```ts
 * import { ApiClient } from './utils/apiClient';
 * const client = new ApiClient();
 * client.setToken('...');
 * const res = await client.get<User>('/users/me');
 * if (res.ok) { console.log(res.data); }
 * ```
 */
export class ApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;

  constructor(baseUrl: string = BASE_URL, timeout: number = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.headers = { 'Content-Type': 'application/json' };
    this.timeout = timeout;
  }

  /** Set the Bearer authorization token. */
  setToken(token: string): void {
    this.headers['Authorization'] = `Bearer ${token}`;
  }

  /** Remove the authorization header. */
  clearToken(): void {
    delete this.headers['Authorization'];
  }

  /**
   * Core request method that wraps responses in ApiResponse<T>.
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this.headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle empty responses (e.g. 204)
      const text = await response.text();
      if (!text) {
        return { ok: response.ok };
      }

      const json = JSON.parse(text);

      // If the server already returns { ok, data/error/code } envelope, pass through
      if (typeof json === 'object' && json !== null && 'ok' in json) {
        if (!json.ok) {
          throw new ApiError(
            json.error || json.message || 'Unknown error',
            response.status,
            json,
            json.code,
          );
        }
        return json as ApiResponse<T>;
      }

      // Otherwise wrap in envelope
      if (!response.ok) {
        throw new ApiError(
          json.error || json.message || `HTTP ${response.status}`,
          response.status,
          json,
        );
      }

      return { ok: true, data: json as T };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(`Request timeout: ${path}`, 408);
      }

      throw error;
    }
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body);
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path);
  }
}

/** Default singleton API client instance. */
export const apiClientInstance = new ApiClient();

export default apiClient;
