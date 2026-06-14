/**
 * Contextual Type Checks & Identifier Analysis
 *
 * TSTS syntax-based contextual type detection helpers for lambdas, object
 * literals, and array literals. Also includes generic function value
 * identifier analysis and symbol resolution utilities.
 */

import type { TstsNode } from "@tsonic/tsts";
import { TstsSyntax } from "@tsonic/tsts";
import type { TstsFrontendSourceSemanticView } from "../source-frontend/index.js";
import {
  getNodeBody,
  getNodeExpression,
  getNodeInitializer,
  getNodeType,
  getNodeTypeParameters,
  getTypeArguments,
  identifierText,
  getVariableDeclarationListKind,
  isIdentifier,
  nodeParent,
  type SourceSymbol,
  type SourceType,
} from "./tsts-helpers.js";

const isFunctionWithReturnTypeContext = (node: TstsNode): boolean => {
  const containingFunction = findContainingFunction(node);
  return containingFunction ? getNodeType(containingFunction) !== undefined : false;
};

export const lambdaHasExpectedTypeContext = (lambda: TstsNode): boolean => {
  let parent = nodeParent(lambda);
  while (parent?.Kind === TstsSyntax.KindParenthesizedExpression) {
    parent = nodeParent(parent);
  }

  if (
    parent?.Kind === TstsSyntax.KindCallExpression ||
    parent?.Kind === TstsSyntax.KindNewExpression
  ) {
    return true;
  }

  if (
    parent?.Kind === TstsSyntax.KindVariableDeclaration &&
    getNodeType(parent) !== undefined
  ) {
    return true;
  }

  if (
    parent?.Kind === TstsSyntax.KindSatisfiesExpression &&
    getNodeType(parent) !== undefined
  ) {
    return true;
  }

  if (
    parent?.Kind === TstsSyntax.KindReturnStatement &&
    isFunctionWithReturnTypeContext(parent)
  ) {
    return true;
  }

  if (
    parent?.Kind === TstsSyntax.KindPropertyAssignment &&
    parent.Parent?.Kind === TstsSyntax.KindObjectLiteralExpression
  ) {
    return objectLiteralHasContextualType(parent.Parent);
  }

  if (parent?.Kind === TstsSyntax.KindArrayLiteralExpression) {
    return arrayLiteralHasContextualType(parent);
  }

  if (
    parent?.Kind === TstsSyntax.KindArrowFunction ||
    parent?.Kind === TstsSyntax.KindFunctionExpression
  ) {
    if (getNodeBody(parent) === lambda) {
      return (
        getNodeType(parent) !== undefined || lambdaHasExpectedTypeContext(parent)
      );
    }
  }

  return false;
};

export const arrayLiteralHasContextualType = (node: TstsNode): boolean => {
  const parent = nodeParent(node);

  if (
    parent?.Kind === TstsSyntax.KindVariableDeclaration &&
    getNodeType(parent) !== undefined
  ) {
    return true;
  }

  if (
    parent?.Kind === TstsSyntax.KindCallExpression ||
    parent?.Kind === TstsSyntax.KindNewExpression
  ) {
    return true;
  }

  if (
    parent?.Kind === TstsSyntax.KindReturnStatement &&
    isFunctionWithReturnTypeContext(parent)
  ) {
    return true;
  }

  if (parent?.Kind === TstsSyntax.KindArrayLiteralExpression) {
    return arrayLiteralHasContextualType(parent);
  }

  if (
    parent?.Kind === TstsSyntax.KindPropertyAssignment &&
    parent.Parent?.Kind === TstsSyntax.KindObjectLiteralExpression
  ) {
    return objectLiteralHasContextualType(parent.Parent);
  }

  if (
    (parent?.Kind === TstsSyntax.KindAsExpression ||
      parent?.Kind === TstsSyntax.KindSatisfiesExpression) &&
    getNodeType(parent) !== undefined
  ) {
    return true;
  }

  return false;
};

export const findContainingFunction = (
  node: TstsNode
): TstsNode | undefined => {
  let current = nodeParent(node);
  while (current !== undefined) {
    if (
      current.Kind === TstsSyntax.KindFunctionDeclaration ||
      current.Kind === TstsSyntax.KindMethodDeclaration ||
      current.Kind === TstsSyntax.KindArrowFunction ||
      current.Kind === TstsSyntax.KindFunctionExpression
    ) {
      return current;
    }
    current = nodeParent(current);
  }
  return undefined;
};

