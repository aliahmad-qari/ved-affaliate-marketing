# Production startup seed safety

Isolated branch: `feature/production-startup-safety`, based on the approved local landing commit `b6c3ce5bde466b02165e2b41ee20e1a8bf5cbf9a`. No Requirement #7 code is imported or activated.

## Complete startup path and former operations

`npm start` executes `server.ts`, which imports and invokes `startServer()` in `server/server.ts`. Importing the application registers middleware, routes and Mongoose models; route handlers do not run merely because the server starts. Dotenv loads configuration. Production checks require JWT configuration and a MongoDB URI. `connectDatabase()` calls `mongoose.connect()` with connection/server-selection timeouts; unavailable production databases still prevent the listener from starting. Static frontend middleware and the VED HTTP listener are then initialized.

Previously, a successful connection called `ensureSeededData()` from the campaign controller. That function ran:

1. `Campaign.countDocuments()`.
2. If the count was zero, `Campaign.insertMany(initialCampaignSeeds)`.
3. On every connected startup, `Campaign.updateOne()` against one specific Kotak campaign/old tracking-URL pair, replacing its destination from the bundled definitions.

Its catch block swallowed failures and logged raw errors. Vite `configureServer()` independently invoked the same seeder after connecting. No automatic demo-user, sample-lead, wallet, payout or referral seeding was found in these startup paths. `scripts/provision-admin.ts` is a separate explicit operator command, not an application-startup import; it was not executed or modified.

## Changes

- Removed seeding imports and calls from production/API startup and Vite development startup.
- Removed the controller's entire database seeder, including the campaign URL update. The read-only offline campaign fallback remains unchanged.
- Preserved database connection, production validation, routing, model registration, static assets and listening behavior.
- Added `npm run seed:development -- --confirm-development-seed` as a standalone operation, never invoked by start/dev/build scripts.
- The explicit command requires `NODE_ENV=development`, confirmation, a loopback-only `mongodb://` URI, and a database named `ved_*_dev` or `ved_*_test`. It rejects Atlas/SRV and remote hosts before connecting. It disables automatic index/collection creation for its own connection, refuses any nonempty collection, and only inserts the existing campaign fixtures. It never updates existing campaigns or creates demo users/leads/financial records. Errors do not print connection strings or raw database details. It disconnects after execution.

Local development example, **never run on the VPS or through a tunnel to production**:

```powershell
$env:NODE_ENV = 'development'
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/ved_local_dev'
npm run seed:development -- --confirm-development-seed
```

Use a dedicated empty local database with no concurrent application writers. A second run refuses existing data rather than resetting or merging it. This command was not executed during implementation.

## Remaining initialization and deployment risks

- Existing Mongoose model initialization is preserved. Depending on effective Mongoose configuration, a real connection can still perform collection/index initialization (`createCollection`/`createIndexes`), as before. This patch neither runs migrations nor adds, drops or synchronizes schema indexes. It guarantees removal of automatic **seed/business-record mutations**, not that MongoDB startup performs only reads. Actual production indexes were not inspected.
- Existing explicitly invoked admin provisioning and deployment scripts remain outside this fix. Do not run them as part of validation. No production environment, PM2, Nginx, `deploy.sh` or `ecosystem.config.cjs` was changed.
- No seed flag can re-enable production startup seeding. Existing campaign destinations will no longer be silently repaired at boot; legitimate corrections require a separate reviewed action.
- The homepage, completed capture/landing UI, authentication and referral calculations remain unchanged. Requirement #7 stays on hold.
- Release requires separate approval, normal backup/rollback preparation and source-plus-build artifact review. Existing main-push automatic deployment is untouched. No commit, merge, push, deployment, real database connection or production service restart was performed for this change.
- Rollback to an older artifact would restore its startup-seeding risk. Prefer a forward correction; do not restart the old seed-mutating build against live data as an automatic rollback step.

## Validation

`tests/startupSafety.test.ts` exercises actual `startServer()` with mocked MongoDB connect and HTTP listen, asserting zero model business-data reads/writes. It also checks both startup sources, guard rejection cases, nonempty-database refusal and repeated-run safety. Tests never use a real database or bind the production API port. All 16 selected tests passed, including four startup-safety tests and the capture/tracking/authentication regressions. TypeScript passed. The local production build passed using the established Windows Vite native-config-loader workaround; the existing greater-than-500-kB bundle warning remains. `git diff --check` passed. Frontend source/assets, capture implementation, model schemas, lockfile and workflow are unchanged from the landing commit.
