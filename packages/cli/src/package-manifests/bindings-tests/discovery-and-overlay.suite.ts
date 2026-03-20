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
  mergeManifestIntoWorkspaceConfig,
  type NormalizedBindingsManifest,
  writeInstalledPackage,
  writeJson,
} from "./helpers.js";

describe("package-manifest bindings", function () {
  this.timeout(buildTestTimeoutMs);

  it("discovers workspace manifests from dependencies and devDependencies", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-package-manifest-discover-")
    );
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
          "@acme/package-manifest-lib": "1.0.0",
          "legacy-types": "1.0.0",
        },
      });

      writeInstalledPackage(dir, "app-no-bindings", "1.0.0");
      writeInstalledPackage(dir, "@acme/package-manifest-lib", "1.0.0", {
        bindingsRoot: "tsonic/bindings",
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "@acme/package-manifest-lib",
          npmVersion: "1.0.0",
          runtime: {
            nugetPackages: [{ id: "Acme.PackageManifest", version: "1.0.0" }],
          },
          typing: {
            bindingsRoot: "tsonic/bindings",
          },
        },
      });
      writeInstalledPackage(dir, "legacy-types", "1.0.0", {
        legacyBindings: {
          dotnet: {
            packageReferences: [{ id: "Legacy.Core", version: "1.0.0" }],
          },
        },
      });

      const manifests = discoverWorkspaceBindingsManifests(dir);
      expect(manifests.ok).to.equal(true);
      const values = manifests.ok ? manifests.value : [];
      expect(values.map((x) => x.packageName)).to.deep.equal([
        "@acme/package-manifest-lib",
        "legacy-types",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("discovers transitive manifests through installed dependency graph", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-package-manifest-discover-transitive-")
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
        bindingsRoot: "tsonic/bindings",
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "acme-child",
          npmVersion: "1.0.0",
          runtime: {
            nugetPackages: [{ id: "Acme.Child.Runtime", version: "1.0.0" }],
          },
          typing: {
            bindingsRoot: "tsonic/bindings",
          },
        },
      });

      const manifests = discoverWorkspaceBindingsManifests(dir);
      expect(manifests.ok).to.equal(true);
      const values = manifests.ok ? manifests.value : [];
      expect(values.map((x) => x.packageName)).to.deep.equal(["acme-child"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies workspace overlay and merges package references", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-manifest-overlay-"));
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
        legacyBindings: {
          dotnet: {
            packageReferences: [{ id: "Acme.Core", version: "1.0.0" }],
          },
        },
      });
      writeInstalledPackage(dir, "acme-b", "1.0.0", {
        bindingsRoot: "tsonic/bindings",
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "acme-b",
          npmVersion: "1.0.0",
          runtime: {
            nugetPackages: [{ id: "Acme.Http", version: "2.0.0" }],
          },
          typing: {
            bindingsRoot: "tsonic/bindings",
          },
        },
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
      expect(result.ok ? result.value.manifests.length : 0).to.equal(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("discovers installed custom surface chains even when not listed in workspace package.json", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-package-manifest-surface-chain-")
    );
    try {
      writeJson(join(dir, "package.json"), {
        name: "workspace",
        private: true,
        type: "module",
      });

      writeInstalledPackage(dir, "@tsonic/js", "10.0.0", {
        surfaceManifest: {
          schemaVersion: 1,
          id: "@tsonic/js",
          extends: [],
          requiredTypeRoots: ["."],
        },
        bindingsRoot: "tsonic/bindings",
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "@tsonic/js",
          npmVersion: "10.0.0",
          runtime: {
            nugetPackages: [{ id: "Tsonic.JSRuntime", version: "10.0.0" }],
          },
          typing: {
            bindingsRoot: "tsonic/bindings",
          },
        },
      });

      writeInstalledPackage(dir, "@acme/surface-node", "10.0.0", {
        surfaceManifest: {
          schemaVersion: 1,
          id: "@acme/surface-node",
          extends: ["@tsonic/js"],
          requiredTypeRoots: ["."],
        },
        bindingsRoot: "tsonic/bindings",
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "@acme/surface-node",
          npmVersion: "10.0.0",
          runtime: {
            nugetPackages: [{ id: "Acme.Surface.Node", version: "10.0.0" }],
            frameworkReferences: ["Microsoft.AspNetCore.App"],
          },
          typing: {
            bindingsRoot: "tsonic/bindings",
          },
        },
      });

      const manifests = discoverWorkspaceBindingsManifests(
        dir,
        "@acme/surface-node"
      );
      expect(manifests.ok).to.equal(true);
      const values = manifests.ok ? manifests.value : [];
      expect(values.map((x) => x.packageName)).to.deep.equal([
        "@acme/surface-node",
        "@tsonic/js",
      ]);

      const result = applyPackageManifestWorkspaceOverlay(dir, {
        ...baseWorkspaceConfig(),
        surface: "@acme/surface-node",
      });
      expect(result.ok).to.equal(true);
      const cfg = result.ok ? result.value.config : baseWorkspaceConfig();
      expect(cfg.dotnet?.frameworkReferences).to.deep.equal([
        "Microsoft.AspNetCore.App",
      ]);
      expect(cfg.dotnet?.packageReferences).to.deep.equal([
        { id: "Acme.Surface.Node", version: "10.0.0" },
        { id: "Tsonic.JSRuntime", version: "10.0.0" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("merges requiredTypeRoots from regular package manifests into workspace overlay", () => {
    const manifest: NormalizedBindingsManifest = {
      bindingVersion: 1,
      sourceManifest: "legacy",
      packageName: "@tsonic/nodejs",
      packageVersion: "10.0.0",
      surfaceMode: "clr",
      requiredTypeRoots: [
        "node_modules/@tsonic/nodejs",
        "node_modules/@tsonic/nodejs/types",
      ],
      runtimePackages: ["@tsonic/nodejs"],
      nugetDependencies: [],
      dotnet: {
        packageReferences: [{ id: "Tsonic.Nodejs", version: "10.0.0" }],
      },
    };

    const merged = mergeManifestIntoWorkspaceConfig(
      baseWorkspaceConfig(),
      manifest,
      "TSN8A03"
    );
    expect(merged.ok).to.equal(true);
    if (!merged.ok) return;
    expect(merged.value.dotnet?.typeRoots).to.deep.equal([
      "node_modules/@tsonic/nodejs",
      "node_modules/@tsonic/nodejs/types",
    ]);
    expect(merged.value.dotnet?.packageReferences).to.deep.equal([
      { id: "Tsonic.Nodejs", version: "10.0.0" },
    ]);
  });
});
