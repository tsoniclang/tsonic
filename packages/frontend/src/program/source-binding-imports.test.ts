import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "node:path";
import { materializeFrontendFixture } from "../testing/filesystem-fixtures.js";
import { BindingRegistry, loadBindings } from "./bindings.js";
import {
  resolveSourceBindingFiles,
  resolveSourceBackedBindingFiles,
} from "./source-binding-imports.js";

describe("resolveSourceBindingFiles", () => {
  it("prefers authoritative source-package roots over stale installed packages", () => {
    const fixture = materializeFrontendFixture(
      "program/source-binding-imports/authoritative-js-root"
    );

    try {
      const projectRoot = fixture.path("workspace/proof/js");
      const resolverFile = fixture.path("workspace/proof/js/__tsonic_resolver__.ts");
      const authoritativeJsRoot = fixture.path("workspace/js-next/versions/10");

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/js.bindings.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "js",
            type: "js.console",
            sourceImport: "@tsonic/js/console.js",
          },
        },
      });

      const result = resolveSourceBindingFiles(
        bindings,
        ["global"],
        resolverFile,
        projectRoot,
        "@tsonic/js",
        new Map<string, string>([["@tsonic/js", authoritativeJsRoot]])
      );

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value).to.deep.equal([
        path.join(authoritativeJsRoot, "src", "console.ts"),
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  it("includes source-owned type member files for authoritative source packages", () => {
    const fixture = materializeFrontendFixture(
      "program/source-binding-imports/source-backed-binding-files"
    );

    try {
      const projectRoot = fixture.path("app");
      const resolverFile = fixture.path("app/__tsonic_resolver__.ts");
      const surfaceRoot = fixture.path("app/node_modules/@fixture/js");
      const stringPath = fixture.path("app/node_modules/@fixture/js/src/String.ts");
      const timersPath = fixture.path("app/node_modules/@fixture/js/src/timers.ts");

      const bindings = loadBindings([surfaceRoot]);
      const result = resolveSourceBackedBindingFiles(
        bindings,
        resolverFile,
        projectRoot,
        "@fixture/js",
        new Map<string, string>([["@fixture/js", surfaceRoot]])
      );

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value).to.include(stringPath);
      expect(result.value).to.include(timersPath);
    } finally {
      fixture.cleanup();
    }
  });
});
