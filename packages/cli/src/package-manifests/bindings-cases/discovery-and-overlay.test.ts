import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyPackageManifestWorkspaceOverlay,
  baseWorkspaceConfig,
  buildTestTimeoutMs,
  discoverWorkspaceBindingsManifests,
  installClrSurfacePackages,
  writeInstalledPackage,
  writeJson,
} from "./helpers.js";

const createSourcePackageManifest = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  schemaVersion: 1,
  kind: "tsonic-source-package",
  surfaces: ["@tsonic/js"],
  source: {
    namespace: "Acme.Package",
    exports: {
      ".": "./src/index.ts",
    },
  },
  ...overrides,
});

describe("tsonic.package bindings", function () {
  this.timeout(buildTestTimeoutMs);

  it("discovers workspace manifests from dependencies and devDependencies", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-discover-"));
    try {
      installClrSurfacePackages(dir);
      writeJson(join(dir, "package.json"), {
        name: "workspace",
        private: true,
        type: "module",
        dependencies: {
          "app-no-bindings": "1.0.0",
        },
        devDependencies: {
          "@acme/package-lib": "1.0.0",
          "bindings-types": "1.0.0",
        },
      });

      writeInstalledPackage(dir, "app-no-bindings", "1.0.0");
      writeInstalledPackage(dir, "@acme/package-lib", "1.0.0", {
        packageManifest: createSourcePackageManifest({
          runtime: {
            nugetPackages: [{ id: "Acme.Package", version: "1.0.0" }],
          },
        }),
      });
      writeInstalledPackage(dir, "bindings-types", "1.0.0", {
        bindingsManifest: {
          dotnet: {
            packageReferences: [{ id: "Bindings.Core", version: "1.0.0" }],
          },
        },
      });

      const manifests = discoverWorkspaceBindingsManifests(dir);
      expect(manifests.ok).to.equal(true);
      expect(
        (manifests.ok ? manifests.value : []).map((x) => x.packageName)
      ).to.deep.equal(["@acme/package-lib", "bindings-types"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("discovers transitive manifests through installed dependency graph", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-package-discover-transitive-")
    );
    try {
      installClrSurfacePackages(dir);
      writeJson(join(dir, "package.json"), {
        name: "workspace",
        private: true,
        type: "module",
        dependencies: {
          "acme-parent": "1.0.0",
        },
      });

      writeInstalledPackage(dir, "acme-parent", "1.0.0", {
        dependencies: {
          "acme-child": "1.0.0",
        },
      });
      writeInstalledPackage(dir, "acme-child", "1.0.0", {
        packageManifest: createSourcePackageManifest({
          runtime: {
            nugetPackages: [{ id: "Acme.Child.Runtime", version: "1.0.0" }],
          },
        }),
      });

      const manifests = discoverWorkspaceBindingsManifests(dir);
      expect(manifests.ok).to.equal(true);
      expect(
        (manifests.ok ? manifests.value : []).map((x) => x.packageName)
      ).to.deep.equal(["acme-child"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prefers root manifests over transitive nested packages with the same name", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-root-preference-"));
    try {
      installClrSurfacePackages(dir);
      writeJson(join(dir, "package.json"), {
        name: "workspace",
        private: true,
        type: "module",
        dependencies: {
          "@tsonic/js": "10.0.9",
          "@tsonic/nodejs": "10.0.9",
        },
      });

      writeInstalledPackage(dir, "@tsonic/js", "10.0.9", {
        packageManifest: createSourcePackageManifest({
          runtime: {
            nugetPackages: [{ id: "Acme.Js.Runtime", version: "0.0.9" }],
          },
        }),
      });

      const nodejsRoot = writeInstalledPackage(
        dir,
        "@tsonic/nodejs",
        "10.0.9",
        {
          dependencies: {
            "@tsonic/js": "10.0.4",
          },
          packageManifest: createSourcePackageManifest({
            runtime: {
              nugetPackages: [{ id: "Acme.Node.Runtime", version: "10.0.9" }],
            },
          }),
        }
      );

      writeInstalledPackage(nodejsRoot, "@tsonic/js", "10.0.4", {
        packageManifest: createSourcePackageManifest({
          runtime: {
            nugetPackages: [{ id: "Acme.Js.Runtime", version: "0.0.4" }],
          },
        }),
      });

      const manifests = discoverWorkspaceBindingsManifests(dir);
      expect(manifests.ok).to.equal(true);
      if (!manifests.ok) return;

      expect(
        manifests.value.map((manifest) => [
          manifest.packageName,
          manifest.packageVersion,
        ])
      ).to.deep.equal([
        ["@tsonic/js", "10.0.9"],
        ["@tsonic/nodejs", "10.0.9"],
      ]);

      const overlay = applyPackageManifestWorkspaceOverlay(
        dir,
        baseWorkspaceConfig()
      );
      expect(overlay.ok).to.equal(true);
      if (!overlay.ok) return;
      expect(overlay.value.config.dotnet?.packageReferences).to.deep.equal([
        { id: "Acme.Js.Runtime", version: "0.0.9" },
        { id: "Acme.Node.Runtime", version: "10.0.9" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies workspace overlay and merges runtime package references", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-overlay-"));
    try {
      installClrSurfacePackages(dir);
      writeJson(join(dir, "package.json"), {
        name: "workspace",
        private: true,
        devDependencies: {
          "acme-a": "1.0.0",
          "acme-b": "1.0.0",
        },
      });

      writeInstalledPackage(dir, "acme-a", "1.0.0", {
        bindingsManifest: {
          dotnet: {
            packageReferences: [{ id: "Acme.Core", version: "1.0.0" }],
          },
        },
      });
      writeInstalledPackage(dir, "acme-b", "1.0.0", {
        packageManifest: createSourcePackageManifest({
          runtime: {
            nugetPackages: [{ id: "Acme.Http", version: "2.0.0" }],
          },
        }),
      });

      const result = applyPackageManifestWorkspaceOverlay(
        dir,
        baseWorkspaceConfig()
      );
      expect(result.ok).to.equal(true);
      const cfg = result.ok ? result.value.config : baseWorkspaceConfig();
      expect(cfg.dotnet?.packageReferences).to.deep.equal([
        { id: "Acme.Core", version: "1.0.0" },
        { id: "Acme.Http", version: "2.0.0" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("discovers installed custom surface runtime packages without fabricating missing parent surfaces", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-surface-chain-"));
    try {
      writeJson(join(dir, "package.json"), {
        name: "workspace",
        private: true,
        type: "module",
      });

      writeInstalledPackage(dir, "@acme/custom-surface", "1.0.0", {
        surfaceManifest: {
          schemaVersion: 1,
          id: "@acme/custom-surface",
          extends: ["@tsonic/js"],
          requiredNpmPackages: ["acme-runtime"],
        },
      });
      writeInstalledPackage(dir, "acme-runtime", "1.0.0", {
        packageManifest: createSourcePackageManifest({
          runtime: {
            nugetPackages: [{ id: "Acme.Runtime", version: "1.0.0" }],
          },
        }),
      });

      const manifests = discoverWorkspaceBindingsManifests(
        dir,
        "@acme/custom-surface"
      );
      expect(manifests.ok).to.equal(true);
      expect(
        (manifests.ok ? manifests.value : []).map((x) => x.packageName)
      ).to.deep.equal(["acme-runtime"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("merges requiredTypeRoots from tsonic.bindings.json into workspace overlay", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-bindings-roots-"));
    try {
      installClrSurfacePackages(dir);
      writeJson(join(dir, "package.json"), {
        name: "workspace",
        private: true,
        type: "module",
        dependencies: {
          "bindings-types": "1.0.0",
        },
      });

      writeInstalledPackage(dir, "bindings-types", "1.0.0", {
        bindingsManifest: {
          bindingVersion: 1,
          requiredTypeRoots: ["."],
          dotnet: {
            packageReferences: [{ id: "Bindings.Core", version: "1.0.0" }],
          },
        },
      });

      const result = applyPackageManifestWorkspaceOverlay(
        dir,
        baseWorkspaceConfig()
      );
      expect(result.ok).to.equal(true);
      const cfg = result.ok ? result.value.config : baseWorkspaceConfig();
      expect(cfg.dotnet?.typeRoots).to.deep.equal([
        "node_modules/bindings-types",
      ]);
      expect(cfg.dotnet?.packageReferences).to.deep.equal([
        { id: "Bindings.Core", version: "1.0.0" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not merge requiredTypeRoots from the active surface package", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-surface-roots-"));
    try {
      writeJson(join(dir, "package.json"), {
        name: "workspace",
        private: true,
        type: "module",
        dependencies: {
          "@tsonic/js": "10.0.9",
          "@tsonic/nodejs": "10.0.9",
        },
      });

      writeInstalledPackage(dir, "@tsonic/js", "10.0.9", {
        surfaceManifest: {
          schemaVersion: 1,
          id: "@tsonic/js",
          extends: [],
          requiredTypeRoots: ["."],
        },
        packageManifest: createSourcePackageManifest({
          requiredTypeRoots: ["."],
          dotnet: {
            packageReferences: [{ id: "Acme.Js.Runtime", version: "0.0.9" }],
          },
        }),
      });

      writeInstalledPackage(dir, "@tsonic/nodejs", "10.0.9", {
        packageManifest: createSourcePackageManifest({
          requiredTypeRoots: ["."],
          dotnet: {
            packageReferences: [{ id: "Acme.Node.Runtime", version: "10.0.9" }],
          },
        }),
      });

      const result = applyPackageManifestWorkspaceOverlay(dir, {
        ...baseWorkspaceConfig(),
        surface: "@tsonic/js",
        dotnet: {
          frameworkReferences: [],
          packageReferences: [],
          typeRoots: ["node_modules/@tsonic/nodejs"],
        },
      });
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value.config.dotnet?.typeRoots).to.deep.equal([
        "node_modules/@tsonic/nodejs",
      ]);
      expect(result.value.config.dotnet?.packageReferences).to.deep.equal([
        { id: "Acme.Js.Runtime", version: "0.0.9" },
        { id: "Acme.Node.Runtime", version: "10.0.9" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
