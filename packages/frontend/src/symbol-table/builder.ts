/**
 * Symbol table builder from TypeScript AST
 */

import * as ts from "typescript";
import { Symbol } from "./types.js";
import { hasExportModifier } from "./helpers.js";

/**
 * Build symbol table from a TypeScript source file
 */
export const buildSymbolTable = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): readonly Symbol[] => {
  const symbols: Symbol[] = [];
  const modulePath = sourceFile.fileName;

  const visitor = (node: ts.Node): void => {
    // Check for exported declarations
    const isExported = hasExportModifier(node);

    if (ts.isClassDeclaration(node) && node.name) {
      symbols.push({
        name: node.name.text,
        kind: "class",
        isExported,
        module: modulePath,
        tsSymbol: checker.getSymbolAtLocation(node.name),
      });
    } else if (ts.isInterfaceDeclaration(node)) {
      symbols.push({
        name: node.name.text,
        kind: "interface",
        isExported,
        module: modulePath,
        tsSymbol: checker.getSymbolAtLocation(node.name),
      });
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      symbols.push({
        name: node.name.text,
        kind: "function",
        isExported,
        module: modulePath,
        tsSymbol: checker.getSymbolAtLocation(node.name),
      });
    } else if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach((decl) => {
        if (ts.isIdentifier(decl.name)) {
          symbols.push({
            name: decl.name.text,
            kind: "variable",
            isExported,
            module: modulePath,
            tsSymbol: checker.getSymbolAtLocation(decl.name),
          });
        }
      });
    } else if (ts.isTypeAliasDeclaration(node)) {
      symbols.push({
        name: node.name.text,
        kind: "type",
        isExported,
        module: modulePath,
        tsSymbol: checker.getSymbolAtLocation(node.name),
      });
    } else if (ts.isEnumDeclaration(node)) {
      symbols.push({
        name: node.name.text,
        kind: "enum",
        isExported,
        module: modulePath,
        tsSymbol: checker.getSymbolAtLocation(node.name),
      });
    } else if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) {
      symbols.push({
        name: node.name.text,
        kind: "namespace",
        isExported,
        module: modulePath,
        tsSymbol: checker.getSymbolAtLocation(node.name),
      });
    }

    // Check for export declarations
    if (
      ts.isExportDeclaration(node) &&
      node.exportClause &&
      ts.isNamedExports(node.exportClause)
    ) {
      node.exportClause.elements.forEach((spec) => {
        const originalName = spec.propertyName?.text ?? spec.name.text;
        const exportedName = spec.name.text;

        // Find the original symbol and mark it as exported
        const originalSymbol = symbols.find(
          (s) => s.name === originalName && !s.isExported
        );
        if (originalSymbol) {
          symbols.push({
            ...originalSymbol,
            name: exportedName,
            isExported: true,
          });
        }
      });
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return symbols;
};
