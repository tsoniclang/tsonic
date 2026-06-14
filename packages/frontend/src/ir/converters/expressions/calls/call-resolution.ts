/**
 * Call resolution helpers
 *
 * Contains argument expansion and declared return helpers for call/new
 * expressions. Selected-signature ownership sits behind the source semantic
 * boundary and `TypeSystem.resolveCall`; this module must not rank callable
 * candidates locally.
 */

import {
  getTstsIdentifierText,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import { IrCallExpression, getSpreadTupleShape } from "../../../types.js";
import { IrType } from "../../../types.js";
import type { ProgramContext } from "../../../program-context.js";

export const collectResolutionArguments = (
  args: readonly IrCallExpression["arguments"][number][]
): {
  readonly argumentCount: number;
  readonly argTypes: readonly (IrType | undefined)[];
} => {
  const argTypes: (IrType | undefined)[] = [];

  for (const arg of args) {
    if (arg.kind !== "spread") {
      argTypes.push(arg.inferredType);
      continue;
    }

    const spreadShape = arg.inferredType
      ? getSpreadTupleShape(arg.inferredType)
      : undefined;
    if (!spreadShape) {
      continue;
    }

    for (const elementType of spreadShape.prefixElementTypes) {
      argTypes.push(elementType);
    }
  }

  return {
    argumentCount: argTypes.length,
    argTypes,
  };
};

/**
 * Walk a property access chain and build a qualified name.
 * For `Foo.Bar.Baz`, returns "Foo.Bar.Baz" by walking the AST identifiers.
 * This avoids getText() which bakes source formatting into type identity.
 */
export const buildQualifiedName = (expr: TstsNode): string | undefined => {
  if (expr.Kind === TstsSyntax.KindIdentifier) {
    return getTstsIdentifierText(expr);
  }

  if (expr.Kind === TstsSyntax.KindPropertyAccessExpression) {
    const parts: string[] = [];
    let current: TstsNode = expr;

    while (current.Kind === TstsSyntax.KindPropertyAccessExpression) {
      const propertyAccess = TstsSyntax.AsPropertyAccessExpression(current);
      if (!propertyAccess?.Expression) return undefined;
      const name = getTstsIdentifierText(propertyAccess.name);
      if (!name) return undefined;
      parts.unshift(name);
      current = propertyAccess.Expression;
    }

    const root = getTstsIdentifierText(current);
    if (root) {
      parts.unshift(root);
      return parts.join(".");
    }
  }

  return undefined;
};

export const unwrapExpr = (expr: TstsNode): TstsNode => {
  let current = expr;
  while (current.Kind === TstsSyntax.KindParenthesizedExpression) {
    const inner = TstsSyntax.AsParenthesizedExpression(current)?.Expression;
    if (!inner) return current;
    current = inner;
  }
  return current;
};

// TypeSystem.resolveCall() is the single source of truth.

/**
 * Get the declared return type from a call or new expression's signature.
 *
 * Uses TypeSystem.resolveCall() exclusively.
 * NO FALLBACKS. If TypeSystem can't resolve, return unknownType.
 * This ensures any missing TypeSystem functionality surfaces as test failures.
 */
export const getDeclaredReturnType = (
  node: TstsNode,
  ctx: ProgramContext,
  receiverIrType?: IrType
): IrType | undefined => {
  const DEBUG = process.env.DEBUG_RETURN_TYPE === "1";
  const callTarget = TstsSyntax.Node_Expression(node);
  const methodName =
    node.Kind === TstsSyntax.KindCallExpression &&
    callTarget?.Kind === TstsSyntax.KindPropertyAccessExpression
      ? getTstsIdentifierText(
          TstsSyntax.AsPropertyAccessExpression(callTarget)?.name
        )
      : undefined;
  if (DEBUG && methodName) {
    console.log(
      "[getDeclaredReturnType]",
      methodName,
      "receiver:",
      receiverIrType
    );
  }

  // Handle new expressions specially - they construct the type from the expression
  if (node.Kind === TstsSyntax.KindNewExpression) {
    const typeSystem = ctx.typeSystem;
    const sigId = ctx.binding.resolveConstructorSignature(node);
    if (!sigId) {
      if (DEBUG && methodName) {
        console.log(
          "[getDeclaredReturnType]",
          methodName,
          "No constructor signature resolved"
        );
      }
      return undefined;
    }

    const argumentCount = (TstsSyntax.Node_Arguments(node) ?? []).length;
    const explicitTypeArgNodes = TstsSyntax.Node_TypeArguments(node) ?? [];
    const explicitTypeArgs =
      explicitTypeArgNodes.length > 0
        ? explicitTypeArgNodes.flatMap((ta) =>
            ta
              ? [typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(ta))]
              : []
          )
      : undefined;
    const resolved = typeSystem.resolveCall({
      sigId,
      argumentCount,
      explicitTypeArgs,
    });

    if (DEBUG && methodName) {
      console.log(
        "[getDeclaredReturnType]",
        methodName,
        "TypeSystem returned:",
        resolved.returnType
      );
    }

    return resolved.returnType.kind === "unknownType"
      ? undefined
      : resolved.returnType;
  }

  // For call expressions, use TypeSystem.resolveCall() EXCLUSIVELY
  const typeSystem = ctx.typeSystem;

  const sigId = ctx.binding.resolveCallSignature(node);
  if (!sigId) {
    if (DEBUG && methodName)
      console.log(
        "[getDeclaredReturnType]",
        methodName,
        "No signature resolved"
      );
    return undefined;
  }

  // Get argument count for totality
  const argumentCount = (TstsSyntax.Node_Arguments(node) ?? []).length;

  // Extract explicit type arguments from call syntax through the TypeSystem.
  const explicitTypeArgNodes = TstsSyntax.Node_TypeArguments(node) ?? [];
  const explicitTypeArgs =
    explicitTypeArgNodes.length > 0
      ? explicitTypeArgNodes.flatMap((ta) =>
          ta
            ? [typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(ta))]
            : []
        )
    : undefined;

  // Use TypeSystem.resolveCall() - guaranteed to return a result
  // NO FALLBACK: If TypeSystem returns unknownType, that's the answer
  const resolved = typeSystem.resolveCall({
    sigId,
    argumentCount,
    receiverType: receiverIrType,
    explicitTypeArgs,
  });

  if (DEBUG && methodName) {
    console.log(
      "[getDeclaredReturnType]",
      methodName,
      "TypeSystem returned:",
      resolved.returnType
    );
  }

  // Return TypeSystem's answer directly.
  return resolved.returnType;
};
