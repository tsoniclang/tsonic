/**
 * Override detection for class members
 *
 * ALICE'S SPEC: Uses TypeSystem exclusively for declaration queries.
 */

import * as ts from "typescript";
import type { ProgramContext } from "../../../../program-context.js";

export type OverrideInfo = {
  readonly isOverride: boolean;
  readonly isShadow: boolean;
};

/**
 * Check if a method/property should be marked as override based on base class metadata.
 * DETERMINISTIC: Uses Binding API for symbol resolution.
 */
export const detectOverride = (
  memberName: string,
  memberKind: "method" | "property",
  superClass: ts.ExpressionWithTypeArguments | undefined,
  ctx: ProgramContext,
  parameterTypes?: readonly string[]
): OverrideInfo => {
  if (!superClass) {
    return { isOverride: false, isShadow: false };
  }

  // DETERMINISTIC: Get base class name directly from AST
  // For simple identifiers, get the name; for qualified names, get the full path
  const baseClassName = ts.isIdentifier(superClass.expression)
    ? superClass.expression.text
    : ts.isPropertyAccessExpression(superClass.expression)
      ? getFullPropertyAccessName(superClass.expression)
      : undefined;

  if (!baseClassName) {
    return { isOverride: false, isShadow: false };
  }

  // Try to resolve the identifier to get more context
  const declId =
    ts.isIdentifier(superClass.expression) &&
    ctx.binding.resolveIdentifier(superClass.expression);

  // Get qualified name from the resolved declaration if available
  const qualifiedName = declId
    ? ctx.typeSystem.getFQNameOfDecl(declId)
    : baseClassName;

  // Check if this is a .NET type (starts with "System." or other .NET namespaces)
  const isDotNetType =
    qualifiedName?.startsWith("System.") ||
    qualifiedName?.startsWith("Microsoft.") ||
    qualifiedName?.startsWith("Tsonic.Runtime.");

  if (isDotNetType && qualifiedName) {
    return detectDotNetOverride(
      memberName,
      memberKind,
      qualifiedName,
      ctx,
      parameterTypes
    );
  } else if (declId) {
    // ALICE'S SPEC (Phase 5): Use semantic method instead of getDeclInfo
    return ctx.typeSystem.checkTsClassMemberOverride(
      declId,
      memberName,
      memberKind
    );
  }

  return { isOverride: false, isShadow: false };
};

/**
 * Get full property access name (e.g., "System.Collections.Generic.List")
 */
const getFullPropertyAccessName = (
  expr: ts.PropertyAccessExpression
): string => {
  const parts: string[] = [expr.name.text];
  let current: ts.Expression = expr.expression;

  while (ts.isPropertyAccessExpression(current)) {
    parts.unshift(current.name.text);
    current = current.expression;
  }

  if (ts.isIdentifier(current)) {
    parts.unshift(current.text);
  }

  return parts.join(".");
};

/**
 * Detect override for .NET base classes using metadata
 */
const detectDotNetOverride = (
  memberName: string,
  memberKind: "method" | "property",
  qualifiedName: string,
  ctx: ProgramContext,
  parameterTypes?: readonly string[]
): OverrideInfo => {
  if (memberKind === "method" && parameterTypes) {
    const signature = `${memberName}(${parameterTypes.join(",")})`;
    const isVirtual = ctx.metadata.isVirtualMember(qualifiedName, signature);
    const isSealed = ctx.metadata.isSealedMember(qualifiedName, signature);
    return { isOverride: isVirtual && !isSealed, isShadow: !isVirtual };
  } else if (memberKind === "property") {
    // For properties, check without parameters
    const isVirtual = ctx.metadata.isVirtualMember(qualifiedName, memberName);
    const isSealed = ctx.metadata.isSealedMember(qualifiedName, memberName);
    return { isOverride: isVirtual && !isSealed, isShadow: !isVirtual };
  }

  return { isOverride: false, isShadow: false };
};
