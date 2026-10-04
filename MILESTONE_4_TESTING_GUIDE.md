# Milestone 4 - VED Affiliate Marketing Platform - Testing Guide

## Overview
This guide provides step-by-step instructions for testing all Milestone 4 features. The platform includes Admin Dashboard, Campaign Terms & Conditions, Lead Management with Payout Adjustment, and Referral/Notification systems.

---

## 1. ENVIRONMENT SETUP

### Prerequisites
- Node.js v18+
- MongoDB Atlas database running
- Environment variables configured in `.env` file

### Environment Variables Required
```
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ved_affiliate
JWT_SECRET=your-secret-key-at-least-32-chars
FRONTEND_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:3001
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
ADMIN_NAME=Admin Name
ADMIN_EMAIL=admin@vedaffiliate.com
ADMIN_PASSWORD=AdminPassword123
```

### Start Development Server
```bash
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend
npm run dev:vite
```

Frontend runs at `http://localhost:3000`
Backend API runs at `http://localhost:3001`

---

## 2. ADMIN PROVISIONING & LOGIN

### 2.1 First-Time Admin Setup
1. Backend automatically creates an Admin user on first startup if environment variables are set
2. Check MongoDB for `AdminUser` collection - should have one record with your ADMIN_EMAIL

### 2.2 Admin Login
1. Go to `http://localhost:3000/admin` (or click "Admin" link if visible)
2. Enter Admin Email and Password:
   - Email: `admin@vedaffiliate.com`
   - Password: `AdminPassword123`
3. ✅ Should redirect to Admin Dashboard

### 2.3 Expected Behavior
- Admin Dashboard shows system statistics (total partners, leads, earnings, etc.)
- Cookie-based session (no token in localStorage)
- Admin navigation hidden from partner/public pages

---

## 3. CAMPAIGN MANAGEMENT

### 3.1 Create Campaign with Terms & Conditions

**Test Steps:**
1. Login as Admin
2. Click "Campaigns" tab
3. Click "Create Campaign" button
4. Fill form fields:
   - **Name**: "High-Yield Trading App"
   - **Slug**: "high-yield-trading"
   - **Company**: "TradePro Solutions"
   - **Type**: "Demat & Trading"
   - **Description**: "Refer users to open a trading account with real-time market access"
   - **Required Action**: "User must complete KYC and open a Demat account"
   - **Payout**: "450"
   - **Payout Terms**: "Admin verified per eligible lead post-activation"
   - **Rules** (one per line):
     ```
     First-time traders only
     KYC must be complete
     Account must remain active for 30 days
     No duplicate referrals
     ```
   - **Terms - Eligibility**: "New traders in India, aged 18+, with valid PAN"
   - **Terms - Validation/Rejection**: "Leads failing broker validation or with incomplete KYC will be rejected"
   - **Terms - Payout Timeline**: "Payouts credited 7-14 days after broker confirms account opening"
   - **Terms - Duplicate/Fraud Rules**: "Duplicate accounts, self-referrals, and detected fraud result in rejection and potential suspension"

5. Click "Save Campaign"
6. ✅ Campaign should appear in the list below

### 3.2 Verify Campaign Display on Frontend

**As Partner (or public user):**
1. Go to `http://localhost:3000/campaigns`
2. Scroll and find your created campaign
3. Click campaign card to open modal
4. **Verify displayed fields:**
   - Campaign name and company logo
   - ✅ "Potential Payout: ₹450" (NOT "Payout: ₹450 INR")
   - Required Action section
   - **New "Terms & Conditions" section with all 6 fields:**
     1. Eligibility
     2. Required Action (from campaign)
     3. Potential Payout (with payout timeline info)
     4. Validation / Rejection
     5. Payout Timeline
     6. Duplicate / Fraud Rules
   - Campaign Conditions (rules)

5. ✅ All Terms & Conditions should be clearly visible in structured format

