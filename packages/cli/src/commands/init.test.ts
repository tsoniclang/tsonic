/**
 * Tests for init command
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { getTypePackageInfo, initWorkspace } from "./init.js";

describe("Init Command", () => {
  describe("getTypePackageInfo", () => {
    describe("default (no options)", () => {
      it("should return cli, core, and globals packages", () => {
        const result = getTypePackageInfo();
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("tsonic");
        expect(packageNames).to.include("@tsonic/core");
        expect(packageNames).to.include("@tsonic/globals");
      });

      it("should set typeRoots to globals", () => {
        const result = getTypePackageInfo();
        expect(result.typeRoots).to.deep.equal([
          "node_modules/@tsonic/globals",
        ]);
      });
    });

    it("should include js package (without nodejs) for js surface", () => {
      const result = getTypePackageInfo({ surface: "js" });
      const packageNames = result.packages.map((p) => p.name);

      expect(packageNames).to.include("@tsonic/js");
      expect(packageNames).to.not.include("@tsonic/nodejs");
      expect(result.typeRoots).to.deep.equal([
        "node_modules/@tsonic/globals",
        "node_modules/@tsonic/js",
      ]);
    });

    it("should include js and nodejs packages for nodejs surface", () => {
      const result = getTypePackageInfo({ surface: "nodejs" });
      const packageNames = result.packages.map((p) => p.name);

      expect(packageNames).to.include("@tsonic/js");
      expect(packageNames).to.include("@tsonic/nodejs");
      expect(result.typeRoots).to.deep.equal([
        "node_modules/@tsonic/globals",
        "node_modules/@tsonic/js",
        "node_modules/@tsonic/nodejs",
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
    it("should fail for invalid surface mode", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-invalid-"));
      try {
        const result = initWorkspace(dir, {
          skipTypes: true,
          surface: "invalid" as never,
        });
        expect(result.ok).to.equal(false);
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

    it("should write js surface config when requested", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-js-"));
      try {
        const result = initWorkspace(dir, { skipTypes: true, surface: "js" });
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
        expect(workspace.surface).to.equal("js");
        expect(workspace.dotnet?.typeRoots).to.deep.equal([
          "node_modules/@tsonic/globals",
          "node_modules/@tsonic/js",
        ]);

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

    it("should write nodejs surface config when requested", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-nodejs-"));
      try {
        const result = initWorkspace(dir, {
          skipTypes: true,
          surface: "nodejs",
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
        expect(workspace.surface).to.equal("nodejs");
        expect(workspace.dotnet?.typeRoots).to.deep.equal([
          "node_modules/@tsonic/globals",
          "node_modules/@tsonic/js",
          "node_modules/@tsonic/nodejs",
        ]);

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
