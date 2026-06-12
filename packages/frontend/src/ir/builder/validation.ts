/**
 * IR builder validation - checks for unsupported patterns
 *
 * Uses ProgramContext instead of global singletons.
 */

import * as ts from "typescript";
import { Diagnostic } from "../../types/diagnostic.js";
import type { ProgramContext } from "../program-context.js";
import type { DeclId } from "../type-system/types.js";
import type { TypeAuthority } from "../type-system/type-system.js";
import {
  isSourceTypeKind,
  sourceTypeSemanticsFactKey,
} from "../../source-frontend/index.js";

/**
 * Check if a type reference is the struct marker
 * (used to mark types as native value types)
 * Uses source-extension facts projected from TSTS.
 */
const isStructMarker = (
  typeRef: ts.ExpressionWithTypeArguments,
  ctx: ProgramContext
): boolean =>
  isSourceTypeKind(
    ctx.sourceSemantics.getFact(typeRef, sourceTypeSemanticsFactKey),
    "struct"
  );

/**
 * Check if a declaration represents a TypeScript interface
 * (which Tsonic nominalizes for native emission)
 * Uses TypeSystem.isInterfaceDecl().
 */
const isNominalizedInterface = (
  declId: DeclId | undefined,
  typeSystem: TypeAuthority
): boolean => {
  if (!declId) return false;
  return typeSystem.isInterfaceDecl(declId);
};

/**
 * Check if a declaration represents a type alias for an object type
 * (which Tsonic nominalizes for native emission)
 * Uses TypeSystem.isTypeAliasToObjectLiteral().
 */
const isNominalizedTypeAlias = (
  declId: DeclId | undefined,
  typeSystem: TypeAuthority
): boolean => {
  if (!declId) return false;
  return typeSystem.isTypeAliasToObjectLiteral(declId);
};

/**
 * Validate a class declaration for implements clause issues
 */
const validateClassDeclaration = (
  node: ts.ClassDeclaration,
  ctx: ProgramContext
): readonly Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  const implementsClause = node.heritageClauses?.find(
    (h) => h.token === ts.SyntaxKind.ImplementsKeyword
  );

  if (!implementsClause) return [];

  for (const typeRef of implementsClause.types) {
    // Skip the proven source-level struct marker; it is not an emitted interface.
    if (isStructMarker(typeRef, ctx)) {
      continue;
    }

    // Get the declaration ID for the identifier
    // This preserves type alias identity
    const identifierDeclId = ts.isIdentifier(typeRef.expression)
      ? ctx.binding.resolveIdentifier(typeRef.expression)
      : undefined;

    // Check if it's a nominalized interface or type alias
    if (
      isNominalizedInterface(identifierDeclId, ctx.typeSystem) ||
      isNominalizedTypeAlias(identifierDeclId, ctx.typeSystem)
    ) {
      // Tsonic supports `implements` in the TypeScript surface language. The
      // emitter is responsible for selecting a valid native representation.
      continue;
    }
  }

  return diagnostics;
};

/**
 * Validate all class declarations in a source file
 */
export const validateClassImplements = (
  sourceFile: ts.SourceFile,
  ctx: ProgramContext
): readonly Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node)) {
      diagnostics.push(...validateClassDeclaration(node, ctx));
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return diagnostics;
};
