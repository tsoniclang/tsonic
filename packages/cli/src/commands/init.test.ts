/**
 * Tests for init command
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { getTypePackageInfo } from "./init.js";

describe("Init Command", () => {
  describe("getTypePackageInfo", () => {
    describe("js runtime", () => {
      it("should return js-globals and types packages", () => {
        const result = getTypePackageInfo("js");
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("@tsonic/tsonic");
        expect(packageNames).to.include("@tsonic/js-globals");
        expect(packageNames).to.include("@tsonic/types");
        expect(packageNames).to.not.include("@tsonic/dotnet");
        expect(packageNames).to.not.include("@tsonic/nodejs");
      });

      it("should set typeRoots to js-globals", () => {
        const result = getTypePackageInfo("js");
        expect(result.typeRoots).to.deep.equal([
          "node_modules/@tsonic/js-globals",
        ]);
      });

      it("should include nodejs package when nodejs flag is true", () => {
        const result = getTypePackageInfo("js", true);
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("@tsonic/tsonic");
        expect(packageNames).to.include("@tsonic/js-globals");
        expect(packageNames).to.include("@tsonic/types");
        expect(packageNames).to.include("@tsonic/nodejs");
      });
    });

    describe("dotnet runtime", () => {
      it("should return dotnet-globals and dotnet packages", () => {
        const result = getTypePackageInfo("dotnet");
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("@tsonic/tsonic");
        expect(packageNames).to.include("@tsonic/dotnet-globals");
        expect(packageNames).to.include("@tsonic/dotnet");
        expect(packageNames).to.not.include("@tsonic/js-globals");
        expect(packageNames).to.not.include("@tsonic/nodejs");
      });

      it("should set typeRoots to dotnet-globals", () => {
        const result = getTypePackageInfo("dotnet");
        expect(result.typeRoots).to.deep.equal([
          "node_modules/@tsonic/dotnet-globals",
        ]);
      });

      it("should include nodejs package when nodejs flag is true", () => {
        const result = getTypePackageInfo("dotnet", true);
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("@tsonic/tsonic");
        expect(packageNames).to.include("@tsonic/dotnet-globals");
        expect(packageNames).to.include("@tsonic/dotnet");
        expect(packageNames).to.include("@tsonic/nodejs");
      });
    });

    describe("package versions", () => {
      it("should use latest version for all packages", () => {
        const jsResult = getTypePackageInfo("js");
        const dotnetResult = getTypePackageInfo("dotnet");

        for (const pkg of jsResult.packages) {
          expect(pkg.version).to.equal("latest");
        }
        for (const pkg of dotnetResult.packages) {
          expect(pkg.version).to.equal("latest");
        }
      });

      it("should use latest version for nodejs package", () => {
        const result = getTypePackageInfo("js", true);
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
