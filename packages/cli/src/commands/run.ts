/**
 * tsonic run command - Build and execute
 */

import { spawnSync } from "node:child_process";
import { constants as osConstants } from "node:os";
import type { ResolvedConfig, Result } from "../types.js";
import { buildCommand } from "./build.js";

const signalToExitCode = (signal: string): number => {
  const signalNumber = (
    osConstants.signals as Record<string, number | undefined>
  )[signal];
  if (typeof signalNumber === "number") return 128 + signalNumber;
  return 1;
};

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

  const exitCode =
    typeof runResult.status === "number"
      ? runResult.status
      : runResult.signal
        ? signalToExitCode(runResult.signal)
        : 1;

  if (!config.quiet) {
    console.log("─".repeat(50));
    if (runResult.signal) {
      console.log(
        `\nProcess terminated by signal ${runResult.signal} (exit code ${exitCode})`
      );
    } else {
      console.log(`\nProcess exited with code ${exitCode}`);
    }
  }

  return {
    ok: true,
    value: { exitCode },
  };
};
