# Requirement 7 - duplicate-safe campaign leads

Local branch: `feature/prevent-duplicate-leads`. No push, commit, deployment, database connection, production environment edit, index creation, migration or service restart was performed during implementation. The other eight client features and all payout/referral formulas remain unchanged.

## Implemented behavior

- Global uniqueness is `(canonical campaign Mongo ID, normalized Indian customer mobile)`, NOT partner/mobile. Ten-digit national numbers and +91/91 prefixes with spaces, parentheses and hyphens normalize identically. Extensions, foreign numbers, ambiguous leading-zero formats and invalid input are rejected rather than guessed.
- CampaignMobileClaim is a separate collection. Its non-partial/non-sparse `unique_campaign_mobile` index is required; schema autoCreate/autoIndex are disabled. Existing Lead records and their legacy ID/slug representation remain unchanged.
- Public form and manual report creation claim the key inside the same Mongo transaction as their lead writes. The public transaction also contains the original click and notification. Failed transactions roll back the claim and side effects. No standalone-Mongo or in-memory creation fallback silently bypasses protection.
- Structured manual/API duplicate: HTTP 409, code DUPLICATE_CAMPAIGN_MOBILE, message `This mobile number has already been submitted for this campaign.` No original lead, mobile, partner, private URL or tracking token is returned. Public HTML uses the same message and status.
- Both public and React forms show `If Not Completed, Click Here` as an expandable explanation. It does not redirect, reveal another partner's attribution, create a lead or claim vendor completion. Same-token form retries now show this duplicate state rather than performing a second vendor redirect.
- Existing customer-form enquiries remain admin-reviewed. A same-partner authenticated callback that matches an existing manual lead preserves that lead without awarding a new earning. Cross-partner, historical-conflict or incompatible conversion references are rejected without transferring attribution. Existing callback conversion/click references and payout snapshots remain authoritative.
- Vendor-created leads also claim campaign/mobile within the existing callback transaction. New conversions without a valid mobile AND without a usable existing lead correlation return CUSTOMER_MOBILE_REQUIRED (422), with no lead/earning/event committed. Providers must retry with valid data; they must not interpret this as a successful conversion. Do not enable this release against an incompatible live vendor feed without reviewing this behavior.
- Exact event retries and repeated same-status conversion notifications do not create more financial entries or dashboard rows. A conflicting event ID is not silently accepted. Existing earning/referral calculations and idempotency keys are unchanged.
- Existing approved, paid, rejected and abandoned leads continue to reserve their campaign/mobile identity. No automatic expiry/release of claims is implemented. This conservative policy prevents re-earning through resubmission.

## Readiness gate - deployment prerequisite

All three lead creation paths require:

1. `leadDeduplicationState` record `_id: campaign-mobile-v1`, `version: 1`, `ready: true`.
2. A full unique compound index on `campaignmobileclaims`: canonicalCampaignId + normalizedMobile.
3. Working MongoDB transactions (replica set or compatible sharded topology).

If preparation is absent, creation fails closed. Do NOT deploy expecting normal lead submissions before the approved registry preparation window. Runtime readiness performs read-only checks; it never builds indexes or backfills data. Unsupported transaction infrastructure must be resolved separately; no production topology change was made here.

## Vendor continuation limitation

The repository has a generic vendor destination, not a verified secure application-resume API. No resume URL or public resume endpoint was invented. Mobile knowledge is not proof of ownership. The fallback tells customers to use the provider's official existing application login or contact VED support, without publishing an unapproved login URL. m.Stock destination preservation and ref/pid generation remain untouched. VED can prevent duplicate internal click rows after mobile submission; it cannot guarantee an external vendor will not count a later independently opened URL as a new click.

VED contact capture does not prove a vendor application was submitted/completed. Existing process status/approval semantics are preserved. No new sub-team functionality is implemented; existing lead metadata is not overwritten.

## Historical inventory - read-only, separate execution

`scripts/audit-campaign-mobile-duplicates.ts` uses a raw MongoClient, never imports app startup/models, and never writes. Configure `AUDIT_MONGODB_URI` privately for the correct database with a read-only account. Do not paste URI values into chat or shell history. Then, after authorized access approval:

```bash
node --import tsx scripts/audit-campaign-mobile-duplicates.ts
```

Only aggregate counts and topology/index-presence booleans are printed: total/valid records, invalid or missing mobiles, unresolved campaign aliases, unique pairs, duplicate groups/extra records, cross-partner/source groups and approved/paid conflict groups. No customer names, numbers, lead IDs or credentials are printed. Inventory can consume up to one million distinct valid pairs in memory; larger datasets require a separately reviewed batch strategy. Campaign aliases resolve only by Mongo ID or slug; ambiguous/unrecognized aliases are not guessed from a name.

Actual production counts, installed indexes and transaction support remain UNKNOWN because no production access is configured here. A hello topology indication is not a substitute for an actual transaction test on isolated staging.

## Separately executable registry preparation - NOT RUN

`scripts/prepare-campaign-mobile-registry.ts` has no startup/deployment hook. It requires all of:

