import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { PartnerStore } from '../services/partnerStore.ts';
import { beginPartnerSignup, resendPartnerSignupOtp, SIGNUP_OTP_GENERIC_MESSAGE, verifyPartnerSignupOtp } from '../services/partnerSignupOtp.ts';
import { AdminUser } from '../models/AdminUser.ts';
import { signToken, verifyToken, getAuthCookieOptions, AUTH_COOKIE_NAME } from '../utils/jwt.ts';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    const result = await beginPartnerSignup(req.body || {});
    if (result.errors) {
      res.status(400).json({ success: false, message: 'Validation failed. Please correct the highlighted fields.', errors: result.errors });
      return;
    }
    if (result.deliveryFailed) {
      res.status(503).json({ success: false, message: 'We could not send the verification email. Please try again shortly.' });
      return;
    }
    res.status(202).json({ success: true, message: SIGNUP_OTP_GENERIC_MESSAGE });
  } catch (error) {
    // Do not expose provider, email, or database details in a public signup response.
    console.error('[VED SIGNUP] Verification request could not be completed.');
    res.status(503).json({ success: false, message: 'Email verification is temporarily unavailable. Please try again later.' });
  }
};

export const resendSignupOtp = async (req: Request, res: Response): Promise<void> => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  try {
    const deliveryFailed = await resendPartnerSignupOtp(req.body?.email);
    if (deliveryFailed) {
      res.status(503).json({ success: false, message: 'We could not send the verification email. Please try again shortly.' });
      return;
    }
    res.status(202).json({ success: true, message: SIGNUP_OTP_GENERIC_MESSAGE });
  } catch {
    console.error('[VED SIGNUP] Verification request could not be completed.');
    res.status(503).json({ success: false, message: 'Email verification is temporarily unavailable. Please try again later.' });
  }
};

export const verifySignupOtp = async (req: Request, res: Response): Promise<void> => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  try {
    const result = await verifyPartnerSignupOtp(req.body?.email, req.body?.otp);
    if (!result) {
      res.status(400).json({ success: false, message: 'The verification code is invalid or expired. Request a new code and try again.' });
      return;
    }
    res.cookie(AUTH_COOKIE_NAME, result.token, getAuthCookieOptions());
    res.status(200).json({ success: true, message: 'Email verified. Your partner account is ready.', data: result });
  } catch {
    console.error('[VED SIGNUP] Verification request could not be completed.');
    res.status(503).json({ success: false, message: 'Email verification is temporarily unavailable. Please try again later.' });
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      res.status(400).json({
        success: false,
        message: 'Please enter your registered Email address or 10-digit Mobile number.',
      });
      return;
    }

    if (!password || typeof password !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Password is required.',
      });
      return;
    }

    // Lookup partner by Email OR Mobile
    const partner = await PartnerStore.findByEmailOrMobile(identifier, true);
    if (!partner || !partner.passwordHash) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please verify your Email/Mobile and Password.',
      });
      return;
    }

    // Verify bcrypt password
    const isMatch = await bcrypt.compare(password, partner.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please verify your Email/Mobile and Password.',
      });
      return;
    }

    if (partner.accountStatus === 'SUSPENDED') {
      res.status(403).json({
        success: false,
        message: 'Your partner account has been suspended by administration. Please contact support.',
      });
      return;
    }

    // Generate JWT token
    const token = signToken({
      id: partner._id || partner.id,
      partnerId: partner.partnerId,
      email: partner.email,
      role: partner.role,
    });

    // Set secure HTTP-only cookie
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    // Sanitize output
    const safePartner = typeof partner.toJSON === 'function' ? partner.toJSON() : { ...partner };
    delete safePartner.passwordHash;
    delete safePartner.resetPasswordToken;
    delete safePartner.resetPasswordExpires;

    res.status(200).json({
      success: true,
      message: 'Sign-in successful. Welcome back.',
      data: {
        partner: safePartner,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : undefined;
  const payload = verifyToken(req.cookies?.[AUTH_COOKIE_NAME] || bearer || '');
  const options = getAuthCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, { ...options, maxAge: 0 });
  try {
    if (payload?.id) {
      if (payload.role === 'ADMIN') {
        await AdminUser.findByIdAndUpdate(payload.id, { $set: { sessionsInvalidatedAt: new Date() } }).exec();
      } else {
        await PartnerStore.invalidateSessions(payload.id);
      }
    }
  } catch (error) {
    next(error);
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Signed out successfully.',
  });
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
};
