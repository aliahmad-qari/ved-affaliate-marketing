# Admin Setup - Free Render Tier (No Shell Access)

## Problem
Free Render doesn't have Shell access. How to add admin without Shell?

## Solution
**Provision admin locally on your machine**, then deploy. The admin will already exist in MongoDB.

---

## Method 1: Local Provisioning (RECOMMENDED - 2 Minutes)

### Step 1: Update .env File Locally

In your `.env` file (on your computer), add:
```
ADMIN_NAME=Your Admin Name
ADMIN_EMAIL=admin@vedaffiliate.com
ADMIN_PASSWORD=AdminPassword123456
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ved_affiliate
NODE_ENV=development
```

**Important:** Make sure `MONGODB_URI` is the SAME connection string as Render will use.

### Step 2: Run Provision Command Locally

Open PowerShell in your project folder and run:
```bash
npm run admin:provision
```

**Expected output:**
```
Admin provisioned for admin@vedaffiliate.com. No password was printed.
```

✅ **Done!** Admin is now in MongoDB (same database Render uses)

### Step 3: Deploy to Render

Just deploy normally to Render. The admin already exists in the database!

### Step 4: Login

Go to: `https://your-render-app.onrender.com/admin`

Login with:
- Email: `admin@vedaffiliate.com`
- Password: `AdminPassword123456`

✅ Works!

---

## Method 2: Web-Based Setup Form (If you prefer)

Alternative: Create a temporary setup endpoint on your app.

### Option A: Use Existing API to Add Admin Manually

Create admin through direct database connection:

```bash
# In MongoDB Atlas Web Shell:
# Go to: MongoDB Atlas → Database → Collections → AdminUser → Insert Document

{
  "fullName": "Your Admin Name",
  "email": "admin@vedaffiliate.com",
  "passwordHash": "$2a$12$...", // bcrypt hashed password
  "status": "ACTIVE",
  "createdAt": new Date(),
  "updatedAt": new Date()
}
```

But this requires knowing bcrypt hash... so not ideal.

---

## Method 3: Quick API Endpoint (For Setup Only)

If you want a web form to add admin on Render:

### Step 1: Create Setup Endpoint

Add this to `server/routes/setupRoutes.ts`:

```typescript
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AdminUser } from '../models/AdminUser.ts';

const router = Router();

// TEMPORARY: Remove after first use!
router.post('/setup-admin', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;
    
    if (!email || !password || !fullName || password.length < 12) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, fullName, and password (min 12 chars) required' 
      });
    }

    const existingCount = await AdminUser.countDocuments();
    if (existingCount >= 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Maximum 3 admins allowed' 
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await AdminUser.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: { fullName, passwordHash, status: 'ACTIVE' } },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, message: `Admin created: ${email}` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
```

### Step 2: Add Route to app.ts

```typescript
import setupRoutes from './routes/setupRoutes.ts';
// ...
app.use('/api/setup', setupRoutes);
```

### Step 3: Use the Endpoint

Go to: `https://your-render-app.onrender.com/api/setup/setup-admin`

Send POST request with JSON body:
```json
{
  "email": "admin@vedaffiliate.com",
  "password": "AdminPassword123456",
  "fullName": "Your Admin Name"
}
```

**Using Postman or curl:**
```bash
curl -X POST https://your-render-app.onrender.com/api/setup/setup-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vedaffiliate.com","password":"AdminPassword123456","fullName":"Admin"}'
```

### Step 4: Delete the Endpoint

After admin is created, **delete or disable** the setup endpoint for security!

---

## ⭐ BEST APPROACH FOR YOU (Free Render)

### Step-by-Step:

1. **On your computer**, open project folder in PowerShell

2. **Create/update `.env` file** with:
   ```
   ADMIN_NAME=Your Name
   ADMIN_EMAIL=admin@vedaffiliate.com
   ADMIN_PASSWORD=YourSecurePassword123456
   MONGODB_URI=your-mongodb-connection-string
   NODE_ENV=development
   ```

3. **Run locally:**
   ```bash
   npm run admin:provision
   ```

4. **Wait for:** "Admin provisioned for admin@vedaffiliate.com"

5. **Deploy to Render** (admin already exists in DB)

6. **Login at:** `https://your-app.onrender.com/admin`
   - Email: `admin@vedaffiliate.com`
   - Password: `YourSecurePassword123456`

✅ **Done!**

---

## FAQ

**Q: Will this work if Render and my computer use same MongoDB?**  
A: Yes! Both connect to the same MongoDB database.

**Q: Do I need to set ADMIN variables in Render Environment?**  
A: No! Only locally on your computer.

**Q: Can I change admin password later?**  
A: Yes - run provision script again with new password.

**Q: What if I forget the password?**  
A: Run provision script again with new password.

**Q: Is this secure?**  
A: Yes, passwords are bcrypt-hashed. Just don't commit `.env` to git.

---

## Troubleshooting

**Error: "MONGODB_URI is required"**
- Make sure `.env` has `MONGODB_URI`
- Check MongoDB connection string is correct
- Test: Can you connect to MongoDB from your computer?

**Error: "Cannot connect to MongoDB"**
- Verify MongoDB Atlas Network Access whitelist
- Add your computer's IP: Go to MongoDB → Network Access → Add IP
- Or add `0.0.0.0/0` temporarily (less secure but works)

**Admin created but login still fails**
- Check `.env` has same email/password
- Wait 2-3 seconds for database to sync
- Clear browser cache and cookies
- Try different browser

---

## Alternative: Build Admin Dashboard UI for Setup

Want a web form instead? Create a temporary setup page:

```typescript
// POST /api/setup/create-admin (from form)
// Then delete the endpoint after use
```

**Should I implement this?** Let me know and I can add it!

---

**Recommended:** Use **Method 1** (Local Provisioning) - fastest and safest!

Any issues? Let me know!
