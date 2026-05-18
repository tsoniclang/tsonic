/**
 * NumericKind - Represents all source-level numeric categories that Tsonic supports.
 *
 * This module provides:
 * - NumericKind type union
 * - Mapping from Tsonic type names to neutral numeric kinds
 * - Range bounds for compile-time literal validation
 * - Numeric promotion rules for Tsonic's current source semantics
 */

/**
 * Represents all numeric categories that Tsonic supports.
 * These are source-level semantic facts, not target runtime type names.
 */
export type NumericKind =
  | "int8"
  | "uint8"
  | "int16"
  | "uint16"
  | "int32"
  | "uint32"
  | "int64"
  | "uint64"
  | "float32"
  | "float64";

export type NumericTypeFact = {
  readonly kind: "numeric";
  readonly numericKind:
    | NumericKind
    | "float16"
    | "decimal"
    | "native-int"
    | "native-uint"
    | "int128"
    | "uint128";
  readonly integral: boolean;
  readonly jsTypeof: "number";
};

export type PrimitiveTypeFact =
  | NumericTypeFact
  | {
      readonly kind: "boolean";
      readonly jsTypeof: "boolean";
    };

/**
 * Maps Tsonic type alias names to neutral numeric kinds.
 * Used to recognize numeric intent from TypeScript annotations.
 */
export const TSONIC_TO_NUMERIC_KIND: ReadonlyMap<string, NumericKind> = new Map(
  [
    ["sbyte", "int8"],
    ["byte", "uint8"],
    ["short", "int16"],
    ["ushort", "uint16"],
    ["int", "int32"],
    ["uint", "uint32"],
    ["long", "int64"],
    ["ulong", "uint64"],
    ["float", "float32"],
    ["double", "float64"],
  ]
);

/**
 * Maps numeric kinds back to their Tsonic source aliases.
 */
export const NUMERIC_KIND_TO_TYPE_ALIAS: ReadonlyMap<NumericKind, string> =
  new Map([
    ["int8", "sbyte"],
    ["uint8", "byte"],
    ["int16", "short"],
    ["uint16", "ushort"],
    ["int32", "int"],
    ["uint32", "uint"],
    ["int64", "long"],
    ["uint64", "ulong"],
    ["float32", "float"],
    ["float64", "double"],
  ]);

const normalizeExternalNumericName = (name: string): string => {
  const withoutGlobal = name.startsWith("global::")
    ? name.slice("global::".length)
    : name;
  const arityIndex = withoutGlobal.indexOf("/");
  return arityIndex >= 0 ? withoutGlobal.slice(0, arityIndex) : withoutGlobal;
};

const numericFact = (
  numericKind: NumericTypeFact["numericKind"],
  integral: boolean
): NumericTypeFact => ({
  kind: "numeric",
  numericKind,
  integral,
  jsTypeof: "number",
});

const numericFactEntries = (
  names: readonly string[],
  numericKind: NumericTypeFact["numericKind"],
  integral: boolean
): readonly (readonly [string, NumericTypeFact])[] =>
  names.map((name) => [name, numericFact(numericKind, integral)] as const);

const NUMERIC_NAME_FACTS: ReadonlyMap<string, NumericTypeFact> = new Map([
  ...numericFactEntries(["sbyte", "int8"], "int8", true),
  ...numericFactEntries(["byte", "uint8"], "uint8", true),
  ...numericFactEntries(["short", "int16"], "int16", true),
  ...numericFactEntries(["ushort", "uint16"], "uint16", true),
  ...numericFactEntries(["int", "int32"], "int32", true),
  ...numericFactEntries(["uint", "uint32"], "uint32", true),
  ...numericFactEntries(["long", "int64"], "int64", true),
  ...numericFactEntries(["ulong", "uint64"], "uint64", true),
  ...numericFactEntries(["nint"], "native-int", true),
  ...numericFactEntries(["nuint"], "native-uint", true),
  ...numericFactEntries(["int128"], "int128", true),
  ...numericFactEntries(["uint128"], "uint128", true),
  ...numericFactEntries(["half"], "float16", false),
  ...numericFactEntries(["float", "float32"], "float32", false),
  ...numericFactEntries(["number", "double", "float64"], "float64", false),
  ...numericFactEntries(["decimal"], "decimal", false),
]);

