import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidEmail,
  isValidWhatsApp,
  isValidCPF,
  isValidPlate,
  isAdult,
} from '../../../shared/src/validation.js';
import { apiFetch, ApiError } from '../api/client.js';

describe('Frontend Auth, Validation & Contract Resilience Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Form Validation Rules (shared/src/validation.ts)', () => {
    it('validates Brazilian and international WhatsApp phone numbers', () => {
      // Valid cases
      expect(isValidWhatsApp('(12) 99123-4567')).toBe(true);
      expect(isValidWhatsApp('12991234567')).toBe(true);
      expect(isValidWhatsApp('+55 12 99123-4567')).toBe(true);
      expect(isValidWhatsApp('+5512991234567')).toBe(true);
      expect(isValidWhatsApp('+1 415 555-0199')).toBe(true);

      // Invalid cases
      expect(isValidWhatsApp('')).toBe(false);
      expect(isValidWhatsApp('123')).toBe(false);
      expect(isValidWhatsApp('invalid-phone')).toBe(false);
      expect(isValidWhatsApp('1234567')).toBe(false); // under min length (min 8 digits)
    });

    it('validates email formats strictly and defensively', () => {
      expect(isValidEmail('motorista@vaicar.app')).toBe(true);
      expect(isValidEmail('passageiro.saosebastiao@gmail.com')).toBe(true);
      expect(isValidEmail('usuario+teste@outlook.com')).toBe(true);

      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('sem-arroba.com')).toBe(false);
      expect(isValidEmail('usuario@')).toBe(false);
      expect(isValidEmail('@dominio.com')).toBe(false);
      expect(isValidEmail('espacos no email@vaicar.app')).toBe(false);
    });

    it('validates CPF structure and rejection of invalid digits', () => {
      // Known invalid sequences
      expect(isValidCPF('00000000000')).toBe(false);
      expect(isValidCPF('11111111111')).toBe(false);
      expect(isValidCPF('12345678900')).toBe(false);
      expect(isValidCPF('123')).toBe(false);
      expect(isValidCPF('')).toBe(false);
    });

    it('validates vehicle license plates (Traditional & Mercosul)', () => {
      // Traditional ABC-1234
      expect(isValidPlate('ABC-1234')).toBe(true);
      expect(isValidPlate('ABC1234')).toBe(true);

      // Mercosul ABC1D23
      expect(isValidPlate('ABC1D23')).toBe(true);
      expect(isValidPlate('BRA2E19')).toBe(true);

      // Invalid plates
      expect(isValidPlate('')).toBe(false);
      expect(isValidPlate('1234-ABC')).toBe(false);
      expect(isValidPlate('TOOLONG123')).toBe(false);
    });

    it('validates driver majority (18+ years requirement)', () => {
      const today = new Date();
      const nineteenYearsAgo = new Date(today.getFullYear() - 19, today.getMonth(), today.getDate())
        .toISOString()
        .split('T')[0];
      const seventeenYearsAgo = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate())
        .toISOString()
        .split('T')[0];

      expect(isAdult(nineteenYearsAgo)).toBe(true);
      expect(isAdult(seventeenYearsAgo)).toBe(false);
      expect(isAdult('')).toBe(false);
    });
  });

  describe('2. Dual-Contract Unwrapping & Safe Object/Array Returns', () => {
    it('returns unwrapped object merging root and data properties without token undefined crash', async () => {
      const mockPayload = {
        success: true,
        requestId: 'req-auth-100',
        data: {
          token: 'token.abc.xyz',
          user: { uid: 'usr-1', email: 'teste@vaicar.app' },
          role: 'passenger',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => mockPayload,
      } as any);

      const result = await apiFetch<any>('/api/v1/auth/login', { method: 'POST' });

      // Both flat and nested access succeed
      expect(result.token).toBe('token.abc.xyz');
      expect(result.data.token).toBe('token.abc.xyz');
      expect(result.role).toBe('passenger');
      expect(result.user.uid).toBe('usr-1');
    });

    it('preserves array data intact (does not turn lists into { data: [...] } objects)', async () => {
      const mockPlaces = [
        { name: 'Centro Histórico', lat: -23.8066, lng: -45.4025 },
        { name: 'Praia de Maresias', lat: -23.7915, lng: -45.5567 },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: true,
          data: mockPlaces,
        }),
      } as any);

      const result = await apiFetch<any[]>('/api/v1/maps/popular-places');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Centro Histórico');
      expect(result[1].name).toBe('Praia de Maresias');
    });

    it('correctly handles non-JSON plain text response gracefully without crashing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: async () => 'OK',
      } as any);

      const result = await apiFetch<string>('/api/v1/health');
      expect(result).toBe('OK');
    });

    it('extracts API error payload and propagates descriptive message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'E-mail ou senha incorretos.',
          },
        }),
      } as any);

      try {
        await apiFetch('/api/v1/auth/login', { method: 'POST' });
        expect.unreachable('Should have thrown an ApiError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.message).toBe('E-mail ou senha incorretos.');
        expect(err.status).toBe(400);
      }
    });
  });
});
