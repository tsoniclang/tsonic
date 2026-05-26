import type {
  BindingFile,
  FirstPartyBindingsFileV2,
  TsbindgenBindingFile,
} from "./binding-types.js";

export type ParsedExternalBindingPayload = {
  readonly namespace: string;
  readonly types: readonly unknown[];
  readonly exports?: Readonly<Record<string, unknown>>;
};

export const isFirstPartyTargetBindingsFileV2 = (
  manifest: BindingFile
): manifest is FirstPartyBindingsFileV2 => {
  return (
    "namespace" in manifest &&
    "targetSurface" in manifest &&
    typeof manifest.targetSurface === "object" &&
    manifest.targetSurface !== null &&
    Array.isArray(manifest.targetSurface.types)
  );
};

export const getExternalBindingPayload = (
  manifest: BindingFile
): TsbindgenBindingFile | undefined => {
  if (
    "namespace" in manifest &&
    "types" in manifest &&
    !("namespaces" in manifest) &&
    !("targetSurface" in manifest)
  ) {
    return manifest as TsbindgenBindingFile;
  }

  if (isFirstPartyTargetBindingsFileV2(manifest)) {
    return {
      namespace: manifest.namespace,
      types: manifest.targetSurface.types,
      exports: manifest.targetSurface.exports,
    };
  }

  return undefined;
};

export const extractRawExternalBindingsPayload = (
  value: unknown
): ParsedExternalBindingPayload | undefined => {
  if (typeof value !== "object" || value === null) return undefined;

  const candidate = value as {
    readonly namespace?: unknown;
    readonly types?: unknown;
    readonly exports?: unknown;
    readonly targetSurface?: {
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
    candidate.targetSurface !== undefined &&
    typeof candidate.targetSurface === "object" &&
    candidate.targetSurface !== null &&
    Array.isArray(candidate.targetSurface.types)
  ) {
    return {
      namespace: candidate.namespace,
      types: candidate.targetSurface.types,
      exports:
        candidate.targetSurface.exports &&
        typeof candidate.targetSurface.exports === "object" &&
        !Array.isArray(candidate.targetSurface.exports)
          ? (candidate.targetSurface.exports as Readonly<
              Record<string, unknown>
            >)
          : undefined,
    };
  }

  return undefined;
};

export const extractRawExternalBindingTypes = (
  value: unknown
): readonly Record<string, unknown>[] | undefined => {
  const payload = extractRawExternalBindingsPayload(value);
  if (!payload) {
    return undefined;
  }

  return payload.types.filter(
    (entry): entry is Record<string, unknown> =>
      entry !== null && typeof entry === "object" && !Array.isArray(entry)
  );
};

export const extractRawExternalOwnerIdentity = (
  value: unknown
): string | undefined => {
  const [firstType] = extractRawExternalBindingTypes(value) ?? [];
  return typeof firstType?.ownerIdentity === "string"
    ? firstType.ownerIdentity
    : undefined;
};
