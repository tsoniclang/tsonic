import { expect } from "chai";
import { describe, it } from "mocha";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const srcRoot = join(process.cwd(), "src");

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
  /(?:^|\/)[^/]+-cases\//.test(relative(srcRoot, file));

const productionFiles = (): string[] =>
  walkTsFiles(srcRoot).filter(
    (file) => !file.endsWith(".test.ts") && !isTestSupportFile(file)
  );

describe("dotnet binding payload architecture invariants", () => {
  it("routes every dotnet-payload consumer through the shared boundary helper", () => {
    const requiredConsumers = [
      "program/metadata.ts",
      "program/binding-registry-loading.ts",
      "resolver/clr-bindings-package-resolution.ts",
      "ir/type-system/internal/universe/clr-catalog.ts",
      "ir/type-system/internal/type-converter/references-structural-bindings.ts",
    ];

    const missingImport = requiredConsumers.filter((file) => {
      const text = readFileSync(join(srcRoot, file), "utf8");
      return !/from\s+["'][^"']*dotnet-binding-payload\.js["']/.test(text);
    });

    expect(missingImport).to.deep.equal([]);
  });

  it("confines direct dotnet payload field access to the validation and helper boundary", () => {
    const allowedDirectAccess = new Set([
      "program/binding-types.ts",
      "program/dotnet-binding-payload.ts",
      "ir/type-system/internal/universe/raw-bindings-types.ts",
    ]);

    const hits = productionFiles()
      .map((file) => relative(srcRoot, file))
      .filter((file) => !allowedDirectAccess.has(file))
      .filter((file) => {
        const text = readFileSync(join(srcRoot, file), "utf8");
        return /\.dotnet\.(types|exports)\b/.test(text);
      });

    expect(hits).to.deep.equal([]);
  });
});
