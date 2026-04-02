import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildModuleDependencyGraph,
} from "@tsonic/frontend";
import { emitCSharpFiles } from "../dist/emitter.js";
import { discoverScenarios } from "../dist/golden-tests/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const emitterRoot = path.resolve(__dirname, "..");
const monorepoRoot = path.resolve(emitterRoot, "..", "..");

const globalsPath = path.join(monorepoRoot, "node_modules/@tsonic/globals");
const corePath = path.join(monorepoRoot, "node_modules/@tsonic/core");

const testcasesDir = path.join(emitterRoot, "testcases");
const scenarios = discoverScenarios(testcasesDir);

const ensureDir = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

let updated = 0;

for (const scenario of scenarios) {
  if (!scenario.expectedPath) continue;

  const sourceRoot = path.dirname(scenario.inputPath);
  const namespaceParts = scenario.pathParts.map((part) => part.replace(/-/g, ""));
  const rootNamespace = ["TestCases", ...namespaceParts].join(".");

  const graphResult = buildModuleDependencyGraph(scenario.inputPath, {
    projectRoot: monorepoRoot,
    sourceRoot,
    rootNamespace,
    typeRoots: [globalsPath, corePath],
  });

  if (!graphResult.ok) {
    const errors = graphResult.error
      .map((d) => `${d.code}: ${d.message}`)
      .join("\n");
    throw new Error(`Compilation failed for ${scenario.inputPath}:\n${errors}`);
  }

  const emitResult = emitCSharpFiles(graphResult.value.modules, {
    rootNamespace,
    bindingRegistry: graphResult.value.bindingRegistry,
  });
  if (!emitResult.ok) {
    const errors = emitResult.errors.map((d) => `${d.code}: ${d.message}`).join("\n");
    throw new Error(`Emit failed for ${scenario.inputPath}:\n${errors}`);
  }

  const className = path.basename(scenario.inputPath, ".ts");
  const generatedKey = Array.from(emitResult.files.keys()).find((key) =>
    key.endsWith(`${className}.cs`)
  );
  if (!generatedKey) {
    throw new Error(
      `Could not find generated file for ${scenario.inputPath}. Available: ${Array.from(
        emitResult.files.keys()
      ).join(", ")}`
    );
  }

  const actualCs = emitResult.files.get(generatedKey);
  if (!actualCs) {
    throw new Error(`Generated key exists but content missing: ${generatedKey}`);
  }

  ensureDir(scenario.expectedPath);
  fs.writeFileSync(scenario.expectedPath, actualCs, "utf-8");
  updated++;
}

console.log(`Updated ${updated} golden expected files.`);
