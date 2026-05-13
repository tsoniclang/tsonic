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
});
