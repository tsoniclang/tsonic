/**
 * tsbindgen naming helpers.
 *
 * These utilities encode the deterministic mapping rules between provider
 * names and the TypeScript identifiers produced by tsbindgen.
 *
 * IMPORTANT: These are NOT "naming transforms" (no casing policy). They are
 * structural encodings required to represent provider generics and nested types in TS.
 */

/**
 * Convert a provider full type name to the tsbindgen TS type identifier.
 *
 * Examples:
 * - "provider string" -> "String"
 * - "Provider.Collections.List`1" -> "List_1"
 * - "Provider.Collections.List`1+Enumerator" -> "List_1_Enumerator"
 */
export const tsbindgenTargetTypeNameToTsTypeName = (
  providerFullName: string
): string => {
  // Some signatures may include generic instantiation suffixes (e.g. "[[T]]").
  // Those never appear in type declarations as part of the exported identifier.
  const withoutInstantiation = providerFullName.includes("[[")
    ? (providerFullName.split("[[")[0] ?? providerFullName)
    : providerFullName;

  const lastDot = withoutInstantiation.lastIndexOf(".");
  const simple =
    lastDot >= 0
      ? withoutInstantiation.slice(lastDot + 1)
      : withoutInstantiation;

  return (
    simple
      // Nested provider types use '+', TS uses '_' between segments.
      .replace(/\+/g, "_")
      // Generic arity markers use '`N', TS uses '_N'.
      .replace(/`(\d+)/g, "_$1")
  );
};
