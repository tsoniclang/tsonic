import { existsSync } from "node:fs";
import { isAbsolute, join, normalize } from "node:path";
import type {
  FrameworkReferenceConfig,
  PackageReferenceConfig,
  Result,
} from "../../types.js";
import {
  AIKYA_DIAGNOSTIC,
  errorWithCode,
  isSurfaceMode,
  normalizeId,
  readJsonObject,
} from "./shared.js";
import type {
  AikyaProducer,
  ManifestDotnet,
  ManifestSurfaceMode,
  NormalizedBindingsManifest,
  NormalizedNugetDependency,
} from "./types.js";

const parseFrameworkReference = (
  value: unknown,
  path: string
): Result<FrameworkReferenceConfig, string> => {
  if (typeof value === "string" && value.trim().length > 0) {
    return { ok: true, value: value.trim() };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `${path} must be a string or { id, types? }`
    );
  }
  const id = (value as { readonly id?: unknown }).id;
  const types = (value as { readonly types?: unknown }).types;
  if (typeof id !== "string" || id.trim().length === 0) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `${path}.id must be a non-empty string`
    );
  }
  if (
    types !== undefined &&
    types !== false &&
    (typeof types !== "string" || types.trim().length === 0)
  ) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
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
      AIKYA_DIAGNOSTIC.invalidSchema,
      `${path} must be { id, version, types? }`
    );
  }
  const id = (value as { readonly id?: unknown }).id;
  const version = (value as { readonly version?: unknown }).version;
  const types = (value as { readonly types?: unknown }).types;
  if (typeof id !== "string" || id.trim().length === 0) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `${path}.id must be a non-empty string`
    );
  }
  if (typeof version !== "string" || version.trim().length === 0) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `${path}.version must be a non-empty string`
    );
  }
  if (
    types !== undefined &&
    types !== false &&
    (typeof types !== "string" || types.trim().length === 0)
  ) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
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
      AIKYA_DIAGNOSTIC.invalidSchema,
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
        AIKYA_DIAGNOSTIC.invalidSchema,
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
        AIKYA_DIAGNOSTIC.invalidSchema,
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
        AIKYA_DIAGNOSTIC.invalidSchema,
        `${path}.msbuildProperties must be an object`
      );
    }
    msbuildProperties = {};
    for (const [key, value] of Object.entries(
      raw.msbuildProperties as Record<string, unknown>
    )) {
      if (typeof value !== "string") {
        return errorWithCode(
          AIKYA_DIAGNOSTIC.invalidSchema,
          `${path}.msbuildProperties.${key} must be a string`
        );
      }
      msbuildProperties[key] = value;
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
      AIKYA_DIAGNOSTIC.invalidSchema,
      `${path} must be a non-empty string`
    );
  }
  if (isAbsolute(trimmed)) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `${path} must be package-relative, not absolute`
    );
  }

  const normalized = normalize(trimmed).replace(/\\/g, "/");
  if (normalized === ".." || normalized.startsWith("../")) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
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

