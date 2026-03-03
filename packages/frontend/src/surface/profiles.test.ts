import { expect } from "chai";
import { describe, it } from "mocha";
import { resolveSurfaceCapabilities } from "./profiles.js";

describe("Frontend Surface Profiles", () => {
  it("should resolve clr capabilities", () => {
    const caps = resolveSurfaceCapabilities("clr");
    expect(caps.requiredTypeRoots).to.deep.equal([
      "node_modules/@tsonic/globals",
    ]);
    expect(caps.useStandardLib).to.equal(false);
    expect(caps.enableJsBuiltins).to.equal(false);
    expect(caps.enableNodeModuleAliases).to.equal(false);
  });

  it("should resolve js capabilities without node aliases", () => {
    const caps = resolveSurfaceCapabilities("js");
    expect(caps.requiredTypeRoots).to.deep.equal([
      "node_modules/@tsonic/globals",
      "node_modules/@tsonic/js",
    ]);
    expect(caps.useStandardLib).to.equal(false);
    expect(caps.enableJsBuiltins).to.equal(true);
    expect(caps.enableNodeModuleAliases).to.equal(false);
  });

  it("should resolve nodejs capabilities as js + node aliases", () => {
    const caps = resolveSurfaceCapabilities("nodejs");
    expect(caps.requiredTypeRoots).to.deep.equal([
      "node_modules/@tsonic/globals",
      "node_modules/@tsonic/js",
      "node_modules/@tsonic/nodejs",
    ]);
    expect(caps.useStandardLib).to.equal(false);
    expect(caps.enableJsBuiltins).to.equal(true);
    expect(caps.enableNodeModuleAliases).to.equal(true);
  });

  it("should default to clr when mode is undefined", () => {
    const caps = resolveSurfaceCapabilities(undefined);
    expect(caps.mode).to.equal("clr");
    expect(caps.requiredTypeRoots).to.deep.equal([
      "node_modules/@tsonic/globals",
    ]);
    expect(caps.enableNodeModuleAliases).to.equal(false);
  });
});
