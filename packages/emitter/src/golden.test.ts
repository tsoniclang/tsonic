/**
 * Golden Test Harness for Tsonic Emitter
 *
 * Directory structure:
 *   testcases/
 *   └── common/                       # All tests
 *       ├── <category>/<test>/        # .ts sources + config.yaml
 *       └── expected/<category>/<test>/  # Expected .cs output
 */

import { describe } from "mocha";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  discoverScenarios,
  buildDescribeTree,
  registerNode,
} from "./golden-tests/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main test suite setup (synchronous discovery for Mocha compatibility)
 */
describe("Golden Tests", function () {
  // Golden tests run the full compiler+emitter pipeline per scenario and can
  // exceed the default timeout on slower machines / CI.
  this.timeout(30_000);
  const testcasesDir = path.join(__dirname, "../testcases");

  try {
    const scenarios = discoverScenarios(testcasesDir);

    if (scenarios.length === 0) {
      console.warn("⚠️  No golden test cases found");
    } else {
      const tree = buildDescribeTree(scenarios);
      if (tree) {
        registerNode(tree);
      }
    }
  } catch (error) {
    console.error("❌ Failed to setup golden tests:", error);
    throw error;
  }
});
