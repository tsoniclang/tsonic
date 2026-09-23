export const invalidNativeProcessOptionValues = [
  "0.5",
  "Number.NaN",
  "Number.POSITIVE_INFINITY",
];

export function nativeProcessOptionSource(field, expression) {
  return `
    import { spawnSync } from "node:child_process";
    export function run(): void {
      const value = ${expression};
      spawnSync("must-not-be-started", [], { ${field}: value });
    }
  `;
}

export const nativeOptionContracts = [
  ["node:fs", "MakeDirectoryOptions", "mode"],
  ["node:fs", "RmOptions", "maxRetries"],
  ["node:fs", "RmOptions", "retryDelay"],
  ["node:tls", "ConnectionOptions", "port"],
  ["node:tls", "ConnectionOptions", "timeout"],
  ["node:zlib", "ZlibOptions", "level"],
  ["node:zlib", "ZlibOptions", "chunkSize"],
  ["node:zlib", "ZlibOptions", "maxOutputLength"],
];

export function nativeOptionSource(moduleSpecifier, typeName, field, expression) {
  return `
    import type { ${typeName} } from "${moduleSpecifier}";
    export function options(): ${typeName} {
      const value = ${expression};
      return { ${field}: value };
    }
  `;
}
