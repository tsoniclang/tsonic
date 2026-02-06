/**
 * tsonic add nuget - add a NuGet PackageReference to the workspace, plus bindings.
 *
 * Usage:
 *   tsonic add nuget <PackageId> <Version> [typesPackage]
 *
 * Airplane-grade rules:
 * - Versions are pinned (no automatic upgrades/downgrades)
 * - If a types package is provided, we do NOT auto-generate bindings
 * - If types are omitted, we auto-generate bindings for the full transitive closure
 *   via `tsonic restore` (single source of truth)
 */

import type { Result, TsonicWorkspaceConfig, PackageReferenceConfig } from "../types.js";
import { loadWorkspaceConfig } from "../config.js";
import { dirname } from "node:path";
import {
  defaultBindingsPackageNameForNuget,
  npmInstallDevDependency,
  writeTsonicJson,
  type AddCommandOptions,
} from "./add-common.js";
import { restoreCommand } from "./restore.js";

export type AddNugetOptions = AddCommandOptions;

const normalizePkgId = (id: string): string => id.trim().toLowerCase();

const isValidTypesPackageName = (name: string): boolean => {
  if (!name.startsWith("@") && !name.includes("/")) return true;
  return /^@[a-z0-9-]+\/[a-z0-9-]+$/i.test(name);
};

export const addNugetCommand = (
  id: string,
  ver: string,
  typesPackage: string | undefined,
  configPath: string,
  options: AddNugetOptions = {}
): Result<{ packageId: string; version: string; bindings: string }, string> => {
  const workspaceRoot = dirname(configPath);
  if (!id.trim()) {
    return { ok: false, error: "NuGet package id must be non-empty" };
  }
  if (!ver.trim()) {
    return { ok: false, error: "NuGet version must be non-empty" };
  }
  if (typesPackage !== undefined && !isValidTypesPackageName(typesPackage)) {
    return { ok: false, error: `Invalid types package name: ${typesPackage}` };
  }

  const tsonicConfigResult = loadWorkspaceConfig(configPath);
  if (!tsonicConfigResult.ok) return tsonicConfigResult;
  const config = tsonicConfigResult.value;

  const dotnet = config.dotnet ?? {};
  const existing: PackageReferenceConfig[] = [
    ...((dotnet.packageReferences ?? []) as PackageReferenceConfig[]),
  ];

  const idx = existing.findIndex(
    (p) => normalizePkgId(p.id) === normalizePkgId(id)
  );

  if (idx >= 0) {
    const current = existing[idx];
    if (current?.version !== ver) {
      return {
        ok: false,
        error:
          `NuGet package already present with a different version: ${current?.id} ${current?.version}\n` +
          `Refusing to change versions automatically (airplane-grade). Update tsonic.workspace.json manually if intended.`,
      };
    }

    if (typesPackage) {
      if (current?.types !== undefined && current.types !== typesPackage) {
        return {
          ok: false,
          error:
            `NuGet package already present with a different types package:\n` +
            `- ${current.id} ${current.version}\n` +
            `- existing: ${current.types}\n` +
            `- requested: ${typesPackage}\n` +
            `Refusing to change automatically (airplane-grade). Update tsonic.workspace.json manually if intended.`,
        };
      }

      existing[idx] = { ...current, types: typesPackage };
    }
  } else {
    existing.push(
      typesPackage ? { id, version: ver, types: typesPackage } : { id, version: ver }
    );
  }

  const nextConfig: TsonicWorkspaceConfig = {
    ...config,
    dotnet: {
      ...dotnet,
      packageReferences: existing,
    },
  };

  const writeResult = writeTsonicJson(configPath, nextConfig);
  if (!writeResult.ok) return writeResult;

  const declared = existing.find((p) => normalizePkgId(p.id) === normalizePkgId(id));
  const declaredTypes = declared?.types;

  const bindings =
    typesPackage ??
    (typeof declaredTypes === "string" ? declaredTypes : undefined) ??
    defaultBindingsPackageNameForNuget(id);

  if (typesPackage) {
    const installResult = npmInstallDevDependency(
      workspaceRoot,
      typesPackage,
      options
    );
    if (!installResult.ok) return installResult;
    return { ok: true, value: { packageId: id, version: ver, bindings } };
  }

  // Auto-generate bindings for all auto-gen dependencies (including transitive deps).
  const restoreResult = restoreCommand(configPath, options);
  if (!restoreResult.ok) return restoreResult;

  return { ok: true, value: { packageId: id, version: ver, bindings } };
};
