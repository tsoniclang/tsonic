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
    normalized.endsWith(".test.ts") ||
    normalized.includes("-cases/") ||
    normalized === "source-frontend/tsts-semantic-view.ts" ||
    normalized === "tsonic-extension/source-semantics.ts" ||
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
  it("keeps source semantic queries behind the TSTS semantic bridge", () => {
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

  it("keeps raw source symbol/type object methods behind the TSTS semantic bridge", () => {
    const bannedReads = [
      ".getDeclarations(",
      ".getConstructSignatures(",
      ".getCallSignatures(",
      ".getProperties(",
      ".valueDeclaration",
      "symbol.declarations",
      "symbol?.declarations",
      "SymbolFlags.Alias",
      "sourceSemantics.getAliasedSymbol",
      ".aliasSymbol",
      ".aliasTypeArguments",
      ".getSymbol()",
      ".objectFlags",
      "ts.ObjectFlags",
      ".getDeclaration(",
      ".getParameters(",
    ] as const;

    const offenders = collectTypeScriptFiles(frontendSrcRoot)
      .filter((filePath) => !isBoundaryFile(filePath))
      .flatMap((filePath) => {
        const text = fs.readFileSync(filePath, "utf8");
        const lines = text.split(/\r?\n/);
        return lines.flatMap((line, index) => {
          const isAllowedBoundaryCall =
            /sourceSemantics\.(getSymbolDeclarations|getSymbolValueDeclaration|getConstructSignatures|getCallSignatures|getProperties)\(/.test(
              line
            );
          if (isAllowedBoundaryCall) return [];

          const read = bannedReads.find((candidate) =>
            line.includes(candidate)
          );
          return read
            ? [
                `${normalizePath(path.relative(repoRoot, filePath))}:${index + 1} ${read}`,
              ]
            : [];
        });
      });

    expect(offenders).to.deep.equal([]);
  });

  it("keeps validation type classification behind the semantic bridge", () => {
    const validationRoot = path.join(frontendSrcRoot, "validation");
    const bannedReads = [
      "ts.TypeFlags",
      ".getFlags(",
      ".isUnion(",
      ".isIntersection(",
      ".isUnionOrIntersection(",
    ] as const;

    const offenders = collectTypeScriptFiles(validationRoot)
      .filter((filePath) => !isBoundaryFile(filePath))
      .flatMap((filePath) => {
        const text = fs.readFileSync(filePath, "utf8");
        const lines = text.split(/\r?\n/);
        return lines.flatMap((line, index) => {
          const read = bannedReads.find((candidate) =>
            line.includes(candidate)
          );
          return read
            ? [
                `${normalizePath(path.relative(repoRoot, filePath))}:${index + 1} ${read}`,
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
    expect(text).not.to.include("readonly program: ts.Program");
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

  it("does not expose the raw TSTS compiler program outside the source-program adapter", () => {
    const sourceProgramPath = path.join(
      frontendSrcRoot,
      "source-frontend/tsts-source-program.ts"
    );
    const text = fs.readFileSync(sourceProgramPath, "utf8");

    expect(text).not.to.include("readonly compilerProgram");
  });

  it("keeps source-front TSTS integration on the public TSTS API", () => {
    const tstsIntegrationRoots = [
      path.join(frontendSrcRoot, "source-frontend"),
      path.join(frontendSrcRoot, "tsonic-extension"),
    ];
    const offenders = tstsIntegrationRoots.flatMap((root) =>
      collectTypeScriptFiles(root)
        .filter((filePath) => !isBoundaryFile(filePath))
        .flatMap((filePath) => {
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
        })
    );

    expect(offenders).to.deep.equal([]);
  });

  it("uses TSTS fact primitives for source-extension facts", () => {
    const semanticViewPath = path.join(
      frontendSrcRoot,
      "source-frontend/semantic-view.ts"
    );
    const text = fs.readFileSync(semanticViewPath, "utf8");

    expect(text).to.include('from "@tsonic/tsts"');
    expect(text).to.include("ExtensionFacts");
    expect(text).to.include("ExtensionFactKeyLike");
    expect(text).not.to.include("defineSourceSemanticFactKey");
    expect(text).not.to.include("new WeakMap");
    expect(text).not.to.include("Map<string, unknown>");
  });

  it("does not export the TypeScript semantic bridge from the source frontend barrel", () => {
    const sourceFrontendIndexPath = path.join(
      frontendSrcRoot,
      "source-frontend/index.ts"
    );
    const text = fs.readFileSync(sourceFrontendIndexPath, "utf8");

    expect(text).not.to.include("createTypeScriptSemanticView");
    expect(text).not.to.include("typescript-semantic-view.js");
  });

  it("does not keep the stale frontend semantic alias module", () => {
    expect(
      fs.existsSync(
        path.join(
          frontendSrcRoot,
          "source-frontend/frontend-source-semantic-view.ts"
        )
      )
    ).to.equal(false);
  });

  it("does not keep a TSTS-to-TypeScript fact projection bridge", () => {
    const bannedProjectionTerms = [
      "projectTstsFactsTo" + "TypeScriptSource",
      "tsts-fact-" + "projection",
    ] as const;
    const offenders = collectTypeScriptFiles(frontendSrcRoot).flatMap(
      (filePath) => {
        const text = fs.readFileSync(filePath, "utf8");
        const lines = text.split(/\r?\n/);
        return lines.flatMap((line, index) =>
          bannedProjectionTerms.some((term) => line.includes(term))
            ? [
                `${normalizePath(path.relative(repoRoot, filePath))}:${index + 1}`,
              ]
            : []
        );
      }
    );

    expect(offenders).to.deep.equal([]);
  });

  it("keeps product reads of raw program fields behind program queries", () => {
    const allowedFiles = new Set(["program/queries.ts"]);
    const bannedReads = [
      "program.sourceFiles",
      "program.declarationSourceFiles",
      "program.targetSurfaceProvider",
    ] as const;

    const offenders = collectTypeScriptFiles(frontendSrcRoot)
      .filter((filePath) => !isBoundaryFile(filePath))
      .filter(
        (filePath) =>
          !allowedFiles.has(
            normalizePath(path.relative(frontendSrcRoot, filePath))
          )
      )
      .flatMap((filePath) => {
        const text = fs.readFileSync(filePath, "utf8");
        const lines = text.split(/\r?\n/);
        return lines.flatMap((line, index) => {
          const read = bannedReads.find((candidate) =>
            line.includes(candidate)
          );
          return read
            ? [
                `${normalizePath(path.relative(repoRoot, filePath))}:${index + 1} ${read}`,
              ]
            : [];
        });
      });

    expect(offenders).to.deep.equal([]);
  });
});
