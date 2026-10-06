import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { Lead } from '../models/Lead.ts';
import { AuditLog } from '../models/AuditLog.ts';

export const updateEnquiryProcess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const processStatus = req.body?.processStatus;
  if (!['IN_PROCESS', 'NOT_SUBMITTED'].includes(processStatus)) {
    res.status(400).json({ success: false, message: 'Process status must be IN_PROCESS or NOT_SUBMITTED.' });
    return;
  }
  let session: mongoose.ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    let updated: any;
    await session.withTransaction(async () => {
      const lead: any = await Lead.findById(req.params.id).session(session!).exec();
      if (!lead || lead.submittedData?.source !== 'CUSTOMER_FORM') {
        throw Object.assign(new Error('Customer enquiry not found.'), { status: 404 });
      }
      if (!['PENDING', 'VERIFIED'].includes(lead.status)) {
        throw Object.assign(new Error('A reviewed enquiry cannot be changed back to in process or not submitted.'), { status: 409 });
      }
      const before = { processStatus: lead.submittedData.processStatus };
      lead.submittedData = { ...lead.submittedData, processStatus };
      lead.reviewedBy = String(req.user._id);
      await lead.save({ session });
      await AuditLog.create([{
        adminId: String(req.user._id), adminEmail: req.user.email, action: 'ENQUIRY_PROCESS_UPDATED',
        entityType: 'Lead', entityId: String(lead._id), before, after: { processStatus }, ipAddress: req.ip,
      }], { session });
      updated = lead.toJSON();
    });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
  finally { await session?.endSession(); }
};
