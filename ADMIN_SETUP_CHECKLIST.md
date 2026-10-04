# ✅ Admin Setup on Render - Complete Checklist

## THE ISSUE (Why you see "Invalid Credentials")

Admin user is **NOT automatically created** when the app deploys to Render.

You must manually:
1. Set environment variables
2. Run a provisioning command
3. Verify it worked
4. Remove the password from environment

---

## STEP-BY-STEP SOLUTION (Do this now on Render)

### ✅ STEP 1: Set Environment Variables in Render Dashboard

**Go to:** Render → Your Service → Environment

**Add these 3 variables:**

| Variable | Value |
|----------|-------|
| `ADMIN_NAME` | Your Admin Name |
| `ADMIN_EMAIL` | admin@vedaffiliate.com |
| `ADMIN_PASSWORD` | AdminPassword123456 |

**Important:** Password MUST be at least 12 characters ✓

Click **Save**

---

### ✅ STEP 2: Run Provisioning Command in Render Shell

**Go to:** Render → Your Service → **Shell** button (top right)

**Paste this:**
```
npm run admin:provision
```

**Press Enter** and wait for message:
```
Admin provisioned for admin@vedaffiliate.com. No password was printed.
```

---

### ✅ STEP 3: Verify Admin Created in MongoDB

**Go to:** MongoDB Atlas → Your Database → Collections → AdminUser

**Should see:**
- 1 document with `email: "admin@vedaffiliate.com"`
- `passwordHash` field (encrypted password)
- `status: "ACTIVE"`

---

### ✅ STEP 4: Remove Password from Render (Security)

**Go to:** Render → Your Service → Environment

**Delete these variables:**
- ❌ `ADMIN_NAME` 
- ❌ `ADMIN_EMAIL`
- ❌ `ADMIN_PASSWORD`

Click **Save**

Then click **Redeploy** to apply changes

---

## ✅ STEP 5: Test Admin Login

**Go to:** `https://your-app.onrender.com/admin`

**Login with:**
- Email: `admin@vedaffiliate.com`
- Password: `AdminPassword123456`

**Should see:** ✅ Admin Dashboard

---

## ⚠️ Troubleshooting

### Still saying "Invalid Credentials"?

**Check 1:** Did you run the provision command?
- Go to Render Shell → Look for "Admin provisioned" message

**Check 2:** Is password at least 12 characters?
- Shorter passwords are rejected

**Check 3:** Email case
- Admin email stored as lowercase automatically
- Try: `admin@vedaffiliate.com` (lowercase)

**Check 4:** MongoDB connection
- Go to Render Logs
- Look for "Connected to MongoDB" message
- If not there, check MONGODB_URI is correct

**Check 5:** Did you delete password variables?
- If password still in environment, redeploy service

---

## Complete Variable Reference

### For Render Environment:

**Permanent variables:**
```
NODE_ENV=production
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=at-least-32-random-characters
FRONTEND_URL=https://your-vercel-domain.vercel.app
```

**One-time only (then delete):**
```
ADMIN_NAME=Your Admin Name
ADMIN_EMAIL=admin@vedaffiliate.com
ADMIN_PASSWORD=YourSecurePassword123456
```

**Optional (for email/uploads):**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
CLOUDINARY_CLOUD_NAME=your-name
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
```

---

## 📋 Before You Start: Verify Requirements

- ✅ MONGODB_URI is set and working
- ✅ Node app deployed to Render
- ✅ Health check passing: `https://your-app.onrender.com/api/health`
- ✅ Frontend deployed to Vercel (if separate)

---

## How It Works (Behind the Scenes)

```
1. You set ADMIN_PASSWORD in Render Environment
   ↓
2. Run: npm run admin:provision
   ↓
3. Script reads ADMIN_PASSWORD and hashes it with bcrypt
   ↓
4. Creates/updates AdminUser document in MongoDB
   ↓
5. Store the hashed password in database
   ↓
6. Remove ADMIN_PASSWORD from environment (security)
   ↓
7. When you login:
   - User enters password
   - Compare with hashed password in database
   - If match → Login successful ✅
```

---

## Next Steps After Login

Once admin login works:
1. ✅ Go to Campaigns tab
2. ✅ Create a test campaign
3. ✅ Verify it appears on frontend
4. ✅ Test lead review workflow
5. ✅ Check audit logs

---

**Status:** Ready for Admin Setup  
**Time Required:** 5-10 minutes  
**Difficulty:** Easy  
**Updated:** October 4, 2026
