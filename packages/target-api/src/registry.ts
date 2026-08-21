import { getTargetIdValidationMessage, isValidTargetId, isValidTargetSurfaceId } from "./config.js";
import type { TargetId } from "./config.js";
import type { TargetPack } from "./target/pack.js";

export interface TargetRegistry {
  readonly packs: readonly TargetPack[];
  get(id: TargetId): TargetPack | undefined;
}

export function createTargetRegistry(packs: readonly TargetPack[]): TargetRegistry {
  const byId = new Map<TargetId, TargetPack>();
  for (const pack of packs) {
    validateTargetPackContract(pack);
    if (!isValidTargetId(pack.id)) {
      throw new Error(getTargetIdValidationMessage(`Target pack id '${pack.id}'`));
    }
    if (byId.has(pack.id)) {
      throw new Error(`Duplicate target pack '${pack.id}'.`);
    }
    for (const ownership of pack.provider.moduleOwnership) {
      validateProviderModuleOwnershipPrefix(`Target pack '${pack.id}' provider module ownership prefix`, ownership.specifierPrefix);
    }
    for (const surface of pack.surfaces) {
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

function validateTargetPackContract(pack: TargetPack): void {
  if (
    pack.provider === undefined ||
    typeof pack.provider.id !== "string" ||
    pack.provider.id.length === 0 ||
    typeof pack.provider.displayName !== "string" ||
    !Array.isArray(pack.provider.moduleOwnership)
  ) {
    throw new Error(`Target pack '${pack.id}' must declare one complete provider descriptor.`);
  }
  if (!Array.isArray(pack.surfaces)) {
    throw new Error(`Target pack '${pack.id}' must declare its surface list.`);
  }
  if (typeof pack.createCompilationSession !== "function") {
    throw new Error(`Target pack '${pack.id}' must declare one compilation-session factory.`);
  }
  if (typeof pack.createToolchain !== "function") {
    throw new Error(`Target pack '${pack.id}' must declare one toolchain factory.`);
  }
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
