/**
 * Static Safety Validation
 *
 * Detects patterns that violate static typing requirements:
 * - TSN7401: 'any' type usage
 * - TSN7403: Object literal without contextual nominal type
 * - TSN7405: Untyped function/arrow/lambda parameter
 * - TSN7406: Mapped types not supported (retired)
 * - TSN7407: Conditional types not supported (retired)
 * - TSN7408: Mixed variadic tuples not supported (retired)
 * - TSN7409: 'infer' keyword not supported (retired)
 * - TSN7410: Intersection types not supported (retired)
 * - TSN7413: Dictionary key must be string or number
 * - TSN7430: Arrow function requires explicit types (escape hatch)
 *
 * This ensures NativeAOT-compatible, predictable-performance output.
 *
 * Note: We intentionally do NOT validate JS built-in usage (arr.map, str.length)
 * or dictionary dot-access patterns. These will fail naturally in C# if used
 * incorrectly, which is an acceptable failure mode.
 */

import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";
import { getNodeLocation } from "./helpers.js";
import {
  collectWrittenSymbols,
  getSupportedGenericFunctionValueSymbol,
  isGenericFunctionValueNode,
} from "../generic-function-values.js";

/**
 * Result of basic eligibility check for object literal synthesis.
 */
type BasicEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * Check basic structural eligibility for object literal synthesis.
 *
 * This is a simplified check that doesn't require TypeSystem access.
 * It validates structural constraints (no computed keys, no method shorthand, etc.)
 * but does NOT validate spread type annotations (that requires TypeSystem).
 *
 * Full eligibility check happens during IR conversion.
 */
