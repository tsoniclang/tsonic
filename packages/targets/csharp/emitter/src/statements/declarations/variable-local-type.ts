/**
 * Local variable type AST resolution.
 *
 * Determines the C# type AST for local variable declarations,
 * handling asinterface, explicit annotations, nullish initializers,
 * nullable value unions, function expressions, and stackalloc.
 */

import {
  IrExpression,
  IrParameter,
  IrType,
  IrBlockStatement,
} from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  resolveAsInterfaceTargetType,
  resolveEffectiveVariableInitializerType,
} from "../../core/semantic/variable-type-resolution.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import type { CSharpTypeAst } from "../../core/format/backend-ast/types.js";
import type { NumericKind } from "@tsonic/frontend";
import {
  canEmitTypeExplicitly,
  isNullishInitializer,
  isNullableValueUnion,
  needsExplicitLocalType,
  shouldTreatStructuralAssertionAsErased,
} from "./variable-type-helpers.js";

/**
 * Determine the C# type AST for a local variable declaration.
 *
 * Priority:
 * 1) asinterface initializer - use target type
 * 2) Explicit/inferred IR type (if C#-emittable)
 * 3) Nullish initializer with annotation - use explicit type
 * 4) Nullish initializer without annotation - use inferred or object?
 * 5) Types needing explicit declaration (byte, sbyte, short, ushort)
 * 6) stackalloc - target-typed to produce Span<T>
 * 7) var
 */
export const resolveLocalTypeAst = (
  decl: {
    readonly type?: IrType;
    readonly initializer?: {
      readonly kind: string;
      readonly value?: unknown;
      readonly name?: string;
      readonly targetType?: IrType;
      readonly inferredType?: IrType;
      readonly parameters?: readonly IrParameter[];
      readonly returnType?: IrType;
      readonly body?: IrBlockStatement | IrExpression;
    };
  },
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const numericInit = decl.initializer as
    | ({ readonly targetKind?: NumericKind; readonly inferredType?: IrType } & {
        readonly kind: string;
      })
    | undefined;

  if (
    !decl.type &&
    decl.initializer?.kind === "numericNarrowing" &&
    numericInit?.targetKind
  ) {
    return [{ kind: "varType" }, context];
  }

  if (
    decl.initializer?.kind === "typeAssertion" &&
    (!decl.type || shouldTreatStructuralAssertionAsErased(decl, context))
  ) {
    const assertedTarget = decl.initializer.targetType;
    if (assertedTarget) {
      const resolvedAssertedTarget = resolveTypeAlias(
        stripNullish(assertedTarget),
        context
      );
      if (resolvedAssertedTarget.kind === "arrayType") {
        return emitTypeAst(assertedTarget, context);
      }
      return [{ kind: "varType" }, context];
    }
  }

  // asinterface<T>(x) - preserve target type in LHS
  if (
    !decl.type &&
    decl.initializer?.kind === "asinterface" &&
    decl.initializer.targetType
  ) {
    return emitTypeAst(
      resolveAsInterfaceTargetType(decl.initializer.targetType, context),
      context
    );
  }

  // Explicit TypeScript annotation that is C#-emittable
  if (decl.type && canEmitTypeExplicitly(decl.type)) {
    return emitTypeAst(decl.type, context);
  }

  // Nullish initializer with explicit annotation -> must use explicit type
  if (decl.type && decl.initializer && isNullishInitializer(decl.initializer)) {
    return emitTypeAst(decl.type, context);
  }

  // Nullish initializer without annotation -> use inferred type or object?
  if (
    !decl.type &&
    decl.initializer &&
    isNullishInitializer(decl.initializer)
  ) {
    const fallbackType = resolveEffectiveVariableInitializerType(
      decl.initializer,
      context
    );
    if (fallbackType && canEmitTypeExplicitly(fallbackType)) {
      return emitTypeAst(fallbackType, context);
    }
    return [
      {
        kind: "nullableType",
        underlyingType: { kind: "predefinedType", keyword: "object" },
      },
      context,
    ];
  }

  if (
    !decl.type &&
    decl.initializer &&
    isNullableValueUnion(
      resolveEffectiveVariableInitializerType(decl.initializer, context)
    )
  ) {
    const inferredType = resolveEffectiveVariableInitializerType(
      decl.initializer,
      context
    );
    if (inferredType) {
      return emitTypeAst(inferredType, context);
    }
  }

  if (
    !decl.type &&
    (decl.initializer?.kind === "arrowFunction" ||
      decl.initializer?.kind === "functionExpression")
  ) {
    const functionInitializer = decl.initializer;
    const inferredReturnType =
      functionInitializer.body &&
      functionInitializer.body.kind !== "blockStatement"
        ? functionInitializer.body.inferredType
        : undefined;
    const resolvedReturnType =
      functionInitializer.returnType ?? inferredReturnType;
    const functionType =
      functionInitializer.inferredType?.kind === "functionType"
        ? functionInitializer.inferredType
        : functionInitializer.parameters &&
            functionInitializer.parameters.every((param) => !!param.type) &&
            resolvedReturnType
          ? {
              kind: "functionType" as const,
              parameters: functionInitializer.parameters,
              returnType: resolvedReturnType,
            }
          : undefined;

    if (functionType) {
      return emitTypeAst(functionType, context);
    }
  }

  // Types that need explicit declaration (byte, sbyte, short, ushort)
  if (
    decl.type &&
    decl.initializer?.kind !== "stackalloc" &&
    needsExplicitLocalType(decl.type, context)
  ) {
    return emitTypeAst(decl.type, context);
  }

  // stackalloc - must be target-typed to produce Span<T>
  if (decl.initializer?.kind === "stackalloc") {
    const targetType =
      decl.type ??
      resolveEffectiveVariableInitializerType(decl.initializer, context);
    if (!targetType) {
      throw new Error(
        "ICE: stackalloc initializer missing target type (no decl.type and no inferredType)"
      );
    }
    return emitTypeAst(targetType, context);
  }

  // Default: var
  return [{ kind: "varType" }, context];
};
