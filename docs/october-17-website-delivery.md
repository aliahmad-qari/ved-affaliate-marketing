# Website updates and additional developer issues - local delivery

Reviewed both supplied PDFs completely: the seven-page Website Changes document and its three reference images, and the three-page Additional Developer Issues supplement and its two screenshots. These changes are local; no commit, push, deployment, domain purchase, DNS edit or live record update was performed.

## Acceptance status

| Requested item | Implemented behavior | Status |
| --- | --- | --- |
| Partner campaign reports | Dashboard and Leads have campaign selection and CSV download. Leads also supports campaign/status/search filtering and pagination. CSV exports all matching pages, not just the visible 50 rows. | Locally implemented and tested |
| Report privacy | Authenticated partner ID controls every query, regardless of supplied partnerId. Phone numbers are masked. CSV quotes and spreadsheet formula inputs are escaped. No bank/PAN data is exported. | Locally tested |
| Wallet wording | Exact requested wording: Withdraw approved commission earnings directly to your verified UPI ID or bank account. | Implemented |
| Wallet metrics | Available balance, pending clearance, total earned and total disbursed remain separate. Disbursed includes direct paid commissions and completed withdrawals. Missing data shows placeholders. | Locally tested |
| Six categories | Demat & Trading, Mutual Funds, Insurance, Loans, Banking, UPI & Credit. Shared defaults used in public filters, homepage and admin campaign tools. | Implemented |
| Manage categories | Admin Settings adds custom categories, up to 30 total. The six defaults remain. Existing legacy categories/records remain readable and editable without bulk rewriting. | Locally tested |
| Homepage refresh | Navy/black and gold hero, Financial Services Partner Platform headline, Explore Campaigns/Join/Login actions, six icon cards, colored stat-card accents, retained branding and mobile bottom navigation. | Built; rendered markup tested; interactive visual QA pending |
| VED Updates | Admin Settings manages announcement text. Database statistics, live campaign count, pause/play and reduced-motion behavior remain. No hard-coded public campaign totals. | Locally tested |
| Rejected archive | Default Admin Leads hides REJECTED records whose rejectedAt is at least seven days old. REJECTED shows all; Rejected / Archived shows old records. | Locally tested |
| Rejection reasons | No Lead Found, Duplicate Lead, Other with required explanation. Reason and reason code persist in lead/audit history. | Locally tested |
| Approval reversal | Specific approved/unpaid lead, required reason, exact original earning amount, atomic debit adjustment, audit trail, duplicate protection and balance checks. | Locally tested with database doubles |
| Domain / final launch | Candidate names and controlled deployment/rollback steps below. | Pending explicit domain confirmation and approved deployment |

## Where to use the new controls

- Partner Dashboard -> Campaign lead reports -> choose campaign -> Download CSV.
- Partner Leads -> campaign selector -> status/search -> Download CSV. Filters combine and the download includes every matching page.
- Admin Settings -> VED Updates message / Additional categories -> Save Settings. Public configuration refreshes within 60 seconds or on window focus. Campaign forms reload category settings when their tab opens.
- Admin Leads -> All statuses: the default hides older rejected records. Select REJECTED for every rejection, or Rejected / Archived (7+ days) for older records.
- Admin lead card -> Reject -> choose a reason -> explain Other -> Confirm rejection.
- Admin Partners -> View Lead Ledger -> Open lead -> Reverse Approval. The same action appears on approved cards in Admin Leads.
- Partner ledger -> Partner balance & adjustment history shows current available balance and the latest 100 reversal adjustments, with admin, timestamp, lead, reason and before/after balances. Full stored audit history remains available through existing audit tools.

## Data and financial behavior

