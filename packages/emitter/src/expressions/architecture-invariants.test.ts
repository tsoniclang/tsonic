import { expect } from "chai";
import { describe, it } from "mocha";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const emitterRoot = join(process.cwd(), "src");
const expressionsRoot = join(emitterRoot, "expressions");

const walkTsFiles = (dir: string): string[] => {
  const entries = readdirSync(dir).sort();
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkTsFiles(fullPath));
      continue;
    }
    if (entry.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
};

const isTestSupportFile = (file: string): boolean =>
  /(?:^|\/)[^/]+-cases\//.test(relative(expressionsRoot, file));

const productionExpressionFiles = (): string[] =>
  walkTsFiles(expressionsRoot).filter(
    (file) => !file.endsWith(".test.ts") && !isTestSupportFile(file)
  );

describe("expression architecture invariants", () => {
  it("keeps expression entrypoints on the shared expected-type planner", () => {
    const expressionEmitter = readFileSync(
      join(emitterRoot, "expression-emitter.ts"),
      "utf8"
    );
    const typeAssertions = readFileSync(
      join(expressionsRoot, "type-assertion-emitters.ts"),
      "utf8"
    );

    expect(expressionEmitter).to.include(
      'from "./expressions/expected-type-adaptation.js"'
    );
    expect(expressionEmitter).to.not.include("runtime-union-adaptation.js");
    expect(expressionEmitter).to.not.include("structural-adaptation.js");
    expect(expressionEmitter).to.not.include("direct-storage-types.js");

    expect(typeAssertions).to.include('from "./expected-type-adaptation.js"');
    expect(typeAssertions).to.not.include("runtime-union-adaptation.js");
    expect(typeAssertions).to.not.include("structural-adaptation.js");
    expect(typeAssertions).to.not.include("direct-storage-types.js");
  });

  it("confines raw runtime-union adaptation imports to the shared planner boundary", () => {
    const allowedRuntimeUnionImports = new Set([
      "expected-type-adaptation.ts",
      "runtime-union-adaptation-projection.ts",
      "runtime-union-adaptation.ts",
      "runtime-union-adaptation-upcast.ts",
    ]);
    const allowedDirectStorageImports = new Set([
      "calls/call-runtime-union-guards.ts",
      "expected-type-adaptation.ts",
      "operators/binary-runtime-union-comparison.ts",
      "operators/binary-special-ops.ts",
    ]);

    const runtimeUnionImportHits: string[] = [];
    const directStorageImportHits: string[] = [];

    for (const file of productionExpressionFiles()) {
      const relativeFile = relative(expressionsRoot, file);
      const text = readFileSync(file, "utf8");

      if (
        /from\s+["'][^"']*runtime-union-adaptation\.js["']/.test(text) &&
        !allowedRuntimeUnionImports.has(relativeFile)
      ) {
        runtimeUnionImportHits.push(relativeFile);
      }

      if (
        /from\s+["'][^"']*direct-storage-types\.js["']/.test(text) &&
        !allowedDirectStorageImports.has(relativeFile)
      ) {
        directStorageImportHits.push(relativeFile);
      }
    }

    expect(runtimeUnionImportHits).to.deep.equal([]);
    expect(directStorageImportHits).to.deep.equal([]);
  });

  it("keeps direct storage lookups out of the runtime-union barrel", () => {
    const runtimeUnionBarrel = readFileSync(
      join(expressionsRoot, "runtime-union-adaptation.ts"),
      "utf8"
    );

    expect(runtimeUnionBarrel).to.not.include(
      "resolveDirectStorageExpressionType"
    );
  });

  it("keeps permissive architecture names out of emitter product code", () => {
    const hits: string[] = [];
    const forbiddenNames = [
      "isBroadObjectPassThroughType",
      "preserveRuntimeLayout",
    ];
    for (const file of walkTsFiles(emitterRoot)) {
      if (file.endsWith(".test.ts")) continue;
      const text = readFileSync(file, "utf8");
      for (const forbiddenName of forbiddenNames) {
        if (text.includes(forbiddenName)) {
          hits.push(`${relative(emitterRoot, file)}:${forbiddenName}`);
        }
      }
    }

    expect(hits).to.deep.equal([]);
  });

  it("keeps JS surface member behavior metadata-backed", () => {
    const hits: string[] = [];
    for (const file of walkTsFiles(emitterRoot)) {
      if (file.endsWith(".test.ts")) continue;
      const relativeFile = relative(emitterRoot, file);
      const text = readFileSync(file, "utf8");
      if (
        text.includes("js-array-surface-members") ||
        text.includes("JS_ARRAY_MUTATING_METHODS") ||
        text.includes("JS_ARRAY_RETURNING_METHODS") ||
        text.includes("isLengthPropertyName")
      ) {
        hits.push(relativeFile);
      }
    }

    expect(hits).to.deep.equal([]);
  });

  it("does not synthesize string length access from receiver type names", () => {
    const hits: string[] = [];

    for (const file of walkTsFiles(emitterRoot)) {
      if (file.endsWith(".test.ts")) continue;
      const relativeFile = relative(emitterRoot, file);
      const text = readFileSync(file, "utf8");
      if (text.includes("isStringReceiverType")) {
        hits.push(`${relativeFile}:isStringReceiverType`);
      }
    }

    expect(hits).to.deep.equal([]);
  });

  it("centralizes typeof comparison extraction", () => {
    const allowedFiles = new Set([
      "core/semantic/typeof-comparison.ts",
      "expressions/operators/unary-emitter.ts",
    ]);
    const hits: string[] = [];

    for (const file of walkTsFiles(emitterRoot)) {
      if (file.endsWith(".test.ts")) continue;
      const relativeFile = relative(emitterRoot, file).replace(/\\/g, "/");
      if (allowedFiles.has(relativeFile)) continue;
      const text = readFileSync(file, "utf8");
      if (
        text.includes('operator !== "typeof"') ||
        text.includes('operator === "typeof"')
      ) {
        hits.push(relativeFile);
      }
    }

    expect(hits).to.deep.equal([]);
  });

  it("keeps runtime-storage normalization behind semantic storage helpers", () => {
    const allowedFiles = new Set([
      "core/format/local-names.ts",
      "core/semantic/broad-array-storage.ts",
      "core/semantic/direct-storage-ir-types.ts",
      "core/semantic/storage-types.ts",
      "core/semantic/symbol-types.ts",
      "core/semantic/variable-type-resolution.ts",
    ]);
    const hits: string[] = [];

    for (const file of walkTsFiles(emitterRoot)) {
      if (file.endsWith(".test.ts")) continue;
      const relativeFile = relative(emitterRoot, file).replace(/\\/g, "/");
      if (allowedFiles.has(relativeFile)) continue;
      const text = readFileSync(file, "utf8");
      if (text.includes("normalizeRuntimeStorageType(")) {
        hits.push(relativeFile);
      }
    }

    expect(hits).to.deep.equal([]);
  });

  it("keeps identifier storage orchestration as a facade over named strategies", () => {
    const facade = readFileSync(
      join(expressionsRoot, "identifier-storage.ts"),
      "utf8"
    );
    const strategyRoot = join(expressionsRoot, "identifier-storage");
    const strategyFiles = walkTsFiles(strategyRoot)
      .map((file) => relative(strategyRoot, file).replace(/\\/g, "/"))
      .filter((file) => file !== "storage-surface.ts")
      .sort();

    expect(strategyFiles).to.include.members([
      "broad-storage-target.ts",
      "implicit-storage.ts",
      "materialized-narrowed.ts",
      "narrowed-storage-compatible.ts",
      "reified-storage.ts",
      "runtime-subset.ts",
      "storage-compatible.ts",
      "storage-surface-match.ts",
    ]);
    expect(facade).to.include('from "./identifier-storage/storage-surface.js"');
    expect(facade).to.not.include("normalizeRuntimeStorageType(");

    const oversizedStrategies = strategyFiles.filter(
      (file) =>
        readFileSync(join(strategyRoot, file), "utf8").split("\n").length > 360
    );

    expect(oversizedStrategies).to.deep.equal([]);
  });
});