const checkBasicSynthesisEligibility = (
  node: ts.ObjectLiteralExpression
): BasicEligibilityResult => {
  for (const prop of node.properties) {
    // Property assignment: check key type
    if (ts.isPropertyAssignment(prop)) {
      if (ts.isComputedPropertyName(prop.name)) {
        // Computed key - check if it's a string literal
        const expr = prop.name.expression;
        if (!ts.isStringLiteral(expr)) {
          return {
            eligible: false,
            reason: `Computed property key is not a string literal`,
          };
        }
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
      // Basic check: spread source must be an identifier
      if (!ts.isIdentifier(prop.expression)) {
        return {
          eligible: false,
          reason: `Spread source must be a simple identifier (TSN5215)`,
        };
      }
      continue;
    }

    // Method declaration: reject (use arrow functions instead)
    if (ts.isMethodDeclaration(prop)) {
      return {
        eligible: false,
        reason: `Method shorthand is not supported. Use arrow function syntax: 'name: () => ...'`,
      };
    }

    // Getter/setter: reject
    if (
      ts.isGetAccessorDeclaration(prop) ||
      ts.isSetAccessorDeclaration(prop)
    ) {
      return {
        eligible: false,
        reason: `Getters and setters are not supported in synthesized types`,
      };
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
const lambdaHasExpectedTypeContext = (
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
    const arrayParent = parent.parent;
    if (ts.isVariableDeclaration(arrayParent) && arrayParent.type) {
      return true;
    }
    if (ts.isCallExpression(arrayParent) || ts.isNewExpression(arrayParent)) {
      return true;
    }
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

/**
 * Find the containing function declaration/expression for a node.
 */
const findContainingFunction = (
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
const objectLiteralHasContextualType = (
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
    const arrayParent = parent.parent;
    if (ts.isVariableDeclaration(arrayParent) && arrayParent.type) {
      return true;
    }
    if (ts.isCallExpression(arrayParent) || ts.isNewExpression(arrayParent)) {
      return true;
    }
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

const collectSupportedGenericFunctionValueSymbols = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  writtenSymbols: ReadonlySet<ts.Symbol>
): ReadonlySet<ts.Symbol> => {
  const symbols = new Set<ts.Symbol>();

  const collect = (node: ts.Node): void => {
    if (isGenericFunctionValueNode(node)) {
      const symbol = getSupportedGenericFunctionValueSymbol(
        node,
        checker,
        writtenSymbols
      );
      if (symbol) symbols.add(symbol);
    }
    ts.forEachChild(node, collect);
  };

  collect(sourceFile);
  return symbols;
};

const isAllowedGenericFunctionValueIdentifierUse = (
  node: ts.Identifier,
  checker: ts.TypeChecker
): boolean => {
  const parent = node.parent;

  if (ts.isVariableDeclaration(parent) && parent.name === node) return true;
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

const getReferencedIdentifierSymbol = (
  checker: ts.TypeChecker,
  node: ts.Identifier
): ts.Symbol | undefined => {
  const parent = node.parent;
  if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) {
    return checker.getShorthandAssignmentValueSymbol(parent) ?? undefined;
  }
  return checker.getSymbolAtLocation(node);
};

/**
 * Validate a source file for static safety violations.
 */
export const validateStaticSafety = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const writtenSymbols = collectWrittenSymbols(sourceFile, program.checker);
  const supportedGenericFunctionValueSymbols =
    collectSupportedGenericFunctionValueSymbols(
      sourceFile,
      program.checker,
      writtenSymbols
    );

  const visitor = (
    node: ts.Node,
    accCollector: DiagnosticsCollector
  ): DiagnosticsCollector => {
    let currentCollector = accCollector;

    // TSN7401: Check for explicit 'any' type annotations
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      currentCollector = addDiagnostic(
        currentCollector,
        createDiagnostic(
          "TSN7401",
          "error",
          "'any' type is not supported. Provide a concrete type, use 'unknown', or define a nominal type.",
          getNodeLocation(sourceFile, node),
          "Replace 'any' with a specific type like 'unknown', 'object', or a custom interface."
        )
      );
    }

    // TSN7401: Check for 'as any' type assertions
    if (
      ts.isAsExpression(node) &&
      node.type.kind === ts.SyntaxKind.AnyKeyword
    ) {
      currentCollector = addDiagnostic(
        currentCollector,
        createDiagnostic(
          "TSN7401",
          "error",
          "'as any' type assertion is not supported. Use a specific type assertion.",
          getNodeLocation(sourceFile, node),
          "Replace 'as any' with a specific type like 'as unknown' or 'as YourType'."
        )
      );
    }

    // TSN7405: Check for untyped function parameters
    // Covers: function declarations, methods, constructors, arrow functions, function expressions
    if (ts.isParameter(node) && !node.type) {
      const parent = node.parent;

      // For lambdas (arrow functions and function expressions), allow inference from context
      const isLambda =
        ts.isArrowFunction(parent) || ts.isFunctionExpression(parent);

      if (isLambda) {
        // DETERMINISTIC IR TYPING (INV-0 compliant):
        // Check if lambda is in a position where expected types provide parameter types.
        // This replaces the old getContextualType-based inference.
        const hasExpectedTypeContext = lambdaHasExpectedTypeContext(parent);

        if (hasExpectedTypeContext) {
          // Lambda is in a contextual position - converter will get types from expected type
        } else {
          // No expected type context - emit TSN7405
          const paramName = ts.isIdentifier(node.name)
            ? node.name.text
            : "param";
          currentCollector = addDiagnostic(
            currentCollector,
            createDiagnostic(
              "TSN7405",
              "error",
              `Parameter '${paramName}' must have an explicit type annotation.`,
              getNodeLocation(sourceFile, node),
              "Add a type annotation to this parameter, or use the lambda in a context that provides type inference (e.g., array.sort, array.map)."
            )
          );
        }
      } else {
        // For non-lambdas (function declarations, methods, constructors, accessors),
        // always require explicit type annotations
        const isFunctionLike =
          ts.isFunctionDeclaration(parent) ||
          ts.isMethodDeclaration(parent) ||
          ts.isConstructorDeclaration(parent) ||
          ts.isGetAccessorDeclaration(parent) ||
          ts.isSetAccessorDeclaration(parent);

        if (isFunctionLike) {
          const paramName = ts.isIdentifier(node.name)
            ? node.name.text
            : "param";
          currentCollector = addDiagnostic(
            currentCollector,
            createDiagnostic(
              "TSN7405",
              "error",
              `Parameter '${paramName}' must have an explicit type annotation.`,
              getNodeLocation(sourceFile, node),
              "Add a type annotation to this parameter."
            )
          );
        }
      }
    }

    // TSN7403: Check for object literals without contextual nominal type
    // Now supports auto-synthesis for eligible object literals (spreads, arrow props)
    // DETERMINISTIC (INV-0): Uses AST-based contextual type detection, not getContextualType
    if (ts.isObjectLiteralExpression(node)) {
      // Check if object literal has a contextual type using deterministic AST analysis
      const hasContextualType = objectLiteralHasContextualType(node);

      if (hasContextualType) {
        // Has contextual type - type checking will validate compatibility during IR conversion
      } else {
        // No contextual type - check basic synthesis eligibility
        // Full eligibility check (including spread type annotations) happens during IR conversion
        // when we have TypeSystem access.
        const eligibility = checkBasicSynthesisEligibility(node);
        if (!eligibility.eligible) {
          // Not eligible for synthesis - emit diagnostic with specific reason
          currentCollector = addDiagnostic(
            currentCollector,
            createDiagnostic(
              "TSN7403",
              "error",
              `Object literal cannot be synthesized: ${eligibility.reason}`,
              getNodeLocation(sourceFile, node),
              "Use an explicit type annotation, or restructure to use only identifier keys and arrow functions."
            )
          );
        }
        // If eligible, full synthesis check happens during IR conversion
      }
    }

    // Check TypeReferenceNode for utility types and dictionary keys
    if (ts.isTypeReferenceNode(node)) {
      const typeName = node.typeName;
      if (ts.isIdentifier(typeName)) {
        const name = typeName.text;
        const hasTypeArgs = node.typeArguments && node.typeArguments.length > 0;

        // TSN7419: 'never' cannot be used as a generic type argument.
        //
        // This is airplane-grade: CLR has no bottom type usable as a generic argument.
        // Allowing `Foo<never>` would either require inventing a fake CLR type or
        // emitting invalid C# (void is not a legal generic argument).
        if (
          hasTypeArgs &&
          node.typeArguments?.some((a) => a.kind === ts.SyntaxKind.NeverKeyword)
        ) {
          currentCollector = addDiagnostic(
            currentCollector,
            createDiagnostic(
              "TSN7419",
              "error",
              "'never' cannot be used as a generic type argument.",
              getNodeLocation(sourceFile, node),
              "Rewrite the type to avoid never. For Result-like types, model explicit variants (Ok<T> | Err<E>) and have helpers return the specific variant type."
            )
          );
        }

        // TSN7413: Record<K, V> where K is not an allowed key type
        if (name === "Record") {
          const typeArgs = node.typeArguments;
          const keyTypeNode = typeArgs?.[0];
          if (keyTypeNode !== undefined) {
            if (!isAllowedKeyType(keyTypeNode)) {
              currentCollector = addDiagnostic(
                currentCollector,
                createDiagnostic(
                  "TSN7413",
                  "error",
                  "Dictionary key type must be 'string' or 'number'. Other key types are not supported.",
                  getNodeLocation(sourceFile, keyTypeNode),
                  "Use Record<string, V> or Record<number, V>."
                )
              );
            }
          }
        }
      }
    }

    // TSN7413: Check for unsupported index signature key types
    // Only string and number are allowed (matches TypeScript's index signature constraints)
    if (ts.isIndexSignatureDeclaration(node)) {
      const keyParam = node.parameters[0];
      if (keyParam?.type && !isAllowedKeyType(keyParam.type)) {
        currentCollector = addDiagnostic(
          currentCollector,
          createDiagnostic(
            "TSN7413",
            "error",
            "Index signature key type must be 'string' or 'number'. Other key types are not supported.",
            getNodeLocation(sourceFile, keyParam.type),
            "Use { [key: string]: V } or { [key: number]: V }."
          )
        );
      }
    }

    // TSN7406 retired:
    // Mapped types are handled by type conversion + specialization.

    // TSN7407 retired:
    // Conditional types are handled by utility expansion and type conversion.

    // TSN7408 retired:
    // Mixed variadic tuples are now lowered to array types in the converter.

    // TSN7409 retired:
    // infer clauses are handled by conditional/type evaluator paths.

    // TSN7410 retired:
    // Intersection types are lowered by the type emitter.

    // TSN7416 retired:
    // new Array() without explicit type argument is lowered by the emitter.

    // TSN7417 retired:
    // Empty arrays are inferred/erased deterministically by array conversion rules.

    // TSN7432:
    // Generic function values are currently supported for `const` declarations
    // and `let` declarations that are never reassigned,
    // with identifier names and generic arrow/function-expression initializers.
    // Other declaration forms remain hard errors.
    if (isGenericFunctionValueNode(node)) {
      const symbol = getSupportedGenericFunctionValueSymbol(
        node,
        program.checker,
        writtenSymbols
      );
      const isSupported =
        symbol !== undefined &&
        supportedGenericFunctionValueSymbols.has(symbol);

      if (!isSupported) {
        currentCollector = addDiagnostic(
          currentCollector,
          createDiagnostic(
            "TSN7432",
            "error",
            "Generic arrow/functions as values are only supported for `const` or never-reassigned `let` identifier declarations.",
            getNodeLocation(sourceFile, node),
            "Use `const f = <T>(...) => ...`, or `let f = <T>(...) => ...` with no reassignments, or rewrite as a named generic function declaration."
          )
        );
      }
    }

    if (ts.isIdentifier(node)) {
      const symbol = getReferencedIdentifierSymbol(program.checker, node);
      if (
        symbol &&
        supportedGenericFunctionValueSymbols.has(symbol) &&
        !isAllowedGenericFunctionValueIdentifierUse(node, program.checker)
      ) {
        const name = node.text;
        currentCollector = addDiagnostic(
          currentCollector,
          createDiagnostic(
            "TSN7432",
            "error",
            `Generic function value '${name}' is only supported in direct call or monomorphic callable-context position.`,
            getNodeLocation(sourceFile, node),
            "Call the function directly (e.g., `name<T>(...)`), or use it where a concrete callable type is contextually known (e.g., function argument typed as `(x: number) => number`)."
          )
        );
      }
    }

    // TSN7430: Arrow function escape hatch validation
    // Non-simple arrows must have explicit type annotations
    if (ts.isArrowFunction(node)) {
      currentCollector = validateArrowEscapeHatch(
        node,
        sourceFile,
        program.checker,
        currentCollector
      );
    }

    // Continue visiting children
    ts.forEachChild(node, (child) => {
      currentCollector = visitor(child, currentCollector);
    });

    return currentCollector;
  };

  return visitor(sourceFile, collector);
};

/**
 * Check if a type node represents an allowed dictionary key type.
 * Allowed: string, number (matches TypeScript's PropertyKey constraint)
 *
 * Note: TypeScript's Record<K, V> only allows K extends keyof any (string | number | symbol).
 * We support string and number. Symbol is rejected via TSN7203.
 */
const isAllowedKeyType = (typeNode: ts.TypeNode): boolean => {
  // Direct keywords
  if (
    typeNode.kind === ts.SyntaxKind.StringKeyword ||
    typeNode.kind === ts.SyntaxKind.NumberKeyword
  ) {
    return true;
  }

  // String literal types (e.g., "a", "b")
  if (ts.isLiteralTypeNode(typeNode)) {
    const literal = typeNode.literal;
    if (
      ts.isStringLiteral(literal) ||
      ts.isNumericLiteral(literal) ||
      literal.kind === ts.SyntaxKind.NumericLiteral
    ) {
      return true;
    }
  }

  // Union types - all constituents must be allowed key types
  if (ts.isUnionTypeNode(typeNode)) {
    return typeNode.types.every((t) => isAllowedKeyType(t));
  }

  // Type reference to allowed types
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName;
    if (ts.isIdentifier(typeName)) {
      const name = typeName.text;
      if (name === "string" || name === "number") {
        return true;
      }
    }
  }

  return false;
};

/**
 * TSN7430: Arrow function escape hatch validation.
 *
 * Arrow functions can only infer types from context if they meet the
 * "simple arrow" criteria. Non-simple arrows must have explicit annotations.
 *
 * Simple Arrow Definition (per spec):
 * 1. Every parameter pattern is a simple identifier (no destructuring)
 * 2. No default initializers
 * 3. No rest parameters
 *
 * Notes:
 * - Async arrows CAN be contextually typed when expected types are available.
 * - Block-bodied arrows CAN be contextually typed when expected types are available.
 *
 * If an arrow fails ANY of these criteria AND doesn't have explicit types,
 * emit TSN7430.
 */
const validateArrowEscapeHatch = (
  node: ts.ArrowFunction,
  sourceFile: ts.SourceFile,
  _checker: ts.TypeChecker,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  // Check if arrow has explicit parameter types and return type
  const hasExplicitReturnType = node.type !== undefined;
  const allParamsExplicitlyTyped = node.parameters.every(
    (param) => param.type !== undefined
  );

  // If fully typed, no escape hatch validation needed
  if (hasExplicitReturnType && allParamsExplicitlyTyped) {
    return collector;
  }

  // Determine if this is a "simple arrow"
  const simpleArrowResult = isSimpleArrow(node);

  // If it's a simple arrow shape, check for contextual type
  // DETERMINISTIC (INV-0): Uses AST-based contextual type detection, not getContextualType
  if (simpleArrowResult.isSimple) {
    // Check if arrow has expected type context using deterministic AST analysis
    const hasExpectedType = lambdaHasExpectedTypeContext(node);

    if (hasExpectedType) {
      // Contextual type available - parameter inference will proceed during IR conversion
      // Parameter count validation is done in the IR conversion phase
      return collector;
    } else {
      // No contextual type available
      return addDiagnostic(
        collector,
        createDiagnostic(
          "TSN7430",
          "error",
          "Arrow function requires explicit types. No contextual type available for inference.",
          getNodeLocation(sourceFile, node),
          "Add explicit type annotations: (x: Type, y: Type): ReturnType => expression"
        )
      );
    }
  }

  // Not a simple arrow - emit escape hatch error with specific reason
  return addDiagnostic(
    collector,
    createDiagnostic(
      "TSN7430",
      "error",
      `Arrow function requires explicit types. ${simpleArrowResult.reason}`,
      getNodeLocation(sourceFile, node),
      "Only expression-bodied arrows with simple identifier parameters can infer types from context. Add explicit parameter and return type annotations."
    )
  );
};

/**
 * Check if an arrow function meets the "simple arrow" criteria for type inference.
 *
 * Returns { isSimple: true } if all criteria are met, or
 * { isSimple: false, reason: string } explaining why it's not simple.
 */
const isSimpleArrow = (
  node: ts.ArrowFunction
):
  | { readonly isSimple: true }
  | { readonly isSimple: false; readonly reason: string } => {
  // 1. All parameter patterns must be simple identifiers (no destructuring)
  for (const param of node.parameters) {
    if (!ts.isIdentifier(param.name)) {
      return {
        isSimple: false,
        reason:
          "Arrow functions with destructuring patterns require explicit type annotations.",
      };
    }
  }

  // 2. No default initializers
  for (const param of node.parameters) {
    if (param.initializer !== undefined) {
      return {
        isSimple: false,
        reason:
          "Arrow functions with default parameter values require explicit type annotations.",
      };
    }
  }

  // 3. No rest parameters
  for (const param of node.parameters) {
    if (param.dotDotDotToken !== undefined) {
      return {
        isSimple: false,
        reason:
          "Arrow functions with rest parameters require explicit type annotations.",
      };
    }
  }

  return { isSimple: true };
};
