/**
 * Tests for init command
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { getTypePackageInfo } from "./init.js";

describe("Init Command", () => {
  describe("getTypePackageInfo", () => {
    describe("js runtime", () => {
      it("should return cli, core, globals, and js-globals packages", () => {
        const result = getTypePackageInfo("js");
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("@tsonic/tsonic");
        expect(packageNames).to.include("@tsonic/core");
        expect(packageNames).to.include("@tsonic/globals");
        expect(packageNames).to.include("@tsonic/js-globals");
        // dotnet is transitive dep of globals, not installed separately
        expect(packageNames).to.not.include("@tsonic/dotnet");
        expect(packageNames).to.not.include("@tsonic/nodejs");
      });

      it("should set typeRoots to globals and js-globals", () => {
        const result = getTypePackageInfo("js");
        expect(result.typeRoots).to.deep.equal([
          "node_modules/@tsonic/globals",
          "node_modules/@tsonic/js-globals",
        ]);
      });

      it("should include nodejs package when nodejs flag is true", () => {
        const result = getTypePackageInfo("js", true);
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("@tsonic/tsonic");
        expect(packageNames).to.include("@tsonic/core");
        expect(packageNames).to.include("@tsonic/globals");
        expect(packageNames).to.include("@tsonic/js-globals");
        expect(packageNames).to.include("@tsonic/nodejs");
      });

      it("should ignore pure flag in js mode", () => {
        const result = getTypePackageInfo("js", false, true);
        const packageNames = result.packages.map((p) => p.name);

        // JS mode always uses camelCase globals, not globals-pure
        expect(packageNames).to.include("@tsonic/core");
        expect(packageNames).to.include("@tsonic/globals");
        expect(packageNames).to.not.include("@tsonic/globals-pure");
      });
    });

    describe("dotnet runtime", () => {
      it("should return cli, core, and globals packages (dotnet is transitive)", () => {
        const result = getTypePackageInfo("dotnet");
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("@tsonic/tsonic");
        expect(packageNames).to.include("@tsonic/core");
        expect(packageNames).to.include("@tsonic/globals");
        // dotnet is transitive dep of globals, not installed separately
        expect(packageNames).to.not.include("@tsonic/dotnet");
        expect(packageNames).to.not.include("@tsonic/js-globals");
        expect(packageNames).to.not.include("@tsonic/nodejs");
      });

      it("should set typeRoots to globals", () => {
        const result = getTypePackageInfo("dotnet");
        expect(result.typeRoots).to.deep.equal([
          "node_modules/@tsonic/globals",
        ]);
      });

      it("should include nodejs package when nodejs flag is true", () => {
        const result = getTypePackageInfo("dotnet", true);
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("@tsonic/tsonic");
        expect(packageNames).to.include("@tsonic/core");
        expect(packageNames).to.include("@tsonic/globals");
        expect(packageNames).to.include("@tsonic/nodejs");
        // dotnet is transitive dep of globals, not installed separately
        expect(packageNames).to.not.include("@tsonic/dotnet");
      });

      it("should use globals-pure when pure flag is true", () => {
        const result = getTypePackageInfo("dotnet", false, true);
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("@tsonic/tsonic");
        expect(packageNames).to.include("@tsonic/core");
        expect(packageNames).to.include("@tsonic/globals-pure");
        expect(packageNames).to.not.include("@tsonic/globals");
        expect(result.typeRoots).to.deep.equal([
          "node_modules/@tsonic/globals-pure",
        ]);
      });

      it("should use globals-pure with nodejs when both flags are true", () => {
        const result = getTypePackageInfo("dotnet", true, true);
        const packageNames = result.packages.map((p) => p.name);

        expect(packageNames).to.include("@tsonic/tsonic");
        expect(packageNames).to.include("@tsonic/core");
        expect(packageNames).to.include("@tsonic/globals-pure");
        expect(packageNames).to.include("@tsonic/nodejs");
        expect(packageNames).to.not.include("@tsonic/globals");
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