- An approved consistent backup and isolated staging rehearsal.
- Every VED lead writer drained/paused, including old workers, callback consumers/imports and campaign identity edits. The script requires the operator's `--writers-paused` acknowledgement; it cannot independently enforce a maintenance window.
- Private `MIGRATION_MONGODB_URI` with the correct explicit database and necessary index/write privileges.
- `CONFIRM_DEDUPLICATION_MIGRATION=YES` and `--apply`.

After separate migration approval, with those environment variables securely set:

```bash
node --import tsx scripts/prepare-campaign-mobile-registry.ts --apply --writers-paused
```

The migration marks readiness false, inventories historical leads, refuses unresolved campaign aliases, creates only the registry index, and seeds one claim per normalized pair. Single-lead pairs retain the original lead/partner reference. Multiple-lead pairs become HISTORICAL_CONFLICT with a count and no arbitrarily chosen owner. Source leads, clicks, accounts, financial transactions and audit history are not updated/deleted/merged.

Invalid/missing historical mobiles stop activation. Complete identity and claim coverage is required; `--accept-unidentified-history` no longer bypasses that requirement. For the two explicitly approved isolated historical references, follow `docs/historical-identity-compatibility.md`; all other unresolved references still block readiness.

Matching partially prepared claims are idempotent; discrepancies stop the operation without overwriting their owner. Already-active registries cannot be rerun online. Readiness becomes true only after insertion and index verification complete. On failure, keep writers paused and readiness unconfirmed until a reviewed retry. Never mark readiness true manually to bypass missing inventory/indexes.

## Production prerequisites and release sequence - approval required

1. Review and approve the complete branch diff. Existing GitHub main-push workflow auto-deploys; do not push or run it during preparation. Server-side deploy.sh/process manager are not verified here.
2. Obtain read-only masked inventory and actual indexes/topology. Confirm callback customer-mobile availability, retries, original attribution and historical conflict policy. Stage the production-like dataset with anonymized records.
3. Take an encrypted, consistent VED database backup including campaigns, leads, partners, clicks, webhook events, wallet transactions, notifications, audit logs and existing registry/state if present. Verify restoration in an isolated database. No old snapshot may overwrite subsequent financial activity.
4. Run the preparation script in staging and test actual concurrent transactions/unique-key conflicts, failure rollback, callback retries and both frontend duplicate states. Prevent staging from sending real vendor traffic/emails/payments.
5. Schedule an approved VED-only write maintenance window. Pause/drain all old submission/callback workers and campaign identity edits. Do not stop unrelated VPS projects or restart the VPS. Do not change Nginx as part of this feature.
6. Using the verified VED release mechanism, install the reviewed release/backend/frontend. New code will block new lead creation until preparation succeeds. Run the separately approved migration with all writers still paused; do not invoke app startup as an inventory tool (existing startup includes seeding behavior).
7. Confirm registry readiness/indexes, then start/reload ONLY the identified VED process and resume approved writers. No runtime environment variable or existing payout/vendor configuration changes are required by this feature. The new audit/migration variables are tool-only credentials, not frontend configuration.
8. Verify public/manual first submission versus duplicate behavior using approved test customers, different campaigns, callback reconciliation and unchanged original links/payouts. Watch 409/422/503 responses and vendor retry queues. Actual lead-creation smoke tests require explicit authorization; do not generate fake conversions or customer payments.

## Rollback

Keep the claim registry and readiness metadata; do not drop indexes/collections or delete source records. If the new release fails, pause VED submission/callback writers before reverting. An old release bypasses registry protection: do not resume old writers without a reviewed duplicate-safe guard. Prefer a targeted fix while retaining the guard. Preserve every original lead, attribution, wallet entry and audit record. No automatic down migration or wallet recalculation is provided.

## Files

New: shared/customerMobile.ts; server/models/CampaignMobileClaim.ts; server/services/leadDuplicateProtection.ts; scripts/lib/campaignMobileInventory.ts; scripts/audit-campaign-mobile-duplicates.ts; scripts/prepare-campaign-mobile-registry.ts; tests/duplicateLeads.test.ts; this document.

Modified: server/services/leadStore.ts; server/controllers/leadCaptureController.ts; server/controllers/partnerDataController.ts; server/controllers/vendorWebhookController.ts; src/pages/PartnerLeadsPage.tsx; src/services/partnerApi.ts; tests/leadCapture.test.ts. The existing redirect test fixture is updated for duplicate responses and status-independent canonical campaign lookup, with registry behavior isolated to the new test suite.

## Validation

Full local regression run: 34 passed, zero failed. TypeScript and production build passed. Existing Vite native-config and bundle-size warnings remain. No real MongoDB or vendor connection was used.

Local tests use isolated database doubles; production and real Mongo transactions were not contacted. Coverage includes formatting aliases, ID/slug identity, same/different campaigns, cross-partner and cross-source submissions, concurrent claims, index collisions, historical approved/paid conflicts, transaction rollback, callbacks, financial idempotency, readiness and unsupported continuation. Existing tracking/m.Stock, financial, authentication and admin regressions should pass before release. Real browser/device checks and actual replica-set concurrency remain staging acceptance requirements.

```powershell
npm run lint
npm run build
$testFiles = @(rg --files tests -g '*.test.ts' -g '*.test.tsx')
node --import tsx --test --test-concurrency=2 $testFiles
```
