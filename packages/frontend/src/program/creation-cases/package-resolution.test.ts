/**
 * Tests for package resolution: installed subpath exports, tsconfig declarations,
 * and project-local @tsonic imports
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import { createProgram } from "../creation.js";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";

describe("Program Creation – package resolution", function () {
  this.timeout(90_000);

  it("should prefer installed @tsonic source-package subpath exports over sibling compiler packages", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/package-resolution/installed-source-subpath"
    );

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const nodejsRoot = fixture.path("app/node_modules/@tsonic/nodejs");
      const authoritativeJsRoot = fixture.path("type-roots/@tsonic/js");
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [authoritativeJsRoot, nodejsRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        result.value.program
          .getSourceFiles()
          .some(
            (sourceFile) =>
              path.resolve(sourceFile.fileName) ===
              path.resolve(path.join(nodejsRoot, "src", "path-module.ts"))
          )
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("should resolve symlinked source-package files through their real paths during program creation", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/package-resolution/symlinked-source-package"
    );

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const authoritativeJsRoot = fixture.path("type-roots/@tsonic/js");
      const nodejsRoot = fixture.path("app/node_modules/@tsonic/nodejs");
      const entryPath = fixture.path("app/src/index.ts");
      const externalRoot = fixture.path("external/@tsonic/nodejs");

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
        typeRoots: [authoritativeJsRoot, nodejsRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        result.value.program
          .getSourceFiles()
          .filter((sourceFile) => {
            try {
              return (
                fs.realpathSync(sourceFile.fileName) ===
                fs.realpathSync(path.join(externalRoot, "src", "path-module.ts"))
              );
            } catch {
              return false;
            }
          })
      ).to.have.lengthOf(1);
    } finally {
      fixture.cleanup();
    }
  });

  it("should include tsconfig declaration roots for local module augmentation", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/package-resolution/tsconfig-local-augmentation"
    );

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "clr",
      });

      expect(result.ok).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("should resolve project-local @tsonic/* imports when no authoritative package exists", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/package-resolution/project-local-custom-import"
    );

    try {
      const tempDir = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const fakePkgRoot = fixture.path("app/node_modules/@tsonic/custom");
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "clr",
        typeRoots: [],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const expectedDts = path.resolve(path.join(fakePkgRoot, "System.d.ts"));
      expect(result.value.program.getSourceFile(expectedDts)).to.not.equal(
        undefined
      );
    } finally {
      fixture.cleanup();
    }
  });
});
