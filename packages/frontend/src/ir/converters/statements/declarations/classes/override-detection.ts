/**
 * Override detection for class members
 */

import * as ts from "typescript";
import { getMetadataRegistry } from "../registry.js";

export type OverrideInfo = {
  readonly isOverride: boolean;
  readonly isShadow: boolean;
};

/**
 * Check if a method/property should be marked as override based on base class metadata
 */
export const detectOverride = (
  memberName: string,
  memberKind: "method" | "property",
  superClass: ts.ExpressionWithTypeArguments | undefined,
  checker: ts.TypeChecker,
  parameterTypes?: readonly string[]
): OverrideInfo => {
  if (!superClass) {
    return { isOverride: false, isShadow: false };
  }

  // DETERMINISTIC: Get base class symbol directly from AST
  // Uses getSymbolAtLocation (allowed) instead of getTypeAtLocation (banned)
  const baseSymbol = checker.getSymbolAtLocation(superClass.expression);

  if (!baseSymbol) {
    return { isOverride: false, isShadow: false };
  }

  // Get fully-qualified name for .NET types
  const qualifiedName = checker.getFullyQualifiedName(baseSymbol);

  // Check if this is a .NET type (starts with "System." or other .NET namespaces)
  const isDotNetType =
    qualifiedName.startsWith("System.") ||
    qualifiedName.startsWith("Microsoft.") ||
    qualifiedName.startsWith("Tsonic.Runtime.");

  if (isDotNetType) {
    return detectDotNetOverride(
      memberName,
      memberKind,
      qualifiedName,
      parameterTypes
    );
  } else {
    return detectTypeScriptOverride(memberName, memberKind, baseSymbol);
  }
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

/**
 * Detect override for TypeScript base classes
 */
const detectTypeScriptOverride = (
  memberName: string,
  memberKind: "method" | "property",
  baseSymbol: ts.Symbol
): OverrideInfo => {
  const baseDeclarations = baseSymbol.getDeclarations();

  if (!baseDeclarations || baseDeclarations.length === 0) {
    return { isOverride: false, isShadow: false };
  }

  for (const baseDecl of baseDeclarations) {
    if (ts.isClassDeclaration(baseDecl)) {
      // Check if base class has this member
      const baseMember = baseDecl.members.find((m) => {
        if (memberKind === "method" && ts.isMethodDeclaration(m)) {
          return ts.isIdentifier(m.name) && m.name.text === memberName;
        } else if (memberKind === "property" && ts.isPropertyDeclaration(m)) {
          return ts.isIdentifier(m.name) && m.name.text === memberName;
        }
        return false;
      });

      if (baseMember) {
        // In TypeScript, all methods can be overridden unless final (not supported in TS)
        return { isOverride: true, isShadow: false };
      }
    }
  }

  return { isOverride: false, isShadow: false };
};
