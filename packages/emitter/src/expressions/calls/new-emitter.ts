/**
 * New expression emitter
 */

import { IrCallExpression, IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import {
  emitTypeArgumentsAst,
  generateSpecializedName,
} from "../identifiers.js";
import { extractCalleeNameFromAst } from "../../core/format/backend-ast/utils.js";
import {
  identifierType,
  withTypeArguments,
} from "../../core/format/backend-ast/builders.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import {
  emitArrayConstructor,
  emitListCollectionInitializer,
  isArrayConstructorCall,
  isListConstructorWithArrayLiteral,
} from "./new-emitter-collections.js";
import {
  emitPromiseConstructor,
  isPromiseConstructorCall,
} from "./new-emitter-promise.js";
import { emitCallArguments } from "./call-arguments.js";

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

  const constructorCallExpr: IrCallExpression = {
    kind: "call",
    callee: expr.callee,
    arguments: expr.arguments,
    isOptional: false,
    inferredType: expr.inferredType,
    sourceSpan: expr.sourceSpan,
    signatureId: expr.signatureId,
    typeArguments: expr.typeArguments,
    requiresSpecialization: expr.requiresSpecialization,
    resolutionExpectedReturnType: expr.resolutionExpectedReturnType,
    argumentPassing: expr.argumentPassing,
    parameterTypes: expr.parameterTypes,
    surfaceParameterTypes: expr.surfaceParameterTypes,
    restParameter: expr.surfaceRestParameter,
    surfaceRestParameter: expr.surfaceRestParameter,
  };

  const [argAsts, argContext] = emitCallArguments(
    expr.arguments,
    constructorCallExpr,
    currentContext
  );
  currentContext = argContext;

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
