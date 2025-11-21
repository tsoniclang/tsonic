/**
 * Nested Types Handling - Parse and transform nested type names.
 *
 * C# supports nested types (types inside types). TypeScript doesn't have true nested
 * type syntax, so tsbindgen flattens them using a dollar sign separator:
 *
 * CLR:        Outer+Nested (reflection uses +)
 * TypeScript: Outer$Nested ($ separator)
 * C#:         Outer.Nested (dot in source code)
 *
 * @see spec/nested-types.md for complete documentation
 */

/**
 * Information about a nested type name.
 */
export type NestedTypeInfo = {
  readonly isNested: boolean;
  readonly outerType: string;
  readonly nestedType: string;
  readonly fullPath: readonly string[];
  readonly depth: number;
};

/**
 * Parse a TypeScript type name to check if it represents a nested type.
 *
 * @param tsEmitName - TypeScript emit name (e.g., "List_1$Enumerator")
 * @returns Nested type info if nested, undefined if not nested
 */
export const parseNestedTypeName = (
  tsEmitName: string
): NestedTypeInfo | undefined => {
  // Check if name contains $ separator
  if (!tsEmitName.includes("$")) {
    return undefined;
  }

  // Split on $ to get nesting path
  const parts = tsEmitName.split("$");
  if (parts.length < 2) {
    return undefined;
  }

  return {
    isNested: true,
    outerType: parts[0],
    nestedType: parts[parts.length - 1],
    fullPath: parts,
    depth: parts.length - 1,
  };
};

/**
 * Check if a TypeScript emit name represents a nested type.
 *
 * @param tsEmitName - TypeScript emit name
 * @returns True if nested type
 */
export const isNestedType = (tsEmitName: string): boolean => {
  return tsEmitName.includes("$");
};

/**
 * Convert TypeScript nested type name to C# nested type name.
 *
 * TypeScript: List_1$Enumerator
 * C#:         List<T>.Enumerator
 *
 * Note: This only converts the separator ($  → .). Generic arity substitution
 * (_1 → <T>) is handled separately by generic type processing.
 *
 * @param tsEmitName - TypeScript emit name with $ separator
 * @returns C# name with dot separator (generic arity not substituted)
 */
export const tsCSharpNestedTypeName = (tsEmitName: string): string => {
  return tsEmitName.replace(/\$/g, ".");
};

/**
 * Convert CLR reflection name to TypeScript emit name.
 *
 * CLR uses + for nested types (reflection metadata).
 * TypeScript uses $.
 *
 * CLR:        List`1+Enumerator
 * TypeScript: List_1$Enumerator
 *
 * @param clrName - CLR reflection name with + separator and ` for generics
 * @returns TypeScript emit name with $ separator and _ for generics
 */
export const clrToTsNestedTypeName = (clrName: string): string => {
  // First replace backticks with underscores for generic arity
  let tsName = clrName.replace(/`/g, "_");

  // Then replace plus signs with dollar signs for nesting
  tsName = tsName.replace(/\+/g, "$");

  return tsName;
};

/**
 * Convert TypeScript emit name to CLR reflection name.
 *
 * Reverse of clrToTsNestedTypeName.
 *
 * TypeScript: List_1$Enumerator
 * CLR:        List`1+Enumerator
 *
 * @param tsEmitName - TypeScript emit name
 * @returns CLR reflection name
 */
export const tsToCLRNestedTypeName = (tsEmitName: string): string => {
  // Replace dollar signs with plus signs for nesting
  let clrName = tsEmitName.replace(/\$/g, "+");

  // Replace underscores with backticks for generic arity
  // Note: This is a simple replacement. In practice, we need to be careful
  // not to replace underscores that are part of the actual type name.
  // For now, we assume _N pattern at end of each segment indicates arity.
  clrName = clrName.replace(/_(\d+)/g, "`$1");

  return clrName;
};

/**
 * Get all nesting levels from a nested type name.
 *
 * @param tsEmitName - TypeScript emit name (e.g., "A$B$C")
 * @returns Array of type names at each level ["A", "A$B", "A$B$C"]
 */
export const getNestedTypeLevels = (tsEmitName: string): readonly string[] => {
  if (!isNestedType(tsEmitName)) {
    return [tsEmitName];
  }

  const parts = tsEmitName.split("$");
  const levels: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    levels.push(parts.slice(0, i + 1).join("$"));
  }

  return levels;
};

/**
 * Get the outermost type name from a nested type.
 *
 * @param tsEmitName - TypeScript emit name (e.g., "List_1$Enumerator")
 * @returns Outermost type name (e.g., "List_1")
 */
export const getOutermostType = (tsEmitName: string): string => {
  const dollarIndex = tsEmitName.indexOf("$");
  if (dollarIndex === -1) {
    return tsEmitName;
  }
  return tsEmitName.substring(0, dollarIndex);
};

/**
 * Get the innermost type name from a nested type.
 *
 * @param tsEmitName - TypeScript emit name (e.g., "A$B$C")
 * @returns Innermost type name (e.g., "C")
 */
export const getInnermostType = (tsEmitName: string): string => {
  const parts = tsEmitName.split("$");
  return parts[parts.length - 1];
};

/**
 * Check if one type is nested inside another.
 *
 * @param innerType - Potentially nested type (e.g., "List_1$Enumerator")
 * @param outerType - Potentially containing type (e.g., "List_1")
 * @returns True if innerType is nested inside outerType
 */
export const isNestedInside = (innerType: string, outerType: string): boolean => {
  if (!isNestedType(innerType)) {
    return false;
  }

  return innerType.startsWith(outerType + "$");
};

/**
 * Get parent type name from a nested type.
 *
 * @param tsEmitName - TypeScript emit name (e.g., "A$B$C")
 * @returns Parent type name (e.g., "A$B"), or undefined if not nested
 */
export const getParentType = (tsEmitName: string): string | undefined => {
  const info = parseNestedTypeName(tsEmitName);
  if (!info) {
    return undefined;
  }

  if (info.fullPath.length < 2) {
    return undefined;
  }

  return info.fullPath.slice(0, -1).join("$");
};
