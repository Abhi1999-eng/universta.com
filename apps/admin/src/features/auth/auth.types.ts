export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  roles: string[];
}

export interface ApiError {
  code: string;
  message: string;
  details: unknown;
}

export interface ApiEnvelope<T> {
  data: T | null;
  meta: unknown;
  error: ApiError | null;
  requestId: string;
  timestamp: string;
}

export interface AuthResponseData {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthenticatedAdmin;
}

export interface MeResponseData {
  user: AuthenticatedAdmin;
}

export class AuthClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string | null;

  constructor(
    message: string,
    options: { code?: string; status?: number; requestId?: string | null } = {},
  ) {
    super(message);
    this.name = 'AuthClientError';
    this.code = options.code ?? 'AUTH_REQUEST_FAILED';
    this.status = options.status ?? 0;
    this.requestId = options.requestId ?? null;
  }
}
