/**
 * Contextual Type Checks & Identifier Analysis
 *
 * AST-based contextual type detection helpers for lambdas, object literals,
 * and array literals. Also includes generic function value identifier
 * analysis and symbol resolution utilities.
 */

import * as ts from "typescript";

/**
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Check if a lambda is in a position where expected types provide parameter types.
 *
 * This replaces the old getContextualType-based inference with AST analysis.
 * Expected types are propagated from:
 * 1. Call arguments - the callee's parameter type provides the expected type
 * 2. Variable initializers - the variable's type annotation provides the expected type
 * 3. New expression arguments - the constructor's parameter type provides the expected type
 * 4. Return statements - the function's return type provides the expected type
 * 5. Property assignments - the object's contextual type provides the expected type
 * 6. Nested arrow functions - body of another arrow that has expected context
 */
export const lambdaHasExpectedTypeContext = (
  lambda: ts.ArrowFunction | ts.FunctionExpression
): boolean => {
  const parent = lambda.parent;

  // Case 1: Lambda is a call argument
  if (ts.isCallExpression(parent)) {
    return true;
  }

  // Case 2: Lambda is a new expression argument
  if (ts.isNewExpression(parent)) {
    return true;
  }

  // Case 3: Lambda is assigned to a typed variable
  if (ts.isVariableDeclaration(parent) && parent.type) {
    return true;
  }

  // Case 4: Lambda is in a return statement in a function with return type
  if (ts.isReturnStatement(parent)) {
    const containingFunction = findContainingFunction(parent);
    if (containingFunction && containingFunction.type) {
      return true;
    }
  }

  // Case 5: Lambda is a property value where the object has contextual type
  if (
    ts.isPropertyAssignment(parent) &&
    ts.isObjectLiteralExpression(parent.parent)
  ) {
    const grandparent = parent.parent.parent;
    if (ts.isVariableDeclaration(grandparent) && grandparent.type) {
      return true;
    }
    if (ts.isCallExpression(grandparent) || ts.isNewExpression(grandparent)) {
      return true;
    }
  }

  // Case 6: Lambda is an array element where the array has a type
  if (ts.isArrayLiteralExpression(parent)) {
    return arrayLiteralHasContextualType(parent);
  }

  // Case 7: Lambda is the expression body of another arrow function
  if (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) {
    if (parent.body === lambda) {
      if (parent.type) {
        return true;
      }
      if (lambdaHasExpectedTypeContext(parent)) {
        return true;
      }
    }
  }

  return false;
};

export const arrayLiteralHasContextualType = (
  node: ts.ArrayLiteralExpression
): boolean => {
  const parent = node.parent;

  if (ts.isVariableDeclaration(parent) && parent.type) {
    return true;
  }

  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
    return true;
  }

  if (ts.isReturnStatement(parent)) {
    const containingFunction = findContainingFunction(parent);
    if (containingFunction && containingFunction.type) {
      return true;
    }
  }

  if (ts.isArrayLiteralExpression(parent)) {
    return arrayLiteralHasContextualType(parent);
  }

  if (
    ts.isPropertyAssignment(parent) &&
    ts.isObjectLiteralExpression(parent.parent)
  ) {
    return objectLiteralHasContextualType(parent.parent);
  }

  if (ts.isAsExpression(parent) && parent.type) {
    return true;
  }

  if (ts.isSatisfiesExpression(parent) && parent.type) {
    return true;
  }

  return false;
};

/**
 * Find the containing function declaration/expression for a node.
 */
export const findContainingFunction = (
  node: ts.Node
): ts.FunctionLikeDeclaration | undefined => {
  let current = node.parent;
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current)
    ) {
      return current;
    }
    current = current.parent;
  }
  return undefined;
};

/**
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Check if an object literal is in a position where expected types are available.
 */
export const objectLiteralHasContextualType = (
  node: ts.ObjectLiteralExpression
): boolean => {
  const parent = node.parent;

  if (ts.isVariableDeclaration(parent) && parent.type) {
    return true;
  }

  if (ts.isCallExpression(parent)) {
    return true;
  }

  if (ts.isNewExpression(parent)) {
    return true;
  }

  if (ts.isReturnStatement(parent)) {
    const containingFunction = findContainingFunction(parent);
    if (containingFunction && containingFunction.type) {
      return true;
    }
  }

  if (
    ts.isPropertyAssignment(parent) &&
    ts.isObjectLiteralExpression(parent.parent)
  ) {
    return objectLiteralHasContextualType(parent.parent);
  }

  if (ts.isArrayLiteralExpression(parent)) {
    return arrayLiteralHasContextualType(parent);
  }

  if (ts.isAsExpression(parent) && parent.type) {
    return true;
  }

  if (ts.isSatisfiesExpression(parent) && parent.type) {
    return true;
  }

  return false;
};

export const isAllowedGenericFunctionValueIdentifierUse = (
  node: ts.Identifier,
  checker: ts.TypeChecker
): boolean => {
  const parent = node.parent;

  if (ts.isFunctionDeclaration(parent) && parent.name === node) return true;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return true;
  if (ts.isImportSpecifier(parent) && parent.name === node) return true;
  if (
    ts.isVariableDeclaration(parent) &&
    parent.initializer === node &&
    ts.isIdentifier(parent.name)
  ) {
    const declarationList = parent.parent;
    if (ts.isVariableDeclarationList(declarationList)) {
      const isConst = (declarationList.flags & ts.NodeFlags.Const) !== 0;
      const isLet = (declarationList.flags & ts.NodeFlags.Let) !== 0;
      if (isConst || isLet) return true;
    }
  }
  if (ts.isCallExpression(parent) && parent.expression === node) return true;
  if (ts.isTypeQueryNode(parent) && parent.exprName === node) return true;
  if (ts.isExportSpecifier(parent)) return true;
  if (ts.isExportAssignment(parent) && parent.expression === node) return true;

  const contextualType = checker.getContextualType(node);
  if (contextualType) {
    const isNullishOnly = (type: ts.Type): boolean => {
      const flags = type.getFlags();
      return (
        (flags &
          (ts.TypeFlags.Null |
            ts.TypeFlags.Undefined |
            ts.TypeFlags.Void |
            ts.TypeFlags.Never)) !==
        0
      );
    };

    const isMonomorphicCallableType = (type: ts.Type): boolean => {
      if (type.isUnion()) {
        return type.types.every(
          (member) => isNullishOnly(member) || isMonomorphicCallableType(member)
        );
      }

      if (type.isIntersection()) {
        return type.types.every((member) => isMonomorphicCallableType(member));
      }

      const signatures = checker.getSignaturesOfType(
        type,
        ts.SignatureKind.Call
      );
      if (signatures.length === 0) return false;
      return signatures.every(
        (sig) => !sig.typeParameters || sig.typeParameters.length === 0
      );
    };

    if (isMonomorphicCallableType(contextualType)) return true;
  }

  return false;
};

export const getReferencedIdentifierSymbol = (
  checker: ts.TypeChecker,
  node: ts.Identifier
): ts.Symbol | undefined => {
  const parent = node.parent;
  if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) {
    return checker.getShorthandAssignmentValueSymbol(parent) ?? undefined;
  }
  return checker.getSymbolAtLocation(node);
};
