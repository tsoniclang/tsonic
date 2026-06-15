import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../../../../../..");
const emitterSrcRoot = path.join(
  repoRoot,
  "packages/targets/csharp/emitter/src"
);

const collectTypeScriptFiles = (dir: string): readonly string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }

  return files;
};

const normalizePath = (filePath: string): string =>
  filePath.replace(/\\/g, "/");

const productFiles = (): readonly string[] =>
  collectTypeScriptFiles(emitterSrcRoot).filter(
    (filePath) => !filePath.endsWith(".test.ts")
  );

const matchingLines = (
  bannedSnippets: readonly string[]
): readonly string[] =>
  productFiles().flatMap((filePath) => {
    const text = fs.readFileSync(filePath, "utf8");
    return text.split(/\r?\n/).flatMap((line, index) => {
      const snippet = bannedSnippets.find((candidate) =>
        line.includes(candidate)
      );
      return snippet
        ? [
            `${normalizePath(path.relative(repoRoot, filePath))}:${index + 1} ${snippet}`,
          ]
        : [];
    });
  });

describe("C# emitter architecture boundary", () => {
  it("does not import TSTS or checker APIs in product rendering code", () => {
    expect(
      matchingLines([
        'from "@tsonic/tsts"',
        'from "@tsonic/tsts/',
        "checker.getTypeAtLocation(",
        "checker.getNarrowedTypeAtLocation(",
        "checker.getSymbolAtLocation(",
        "checker.getResolvedSignature(",
      ])
    ).to.deep.equal([]);
  });

  it("does not infer source runtime operations from property/member text", () => {
    expect(
      matchingLines([
        'rawMember === "length"',
        'heritageType.name === "struct"',
        'operation.member !== "length"',
        'operation.member === "length" && !plan.sourceOperation',
      ])
    ).to.deep.equal([]);
  });

  it("does not classify type opacity from rendered source names", () => {
    expect(
      matchingLines([
        'type.name === "_"',
        'type.name.includes("\\uFFFD")',
        'type.name.startsWith("_")',
        'sourceRuntimeName?.name === "_"',
        "bySimpleName",
        "simpleTypeName",
      ])
    ).to.deep.equal([]);
  });
});
