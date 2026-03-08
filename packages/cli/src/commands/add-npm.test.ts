/**
 * Integration tests for `tsonic add npm`.
 *
 * These tests are intentionally end-to-end at the CLI command level:
 * - Use local `file:` npm packages (no registry)
 * - Verify `tsonic.bindings.json` manifest merging behavior
 * - Verify airplane-grade conflict detection
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addNpmCommand } from "./add-npm.js";

const writeWorkspaceConfig = (
  dir: string,
  options: { readonly surface?: string } = {}
): string => {
  const configPath = join(dir, "tsonic.workspace.json");
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: options.surface ?? "clr",
        dotnet: {
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
      "\n",
    "utf-8"
  );

  return configPath;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readWorkspaceConfig = (dir: string): any => {
  return JSON.parse(readFileSync(join(dir, "tsonic.workspace.json"), "utf-8"));
};

const writeLocalNpmPackage = (
  workspaceRoot: string,
  relDir: string,
  pkg: {
    readonly name: string;
    readonly manifest?: unknown;
    readonly aikyaManifest?: unknown;
    readonly bindingsRoot?: string;
    readonly dependencies?: Readonly<Record<string, string>>;
  }
): string => {
  const pkgRoot = join(workspaceRoot, relDir);
  mkdirSync(pkgRoot, { recursive: true });

  writeFileSync(
    join(pkgRoot, "package.json"),
    JSON.stringify(
      {
        name: pkg.name,
        private: true,
        version: "1.0.0",
        type: "module",
        ...(pkg.dependencies ? { dependencies: pkg.dependencies } : {}),
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );

  if (pkg.manifest !== undefined) {
    writeFileSync(
      join(pkgRoot, "tsonic.bindings.json"),
      JSON.stringify(pkg.manifest, null, 2) + "\n",
      "utf-8"
    );
  }

  if (pkg.aikyaManifest !== undefined) {
    mkdirSync(join(pkgRoot, "tsonic"), { recursive: true });
    writeFileSync(
      join(pkgRoot, "tsonic", "package-manifest.json"),
      JSON.stringify(pkg.aikyaManifest, null, 2) + "\n",
      "utf-8"
    );
  }

  if (pkg.bindingsRoot) {
    mkdirSync(join(pkgRoot, pkg.bindingsRoot), { recursive: true });
  }

  return pkgRoot;
};

const writeInstalledSurfacePackage = (
  workspaceRoot: string,
  pkg: {
    readonly name: string;
    readonly surfaceManifest: unknown;
  }
): string => {
  const [scope, name] = pkg.name.startsWith("@")
    ? pkg.name.split("/")
    : [undefined, pkg.name];
  const pkgRoot =
    scope && name
      ? join(workspaceRoot, "node_modules", scope, name)
      : join(workspaceRoot, "node_modules", pkg.name);
  mkdirSync(pkgRoot, { recursive: true });
  writeFileSync(
    join(pkgRoot, "package.json"),
    JSON.stringify(
      {
        name: pkg.name,
        version: "1.0.0",
        type: "module",
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  writeFileSync(
    join(pkgRoot, "tsonic.surface.json"),
    JSON.stringify(pkg.surfaceManifest, null, 2) + "\n",
    "utf-8"
  );
  return pkgRoot;
};

describe("add npm", function () {
  this.timeout(3 * 60 * 1000);

  it("installs local package and merges manifest into workspace config", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-"));
    try {
      const configPath = writeWorkspaceConfig(dir);

      const pkgName = "acme-bindings";
      writeLocalNpmPackage(dir, "local/acme-bindings", {
        name: pkgName,
        manifest: {
          dotnet: {
            frameworkReferences: [
              { id: "Microsoft.AspNetCore.App", types: pkgName },
            ],
            packageReferences: [
              { id: "Acme.A", version: "1.0.0", types: pkgName },
            ],
            msbuildProperties: { InterceptorsNamespaces: "Acme.Generated" },
          },
          testDotnet: {
            packageReferences: [
              { id: "Acme.Test", version: "2.0.0", types: false },
            ],
          },
        },
      });

      const result = addNpmCommand("./local/acme-bindings", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(true);
      expect(result.ok ? result.value.packageName : "").to.equal(pkgName);

      expect(existsSync(join(dir, "node_modules", pkgName))).to.equal(true);

      const cfg = readWorkspaceConfig(dir);
      expect(cfg.dotnet.frameworkReferences).to.deep.equal([
        { id: "Microsoft.AspNetCore.App", types: pkgName },
      ]);
      expect(cfg.dotnet.packageReferences).to.deep.equal([
        { id: "Acme.A", version: "1.0.0", types: pkgName },
      ]);
      expect(cfg.dotnet.msbuildProperties).to.deep.equal({
        InterceptorsNamespaces: "Acme.Generated",
      });
      expect(cfg.testDotnet.packageReferences).to.deep.equal([
        { id: "Acme.Test", version: "2.0.0", types: false },
      ]);

      const normalizedManifestPath = join(
        dir,
        ".tsonic",
        "manifests",
        "npm",
        pkgName,
        "tsonic.bindings.normalized.json"
      );
      expect(existsSync(normalizedManifestPath)).to.equal(true);
      const normalizedManifest = JSON.parse(
        readFileSync(normalizedManifestPath, "utf-8")
      ) as Record<string, unknown>;
      expect(normalizedManifest["bindingVersion"]).to.equal(1);
      expect(normalizedManifest["packageName"]).to.equal(pkgName);
      expect(normalizedManifest["packageVersion"]).to.equal("1.0.0");
      expect(normalizedManifest["surfaceMode"]).to.equal("clr");

      const runtimePackages = normalizedManifest["runtimePackages"] as
        | string[]
        | undefined;
      expect(runtimePackages).to.deep.equal([pkgName]);

      const nugetDependencies = normalizedManifest["nugetDependencies"] as
        | { id: string; source: string; version?: string }[]
        | undefined;
      expect(nugetDependencies).to.deep.equal([
        {
          source: "dotnet.framework",
          id: "Microsoft.AspNetCore.App",
        },
        {
          source: "dotnet.package",
          id: "Acme.A",
          version: "1.0.0",
        },
        {
          source: "testDotnet.package",
          id: "Acme.Test",
          version: "2.0.0",
        },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors on manifest conflicts (different NuGet version)", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-conflict-"));
    try {
      const configPath = writeWorkspaceConfig(dir);
      const pkgName = "acme-bindings";
      writeLocalNpmPackage(dir, "local/acme-bindings", {
        name: pkgName,
        manifest: {
          dotnet: {
            packageReferences: [
              { id: "Acme.A", version: "1.0.0", types: pkgName },
            ],
          },
        },
      });

      // Seed a conflicting workspace package reference.
      const cfg = readWorkspaceConfig(dir);
      cfg.dotnet.packageReferences = [{ id: "Acme.A", version: "0.9.0" }];
      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(cfg, null, 2) + "\n",
        "utf-8"
      );

      const result = addNpmCommand("./local/acme-bindings", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/different version/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors when the npm package lacks both supported manifest contracts", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-missing-"));
    try {
      const configPath = writeWorkspaceConfig(dir);
      writeLocalNpmPackage(dir, "local/no-manifest", { name: "no-manifest" });

      const result = addNpmCommand("./local/no-manifest", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/Missing manifest/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors on unsupported manifest bindingVersion", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-bindver-"));
    try {
      const configPath = writeWorkspaceConfig(dir);
      const pkgName = "acme-bindings";
      writeLocalNpmPackage(dir, "local/acme-bindings", {
        name: pkgName,
        manifest: {
          bindingVersion: 2,
          dotnet: {
            packageReferences: [
              { id: "Acme.A", version: "1.0.0", types: pkgName },
            ],
          },
        },
      });

      const result = addNpmCommand("./local/acme-bindings", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/bindingVersion/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors on packageName mismatch between manifest and installed package", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-name-mismatch-"));
    try {
      const configPath = writeWorkspaceConfig(dir);
      writeLocalNpmPackage(dir, "local/acme-bindings", {
        name: "acme-bindings",
        manifest: {
          bindingVersion: 1,
          packageName: "different-name",
          dotnet: {
            packageReferences: [{ id: "Acme.A", version: "1.0.0" }],
          },
        },
      });

      const result = addNpmCommand("./local/acme-bindings", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/packageName mismatch/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes deterministic normalized manifest bytes across repeated installs", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-deterministic-"));
    try {
      const configPath = writeWorkspaceConfig(dir);
      const pkgName = "acme-bindings";
      writeLocalNpmPackage(dir, "local/acme-bindings", {
        name: pkgName,
        manifest: {
          bindingVersion: 1,
          requiredTypeRoots: ["types", "."],
          dotnet: {
            packageReferences: [
              { id: "Zeta", version: "1.0.0" },
              { id: "Acme.A", version: "1.0.0" },
            ],
          },
          testDotnet: {
            frameworkReferences: ["Microsoft.AspNetCore.App"],
          },
        },
      });

      const first = addNpmCommand("./local/acme-bindings", configPath, {
        quiet: true,
      });
      expect(first.ok).to.equal(true);

      const normalizedManifestPath = join(
        dir,
        ".tsonic",
        "manifests",
        "npm",
        pkgName,
        "tsonic.bindings.normalized.json"
      );
      const firstBytes = readFileSync(normalizedManifestPath, "utf-8");

      const second = addNpmCommand("./local/acme-bindings", configPath, {
        quiet: true,
      });
      expect(second.ok).to.equal(true);

      const secondBytes = readFileSync(normalizedManifestPath, "utf-8");
      expect(secondBytes).to.equal(firstBytes);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("merges requiredTypeRoots from package manifests into workspace config", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-type-roots-"));
    try {
      const configPath = writeWorkspaceConfig(dir);
      const pkgName = "@acme/node-runtime";
      writeLocalNpmPackage(dir, "local/acme-node-runtime", {
        name: pkgName,
        manifest: {
          bindingVersion: 1,
          requiredTypeRoots: ["types", "."],
          dotnet: {
            packageReferences: [{ id: "Acme.Node.Runtime", version: "1.0.0" }],
          },
        },
      });

      const result = addNpmCommand("./local/acme-node-runtime", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(true);

      const cfg = readWorkspaceConfig(dir);
      expect(cfg.dotnet.typeRoots).to.deep.equal([
        "node_modules/@acme/node-runtime",
        "node_modules/@acme/node-runtime/types",
      ]);

      const normalizedManifestPath = join(
        dir,
        ".tsonic",
        "manifests",
        "npm",
        pkgName,
        "tsonic.bindings.normalized.json"
      );
      const normalizedManifest = JSON.parse(
        readFileSync(normalizedManifestPath, "utf-8")
      ) as Record<string, unknown>;
      expect(normalizedManifest["requiredTypeRoots"]).to.deep.equal([
        "node_modules/@acme/node-runtime",
        "node_modules/@acme/node-runtime/types",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports Aikya package-manifest and injects runtime NuGet references", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-aikya-"));
    try {
      const configPath = writeWorkspaceConfig(dir);
      const pkgName = "@acme/node";
      writeLocalNpmPackage(dir, "local/acme-node", {
        name: pkgName,
        bindingsRoot: "tsonic/bindings",
        aikyaManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: pkgName,
          npmVersion: "1.0.0",
          runtime: {
            nugetPackages: [{ id: "Acme.Node.Runtime", version: "1.0.0" }],
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

      const result = addNpmCommand("./local/acme-node", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(true);
      expect(result.ok ? result.value.packageName : "").to.equal(pkgName);

      const cfg = readWorkspaceConfig(dir);
      expect(cfg.dotnet.frameworkReferences).to.deep.equal([
        "Microsoft.AspNetCore.App",
      ]);
      expect(cfg.dotnet.packageReferences).to.deep.equal([
        { id: "Acme.Node.Runtime", version: "1.0.0" },
      ]);

      const normalizedManifestPath = join(
        dir,
        ".tsonic",
        "manifests",
        "npm",
        pkgName,
        "tsonic.bindings.normalized.json"
      );
      const normalizedManifest = JSON.parse(
        readFileSync(normalizedManifestPath, "utf-8")
      ) as Record<string, unknown>;
      expect(normalizedManifest["sourceManifest"]).to.equal("aikya");
      expect(normalizedManifest["packageName"]).to.equal(pkgName);
      expect(normalizedManifest["bindingsRoot"]).to.equal("tsonic/bindings");
      expect(normalizedManifest["runtimePackages"]).to.deep.equal([
        "@acme/node",
        "@tsonic/dotnet",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses the workspace surface when rediscovering manifests", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-surface-"));
    try {
      const configPath = writeWorkspaceConfig(dir, { surface: "@tsonic/js" });
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          {
            name: "test",
            private: true,
            type: "module",
            devDependencies: {
              "@tsonic/js": "1.0.0",
              "acme-bindings": "1.0.0",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeInstalledSurfacePackage(dir, {
        name: "@tsonic/js",
        surfaceManifest: {
          schemaVersion: 1,
          id: "@tsonic/js",
          requiredTypeRoots: ["."],
        },
      });
      writeLocalNpmPackage(dir, "node_modules/acme-bindings", {
        name: "acme-bindings",
        manifest: {
          dotnet: {
            packageReferences: [{ id: "Acme.Runtime", version: "1.0.0" }],
          },
        },
      });

      const result = addNpmCommand("acme-bindings", configPath, {
        quiet: true,
        skipInstallIfPresent: true,
      });
      expect(result.ok).to.equal(true);
      expect(result.ok ? result.value.packageName : "").to.equal(
        "acme-bindings"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("can merge manifests from an already-installed package without reinstalling", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-preinstalled-"));
    try {
      const configPath = writeWorkspaceConfig(dir);
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          {
            name: "test",
            private: true,
            type: "module",
            devDependencies: {
              "acme-bindings": "1.0.0",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeLocalNpmPackage(dir, "node_modules/acme-bindings", {
        name: "acme-bindings",
        manifest: {
          dotnet: {
            packageReferences: [{ id: "Acme.Runtime", version: "1.0.0" }],
          },
        },
      });

      const result = addNpmCommand("acme-bindings", configPath, {
        quiet: true,
        skipInstallIfPresent: true,
      });
      expect(result.ok).to.equal(true);
      expect(result.ok ? result.value.packageName : "").to.equal(
        "acme-bindings"
      );

      const cfg = readWorkspaceConfig(dir);
      expect(cfg.dotnet.packageReferences).to.deep.equal([
        { id: "Acme.Runtime", version: "1.0.0" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves transitive Aikya manifests and injects all runtime NuGet references", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-aikya-transitive-"));
    try {
      const configPath = writeWorkspaceConfig(dir);

      writeLocalNpmPackage(dir, "local/acme-child", {
        name: "acme-child",
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
          producer: {
            tool: "tsonic",
            version: "0.0.70",
            mode: "aikya-firstparty",
          },
        },
      });

      writeLocalNpmPackage(dir, "local/acme-parent", {
        name: "acme-parent",
        dependencies: {
          "acme-child": "file:../acme-child",
        },
        bindingsRoot: "tsonic/bindings",
        aikyaManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "acme-parent",
          npmVersion: "1.0.0",
          runtime: {
            nugetPackages: [{ id: "Acme.Parent.Runtime", version: "1.0.0" }],
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

      const result = addNpmCommand("./local/acme-parent", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(true);
      expect(result.ok ? result.value.packageName : "").to.equal("acme-parent");

      const cfg = readWorkspaceConfig(dir);
      expect(cfg.dotnet.packageReferences).to.deep.equal([
        { id: "Acme.Child.Runtime", version: "1.0.0" },
        { id: "Acme.Parent.Runtime", version: "1.0.0" },
      ]);

      const childManifest = join(
        dir,
        ".tsonic",
        "manifests",
        "npm",
        "acme-child",
        "tsonic.bindings.normalized.json"
      );
      const parentManifest = join(
        dir,
        ".tsonic",
        "manifests",
        "npm",
        "acme-parent",
        "tsonic.bindings.normalized.json"
      );
      expect(existsSync(childManifest)).to.equal(true);
      expect(existsSync(parentManifest)).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits TSN8A04 when Aikya manifest bindingsRoot is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-aikya-root-"));
    try {
      const configPath = writeWorkspaceConfig(dir);
      writeLocalNpmPackage(dir, "local/acme-node", {
        name: "@acme/node",
        aikyaManifest: {
          schemaVersion: 1,
          kind: "tsonic-library",
          npmPackage: "@acme/node",
          npmVersion: "1.0.0",
          runtime: {
            nugetPackages: [{ id: "Acme.Node.Runtime", version: "1.0.0" }],
          },
          typing: {
            bindingsRoot: "tsonic/bindings",
          },
        },
      });

      const result = addNpmCommand("./local/acme-node", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/^TSN8A04:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