const parseRequiredTypeRoots = (
  value: unknown,
  path: string,
  packageName: string
): Result<readonly string[], string> => {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value)) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `${path} must be an array of package-relative strings`
    );
  }

  const out: string[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string") {
      return errorWithCode(
        AIKYA_DIAGNOSTIC.invalidSchema,
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

const canonicalizeManifestDotnet = (
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
      const idx = out.findIndex(
        (x) =>
          normalizeId(typeof x === "string" ? x : x.id) === normalizeId(current)
      );
      if (idx >= 0) out[idx] = { id: current, types: ref.types };
      byId.set(key, out[idx] as FrameworkReferenceConfig);
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
  for (const p of out) byId.set(normalizeId(p.id), p);

  for (const p of incoming) {
    const key = normalizeId(p.id);
    const current = byId.get(key);
    if (!current) {
      out.push(p);
      byId.set(key, p);
      continue;
    }

    if (current.version !== p.version) {
      const msg =
        `NuGet package already present with a different version: ${current.id} ${current.version}\n` +
        `Incoming requested: ${p.id} ${p.version}\n` +
        `Refusing to merge automatically (airplane-grade).`;
      return conflictCode
        ? errorWithCode(conflictCode, msg)
        : { ok: false, error: msg };
    }

    if (
      p.types !== undefined &&
      current.types !== undefined &&
      current.types !== p.types
    ) {
      const msg =
        `NuGet package already present with a different types mapping:\n` +
        `- ${current.id} ${current.version}\n` +
        `- existing: ${String(current.types)}\n` +
        `- incoming: ${String(p.types)}\n` +
        `Refusing to merge automatically (airplane-grade).`;
      return conflictCode
        ? errorWithCode(conflictCode, msg)
        : { ok: false, error: msg };
    }

    if (current.types === undefined && p.types !== undefined) {
      const idx = out.findIndex((x) => normalizeId(x.id) === key);
      if (idx >= 0) out[idx] = { ...current, types: p.types };
      byId.set(key, out[idx] as PackageReferenceConfig);
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
  for (const [k, v] of Object.entries(incoming)) {
    const current = out[k];
    if (current !== undefined && current !== v) {
      const msg =
        `Conflicting msbuildProperties for key '${k}'.\n` +
        `Existing: ${current}\n` +
        `Incoming: ${v}\n` +
        `Refusing to merge automatically (airplane-grade).`;
      return conflictCode
        ? errorWithCode(conflictCode, msg)
        : { ok: false, error: msg };
    }
    out[k] = v;
  }
  return { ok: true, value: sortMsbuildProperties(out) };
};

const collectNugetDependencies = (
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

const collectRuntimePackagesFromLegacy = (
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
      if (typeof ref.types === "string" && ref.types.trim())
        set.add(ref.types.trim());
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

const parseAikyaProducer = (
  value: unknown
): Result<AikyaProducer | undefined, string> => {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      "producer must be an object"
    );
  }
  const tool = (value as { readonly tool?: unknown }).tool;
  const version = (value as { readonly version?: unknown }).version;
  const mode = (value as { readonly mode?: unknown }).mode;
  if (tool !== "tsonic" && tool !== "tsbindgen") {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `producer.tool must be "tsonic" or "tsbindgen"`
    );
  }
  if (typeof version !== "string" || version.trim().length === 0) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      "producer.version must be a non-empty string"
    );
  }
  if (mode !== "aikya-firstparty" && mode !== "external-clr") {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `producer.mode must be "aikya-firstparty" or "external-clr"`
    );
  }
  return {
    ok: true,
    value: {
      tool,
      version: version.trim(),
      mode,
    },
  };
};

const parseRuntimeNugetPackages = (
  value: unknown
): Result<readonly PackageReferenceConfig[], string> => {
  if (!Array.isArray(value) || value.length === 0) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.missingRuntimeMapping,
      "runtime.nugetPackages must be a non-empty array"
    );
  }

  const out: PackageReferenceConfig[] = [];
  for (const [index, entry] of value.entries()) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return errorWithCode(
        AIKYA_DIAGNOSTIC.unresolvedRuntime,
        `runtime.nugetPackages[${index}] must be { id, version }`
      );
    }
    const id = (entry as { readonly id?: unknown }).id;
    const version = (entry as { readonly version?: unknown }).version;
    if (typeof id !== "string" || id.trim().length === 0) {
      return errorWithCode(
        AIKYA_DIAGNOSTIC.unresolvedRuntime,
        `runtime.nugetPackages[${index}].id must be a non-empty string`
      );
    }
    if (typeof version !== "string" || version.trim().length === 0) {
      return errorWithCode(
        AIKYA_DIAGNOSTIC.unresolvedRuntime,
        `runtime.nugetPackages[${index}].version must be a non-empty string`
      );
    }
    out.push({ id: id.trim(), version: version.trim() });
  }
  return { ok: true, value: out };
};

const parseRuntimeFrameworkReferences = (
  value: unknown
): Result<readonly FrameworkReferenceConfig[], string> => {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value)) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      "runtime.frameworkReferences must be an array when present"
    );
  }
  const refs: FrameworkReferenceConfig[] = [];
  for (const [index, entry] of value.entries()) {
    const parsed = parseFrameworkReference(
      entry,
      `runtime.frameworkReferences[${index}]`
    );
    if (!parsed.ok) return parsed;
    refs.push(parsed.value);
  }
  return { ok: true, value: refs };
};

const parseRuntimePackages = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .sort((a, b) => normalizeId(a).localeCompare(normalizeId(b)));
};

