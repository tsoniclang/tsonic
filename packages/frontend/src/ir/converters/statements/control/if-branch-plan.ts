import type {
  IrExpression,
  IrGuardPolarity,
  IrIfBranchPlan,
  IrIfGuardShape,
  IrBranchNarrowing,
  IrType,
} from "../../../types.js";
import {
  createIfBranchPlan,
  createOpaqueIfGuardShape,
  invertIfGuardShape,
} from "../../../types.js";
import { selectUnionArm } from "../../union-arm-selection.js";
import { normalizedUnionType } from "../../../types/type-ops.js";
import type { ProgramContext } from "../../../program-context.js";
import { primitiveTypeFactFromName } from "../../../types/numeric-kind.js";
import { collectNarrowingCandidateLeaves } from "../../narrowing-candidates.js";
import {
  narrowTypeByPropertyExistence,
  narrowTypeByPropertyLiteral,
  narrowTypeByPropertyTruthiness,
} from "../../narrowing-property-helpers.js";
import { narrowTypeByAssignableTarget } from "../../reference-type-guards.js";

const isEqualityOperator = (operator: string): boolean =>
  operator === "===" ||
  operator === "==" ||
  operator === "!==" ||
  operator === "!=";

const equalityPolarity = (
  operator: string,
  branchPolarity: IrGuardPolarity
): IrGuardPolarity => {
  const positive = operator === "===" || operator === "==";
  if (branchPolarity === "truthy") {
    return positive ? "truthy" : "falsy";
  }
  return positive ? "falsy" : "truthy";
};

const literalValue = (
  expression: IrExpression
): string | number | bigint | boolean | null | undefined | typeof noLiteral => {
  if (expression.kind !== "literal") {
    return expression.kind === "identifier" && expression.name === "undefined"
      ? undefined
      : noLiteral;
  }
  return expression.value;
};

const noLiteral = Symbol("noLiteral");

const literalStringValue = (expression: IrExpression): string | undefined => {
  const value = literalValue(expression);
  return typeof value === "string" ? value : undefined;
};

const isNullishLiteralValue = (
  value: string | number | bigint | boolean | null | undefined | typeof noLiteral
): value is null | undefined => value === null || value === undefined;

const propertyName = (expression: IrExpression | string): string | undefined =>
  typeof expression === "string"
    ? expression
    : expression.kind === "literal" && typeof expression.value === "string"
      ? expression.value
      : expression.kind === "identifier"
        ? expression.name
        : undefined;

const classifyBinaryGuard = (
  expression: Extract<IrExpression, { kind: "binary" }>,
  branchPolarity: IrGuardPolarity
): IrIfGuardShape | undefined => {
  if (expression.operator === "instanceof") {
    return {
      kind: "instanceofGuard",
      target: expression.left,
      typeExpression: expression.right,
      polarity: branchPolarity,
    };
  }

  if (expression.operator === "in") {
    const property = literalStringValue(expression.left);
    return property
      ? {
          kind: "propertyExistence",
          target: expression.right,
          property,
          polarity: branchPolarity,
        }
      : undefined;
  }

  if (!isEqualityOperator(expression.operator)) {
    return undefined;
  }

  const polarity = equalityPolarity(expression.operator, branchPolarity);
  const left = expression.left;
  const right = expression.right;

  const typeofLeft =
    left.kind === "unary" && left.operator === "typeof" ? left : undefined;
  const typeofRight =
    right.kind === "unary" && right.operator === "typeof" ? right : undefined;
  const tagFromRight = literalStringValue(right);
  const tagFromLeft = literalStringValue(left);
  if (typeofLeft && tagFromRight) {
    return {
      kind: "typeofGuard",
      target: typeofLeft.expression,
      tag: tagFromRight,
      polarity,
    };
  }
  if (typeofRight && tagFromLeft) {
    return {
      kind: "typeofGuard",
      target: typeofRight.expression,
      tag: tagFromLeft,
      polarity,
    };
  }

  const leftLiteral = literalValue(left);
  const rightLiteral = literalValue(right);
  const nullishGuard =
    isNullishLiteralValue(leftLiteral)
      ? { target: right, value: leftLiteral }
      : isNullishLiteralValue(rightLiteral)
        ? { target: left, value: rightLiteral }
        : undefined;
  if (nullishGuard) {
    return {
      kind: "nullableGuard",
      target: nullishGuard.target,
      value: nullishGuard.value,
      loose: expression.operator === "==" || expression.operator === "!=",
      polarity,
    };
  }

  const member =
    left.kind === "memberAccess" && rightLiteral !== noLiteral
      ? { access: left, value: rightLiteral }
      : right.kind === "memberAccess" && leftLiteral !== noLiteral
        ? { access: right, value: leftLiteral }
        : undefined;
  const property = member ? propertyName(member.access.property) : undefined;
  if (member && property) {
    return {
      kind: "discriminantEquality",
      target: member.access.object,
      property,
      value: member.value,
      polarity,
    };
  }

  return undefined;
};

