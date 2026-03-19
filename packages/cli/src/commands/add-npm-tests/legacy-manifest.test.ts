import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addNpmCommand } from "../add-npm.js";
import {
  readWorkspaceConfig,
  writeLocalNpmPackage,
  writeWorkspaceConfig,
} from "./helpers.js";

describe("add npm (legacy manifest)", function () {
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
      const normalizedManifest = JSON.parse(
        readFileSync(normalizedManifestPath, "utf-8")
      ) as Record<string, unknown>;
      expect(normalizedManifest["bindingVersion"]).to.equal(1);
      expect(normalizedManifest["packageName"]).to.equal(pkgName);
      expect(normalizedManifest["packageVersion"]).to.equal("1.0.0");
      expect(normalizedManifest["surfaceMode"]).to.equal("clr");
      expect(normalizedManifest["runtimePackages"]).to.deep.equal([pkgName]);
      expect(normalizedManifest["nugetDependencies"]).to.deep.equal([
        { source: "dotnet.framework", id: "Microsoft.AspNetCore.App" },
        { source: "dotnet.package", id: "Acme.A", version: "1.0.0" },
        { source: "testDotnet.package", id: "Acme.Test", version: "2.0.0" },
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
            packageReferences: [{ id: "Acme.A", version: "1.0.0", types: pkgName }],
          },
        },
      });

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
            packageReferences: [{ id: "Acme.A", version: "1.0.0", types: pkgName }],
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

      const first = addNpmCommand("./local/acme-bindings", configPath, { quiet: true });
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

      const second = addNpmCommand("./local/acme-bindings", configPath, { quiet: true });
      expect(second.ok).to.equal(true);
      expect(readFileSync(normalizedManifestPath, "utf-8")).to.equal(firstBytes);
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
});
