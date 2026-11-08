# Urgent hotfix: Requirement #7 isolation

The campaign/mobile claim registry is not activated by this release. Lead and
vendor callback handlers enforce registry readiness and claim uniqueness only
when the server environment contains:

```dotenv
VED_CAMPAIGN_MOBILE_REGISTRY_ENFORCEMENT=true
```

The flag is opt-in. If it is absent or is not exactly `true`, registry readiness
is not queried and no `CampaignMobileClaim` records are written. Existing signed
campaign context validation, partner/sub-team authorization, click association,
vendor webhook authentication, event idempotency, lead idempotency and wallet
idempotency remain active. This release does not create the registry collection,
readiness marker or indexes.

Do not enable the flag until the separately reviewed Requirement #7 historical
inventory and registry preparation have completed successfully, including the
required full unique index and readiness verification. If explicitly enabled,
the application continues to fail closed when those prerequisites are absent.

## Behavior while the registry is off

- Repeated submission of the same signed click is still recognized through the
  existing lead/click idempotency path and receives the campaign continuation.
- The same mobile number remains valid in a different campaign.
- Different customers using one partner device remain independent submissions.
- A repeat using the same normalized mobile on a different click, partner,
  manual partner submission, or vendor-created lead is **not globally prevented**
  until Requirement #7 is prepared and enabled. No guarantee of global
  same-campaign/mobile uniqueness is made during this hold.
- Vendor callbacks still require their configured secret and existing click,
  conversion, partner, lead and wallet checks; only the unprepared campaign/mobile
  registry gate and claim write are skipped.

The hotfix repairs the duplicate-registration continuation race so that an
already-created enquiry returns a signed, same-campaign continuation action
instead of an incomplete form. The continuation is resolved from the signed
original campaign context and stored click; it does not accept a client-supplied
destination.
