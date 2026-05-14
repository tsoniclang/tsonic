import type {
  IrExpression,
  IrGuardPolarity,
  IrIfBranchPlan,
  IrIfGuardShape,
  IrBranchNarrowing,
} from "../../../types.js";
import {
  createIfBranchPlan,
  createOpaqueIfGuardShape,
  invertIfGuardShape,
} from "../../../types.js";
import { selectUnionArm } from "../../union-arm-selection.js";

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
): string | number | boolean | null | undefined | typeof noLiteral => {
  if (expression.kind !== "literal") {
    return noLiteral;
  }
  return expression.value;
};

const noLiteral = Symbol("noLiteral");

const literalStringValue = (expression: IrExpression): string | undefined => {
  const value = literalValue(expression);
  return typeof value === "string" ? value : undefined;
};

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
  if (leftLiteral === null || rightLiteral === null) {
    return {
      kind: "nullableGuard",
      target: leftLiteral === null ? right : left,
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
  thenBindings: readonly IrBranchNarrowing[] = [],
  elseBindings: readonly IrBranchNarrowing[] = []
): {
  readonly thenPlan: IrIfBranchPlan;
  readonly elsePlan: IrIfBranchPlan;
} => {
  const thenShape = classifyIfGuardShape(condition, "truthy");
  return {
    thenPlan: createIfBranchPlan(
      attachArmSelection(thenShape, thenBindings),
      thenBindings
    ),
    elsePlan: createIfBranchPlan(
      attachArmSelection(invertIfGuardShape(thenShape), elseBindings),
      elseBindings
    ),
  };
};
