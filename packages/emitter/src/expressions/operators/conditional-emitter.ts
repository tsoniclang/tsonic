/**
 * Conditional (ternary) expression emitter with type predicate narrowing support
 */

import { IrExpression, IrType, stableIrTypeKey } from "@tsonic/frontend";
import { EmitterContext, LocalTypeInfo, NarrowedBinding } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  resolveTypeAlias,
  getPropertyType,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { isAssignable } from "../../core/semantic/index.js";
import { emitBooleanConditionAst } from "../../core/semantic/boolean-context.js";
import { emitRemappedLocalName } from "../../core/format/local-names.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import {
  buildRuntimeUnionFrame,
  buildRuntimeUnionLayout,
  findRuntimeUnionMemberIndices,
} from "../../core/semantic/runtime-unions.js";
import { applyConditionBranchNarrowing } from "../../core/semantic/condition-branch-narrowing.js";

/**
 * Try to extract ternary guard info from a condition expression.
 * Handles both `isUser(x)` (positive) and `!isUser(x)` (negated).
 * Returns guard info with polarity indicating which branch to narrow.
 */
type TernaryGuardInfo = {
  readonly originalName: string;
  readonly memberN: number;
  readonly escapedOrig: string;
  readonly polarity: "positive" | "negative"; // positive = narrow whenTrue, negative = narrow whenFalse
};

const resolveLocalTypesForReference = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): ReadonlyMap<string, LocalTypeInfo> | undefined => {
  const lookupName = type.name.includes(".")
    ? (type.name.split(".").pop() ?? type.name)
    : type.name;

  if (context.localTypes?.has(lookupName)) {
    return context.localTypes;
  }

  const moduleMap = context.options.moduleMap;
  if (!moduleMap) return undefined;

  const matches: {
    readonly namespace: string;
    readonly localTypes: ReadonlyMap<string, LocalTypeInfo>;
  }[] = [];
  for (const m of moduleMap.values()) {
    if (!m.localTypes) continue;
    if (m.localTypes.has(lookupName)) {
      matches.push({ namespace: m.namespace, localTypes: m.localTypes });
    }
  }

  if (matches.length === 0) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  if (matches.length === 1) return matches[0]!.localTypes;

  const fqn =
    type.resolvedClrType ?? (type.name.includes(".") ? type.name : undefined);
  if (fqn && fqn.includes(".")) {
    const ns = fqn.slice(0, fqn.lastIndexOf("."));
    const filtered = matches.filter((m) => m.namespace === ns);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (filtered.length === 1) return filtered[0]!.localTypes;
  }

  return undefined;
};

const tryGetLiteralSet = (
  type: IrType,
  context: EmitterContext
): ReadonlySet<string | number | boolean> | undefined => {
  const resolved = resolveTypeAlias(type, context);

  if (resolved.kind === "literalType") {
    return new Set([resolved.value]);
  }

  if (resolved.kind === "unionType") {
    const out = new Set<string | number | boolean>();
    for (const t of resolved.types) {
      const r = resolveTypeAlias(t, context);
      if (r.kind !== "literalType") return undefined;
      out.add(r.value);
    }
    return out;
  }

  return undefined;
};

