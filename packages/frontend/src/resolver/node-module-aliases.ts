export type NodeModuleAliasResolution = {
  readonly canonicalSpecifier: string;
  readonly moduleName: "fs" | "path" | "crypto" | "os" | "process";
};

const NODE_SPECIFIER_MAP = new Map<string, NodeModuleAliasResolution>([
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
]);

export const resolveNodeModuleAlias = (
  moduleSpecifier: string
): NodeModuleAliasResolution | undefined =>
  NODE_SPECIFIER_MAP.get(moduleSpecifier);