const classifyCallGuard = (
  expression: Extract<IrExpression, { kind: "call" }>,
  branchPolarity: IrGuardPolarity
): IrIfGuardShape | undefined => {
  const callee = expression.callee;
  if (
    callee.kind === "memberAccess" &&
    !callee.isComputed &&
    callee.object.kind === "identifier" &&
    callee.object.name === "Array" &&
    propertyName(callee.property) === "isArray" &&
    expression.arguments.length === 1
  ) {
    const [target] = expression.arguments;
    if (target && target.kind !== "spread") {
      return {
        kind: "arrayIsArrayGuard",
        target,
        polarity: branchPolarity,
      };
    }
  }

  return undefined;
};

export const classifyIfGuardShape = (
  expression: IrExpression,
  branchPolarity: IrGuardPolarity
): IrIfGuardShape => {
  const unwrapped = unwrapNarrowingTargetExpression(expression);
  if (unwrapped !== expression) {
    return classifyIfGuardShape(unwrapped, branchPolarity);
  }

  switch (expression.kind) {
    case "binary":
      return (
        classifyBinaryGuard(expression, branchPolarity) ??
        createOpaqueIfGuardShape(branchPolarity)
      );
    case "call":
      return (
        classifyCallGuard(expression, branchPolarity) ??
        createOpaqueIfGuardShape(branchPolarity)
      );
    case "logical":
      return expression.operator === "&&" || expression.operator === "||"
        ? {
            kind: "compound",
            operator: expression.operator,
            left: classifyIfGuardShape(expression.left, branchPolarity),
            right: classifyIfGuardShape(expression.right, branchPolarity),
            polarity: branchPolarity,
          }
        : createOpaqueIfGuardShape(branchPolarity);
    case "memberAccess": {
      const property = propertyName(expression.property);
      return property
        ? {
            kind: "propertyTruthiness",
            target: expression.object,
            property,
            polarity: branchPolarity,
          }
        : createOpaqueIfGuardShape(branchPolarity);
    }
    case "unary":
      return expression.operator === "!"
        ? classifyIfGuardShape(
            expression.expression,
            branchPolarity === "truthy" ? "falsy" : "truthy"
          )
        : createOpaqueIfGuardShape(branchPolarity);
    default:
      return createOpaqueIfGuardShape(branchPolarity);
  }
};

const expressionBindingKey = (expression: IrExpression): string | undefined => {
  const unwrapped = unwrapNarrowingTargetExpression(expression);
  if (unwrapped !== expression) {
    return expressionBindingKey(unwrapped);
  }

  if (expression.kind === "identifier") {
    return expression.name;
  }

  if (
    expression.kind === "memberAccess" &&
    !expression.isComputed &&
    !expression.isOptional &&
    typeof expression.property === "string"
  ) {
    const objectKey = expressionBindingKey(expression.object);
    return objectKey ? `${objectKey}.${expression.property}` : undefined;
  }

  return undefined;
};

const unwrapNarrowingTargetExpression = (
  expression: IrExpression
): IrExpression => {
  let current = expression;
  while (
    current.kind === "typeAssertion" ||
    current.kind === "numericNarrowing" ||
    current.kind === "asinterface" ||
    current.kind === "trycast"
  ) {
    current = current.expression;
  }
  return current;
};

const isBranchNarrowingTarget = (
  expression: IrExpression
): expression is Extract<IrExpression, { kind: "identifier" | "memberAccess" }> =>
  expression.kind === "identifier" || expression.kind === "memberAccess";

