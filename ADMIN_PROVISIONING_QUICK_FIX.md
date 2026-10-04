# Admin Provisioning Quick Fix - Invalid Credentials Issue

## Problem
Getting "Invalid admin credentials" when trying to log in to admin panel on Render/production.

---

## Root Cause
The admin user was **never provisioned** in the database, or provisioned with different credentials than what you're using.

---

## Quick Fix (5 Minutes)

### Step 1: Set Environment Variables in Render Dashboard

Go to **Render → Your Service → Environment**

Add these 3 variables:
```
ADMIN_NAME=Your Admin Name
ADMIN_EMAIL=admin@vedaffiliate.com
ADMIN_PASSWORD=AdminPassword123456
```

**Important:** Password must be **at least 12 characters**

Save the changes.

### Step 2: Run Provision Command

Go to **Render → Your Service → Shell** (top right)

Paste this command:
```bash
node -e "require('dotenv').config(); const mongoose = require('mongoose'); const bcrypt = require('bcryptjs'); const AdminUser = require('./server/models/AdminUser.ts').AdminUser; (async () => { await mongoose.connect(process.env.MONGODB_URI); const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12); await AdminUser.findOneAndUpdate({ email: process.env.ADMIN_EMAIL.toLowerCase() }, { \$set: { fullName: process.env.ADMIN_NAME, passwordHash, status: 'ACTIVE' } }, { upsert: true }); console.log('Admin provisioned!'); process.exit(0); })().catch(e => { console.error(e.message); process.exit(1); });"
```

**Or simpler:** Use the built-in script:
```bash
npm run admin:provision
```

Wait for output: `Admin provisioned for admin@vedaffiliate.com. No password was printed.`

### Step 3: Remove Environment Variables (Security)

Go back to **Render → Environment**

Delete these 3 variables:
- `ADMIN_NAME`
- `ADMIN_EMAIL`  
- `ADMIN_PASSWORD`

Save and redeploy service.

### Step 4: Test Login

Go to: `https://your-render-app.onrender.com/admin` (or wherever your frontend is)

Login with:
- Email: `admin@vedaffiliate.com`
- Password: `AdminPassword123456`

✅ Should work now!

---

## What Went Wrong

The admin wasn't created because:
1. Environment variables weren't set during first deployment
2. Provision command was never run
3. Provision command ran but password didn't match 12-char requirement

---

## Prevent This Next Time

1. **Before first deploy:** Set ADMIN variables in Render Environment
2. **After deployment:** Run provision script in Render Shell
3. **After success:** Delete ADMIN variables from Environment
4. **Redeploy:** To apply the deletion

---

## Need Help?

**Check these:**
- Are ADMIN variables set in Render Environment? (Step 1)
- Did provision command succeed? (Step 2)
- Is password at least 12 characters? (Admin requires this)
- Did you remove the variables after provisioning? (Step 3)
- Exact email/password match when logging in?

**Test MongoDB connection:**
```bash
# In Render Shell
node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => console.log('Connected!') ).catch(e => console.error(e.message));"
```

If connection fails, check:
- MONGODB_URI is correct
- MongoDB Atlas Network Access whitelist includes Render's IP
- Database user has correct permissions

---

## Still Not Working?

1. **Check MongoDB directly:**
   - Go to MongoDB Atlas
   - Find your database
   - Open `AdminUser` collection
   - Should have 1 document with your email

2. **Check Render logs:**
   - Go to Service → Logs tab
   - Look for errors or "Connected to MongoDB"
   - Paste any errors here

3. **Verify credentials:**
   - Double-check email is lowercase: `admin@vedaffiliate.com`
   - Double-check password exactly matches what you set
   - Password is case-sensitive

---

**Last Updated:** October 4, 2026
