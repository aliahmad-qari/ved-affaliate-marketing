# One-command Contabo release, explicit approval required

This opt-in Linux CLI never runs from application startup or GitHub Actions. It
does not run deploy.sh, pull/push main, run unit tests, change Nginx or restart any
other PM2 application. The default command is read-only; --apply requires the exact
dry-run approval digest. This tooling must itself be reviewed and saved in an
immutable release commit before production use. It has NOT been run on Contabo.

## One-time private inputs

Use a separate, clean release checkout, with its reviewed production dist already
built and its existing dependencies installed. The live checkout must already have
the approved Git object available (fetching a feature branch does not deploy it).
This runner requires the live and release package-lock.json files to match: it
does not upgrade production dependencies during downtime. The runner must execute
from the reviewed release revision, not the live application directory.

Create one owner-only (0600) JSON configuration outside ALL checkouts. No real
configuration, credentials or completed historical manifest belongs in Git.
Example shape; replace placeholders privately:

```json
{
  "liveDirectory": "/var/www/ved-affaliate-marketing",
  "releaseDirectory": "/var/www/ved-r7-release",
  "backupDirectory": "/var/www/ved-r7-backups",
  "reviewedCommit": "<full SHA including this reviewed release tooling>",
  "databaseName": "<exact existing VED database>",
  "mongoUri": "<private authorized VED connection>",
  "manifestPath": "/etc/ved/historical-references.json",
  "manifestSha256": "<approved exact-file SHA-256>",
  "restoreImage": "mongo@sha256:<approved local image digest>",
  "allVedWritersAreThisProcess": true,
  "vendorRetryHandlingApproved": true,
  "acceptHistoricalIsolation": true,
  "deploymentAutomationFrozen": true
}
```

The four true values are explicit operator attestations, not facts a script can
discover. Confirm there are no separate VED import/cron/callback workers or external
writers. No one may push main or otherwise redeploy during cutover. Review vendor
retry/reconciliation arrangements; the tool does not queue incoming callbacks.
The existing private manifest must contain the two approved identities/counts as
documented in historical-identity-compatibility.md.

Required already-installed tools: Node/tsx dependencies, Git, an existing PM2
daemon under the SAME OS account that owns VED, MongoDB Database Tools, mongosh,
and Docker. No automatic tool installation or image pull occurs. Preload the
approved official MongoDB image whose MONGO_VERSION exactly matches production.
The sole opt-in exception is Atlas 8.0.36 to an isolated 8.0.34 verifier. To approve
it, add this object to the private JSON (imageDigest must exactly equal restoreImage):

```json
"restoreCompatibilityApproval": {
  "approved": true,
  "sourceVersion": "8.0.36",
  "verifierVersion": "8.0.34",
  "fcv": "8.0",
  "imageDigest": "mongo@sha256:<same approved digest as restoreImage>"
}
```

Without this object, exact-version behavior remains. No other mismatch is allowed.
Actual production buildInfo and stable FCV are checked read-only; unknown or
transitional FCV fails. Actual container buildInfo/FCV are checked before AND after
restore. Its mongorestore must match the host mongodump tool version exactly. Both
server versions, FCV, exception, image digest and required tool version are bound
to the dry-run approval digest; verified actual versions/tool versions are retained
in restore-verified.json. All document/index/options/financial preservation gates
remain mandatory. This is dataset-specific restore verification, not a general
promise that older-patch archive restores are compatible. Do not change production
FCV to satisfy the check. An Atlas upgrade invalidates the approved version pair.
Omit restoreCompatibilityApproval when using an exact-version verifier.

The database account needs backup/read/index/registry-write permissions plus
read-only $currentOp and FCV getParameter visibility. No account/role/topology
changes are automated.

Prepare backupDirectory outside all checkouts as an owner-only (0700) directory
on the SAME filesystem as the live application, with at least 1 GiB free space
and room for the previous dist. Database data plus index size must be at most
128 MiB for this bounded restore procedure; larger databases require separate review.
The isolated restore is network-disabled, publishes NO ports, is limited to one
CPU and 1 GiB RAM, and has bounded temporary storage. Preflight requires at least
1.5 GiB free host RAM. If capacity/tools/permissions do not match, STOP and resolve
them explicitly; do not weaken checks. No other project's database is used.

## Operator procedure: dry-run, then separate approval

### Already-stopped VED maintenance

Default preflight still expects VED online. If it is already deliberately stopped,
an authorized operator may add these private configuration fields ONLY after
verifying the maintenance approval and Nginx routing (the tool never changes Nginx):

```json
"initialVedState": "stopped-maintenance",
"maintenanceApproval": {
  "approved": true,
  "reference": "<actual authorized maintenance approval reference>",
  "nginxMaintenanceConfirmed": true,
  "apiPort": 4004
}
```

Do not set these flags automatically. This mode requires all matching PM2 instances
stopped with PID 0, exact live cwd/launch configuration, effective port 4004, no TCP
listener on that port (IPv4 or IPv6), no additional VED PM2 writer and zero active
VED database operations. Existing all-writers/automation attestations still apply:
read-only process/activity checks cannot prove absence of undeclared future writers.
Mixed/errored/restarting states are rejected. During apply, identity and the fence
are revalidated; already-stopped mode skips the redundant stop command. Only the
final, fully verified release can restart ved-affiliate-api. Nginx maintenance must
remain until a SEPARATE operator-approved reopening step; no config change here
removes maintenance routing.

The pre-maintenance reviewed SHA stays immutable. After reviewing/validating this
patch, make a new commit. Before editing reviewedCommit in the private config,
verify in the release checkout that HEAD is that new SHA, its tracked tree is clean,
and its dist was built for that revision. Verify in the live checkout, read-only:

