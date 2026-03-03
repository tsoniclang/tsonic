import { expect } from "chai";
import { describe, it } from "mocha";
import { isSurfaceMode, resolveSurfaceCapabilities } from "./profiles.js";

describe("CLI Surface Profiles", () => {
  it("should resolve clr capabilities", () => {
    const caps = resolveSurfaceCapabilities("clr");
    expect(caps.requiredTypeRoots).to.deep.equal([
      "node_modules/@tsonic/globals",
    ]);
    expect(caps.requiredNpmPackages).to.deep.equal([]);
    expect(caps.useStandardLib).to.equal(false);
  });

  it("should resolve js capabilities without node host requirements", () => {
    const caps = resolveSurfaceCapabilities("js");
    expect(caps.requiredTypeRoots).to.deep.equal([
      "node_modules/@tsonic/globals",
      "node_modules/@tsonic/js",
    ]);
    expect(caps.requiredNpmPackages).to.deep.equal(["@tsonic/js"]);
    expect(caps.useStandardLib).to.equal(false);
  });

  it("should resolve nodejs capabilities as js + nodejs", () => {
    const caps = resolveSurfaceCapabilities("nodejs");
    expect(caps.requiredTypeRoots).to.deep.equal([
      "node_modules/@tsonic/globals",
      "node_modules/@tsonic/js",
      "node_modules/@tsonic/nodejs",
    ]);
    expect(caps.requiredNpmPackages).to.deep.equal([
      "@tsonic/js",
      "@tsonic/nodejs",
    ]);
    expect(caps.useStandardLib).to.equal(false);
  });

  it("should validate surface mode strings", () => {
    expect(isSurfaceMode("clr")).to.equal(true);
    expect(isSurfaceMode("js")).to.equal(true);
    expect(isSurfaceMode("nodejs")).to.equal(true);
    expect(isSurfaceMode("web")).to.equal(false);
  });

  it("should default to clr when mode is undefined", () => {
    const caps = resolveSurfaceCapabilities(undefined);
    expect(caps.mode).to.equal("clr");
    expect(caps.requiredTypeRoots).to.deep.equal([
      "node_modules/@tsonic/globals",
    ]);
  });
});
