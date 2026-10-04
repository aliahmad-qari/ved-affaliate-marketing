# VED AFFILIATE PVT. LIMITED

**Promote • Earn • Grow**  
*Official Indian Partner & Affiliate Marketing Infrastructure*

Registered Office: **Rourkela, Odisha, India**  
Official Contact Email: **vedaffiliateltd@gmail.com**  
Official WhatsApp Support: **+91 7064866056**

---

## 1. Project Overview

**VED AFFILIATE PVT. LIMITED** is a dedicated partner marketing platform engineered to connect registered independent affiliates with high-demand financial applications and investment services across India, including:

- **Angel One NXT** (Demat & Trading Account)
- **Upstox Pro** (Paperless Trading & Account Opening)
- **Choice Broking** (Jiffy Demat & AMC Schemes)
- **Nirmal Bang Beyond** (Securities & Research Demat)
- **Stocko Super App** (Retail Trading Account)
- **Bigul Smart Investment** (AI Advisory & Demat)
- **ICICI Prudential Mutual Fund** (SIP & Folio Setup)
- **Axis Mutual Fund** (Equity & Hybrid Folios)
- **HDFC Securities Digital Campaign** (3-in-1 Account)
- **5Paisa Zero Brokerage Demat** (Digital Demat)
- **Geojit Financial Services** (Advisory Demat)
- **Motilal Oswal Wealth Creation** (Research Broking)

### Core Business Rule
> **A submitted lead is NEVER automatically approved.**  
> The partner submits client lead details through the Partner Portal.  
> The lead remains **Pending** until an authorized Administrator cross-checks with vendor/broker MIS reports.  
> Only Administrator manual approval releases commission to the Partner Wallet.

---

## 2. Milestone Architecture Roadmap

- **MILESTONE 1 (Current - 100% Complete)**:
  - Enterprise public website UI with dark navy (`#070B14`, `#0D1424`) and gold (`#D4AF37`) color system.
  - Complete Home, About, Campaigns, Support, and Legal pages.
  - Production-ready Express.js backend with REST APIs (`/api/public/campaigns`, `/api/public/support`).
  - Mongoose Campaign & SupportTicket schemas with built-in seeded fallback.
  - Full-stack Vite development integration and production Render/Vercel configuration.
- **MILESTONE 2 (Complete)**:
  - Partner Registration with unique Partner ID generation.
  - Secure Authentication (JWT / HTTP-only cookies, bcrypt hashing, session protection).
  - Manual PAN & KYC review workflow.
  - Bank Account & UPI ID management.
- **MILESTONE 3 (Complete)**:
  - Partner Dashboard (`/dashboard`) with mobile bottom navigation.
  - Live campaign access with private affiliate tracking links and WhatsApp sharing.
  - Lead submission portal with Pending / Verified / Approved / Rejected statuses.
  - Real-time Wallet balance tracking (Available vs. Pending vs. Total Earned).
- **MILESTONE 4 (Planned - 30%)**:
  - Admin Management Console (up to 3 authorized administrators).
  - Campaign creation, rate adjustment, and logo upload (Cloudinary).
  - Lead approval/rejection with rejection reason recording.
  - Manual withdrawal approval (Minimum ₹200 via Bank / UPI) with transaction reference IDs.
  - Excel/CSV exportable reports & ₹50 referral settlement.

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Mobile-first responsive layout.
- **Backend**: Node.js, Express.js, TypeScript, REST API architecture.
- **Database**: MongoDB Atlas with Mongoose ODM (includes offline resilient fallback store).
- **Hosting Targets**:
  - Frontend: Deployable to **Vercel**
  - Backend: Deployable to **Render**

---

## 4. Folder Structure

```
├── server/                       # Backend Express Architecture
│   ├── config/
│   │   └── db.ts                 # MongoDB Atlas connection & fallback store
│   ├── controllers/
│   │   ├── campaignController.ts # Public campaign list, slug lookup & seeders
│   │   └── supportController.ts  # Support ticket submission & validation
│   ├── middleware/
│   │   └── errorHandler.ts       # Centralized 404 & error handlers
│   ├── models/
│   │   ├── Campaign.ts           # Mongoose schema for campaigns
│   │   └── SupportTicket.ts      # Mongoose schema for inquiries
│   ├── routes/
│   │   ├── campaignRoutes.ts     # Express router for campaigns
│   │   └── supportRoutes.ts      # Express router for support tickets
│   ├── seeds/
│   │   └── campaignSeeds.ts      # Seed data for initial 12 financial campaigns
│   ├── types/
│   │   └── index.ts              # Backend TypeScript interfaces
│   ├── app.ts                    # Express application configuration
│   └── server.ts                 # Standalone HTTP server (Render-ready)
├── src/                          # Frontend React Architecture
│   ├── assets/                   # High-fidelity visual assets
│   ├── components/
│   │   ├── home/                 # Hero, Stats, HowItWorks, WhyChoose, Featured
│   │   ├── layout/               # Navbar (3-zone), Footer, MobileBottomNav
│   │   └── ui/                   # Button, StatusBadge, Skeletons, Modals, WhatsApp
│   ├── pages/
│   │   ├── HomePage.tsx          # Homepage overview
│   │   ├── AboutPage.tsx         # Corporate background & ethics
│   │   ├── CampaignsPage.tsx     # Filterable campaign directory
│   │   ├── SupportPage.tsx       # Support ticket form, FAQs & direct contact
│   │   ├── AuthPlaceholderPage.tsx # Compliant shell for upcoming Milestone 2 auth
│   │   ├── LegalPage.tsx         # Terms & Conditions and Privacy Policy
│   │   └── NotFoundPage.tsx      # 404 handler
│   ├── services/
│   │   └── api.ts                # Frontend API fetch wrapper
│   ├── types/
│   │   └── campaign.ts           # Frontend interfaces
│   ├── App.tsx                   # Root state & view orchestration
│   ├── main.tsx                  # React DOM entry
│   └── index.css                 # Tailwind v4 theme & token layers
├── .env.example                  # Environment variable reference
├── index.html                    # SEO & typography headers
├── metadata.json                 # AI Studio metadata
├── package.json                  # Scripts & dependencies
├── server.ts                     # Root fullstack runner
└── vite.config.ts                # Vite config with Express middleware plugin
```

