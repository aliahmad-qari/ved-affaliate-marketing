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
- **MILESTONE 2 (Planned - 30%)**:
  - Partner Registration with unique Partner ID generation.
  - Secure Authentication (JWT / HTTP-only cookies, bcrypt hashing, session protection).
  - Manual PAN & KYC review workflow.
  - Bank Account & UPI ID management.
- **MILESTONE 3 (Planned - 30%)**:
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
```

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

---

## 7. Deployment Instructions

### A. Deploy Frontend to Vercel
1. Push your repository to GitHub.
2. In the Vercel Dashboard, import the repository.
3. Framework Preset: **Vite**.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Environment Variables:
   - `VITE_API_BASE_URL`: `https://your-render-backend-url.onrender.com`

### B. Deploy Backend to Render
1. In the Render Dashboard, create a new **Web Service**.
2. Connect your GitHub repository.
3. Runtime: **Node**.
4. Build Command: `npm install && npm run build`
5. Start Command: `npm run start`
6. Environment Variables:
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `your_mongodb_atlas_connection_string`
   - `FRONTEND_URL`: `https://your-vercel-app.vercel.app`

---

## 8. Compliance & Disclaimer
VED AFFILIATE PVT. LIMITED is an affiliate marketing platform and is not a registered stockbroker, investment advisor, or banking institution. All logos and campaign trademarks are the property of their respective holders. Lead verification and commission approval are manually determined by the company's compliance administrators.
