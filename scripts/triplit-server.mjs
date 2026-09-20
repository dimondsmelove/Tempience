// Thin wrapper kept for the owner's tempience-triplit.service
// (ExecStart=node scripts/triplit-server.mjs, WorkingDirectory=the checkout).
// The server itself is the tempience-sync package in packages/sync-server;
// the TRIPLIT_* environment contract is unchanged and takes precedence over
// its config.json. Everyone else: `npx tempience-sync` (see SYNC.md).
import { main } from "../packages/sync-server/src/index.mjs";

await main(process.argv.slice(2));
