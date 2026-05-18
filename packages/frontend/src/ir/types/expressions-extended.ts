/**
 * Extended expression types for IR — numeric narrowing, type assertions,
 * intrinsics (stackalloc, defaultof, nameof, sizeof), and proof types.
 */

import { IrType } from "./ir-types.js";
import { NumericKind } from "./numeric-kind.js";
import { SourceLocation } from "../../types/diagnostic.js";
import type { IrExpression } from "./expressions-core.js";

/**
 * Represents an explicit numeric conversion intent (narrowing OR widening).
 *
 * This captures explicit numeric intent from the source code while preserving
 * the inner expression. The coercion pass uses this to distinguish explicit
 * user intent from implicit conversions.
 *
 * SEMANTICS:
 * - This node indicates **explicit user intent** to convert between numeric types
 * - May be narrowing (e.g., `x as int`) or widening (e.g., `42 as number`)
 * - Used by TSN5110 to exempt explicit casts from int→double coercion errors
 * - The proof system validates that narrowing operations are sound
 *
 * Examples:
 * - `10 as int` → IrNumericNarrowingExpression(literal 10, targetKind: int32)
 * - `x as byte` → IrNumericNarrowingExpression(identifier x, targetKind: uint8)
 * - `42 as number` → IrNumericNarrowingExpression(literal 42, targetKind: float64)
 *
 * NOTE: Despite the name "Narrowing", this node also handles widening conversions.
 * A future rename to IrNumericConversionExpression may be appropriate.
 */
export type IrNumericNarrowingExpression = {
  readonly kind: "numericNarrowing";
  /** The expression being narrowed */
  readonly expression: IrExpression;
  /** The target numeric kind */
  readonly targetKind: NumericKind;
  /** Type after narrowing (always a number with numericIntent set) */
  readonly inferredType: IrType;
  readonly sourceSpan?: SourceLocation;
  /**
   * Attached by the Numeric Proof Pass.
   * If present and valid, the narrowing has been proven sound.
   * If undefined, the proof pass hasn't run yet or couldn't prove it.
   */
  readonly proof?: NumericProof;
};

/**
 * Proof that an expression produces a specific numeric kind.
 * Attached to expressions by the Numeric Proof Pass.
 */
export type NumericProof = {
  /** The proven numeric kind */
  readonly kind: NumericKind;
  /** How the proof was established */
  readonly source: ProofSource;
};

/**
 * Describes how a numeric proof was established.
 */
export type ProofSource =
  | { readonly type: "literal"; readonly value: number | bigint }
  | { readonly type: "parameter"; readonly name: string }
  | {
      readonly type: "externalReturn";
      readonly method: string;
      readonly returnKind: NumericKind;
    }
  | {
      readonly type: "binaryOp";
      readonly operator: string;
      readonly leftKind: NumericKind;
      readonly rightKind: NumericKind;
    }
  | {
      readonly type: "unaryOp";
      readonly operator: string;
      readonly operandKind: NumericKind;
    }
  | { readonly type: "narrowing"; readonly from: NumericKind }
  | { readonly type: "variable"; readonly name: string };

/**
 * Represents a non-numeric type assertion (x as T).
 *
 * This captures the explicit user intent to cast between types.
 * Emits as a target throwing cast.
 *
 * For safe (nullable) casts, use trycast<T>(x) which creates IrTryCastExpression.
 *
 * Examples:
 * - `obj as Person` → IrTypeAssertionExpression(obj, referenceType(Person))
 * - `value as string` → IrTypeAssertionExpression(value, primitiveType(string))
 *
 * NOTE: Numeric type assertions (`as int`, `as byte`) use IrNumericNarrowingExpression instead.
 */
export type IrTypeAssertionExpression = {
  readonly kind: "typeAssertion";
  /** The expression being cast */
  readonly expression: IrExpression;
  /** The target type for the cast */
  readonly targetType: IrType;
  /** Inferred type (same as targetType) */
  readonly inferredType: IrType;
  /**
   * Compiler-authored runtime-union source member numbers that remain reachable
   * after deterministic overload specialization.
   *
   * This is only used when `expression` still carries the full preserved
   * runtime-union layout, but the current assertion knows that only a subset of
   * source carriers can occur for this call shape.
   */
  readonly selectedRuntimeUnionMembers?: readonly number[];
  readonly sourceSpan?: SourceLocation;
};

