/**
 * New expression emitter
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import {
  emitTypeArgumentsAst,
  generateSpecializedName,
} from "../identifiers.js";
import { isLValue, getPassingModifierFromCast } from "./call-analysis.js";
import { extractCalleeNameFromAst } from "../../core/format/backend-ast/utils.js";
import {
  identifierType,
  withTypeArguments,
} from "../../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import { matchesExpectedEmissionType } from "../../core/semantic/expected-type-matching.js";
import {
  emitArrayConstructor,
  emitUint8ArrayArrayLiteralConstructor,
  emitUint8ArrayNumericLengthConstructor,
  emitListCollectionInitializer,
  isArrayConstructorCall,
  isListConstructorWithArrayLiteral,
  isUint8ArrayConstructorWithArrayLiteral,
  isUint8ArrayConstructorWithNumericLength,
} from "./new-emitter-collections.js";
import {
  emitPromiseConstructor,
  isPromiseConstructorCall,
} from "./new-emitter-promise.js";

/**
 * Emit a new expression as CSharpExpressionAst
 */
export const emitNew = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  // Special case: new Array<T>(size) → new T[size]
  if (isArrayConstructorCall(expr)) {
    return emitArrayConstructor(expr, context);
  }

  // Special case: new List<T>([...]) → new List<T> { ... }
  if (isListConstructorWithArrayLiteral(expr)) {
    return emitListCollectionInitializer(expr, context, emitNew);
  }

  if (isUint8ArrayConstructorWithArrayLiteral(expr)) {
    return emitUint8ArrayArrayLiteralConstructor(expr, context);
  }

  if (isUint8ArrayConstructorWithNumericLength(expr)) {
    return emitUint8ArrayNumericLengthConstructor(expr, context);
  }

  // Promise constructor lowering
  if (isPromiseConstructorCall(expr)) {
    return emitPromiseConstructor(expr, context);
  }

  const [calleeAst, newContext] = emitExpressionAst(expr.callee, context);
  let currentContext = newContext;
  let calleeText = extractCalleeNameFromAst(calleeAst);
  let explicitCalleeTypeAst: CSharpTypeAst | undefined =
    calleeAst.kind === "typeReferenceExpression" ? calleeAst.type : undefined;

  let typeArgAsts: readonly CSharpTypeAst[] = [];

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      const [specializedName, specContext] = generateSpecializedName(
        calleeText,
        expr.typeArguments,
        currentContext
      );
      calleeText = specializedName;
      currentContext = specContext;
    } else {
      const [typeArgs, typeContext] = emitTypeArgumentsAst(
        expr.typeArguments,
        currentContext
      );
      typeArgAsts = typeArgs;
      currentContext = typeContext;
    }
  }

  const argAsts: CSharpExpressionAst[] = [];
  const surfaceParameterTypes =
    expr.surfaceParameterTypes && expr.surfaceParameterTypes.length > 0
      ? expr.surfaceParameterTypes
      : (expr.parameterTypes ?? []);
  const runtimeParameterTypes = expr.parameterTypes ?? [];
  for (let i = 0; i < expr.arguments.length; i++) {
    const arg = expr.arguments[i];
    if (!arg) continue;
    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push({
        kind: "argumentModifierExpression",
        modifier: "params",
        expression: spreadAst,
      });
      currentContext = ctx;
    } else {
      const expectedType = surfaceParameterTypes[i];
      const runtimeExpectedType = runtimeParameterTypes[i];
      const effectiveExpectedType = (() => {
        if (!runtimeExpectedType) {
          return expectedType;
        }

        const actualArgumentType =
          resolveEffectiveExpressionType(arg, currentContext) ??
          arg.inferredType;

        if (
          actualArgumentType &&
          matchesExpectedEmissionType(
            actualArgumentType,
            runtimeExpectedType,
            currentContext
          )
        ) {
          return runtimeExpectedType;
        }

        if (
          runtimeExpectedType.kind === "unknownType" ||
          runtimeExpectedType.kind === "anyType" ||
          (runtimeExpectedType.kind === "referenceType" &&
            runtimeExpectedType.name === "object")
        ) {
          return runtimeExpectedType;
        }

        return expectedType ?? runtimeExpectedType;
      })();
      const castModifier = getPassingModifierFromCast(arg);
      if (castModifier && isLValue(arg)) {
        const [argAst, ctx] = emitExpressionAst(arg, currentContext);
        argAsts.push({
          kind: "argumentModifierExpression",
          modifier: castModifier,
          expression: argAst,
        });
        currentContext = ctx;
      } else {
        const [argAst, ctx] = emitExpressionAst(
          arg,
          currentContext,
          effectiveExpectedType
        );
        const passingMode = expr.argumentPassing?.[i];
        const modifier =
          passingMode && passingMode !== "value" && isLValue(arg)
            ? passingMode
            : undefined;
        argAsts.push(
          modifier
            ? {
                kind: "argumentModifierExpression",
                modifier,
                expression: argAst,
              }
            : argAst
        );
        currentContext = ctx;
      }
    }
  }

  const typeAst: CSharpTypeAst =
    explicitCalleeTypeAst !== undefined
      ? withTypeArguments(explicitCalleeTypeAst, typeArgAsts)
      : typeArgAsts.length > 0
        ? identifierType(calleeText, typeArgAsts)
        : identifierType(calleeText);

  const result: CSharpExpressionAst = {
    kind: "objectCreationExpression",
    type: typeAst,
    arguments: argAsts,
  };
  return [result, currentContext];
};
