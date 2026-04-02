/**
 * Static Safety Validation Rules
 *
 * Contains the main validation visitor and rule implementations for:
 * - TSN7401: 'any' type usage
 * - TSN7402: 'unknown' type usage outside erased overload stubs
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
import { isAllowedKeyType } from "./static-safety-dictionary-keys.js";
import { validateArrowEscapeHatch } from "./static-safety-arrow-rules.js";

const getNamedMemberName = (
  name: ts.PropertyName | ts.PrivateIdentifier | undefined
): string | undefined => {
  if (!name) {
    return undefined;
  }

  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) {
    return name.text;
  }

  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return undefined;
};

const nodeIsWithin = (node: ts.Node, container: ts.Node | undefined): boolean =>
  !!container && node.pos >= container.pos && node.end <= container.end;

const isOverloadStubImplementation = (
  node: ts.FunctionDeclaration | ts.MethodDeclaration
): boolean => {
  if (!node.body) {
    return false;
  }

  if (ts.isFunctionDeclaration(node)) {
    if (!node.name || !node.parent || !ts.isSourceFile(node.parent)) {
      return false;
    }

    return node.parent.statements.some(
      (statement) =>
        ts.isFunctionDeclaration(statement) &&
        statement !== node &&
        statement.name?.text === node.name?.text &&
        !statement.body
    );
  }

  if (!node.parent || !ts.isClassLike(node.parent)) {
    return false;
  }

  const memberName = getNamedMemberName(node.name);
  if (!memberName) {
    return false;
  }

  return node.parent.members.some(
    (member) =>
      ts.isMethodDeclaration(member) &&
      member !== node &&
      getNamedMemberName(member.name) === memberName &&
      !member.body
  );
};

const isInsideOverloadStubSignatureType = (node: ts.Node): boolean => {
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (!ts.isFunctionDeclaration(current) && !ts.isMethodDeclaration(current)) {
      continue;
    }

    if (!isOverloadStubImplementation(current)) {
      return false;
    }

    if (nodeIsWithin(node, current.type)) {
      return true;
    }

    return current.parameters.some((parameter) => nodeIsWithin(node, parameter.type));
  }

  return false;
};

const getAssertionTargetTypeNode = (node: ts.Node): ts.TypeNode | undefined => {
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    return node.type;
  }
  return undefined;
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

    const isBroadOverloadStubType = isInsideOverloadStubSignatureType(node);

    // TSN7401: Check for explicit 'any' type annotations
    if (node.kind === ts.SyntaxKind.AnyKeyword && !isBroadOverloadStubType) {
      currentCollector = addDiagnostic(
        currentCollector,
        createDiagnostic(
          "TSN7401",
          "error",
          "'any' type is not supported. Provide a concrete type, or use a broad overload stub signature that is erased before emission.",
          getNodeLocation(sourceFile, node),
          "Replace 'any' with a specific type, or keep it only on an erased overload stub implementation signature."
        )
      );
    }

    // TSN7402: Check for explicit 'unknown' type annotations
    if (
      node.kind === ts.SyntaxKind.UnknownKeyword &&
      !isBroadOverloadStubType
    ) {
      currentCollector = addDiagnostic(
        currentCollector,
        createDiagnostic(
          "TSN7402",
          "error",
          "'unknown' type is not supported. Provide a concrete type, use JsValue, or keep it only on an erased overload stub implementation signature.",
          getNodeLocation(sourceFile, node),
          "Replace 'unknown' with a specific type or JsValue, or keep it only on an erased overload stub implementation signature."
        )
      );
    }

    // TSN7401/TSN7402: Check for broad type assertions
    const assertionTargetType = getAssertionTargetTypeNode(node);
    if (assertionTargetType?.kind === ts.SyntaxKind.AnyKeyword) {
      currentCollector = addDiagnostic(
        currentCollector,
        createDiagnostic(
          "TSN7401",
          "error",
          "'any' type assertion is not supported. Use a specific type assertion.",
          getNodeLocation(sourceFile, node),
          "Replace this assertion with a specific type like 'as object' or 'as YourType'."
        )
      );
    }

    if (assertionTargetType?.kind === ts.SyntaxKind.UnknownKeyword) {
      currentCollector = addDiagnostic(
        currentCollector,
        createDiagnostic(
          "TSN7402",
          "error",
          "'unknown' type assertion is not supported. Use a specific type assertion or JsValue.",
          getNodeLocation(sourceFile, node),
          "Replace this assertion with a specific type or JsValue."
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
