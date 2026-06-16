import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import { materializeFrontendFixture } from "../testing/filesystem-fixtures.js";
import { resolveImport } from "./import-resolution.js";

describe("Import Resolution", () => {
  it("rejects malformed active core packages without searching fallback roots", () => {
    const fixture = materializeFrontendFixture(
      "resolver/source-package-resolution/installed-source-package"
    );

    try {
      const projectRoot = fixture.path("app");
      const sourceRoot = fixture.path("app/src");
      const containingFile = fixture.path("app/src/index.ts");
      const coreRoot = fixture.path("app/node_modules/@tsonic/core");
      fs.mkdirSync(sourceRoot, { recursive: true });
      fs.mkdirSync(coreRoot, { recursive: true });
      fs.writeFileSync(containingFile, "export {};\n");
      fs.writeFileSync(
        path.join(coreRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/core", version: "0.0.0", type: "module" },
          null,
          2
        )
      );

      const result = resolveImport(
        "@tsonic/core/types.js",
        containingFile,
        sourceRoot,
        {
          projectRoot,
          authoritativeTsonicPackageRoots: new Map(),
          declarationModuleAliases: new Map(),
        }
      );

      expect(result.ok).to.equal(false);
      if (result.ok) return;
      expect(result.error.message).to.equal(
        'Active @tsonic/core package is missing required source declaration for "@tsonic/core/types.js".'
      );
      expect(result.error.hint).to.equal(path.join(coreRoot, "types.d.ts"));
    } finally {
      fixture.cleanup();
    }
  });
});
