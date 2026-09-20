#!/usr/bin/env node
import { main } from "../src/cli.mjs";

try {
  await main();
} catch (error) {
  console.error(error?.message ?? error);
  process.exit(1);
}
