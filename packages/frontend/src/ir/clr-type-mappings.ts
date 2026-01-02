/**
 * CLR Type Mappings - Hardcoded mappings for @tsonic/globals and @tsonic/core types
 *
 * These are special built-in types that need specific fully-qualified names
 * for .NET interop. The mappings are hardcoded because these are fundamental
 * runtime types with fixed CLR identities.
 *
 * Part of Alice's specification for deterministic IR typing.
 */

// ============================================================================
// Primitive Type → System.* Mappings
// ============================================================================

/**
 * Maps TypeScript/IR primitive type names to their CLR System.* FQ names.
 * Used for normalizing receiver types when resolving inherited members.
 */
export const PRIMITIVE_TO_CLR_FQ: Readonly<Record<string, string>> = {
  // Core primitives (TypeScript built-ins)
  string: "System.String",
  number: "System.Double",
  boolean: "System.Boolean",

  // @tsonic/core signed integers
  sbyte: "System.SByte",
  short: "System.Int16",
  int: "System.Int32",
  long: "System.Int64",
  nint: "System.IntPtr",
  int128: "System.Int128",

  // @tsonic/core unsigned integers
  byte: "System.Byte",
  ushort: "System.UInt16",
  uint: "System.UInt32",
  ulong: "System.UInt64",
  nuint: "System.UIntPtr",
  uint128: "System.UInt128",

  // @tsonic/core floating-point
  half: "System.Half",
  float: "System.Single",
  double: "System.Double",
  decimal: "System.Decimal",

  // @tsonic/core other primitives
  bool: "System.Boolean",
  char: "System.Char",
};

// ============================================================================
// Global Type → System.* Mappings
// ============================================================================

/**
 * Maps @tsonic/globals type names to their CLR System.* FQ names.
 * These are the TypeScript-facing names that wrap CLR types.
 */
export const GLOBALS_TO_CLR_FQ: Readonly<Record<string, string>> = {
  // Globals from @tsonic/globals
  String: "System.String",
  Number: "System.Double",
  Boolean: "System.Boolean",
  Object: "System.Object",
  Array: "System.Array",

  // Instance interfaces (from @tsonic/dotnet)
  String$instance: "System.String",
  Double$instance: "System.Double",
  Boolean$instance: "System.Boolean",
  Object$instance: "System.Object",
  Array$instance: "System.Array",
};

// ============================================================================
// Reverse Mappings (CLR → Simple Name)
// ============================================================================

/**
 * Maps CLR System.* FQ names back to simple names.
 * Used for display and some lookup scenarios.
 */
export const CLR_FQ_TO_SIMPLE: Readonly<Record<string, string>> = {
  "System.String": "String",
  "System.Double": "Double",
  "System.Single": "Single",
  "System.Boolean": "Boolean",
  "System.Object": "Object",
  "System.Array": "Array",
  "System.SByte": "SByte",
  "System.Int16": "Int16",
  "System.Int32": "Int32",
  "System.Int64": "Int64",
  "System.IntPtr": "IntPtr",
  "System.Int128": "Int128",
  "System.Byte": "Byte",
  "System.UInt16": "UInt16",
  "System.UInt32": "UInt32",
  "System.UInt64": "UInt64",
  "System.UIntPtr": "UIntPtr",
  "System.UInt128": "UInt128",
  "System.Half": "Half",
  "System.Decimal": "Decimal",
  "System.Char": "Char",
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize a type name to its CLR fully-qualified name.
 * Handles primitives, globals, and $instance interfaces.
 *
 * @param typeName - Simple or already-qualified type name
 * @returns CLR FQ name (e.g., "System.String") or original if no mapping exists
 */
export const normalizeToClrFQ = (typeName: string): string => {
  // Check primitives first
  const primitiveFQ = PRIMITIVE_TO_CLR_FQ[typeName];
  if (primitiveFQ) return primitiveFQ;

  // Check globals
  const globalsFQ = GLOBALS_TO_CLR_FQ[typeName];
  if (globalsFQ) return globalsFQ;

  // Already qualified or unknown - return as-is
  return typeName;
};

/**
 * Check if a type name is a known CLR primitive or global type.
 */
export const isKnownClrType = (typeName: string): boolean => {
  return (
    typeName in PRIMITIVE_TO_CLR_FQ ||
    typeName in GLOBALS_TO_CLR_FQ ||
    typeName in CLR_FQ_TO_SIMPLE
  );
};

/**
 * Get the $instance interface name for a CLR type.
 * E.g., "System.String" → "String$instance", "String" → "String$instance"
 */
export const getInstanceInterfaceName = (typeName: string): string => {
  // If it's a System.* name, extract the simple part
  if (typeName.startsWith("System.")) {
    const simpleName = typeName.substring(7); // Remove "System."
    return `${simpleName}$instance`;
  }

  // Already a simple name
  return `${typeName}$instance`;
};
