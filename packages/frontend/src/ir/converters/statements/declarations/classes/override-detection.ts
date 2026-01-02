/**
 * Override detection for class members
 *
 * ALICE'S SPEC: Uses TypeSystem exclusively for declaration queries.
 */

import * as ts from "typescript";
import { getMetadataRegistry, getTypeSystem } from "../registry.js";
import type { Binding } from "../../../../binding/index.js";

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
  binding: Binding,
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

  // ALICE'S SPEC: Use TypeSystem to get declaration info
  const typeSystem = getTypeSystem();
  if (!typeSystem) {
    return { isOverride: false, isShadow: false };
  }

  // Try to resolve the identifier to get more context
  const declId =
    ts.isIdentifier(superClass.expression) &&
    binding.resolveIdentifier(superClass.expression);

  // Get qualified name from the resolved declaration if available
  const qualifiedName = declId
    ? typeSystem.getFQNameOfDecl(declId)
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
      parameterTypes
    );
  } else if (declId) {
    // ALICE'S SPEC (Phase 5): Use semantic method instead of getDeclInfo
    return typeSystem.checkTsClassMemberOverride(declId, memberName, memberKind);
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
  parameterTypes?: readonly string[]
): OverrideInfo => {
  const metadata = getMetadataRegistry();

  if (memberKind === "method" && parameterTypes) {
    const signature = `${memberName}(${parameterTypes.join(",")})`;
    const isVirtual = metadata.isVirtualMember(qualifiedName, signature);
    const isSealed = metadata.isSealedMember(qualifiedName, signature);
    return { isOverride: isVirtual && !isSealed, isShadow: !isVirtual };
  } else if (memberKind === "property") {
    // For properties, check without parameters
    const isVirtual = metadata.isVirtualMember(qualifiedName, memberName);
    const isSealed = metadata.isSealedMember(qualifiedName, memberName);
    return { isOverride: isVirtual && !isSealed, isShadow: !isVirtual };
  }

  return { isOverride: false, isShadow: false };
};

