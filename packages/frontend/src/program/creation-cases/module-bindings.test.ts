import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  getTstsContainingSourceFileName,
  getTstsIdentifierText,
  TstsSyntax,
  type TstsNode,
  type TstsSourceFile,
  visitTstsSubtree,
} from "@tsonic/tsts";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";
import { createProgram } from "../creation.js";

const hasSourceFile = (
  sourceFiles: readonly TstsSourceFile[],
  filePath: string
): boolean =>
  sourceFiles.some(
    (sourceFile) =>
      path.resolve(sourceFile.FileName()) === path.resolve(filePath)
  );

const findSourceFile = (
  sourceFiles: readonly TstsSourceFile[],
  filePath: string
): TstsSourceFile | undefined =>
  sourceFiles.find(
    (sourceFile) =>
      path.resolve(sourceFile.FileName()) === path.resolve(filePath)
  );

const findIdentifier = (
  sourceFile: TstsSourceFile,
  name: string
): TstsNode | undefined => {
  let result: TstsNode | undefined;
  visitTstsSubtree(sourceFile, (node) => {
    if (!result && getTstsIdentifierText(node) === name) {
      result = node;
    }
  });
  return result;
};

describe("Program Creation – module bindings", function () {
  this.timeout(90_000);

  it("should resolve node module imports from installed source-package module aliases", () => {
    const fixture = materializeFrontendFixture([
      "fragments/module-bindings/basic-fixture-js-surface",
      "program/creation/module-bindings/node-module-alias",
    ]);

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const packageEntry = fixture.path(
        "app/node_modules/@tsonic/nodejs/src/fs.ts"
      );

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
        typeRoots: ["node_modules/@tsonic/nodejs"],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        hasSourceFile(result.value.sourceProgram.sourceFiles, packageEntry)
      ).to.equal(true);
      const sourceFile = findSourceFile(result.value.sourceFiles, entryPath);
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      let importDecl: TstsNode | undefined;
      visitTstsSubtree(sourceFile, (node) => {
        if (importDecl || !node || !TstsSyntax.IsImportDeclaration(node)) return;
        const moduleSpecifier = TstsSyntax.Node_ModuleSpecifier(node);
        if (TstsSyntax.Node_Text(moduleSpecifier) === "node:fs") {
          importDecl = node;
        }
      });
      expect(importDecl).to.not.equal(undefined);

      const importSpecifierName = findIdentifier(sourceFile, "readFileSync");
      expect(importSpecifierName).to.not.equal(undefined);
      if (!importSpecifierName) return;

      const importSymbol = result.value.sourceChecker.getSymbolAtLocation(
        importSpecifierName
      );
      expect(importSymbol).to.not.equal(undefined);
      if (!importSymbol) return;

      const aliasedSymbol = result.value.sourceChecker.resolveAlias(
        importSymbol
      );
      expect(aliasedSymbol).to.not.equal(undefined);
      if (!aliasedSymbol) return;
      const declarationFiles = result.value.sourceChecker
        .getSymbolDeclarations(aliasedSymbol)
        .map((declaration) => getTstsContainingSourceFileName(declaration))
        .filter((fileName): fileName is string => fileName !== undefined)
        .map((fileName) => path.resolve(fileName));
      expect(declarationFiles).to.include(path.resolve(packageEntry));
    } finally {
      fixture.cleanup();
    }
  });

  it("should resolve declaration-module aliases into installed source-package modules", () => {
    const fixture = materializeFrontendFixture([
      "fragments/module-bindings/basic-fixture-js-surface",
      "program/creation/module-bindings/declaration-module-alias",
    ]);

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const packageEntry = fixture.path(
        "app/node_modules/@tsonic/nodejs/src/http/index.ts"
      );

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
        typeRoots: ["node_modules/@tsonic/nodejs"],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        hasSourceFile(result.value.sourceProgram.sourceFiles, packageEntry)
      ).to.equal(true);
      expect(
        result.value.sourceProgram.sourceFiles.some(
          (sourceFile) => path.resolve(sourceFile.FileName()) === packageEntry
        )
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("should include source-package entrypoints referenced by global bindings", () => {
    const fixture = materializeFrontendFixture([
      "fragments/module-bindings/console-global-fixture-js-surface",
      "program/creation/module-bindings/global-binding-console",
    ]);

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const packageEntry = fixture.path(
        "app/node_modules/@fixture/js/src/console.ts"
      );

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        hasSourceFile(result.value.sourceProgram.sourceFiles, packageEntry)
      ).to.equal(true);
      expect(
        result.value.sourceProgram.sourceFiles.some(
          (sourceFile) => path.resolve(sourceFile.FileName()) === packageEntry
        )
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("should remap root-namespace internal imports to package index internals", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/module-bindings/root-namespace-internal"
    );

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const jsInternalIndex = fixture.path(
        "app/node_modules/@tsonic/js-temp/index/internal/index.d.ts"
      );

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        typeRoots: [
          "node_modules/@tsonic/node-temp",
          "node_modules/@tsonic/js-temp",
        ],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        hasSourceFile(result.value.declarationSourceFiles, jsInternalIndex)
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("should include declaration files from custom non-@tsonic surface packages", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/module-bindings/custom-surface-declarations"
    );

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const surfaceRoot = fixture.path("app/node_modules/@acme/surface-web");

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@acme/surface-web",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const expectedDts = path.resolve(path.join(surfaceRoot, "index.d.ts"));
      expect(
        result.value.declarationSourceFiles.some(
          (sourceFile) => path.resolve(sourceFile.FileName()) === expectedDts
        )
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("should load imported source-package modules into the program graph", () => {
    const fixture = materializeFrontendFixture([
      "fragments/module-bindings/basic-fixture-js-surface",
      "program/creation/module-bindings/imported-source-package",
    ]);

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const packageEntry = fixture.path(
        "app/node_modules/@acme/math/src/index.ts"
      );

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        hasSourceFile(result.value.sourceProgram.sourceFiles, packageEntry)
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("dedupes global source-package ambient files when a workspace-installed surface resolves through an ancestor node_modules", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/module-bindings/dedupe-global-source-surface"
    );

    try {
      const projectRoot = fixture.path("workspace/packages/app");
      const srcDir = fixture.path("workspace/packages/app/src");
      const entryPath = fixture.path("workspace/packages/app/src/index.ts");
      const externalRoot = fixture.path("external/js-surface");
      const consolePath = fixture.path("external/js-surface/src/console.ts");

      const result = createProgram([entryPath, consolePath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
        typeRoots: [externalRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const consoleSourceFiles = result.value.sourceProgram.sourceFiles.filter(
        (sourceFile) => {
          try {
            return (
              fs.realpathSync(sourceFile.FileName()) ===
              fs.realpathSync(consolePath)
            );
          } catch {
            return false;
          }
        }
      );
      expect(consoleSourceFiles).to.have.lengthOf(1);
    } finally {
      fixture.cleanup();
    }
  });

  it("includes imported local type-only modules in the source program graph", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/module-bindings/local-relative-import-type-module"
    );

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");
      const importedPath = fixture.path("app/src/profile-types.ts");

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        hasSourceFile(result.value.sourceProgram.sourceFiles, importedPath)
      ).to.equal(true);
      expect(
        result.value.sourceProgram.sourceFiles.some(
          (sourceFile) => path.resolve(sourceFile.FileName()) === importedPath
        )
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });
});