---

## 5. Environment Variables

Create a `.env` file in the project root:

```env
# Backend Environment
NODE_ENV=development
PORT=3001

# MongoDB Atlas URI (Provide your connection string)
MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.mongodb.net/ved_affiliate?retryWrites=true&w=majority"

# Frontend CORS Origin
FRONTEND_URL="http://localhost:3000"

# Frontend API URL (Empty string for same-host dev or URL for production backend)
VITE_API_BASE_URL=""

# Authentication secret (use a unique random value of at least 32 characters)
JWT_SECRET="replace-with-a-random-secret-at-least-32-characters"
```

For production, set `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, and `FRONTEND_URL` on Render. Render supplies `PORT` automatically. Never commit a real `.env` file.

---

## 6. Development & Build Commands

### Start Development Server
```bash
npm run dev
```
Runs the Vite dev server on `http://localhost:3000` with the Express API integrated seamlessly at `/api/*`.

### Build for Production
```bash
npm run build
```

### Run Full-Stack Server
```bash
npm run start
```
Starts `server.ts` via `tsx` on `PORT` (or 3001), serving both the `/api/*` endpoints and the built frontend static assets.

### TypeScript / Lint Check
```bash
npm run lint
```

### Admin Provisioning
Admin registration is not public. Set `MONGODB_URI`, `ADMIN_NAME`, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` of at least 12 characters in a trusted local shell, then run:

```bash
npm run admin:provision
```

The provisioning command creates or updates that Admin account and refuses to create more than three Admin users. Do not set `ADMIN_PASSWORD` in Vercel, and do not commit it. Admin login is at `/admin/login`; all Admin APIs independently enforce the `ADMIN` role.

Campaign logo uploads require `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` on Render. Uploads are limited to 3 MB and validated by file signature for PNG, JPEG, or WebP. MongoDB Atlas must support replica-set transactions for idempotent lead approval and reserved withdrawals.

---

## 7. Deployment Instructions

### A. MongoDB Atlas
1. Create a production database and a dedicated database user with access only to that database.
2. Add the Render service's outbound IP addresses to Atlas Network Access. Avoid `0.0.0.0/0` unless you knowingly accept public network access.
3. Copy the Atlas connection string into Render as `MONGODB_URI`; URL-encode special characters in the database username/password.

### B. Deploy Backend to Render
The repository root is the service root; there is no separate backend package directory. Create a Blueprint from `render.yaml`, or configure a Node Web Service with:

- Root Directory: `.`
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- Node: `22.12.0` or newer supported by Vite 8
- Environment variables: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET` (at least 32 random characters), and `FRONTEND_URL`
- Optional logo storage: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Leave `PORT` to Render; the server binds `0.0.0.0` and reads `process.env.PORT`.

Set `FRONTEND_URL` to the exact Vercel production origin (scheme and host only). Comma-separated origins are supported if you intentionally allow more than one. The API refuses production startup if MongoDB cannot connect, and `/api/health` returns 503 when the database is unavailable.

### C. Deploy Frontend to Vercel
1. Import the same repository. Set Root Directory to `.` and Framework Preset to **Vite**.
2. Build Command: `npm run build`; Output Directory: `dist`.
3. Set `VITE_API_BASE_URL` to the Render service URL, for example `https://ved-affiliate.onrender.com` (no trailing slash).
4. Deploy, then set the resulting production origin as Render's `FRONTEND_URL` and restart/redeploy the Render service.

Vercel serves the Vite SPA routes through `vercel.json`. All frontend API clients use `VITE_API_BASE_URL`; authentication requests include credentials. Production auth cookies are HTTP-only, Secure, and SameSite=None for the split Vercel/Render origins. Some browsers restrict third-party cookies; using frontend and API custom domains under the same registrable domain gives more reliable session persistence.

### D. Production Smoke Test
- Open Home, About, Campaigns, and Contact; verify campaign data loads from Render.
- Register and log in; reload and confirm session persistence, then log out.
- Verify the Partner Dashboard, Campaigns, Lead submission, Partner Leads, Earnings, Wallet, and Profile.
- Confirm submitted leads begin Pending and a partner cannot approve their own lead.
- Provision an Admin privately; test Admin login, partner denial from `/api/admin/*`, lead approval/rejection, earning idempotency, withdrawal reservation/rejection/manual-paid reference, notifications, CSV exports, and audit records.
- Confirm profile responses contain masked PAN/account values only, never raw identifiers.
- Verify support submission appears successful only when accepted by the backend.
- Check Render `/api/health` reports `healthy` with MongoDB connected and returns 503 when it is unavailable.
- Test frontend-to-backend requests and backend-to-Atlas connectivity, including a second concurrent withdrawal request to confirm reserved balance cannot be spent twice.

---

## 8. Compliance & Disclaimer
VED AFFILIATE PVT. LIMITED is an affiliate marketing platform and is not a registered stockbroker, investment advisor, or banking institution. All logos and campaign trademarks are the property of their respective holders. Lead verification and commission approval are manually determined by the company's compliance administrators.
