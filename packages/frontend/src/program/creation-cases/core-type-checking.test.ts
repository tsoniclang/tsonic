/**
 * Tests for core type checking in noLib mode: string index access,
 * IArguments.length, and IArguments index access
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { createProgram } from "../creation.js";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";

describe("Program Creation – core type checking", function () {
  this.timeout(90_000);

  it("should provide string index access from installed core globals", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/core-type-checking/string-index-access"
    );

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
    } finally {
      fixture.cleanup();
    }
  });

  it("should typecheck core IArguments.length in noLib mode", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/core-type-checking/arguments-length"
    );

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
    } finally {
      fixture.cleanup();
    }
  });

  it("should typecheck core IArguments index access in noLib mode", () => {
    const fixture = materializeFrontendFixture(
      "program/creation/core-type-checking/arguments-index-access"
    );

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
    } finally {
      fixture.cleanup();
    }
  });
});
