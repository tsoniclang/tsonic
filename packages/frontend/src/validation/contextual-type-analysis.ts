/**
 * Contextual Type Analysis for Static Safety
 *
 * Provides AST-based contextual type detection helpers used by the
 * static safety validator. These functions determine whether expressions
 * (lambdas, object literals, array literals) are in positions where
 * expected types provide type inference context.
 *
 * Also includes synthesis eligibility checks for object literals and
 * generic function value identifier analysis.
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import { getUnsupportedObjectLiteralMethodRuntimeReason } from "../object-literal-method-runtime.js";

/**
 * Result of basic eligibility check for object literal synthesis.
 */
export type BasicEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * Check basic structural eligibility for object literal synthesis.
 *
 * This is a simplified check that doesn't require TypeSystem access.
 * It validates structural constraints (no non-deterministic computed keys,
 * no dynamic receiver method shorthand, etc.)
 * but does NOT validate spread type annotations (that requires TypeSystem).
 *
 * Full eligibility check happens during IR conversion.
 */
export const checkBasicSynthesisEligibility = (
  node: ts.ObjectLiteralExpression,
  program: TsonicProgram
): BasicEligibilityResult => {
  const unwrapDeterministicKeyExpression = (
    expr: ts.Expression
  ): ts.Expression => {
    let current = expr;
    for (;;) {
      if (ts.isParenthesizedExpression(current)) {
        current = current.expression;
        continue;
      }
      if (
        ts.isAsExpression(current) ||
        ts.isTypeAssertionExpression(current) ||
        ts.isSatisfiesExpression(current)
      ) {
        current = current.expression;
        continue;
      }
      return current;
    }
  };

  const tryResolveDeterministicComputedKeyName = (
    name: ts.PropertyName,
    seenSymbols = new Set<ts.Symbol>()
  ): string | undefined => {
    if (
      ts.isIdentifier(name) ||
      ts.isStringLiteral(name) ||
      ts.isNoSubstitutionTemplateLiteral(name) ||
      ts.isNumericLiteral(name)
    ) {
      return String(name.text);
    }

    if (!ts.isComputedPropertyName(name)) {
      return undefined;
    }

    const expr = unwrapDeterministicKeyExpression(name.expression);
    if (
      ts.isStringLiteral(expr) ||
      ts.isNoSubstitutionTemplateLiteral(expr) ||
      ts.isNumericLiteral(expr)
    ) {
      return String(expr.text);
    }

    if (!ts.isIdentifier(expr)) {
      return undefined;
    }

    const symbol = program.checker.getSymbolAtLocation(expr);
    if (!symbol || seenSymbols.has(symbol)) {
      return undefined;
    }

    seenSymbols.add(symbol);
    const declarations = symbol.getDeclarations() ?? [];
    for (const decl of declarations) {
      if (
        ts.isImportSpecifier(decl) ||
        ts.isNamespaceImport(decl) ||
        ts.isImportClause(decl)
      ) {
        const aliasSymbol = program.checker.getAliasedSymbol(symbol);
        if (!aliasSymbol || seenSymbols.has(aliasSymbol)) continue;
        seenSymbols.add(aliasSymbol);
        for (const aliasedDecl of aliasSymbol.getDeclarations() ?? []) {
          if (
            ts.isVariableDeclaration(aliasedDecl) &&
            aliasedDecl.initializer &&
            ts.isVariableDeclarationList(aliasedDecl.parent)
          ) {
            const flags = aliasedDecl.parent.flags;
            if ((flags & ts.NodeFlags.Const) !== 0) {
              const resolved = tryResolveDeterministicComputedKeyName(
                ts.factory.createComputedPropertyName(aliasedDecl.initializer),
                seenSymbols
              );
              if (resolved !== undefined) return resolved;
            }
          }
        }
        continue;
      }

      if (
        ts.isVariableDeclaration(decl) &&
        decl.initializer &&
        ts.isVariableDeclarationList(decl.parent)
      ) {
        const flags = decl.parent.flags;
        if ((flags & ts.NodeFlags.Const) === 0) continue;
        const resolved = tryResolveDeterministicComputedKeyName(
          ts.factory.createComputedPropertyName(decl.initializer),
          seenSymbols
        );
        if (resolved !== undefined) return resolved;
      }
    }

    return undefined;
  };

  for (const prop of node.properties) {
    // Property assignment: check key type
    if (ts.isPropertyAssignment(prop)) {
      if (tryResolveDeterministicComputedKeyName(prop.name) === undefined) {
        return {
          eligible: false,
          reason:
            "Computed property key is not a deterministically known string/number literal",
        };
      }
      // Check for symbol keys
      if (ts.isPrivateIdentifier(prop.name)) {
        return {
          eligible: false,
          reason: `Private identifier (symbol) keys are not supported`,
        };
      }
    }

    // Shorthand property: always ok (identifier key)
    if (ts.isShorthandPropertyAssignment(prop)) {
      continue;
    }

    // Spread: allow for now, full check happens during IR conversion
    if (ts.isSpreadAssignment(prop)) {
      continue;
    }

    // Method declarations are valid as long as they avoid unsupported runtime
    // features. `this` is supported via object-literal method binding.
    if (ts.isMethodDeclaration(prop)) {
      if (tryResolveDeterministicComputedKeyName(prop.name) === undefined) {
        return {
          eligible: false,
          reason:
            "Computed property key is not a deterministically known string/number literal",
        };
      }
      if (ts.isPrivateIdentifier(prop.name)) {
        return {
          eligible: false,
          reason: `Private identifier (symbol) keys are not supported`,
        };
      }
      const unsupportedRuntimeReason =
        getUnsupportedObjectLiteralMethodRuntimeReason(prop);
      if (unsupportedRuntimeReason) {
        return {
          eligible: false,
          reason: unsupportedRuntimeReason,
        };
      }
      continue;
    }

    // Getter/setter: allowed for synthesized object types
    if (
      ts.isGetAccessorDeclaration(prop) ||
      ts.isSetAccessorDeclaration(prop)
    ) {
      if (tryResolveDeterministicComputedKeyName(prop.name) === undefined) {
        return {
          eligible: false,
          reason:
            "Computed property key is not a deterministically known string/number literal",
        };
      }
      continue;
    }
  }

  return { eligible: true };
};

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
  // e.g., nums.sort((a, b) => a - b) or apply((x) => x * 2, 5)
  if (ts.isCallExpression(parent)) {
    return true;
  }

  // Case 2: Lambda is a new expression argument
  // e.g., new Promise((resolve) => resolve())
  if (ts.isNewExpression(parent)) {
    return true;
  }

  // Case 3: Lambda is assigned to a typed variable
  // e.g., const fn: (x: number) => number = (x) => x + 1
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
  // e.g., const ops: OperationMap = { add: (a, b) => a + b }
  if (
    ts.isPropertyAssignment(parent) &&
    ts.isObjectLiteralExpression(parent.parent)
  ) {
    const grandparent = parent.parent.parent;
    // Check if the object literal is assigned to a typed variable
    if (ts.isVariableDeclaration(grandparent) && grandparent.type) {
      return true;
    }
    // Check if the object literal is a call argument
    if (ts.isCallExpression(grandparent) || ts.isNewExpression(grandparent)) {
      return true;
    }
  }

  // Case 6: Lambda is an array element where the array has a type
  // e.g., const ops: Operation[] = [(a, b) => a + b]
  if (ts.isArrayLiteralExpression(parent)) {
    return arrayLiteralHasContextualType(parent);
  }

  // Case 7: Lambda is the expression body of another arrow function
  // e.g., () => () => "deeply nested" — the inner arrow is the body of the outer
  // If the outer arrow has:
  //   a) an explicit return type annotation, OR
  //   b) expected-type context itself
  // then the inner arrow has contextual type from the outer's expected return type.
  if (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) {
    // Check if this lambda IS the body of the parent (not just a subexpression)
    if (parent.body === lambda) {
      // Parent has explicit return type → inner has context
      if (parent.type) {
        return true;
      }
      // Parent itself has expected-type context → inner has context
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
 *
 * This replaces checker.getContextualType with AST analysis.
 * Expected types are propagated from:
 * 1. Variable initializers - the variable's type annotation provides the expected type
 * 2. Call arguments - the callee's parameter type provides the expected type
 * 3. New expression arguments - the constructor's parameter type provides the expected type
 * 4. Return statements - the function's return type provides the expected type
 * 5. Property assignments - the parent object's contextual type provides the expected type
 */
export const objectLiteralHasContextualType = (
  node: ts.ObjectLiteralExpression
): boolean => {
  const parent = node.parent;

  // Case 1: Object is assigned to a typed variable
  // e.g., const user: User = { name: "Alice" }
  if (ts.isVariableDeclaration(parent) && parent.type) {
    return true;
  }

  // Case 2: Object is a call argument
  // e.g., createUser({ name: "Alice" })
  if (ts.isCallExpression(parent)) {
    return true;
  }

  // Case 3: Object is a new expression argument
  // e.g., new User({ name: "Alice" })
  if (ts.isNewExpression(parent)) {
    return true;
  }

  // Case 4: Object is in a return statement in a function with return type
  if (ts.isReturnStatement(parent)) {
    const containingFunction = findContainingFunction(parent);
    if (containingFunction && containingFunction.type) {
      return true;
    }
  }

  // Case 5: Object is a property value in another object that has contextual type
  // e.g., const config: Config = { nested: { value: 1 } }
  if (
    ts.isPropertyAssignment(parent) &&
    ts.isObjectLiteralExpression(parent.parent)
  ) {
    return objectLiteralHasContextualType(parent.parent);
  }

  // Case 6: Object is an array element where the array has a type
  // e.g., const users: User[] = [{ name: "Alice" }]
  if (ts.isArrayLiteralExpression(parent)) {
    return arrayLiteralHasContextualType(parent);
  }

  // Case 7: Object is in an as-expression (type assertion)
  // e.g., { name: "Alice" } as User
  if (ts.isAsExpression(parent) && parent.type) {
    return true;
  }

  // Case 8: Object is in a satisfies expression
  // e.g., { name: "Alice" } satisfies User
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
