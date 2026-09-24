export const invalidNativeProcessOptionValues = [
  "0.5",
  "Number.NaN",
  "Number.POSITIVE_INFINITY",
];

export function nativeProcessOptionSource(field, expression, { inline = false } = {}) {
  return `
    import { spawnSync } from "node:child_process";
    export function run(): void {
      ${inline ? "" : `const value = ${expression};`}
      spawnSync("must-not-be-started", [], { ${field}: ${inline ? expression : "value"} });
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
  ["node:child_process", "SpawnSyncOptionsWithBufferEncoding", "maxBuffer"],
  ["node:child_process", "SpawnSyncOptionsWithBufferEncoding", "uid"],
  ["node:child_process", "SpawnSyncOptionsWithBufferEncoding", "gid"],
  ["node:child_process", "SpawnSyncOptionsWithBufferEncoding", "timeout"],
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

export const nativeOptionRuntimeSource = `
import type { MakeDirectoryOptions as MutableOptions } from "node:fs";
function mutate(value: number): MutableOptions {
  const options: MutableOptions = {};
  options.mode = value;
  return options;
}
function optionalMutation(value: number | undefined): MutableOptions {
  const options: MutableOptions = {};
  options.mode = value;
  return options;
}
function fromLocal(value: number): MutableOptions {
  const options = { mode: value };
  const alias = options;
  return alias;
}
${nativeOptionContracts.map(([moduleSpecifier, typeName, field], index) => `
import type { ${typeName} as Option${index} } from "${moduleSpecifier}";
function option${index}(value: number): Option${index} { return { ${field}: value }; }
`).join("\n")}
export function run(): boolean {
  const mutable = mutate(7);
  if (mutable.mode !== 7) return false;
  if (optionalMutation(undefined).mode !== undefined) return false;
  const optional = optionalMutation(11);
  if (optional.mode !== 11 || fromLocal(13).mode !== 13) return false;
  for (const invalid of [0.5, Number.NaN, Number.POSITIVE_INFINITY, 1e100]) {
    let rejected = false;
    try { mutable.mode = invalid; } catch { rejected = true; }
    if (!rejected || mutable.mode !== 7) return false;
    rejected = false;
    try { optionalMutation(invalid); } catch { rejected = true; }
    if (!rejected || optional.mode !== 11) return false;
    rejected = false;
    try { fromLocal(invalid); } catch { rejected = true; }
    if (!rejected) return false;
  }
  ${nativeOptionContracts.map(([, , field], index) => `
  if (option${index}(1).${field} !== 1) return false;
  for (const invalid of [0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e100]) {
    let rejected = false;
    try { option${index}(invalid); } catch { rejected = true; }
    if (!rejected) return false;
  }
  `).join("\n")}
  return true;
}
`;
