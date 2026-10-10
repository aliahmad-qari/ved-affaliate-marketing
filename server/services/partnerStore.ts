import mongoose from 'mongoose';
import { Partner, maskPan, maskAccountNumber } from '../models/Partner.ts';
import { IPartner } from '../types/index.ts';

// In-memory fallback map: key is email (lowercased)
const memoryPartners = new Map<string, IPartner>();

function sanitizeMemoryPartner(partner: any, includePassword = false): any {
  if (!includePassword) delete partner.passwordHash;
  delete partner.resetPasswordToken;
  delete partner.resetPasswordExpires;
  delete partner.sessionsInvalidatedAt;
  if (partner.pan) {
    partner.maskedPan = maskPan(partner.pan);
    delete partner.pan;
  }
  if (partner.bankDetails?.accountNumber) {
    partner.bankDetails.maskedAccountNumber = maskAccountNumber(partner.bankDetails.accountNumber);
    delete partner.bankDetails.accountNumber;
  }
  return partner;
}

// Checks if MongoDB Atlas is ready
export function isMongooseReady(): boolean {
  const connected = mongoose.connection.readyState === 1;
  if (!connected && process.env.NODE_ENV === 'production') {
    const error: any = new Error('MongoDB is unavailable. Please try again shortly.');
    error.status = 503;
    throw error;
  }
  return connected;
}

