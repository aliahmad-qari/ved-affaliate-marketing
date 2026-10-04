import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { AdminUser } from '../models/AdminUser.ts';
import { AUTH_COOKIE_NAME, getAuthCookieOptions, signToken } from '../utils/jwt.ts';

export const adminLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    const admin: any = await AdminUser.findOne({ email }).select('+passwordHash +sessionsInvalidatedAt').exec();
    if (!admin || admin.status !== 'ACTIVE' || !(await bcrypt.compare(password, admin.passwordHash))) {
      res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
      return;
    }

    admin.lastLoginAt = new Date();
    await admin.save();
    const token = signToken({ id: admin._id.toString(), email: admin.email, role: 'ADMIN' });
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
    res.status(200).json({ success: true, data: { admin: admin.toJSON() } });
  } catch (error) {
    next(error);
  }
};

export const adminMe = (req: Request, res: Response): void => {
  res.status(200).json({ success: true, data: req.user });
};