export const resolveFromAikyaManifest = (
  packageRoot: string,
  packageName: string,
  packageVersion: string
): Result<NormalizedBindingsManifest | null, string> => {
  const path = join(packageRoot, "tsonic", "package-manifest.json");
  if (!existsSync(path)) return { ok: true, value: null };

  const parsed = readJsonObject(path, AIKYA_DIAGNOSTIC.invalidSchema);
  if (!parsed.ok) return parsed;
  const manifest = parsed.value;

  const schemaVersion = manifest.schemaVersion;
  if (schemaVersion !== 1) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `schemaVersion must be 1 at ${path}`
    );
  }

  const kind = manifest.kind;
  if (kind === "tsonic-source-package") {
    return { ok: true, value: null };
  }
  if (kind !== "tsonic-library") {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `kind must be "tsonic-library" at ${path}`
    );
  }

  const npmPackage = manifest.npmPackage;
  if (typeof npmPackage !== "string" || npmPackage.trim().length === 0) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `npmPackage must be a non-empty string at ${path}`
    );
  }
  if (normalizeId(npmPackage) !== normalizeId(packageName)) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `npmPackage mismatch in ${path}. Installed: ${packageName}, Manifest: ${npmPackage}`
    );
  }

  const npmVersion = manifest.npmVersion;
  if (typeof npmVersion !== "string" || npmVersion.trim().length === 0) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `npmVersion must be a non-empty string at ${path}`
    );
  }
  if (npmVersion.trim() !== packageVersion) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `npmVersion mismatch in ${path}. Installed: ${packageVersion}, Manifest: ${npmVersion}`
    );
  }

  const typing = manifest.typing;
  if (typing === null || typeof typing !== "object" || Array.isArray(typing)) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `typing must be an object at ${path}`
    );
  }
  const bindingsRoot = (typing as { readonly bindingsRoot?: unknown })
    .bindingsRoot;
  if (typeof bindingsRoot !== "string" || bindingsRoot.trim().length === 0) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `typing.bindingsRoot must be a non-empty string at ${path}`
    );
  }
  const bindingsRootPath = join(packageRoot, bindingsRoot);
  if (!existsSync(bindingsRootPath)) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.missingBindingsRoot,
      `typing.bindingsRoot does not exist: ${bindingsRootPath}`
    );
  }

  const runtime = manifest.runtime;
  if (
    runtime === null ||
    typeof runtime !== "object" ||
    Array.isArray(runtime)
  ) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.missingRuntimeMapping,
      `runtime must be an object at ${path}`
    );
  }

  const runtimeNuget = parseRuntimeNugetPackages(
    (runtime as { readonly nugetPackages?: unknown }).nugetPackages
  );
  if (!runtimeNuget.ok) return runtimeNuget;

  const runtimeFramework = parseRuntimeFrameworkReferences(
    (runtime as { readonly frameworkReferences?: unknown }).frameworkReferences
  );
  if (!runtimeFramework.ok) return runtimeFramework;

  const runtimePackages = parseRuntimePackages(
    (runtime as { readonly runtimePackages?: unknown }).runtimePackages
  );

  const producer = parseAikyaProducer(manifest.producer);
  if (!producer.ok) return producer;
  const requiredTypeRoots = parseRequiredTypeRoots(
    manifest.requiredTypeRoots,
    "requiredTypeRoots",
    packageName
  );
  if (!requiredTypeRoots.ok) return requiredTypeRoots;

  const dotnetParsed = parseManifestDotnet(manifest.dotnet, "dotnet");
  if (!dotnetParsed.ok) return dotnetParsed;
  const testDotnetParsed = parseManifestDotnet(
    manifest.testDotnet,
    "testDotnet"
  );
  if (!testDotnetParsed.ok) return testDotnetParsed;

  const mergedDotnetPackages = mergePackageReferences(
    (dotnetParsed.value?.packageReferences ?? []) as PackageReferenceConfig[],
    runtimeNuget.value as PackageReferenceConfig[],
    AIKYA_DIAGNOSTIC.conflictingRuntime
  );
  if (!mergedDotnetPackages.ok) return mergedDotnetPackages;

  const mergedDotnetFramework = mergeFrameworkReferences(
    (dotnetParsed.value?.frameworkReferences ??
      []) as FrameworkReferenceConfig[],
    runtimeFramework.value as FrameworkReferenceConfig[],
    AIKYA_DIAGNOSTIC.conflictingRuntime
  );
  if (!mergedDotnetFramework.ok) return mergedDotnetFramework;

  const dotnet = canonicalizeManifestDotnet({
    frameworkReferences: mergedDotnetFramework.value,
    packageReferences: mergedDotnetPackages.value,
    msbuildProperties: dotnetParsed.value?.msbuildProperties,
  });
  const testDotnet = canonicalizeManifestDotnet(testDotnetParsed.value);

  const runtimeSet = new Set<string>();
  runtimeSet.add(packageName);
  for (const pkg of runtimePackages) runtimeSet.add(pkg);

  return {
    ok: true,
    value: {
      bindingVersion: 1,
      sourceManifest: "aikya",
      packageName,
      packageVersion,
      surfaceMode: "clr",
      requiredTypeRoots: requiredTypeRoots.value,
      bindingsRoot,
      runtimePackages: [...runtimeSet].sort((a, b) =>
        normalizeId(a).localeCompare(normalizeId(b))
      ),
      producer: producer.value,
      dotnet,
      testDotnet,
      nugetDependencies: collectNugetDependencies(dotnet, testDotnet),
    },
  };
};

