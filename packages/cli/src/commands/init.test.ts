/**
 * Tests for init command
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { getTypePackageInfo, initWorkspace } from "./init.js";

describe("Init Command", () => {
  describe("getTypePackageInfo", () => {
    describe("default (no options)", () => {
      it("should return cli and clr surface packages", () => {
        const result = getTypePackageInfo();
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("tsonic");
        expect(packageNames).to.include("@tsonic/dotnet");
        expect(packageNames).to.not.include("@tsonic/core");
      });

      it("should include clr surface type roots", () => {
        const result = getTypePackageInfo();
        expect(result.typeRoots).to.deep.equal(["node_modules/@tsonic/dotnet"]);
      });
    });

    it("should include @tsonic/js package (without nodejs) for js surface", () => {
      const result = getTypePackageInfo({ surface: "@tsonic/js" });
      const packageNames = result.packages.map((p) => p.name);

      expect(packageNames).to.include("@tsonic/js");
      expect(packageNames).to.not.include("@tsonic/nodejs");
      expect(result.typeRoots).to.deep.equal(["node_modules/@tsonic/js"]);
    });

    it("should include @tsonic/nodejs package for nodejs surface bootstrap", () => {
      const result = getTypePackageInfo({ surface: "@tsonic/nodejs" });
      const packageNames = result.packages.map((p) => p.name);

      expect(packageNames).to.include("@tsonic/nodejs");
      expect(packageNames).to.not.include("@tsonic/js");
      expect(result.typeRoots).to.deep.equal(["node_modules/@tsonic/nodejs"]);
    });

    it("should include inherited surface package requirements from installed manifests", () => {
      const workspaceRoot = mkdtempSync(join(tmpdir(), "tsonic-init-surface-"));
      try {
        writeFileSync(
          join(workspaceRoot, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", private: true, type: "module" },
            null,
            2
          )
        );

        const jsRoot = join(workspaceRoot, "node_modules", "@tsonic", "js");
        mkdirSync(jsRoot, { recursive: true });
        writeFileSync(
          join(jsRoot, "package.json"),
          JSON.stringify({
            name: "@tsonic/js",
            version: "1.0.0",
            type: "module",
          })
        );
        writeFileSync(
          join(jsRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@tsonic/js",
              extends: [],
              requiredTypeRoots: ["types"],
              requiredNpmPackages: ["@tsonic/js"],
            },
            null,
            2
          )
        );

        const nodejsRoot = join(
          workspaceRoot,
          "node_modules",
          "@tsonic",
          "nodejs"
        );
        mkdirSync(nodejsRoot, { recursive: true });
        writeFileSync(
          join(nodejsRoot, "package.json"),
          JSON.stringify(
            { name: "@tsonic/nodejs", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        writeFileSync(
          join(nodejsRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@tsonic/nodejs",
              extends: ["@tsonic/js"],
              requiredTypeRoots: ["types"],
              requiredNpmPackages: ["@tsonic/nodejs", "@tsonic/js"],
            },
            null,
            2
          )
        );

        const result = getTypePackageInfo({
          surface: "@tsonic/nodejs",
          workspaceRoot,
        });
        const packageNames = result.packages.map((p) => p.name);
        expect(packageNames).to.include("@tsonic/nodejs");
        expect(packageNames).to.include("@tsonic/js");
        expect(result.typeRoots).to.include(join(jsRoot, "types"));
        expect(result.typeRoots).to.include(join(nodejsRoot, "types"));
      } finally {
        rmSync(workspaceRoot, { recursive: true, force: true });
      }
    });

    it("should support custom surface package names via fallback profile", () => {
      const result = getTypePackageInfo({ surface: "@acme/surface-web" });
      const packageNames = result.packages.map((p) => p.name);

      expect(packageNames).to.include("@acme/surface-web");
      expect(result.typeRoots).to.deep.equal([
        "node_modules/@acme/surface-web",
      ]);
    });

    describe("package versions", () => {
      it("should use latest version for all packages", () => {
        const result = getTypePackageInfo();

        for (const pkg of result.packages) {
          expect(pkg.version).to.equal("latest");
        }
      });
    });
  });

  describe("initWorkspace", () => {
    it("should allow custom surface names", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-custom-surface-"));
      try {
        const result = initWorkspace(dir, {
          skipTypes: true,
          surface: "@acme/surface-web",
        });
        expect(result.ok).to.equal(true);

        const workspaceRaw = readFileSync(
          join(dir, "tsonic.workspace.json"),
          "utf-8"
        );
        const workspace = JSON.parse(workspaceRaw) as {
          readonly surface?: string;
          readonly dotnet?: {
            readonly typeRoots?: readonly string[];
          };
        };
        expect(workspace.surface).to.equal("@acme/surface-web");
        expect(workspace.dotnet?.typeRoots).to.deep.equal([
          "node_modules/@acme/surface-web",
        ]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("should generate dotnet sample for default mode", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-default-"));
      try {
        const result = initWorkspace(dir, { skipTypes: true });
        expect(result.ok).to.equal(true);

        const workspaceName = basename(dir);
        const appTs = readFileSync(
          join(dir, "packages", workspaceName, "src", "App.ts"),
          "utf-8"
        );
        expect(appTs).to.include("@tsonic/dotnet/System.js");
        expect(appTs).to.include("Console.WriteLine");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("should write @tsonic/js surface config when requested", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-js-"));
      try {
        const result = initWorkspace(dir, {
          skipTypes: true,
          surface: "@tsonic/js",
        });
        expect(result.ok).to.equal(true);

        const workspaceRaw = readFileSync(
          join(dir, "tsonic.workspace.json"),
          "utf-8"
        );
        const workspace = JSON.parse(workspaceRaw) as {
          readonly surface?: string;
          readonly dotnet?: {
            readonly typeRoots?: readonly string[];
          };
        };
        expect(workspace.surface).to.equal("@tsonic/js");
        expect(
          (workspace.dotnet?.typeRoots ?? []).some(
            (root) =>
              root === "node_modules/@tsonic/js" ||
              /[/\\]js[/\\]versions[/\\]\d+$/.test(root)
          )
        ).to.equal(true);

        const workspaceName = basename(dir);
        const appTs = readFileSync(
          join(dir, "packages", workspaceName, "src", "App.ts"),
          "utf-8"
        );
        expect(appTs).to.include("console.log");
        expect(appTs).to.include(".trim()");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("should write @tsonic/nodejs surface config when requested", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-nodejs-"));
      try {
        writeFileSync(
          join(dir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", private: true, type: "module" },
            null,
            2
          )
        );
        const jsRoot = join(dir, "node_modules", "@tsonic", "js");
        mkdirSync(jsRoot, { recursive: true });
        writeFileSync(
          join(jsRoot, "package.json"),
          JSON.stringify({
            name: "@tsonic/js",
            version: "1.0.0",
            type: "module",
          })
        );
        writeFileSync(
          join(jsRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@tsonic/js",
              extends: [],
              requiredTypeRoots: ["types"],
              requiredNpmPackages: ["@tsonic/js"],
            },
            null,
            2
          )
        );

        const nodejsRoot = join(dir, "node_modules", "@tsonic", "nodejs");
        mkdirSync(nodejsRoot, { recursive: true });
        writeFileSync(
          join(nodejsRoot, "package.json"),
          JSON.stringify(
            { name: "@tsonic/nodejs", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        writeFileSync(
          join(nodejsRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@tsonic/nodejs",
              extends: ["@tsonic/js"],
              requiredTypeRoots: ["types"],
              requiredNpmPackages: ["@tsonic/nodejs", "@tsonic/js"],
            },
            null,
            2
          )
        );

        const result = initWorkspace(dir, {
          skipTypes: true,
          surface: "@tsonic/nodejs",
        });
        expect(result.ok).to.equal(true);

        const workspaceRaw = readFileSync(
          join(dir, "tsonic.workspace.json"),
          "utf-8"
        );
        const workspace = JSON.parse(workspaceRaw) as {
          readonly surface?: string;
          readonly dotnet?: {
            readonly typeRoots?: readonly string[];
          };
        };
        expect(workspace.surface).to.equal("@tsonic/nodejs");
        expect(
          (workspace.dotnet?.typeRoots ?? []).some(
            (root) =>
              root === join(jsRoot, "types") ||
              root === "node_modules/@tsonic/js" ||
              /[/\\]js[/\\]versions[/\\]\d+$/.test(root)
          )
        ).to.equal(true);
        expect(
          (workspace.dotnet?.typeRoots ?? []).some(
            (root) =>
              root === join(nodejsRoot, "types") ||
              root === "node_modules/@tsonic/nodejs" ||
              /[/\\]nodejs[/\\]versions[/\\]\d+$/.test(root)
          )
        ).to.equal(true);

        const workspaceName = basename(dir);
        const appTs = readFileSync(
          join(dir, "packages", workspaceName, "src", "App.ts"),
          "utf-8"
        );
        expect(appTs).to.include("console.log");
        expect(appTs).to.include(".trim()");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
