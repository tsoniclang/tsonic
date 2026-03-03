export type NodeModuleAliasResolution = {
  readonly canonicalSpecifier: string;
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
};

const NODE_SPECIFIER_MAP = new Map<string, NodeModuleAliasResolution>([
  [
    "node:assert",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "assert" },
  ],
  [
    "assert",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "assert" },
  ],
  [
    "node:buffer",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "buffer" },
  ],
  [
    "buffer",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "buffer" },
  ],
  [
    "node:child_process",
    {
      canonicalSpecifier: "@tsonic/nodejs/index.js",
      moduleName: "child_process",
    },
  ],
  [
    "child_process",
    {
      canonicalSpecifier: "@tsonic/nodejs/index.js",
      moduleName: "child_process",
    },
  ],
  [
    "node:fs",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "fs" },
  ],
  ["fs", { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "fs" }],
  [
    "node:path",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "path" },
  ],
  [
    "path",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "path" },
  ],
  [
    "node:crypto",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "crypto" },
  ],
  [
    "crypto",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "crypto" },
  ],
  [
    "node:dgram",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "dgram" },
  ],
  [
    "dgram",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "dgram" },
  ],
  [
    "node:dns",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "dns" },
  ],
  ["dns", { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "dns" }],
  [
    "node:events",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "events" },
  ],
  [
    "events",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "events" },
  ],
  [
    "node:net",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "net" },
  ],
  ["net", { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "net" }],
  [
    "node:os",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "os" },
  ],
  ["os", { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "os" }],
  [
    "node:process",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "process" },
  ],
  [
    "process",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "process" },
  ],
  [
    "node:querystring",
    {
      canonicalSpecifier: "@tsonic/nodejs/index.js",
      moduleName: "querystring",
    },
  ],
  [
    "querystring",
    {
      canonicalSpecifier: "@tsonic/nodejs/index.js",
      moduleName: "querystring",
    },
  ],
  [
    "node:readline",
    {
      canonicalSpecifier: "@tsonic/nodejs/index.js",
      moduleName: "readline",
    },
  ],
  [
    "readline",
    {
      canonicalSpecifier: "@tsonic/nodejs/index.js",
      moduleName: "readline",
    },
  ],
  [
    "node:stream",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "stream" },
  ],
  [
    "stream",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "stream" },
  ],
  [
    "node:timers",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "timers" },
  ],
  [
    "timers",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "timers" },
  ],
  [
    "node:tls",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "tls" },
  ],
  ["tls", { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "tls" }],
  [
    "node:url",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "url" },
  ],
  ["url", { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "url" }],
  [
    "node:util",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "util" },
  ],
  [
    "util",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "util" },
  ],
  [
    "node:zlib",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "zlib" },
  ],
  [
    "zlib",
    { canonicalSpecifier: "@tsonic/nodejs/index.js", moduleName: "zlib" },
  ],
]);

export const resolveNodeModuleAlias = (
  moduleSpecifier: string
): NodeModuleAliasResolution | undefined =>
  NODE_SPECIFIER_MAP.get(moduleSpecifier);
