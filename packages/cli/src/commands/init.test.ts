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
  });
});
