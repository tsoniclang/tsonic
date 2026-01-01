/**
 * Call and new expression converters
 *
 * ALICE'S SPEC: All call resolution goes through TypeSystem.resolveCall().
 * NO FALLBACKS ALLOWED. If TypeSystem can't resolve, return unknownType.
 */

import * as ts from "typescript";
import {
  IrCallExpression,
  IrNewExpression,
  IrTryCastExpression,
} from "../../types.js";
import {
  getSourceSpan,
  extractTypeArguments,
  checkIfRequiresSpecialization,
} from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import { convertType } from "../../type-converter.js";
import { IrType } from "../../types.js";
import { getTypeSystem } from "../statements/declarations/registry.js";
import type { Binding } from "../../binding/index.js";

/**
 * Extract argument passing modes from resolved signature.
 * Returns array aligned with arguments, indicating ref/out/in/value for each.
 *
 * ALICE'S SPEC: Uses TypeSystem to get parameter modes.
 * Parameter modes were normalized in Binding at registration time.
 */
const extractArgumentPassing = (
  node: ts.CallExpression | ts.NewExpression,
  binding: Binding
): readonly ("value" | "ref" | "out" | "in")[] | undefined => {
  // Get the TypeSystem
  const typeSystem = getTypeSystem();
  if (!typeSystem) return undefined;

  // Handle both CallExpression and NewExpression
  const sigId = ts.isCallExpression(node)
    ? binding.resolveCallSignature(node)
    : binding.resolveConstructorSignature(node);
  if (!sigId) return undefined;

  // Use TypeSystem.resolveCall() to get parameter modes
  const resolved = typeSystem.resolveCall({
    sigId,
    argumentCount: ts.isCallExpression(node)
      ? node.arguments.length
      : (node.arguments?.length ?? 0),
  });

  // Return parameter modes from TypeSystem (already normalized in Binding)
  return resolved.parameterModes;
};

/**
 * Extract type predicate narrowing metadata from a call expression.
 * Returns narrowing info if the callee is a type predicate function (x is T).
 *
 * ALICE'S SPEC: Uses TypeSystem.resolveCall() which includes typePredicate
 * extracted at Binding registration time.
 */
const extractNarrowing = (
  node: ts.CallExpression,
  binding: Binding
): IrCallExpression["narrowing"] => {
  // Get the TypeSystem
  const typeSystem = getTypeSystem();
  if (!typeSystem) return undefined;

  const sigId = binding.resolveCallSignature(node);
  if (!sigId) return undefined;

  // Use TypeSystem.resolveCall() to get type predicate
  const resolved = typeSystem.resolveCall({
    sigId,
    argumentCount: node.arguments.length,
  });

  // Check if resolved has a type predicate
  const pred = resolved.typePredicate;
  if (!pred) return undefined;

  // We only handle "param is T" predicates for call narrowing
  if (pred.kind === "param") {
    return {
      kind: "typePredicate",
      argIndex: pred.parameterIndex,
      targetType: pred.targetType,
    };
  }

  // "this is T" predicates are not applicable to call expressions
  return undefined;
};


/**
 * Extract parameter types from resolved signature.
 * Used for threading expectedType to array literal arguments etc.
 *
 * ALICE'S SPEC: Uses TypeSystem.resolveCall() exclusively.
 * TypeSystem is total - it always returns correct-arity arrays (filled with
 * unknownType on failure). No fallback paths.
 *
 * @param node - Call or new expression
 * @param binding - Binding layer for symbol resolution
 * @param receiverIrType - IR type of the receiver (for member method calls)
 */
const extractParameterTypes = (
  node: ts.CallExpression | ts.NewExpression,
  binding: Binding,
  receiverIrType?: IrType
): readonly (IrType | undefined)[] | undefined => {
  // Get the TypeSystem - required for all call resolution
  const typeSystem = getTypeSystem();
  if (!typeSystem) return undefined;

  // Handle both CallExpression and NewExpression
  const sigId = ts.isCallExpression(node)
    ? binding.resolveCallSignature(node)
    : binding.resolveConstructorSignature(node);
  if (!sigId) return undefined;

  // Extract explicit type arguments from call site if any
  const explicitTypeArgs =
    node.typeArguments?.map((ta) => convertType(ta, binding)) ?? undefined;

  // Get argument count for totality
  const argumentCount = ts.isCallExpression(node)
    ? node.arguments.length
    : (node.arguments?.length ?? 0);

  // Use TypeSystem.resolveCall() - guaranteed to return correct-arity result
  const resolved = typeSystem.resolveCall({
    sigId,
    argumentCount,
    receiverType: receiverIrType,
    explicitTypeArgs,
  });

  // TypeSystem.resolveCall() always returns parameterTypes with correct arity
  // (filled with unknownType on failure). Return directly - no fallback.
  return resolved.parameterTypes;
};

