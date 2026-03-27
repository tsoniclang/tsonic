/**
 * Variable declaration type checking helpers and static field type resolution.
 *
 * Provides predicates for type emittability, structural assertion detection,
 * nullish initializer detection, explicit cast checking, and static field
 * type resolution.
 */

import {
  IrExpression,
  IrType,
  NumericKind,
  NUMERIC_KIND_TO_CSHARP,
  stableIrTypeKey,
} from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import { resolveBehavioralObjectLiteralType } from "../../expressions/collections.js";
import { resolveAsInterfaceTargetType } from "../../core/semantic/variable-type-resolution.js";
import {
  isDefinitelyValueType,
  isTypeOnlyStructuralTarget,
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import { resolveIdentifierValueSurfaceType } from "../../core/semantic/direct-value-surfaces.js";
import { extractCalleeNameFromAst } from "../../core/format/backend-ast/utils.js";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import type {
  CSharpTypeAst,
  CSharpExpressionAst,
} from "../../core/format/backend-ast/types.js";
import type { IrStatement } from "@tsonic/frontend";

/**
 * Types that require explicit LHS type because C# has no literal suffix for them.
 * For these types, `var x = 200;` would infer `int`, not the intended type.
 */
export const TYPES_NEEDING_EXPLICIT_DECL = new Set([
  "byte",
  "sbyte",
  "short",
  "ushort",
]);

/**
 * Check if a type can be explicitly emitted as a C# type.
 * Returns false for types that cannot be named in C# (any, unknown, anonymous).
 */
export const canEmitTypeExplicitly = (type: IrType): boolean => {
  // Reject any/unknown (these are separate type kinds, not primitive names)
  if (type.kind === "anyType" || type.kind === "unknownType") {
    return false;
  }

  if (type.kind === "typeParameterType") {
    return true;
  }

  // Accept primitives
  if (type.kind === "primitiveType") {
    return true;
  }

  // Accept arrays, functions, references, tuples, dictionaries
  if (
    type.kind === "arrayType" ||
    type.kind === "functionType" ||
    type.kind === "referenceType" ||
    type.kind === "tupleType" ||
    type.kind === "dictionaryType"
  ) {
    return true;
  }

  // Reject anonymous object types (no CLR backing)
  if (type.kind === "objectType") {
    return false;
  }

  // Reject unions containing any/unknown
  if (type.kind === "unionType") {
    return type.types.every(canEmitTypeExplicitly);
  }

  return false;
};

export const isStructuralTypeAssertionInitializer = (
  initializer:
    | ({
        readonly kind: string;
        readonly targetType?: IrType;
        readonly inferredType?: IrType;
      } & Record<string, unknown>)
    | undefined,
  context: EmitterContext
): boolean =>
  initializer?.kind === "typeAssertion" &&
  !!initializer.targetType &&
  isTypeOnlyStructuralTarget(initializer.targetType, context);

export const shouldTreatStructuralAssertionAsErased = (
  decl: {
    readonly type?: IrType;
    readonly initializer?: {
      readonly kind: string;
      readonly targetType?: IrType;
      readonly inferredType?: IrType;
    };
  },
  context: EmitterContext
): boolean => {
  const initializer = decl.initializer;
  const targetType = initializer?.targetType;
  if (
    !isStructuralTypeAssertionInitializer(initializer, context) ||
    !targetType
  ) {
    return false;
  }

  if (!decl.type) {
    return true;
  }

  return (
    stableIrTypeKey(stripNullish(decl.type)) ===
    stableIrTypeKey(stripNullish(targetType))
  );
};

/**
 * Check if a type requires explicit local variable declaration.
 * Returns true for types like byte, sbyte, short, ushort that have no C# suffix.
 * Resolves type aliases to get the underlying type.
 */
export const needsExplicitLocalType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  // Resolve aliases (e.g., local type aliases)
  const resolved = resolveTypeAlias(stripNullish(type), context);

  // Check primitive types
  if (resolved.kind === "primitiveType") {
    return TYPES_NEEDING_EXPLICIT_DECL.has(resolved.name);
  }

  // Check reference types - these may be CLR types from @tsonic/core
  // (byte, sbyte, short, ushort are imported as reference types, not primitives)
  if (resolved.kind === "referenceType") {
    return TYPES_NEEDING_EXPLICIT_DECL.has(resolved.name);
  }

  return false;
};

export const isExplicitCastLikeAst = (ast: CSharpExpressionAst): boolean =>
  ast.kind === "castExpression" ||
  ast.kind === "asExpression" ||
  ast.kind === "parenthesizedExpression";

export const shouldForceDeclaredInitializerCast = (
  initializer: IrExpression | undefined,
  declaredType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!initializer || !declaredType) {
    return false;
  }

  if (
    initializer.kind !== "identifier" &&
    initializer.kind !== "memberAccess" &&
    initializer.kind !== "typeAssertion"
  ) {
    return false;
  }

  const rawInitializer = (() => {
    let current: IrExpression = initializer;
    while (current.kind === "typeAssertion") {
      current = current.expression;
    }
    return current;
  })();
  const originalType =
    rawInitializer.kind === "identifier"
      ? (resolveIdentifierValueSurfaceType(rawInitializer, context) ??
        rawInitializer.inferredType)
      : rawInitializer.inferredType;
  const effectiveType =
    initializer.kind === "typeAssertion"
      ? resolveEffectiveExpressionType(initializer.expression, context)
      : resolveEffectiveExpressionType(initializer, context);

  if (!originalType || !effectiveType) {
    return false;
  }

  return (
    stableIrTypeKey(stripNullish(originalType)) !==
      stableIrTypeKey(stripNullish(declaredType)) &&
    stableIrTypeKey(stripNullish(effectiveType)) ===
      stableIrTypeKey(stripNullish(declaredType))
  );
};

