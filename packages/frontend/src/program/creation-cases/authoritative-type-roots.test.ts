/**
 * Tests for authoritative typeRoot resolution: @tsonic module type queries
 * and direct @tsonic imports resolved through authoritative package graph
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getTstsNodeText,
  TstsSyntax,
  type TstsNode,
  type TstsSourceFile,
  visitTstsSubtree,
} from "@tsonic/tsts";
import { createProgram } from "../creation.js";
import { getProgramRuntimeSourceFiles } from "../queries.js";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";

const findSourceFile = (
  sourceFiles: readonly TstsSourceFile[],
  filePath: string
): TstsSourceFile | undefined =>
  sourceFiles.find(
    (sourceFile) =>
      path.resolve(sourceFile.FileName()) === path.resolve(filePath)
  );

const sourceFilePaths = (sourceFiles: readonly TstsSourceFile[]): string[] =>
  sourceFiles.map((sourceFile) => path.resolve(sourceFile.FileName()));

const expressionText = (node: TstsNode): string | undefined =>
  getTstsNodeText(node)?.trim();

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

      const runtimeSourceFiles = getProgramRuntimeSourceFiles(result.value);
      const sourceFile = findSourceFile(runtimeSourceFiles, entryPath);
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const returnTypes = new Map<string, string>();

      result.value.sourceProgram.withTypeChecker(sourceFile, (checker) => {
        visitTstsSubtree(sourceFile, (node) => {
          if (!node || !TstsSyntax.IsCallExpression(node)) return;
          const call = TstsSyntax.AsCallExpression(node);
          const expression = call?.Expression;
          if (expression && TstsSyntax.IsPropertyAccessExpression(expression)) {
            const callee = expressionText(expression);
            if (callee === "path.join" || callee === "process.cwd") {
              returnTypes.set(
                callee,
                checker.typeToString(
                  checker.getNarrowedTypeAtLocation(node) ??
                    checker.getTypeAtLocation(node)
                )
              );
            }
          }
        });
      });

      expect(returnTypes.get("path.join")).to.equal("string");
      expect(returnTypes.get("process.cwd")).to.equal("string");

      const programFiles = sourceFilePaths(runtimeSourceFiles);
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

      const runtimeSourceFiles = getProgramRuntimeSourceFiles(result.value);
      const sourceFile = findSourceFile(runtimeSourceFiles, entryPath);
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const returnTypes = new Map<string, string>();

      result.value.sourceProgram.withTypeChecker(sourceFile, (checker) => {
        visitTstsSubtree(sourceFile, (node) => {
          if (!node || !TstsSyntax.IsCallExpression(node)) return;
          const call = TstsSyntax.AsCallExpression(node);
          const expression = call?.Expression;
          if (
            expression &&
            (TstsSyntax.IsIdentifier(expression) ||
              TstsSyntax.IsPropertyAccessExpression(expression))
          ) {
            const callee = expressionText(expression);
            if (callee === "join" || callee === "process.cwd") {
              returnTypes.set(
                callee,
                checker.typeToString(
                  checker.getNarrowedTypeAtLocation(node) ??
                    checker.getTypeAtLocation(node)
                )
              );
            }
          }
        });
      });

      expect(returnTypes.get("join")).to.equal("string");
      expect(returnTypes.get("process.cwd")).to.equal("string");

      const programFiles = sourceFilePaths(runtimeSourceFiles);
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

      const programFiles = getProgramRuntimeSourceFiles(result.value).map(
        (sourceFile) => path.resolve(sourceFile.FileName())
      );
      expect(programFiles).to.include(pathEntry);
      expect(programFiles).to.not.include(unusedEntry);
    } finally {
      fixture.cleanup();
    }
  });
});