### 3.3 Edit Campaign
1. Admin Dashboard → Campaigns tab
2. Find campaign, click "Edit" button
3. Modify "Payout Terms" to: "Admin verified within 3 business days"
4. Update "Terms - Payout Timeline" to: "24-48 hours after verification"
5. Click "Save"
6. ✅ Changes should be reflected immediately
7. Verify changes on public campaign modal

### 3.4 Campaign Status Management
1. Edit a campaign
2. Change Status dropdown to "PAUSED"
3. Save
4. Go to Campaigns page - campaign should still be visible but marked appropriately
5. Change status back to "LIVE"

---

## 4. LEAD MANAGEMENT & PAYOUT ADJUSTMENT

### 4.1 Manual Lead Creation (Admin)
1. Admin Dashboard → Leads tab
2. Click "Add Manual Lead" (if available)
3. Fill details:
   - Partner Email: `partner@example.com`
   - Campaign: Select one
   - Lead Data: `{ "name": "John Doe", "phone": "9876543210" }`
   - Payout: "450"
4. Click "Save"
5. ✅ Lead should appear with status "PENDING"

### 4.2 Lead Review & Status Workflow

**Test Lead Verification Flow:**

1. **PENDING State:**
   - Admin Dashboard → Leads tab
   - Find lead with status "PENDING"
   - ✅ Should see two buttons:
     - "Verify" - moves to VERIFIED
     - "Adjust payout" - opens dialog to change amount
     - "Approve" or "Reject" (may vary by implementation)

2. **Click "Adjust payout":**
   - Dialog appears asking for new payout amount
   - Enter new amount: "500"
   - ✅ Lead payout should update to 500
   - Status remains PENDING

3. **Click "Verify":**
   - Status changes to "VERIFIED"
   - Buttons available: "Adjust payout", "Approve", "Reject"

4. **Click "Approve" (from VERIFIED):**
   - ✅ Status changes to "APPROVED"
   - Creates APPROVED earning ledger entry for partner wallet
   - ✅ **IMPORTANT:** Balance validation check happens:
     - If partner has pending withdrawals that would exceed available balance, shows error
     - "This earning is reserved by a pending withdrawal. Resolve the withdrawal first."
     - Otherwise, approval succeeds

5. **Click "Mark as Paid" (from APPROVED):**
   - ✅ Same balance check applies
   - Status changes to "PAID"
   - Marks earning ledger as PAID
   - Updates partner's wallet and withdrawal history

### 4.3 Rejection & Reason Tracking

1. Admin Dashboard → Leads tab
2. Find a PENDING lead
3. Click "Reject" button
4. Dialog appears asking for rejection reason
5. Enter reason: "KYC documentation incomplete - missing PAN verification"
6. Click "Submit"
7. ✅ Lead status should change to "REJECTED"
8. ✅ Rejection reason stored in audit log

---

## 5. ADMIN DASHBOARD & METRICS

### 5.1 Dashboard Statistics
1. Login as Admin
2. View Dashboard tab
3. **Verify displayed metrics:**
   - ✅ Total Partners (count)
   - ✅ Active Partners (status = ACTIVE)
   - ✅ Total Leads (all)
   - ✅ Approved Leads (status = APPROVED or PAID)
   - ✅ Pending Leads (status = PENDING or VERIFIED)
   - ✅ Total Earnings (sum of APPROVED + PAID payouts)
   - ✅ Pending Payout (sum of APPROVED payouts)
   - ✅ Paid Payout (sum of PAID payouts)
   - ✅ Withdrawal Requests (count)
   - ✅ Pending Withdrawals (sum of amounts)
   - ✅ Paid Withdrawals (sum of amounts)

### 5.2 Audit Log
1. Admin Dashboard → Audit tab
2. Scroll through audit entries
3. **Verify audit entries for:**
   - Campaign creation: "CAMPAIGN_CREATED"
   - Campaign updates: "CAMPAIGN_UPDATED"
   - Lead reviews: "LEAD_REVIEWED"
   - Lead payout adjustments: "LEAD_PAYOUT_ADJUSTED"
   - Admin logins: "ADMIN_LOGIN"