const createBranchNarrowing = (
  target: IrExpression,
  targetType: IrExpression["inferredType"] | undefined,
  bindingKey: string | undefined
): IrBranchNarrowing | undefined => {
  const unwrappedTarget = unwrapNarrowingTargetExpression(target);
  return bindingKey && targetType && isBranchNarrowingTarget(unwrappedTarget)
    ? {
        bindingKey,
        targetExpr: unwrappedTarget,
        targetType,
      }
    : undefined;
};

const typeIdentityNames = (type: IrType): readonly string[] => {
  if (type.kind === "primitiveType") {
    return [type.name];
  }

  if (type.kind !== "referenceType") {
    return [];
  }

  return [
    type.name,
    type.providerQualifiedName,
    type.typeId?.sourceName,
    type.typeId?.providerName,
  ].filter((name): name is string => typeof name === "string");
};

const typeHasSourcePrimitiveFact = (
  type: IrType,
  predicate: (fact: ReturnType<typeof primitiveTypeFactFromName>) => boolean
): boolean => typeIdentityNames(type).some((name) => predicate(primitiveTypeFactFromName(name)));

const candidateRuntimeTypeofTag = (
  candidate: IrType
): "string" | "number" | "boolean" | "bigint" | "undefined" | "function" | "object" | undefined => {
  if (candidate.kind === "literalType") {
    switch (typeof candidate.value) {
      case "string":
        return "string";
      case "number":
        return "number";
      case "boolean":
        return "boolean";
    }
  }

  if (candidate.kind === "primitiveType") {
    switch (candidate.name) {
      case "string":
      case "char":
        return "string";
      case "number":
      case "int":
        return "number";
      case "boolean":
        return "boolean";
      case "bigint":
        return "bigint";
      case "undefined":
        return "undefined";
      case "null":
        return "object";
    }
  }

  if (
    candidate.kind === "functionType"
  ) {
    return "function";
  }

  if (
    typeHasSourcePrimitiveFact(
      candidate,
      (fact) => fact?.kind === "numeric"
    )
  ) {
    return "number";
  }

  if (
    typeHasSourcePrimitiveFact(
      candidate,
      (fact) => fact?.kind === "boolean"
    )
  ) {
    return "boolean";
  }

  switch (candidate.kind) {
    case "arrayType":
    case "tupleType":
    case "objectType":
    case "dictionaryType":
    case "referenceType":
      return "object";
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
    case "unionType":
    case "intersectionType":
    case "typeParameterType":
      return undefined;
  }
};

const filterTypeCandidates = (
  sourceType: IrType | undefined,
  ctx: ProgramContext,
  predicate: (candidate: IrType) => boolean
): IrType | undefined => {
  if (!sourceType || sourceType.kind === "unknownType" || sourceType.kind === "anyType") {
    return undefined;
  }

  const candidates = collectNarrowingCandidateLeaves(ctx.typeSystem, sourceType);
  const kept = candidates.filter(
    (candidate): candidate is IrType => !!candidate && predicate(candidate)
  );

  if (kept.length === 0) {
    return undefined;
  }

  if (kept.length === 1) {
    return kept[0];
  }

  return normalizedUnionType(kept);
};

const narrowTypeByTypeofTag = (
  sourceType: IrType | undefined,
  tag: string,
  wantMatch: boolean,
  ctx: ProgramContext
): IrType | undefined =>
  filterTypeCandidates(
    sourceType,
    ctx,
    (candidate) => (candidateRuntimeTypeofTag(candidate) === tag) === wantMatch
  );

const candidateMatchesNullishGuard = (
  candidate: IrType,
  value: null | undefined,
  loose: boolean
): boolean => {
  if (candidate.kind === "primitiveType") {
    if (loose) {
      return candidate.name === "null" || candidate.name === "undefined";
    }
    return value === null
      ? candidate.name === "null"
      : candidate.name === "undefined";
  }

  if (candidate.kind === "literalType") {
    return value === null && candidate.value === null;
  }

  return false;
};

const narrowTypeByNullishGuard = (
  sourceType: IrType | undefined,
  value: null | undefined,
  loose: boolean,
  wantMatch: boolean,
  ctx: ProgramContext
): IrType | undefined =>
  filterTypeCandidates(
    sourceType,
    ctx,
    (candidate) =>
      candidateMatchesNullishGuard(candidate, value, loose) === wantMatch
  );

