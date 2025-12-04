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
 * - TSN7413: Dictionary key must be string type
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
import { inferLambdaParamTypes } from "../ir/type-converter/index.js";
import {
  UNSUPPORTED_MAPPED_UTILITY_TYPES,
  UNSUPPORTED_CONDITIONAL_UTILITY_TYPES,
} from "./unsupported-utility-types.js";

/**
 * Validate a source file for static safety violations.
 */
export const validateStaticSafety = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const checker = program.checker;

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
        // Try contextual signature inference
        const inference = inferLambdaParamTypes(parent, checker);
        const paramIndex = parent.parameters.indexOf(
          node as ts.ParameterDeclaration
        );

        // If inference succeeded for this parameter, don't emit TSN7405
        if (inference && inference.paramTypes[paramIndex] !== undefined) {
          // Inference succeeded - no error needed
        } else {
          // Inference failed - emit TSN7405
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
    if (ts.isObjectLiteralExpression(node)) {
      const contextualType = checker.getContextualType(node);

      // Must have a contextual type that resolves to a nominal type or dictionary
      if (
        !contextualType ||
        !isNominalOrDictionaryType(contextualType, checker)
      ) {
        currentCollector = addDiagnostic(
          currentCollector,
          createDiagnostic(
            "TSN7403",
            "error",
            "Object literal requires a contextual nominal type (interface, type alias, or class). Anonymous object types are not supported.",
            getNodeLocation(sourceFile, node),
            "Add a type annotation like 'const x: MyInterface = { ... }' or define an interface/type alias."
          )
        );
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

        // TSN7413: Record<K, V> where K is not string
        if (name === "Record") {
          const typeArgs = node.typeArguments;
          const keyTypeNode = typeArgs?.[0];
          if (keyTypeNode !== undefined) {
            if (!isStringKeyType(keyTypeNode)) {
              currentCollector = addDiagnostic(
                currentCollector,
                createDiagnostic(
                  "TSN7413",
                  "error",
                  "Dictionary key type must be 'string'. Non-string key types are not supported for NativeAOT compatibility.",
                  getNodeLocation(sourceFile, keyTypeNode),
                  "Use Record<string, V> instead of Record<number, V> or other key types."
                )
              );
            }
          }
        }
      }
    }

    // TSN7413: Check for non-string index signatures
    // { [k: number]: V } is not allowed
    if (ts.isIndexSignatureDeclaration(node)) {
      const keyParam = node.parameters[0];
      if (keyParam?.type && !isStringKeyType(keyParam.type)) {
        currentCollector = addDiagnostic(
          currentCollector,
          createDiagnostic(
            "TSN7413",
            "error",
            "Index signature key type must be 'string'. Non-string key types are not supported for NativeAOT compatibility.",
            getNodeLocation(sourceFile, keyParam.type),
            "Use { [key: string]: V } instead of { [key: number]: V }."
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

    // Continue visiting children
    ts.forEachChild(node, (child) => {
      currentCollector = visitor(child, currentCollector);
    });

    return currentCollector;
  };

  return visitor(sourceFile, collector);
};

/**
 * Check if a contextual type is a nominal type (interface, type alias, class)
 * or a dictionary type that we can emit.
 *
 * Returns false for anonymous object types like `{ x: number }` without a name.
 *
 * Special case: Union types defined via type aliases (e.g., Result<T, E> = { ok: true; value: T } | {...})
 * are considered nominal because we generate synthetic interfaces for them during IR building.
 */
const isNominalOrDictionaryType = (
  type: ts.Type,
  checker: ts.TypeChecker
): boolean => {
  // Check if it's a dictionary type (Record<K,V> or index signature)
  if (isTsDictionaryType(type)) {
    return true;
  }

  // Check if the type has an aliasSymbol (used via a type alias)
  // This catches: type Result = { ok: true } | { ok: false }
  // where the union was defined via a type alias
  if (type.aliasSymbol) {
    const aliasDecl = type.aliasSymbol.getDeclarations()?.[0];
    if (aliasDecl && ts.isTypeAliasDeclaration(aliasDecl)) {
      return true;
    }
  }

  // Check if the type has a symbol with a declaration (named type)
  const symbol = type.getSymbol();
  if (symbol) {
    const declarations = symbol.getDeclarations();
    const decl = declarations?.[0];
    if (decl !== undefined) {
      // Accept: interface, type alias, class
      if (
        ts.isInterfaceDeclaration(decl) ||
        ts.isTypeAliasDeclaration(decl) ||
        ts.isClassDeclaration(decl)
      ) {
        return true;
      }
    }
  }

  // Check for union types with aliasSymbol (discriminated unions via type alias)
  // This handles: return { ok: true, value } where return type is Result<T,E>
  if (type.isUnion()) {
    // Check if this union was created from a type alias
    if (type.aliasSymbol) {
      return true;
    }
  }

  // Check for primitive types (allowed)
  if (
    type.flags & ts.TypeFlags.String ||
    type.flags & ts.TypeFlags.Number ||
    type.flags & ts.TypeFlags.Boolean ||
    type.flags & ts.TypeFlags.Null ||
    type.flags & ts.TypeFlags.Undefined ||
    type.flags & ts.TypeFlags.Void
  ) {
    return true;
  }

  // Check for array types (allowed)
  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    return true;
  }

  return false;
};

/**
 * Check if a type is a TS dictionary type (Record<K,V> or index signature).
 *
 * TS dictionary types:
 * - Record<string, T> → has aliasSymbol named "Record"
 * - { [k: string]: T } → has string index signature
 */
const isTsDictionaryType = (type: ts.Type): boolean => {
  // Check for Record<K,V> utility type
  if (type.aliasSymbol?.name === "Record") {
    return true;
  }

  // Check for index signature type like { [k: string]: T }
  const stringIndexType = type.getStringIndexType();
  const numberIndexType = type.getNumberIndexType();

  return !!(stringIndexType || numberIndexType);
};

/**
 * Check if a type node represents a string key type.
 * Only `string` keyword is allowed for dictionary keys.
 */
const isStringKeyType = (typeNode: ts.TypeNode): boolean => {
  // Direct string keyword
  if (typeNode.kind === ts.SyntaxKind.StringKeyword) {
    return true;
  }

  // Type reference to "string"
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName;
    if (ts.isIdentifier(typeName) && typeName.text === "string") {
      return true;
    }
  }

  return false;
};
