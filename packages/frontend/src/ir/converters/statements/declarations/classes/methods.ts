/**
 * Method member conversion
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
import { detectOverride } from "./override-detection.js";
import type { ProgramContext } from "../../../../program-context.js";
import { createDiagnostic } from "../../../../../types/diagnostic.js";
import { getSourceSpan } from "../../../expressions/helpers.js";

/**
 * Convert method declaration to IR
 */
export const convertMethod = (
  node: ts.MethodDeclaration,
  ctx: ProgramContext,
  superClass: ts.ExpressionWithTypeArguments | undefined
): IrClassMember => {
  const memberName = ts.isIdentifier(node.name) ? node.name.text : "[computed]";

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
      return declaredAccessibility;
    }

    const required = overrideInfo.requiredAccessibility;

    // Airplane-grade: C# forbids changing accessibility when overriding.
    // For CLR `protected internal`, TypeScript cannot express the `internal` portion,
    // so we accept `protected` in TS and emit `protected internal` in C#.
    const ok =
      required === "public"
        ? declaredAccessibility === "public"
        : required === "protected"
          ? declaredAccessibility === "protected"
          : required === "protected internal"
            ? declaredAccessibility === "protected"
            : false;

    if (!ok) {
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN6201",
          "error",
          `Invalid override accessibility for '${memberName}'. CLR base member is '${required}', but this override is declared '${declaredAccessibility}'.`,
          getSourceSpan(node)
        )
      );
    }

    // Emit the CLR-required accessibility.
    return required;
  })();

  // Get return type from declared annotation for contextual typing
  // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
  const returnType = node.type
    ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(node.type))
    : undefined;

  return {
    kind: "methodDeclaration",
    name: memberName,
    typeParameters: convertTypeParameters(node.typeParameters, ctx),
    parameters,
    returnType,
    // Pass return type to body for contextual typing of return statements
    body: node.body
      ? convertBlockStatement(node.body, ctx, returnType)
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
