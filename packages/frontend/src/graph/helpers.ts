/**
 * Helper functions for dependency graph analysis
 */

import * as ts from "typescript";

/**
 * Check if a node is top-level executable code (not just declarations)
 */
export const isTopLevelCode = (node: ts.Node): boolean => {
  // Check if this is a top-level statement that's not a declaration
  if (node.parent && ts.isSourceFile(node.parent)) {
    return (
      !ts.isModuleDeclaration(node) &&
      !ts.isImportDeclaration(node) &&
      !ts.isExportDeclaration(node) &&
      !ts.isExportAssignment(node) &&
      !ts.isTypeAliasDeclaration(node) &&
      !ts.isInterfaceDeclaration(node) &&
      !(ts.isVariableStatement(node) && !hasExecutableInitializer(node)) &&
      !ts.isFunctionDeclaration(node) &&
      !ts.isClassDeclaration(node) &&
      !ts.isEnumDeclaration(node)
    );
  }
  return false;
};

/**
 * Check if a variable statement has an initializer that executes code
 */
export const hasExecutableInitializer = (
  node: ts.VariableStatement
): boolean => {
  return node.declarationList.declarations.some(
    (decl) => decl.initializer && !ts.isLiteralExpression(decl.initializer)
  );
};

/**
 * Check if a node has the export modifier
 */
export const hasExportModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
  );
};
