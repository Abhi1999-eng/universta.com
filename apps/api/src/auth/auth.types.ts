import type { Request } from 'express';

export const AUTH_ISSUER = 'universta';
export const AUTH_AUDIENCE = 'universta-admin-api';
/** A student token names a different audience, so it fails the admin guard's
 * `verifyAsync({ audience })` check outright. Separation is cryptographic
 * rather than a role comparison someone can forget to write. */
export const STUDENT_AUTH_AUDIENCE = 'universta-student-api';
export const ACCESS_TOKEN_TYPE = 'access';
export const REFRESH_TOKEN_TYPE = 'refresh';
export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';
export const STUDENT_ROLE = 'STUDENT';

/** Which portal a session belongs to. Everything about issuing, rotating and
 * revoking a session is shared; only eligibility and audience differ. */
export type AuthAudience = 'ADMIN' | 'STUDENT';

export const AUDIENCE_CONFIG: Record<
  AuthAudience,
  { jwtAudience: string; requiredRole: string; loginDescription: string }
> = {
  ADMIN: {
    jwtAudience: AUTH_AUDIENCE,
    requiredRole: SUPER_ADMIN_ROLE,
    loginDescription: 'Super Admin login',
  },
  STUDENT: {
    jwtAudience: STUDENT_AUTH_AUDIENCE,
    requiredRole: STUDENT_ROLE,
    loginDescription: 'Student login',
  },
};

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

/** Kept under its original name because Admin code imports it everywhere; a
 * student session carries the same shape. */
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
