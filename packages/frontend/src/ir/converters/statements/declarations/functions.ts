/**
 * Function declaration converter
 */

import {
  getTstsBodyNode,
  getTstsNodeNameText,
  getTstsParameters,
  getTstsTypeParameterNodes,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import { IrFunctionDeclaration } from "../../../types.js";
import { convertBlockStatement } from "../control.js";
import {
  hasExportModifier,
  convertTypeParameters,
  convertParameters,
  hasAsyncModifier,
  definedTstsNodes,
} from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";
import { withParameterTypeEnv } from "../../type-env.js";
import { getReturnExpressionExpectedType } from "../../return-expression-types.js";
import { inferDeterministicBlockReturnType } from "./return-type-inference.js";

/**
 * Convert function declaration
 */
export const convertFunctionDeclaration = (
  node: TstsNode,
  ctx: ProgramContext
): IrFunctionDeclaration | null => {
  const name = getTstsNodeNameText(node);
  if (!name) return null;

  // Get return type from declared annotation for contextual typing
  // Convert function declaration syntax through the TypeSystem.
  const returnTypeNode = TstsSyntax.Node_Type(node);
  const returnType = returnTypeNode
    ? ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(returnTypeNode)
      )
    : undefined;
  const returnExpressionType = getReturnExpressionExpectedType(
    returnType,
    hasAsyncModifier(node)
  );
  const parameterNodes = definedTstsNodes(getTstsParameters(node));
  const parameters = convertParameters(parameterNodes, ctx);
  const bodyCtx = withParameterTypeEnv(ctx, parameterNodes, parameters);
  const bodyNode = getTstsBodyNode(node);
  const body = bodyNode
    ? convertBlockStatement(bodyNode, bodyCtx, returnExpressionType)
    : { kind: "blockStatement" as const, statements: [] };
  const effectiveReturnType =
    returnType ??
    (bodyNode && !TstsSyntax.AsFunctionDeclaration(node)?.AsteriskToken
      ? inferDeterministicBlockReturnType(body)
      : undefined);

  return {
    kind: "functionDeclaration",
    name,
    typeParameters: convertTypeParameters(
      definedTstsNodes(getTstsTypeParameterNodes(node)),
      ctx
    ),
    parameters,
    returnType: effectiveReturnType,
    // Pass return type to body for contextual typing of return statements
    body,
    isDeclarationOnly: bodyNode ? undefined : true,
    isAsync: hasAsyncModifier(node),
    isGenerator: !!TstsSyntax.AsFunctionDeclaration(node)?.AsteriskToken,
    isExported: hasExportModifier(node),
  };
};