const isBroadObjectLiteralContextType = (typeNode: TstsNode): boolean => {
  if (
    typeNode.Kind === TstsSyntax.KindObjectKeyword ||
    typeNode.Kind === TstsSyntax.KindUnknownKeyword ||
    typeNode.Kind === TstsSyntax.KindAnyKeyword
  ) {
    return true;
  }

  if (typeNode.Kind === TstsSyntax.KindParenthesizedType) {
    const inner = getNodeType(typeNode);
    return inner ? isBroadObjectLiteralContextType(inner) : false;
  }

  if (typeNode.Kind === TstsSyntax.KindUnionType) {
    return (
      TstsSyntax.AsUnionTypeNode(typeNode)?.Types?.Nodes.some((member) =>
        member ? isBroadObjectLiteralContextType(member) : false
      ) ?? false
    );
  }

  return false;
};

export const objectLiteralHasBroadContextualType = (
  node: TstsNode
): boolean => {
  const parent = nodeParent(node);

  if (parent?.Kind === TstsSyntax.KindVariableDeclaration) {
    const type = getNodeType(parent);
    return type ? isBroadObjectLiteralContextType(type) : false;
  }

  if (parent?.Kind === TstsSyntax.KindReturnStatement) {
    const containingFunction = findContainingFunction(parent);
    const type = containingFunction ? getNodeType(containingFunction) : undefined;
    return type ? isBroadObjectLiteralContextType(type) : false;
  }

  if (
    parent?.Kind === TstsSyntax.KindAsExpression ||
    parent?.Kind === TstsSyntax.KindSatisfiesExpression
  ) {
    const type = getNodeType(parent);
    return type ? isBroadObjectLiteralContextType(type) : false;
  }

  return false;
};

export const objectLiteralHasContextualType = (node: TstsNode): boolean => {
  const parent = nodeParent(node);

  if (parent?.Kind === TstsSyntax.KindVariableDeclaration) {
    const type = getNodeType(parent);
    return type !== undefined && !isBroadObjectLiteralContextType(type);
  }

  if (
    parent?.Kind === TstsSyntax.KindCallExpression ||
    parent?.Kind === TstsSyntax.KindNewExpression
  ) {
    return true;
  }

  if (parent?.Kind === TstsSyntax.KindReturnStatement) {
    const containingFunction = findContainingFunction(parent);
    const type = containingFunction ? getNodeType(containingFunction) : undefined;
    return type !== undefined && !isBroadObjectLiteralContextType(type);
  }

  if (
    parent?.Kind === TstsSyntax.KindPropertyAssignment &&
    parent.Parent?.Kind === TstsSyntax.KindObjectLiteralExpression
  ) {
    return objectLiteralHasContextualType(parent.Parent);
  }

  if (parent?.Kind === TstsSyntax.KindArrayLiteralExpression) {
    return arrayLiteralHasContextualType(parent);
  }

  if (
    parent?.Kind === TstsSyntax.KindAsExpression ||
    parent?.Kind === TstsSyntax.KindSatisfiesExpression
  ) {
    const type = getNodeType(parent);
    return type !== undefined && !isBroadObjectLiteralContextType(type);
  }

  return false;
};

export const isAllowedGenericFunctionValueIdentifierUse = (
  node: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView
): boolean => {
  const parent = nodeParent(node);

  if (
    parent?.Kind === TstsSyntax.KindFunctionDeclaration &&
    TstsSyntax.Node_Name(parent) === node
  ) {
    return true;
  }
  if (
    parent?.Kind === TstsSyntax.KindVariableDeclaration &&
    TstsSyntax.Node_Name(parent) === node
  ) {
    return true;
  }
  if (
    parent?.Kind === TstsSyntax.KindImportSpecifier &&
    TstsSyntax.Node_Name(parent) === node
  ) {
    return true;
  }
  if (
    parent?.Kind === TstsSyntax.KindVariableDeclaration &&
    getNodeInitializer(parent) === node &&
    isIdentifier(TstsSyntax.Node_Name(parent))
  ) {
    if (getVariableDeclarationListKind(parent)) {
      return true;
    }
  }
  if (
    parent?.Kind === TstsSyntax.KindCallExpression &&
    getNodeExpression(parent) === node
  ) {
    return true;
  }
  if (
    parent?.Kind === TstsSyntax.KindTypeQuery &&
    TstsSyntax.AsTypeQueryNode(parent)?.ExprName === node
  ) {
    return true;
  }
  if (parent?.Kind === TstsSyntax.KindExportSpecifier) {
    return true;
  }
  if (
    parent?.Kind === TstsSyntax.KindExportAssignment &&
    TstsSyntax.AsExportAssignment(parent)?.Expression === node
  ) {
    return true;
  }

  const contextualType = sourceSemantics.getContextualType(node);
  if (contextualType) {
    const isNullishOnly = (type: SourceType): boolean =>
      sourceSemantics.isNullishVoidOrNeverType(type);

    const isMonomorphicCallableType = (type: SourceType): boolean => {
      const unionMembers = sourceSemantics.getUnionMembers(type);
      if (unionMembers) {
        return unionMembers.every(
          (member) => isNullishOnly(member) || isMonomorphicCallableType(member)
        );
      }

      const intersectionMembers = sourceSemantics.getIntersectionMembers(type);
      if (intersectionMembers) {
        return intersectionMembers.every((member) =>
          isMonomorphicCallableType(member)
        );
      }

      const signatures = sourceSemantics.getCallSignatures(type);
      if (signatures.length === 0) return false;
      return signatures.every(
        (signature) => !sourceSemantics.signatureHasTypeParameters(signature)
      );
    };

    if (isMonomorphicCallableType(contextualType)) return true;
  }

  return hasMonomorphicArrayElementContext(node, sourceSemantics);
};

