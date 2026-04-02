/**
 * Update golden test expected files
 * Run with: npx tsx scripts/update-golden-tests.ts
 *
 * Directory structure:
 *   testcases/
 *   └── common/                       # All tests
 *       ├── <category>/<test>/        # .ts sources + config.yaml
 *       └── expected/<category>/<test>/  # Expected .cs output
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  buildModuleDependencyGraph,
} from "@tsonic/frontend";
import { emitCSharpFiles } from "../src/emitter.js";
import { parseConfigYaml } from "../src/golden-tests/config-parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve paths to globals packages
const monorepoRoot = path.resolve(__dirname, "../../..");
const globalsPath = path.join(monorepoRoot, "node_modules/@tsonic/globals");
const corePath = path.join(monorepoRoot, "node_modules/@tsonic/core");

const typeRoots = [globalsPath, corePath];

/**
 * Generate C# and write to expected file
 */
const generateAndWrite = (
  inputPath: string,
  expectedPath: string,
  pathParts: readonly string[]
): boolean => {
  const baseName = path.basename(inputPath, ".ts");
  console.log(`Updating: ${pathParts.join("/")}/${baseName}`);

  try {
    // Compile ALL .ts files in the scenario directory so that cross-module behaviors
    // (imports, re-exports, union narrowing across files, etc.) are captured in golden outputs.
    const scenarioRoot = path.dirname(inputPath);
    const tsFiles: string[] = [];
    const collectTs = (dir: string): void => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectTs(full);
          continue;
        }
        if (entry.isFile() && entry.name.endsWith(".ts")) {
          tsFiles.push(full);
        }
      }
    };
    collectTs(scenarioRoot);
    tsFiles.sort();

    // Build namespace from path parts
    const namespaceParts = pathParts.map((part) => part.replace(/-/g, ""));
    const rootNamespace = ["TestCases", ...namespaceParts].join(".");
    const sourceRoot = path.dirname(inputPath);

    // Build the authoritative processed module graph.
    const graphResult = buildModuleDependencyGraph(inputPath, {
      projectRoot: monorepoRoot,
      sourceRoot,
      rootNamespace,
      typeRoots,
    });

    if (!graphResult.ok) {
      console.error(`  ERROR: Compilation failed`);
      for (const d of graphResult.error) {
        console.error(`    ${d.code}: ${d.message}`);
      }
      return false;
    }

    // Emit C# from the authoritative dependency-graph modules.
    const emitResult = emitCSharpFiles(graphResult.value.modules, {
      rootNamespace,
      bindingRegistry: graphResult.value.bindingRegistry,
    });

    if (!emitResult.ok) {
      console.error(`  ERROR: Emit failed`);
      for (const err of emitResult.errors) {
        console.error(`    ${err.code}: ${err.message}`);
      }
      return false;
    }

    const csharpFiles = emitResult.files;

    // Find the generated file
    const className = baseName;
    const generatedKey = Array.from(csharpFiles.keys()).find((key) =>
      key.endsWith(`${className}.cs`)
    );

    if (!generatedKey) {
      console.error(`  ERROR: No generated file found`);
      return false;
    }

    const fullOutput = csharpFiles.get(generatedKey)!;

    // Strip the header (Generated from, Generated at, WARNING, blank line)
    const lines = fullOutput.split("\n");
    const bodyStartIndex = lines.findIndex(
      (line, i) => i > 0 && line.startsWith("namespace")
    );

    if (bodyStartIndex === -1) {
      if (lines.length <= 6) {
        const preview = lines.slice(0, 5).join("\n");
        throw new Error(
          `Cannot find 'namespace' in output for ${generatedKey} ` +
            `and file is too small (${lines.length} lines).\n` +
            `Preview:\n${preview}`
        );
      }
      console.warn(`  WARN: Using fallback header skip`);
    }

    const body = lines
      .slice(bodyStartIndex === -1 ? 4 : bodyStartIndex)
      .join("\n");

    // Ensure directory exists
    fs.mkdirSync(path.dirname(expectedPath), { recursive: true });

    // Write to expected file
    fs.writeFileSync(expectedPath, body);
    console.log(`  OK: ${expectedPath}`);
    return true;
  } catch (err) {
    console.error(`  ERROR: ${err}`);
    return false;
  }
};

/**
 * Walk common/ directory - sources in common/<path>/, expected in common/expected/<path>/
 */
const walkCommonDir = (
  currentDir: string,
  commonBaseDir: string,
  pathParts: string[] = []
): void => {
  // Skip expected/ subdirectory (it contains expected output)
  const dirName = path.basename(currentDir);
  if (dirName === "expected") {
    return;
  }

  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const hasConfig = entries.some((e) => e.name === "config.yaml");

  if (hasConfig) {
    const configPath = path.join(currentDir, "config.yaml");
    const configContent = fs.readFileSync(configPath, "utf-8");
    const testEntries = parseConfigYaml(configContent);

    for (const entry of testEntries) {
      if (entry.expectDiagnostics?.length) {
        console.log(
          `Skipping (expects diagnostics): common/${pathParts.join("/")}/${path.basename(entry.input, ".ts")}`
        );
        continue;
      }

      const inputPath = path.join(currentDir, entry.input);
      const baseName = path.basename(entry.input, ".ts");

      // Expected output goes to common/expected/<pathParts>/<baseName>.cs
      const expectedDir = path.join(commonBaseDir, "expected", ...pathParts);
      const expectedPath = path.join(expectedDir, `${baseName}.cs`);

      // Include "common" in the path for namespace generation (to match discovery.ts)
      generateAndWrite(inputPath, expectedPath, ["common", ...pathParts]);
    }
  }

  // Recurse into subdirectories (except expected/)
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== "expected") {
      walkCommonDir(path.join(currentDir, entry.name), commonBaseDir, [
        ...pathParts,
        entry.name,
      ]);
    }
  }
};

const testcasesDir = path.join(__dirname, "../testcases");
const commonDir = path.join(testcasesDir, "common");

console.log("Updating golden test expected files...\n");

// Update common tests
if (fs.existsSync(commonDir)) {
  console.log(`Processing common/ tests...`);
  walkCommonDir(commonDir, commonDir);
}

console.log("\nDone!");
