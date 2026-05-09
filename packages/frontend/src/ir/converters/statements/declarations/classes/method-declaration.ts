/**
 * Method declaration conversion (single non-overloaded method)
 */

import * as ts from "typescript";
import { IrClassMember } from "../../../../types.js";
import { convertBlockStatement } from "../../control.js";
import {
  hasStaticModifier,
  getAccessibility,
  convertTypeParameters,
  convertParameters,
} from "../../helpers.js";
import { withParameterTypeEnv } from "../../../type-env.js";
import { detectOverride } from "./override-detection.js";
import {
  getClassMemberName,
  isPrivateClassMemberName,
} from "./member-names.js";
import type { ProgramContext } from "../../../../program-context.js";
import { getReturnExpressionExpectedType } from "../../../return-expression-types.js";

/**
 * Convert method declaration to IR
 */
export const convertMethod = (
  node: ts.MethodDeclaration,
  ctx: ProgramContext,
  superClass: ts.ExpressionWithTypeArguments | undefined
): IrClassMember => {
  const memberName = getClassMemberName(node.name);
  const isEcmaPrivate = isPrivateClassMemberName(node.name);

  const parameters = convertParameters(node.parameters, ctx);

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

    // Airplane-grade: always emit CLR-required accessibility for overrides.
    // The TS surface may lose access modifiers (e.g., protected members exposed as callable
    // overloads to avoid unstable renames like Dispose2), but C# compilation enforces the truth.
    return overrideInfo.requiredAccessibility;
  })();

  // Get return type from declared annotation for contextual typing
  // Convert method declaration syntax through the TypeSystem.
  const returnType = node.type
    ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(node.type))
    : undefined;
  const returnExpressionType = getReturnExpressionExpectedType(
    returnType,
    !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
  );
  const bodyCtx = withParameterTypeEnv(ctx, node.parameters, parameters);

  return {
    kind: "methodDeclaration",
    name: memberName,
    typeParameters: convertTypeParameters(node.typeParameters, ctx),
    parameters,
    returnType,
    // Pass return type to body for contextual typing of return statements
    body: node.body
      ? convertBlockStatement(node.body, bodyCtx, returnExpressionType)
      : undefined,
    isStatic: hasStaticModifier(node),
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    isGenerator: !!node.asteriskToken,
    accessibility,
    isOverride: overrideInfo.isOverride ? true : undefined,
    isShadow: overrideInfo.isShadow ? true : undefined,
  };
};
