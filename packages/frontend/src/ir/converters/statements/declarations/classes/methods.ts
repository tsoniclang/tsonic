/**
 * Method member conversion
 */

import * as ts from "typescript";
import { IrClassMember } from "../../../../types.js";
import { convertBlockStatement } from "../../control.js";
import {
  hasStaticModifier,
  getAccessibility,
  convertTypeParameters,
  convertParameters,
} from "../../helpers.js";
import { detectOverride } from "./override-detection.js";
import { getTypeSystem } from "../registry.js";
import type { Binding } from "../../../../binding/index.js";

/**
 * DETERMINISTIC: Convert a TypeNode to a string for signature matching.
 * Uses only AST structure, not TypeScript's type inference.
 */
const typeNodeToSignatureString = (typeNode: ts.TypeNode): string => {
  // Handle type references: Foo, List<T>, etc.
  if (ts.isTypeReferenceNode(typeNode)) {
    // EntityName is Identifier | QualifiedName - handle both
    const name = ts.isIdentifier(typeNode.typeName)
      ? typeNode.typeName.text
      : typeNode.typeName.right.text; // QualifiedName: get rightmost identifier
    return name;
  }

  // Handle keyword types
  switch (typeNode.kind) {
    case ts.SyntaxKind.NumberKeyword:
      return "number";
    case ts.SyntaxKind.StringKeyword:
      return "string";
    case ts.SyntaxKind.BooleanKeyword:
      return "boolean";
    case ts.SyntaxKind.VoidKeyword:
      return "void";
    case ts.SyntaxKind.AnyKeyword:
      return "any";
    case ts.SyntaxKind.UnknownKeyword:
      return "unknown";
    case ts.SyntaxKind.NeverKeyword:
      return "never";
    case ts.SyntaxKind.ObjectKeyword:
      return "object";
    case ts.SyntaxKind.SymbolKeyword:
      return "symbol";
    case ts.SyntaxKind.BigIntKeyword:
      return "bigint";
    case ts.SyntaxKind.UndefinedKeyword:
      return "undefined";
    case ts.SyntaxKind.NullKeyword:
      return "null";
  }

  // Handle array types: T[]
  if (ts.isArrayTypeNode(typeNode)) {
    return `${typeNodeToSignatureString(typeNode.elementType)}[]`;
  }

  // For other complex types, fall back to any
  return "any";
};

/**
 * Convert method declaration to IR
 */
export const convertMethod = (
  node: ts.MethodDeclaration,
  binding: Binding,
  superClass: ts.ExpressionWithTypeArguments | undefined
): IrClassMember => {
  const memberName = ts.isIdentifier(node.name) ? node.name.text : "[computed]";

  // DETERMINISTIC: Extract parameter types directly from TypeNodes
  const parameterTypes = node.parameters.map((param) => {
    if (param.type) {
      return typeNodeToSignatureString(param.type);
    }
    return "any";
  });

  const overrideInfo = detectOverride(
    memberName,
    "method",
    superClass,
    binding,
    parameterTypes
  );

  // Get return type from declared annotation for contextual typing
  // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
  const typeSystem = getTypeSystem();
  const returnType =
    node.type && typeSystem
      ? typeSystem.typeFromSyntax(binding.captureTypeSyntax(node.type))
      : undefined;

  return {
    kind: "methodDeclaration",
    name: memberName,
    typeParameters: convertTypeParameters(node.typeParameters, binding),
    parameters: convertParameters(node.parameters, binding),
    returnType,
    // Pass return type to body for contextual typing of return statements
    body: node.body
      ? convertBlockStatement(node.body, binding, returnType)
      : undefined,
    isStatic: hasStaticModifier(node),
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    isGenerator: !!node.asteriskToken,
    accessibility: getAccessibility(node),
    isOverride: overrideInfo.isOverride ? true : undefined,
    isShadow: overrideInfo.isShadow ? true : undefined,
  };
};
