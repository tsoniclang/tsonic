import { getTargetIdValidationMessage, isValidTargetId, isValidTargetProviderPackageId, isValidTargetSurfaceId } from "./config.js";
import type { TargetId } from "./config.js";
import type { TargetPack } from "./pack.js";

export interface TargetRegistry {
  readonly packs: readonly TargetPack[];
  get(id: TargetId): TargetPack | undefined;
}

export function createTargetRegistry(packs: readonly TargetPack[]): TargetRegistry {
  const byId = new Map<TargetId, TargetPack>();
  for (const pack of packs) {
    if (!isValidTargetId(pack.id)) {
      throw new Error(getTargetIdValidationMessage(`Target pack id '${pack.id}'`));
    }
    if (byId.has(pack.id)) {
      throw new Error(`Duplicate target pack '${pack.id}'.`);
    }
    for (const ownership of pack.provider?.moduleOwnership ?? []) {
      validateProviderModuleOwnershipPrefix(`Target pack '${pack.id}' provider module ownership prefix`, ownership.specifierPrefix);
    }
    const packageIds = new Set<string>();
    for (const providerPackage of pack.packages ?? []) {
      if (!isValidTargetProviderPackageId(providerPackage.id)) {
        throw new Error(getTargetIdValidationMessage(`Target pack '${pack.id}' provider package id '${providerPackage.id}'`));
      }
      if (packageIds.has(providerPackage.id)) {
        throw new Error(`Target pack '${pack.id}' declares provider package '${providerPackage.id}' more than once`);
      }
      packageIds.add(providerPackage.id);
      for (const requiredPackageId of providerPackage.requiredPackages ?? []) {
        if (!isValidTargetProviderPackageId(requiredPackageId)) {
          throw new Error(getTargetIdValidationMessage(`Target pack '${pack.id}' provider package '${providerPackage.id}' required package id '${requiredPackageId}'`));
        }
      }
      for (const ownership of providerPackage.moduleOwnership ?? []) {
        validateProviderModuleOwnershipPrefix(
          `Target pack '${pack.id}' provider package '${providerPackage.id}' module ownership prefix`,
          ownership.specifierPrefix,
        );
      }
    }
    for (const surface of pack.surfaces ?? []) {
      if (!isValidTargetSurfaceId(surface.id)) {
        throw new Error(getTargetIdValidationMessage(`Target pack '${pack.id}' surface id '${surface.id}'`));
      }
      for (const requiredSurfaceId of surface.requiredSurfaces ?? []) {
        if (!isValidTargetSurfaceId(requiredSurfaceId)) {
          throw new Error(getTargetIdValidationMessage(`Target pack '${pack.id}' surface '${surface.id}' required surface id '${requiredSurfaceId}'`));
        }
      }
    }
    byId.set(pack.id, pack);
  }
  return {
    packs,
    get(id: TargetId): TargetPack | undefined {
      return byId.get(id);
    },
  };
}

function validateProviderModuleOwnershipPrefix(subject: string, prefix: string): void {
  if (
    prefix.length === 0 ||
    prefix.trim() !== prefix ||
    prefix.startsWith(".") ||
    prefix.includes("\\") ||
    prefix.includes("\0")
  ) {
    throw new Error(`${subject} '${prefix}' must be a non-empty bare/package/URL-style ESM specifier prefix, not a relative or filesystem path.`);
  }
}
