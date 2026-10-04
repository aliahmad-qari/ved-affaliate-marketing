# Milestone 4 - Quick Testing Checklist

## Quick Start (2 Minutes)

### 1. Start Servers
```bash
npm run dev:server    # Terminal 1
npm run dev:vite      # Terminal 2
```

### 2. Admin Login
- URL: http://localhost:3000/admin
- Email: admin@vedaffiliate.com
- Password: AdminPassword123

### 3. Quick Tests

| Feature | Test | Expected Result |
|---------|------|-----------------|
| **Dashboard** | Click Admin → Dashboard | See stats: Partners, Leads, Earnings |
| **Create Campaign** | Fill form + Save | Campaign appears in list |
| **Terms View** | Go to /campaigns → Click campaign | See 6-field Terms section |
| **Payout Text** | View campaign card | Shows "Potential Payout: ₹XXX" |
| **Hero Text** | View homepage | "Earn on Verified Leads" (not "Commissions") |
| **Campaign Count** | Homepage stats | "12+ Financial Campaigns" |
| **Lead Review** | Admin → Leads → PENDING lead | "Verify" & "Adjust payout" buttons |
| **Payout Adjustment** | Click "Adjust payout" | Dialog accepts new amount |
| **Lead Approval** | Verify → Approve lead | Status changes, balance checked |
| **Audit Log** | Admin → Audit tab | See all admin actions logged |
| **Partner Notifications** | Login as partner → /notifications | See system messages |
| **Referral Sharing** | Partner → Referrals | WhatsApp message says "earn on verified leads" |

---

## Critical Features ✅

✅ **Admin System** - Complete workspace with dashboard, lead management, auditing
✅ **Campaign Terms** - 6-field Terms & Conditions system (Eligibility, Validation, Payout Timeline, Fraud Rules)
✅ **Payout Management** - Adjust payouts + balance validation guards
✅ **Client Wording** - "Earn on Verified Leads" + "12+ Campaigns" + "Potential Payout"
✅ **Security** - Admin authorization, input validation, error sanitization
✅ **Audit Trail** - All admin actions logged with before/after snapshots

---

## Detailed Testing Guide
See `MILESTONE_4_TESTING_GUIDE.md` for complete 13-section guide

---

## Environment Variables (Required in .env)
```
ADMIN_NAME=Admin Name
ADMIN_EMAIL=admin@vedaffiliate.com
ADMIN_PASSWORD=AdminPassword123
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
```

---

## Support
If issues occur:
1. Check console errors (F12)
2. Check server terminal logs
3. Verify .env file is complete
4. Restart both servers
