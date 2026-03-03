import { describe, it } from "mocha";
import { expect } from "chai";
import { resolveNodeModuleAlias } from "./node-module-aliases.js";

describe("Node Module Aliases", () => {
  const expectedCanonical = "@tsonic/nodejs/index.js";

  it("should canonicalize all supported node aliases", () => {
    const cases: Array<{
      readonly specifier: string;
      readonly moduleName:
        | "assert"
        | "buffer"
        | "child_process"
        | "crypto"
        | "dgram"
        | "dns"
        | "events"
        | "fs"
        | "net"
        | "os"
        | "path"
        | "process"
        | "querystring"
        | "readline"
        | "stream"
        | "timers"
        | "tls"
        | "url"
        | "util"
        | "zlib";
    }> = [
      { specifier: "node:assert", moduleName: "assert" },
      { specifier: "assert", moduleName: "assert" },
      { specifier: "node:buffer", moduleName: "buffer" },
      { specifier: "buffer", moduleName: "buffer" },
      { specifier: "node:child_process", moduleName: "child_process" },
      { specifier: "child_process", moduleName: "child_process" },
      { specifier: "node:dgram", moduleName: "dgram" },
      { specifier: "dgram", moduleName: "dgram" },
      { specifier: "node:dns", moduleName: "dns" },
      { specifier: "dns", moduleName: "dns" },
      { specifier: "node:events", moduleName: "events" },
      { specifier: "events", moduleName: "events" },
      { specifier: "node:fs", moduleName: "fs" },
      { specifier: "fs", moduleName: "fs" },
      { specifier: "node:net", moduleName: "net" },
      { specifier: "net", moduleName: "net" },
      { specifier: "node:path", moduleName: "path" },
      { specifier: "path", moduleName: "path" },
      { specifier: "node:crypto", moduleName: "crypto" },
      { specifier: "crypto", moduleName: "crypto" },
      { specifier: "node:os", moduleName: "os" },
      { specifier: "os", moduleName: "os" },
      { specifier: "node:process", moduleName: "process" },
      { specifier: "process", moduleName: "process" },
      { specifier: "node:querystring", moduleName: "querystring" },
      { specifier: "querystring", moduleName: "querystring" },
      { specifier: "node:readline", moduleName: "readline" },
      { specifier: "readline", moduleName: "readline" },
      { specifier: "node:stream", moduleName: "stream" },
      { specifier: "stream", moduleName: "stream" },
      { specifier: "node:timers", moduleName: "timers" },
      { specifier: "timers", moduleName: "timers" },
      { specifier: "node:tls", moduleName: "tls" },
      { specifier: "tls", moduleName: "tls" },
      { specifier: "node:url", moduleName: "url" },
      { specifier: "url", moduleName: "url" },
      { specifier: "node:util", moduleName: "util" },
      { specifier: "util", moduleName: "util" },
      { specifier: "node:zlib", moduleName: "zlib" },
      { specifier: "zlib", moduleName: "zlib" },
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
    expect(resolveNodeModuleAlias("node:vm")).to.equal(undefined);
  });
});