const BOOLEAN_NAME_FACTS: ReadonlyMap<string, PrimitiveTypeFact> = new Map([
  ["boolean", { kind: "boolean", jsTypeof: "boolean" }],
  ["bool", { kind: "boolean", jsTypeof: "boolean" }],
  ["Boolean", { kind: "boolean", jsTypeof: "boolean" }],
]);

export const numericTypeFactFromName = (
  name: string
): NumericTypeFact | undefined =>
  NUMERIC_NAME_FACTS.get(normalizeExternalNumericName(name));

export const booleanTypeFactFromName = (
  name: string
): PrimitiveTypeFact | undefined =>
  BOOLEAN_NAME_FACTS.get(normalizeExternalNumericName(name));

export const primitiveTypeFactFromName = (
  name: string
): PrimitiveTypeFact | undefined =>
  numericTypeFactFromName(name) ?? booleanTypeFactFromName(name);

/**
 * Range bounds for compile-time literal validation.
 * Uses bigint for exact integer range checking.
 * Float ranges are marked as 0n - they require different validation.
 */
export const NUMERIC_RANGES: ReadonlyMap<
  NumericKind,
  { readonly min: bigint; readonly max: bigint }
> = new Map([
  ["int8", { min: -128n, max: 127n }],
  ["uint8", { min: 0n, max: 255n }],
  ["int16", { min: -32768n, max: 32767n }],
  ["uint16", { min: 0n, max: 65535n }],
  ["int32", { min: -2147483648n, max: 2147483647n }],
  ["uint32", { min: 0n, max: 4294967295n }],
  ["int64", { min: -9223372036854775808n, max: 9223372036854775807n }],
  ["uint64", { min: 0n, max: 18446744073709551615n }],
  ["float32", { min: 0n, max: 0n }], // Float validation handled separately
  ["float64", { min: 0n, max: 0n }], // Float validation handled separately
]);

/**
 * Check if a numeric kind is an integer type (not floating point).
 */
export const isIntegerKind = (kind: NumericKind): boolean =>
  kind !== "float32" && kind !== "float64";

/**
 * Check if a numeric kind is a signed type.
 */
export const isSignedKind = (kind: NumericKind): boolean =>
  kind === "int8" ||
  kind === "int16" ||
  kind === "int32" ||
  kind === "int64" ||
  kind === "float32" ||
  kind === "float64";

/**
 * Numeric binary operator result type promotion.
 * Returns the result type when two numeric kinds are combined with +, -, *, /, %.
 *
 * Rules:
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
  // Rule 1: float64 dominates
  if (left === "float64" || right === "float64") return "float64";

  // Rule 2: float32 dominates (if no float64)
  if (left === "float32" || right === "float32") return "float32";

  // Rule 3: uint64 dominates (if no floating)
  if (left === "uint64" || right === "uint64") return "uint64";

  // Rule 4: int64 dominates (if no uint64)
  if (left === "int64" || right === "int64") return "int64";

  // Rule 5: uint32 + signed smaller type = int64
  const signedSmallerTypes = ["int8", "int16", "int32"];
  if (left === "uint32" && signedSmallerTypes.includes(right)) return "int64";
  if (right === "uint32" && signedSmallerTypes.includes(left)) return "int64";

  // Rule 6: uint32 dominates (if no above cases)
  if (left === "uint32" || right === "uint32") return "uint32";

  // Rule 7: All smaller integer types promote to int32
  return "int32";
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
  if (kind === "float32" || kind === "float64") {
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

  // Widening paths for Tsonic numeric semantics.
  const wideningPaths: ReadonlyMap<NumericKind, readonly NumericKind[]> =
    new Map([
      ["int8", ["int16", "int32", "int64", "float32", "float64"]],
      [
        "uint8",
        [
          "int16",
          "uint16",
          "int32",
          "uint32",
          "int64",
          "uint64",
          "float32",
          "float64",
        ],
      ],
      ["int16", ["int32", "int64", "float32", "float64"]],
      ["uint16", ["int32", "uint32", "int64", "uint64", "float32", "float64"]],
      ["int32", ["int64", "float32", "float64"]],
      ["uint32", ["int64", "uint64", "float32", "float64"]],
      ["int64", ["float32", "float64"]],
      ["uint64", ["float32", "float64"]],
      ["float32", ["float64"]],
      ["float64", []],
    ]);

  const targets = wideningPaths.get(source);
  return targets !== undefined && targets.includes(target);
};
