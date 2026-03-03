import { describe, it } from "mocha";
import { expect } from "chai";
import { resolveNodeModuleAlias } from "./node-module-aliases.js";

describe("Node Module Aliases", () => {
  const expectedCanonical = "@tsonic/nodejs/index.js";

  it("should canonicalize all supported node aliases", () => {
    const cases: Array<{
      readonly specifier: string;
      readonly moduleName: "fs" | "path" | "crypto" | "os" | "process";
    }> = [
      { specifier: "node:fs", moduleName: "fs" },
      { specifier: "fs", moduleName: "fs" },
      { specifier: "node:path", moduleName: "path" },
      { specifier: "path", moduleName: "path" },
      { specifier: "node:crypto", moduleName: "crypto" },
      { specifier: "crypto", moduleName: "crypto" },
      { specifier: "node:os", moduleName: "os" },
      { specifier: "os", moduleName: "os" },
      { specifier: "node:process", moduleName: "process" },
      { specifier: "process", moduleName: "process" },
    ];

    for (const testCase of cases) {
      const resolved = resolveNodeModuleAlias(testCase.specifier);
      expect(resolved).to.not.equal(undefined);
      if (!resolved) continue;
      expect(resolved.canonicalSpecifier).to.equal(expectedCanonical);
      expect(resolved.moduleName).to.equal(testCase.moduleName);
    }
  });

  it("should return undefined for unsupported modules", () => {
    expect(resolveNodeModuleAlias("node:http")).to.equal(undefined);
    expect(resolveNodeModuleAlias("http")).to.equal(undefined);
    expect(resolveNodeModuleAlias("node:buffer")).to.equal(undefined);
  });
});
