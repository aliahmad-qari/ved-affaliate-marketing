# Customer registration landing — local implementation

Branch: `feature/landing-registration`, isolated worktree based on `origin/main` at `8273feb3a9489ffce905fd3f498f954ea9f1e6eb`. Requirement #7 worktree and pending release work remain separate. No migration, production connection, push or deployment was performed.

## Audit and scope

- `src/App.tsx`, `campaignCaptureUrl()` in `src/lib/campaignTracking.ts`: attributed `/campaigns/:slug?ref=...&pid=...` navigates to the existing public capture endpoint. The homepage `/` is not a capture route. These functions are unchanged.
- `server/routes/campaignRoutes.ts`: existing GET/POST `/api/public/campaigns/:slug/go`; existing POST rate limiter and origin checks remain in place.
- `server/controllers/leadCaptureController.ts`: `resolveTracking()` validates the live campaign and active partner, matching both referral identifiers. `destination()` is unchanged, including m.Stock parameter preservation.
- The public form records an enquiry, not a partner account or completed vendor application. `RegisterPage.tsx` and partner/admin authentication are unchanged. Existing partner signup still requires its existing email/password fields.
- Mobile validation remains the existing Indian 6–9 + nine digits rule, accepting existing supported spaces, hyphens, parentheses and +91/91 prefixes. Name and consent are validated on the server. Errors retain entered values and consent.
- Existing transaction creates one click, PENDING enquiry and notification for a signed click ID. Existing unique click/enquiry indexes are reused. No indexes or schemas were added; no dependency on Requirement #7 registry.

## Exact flow

1. Open an attributed campaign link. Existing frontend forwarding remains unchanged.
2. GET validates campaign/partner context and renders the new shared React screen as native HTML. No data is created on GET.
3. POST validates the signed 30-minute capture token. An existing enquiry with the same token click ID, campaign and partner goes directly to the welcome-back state, with no resubmitted contact fields required.
4. A new valid POST retains the existing transaction and vendor 303 handoff. It issues an HttpOnly, SameSite=Lax receipt signed for a separate audience, expiring after seven days and scoped to this campaign capture path. Production cookies are Secure.
5. A return GET only shows welcome-back after the receipt signature, expiry, campaign, ref, pid and corresponding original enquiry have all been checked. Forged/missing/expired receipts show a new form. No public phone lookup exists.
6. Welcome-back shows no original personal data, has disabled blank input placeholders and no capture token or new submission button. `CONTINUE TO MAIN PAGE` links to **`/`**. It does not open a vendor URL. Root homepage routing is unchanged and cannot send this user back to capture automatically.
7. Existing same-token race recovery handles unique-index collision by confirming the exact original enquiry, then rendering welcome-back. Financial calculations and records are untouched.

The receipt establishes possession of this browser's signed capture context, **not phone ownership, vendor completion or application-resume support**. It is an opaque bearer credential; it must not be copied or logged. Consent wording remains the approved existing application contact permission. Same-origin referrer policy preserves the native POST Origin while suppressing cross-origin referrers; no third-party scripts, fonts or tracking resources were added. Pages are no-store and unframeable.

## Duplicate limitations

Double-clicks are disabled progressively; the native form remains functional without JavaScript. Backend same-token idempotency remains authoritative. A fresh browser/session/token using the same mobile can still create another enquiry, as can the existing manual workflow. There is no phone OTP flow. This patch neither promises global duplicate prevention nor introduces a competing registry. Different campaign applications remain separate. Database-level concurrent campaign/mobile enforcement remains blocked on the separately approved Requirement #7 release. Real MongoDB concurrency was not exercised here; mocked tests do not prove index/transaction readiness in production.

## UI and preview

Functional React controls are in `src/components/CustomerRegistrationScreen.tsx`; shared CSS is `src/styles/customer-registration.css`. `server/utils/registrationView.ts` produces server-rendered HTML, with small progressive loading/double-click protection. Hero is a generated hero-only illustration, not a screenshot of the page. SVG icons and gold decoration are code-rendered. Both supplied WhatsApp reference files were visually inspected; the illustration and typography are recreations, not a claim of identical pixels.

From this worktree run:

```powershell
node --import tsx scripts/preview-customer-registration.ts
```

Open `http://127.0.0.1:4285` and `http://127.0.0.1:4285/already-registered`. This standalone preview imports no app startup, dotenv or database; it stores nothing. It is not an authentication or functional submission simulator. Screenshots in `docs/previews/` contain synthetic/empty fields only. Disposable browser profiles are ignored by Git.

## Validation

12 tests passed across customer presentation, capture route, origin checks, campaign-link construction, m.Stock vendor preservation, admin progress/financial transitions, and partner/admin password/login recovery. Invalid/expired tokens, missing consent, invalid mobile/name, storage failure, same-token replay, valid/forged receipts and original new-submission redirects are covered. TypeScript and production build passed (Windows native-config-loader workaround); existing large-bundle warning remains. Final comparison corrected the welcome-back check icon and moved its homepage button outside the confirmation panel, brightened gold typography and refined mobile spacing. Browser viewport checks cover both states at 320, 390, 768 and 1440 pixels with no horizontal overflow; returning-state buttons point to `/`. Updated screenshots cover 390-pixel mobile and 1440-pixel desktop. The recreated hero and system typography are not pixel-identical artwork. No production browser or customer was used.

## Separate deployment approval required

Locally committed after the final approved review; not deployed or pushed. The implementation commit SHA is supplied in the final delivery message. Do not merge or push main: the existing workflow runs production deployment on main pushes.

Before a separately approved release:

1. Review this isolated diff, screenshots and duplicate limitations. Confirm deployment target matches the restored production baseline; do not merge pending Requirement #7 registry changes.
2. Review the existing startup behavior: this baseline `server/server.ts` and Vite dev config invoke `ensureSeededData()` on successful DB connection. This UI patch does not alter or execute that code. Integrate the already-approved standalone non-mutating startup fix separately before a production startup; do not deploy a seed-mutating startup against live data.
3. Use the existing VED-only release process only after explicit approval and a verified backup/rollback artifact. Include `src/components/CustomerRegistrationScreen.tsx`, `src/styles/customer-registration.css` and the public hero asset in deployment: the backend imports the component and reads the stylesheet at runtime. A dist-only upload is insufficient.
4. Retain existing API origin, JWT secret, proxy, transaction/index configuration, campaign URLs and data. No environment variables are added. Verify same-origin HTTPS cookie persistence; cross-site deployments are not newly supported.
5. Check new capture then returning context using isolated staging fixtures before reopening. Verify existing `/`, partner/admin login and vendor URL preservation. Do not create test leads in production.

Rollback: restore the previous complete source and dist artifact using the approved VED-only procedure. No database rollback, deletion, seeding, registry preparation or migration is required for this UI patch. The previous code ignores the new path-scoped receipt cookie. Keep all real enquiries created by legitimate users intact.
