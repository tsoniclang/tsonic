/**
 * Import information extraction
 */

import * as ts from "typescript";
import { TsonicProgram } from "../../program.js";
import { Import } from "../../types/module.js";
import { resolveImport } from "../../resolver.js";

/**
 * Extract import information from an import declaration
 */
export const extractImport = (
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  program: TsonicProgram
): Import | null => {
  if (!ts.isStringLiteral(node.moduleSpecifier)) {
    return null;
  }

  const specifier = node.moduleSpecifier.text;
  const result = resolveImport(
    specifier,
    sourceFile.fileName,
    program.options.sourceRoot,
    { clrResolver: program.clrResolver, bindings: program.bindings }
  );

  const importedNames: { readonly name: string; readonly alias?: string }[] =
    [];

  if (node.importClause) {
    // Default import
    if (node.importClause.name) {
      importedNames.push({
        name: "default",
        alias: node.importClause.name.text,
      });
    }

    // Named imports
    if (node.importClause.namedBindings) {
      if (ts.isNamespaceImport(node.importClause.namedBindings)) {
        // import * as ns from "..."
        importedNames.push({
          name: "*",
          alias: node.importClause.namedBindings.name.text,
        });
      } else if (ts.isNamedImports(node.importClause.namedBindings)) {
        // import { a, b as c } from "..."
        node.importClause.namedBindings.elements.forEach((spec) => {
          importedNames.push({
            name: (spec.propertyName ?? spec.name).text,
            alias: spec.propertyName ? spec.name.text : undefined,
          });
        });
      }
    }
  }

  if (result.ok) {
    return {
      kind: result.value.isLocal
        ? "local"
        : result.value.isClr
          ? "clr"
          : "node_module",
      specifier,
      resolvedPath: result.value.resolvedPath || undefined,
      namespace: result.value.resolvedNamespace,
      importedNames,
    };
  }

  return {
    kind: "local",
    specifier,
    importedNames,
  };
};

/**
 * Extract dependency information from dynamic import() calls.
 * Only static-string local specifiers are considered.
 */
export const extractDynamicImport = (
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  program: TsonicProgram
): Import | null => {
  if (node.expression.kind !== ts.SyntaxKind.ImportKeyword) {
    return null;
  }
  if (node.arguments.length !== 1) {
    return null;
  }
  const [arg] = node.arguments;
  if (!arg) return null;
  if (!ts.isStringLiteral(arg) && !ts.isNoSubstitutionTemplateLiteral(arg)) {
    return null;
  }

  const specifier = arg.text;
  const result = resolveImport(
    specifier,
    sourceFile.fileName,
    program.options.sourceRoot,
    { clrResolver: program.clrResolver, bindings: program.bindings }
  );

  if (!result.ok || !result.value.isLocal) {
    return null;
  }

  return {
    kind: "local",
    specifier,
    resolvedPath: result.value.resolvedPath || undefined,
    namespace: result.value.resolvedNamespace,
    importedNames: [],
  };
};
