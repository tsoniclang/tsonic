/**
 * Generic type validation
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";
import { checkForSymbolIndexSignature } from "../ir/generic-validator.js";

/**
 * Check if a type node is a null or undefined literal type
 */
const isNullishType = (typeNode: ts.TypeNode): boolean =>
  typeNode.kind === ts.SyntaxKind.NullKeyword ||
  typeNode.kind === ts.SyntaxKind.UndefinedKeyword ||
  (ts.isLiteralTypeNode(typeNode) &&
    (typeNode.literal.kind === ts.SyntaxKind.NullKeyword ||
      typeNode.literal.kind === ts.SyntaxKind.UndefinedKeyword));

/**
 * Check if a type node references a type parameter.
 * Returns the type parameter name if it does, undefined otherwise.
 */
const getTypeParameterReference = (
  typeNode: ts.TypeNode
): string | undefined => {
  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
    return typeNode.typeName.text;
  }
  return undefined;
};

/**
 * Get the set of type parameter names in scope for a node.
 * Walks up the tree to find enclosing generic declarations.
 */
const getTypeParametersInScope = (node: ts.Node): Set<string> => {
  const params = new Set<string>();
  let current: ts.Node | undefined = node;

  while (current) {
    // Check for type parameters on various declaration types
    if (
      (ts.isInterfaceDeclaration(current) ||
        ts.isClassDeclaration(current) ||
        ts.isTypeAliasDeclaration(current) ||
        ts.isFunctionDeclaration(current) ||
        ts.isMethodDeclaration(current) ||
        ts.isArrowFunction(current) ||
        ts.isFunctionExpression(current)) &&
      current.typeParameters
    ) {
      for (const tp of current.typeParameters) {
        params.add(tp.name.text);
      }
    }
    current = current.parent;
  }

  return params;
};

/**
 * Check for nullable unions with unconstrained generic type parameters.
 * Pattern: T | null where T is an unconstrained type parameter.
 *
 * This is unsupported because C# cannot represent nullable unconstrained generics:
 * - For value types, T? requires `where T : struct` to become Nullable<T>
 * - Without constraints, T? for a value type is just T (non-nullable)
 *
 * Returns a diagnostic if the pattern is detected, undefined otherwise.
 */
const checkNullableGenericUnion = (
  typeNode: ts.TypeNode,
  sourceFile: ts.SourceFile
): ReturnType<typeof createDiagnostic> | undefined => {
  if (!ts.isUnionTypeNode(typeNode)) {
    return undefined;
  }

  // Check if union contains null or undefined
  const hasNullish = typeNode.types.some(isNullishType);
  if (!hasNullish) {
    return undefined;
  }

  // Check if any non-nullish type is a type parameter reference
  const typeParamsInScope = getTypeParametersInScope(typeNode);
  const nonNullishTypes = typeNode.types.filter((t) => !isNullishType(t));

  for (const memberType of nonNullishTypes) {
    const typeParamName = getTypeParameterReference(memberType);
    if (typeParamName && typeParamsInScope.has(typeParamName)) {
      // Found a nullable union with a type parameter
      const start = typeNode.getStart(sourceFile);
      const end = typeNode.getEnd();
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);

      return createDiagnostic(
        "TSN7415",
        "error",
        `Nullable union '${typeNode.getText(sourceFile)}' with unconstrained generic type parameter '${typeParamName}' cannot be represented in C#. ` +
          `Use 'object | null' for nullable generic values, or constrain the type parameter.`,
        {
          file: sourceFile.fileName,
          line: line + 1,
          column: character,
          length: end - start,
        },
        `In C#, T? for an unconstrained type parameter T does not provide nullability for value types. ` +
          `Either use 'object | null' to box the value, or if T is always a reference type, this is a limitation.`
      );
    }
  }

  return undefined;
};

/**
 * Validate generic types and constraints
 */
export const validateGenerics = (
  sourceFile: ts.SourceFile,
  _program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  // Debug: log when validation runs
  if (process.env.DEBUG_GENERICS) {
    console.log(`[validateGenerics] Checking: ${sourceFile.fileName}`);
  }

  const visitor = (node: ts.Node): void => {
    // Only check for truly unsupported features (no static C# mapping)
    // Symbol index signatures - TSN7203
    if (ts.isIndexSignatureDeclaration(node)) {
      const symbolDiag = checkForSymbolIndexSignature(node, sourceFile);
      if (symbolDiag) {
        collector = addDiagnostic(collector, symbolDiag);
      }
    }

    // Check for nullable unions with unconstrained generic type parameters - TSN7415
    // This covers property signatures, variable declarations, function parameters, etc.
    if (ts.isTypeNode(node)) {
      const nullableGenericDiag = checkNullableGenericUnion(node, sourceFile);
      if (nullableGenericDiag) {
        collector = addDiagnostic(collector, nullableGenericDiag);
      }
    }

    // Explicitly visit interface and type literal members
    if (ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node)) {
      for (const member of node.members) {
        visitor(member);
      }
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return collector;
};
