import type {
  BindingFile,
  FirstPartyBindingsFileV2,
  TsbindgenBindingFile,
} from "./binding-types.js";

export type ParsedDotnetBindingPayload = {
  readonly namespace: string;
  readonly types: readonly unknown[];
  readonly exports?: Readonly<Record<string, unknown>>;
};

export const isFirstPartyBindingsFileV2 = (
  manifest: BindingFile
): manifest is FirstPartyBindingsFileV2 => {
  return (
    "namespace" in manifest &&
    "dotnet" in manifest &&
    typeof manifest.dotnet === "object" &&
    manifest.dotnet !== null &&
    Array.isArray(manifest.dotnet.types)
  );
};

export const getDotnetBindingPayload = (
  manifest: BindingFile
): TsbindgenBindingFile | undefined => {
  if (
    "namespace" in manifest &&
    "types" in manifest &&
    !("namespaces" in manifest) &&
    !("dotnet" in manifest)
  ) {
    return manifest as TsbindgenBindingFile;
  }

  if (isFirstPartyBindingsFileV2(manifest)) {
    return {
      namespace: manifest.namespace,
      types: manifest.dotnet.types,
      exports: manifest.dotnet.exports,
    };
  }

  return undefined;
};

export const extractRawDotnetBindingsPayload = (
  value: unknown
): ParsedDotnetBindingPayload | undefined => {
  if (typeof value !== "object" || value === null) return undefined;

  const candidate = value as {
    readonly namespace?: unknown;
    readonly types?: unknown;
    readonly exports?: unknown;
    readonly dotnet?: {
      readonly types?: unknown;
      readonly exports?: unknown;
    };
  };

  if (typeof candidate.namespace !== "string") {
    return undefined;
  }

  if (Array.isArray(candidate.types)) {
    return {
      namespace: candidate.namespace,
      types: candidate.types,
      exports:
        candidate.exports &&
        typeof candidate.exports === "object" &&
        !Array.isArray(candidate.exports)
          ? (candidate.exports as Readonly<Record<string, unknown>>)
          : undefined,
    };
  }

  if (
    candidate.dotnet !== undefined &&
    typeof candidate.dotnet === "object" &&
    candidate.dotnet !== null &&
    Array.isArray(candidate.dotnet.types)
  ) {
    return {
      namespace: candidate.namespace,
      types: candidate.dotnet.types,
      exports:
        candidate.dotnet.exports &&
        typeof candidate.dotnet.exports === "object" &&
        !Array.isArray(candidate.dotnet.exports)
          ? (candidate.dotnet.exports as Readonly<Record<string, unknown>>)
          : undefined,
    };
  }

  return undefined;
};

export const extractRawDotnetBindingTypes = (
  value: unknown
): readonly Record<string, unknown>[] | undefined => {
  const payload = extractRawDotnetBindingsPayload(value);
  if (!payload) {
    return undefined;
  }

  return payload.types.filter(
    (entry): entry is Record<string, unknown> =>
      entry !== null && typeof entry === "object" && !Array.isArray(entry)
  );
};

export const extractRawDotnetAssemblyName = (
  value: unknown
): string | undefined => {
  const [firstType] = extractRawDotnetBindingTypes(value) ?? [];
  return typeof firstType?.assemblyName === "string"
    ? firstType.assemblyName
    : undefined;
};
