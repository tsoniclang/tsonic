/**
 * Generic validation - detect truly unsupported generic patterns
 *
 * NOTE: Many previously-blocked constructs are now handled via:
 * - Monomorphisation for finite specializations
 * - CRTP pattern for `this` typing
 * - Tuple specialisations for variadic parameters
 * - Structural adapters for mapped/conditional types
 *
 * Only constructs with NO static mapping remain as errors.
 */

import * as ts from "typescript";
import {
  Diagnostic,
  createDiagnostic,
  SourceLocation,
} from "../types/diagnostic.js";

/**
 * Get source location from TypeScript node
 */
const getLocation = (
  node: ts.Node,
  sourceFile: ts.SourceFile
): SourceLocation => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart()
  );
  return {
    file: sourceFile.fileName,
    line: line + 1,
    column: character + 1,
    length: node.getWidth(),
  };
};

/**
 * Check for symbol index signatures (TSN7203)
 *
 * Symbol keys have no static C# mapping and must be rejected.
 */
export const checkForSymbolIndexSignature = (
  node: ts.IndexSignatureDeclaration,
  sourceFile: ts.SourceFile
): Diagnostic | null => {
  // Check if the parameter type is symbol
  if (node.parameters.length > 0) {
    const param = node.parameters[0];
    if (param && param.type) {
      // Check for symbol keyword type
      if (param.type.kind === ts.SyntaxKind.SymbolKeyword) {
        return createDiagnostic(
          "TSN7203",
          "error",
          "Symbol keys are not supported in C#",
          getLocation(node, sourceFile),
          "Use string keys instead of symbol keys"
        );
      }

      // Also check for type reference to 'symbol'
      if (ts.isTypeReferenceNode(param.type)) {
        if (
          ts.isIdentifier(param.type.typeName) &&
          param.type.typeName.text === "symbol"
        ) {
          return createDiagnostic(
            "TSN7203",
            "error",
            "Symbol keys are not supported in C#",
            getLocation(node, sourceFile),
            "Use string keys instead of symbol keys"
          );
        }
      }
    }
  }

  return null;
};

/**
 * REMOVED CHECKS (now handled by implementation):
 *
 * - checkForInferKeyword (TSN7102)
 *   Conditional types with infer are handled via monomorphisation
 *
 * - checkForRecursiveMappedType (TSN7101)
 *   Finite mapped types are specialized; unbounded cases get adapters
 *
 * - checkForThisType (TSN7103)
 *   `this` typing is handled via CRTP pattern
 *
 * - checkForVariadicTypeParameter (TSN7104)
 *   Variadic parameters are handled via tuple specialisations
 *
 * - checkForRecursiveStructuralAlias (TSN7201)
 *   Recursive structural aliases emit as C# classes with nullable refs
 */
