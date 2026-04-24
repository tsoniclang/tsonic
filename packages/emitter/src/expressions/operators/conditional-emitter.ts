/**
 * Conditional (ternary) expression emitter with type predicate narrowing support
 */

import { getAwaitedIrType, IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { resolveArrayLiteralContextType } from "../../core/semantic/array-expected-types.js";
import { isAssignable } from "../../core/semantic/index.js";
import { emitBooleanConditionAst } from "../../core/semantic/boolean-context.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import { applyConditionBranchNarrowing } from "../../core/semantic/condition-branch-narrowing.js";
import { tryResolveTernaryGuard } from "../../core/semantic/ternary-guards.js";
import { emitTypeAst } from "../../type-emitter.js";
import { isBroadObjectSlotType } from "../../core/semantic/js-value-types.js";
import { matchesExpectedEmissionType } from "../../core/semantic/expected-type-matching.js";
import { willCarryAsRuntimeUnion } from "../../core/semantic/union-semantics.js";
import { areIrTypesEquivalent } from "../../core/semantic/type-equivalence.js";
import {
  referenceTypeHasClrIdentity,
} from "../../core/semantic/clr-type-identity.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { materializeDirectNarrowingAst } from "../../core/semantic/materialized-narrowing.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";

const NUMERIC_CLR_NAMES = new Set([
  "System.SByte",
  "global::System.SByte",
  "System.Byte",
  "global::System.Byte",
  "System.Int16",
  "global::System.Int16",
  "System.UInt16",
  "global::System.UInt16",
  "System.Int32",
  "global::System.Int32",
  "System.UInt32",
  "global::System.UInt32",
  "System.Int64",
  "global::System.Int64",
  "System.UInt64",
  "global::System.UInt64",
  "System.Single",
  "global::System.Single",
  "System.Double",
  "global::System.Double",
  "System.Decimal",
  "global::System.Decimal",
]);

const isNumericIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" &&
      (resolved.name === "number" || resolved.name === "int")) ||
    (resolved.kind === "referenceType" &&
      referenceTypeHasClrIdentity(resolved, NUMERIC_CLR_NAMES))
  );
};

/**
 * Emit a conditional (ternary) expression as CSharpExpressionAst
 *
 * Supports type predicate narrowing:
 * - `isUser(x) ? x.name : "anon"` → `x.Is1() ? (x.As1()).name : "anon"`
 * - `!isUser(x) ? "anon" : x.name` → `!x.Is1() ? "anon" : (x.As1()).name`
 */
