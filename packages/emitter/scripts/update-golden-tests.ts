/**
 * Update golden test expected files
 * Run with: npx tsx scripts/update-golden-tests.ts [dotnet|js]
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
 * If no mode specified, updates both modes.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { compile, buildIr, runNumericProofPass } from "@tsonic/frontend";
import { emitCSharpFiles } from "../src/emitter.js";
import { parseConfigYaml } from "../src/golden-tests/config-parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve paths to globals packages
const monorepoRoot = path.resolve(__dirname, "../../..");
const globalsPath = path.join(monorepoRoot, "node_modules/@tsonic/globals");
const jsGlobalsPath = path.join(
  monorepoRoot,
  "node_modules/@tsonic/js-globals"
);
const corePath = path.join(monorepoRoot, "node_modules/@tsonic/core");

type RuntimeMode = "dotnet" | "js";

const getTypeRoots = (mode: RuntimeMode): readonly string[] =>
  mode === "js"
    ? [globalsPath, jsGlobalsPath, corePath]
    : [globalsPath, corePath];

/**
 * Generate C# and write to expected file
 */
const generateAndWrite = (
  inputPath: string,
  expectedPath: string,
  pathParts: readonly string[],
  mode: RuntimeMode
): boolean => {
  const baseName = path.basename(inputPath, ".ts");
  console.log(`Updating: ${pathParts.join("/")}/${baseName}`);

  try {
    // Build namespace from path parts
    const namespaceParts = pathParts.map((part) => part.replace(/-/g, ""));
    const rootNamespace = ["TestCases", ...namespaceParts].join(".");
    const sourceRoot = path.dirname(inputPath);

    // Compile using appropriate typeRoots for the mode
    const compileResult = compile([inputPath], {
      projectRoot: monorepoRoot,
      sourceRoot,
      rootNamespace,
      typeRoots: getTypeRoots(mode),
    });

    if (!compileResult.ok) {
      console.error(`  ERROR: Compilation failed`);
      for (const d of compileResult.error.diagnostics) {
        console.error(`    ${d.code}: ${d.message}`);
      }
      return false;
    }

    // Build IR
    const irResult = buildIr(compileResult.value.program, {
      sourceRoot,
      rootNamespace,
    });

    if (!irResult.ok) {
      console.error(`  ERROR: IR build failed`);
      return false;
    }

    // Run numeric proof pass
    const proofResult = runNumericProofPass(irResult.value);
    if (!proofResult.ok) {
      console.error(`  ERROR: Proof pass failed`);
      for (const d of proofResult.diagnostics) {
        console.error(`    ${d.code}: ${d.message}`);
      }
      return false;
    }

    // Emit C# using proof-annotated modules
    const emitResult = emitCSharpFiles(proofResult.modules, {
      rootNamespace,
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
 * Walk common/ directory - sources in common/<path>/, expected in common/{mode}/<path>/
 */
const walkCommonDir = (
  currentDir: string,
  commonBaseDir: string,
  mode: RuntimeMode,
  pathParts: string[] = []
): void => {
  // Skip dotnet/ and js/ subdirectories (they contain expected output)
  const dirName = path.basename(currentDir);
  if (dirName === "dotnet" || dirName === "js") {
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

      // Expected output goes to common/{mode}/<pathParts>/<baseName>.cs
      const expectedDir = path.join(commonBaseDir, mode, ...pathParts);
      const expectedPath = path.join(expectedDir, `${baseName}.cs`);

      // Include "common" in the path for namespace generation (to match discovery.ts)
      generateAndWrite(inputPath, expectedPath, ["common", ...pathParts], mode);
    }
  }

  // Recurse into subdirectories (except dotnet/js)
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== "dotnet" && entry.name !== "js") {
      walkCommonDir(path.join(currentDir, entry.name), commonBaseDir, mode, [
        ...pathParts,
        entry.name,
      ]);
    }
  }
};

/**
 * Walk js-only/ directory - sources and expected together
 */
const walkJsOnlyDir = (dir: string, pathParts: string[] = []): void => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const hasConfig = entries.some((e) => e.name === "config.yaml");

  if (hasConfig) {
    const configPath = path.join(dir, "config.yaml");
    const configContent = fs.readFileSync(configPath, "utf-8");
    const testEntries = parseConfigYaml(configContent);

    for (const entry of testEntries) {
      if (entry.expectDiagnostics?.length) {
        console.log(
          `Skipping (expects diagnostics): js-only/${pathParts.join("/")}/${path.basename(entry.input, ".ts")}`
        );
        continue;
      }

      const inputPath = path.join(dir, entry.input);
      const baseName = path.basename(entry.input, ".ts");
      const expectedPath = path.join(dir, `${baseName}.cs`);

      // Include "js-only" in the path for namespace generation (to match discovery.ts)
      generateAndWrite(
        inputPath,
        expectedPath,
        ["js-only", ...pathParts],
        "js"
      );
    }
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (entry.isDirectory()) {
      walkJsOnlyDir(path.join(dir, entry.name), [...pathParts, entry.name]);
    }
  }
};

const updateMode = (mode: RuntimeMode): void => {
  const testcasesDir = path.join(__dirname, "../testcases");
  const commonDir = path.join(testcasesDir, "common");
  const jsOnlyDir = path.join(testcasesDir, "js-only");

  console.log(`\n=== Updating ${mode} mode golden tests ===\n`);

  // Update common tests for this mode
  if (fs.existsSync(commonDir)) {
    console.log(`Processing common/ tests...`);
    walkCommonDir(commonDir, commonDir, mode);
  }

  // Update js-only tests (only for js mode)
  if (mode === "js" && fs.existsSync(jsOnlyDir)) {
    console.log(`\nProcessing js-only/ tests...`);
    walkJsOnlyDir(jsOnlyDir);
  }
};

// Parse command line args
const args = process.argv.slice(2);
const requestedMode = args[0] as RuntimeMode | undefined;

if (requestedMode && requestedMode !== "dotnet" && requestedMode !== "js") {
  console.error(`Invalid mode: ${requestedMode}. Use 'dotnet' or 'js'.`);
  process.exit(1);
}

console.log("Updating golden test expected files...");

if (requestedMode) {
  updateMode(requestedMode);
} else {
  updateMode("dotnet");
  updateMode("js");
}

console.log("\nDone!");