const tryResolveTernaryGuard = (
  condition: IrExpression,
  context: EmitterContext
): TernaryGuardInfo | undefined => {
  // Check for direct call: isUser(x)
  const resolveFromCall = (
    call: Extract<IrExpression, { kind: "call" }>
  ): TernaryGuardInfo | undefined => {
    const narrowing = call.narrowing;
    if (!narrowing || narrowing.kind !== "typePredicate") return undefined;

    const arg = call.arguments[narrowing.argIndex];
    if (
      !arg ||
      ("kind" in arg && arg.kind === "spread") ||
      arg.kind !== "identifier"
    ) {
      return undefined;
    }

    const originalName = arg.name;
    const unionSourceType = arg.inferredType;
    if (!unionSourceType) return undefined;

    const runtimeFrame = buildRuntimeUnionFrame(unionSourceType, context);
    if (!runtimeFrame) return undefined;

    const matchingIndices = findRuntimeUnionMemberIndices(
      runtimeFrame.members,
      narrowing.targetType,
      context
    );
    if (matchingIndices.length !== 1) return undefined;
    const idx = matchingIndices[0];
    if (idx === undefined) return undefined;

    return {
      originalName,
      memberN: idx + 1,
      escapedOrig: emitRemappedLocalName(originalName, context),
      polarity: "positive",
    };
  };

  // Direct call: isUser(x) -> narrow whenTrue
  if (condition.kind === "call") {
    return resolveFromCall(condition);
  }

  // Discriminant literal equality: x.kind === "circle"
  const resolveFromDiscriminantEquality = (
    expr: IrExpression
  ): TernaryGuardInfo | undefined => {
    // Normalize `!(x.prop === lit)` to `x.prop !== lit` (and vice versa) by flipping polarity.
    if (expr.kind === "unary" && expr.operator === "!") {
      const inner = resolveFromDiscriminantEquality(expr.expression);
      if (!inner) return undefined;
      return {
        ...inner,
        polarity: inner.polarity === "positive" ? "negative" : "positive",
      };
    }

    if (expr.kind !== "binary") return undefined;
    if (
      expr.operator !== "===" &&
      expr.operator !== "!==" &&
      expr.operator !== "==" &&
      expr.operator !== "!="
    ) {
      return undefined;
    }

    const extract = (
      left: IrExpression,
      right: IrExpression
    ):
      | {
          readonly receiver: Extract<IrExpression, { kind: "identifier" }>;
          readonly propertyName: string;
          readonly literal: string | number | boolean;
        }
      | undefined => {
      if (left.kind !== "memberAccess") return undefined;
      if (left.isOptional) return undefined;
      if (left.isComputed) return undefined;
      if (left.object.kind !== "identifier") return undefined;
      if (typeof left.property !== "string") return undefined;
      if (right.kind !== "literal") return undefined;
      if (
        typeof right.value !== "string" &&
        typeof right.value !== "number" &&
        typeof right.value !== "boolean"
      ) {
        return undefined;
      }
      return {
        receiver: left.object,
        propertyName: left.property,
        literal: right.value,
      };
    };

    const direct = extract(expr.left, expr.right);
    const swapped = direct ? undefined : extract(expr.right, expr.left);
    const match = direct ?? swapped;
    if (!match) return undefined;

    const { receiver, propertyName, literal } = match;
    const originalName = receiver.name;

    if (context.narrowedBindings?.has(originalName)) return undefined;

    const unionSourceType = receiver.inferredType;
    if (!unionSourceType) return undefined;

    const [runtimeLayout] = buildRuntimeUnionLayout(
      unionSourceType,
      context,
      emitTypeAst
    );
    if (!runtimeLayout) return undefined;

    const unionArity = runtimeLayout.members.length;
    if (unionArity < 2 || unionArity > 8) return undefined;

    const matchingMembers: number[] = [];

    for (let i = 0; i < runtimeLayout.members.length; i++) {
      const member = runtimeLayout.members[i];
      if (!member) continue;

      let propType: IrType | undefined;

      if (member.kind === "objectType") {
        const prop = member.members.find(
          (m): m is Extract<typeof m, { kind: "propertySignature" }> =>
            m.kind === "propertySignature" && m.name === propertyName
        );
        propType = prop?.type;
      } else if (member.kind === "referenceType") {
        const localTypes = resolveLocalTypesForReference(member, context);
        if (!localTypes) continue;

        const lookupName = member.name.includes(".")
          ? (member.name.split(".").pop() ?? member.name)
          : member.name;

        propType = getPropertyType(
          { ...member, name: lookupName },
          propertyName,
          { ...context, localTypes }
        );
      } else {
        continue;
      }

      if (!propType) continue;

      const literals = tryGetLiteralSet(propType, context);
      if (!literals) continue;
      if (literals.has(literal)) {
        matchingMembers.push(i + 1);
      }
    }

    if (matchingMembers.length !== 1) return undefined;
    const memberN = matchingMembers[0];
    if (!memberN) return undefined;

    const isInequality = expr.operator === "!==" || expr.operator === "!=";

    return {
      originalName,
      memberN,
      escapedOrig: emitRemappedLocalName(originalName, context),
      polarity: isInequality ? "negative" : "positive",
    };
  };

  const discr = resolveFromDiscriminantEquality(condition);
  if (discr) return discr;

  // Negated call: !isUser(x) -> narrow whenFalse
  if (
    condition.kind === "unary" &&
    condition.operator === "!" &&
    condition.expression.kind === "call"
  ) {
    const guard = resolveFromCall(condition.expression);
    if (guard) {
      return { ...guard, polarity: "negative" };
    }
  }

  return undefined;
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
  const resolveBranchType = (
    branchExpr: IrExpression,
    branchContext: EmitterContext
  ): IrType | undefined => {
    const candidate =
      resolveEffectiveBranchType(branchExpr, branchContext) ??
      branchExpr.inferredType;
    return candidate
      ? resolveTypeAlias(stripNullish(candidate), branchContext)
      : undefined;
  };

  const deriveBranchExpectedType = (
    whenTrueContext: EmitterContext,
    whenFalseContext: EmitterContext
  ): IrType | undefined => {
    if (expectedType) {
      return expectedType;
    }

    const trueType = resolveBranchType(expr.whenTrue, whenTrueContext);
    const falseType = resolveBranchType(expr.whenFalse, whenFalseContext);

    if (
      trueType &&
      falseType &&
      stableIrTypeKey(trueType) === stableIrTypeKey(falseType)
    ) {
      return trueType;
    }

    if (trueType && falseType) {
      if (isAssignable(trueType, falseType)) {
        return falseType;
      }
      if (isAssignable(falseType, trueType)) {
        return trueType;
      }
    }

    return expr.inferredType;
  };

  // Try to detect type predicate guard in condition
  const guard = tryResolveTernaryGuard(expr.condition, context);

  if (guard) {
    const { originalName, memberN, escapedOrig, polarity } = guard;

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
    narrowedMap.set(originalName, { kind: "expr", exprAst });

    const narrowedContext: EmitterContext = {
      ...context,
      narrowedBindings: narrowedMap,
    };
    const branchExpectedType = deriveBranchExpectedType(
      polarity === "positive" ? narrowedContext : context,
      polarity === "negative" ? narrowedContext : context
    );

    // Apply narrowing to the appropriate branch
    const [trueAst, trueContext] =
      polarity === "positive"
        ? emitExpressionAst(expr.whenTrue, narrowedContext, branchExpectedType)
        : emitExpressionAst(expr.whenTrue, context, branchExpectedType);

    const [falseAst, falseContext] =
      polarity === "negative"
        ? emitExpressionAst(expr.whenFalse, narrowedContext, branchExpectedType)
        : emitExpressionAst(expr.whenFalse, trueContext, branchExpectedType);

    // Return context WITHOUT narrowing (don't leak)
    const finalContext: EmitterContext = {
      ...falseContext,
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
  const [trueAst, trueContext] = emitExpressionAst(
    expr.whenTrue,
    truthyBranchContext,
    branchExpectedType
  );
  const [falseAst, falseContext] = emitExpressionAst(
    expr.whenFalse,
    falsyBranchContext,
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
