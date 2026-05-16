/**
 * Core expression types for IR — base types, union, and primary expression nodes.
 */

import { IrType } from "./ir-types.js";
import type {
  IrParameter,
  IrPattern,
  IrBinaryOperator,
  IrAssignmentOperator,
} from "./helpers.js";
import type { IrClassMember, IrUnionArmSelection } from "./statements.js";
import { IrBlockStatement } from "./statements.js";
import { NumericKind } from "./numeric-kind.js";
import { SourceLocation } from "../../types/diagnostic.js";
import type { DeclId, SignatureId, MemberId } from "../type-system/types.js";
import type {
  IrNumericNarrowingExpression,
  IrTypeAssertionExpression,
  IrAsInterfaceExpression,
  IrTryCastExpression,
  IrStackAllocExpression,
  IrDefaultOfExpression,
  IrNameOfExpression,
  IrSizeOfExpression,
} from "./expressions-extended.js";

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
  | IrAsInterfaceExpression
  | IrTryCastExpression
  | IrStackAllocExpression
  | IrDefaultOfExpression
  | IrNameOfExpression
  | IrSizeOfExpression;

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
  // Opaque handle to the declaration this identifier references (from Binding layer)
  readonly declId?: DeclId;
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
  /** Synthesized behavioral members (currently accessors) for object literal lowering. */
  readonly behaviorMembers?: readonly IrClassMember[];
  /** Authoritative frontend union-arm selection for contextual union targets. */
  readonly armSelection?: IrUnionArmSelection;
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
  /** Contextual type for object literals in typed positions (return, assignment, etc.) */
  readonly contextualType?: IrType;
  /** True if this object literal contains spread expressions (for IIFE lowering) */
  readonly hasSpreads?: boolean;
  /** True when this literal must emit as a C# anonymous object expression. */
  readonly emitAsAnonymousObject?: boolean;
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
  /** True when object-literal method shorthand must bind `this` to the constructed object. */
  readonly capturesObjectLiteralThis?: boolean;
  readonly inferredType?: IrType;
  /** Contextual type from call site or assignment target. */
  readonly contextualType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

export type IrArrowFunctionExpression = {
  readonly kind: "arrowFunction";
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
  readonly body: IrBlockStatement | IrExpression;
  readonly isAsync: boolean;
  readonly inferredType?: IrType;
  /** Contextual type from call site (e.g., array.map callback signature) */
  readonly contextualType?: IrType;
  readonly sourceSpan?: SourceLocation;
};

/**
 * Classification for computed member access lowering.
 * Determines whether TSN5107 (Int32 proof) is required.
 *
 * - clrIndexer: CLR indexer (obj[int]) - requires Int32 proof
 * - dictionary: Dictionary<K,V>[key] - NO Int32 requirement (key is typed)
 * - stringChar: string[int] character access - requires Int32 proof
 * - unknown: Fallback for unclassified access - emit error
 */
export type ComputedAccessKind =
  | "clrIndexer"
  | "dictionary"
  | "stringChar"
  | "unknown";

export type ComputedAccessProtocol = {
  readonly getterMember: string;
  readonly setterMember?: string;
};

export type IrMemberExpression = {
  readonly kind: "memberAccess";
  readonly object: IrExpression;
  readonly property: IrExpression | string;
  readonly isComputed: boolean; // true for obj[prop], false for obj.prop
  readonly isOptional: boolean; // true for obj?.prop
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
  /** Authoritative frontend union-arm selection for a narrowed receiver. */
  readonly receiverArmSelection?: IrUnionArmSelection;
  // Opaque handle to the member declaration (from Binding layer)
  readonly memberId?: MemberId;
  // Hierarchical member binding (from bindings manifest)
  // When a member access like systemLinq.enumerable.selectMany is resolved,
  // this contains the full CLR binding info
  readonly memberBinding?: {
    readonly kind: "method" | "property";
    readonly assembly: string; // e.g., "System.Linq"
    readonly type: string; // Full CLR type e.g., "System.Linq.Enumerable"
    readonly member: string; // CLR member name e.g., "SelectMany"
    // Parameter modifiers for ref/out/in parameters
    readonly parameterModifiers?: readonly {
      readonly index: number;
      readonly modifier: "ref" | "out" | "in";
    }[];
    readonly isExtensionMethod?: boolean;
    readonly receiverExpectedType?: IrType;
    readonly emitSemantics?: {
      readonly callStyle?: "receiver" | "static";
      readonly callableStaticAccessorKind?: "property" | "field";
    };
  };
  // Classification for computed access lowering (set during IR build)
  // Determines whether Int32 proof is required for indices
  readonly accessKind?: ComputedAccessKind;
  /** Explicit source-surface protocol for computed index access. */
  readonly accessProtocol?: ComputedAccessProtocol;
};

