/**
 * tsonic update nuget - update an existing NuGet PackageReference in the project.
 *
 * Usage:
 *   tsonic update nuget <PackageId> <Version> [typesPackage]
 *
 * Airplane-grade rules:
 * - Versions are pinned (explicit update only; no automatic upgrades)
 * - Always runs `tsonic restore` afterwards to keep local bindings consistent
 */

import type { Result, TsonicConfig } from "../types.js";
import { loadConfig } from "../config.js";
import { dirname } from "node:path";
import {
  npmInstallDevDependency,
  writeTsonicJson,
  type AddCommandOptions,
} from "./add-common.js";
import { restoreCommand } from "./restore.js";

type PackageReferenceConfig = {
  readonly id: string;
  readonly version: string;
  readonly types?: string;
};

const normalizePkgId = (id: string): string => id.trim().toLowerCase();

const isValidTypesPackageName = (name: string): boolean => {
  if (!name.startsWith("@") && !name.includes("/")) return true;
  return /^@[a-z0-9-]+\/[a-z0-9-]+$/i.test(name);
};

export const updateNugetCommand = (
  id: string,
  ver: string,
  typesPackage: string | undefined,
  configPath: string,
  options: AddCommandOptions = {}
): Result<{ packageId: string; version: string; bindings?: string }, string> => {
  if (!id.trim()) {
    return { ok: false, error: "NuGet package id must be non-empty" };
  }
  if (!ver.trim()) {
    return { ok: false, error: "NuGet version must be non-empty" };
  }
  if (typesPackage !== undefined && !isValidTypesPackageName(typesPackage)) {
    return { ok: false, error: `Invalid types package name: ${typesPackage}` };
  }

  const configResult = loadConfig(configPath);
  if (!configResult.ok) return configResult;
  const config = configResult.value;

  const dotnet = config.dotnet ?? {};
  const existing: PackageReferenceConfig[] = [
    ...((dotnet.packageReferences ?? []) as PackageReferenceConfig[]),
  ];

  const idx = existing.findIndex(
    (p) => normalizePkgId(p.id) === normalizePkgId(id)
  );
  if (idx < 0) {
    return { ok: false, error: `NuGet package not found in config: ${id}` };
  }

  const current = existing[idx];
  if (!current) {
    return {
      ok: false,
      error: `Invalid config: dotnet.packageReferences[${idx}] is missing`,
    };
  }
  existing[idx] = typesPackage
    ? { id: current.id, version: ver, types: typesPackage }
    : { id: current.id, version: ver, types: current.types };

  const nextConfig: TsonicConfig = {
    ...config,
    dotnet: {
      ...dotnet,
      packageReferences: existing,
    },
  };

  const writeResult = writeTsonicJson(configPath, nextConfig);
  if (!writeResult.ok) return writeResult;

  if (typesPackage) {
    const installResult = npmInstallDevDependency(
      dirname(configPath),
      typesPackage,
      options
    );
    if (!installResult.ok) return installResult;
  }

  const restoreResult = restoreCommand(configPath, options);
  if (!restoreResult.ok) return restoreResult;

  return {
    ok: true,
    value: { packageId: id, version: ver, bindings: typesPackage },
  };
};
