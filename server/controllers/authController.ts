import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { validateKyc, normalizeKyc } from '../utils/kyc.ts';
import { PartnerStore } from '../services/partnerStore.ts';
import { AdminUser } from '../models/AdminUser.ts';
import { signToken, verifyToken, getAuthCookieOptions, AUTH_COOKIE_NAME } from '../utils/jwt.ts';
import {
  generatePartnerId,
  generateReferralCode,
  isValidMobile,
} from '../utils/partnerIdGenerator.ts';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      fullName,
      mobile,
      email,
      city,
      state,
      pan,
      bankDetails,
      upiId,
      password,
      confirmPassword,
      referralCodeInput,
    } = req.body;

    // Field validations
    const errors: Record<string, string> = {};

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 3) {
      errors.fullName = 'Full Name must be at least 3 characters.';
    }

    if (!mobile || !isValidMobile(mobile)) {
      errors.mobile = 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210).';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim().toLowerCase())) {
      errors.email = 'Please provide a valid email address.';
    }

    if (!city || typeof city !== 'string' || city.trim().length < 2) {
      errors.city = 'City is required.';
    }

    if (!state || typeof state !== 'string' || state.trim().length < 2) {
      errors.state = 'State is required.';
    }

    if (!password || password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    } else if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
      errors.password = 'Password must contain at least one letter and one number.';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        success: false,
        message: 'Validation failed. Please correct the highlighted fields.',
        errors,
      });
      return;
    }

    // Legacy clients may still include complete KYC; new signup does not require it.
    const includesKyc = pan !== undefined || bankDetails !== undefined || upiId !== undefined;
    if (includesKyc) {
      const kycErrors = validateKyc({ pan, bankDetails, upiId });
      if (Object.keys(kycErrors).length) {
        res.status(400).json({ success: false, message: 'Please correct the KYC details.', errors: kycErrors });
        return;
      }
    }

    // Check for duplicate email or mobile
    const { duplicateEmail, duplicateMobile } = await PartnerStore.checkDuplicates(email, mobile);
    if (duplicateEmail) {
      res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in or use password reset.',
        field: 'email',
      });
      return;
    }
    if (duplicateMobile) {
      res.status(409).json({
        success: false,
        message: 'An account with this mobile number already exists. Please log in.',
        field: 'mobile',
      });
      return;
    }

    // Hash password with bcrypt salt 12
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate unique Partner ID & Referral Code
    let partnerId = generatePartnerId();
    let referralCode = generateReferralCode();

    // Ensure referral code is not duplicate
    let existingRef = await PartnerStore.findByReferralCode(referralCode);
    while (existingRef) {
      referralCode = generateReferralCode();
      existingRef = await PartnerStore.findByReferralCode(referralCode);
    }

    // Handle referral tracking (if referred by another partner)
    let referredBy = '';
    if (referralCodeInput && typeof referralCodeInput === 'string' && referralCodeInput.trim()) {
      const referrer = await PartnerStore.findByReferralCode(referralCodeInput.trim());
      if (referrer) {
        referredBy = referrer.partnerId;
      }
    }

    // Create partner
    const newPartner = await PartnerStore.create({
      partnerId,
      fullName: fullName.trim(),
      mobile: mobile.trim(),
      email: email.trim().toLowerCase(),
      city: city.trim(),
      state: state.trim(),
      ...(includesKyc ? normalizeKyc({ pan, bankDetails, upiId }) : {}),
      passwordHash,
      role: 'PARTNER',
      accountStatus: 'ACTIVE',
      kycStatus: 'PENDING', // Manual KYC verification only
      kycRejectionReason: '',
      referralCode,
      referredBy,
    });

    // Generate JWT token
    const token = signToken({
      id: newPartner._id || newPartner.id,
      partnerId: newPartner.partnerId,
      email: newPartner.email,
      role: newPartner.role,
    });

    // Set secure HTTP-only cookie
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

    res.status(201).json({
      success: true,
      message: 'Partner registration successful. Welcome to VED AFFILIATE PVT. LIMITED.',
      data: {
        partner: newPartner,
        token,
      },
    });
  } catch (error) {
    next(error);
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

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid registered email address.',
      });
      return;
    }

    const partner = await PartnerStore.findByEmailOrMobile(email.trim(), true);
    if (partner) {
      // Generate secure 32-byte hex reset token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await PartnerStore.updateById(partner._id || partner.id, {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: expires,
      } as any);

      // In production with configured SMTP credentials, send the email here.
      // We log in development environment only if appropriate
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[VED AUTH] Password reset token generated for ${partner.email}: ${rawToken}`);
      }
    }

    // Always return safe non-enumerating message to prevent account discovery
    res.status(200).json({
      success: true,
      message: 'If an account with that email address is registered, instructions to reset your password have been sent.',
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Password reset token is required.',
      });
      return;
    }

    if (!password || password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long with letters and numbers.',
      });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
      return;
    }

    const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const targetPartner = await PartnerStore.findByResetToken(hashedToken);
    if (!targetPartner) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token. Please request a new link.',
      });
      return;
    }

    // Hash new password
    const newHash = await bcrypt.hash(password, 12);
    await PartnerStore.updatePassword(targetPartner._id || targetPartner.id, newHash);

    res.status(200).json({
      success: true,
      message: 'Password has been successfully updated. You can now log in with your new credentials.',
    });
  } catch (error) {
    next(error);
  }
};
