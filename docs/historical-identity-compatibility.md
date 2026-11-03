# Isolated historical identities: approval and release

This is additive registry preparation, not a source-data migration. Original lead
campaign references, partner attribution, approvals and financial records are never
rewritten. Historical identities are registry-only; no Campaign documents, selectable
options, vendor URLs or application-resume mechanism are created.

## Private approval

For the two approved historical groups and 27 campaigns, use the standalone
interactive helper while production remains live, from the separate VPS audit checkout:

```bash
node --import tsx scripts/create-historical-reference-manifest.ts
```

It privately reads AUDIT_MONGODB_URI, then MONGODB_URI, then the existing owner-only
live .env or /etc/ved/r7-release.json (mongoUri). Prefer an authorized read-only URI
when available. No URI is requested in chat, passed in argv or printed. Run as the
OS account owning the private /etc/ved directory; it must have owner-only permissions.
Approval binds the exact two historical references, record membership, attribution
and approved/paid counts, not the changing number of active-campaign leads. The
snapshot total is recorded for information only under FROZEN_AT_CUTOVER policy.
The helper reads snapshot transactions only, verifies exact A=1/0/0 and B=9/9/0
record/approved/paid counts, and asks for explicit authorized isolation acceptance.
It rechecks the approved historical records after approval and exclusively creates the 0600 manifest;
it never overwrites an existing file or creates database/index/readiness records.
Only sanitized counts and the exact-file SHA-256 go to stdout; approval prompts go
to the terminal. Historical identity/status/membership drift or ambiguity stops setup;
normal active lead growth does not. Preserve the resulting
file/UUIDs for retries. If a partial file exists after a filesystem error, obtain
private review rather than deleting/replacing it automatically.

An authorized operator must create a JSON manifest OUTSIDE every repository checkout,
using the exact two original references privately established by the diagnostic.
Do not paste or commit the completed manifest. Store it with owner-only permissions
(0600 on Linux) and retain a protected recovery copy. Generate two distinct UUID v4
values once; retain them for retries. No alias trimming or case conversion is applied.

Structure (placeholders below are documentation only, not an executable manifest):

```json
{
  "version": 1,
  "approvedBy": "<authorized reviewer>",
  "approvalReference": "<recorded approval>",
  "expectedTotalLeads": "<observed number; informational>",
  "inventoryPolicy": "FROZEN_AT_CUTOVER",
  "historicalRecordsDigest": "<helper-generated historical-record digest>",
  "expectedCampaigns": 27,
  "entries": [
    {
      "originalReference": "<exact private Group A reference>",
      "historicalIdentity": "historical:<UUID-v4-A>",
      "expectedRecords": 1,
      "expectedApproved": 0,
      "expectedPaid": 0
    },
    {
      "originalReference": "<exact private Group B reference>",
      "historicalIdentity": "historical:<UUID-v4-B>",
      "expectedRecords": 9,
      "expectedApproved": 9,
      "expectedPaid": 0
    }
  ]
}
```

Confirm paid counts privately before approving the file. Group A's zero approved
count alone does not establish its paid count. Current production may grow normally;
the release command automatically obtains a fresh frozen inventory ONLY after
writer fencing. Any change after that freeze stops preparation. Nine approved leads do not prove nine
distinct mobiles; ordinary grouping determines singleton/conflict claims.

Review the exact file and its SHA-256 digest via a trusted approval channel. The
script compares the file bytes with APPROVED_HISTORICAL_MANIFEST_SHA256; this binds
an operator-provided approval, not an independent cryptographic signature. It
requires exactly two distinct references/identities, existing-campaign separation,
and the approved per-group record/approved/paid counts. Exactly matching partial
preparation may be retried with the SAME file/digest. Approval changes after partial
preparation require manual review; do not reset or delete registry data.

Tool-only environment variables:

```dotenv
HISTORICAL_REFERENCE_MANIFEST=<absolute external private file path>
APPROVED_HISTORICAL_MANIFEST_SHA256=<approved exact-file digest>
```

With those variables securely set in a separate reviewed audit checkout, a read-only
preflight uses AUDIT_MONGODB_URI and:

```bash
node --import tsx scripts/audit-campaign-mobile-duplicates.ts
```

Only aggregate counts are printed. No readiness/index/claim writes occur in this
audit. Without a manifest, previous strict unresolved-reference reporting remains.

## Minimal controlled release — separate explicit approval required

1. Review this patch and private manifest; accept unresolved cross-campaign identity
   uncertainty. Validate with synthetic/approved isolated fixtures first.
2. Prepare the release artifact without application startup. Drain and fence ALL VED
   lead/callback/import writers and campaign identity edits; pause only verified VED
   processes. No other VPS service or Nginx changes are required.
3. Take a consistent VED backup and verify isolated restoration, preserving all source
   collections, registry/state if present, and financial records.
4. Approve the historical manifest/digest once. Use the release runner, which fences
   writers, captures the full consistent cutover inventory and passes its digest
   automatically in VED_FROZEN_INVENTORY_SHA256. Standalone migration also requires
   that exact frozen digest; do not invent it or use a live/preparation inventory.
   Only with migration approval and writers actually fenced:

   ```bash
   node --import tsx scripts/prepare-campaign-mobile-registry.ts --apply --writers-paused
   ```

5. The script blocks unknown references and any invalid mobile (the previous
   --accept-unidentified-history bypass no longer applies). It creates only registry
   data/index and readiness metadata. It verifies complete lead coverage, exact claim
   read-back, no extra registry rows, a full non-sparse/non-partial unique compound
   index and a repeat snapshot against the frozen digest before readiness. Manifest
   digest, frozen inventory digest and covered lead count are retained
   in state. The source database must remain writer-fenced throughout; the command-line
   flag and repeat scan are NOT an enforced lock.
6. Activate the reviewed VED release using the separately verified production process.
   Check readiness and reopen VED writers. Monitor 409/422/503 and pending callback
   reconciliation. No main push, deployment or migration is authorized by this document.

## Financial and callback limits

Duplicate historical pairs remain ownerless HISTORICAL_CONFLICT claims, including
approved groups. Singleton historical pairs preserve their existing lead/partner
reference. No earning is awarded, reversed or recalculated during preparation.
Callbacks with noncanonical historical click campaign identities return 409 before
new event/lead/financial writes; correlated leads whose reference disagrees with the
current campaign also remain rejected. Historical conflicts never transfer ownership.
Unrelated current campaigns continue using the existing partner-independent claim key.

No evidence establishes which active campaign either historical reference belonged
to. Consequently these isolated claims cannot safely block that mobile in an unrelated
current campaign. This remaining uncertainty must be accepted explicitly. There is
no genuine vendor resume support or automatic callback repair.

## Recovery

On failure, keep VED writers paused and preserve partial claims and source records.
Retry only after review with identical approval/input. Never mark readiness manually,
drop the index, clear claims, rewrite references or restore an old backup over later
financial activity. An old application bypasses duplicate protection; reopening it
requires a separately approved safety decision. Prefer a targeted fix while retaining
the registry. Manifest loss or a missing identity approval is a blocker, not a reason
to infer a new historical mapping.
