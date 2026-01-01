/**
 * Static Safety Validation
 *
 * Detects patterns that violate static typing requirements:
 * - TSN7401: 'any' type usage
 * - TSN7403: Object literal without contextual nominal type
 * - TSN7405: Untyped function/arrow/lambda parameter
 * - TSN7406: Mapped types not supported
 * - TSN7407: Conditional types not supported
 * - TSN7408: Mixed variadic tuples not supported
 * - TSN7409: 'infer' keyword not supported
 * - TSN7410: Intersection types not supported
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
  UNSUPPORTED_MAPPED_UTILITY_TYPES,
  UNSUPPORTED_CONDITIONAL_UTILITY_TYPES,
} from "./unsupported-utility-types.js";
import { checkSynthesisEligibility } from "../ir/converters/anonymous-synthesis.js";

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

/**
 * Validate a source file for static safety violations.
 */
export const validateStaticSafety = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const { binding } = program;

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
        // No contextual type - check if eligible for synthesis
        const eligibility = checkSynthesisEligibility(node, binding);
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
        // If eligible, synthesis will happen during IR conversion
      }
    }

    // Check TypeReferenceNode for utility types and dictionary keys
    if (ts.isTypeReferenceNode(node)) {
      const typeName = node.typeName;
      if (ts.isIdentifier(typeName)) {
        const name = typeName.text;
        const hasTypeArgs = node.typeArguments && node.typeArguments.length > 0;

        // TSN7406: Mapped-type utility types (these expand to mapped types internally)
        // Only check when type arguments are present to avoid false positives for
        // user-defined types named "Partial", etc.
        if (hasTypeArgs && UNSUPPORTED_MAPPED_UTILITY_TYPES.has(name)) {
          currentCollector = addDiagnostic(
            currentCollector,
            createDiagnostic(
              "TSN7406",
              "error",
              `Utility type '${name}' is not supported (it uses mapped types internally).`,
              getNodeLocation(sourceFile, node),
              `Replace '${name}' with an explicit interface that has the desired properties.`
            )
          );
        }

        // TSN7407: Conditional-type utility types (these expand to conditional types internally)
        // Only check when type arguments are present
        if (hasTypeArgs && UNSUPPORTED_CONDITIONAL_UTILITY_TYPES.has(name)) {
          currentCollector = addDiagnostic(
            currentCollector,
            createDiagnostic(
              "TSN7407",
              "error",
              `Utility type '${name}' is not supported (it uses conditional types internally).`,
              getNodeLocation(sourceFile, node),
              `Replace '${name}' with an explicit type definition.`
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

    // TSN7406: Check for mapped types (e.g., { [P in keyof T]: ... })
    if (ts.isMappedTypeNode(node)) {
      currentCollector = addDiagnostic(
        currentCollector,
        createDiagnostic(
          "TSN7406",
          "error",
          "Mapped types are not supported. Write an explicit interface or class instead.",
          getNodeLocation(sourceFile, node),
          "Replace mapped types like Partial<T>, Required<T>, or { [P in keyof T]: ... } with explicit interface definitions."
        )
      );
    }

    // TSN7407: Check for conditional types (e.g., T extends U ? X : Y)
    if (ts.isConditionalTypeNode(node)) {
      currentCollector = addDiagnostic(
        currentCollector,
        createDiagnostic(
          "TSN7407",
          "error",
          "Conditional types are not supported. Use explicit union types or overloads instead.",
          getNodeLocation(sourceFile, node),
          "Replace conditional types like Extract<T, U> or T extends X ? Y : Z with explicit type definitions."
        )
      );
    }

    // TSN7408: Check for variadic tuple types with mixed elements (e.g., [string, ...number[]])
    // Pure variadic tuples like [...T[]] are OK (converted to arrays), fixed tuples are OK
    // Mixed tuples with both fixed and rest elements are not supported
    if (ts.isTupleTypeNode(node)) {
      const hasRest = node.elements.some((el) => ts.isRestTypeNode(el));
      const hasFixed = node.elements.some((el) => !ts.isRestTypeNode(el));

      if (hasRest && hasFixed) {
        currentCollector = addDiagnostic(
          currentCollector,
          createDiagnostic(
            "TSN7408",
            "error",
            "Variadic tuple types with mixed fixed and rest elements are not supported.",
            getNodeLocation(sourceFile, node),
            "Use a fixed-length tuple like [T1, T2] or an array like T[] instead."
          )
        );
      }
    }

    // TSN7409: Check for 'infer' keyword in conditional types
    if (ts.isInferTypeNode(node)) {
      currentCollector = addDiagnostic(
        currentCollector,
        createDiagnostic(
          "TSN7409",
          "error",
          "The 'infer' keyword is not supported. Use explicit type parameters instead.",
          getNodeLocation(sourceFile, node),
          "Replace infer patterns with explicit generic type parameters."
        )
      );
    }

    // TSN7410: Check for intersection types (e.g., A & B)
    if (ts.isIntersectionTypeNode(node)) {
      currentCollector = addDiagnostic(
        currentCollector,
        createDiagnostic(
          "TSN7410",
          "error",
          "Intersection types (A & B) are not supported. Use a nominal type that explicitly includes all required members.",
          getNodeLocation(sourceFile, node),
          "Replace the intersection with an interface or class that combines the members, or a type alias to an object type with explicit members."
        )
      );
    }

    // TSN7416: Check for new Array() without explicit type argument
    // new Array<T>(n) is valid, new Array() or new Array(n) without type arg is not
    if (ts.isNewExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && callee.text === "Array") {
        const hasTypeArgs = node.typeArguments && node.typeArguments.length > 0;
        if (!hasTypeArgs) {
          currentCollector = addDiagnostic(
            currentCollector,
            createDiagnostic(
              "TSN7416",
              "error",
              "'new Array()' requires an explicit type argument. Use 'new Array<T>(size)' instead.",
              getNodeLocation(sourceFile, node),
              "Add a type argument: new Array<int>(10), new Array<string>(5), etc."
            )
          );
        }
      }
    }

    // TSN7417: Check for empty array literal without type annotation
    // const x = [] is invalid, const x: T[] = [] is valid
    if (ts.isArrayLiteralExpression(node) && node.elements.length === 0) {
      // Check if parent provides type context
      const parent = node.parent;
      const hasTypeAnnotation =
        (ts.isVariableDeclaration(parent) && parent.type !== undefined) ||
        (ts.isPropertyDeclaration(parent) && parent.type !== undefined) ||
        (ts.isParameter(parent) && parent.type !== undefined) ||
        ts.isReturnStatement(parent) || // return type from function
        ts.isCallExpression(parent) || // passed as argument (has contextual type)
        ts.isPropertyAssignment(parent); // object property (has contextual type)

      if (!hasTypeAnnotation) {
        currentCollector = addDiagnostic(
          currentCollector,
          createDiagnostic(
            "TSN7417",
            "error",
            "Empty array literal requires a type annotation. Use 'const x: T[] = []' instead.",
            getNodeLocation(sourceFile, node),
            "Add a type annotation: const x: number[] = []; or const x: string[] = [];"
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
 * 1. isAsync === false
 * 2. Body is an expression (not a block) - block bodies ALWAYS require explicit return type
 * 3. Every parameter pattern is a simple identifier (no destructuring)
 * 4. No default initializers
 * 5. No rest parameters
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
  // 1. Not async
  if (node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
    return {
      isSimple: false,
      reason: "Async arrow functions require explicit type annotations.",
    };
  }

  // 2. Body must be an expression (not a block)
  // Block bodies ALWAYS require explicit return type annotation
  if (ts.isBlock(node.body)) {
    return {
      isSimple: false,
      reason:
        "Block-bodied arrow functions require explicit return type annotation.",
    };
  }

  // 3. All parameter patterns must be simple identifiers (no destructuring)
  for (const param of node.parameters) {
    if (!ts.isIdentifier(param.name)) {
      return {
        isSimple: false,
        reason:
          "Arrow functions with destructuring patterns require explicit type annotations.",
      };
    }
  }

  // 4. No default initializers
  for (const param of node.parameters) {
    if (param.initializer !== undefined) {
      return {
        isSimple: false,
        reason:
          "Arrow functions with default parameter values require explicit type annotations.",
      };
    }
  }

  // 5. No rest parameters
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
