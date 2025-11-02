/**
 * Golden Test Harness for Tsonic Emitter
 *
 * Automatically discovers and runs test cases from testcases/ directory.
 * Each directory with config.yaml defines tests:
 *   - config.yaml: List of tests (input.ts → expected output)
 *   - FileName.ts: TypeScript source
 *   - FileName.cs: Expected C# output
 */

import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";
import { compile, buildIr } from "@tsonic/frontend";
import { emitCSharpFiles } from "./emitter.js";
import { generateFileHeader } from "./constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TESTCASES_DIR = path.join(__dirname, "../testcases");

type TestEntry = {
  readonly input: string;
  readonly title: string;
};

type Scenario = {
  readonly pathParts: readonly string[];
  readonly title: string;
  readonly inputPath: string;
  readonly expectedPath: string;
};

type DescribeNode = {
  readonly name: string;
  readonly children: Map<string, DescribeNode>;
  tests: Scenario[];
};

/**
 * Parse config.yaml and extract test entries
 */
const parseConfigYaml = (yamlContent: string): readonly TestEntry[] => {
  const parsed = YAML.parse(yamlContent);

  if (!Array.isArray(parsed)) {
    throw new Error("config.yaml must be an array of test entries");
  }

  const entries: TestEntry[] = [];

  for (const item of parsed) {
    if (typeof item === "object" && item !== null) {
      // Check if it's the simple YAML format: { "File.ts": "title" }
      const keys = Object.keys(item);

      if (keys.length === 1 && keys[0] && keys[0].endsWith(".ts")) {
        // Simple format parsed as object
        const input = keys[0];
        const title = item[input];

        if (typeof title !== "string") {
          throw new Error(`Title must be a string for ${input}`);
        }

        entries.push({ input, title });
      } else if (item.input && item.title) {
        // Explicit format: { input: "File.ts", title: "..." }
        const input = item.input;
        const title = item.title;

        if (typeof input !== "string" || typeof title !== "string") {
          throw new Error(
            "Each test entry must have 'input' and 'title' fields"
          );
        }

        entries.push({ input, title });
      } else {
        throw new Error(`Invalid test entry: ${JSON.stringify(item)}`);
      }
    } else if (typeof item === "string") {
      // Quoted string format: "File.ts: title here"
      const match = item.match(/^(\S+\.ts):\s*(.+)$/);
      if (!match || !match[1] || !match[2]) {
        throw new Error(`Invalid test entry format: ${item}`);
      }

      entries.push({
        input: match[1],
        title: match[2].trim(),
      });
    } else {
      throw new Error(`Invalid test entry: ${JSON.stringify(item)}`);
    }
  }

  return entries;
};

/**
 * Discover all test scenarios by walking the testcases directory (synchronous)
 */
const discoverScenarios = (baseDir: string): readonly Scenario[] => {
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
        const inputPath = path.join(dir, entry.input);
        const baseName = path.basename(entry.input, ".ts");
        const expectedPath = path.join(dir, `${baseName}.cs`);

        // Verify files exist
        if (!fs.existsSync(inputPath)) {
          throw new Error(`Input file not found: ${inputPath}`);
        }
        if (!fs.existsSync(expectedPath)) {
          throw new Error(`Expected file not found: ${expectedPath}`);
        }

        scenarios.push({
          pathParts,
          title: entry.title,
          inputPath,
          expectedPath,
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

/**
 * Build a tree structure for nested describe blocks
 */
const buildDescribeTree = (
  scenarios: readonly Scenario[]
): DescribeNode | null => {
  if (scenarios.length === 0) return null;

  const root: DescribeNode = {
    name: "Golden Tests",
    children: new Map(),
    tests: [],
  };

  for (const scenario of scenarios) {
    let current = root;

    // Navigate/create tree nodes for each path part
    for (const part of scenario.pathParts) {
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          children: new Map(),
          tests: [],
        });
      }
      current = current.children.get(part)!;
    }

    // Add test to the leaf node
    current.tests.push(scenario);
  }

  return root;
};

/**
 * Normalize C# output for comparison
 */
const normalizeCs = (code: string): string => {
  return (
    code
      .trim()
      // Normalize line endings
      .replace(/\r\n/g, "\n")
      // Remove trailing whitespace
      .replace(/\s+$/gm, "")
      // Normalize timestamp line (make comparison timestamp-agnostic)
      .replace(/\/\/ Generated at: .+/, "// Generated at: TIMESTAMP")
  );
};

/**
 * Run a single test scenario
 */
const runScenario = async (scenario: Scenario): Promise<void> => {
  // Read expected output (without header)
  const expectedCsBody = fs.readFileSync(scenario.expectedPath, "utf-8");

  // Determine source root (parent of input file)
  const sourceRoot = path.dirname(scenario.inputPath);

  // Build namespace from path parts (case-preserved, hyphens stripped per spec)
  // e.g., ['control-flow', 'error-handling'] → 'TestCases.controlflow'
  const namespaceParts = scenario.pathParts
    .slice(0, -1)
    .map((part) => part.replace(/-/g, "")); // Strip hyphens
  const rootNamespace = ["TestCases", ...namespaceParts].join(".");

  // Step 1: Compile TypeScript → Program
  const compileResult = compile([scenario.inputPath], {
    sourceRoot,
    rootNamespace,
  });

  if (!compileResult.ok) {
    // Show diagnostics if compilation failed
    const errors = compileResult.error.diagnostics
      .map((d) => `${d.code}: ${d.message}`)
      .join("\n");
    throw new Error(`Compilation failed:\n${errors}`);
  }

  // Step 2: Build IR from Program
  const irResult = buildIr(compileResult.value.program, {
    sourceRoot,
    rootNamespace,
  });

  if (!irResult.ok) {
    const errors = irResult.error
      .map((d) => `${d.code}: ${d.message}`)
      .join("\n");
    throw new Error(`IR build failed:\n${errors}`);
  }

  // Step 3: Emit IR → C#
  // Note: Don't set entryPointPath - golden tests are NOT entry points
  const csharpFiles = emitCSharpFiles(irResult.value, {
    rootNamespace,
  });

  // Find the generated file for our input
  // The key should be the class name derived from the input file
  const className = path.basename(scenario.inputPath, ".ts");
  const generatedKey = Array.from(csharpFiles.keys()).find((key) =>
    key.endsWith(`/${className}.cs`)
  );

  if (!generatedKey) {
    throw new Error(
      `Could not find generated C# file for ${scenario.inputPath}. Available: ${Array.from(csharpFiles.keys()).join(", ")}`
    );
  }

  const actualCs = csharpFiles.get(generatedKey)!;

  // Generate expected header using shared constant (with TIMESTAMP placeholder)
  const expectedHeader = generateFileHeader(scenario.inputPath, {
    timestamp: "TIMESTAMP",
  });

  // Combine header with expected body
  const expectedCs = expectedHeader + expectedCsBody;

  // Normalize and compare
  const normalizedActual = normalizeCs(actualCs);
  const normalizedExpected = normalizeCs(expectedCs);

  expect(normalizedActual).to.equal(
    normalizedExpected,
    `C# output mismatch for ${scenario.pathParts.join("/")}`
  );
};

/**
 * Register describe blocks recursively
 */
const registerNode = (node: DescribeNode): void => {
  describe(node.name, () => {
    // Register child describe blocks
    for (const child of node.children.values()) {
      registerNode(child);
    }

    // Register tests at this level
    for (const scenario of node.tests) {
      it(scenario.title, async () => {
        await runScenario(scenario);
      });
    }
  });
};

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
