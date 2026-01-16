/**
 * tsonic add reference - add a reference to an existing local DLL (no copy, no bindings generation).
 *
 * Usage:
 *   tsonic add reference ./path/to/MyLib.dll [typesPackage]
 *
 * This command exists primarily for workspace scenarios:
 * - DLL is installed at the workspace level (e.g. workspaceRoot/lib/MyLib.dll)
 * - Projects reference it via a relative path and rely on workspace node_modules for bindings.
 */

import { basename, dirname, relative, resolve } from "node:path";
import { existsSync } from "node:fs";
import type { Result, TsonicConfig } from "../types.js";
import { loadConfig } from "../config.js";
import { writeTsonicJson } from "./add-common.js";

type LibraryConfig = string | { readonly path: string; readonly types?: string };

const normalizeLibraryPathKey = (p: string): string =>
  p.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();

const getLibraryPath = (entry: LibraryConfig): string =>
  typeof entry === "string" ? entry : entry.path;

const ensureLibraryPath = (arr: LibraryConfig[], path: string): void => {
  const key = normalizeLibraryPathKey(path);
  if (arr.some((e) => normalizeLibraryPathKey(getLibraryPath(e)) === key)) return;
  arr.push(path);
};

const ensureLibraryTypes = (
  arr: LibraryConfig[],
  path: string,
  types: string
): Result<void, string> => {
  const key = normalizeLibraryPathKey(path);
  const idx = arr.findIndex((e) => normalizeLibraryPathKey(getLibraryPath(e)) === key);
  if (idx < 0) {
    arr.push({ path, types });
    return { ok: true, value: undefined };
  }

  const existing = arr[idx];
  if (!existing) {
    arr[idx] = { path, types };
    return { ok: true, value: undefined };
  }
  if (typeof existing === "string") {
    arr[idx] = { path: existing, types };
    return { ok: true, value: undefined };
  }

  if (existing.types && existing.types !== types) {
    return {
      ok: false,
      error:
        `Library already present with a different types package:\n` +
        `- ${existing.path}\n` +
        `- existing: ${existing.types}\n` +
        `- requested: ${types}\n` +
        `Refusing to change automatically (airplane-grade). Update tsonic.json manually if intended.`,
    };
  }

  arr[idx] = { ...existing, types };
  return { ok: true, value: undefined };
};

const isValidTypesPackageName = (name: string): boolean => {
  if (!name.startsWith("@") && !name.includes("/")) return true;
  return /^@[a-z0-9-]+\/[a-z0-9-]+$/i.test(name);
};

export const addReferenceCommand = (
  dllPath: string,
  typesPackage: string | undefined,
  configPath: string
): Result<{ dll: string; bindings?: string }, string> => {
  if (!dllPath.trim()) {
    return { ok: false, error: "DLL path must be non-empty" };
  }
  if (!dllPath.toLowerCase().endsWith(".dll")) {
    return {
      ok: false,
      error: `Invalid DLL path: ${dllPath} (must end with .dll)`,
    };
  }
  if (typesPackage !== undefined && !isValidTypesPackageName(typesPackage)) {
    return { ok: false, error: `Invalid types package name: ${typesPackage}` };
  }

  const configResult = loadConfig(configPath);
  if (!configResult.ok) return configResult;
  const config = configResult.value;

  const projectRoot = dirname(configPath);
  const dllAbs = resolve(projectRoot, dllPath);
  if (!existsSync(dllAbs)) {
    return { ok: false, error: `DLL not found: ${dllAbs}` };
  }

  const rel = relative(projectRoot, dllAbs).replace(/\\/g, "/");

  const dotnet = config.dotnet ?? {};
  const libraries: LibraryConfig[] = [...((dotnet.libraries ?? []) as LibraryConfig[])];

  if (typesPackage) {
    const res = ensureLibraryTypes(libraries, rel, typesPackage);
    if (!res.ok) return res;
  } else {
    ensureLibraryPath(libraries, rel);
  }

  const nextConfig: TsonicConfig = {
    ...config,
    dotnet: {
      ...dotnet,
      libraries,
    },
  };

  const writeResult = writeTsonicJson(configPath, nextConfig);
  if (!writeResult.ok) return writeResult;

  return {
    ok: true,
    value: { dll: basename(dllAbs), bindings: typesPackage },
  };
};

