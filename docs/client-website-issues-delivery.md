# Client website issues — local delivery

Reference: VED_Affiliate_Website_Issues_Report (1).pdf. All seven pages and all five embedded screenshots were read/inspected. The separately pasted implementation brief was followed. The actual repository frontend is React/Vite, not Next.js; its architecture is preserved.

## Issue status and changes

| PDF issue | Local implementation |
| --- | --- |
| 1 — Partner Advantages | Compact horizontal icon/text cards with navy gradients, gold borders, six approved benefits, the approved supporting line and gold VED heading. The referral description explicitly retains the eligible first-task condition. No new KYC or vendor automation is implied. |
| 2 — Featured Campaigns | LIVE NOW and View all navigation to the existing campaigns route. Home fetches featured LIVE campaigns from the backend without using sample fallback cards. Component also filters status and featured flag. Empty/loading states, existing real payout/card details and status badge retained. Zero payout displays ₹0. |
| 3 — Hero description | Exact approved description in the hero, description metadata and Open Graph description. HTML metadata encodes the ampersand as &amp;; its decoded text matches the approved sentence. Hero heading and CTAs unchanged. |
| 4 — Non-live new submissions | Dropdown only shows LIVE campaigns. Availability refreshes on opening, focus and every 30 seconds; it is checked again before submitting. Missing/non-live selection shows a warning and disables submit. Backend rejects PAUSED/DRAFT/ENDED with 404, and unavailable database verification with 503. Empty authoritative database results no longer resurrect seed campaigns. Existing lead-update rules are unchanged. |
| 5 — Admin lead details | Customer name is prominent, mobile has its own label, and Referred By (Partner Name) comes from the actual lead.partnerId relationship. One batched partner query per page selects only partnerId/fullName. Missing data has explicit fallbacks. Existing actions, statuses, payout controls and filters retained. |

## Exact files changed for these five fixes

- index.html
- src/components/home/WhyChooseSection.tsx
- src/components/home/FeaturedCampaignsSection.tsx
- src/components/home/HeroSection.tsx
- src/pages/HomePage.tsx
- src/pages/PartnerLeadsPage.tsx
- src/services/api.ts
- src/components/admin/AdminLeadCard.tsx
- src/types/partner.ts
- server/controllers/campaignController.ts — public campaign listing only in this task
- server/controllers/partnerDataController.ts
- server/controllers/adminLeadController.ts
- tests/clientWebsiteIssues.test.tsx
- tests/leadCapture.test.ts — additional query-aware mocks, partner lookup mock and non-live/paused-update coverage
- docs/client-website-issues-delivery.md

Earlier uncommitted m.Stock changes, their tests and docs were already present before this task. They are not additional changes to attribution in this task. No vendor webhook, wallet/payout controller, campaign URL, database configuration or existing database record was edited. No migration or new environment variable is required. No Milestone 4 work, commit, push or deployment was performed.

## Backend/API behavior

- GET /api/admin/leads: adds optional referringPartnerName to each authorized admin result; null if missing. No per-lead database query. Authentication/role middleware remains unchanged. No public customer endpoint was introduced.
- GET /api/public/campaigns?status=LIVE&featured=true: authoritative empty results stay empty; unavailable DB returns 503 for this verified featured request rather than seeds.
- GET /api/partner/campaigns: authoritative LIVE/PAUSED results remain available, including an empty result; unavailable DB fails closed with 503 instead of fake selectable campaigns.
- POST /api/partner/leads: existing LIVE-only validation is preserved and made safe against empty/offline seed fallbacks. Direct non-live requests are rejected before any record creation.
- PATCH /api/partner/leads/:leadId: existing ownership/status update rules are unchanged, including approved handling of existing PAUSED-campaign leads.

## Validation

- npm run lint: passed. This repository command runs tsc --noEmit for frontend and backend; it is not an ESLint run.
- npm run build: passed, Vite production frontend build. Existing __dirname/native-config warning remains unrelated.
- Regression suite: 13 tests passed. Coverage includes exact hero/metadata text, six benefits, LIVE/featured filtering, zero payout, empty data, View all callback navigation, authorized batched partner resolution and missing-name fallback, non-live creation rejection, lead capture and retries, origin/authentication controls, manual leads, existing earnings/wallet/withdrawals, campaign logo handling and m.Stock URL preservation.
- Final combined rerun: all 13 tests passed, including the additional paused-campaign existing-lead update assertion. Command: `node --import tsx --test tests/clientWebsiteIssues.test.tsx tests/leadCapture.test.ts tests/vendorTracking.test.ts tests/leadCaptureUi.test.tsx tests/leadCaptureOrigin.test.ts tests/adminDesign.test.tsx tests/campaignLogo.test.tsx`.
- No separate ESLint scripts or backend production-build script exist in package.json. Backend is TypeScript checked and exercised through the real Express routes with isolated database doubles. No live production data or vendor API was used for tests.

## Responsive QA and remaining limit

Benefits stack on mobile, move to two columns at 768px and three at 1280px. Featured cards retain mobile stacking and desktop columns, with minimum-width and wrapping protection. Admin customer/referring-partner text wraps; action controls retain their existing responsive layout.

Requested widths: 360, 375, 390, 412, 768, 1024, 1280 and 1440 pixels. Source/layout review was completed, but rendered visual/browser QA at these widths could not run: the browser runtime failed while writing kernel assets (system path not found). Do not treat responsive visual QA as passed. A connected browser is required for that final check.

Production DB values and the historical m.Stock account attribution remain unverified. Deploy only after explicit approval and review of the separate m.Stock evidence requirements. The five website corrections do not claim to recover those accounts or establish a vendor integration.