const collectCallPredicateNarrowings = (
  expression: IrExpression,
  ctx: ProgramContext,
  polarity: IrGuardPolarity
): readonly IrBranchNarrowing[] => {
  if (expression.kind === "unary" && expression.operator === "!") {
    return collectCallPredicateNarrowings(
      expression.expression,
      ctx,
      polarity === "truthy" ? "falsy" : "truthy"
    );
  }

  if (expression.kind === "logical") {
    if (
      (expression.operator === "&&" && polarity === "truthy") ||
      (expression.operator === "||" && polarity === "falsy")
    ) {
      return [
        ...collectCallPredicateNarrowings(expression.left, ctx, polarity),
        ...collectCallPredicateNarrowings(expression.right, ctx, polarity),
      ];
    }
    if (expression.operator === "||" && polarity === "truthy") {
      return unionSameBindingPredicateNarrowings(
        collectCallPredicateNarrowings(expression.left, ctx, "truthy"),
        collectCallPredicateNarrowings(expression.right, ctx, "truthy")
      );
    }
    return [];
  }

  if (expression.kind !== "call" || !expression.narrowing) {
    return [];
  }

  const target = expression.arguments[expression.narrowing.argIndex];
  if (!target || target.kind === "spread") {
    return [];
  }

  const targetType =
    narrowTypeByAssignableTarget(
      ctx.typeSystem,
      target.inferredType,
      expression.narrowing.targetType,
      polarity === "truthy"
    ) ??
    (polarity === "truthy" ? expression.narrowing.targetType : undefined);

  const narrowing = createBranchNarrowing(
    target,
    targetType,
    expressionBindingKey(target)
  );
  return narrowing ? [narrowing] : [];
};

const effectiveNarrowingByBinding = (
  narrowings: readonly IrBranchNarrowing[]
): ReadonlyMap<string, IrBranchNarrowing> => {
  const result = new Map<string, IrBranchNarrowing>();
  for (const narrowing of narrowings) {
    result.set(narrowing.bindingKey, narrowing);
  }
  return result;
};

const unionSameBindingPredicateNarrowings = (
  left: readonly IrBranchNarrowing[],
  right: readonly IrBranchNarrowing[]
): readonly IrBranchNarrowing[] => {
  const leftByBinding = effectiveNarrowingByBinding(left);
  const rightByBinding = effectiveNarrowingByBinding(right);
  const result: IrBranchNarrowing[] = [];

  for (const [bindingKey, leftNarrowing] of leftByBinding) {
    const rightNarrowing = rightByBinding.get(bindingKey);
    if (!rightNarrowing) {
      continue;
    }

    result.push({
      bindingKey,
      targetExpr: leftNarrowing.targetExpr,
      targetType: normalizedUnionType([
        leftNarrowing.targetType,
        rightNarrowing.targetType,
      ]),
    });
  }

  return result;
};

