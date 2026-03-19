/**
 * Yield Member Access Assignment Lowering
 *
 * Lowers yield expressions within member access assignments into leading
 * IrYieldStatement nodes plus rewritten assignments referencing temporaries.
 */

import { IrStatement, IrExpression } from "../types.js";

import {
  type LoweringContext,
  containsYield,
  createYieldStatement,
  allocateYieldTempName,
  createTempVariableDeclaration,
} from "./yield-lowering-helpers.js";

import { lowerExpressionWithYields } from "./yield-main-expression-lowering.js";

export const lowerMemberAccessAssignmentWithYields = (
  assignment: Extract<IrExpression, { kind: "assignment" }>,
  ctx: LoweringContext,
  positionLabels: {
    readonly object: string;
    readonly property: string;
    readonly right: string;
  }
):
  | {
      readonly leadingStatements: readonly IrStatement[];
      readonly loweredAssignment: Extract<IrExpression, { kind: "assignment" }>;
    }
  | undefined => {
  if (assignment.left.kind !== "memberAccess") {
    return undefined;
  }

  const loweredObject = lowerExpressionWithYields(
    assignment.left.object,
    ctx,
    positionLabels.object,
    assignment.left.object.inferredType
  );
  if (!loweredObject) {
    return undefined;
  }

  const leadingStatements: IrStatement[] = [...loweredObject.prelude];
  const objectTempName = allocateYieldTempName(ctx);
  leadingStatements.push(
    createTempVariableDeclaration(
      objectTempName,
      loweredObject.expression,
      loweredObject.expression.inferredType
    )
  );

  let loweredProperty: IrExpression | string = assignment.left.property;
  if (typeof assignment.left.property !== "string") {
    const loweredPropertyExpr = lowerExpressionWithYields(
      assignment.left.property,
      ctx,
      positionLabels.property,
      assignment.left.property.inferredType
    );
    if (!loweredPropertyExpr) {
      return undefined;
    }

    leadingStatements.push(...loweredPropertyExpr.prelude);
    const propertyTempName = allocateYieldTempName(ctx);
    leadingStatements.push(
      createTempVariableDeclaration(
        propertyTempName,
        loweredPropertyExpr.expression,
        loweredPropertyExpr.expression.inferredType
      )
    );
    loweredProperty = { kind: "identifier", name: propertyTempName };
  }

  let loweredRight: IrExpression = assignment.right;
  if (assignment.right.kind === "yield" && !assignment.right.delegate) {
    const receiveTempName = allocateYieldTempName(ctx);
    leadingStatements.push(
      createYieldStatement(
        assignment.right,
        { kind: "identifierPattern", name: receiveTempName },
        assignment.right.inferredType
      )
    );
    loweredRight = { kind: "identifier", name: receiveTempName };
  } else if (containsYield(assignment.right)) {
    const loweredRightExpr = lowerExpressionWithYields(
      assignment.right,
      ctx,
      positionLabels.right,
      assignment.right.inferredType
    );
    if (!loweredRightExpr) {
      return undefined;
    }
    leadingStatements.push(...loweredRightExpr.prelude);
    loweredRight = loweredRightExpr.expression;
  }

  return {
    leadingStatements,
    loweredAssignment: {
      ...assignment,
      left: {
        ...assignment.left,
        object: { kind: "identifier", name: objectTempName },
        property: loweredProperty,
      },
      right: loweredRight,
    },
  };
};