export const PartnerStore = {
  async findByEmailOrMobile(identifier: string, includePassword = false): Promise<any | null> {
    const cleanId = identifier.trim().toLowerCase();

    if (isMongooseReady()) {
      let query = Partner.findOne({
        $or: [{ email: cleanId }, { mobile: identifier.trim() }],
      });
      if (includePassword) {
        query = query.select('+passwordHash +resetPasswordToken +resetPasswordExpires');
      }
      return query.exec();
    }

    // Memory fallback
    for (const partner of memoryPartners.values()) {
      if (partner.email === cleanId || partner.mobile === identifier.trim()) {
        const copy = JSON.parse(JSON.stringify(partner));
        return sanitizeMemoryPartner(copy, includePassword);
      }
    }
    return null;
  },

  async findById(id: string, includePassword = false): Promise<any | null> {
    if (isMongooseReady()) {
      let query = Partner.findById(id);
      if (includePassword) {
        query = query.select('+passwordHash +resetPasswordToken +resetPasswordExpires');
      }
      return query.exec();
    }

    for (const partner of memoryPartners.values()) {
      if ((partner as any)._id === id || partner.partnerId === id) {
        const copy = JSON.parse(JSON.stringify(partner));
        return sanitizeMemoryPartner(copy, includePassword);
      }
    }
    return null;
  },

  async findByPartnerId(partnerId: string): Promise<any | null> {
    if (isMongooseReady()) {
      return Partner.findOne({ partnerId: partnerId.toUpperCase() }).exec();
    }

    for (const partner of memoryPartners.values()) {
      if (partner.partnerId === partnerId.toUpperCase()) {
        const copy = JSON.parse(JSON.stringify(partner));
        return sanitizeMemoryPartner(copy);
      }
    }
    return null;
  },

  async findByReferralCode(code: string): Promise<any | null> {
    if (isMongooseReady()) {
      return Partner.findOne({ referralCode: code.toUpperCase() }).exec();
    }

    for (const partner of memoryPartners.values()) {
      if (partner.referralCode === code.toUpperCase()) {
        const copy = JSON.parse(JSON.stringify(partner));
        return sanitizeMemoryPartner(copy);
      }
    }
    return null;
  },

  async findByResetToken(hashedToken: string): Promise<any | null> {
    const now = new Date();
    if (isMongooseReady()) {
      return Partner.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: now },
      }).select('+passwordHash +resetPasswordToken +resetPasswordExpires').exec();
    }

    for (const partner of memoryPartners.values()) {
      if (
        partner.resetPasswordToken === hashedToken &&
        partner.resetPasswordExpires &&
        new Date(partner.resetPasswordExpires) > now
      ) {
        return partner;
      }
    }
    return null;
  },

  async findReferredPartners(partnerId: string): Promise<any[]> {
    const pId = partnerId.toUpperCase();
    if (isMongooseReady()) {
      return Partner.find({ referredBy: pId })
        .select('partnerId fullName mobile email createdAt')
        .sort({ createdAt: -1 })
        .exec();
    }

    const list: any[] = [];
    for (const partner of memoryPartners.values()) {
      if (partner.referredBy === pId) {
        list.push({
          partnerId: partner.partnerId,
          fullName: partner.fullName,
          mobile: partner.mobile,
          email: partner.email,
          createdAt: partner.createdAt,
        });
      }
    }
    return list;
  },

  async checkDuplicates(email: string, mobile: string): Promise<{ duplicateEmail: boolean; duplicateMobile: boolean }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.trim();

    if (isMongooseReady()) {
      const existingEmail = await Partner.findOne({ email: cleanEmail }).select('_id').exec();
      const existingMobile = await Partner.findOne({ mobile: cleanMobile }).select('_id').exec();
      return {
        duplicateEmail: !!existingEmail,
        duplicateMobile: !!existingMobile,
      };
    }

    let duplicateEmail = false;
    let duplicateMobile = false;

    for (const partner of memoryPartners.values()) {
      if (partner.email === cleanEmail) duplicateEmail = true;
      if (partner.mobile === cleanMobile) duplicateMobile = true;
    }

    return { duplicateEmail, duplicateMobile };
  },

  async create(partnerData: IPartner): Promise<any> {
    if (isMongooseReady()) {
      const partner = new Partner(partnerData);
      await partner.save();
      return partner;
    }

    // Memory fallback
    const id = `mem_ptr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record = {
      ...partnerData,
      _id: id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryPartners.set(partnerData.email.toLowerCase(), record);

    const safeCopy = JSON.parse(JSON.stringify(record));
    return sanitizeMemoryPartner(safeCopy);
  },

  async submitKyc(id: string, details: Pick<IPartner, 'pan' | 'bankDetails' | 'upiId'>): Promise<any | null> {
    const updates = { ...details, kycStatus: 'PENDING' as const, kycRejectionReason: '' };
    if (isMongooseReady()) {
      // Atomic status guard: an admin verification wins over a stale partner form.
      return Partner.findOneAndUpdate({ _id: id, kycStatus: { $ne: 'VERIFIED' } }, { $set: updates }, { new: true, runValidators: true }).exec();
    }
    for (const partner of memoryPartners.values()) {
      if ((partner as any)._id === id && partner.kycStatus !== 'VERIFIED') return this.updateById(id, updates);
    }
    return null;
  },

  async updateById(id: string, updates: Partial<IPartner>): Promise<any | null> {
    if (isMongooseReady()) {
      if (updates.bankDetails || updates.upiId) {
        return Partner.findOneAndUpdate({ _id: id, kycStatus: { $ne: 'VERIFIED' } }, { $set: updates }, { new: true, runValidators: true }).exec();
      }
      return Partner.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).exec();
    }

    // Memory fallback
    for (const [emailKey, partner] of memoryPartners.entries()) {
      if ((partner as any)._id === id || partner.partnerId === id) {
        if ((updates.bankDetails || updates.upiId) && partner.kycStatus === 'VERIFIED') return null;
        const updated = {
          ...partner,
          ...updates,
          updatedAt: new Date(),
        };
        memoryPartners.set(emailKey, updated);
        const safeCopy = JSON.parse(JSON.stringify(updated));
        return sanitizeMemoryPartner(safeCopy);
      }
    }
    return null;
  },

  async getSessionsInvalidatedAt(id: string): Promise<number> {
    if (isMongooseReady()) {
      const doc: any = await Partner.findById(id).select('+sessionsInvalidatedAt').exec();
      return doc?.sessionsInvalidatedAt ? new Date(doc.sessionsInvalidatedAt).getTime() : 0;
    }
    for (const partner of memoryPartners.values()) {
      if ((partner as any)._id === id || partner.partnerId === id) {
        return (partner as any).sessionsInvalidatedAt || 0;
      }
    }
    return 0;
  },

  async invalidateSessions(id: string): Promise<void> {
    if (isMongooseReady()) {
      await Partner.findByIdAndUpdate(id, { $set: { sessionsInvalidatedAt: new Date() } }).exec();
      return;
    }
    for (const partner of memoryPartners.values()) {
      if ((partner as any)._id === id || partner.partnerId === id) {
        (partner as any).sessionsInvalidatedAt = Date.now();
      }
    }
  },

  async updatePassword(id: string, newPasswordHash: string): Promise<boolean> {
    if (isMongooseReady()) {
      await Partner.findByIdAndUpdate(id, {
        $set: {
          passwordHash: newPasswordHash,
          resetPasswordToken: undefined,
          resetPasswordExpires: undefined,
        },
      }).exec();
      return true;
    }

    for (const [emailKey, partner] of memoryPartners.entries()) {
      if ((partner as any)._id === id || partner.partnerId === id) {
        partner.passwordHash = newPasswordHash;
        delete partner.resetPasswordToken;
        delete partner.resetPasswordExpires;
        partner.updatedAt = new Date();
        memoryPartners.set(emailKey, partner);
        return true;
      }
    }
    return false;
  },
};
