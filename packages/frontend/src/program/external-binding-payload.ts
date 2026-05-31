import type {
  BindingFile,
  TsbindgenExport,
  TsbindgenType,
} from "./binding-types.js";

export type ParsedExternalBindingPayload = {
  readonly namespace: string;
  readonly types: readonly TsbindgenType[];
  readonly exports?: Readonly<Record<string, TsbindgenExport>>;
  readonly ownerIdentities?: readonly string[];
  readonly targetRuntimeVersion?: string;
};

export const getExternalBindingPayload = (
  manifest: BindingFile
): ParsedExternalBindingPayload => ({
  namespace: manifest.provider.namespace,
  types: manifest.targetSurface.types,
  exports: manifest.targetSurface.exports,
  ownerIdentities: manifest.provider.ownerIdentities,
  targetRuntimeVersion: manifest.provider.targetRuntimeVersion,
});

export const extractRawExternalBindingsPayload = (
  value: unknown
): ParsedExternalBindingPayload | undefined => {
  if (typeof value !== "object" || value === null) return undefined;

  const candidate = value as {
    readonly schema?: unknown;
    readonly provider?: {
      readonly namespace?: unknown;
      readonly ownerIdentities?: unknown;
      readonly targetRuntimeVersion?: unknown;
    };
    readonly targetSurface?: {
      readonly types?: unknown;
      readonly exports?: unknown;
    };
  };

  if (candidate.schema !== "tsonic.bindings") {
    return undefined;
  }

  if (
    candidate.provider === undefined ||
    typeof candidate.provider !== "object" ||
    candidate.provider === null ||
    typeof candidate.provider.namespace !== "string"
  ) {
    return undefined;
  }

  if (
    candidate.targetSurface === undefined ||
    typeof candidate.targetSurface !== "object" ||
    candidate.targetSurface === null ||
    !Array.isArray(candidate.targetSurface.types)
  ) {
    return undefined;
  }

  return {
    namespace: candidate.provider.namespace,
    types: candidate.targetSurface.types as readonly TsbindgenType[],
    exports:
      candidate.targetSurface.exports &&
      typeof candidate.targetSurface.exports === "object" &&
      !Array.isArray(candidate.targetSurface.exports)
        ? (candidate.targetSurface.exports as Readonly<
            Record<string, TsbindgenExport>
          >)
        : undefined,
    ownerIdentities: Array.isArray(candidate.provider.ownerIdentities)
      ? candidate.provider.ownerIdentities.filter(
          (entry): entry is string => typeof entry === "string"
        )
      : undefined,
    targetRuntimeVersion:
      typeof candidate.provider.targetRuntimeVersion === "string"
        ? candidate.provider.targetRuntimeVersion
        : undefined,
  };
};

export const extractRawExternalBindingTypes = (
  value: unknown
): readonly TsbindgenType[] | undefined => {
  const payload = extractRawExternalBindingsPayload(value);
  if (!payload) {
    return undefined;
  }

  return payload.types;
};

export const extractRawExternalOwnerIdentity = (
  value: unknown
): string | undefined => {
  const payload = extractRawExternalBindingsPayload(value);
  const [firstProviderOwner] = payload?.ownerIdentities ?? [];
  if (firstProviderOwner) return firstProviderOwner;

  const [firstType] = extractRawExternalBindingTypes(value) ?? [];
  return typeof firstType?.ownerIdentity === "string"
    ? firstType.ownerIdentity
    : undefined;
};
