/**
 * Golden Test Harness for Tsonic Emitter
 *
 * Automatically discovers and runs test cases from testcases/ directory.
 * Each directory with config.yaml defines tests:
 *   - config.yaml: List of tests (input.ts → expected output)
 *   - FileName.ts: TypeScript source
 *   - FileName.cs: Expected C# output
 */

import * as path from "path";
import { fileURLToPath } from "url";
import {
  discoverScenarios,
  buildDescribeTree,
  registerNode,
} from "./golden-tests/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TESTCASES_DIR = path.join(__dirname, "../testcases");

/**
 * Main test suite setup (synchronous discovery for Mocha compatibility)
 */
try {
  const scenarios = discoverScenarios(TESTCASES_DIR);

  if (scenarios.length === 0) {
    console.warn("⚠️  No golden test cases found in testcases/");
  } else {
    console.log(`📋 Discovered ${scenarios.length} golden test case(s)`);

    const tree = buildDescribeTree(scenarios);
    if (tree) {
      registerNode(tree);
    }
  }
} catch (error) {
  console.error("❌ Failed to setup golden tests:", error);
  throw error;
}
