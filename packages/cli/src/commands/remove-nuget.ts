/**
 * tsonic remove nuget - remove a NuGet PackageReference from the workspace.
 *
 * Usage:
 *   tsonic remove nuget <PackageId>
 *
 * Airplane-grade rules:
 * - Deterministic edit: removes exactly one PackageReference by id (case-insensitive)
 * - Always runs `tsonic restore` afterwards to keep local bindings consistent
 */

import type {
  Result,
  TsonicWorkspaceConfig,
  PackageReferenceConfig,
} from "../types.js";
import { loadWorkspaceConfig } from "../config.js";
import { writeTsonicJson, type AddCommandOptions } from "./add-common.js";
import { restoreCommand } from "./restore.js";

const normalizePkgId = (id: string): string => id.trim().toLowerCase();

export const removeNugetCommand = (
  id: string,
  configPath: string,
  options: AddCommandOptions = {}
): Result<{ packageId: string }, string> => {
  if (!id.trim()) {
    return { ok: false, error: "NuGet package id must be non-empty" };
  }

  const configResult = loadWorkspaceConfig(configPath);
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

  const nextConfig: TsonicWorkspaceConfig = {
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
