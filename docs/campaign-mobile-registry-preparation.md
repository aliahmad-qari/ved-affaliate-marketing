# Campaign/mobile registry preparation

This is a separate production database operation. Do not run it until an approved VED-only maintenance window is active. The script never starts services and never writes leads, campaigns, partners, wallets, earnings, payout transactions, or vendor attribution.

## Database objects

- Collection `campaignmobileclaims`.
- Unique index `unique_campaign_mobile` on `{ canonicalCampaignId: 1, normalizedMobile: 1 }`, with `unique: true`. No sparse, partial, TTL, or collation options.
- Collection `leadDeduplicationState`, with its built-in `_id_` index and readiness document `_id: "campaign-mobile-v1"`.
- `campaignmobileclaims` also receives MongoDB's built-in `_id_` index.

Historical duplicate pairs are represented by one `HISTORICAL_CONFLICT` claim with `historicalCount`; it has no `leadId` or `partnerId`, so migration does not choose a financial or attribution owner. Existing lead documents remain unchanged. The unique key omits partner ID and uses the same ten-digit Indian mobile normalization as application submissions.

## Read-only inventory

On the Contabo host, use a private environment file outside the repository. Set `PROD_AUDIT_MONGODB_URI` to the authorized read-only user for exactly `VedAffiliatemarket` and set `R7_CAMPAIGN_REFERENCE_HMAC_KEY` to a private random key of at least 32 bytes. If campaign references cannot be resolved from exact campaign IDs/slugs, the dry run prints only a stable keyed HMAC label and record count. Do not print or paste the original reference.

```bash
cd /var/www/ved-r7-audit
set -a
. /etc/ved/r7-registry-audit.env
set +a
node --import tsx scripts/prepare-campaign-mobile-registry.ts --dry-run
```

Dry run reports aggregate lead, invalid-mobile, unresolved-reference, duplicate, cross-partner, approved/paid-conflict and claim-coverage counts plus an approval digest. It does not create collections or indexes. The approval digest is bound to the target database, masked inventory digest, schema/index state, MongoDB binary/topology facts, and private manifest checksum.

## Exact historical mappings

An unresolved reference may be mapped only with exact archived evidence. Store a private JSON manifest outside Git with this shape and mode `0600`:

```json
{
  "version": 1,
  "approvedBy": "authorized reviewer identifier",
  "approvedAt": "2026-11-08T00:00:00.000Z",
  "limitationsAcknowledged": "I_APPROVE_EXACT_EVIDENCE_BASED_CAMPAIGN_MAPPINGS",
  "entries": [
    {
      "referenceHmac": "full 64-character label from the dry-run's keyed diagnostic",
      "canonicalCampaignId": "exact existing campaign MongoDB ID",
      "evidenceReference": "private archive/change record proving this exact mapping"
    }
  ]
}
```

There must be exactly one manifest entry per unresolved reference and each target campaign ID must exist. Similar names, formatting, or operator guesswork are not accepted. If exact evidence is unavailable, do not prepare a manifest; readiness remains blocked.

## Apply gate (prepare only; do not run without separate approval)

Minimum database roles for apply are `readWrite` and `dbAdmin` scoped only to `VedAffiliatemarket` (or a custom role with only the required database-scoped find/list/createCollection/createIndex/insert/update actions). The script checks the authenticated role list when Atlas exposes it and refuses broad or unverified apply credentials. The read-only audit account cannot apply.

During the approved maintenance window, stop only the VED API using the existing operator procedure. Confirm PM2 shows exactly one `ved-affiliate-api` entry, stopped in `/var/www/ved-affaliate-marketing`, no online PM2 process uses that directory, and port `4004` has no listener. Confirm all VED webhook/manual lead writers are fenced. Do not stop other PM2 applications. Export `R7_WRITERS_FENCED=YES` only after that confirmation. Use `R7_REGISTRY_PREPARE_URI`, the same private HMAC key, and (if needed) `R7_HISTORICAL_ALIAS_MANIFEST` in a separate mode-0600 environment file.

First run `--dry-run` again with the final fenced inventory. Review the aggregate report and digest. Then the separately authorized operation is:

```bash
node --import tsx scripts/prepare-campaign-mobile-registry.ts --apply --confirm-target=VedAffiliatemarket --maintenance-approved --writers-fenced --approval-digest=REPLACE_WITH_EXACT_REVIEWED_DRY_RUN_DIGEST
```

If a historical mapping manifest is present, add `--approve-historical-mappings`. Any inventory, manifest, index, role, target, or readiness difference causes a stop. The script first marks readiness false, prepares only the two collections and one unique compound index above, idempotently inserts only missing claim rows, verifies complete coverage against a fresh inventory, and sets readiness true last. On any failure after fencing, keep VED stopped and readiness false; do not drop or roll back collections/indexes/claims. Diagnose the exact safe stage and rerun dry-run before another approved apply.

The script does not query or infer FCV. Atlas Free/M0 manages cluster version/FCV; a restricted user's `getParameter` failure is not treated as a successful FCV check. This registry operation uses ordinary collection creation, unique-index creation, reads and writes; the application additionally needs replica-set transaction capability, which the script checks via the server's binary version, replica-set `hello`, and logical-session support. These checks do not claim an actual production transaction write test.