/**
 * Get the declared return type from a call or new expression's signature.
 *
 * This function extracts the return type from the **signature declaration's TypeNode**,
 * NOT from TypeScript's inferred type. This is critical for preserving CLR type aliases.
 *
 * For generic methods, type parameters are substituted using the receiver's type arguments.
 * For example: `dict.get(key)` where `dict: Dictionary<int, Todo>` returns `Todo | undefined`,
 * not `TValue | undefined`.
 *
 * Returns undefined if:
 * - No signature found
 * - No declaration on signature
 * - No return type annotation on declaration
 */
// DELETED: getReturnTypeFromFunctionType - Was part of fallback path
// DELETED: getCalleesDeclaredType - Was part of fallback path
// Alice's spec: TypeSystem.resolveCall() is the single source of truth.

/**
 * Walk a property access chain and build a qualified name.
 * For `Foo.Bar.Baz`, returns "Foo.Bar.Baz" by walking the AST identifiers.
 * This avoids getText() which bakes source formatting into type identity.
 */
const buildQualifiedName = (expr: ts.Expression): string | undefined => {
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }

  if (ts.isPropertyAccessExpression(expr)) {
    const parts: string[] = [];
    let current: ts.Expression = expr;

    while (ts.isPropertyAccessExpression(current)) {
      parts.unshift(current.name.text);
      current = current.expression;
    }

    if (ts.isIdentifier(current)) {
      parts.unshift(current.text);
      return parts.join(".");
    }
  }

  return undefined;
};

// DELETED: getDeclaredReturnTypeFallback - Alice's spec: no fallbacks allowed
// TypeSystem.resolveCall() is the single source of truth.

// DELETED: normalizeReceiverToNominal - No longer needed without NominalEnv fallback
// DELETED: getDeclaredReturnTypeNominalEnvFallback - Alice's spec: no fallbacks allowed
// TypeSystem.resolveCall() is the single source of truth.

/**
 * Get the declared return type from a call or new expression's signature.
 *
 * ALICE'S SPEC: Uses TypeSystem.resolveCall() EXCLUSIVELY.
 * NO FALLBACKS. If TypeSystem can't resolve, return unknownType.
 * This ensures any missing TypeSystem functionality surfaces as test failures.
 */
export const getDeclaredReturnType = (
  node: ts.CallExpression | ts.NewExpression,
  binding: Binding,
  receiverIrType?: IrType
): IrType | undefined => {
  const DEBUG = process.env.DEBUG_RETURN_TYPE === "1";
  const methodName = ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
    ? node.expression.name.text
    : undefined;
  if (DEBUG && methodName) {
    console.log("[getDeclaredReturnType]", methodName, "receiver:", receiverIrType);
  }

  // Handle new expressions specially - they construct the type from the expression
  if (ts.isNewExpression(node)) {
    // For new expressions with explicit type arguments
    if (node.typeArguments && node.typeArguments.length > 0) {
      const typeName = buildQualifiedName(node.expression);
      if (typeName) {
        return {
          kind: "referenceType",
          name: typeName,
          typeArguments: node.typeArguments.map((ta) =>
            convertType(ta, binding)
          ),
        };
      }
    }
    // For constructors without type arguments, use the class name
    const typeName = buildQualifiedName(node.expression);
    if (typeName) {
      return { kind: "referenceType", name: typeName };
    }
    return undefined;
  }

  // For call expressions, use TypeSystem.resolveCall() EXCLUSIVELY
  const typeSystem = getTypeSystem();
  if (!typeSystem) {
    if (DEBUG && methodName) console.log("[getDeclaredReturnType]", methodName, "No TypeSystem available");
    return undefined;
  }

  const sigId = binding.resolveCallSignature(node);
  if (!sigId) {
    if (DEBUG && methodName) console.log("[getDeclaredReturnType]", methodName, "No signature resolved");
    return undefined;
  }

  // Get argument count for totality
  const argumentCount = node.arguments.length;

  // Extract explicit type arguments from call site if any
  const explicitTypeArgs =
    node.typeArguments?.map((ta) => convertType(ta, binding)) ?? undefined;

  // Use TypeSystem.resolveCall() - guaranteed to return a result
  // NO FALLBACK: If TypeSystem returns unknownType, that's the answer
  const resolved = typeSystem.resolveCall({
    sigId,
    argumentCount,
    receiverType: receiverIrType,
    explicitTypeArgs,
  });

  if (DEBUG && methodName) {
    console.log("[getDeclaredReturnType]", methodName, "TypeSystem returned:", resolved.returnType);
  }

  // Return TypeSystem's answer directly - no fallbacks
  return resolved.returnType;
};