/**
 * Helper: check if an initializer is a nullish expression (undefined/null literal or identifier).
 */
export const isNullishInitializer = (init: {
  kind: string;
  value?: unknown;
  name?: string;
}): boolean =>
  (init.kind === "literal" &&
    ((init as { value: unknown }).value === undefined ||
      (init as { value: unknown }).value === null)) ||
  (init.kind === "identifier" &&
    ((init as { name: string }).name === "undefined" ||
      (init as { name: string }).name === "null"));

export const isNullableValueUnion = (type: IrType | undefined): boolean => {
  if (!type || type.kind !== "unionType") return false;

  const hasNullish = type.types.some(
    (member) =>
      member.kind === "primitiveType" &&
      (member.name === "undefined" || member.name === "null")
  );
  if (!hasNullish) return false;

  return isDefinitelyValueType(stripNullish(type));
};

export const shouldEmitReadonlyStaticField = (
  stmt: Extract<IrStatement, { kind: "variableDeclaration" }>,
  decl: {
    readonly name: {
      readonly kind: string;
      readonly name?: string;
    };
  },
  context: EmitterContext
): boolean => {
  if (stmt.declarationKind !== "const") return false;
  if (decl.name.kind !== "identifierPattern") return true;
  return !(
    decl.name.name && context.mutableModuleBindings?.has(decl.name.name)
  );
};

/**
 * Resolve the C# type AST for a static field declaration.
 *
 * Priority:
 * 1) numericNarrowing initializer (e.g., `1000 as int`) - use CLR type
 * 2) typeAssertion initializer (e.g., `obj as Person`) - use target type
 * 3) asinterface initializer (e.g., `asinterface<IQueryable<T>>(db.Events)`) - use target type
 * 4) Explicit/inferred IR type
 * 5) Infer from initializer (new, literal, inferredType)
 * 6) Fallback to object
 *
 * Arrow function types are handled separately in emitStaticArrowFieldMembers.
 */
export const resolveStaticFieldType = (
  decl: {
    readonly type?: IrType;
    readonly initializer?: {
      readonly kind: string;
      readonly targetKind?: NumericKind;
      readonly targetType?: IrType;
      readonly callee?: unknown;
      readonly typeArguments?: readonly IrType[];
      readonly value?: unknown;
      readonly numericIntent?: NumericKind;
      readonly inferredType?: IrType;
    };
  },
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const init = decl.initializer;

  // numericNarrowing
  if (init?.kind === "numericNarrowing" && init.targetKind) {
    const csharpType = NUMERIC_KIND_TO_CSHARP.get(init.targetKind) ?? "double";
    return [identifierType(csharpType), context];
  }

  // typeAssertion
  if (init?.kind === "typeAssertion" && init.targetType) {
    if (isTypeOnlyStructuralTarget(init.targetType, context)) {
      const inferredType = decl.type ?? init.inferredType;
      if (inferredType && canEmitTypeExplicitly(inferredType)) {
        return emitTypeAst(inferredType, context);
      }
      return [{ kind: "varType" }, context];
    }
    return emitTypeAst(init.targetType, context);
  }

  // asinterface
  if (init?.kind === "asinterface" && init.targetType) {
    const targetType = resolveAsInterfaceTargetType(init.targetType, context);
    return emitTypeAst(targetType, context);
  }

  // Explicit type annotation
  if (decl.type) {
    return emitTypeAst(decl.type, context);
  }

  // Infer from new expression
  if (init?.kind === "new") {
    // Type is inferred from the new expression callee + type args.
    // We emit the callee as expression AST and construct a type from it.
    const newExpr = init as {
      callee: Parameters<typeof emitExpressionAst>[0];
      typeArguments?: readonly IrType[];
    };
    const [calleeAst, calleeContext] = emitExpressionAst(
      newExpr.callee,
      context
    );
    let currentContext = calleeContext;
    const calleeText = extractCalleeNameFromAst(calleeAst);

    if (newExpr.typeArguments && newExpr.typeArguments.length > 0) {
      const typeArgs: CSharpTypeAst[] = [];
      for (const typeArg of newExpr.typeArguments) {
        const [typeArgAst, newCtx] = emitTypeAst(typeArg, currentContext);
        typeArgs.push(typeArgAst);
        currentContext = newCtx;
      }
      return [identifierType(calleeText, typeArgs), currentContext];
    }
    return [identifierType(calleeText), currentContext];
  }

  // Infer from literal
  if (init?.kind === "literal") {
    const lit = init as { value: unknown; numericIntent?: NumericKind };
    if (typeof lit.value === "string") {
      return [identifierType("string"), context];
    }
    if (typeof lit.value === "number") {
      const csharpType = lit.numericIntent
        ? (NUMERIC_KIND_TO_CSHARP.get(lit.numericIntent) ?? "double")
        : "double";
      return [identifierType(csharpType), context];
    }
    if (typeof lit.value === "boolean") {
      return [identifierType("bool"), context];
    }
    return [identifierType("object"), context];
  }

  // Infer from initializer's inferred type
  if (init?.kind === "object") {
    const behavioralType = resolveBehavioralObjectLiteralType(
      init as Extract<IrExpression, { kind: "object" }>,
      context
    );
    if (behavioralType) {
      return emitTypeAst(behavioralType, context);
    }
  }

  if (init?.inferredType && canEmitTypeExplicitly(init.inferredType)) {
    return emitTypeAst(init.inferredType, context);
  }

  return [identifierType("object"), context];
};