const hasMonomorphicArrayElementContext = (
  node: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView
): boolean => {
  const parent = nodeParent(node);
  if (parent?.Kind !== TstsSyntax.KindArrayLiteralExpression) {
    return false;
  }

  const arrayContext = sourceSemantics.getContextualType(parent);
  if (!arrayContext) {
    return false;
  }

  const directElementType = sourceSemantics.getElementTypeOfArrayType(
    arrayContext
  );
  if (directElementType) {
    return sourceSemantics.getCallSignatures(directElementType).every(
      (signature) => !sourceSemantics.signatureHasTypeParameters(signature)
    );
  }

  const arrayContextTypeNode = sourceSemantics.typeToTypeNode(
    arrayContext,
    parent,
    0
  );
  const elementTypeNode = getArrayElementTypeNode(arrayContextTypeNode);
  return isMonomorphicCallableTypeNode(elementTypeNode);
};

const getArrayElementTypeNode = (
  typeNode: TstsNode | undefined
): TstsNode | undefined => {
  if (!typeNode) {
    return undefined;
  }

  if (TstsSyntax.IsArrayTypeNode(typeNode)) {
    return TstsSyntax.AsArrayTypeNode(typeNode)?.ElementType;
  }

  if (!TstsSyntax.IsTypeReferenceNode(typeNode)) {
    return undefined;
  }

  const typeReference = TstsSyntax.AsTypeReferenceNode(typeNode);
  const typeName = identifierText(typeReference?.TypeName);
  if (typeName !== "Array" && typeName !== "ReadonlyArray") {
    return undefined;
  }

  return getTypeArguments(typeNode)[0];
};

const isMonomorphicCallableTypeNode = (
  typeNode: TstsNode | undefined
): boolean => {
  if (!typeNode) {
    return false;
  }

  if (TstsSyntax.IsParenthesizedTypeNode(typeNode)) {
    return isMonomorphicCallableTypeNode(getNodeType(typeNode));
  }

  if (TstsSyntax.IsFunctionTypeNode(typeNode)) {
    return getNodeTypeParameters(typeNode).length === 0;
  }

  if (TstsSyntax.IsUnionTypeNode(typeNode)) {
    return (
      TstsSyntax.AsUnionTypeNode(typeNode)?.Types?.Nodes.every((member) =>
        isNullishTypeNode(member) || isMonomorphicCallableTypeNode(member)
      ) ?? false
    );
  }

  if (TstsSyntax.IsIntersectionTypeNode(typeNode)) {
    return (
      TstsSyntax.AsIntersectionTypeNode(typeNode)?.Types?.Nodes.every((member) =>
        isMonomorphicCallableTypeNode(member)
      ) ?? false
    );
  }

  return false;
};

const isNullishTypeNode = (typeNode: TstsNode | undefined): boolean =>
  typeNode?.Kind === TstsSyntax.KindNullKeyword ||
  typeNode?.Kind === TstsSyntax.KindUndefinedKeyword ||
  typeNode?.Kind === TstsSyntax.KindVoidKeyword ||
  typeNode?.Kind === TstsSyntax.KindNeverKeyword;

export const getReferencedIdentifierSymbol = (
  sourceSemantics: TstsFrontendSourceSemanticView,
  node: TstsNode
): SourceSymbol | undefined => {
  const parent = nodeParent(node);
  if (
    parent?.Kind === TstsSyntax.KindShorthandPropertyAssignment &&
    TstsSyntax.Node_Name(parent) === node
  ) {
    return sourceSemantics.getShorthandAssignmentValueSymbol(parent);
  }
  return sourceSemantics.getSymbol(node);
};
