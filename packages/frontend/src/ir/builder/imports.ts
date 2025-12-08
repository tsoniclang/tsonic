/**
 * Import extraction from TypeScript source
 */

import * as ts from "typescript";
import { IrImport, IrImportSpecifier } from "../types.js";
import { getBindingRegistry } from "../converters/statements/declarations/registry.js";
import { ClrBindingsResolver } from "../../resolver/clr-bindings-resolver.js";

/**
 * Extract import declarations from source file.
 * Uses TypeChecker to determine if each import is a type or value.
 * Uses ClrBindingsResolver to detect CLR namespace imports.
 */
export const extractImports = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  clrResolver: ClrBindingsResolver
): readonly IrImport[] => {
  const imports: IrImport[] = [];

  const visitor = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const source = node.moduleSpecifier.text;
      const isLocal = source.startsWith(".") || source.startsWith("/");

      // Use import-driven resolution to detect CLR imports
      // This works for any package that provides bindings.json
      // Note: Bindings are loaded upfront by discoverAndLoadClrBindings()
      // in dependency-graph.ts before IR building starts.
      const clrResolution = clrResolver.resolve(source);
      const isClr = clrResolution.isClr;
      const resolvedNamespace = clrResolution.isClr
        ? clrResolution.resolvedNamespace
        : undefined;
      const clrAssembly = clrResolution.isClr
        ? clrResolution.assembly
        : undefined;

      const specifiers = extractImportSpecifiers(node, checker);

      // Check for module binding (Node.js API, etc.)
      const binding = getBindingRegistry().getBinding(source);
      const hasModuleBinding = binding?.kind === "module";

      // Assembly comes from CLR resolution (bindings.json) or module binding
      const resolvedAssembly =
        clrAssembly ?? (hasModuleBinding ? binding.assembly : undefined);

      imports.push({
        kind: "import",
        source,
        isLocal,
        isClr,
        specifiers,
        resolvedNamespace,
        resolvedClrType: hasModuleBinding ? binding.type : undefined,
        resolvedAssembly,
      });
    }
    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return imports;
};

/**
 * Extract import specifiers from an import declaration.
 * Uses TypeChecker to determine if each named import is a type or value.
 */
export const extractImportSpecifiers = (
  node: ts.ImportDeclaration,
  checker: ts.TypeChecker
): readonly IrImportSpecifier[] => {
  const specifiers: IrImportSpecifier[] = [];

  if (node.importClause) {
    // Default import
    if (node.importClause.name) {
      specifiers.push({
        kind: "default",
        localName: node.importClause.name.text,
      });
    }

    // Named or namespace imports
    if (node.importClause.namedBindings) {
      if (ts.isNamespaceImport(node.importClause.namedBindings)) {
        specifiers.push({
          kind: "namespace",
          localName: node.importClause.namedBindings.name.text,
        });
      } else if (ts.isNamedImports(node.importClause.namedBindings)) {
        node.importClause.namedBindings.elements.forEach((spec) => {
          const isType = isTypeImport(spec, checker);
          specifiers.push({
            kind: "named",
            name: (spec.propertyName ?? spec.name).text,
            localName: spec.name.text,
            isType,
          });
        });
      }
    }
  }

  return specifiers;
};

/**
 * Determine if an import specifier refers to a type (interface, class, type alias, enum).
 * Uses TypeChecker to resolve the symbol and check its declaration kind.
 */
const isTypeImport = (
  spec: ts.ImportSpecifier,
  checker: ts.TypeChecker
): boolean => {
  try {
    // TypeScript's isTypeOnly flag on the specifier itself (for `import { type Foo }`)
    if (spec.isTypeOnly) {
      return true;
    }

    // Get the symbol for this import specifier
    const symbol = checker.getSymbolAtLocation(spec.name);
    if (!symbol) {
      return false;
    }

    // Follow aliases to get the actual symbol
    const resolvedSymbol =
      symbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;

    if (!resolvedSymbol) {
      return false;
    }

    // Check if the symbol is a type
    const flags = resolvedSymbol.flags;
    return !!(
      flags & ts.SymbolFlags.Interface ||
      flags & ts.SymbolFlags.Class ||
      flags & ts.SymbolFlags.TypeAlias ||
      flags & ts.SymbolFlags.Enum ||
      flags & ts.SymbolFlags.TypeParameter
    );
  } catch {
    return false;
  }
};
