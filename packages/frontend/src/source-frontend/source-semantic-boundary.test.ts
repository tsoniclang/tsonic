import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../../../..");
const frontendSrcRoot = path.join(repoRoot, "packages/frontend/src");

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

const isBoundaryFile = (filePath: string): boolean => {
  const normalized = normalizePath(path.relative(frontendSrcRoot, filePath));
  return (
    normalized === "source-frontend/typescript-semantic-view.ts" ||
    normalized.endsWith(".test.ts") ||
    normalized.includes("-cases/") ||
    normalized.startsWith("ir/type-system/") ||
    normalized === "types/test-harness.ts"
  );
};

const bannedSemanticQueries = [
  "getTypeAtLocation(",
  "getSymbolAtLocation(",
] as const;

describe("source semantic boundary", () => {
  it("keeps source semantic queries behind sourceSemantics", () => {
    const offenders = collectTypeScriptFiles(frontendSrcRoot)
      .filter((filePath) => !isBoundaryFile(filePath))
      .flatMap((filePath) => {
        const text = fs.readFileSync(filePath, "utf8");
        const lines = text.split(/\r?\n/);
        return lines.flatMap((line, index) => {
          const query = bannedSemanticQueries.find((candidate) =>
            line.includes(candidate)
          );
          return query
            ? [
                `${normalizePath(path.relative(repoRoot, filePath))}:${index + 1} ${query}`,
              ]
            : [];
        });
      });

    expect(offenders).to.deep.equal([]);
  });
});
