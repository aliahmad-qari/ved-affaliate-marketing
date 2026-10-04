# Render Deployment Guide - VED Affiliate Marketing Platform

## Overview
This guide walks you through deploying the VED Affiliate Marketing platform to Render (backend) and Vercel (frontend) with proper admin setup.

---

## PART 1: PREPARE RENDER ENVIRONMENT VARIABLES

### Step 1: Go to Render Dashboard
1. Log in to [render.com](https://render.com)
2. Create new Web Service or use existing one
3. Go to "Environment" tab

### Step 2: Add Required Environment Variables

**CRITICAL VARIABLES (Required for startup):**
```
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ved_affiliate?retryWrites=true&w=majority
JWT_SECRET=your-random-secret-key-at-least-32-characters-long-change-this
FRONTEND_URL=https://your-vercel-domain.vercel.app
```

**ADMIN PROVISIONING VARIABLES (Set only once, then remove for security):**
```
ADMIN_NAME=Admin Name
ADMIN_EMAIL=admin@vedaffiliate.com
ADMIN_PASSWORD=AdminPassword123456
```

**EMAIL/NOTIFICATIONS (Optional but recommended):**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=vedaffiliateltd@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=VED AFFILIATE <vedaffiliateltd@gmail.com>
```

**CLOUDINARY (For campaign logo uploads - Optional):**
```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Step 3: IMPORTANT Security Notes

⚠️ **DO NOT commit ADMIN_PASSWORD to git or leave in production permanently**
- Set these variables only for initial setup
- Remove ADMIN_PASSWORD after running provision command
- Use Render's Environment tab, NOT hardcoded in code

---

## PART 2: DEPLOY BACKEND TO RENDER

### Step 1: Configure Service
1. In Render dashboard, go to your Web Service
2. Set these Build settings:
   - **Root Directory**: `.`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Node Version**: 22 or newer
   - **Health Check Path**: `/api/health`

### Step 2: Verify Environment Variables
1. Go to "Environment" tab
2. Verify all variables from Part 1 are set
3. Click "Save"

### Step 3: Deploy
1. Click "Manual Deploy" or push to git to trigger auto-deploy
2. Wait for build to complete (5-10 minutes)
3. Check logs for errors

**Expected log output:**
```
npm WARN ... (npm warnings are normal)
✓ Built in X.XXXs
Server running on http://0.0.0.0:3000
Connected to MongoDB
```

### Step 4: Verify Health Check
1. Go to your Render URL: `https://your-service.onrender.com`
2. Check health: `https://your-service.onrender.com/api/health`
3. Should return: `{"status":"healthy","database":"connected"}`

---

## PART 3: PROVISION ADMIN ON RENDER

### Option A: Using Render Shell (Recommended)

1. In Render dashboard, go to your service
2. Click "Shell" tab (top right)
3. Run this command in the shell:
```bash
node -e "import('./scripts/provision-admin.ts').catch(e => { console.error(e.message); process.exit(1); })"
```

**Expected output:**
```
Admin provisioned for admin@vedaffiliate.com. No password was printed.
```

### Option B: Using Build Script (Alternative)

1. Create temporary file `render-provision.sh` in root:
```bash
#!/bin/bash
npm run admin:provision
```

2. In Render build steps, add before start command:
```
npm run admin:provision && npm start
```

3. Deploy
4. After deployment succeeds, remove the command (so admin isn't re-provisioned on each deploy)

### Step 4: IMPORTANT - Remove Admin Variables from Render

After admin is provisioned:
1. Go to Render Environment tab
2. Delete these variables:
   - `ADMIN_NAME`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
3. Click "Save"
4. Click "Manual Redeploy" to apply changes

**Why?** Security best practice - passwords shouldn't be in environment long-term.

---

## PART 4: DEPLOY FRONTEND TO VERCEL

### Step 1: Connect Repository
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project" → Import Git Repository
3. Select your VED Affiliate repo

### Step 2: Configure Build Settings
1. **Root Directory**: `.`
2. **Framework Preset**: Vite
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`

### Step 3: Add Environment Variable
1. In Vercel project settings, go to "Environment Variables"
2. Add:
   ```
   VITE_API_BASE_URL=https://your-render-service.onrender.com
   ```
   (no trailing slash)

3. Click "Save and Deploy"

### Step 4: Get Vercel Production URL
1. After deployment, you'll see the production URL
2. Format: `https://your-project.vercel.app`
3. Copy this URL

### Step 5: Update Render's FRONTEND_URL
1. Go back to Render dashboard
2. Update Environment variable:
   ```
   FRONTEND_URL=https://your-project.vercel.app
   ```
3. Click "Save"
4. Click "Manual Redeploy" to apply changes

---

## PART 5: TEST PRODUCTION DEPLOYMENT

### Frontend Tests
1. Go to `https://your-project.vercel.app`
2. Test these pages:
   - Home page loads
   - Campaigns page shows campaigns
   - Register page works
   - Login works
   - All navigation works

### Backend Tests
1. Check health: `https://your-render-service.onrender.com/api/health`
2. Should show: `{"status":"healthy","database":"connected"}`

### Admin Login Test
1. Go to `https://your-project.vercel.app/admin`
2. Login with:
   - Email: `admin@vedaffiliate.com`
   - Password: `AdminPassword123456` (your provisioned password)
3. Should show Admin Dashboard

### Admin Features Test
1. **Campaigns**: Create, edit, view campaigns
2. **Leads**: See leads, adjust payouts, approve/reject
3. **Audit Log**: See all actions logged
4. **Dashboard**: See statistics

---

## TROUBLESHOOTING

### Problem: "Invalid admin credentials" on production login

**Solution 1: Admin was never provisioned**
- Check Render logs for provision command output
- Re-run provision command in Render Shell
- Verify ADMIN_EMAIL and ADMIN_PASSWORD are correct in Render Environment

**Solution 2: Email case mismatch**
- Admin email is stored in lowercase
- Try logging in with lowercase email: `admin@vedaffiliate.com`

**Solution 3: Password changed during provision**
- Re-run provision script with correct password
- Update password in Render Environment before running

### Problem: "Cannot connect to MongoDB" error

**Solution:**
- Verify `MONGODB_URI` is correct in Render Environment
- Check MongoDB Atlas Network Access whitelist
- Add Render IP range to MongoDB: `0.0.0.0/0` OR specific IP
- Test connection: Run `npm run admin:provision` to verify connectivity

### Problem: Frontend cannot reach backend API

**Solution:**
- Verify `FRONTEND_URL` is set in Render
- Verify `VITE_API_BASE_URL` is set in Vercel
- URLs must match domains exactly (including scheme and no trailing slash)
- Check browser console for CORS errors

### Problem: Admin dashboard shows "Unauthorized" or 403

**Solution:**
- Clear browser cookies and cache
- Log out and log in again
- Check browser DevTools → Cookies → verify `auth_token` cookie exists
- Check that admin role is properly assigned in MongoDB

### Problem: Campaign images not uploading

**Solution:**
- Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in Render
- Redeploy service after adding these variables
- Test upload again

---

## ENVIRONMENT VARIABLES SUMMARY

| Variable | Required? | Where to Set | Notes |
|----------|-----------|-------------|-------|
| `NODE_ENV` | Yes | Render | Always `production` |
| `PORT` | No | Render | Render assigns automatically |
| `MONGODB_URI` | Yes | Render | From MongoDB Atlas |
| `JWT_SECRET` | Yes | Render | Min 32 chars, keep secret |
| `FRONTEND_URL` | Yes | Render | Vercel production URL |
| `VITE_API_BASE_URL` | Yes | Vercel | Render production URL |
| `ADMIN_NAME` | One-time | Render | Remove after provisioning |
| `ADMIN_EMAIL` | One-time | Render | Remove after provisioning |
| `ADMIN_PASSWORD` | One-time | Render | **Remove after provisioning** |
| `SMTP_*` | Optional | Render | For email notifications |
| `CLOUDINARY_*` | Optional | Render | For campaign logo uploads |

---

## PRODUCTION CHECKLIST

Before going live:

- [ ] Backend deployed to Render
- [ ] Frontend deployed to Vercel
- [ ] Admin provisioned successfully
- [ ] Admin can login at `/admin`
- [ ] Campaigns display correctly
- [ ] Partners can register and login
- [ ] Lead submission works
- [ ] Admin can review/approve leads
- [ ] Payout adjustment works
- [ ] Notifications appear
- [ ] ADMIN_PASSWORD removed from Render Environment
- [ ] Health check returns `healthy`
- [ ] Audit logs recording actions
- [ ] Database backups configured
- [ ] Error monitoring setup (optional but recommended)

---

## SECURITY BEST PRACTICES

1. ✅ **Environment Variables**: Set in Render/Vercel dashboards, NOT in .env files
2. ✅ **JWT_SECRET**: Min 32 random characters, unique per environment
3. ✅ **ADMIN_PASSWORD**: Remove from Environment after provisioning
4. ✅ **MongoDB URI**: Use strong password, URL-encode special characters
5. ✅ **CORS**: Set FRONTEND_URL to exact Vercel domain
6. ✅ **HTTPS**: Both Render and Vercel use HTTPS by default
7. ✅ **Cookies**: HTTP-only, Secure, SameSite=None set automatically
8. ✅ **Logs**: Don't log sensitive data; monitor for errors

---

## SUPPORT & MONITORING

### Render Logs
- Service → Logs tab
- Check for errors during startup and requests
- Look for "Connected to MongoDB" confirmation

### Vercel Analytics
- Project → Analytics tab
- Monitor response times and error rates

### Errors to Watch For
- 503 Service Unavailable = MongoDB connection issue
- 401 Unauthorized = JWT/auth issue
- 400 Bad Request = Invalid input data
- 5xx errors = Backend errors (check logs)

---

**Document Version:** 1.0  
**Last Updated:** October 4, 2026  
**For:** Render + Vercel Deployment with Admin Provisioning