/**
 * Extract argument passing modes from member binding's parameter modifiers.
 * Converts parameterModifiers to the argumentPassing array format.
 * Returns undefined if no modifiers are present.
 */
const extractArgumentPassingFromBinding = (
  callee: ReturnType<typeof convertExpression>,
  argCount: number
): readonly ("value" | "ref" | "out" | "in")[] | undefined => {
  // Check if callee is a member access with parameter modifiers
  if (
    callee.kind !== "memberAccess" ||
    !callee.memberBinding?.parameterModifiers
  ) {
    return undefined;
  }

  const modifiers = callee.memberBinding.parameterModifiers;
  if (modifiers.length === 0) {
    return undefined;
  }

  // Build the argumentPassing array
  // Initialize all as "value", then override based on modifiers
  const passing: ("value" | "ref" | "out" | "in")[] =
    Array(argCount).fill("value");
  for (const mod of modifiers) {
    if (mod.index >= 0 && mod.index < argCount) {
      passing[mod.index] = mod.modifier;
    }
  }

  return passing;
};

/**
 * Convert call expression
 */
export const convertCallExpression = (
  node: ts.CallExpression,
  binding: Binding
): IrCallExpression | IrTryCastExpression => {
  // Check for trycast<T>(x) - special intrinsic for safe casting
  // trycast<T>(x) compiles to C#: x as T (safe cast, returns null on failure)
  if (
    ts.isIdentifier(node.expression) &&
    node.expression.text === "trycast" &&
    node.typeArguments &&
    node.typeArguments.length === 1 &&
    node.arguments.length === 1
  ) {
    // We've verified length === 1 above, so these are guaranteed to exist
    const targetTypeNode = node.typeArguments[0];
    const argNode = node.arguments[0];
    if (!targetTypeNode || !argNode) {
      throw new Error(
        "ICE: trycast requires exactly 1 type argument and 1 argument"
      );
    }
    const targetType = convertType(targetTypeNode, binding);
    const argExpr = convertExpression(argNode, binding, undefined);

    // Build union type T | null for inferredType
    const nullType: IrType = { kind: "primitiveType", name: "null" };
    const unionType: IrType = {
      kind: "unionType",
      types: [targetType, nullType],
    };

    return {
      kind: "trycast",
      expression: argExpr,
      targetType,
      inferredType: unionType,
      sourceSpan: getSourceSpan(node),
    };
  }

  // Extract type arguments from the call signature
  const typeArguments = extractTypeArguments(node, binding);
  const requiresSpecialization = checkIfRequiresSpecialization(node, binding);
  const narrowing = extractNarrowing(node, binding);

  // Convert callee first so we can access memberBinding and receiver type
  const callee = convertExpression(node.expression, binding, undefined);

  // Extract receiver type for member method calls (e.g., dict.get() → dict's type)
  const receiverIrType =
    callee.kind === "memberAccess" ? callee.object.inferredType : undefined;

  // Extract parameter types with receiver type for inheritance substitution
  const parameterTypes = extractParameterTypes(node, binding, receiverIrType);

  // Try to get argument passing from binding's parameter modifiers first (tsbindgen format),
  // then fall back to TypeScript declaration analysis (ref<T>/out<T>/in<T> wrapper types)
  const argumentPassing =
    extractArgumentPassingFromBinding(callee, node.arguments.length) ??
    extractArgumentPassing(node, binding);

  // DETERMINISTIC TYPING: Return type comes ONLY from declared TypeNodes.
  // NO fallback to TS inference - that loses CLR type aliases.
  // If getDeclaredReturnType returns undefined, use unknownType as poison
  // so validation can emit TSN5201.
  const declaredReturnType = getDeclaredReturnType(
    node,
    binding,
    receiverIrType
  );
  const inferredType = declaredReturnType ?? { kind: "unknownType" as const };

  return {
    kind: "call",
    callee,
    // Pass parameter types as expectedType for deterministic contextual typing
    // This ensures `spreadArray([1,2,3], [4,5,6])` with `number[]` params produces `double[]`
    arguments: node.arguments.map((arg, index) => {
      // Get expected type for this argument position
      const expectedType = parameterTypes?.[index];

      if (ts.isSpreadElement(arg)) {
        // DETERMINISTIC: Use expression's inferredType directly
        const spreadExpr = convertExpression(
          arg.expression,
          binding,
          undefined
        );
        return {
          kind: "spread" as const,
          expression: spreadExpr,
          inferredType: spreadExpr.inferredType,
          sourceSpan: getSourceSpan(arg),
        };
      }
      return convertExpression(arg, binding, expectedType);
    }),
    isOptional: node.questionDotToken !== undefined,
    inferredType,
    sourceSpan: getSourceSpan(node),
    typeArguments,
    requiresSpecialization,
    argumentPassing,
    parameterTypes,
    narrowing,
  };
};

