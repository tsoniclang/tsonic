/**
 * Expression types for IR
 */

import { IrType } from "./ir-types.js";
import {
  IrParameter,
  IrPattern,
  IrBinaryOperator,
  IrAssignmentOperator,
} from "./helpers.js";
import { IrBlockStatement } from "./statements.js";
import { NumericKind } from "./numeric-kind.js";
import { SourceLocation } from "../../types/diagnostic.js";

/**
 * Base fields shared by all expression types.
 * - inferredType: The type TypeScript infers for this expression
 * - contextualType: The type expected from context (assignment target, return type, etc.)
 * - sourceSpan: Source location for error reporting
 */
export type IrExpressionBase = {
  readonly inferredType?: IrType;
  readonly contextualType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

export type IrExpression =
  | IrLiteralExpression
  | IrIdentifierExpression
  | IrArrayExpression
  | IrObjectExpression
  | IrFunctionExpression
  | IrArrowFunctionExpression
  | IrMemberExpression
  | IrCallExpression
  | IrNewExpression
  | IrThisExpression
  | IrUpdateExpression
  | IrUnaryExpression
  | IrBinaryExpression
  | IrLogicalExpression
  | IrConditionalExpression
  | IrAssignmentExpression
  | IrTemplateLiteralExpression
  | IrSpreadExpression
  | IrAwaitExpression
  | IrYieldExpression
  | IrNumericNarrowingExpression
  | IrTypeAssertionExpression
  | IrTryCastExpression;

export type IrLiteralExpression = {
  readonly kind: "literal";
  readonly value: string | number | boolean | null | undefined;
  readonly raw?: string;
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
  /**
   * For numeric literals, the inferred numeric kind based on lexeme form.
   * - Integer literals (42, 0xFF) → "Int32"
   * - Floating literals (42.0, 3.14, 1e3) → "Double"
   *
   * This is expression-level information, NOT type-level.
   * The type system still sees this as "number" (which means double).
   * This field enables the emitter to emit `42` vs `42.0` appropriately
   * and the coercion pass to detect int→double conversions.
   */
  readonly numericIntent?: NumericKind;
};

export type IrIdentifierExpression = {
  readonly kind: "identifier";
  readonly name: string;
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
  // Resolved binding for globals (console, Math, etc.)
  readonly resolvedClrType?: string; // e.g., "Tsonic.Runtime.console"
  readonly resolvedAssembly?: string; // e.g., "Tsonic.Runtime"
  readonly csharpName?: string; // Optional: renamed identifier in C# (from binding)
  // For imported symbols from local modules
  readonly importedFrom?: {
    readonly containerName: string; // e.g., "Math"
    readonly exportName: string; // e.g., "add" (may differ from local name if aliased)
    readonly namespace: string; // e.g., "MultiFileCheck.utils"
  };
  // For aliased imports: the original export name before renaming
  // e.g., for `import { String as ClrString }`, originalName is "String"
  readonly originalName?: string;
};

export type IrArrayExpression = {
  readonly kind: "array";
  readonly elements: readonly (IrExpression | IrSpreadExpression | undefined)[]; // undefined for holes
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

export type IrObjectExpression = {
  readonly kind: "object";
  readonly properties: readonly IrObjectProperty[];
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
  /** Contextual type for object literals in typed positions (return, assignment, etc.) */
  readonly contextualType?: IrType;
  /** True if this object literal contains spread expressions (for IIFE lowering) */
  readonly hasSpreads?: boolean;
};

export type IrObjectProperty =
  | {
      readonly kind: "property";
      readonly key: string | IrExpression;
      readonly value: IrExpression;
      readonly shorthand: boolean;
    }
  | { readonly kind: "spread"; readonly expression: IrExpression };

export type IrFunctionExpression = {
  readonly kind: "functionExpression";
  readonly name?: string;
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
  readonly body: IrBlockStatement;
  readonly isAsync: boolean;
  readonly isGenerator: boolean;
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

export type IrArrowFunctionExpression = {
  readonly kind: "arrowFunction";
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
  readonly body: IrBlockStatement | IrExpression;
  readonly isAsync: boolean;
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

/**
 * Classification for computed member access lowering.
 * Determines whether TSN5107 (Int32 proof) is required.
 *
 * - clrIndexer: CLR indexer (obj[int]) - requires Int32 proof
 * - dictionary: Dictionary<K,V>[key] - NO Int32 requirement (key is typed)
 * - jsRuntimeArray: Tsonic.JSRuntime.Array.get() - requires Int32 proof
 * - stringChar: string[int] character access - requires Int32 proof
 * - unknown: Fallback for unclassified access - emit error
 */
export type ComputedAccessKind =
  | "clrIndexer"
  | "dictionary"
  | "jsRuntimeArray"
  | "stringChar"
  | "unknown";

export type IrMemberExpression = {
  readonly kind: "memberAccess";
  readonly object: IrExpression;
  readonly property: IrExpression | string;
  readonly isComputed: boolean; // true for obj[prop], false for obj.prop
  readonly isOptional: boolean; // true for obj?.prop
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
  // Hierarchical member binding (from bindings manifest)
  // When a member access like systemLinq.enumerable.selectMany is resolved,
  // this contains the full CLR binding info
  readonly memberBinding?: {
    readonly assembly: string; // e.g., "System.Linq"
    readonly type: string; // Full CLR type e.g., "System.Linq.Enumerable"
    readonly member: string; // CLR member name e.g., "SelectMany"
    // Parameter modifiers for ref/out/in parameters
    readonly parameterModifiers?: readonly {
      readonly index: number;
      readonly modifier: "ref" | "out" | "in";
    }[];
  };
  // Classification for computed access lowering (set during IR build)
  // Determines whether Int32 proof is required for indices
  readonly accessKind?: ComputedAccessKind;
};

export type IrCallExpression = {
  readonly kind: "call";
  readonly callee: IrExpression;
  readonly arguments: readonly (IrExpression | IrSpreadExpression)[];
  readonly isOptional: boolean; // true for func?.()
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
  readonly typeArguments?: readonly IrType[]; // Explicit or inferred type arguments
  readonly requiresSpecialization?: boolean; // Flag for conditional/unsupported patterns
  readonly argumentPassing?: readonly ("value" | "ref" | "out" | "in")[]; // Passing mode for each argument
  /** Parameter types from resolved signature (for expectedType threading to array literals etc.) */
  readonly parameterTypes?: readonly (IrType | undefined)[];
  /** Type predicate narrowing metadata (for `x is T` predicates) */
  readonly narrowing?: {
    readonly kind: "typePredicate";
    readonly argIndex: number; // which argument is being narrowed
    readonly targetType: IrType; // the asserted type
  };
};

export type IrNewExpression = {
  readonly kind: "new";
  readonly callee: IrExpression;
  readonly arguments: readonly (IrExpression | IrSpreadExpression)[];
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
  readonly typeArguments?: readonly IrType[]; // Explicit or inferred type arguments
  readonly requiresSpecialization?: boolean; // Flag for conditional/unsupported patterns
};

export type IrThisExpression = {
  readonly kind: "this";
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

export type IrUpdateExpression = {
  readonly kind: "update";
  readonly operator: "++" | "--";
  readonly prefix: boolean;
  readonly expression: IrExpression;
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

export type IrUnaryExpression = {
  readonly kind: "unary";
  readonly operator: "+" | "-" | "!" | "~" | "typeof" | "void" | "delete";
  readonly expression: IrExpression;
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

export type IrBinaryExpression = {
  readonly kind: "binary";
  readonly operator: IrBinaryOperator;
  readonly left: IrExpression;
  readonly right: IrExpression;
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

export type IrLogicalExpression = {
  readonly kind: "logical";
  readonly operator: "&&" | "||" | "??";
  readonly left: IrExpression;
  readonly right: IrExpression;
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

export type IrConditionalExpression = {
  readonly kind: "conditional";
  readonly condition: IrExpression;
  readonly whenTrue: IrExpression;
  readonly whenFalse: IrExpression;
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

export type IrAssignmentExpression = {
  readonly kind: "assignment";
  readonly operator: IrAssignmentOperator;
  readonly left: IrExpression | IrPattern;
  readonly right: IrExpression;
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

export type IrTemplateLiteralExpression = {
  readonly kind: "templateLiteral";
  readonly quasis: readonly string[];
  readonly expressions: readonly IrExpression[];
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

export type IrSpreadExpression = {
  readonly kind: "spread";
  readonly expression: IrExpression;
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

export type IrAwaitExpression = {
  readonly kind: "await";
  readonly expression: IrExpression;
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

export type IrYieldExpression = {
  readonly kind: "yield";
  readonly expression?: IrExpression; // Optional for bare `yield`
  readonly delegate: boolean; // true for `yield*`, false for `yield`
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

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
 * For safe (nullable) casts, use tryCast<T>(x) which creates IrTryCastExpression.
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
 * Represents a safe cast operation (tryCast<T>(x)).
 *
 * Emits as C# safe cast: x as T
 * Returns T | null (null if cast fails).
 *
 * This is the C# "as" keyword behavior - returns null on failure instead of throwing.
 *
 * Examples:
 * - `tryCast<Person>(obj)` → `obj as Person` in C#
 * - `tryCast<string>(value)` → `value as string` in C#
 */
export type IrTryCastExpression = {
  readonly kind: "tryCast";
  /** The expression being cast */
  readonly expression: IrExpression;
  /** The target type for the cast */
  readonly targetType: IrType;
  /** Inferred type is T | null */
  readonly inferredType: IrType;
  readonly sourceSpan?: SourceLocation;
};