- No existing records were deleted, migrated or rewritten by this implementation. Existing vendor URLs, referral IDs, redirects and callbacks remain unchanged.
- Report campaign selection supports both Mongo campaign IDs and historical manual-report slugs. Historical ended campaigns are included when that partner has leads in them; draft campaigns without their leads are not exposed as report options.
- CSV timestamps explicitly use UTC. Names are visible only to the owning authenticated partner; mobile numbers expose only the final four digits. Approved commission snapshots in a CSV are not presented as an available wallet balance or proof of payment.
- Rejected archival is a read-time filter, not a destructive scheduled job or TTL deletion. Records lacking a reliable rejectedAt remain visible. Partner history, reports and ledgers retain old rejections.
- A reversal creates a new ADJUSTMENT/DEBIT transaction, uniquely keyed to the original approval. It does not modify/delete the original earning transaction, payout snapshot or approval timestamp. The lead is marked REJECTED with reversal metadata and the required reason.
- Existing wallet calculations derive approved credit from lead status. Changing the reversed lead to REJECTED removes that credit exactly once; the appended adjustment records the same correction. It is not subtracted a second time. Wallet history labels the original credit as reversed and renders the new debit with a minus sign. Admin earnings exports include direction and numeric signed amounts.
- Reversal requires an available original LEAD_EARNING entry matching the lead amount, a sufficient unreserved balance, and an authenticated admin. Paid leads, inconsistent/missing original earnings and duplicate reversals are rejected. Client-supplied amounts cannot choose the deduction.
- The transaction includes lead correction, adjustment, notification and audit. Withdrawal requests, direct commission payments and reversals use a shared partner walletRevision write lock; lead writes and the existing unique idempotency index add duplicate/concurrency protection.
- Referral bonuses and other partners' earnings are not clawed back by this lead-only correction. Already paid amounts require reconciliation; this action is not an automatic bank refund or recovery mechanism.
- Available-balance checks exclude already PROCESSED referral rewards, matching the existing partner wallet/withdrawal eligibility calculation.
- The existing default/minimum withdrawal remains INR 200. Saving website settings without a withdrawal value preserves the configured minimum.

## Validation and review limits

- Combined regression run: 20 tests passed, zero failures. Covers existing capture/redirect/manual leads, origin/auth rules, KYC, review, wallet/earnings, withdrawals, logos, ledger history and both PDFs' new behaviors.
- New report tests export 125 leads across page limits, resolve ID/slug aliases, combine filters, retain historical campaigns, return header-only empty reports and reject unauthorized access/partner override attempts.
- Archive tests cover recent, old, exactly-seven-day and missing-timestamp rejections without deleting data.
- Reversal tests exercise required reason, role restrictions, a simulated transaction failure/rollback, concurrent duplicate attempts, exact deduction despite a tampered amount, reserved balance, already-paid leads, unchanged original transactions/referral reward, current balances, history and signed earnings export.
- React markup tests cover the new hero, all six categories, editable settings, ticker text escaping and real-count placeholders, Dashboard/Leads report entry points, exact wallet wording, rejection options and reversal confirmation.
- TypeScript and production build passed. Repository lint means tsc --noEmit, not ESLint. Final targeted tests for literal list/report searching and numeric negative export amounts also passed.
- Build warnings remain for the existing Vite native-config/__dirname usage and a JavaScript chunk above 500 kB; the build succeeds.
- The browser inventory returned no connected apps/browsers. Real Android/tablet/desktop screenshots, click-through checks and final-domain tests are NOT verified. No screenshots have been fabricated.
- Tests use isolated database doubles. Production MongoDB transactions, production counts, backups, vendor conversion feeds and historical m.Stock attribution are not certified by these tests.

Local frontend preview: http://127.0.0.1:4173/ . This serves the production UI build for visual review only; a live backend/session is needed for actual login, downloads, settings and financial actions. Missing API data remains placeholders. Do not treat the local preview as a deployed staging site.

## Domain decision and launch plan - do not execute without approval

Suggested spellings for client review: vedaffiliate.com, vedaffiliatepartners.com, vedaffiliatehub.com. These are candidates, NOT confirmed available domains. Registry lookup attempts were inaccessible, and the existing admin email already uses vedaffiliate.com; first confirm whether the client owns it. Verify registrar availability/current price after the spelling is agreed. The company should own the registrar account; confirm ownership and required delegated hosting access before purchase.

