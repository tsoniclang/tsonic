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
import { Diagnostic } from "../types/diagnostic.js";

/**
 * TSN7203 retired:
 * Symbol index signatures are lowered as dictionary/object-key shapes.
 */
export const checkForSymbolIndexSignature = (
  _node: ts.IndexSignatureDeclaration,
  _sourceFile: ts.SourceFile
): Diagnostic | null => {
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
