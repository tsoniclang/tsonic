/**
 * Tests for init command
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { getTypePackageInfo } from "./init.js";

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
});
