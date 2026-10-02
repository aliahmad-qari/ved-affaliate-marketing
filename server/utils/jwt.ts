import jwt from 'jsonwebtoken';
import { CookieOptions } from 'express';
import { AuthTokenPayload } from '../types/index.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'ved-affiliate-pvt-ltd-production-jwt-key-2026-auth';
export const AUTH_COOKIE_NAME = 'ved_auth_token';

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function getAuthCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    // When frontend is hosted on Vercel and backend on Render, sameSite: 'none' is required for cross-domain cookies with HTTPS.
    // In local development, 'lax' is used.
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
}
