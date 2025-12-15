/**
 * Test scenario discovery
 */

import * as fs from "fs";
import * as path from "path";
import { RuntimeMode, Scenario } from "./types.js";
import { parseConfigYaml } from "./config-parser.js";

/**
 * Discover all test scenarios by walking the testcases directory (synchronous)
 */
export const discoverScenarios = (
  baseDir: string,
  runtimeMode: RuntimeMode
): readonly Scenario[] => {
  const scenarios: Scenario[] = [];

  const walk = (dir: string, pathParts: string[]): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    // Check if this directory contains config.yaml
    const hasConfig = entries.some((e) => e.name === "config.yaml");

    if (hasConfig) {
      // This is a test directory - read config
      const configPath = path.join(dir, "config.yaml");
      const configContent = fs.readFileSync(configPath, "utf-8");
      const testEntries = parseConfigYaml(configContent);

      // Create scenarios for each test entry
      for (const entry of testEntries) {
        // Defensive check: parser should enforce this, but double-check
        if (!entry.input.endsWith(".ts")) {
          throw new Error(
            `Invalid input (must end with .ts): ${entry.input} (config: ${configPath})`
          );
        }

        const inputPath = path.join(dir, entry.input);
        const baseName = path.basename(entry.input, ".ts");
        const expectedPath = path.join(dir, `${baseName}.cs`);

        // Verify input file exists
        if (!fs.existsSync(inputPath)) {
          throw new Error(
            `Input file not found: ${inputPath} (title: "${entry.title}", config: ${configPath})`
          );
        }

        // Only require .cs file if not expecting diagnostics
        const expectDiagnostics = entry.expectDiagnostics;
        if (!expectDiagnostics?.length) {
          if (!fs.existsSync(expectedPath)) {
            throw new Error(
              `Expected file not found: ${expectedPath} (title: "${entry.title}", config: ${configPath})`
            );
          }
        }

        scenarios.push({
          pathParts,
          title: entry.title,
          inputPath,
          expectedPath: expectDiagnostics?.length ? undefined : expectedPath,
          expectDiagnostics,
          expectDiagnosticsMode: entry.expectDiagnosticsMode,
          runtimeMode,
        });
      }
    }

    // Recurse into subdirectories
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), [...pathParts, entry.name]);
      }
    }
  };

  walk(baseDir, []);
  return scenarios;
};
