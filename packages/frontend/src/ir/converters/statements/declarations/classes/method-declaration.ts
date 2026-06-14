/**
 * Method declaration conversion (single non-overloaded method)
 */

import {
  getTstsBodyNode,
  getTstsDeclaredTypeNode,
  getTstsParameters,
  getTstsTypeParameterNodes,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import { IrClassMember } from "../../../../types.js";
import { convertBlockStatement } from "../../control.js";
import {
  hasStaticModifier,
  getAccessibility,
  convertTypeParameters,
  convertParameters,
  hasAsyncModifier,
  definedTstsNodes,
} from "../../helpers.js";
import { withParameterTypeEnv } from "../../../type-env.js";
import { detectOverride } from "./override-detection.js";
import {
  getClassMemberName,
  isPrivateClassMemberName,
} from "./member-names.js";
import type { ProgramContext } from "../../../../program-context.js";
import { getReturnExpressionExpectedType } from "../../../return-expression-types.js";
import { inferDeterministicBlockReturnType } from "../return-type-inference.js";

/**
 * Convert method declaration to IR
 */
export const convertMethod = (
  node: TstsNode,
  ctx: ProgramContext,
  superClass: TstsNode | undefined
): IrClassMember => {
  const memberName = getClassMemberName(TstsSyntax.Node_Name(node));
  const isEcmaPrivate = isPrivateClassMemberName(TstsSyntax.Node_Name(node));

  const parameterNodes = definedTstsNodes(getTstsParameters(node));
  const parameters = convertParameters(parameterNodes, ctx);

  const overrideInfo = detectOverride(
    memberName,
    "method",
    superClass,
    ctx,
    parameters
  );

  const declaredAccessibility = getAccessibility(node);
  const accessibility = (() => {
    if (!overrideInfo.isOverride || !overrideInfo.requiredAccessibility) {
      return isEcmaPrivate ? "private" : declaredAccessibility;
    }

    // Airplane-grade: always emit native target-required accessibility for overrides.
    // The TS surface may lose access modifiers (e.g., protected members exposed as callable
    // overloads to avoid unstable renames like Dispose2), but target compilation enforces the truth.
    return overrideInfo.requiredAccessibility;
  })();

  // Get return type from declared annotation for contextual typing
  // Convert method declaration syntax through the TypeSystem.
  const returnTypeNode = getTstsDeclaredTypeNode(node);
  const returnType = returnTypeNode
    ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(returnTypeNode))
    : undefined;
  const returnExpressionType = getReturnExpressionExpectedType(
    returnType,
    hasAsyncModifier(node)
  );
  const bodyCtx = withParameterTypeEnv(ctx, parameterNodes, parameters);
  const bodyNode = getTstsBodyNode(node);
  const body = bodyNode
    ? convertBlockStatement(bodyNode, bodyCtx, returnExpressionType)
    : undefined;
  const effectiveReturnType =
    returnType ??
    (body && !TstsSyntax.AsMethodDeclaration(node)?.AsteriskToken
      ? inferDeterministicBlockReturnType(body)
      : undefined);

  return {
    kind: "methodDeclaration",
    name: memberName,
    typeParameters: convertTypeParameters(
      definedTstsNodes(getTstsTypeParameterNodes(node)),
      ctx
    ),
    parameters,
    returnType: effectiveReturnType,
    // Pass return type to body for contextual typing of return statements
    body,
    isStatic: hasStaticModifier(node),
    isAsync: hasAsyncModifier(node),
    isGenerator: !!TstsSyntax.AsMethodDeclaration(node)?.AsteriskToken,
    accessibility,
    isOverride: overrideInfo.isOverride ? true : undefined,
    isShadow: overrideInfo.isShadow ? true : undefined,
  };
};
