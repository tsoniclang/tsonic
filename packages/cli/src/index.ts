#!/usr/bin/env node
/**
 * Tsonic CLI - Command-line interface for Tsonic compiler
 */

import { runCli } from "./cli.js";

// Run CLI with arguments (skip node and script name)
const args = process.argv.slice(2);

runCli(args)
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

// Export for testing
export { runCli } from "./cli.js";
export * from "./types.js";
export * from "./config.js";
