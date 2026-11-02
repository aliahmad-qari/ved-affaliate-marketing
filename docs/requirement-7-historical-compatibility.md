# Historical compatibility review

Reported production audit: 679 leads, 669 resolvable records, 469 campaign/mobile
pairs, 120 duplicate groups, 200 extra historical records, 1 cross-partner group,
2 cross-source groups, 45 approved/paid conflict groups, 10 unresolved campaign
references, and no invalid mobiles. These counts were supplied by the developer;
no production connection was made during this review.

Existing preparation already represents duplicate groups as HISTORICAL_CONFLICT
without selecting an owner. It does not delete, merge, update or recalculate source
leads, attribution, statuses or financial records. The 45 financially sensitive
groups are not evidence that 45 payouts were duplicated or that money is owed.
Existing callbacks requiring an ownership claim for these conflicts can reject
with 409; review pending vendor events and arrange manual reconciliation before
activation. Do not bypass the conflict guard or automatically reverse earnings.

The additive inventory diagnostics report unresolved-reference categories and
approved/paid record counts only. Formatting candidates are suggestions, never
automatic mappings. Missing and ambiguous identities remain unresolved. Aggregate
data cannot establish the correct identity of a missing historical campaign.

Next: run the updated read-only audit from a separate reviewed checkout with an
authorized read-only account. Privately inspect unresolved references against
archived campaign/configuration evidence. Keep customer data and raw aliases out
of shared output. If evidence supports a legacy alias, approve an explicit,
auditable alias-to-canonical mapping design separately; do not rewrite lead IDs,
guess by campaign name, assign an arbitrary current campaign, or skip records.

Readiness remains blocked until all campaign identities resolve. Resolved counts
may change after the ten records are correctly mapped. Rerun inventory at the
approved writer-paused cutover; live audit counts are observational, not a frozen
snapshot. Backup/isolated restore verification and VED writer fencing remain
mandatory. No migration or runtime guard/index changes are included in this patch.
