import type { Result } from "../../../types.js";
import { PACKAGE_MANIFEST_DIAGNOSTIC, errorWithCode } from "../shared.js";
import type { NormalizedBindingsManifest } from "../types.js";

type SemanticMetadata = NonNullable<
  NormalizedBindingsManifest["semanticMetadata"]
>;

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const parseObjectMap = (
  value: unknown,
  path: string
): Result<Readonly<Record<string, unknown>> | undefined, string> => {
  if (value === undefined) return { ok: true, value: undefined };
  if (!isObjectRecord(value)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path} must be an object keyed by stable semantic id`
    );
  }
  return { ok: true, value };
};

const parseAliasMetadata = (
  value: unknown,
  path: string
): Result<unknown, string> => {
  if (!isObjectRecord(value)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path} must be an object`
    );
  }
  if (typeof value.aliasId !== "string" || value.aliasId.length === 0) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.aliasId must be a non-empty string`
    );
  }
  if (
    !isObjectRecord(value.definition) ||
    typeof value.definition.kind !== "string"
  ) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.definition must be an IrType object`
    );
  }
  if (typeof value.isRecursive !== "boolean") {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.isRecursive must be a boolean`
    );
  }
  if (
    !Array.isArray(value.typeParameters) ||
    !value.typeParameters.every((entry) => typeof entry === "string")
  ) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.typeParameters must be a string array`
    );
  }
  return { ok: true, value };
};

const parseOverloadFamilyMetadata = (
  value: unknown,
  path: string
): Result<unknown, string> => {
  if (!isObjectRecord(value)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path} must be an object`
    );
  }
  if (typeof value.familyId !== "string" || value.familyId.length === 0) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.familyId must be a non-empty string`
    );
  }
  if (
    value.ownerKind !== "function" &&
    value.ownerKind !== "method" &&
    value.ownerKind !== "constructor"
  ) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.ownerKind must be function, method, or constructor`
    );
  }
  if (typeof value.publicName !== "string" || value.publicName.length === 0) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.publicName must be a non-empty string`
    );
  }
  if (!Array.isArray(value.publicMembers)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.publicMembers must be an array`
    );
  }
  if (!isObjectRecord(value.resolutionMetadata)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.resolutionMetadata must be an object`
    );
  }
  return { ok: true, value };
};

export const parseSemanticMetadata = (
  value: unknown,
  path: string
): Result<SemanticMetadata | undefined, string> => {
  if (value === undefined) return { ok: true, value: undefined };
  if (!isObjectRecord(value)) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path} must be an object`
    );
  }
  if (value.version !== 1) {
    return errorWithCode(
      PACKAGE_MANIFEST_DIAGNOSTIC.invalidSchema,
      `${path}.version must be 1`
    );
  }

  const aliases = parseObjectMap(value.aliases, `${path}.aliases`);
  if (!aliases.ok) return aliases;
  const overloadFamilies = parseObjectMap(
    value.overloadFamilies,
    `${path}.overloadFamilies`
  );
  if (!overloadFamilies.ok) return overloadFamilies;

  for (const [key, alias] of Object.entries(aliases.value ?? {})) {
    const parsed = parseAliasMetadata(alias, `${path}.aliases.${key}`);
    if (!parsed.ok) return parsed;
  }
  for (const [key, family] of Object.entries(overloadFamilies.value ?? {})) {
    const parsed = parseOverloadFamilyMetadata(
      family,
      `${path}.overloadFamilies.${key}`
    );
    if (!parsed.ok) return parsed;
  }

  return {
    ok: true,
    value: {
      version: 1,
      ...(aliases.value
        ? { aliases: aliases.value as SemanticMetadata["aliases"] }
        : {}),
      ...(overloadFamilies.value
        ? {
            overloadFamilies:
              overloadFamilies.value as SemanticMetadata["overloadFamilies"],
          }
        : {}),
    },
  };
};
