/**
 * Test scenario discovery
 *
 * Directory structure:
 *   testcases/
 *   └── common/                       # All tests
 *       ├── <category>/<test>/        # .ts sources + config.yaml
 *       └── expected/<category>/<test>/  # Expected .cs output
 */

import * as fs from "fs";
import * as path from "path";
import { Scenario } from "./types.js";
import { parseConfigYaml } from "./config-parser.js";

/**
 * Discover all test scenarios
 */
export const discoverScenarios = (baseDir: string): readonly Scenario[] => {
  const commonDir = path.join(baseDir, "common");
  return discoverCommonScenarios(commonDir);
};

/**
 * Discover scenarios from common/ directory
 * Source files are in common/<category>/<test>/
 * Expected .cs files are in common/expected/<category>/<test>/
 */
const discoverCommonScenarios = (commonDir: string): readonly Scenario[] => {
  const scenarios: Scenario[] = [];
  const expectedBaseDir = path.join(commonDir, "expected");

  const walk = (dir: string, pathParts: string[]): void => {
    // Skip expected/ subdirectory (it contains expected output, not sources)
    const dirName = path.basename(dir);
    if (dirName === "expected") {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const hasConfig = entries.some((e) => e.name === "config.yaml");

    if (hasConfig) {
      const configPath = path.join(dir, "config.yaml");
      const configContent = fs.readFileSync(configPath, "utf-8");
      const testEntries = parseConfigYaml(configContent);

      for (const entry of testEntries) {
        if (!entry.input.endsWith(".ts")) {
          throw new Error(
            `Invalid input (must end with .ts): ${entry.input} (config: ${configPath})`
          );
        }

        const inputPath = path.join(dir, entry.input);
        const baseName = path.basename(entry.input, ".ts");

        // Expected path is in common/expected/<pathParts>/<baseName>.cs
        const expectedPath = path.join(
          expectedBaseDir,
          ...pathParts,
          `${baseName}.cs`
        );

        if (!fs.existsSync(inputPath)) {
          throw new Error(
            `Input file not found: ${inputPath} (title: "${entry.title}", config: ${configPath})`
          );
        }

        const expectDiagnostics = entry.expectDiagnostics;
        if (!expectDiagnostics?.length) {
          if (!fs.existsSync(expectedPath)) {
            throw new Error(
              `Expected file not found: ${expectedPath} (title: "${entry.title}", config: ${configPath})`
            );
          }
        }

        scenarios.push({
          pathParts: ["common", ...pathParts],
          title: entry.title,
          inputPath,
          expectedPath: expectDiagnostics?.length ? undefined : expectedPath,
          expectDiagnostics,
          expectDiagnosticsMode: entry.expectDiagnosticsMode,
        });
      }
    }

    // Recurse into subdirectories (except expected/)
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== "expected") {
        walk(path.join(dir, entry.name), [...pathParts, entry.name]);
      }
    }
  };

  if (fs.existsSync(commonDir)) {
    walk(commonDir, []);
  }
  return scenarios;
};
