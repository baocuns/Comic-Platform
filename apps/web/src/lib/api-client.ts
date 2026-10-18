function getDefaultApiUrl(): string {
  if (typeof window !== 'undefined') {
    if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    return '/v1';
  }
  return process.env.API_URL
    ? `${process.env.API_URL}/v1`
    : (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/v1');
}

interface FetchOptions extends RequestInit {
  token?: string;
}

class ApiClient {
  private baseUrl?: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl;
  }

  private getEffectiveBaseUrl(): string {
    return this.baseUrl || getDefaultApiUrl();
  }

  private async request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { token, headers, ...rest } = options;

    const res = await fetch(`${this.getEffectiveBaseUrl()}${endpoint}`, {
      ...rest,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      throw new ApiError(
        data?.error?.message || res.statusText || 'Something went wrong',
        data?.error?.code || 'UNKNOWN',
        res.status,
      );
    }

    return data;
  }

  get<T>(endpoint: string, options?: FetchOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: FetchOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: FetchOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown, options?: FetchOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: FetchOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  async upload<T>(endpoint: string, formData: FormData, options?: FetchOptions): Promise<T> {
    const { token, headers, ...rest } = options || {};

    const res = await fetch(`${this.getEffectiveBaseUrl()}${endpoint}`, {
      ...rest,
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
      body: formData,
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      throw new ApiError(
        data?.error?.message || res.statusText || 'Something went wrong',
        data?.error?.code || 'UNKNOWN',
        res.status,
      );
    }

    return data;
  }
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const api = new ApiClient();
