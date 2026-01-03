/**
 * IR builder validation - checks for unsupported patterns
 *
 * Phase 5 Step 4: Uses ProgramContext instead of global singletons.
 */

import * as ts from "typescript";
import { Diagnostic } from "../../types/diagnostic.js";
import type { ProgramContext } from "../program-context.js";
import type { DeclId } from "../type-system/types.js";
import type { TypeAuthority } from "../type-system/type-system.js";
import type { Binding } from "../binding/index.js";

/**
 * Check if a type reference is the struct marker
 * (used to mark types as C# value types)
 * ALICE'S SPEC: Uses TypeSystem for symbol resolution.
 */
const isStructMarker = (
  typeRef: ts.ExpressionWithTypeArguments,
  binding: Binding,
  typeSystem: TypeAuthority
): boolean => {
  if (!ts.isIdentifier(typeRef.expression)) {
    return false;
  }
  const declId = binding.resolveIdentifier(typeRef.expression);
  if (!declId) {
    return false;
  }

  const fqName = typeSystem.getFQNameOfDecl(declId);
  return fqName === "struct" || fqName === "Struct";
};

/**
 * Check if a declaration represents a TypeScript interface
 * (which Tsonic nominalizes to a C# class)
 * ALICE'S SPEC: Uses TypeSystem.isInterfaceDecl()
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
 * (which Tsonic nominalizes to a C# class)
 * ALICE'S SPEC: Uses TypeSystem.isTypeAliasToObjectLiteral()
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
    // Skip the struct marker - it's a special pattern for value types
    if (isStructMarker(typeRef, ctx.binding, ctx.typeSystem)) {
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
      // Tsonic supports `implements` in the TypeScript surface language even when the
      // nominal type is emitted as a C# class or interface. The emitter is responsible
      // for selecting a valid C# representation.
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
