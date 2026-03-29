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
import { addNpmCommand } from "../add-npm.js";
import {
  readWorkspaceConfig,
  writeInstalledSurfacePackage,
  writeLocalNpmPackage,
  writeWorkspaceConfig,
} from "./helpers.js";

const installJsSurface = (workspaceRoot: string): void => {
  const jsRoot = writeInstalledSurfacePackage(workspaceRoot, {
    name: "@tsonic/js",
    surfaceManifest: {
      schemaVersion: 1,
      id: "@tsonic/js",
      extends: [],
      requiredTypeRoots: ["."],
      requiredNpmPackages: ["@tsonic/js"],
      useStandardLib: false,
    },
  });
  writeFileSync(
    join(jsRoot, "tsonic.package.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        kind: "tsonic-source-package",
        surfaces: ["@tsonic/js"],
        source: {
          namespace: "js",
          exports: {
            ".": "./src/index.ts",
            "./index.js": "./src/index.ts",
          },
        },
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  mkdirSync(join(jsRoot, "src"), { recursive: true });
  writeFileSync(join(jsRoot, "src", "index.ts"), "export const ok = true;\n");
};

describe("add npm (package manifests)", function () {
  this.timeout(3 * 60 * 1000);

  it("supports package manifests and injects runtime NuGet references", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-package-manifest-"));
    try {
      const configPath = writeWorkspaceConfig(dir);
      const pkgName = "@acme/node";
      writeLocalNpmPackage(dir, "local/acme-node", {
        name: pkgName,
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-source-package",
          surfaces: ["@tsonic/js"],
          runtime: {
            nugetPackages: [{ id: "Acme.Node.Runtime", version: "1.0.0" }],
            frameworkReferences: ["Microsoft.AspNetCore.App"],
            runtimePackages: ["@tsonic/dotnet"],
          },
          producer: {
            tool: "tsonic",
            version: "0.0.70",
            mode: "tsonic-firstparty",
          },
          source: {
            namespace: "Acme.Node",
            exports: {
              ".": "./src/index.ts",
            },
          },
        },
      });
      mkdirSync(join(dir, "local/acme-node", "src"), { recursive: true });
      writeFileSync(
        join(dir, "local/acme-node", "src", "index.ts"),
        "export const ok = true;\n",
        "utf-8"
      );

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
      expect(normalizedManifest["sourceManifest"]).to.equal("tsonic-package");
      expect(normalizedManifest["packageName"]).to.equal(pkgName);
      expect(normalizedManifest["runtimePackages"]).to.deep.equal([
        "@acme/node",
        "@tsonic/dotnet",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows installed tsonic source packages without treating them as invalid package manifests", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-source-package-"));
    try {
      const configPath = writeWorkspaceConfig(dir, { surface: "@tsonic/js" });
      installJsSurface(dir);
      const pkgName = "@acme/math";
      writeLocalNpmPackage(dir, "local/acme-math", {
        name: pkgName,
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-source-package",
          surfaces: ["@tsonic/js"],
          source: {
            namespace: "Acme.Math",
            exports: { ".": "./src/index.ts" },
          },
        },
      });
      mkdirSync(join(dir, "local/acme-math", "src"), { recursive: true });
      writeFileSync(
        join(dir, "local/acme-math", "src", "index.ts"),
        "export const clamp = (x: number, min: number, max: number): number => x < min ? min : x > max ? max : x;\n",
        "utf-8"
      );

      const result = addNpmCommand("./local/acme-math", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(true);
      expect(result.ok ? result.value.packageName : "").to.equal(pkgName);
      expect(
        existsSync(
          join(
            dir,
            ".tsonic",
            "manifests",
            "npm",
            pkgName,
            "tsonic.bindings.normalized.json"
          )
        )
      ).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("merges overlay metadata from source packages when they declare runtime requirements", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-add-npm-source-package-overlay-")
    );
    try {
      const configPath = writeWorkspaceConfig(dir, { surface: "@tsonic/js" });
      installJsSurface(dir);
      const pkgName = "@acme/node";
      writeLocalNpmPackage(dir, "local/acme-node", {
        name: pkgName,
        packageManifest: {
          schemaVersion: 1,
          kind: "tsonic-source-package",
          surfaces: ["@tsonic/js"],
          requiredTypeRoots: ["."],
          runtime: {
            frameworkReferences: ["Microsoft.AspNetCore.App"],
          },
          dotnet: {
            packageReferences: [{ id: "Acme.Node.Runtime", version: "1.0.0" }],
          },
          source: {
            namespace: "Acme.Node",
            exports: {
              ".": "./src/index.ts",
              "./fs.js": "./src/fs.ts",
            },
          },
        },
      });
      mkdirSync(join(dir, "local/acme-node", "src"), { recursive: true });
      writeFileSync(
        join(dir, "local/acme-node", "src", "index.ts"),
        "export const ok = true;\n",
        "utf-8"
      );

      const result = addNpmCommand("./local/acme-node", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(true);
      expect(result.ok ? result.value.packageName : "").to.equal(pkgName);

      const cfg = readWorkspaceConfig(dir);
      expect(cfg.dotnet.typeRoots).to.deep.equal(["node_modules/@acme/node"]);
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
      expect(existsSync(normalizedManifestPath)).to.equal(true);
      const normalizedManifest = JSON.parse(
        readFileSync(normalizedManifestPath, "utf-8")
      ) as Record<string, unknown>;
      expect(normalizedManifest["sourceManifest"]).to.equal("tsonic-package");
      expect(normalizedManifest["requiredTypeRoots"]).to.deep.equal([
        "node_modules/@acme/node",
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
        bindingsManifest: {
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
            devDependencies: { "acme-bindings": "1.0.0" },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeLocalNpmPackage(dir, "node_modules/acme-bindings", {
        name: "acme-bindings",
        bindingsManifest: {
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
      expect(readWorkspaceConfig(dir).dotnet.packageReferences).to.deep.equal([
        { id: "Acme.Runtime", version: "1.0.0" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
