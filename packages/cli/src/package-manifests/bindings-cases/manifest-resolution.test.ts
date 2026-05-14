import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTestTimeoutMs,
  resolveInstalledPackageBindingsManifest,
  writeInstalledPackage,
} from "./helpers.js";

describe("tsonic.package bindings", function () {
  this.timeout(buildTestTimeoutMs);

  it("returns null when package has no bindings manifests", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-none-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "no-bindings", "1.0.0");
      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(true);
      expect(result.ok ? result.value : "x").to.equal(null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves tsonic.bindings.json manifests", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-bindings-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "clr-bindings", "1.2.3", {
        bindingsManifest: {
          bindingVersion: 1,
          packageName: "clr-bindings",
          packageVersion: "1.2.3",
          dotnet: {
            packageReferences: [{ id: "Acme.Bindings", version: "1.2.3" }],
          },
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(true);
      const manifest = result.ok ? result.value : null;
      expect(manifest?.sourceManifest).to.equal("tsonic-bindings");
      expect(manifest?.dotnet?.packageReferences).to.deep.equal([
        { id: "Acme.Bindings", version: "1.2.3" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves semantic metadata from tsonic.bindings.json manifests", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-bindings-semantic-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "semantic-bindings", "1.0.0", {
        bindingsManifest: {
          bindingVersion: 1,
          packageName: "semantic-bindings",
          packageVersion: "1.0.0",
          semanticMetadata: {
            version: 1,
            aliases: {
              "semantic-bindings:User": {
                aliasId: "semantic-bindings:User",
                definition: { kind: "referenceType", name: "User" },
                isRecursive: false,
                typeParameters: [],
              },
            },
            overloadFamilies: {
              "semantic-bindings:parse": {
                familyId: "semantic-bindings:parse",
                ownerKind: "function",
                publicName: "parse",
                publicMembers: [],
                resolutionMetadata: {},
              },
            },
          },
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(true);
      const manifest = result.ok ? result.value : null;
      expect(
        manifest?.semanticMetadata?.aliases?.["semantic-bindings:User"]
      ).to.deep.include({
        aliasId: "semantic-bindings:User",
        isRecursive: false,
      });
      expect(
        manifest?.semanticMetadata?.overloadFamilies?.[
          "semantic-bindings:parse"
        ]?.familyId
      ).to.equal("semantic-bindings:parse");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves tsonic.package.json overlays and runtime metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-overlay-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "@acme/node", "2.0.0", {
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-source-package",
          assemblyName: "Acme.Node.Runtime",
          surfaces: ["@tsonic/js"],
          requiredTypeRoots: ["."],
          runtime: {
            nugetPackages: [{ id: "Acme.Node.Runtime", version: "2.0.0" }],
            frameworkReferences: ["Microsoft.AspNetCore.App"],
            runtimePackages: ["@tsonic/dotnet"],
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
      expect(manifest?.sourceManifest).to.equal("tsonic-package");
      expect(manifest?.assemblyName).to.equal("Acme.Node.Runtime");
      expect(manifest?.requiredTypeRoots).to.deep.equal([
        "node_modules/@acme/node",
      ]);
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

  it("treats source-package semantic metadata as overlay metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-semantic-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "@acme/semantic", "1.0.0", {
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-source-package",
          semanticMetadata: {
            version: 1,
            aliases: {
              "@acme/semantic:Result": {
                aliasId: "@acme/semantic:Result",
                definition: { kind: "referenceType", name: "Result" },
                isRecursive: true,
                typeParameters: ["T", "E"],
              },
            },
          },
          source: {
            exports: {
              ".": "./src/index.ts",
            },
          },
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(true);
      const manifest = result.ok ? result.value : null;
      expect(manifest?.sourceManifest).to.equal("tsonic-package");
      expect(
        manifest?.semanticMetadata?.aliases?.["@acme/semantic:Result"]
      ).to.deep.include({
        aliasId: "@acme/semantic:Result",
        isRecursive: true,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns null for pure source packages without overlay metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-pure-source-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "@acme/math", "1.0.0", {
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-source-package",
          surfaces: ["@tsonic/js"],
          source: {
            exports: {
              ".": "./src/index.ts",
            },
          },
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(true);
      expect(result.ok ? result.value : "x").to.equal(null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("collects deterministic nugetDependencies across dotnet and testDotnet", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-nuget-deps-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "@acme/deps", "3.1.0", {
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-source-package",
          surfaces: ["@tsonic/js"],
          runtime: {
            nugetPackages: [{ id: "Acme.Runtime", version: "3.1.0" }],
            frameworkReferences: ["Microsoft.AspNetCore.App"],
            runtimePackages: ["@tsonic/dotnet"],
          },
          dotnet: {
            packageReferences: [{ id: "Acme.Core", version: "1.2.3" }],
          },
          testDotnet: {
            packageReferences: [{ id: "Acme.Testing", version: "9.9.9" }],
          },
          source: {
            exports: {
              ".": "./src/index.ts",
            },
          },
        },
      });

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(true);

      const manifest = result.ok ? result.value : null;
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
      expect(
        (manifest?.nugetDependencies ?? []).map(
          (dep) => `${dep.source}:${dep.id}@${dep.version ?? ""}`
        )
      ).to.deep.equal([
        "dotnet.framework:Microsoft.AspNetCore.App@",
        "dotnet.package:Acme.Core@1.2.3",
        "dotnet.package:Acme.Runtime@3.1.0",
        "testDotnet.package:Acme.Testing@9.9.9",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors with TSN8A01 when producer.tool is invalid", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-producer-tool-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "bad-producer-tool", "1.0.0", {
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-source-package",
          surfaces: ["@tsonic/js"],
          runtime: {
            nugetPackages: [{ id: "Bad.Runtime", version: "1.0.0" }],
          },
          producer: {
            tool: "custom-tool",
            version: "1.0.0",
            mode: "tsonic-firstparty",
          },
          source: {
            exports: {
              ".": "./src/index.ts",
            },
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
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-producer-mode-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "bad-producer-mode", "1.0.0", {
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-source-package",
          surfaces: ["@tsonic/js"],
          runtime: {
            nugetPackages: [{ id: "Bad.Runtime", version: "1.0.0" }],
          },
          producer: {
            tool: "tsonic",
            version: "1.0.0",
            mode: "invalid-mode",
          },
          source: {
            exports: {
              ".": "./src/index.ts",
            },
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

  it("errors with TSN8A01 on invalid tsonic.package.json schemaVersion", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-schema-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "bad-schema", "1.0.0", {
        packageManifest: {
          schemaVersion: 2,
          kind: "tsonic-source-package",
          surfaces: ["@tsonic/js"],
          runtime: {
            nugetPackages: [{ id: "Bad.Runtime", version: "1.0.0" }],
          },
          source: {
            exports: {
              ".": "./src/index.ts",
            },
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
    const dir = mkdtempSync(join(tmpdir(), "tsonic-package-runtime-version-"));
    try {
      const pkgRoot = writeInstalledPackage(
        dir,
        "bad-runtime-version",
        "1.0.0",
        {
          packageManifest: {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            runtime: {
              nugetPackages: [{ id: "Bad.Runtime", version: "" }],
            },
            source: {
              exports: {
                ".": "./src/index.ts",
              },
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
});
