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
        expect(packageNames).to.not.include("@tsonic/nodejs");
        expect(packageNames).to.not.include("@tsonic/js");
      });

      it("should set typeRoots to globals", () => {
        const result = getTypePackageInfo();
        expect(result.typeRoots).to.deep.equal([
          "node_modules/@tsonic/globals",
        ]);
      });
    });

    describe("nodejs flag", () => {
      it("should include nodejs package when nodejs flag is true", () => {
        const result = getTypePackageInfo({ nodejs: true });
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("tsonic");
        expect(packageNames).to.include("@tsonic/core");
        expect(packageNames).to.include("@tsonic/globals");
        expect(packageNames).to.include("@tsonic/nodejs");
      });
    });

    describe("js flag", () => {
      it("should include js package when js flag is true", () => {
        const result = getTypePackageInfo({ js: true });
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("tsonic");
        expect(packageNames).to.include("@tsonic/core");
        expect(packageNames).to.include("@tsonic/globals");
        expect(packageNames).to.include("@tsonic/js");
      });
    });

    describe("package versions", () => {
      it("should use latest version for all packages", () => {
        const result = getTypePackageInfo();

        for (const pkg of result.packages) {
          expect(pkg.version).to.equal("latest");
        }
      });

      it("should use latest version for nodejs package", () => {
        const result = getTypePackageInfo({ nodejs: true });
        const nodejsPkg = result.packages.find(
          (p) => p.name === "@tsonic/nodejs"
        );

        if (nodejsPkg === undefined) {
          throw new Error("@tsonic/nodejs package not found");
        }
        expect(nodejsPkg.version).to.equal("latest");
      });
    });
  });

  describe("initWorkspace", () => {
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
        expect(appTs).to.include('@tsonic/dotnet/System.js');
        expect(appTs).to.include("Console.WriteLine");
        expect(appTs).to.include("File.ReadAllText");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("should generate js sample when --js is enabled", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-js-"));
      try {
        const result = initWorkspace(dir, { skipTypes: true, js: true });
        expect(result.ok).to.equal(true);

        const workspaceName = basename(dir);
        const appTs = readFileSync(
          join(dir, "packages", workspaceName, "src", "App.ts"),
          "utf-8"
        );
        expect(appTs).to.include('@tsonic/js/index.js');
        expect(appTs).to.include("JSON.parse");
        expect(appTs).to.include("JSON.stringify");

        const config = JSON.parse(
          readFileSync(join(dir, "tsonic.workspace.json"), "utf-8")
        ) as {
          dotnet?: { libraries?: unknown };
        };
        expect(config.dotnet?.libraries).to.deep.equal(["libs/Tsonic.JSRuntime.dll"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("should generate nodejs sample when --nodejs is enabled", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-nodejs-"));
      try {
        const result = initWorkspace(dir, { skipTypes: true, nodejs: true });
        expect(result.ok).to.equal(true);

        const workspaceName = basename(dir);
        const appTs = readFileSync(
          join(dir, "packages", workspaceName, "src", "App.ts"),
          "utf-8"
        );
        expect(appTs).to.include('@tsonic/nodejs/index.js');
        expect(appTs).to.include("console.log");

        const config = JSON.parse(
          readFileSync(join(dir, "tsonic.workspace.json"), "utf-8")
        ) as {
          dotnet?: { libraries?: unknown };
        };
        expect(config.dotnet?.libraries).to.deep.equal([
          "libs/Tsonic.JSRuntime.dll",
          "libs/nodejs.dll",
        ]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

  });
});
