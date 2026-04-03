import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";
import { createProgram } from "../creation.js";

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
      const packageEntry = fixture.path("app/node_modules/@tsonic/nodejs/src/fs.ts");

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
        typeRoots: ["node_modules/@tsonic/nodejs"],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value.program.getSourceFile(packageEntry)).to.not.equal(
        undefined
      );
      const sourceFile = result.value.program.getSourceFile(entryPath);
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const importDecl = sourceFile.statements.find(
        (stmt): stmt is ts.ImportDeclaration =>
          ts.isImportDeclaration(stmt) &&
          ts.isStringLiteral(stmt.moduleSpecifier) &&
          stmt.moduleSpecifier.text === "node:fs"
      );
      expect(importDecl).to.not.equal(undefined);
      if (!importDecl?.importClause?.namedBindings) return;
      expect(ts.isNamedImports(importDecl.importClause.namedBindings)).to.equal(
        true
      );
      if (!ts.isNamedImports(importDecl.importClause.namedBindings)) return;

      const importSpecifier = importDecl.importClause.namedBindings.elements.find(
        (element) => element.name.text === "readFileSync"
      );
      expect(importSpecifier).to.not.equal(undefined);
      if (!importSpecifier) return;

      const checker = result.value.program.getTypeChecker();
      const importSymbol = checker.getSymbolAtLocation(importSpecifier.name);
      expect(importSymbol).to.not.equal(undefined);
      if (!importSymbol) return;

      const aliasedSymbol =
        importSymbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(importSymbol)
          : importSymbol;
      const declarationFiles = (aliasedSymbol.getDeclarations() ?? []).map(
        (declaration) => path.resolve(declaration.getSourceFile().fileName)
      );
      expect(declarationFiles).to.include(path.resolve(packageEntry));

      const moduleResolutionErrors = result.value.program
        .getSemanticDiagnostics()
        .filter((diagnostic) => diagnostic.code === 2307);
      expect(moduleResolutionErrors).to.deep.equal([]);
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

      expect(result.value.program.getSourceFile(packageEntry)).to.not.equal(
        undefined
      );
      expect(
        result.value.sourceFiles.some(
          (sourceFile) => path.resolve(sourceFile.fileName) === packageEntry
        )
      ).to.equal(true);
      const moduleResolutionErrors = result.value.program
        .getSemanticDiagnostics()
        .filter((diagnostic) => diagnostic.code === 2307);
      expect(moduleResolutionErrors).to.deep.equal([]);
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
      const packageEntry = fixture.path("app/node_modules/@fixture/js/src/console.ts");

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value.program.getSourceFile(packageEntry)).to.not.equal(
        undefined
      );
      expect(
        result.value.sourceFiles.some(
          (sourceFile) => path.resolve(sourceFile.fileName) === packageEntry
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

      expect(result.value.program.getSourceFile(jsInternalIndex)).to.not.equal(
        undefined
      );
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
          (sourceFile) => path.resolve(sourceFile.fileName) === expectedDts
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
      const packageEntry = fixture.path("app/node_modules/@acme/math/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@fixture/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value.program.getSourceFile(packageEntry)).to.not.equal(
        undefined
      );
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

      const consoleSourceFiles = result.value.sourceFiles.filter((sourceFile) => {
        try {
          return fs.realpathSync(sourceFile.fileName) === fs.realpathSync(consolePath);
        } catch {
          return false;
        }
      });
      expect(consoleSourceFiles).to.have.lengthOf(1);
    } finally {
      fixture.cleanup();
    }
  });
});
