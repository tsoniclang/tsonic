/**
 * Golden Test Harness for Tsonic Emitter
 *
 * Automatically discovers and runs test cases from testcases-dotnet/ and testcases-js/ directories.
 * Each directory with config.yaml defines tests:
 *   - config.yaml: List of tests (input.ts → expected output)
 *   - FileName.ts: TypeScript source
 *   - FileName.cs: Expected C# output
 *
 * Two modes:
 *   - dotnet: uses @tsonic/globals only (native .NET APIs like str.Length)
 *   - js: uses @tsonic/globals + @tsonic/js-globals (JSRuntime APIs)
 */

import { describe } from "mocha";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  discoverScenarios,
  buildDescribeTree,
  registerNode,
} from "./golden-tests/index.js";
import type { RuntimeMode } from "./golden-tests/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Setup tests for a specific runtime mode
 */
const setupMode = (mode: RuntimeMode): void => {
  const testcasesDir = path.join(__dirname, `../testcases-${mode}`);

  try {
    const scenarios = discoverScenarios(testcasesDir, mode);

    if (scenarios.length === 0) {
      console.warn(`⚠️  No golden test cases found in testcases-${mode}/`);
    } else {
      const tree = buildDescribeTree(scenarios);
      if (tree) {
        registerNode(tree);
      }
    }
  } catch (error) {
    console.error(`❌ Failed to setup ${mode} mode golden tests:`, error);
    throw error;
  }
};

/**
 * Main test suite setup (synchronous discovery for Mocha compatibility)
 */
describe("Golden Tests (dotnet mode)", () => {
  setupMode("dotnet");
});

describe("Golden Tests (js mode)", () => {
  setupMode("js");
});
