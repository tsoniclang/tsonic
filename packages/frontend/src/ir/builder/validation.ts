/**
 * IR builder validation - checks for unsupported patterns
 */

import * as ts from "typescript";
import { Diagnostic, createDiagnostic } from "../../types/diagnostic.js";
import { getSourceLocation } from "../../program/diagnostics.js";
import type { Binding } from "../binding/index.js";
import type { DeclId } from "../type-system/types.js";

/**
 * Check if a type reference is the struct marker
 * (used to mark types as C# value types)
 * Uses Binding layer for symbol resolution.
 */
const isStructMarker = (
  typeRef: ts.ExpressionWithTypeArguments,
  binding: Binding
): boolean => {
  if (!ts.isIdentifier(typeRef.expression)) {
    return false;
  }
  const declId = binding.resolveIdentifier(typeRef.expression);
  if (!declId) {
    return false;
  }
  const declInfo = binding.getHandleRegistry().getDecl(declId);
  const name = declInfo?.fqName;
  return name === "struct" || name === "Struct";
};

/**
 * Check if a declaration represents a TypeScript interface
 * (which Tsonic nominalizes to a C# class)
 */
const isNominalizedInterface = (
  declId: DeclId | undefined,
  binding: Binding
): boolean => {
  if (!declId) return false;

  const declInfo = binding.getHandleRegistry().getDecl(declId);
  if (!declInfo) return false;

  return declInfo.kind === "interface";
};

/**
 * Check if a declaration represents a type alias for an object type
 * (which Tsonic nominalizes to a C# class)
 * Note: We check DeclKind for typeAlias, then examine the typeNode.
 */
const isNominalizedTypeAlias = (
  declId: DeclId | undefined,
  binding: Binding
): boolean => {
  if (!declId) return false;

  const declInfo = binding.getHandleRegistry().getDecl(declId);
  if (!declInfo) return false;

  if (declInfo.kind !== "typeAlias") return false;

  // Check if the type alias points to an object literal type
  const typeNode = declInfo.typeNode as ts.TypeNode | undefined;
  if (!typeNode) return false;

  return ts.isTypeLiteralNode(typeNode);
};

/**
 * Validate a class declaration for implements clause issues
 */
const validateClassDeclaration = (
  node: ts.ClassDeclaration,
  binding: Binding
): readonly Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  const implementsClause = node.heritageClauses?.find(
    (h) => h.token === ts.SyntaxKind.ImplementsKeyword
  );

  if (!implementsClause) return [];

  for (const typeRef of implementsClause.types) {
    // Skip the struct marker - it's a special pattern for value types
    if (isStructMarker(typeRef, binding)) {
      continue;
    }

    // Get the declaration ID for the identifier
    // This preserves type alias identity
    const identifierDeclId = ts.isIdentifier(typeRef.expression)
      ? binding.resolveIdentifier(typeRef.expression)
      : undefined;

    // Check if it's a nominalized interface or type alias
    if (
      isNominalizedInterface(identifierDeclId, binding) ||
      isNominalizedTypeAlias(identifierDeclId, binding)
    ) {
      const typeName = typeRef.expression.getText();
      const location = getSourceLocation(
        node.getSourceFile(),
        typeRef.getStart(),
        typeRef.getWidth()
      );

      diagnostics.push(
        createDiagnostic(
          "TSN7301",
          "error",
          `Class cannot implement '${typeName}': TypeScript interfaces are nominalized to C# classes in Tsonic. Use 'extends' instead, or refactor to composition.`,
          location,
          "In Tsonic, interfaces become classes for object initializer support. C# classes cannot implement other classes."
        )
      );
    }
  }

  return diagnostics;
};

/**
 * Validate all class declarations in a source file
 */
export const validateClassImplements = (
  sourceFile: ts.SourceFile,
  binding: Binding
): readonly Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node)) {
      diagnostics.push(...validateClassDeclaration(node, binding));
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return diagnostics;
};
