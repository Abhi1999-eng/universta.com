import type { Request } from 'express';

export const AUTH_ISSUER = 'universta';
export const AUTH_AUDIENCE = 'universta-admin-api';
export const ACCESS_TOKEN_TYPE = 'access';
export const REFRESH_TOKEN_TYPE = 'refresh';
export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  type: typeof ACCESS_TOKEN_TYPE;
  jti: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: typeof REFRESH_TOKEN_TYPE;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  roles: string[];
}

export type AuthenticatedRequest = Request & {
  requestId?: string;
  user?: AccessTokenPayload;
  cookies?: Record<string, string | undefined>;
};

export interface AuthRequestMetadata {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuthResponseData {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthenticatedAdmin;
}
