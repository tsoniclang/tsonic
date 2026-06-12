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
    normalized === "types/test-harness.ts"
  );
};

const bannedSemanticQueries = [
  "checker.getTypeAtLocation(",
  "checker.getContextualType(",
  "checker.getSymbolAtLocation(",
  "checker.getResolvedSignature(",
  "checker.getAliasedSymbol(",
  "checker.getExportsOfModule(",
  "checker.getShorthandAssignmentValueSymbol(",
  "checker.getTypeOfSymbolAtLocation(",
  "checker.getTypeArguments(",
  "checker.getReturnTypeOfSignature(",
  "checker.getSignatureFromDeclaration(",
  "checker.getFullyQualifiedName(",
  "checker.getSymbolsInScope(",
  "checker.getTypeFromTypeNode(",
  "checker.getApparentType(",
  "checker.getPropertyOfType(",
  "checker.getSignaturesOfType(",
  "checker.isArrayType(",
  "checker.isTupleType(",
  "checker.typeToString(",
  "checker.typeToTypeNode(",
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

  it("does not expose the raw source checker on TsonicProgram", () => {
    const programTypesPath = path.join(frontendSrcRoot, "program/types.ts");
    const text = fs.readFileSync(programTypesPath, "utf8");

    expect(text).not.to.include("readonly checker:");
    expect(text).not.to.include("checker: ts.TypeChecker");
  });

  it("does not reach through TsonicProgram to raw TypeScript program APIs", () => {
    const offenders = collectTypeScriptFiles(frontendSrcRoot)
      .filter((filePath) => !isBoundaryFile(filePath))
      .flatMap((filePath) => {
        const text = fs.readFileSync(filePath, "utf8");
        const lines = text.split(/\r?\n/);
        return lines.flatMap((line, index) =>
          line.includes("program.program.")
            ? [
                `${normalizePath(path.relative(repoRoot, filePath))}:${index + 1}`,
              ]
            : []
        );
      });

    expect(offenders).to.deep.equal([]);
  });

  it("keeps Tsonic source extensions on the public TSTS extension API", () => {
    const extensionRoot = path.join(frontendSrcRoot, "tsonic-extension");
    const offenders = collectTypeScriptFiles(extensionRoot).flatMap(
      (filePath) => {
        const text = fs.readFileSync(filePath, "utf8");
        const lines = text.split(/\r?\n/);
        return lines.flatMap((line, index) => {
          const importsPrivateTsts =
            line.includes("@tsonic/tsts/") ||
            line.includes("packages/tsts/src/internal/") ||
            line.includes("../internal/ast/") ||
            line.includes("../internal/checker/");
          return importsPrivateTsts
            ? [
                `${normalizePath(path.relative(repoRoot, filePath))}:${index + 1}`,
              ]
            : [];
        });
      }
    );

    expect(offenders).to.deep.equal([]);
  });
});