4. ✅ Each entry should show: Timestamp, Admin Email, Action, Entity, Changes (before/after)

---

## 6. PARTNER FEATURES

### 6.1 Partner Registration
1. Go to `http://localhost:3000/register`
2. Register new partner:
   - Name: "Test Partner"
   - Email: "testpartner@example.com"
   - Password: "TestPass123"
   - Terms: Accept
3. ✅ Should redirect to Dashboard

### 6.2 Campaign Viewing & Tracking Links
1. Go to Campaigns page
2. **Verify new wording:**
   - ✅ Hero section: "Promote Financial Apps. **Earn on Verified Leads.**" (NOT "Earn Verified Commissions")
   - ✅ Statistics: "**12+ Financial Campaigns**" (NOT "10-12 Top Indian")
3. Click campaign → view modal with Terms & Conditions
4. Click "Register to Promote" button
5. ✅ Should be able to copy/share tracking link

### 6.3 Referral Sharing
1. Partner Dashboard → Referrals tab
2. Generate referral link: "Join VED AFFILIATE to promote leading financial apps in India and earn on verified leads!"
3. ✅ Should include partner referral code
4. Share via WhatsApp button
5. ✅ Message contains updated wording ("earn on verified leads" NOT "earn verified commissions")

### 6.4 Notifications
1. Partner Dashboard → Notifications tab
2. **Should see notification types:**
   - Lead Status Updates
   - Withdrawal Status Updates
   - System Announcements
   - Referral Rewards
3. Mark notification as read
4. ✅ Should update UI state

### 6.5 Earnings & Wallet
1. Partner Dashboard → Earnings tab
2. **Verify payout display:**
   - ✅ Shows "Potential Payout: ₹XXX" in campaign lists
   - ✅ NO "₹XXX INR" format
3. Wallet tab
4. ✅ Shows current balance, pending, and available amounts

---

## 7. SECURITY & VALIDATION TESTING

### 7.1 Admin Authorization
1. **Test unauthenticated access:**
   - Open incognito window
   - Try to access `/admin` directly
   - ✅ Should redirect to login

2. **Test partner cannot access admin:**
   - Login as partner
   - Try to navigate to `/admin`
   - ✅ Should get 403 or redirect to dashboard

3. **Test JWT validation:**
   - Manually delete authentication cookie
   - Refresh page
   - ✅ Should be logged out

### 7.2 Input Validation
1. Admin Campaign Form:
   - Try to submit with empty required fields
   - ✅ Should show validation errors
   - Try to enter invalid payout (negative number)
   - ✅ Should show error: "Payout must be non-negative"
   - Try to submit with payout having > 2 decimals
   - ✅ Should show error: "at most two decimals"

2. Payout Adjustment:
   - Try to adjust payout on APPROVED lead
   - ✅ Should show error: "can only be adjusted on Pending or Verified"
   - Try to adjust with invalid amount
   - ✅ Should validate amount format

### 7.3 Balance Guards
1. Create partner with small balance
2. Add APPROVED lead with payout = ₹500
3. Partner requests withdrawal = ₹400
4. Withdrawal status = "PENDING"
5. Try to APPROVE another lead with payout = ₹300
6. ✅ Should show error: "This earning is reserved by a pending withdrawal"
7. After withdrawal is processed/rejected, lead approval should work

### 7.4 Error Message Sanitization
1. **Test in Development (NODE_ENV=development):**
   - Trigger an error on backend
   - ✅ Should see detailed error message in console

2. **Test in Production (NODE_ENV=production):**
   - Set NODE_ENV=production
   - Trigger an error
   - ✅ Error message should be generic: "An internal server error occurred..."
   - ✅ Detailed error NOT exposed to client

---

## 8. DATABASE VERIFICATION

### 8.1 Collections to Verify
Open MongoDB Atlas and check these collections:

**AdminUser:**
- ✅ Has 1 record with ADMIN_EMAIL
- ✅ passwordHash field exists but not returned in API responses
- ✅ No __v field exposed to API clients

