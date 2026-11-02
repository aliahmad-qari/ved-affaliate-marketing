# Private unresolved campaign diagnostic

Standalone command, from an isolated reviewed audit checkout:

```bash
read -rsp 'Authorized read-only VED database URI: ' AUDIT_MONGODB_URI; echo
read -rsp 'Private diagnostic key (64 hexadecimal characters): ' AUDIT_DIAGNOSTIC_KEY; echo
export AUDIT_MONGODB_URI AUDIT_DIAGNOSTIC_KEY
node --import tsx scripts/diagnose-unresolved-campaigns.ts
diagnostic_status=$?
unset AUDIT_MONGODB_URI AUDIT_DIAGNOSTIC_KEY
printf 'Diagnostic exit status: %s\n' "$diagnostic_status"
```

Generate the diagnostic key once with a secure random generator (32 bytes), store
it in the approved private secret store, and reuse it for comparable reports.
Never commit or share it. Labels use domain-separated HMAC-SHA256, not unsalted
hashes of guessable campaign aliases. They are pseudonyms, not encrypted references;
key disclosure permits dictionary testing. Actual identifiers stay out of output.

The raw MongoClient reads only campaigns (_id/slug), leads (campaignId/status), and
campaign audit metadata (entityId/action and before/after slug/_id). It uses a
read-only snapshot transaction; no application startup or models are imported.
Missing required collections, inaccessible history, transaction failure or query
limits fail without printing raw errors or partial results. An absent auditlogs
collection is explicitly reported as history unavailable. No collection/index is
created. The limit is 100,000 documents per queried source.

Only an exact historical slug snapshot attached to a specific current canonical
campaign is reported as historical mapping evidence. Conflicting historical
targets, absent current targets and ambiguous current aliases do not establish a
mapping. No case folding, trimming, name similarity, URLs or seed-list position is
used to infer identity. This diagnostic does not consult external backups or
invent historical metadata fields.

Current repository campaign audit writers store name/payout/status, not slug
history. Therefore real production reports may have NO_EXACT_MAPPING_EVIDENCE
for every group. Historical snapshots may exist only if earlier software recorded
them. An authorized administrator must then inspect approved backups/archived
configuration privately. Use the same key/helper locally to correlate candidate
references to labels without disclosing raw identifiers. Similar names alone are
not proof; document exact source evidence and obtain mapping approval separately.

Output includes the distinct group count, affected/approved/paid counts per label,
evidence status and an opaque canonical label only for evidenced targets. Every
group still requires manual confirmation, and registryActivationAllowed is always
false. No mapping manifest or registry writes are produced.

The ten unresolved records are known from the supplied production report, but
their number of distinct references and actual per-group evidence cannot be known
until this diagnostic is run by an authorized operator. Do not substitute test
fixture counts for production results. Preserve all original leads and financial
history; resolve evidence first, approve any compatibility mapping second, and
keep registry activation blocked meanwhile.
