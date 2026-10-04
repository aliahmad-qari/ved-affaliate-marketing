import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { AdminUser } from '../models/AdminUser.ts';

const router = Router();

/**
 * TEMPORARY SETUP ENDPOINT - Delete after first use!
 * Use this to create admin when you can't access Shell
 * 
 * POST /api/admin-setup
 * Body: { "email": "admin@example.com", "password": "SecurePass123456", "name": "Admin Name" }
 * 
 * ⚠️ SECURITY: Delete this file and remove route after creating admin!
 */

router.post('/admin-setup', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: email, password, name',
      });
      return;
    }

    const emailLower = String(email).trim().toLowerCase();
    const passwordStr = String(password).trim();
    const nameTrim = String(name).trim();

    if (passwordStr.length < 12) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 12 characters',
      });
      return;
    }

    // Check admin limit
    const existingCount = await AdminUser.countDocuments();
    if (existingCount >= 3) {
      res.status(400).json({
        success: false,
        message: 'Maximum 3 admin users allowed',
      });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(passwordStr, 12);

    // Create or update admin
    const admin = await AdminUser.findOneAndUpdate(
      { email: emailLower },
      {
        $set: {
          fullName: nameTrim,
          passwordHash,
          status: 'ACTIVE',
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: `Admin created successfully for ${emailLower}`,
      data: {
        id: admin._id,
        email: admin.email,
        fullName: admin.fullName,
        status: admin.status,
      },
    });
  } catch (error: any) {
    console.error('Admin setup error:', error.message);
    res.status(500).json({
      success: false,
      message: `Error creating admin: ${error.message}`,
    });
  }
});

export default router;
