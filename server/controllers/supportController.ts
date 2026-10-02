import { Request, Response, NextFunction } from 'express';
import { SupportTicket } from '../models/SupportTicket.ts';
import { getDbStatus } from '../config/db.ts';

export const createSupportTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, mobile, subject, message } = req.body;

    if (!name || !email || !mobile || !subject || !message) {
      res.status(400).json({
        success: false,
        message: 'All fields (name, email, mobile, subject, and message) are required.',
      });
      return;
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
      return;
    }

    // Mobile number basic check (Indian 10-digit mobile)
    const cleanMobile = mobile.replace(/[^0-9]/g, '');
    if (cleanMobile.length < 10) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit mobile contact number.',
      });
      return;
    }

    const { isConnected } = getDbStatus();
    let ticketId = `VED-TKT-${Date.now().toString().slice(-6)}`;

    if (isConnected) {
      const ticket = await SupportTicket.create({
        name,
        email,
        mobile: cleanMobile,
        subject,
        message,
        status: 'OPEN',
      });
      ticketId = ticket._id.toString();
    }

    res.status(201).json({
      success: true,
      message: 'Support ticket received successfully. The VED Partner Support team will respond within 24 business hours.',
      data: {
        ticketId,
        subject,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
