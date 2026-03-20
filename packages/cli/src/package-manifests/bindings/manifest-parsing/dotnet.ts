import { isAbsolute, join, normalize } from "node:path";
import type {
  FrameworkReferenceConfig,
  PackageReferenceConfig,
  Result,
} from "../../../types.js";
import {
  PACKAGE_MANIFEST_DIAGNOSTIC,
  errorWithCode,
  normalizeId,
} from "../shared.js";
import type { ManifestDotnet, NormalizedNugetDependency } from "../types.js";
export {
  canonicalizeManifestDotnet,
  mergeFrameworkReferences,
  mergeMsbuildProperties,
  mergePackageReferences,
} from "./merge.js";

const parseFrameworkReference = (
  value: unknown,
  path: string
): Result<FrameworkReferenceConfig, string> => {
  if (typeof value === "string" && value.trim().length > 0) {
    return { ok: true, value: value.trim() };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path} must be a string or { id, types? }`
    );
  }
  const id = (value as { readonly id?: unknown }).id;
  const types = (value as { readonly types?: unknown }).types;
  if (typeof id !== "string" || id.trim().length === 0) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.id must be a non-empty string`
    );
  }
  if (
    types !== undefined &&
    types !== false &&
    (typeof types !== "string" || types.trim().length === 0)
  ) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.types must be a non-empty string or false`
    );
  }
  return {
    ok: true,
    value: types === undefined ? { id: id.trim() } : { id: id.trim(), types },
  };
};

const parsePackageReference = (
  value: unknown,
  path: string
): Result<PackageReferenceConfig, string> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path} must be { id, version, types? }`
    );
  }
  const id = (value as { readonly id?: unknown }).id;
  const version = (value as { readonly version?: unknown }).version;
  const types = (value as { readonly types?: unknown }).types;
  if (typeof id !== "string" || id.trim().length === 0) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.id must be a non-empty string`
    );
  }
  if (typeof version !== "string" || version.trim().length === 0) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.version must be a non-empty string`
    );
  }
  if (
    types !== undefined &&
    types !== false &&
    (typeof types !== "string" || types.trim().length === 0)
  ) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.types must be a non-empty string or false`
    );
  }
  return {
    ok: true,
    value: {
      id: id.trim(),
      version: version.trim(),
      ...(types === undefined ? {} : { types }),
    },
  };
};

const parseManifestDotnet = (
  value: unknown,
  path: string
): Result<ManifestDotnet | undefined, string> => {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path} must be an object`
    );
  }

  const raw = value as {
    readonly frameworkReferences?: unknown;
    readonly packageReferences?: unknown;
    readonly msbuildProperties?: unknown;
  };

  let frameworkReferences: FrameworkReferenceConfig[] | undefined;
  if (raw.frameworkReferences !== undefined) {
    if (!Array.isArray(raw.frameworkReferences)) {
      return errorWithCode(
        PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
        `${path}.frameworkReferences must be an array`
      );
    }
    frameworkReferences = [];
    for (const [index, entry] of raw.frameworkReferences.entries()) {
      const parsed = parseFrameworkReference(
        entry,
        `${path}.frameworkReferences[${index}]`
      );
      if (!parsed.ok) return parsed;
      frameworkReferences.push(parsed.value);
    }
  }

  let packageReferences: PackageReferenceConfig[] | undefined;
  if (raw.packageReferences !== undefined) {
    if (!Array.isArray(raw.packageReferences)) {
      return errorWithCode(
        PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
        `${path}.packageReferences must be an array`
      );
    }
    packageReferences = [];
    for (const [index, entry] of raw.packageReferences.entries()) {
      const parsed = parsePackageReference(
        entry,
        `${path}.packageReferences[${index}]`
      );
      if (!parsed.ok) return parsed;
      packageReferences.push(parsed.value);
    }
  }

  let msbuildProperties: Record<string, string> | undefined;
  if (raw.msbuildProperties !== undefined) {
    if (
      raw.msbuildProperties === null ||
      typeof raw.msbuildProperties !== "object" ||
      Array.isArray(raw.msbuildProperties)
    ) {
      return errorWithCode(
        PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
        `${path}.msbuildProperties must be an object`
      );
    }
    msbuildProperties = {};
    for (const [key, entryValue] of Object.entries(
      raw.msbuildProperties as Record<string, unknown>
    )) {
      if (typeof entryValue !== "string") {
        return errorWithCode(
          PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
          `${path}.msbuildProperties.${key} must be a string`
        );
      }
      msbuildProperties[key] = entryValue;
    }
  }

  const hasFramework = (frameworkReferences?.length ?? 0) > 0;
  const hasPackage = (packageReferences?.length ?? 0) > 0;
  const hasMsbuild = Object.keys(msbuildProperties ?? {}).length > 0;
  if (!hasFramework && !hasPackage && !hasMsbuild) {
    return { ok: true, value: undefined };
  }

  return {
    ok: true,
    value: {
      frameworkReferences,
      packageReferences,
      msbuildProperties,
    },
  };
};

