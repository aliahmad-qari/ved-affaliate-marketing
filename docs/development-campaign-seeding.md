# Explicit development campaign seeding

Backend and Vite startup only connect to MongoDB; neither invokes campaign seeding.
The former automatic tracking-URL update has been removed, without running it.
Database connection and existing model/index initialization are unchanged.

To provision an empty, separately configured development database, privately set:

```dotenv
NODE_ENV=development
CONFIRM_DEVELOPMENT_SEED=YES
DEVELOPMENT_MONGODB_URI=
```

Then explicitly run:

```bash
node --import tsx scripts/seed-development-campaigns.ts
```

This command rejects production mode before connecting, does not use the application's
MONGODB_URI, and does nothing if campaigns already exist. It never updates existing
tracking URLs. Do not point DEVELOPMENT_MONGODB_URI at production or run simultaneous
seed commands. No deployment/startup hook invokes this operation.
