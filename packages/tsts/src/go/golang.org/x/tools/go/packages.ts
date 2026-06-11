import type { int } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "../../../../compat.js";
import * as nodeChildProcess from "node:child_process";

export type LoadMode = int;
export const NeedName: LoadMode = 1 << 0 as LoadMode;
export const NeedFiles: LoadMode = 1 << 1 as LoadMode;
export const NeedCompiledGoFiles: LoadMode = 1 << 2 as LoadMode;
export const NeedImports: LoadMode = 1 << 3 as LoadMode;
export const NeedTypes: LoadMode = 1 << 4 as LoadMode;
export const NeedSyntax: LoadMode = 1 << 5 as LoadMode;
export const LoadAllSyntax: LoadMode = (NeedName | NeedFiles | NeedCompiledGoFiles | NeedImports | NeedTypes | NeedSyntax) as LoadMode;

export interface Config {
  Mode?: LoadMode;
  Dir?: string;
  Env?: GoSlice<string>;
}

export interface Package {
  ID: string;
  Name: string;
  PkgPath: string;
  GoFiles: GoSlice<string>;
  CompiledGoFiles: GoSlice<string>;
  Imports: Map<string, Package>;
  Errors: GoSlice<Error>;
}

export function Load(config: Config | undefined, ...patterns: GoSlice<string>): [GoSlice<Package>, GoError] {
  try {
    const args = ["list", "-json", ...patterns];
    const stdout = nodeChildProcess.execFileSync("go", args, {
      cwd: config?.Dir === "" ? undefined : config?.Dir,
      env: envObject(config?.Env),
      encoding: "utf8",
    });
    return [parseGoListJson(stdout), undefined];
  } catch (error) {
    return [[], normalizeError(error)];
  }
}

function parseGoListJson(text: string): GoSlice<Package> {
  const packages: Package[] = [];
  for (const objectText of splitConcatenatedJsonObjects(text)) {
    const value = JSON.parse(objectText) as {
      ImportPath?: string;
      Name?: string;
      GoFiles?: string[];
      CompiledGoFiles?: string[];
      Imports?: Record<string, string>;
      Error?: { Err?: string };
    };
    packages.push({
      ID: value.ImportPath ?? "",
      Name: value.Name ?? "",
      PkgPath: value.ImportPath ?? "",
      GoFiles: value.GoFiles ?? [],
      CompiledGoFiles: value.CompiledGoFiles ?? [],
      Imports: new Map(),
      Errors: value.Error?.Err ? [new globalThis.Error(value.Error.Err)] : [],
    });
  }
  return packages;
}

function splitConcatenatedJsonObjects(text: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        objects.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return objects;
}

function envObject(env: GoSlice<string> | undefined): NodeJS.ProcessEnv | undefined {
  if (env === undefined) {
    return undefined;
  }
  const result: NodeJS.ProcessEnv = {};
  for (const entry of env) {
    const index = entry.indexOf("=");
    if (index >= 0) {
      result[entry.slice(0, index)] = entry.slice(index + 1);
    }
  }
  return result;
}

function normalizeError(error: unknown): GoError {
  return error instanceof globalThis.Error ? error : new globalThis.Error(String(error));
}
