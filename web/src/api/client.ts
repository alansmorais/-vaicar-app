import { type ApiResponse, ErrorCode, type ErrorCodeType, getFriendlyErrorMessage } from '../../../shared/src/errors.js';

let currentAuthToken: string | null = null;

export function setAuthToken(token: string | null): void {
  currentAuthToken = token;
  if (token) {
    localStorage.setItem('vaicar_fb_token', token);
  } else {
    localStorage.removeItem('vaicar_fb_token');
  }
}

export function getAuthToken(): string | null {
  if (!currentAuthToken) {
    currentAuthToken = localStorage.getItem('vaicar_fb_token');
  }
  return currentAuthToken;
}

export class ApiError extends Error {
  code: ErrorCodeType;
  details?: unknown;
  requestId?: string;

  constructor(code: ErrorCodeType, message: string, details?: unknown, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (window.location.hostname.endsWith('.pages.dev')
  ? 'https://vaicar-app-770203144889.southamerica-east1.run.app'
  : '');

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiPath = endpoint.startsWith('/api/') ? endpoint : `/api/v1${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const url = API_BASE_URL ? `${API_BASE_URL.replace(/\/$/, '')}${apiPath}` : apiPath;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    if (!isJson) {
      if (!response.ok) {
        throw new ApiError(ErrorCode.INTERNAL_ERROR, `Erro na requisição (${response.status})`);
      }
      return (await response.text()) as unknown as T;
    }

    const json: ApiResponse<T> = await response.json();

    if (!response.ok || !json.success) {
      const code = json.error?.code || ErrorCode.INTERNAL_ERROR;
      const message = json.error?.message || getFriendlyErrorMessage(code);
      throw new ApiError(code, message, json.error?.details, json.requestId);
    }

    // Some legacy endpoints (including /auth/login) return the payload at the top level,
    // while newer endpoints use the standard { success, data } envelope.
    return (json.data ?? json) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = (err as Error)?.message || 'Falha de conexão com os servidores do VaiCar.';
    throw new ApiError(ErrorCode.INTERNAL_ERROR, message);
  }
}