The source document explicitly says: "Do not purchase or connect the final domain without my confirmation of the selected domain name." No DNS, ownership, SSL or final-domain testing is claimed complete.

After approval:

1. Obtain and verify a backup of Partner, Campaign, Lead, WalletTransaction, AuditLog, AppSetting and relevant integration records. Record the frontend/backend revisions and current environment configuration without exposing secrets.
2. Verify Mongo replica-set transactions and the WalletTransaction unique idempotencyKey index before enabling reversal actions. Review sample historical earning consistency with authorized admins. Stage the backend before the frontend so new endpoints/categories exist when the UI is released.
3. Use a company-owned registrar account. Add the confirmed domain to Vercel and use the exact DNS targets supplied by Vercel for apex/www. Coordinate DNS verification and verify HTTPS certificates for the chosen hostnames.
4. Update FRONTEND_URL with the approved frontend origin(s). Review VITE_API_BASE_URL and the existing /api proxy approach, Render origin settings and any registered VED callback URLs. Preserve original vendor destinations and their referral parameters. Have each vendor confirm supported callback changes; do not invent integrations.
5. Review email/WhatsApp links and canonical/redirect behavior for the confirmed spelling. Password-reset email delivery needs separate production verification; configuration values alone are not proof of delivery.
6. On the final domain, test registration/login/session refresh, KYC, all six category links/filters, LIVE/PAUSED manual reports, campaign CSV/privacy, earnings/balances, KYC-gated withdrawal, admin review/reasons, archive access, reversal/duplicate guard and notifications. Verify Android widths 360/375/390/412, tablet 768 and desktop 1024/1280/1440. Capture review screenshots without customer data.
7. Share the final URL, ownership/access handover and any remaining limitations only after those checks and client approval.

Rollback: revert the frontend deployment independently if needed. A backend rollback must retain support for any newly used category values and reversal metadata/ledger rows. Do not restore an old database snapshot over subsequent leads or payments. Keep original financial transactions and compensate/reconcile through approved auditable workflows. Pause use of reversal controls if a financial discrepancy is found and reconcile the specific account before further changes.

## Test commands

## Homepage reference follow-up

Rechecked the complete Website Changes PDF and Additional Developer Issues PDF. Homepage now uses a locally bundled 74 kB WebP trading-workstation photograph with readability overlays, four functional hero category links matching the reference, consistent colored financial icons, coordinated navy section/card backgrounds, and a photographic partner invitation banner. All six categories remain in the main category grid. Existing statistics endpoints and business actions remain unchanged. Browser inventory is still empty, so responsive browser screenshots and final visual approval remain pending.

Asset: `src/assets/images/hero-trading-workstation.webp`, generated with the built-in imagegen tool and optimized locally to WebP. Final generation prompt: "Create a photorealistic wide website hero BACKGROUND IMAGE, 1536x1024 landscape. Premium financial services partner platform, navy black and subtle gold palette. Modern trading workstation on a wooden desk, laptop showing abstract red green candlestick chart (no readable numbers), second upright monitor behind, softly blurred office plant and window. Workstation centered toward right half; left half very dark navy negative space for white headline, upper right remains subdued for overlay category links. Professional realistic photography, restrained cinematic cyan lighting, no people, no logos, no text, no watermark, no UI buttons or added graphics. This is a decorative background, not a complete website screenshot."

### Commands

```powershell
npm run lint
npm run build
node --import tsx --test tests/leadCapture.test.ts tests/clientWebsiteIssues.test.tsx tests/vendorTracking.test.ts tests/leadCaptureOrigin.test.ts tests/leadCaptureUi.test.tsx tests/adminDesign.test.tsx tests/campaignLogo.test.tsx tests/finalClientReport.test.ts tests/finalClientReportUi.test.tsx tests/websiteLaunchChanges.test.ts tests/websiteLaunchUi.test.tsx tests/additionalDeveloperIssues.test.ts
```
