/**
 * IR builder validation - checks for unsupported patterns
 */

import * as ts from "typescript";
import { Diagnostic, createDiagnostic } from "../../types/diagnostic.js";
import { getSourceLocation } from "../../program/diagnostics.js";

/**
 * Check if a type reference is the struct marker
 * (used to mark types as C# value types)
 */
const isStructMarker = (
  typeRef: ts.ExpressionWithTypeArguments,
  checker: ts.TypeChecker
): boolean => {
  const symbol = checker.getSymbolAtLocation(typeRef.expression);
  return symbol?.escapedName === "struct" || symbol?.escapedName === "Struct";
};

/**
 * Check if a symbol represents a TypeScript interface
 * (which Tsonic nominalizes to a C# class)
 */
const isNominalizedInterface = (
  symbol: ts.Symbol | undefined,
  _checker: ts.TypeChecker
): boolean => {
  if (!symbol) return false;

  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) return false;

  // Check if any declaration is an interface
  return declarations.some((decl) => ts.isInterfaceDeclaration(decl));
};

/**
 * Check if a symbol represents a type alias for an object type
 * (which Tsonic nominalizes to a C# class)
 */
const isNominalizedTypeAlias = (
  symbol: ts.Symbol | undefined,
  _checker: ts.TypeChecker
): boolean => {
  if (!symbol) return false;

  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) return false;

  // Check if declaration is a type alias with object literal type
  return declarations.some((decl) => {
    if (!ts.isTypeAliasDeclaration(decl)) return false;
    // Type aliases for object shapes are nominalized
    return ts.isTypeLiteralNode(decl.type);
  });
};

/**
 * Validate a class declaration for implements clause issues
 */
const validateClassDeclaration = (
  node: ts.ClassDeclaration,
  checker: ts.TypeChecker
): readonly Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  const implementsClause = node.heritageClauses?.find(
    (h) => h.token === ts.SyntaxKind.ImplementsKeyword
  );

  if (!implementsClause) return [];

  for (const typeRef of implementsClause.types) {
    // Skip the struct marker - it's a special pattern for value types
    if (isStructMarker(typeRef, checker)) {
      continue;
    }

    // Get the symbol for the identifier (not the resolved type)
    // This preserves type alias identity
    const identifierSymbol = checker.getSymbolAtLocation(typeRef.expression);

    // Check if it's a nominalized interface or type alias
    if (
      isNominalizedInterface(identifierSymbol, checker) ||
      isNominalizedTypeAlias(identifierSymbol, checker)
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
  checker: ts.TypeChecker
): readonly Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node)) {
      diagnostics.push(...validateClassDeclaration(node, checker));
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return diagnostics;
};
