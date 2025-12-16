/**
 * Test scenario discovery
 *
 * Directory structure:
 *   testcases/
 *   ├── common/                    # Tests that work in BOTH modes
 *   │   ├── <category>/<test>/     # .ts sources + config.yaml
 *   │   ├── dotnet/<category>/<test>/  # Expected .cs for dotnet mode
 *   │   └── js/<category>/<test>/      # Expected .cs for js mode
 *   └── js-only/                   # Tests that ONLY work in JS mode
 *       └── <category>/<test>/     # .ts, config.yaml, AND .cs together
 */

import * as fs from "fs";
import * as path from "path";
import { RuntimeMode, Scenario } from "./types.js";
import { parseConfigYaml } from "./config-parser.js";

/**
 * Discover all test scenarios for a given runtime mode
 * - dotnet mode: only common/ tests
 * - js mode: common/ + js-only/ tests
 */
export const discoverScenarios = (
  baseDir: string,
  runtimeMode: RuntimeMode
): readonly Scenario[] => {
  const commonDir = path.join(baseDir, "common");
  const jsOnlyDir = path.join(baseDir, "js-only");

  // Common tests - source in common/, expected in common/{dotnet|js}/
  const commonScenarios = discoverCommonScenarios(commonDir, runtimeMode);

  // JS-only tests - only for js mode, source and expected together
  const jsOnlyScenarios =
    runtimeMode === "js" ? discoverJsOnlyScenarios(jsOnlyDir) : [];

  return [...commonScenarios, ...jsOnlyScenarios];
};

/**
 * Discover scenarios from common/ directory
 * Source files are in common/<category>/<test>/
 * Expected .cs files are in common/{dotnet|js}/<category>/<test>/
 */
const discoverCommonScenarios = (
  commonDir: string,
  runtimeMode: RuntimeMode
): readonly Scenario[] => {
  const scenarios: Scenario[] = [];
  const expectedBaseDir = path.join(commonDir, runtimeMode);

  const walk = (dir: string, pathParts: string[]): void => {
    // Skip dotnet/ and js/ subdirectories (they contain expected output, not sources)
    const dirName = path.basename(dir);
    if (dirName === "dotnet" || dirName === "js") {
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

        // Expected path is in common/{dotnet|js}/<pathParts>/<baseName>.cs
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
          runtimeMode,
        });
      }
    }

    // Recurse into subdirectories (except dotnet/js)
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        entry.name !== "dotnet" &&
        entry.name !== "js"
      ) {
        walk(path.join(dir, entry.name), [...pathParts, entry.name]);
      }
    }
  };

  if (fs.existsSync(commonDir)) {
    walk(commonDir, []);
  }
  return scenarios;
};

/**
 * Discover scenarios from js-only/ directory
 * Source and expected files are in the same directory
 */
const discoverJsOnlyScenarios = (jsOnlyDir: string): readonly Scenario[] => {
  const scenarios: Scenario[] = [];

  const walk = (dir: string, pathParts: string[]): void => {
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
        const expectedPath = path.join(dir, `${baseName}.cs`);

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
          pathParts: ["js-only", ...pathParts],
          title: entry.title,
          inputPath,
          expectedPath: expectDiagnostics?.length ? undefined : expectedPath,
          expectDiagnostics,
          expectDiagnosticsMode: entry.expectDiagnosticsMode,
          runtimeMode: "js",
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

  if (fs.existsSync(jsOnlyDir)) {
    walk(jsOnlyDir, []);
  }
  return scenarios;
};