export const emitConditional = (
  expr: Extract<IrExpression, { kind: "conditional" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const materializeRawIdentifierBranch = (
    branchExpr: IrExpression,
    branchAst: CSharpExpressionAst,
    branchContext: EmitterContext,
    branchExpectedType: IrType | undefined
  ): [CSharpExpressionAst, EmitterContext] => {
    const isRawIdentifierCarrierAst = (
      candidate: CSharpExpressionAst,
      identifier: string
    ): boolean => {
      switch (candidate.kind) {
        case "identifierExpression":
          return candidate.identifier === identifier;
        case "parenthesizedExpression":
        case "suppressNullableWarningExpression":
          return isRawIdentifierCarrierAst(candidate.expression, identifier);
        case "castExpression":
        case "asExpression":
          return isRawIdentifierCarrierAst(candidate.expression, identifier);
        default:
          return false;
      }
    };

    if (branchExpr.kind !== "identifier" || !branchExpectedType) {
      return [branchAst, branchContext];
    }

    const emittedIdentifier =
      branchContext.localNameMap?.get(branchExpr.name) ??
      context.localNameMap?.get(branchExpr.name) ??
      escapeCSharpIdentifier(branchExpr.name);
    if (!isRawIdentifierCarrierAst(branchAst, emittedIdentifier)) {
      return [branchAst, branchContext];
    }

    const storageType =
      branchContext.localValueTypes?.get(branchExpr.name) ??
      context.localValueTypes?.get(branchExpr.name);
    if (!storageType) {
      return [branchAst, branchContext];
    }

    const semanticBranchType =
      resolveBranchType(branchExpr, branchContext) ?? branchExpr.inferredType;
    const semanticBranchFitsExpected =
      !!semanticBranchType &&
      !isBroadObjectSlotType(semanticBranchType, branchContext) &&
      !isBroadObjectSlotType(branchExpectedType, branchContext) &&
      !willCarryAsRuntimeUnion(branchExpectedType, branchContext) &&
      (areIrTypesEquivalent(
        semanticBranchType,
        branchExpectedType,
        branchContext
      ) ||
        matchesExpectedEmissionType(
          semanticBranchType,
          branchExpectedType,
          branchContext
        ) ||
        isAssignable(semanticBranchType, branchExpectedType));
    const semanticBranchIsWholeConditionalType =
      !expectedType &&
      isBroadObjectSlotType(branchExpectedType, branchContext) &&
      expr.inferredType &&
      semanticBranchType &&
      !isBroadObjectSlotType(expr.inferredType, branchContext) &&
      areIrTypesEquivalent(
        semanticBranchType,
        expr.inferredType,
        branchContext
      );
    const materializationTargetType =
      semanticBranchFitsExpected || semanticBranchIsWholeConditionalType
        ? semanticBranchType
        : branchExpectedType;

    return materializeDirectNarrowingAst(
      {
        kind: "identifierExpression",
        identifier: emittedIdentifier,
      },
      storageType,
      materializationTargetType,
      branchContext
    );
  };

  const resolveBranchType = (
    branchExpr: IrExpression,
    branchContext: EmitterContext
  ): IrType | undefined => {
    const candidate =
      resolveEffectiveBranchType(branchExpr, branchContext) ??
      resolveSourceBackedBranchType(branchExpr) ??
      branchExpr.inferredType;
    // Preserve authored branch nullishness and alias identity. Ternary branch
    // emission uses this type as storage context; stripping nullish here turns
    // `options !== undefined ? options.level : undefined` into a non-null
    // `double` branch and can force invalid nullable `.Value` chains.
    return candidate;
  };

  const deriveBranchExpectedType = (
    whenTrueContext: EmitterContext,
    whenFalseContext: EmitterContext
  ): IrType | undefined => {
    const trueType = resolveBranchType(expr.whenTrue, whenTrueContext);
    const falseType = resolveBranchType(expr.whenFalse, whenFalseContext);
    const conditionalType = expr.inferredType;
    const emptyArrayBranchType = (() => {
      const isEmptyArrayLiteral = (branchExpr: IrExpression): boolean =>
        branchExpr.kind === "array" && branchExpr.elements.length === 0;

      if (isEmptyArrayLiteral(expr.whenTrue) === isEmptyArrayLiteral(expr.whenFalse)) {
        return undefined;
      }

      return isEmptyArrayLiteral(expr.whenTrue)
        ? resolveArrayLiteralContextType(falseType, whenFalseContext)
        : resolveArrayLiteralContextType(trueType, whenTrueContext);
    })();
    let commonBranchType: IrType | undefined;

    if (
      trueType &&
      falseType &&
      areIrTypesEquivalent(trueType, falseType, context)
    ) {
      commonBranchType = trueType;
    } else if (trueType && falseType) {
      if (isAssignable(trueType, falseType)) {
        commonBranchType = falseType;
      } else if (isAssignable(falseType, trueType)) {
        commonBranchType = trueType;
      }
    }

    const preciseBranchType =
      emptyArrayBranchType ?? commonBranchType ?? conditionalType;
    const contextualBranchType =
      expectedType && !isBroadObjectSlotType(expectedType, context)
        ? expectedType
        : undefined;
    if (contextualBranchType) {
      if (
        preciseBranchType &&
        isNumericIrType(preciseBranchType, context) &&
        isNumericIrType(contextualBranchType, context) &&
        !areIrTypesEquivalent(
          preciseBranchType,
          contextualBranchType,
          context
        ) &&
        (isAssignable(preciseBranchType, contextualBranchType) ||
          matchesExpectedEmissionType(
            preciseBranchType,
            contextualBranchType,
            context
          ))
      ) {
        return preciseBranchType;
      }
      return contextualBranchType;
    }

    if (preciseBranchType) {
      return preciseBranchType;
    }

    return expectedType ?? expr.inferredType;
  };

  // Try to detect type predicate guard in condition
  const guard = tryResolveTernaryGuard(expr.condition, context, emitTypeAst);

  if (guard) {
    const {
      originalName,
      memberN,
      narrowedType,
      sourceType,
      escapedOrig,
      polarity,
    } = guard;

    // Build condition AST: escapedOrig.IsN() or !escapedOrig.IsN()
    const isCallAst: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: {
          kind: "identifierExpression",
          identifier: escapedOrig,
        },
        memberName: `Is${memberN}`,
      },
      arguments: [],
    };
    const condAst: CSharpExpressionAst =
      polarity === "positive"
        ? isCallAst
        : {
            kind: "prefixUnaryExpression",
            operatorToken: "!",
            operand: isCallAst,
          };

    // Create inline narrowing binding: x -> (x.AsN())
    const exprAst: CSharpExpressionAst = {
      kind: "parenthesizedExpression",
      expression: {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: {
            kind: "identifierExpression",
            identifier: escapedOrig,
          },
          memberName: `As${memberN}`,
        },
        arguments: [],
      },
    };
    const narrowedMap = new Map<string, NarrowedBinding>(
      context.narrowedBindings ?? []
    );
    narrowedMap.set(originalName, {
      kind: "expr",
      exprAst,
      type: narrowedType,
      sourceType,
    });

    const narrowedContext: EmitterContext = {
      ...context,
      narrowedBindings: narrowedMap,
    };
    const branchExpectedType = deriveBranchExpectedType(
      polarity === "positive" ? narrowedContext : context,
      polarity === "negative" ? narrowedContext : context
    );

    // Apply guard narrowing to the matching branch, and condition-based
    // complement narrowing to the opposite branch so that the complement
    // type is visible (e.g., first: PathSpec | MiddlewareLike in the
    // false branch becomes first: MiddlewareLike).
    const complementContext = applyConditionBranchNarrowing(
      expr.condition,
      polarity === "positive" ? "falsy" : "truthy",
      context,
      (e, ctx) => emitExpressionAst(e, ctx)
    );

    const [rawTrueAst, rawTrueContext] =
      polarity === "positive"
        ? emitExpressionAst(expr.whenTrue, narrowedContext, branchExpectedType)
        : emitExpressionAst(
            expr.whenTrue,
            complementContext,
            branchExpectedType
          );

    const [trueAst, trueContext] = materializeRawIdentifierBranch(
      expr.whenTrue,
      rawTrueAst,
      rawTrueContext,
      branchExpectedType
    );

    const [rawFalseAst, rawFalseContext] =
      polarity === "negative"
        ? emitExpressionAst(expr.whenFalse, narrowedContext, branchExpectedType)
        : emitExpressionAst(
            expr.whenFalse,
            complementContext,
            branchExpectedType
          );
    const [falseAst, falseContext] = materializeRawIdentifierBranch(
      expr.whenFalse,
      rawFalseAst,
      rawFalseContext,
      branchExpectedType
    );

    // Return context WITHOUT narrowing (don't leak)
    const finalContext: EmitterContext = {
      ...falseContext,
      tempVarId: Math.max(trueContext.tempVarId ?? 0, falseContext.tempVarId ?? 0),
      usings: new Set([
        ...(trueContext.usings ?? []),
        ...(falseContext.usings ?? []),
      ]),
      narrowedBindings: context.narrowedBindings,
    };

    return [
      {
        kind: "conditionalExpression",
        condition: condAst,
        whenTrue: trueAst,
        whenFalse: falseAst,
      },
      finalContext,
    ];
  }

  // Standard ternary emission (no narrowing)
  const [condAst, condContext] = emitBooleanConditionAst(
    expr.condition,
    (e, ctx) => emitExpressionAst(e, ctx),
    context
  );

  const truthyBranchContext = applyConditionBranchNarrowing(
    expr.condition,
    "truthy",
    condContext,
    (e, ctx) => emitExpressionAst(e, ctx)
  );
  const falsyBranchContext = applyConditionBranchNarrowing(
    expr.condition,
    "falsy",
    condContext,
    (e, ctx) => emitExpressionAst(e, ctx)
  );
  const branchExpectedType = deriveBranchExpectedType(
    truthyBranchContext,
    falsyBranchContext
  );

  // Pass expectedType (or inferred type) to both branches for null/undefined → default conversion
  const [rawTrueAst, rawTrueContext] = emitExpressionAst(
    expr.whenTrue,
    truthyBranchContext,
    branchExpectedType
  );
  const [trueAst, trueContext] = materializeRawIdentifierBranch(
    expr.whenTrue,
    rawTrueAst,
    rawTrueContext,
    branchExpectedType
  );
  const [rawFalseAst, rawFalseContext] = emitExpressionAst(
    expr.whenFalse,
    falsyBranchContext,
    branchExpectedType
  );
  const [falseAst, falseContext] = materializeRawIdentifierBranch(
    expr.whenFalse,
    rawFalseAst,
    rawFalseContext,
    branchExpectedType
  );

  const finalContext: EmitterContext = {
    ...falseContext,
    tempVarId: Math.max(
      trueContext.tempVarId ?? 0,
      falseContext.tempVarId ?? 0
    ),
    usings: new Set([
      ...(trueContext.usings ?? []),
      ...(falseContext.usings ?? []),
    ]),
    narrowedBindings: condContext.narrowedBindings,
  };

  return [
    {
      kind: "conditionalExpression",
      condition: condAst,
      whenTrue: trueAst,
      whenFalse: falseAst,
    },
    finalContext,
  ];
};

const resolveEffectiveBranchType = (
  expr: IrExpression,
  context: EmitterContext
): IrType | undefined => {
  if (expr.kind === "identifier") {
    return context.narrowedBindings?.get(expr.name)?.type ?? expr.inferredType;
  }

  if (expr.kind === "memberAccess" && !expr.isComputed) {
    const key =
      typeof expr.property === "string" && expr.object.kind === "identifier"
        ? `${expr.object.name}.${expr.property}`
        : undefined;
    return key
      ? (context.narrowedBindings?.get(key)?.type ?? expr.inferredType)
      : expr.inferredType;
  }

  return expr.inferredType;
};

const resolveSourceBackedBranchType = (
  expr: IrExpression
): IrType | undefined => {
  switch (expr.kind) {
    case "call":
    case "new":
      return expr.sourceBackedReturnType;
    case "await": {
      const sourceType = resolveSourceBackedBranchType(expr.expression);
      return sourceType ? (getAwaitedIrType(sourceType) ?? sourceType) : undefined;
    }
    default:
      return undefined;
  }
};
