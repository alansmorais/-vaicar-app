/**
 * Structured error codes and types for VaiCar platform.
 */

export const ErrorCode = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_ACCOUNT: 'DUPLICATE_ACCOUNT',
  EMAIL_DELIVERY_FAILED: 'EMAIL_DELIVERY_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_RIDE_STATE: 'INVALID_RIDE_STATE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

export interface ApiErrorPayload {
  code: ErrorCodeType;
  message: string;
  details?: Record<string, unknown> | Array<unknown> | string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  requestId: string;
  data?: T;
  error?: ApiErrorPayload;
}

/**
 * Maps error code to user-friendly Portuguese message
 */
export function getFriendlyErrorMessage(code: ErrorCodeType, fallback?: string): string {
  switch (code) {
    case ErrorCode.AUTH_REQUIRED:
      return 'Autenticação necessária. Por favor, faça login para continuar.';
    case ErrorCode.AUTH_EXPIRED:
      return 'Sua sessão expirou. Por favor, faça login novamente.';
    case ErrorCode.FORBIDDEN:
      return 'Acesso negado. Você não tem permissão para realizar esta operação.';
    case ErrorCode.VALIDATION_ERROR:
      return 'Dados inválidos ou incompletos. Verifique os campos informados.';
    case ErrorCode.DUPLICATE_ACCOUNT:
      return 'Já existe uma conta cadastrada com este e-mail ou WhatsApp.';
    case ErrorCode.EMAIL_DELIVERY_FAILED:
      return 'Não foi possível enviar o e-mail no momento. Sua conta foi criada, tente reenviar depois.';
    case ErrorCode.NOT_FOUND:
      return 'Recurso não encontrado.';
    case ErrorCode.INVALID_RIDE_STATE:
      return 'Transição de corrida inválida para o estado atual.';
    case ErrorCode.INTERNAL_ERROR:
      return 'Erro interno do servidor. Tente novamente em instantes.';
    default:
      return fallback || 'Ocorreu um erro inesperado. Tente novamente.';
  }
}