export type IrCallExpression = {
  readonly kind: "call";
  readonly callee: IrExpression;
  readonly arguments: readonly (IrExpression | IrSpreadExpression)[];
  readonly isOptional: boolean; // true for func?.()
  readonly intrinsicKind?: "globalSymbol";
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
  // Opaque handle to the resolved signature (from Binding layer)
  readonly signatureId?: SignatureId;
  /** Alternate overload candidates for post-proof re-resolution. */
  readonly candidateSignatureIds?: readonly SignatureId[];
  readonly typeArguments?: readonly IrType[]; // Explicit or inferred type arguments
  readonly requiresSpecialization?: boolean; // Flag for conditional/unsupported patterns
  /** Contextual expected return type used during original overload selection. */
  readonly resolutionExpectedReturnType?: IrType;
  readonly argumentPassing?: readonly ("value" | "ref" | "out" | "in")[]; // Passing mode for each argument
  /** Authoritative frontend union-arm selection for each argument-to-parameter edge. */
  readonly argumentArmSelections?: readonly IrUnionArmSelection[];
  /** Parameter types from resolved signature (for expectedType threading to array literals etc.) */
  readonly parameterTypes?: readonly (IrType | undefined)[];
  /** Declared/public parameter surface types for emission; not narrowed per call-site argument. */
  readonly surfaceParameterTypes?: readonly (IrType | undefined)[];
  /** Explicit rest-parameter metadata from the resolved/public signature. */
  readonly restParameter?: {
    readonly index: number;
    readonly arrayType: IrType | undefined;
    readonly elementType: IrType | undefined;
  };
  /** Declared/public rest-parameter metadata for emission. */
  readonly surfaceRestParameter?: {
    readonly index: number;
    readonly arrayType: IrType | undefined;
    readonly elementType: IrType | undefined;
  };
  /** Exact source-declared parameter surface retained across refresh passes. */
  readonly sourceBackedParameterTypes?: readonly (IrType | undefined)[];
  /** Exact source-declared public parameter surface retained across refresh passes. */
  readonly sourceBackedSurfaceParameterTypes?: readonly (IrType | undefined)[];
  /** Exact source-declared rest metadata retained across refresh passes. */
  readonly sourceBackedRestParameter?: {
    readonly index: number;
    readonly arrayType: IrType | undefined;
    readonly elementType: IrType | undefined;
  };
  /** Exact source-declared return type retained across refresh passes. */
  readonly sourceBackedReturnType?: IrType;
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
  // Opaque handle to the resolved constructor signature (from Binding layer)
  readonly signatureId?: SignatureId;
  /** Contextual expected return type used during original constructor resolution. */
  readonly resolutionExpectedReturnType?: IrType;
  /** Passing mode for each constructor argument (ref/out/in/value). */
  readonly argumentPassing?: readonly ("value" | "ref" | "out" | "in")[];
  /** Parameter types from resolved constructor signature (for expectedType threading). */
  readonly parameterTypes?: readonly (IrType | undefined)[];
  /** Declared/public constructor parameter surface types for emission. */
  readonly surfaceParameterTypes?: readonly (IrType | undefined)[];
  /** Exact source-declared constructor parameter surface retained across refresh passes. */
  readonly sourceBackedParameterTypes?: readonly (IrType | undefined)[];
  /** Exact source-declared public constructor parameter surface retained across refresh passes. */
  readonly sourceBackedSurfaceParameterTypes?: readonly (IrType | undefined)[];
  /** Exact source-declared constructor rest metadata retained across refresh passes. */
  readonly sourceBackedRestParameter?: {
    readonly index: number;
    readonly arrayType: IrType | undefined;
    readonly elementType: IrType | undefined;
  };
  /** Exact source-declared constructor result type retained across refresh passes. */
  readonly sourceBackedReturnType?: IrType;
  readonly typeArguments?: readonly IrType[]; // Explicit or inferred type arguments
  readonly requiresSpecialization?: boolean; // Flag for conditional/unsupported patterns
  readonly surfaceRestParameter?: {
    readonly index: number;
    readonly arrayType: IrType | undefined;
    readonly elementType: IrType | undefined;
  };
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

export type IrInOperatorPlan = {
  readonly kind: "dictionaryKey" | "unionProperty";
  readonly key: string;
};

export type IrBinaryExpression = {
  readonly kind: "binary";
  readonly operator: IrBinaryOperator;
  readonly left: IrExpression;
  readonly right: IrExpression;
  readonly inOperatorPlan?: IrInOperatorPlan;
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
  readonly expression?: IrExpression; // undefined for bare `yield`
  readonly delegate: boolean; // true for `yield*`, false for `yield`
  readonly inferredType?: IrType;
  readonly sourceSpan?: SourceLocation;
};
