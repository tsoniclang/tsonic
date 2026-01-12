/**
 * tsonic remove nuget - remove a NuGet PackageReference from the project.
 *
 * Usage:
 *   tsonic remove nuget <PackageId>
 *
 * Airplane-grade rules:
 * - Deterministic edit: removes exactly one PackageReference by id (case-insensitive)
 * - Always runs `tsonic restore` afterwards to keep local bindings consistent
 */

import type { Result, TsonicConfig } from "../types.js";
import { loadConfig } from "../config.js";
import { writeTsonicJson, type AddCommandOptions } from "./add-common.js";
import { restoreCommand } from "./restore.js";

type PackageReferenceConfig = {
  readonly id: string;
  readonly version: string;
  readonly types?: string;
};

const normalizePkgId = (id: string): string => id.trim().toLowerCase();

export const removeNugetCommand = (
  id: string,
  configPath: string,
  options: AddCommandOptions = {}
): Result<{ packageId: string }, string> => {
  if (!id.trim()) {
    return { ok: false, error: "NuGet package id must be non-empty" };
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

  existing.splice(idx, 1);

  const nextConfig: TsonicConfig = {
    ...config,
    dotnet: {
      ...dotnet,
      packageReferences: existing,
    },
  };

  const writeResult = writeTsonicJson(configPath, nextConfig);
  if (!writeResult.ok) return writeResult;

  const restoreResult = restoreCommand(configPath, options);
  if (!restoreResult.ok) return restoreResult;

  return { ok: true, value: { packageId: id } };
};

