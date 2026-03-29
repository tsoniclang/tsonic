import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TsonicWorkspaceConfig } from "../../types.js";
import {
  baseWorkspaceConfig,
  buildTestTimeoutMs,
  mergeManifestIntoWorkspaceConfig,
  resolveInstalledPackageBindingsManifest,
  type NormalizedBindingsManifest,
  writeInstalledPackage,
} from "./helpers.js";

describe("tsonic.package bindings", function () {
  this.timeout(buildTestTimeoutMs);

  it("suppresses manifest package references when a local dll satisfies the same assembly", () => {
    const manifest: NormalizedBindingsManifest = {
      bindingVersion: 1,
      sourceManifest: "tsonic-bindings",
      packageName: "@acme/node",
      packageVersion: "10.0.0",
      surfaceMode: "@tsonic/js",
      requiredTypeRoots: ["node_modules/@acme/node"],
      runtimePackages: ["@acme/node"],
      nugetDependencies: [],
      assemblyName: "Acme.Node",
      dotnet: {
        packageReferences: [{ id: "Acme.Node", version: "1.0.1" }],
      },
    };

    const merged = mergeManifestIntoWorkspaceConfig(
      {
        ...baseWorkspaceConfig(),
        dotnet: {
          libraries: ["libs/Acme.Node.dll"],
          frameworkReferences: [],
          packageReferences: [],
        },
      },
      manifest,
      "TSN8A03"
    );

    expect(merged.ok).to.equal(true);
    if (!merged.ok) return;
    expect(merged.value.dotnet?.typeRoots).to.deep.equal([
      "node_modules/@acme/node",
    ]);
    expect(merged.value.dotnet?.packageReferences).to.deep.equal([]);
  });

  it("keeps manifest package references when no local dll satisfies the assembly", () => {
    const manifest: NormalizedBindingsManifest = {
      bindingVersion: 1,
      sourceManifest: "tsonic-bindings",
      packageName: "@tsonic/js",
      packageVersion: "10.0.0",
      surfaceMode: "@tsonic/js",
      requiredTypeRoots: ["node_modules/@tsonic/js"],
      runtimePackages: ["@tsonic/js"],
      nugetDependencies: [],
      assemblyName: "js",
      dotnet: {
        packageReferences: [{ id: "js", version: "0.0.4" }],
      },
    };

    const merged = mergeManifestIntoWorkspaceConfig(
      {
        ...baseWorkspaceConfig(),
        dotnet: {
          libraries: ["libs/other.dll"],
          frameworkReferences: [],
          packageReferences: [],
        },
      },
      manifest,
      "TSN8A03"
    );

    expect(merged.ok).to.equal(true);
    if (!merged.ok) return;
    expect(merged.value.dotnet?.packageReferences).to.deep.equal([
      { id: "js", version: "0.0.4" },
    ]);
  });

  it("rejects requiredTypeRoots that escape the package root", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-package-manifest-type-root-escape-")
    );
    try {
      const pkgRoot = writeInstalledPackage(dir, "@acme/node", "1.0.0", {
        bindingsManifest: {
          bindingVersion: 1,
          requiredTypeRoots: ["../outside"],
          dotnet: {
            packageReferences: [{ id: "Acme.Node.Runtime", version: "1.0.0" }],
          },
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/^TSN8A01:/);
      expect(result.ok ? "" : result.error).to.include("requiredTypeRoots");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects absolute requiredTypeRoots", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-package-manifest-type-root-abs-")
    );
    try {
      const pkgRoot = writeInstalledPackage(dir, "@acme/node", "1.0.0", {
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-source-package",
          surfaces: ["@tsonic/js"],
          runtime: {
            nugetPackages: [{ id: "Acme.Node.Runtime", version: "1.0.0" }],
          },
          source: {
            exports: {
              ".": "./src/index.ts",
            },
          },
          requiredTypeRoots: ["/absolute/root"],
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/^TSN8A01:/);
      expect(result.ok ? "" : result.error).to.include("requiredTypeRoots");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails overlay with TSN8A03 on conflicting runtime package versions", () => {
    const config = baseWorkspaceConfig();
    const manifest: NormalizedBindingsManifest = {
      bindingVersion: 1,
      sourceManifest: "tsonic-package",
      packageName: "acme-conflict",
      packageVersion: "1.0.0",
      surfaceMode: "clr",
      requiredTypeRoots: [],
      runtimePackages: ["acme-conflict"],
      nugetDependencies: [],
      dotnet: {
        packageReferences: [{ id: "Acme.Core", version: "2.0.0" }],
      },
    };

    const seeded: TsonicWorkspaceConfig = {
      ...config,
      dotnet: {
        packageReferences: [{ id: "Acme.Core", version: "1.0.0" }],
      },
    };

    const merged = mergeManifestIntoWorkspaceConfig(
      seeded,
      manifest,
      "TSN8A03"
    );
    expect(merged.ok).to.equal(false);
    expect(merged.ok ? "" : merged.error).to.match(/^TSN8A03:/);
  });
});
