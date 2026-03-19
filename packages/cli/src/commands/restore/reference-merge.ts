import type {
  FrameworkReferenceConfig,
  PackageReferenceConfig,
  Result,
} from "../../types.js";
import { normalizePkgId } from "./shared.js";

const normalizeFrameworkId = (id: string): string => id.trim().toLowerCase();

export const mergeFrameworkReferences = (
  a: readonly FrameworkReferenceConfig[],
  b: readonly FrameworkReferenceConfig[]
): Result<readonly FrameworkReferenceConfig[], string> => {
  const byId = new Map<string, FrameworkReferenceConfig>();

  const upsert = (ref: FrameworkReferenceConfig): Result<void, string> => {
    const id = typeof ref === "string" ? ref : ref.id;
    const key = normalizeFrameworkId(id);
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, ref);
      return { ok: true, value: undefined };
    }

    const existingId = typeof existing === "string" ? existing : existing.id;
    const existingTypes =
      typeof existing === "string" ? undefined : existing.types;
    const nextTypes = typeof ref === "string" ? undefined : ref.types;
    if (
      existingTypes !== undefined &&
      nextTypes !== undefined &&
      existingTypes !== nextTypes
    ) {
      return {
        ok: false,
        error:
          `Conflicting FrameworkReference 'types' mapping for '${existingId}'.\n` +
          `Existing: ${String(existingTypes)}\n` +
          `New: ${String(nextTypes)}\n` +
          `Use a single mapping at the workspace level.`,
      };
    }

    const mergedTypes =
      existingTypes !== undefined ? existingTypes : nextTypes;
    byId.set(
      key,
      mergedTypes === undefined
        ? existingId
        : { id: existingId, types: mergedTypes }
    );
    return { ok: true, value: undefined };
  };

  for (const ref of a) {
    const result = upsert(ref);
    if (!result.ok) return result;
  }
  for (const ref of b) {
    const result = upsert(ref);
    if (!result.ok) return result;
  }

  return {
    ok: true,
    value: Array.from(byId.values()).sort((left, right) => {
      const leftId = typeof left === "string" ? left : left.id;
      const rightId = typeof right === "string" ? right : right.id;
      return leftId.localeCompare(rightId);
    }),
  };
};

export const mergePackageReferences = (
  a: readonly PackageReferenceConfig[],
  b: readonly PackageReferenceConfig[]
): Result<readonly PackageReferenceConfig[], string> => {
  const byId = new Map<string, PackageReferenceConfig>();

  for (const pkg of [...a, ...b]) {
    const key = normalizePkgId(pkg.id);
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, pkg);
      continue;
    }
    if (existing.version !== pkg.version) {
      return {
        ok: false,
        error:
          `Conflicting PackageReference versions for '${pkg.id}': '${existing.version}' vs '${pkg.version}'.\n` +
          `Use a single version at the workspace level.`,
      };
    }
    if (
      existing.types !== undefined &&
      pkg.types !== undefined &&
      existing.types !== pkg.types
    ) {
      return {
        ok: false,
        error:
          `Conflicting PackageReference 'types' mapping for '${existing.id}'.\n` +
          `Existing: ${String(existing.types)}\n` +
          `New: ${String(pkg.types)}\n` +
          `Use a single mapping at the workspace level.`,
      };
    }

    const mergedTypes =
      existing.types !== undefined ? existing.types : pkg.types;
    byId.set(
      key,
      mergedTypes === undefined
        ? existing
        : { id: existing.id, version: existing.version, types: mergedTypes }
    );
  }

  return {
    ok: true,
    value: Array.from(byId.values()).sort((left, right) =>
      left.id.localeCompare(right.id)
    ),
  };
};
