/**
 * Function declaration converter
 */

import * as ts from "typescript";
import { IrFunctionDeclaration } from "../../../types.js";
import { convertBlockStatement } from "../control.js";
import {
  hasExportModifier,
  convertTypeParameters,
  convertParameters,
} from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";
import { withParameterTypeEnv } from "../../type-env.js";
import { getReturnExpressionExpectedType } from "../../return-expression-types.js";

/**
 * Convert function declaration
 */
export const convertFunctionDeclaration = (
  node: ts.FunctionDeclaration,
  ctx: ProgramContext
): IrFunctionDeclaration | null => {
  if (!node.name) return null;

  // Get return type from declared annotation for contextual typing
  // Convert function declaration syntax through the TypeSystem.
  const returnType = node.type
    ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(node.type))
    : undefined;
  const returnExpressionType = getReturnExpressionExpectedType(
    returnType,
    !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
  );
  const parameters = convertParameters(node.parameters, ctx);
  const bodyCtx = withParameterTypeEnv(ctx, node.parameters, parameters);

  return {
    kind: "functionDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, ctx),
    parameters,
    returnType,
    // Pass return type to body for contextual typing of return statements
    body: node.body
      ? convertBlockStatement(node.body, bodyCtx, returnExpressionType)
      : { kind: "blockStatement", statements: [] },
    isDeclarationOnly: node.body ? undefined : true,
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    isGenerator: !!node.asteriskToken,
    isExported: hasExportModifier(node),
  };
};
