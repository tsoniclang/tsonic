/**
 * Update golden test expected files
 * Run with: npx tsx scripts/update-golden-tests.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { compile, buildIr } from "@tsonic/frontend";
import { emitCSharpFiles } from "../src/emitter.js";
import { parseConfigYaml } from "../src/golden-tests/config-parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TESTCASES_DIR = path.join(__dirname, "../testcases");

interface TestEntry {
  input: string;
  title: string;
}

const walkDir = (dir: string, pathParts: string[] = []): void => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const hasConfig = entries.some((e) => e.name === "config.yaml");

  if (hasConfig) {
    const configPath = path.join(dir, "config.yaml");
    const configContent = fs.readFileSync(configPath, "utf-8");
    const testEntries = parseConfigYaml(configContent);

    for (const entry of testEntries) {
      const inputPath = path.join(dir, entry.input);
      const baseName = path.basename(entry.input, ".ts");
      const expectedPath = path.join(dir, `${baseName}.cs`);

      console.log(`Updating: ${pathParts.join("/")}/${baseName}`);

      try {
        // Build namespace from path parts
        const namespaceParts = pathParts.map((part) => part.replace(/-/g, ""));
        const rootNamespace = ["TestCases", ...namespaceParts].join(".");
        const sourceRoot = path.dirname(inputPath);

        // Compile
        const compileResult = compile([inputPath], {
          sourceRoot,
          rootNamespace,
          useStandardLib: true,
        });

        if (!compileResult.ok) {
          console.error(`  ERROR: Compilation failed`);
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

        // Emit C#
        const emitResult = emitCSharpFiles(irResult.value, { rootNamespace });

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

        // Strip the header (first 4 lines: Generated from, Generated at, WARNING, blank)
        const lines = fullOutput.split("\n");
        const bodyStartIndex = lines.findIndex(
          (line, i) => i > 0 && line.startsWith("using")
        );
        const body = lines.slice(bodyStartIndex).join("\n");

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
      walkDir(path.join(dir, entry.name), [...pathParts, entry.name]);
    }
  }
};

console.log("Updating golden test expected files...\n");
walkDir(TESTCASES_DIR);
console.log("\nDone!");
