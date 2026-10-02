import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { PartnerStore } from '../services/partnerStore.ts';
import { isValidUpi, isValidIfsc } from '../utils/partnerIdGenerator.ts';

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  // req.user is populated by requireAuth
  res.status(200).json({
    success: true,
    data: req.user,
  });
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.user._id || req.user.id;
    const body = req.body;

    // Security check: Reject any attempt to update forbidden fields
    const forbiddenFields = [
      'partnerId',
      'role',
      'email',
      'pan',
      'accountStatus',
      'kycStatus',
      'kycRejectionReason',
      'referralCode',
      'referredBy',
      'passwordHash',
      'earnings',
      'wallet',
      'leads',
    ];

    for (const field of forbiddenFields) {
      if (body[field] !== undefined) {
        res.status(400).json({
          success: false,
          message: `Forbidden: Field '${field}' cannot be updated directly by partner.`,
          code: 'FORBIDDEN_FIELD_UPDATE',
        });
        return;
      }
    }

    const updates: Record<string, any> = {};

    if (body.fullName !== undefined) {
      if (typeof body.fullName !== 'string' || body.fullName.trim().length < 3) {
        res.status(400).json({
          success: false,
          message: 'Full Name must be at least 3 characters.',
        });
        return;
      }
      updates.fullName = body.fullName.trim();
    }

    if (body.city !== undefined) {
      if (typeof body.city !== 'string' || body.city.trim().length < 2) {
        res.status(400).json({ success: false, message: 'Valid city name is required.' });
        return;
      }
      updates.city = body.city.trim();
    }

    if (body.state !== undefined) {
      if (typeof body.state !== 'string' || body.state.trim().length < 2) {
        res.status(400).json({ success: false, message: 'Valid state name is required.' });
        return;
      }
      updates.state = body.state.trim();
    }

    if (body.upiId !== undefined) {
      if (!isValidUpi(body.upiId)) {
        res.status(400).json({
          success: false,
          message: 'Please provide a valid UPI ID (e.g. partner@okhdfcbank).',
        });
        return;
      }
      updates.upiId = body.upiId.trim().toLowerCase();
    }

    if (body.bankDetails !== undefined) {
      // If KYC is already VERIFIED, bank details cannot be edited without Admin re-verification
      if (req.user.kycStatus === 'VERIFIED') {
        res.status(400).json({
          success: false,
          message: 'Your KYC is already VERIFIED. To change bank details, please contact Support.',
        });
        return;
      }

      const { accountHolderName, accountNumber, ifscCode, bankName } = body.bankDetails;
      if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
        res.status(400).json({
          success: false,
          message: 'All bank details fields (Account Holder, Account Number, IFSC, Bank Name) are required.',
        });
        return;
      }
      if (!isValidIfsc(ifscCode)) {
        res.status(400).json({
          success: false,
          message: 'Invalid IFSC code format.',
        });
        return;
      }

      updates.bankDetails = {
        accountHolderName: accountHolderName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        bankName: bankName.trim(),
      };
    }

    const updatedPartner = await PartnerStore.updateById(partnerId, updates);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: updatedPartner,
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerId = req.user._id || req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Current password, new password, and confirmation are required.',
      });
      return;
    }

    if (newPassword.length < 8 || !/(?=.*[a-zA-Z])(?=.*[0-9])/.test(newPassword)) {
      res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long with letters and numbers.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match.',
      });
      return;
    }

    // Retrieve partner with password hash
    const partner = await PartnerStore.findById(partnerId, true);
    if (!partner || !partner.passwordHash) {
      res.status(404).json({
        success: false,
        message: 'Partner account not found.',
      });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, partner.passwordHash);
    if (!isMatch) {
      res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await PartnerStore.updatePassword(partnerId, newHash);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    next(error);
  }
};
