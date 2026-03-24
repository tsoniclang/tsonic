import { describe, it } from "mocha";
import { expect } from "chai";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTestTimeoutMs,
  resolveInstalledPackageBindingsManifest,
  writeInstalledPackage,
} from "./helpers.js";

describe("package-manifest bindings", function () {
  this.timeout(buildTestTimeoutMs);

  it("returns null when package has no bindings manifests", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-manifest-none-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "no-bindings", "1.0.0");
      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(true);
      expect(result.ok ? result.value : "x").to.equal(null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves legacy tsonic.bindings.json manifest", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-manifest-legacy-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "legacy-bindings", "1.2.3", {
        legacyBindings: {
          bindingVersion: 1,
          packageName: "legacy-bindings",
          packageVersion: "1.2.3",
          dotnet: {
            packageReferences: [{ id: "Acme.Legacy", version: "1.2.3" }],
          },
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(true);
      const manifest = result.ok ? result.value : null;
      expect(manifest).to.not.equal(null);
      expect(manifest?.sourceManifest).to.equal("legacy");
      expect(manifest?.packageName).to.equal("legacy-bindings");
      expect(manifest?.dotnet?.packageReferences).to.deep.equal([
        { id: "Acme.Legacy", version: "1.2.3" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves a package manifest and overlays runtime nuget mapping", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-manifest-v1-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "@acme/node", "2.0.0", {
        bindingsRoot: "tsonic/bindings",
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "@acme/node",
          npmVersion: "2.0.0",
          runtime: {
            nugetPackages: [{ id: "Acme.Node.Runtime", version: "2.0.0" }],
            frameworkReferences: ["Microsoft.AspNetCore.App"],
            runtimePackages: ["@tsonic/dotnet"],
          },
          typing: {
            bindingsRoot: "tsonic/bindings",
          },
          producer: {
            tool: "tsonic",
            version: "0.0.70",
            mode: "tsonic-firstparty",
          },
        },
      });
      expect(existsSync(join(pkgRoot, "tsonic", "bindings"))).to.equal(true);

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(true);
      const manifest = result.ok ? result.value : null;
      expect(manifest).to.not.equal(null);
      expect(manifest?.sourceManifest).to.equal("package-manifest");
      expect(manifest?.producer?.tool).to.equal("tsonic");
      expect(manifest?.runtimePackages).to.deep.equal([
        "@acme/node",
        "@tsonic/dotnet",
      ]);
      expect(manifest?.dotnet?.frameworkReferences).to.deep.equal([
        "Microsoft.AspNetCore.App",
      ]);
      expect(manifest?.dotnet?.packageReferences).to.deep.equal([
        { id: "Acme.Node.Runtime", version: "2.0.0" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves source-package overlays when the manifest declares type roots and runtime metadata", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-package-manifest-source-overlay-")
    );
    try {
      const pkgRoot = writeInstalledPackage(dir, "@acme/node", "2.0.0", {
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-source-package",
          assemblyName: "Acme.Node.Runtime",
          surfaces: ["@tsonic/js"],
          requiredTypeRoots: ["."],
          runtime: {
            frameworkReferences: ["Microsoft.AspNetCore.App"],
            runtimePackages: ["@tsonic/aspnetcore"],
          },
          dotnet: {
            packageReferences: [{ id: "Acme.Node.Runtime", version: "2.0.0" }],
          },
          source: {
            exports: {
              ".": "./src/index.ts",
              "./fs.js": "./src/fs.ts",
            },
          },
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(true);
      const manifest = result.ok ? result.value : null;
      expect(manifest).to.not.equal(null);
      expect(manifest?.sourceManifest).to.equal("package-manifest");
      expect(manifest?.assemblyName).to.equal("Acme.Node.Runtime");
      expect(manifest?.requiredTypeRoots).to.deep.equal([
        "node_modules/@acme/node",
      ]);
      expect(manifest?.runtimePackages).to.deep.equal([
        "@acme/node",
        "@tsonic/aspnetcore",
      ]);
      expect(manifest?.dotnet?.frameworkReferences).to.deep.equal([
        "Microsoft.AspNetCore.App",
      ]);
      expect(manifest?.dotnet?.packageReferences).to.deep.equal([
        { id: "Acme.Node.Runtime", version: "2.0.0" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors with TSN8A01 when producer.tool is invalid", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-package-manifest-producer-tool-")
    );
    try {
      const pkgRoot = writeInstalledPackage(dir, "bad-producer-tool", "1.0.0", {
        bindingsRoot: "tsonic/bindings",
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "bad-producer-tool",
          npmVersion: "1.0.0",
          runtime: {
            nugetPackages: [{ id: "Bad.Runtime", version: "1.0.0" }],
          },
          typing: {
            bindingsRoot: "tsonic/bindings",
          },
          producer: {
            tool: "custom-tool",
            version: "1.0.0",
            mode: "tsonic-firstparty",
          },
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/^TSN8A01:/);
      expect(result.ok ? "" : result.error).to.include("producer.tool");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors with TSN8A01 when producer.mode is invalid", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-package-manifest-producer-mode-")
    );
    try {
      const pkgRoot = writeInstalledPackage(dir, "bad-producer-mode", "1.0.0", {
        bindingsRoot: "tsonic/bindings",
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "bad-producer-mode",
          npmVersion: "1.0.0",
          runtime: {
            nugetPackages: [{ id: "Bad.Runtime", version: "1.0.0" }],
          },
          typing: {
            bindingsRoot: "tsonic/bindings",
          },
          producer: {
            tool: "tsonic",
            version: "1.0.0",
            mode: "invalid-mode",
          },
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/^TSN8A01:/);
      expect(result.ok ? "" : result.error).to.include("producer.mode");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors with TSN8A01 when npmPackage does not match installed package name", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-package-manifest-package-mismatch-")
    );
    try {
      const pkgRoot = writeInstalledPackage(dir, "actual-package", "1.0.0", {
        bindingsRoot: "tsonic/bindings",
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "manifest-package",
          npmVersion: "1.0.0",
          runtime: {
            nugetPackages: [{ id: "Bad.Runtime", version: "1.0.0" }],
          },
          typing: {
            bindingsRoot: "tsonic/bindings",
          },
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/^TSN8A01:/);
      expect(result.ok ? "" : result.error).to.include("npmPackage mismatch");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("collects deterministic nugetDependencies across dotnet and testDotnet sections", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-package-manifest-nuget-deps-")
    );
    try {
      const pkgRoot = writeInstalledPackage(dir, "@acme/deps", "3.1.0", {
        bindingsRoot: "tsonic/bindings",
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "@acme/deps",
          npmVersion: "3.1.0",
          runtime: {
            nugetPackages: [{ id: "Acme.Runtime", version: "3.1.0" }],
            frameworkReferences: ["Microsoft.AspNetCore.App"],
            runtimePackages: ["@tsonic/dotnet"],
          },
          typing: {
            bindingsRoot: "tsonic/bindings",
          },
          dotnet: {
            packageReferences: [{ id: "Acme.Core", version: "1.2.3" }],
          },
          testDotnet: {
            packageReferences: [{ id: "Acme.Testing", version: "9.9.9" }],
          },
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(true);

      const manifest = result.ok ? result.value : null;
      expect(manifest).to.not.equal(null);
      expect(manifest?.dotnet?.packageReferences).to.deep.equal([
        { id: "Acme.Core", version: "1.2.3" },
        { id: "Acme.Runtime", version: "3.1.0" },
      ]);
      expect(manifest?.dotnet?.frameworkReferences).to.deep.equal([
        "Microsoft.AspNetCore.App",
      ]);
      expect(manifest?.testDotnet?.packageReferences).to.deep.equal([
        { id: "Acme.Testing", version: "9.9.9" },
      ]);
      expect(manifest?.runtimePackages).to.deep.equal([
        "@acme/deps",
        "@tsonic/dotnet",
      ]);

      const dependencyKeys = (manifest?.nugetDependencies ?? []).map(
        (dep) => `${dep.source}:${dep.id}@${dep.version ?? ""}`
      );
      expect(dependencyKeys).to.deep.equal([
        "dotnet.framework:Microsoft.AspNetCore.App@",
        "dotnet.package:Acme.Core@1.2.3",
        "dotnet.package:Acme.Runtime@3.1.0",
        "testDotnet.package:Acme.Testing@9.9.9",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors with TSN8A04 when bindingsRoot path does not exist", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-package-manifest-no-bindings-root-")
    );
    try {
      const pkgRoot = writeInstalledPackage(
        dir,
        "bad-package-manifest",
        "1.0.0",
        {
          packageManifest: {
            schemaVersion: 1,
            kind: "tsonic-library",
            npmPackage: "bad-package-manifest",
            npmVersion: "1.0.0",
            runtime: {
              nugetPackages: [{ id: "Bad.Runtime", version: "1.0.0" }],
            },
            typing: {
              bindingsRoot: "tsonic/bindings",
            },
          },
        }
      );

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/^TSN8A04:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors with TSN8A01 on invalid package-manifest schemaVersion", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-manifest-schema-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "bad-schema", "1.0.0", {
        bindingsRoot: "tsonic/bindings",
        packageManifest: {
          schemaVersion: 2,
          kind: "tsonic-library",
          npmPackage: "bad-schema",
          npmVersion: "1.0.0",
          runtime: {
            nugetPackages: [{ id: "Bad.Runtime", version: "1.0.0" }],
          },
          typing: {
            bindingsRoot: "tsonic/bindings",
          },
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/^TSN8A01:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors with TSN8A02 when runtime nuget package version is invalid", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-package-manifest-runtime-version-")
    );
    try {
      const pkgRoot = writeInstalledPackage(
        dir,
        "bad-runtime-version",
        "1.0.0",
        {
          bindingsRoot: "tsonic/bindings",
          packageManifest: {
            schemaVersion: 1,
            kind: "tsonic-library",
            npmPackage: "bad-runtime-version",
            npmVersion: "1.0.0",
            runtime: {
              nugetPackages: [{ id: "Bad.Runtime", version: "" }],
            },
            typing: {
              bindingsRoot: "tsonic/bindings",
            },
          },
        }
      );

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/^TSN8A02:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors with TSN8A05 when runtime mapping is missing", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-package-manifest-no-runtime-")
    );
    try {
      const pkgRoot = writeInstalledPackage(dir, "bad-runtime", "1.0.0", {
        bindingsRoot: "tsonic/bindings",
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "bad-runtime",
          npmVersion: "1.0.0",
          runtime: {
            nugetPackages: [],
          },
          typing: {
            bindingsRoot: "tsonic/bindings",
          },
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/^TSN8A05:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
