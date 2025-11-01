/**
 * tsonic run command - Build and execute
 */

import { spawnSync } from "node:child_process";
import type { ResolvedConfig, Result } from "../types.js";
import { buildCommand } from "./build.js";

/**
 * Build and run the executable
 */
export const runCommand = (
  config: ResolvedConfig,
  programArgs: string[] = []
): Result<{ exitCode: number }, string> => {
  // Build the executable
  const buildResult = buildCommand(config);
  if (!buildResult.ok) {
    return buildResult;
  }

  const { outputPath } = buildResult.value;

  if (!config.quiet) {
    console.log(`\nRunning ${outputPath}...`);
    console.log("─".repeat(50));
  }

  // Execute the binary
  const runResult = spawnSync(outputPath, programArgs, {
    stdio: "inherit",
    encoding: "utf-8",
  });

  if (runResult.error) {
    return {
      ok: false,
      error: `Failed to run executable: ${runResult.error.message}`,
    };
  }

  if (!config.quiet) {
    console.log("─".repeat(50));
    console.log(`\nProcess exited with code ${runResult.status ?? 0}`);
  }

  return {
    ok: true,
    value: { exitCode: runResult.status ?? 0 },
  };
};
