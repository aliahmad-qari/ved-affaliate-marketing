import { Request, Response, NextFunction } from 'express';
import { verifyToken, AUTH_COOKIE_NAME } from '../utils/jwt.ts';
import { PartnerStore } from '../services/partnerStore.ts';
import { AdminUser } from '../models/AdminUser.ts';
import { UserRole } from '../types/index.ts';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: any;
      authRole?: UserRole;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check HTTP-only cookie first
    if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
      token = req.cookies[AUTH_COOKIE_NAME];
    }

    // 2. Check Authorization Bearer header as fallback
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to access this resource.',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    const payload = verifyToken(token);
    if (!payload || !payload.id) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired session. Please log in again.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    if (payload.role === 'ADMIN') {
      const admin: any = await AdminUser.findById(payload.id).select('+sessionsInvalidatedAt').exec();
      if (!admin || admin.status !== 'ACTIVE') {
        res.status(401).json({ success: false, message: 'Admin account is unavailable.', code: 'USER_NOT_FOUND' });
        return;
      }
      if (admin.sessionsInvalidatedAt && (!payload.issuedAtMs || payload.issuedAtMs <= admin.sessionsInvalidatedAt.getTime())) {
        res.status(401).json({ success: false, message: 'Session has ended. Please log in again.', code: 'TOKEN_EXPIRED' });
        return;
      }
      req.authRole = 'ADMIN';
      req.user = { ...admin.toJSON(), _id: admin._id.toString(), role: 'ADMIN' };
      next();
      return;
    }

    if (payload.role !== 'PARTNER') {
      res.status(401).json({ success: false, message: 'Invalid account role.', code: 'TOKEN_EXPIRED' });
      return;
    }
    req.authRole = 'PARTNER';

    const invalidatedAt = await PartnerStore.getSessionsInvalidatedAt(payload.id);
    if (invalidatedAt && (!payload.issuedAtMs || payload.issuedAtMs <= invalidatedAt)) {
      res.status(401).json({ success: false, message: 'Session has ended. Please log in again.', code: 'TOKEN_EXPIRED' });
      return;
    }

    const partner = await PartnerStore.findById(payload.id);
    if (!partner) {
      res.status(401).json({
        success: false,
        message: 'Account not found. Please log in again.',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    if (partner.accountStatus !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        message: 'Your partner account is not active. Please contact support.',
        code: 'ACCOUNT_SUSPENDED',
      });
      return;
    }

    // Attach user to request
    req.user = partner;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(requiredRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    if (req.authRole !== requiredRole) {
      res.status(403).json({
        success: false,
        message: `Forbidden. This operation requires ${requiredRole} permissions.`,
        code: 'ROLE_UNAUTHORIZED',
      });
      return;
    }

    next();
  };
}
