/**
 * Symbol table for tracking cross-module references
 */

import * as ts from "typescript";

export type SymbolKind =
  | "class"
  | "interface"
  | "function"
  | "variable"
  | "type"
  | "enum"
  | "namespace";

export type Symbol = {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly isExported: boolean;
  readonly module: string; // File path
  readonly tsSymbol?: ts.Symbol; // Optional reference to TypeScript symbol
};

export type SymbolTable = {
  readonly symbols: ReadonlyMap<string, readonly Symbol[]>; // Name to symbols
  readonly moduleSymbols: ReadonlyMap<string, readonly Symbol[]>; // Module path to symbols
  readonly exportedSymbols: ReadonlyMap<string, readonly Symbol[]>; // Module path to exported symbols
};

export const createSymbolTable = (): SymbolTable => ({
  symbols: new Map(),
  moduleSymbols: new Map(),
  exportedSymbols: new Map(),
});

export const addSymbol = (table: SymbolTable, symbol: Symbol): SymbolTable => {
  // Add to symbols map (by name)
  const symbolsByName = table.symbols.get(symbol.name) ?? [];
  const newSymbolsByName = new Map(table.symbols);
  newSymbolsByName.set(symbol.name, [...symbolsByName, symbol]);

  // Add to module symbols map
  const moduleSymbols = table.moduleSymbols.get(symbol.module) ?? [];
  const newModuleSymbols = new Map(table.moduleSymbols);
  newModuleSymbols.set(symbol.module, [...moduleSymbols, symbol]);

  // Add to exported symbols if exported
  let newExportedSymbols = new Map(table.exportedSymbols);
  if (symbol.isExported) {
    const exportedSymbols = table.exportedSymbols.get(symbol.module) ?? [];
    newExportedSymbols.set(symbol.module, [...exportedSymbols, symbol]);
  }

  return {
    symbols: newSymbolsByName,
    moduleSymbols: newModuleSymbols,
    exportedSymbols: newExportedSymbols,
  };
};

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

export const findSymbol = (
  table: SymbolTable,
  name: string,
  module?: string
): readonly Symbol[] => {
  if (module) {
    const moduleSymbols = table.moduleSymbols.get(module) ?? [];
    return moduleSymbols.filter((s) => s.name === name);
  }
  return table.symbols.get(name) ?? [];
};

export const getExportedSymbols = (
  table: SymbolTable,
  module: string
): readonly Symbol[] => {
  return table.exportedSymbols.get(module) ?? [];
};

export const hasExportedSymbol = (
  table: SymbolTable,
  module: string,
  name: string
): boolean => {
  const exported = getExportedSymbols(table, module);
  return exported.some((s) => s.name === name);
};

const hasExportModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
  );
};
