/**
 * Static Safety Validation Rules
 *
 * Contains the main validation visitor and rule implementations for:
 * - TSN7401: 'any' type usage
 * - TSN7403: Object literal without contextual nominal type
 * - TSN7405: Untyped function/arrow/lambda parameter
 * - TSN7413: Dictionary key must be string, number, or symbol
 * - TSN7419: 'never' cannot be used as a generic type argument
 * - TSN7430: Arrow function requires explicit types (escape hatch)
 * - TSN7432: Generic function value restrictions
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
  collectSupportedGenericFunctionValueSymbols,
  getSupportedGenericFunctionDeclarationSymbol,
  getSupportedGenericFunctionValueSymbol,
  isGenericFunctionDeclarationNode,
  isGenericFunctionValueNode,
} from "../generic-function-values.js";
import {
  checkBasicSynthesisEligibility,
  lambdaHasExpectedTypeContext,
  objectLiteralHasContextualType,
  isAllowedGenericFunctionValueIdentifierUse,
  getReferencedIdentifierSymbol,
} from "./contextual-type-analysis.js";

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
        const eligibility = checkBasicSynthesisEligibility(node, program);
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
                  "Dictionary key type must be 'string', 'number', or 'symbol'. Other key types are not supported.",
                  getNodeLocation(sourceFile, keyTypeNode),
                  "Use Record<string, V>, Record<number, V>, or Record<symbol, V>."
                )
              );
            }
          }
        }
      }
    }

    // TSN7413: Check for unsupported index signature key types
    // string, number, and symbol are allowed (matches TypeScript's PropertyKey constraint)
    if (ts.isIndexSignatureDeclaration(node)) {
      const keyParam = node.parameters[0];
      if (keyParam?.type && !isAllowedKeyType(keyParam.type)) {
        currentCollector = addDiagnostic(
          currentCollector,
          createDiagnostic(
            "TSN7413",
            "error",
            "Index signature key type must be 'string', 'number', or 'symbol'. Other key types are not supported.",
            getNodeLocation(sourceFile, keyParam.type),
            "Use { [key: string]: V }, { [key: number]: V }, or { [key: symbol]: V }."
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
    // Generic function values are supported for deterministic declaration/alias
    // forms that can be lowered to C# generic method declarations:
    // - direct generic function value declarations (`const` + never-reassigned `let`)
    // - direct generic function declarations (`function f<T>(...) { ... }`)
    // - deterministic alias declarations that point at supported symbols
    //   (`const` aliases + never-reassigned `let` aliases).
    // Non-deterministic or non-transpilable value-level usages remain hard errors.
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
            "Generic function values are only supported in deterministic declaration/alias forms that can lower to C# generic methods.",
            getNodeLocation(sourceFile, node),
            "Use `const f = <T>(...) => ...`, `let f = <T>(...) => ...` with no reassignments, or deterministic aliases like `const g = f`."
          )
        );
      }
    }

    if (isGenericFunctionDeclarationNode(node)) {
      const symbol = getSupportedGenericFunctionDeclarationSymbol(
        node,
        program.checker
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
            "Generic function declarations are only supported when their symbol remains deterministic in value positions and lowers to a C# generic method.",
            getNodeLocation(sourceFile, node),
            "Use a direct generic call (e.g., `f<T>(...)`) or deterministic const/never-reassigned let aliases."
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
            `Generic function value '${name}' is only supported in direct call or monomorphic callable-context position where lowering is deterministic.`,
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
 * Allowed: string, number, symbol (matches TypeScript's PropertyKey constraint)
 *
 * Note: TypeScript's Record<K, V> only allows K extends keyof any (string | number | symbol).
 * We support all three PropertyKey primitives.
 */
const isAllowedKeyType = (typeNode: ts.TypeNode): boolean => {
  // Direct keywords
  if (
    typeNode.kind === ts.SyntaxKind.StringKeyword ||
    typeNode.kind === ts.SyntaxKind.NumberKeyword ||
    typeNode.kind === ts.SyntaxKind.SymbolKeyword
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
      if (name === "string" || name === "number" || name === "symbol") {
        return true;
      }
    }
  }

  return false;
};

/**
 * TSN7430: Arrow function escape hatch validation.
 *
 * Arrow functions can infer types from context when a deterministic expected
 * callable type exists. Without contextual typing, only "simple arrows" are
 * allowed to rely on inference.
 *
 * Contextual arrows may use:
 * 1. Destructuring parameter patterns
 * 2. Default parameter initializers
 * 3. Rest parameters
 *
 * Non-contextual arrows must still satisfy the simple-arrow rule:
 * 1. Every parameter pattern is a simple identifier (no destructuring)
 * 2. No default initializers
 * 3. No rest parameters
 *
 * Notes:
 * - Async arrows CAN be contextually typed when expected types are available.
 * - Block-bodied arrows CAN be contextually typed when expected types are available.
 *
 * If an arrow has no deterministic contextual type and fails the simple-arrow
 * criteria, emit TSN7430.
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

  const hasExpectedType = lambdaHasExpectedTypeContext(node);

  if (hasExpectedType) {
    return collector;
  }

  // Determine if this is a "simple arrow"
  const simpleArrowResult = isSimpleArrow(node);

  // If it's a simple arrow shape, check for contextual type
  // DETERMINISTIC (INV-0): Uses AST-based contextual type detection, not getContextualType
  if (simpleArrowResult.isSimple) {
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
