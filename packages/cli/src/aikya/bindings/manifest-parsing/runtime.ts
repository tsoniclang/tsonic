import type {
  FrameworkReferenceConfig,
  PackageReferenceConfig,
  Result,
} from "../../../types.js";
import { AIKYA_DIAGNOSTIC, errorWithCode, normalizeId } from "../shared.js";
import { parseFrameworkReference } from "./dotnet.js";
import type { AikyaProducer } from "../types.js";

export const parseAikyaProducer = (
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

export const parseRuntimeNugetPackages = (
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

export const parseRuntimeFrameworkReferences = (
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

export const parseRuntimePackages = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .sort((a, b) => normalizeId(a).localeCompare(normalizeId(b)));
};