const normalizePackageTypeRoot = (
  packageName: string,
  raw: string,
  path: string
): Result<string, string> => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path} must be a non-empty string`
    );
  }
  if (isAbsolute(trimmed)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path} must be package-relative, not absolute`
    );
  }

  const normalized = normalize(trimmed).replace(/\\/g, "/");
  if (normalized === ".." || normalized.startsWith("../")) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path} must not escape the package root`
    );
  }

  if (normalized === "." || normalized === "./") {
    return { ok: true, value: join("node_modules", packageName) };
  }

  const relative = normalized.replace(/^\.?\//, "");
  if (relative.length === 0) {
    return { ok: true, value: join("node_modules", packageName) };
  }

  return { ok: true, value: join("node_modules", packageName, relative) };
};

export const parseRequiredTypeRoots = (
  value: unknown,
  path: string,
  packageName: string
): Result<readonly string[], string> => {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path} must be an array of package-relative strings`
    );
  }

  const out: string[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string") {
      return errorWithCode(
        PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
        `${path}[${index}] must be a string`
      );
    }
    const normalizedEntry = normalizePackageTypeRoot(
      packageName,
      entry,
      `${path}[${index}]`
    );
    if (!normalizedEntry.ok) return normalizedEntry;
    out.push(normalizedEntry.value);
  }

  return {
    ok: true,
    value: [...new Set(out)].sort((a, b) => a.localeCompare(b)),
  };
};

export const collectNugetDependencies = (
  dotnet: ManifestDotnet | undefined,
  testDotnet: ManifestDotnet | undefined
): NormalizedNugetDependency[] => {
  const dependencies: NormalizedNugetDependency[] = [];
  const addFrameworkRefs = (
    refs: readonly FrameworkReferenceConfig[] | undefined,
    source: "dotnet.framework" | "testDotnet.framework"
  ): void => {
    for (const ref of refs ?? []) {
      const id = typeof ref === "string" ? ref : ref.id;
      dependencies.push({ source, id });
    }
  };
  const addPackageRefs = (
    refs: readonly PackageReferenceConfig[] | undefined,
    source: "dotnet.package" | "testDotnet.package"
  ): void => {
    for (const ref of refs ?? []) {
      dependencies.push({ source, id: ref.id, version: ref.version });
    }
  };
  addFrameworkRefs(dotnet?.frameworkReferences, "dotnet.framework");
  addPackageRefs(dotnet?.packageReferences, "dotnet.package");
  addFrameworkRefs(testDotnet?.frameworkReferences, "testDotnet.framework");
  addPackageRefs(testDotnet?.packageReferences, "testDotnet.package");

  return dependencies.sort((a, b) => {
    const bySource = a.source.localeCompare(b.source);
    if (bySource !== 0) return bySource;
    const byId = normalizeId(a.id).localeCompare(normalizeId(b.id));
    if (byId !== 0) return byId;
    return (a.version ?? "").localeCompare(b.version ?? "");
  });
};

export const collectRuntimePackagesFromLegacy = (
  packageName: string,
  runtimePackages: readonly string[] | undefined,
  dotnet: ManifestDotnet | undefined,
  testDotnet: ManifestDotnet | undefined
): string[] => {
  const set = new Set<string>();
  set.add(packageName);

  for (const pkg of runtimePackages ?? []) {
    if (pkg.trim()) set.add(pkg.trim());
  }

  const collectTypesPackage = (
    refs:
      | readonly FrameworkReferenceConfig[]
      | readonly PackageReferenceConfig[]
  ): void => {
    for (const ref of refs) {
      if (typeof ref === "string") continue;
      if (typeof ref.types === "string" && ref.types.trim()) {
        set.add(ref.types.trim());
      }
    }
  };

  collectTypesPackage(
    (dotnet?.frameworkReferences ?? []) as readonly FrameworkReferenceConfig[]
  );
  collectTypesPackage(
    (dotnet?.packageReferences ?? []) as readonly PackageReferenceConfig[]
  );
  collectTypesPackage(
    (testDotnet?.frameworkReferences ??
      []) as readonly FrameworkReferenceConfig[]
  );
  collectTypesPackage(
    (testDotnet?.packageReferences ?? []) as readonly PackageReferenceConfig[]
  );

  return [...set].sort((a, b) => normalizeId(a).localeCompare(normalizeId(b)));
};

export { parseFrameworkReference, parseManifestDotnet, parsePackageReference };
