import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { TsonicWorkspaceConfig } from "../types.js";
import {
  applyAikyaWorkspaceOverlay,
  discoverWorkspaceBindingsManifests,
  mergeManifestIntoWorkspaceConfig,
  resolveInstalledPackageBindingsManifest,
  type NormalizedBindingsManifest,
} from "./bindings.js";

const writeJson = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf-8");
};

const packageDir = (workspaceRoot: string, packageName: string): string => {
  if (packageName.startsWith("@")) {
    const [scope, name] = packageName.split("/");
    if (!scope || !name) {
      throw new Error(`Invalid scoped package name: ${packageName}`);
    }
    return join(workspaceRoot, "node_modules", scope, name);
  }
  return join(workspaceRoot, "node_modules", packageName);
};

const writeInstalledPackage = (
  workspaceRoot: string,
  packageName: string,
  version: string,
  opts: {
    readonly legacyBindings?: unknown;
    readonly aikyaManifest?: unknown;
    readonly bindingsRoot?: string;
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly optionalDependencies?: Readonly<Record<string, string>>;
    readonly peerDependencies?: Readonly<Record<string, string>>;
  } = {}
): string => {
  const pkgRoot = packageDir(workspaceRoot, packageName);
  mkdirSync(pkgRoot, { recursive: true });
  writeJson(join(pkgRoot, "package.json"), {
    name: packageName,
    version,
    private: true,
    type: "module",
    ...(opts.dependencies ? { dependencies: opts.dependencies } : {}),
    ...(opts.optionalDependencies
      ? { optionalDependencies: opts.optionalDependencies }
      : {}),
    ...(opts.peerDependencies
      ? { peerDependencies: opts.peerDependencies }
      : {}),
  });

  if (opts.legacyBindings !== undefined) {
    writeJson(join(pkgRoot, "tsonic.bindings.json"), opts.legacyBindings);
  }

  if (opts.aikyaManifest !== undefined) {
    writeJson(
      join(pkgRoot, "tsonic", "package-manifest.json"),
      opts.aikyaManifest
    );
    if (opts.bindingsRoot) {
      mkdirSync(join(pkgRoot, opts.bindingsRoot), { recursive: true });
    }
  }

  return pkgRoot;
};

const baseWorkspaceConfig = (): TsonicWorkspaceConfig => ({
  dotnetVersion: "net10.0",
  dotnet: {
    frameworkReferences: [],
    packageReferences: [],
  },
});

describe("aikya bindings", function () {
  this.timeout(30_000);

  it("returns null when package has no bindings manifests", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-aikya-none-"));
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
    const dir = mkdtempSync(join(tmpdir(), "tsonic-aikya-legacy-"));
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

  it("resolves Aikya package-manifest and overlays runtime nuget mapping", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-aikya-v1-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "@acme/node", "2.0.0", {
        bindingsRoot: "tsonic/bindings",
        aikyaManifest: {
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
            mode: "aikya-firstparty",
          },
        },
      });
      expect(existsSync(join(pkgRoot, "tsonic", "bindings"))).to.equal(true);

      const result = resolveInstalledPackageBindingsManifest(pkgRoot);
      expect(result.ok).to.equal(true);
      const manifest = result.ok ? result.value : null;
      expect(manifest).to.not.equal(null);
      expect(manifest?.sourceManifest).to.equal("aikya");
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

  it("errors with TSN8A04 when bindingsRoot path does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-aikya-no-bindings-root-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "bad-aikya", "1.0.0", {
        aikyaManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "bad-aikya",
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
      expect(result.ok ? "" : result.error).to.match(/^TSN8A04:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors with TSN8A01 on invalid Aikya schemaVersion", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-aikya-schema-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "bad-schema", "1.0.0", {
        bindingsRoot: "tsonic/bindings",
        aikyaManifest: {
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
    const dir = mkdtempSync(join(tmpdir(), "tsonic-aikya-runtime-version-"));
    try {
      const pkgRoot = writeInstalledPackage(
        dir,
        "bad-runtime-version",
        "1.0.0",
        {
          bindingsRoot: "tsonic/bindings",
          aikyaManifest: {
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
    const dir = mkdtempSync(join(tmpdir(), "tsonic-aikya-no-runtime-"));
    try {
      const pkgRoot = writeInstalledPackage(dir, "bad-runtime", "1.0.0", {
        bindingsRoot: "tsonic/bindings",
        aikyaManifest: {
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

  it("discovers workspace manifests from dependencies and devDependencies", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-aikya-discover-"));
    try {
      writeJson(join(dir, "package.json"), {
        name: "workspace",
        private: true,
        type: "module",
        dependencies: {
          "app-no-bindings": "1.0.0",
        },
        devDependencies: {
          "@acme/aikya": "1.0.0",
          "legacy-types": "1.0.0",
        },
      });

      writeInstalledPackage(dir, "app-no-bindings", "1.0.0");
      writeInstalledPackage(dir, "@acme/aikya", "1.0.0", {
        bindingsRoot: "tsonic/bindings",
        aikyaManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "@acme/aikya",
          npmVersion: "1.0.0",
          runtime: {
            nugetPackages: [{ id: "Acme.Aikya", version: "1.0.0" }],
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
        "@acme/aikya",
        "legacy-types",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("discovers transitive manifests through installed dependency graph", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-aikya-discover-transitive-")
    );
    try {
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
        aikyaManifest: {
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
    const dir = mkdtempSync(join(tmpdir(), "tsonic-aikya-overlay-"));
    try {
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
        aikyaManifest: {
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

      const result = applyAikyaWorkspaceOverlay(dir, baseWorkspaceConfig());
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

  it("fails overlay with TSN8A03 on conflicting runtime package versions", () => {
    const config = baseWorkspaceConfig();
    const manifest: NormalizedBindingsManifest = {
      bindingVersion: 1,
      sourceManifest: "aikya",
      packageName: "acme-conflict",
      packageVersion: "1.0.0",
      surfaceMode: "clr",
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
