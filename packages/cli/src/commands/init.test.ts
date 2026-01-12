/**
 * Tests for init command
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getTypePackageInfo, initProject } from "./init.js";

describe("Init Command", () => {
  describe("getTypePackageInfo", () => {
    describe("default (no options)", () => {
      it("should return cli, core, and globals packages", () => {
        const result = getTypePackageInfo();
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("tsonic");
        expect(packageNames).to.include("@tsonic/core");
        expect(packageNames).to.include("@tsonic/globals");
        expect(packageNames).to.not.include("@tsonic/globals-pure");
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
        const result = getTypePackageInfo(true);
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("tsonic");
        expect(packageNames).to.include("@tsonic/core");
        expect(packageNames).to.include("@tsonic/globals");
        expect(packageNames).to.include("@tsonic/nodejs");
      });
    });

    describe("pure flag", () => {
      it("should use globals-pure when pure flag is true", () => {
        const result = getTypePackageInfo(false, true);
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("tsonic");
        expect(packageNames).to.include("@tsonic/core");
        expect(packageNames).to.include("@tsonic/globals-pure");
        expect(packageNames).to.not.include("@tsonic/globals");
        expect(result.typeRoots).to.deep.equal([
          "node_modules/@tsonic/globals-pure",
        ]);
      });

      it("should use globals-pure with nodejs when both flags are true", () => {
        const result = getTypePackageInfo(true, true);
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("tsonic");
        expect(packageNames).to.include("@tsonic/core");
        expect(packageNames).to.include("@tsonic/globals-pure");
        expect(packageNames).to.include("@tsonic/nodejs");
        expect(packageNames).to.not.include("@tsonic/globals");
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
        const result = getTypePackageInfo(true);
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

  describe("initProject", () => {
    it("should generate dotnet sample for default mode", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-default-"));
      try {
        const result = initProject(dir, { skipTypes: true });
        expect(result.ok).to.equal(true);

        const appTs = readFileSync(join(dir, "src", "App.ts"), "utf-8");
        expect(appTs).to.include('@tsonic/dotnet/System.js');
        expect(appTs).to.include("Console.writeLine");
        expect(appTs).to.include("File.readAllText");
        expect(appTs).to.not.include("@tsonic/dotnet-pure/System.js");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("should generate dotnet-pure sample when --pure is enabled", () => {
      const dir = mkdtempSync(join(tmpdir(), "tsonic-init-pure-"));
      try {
        const result = initProject(dir, { skipTypes: true, pure: true });
        expect(result.ok).to.equal(true);

        const appTs = readFileSync(join(dir, "src", "App.ts"), "utf-8");
        expect(appTs).to.include('@tsonic/dotnet-pure/System.js');
        expect(appTs).to.include("Console.WriteLine");
        expect(appTs).to.include("File.ReadAllText");
        expect(appTs).to.not.include("@tsonic/dotnet/System.js");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
