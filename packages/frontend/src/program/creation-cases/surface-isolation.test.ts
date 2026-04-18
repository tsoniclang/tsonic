/**
 * Tests for surface isolation: CLR vs JS surface member visibility,
 * Array.from/RangeError exposure, array mutators, and CLR string members
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../../ir/builder.js";
import { createProgramContext } from "../../ir/program-context-factory.js";
import { validateIrSoundness } from "../../ir/validation/index.js";
import { createProgram } from "../creation.js";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";

describe("Program Creation – surface isolation", function () {
  this.timeout(90_000);

  it("should allow mutable array index writes in clr surface mode", () => {
    const fixture = materializeFrontendFixture([
      "fragments/surface-isolation/custom-clr-surface",
      "program/creation/surface-isolation/clr-array-write",
    ]);

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
      });

      expect(result.ok).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("should keep JS surface free of CLR string members", () => {
    const fixture = materializeFrontendFixture([
      "fragments/surface-isolation/custom-js-surface",
      "program/creation/surface-isolation/js-no-clr-members",
    ]);

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const sourceFile = result.value.sourceFiles.find(
        (candidate) => candidate.fileName === entryPath
      );
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const ctx = createProgramContext(result.value, {
        sourceRoot: srcDir,
        rootNamespace: "Test",
      });
      const moduleResult = buildIrModule(
        sourceFile,
        result.value,
        {
          sourceRoot: srcDir,
          rootNamespace: "Test",
        },
        ctx
      );

      expect(moduleResult.ok).to.equal(true);
      if (!moduleResult.ok) return;
      const soundness = validateIrSoundness([moduleResult.value]);
      expect(soundness.ok).to.equal(false);
      expect(
        soundness.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "TSN5203" && diagnostic.message.includes("Trim")
        )
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("should expose Array.from and RangeError on js surface", () => {
    const fixture = materializeFrontendFixture([
      "fragments/surface-isolation/custom-js-surface",
      "program/creation/surface-isolation/js-array-from-rangeerror",
    ]);

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("should expose js array mutators and numeric instance helpers on js surface", () => {
    const fixture = materializeFrontendFixture([
      "fragments/surface-isolation/custom-js-surface",
      "program/creation/surface-isolation/js-array-number-helpers",
    ]);

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("should keep RangeError out of clr surface", () => {
    const fixture = materializeFrontendFixture([
      "fragments/surface-isolation/custom-clr-surface",
      "program/creation/surface-isolation/clr-no-rangeerror",
    ]);

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "clr",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const sourceFile = result.value.sourceFiles.find(
        (candidate) => candidate.fileName === entryPath
      );
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const ctx = createProgramContext(result.value, {
        sourceRoot: srcDir,
        rootNamespace: "Test",
      });
      const moduleResult = buildIrModule(
        sourceFile,
        result.value,
        {
          sourceRoot: srcDir,
          rootNamespace: "Test",
        },
        ctx
      );

      expect(moduleResult.ok).to.equal(true);
      if (!moduleResult.ok) return;
      const soundness = validateIrSoundness([moduleResult.value]);
      expect(soundness.ok).to.equal(false);
      expect(
        soundness.diagnostics.some((diagnostic) =>
          diagnostic.message.includes("RangeError")
        )
      ).to.equal(true);

      const errorEntryPath = fixture.path("app/src/error.ts");
      const okResult = createProgram([errorEntryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "clr",
      });

      expect(okResult.ok).to.equal(true);
      if (!okResult.ok) return;
      expect(okResult.value.bindings.getBinding("Error")?.type).to.equal(
        "System.Exception"
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("should expose CLR string members on clr surface via @tsonic/globals", () => {
    const fixture = materializeFrontendFixture([
      "fragments/surface-isolation/custom-clr-surface",
      "program/creation/surface-isolation/clr-string-members",
    ]);

    try {
      const projectRoot = fixture.path("app");
      const srcDir = fixture.path("app/src");
      const entryPath = fixture.path("app/src/index.ts");

      const result = createProgram([entryPath], {
        projectRoot,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        surface: "clr",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(
        result.value.declarationSourceFiles.some((sourceFile) =>
          sourceFile.fileName.endsWith("__clr_globals__.d.ts")
        )
      ).to.equal(false);
      expect(
        result.value.declarationSourceFiles.some(
          (sourceFile) =>
            sourceFile.fileName.includes("@tsonic/globals") ||
            /[/\\]globals[/\\]versions[/\\]\d+[/\\]index\.d\.ts$/.test(
              sourceFile.fileName
            )
        )
      ).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });
});
