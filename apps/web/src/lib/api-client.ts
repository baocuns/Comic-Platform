function getDefaultApiUrl(): string {
  if (typeof window !== 'undefined') {
    if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    return '/v1';
  }
  return process.env.API_URL
    ? `${process.env.API_URL}/v1`
    : process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/v1';
}

export interface FetchOptions extends RequestInit {
  token?: string | null;
  skipAuthRefresh?: boolean;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type TokenAccessor = () => string | null;
type TokenRefresher = () => Promise<string | null>;

class ApiClient {
  private baseUrl?: string;
  private getTokenFn?: TokenAccessor;
  private refreshFn?: TokenRefresher;
  private inflightRefresh: Promise<string | null> | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl;
  }

  configureAuth(getToken: TokenAccessor, refreshToken: TokenRefresher) {
    this.getTokenFn = getToken;
    this.refreshFn = refreshToken;
  }

  private getEffectiveBaseUrl(): string {
    return this.baseUrl || getDefaultApiUrl();
  }

  private async trySilentRefresh(): Promise<string | null> {
    if (!this.refreshFn) return null;
    if (!this.inflightRefresh) {
      this.inflightRefresh = this.refreshFn().finally(() => {
        this.inflightRefresh = null;
      });
    }
    return this.inflightRefresh;
  }

  private async executeFetch(
    endpoint: string,
    options: FetchOptions,
    overrideToken?: string | null,
    isFormData = false,
  ): Promise<Response> {
    const { token, headers, skipAuthRefresh: _skip, ...rest } = options;
    const effectiveToken = overrideToken !== undefined ? overrideToken : (token ?? this.getTokenFn?.() ?? null);

    return fetch(`${this.getEffectiveBaseUrl()}${endpoint}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
        ...headers,
      },
    });
  }

  private async request<T>(endpoint: string, options: FetchOptions = {}, isFormData = false): Promise<T> {
    let res = await this.executeFetch(endpoint, options, undefined, isFormData);

    if (
      res.status === 401 &&
      !options.skipAuthRefresh &&
      !endpoint.startsWith('/auth/refresh') &&
      !endpoint.startsWith('/auth/login') &&
      !endpoint.startsWith('/auth/register') &&
      !endpoint.startsWith('/auth/google')
    ) {
      const nextToken = await this.trySilentRefresh();
      if (nextToken) {
        res = await this.executeFetch(endpoint, options, nextToken, isFormData);
      }
    }

    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (!res.ok) {
      throw new ApiError(
        payload?.error?.message || res.statusText || 'Đã có lỗi xảy ra',
        payload?.error?.code || 'HTTP_ERROR',
        res.status,
        payload?.error?.details,
      );
    }

    return payload as T;
  }

  get<T>(endpoint: string, options?: FetchOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: FetchOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: FetchOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown, options?: FetchOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: FetchOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  upload<T>(endpoint: string, formData: FormData, options?: FetchOptions) {
    return this.request<T>(
      endpoint,
      {
        ...options,
        method: 'POST',
        body: formData,
      },
      true,
    );
  }
}

export const api = new ApiClient();
