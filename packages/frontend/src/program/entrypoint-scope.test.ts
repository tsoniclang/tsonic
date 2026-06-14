import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import { createProgram } from "./creation.js";
import { materializeFrontendFixture } from "../testing/filesystem-fixtures.js";

describe("Program Creation – entrypoint input scope", function () {
  this.timeout(90_000);

  it("does not typecheck unreachable current-package exports in entrypoint scope", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/core-type-checking/string-index-access"
    );

    try {
      const projectRoot = fixture.path("app");
      const sourceRoot = fixture.path("app/src");
      const testEntryFile = fixture.path("app/src/tests-index.ts");
      const smokeFile = fixture.path("app/src/smoke.test.ts");
      const packageExportFile = fixture.path("app/src/index.ts");

      fs.writeFileSync(
        fixture.path("app/tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            source: {
              namespace: "app",
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(testEntryFile, 'import "./smoke.test.ts";\n');
      fs.writeFileSync(smokeFile, "export const smoke = 1 + 1;\n");
      fs.writeFileSync(packageExportFile, "export const productionOnly = ;\n");

      const result = createProgram([testEntryFile], {
        projectRoot,
        sourceRoot,
        rootNamespace: "Acme.JsLike.Tests",
        surface: "core",
        programInputScope: "entrypoint",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const sourceFiles = result.value.sourceFiles.map((sourceFile) =>
        path.resolve(sourceFile.FileName())
      );
      expect(sourceFiles).to.include(path.resolve(testEntryFile));
      expect(sourceFiles).to.include(path.resolve(smokeFile));
      expect(sourceFiles).to.not.include(path.resolve(packageExportFile));
    } finally {
      fixture.cleanup();
    }
  });

  it("continues to typecheck current-package exports in package scope", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/core-type-checking/string-index-access"
    );

    try {
      const projectRoot = fixture.path("app");
      const sourceRoot = fixture.path("app/src");
      const testEntryFile = fixture.path("app/src/tests-index.ts");
      const packageExportFile = fixture.path("app/src/index.ts");

      fs.writeFileSync(
        fixture.path("app/tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            source: {
              namespace: "app",
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(testEntryFile, "export const smoke = true;\n");
      fs.writeFileSync(packageExportFile, "export const productionOnly = ;\n");

      const result = createProgram([testEntryFile], {
        projectRoot,
        sourceRoot,
        rootNamespace: "Acme.JsLike",
        surface: "core",
      });

      expect(result.ok).to.equal(false);
      if (result.ok) return;

      expect(
        result.error.diagnostics.some(
          (diagnostic) =>
            path.resolve(diagnostic.location?.file ?? "") ===
            path.resolve(packageExportFile)
        )
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });
});
