/**
 * NumericKind - Represents all CLR numeric types that Tsonic supports.
 *
 * This module provides:
 * - NumericKind type union
 * - Mapping from Tsonic type names to CLR kinds
 * - Range bounds for compile-time literal validation
 * - C# binary operator promotion rules
 */

/**
 * Represents all CLR numeric types that Tsonic supports.
 * These map to specific C# primitive types.
 */
export type NumericKind =
  | "SByte" // System.SByte, -128 to 127
  | "Byte" // System.Byte, 0 to 255
  | "Int16" // System.Int16, short
  | "UInt16" // System.UInt16, ushort
  | "Int32" // System.Int32, int
  | "UInt32" // System.UInt32, uint
  | "Int64" // System.Int64, long
  | "UInt64" // System.UInt64, ulong
  | "Single" // System.Single, float
  | "Double"; // System.Double, double

/**
 * Maps Tsonic type alias names to CLR numeric kinds.
 * Used to recognize numeric intent from TypeScript annotations.
 */
export const TSONIC_TO_NUMERIC_KIND: ReadonlyMap<string, NumericKind> = new Map(
  [
    ["sbyte", "SByte"],
    ["byte", "Byte"],
    ["short", "Int16"],
    ["ushort", "UInt16"],
    ["int", "Int32"],
    ["uint", "UInt32"],
    ["long", "Int64"],
    ["ulong", "UInt64"],
    ["float", "Single"],
    ["double", "Double"],
  ]
);

/**
 * Maps CLR numeric kinds back to C# type names for emission.
 */
export const NUMERIC_KIND_TO_CSHARP: ReadonlyMap<NumericKind, string> = new Map(
  [
    ["SByte", "sbyte"],
    ["Byte", "byte"],
    ["Int16", "short"],
    ["UInt16", "ushort"],
    ["Int32", "int"],
    ["UInt32", "uint"],
    ["Int64", "long"],
    ["UInt64", "ulong"],
    ["Single", "float"],
    ["Double", "double"],
  ]
);

/**
 * Range bounds for compile-time literal validation.
 * Uses bigint for exact integer range checking.
 * Float ranges are marked as 0n - they require different validation.
 */
export const NUMERIC_RANGES: ReadonlyMap<
  NumericKind,
  { readonly min: bigint; readonly max: bigint }
> = new Map([
  ["SByte", { min: -128n, max: 127n }],
  ["Byte", { min: 0n, max: 255n }],
  ["Int16", { min: -32768n, max: 32767n }],
  ["UInt16", { min: 0n, max: 65535n }],
  ["Int32", { min: -2147483648n, max: 2147483647n }],
  ["UInt32", { min: 0n, max: 4294967295n }],
  ["Int64", { min: -9223372036854775808n, max: 9223372036854775807n }],
  ["UInt64", { min: 0n, max: 18446744073709551615n }],
  ["Single", { min: 0n, max: 0n }], // Float validation handled separately
  ["Double", { min: 0n, max: 0n }], // Float validation handled separately
]);

/**
 * Check if a numeric kind is an integer type (not floating point).
 */
export const isIntegerKind = (kind: NumericKind): boolean =>
  kind !== "Single" && kind !== "Double";

/**
 * Check if a numeric kind is a signed type.
 */
export const isSignedKind = (kind: NumericKind): boolean =>
  kind === "SByte" ||
  kind === "Int16" ||
  kind === "Int32" ||
  kind === "Int64" ||
  kind === "Single" ||
  kind === "Double";

/**
 * C# binary operator result type promotion.
 * Returns the result type when two numeric kinds are combined with +, -, *, /, %.
 *
 * Rules (per C# spec):
 * 1. If either is double, result is double
 * 2. If either is float, result is float
 * 3. If either is ulong, result is ulong
 * 4. If either is long, result is long
 * 5. If either is uint and other is sbyte/short/int, result is long
 * 6. If either is uint, result is uint
 * 7. Otherwise, result is int (byte, sbyte, short, ushort all promote to int)
 */
export const getBinaryResultKind = (
  left: NumericKind,
  right: NumericKind
): NumericKind => {
  // Rule 1: double dominates
  if (left === "Double" || right === "Double") return "Double";

  // Rule 2: float dominates (if no double)
  if (left === "Single" || right === "Single") return "Single";

  // Rule 3: ulong dominates (if no floating)
  if (left === "UInt64" || right === "UInt64") return "UInt64";

  // Rule 4: long dominates (if no ulong)
  if (left === "Int64" || right === "Int64") return "Int64";

  // Rule 5: uint + signed smaller type = long
  const signedSmallerTypes = ["SByte", "Int16", "Int32"];
  if (left === "UInt32" && signedSmallerTypes.includes(right)) return "Int64";
  if (right === "UInt32" && signedSmallerTypes.includes(left)) return "Int64";

  // Rule 6: uint dominates (if no above cases)
  if (left === "UInt32" || right === "UInt32") return "UInt32";

  // Rule 7: All smaller integer types promote to int
  return "Int32";
};

/**
 * Check if a literal value fits within the range of a numeric kind.
 * Returns true if the value is valid for the target kind.
 *
 * For integer kinds: checks exact range
 * For floating kinds: currently always returns true (could add precision checks)
 */
export const literalFitsInKind = (
  value: number,
  kind: NumericKind
): boolean => {
  // Floating point kinds - allow any number for now
  if (kind === "Single" || kind === "Double") {
    return true;
  }

  // For integer kinds, the value must be an integer
  if (!Number.isInteger(value)) {
    return false;
  }

  // Check range
  const range = NUMERIC_RANGES.get(kind);
  if (range === undefined) {
    return false;
  }

  // Convert to bigint for range checking
  const bigValue = BigInt(Math.trunc(value));
  return bigValue >= range.min && bigValue <= range.max;
};

/**
 * Check if conversion from source to target is a widening (safe) conversion.
 * Widening never loses data; narrowing may.
 */
export const isWideningConversion = (
  source: NumericKind,
  target: NumericKind
): boolean => {
  // Same type - always safe
  if (source === target) return true;

  // Widening paths (simplified - C# has more complex rules)
  const wideningPaths: ReadonlyMap<NumericKind, readonly NumericKind[]> =
    new Map([
      ["SByte", ["Int16", "Int32", "Int64", "Single", "Double"]],
      [
        "Byte",
        [
          "Int16",
          "UInt16",
          "Int32",
          "UInt32",
          "Int64",
          "UInt64",
          "Single",
          "Double",
        ],
      ],
      ["Int16", ["Int32", "Int64", "Single", "Double"]],
      ["UInt16", ["Int32", "UInt32", "Int64", "UInt64", "Single", "Double"]],
      ["Int32", ["Int64", "Single", "Double"]],
      ["UInt32", ["Int64", "UInt64", "Single", "Double"]],
      ["Int64", ["Single", "Double"]],
      ["UInt64", ["Single", "Double"]],
      ["Single", ["Double"]],
      ["Double", []],
    ]);

  const targets = wideningPaths.get(source);
  return targets !== undefined && targets.includes(target);
};
