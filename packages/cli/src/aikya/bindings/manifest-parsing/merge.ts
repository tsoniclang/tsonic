import type {
  FrameworkReferenceConfig,
  PackageReferenceConfig,
  Result,
} from "../../../types.js";
import { errorWithCode, normalizeId } from "../shared.js";
import type { ManifestDotnet } from "../types.js";

const sortFrameworkReferences = (
  refs: readonly FrameworkReferenceConfig[]
): FrameworkReferenceConfig[] =>
  [...refs].sort((a, b) => {
    const idA = typeof a === "string" ? a : a.id;
    const idB = typeof b === "string" ? b : b.id;
    return normalizeId(idA).localeCompare(normalizeId(idB));
  });

const sortPackageReferences = (
  refs: readonly PackageReferenceConfig[]
): PackageReferenceConfig[] =>
  [...refs].sort((a, b) => {
    const byId = normalizeId(a.id).localeCompare(normalizeId(b.id));
    if (byId !== 0) return byId;
    return a.version.localeCompare(b.version);
  });

const sortMsbuildProperties = (
  props: Readonly<Record<string, string>>
): Record<string, string> => {
  const out: Record<string, string> = {};
  const keys = Object.keys(props).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    const value = props[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
};

export const canonicalizeManifestDotnet = (
  dotnet: ManifestDotnet | undefined
): ManifestDotnet | undefined => {
  if (!dotnet) return undefined;
  const frameworkReferences = sortFrameworkReferences(
    (dotnet.frameworkReferences ?? []) as FrameworkReferenceConfig[]
  );
  const packageReferences = sortPackageReferences(
    (dotnet.packageReferences ?? []) as PackageReferenceConfig[]
  );
  const msbuildProperties = sortMsbuildProperties(
    (dotnet.msbuildProperties ?? {}) as Record<string, string>
  );

  const hasMsbuild = Object.keys(msbuildProperties).length > 0;
  const hasFramework = frameworkReferences.length > 0;
  const hasPackage = packageReferences.length > 0;
  if (!hasMsbuild && !hasFramework && !hasPackage) {
    return undefined;
  }

  return {
    frameworkReferences: hasFramework ? frameworkReferences : undefined,
    packageReferences: hasPackage ? packageReferences : undefined,
    msbuildProperties: hasMsbuild ? msbuildProperties : undefined,
  };
};

export const mergeFrameworkReferences = (
  existing: readonly FrameworkReferenceConfig[],
  incoming: readonly FrameworkReferenceConfig[],
  conflictCode: string | undefined = undefined
): Result<FrameworkReferenceConfig[], string> => {
  const out: FrameworkReferenceConfig[] = [...existing];
  const byId = new Map<string, FrameworkReferenceConfig>();
  for (const ref of out) {
    const id = typeof ref === "string" ? ref : ref.id;
    byId.set(normalizeId(id), ref);
  }

  for (const ref of incoming) {
    const id = typeof ref === "string" ? ref : ref.id;
    const key = normalizeId(id);
    const current = byId.get(key);
    if (!current) {
      out.push(ref);
      byId.set(key, ref);
      continue;
    }

    const currentTypes =
      typeof current === "string" ? undefined : current.types;
    const nextTypes = typeof ref === "string" ? undefined : ref.types;

    if (
      nextTypes !== undefined &&
      currentTypes !== undefined &&
      currentTypes !== nextTypes
    ) {
      const msg =
        `Conflicting framework types mapping for '${id}'.\n` +
        `Existing: ${String(currentTypes)}\n` +
        `Incoming: ${String(nextTypes)}\n` +
        `Refusing to merge automatically (airplane-grade).`;
      return conflictCode
        ? errorWithCode(conflictCode, msg)
        : { ok: false, error: msg };
    }

    if (typeof current === "string" && typeof ref !== "string") {
      const index = out.findIndex(
        (entry) =>
          normalizeId(typeof entry === "string" ? entry : entry.id) ===
          normalizeId(current)
      );
      if (index >= 0) out[index] = { id: current, types: ref.types };
      byId.set(key, out[index] as FrameworkReferenceConfig);
    }
  }

  return { ok: true, value: sortFrameworkReferences(out) };
};

export const mergePackageReferences = (
  existing: readonly PackageReferenceConfig[],
  incoming: readonly PackageReferenceConfig[],
  conflictCode: string | undefined = undefined
): Result<PackageReferenceConfig[], string> => {
  const out: PackageReferenceConfig[] = [...existing];
  const byId = new Map<string, PackageReferenceConfig>();
  for (const pkg of out) byId.set(normalizeId(pkg.id), pkg);

  for (const pkg of incoming) {
    const key = normalizeId(pkg.id);
    const current = byId.get(key);
    if (!current) {
      out.push(pkg);
      byId.set(key, pkg);
      continue;
    }

    if (current.version !== pkg.version) {
      const msg =
        `NuGet package already present with a different version: ${current.id} ${current.version}\n` +
        `Incoming requested: ${pkg.id} ${pkg.version}\n` +
        `Refusing to merge automatically (airplane-grade).`;
      return conflictCode
        ? errorWithCode(conflictCode, msg)
        : { ok: false, error: msg };
    }

    if (
      pkg.types !== undefined &&
      current.types !== undefined &&
      current.types !== pkg.types
    ) {
      const msg =
        `NuGet package already present with a different types mapping:\n` +
        `- ${current.id} ${current.version}\n` +
        `- existing: ${String(current.types)}\n` +
        `- incoming: ${String(pkg.types)}\n` +
        `Refusing to merge automatically (airplane-grade).`;
      return conflictCode
        ? errorWithCode(conflictCode, msg)
        : { ok: false, error: msg };
    }

    if (current.types === undefined && pkg.types !== undefined) {
      const index = out.findIndex((entry) => normalizeId(entry.id) === key);
      if (index >= 0) out[index] = { ...current, types: pkg.types };
      byId.set(key, out[index] as PackageReferenceConfig);
    }
  }

  return { ok: true, value: sortPackageReferences(out) };
};

export const mergeMsbuildProperties = (
  existing: Readonly<Record<string, string>>,
  incoming: Readonly<Record<string, string>>,
  conflictCode: string | undefined = undefined
): Result<Record<string, string>, string> => {
  const out: Record<string, string> = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    const current = out[key];
    if (current !== undefined && current !== value) {
      const msg =
        `Conflicting msbuildProperties for key '${key}'.\n` +
        `Existing: ${current}\n` +
        `Incoming: ${value}\n` +
        `Refusing to merge automatically (airplane-grade).`;
      return conflictCode
        ? errorWithCode(conflictCode, msg)
        : { ok: false, error: msg };
    }
    out[key] = value;
  }
  return { ok: true, value: sortMsbuildProperties(out) };
};
