# m.Stock attribution patch — local review

## Scope

This patch preserves the configured m.Stock destination URL in both customer-form and attributed direct redirects. No live campaign URL, database configuration, UI, route, callback handler, payout rule or existing record is changed. No Milestone 4 integration is added. This is not evidence that the eight reported accounts have been recovered.

## Confirmed defects and before/after

Before: customer-form redirects replaced m.Stock `ref=REF2087275` and `pid=REF2087275` with VED identifiers. Direct redirects selected only `partnerId`, then read the unselected `referralCode`, potentially emitting `ref=undefined`.

After: validated destinations on `mstock.com` and its subdomains are returned using the original configured URL string, without query rewriting or additional tracking parameters. This preserves case, duplicate parameters, encoding, `Refcode`, `ref`, `pid`, and deep-link fields. Host matching excludes lookalike domains.

Direct redirects now select `partnerId referralCode`, and only append a referral value when it is a non-empty string. Existing non-mStock and WhatsApp behavior otherwise remains unchanged. This patch does not introduce general vendor attribution support.

## Internal attribution

The existing unique click ID, partner ID, campaign ID, timestamp and payout snapshot continue to be recorded in TrackingClick. Customer-form submission continues to save its enquiry, consent and notification transactionally before redirecting. Repeated submissions resume the same enquiry. No VED click ID is appended to m.Stock's URL because no accepted vendor parameter has been established.

## Validation coverage

- Exact supplied m.Stock URL is asserted in both redirect paths, including all query parameters and original encoding.
- Internal click-to-partner and enquiry-to-click mappings are asserted.
- Retried customer-form submission must not duplicate the enquiry.
- Separate visits must generate distinct click IDs.
- A projection-aware database mock verifies generic direct redirects have the actual referral code, never `undefined`.
- Existing isolated HTTP tests cover invalid/expired tokens, rejected origins, storage failure, admin authentication and review, manual leads, generic callbacks, earnings, wallet, notifications, campaign availability and withdrawals.
- TypeScript and the production build must pass before review. Test results are reported separately; mocked tests do not establish production behavior.

## Evidence required before deployment

1. Preserve Render deployment revision and available request/error logs for 6 and 8 October 2026. Confirm the incident date and timezone. Account opening is reported as 6 October; the PDF investigation date is 8 October. Do not silently treat them as the same day.
2. Read-only export of the active campaign's private destination URL and historical campaign changes, the partner/referral association, TrackingClick records, Lead records, VendorWebhookEvent records and relevant AuditLog/WalletTransaction records. Preserve timestamps, IDs, status, enquiry source and payout snapshots; protect personal data.
3. Reconcile all 22 reported records for VED-PTR-62F994 with the eight supplied account Login IDs. Match accountId/vendor conversion IDs, then customer details and timestamps where necessary. Enquiry IDs alone do not demonstrate account completion.
4. Obtain m.Stock/vendor records showing each account's creation time, qualifying status and recorded referral identity; determine whether the eight accounts are distinct and resolve name/mobile discrepancies.
5. Inspect actual redirected Location values if retained, callback endpoint requests, authentication/validation errors and transaction failures. Accepted webhook-event records are not a count of every attempted request. The repository does not provide a complete request log.
6. Confirm whether any vendor callback is actually registered, and whether the configured shared secret and payload match the generic receiver. No real m.Stock-specific integration is established by this repository. Do not disclose secrets in the review report.
7. If automatic vendor conversions are required, obtain documented supported click-ID parameter, callback payload/status mapping, authentication and retry rules. The current receiver requires a known VED clickId; it does not infer one from REF2087275. Existing customer-form callbacks intentionally leave manual enquiries for admin review.
8. Review findings and approve the patch explicitly before commit, push or deployment. After an approved deployment, verify one controlled fresh referral with vendor-side attribution evidence. Do not promise retroactive recovery or financial eligibility.

## Production status

Production root cause, click/callback totals, account attribution and financial loss remain unverified. This patch repairs repository-level redirect defects only. Deployment, vendor verification and historical account correction are separate steps requiring approval/evidence.