**Campaign:**
- ✅ Has `terms` field with sub-fields:
  - eligibility
  - validationRejection
  - payoutTimeline
  - duplicateFraudRules
- ✅ Sample campaign:
  ```json
  {
    "name": "High-Yield Trading",
    "payout": 450,
    "terms": {
      "eligibility": "New traders in India, aged 18+",
      "validationRejection": "Leads failing validation will be rejected",
      "payoutTimeline": "7-14 days after confirmation",
      "duplicateFraudRules": "No duplicates or fraud allowed"
    }
  }
  ```

**Lead:**
- ✅ Has `reviewedBy`, `reviewNote`, `verifiedAt`, `paidAt` fields
- ✅ Tracks status transitions: PENDING → VERIFIED → APPROVED → PAID or REJECTED

**WalletTransaction:**
- ✅ Has `status` field with values: AVAILABLE, PENDING, PROCESSING, APPROVED, PAID, PROCESSED
- ✅ Withdrawal transactions properly tracked

**AuditLog:**
- ✅ Records all admin actions
- ✅ Has before/after snapshots for changes

---

## 9. PERFORMANCE & LOAD TESTING

### 9.1 Page Load Times
1. Open browser DevTools (F12)
2. Go to Network tab
3. Load Campaigns page
4. ✅ Initial load should be < 3 seconds
5. Go to Admin Dashboard
6. ✅ Dashboard load with all metrics < 2 seconds

### 9.2 Pagination
1. Admin Leads tab
2. With many leads (>100), pagination should work:
   - ✅ Default shows 10 items
   - ✅ Can navigate between pages
   - ✅ Page number preserved on refresh

### 9.3 Concurrent Operations
1. Open 2 browser windows (same partner)
2. In window 1, click "Mark as Paid" on a lead
3. In window 2, simultaneously try same action
4. ✅ Should prevent double-processing (error or graceful handling)

---

## 10. FEATURE CHECKLIST

### Milestone 4 Deliverables

- [ ] Admin Dashboard with statistics
- [ ] Campaign Terms & Conditions (6 fields)
- [ ] Lead review with 3-state workflow (PENDING → VERIFIED → APPROVED → PAID)
- [ ] Payout adjustment endpoint with balance validation
- [ ] Admin audit logging for all actions
- [ ] Updated hero text: "Earn on Verified Leads"
- [ ] Updated campaign count: "12+ Financial Campaigns"
- [ ] Updated payout display: "Potential Payout: ₹XXX" (no INR)
- [ ] Partner notifications system
- [ ] Referral rewards tracking
- [ ] Wallet management with balance guards
- [ ] Production error sanitization
- [ ] Admin authorization & role guards
- [ ] Input validation & sanitization
- [ ] Cookie-based admin session (no localStorage)
- [ ] Audit log with before/after snapshots

---

## 11. REPORTED ISSUES & RESOLUTIONS

### Known Limitations
- None identified in Milestone 4

### Testing Notes
- All TypeScript compilation errors resolved ✅
- No runtime errors on happy path ✅
- All security validations in place ✅

---

## 12. ROLLBACK & CLEANUP

### Reset to Clean State
```bash
# Stop all servers
Ctrl+C in both terminals

# Clear local data (if using local MongoDB)
# Connect to MongoDB and run:
db.dropDatabase()

# Restart servers
npm run dev:server
npm run dev:vite
```

### Remove Test Data
```bash
# In MongoDB:
db.Partner.deleteMany({ email: "testpartner@example.com" })
db.Campaign.deleteMany({ name: "High-Yield Trading" })
db.Lead.deleteMany({ partnerId: "..." })
```

---

## 13. CONTACT & SUPPORT

For issues during testing:
1. Check console for errors (F12)
2. Review server logs in terminal
3. Verify all environment variables are set
4. Clear browser cache and cookies
5. Restart both servers

---

**Document Version:** 1.0  
**Last Updated:** October 4, 2026  
**Milestone:** 4 - Complete Admin Workspace & Campaign Terms