/**
 * Represents an interface upcast (asinterface<T>(x)).
 *
 * Airplane-grade rule:
 * - This must never emit an explicit runtime cast in the target.
 * - It exists to let TypeScript treat a value as an interface (or other nominal type)
 *   when the value's declared TS type is narrower than the contextual contract.
 *
 * Emits as the underlying expression `x` (type-only), relying on target contextual typing:
 * - `const q = asinterface<Query<T>>(source.items);` → a typed local assignment
 *
 * NOTE: If you need to access members that are implemented explicitly on the target type,
 * prefer assigning to a typed local first.
 */
export type IrAsInterfaceExpression = {
  readonly kind: "asinterface";
  /** The expression being re-typed */
  readonly expression: IrExpression;
  /** The target type for the interface view */
  readonly targetType: IrType;
  /** Inferred type (same as targetType) */
  readonly inferredType: IrType;
  readonly sourceSpan?: SourceLocation;
};

/**
 * Represents a safe cast operation (trycast<T>(x)).
 *
 * Emits as a target safe cast.
 * Returns T | null (null if cast fails).
 *
 * Returns null on failure instead of throwing.
 *
 * Examples:
 * - `trycast<Person>(obj)` → safe-cast Person
 * - `trycast<string>(value)` → safe-cast string
 */
export type IrTryCastExpression = {
  readonly kind: "trycast";
  /** The expression being cast */
  readonly expression: IrExpression;
  /** The target type for the cast */
  readonly targetType: IrType;
  /** Inferred type is T | null */
  readonly inferredType: IrType;
  readonly sourceSpan?: SourceLocation;
};

/**
 * Represents a stack allocation operation (stackalloc<T>(size)).
 *
 * Emits as target stack allocation.
 *
 * Example:
 * - `stackalloc<int>(256)` → native stack allocation of 256 ints
 */
export type IrStackAllocExpression = {
  readonly kind: "stackalloc";
  /** Element type allocated on the stack */
  readonly elementType: IrType;
  /** Number of elements to allocate */
  readonly size: IrExpression;
  /** Inferred type is the active target's stack buffer abstraction. */
  readonly inferredType: IrType;
  readonly sourceSpan?: SourceLocation;
};

/**
 * Represents a default value intrinsic (defaultof<T>()).
 *
 * Emits as target default-value expression.
 *
 * Example:
 * - `defaultof<int>()` → default int value
 */
export type IrDefaultOfExpression = {
  readonly kind: "defaultof";
  /** The type whose default value is requested */
  readonly targetType: IrType;
  /** Inferred type is the same as targetType */
  readonly inferredType: IrType;
  readonly sourceSpan?: SourceLocation;
};

/**
 * Represents a compile-time nameof intrinsic.
 *
 * Tsonic lowers this to a compile-time string literal using the authored TS symbol text.
 *
 * Examples:
 * - `nameof(user)` → `"user"`
 * - `nameof(user.name)` → `"name"`
 * - `nameof(MyType)` → `"MyType"`
 */
export type IrNameOfExpression = {
  readonly kind: "nameof";
  /** The TS-authored symbol/member name extracted at conversion time. */
  readonly name: string;
  readonly inferredType: IrType;
  readonly sourceSpan?: SourceLocation;
};

/**
 * Represents a compile-time sizeof intrinsic.
 *
 * Emits as target `sizeof(T)`.
 *
 * Examples:
 * - `sizeof<int>()` → `sizeof(int)`
 * - `sizeof<NativeId>()` → target sizeof expression for the source type
 */
export type IrSizeOfExpression = {
  readonly kind: "sizeof";
  /** The type whose size is requested */
  readonly targetType: IrType;
  /** Inferred type is always int */
  readonly inferredType: IrType;
  readonly sourceSpan?: SourceLocation;
};