/**
 * Get the constructed type from a new expression.
 *
 * For `new Foo<int>()`, the type is `Foo<int>` - derived from the type reference
 * in the expression itself, NOT from any "return type" annotation.
 *
 * This is different from call expressions where we need declared return types.
 * Constructors don't have return type annotations - the constructed type IS
 * the class/type being instantiated.
 */
const getConstructedType = (
  node: ts.NewExpression,
  binding: Binding
): IrType | undefined => {
  // The expression in `new Foo<T>()` is the type reference
  // If type arguments are explicit, use them to build the type
  if (node.typeArguments && node.typeArguments.length > 0) {
    // Get the constructor name by walking the AST (not getText())
    const typeName = buildQualifiedName(node.expression);

    if (typeName) {
      return {
        kind: "referenceType",
        name: typeName,
        typeArguments: node.typeArguments.map((ta) => convertType(ta, binding)),
      };
    }
  }

  // No explicit type arguments - check if the target is generic
  // ALICE'S SPEC: Use TypeSystem to check if the type has type parameters
  const typeSystem = getTypeSystem();
  if (typeSystem && ts.isIdentifier(node.expression)) {
    const declId = binding.resolveIdentifier(node.expression);
    if (declId) {
      // Use TypeSystem.hasTypeParameters() to check without accessing HandleRegistry
      const hasTypeParams = typeSystem.hasTypeParameters(declId);
      if (hasTypeParams) {
        // Generic type without explicit type arguments - poison with unknownType
        // Validation will emit TSN5202
        return { kind: "unknownType" as const };
      }
    }
  }

  // Non-generic type - get the type from the expression
  const typeName = buildQualifiedName(node.expression);
  if (typeName) {
    return {
      kind: "referenceType",
      name: typeName,
    };
  }

  return undefined;
};

/**
 * Convert new expression
 */
export const convertNewExpression = (
  node: ts.NewExpression,
  binding: Binding
): IrNewExpression => {
  // Extract type arguments from the constructor signature
  const typeArguments = extractTypeArguments(node, binding);
  const requiresSpecialization = checkIfRequiresSpecialization(node, binding);
  const parameterTypes = extractParameterTypes(node, binding);

  // For new expressions, the type is the constructed type from the type reference.
  // Unlike function calls, constructors don't need "return type" annotations.
  // The type is simply what we're instantiating: `new Foo<int>()` → `Foo<int>`.
  const inferredType = getConstructedType(node, binding);

  return {
    kind: "new",
    callee: convertExpression(node.expression, binding, undefined),
    // Pass parameter types as expectedType for deterministic contextual typing
    arguments:
      node.arguments?.map((arg, index) => {
        const expectedType = parameterTypes?.[index];
        if (ts.isSpreadElement(arg)) {
          // DETERMINISTIC: Use expression's inferredType directly
          const spreadExpr = convertExpression(
            arg.expression,
            binding,
            undefined
          );
          return {
            kind: "spread" as const,
            expression: spreadExpr,
            inferredType: spreadExpr.inferredType,
            sourceSpan: getSourceSpan(arg),
          };
        }
        return convertExpression(arg, binding, expectedType);
      }) ?? [],
    inferredType,
    sourceSpan: getSourceSpan(node),
    typeArguments,
    requiresSpecialization,
  };
};
