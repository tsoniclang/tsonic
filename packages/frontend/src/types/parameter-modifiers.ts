/**
 * Parameter Modifier Tracking - Track ref/out/in types from @tsonic/types
 *
 * This module tracks which ref, out, and In types are legitimately imported
 * from @tsonic/types to ensure we only apply parameter modifiers to the
 * correct types (not user-defined types with the same names).
 */

import * as ts from "typescript";

/**
 * Registry for tracking trusted parameter modifier types
 */
export class ParameterModifierRegistry {
  private static instance: ParameterModifierRegistry | null = null;

  // Track which symbols are imported from @tsonic/types
  private trustedSymbols = new Set<string>();

  // Track aliases (e.g., import { ref as myRef })
  private aliasMap = new Map<string, string>();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ParameterModifierRegistry {
    if (!ParameterModifierRegistry.instance) {
      ParameterModifierRegistry.instance = new ParameterModifierRegistry();
    }
    return ParameterModifierRegistry.instance;
  }

  /**
   * Reset the registry (useful for testing)
   */
  static reset(): void {
    if (ParameterModifierRegistry.instance) {
      ParameterModifierRegistry.instance.trustedSymbols.clear();
      ParameterModifierRegistry.instance.aliasMap.clear();
    }
  }

  /**
   * Process an import declaration to track ref/out/In from @tsonic/types
   */
  processImport(importDecl: ts.ImportDeclaration): void {
    // Check if this is an import from @tsonic/types
    if (!ts.isStringLiteral(importDecl.moduleSpecifier)) {
      return;
    }

    const moduleSpecifier = importDecl.moduleSpecifier.text;
    if (moduleSpecifier !== "@tsonic/types") {
      return;
    }

    // Extract named imports
    if (importDecl.importClause?.namedBindings) {
      if (ts.isNamedImports(importDecl.importClause.namedBindings)) {
        for (const spec of importDecl.importClause.namedBindings.elements) {
          const importedName = (spec.propertyName ?? spec.name).text;
          const localName = spec.name.text;

          // Check if this is ref, out, or In
          if (
            importedName === "ref" ||
            importedName === "out" ||
            importedName === "In"
          ) {
            this.trustedSymbols.add(localName);

            // Track alias if different from imported name
            if (importedName !== localName) {
              this.aliasMap.set(localName, importedName);
            }
          }
        }
      }
    }
  }

  /**
   * Check if a type name is a trusted parameter modifier type
   */
  isTrustedParameterModifier(typeName: string): boolean {
    return this.trustedSymbols.has(typeName);
  }

  /**
   * Get the parameter modifier kind for a trusted type
   * @returns 'ref', 'out', 'in', or null if not a parameter modifier
   */
  getParameterModifierKind(typeName: string): "ref" | "out" | "in" | null {
    if (!this.isTrustedParameterModifier(typeName)) {
      return null;
    }

    // Check if it's an alias
    const originalName = this.aliasMap.get(typeName) ?? typeName;

    switch (originalName) {
      case "ref":
        return "ref";
      case "out":
        return "out";
      case "In":
        return "in";
      default:
        return null;
    }
  }

  /**
   * Check if a TypeScript type is a parameter modifier type from @tsonic/types
   * This checks both the type name and verifies it was imported from @tsonic/types
   */
  isParameterModifierType(type: ts.Type, _checker: ts.TypeChecker): boolean {
    // Get the symbol name
    const symbol = type.aliasSymbol || type.symbol;
    if (!symbol) {
      return false;
    }

    const typeName = symbol.getName();
    return this.isTrustedParameterModifier(typeName);
  }

  /**
   * Get parameter modifier info from a type
   */
  getParameterModifierInfo(
    type: ts.Type,
    _checker: ts.TypeChecker
  ): { kind: "ref" | "out" | "in"; wrappedType: ts.Type } | null {
    const symbol = type.aliasSymbol || type.symbol;
    if (!symbol) {
      return null;
    }

    const typeName = symbol.getName();
    const kind = this.getParameterModifierKind(typeName);
    if (!kind) {
      return null;
    }

    // Extract the wrapped type (T in ref<T>, out<T>, or In<T>)
    let wrappedType: ts.Type | undefined;

    if (type.aliasTypeArguments && type.aliasTypeArguments.length > 0) {
      wrappedType = type.aliasTypeArguments[0];
    } else {
      // Access typeArguments through the TypeReference interface
      const typeRef = type as ts.TypeReference;
      const typeArgs = typeRef.typeArguments;
      if (typeArgs && typeArgs.length > 0) {
        wrappedType = typeArgs[0];
      }
    }

    if (!wrappedType) {
      return null;
    }

    return { kind, wrappedType };
  }
}

/**
 * Get the global parameter modifier registry instance
 */
export const getParameterModifierRegistry = (): ParameterModifierRegistry => {
  return ParameterModifierRegistry.getInstance();
};
