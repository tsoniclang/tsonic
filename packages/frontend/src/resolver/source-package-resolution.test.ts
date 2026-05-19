import { describe, it } from "mocha";
import { expect } from "chai";
import { readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import {
  getLocalResolutionBoundary,
  isPathWithinBoundary,
  resolveSourcePackageAliasTarget,
  resolveSourcePackageImport,
  resolveSourcePackageImportFromPackageRoot,
} from "./source-package-resolution.js";
import { materializeFrontendFixture } from "../testing/filesystem-fixtures.js";

describe("Source Package Resolution", () => {
  it("should resolve installed source packages without relying on package.json exports", () => {
    const fixture = materializeFrontendFixture(
      "resolver/source-package-resolution/installed-source-package"
    );

    try {
      const tempDir = fixture.path("app");
      const entryPath = fixture.path("app/src/index.ts");
      const packageRoot = fixture.path("app/node_modules/@acme/math");

      const result = resolveSourcePackageImport(
        "@acme/math",
        entryPath,
        "@tsonic/js",
        tempDir
      );

      expect(result.ok).to.equal(true);
      if (!result.ok || !result.value) return;

      expect(result.value.packageRoot).to.equal(packageRoot);
      expect(result.value.resolvedPath).to.equal(
        path.join(packageRoot, "src", "index.ts")
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("should use the source package root as the local resolution boundary", () => {
    const fixture = materializeFrontendFixture(
      "resolver/source-package-resolution/installed-source-package"
    );

    try {
      const sourceRoot = fixture.path("app/src");
      const packageRoot = fixture.path("app/node_modules/@acme/math");
      const packageEntry = fixture.path(
        "app/node_modules/@acme/math/src/index.ts"
      );

      expect(getLocalResolutionBoundary(packageEntry, sourceRoot)).to.equal(
        packageRoot
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("should use path-segment containment instead of string-prefix containment", () => {
    const root = path.join("/tmp", "project", "src");
    const sibling = path.join("/tmp", "project", "src-private", "index.ts");

    expect(isPathWithinBoundary(path.join(root, "index.ts"), root)).to.equal(
      true
    );
    expect(isPathWithinBoundary(sibling, root)).to.equal(false);
  });

  it("should reject builtin-style specifiers as source package imports", () => {
    const fixture = materializeFrontendFixture(
      "resolver/source-package-resolution/builtin-source-package"
    );

    try {
      const tempDir = fixture.path("app");
      const packageRoot = fixture.path("app/node_modules/@tsonic/nodejs");

      const result = resolveSourcePackageImportFromPackageRoot(
        "node:http",
        packageRoot,
        "@tsonic/js",
        tempDir
      );

      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(result.value).to.equal(null);
    } finally {
      fixture.cleanup();
    }
  });

  it("should reject source packages that do not support the active backend target", () => {
    const fixture = materializeFrontendFixture(
      "resolver/source-package-resolution/installed-source-package"
    );

    try {
      const tempDir = fixture.path("app");
      const entryPath = fixture.path("app/src/index.ts");
      const packageRoot = fixture.path("app/node_modules/@acme/math");
      const manifestPath = path.join(packageRoot, "tsonic.package.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
        supportedTargets?: readonly string[];
      };
      writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            ...manifest,
            supportedTargets: ["rust"],
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const result = resolveSourcePackageImport(
        "@acme/math",
        entryPath,
        "@tsonic/js",
        tempDir,
        "csharp"
      );

      expect(result.ok).to.equal(false);
      if (result.ok) return;
      expect(result.error.message).to.include(
        "does not support target 'csharp'"
      );
      expect(result.error.hint).to.equal("Supported targets: rust");
    } finally {
      fixture.cleanup();
    }
  });

  it("should reject source package alias targets that do not support the active backend target", () => {
    const fixture = materializeFrontendFixture(
      "resolver/source-package-resolution/installed-source-package"
    );

    try {
      const tempDir = fixture.path("app");
      const packageRoot = fixture.path("app/node_modules/@acme/math");
      const manifestPath = path.join(packageRoot, "tsonic.package.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
        source: Record<string, unknown>;
      };
      writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            ...manifest,
            supportedTargets: ["rust"],
            source: {
              ...manifest.source,
              namespace: "Acme.Math",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const result = resolveSourcePackageAliasTarget(
        ".",
        packageRoot,
        "@tsonic/js",
        tempDir,
        "csharp"
      );

      expect(result.ok).to.equal(false);
      if (result.ok) return;
      expect(result.error.message).to.include(
        "does not support target 'csharp'"
      );
      expect(result.error.hint).to.equal("Supported targets: rust");
    } finally {
      fixture.cleanup();
    }
  });
});
