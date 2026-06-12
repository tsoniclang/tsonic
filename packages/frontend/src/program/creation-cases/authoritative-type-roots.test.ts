/**
 * Tests for authoritative typeRoot resolution: @tsonic module type queries
 * and direct @tsonic imports resolved through authoritative package graph
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { createProgram } from "../creation.js";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";

const findSourceFile = (
  sourceFiles: readonly ts.SourceFile[],
  filePath: string
): ts.SourceFile | undefined =>
  sourceFiles.find(
    (sourceFile) => path.resolve(sourceFile.fileName) === path.resolve(filePath)
  );

const sourceFilePaths = (sourceFiles: readonly ts.SourceFile[]): string[] =>
  sourceFiles.map((sourceFile) => path.resolve(sourceFile.fileName));

describe("Program Creation – authoritative type roots", function () {
  this.timeout(90_000);
  const currentFileDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(currentFileDir, "../../../../..");
  const authoritativeRoot = path.resolve(repoRoot, "../nodejs/versions/10");

  it("should keep @tsonic module type queries on the authoritative typeRoot package graph", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/authoritative-type-roots/module-type-queries"
    );

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [authoritativeRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const sourceFile = findSourceFile(result.value.sourceFiles, entryPath);
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const returnTypes = new Map<string, string>();

      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression)
        ) {
          const callee = node.expression.getText(sourceFile);
          if (callee === "path.join" || callee === "process.cwd") {
            returnTypes.set(
              callee,
              result.value.sourceSemantics.typeToString(
                result.value.sourceSemantics.getExpressionType(node)
              )
            );
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      expect(returnTypes.get("path.join")).to.equal("string");
      expect(returnTypes.get("process.cwd")).to.equal("string");

      const programFiles = sourceFilePaths(result.value.sourceFiles);
      expect(programFiles).to.include(
        path.resolve(authoritativeRoot, "src/path-module.ts")
      );
      expect(programFiles).to.include(
        path.resolve(authoritativeRoot, "src/process-module.ts")
      );
      expect(programFiles).to.not.include(
        fixture.path("app/node_modules/@tsonic/nodejs/src/path.ts")
      );
      expect(programFiles).to.not.include(
        fixture.path("app/node_modules/@tsonic/nodejs/src/process.ts")
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("should keep direct @tsonic imports on the authoritative package graph", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/authoritative-type-roots/direct-imports"
    );

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [authoritativeRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const sourceFile = findSourceFile(result.value.sourceFiles, entryPath);
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const returnTypes = new Map<string, string>();

      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          (ts.isIdentifier(node.expression) ||
            ts.isPropertyAccessExpression(node.expression))
        ) {
          const callee = node.expression.getText(sourceFile);
          if (callee === "join" || callee === "process.cwd") {
            returnTypes.set(
              callee,
              result.value.sourceSemantics.typeToString(
                result.value.sourceSemantics.getExpressionType(node)
              )
            );
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      expect(returnTypes.get("join")).to.equal("string");
      expect(returnTypes.get("process.cwd")).to.equal("string");

      const programFiles = sourceFilePaths(result.value.sourceFiles);
      expect(programFiles).to.include(
        path.resolve(authoritativeRoot, "src/index.ts")
      );
      expect(programFiles).to.include(
        path.resolve(authoritativeRoot, "src/path-module.ts")
      );
      expect(programFiles).to.include(
        path.resolve(authoritativeRoot, "src/process-module.ts")
      );
      expect(programFiles).to.not.include(
        fixture.path("app/node_modules/@tsonic/nodejs/src/index.ts")
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("should not preload unrelated authoritative source-package exports", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/authoritative-type-roots/minimal-authoritative-roots"
    );

    try {
      const projectRoot = fixture.path("app");
      const authoritativeRoot = fixture.path("authoritative-js");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const pathEntry = fixture.path("authoritative-js/src/path.ts");
      const unusedEntry = fixture.path("authoritative-js/src/unused.ts");

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
        typeRoots: [authoritativeRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const programFiles = result.value.sourceFiles.map((sourceFile) =>
        path.resolve(sourceFile.fileName)
      );
      expect(programFiles).to.include(pathEntry);
      expect(programFiles).to.not.include(unusedEntry);
    } finally {
      fixture.cleanup();
    }
  });
});
