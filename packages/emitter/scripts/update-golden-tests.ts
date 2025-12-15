/**
 * Update golden test expected files
 * Run with: npx tsx scripts/update-golden-tests.ts [dotnet|js]
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

interface TestEntry {
  input: string;
  title: string;
  expectDiagnostics?: readonly string[];
}

const getTypeRoots = (mode: RuntimeMode): readonly string[] =>
  mode === "js"
    ? [globalsPath, jsGlobalsPath, corePath]
    : [globalsPath, corePath];

const walkDir = (
  dir: string,
  mode: RuntimeMode,
  pathParts: string[] = []
): void => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const hasConfig = entries.some((e) => e.name === "config.yaml");

  if (hasConfig) {
    const configPath = path.join(dir, "config.yaml");
    const configContent = fs.readFileSync(configPath, "utf-8");
    const testEntries = parseConfigYaml(configContent);

    for (const entry of testEntries) {
      // Skip tests that expect diagnostics (no .cs file needed)
      if (entry.expectDiagnostics?.length) {
        console.log(
          `Skipping (expects diagnostics): ${pathParts.join("/")}/${path.basename(entry.input, ".ts")}`
        );
        continue;
      }

      const inputPath = path.join(dir, entry.input);
      const baseName = path.basename(entry.input, ".ts");
      const expectedPath = path.join(dir, `${baseName}.cs`);

      console.log(`Updating: ${pathParts.join("/")}/${baseName}`);

      try {
        // Build namespace from path parts
        const namespaceParts = pathParts.map((part) => part.replace(/-/g, ""));
        const rootNamespace = ["TestCases", ...namespaceParts].join(".");
        const sourceRoot = path.dirname(inputPath);

        // Compile using appropriate typeRoots for the mode
        const compileResult = compile([inputPath], {
          projectRoot: monorepoRoot, // Use monorepo root for node_modules resolution
          sourceRoot,
          rootNamespace,
          typeRoots: getTypeRoots(mode),
        });

        if (!compileResult.ok) {
          console.error(`  ERROR: Compilation failed`);
          for (const d of compileResult.error.diagnostics) {
            console.error(`    ${d.code}: ${d.message}`);
          }
          continue;
        }

        // Build IR
        const irResult = buildIr(compileResult.value.program, {
          sourceRoot,
          rootNamespace,
        });

        if (!irResult.ok) {
          console.error(`  ERROR: IR build failed`);
          continue;
        }

        // Run numeric proof pass
        const proofResult = runNumericProofPass(irResult.value);
        if (!proofResult.ok) {
          console.error(`  ERROR: Proof pass failed`);
          for (const d of proofResult.diagnostics) {
            console.error(`    ${d.code}: ${d.message}`);
          }
          continue;
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
          continue;
        }

        const csharpFiles = emitResult.files;

        // Find the generated file
        const className = baseName;
        const generatedKey = Array.from(csharpFiles.keys()).find((key) =>
          key.endsWith(`${className}.cs`)
        );

        if (!generatedKey) {
          console.error(`  ERROR: No generated file found`);
          continue;
        }

        const fullOutput = csharpFiles.get(generatedKey)!;

        // Strip the header (Generated from, Generated at, WARNING, blank line)
        // Header is typically 4 lines, but we look for 'namespace' to find body start
        const lines = fullOutput.split("\n");
        const bodyStartIndex = lines.findIndex(
          (line, i) => i > 0 && line.startsWith("namespace")
        );

        // Safety check: if no namespace found and file is too small, throw
        if (bodyStartIndex === -1) {
          if (lines.length <= 6) {
            const preview = lines.slice(0, 5).join("\n");
            throw new Error(
              `Cannot find 'namespace' in output for ${generatedKey} ` +
                `and file is too small (${lines.length} lines) to safely skip header.\n` +
                `Preview:\n${preview}`
            );
          }
          // Fallback: skip first 4 lines (header) for larger files
          console.warn(`  WARN: Using fallback header skip`);
        }

        const body = lines
          .slice(bodyStartIndex === -1 ? 4 : bodyStartIndex)
          .join("\n");

        // Write to expected file
        fs.writeFileSync(expectedPath, body);
        console.log(`  OK: ${expectedPath}`);
      } catch (err) {
        console.error(`  ERROR: ${err}`);
      }
    }
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (entry.isDirectory()) {
      walkDir(path.join(dir, entry.name), mode, [...pathParts, entry.name]);
    }
  }
};

const updateMode = (mode: RuntimeMode): void => {
  const testcasesDir = path.join(__dirname, `../testcases-${mode}`);
  console.log(`\n=== Updating ${mode} mode golden tests ===\n`);
  walkDir(testcasesDir, mode);
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
