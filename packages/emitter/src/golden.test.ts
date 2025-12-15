/**
 * Golden Test Harness for Tsonic Emitter
 *
 * Directory structure:
 *   testcases/
 *   ├── common/                    # Tests that work in BOTH modes
 *   │   ├── <category>/<test>/     # .ts sources + config.yaml
 *   │   ├── dotnet/<category>/<test>/  # Expected .cs for dotnet mode
 *   │   └── js/<category>/<test>/      # Expected .cs for js mode
 *   └── js-only/                   # Tests that ONLY work in JS mode
 *       └── <category>/<test>/     # .ts, config.yaml, AND .cs together
 *
 * Two modes:
 *   - dotnet: common/ tests only, uses @tsonic/globals (native .NET APIs)
 *   - js: common/ + js-only/ tests, uses @tsonic/globals + @tsonic/js-globals
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
  const testcasesDir = path.join(__dirname, "../testcases");

  try {
    const scenarios = discoverScenarios(testcasesDir, mode);

    if (scenarios.length === 0) {
      console.warn(`⚠️  No golden test cases found for ${mode} mode`);
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
