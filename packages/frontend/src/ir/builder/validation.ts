/**
 * IR builder validation - checks for unsupported patterns
 *
 * Uses ProgramContext instead of global singletons.
 */

import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";
import {
  getTstsHeritageClauseDetails,
  visitTstsSubtree,
  TstsSyntax,
} from "@tsonic/tsts";
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
  typeRef: TstsNode,
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
  node: TstsNode,
  ctx: ProgramContext
): readonly Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  const implementsClauses = getTstsHeritageClauseDetails(node).filter(
    (clause) => clause.kind === "implements"
  );

  for (const implementsClause of implementsClauses) {
    for (const typeRef of implementsClause.types) {
      // Skip the proven source-level struct marker; it is not an emitted interface.
      if (!typeRef || isStructMarker(typeRef, ctx)) {
        continue;
      }

      // Get the declaration ID for the identifier.
      // This preserves type alias identity.
      const expression = TstsSyntax.Node_Expression(typeRef);
      const identifierDeclId =
        expression && TstsSyntax.IsIdentifier(expression)
          ? ctx.binding.resolveIdentifier(expression)
          : undefined;

      const implementedTypeDeclId =
        identifierDeclId ?? (expression ? ctx.binding.resolveTypeReference(typeRef) : undefined);

      // Check if it's a nominalized interface or type alias.
      if (
        isNominalizedInterface(implementedTypeDeclId, ctx.typeSystem) ||
        isNominalizedTypeAlias(implementedTypeDeclId, ctx.typeSystem)
      ) {
        // Tsonic supports `implements` in the TypeScript surface language. The
        // emitter is responsible for selecting a valid native representation.
        continue;
      }
    }
  }

  return diagnostics;
};

/**
 * Validate all class declarations in a source file
 */
export const validateClassImplements = (
  sourceFile: TstsSourceFile,
  ctx: ProgramContext
): readonly Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  visitTstsSubtree(sourceFile, (node) => {
    if (node && TstsSyntax.IsClassDeclaration(node)) {
      diagnostics.push(...validateClassDeclaration(node, ctx));
    }
  });
  return diagnostics;
};
