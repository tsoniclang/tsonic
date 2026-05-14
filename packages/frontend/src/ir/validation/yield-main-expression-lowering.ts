/**
 * Yield Main Expression Lowering
 *
 * Lowers yield expressions that appear inside larger expression trees
 * (binary, call, member-access, conditional, etc.) into leading
 * IrYieldStatement nodes plus a rewritten expression that references
 * temporary identifiers.
 */

import { IrStatement, IrExpression, IrPattern, IrType } from "../types.js";
import { createIfBranchPlans } from "../converters/statements/control/if-branch-plan.js";

import {
  type LoweringContext,
  type LoweredExpressionWithYields,
  containsYield,
  createYieldStatement,
  allocateYieldTempName,
  emitUnsupportedYieldDiagnostic,
} from "./yield-lowering-helpers.js";

/**
 * Lower yield expressions that appear inside larger expression trees into
 * leading IrYieldStatement nodes plus a rewritten expression that references
 * temp identifiers.
 *
 * This preserves left-to-right evaluation order for supported expression forms.
 * Unsupported forms emit TSN6101 and return undefined.
 */
export const lowerExpressionWithYields = (
  expression: IrExpression,
  ctx: LoweringContext,
  position: string,
  expectedType?: IrType
): LoweredExpressionWithYields | undefined => {
  const lower = (
    expr: IrExpression
  ): LoweredExpressionWithYields | undefined => {
    if (!containsYield(expr)) {
      return { prelude: [], expression: expr };
    }

    switch (expr.kind) {
      case "yield": {
        const tempName = allocateYieldTempName(ctx);
        return {
          prelude: [
            createYieldStatement(
              expr,
              { kind: "identifierPattern", name: tempName },
              expr.inferredType
            ),
          ],
          expression: { kind: "identifier", name: tempName },
        };
      }

      case "unary":
      case "update":
      case "await":
      case "spread":
      case "numericNarrowing":
      case "typeAssertion":
      case "asinterface":
      case "trycast": {
        const lowered = lower(expr.expression);
        if (!lowered) return undefined;
        return {
          prelude: lowered.prelude,
          expression: {
            ...expr,
            expression: lowered.expression,
          },
        };
      }

      case "stackalloc": {
        const loweredSize = lower(expr.size);
        if (!loweredSize) return undefined;
        return {
          prelude: loweredSize.prelude,
          expression: {
            ...expr,
            size: loweredSize.expression,
          },
        };
      }

      case "binary":
      case "logical": {
        const loweredLeft = lower(expr.left);
        if (!loweredLeft) return undefined;
        const loweredRight = lower(expr.right);
        if (!loweredRight) return undefined;
        return {
          prelude: [...loweredLeft.prelude, ...loweredRight.prelude],
          expression: {
            ...expr,
            left: loweredLeft.expression,
            right: loweredRight.expression,
          },
        };
      }

      case "assignment": {
        if (
          expr.left.kind !== "identifierPattern" &&
          expr.left.kind !== "arrayPattern" &&
          expr.left.kind !== "objectPattern" &&
          containsYield(expr.left)
        ) {
          if (expr.left.kind !== "memberAccess") {
            emitUnsupportedYieldDiagnostic(
              ctx,
              `${position} assignment target`
            );
            return undefined;
          }

          const loweredObject = lower(expr.left.object);
          if (!loweredObject) return undefined;

          let loweredProperty: string | IrExpression = expr.left.property;
          let propertyPrelude: readonly IrStatement[] = [];
          if (typeof expr.left.property !== "string") {
            const loweredPropertyExpr = lower(expr.left.property);
            if (!loweredPropertyExpr) return undefined;
            loweredProperty = loweredPropertyExpr.expression;
            propertyPrelude = loweredPropertyExpr.prelude;
          }

          const loweredRight = lower(expr.right);
          if (!loweredRight) return undefined;

          return {
            prelude: [
              ...loweredObject.prelude,
              ...propertyPrelude,
              ...loweredRight.prelude,
            ],
            expression: {
              ...expr,
              left: {
                ...expr.left,
                object: loweredObject.expression,
                property: loweredProperty,
              },
              right: loweredRight.expression,
            },
          };
        }
        const loweredRight = lower(expr.right);
        if (!loweredRight) return undefined;
        return {
          prelude: loweredRight.prelude,
          expression: {
            ...expr,
            right: loweredRight.expression,
          },
        };
      }

      case "memberAccess": {
        const loweredObject = lower(expr.object);
        if (!loweredObject) return undefined;
        let loweredProperty: IrExpression | string = expr.property;
        let propertyPrelude: readonly IrStatement[] = [];
        if (typeof expr.property !== "string") {
          const loweredPropExpr = lower(expr.property);
          if (!loweredPropExpr) return undefined;
          loweredProperty = loweredPropExpr.expression;
          propertyPrelude = loweredPropExpr.prelude;
        }
        return {
          prelude: [...loweredObject.prelude, ...propertyPrelude],
          expression: {
            ...expr,
            object: loweredObject.expression,
            property: loweredProperty,
          },
        };
      }

      case "call":
      case "new": {
        const loweredCallee = lower(expr.callee);
        if (!loweredCallee) return undefined;
        const preludes: IrStatement[] = [...loweredCallee.prelude];
        const loweredArgs: (
          | IrExpression
          | { kind: "spread"; expression: IrExpression }
        )[] = [];
        for (const argument of expr.arguments) {
          if (argument.kind === "spread") {
            const loweredSpreadExpr = lower(argument.expression);
            if (!loweredSpreadExpr) return undefined;
            preludes.push(...loweredSpreadExpr.prelude);
            loweredArgs.push({
              kind: "spread",
              expression: loweredSpreadExpr.expression,
            });
          } else {
            const loweredArg = lower(argument);
            if (!loweredArg) return undefined;
            preludes.push(...loweredArg.prelude);
            loweredArgs.push(loweredArg.expression);
          }
        }
        return {
          prelude: preludes,
          expression: {
            ...expr,
            callee: loweredCallee.expression,
            arguments: loweredArgs,
          },
        };
      }

      case "array": {
        const preludes: IrStatement[] = [];
        const loweredElements: (
          | IrExpression
          | { kind: "spread"; expression: IrExpression }
          | undefined
        )[] = [];
        for (const element of expr.elements) {
          if (!element) {
            loweredElements.push(undefined);
            continue;
          }
          if (element.kind === "spread") {
            const loweredSpreadExpr = lower(element.expression);
            if (!loweredSpreadExpr) return undefined;
            preludes.push(...loweredSpreadExpr.prelude);
            loweredElements.push({
              kind: "spread",
              expression: loweredSpreadExpr.expression,
            });
            continue;
          }
          const loweredElement = lower(element);
          if (!loweredElement) return undefined;
          preludes.push(...loweredElement.prelude);
          loweredElements.push(loweredElement.expression);
        }
        return {
          prelude: preludes,
          expression: {
            ...expr,
            elements: loweredElements,
          },
        };
      }

      case "object": {
        const preludes: IrStatement[] = [];
        const loweredProperties = [];
        for (const property of expr.properties) {
          if (property.kind === "spread") {
            const loweredSpreadExpr = lower(property.expression);
            if (!loweredSpreadExpr) return undefined;
            preludes.push(...loweredSpreadExpr.prelude);
            loweredProperties.push({
              kind: "spread" as const,
              expression: loweredSpreadExpr.expression,
            });
            continue;
          }

          let loweredKey: string | IrExpression = property.key;
          if (typeof property.key !== "string") {
            const loweredKeyExpr = lower(property.key);
            if (!loweredKeyExpr) return undefined;
            preludes.push(...loweredKeyExpr.prelude);
            loweredKey = loweredKeyExpr.expression;
          }

          const loweredValue = lower(property.value);
          if (!loweredValue) return undefined;
          preludes.push(...loweredValue.prelude);
          loweredProperties.push({
            kind: "property" as const,
            key: loweredKey,
            value: loweredValue.expression,
            shorthand: property.shorthand,
          });
        }
        return {
          prelude: preludes,
          expression: {
            ...expr,
            properties: loweredProperties,
          },
        };
      }

      case "templateLiteral": {
        const preludes: IrStatement[] = [];
        const loweredExpressions: IrExpression[] = [];
        for (const templateExpr of expr.expressions) {
          const loweredTemplateExpr = lower(templateExpr);
          if (!loweredTemplateExpr) return undefined;
          preludes.push(...loweredTemplateExpr.prelude);
          loweredExpressions.push(loweredTemplateExpr.expression);
        }
        return {
          prelude: preludes,
          expression: {
            ...expr,
            expressions: loweredExpressions,
          },
        };
      }

      case "conditional": {
        const loweredCondition = lower(expr.condition);
        if (!loweredCondition) return undefined;

        const loweredWhenTrue = lower(expr.whenTrue);
        if (!loweredWhenTrue) return undefined;

        const loweredWhenFalse = lower(expr.whenFalse);
        if (!loweredWhenFalse) return undefined;

        const tempType =
          expr.inferredType ??
          expectedType ??
          loweredWhenTrue.expression.inferredType ??
          loweredWhenFalse.expression.inferredType;

        if (!tempType) {
          emitUnsupportedYieldDiagnostic(
            ctx,
            `${position} conditional expression`,
            expr.sourceSpan
          );
          return undefined;
        }

        const tempName = allocateYieldTempName(ctx);
        const tempPattern: IrPattern = {
          kind: "identifierPattern",
          name: tempName,
        };

        const assignTrueStatement: IrStatement = {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: tempPattern,
            right: loweredWhenTrue.expression,
          },
        };
        const assignFalseStatement: IrStatement = {
          kind: "expressionStatement",
          expression: {
            kind: "assignment",
            operator: "=",
            left: tempPattern,
            right: loweredWhenFalse.expression,
          },
        };

        const branchPlans = createIfBranchPlans(loweredCondition.expression);
        return {
          prelude: [
            ...loweredCondition.prelude,
            {
              kind: "variableDeclaration",
              declarationKind: "let",
              isExported: false,
              declarations: [
                {
                  kind: "variableDeclarator",
                  name: tempPattern,
                  type: tempType,
                  initializer: { kind: "literal", value: undefined },
                },
              ],
            },
            {
              kind: "ifStatement",
              condition: loweredCondition.expression,
              thenStatement: {
                kind: "blockStatement",
                statements: [...loweredWhenTrue.prelude, assignTrueStatement],
              },
              elseStatement: {
                kind: "blockStatement",
                statements: [...loweredWhenFalse.prelude, assignFalseStatement],
              },
              thenPlan: branchPlans.thenPlan,
              elsePlan: branchPlans.elsePlan,
            },
          ],
          expression: { kind: "identifier", name: tempName },
        };
      }

      default:
        emitUnsupportedYieldDiagnostic(ctx, position, expr.sourceSpan);
        return undefined;
    }
  };

  return lower(expression);
};
