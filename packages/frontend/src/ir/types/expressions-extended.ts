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
 * - `10 as int` → IrNumericNarrowingExpression(literal 10, targetKind: "Int32")
 * - `x as byte` → IrNumericNarrowingExpression(identifier x, targetKind: "Byte")
 * - `42 as number` → IrNumericNarrowingExpression(literal 42, targetKind: "Double")
 *
 * NOTE: Despite the name "Narrowing", this node also handles widening conversions.
 * A future rename to IrNumericConversionExpression may be appropriate.
 */
export type IrNumericNarrowingExpression = {
  readonly kind: "numericNarrowing";
  /** The expression being narrowed */
  readonly expression: IrExpression;
  /** The target CLR numeric kind */
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
      readonly type: "dotnetReturn";
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
 * Emits as C# throwing cast: (T)x
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
  readonly sourceSpan?: SourceLocation;
};

/**
 * Represents an interface upcast (asinterface<T>(x)).
 *
 * Airplane-grade rule:
 * - This must never emit an explicit runtime cast in C#.
 * - It exists to let TypeScript treat a value as an interface (or other nominal type)
 *   when the value's declared TS type is narrower (e.g., DbSet<TEntity> vs IQueryable<TEntity>).
 *
 * Emits as the underlying expression `x` (type-only), relying on contextual typing in C#:
 * - `const q = asinterface<IQueryable<T>>(db.Events);` → `global::System.Linq.IQueryable<T> q = db.Events;`
 *
 * NOTE: If you need to access members that are implemented explicitly on the CLR type,
 * prefer assigning to a typed local first (so C# has the interface static type).
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
 * Emits as C# safe cast: x as T
 * Returns T | null (null if cast fails).
 *
 * This is the C# "as" keyword behavior - returns null on failure instead of throwing.
 *
 * Examples:
 * - `trycast<Person>(obj)` → `obj as Person` in C#
 * - `trycast<string>(value)` → `value as string` in C#
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
 * Emits as C# stackalloc expression: `stackalloc T[size]`.
 *
 * Example:
 * - `stackalloc<int>(256)` → `stackalloc int[256]` in C#
 */
export type IrStackAllocExpression = {
  readonly kind: "stackalloc";
  /** Element type allocated on the stack */
  readonly elementType: IrType;
  /** Number of elements to allocate */
  readonly size: IrExpression;
  /** Inferred type is Span<T> */
  readonly inferredType: IrType;
  readonly sourceSpan?: SourceLocation;
};

/**
 * Represents a default value intrinsic (defaultof<T>()).
 *
 * Emits as C# default expression: `default(T)`.
 *
 * Example:
 * - `defaultof<int>()` → `default(int)` in C#
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
 * Emits as C# `sizeof(T)`.
 *
 * Examples:
 * - `sizeof<int>()` → `sizeof(int)`
 * - `sizeof<Guid>()` → `sizeof(global::System.Guid)`
 */
export type IrSizeOfExpression = {
  readonly kind: "sizeof";
  /** The type whose size is requested */
  readonly targetType: IrType;
  /** Inferred type is always int */
  readonly inferredType: IrType;
  readonly sourceSpan?: SourceLocation;
};