```bash
git -C /var/www/ved-affaliate-marketing cat-file -t <NEW_REVIEWED_SHA>
git -C /var/www/ved-affaliate-marketing show <NEW_REVIEWED_SHA>:package-lock.json | sha256sum
sha256sum /var/www/ved-affaliate-marketing/package-lock.json
```

The first must return commit; the lock hashes must match. If the new object is absent,
obtain it through the approved feature-branch transfer process without checking out
or starting production. Only then may the operator back up the private config and
set reviewedCommit to the new SHA. Never amend/overwrite the original reviewed
commit or restore production lock metadata without separate approved review.

Dry run does not start, stop or restart a service in either mode. It prints a safe
stage/check identifier on failure, never a raw database/subprocess exception. Apply
requires the exact newly generated digest; argument parsing rejects missing, extra
or malformed flags/digests before reading private config. Digest binding explicitly
includes initial state, port and full backup/restore policy, in addition to revision,
configuration, artifacts, PM2 identities, image/FCV/tools and manifest approval.

From the separate reviewed release checkout:

```bash
node --import tsx scripts/release-ved-requirement-7.ts \
  --config /etc/ved/r7-release.json
```

This validates the clean Git revisions, staged asset digest, exact lockfile match,
PM2 entry/cwd/environment, historical manifest and counts, transaction execution,
collection types, tools, pinned image, resources and current-operation visibility.
It prints only a sanitized plan with an approvalDigest. It does not stop services,
create a backup/container, prepare the registry, modify files or write the database.
Watch/cron-restarted PM2 configurations and unknown launch wrappers are rejected.
Supported launchers are the repository server.ts/server/server.ts, tsx server.ts,
or npm start/npm run start with cwd pointing at the exact live directory.

After a human separately approves that exact plan and maintenance window:

```bash
node --import tsx scripts/release-ved-requirement-7.ts \
  --config /etc/ved/r7-release.json \
  --apply --approve '<approvalDigest from dry-run>'
```

The same preflight runs again. Configuration, release, artifact, process, versions
or historical-identity approval drift invalidates approval. Ordinary active lead
growth does NOT invalidate the plan: total inventory is deliberately excluded from
its digest. New manifests use FROZEN_AT_CUTOVER; their expectedTotalLeads is an
informational preparation-snapshot count. Historical record membership/attribution
and exact per-group status counts remain bound to the approved manifest. Older
strict manifests are not silently reinterpreted or overwritten.

## What the approved command automates

1. Acquire an exclusive VED release lock; create a private backup/recovery journal.
2. Stop ONLY pm2 process name ved-affiliate-api, including its cluster instances.
   Confirm stopped state and no active database operations for the VED database.
   **This pauses the entire VED application**, because the current monolith has no
   independently switchable lead-writing gate. Other VPS projects remain running.
   Now capture a fresh consistent source snapshot, freeze its complete identity/claim
   digest and current lead count, and retain both in the private release journal.
3. Take a database archive with credentials in a private Mongo tools config, never
   argv. Confirm source fingerprints did not change during backup.
4. Start a fresh network-disabled restore container. Restore the full VED database
   there WITHOUT --drop. Compare every document hash/count, collection options and
   index definition with production. Verify the archive checksum too.
5. Stop only that new verifier container. Retain the archive, restore proof and
   recovery journal. Reconfirm the production baseline before migration.
6. Run the existing approved-manifest preparation command. Read back all claims,
   verify full coverage/index/readiness/digest and verify every non-registry source
   collection is unchanged. VED_FROZEN_INVENTORY_SHA256 is passed automatically;
   migration and its repeat snapshot must match it exactly. Registry readiness stores
   the same frozen digest and covered count. Any failed condition leaves VED stopped.
7. Only now check out the approved SHA in the live checkout, detached, with Git
   hooks disabled. Keep .env, existing dependencies and untracked local files.
   Retain previous dist, then install and hash-check the reviewed dist artifact.
8. Restart ONLY ved-affiliate-api with its retained PM2 configuration/environment.
   Check local API health and unchanged unrelated PM2 process statuses. Failed
   health verification stops VED again. No fake lead or financial test is created.

No fixed maintenance duration is promised. Backup/restore and MongoDB speed dictate
the pause; there are no repeated builds or unit suites in the release path.

## Failure and recovery

No finally block ever starts VED. Any post-fence failure attempts to stop ONLY VED
and its newly created verifier, then exits nonzero. It does not reset readiness,
delete claims, restore the production database, roll back financial activity, or
restart an old application automatically. If PM2 itself cannot execute stop, an
operator must confirm the fence manually before any further action.

Inspect only the private backupDirectory/ved-r7-*/release-state.json, FAILED,
baseline.json and restore-verified.json. Mongo tools config/archives contain secrets
or production data: keep the directory owner-only, with approved retention/offsite
protection. Do not paste them into chat or commit them. A stopped verifier container
is retained under a unique ved-r7-restore-* name for deliberate cleanup; no prune
or broad delete command is used. No container is configured to restart automatically.

The exclusive lock is retained at the live repository Git path
ved-r7-release.lock after success/failure. A human must inspect the journal before
removing that one lock and approving another attempt. Already-ready registries are
not automatically rerun: recovery after a prepared-but-not-started release needs
explicit review, not an automatic rollback/reopen. The previous source SHA and dist
are retained, but an old source release bypasses duplicate protection and must not
be reopened without a separate approved recovery decision. Never restore an older
snapshot over newer valid leads or financial activity.

Remaining trust boundary: PM2 stop/currentOp/fingerprints cannot prove there are no
future writes from an undeclared external process. The all-writers/frozen-automation
attestations and maintenance discipline remain mandatory. Client functional acceptance
follows successful startup; historical isolation does not identify a prior active
campaign and does not provide genuine vendor application resume.
