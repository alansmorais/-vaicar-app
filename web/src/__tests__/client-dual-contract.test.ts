import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, ApiError } from '../api/client.js';

describe('Frontend API Client (web/src/api/client.ts) — Dual Contract & Compatibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Handles root-level response envelope (e.g. legacy login returning token at root)', async () => {
    const mockPayload = {
      success: true,
      requestId: 'req-root-1',
      token: 'jwt.token.root',
      user: { uid: 'u1', email: 'test@vaicar.app' },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => mockPayload,
    } as any);

    const res = await apiFetch<any>('/auth/login', { method: 'POST' });

    expect(res).toBeDefined();
    // Root level fields are present
    expect(res.token).toBe('jwt.token.root');
    expect(res.user.email).toBe('test@vaicar.app');
    // Dual compatibility data property is also present
    expect(res.data).toBeDefined();
    expect(res.data.token).toBe('jwt.token.root');
  });

  it('2. Handles nested data envelope (e.g. { success: true, data: { ... } })', async () => {
    const mockPayload = {
      success: true,
      requestId: 'req-nested-2',
      data: {
        token: 'jwt.token.nested',
        user: { uid: 'u2', email: 'nested@vaicar.app' },
        message: 'Sucesso',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => mockPayload,
    } as any);

    const res = await apiFetch<any>('/auth/login', { method: 'POST' });

    expect(res).toBeDefined();
    // Root level access works
    expect(res.token).toBe('jwt.token.nested');
    expect(res.message).toBe('Sucesso');
    // Nested data access also works
    expect(res.data).toBeDefined();
    expect(res.data.token).toBe('jwt.token.nested');
  });

  it('3. Handles array data without converting it to an object (e.g. /drivers/online)', async () => {
    const mockDrivers = [
      { uid: 'd1', name: 'Motorista 1' },
      { uid: 'd2', name: 'Motorista 2' },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        requestId: 'req-array-3',
        data: mockDrivers,
      }),
    } as any);

    const res = await apiFetch<any[]>('/drivers/online');

    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(2);
    expect(res[0].uid).toBe('d1');
  });

  it('4. Correctly throws ApiError on server error without crashing with undefined token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: false,
        requestId: 'req-err-4',
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Senha incorreta.',
        },
      }),
    } as any);

    await expect(apiFetch('/auth/login')).rejects.toThrow(ApiError);
  });
});
