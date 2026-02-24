#!/usr/bin/env node
/**
 * Tsonic CLI - Command-line interface for Tsonic compiler
 */

import { runCli } from "./cli.js";

// Run CLI with arguments (skip node and script name)
const args = process.argv.slice(2);

runCli(args)
  .then((exitCode) => {
    // Avoid immediate process.exit(...) so stderr/stdout flush reliably when
    // this CLI is invoked from another Node process (e.g. spawnSync tests).
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exitCode = 1;
  });

// Export for testing
export { runCli } from "./cli.js";
export * from "./types.js";
export * from "./config.js";