export const resolveFromLegacyBindingsManifest = (
  packageRoot: string,
  packageName: string,
  packageVersion: string
): Result<NormalizedBindingsManifest | null, string> => {
  const manifestPath = join(packageRoot, "tsonic.bindings.json");
  if (!existsSync(manifestPath)) return { ok: true, value: null };

  const parsed = readJsonObject(manifestPath, AIKYA_DIAGNOSTIC.invalidSchema);
  if (!parsed.ok) return parsed;
  const manifest = parsed.value;

  const bindingVersion = manifest.bindingVersion;
  if (bindingVersion !== undefined && bindingVersion !== 1) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `Unsupported tsonic.bindings.json bindingVersion: ${String(bindingVersion)}`
    );
  }

  const manifestPackageName = manifest.packageName;
  if (manifestPackageName !== undefined) {
    if (
      typeof manifestPackageName !== "string" ||
      normalizeId(manifestPackageName) !== normalizeId(packageName)
    ) {
      return errorWithCode(
        AIKYA_DIAGNOSTIC.invalidSchema,
        `tsonic.bindings.json packageName mismatch. Installed: ${packageName}, Manifest: ${String(manifestPackageName)}`
      );
    }
  }

  const manifestPackageVersion = manifest.packageVersion;
  if (manifestPackageVersion !== undefined) {
    if (
      typeof manifestPackageVersion !== "string" ||
      manifestPackageVersion !== packageVersion
    ) {
      return errorWithCode(
        AIKYA_DIAGNOSTIC.invalidSchema,
        `tsonic.bindings.json packageVersion mismatch. Installed: ${packageVersion}, Manifest: ${String(manifestPackageVersion)}`
      );
    }
  }

  const surfaceModeRaw = manifest.surfaceMode;
  if (surfaceModeRaw !== undefined && !isSurfaceMode(surfaceModeRaw)) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `Invalid tsonic.bindings.json surfaceMode: ${String(surfaceModeRaw)}`
    );
  }
  const surfaceMode =
    (surfaceModeRaw as ManifestSurfaceMode | undefined)?.trim() ?? "clr";
  const requiredTypeRoots = parseRequiredTypeRoots(
    manifest.requiredTypeRoots,
    "requiredTypeRoots",
    packageName
  );
  if (!requiredTypeRoots.ok) return requiredTypeRoots;

  const dotnetParsed = parseManifestDotnet(manifest.dotnet, "dotnet");
  if (!dotnetParsed.ok) return dotnetParsed;
  const testDotnetParsed = parseManifestDotnet(
    manifest.testDotnet,
    "testDotnet"
  );
  if (!testDotnetParsed.ok) return testDotnetParsed;

  const dotnet = canonicalizeManifestDotnet(dotnetParsed.value);
  const testDotnet = canonicalizeManifestDotnet(testDotnetParsed.value);

  const runtimePackages = Array.isArray(manifest.runtimePackages)
    ? manifest.runtimePackages.filter(
        (x: unknown): x is string => typeof x === "string"
      )
    : undefined;

  return {
    ok: true,
    value: {
      bindingVersion: 1,
      sourceManifest: "legacy",
      packageName,
      packageVersion,
      surfaceMode,
      requiredTypeRoots: requiredTypeRoots.value,
      assemblyName:
        typeof manifest.assemblyName === "string"
          ? manifest.assemblyName
          : undefined,
      assemblyVersion:
        typeof manifest.assemblyVersion === "string"
          ? manifest.assemblyVersion
          : undefined,
      targetFramework:
        typeof manifest.targetFramework === "string"
          ? manifest.targetFramework
          : undefined,
      runtimePackages: collectRuntimePackagesFromLegacy(
        packageName,
        runtimePackages,
        dotnet,
        testDotnet
      ),
      dotnet,
      testDotnet,
      nugetDependencies: collectNugetDependencies(dotnet, testDotnet),
    },
  };
};
