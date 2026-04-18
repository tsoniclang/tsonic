import { expect } from "chai";
import { resolveDependencyPackageRoot } from "./package-roots.js";
import { materializeFrontendFixture } from "../testing/filesystem-fixtures.js";

describe("resolveDependencyPackageRoot", () => {
  it("prefers sibling workspace versioned packages over unrelated installed ancestors", () => {
    const fixture = materializeFrontendFixture(
      "program/package-roots/sibling-workspace-preferred"
    );

    try {
      const globalsRoot = fixture.path("workspace/globals/versions/10");
      const dotnetSiblingRoot = fixture.path("workspace/dotnet/versions/10");

      expect(
        resolveDependencyPackageRoot(globalsRoot, "@tsonic/dotnet")
      ).to.equal(dotnetSiblingRoot);
    } finally {
      fixture.cleanup();
    }
  });

  it("falls back to installed package roots when no sibling workspace package exists", () => {
    const fixture = materializeFrontendFixture(
      "program/package-roots/installed-fallback"
    );

    try {
      const packageRoot = fixture.path("app/node_modules/@tsonic/globals");
      const installedDotnetRoot = fixture.path(
        "app/node_modules/@tsonic/dotnet"
      );

      expect(
        resolveDependencyPackageRoot(packageRoot, "@tsonic/dotnet")
      ).to.equal(installedDotnetRoot);
    } finally {
      fixture.cleanup();
    }
  });

  it("can prefer installed package roots over sibling workspace packages when requested", () => {
    const fixture = materializeFrontendFixture(
      "program/package-roots/installed-first-preferred"
    );

    try {
      const globalsRoot = fixture.path("workspace/globals/versions/10");
      const installedDotnetRoot = fixture.path(
        "workspace/globals/versions/10/node_modules/@tsonic/dotnet"
      );

      expect(
        resolveDependencyPackageRoot(
          globalsRoot,
          "@tsonic/dotnet",
          "installed-first"
        )
      ).to.equal(installedDotnetRoot);
    } finally {
      fixture.cleanup();
    }
  });

  it("resolves installed export-mapped packages from project directories without package.json", () => {
    const fixture = materializeFrontendFixture(
      "program/package-roots/workspace-project-installed-export-mapped"
    );

    try {
      const projectRoot = fixture.path("workspace/packages/app");
      const installedNodejsRoot = fixture.path(
        "workspace/node_modules/@tsonic/nodejs"
      );

      expect(
        resolveDependencyPackageRoot(
          projectRoot,
          "@tsonic/nodejs",
          "installed-first"
        )
      ).to.equal(installedNodejsRoot);
    } finally {
      fixture.cleanup();
    }
  });

  it("preserves symlinked installed package roots for installed-first resolution", () => {
    const fixture = materializeFrontendFixture(
      "program/package-roots/symlinked-installed-first"
    );

    try {
      const projectRoot = fixture.path("workspace/apps/proof");
      const linkedNodejsRoot = fixture.path(
        "workspace/apps/proof/node_modules/@tsonic/nodejs"
      );

      expect(
        resolveDependencyPackageRoot(
          projectRoot,
          "@tsonic/nodejs",
          "installed-first"
        )
      ).to.equal(linkedNodejsRoot);
    } finally {
      fixture.cleanup();
    }
  });

  it("resolves sibling workspace packages from symlinked source-package roots", () => {
    const fixture = materializeFrontendFixture(
      "program/package-roots/symlinked-wave-siblings"
    );

    try {
      const installedNodejsRoot = fixture.path(
        "consumer/node_modules/@tsonic/nodejs"
      );
      const jsSiblingRoot = fixture.path("workspace/js-next/versions/10");

      expect(
        resolveDependencyPackageRoot(installedNodejsRoot, "@tsonic/js")
      ).to.equal(jsSiblingRoot);
    } finally {
      fixture.cleanup();
    }
  });

  it("does not treat builtin specifiers as installed package roots", () => {
    const fixture = materializeFrontendFixture(
      "program/package-roots/builtin-specifiers"
    );

    const originalCwd = process.cwd();

    try {
      const projectRoot = fixture.path("workspace/packages/app");

      process.chdir(projectRoot);

      expect(
        resolveDependencyPackageRoot(
          projectRoot,
          "node:http",
          "installed-first"
        )
      ).to.equal(undefined);
      expect(
        resolveDependencyPackageRoot(
          projectRoot,
          "node:path",
          "installed-first"
        )
      ).to.equal(undefined);
      expect(
        resolveDependencyPackageRoot(projectRoot, "node:fs", "installed-first")
      ).to.equal(undefined);
    } finally {
      process.chdir(originalCwd);
      fixture.cleanup();
    }
  });

  it("prefers sibling source packages over CLR siblings with the same package name", () => {
    const fixture = materializeFrontendFixture(
      "program/package-roots/source-package-preference"
    );

    try {
      const nodejsRoot = fixture.path("workspace/nodejs-next/versions/10");
      const jsSourceRoot = fixture.path("workspace/js-next/versions/10");

      expect(resolveDependencyPackageRoot(nodejsRoot, "@tsonic/js")).to.equal(
        jsSourceRoot
      );
    } finally {
      fixture.cleanup();
    }
  });
});
