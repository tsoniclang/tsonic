/**
 * Anonymous type lowering for expressions.
 *
 * Circular import with anon-type-lower-statements.ts is intentional and safe:
 * both modules export const functions only used after module initialization.
 */
import type { IrExpression, IrReferenceType, IrType } from "../types.js";
import { getOrCreateBehavioralObjectTypeName } from "./anon-type-declaration-synthesis.js";
import type { LoweringContext } from "./anon-type-lower-types.js";
import {
  lowerParameter,
  lowerPattern,
  lowerType,
} from "./anon-type-lower-types.js";
import {
  lowerBlockStatement,
  lowerClassMember,
} from "./anon-type-lower-statements.js";

export const lowerExpression = (
  expr: IrExpression,
  ctx: LoweringContext
): IrExpression => {
  const lowered: IrExpression = (() => {
    switch (expr.kind) {
      case "literal":
      case "this":
      case "nameof":
        return expr;

      case "identifier": {
        if (!expr.declId || !expr.inferredType) return expr;
        if (
          expr.resolvedClrType ||
          expr.resolvedAssembly ||
          expr.importedFrom
        ) {
          return expr;
        }
        if (
          expr.inferredType.kind === "objectType" &&
          expr.inferredType.members.length === 0
        ) {
          return expr;
        }
        const loweredInferred = lowerType(expr.inferredType, ctx);
        return loweredInferred === expr.inferredType
          ? expr
          : { ...expr, inferredType: loweredInferred };
      }

      case "array":
        return {
          ...expr,
          inferredType: expr.inferredType
            ? lowerType(expr.inferredType, ctx)
            : undefined,
          elements: expr.elements.map((element) =>
            element ? lowerExpression(element, ctx) : undefined
          ),
        };

      case "object": {
        const rawContextualType = expr.contextualType;
        const rawInferredType = expr.inferredType;
        const objectTypeForBehavior = (() => {
          if (
            rawContextualType?.kind === "objectType" &&
            rawContextualType.members.length > 0
          ) {
            return rawContextualType;
          }
          if (
            rawInferredType?.kind === "objectType" &&
            rawInferredType.members.length > 0
          ) {
            return rawInferredType;
          }
          return undefined;
        })();

        const loweredBehaviorMembers = expr.behaviorMembers?.map((member) =>
          lowerClassMember(member, ctx)
        );
        const behaviorTypeName =
          objectTypeForBehavior &&
          loweredBehaviorMembers &&
          loweredBehaviorMembers.length > 0
            ? getOrCreateBehavioralObjectTypeName(
                objectTypeForBehavior,
                loweredBehaviorMembers,
                expr.sourceSpan,
                ctx
              )
            : undefined;
        const loweredBehaviorType =
          behaviorTypeName !== undefined
            ? ({
                kind: "referenceType",
                name: behaviorTypeName,
              } satisfies IrReferenceType)
            : undefined;

        return {
          ...expr,
          behaviorMembers:
            loweredBehaviorMembers && loweredBehaviorMembers.length > 0
              ? loweredBehaviorMembers
              : undefined,
          inferredType: loweredBehaviorType
            ? loweredBehaviorType
            : expr.inferredType
              ? lowerType(expr.inferredType, ctx)
              : undefined,
          contextualType: loweredBehaviorType
            ? loweredBehaviorType
            : expr.contextualType
              ? lowerType(expr.contextualType, ctx)
              : undefined,
          properties: expr.properties.map((property) => {
            if (property.kind === "property") {
              return {
                ...property,
                key:
                  typeof property.key === "string"
                    ? property.key
                    : lowerExpression(property.key, ctx),
                value: lowerExpression(property.value, ctx),
              };
            }
            return {
              ...property,
              expression: lowerExpression(property.expression, ctx),
            };
          }),
        };
      }

      case "functionExpression": {
        const loweredParams = expr.parameters.map((parameter) =>
          lowerParameter(parameter, ctx)
        );
        const loweredReturnType = expr.returnType
          ? lowerType(expr.returnType, ctx)
          : undefined;
        const bodyCtx: LoweringContext = {
          ...ctx,
          currentFunctionReturnType: loweredReturnType,
        };
        const loweredInferredType =
          expr.inferredType?.kind === "functionType"
            ? {
                ...expr.inferredType,
                parameters: loweredParams,
                returnType:
                  loweredReturnType ??
                  lowerType(expr.inferredType.returnType, ctx),
              }
            : expr.inferredType;
        return {
          ...expr,
          parameters: loweredParams,
          returnType: loweredReturnType,
          body: lowerBlockStatement(expr.body, bodyCtx),
          inferredType: loweredInferredType,
        };
      }

      case "arrowFunction": {
        const loweredParams = expr.parameters.map((parameter) =>
          lowerParameter(parameter, ctx)
        );
        const loweredReturnType = expr.returnType
          ? lowerType(expr.returnType, ctx)
          : undefined;
        const bodyCtx: LoweringContext = {
          ...ctx,
          currentFunctionReturnType: loweredReturnType,
        };
        const loweredInferredType =
          expr.inferredType?.kind === "functionType"
            ? {
                ...expr.inferredType,
                parameters: loweredParams,
                returnType:
                  loweredReturnType ??
                  lowerType(expr.inferredType.returnType, ctx),
              }
            : expr.inferredType;
        if (expr.body.kind === "blockStatement") {
          return {
            ...expr,
            parameters: loweredParams,
            returnType: loweredReturnType,
            body: lowerBlockStatement(expr.body, bodyCtx),
            inferredType: loweredInferredType,
          };
        }
        const loweredBody = lowerExpression(expr.body, ctx);
        const bodyWithType =
          loweredReturnType && loweredBody.inferredType?.kind === "objectType"
            ? { ...loweredBody, inferredType: loweredReturnType }
            : loweredBody;
        return {
          ...expr,
          parameters: loweredParams,
          returnType: loweredReturnType,
          body: bodyWithType,
          inferredType: loweredInferredType,
        };
      }

      case "memberAccess":
        return {
          ...expr,
          object: lowerExpression(expr.object, ctx),
          property:
            typeof expr.property === "string"
              ? expr.property
              : lowerExpression(expr.property, ctx),
        };

      case "call":
        return {
          ...expr,
          callee: lowerExpression(expr.callee, ctx),
          arguments: expr.arguments.map((argument) =>
            lowerExpression(argument, ctx)
          ),
          dynamicImportNamespace: expr.dynamicImportNamespace
            ? (lowerExpression(expr.dynamicImportNamespace, ctx) as Extract<
                typeof expr.dynamicImportNamespace,
                { kind: "object" }
              >)
            : undefined,
          typeArguments: expr.typeArguments?.map((typeArgument) =>
            lowerType(typeArgument, ctx)
          ),
          resolutionExpectedReturnType: expr.resolutionExpectedReturnType
            ? lowerType(expr.resolutionExpectedReturnType, ctx)
            : undefined,
          parameterTypes: expr.parameterTypes?.map((parameterType) =>
            parameterType ? lowerType(parameterType, ctx) : undefined
          ),
          sourceBackedParameterTypes: expr.sourceBackedParameterTypes?.map(
            (parameterType) =>
              parameterType ? lowerType(parameterType, ctx) : undefined
          ),
          surfaceParameterTypes: expr.surfaceParameterTypes,
          sourceBackedSurfaceParameterTypes:
            expr.sourceBackedSurfaceParameterTypes?.map((parameterType) =>
              parameterType ? lowerType(parameterType, ctx) : undefined
            ),
          sourceBackedRestParameter: expr.sourceBackedRestParameter
            ? {
                ...expr.sourceBackedRestParameter,
                arrayType: expr.sourceBackedRestParameter.arrayType
                  ? lowerType(expr.sourceBackedRestParameter.arrayType, ctx)
                  : undefined,
                elementType: expr.sourceBackedRestParameter.elementType
                  ? lowerType(expr.sourceBackedRestParameter.elementType, ctx)
                  : undefined,
              }
            : undefined,
          sourceBackedReturnType: expr.sourceBackedReturnType
            ? lowerType(expr.sourceBackedReturnType, ctx)
            : undefined,
          surfaceRestParameter: expr.surfaceRestParameter,
          narrowing: expr.narrowing
            ? {
                ...expr.narrowing,
                targetType: lowerType(expr.narrowing.targetType, ctx),
              }
            : undefined,
        };

      case "new":
        return {
          ...expr,
          callee: lowerExpression(expr.callee, ctx),
          arguments: expr.arguments.map((argument) =>
            lowerExpression(argument, ctx)
          ),
          typeArguments: expr.typeArguments?.map((typeArgument) =>
            lowerType(typeArgument, ctx)
          ),
          resolutionExpectedReturnType: expr.resolutionExpectedReturnType
            ? lowerType(expr.resolutionExpectedReturnType, ctx)
            : undefined,
          parameterTypes: expr.parameterTypes?.map((parameterType) =>
            parameterType ? lowerType(parameterType, ctx) : undefined
          ),
          surfaceParameterTypes: expr.surfaceParameterTypes,
          surfaceRestParameter: expr.surfaceRestParameter,
        };

      case "update":
      case "unary":
      case "await":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
        };

      case "yield":
        return {
          ...expr,
          expression: expr.expression
            ? lowerExpression(expr.expression, ctx)
            : undefined,
        };

      case "binary":
      case "logical":
        return {
          ...expr,
          left: lowerExpression(expr.left, ctx),
          right: lowerExpression(expr.right, ctx),
        };

      case "conditional":
        return {
          ...expr,
          condition: lowerExpression(expr.condition, ctx),
          whenTrue: lowerExpression(expr.whenTrue, ctx),
          whenFalse: lowerExpression(expr.whenFalse, ctx),
        };

      case "assignment":
        return {
          ...expr,
          left:
            expr.left.kind === "identifierPattern" ||
            expr.left.kind === "arrayPattern" ||
            expr.left.kind === "objectPattern"
              ? lowerPattern(expr.left, ctx)
              : lowerExpression(expr.left, ctx),
          right: lowerExpression(expr.right, ctx),
        };

      case "templateLiteral":
        return {
          ...expr,
          expressions: expr.expressions.map((child) =>
            lowerExpression(child, ctx)
          ),
        };

      case "spread":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
        };

      case "numericNarrowing":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "typeAssertion":
      case "asinterface":
      case "trycast":
        return {
          ...expr,
          expression: lowerExpression(expr.expression, ctx),
          targetType: lowerType(expr.targetType, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "stackalloc":
        return {
          ...expr,
          elementType: lowerType(expr.elementType, ctx),
          size: lowerExpression(expr.size, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };

      case "defaultof":
      case "sizeof":
        return {
          ...expr,
          targetType: lowerType(expr.targetType, ctx),
          inferredType: lowerType(expr.inferredType, ctx),
        };
    }
  })();

  if (lowered.kind !== "identifier") {
    let nextExpr: IrExpression = lowered;
    const inferredType = nextExpr.inferredType;
    if (
      inferredType &&
      !(inferredType.kind === "objectType" && inferredType.members.length === 0)
    ) {
      const loweredInferred = lowerType(inferredType, ctx);
      if (loweredInferred !== inferredType) {
        nextExpr = { ...nextExpr, inferredType: loweredInferred };
      }
    }

    if ("contextualType" in nextExpr) {
      const contextualExpr = nextExpr as IrExpression & {
        contextualType?: IrType;
      };
      const contextualType = contextualExpr.contextualType;
      if (
        contextualType &&
        !(
          contextualType.kind === "objectType" &&
          contextualType.members.length === 0
        )
      ) {
        const loweredContextual = lowerType(contextualType, ctx);
        if (loweredContextual !== contextualType) {
          nextExpr = {
            ...contextualExpr,
            contextualType: loweredContextual,
          } as IrExpression;
        }
      }
    }
    return nextExpr;
  }

  return lowered;
};