const collectNarrowedBindings = (
  shape: IrIfGuardShape,
  ctx: ProgramContext | undefined
): readonly IrBranchNarrowing[] => {
  if (!ctx) {
    return [];
  }

  switch (shape.kind) {
    case "propertyTruthiness": {
      const bindingKey = expressionBindingKey(shape.target);
      const targetType = shape.target.inferredType
        ? narrowTypeByPropertyTruthiness(
            shape.target.inferredType,
            shape.property,
            shape.polarity === "truthy",
            ctx
          )
        : undefined;
      const narrowing = createBranchNarrowing(
        shape.target,
        targetType,
        bindingKey
      );
      return narrowing ? [narrowing] : [];
    }
    case "discriminantEquality": {
      const bindingKey = expressionBindingKey(shape.target);
      const targetType = shape.target.inferredType
        ? narrowTypeByPropertyLiteral(
            shape.target.inferredType,
            shape.property,
            shape.value,
            shape.polarity === "truthy",
            ctx
          )
        : undefined;
      const narrowing = createBranchNarrowing(
        shape.target,
        targetType,
        bindingKey
      );
      return narrowing ? [narrowing] : [];
    }
    case "propertyExistence": {
      const bindingKey = expressionBindingKey(shape.target);
      const targetType = shape.target.inferredType
        ? narrowTypeByPropertyExistence(
            shape.target.inferredType,
            shape.property,
            shape.polarity === "truthy",
            ctx
          )
        : undefined;
      const narrowing = createBranchNarrowing(
        shape.target,
        targetType,
        bindingKey
      );
      return narrowing ? [narrowing] : [];
    }
    case "typeofGuard": {
      const bindingKey = expressionBindingKey(shape.target);
      const targetType = narrowTypeByTypeofTag(
        shape.target.inferredType,
        shape.tag,
        shape.polarity === "truthy",
        ctx
      );
      const narrowing = createBranchNarrowing(
        shape.target,
        targetType,
        bindingKey
      );
      return narrowing ? [narrowing] : [];
    }
    case "arrayIsArrayGuard": {
      const bindingKey = expressionBindingKey(shape.target);
      const targetType = filterTypeCandidates(
        shape.target.inferredType,
        ctx,
        (candidate) => {
          const matches =
            candidate.kind === "arrayType" || candidate.kind === "tupleType";
          return matches === (shape.polarity === "truthy");
        }
      );
      const narrowing = createBranchNarrowing(
        shape.target,
        targetType,
        bindingKey
      );
      return narrowing ? [narrowing] : [];
    }
    case "instanceofGuard": {
      const bindingKey = expressionBindingKey(shape.target);
      const targetType = shape.typeExpression.inferredType
        ? narrowTypeByAssignableTarget(
            ctx.typeSystem,
            shape.target.inferredType,
            shape.typeExpression.inferredType,
            shape.polarity === "truthy"
          )
        : undefined;
      const narrowing = createBranchNarrowing(
        shape.target,
        targetType,
        bindingKey
      );
      return narrowing ? [narrowing] : [];
    }
    case "nullableGuard": {
      const bindingKey = expressionBindingKey(shape.target);
      const targetType = narrowTypeByNullishGuard(
        shape.target.inferredType,
        shape.value,
        shape.loose,
        shape.polarity === "truthy",
        ctx
      );
      const narrowing = createBranchNarrowing(
        shape.target,
        targetType,
        bindingKey
      );
      return narrowing ? [narrowing] : [];
    }
    case "compound":
      return [
        ...collectNarrowedBindings(shape.left, ctx),
        ...collectNarrowedBindings(shape.right, ctx),
      ];
    case "opaqueBoolean":
      return [];
  }
};

const attachArmSelection = (
  shape: IrIfGuardShape,
  narrowings: readonly IrBranchNarrowing[]
): IrIfGuardShape => {
  switch (shape.kind) {
    case "typeofGuard":
    case "instanceofGuard":
    case "arrayIsArrayGuard":
    case "discriminantEquality":
    case "propertyExistence":
    case "propertyTruthiness": {
      const bindingKey = expressionBindingKey(shape.target);
      const narrowing = bindingKey
        ? narrowings.find((entry) => entry.bindingKey === bindingKey)
        : undefined;
      const armSelection = selectUnionArm({
        kind: "semanticProjection",
        sourceType: narrowing?.targetType,
        targetUnion: shape.target.inferredType,
      });
      return armSelection.kind === "unsupported"
        ? shape
        : { ...shape, armSelection };
    }
    case "compound":
      return {
        ...shape,
        left: attachArmSelection(shape.left, narrowings),
        right: attachArmSelection(shape.right, narrowings),
      };
    case "nullableGuard":
    case "opaqueBoolean":
      return shape;
  }
};

export const createIfBranchPlans = (
  condition: IrExpression,
  ctx?: ProgramContext,
  explicitThenBindings: readonly IrBranchNarrowing[] = [],
  explicitElseBindings: readonly IrBranchNarrowing[] = []
): {
  readonly thenPlan: IrIfBranchPlan;
  readonly elsePlan: IrIfBranchPlan;
} => {
  const thenShape = classifyIfGuardShape(condition, "truthy");
  const elseShape = invertIfGuardShape(thenShape);
  const thenBindings = [
    ...collectNarrowedBindings(thenShape, ctx),
    ...(ctx ? collectCallPredicateNarrowings(condition, ctx, "truthy") : []),
    ...explicitThenBindings,
  ];
  const elseBindings = [
    ...collectNarrowedBindings(elseShape, ctx),
    ...(ctx ? collectCallPredicateNarrowings(condition, ctx, "falsy") : []),
    ...explicitElseBindings,
  ];
  return {
    thenPlan: createIfBranchPlan(
      attachArmSelection(thenShape, thenBindings),
      thenBindings
    ),
    elsePlan: createIfBranchPlan(
      attachArmSelection(elseShape, elseBindings),
      elseBindings
    ),
  };
};
