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
import { IrType } from "../../types.js";
import type { ProgramContext } from "../../program-context.js";

/**
 * Extract argument passing modes from resolved signature.
 * Returns array aligned with arguments, indicating ref/out/in/value for each.
 *
 * ALICE'S SPEC: Uses TypeSystem to get parameter modes.
 * Parameter modes were normalized in Binding at registration time.
 */
const extractArgumentPassing = (
  node: ts.CallExpression | ts.NewExpression,
  ctx: ProgramContext
): readonly ("value" | "ref" | "out" | "in")[] | undefined => {
  // Get the TypeSystem
  const typeSystem = ctx.typeSystem;

  // Handle both CallExpression and NewExpression
  const sigId = ts.isCallExpression(node)
    ? ctx.binding.resolveCallSignature(node)
    : ctx.binding.resolveConstructorSignature(node);
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
  ctx: ProgramContext,
  receiverIrType?: IrType
): IrType | undefined => {
  const DEBUG = process.env.DEBUG_RETURN_TYPE === "1";
  const methodName =
    ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      ? node.expression.name.text
      : undefined;
  if (DEBUG && methodName) {
    console.log(
      "[getDeclaredReturnType]",
      methodName,
      "receiver:",
      receiverIrType
    );
  }

  // Handle new expressions specially - they construct the type from the expression
  if (ts.isNewExpression(node)) {
    // For new expressions with explicit type arguments
    if (node.typeArguments && node.typeArguments.length > 0) {
      const typeName = buildQualifiedName(node.expression);
      if (typeName) {
        // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
        const typeSystem = ctx.typeSystem;
        return {
          kind: "referenceType",
          name: typeName,
          typeArguments: node.typeArguments.map((ta) =>
            typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(ta))
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
  const typeSystem = ctx.typeSystem;

  const sigId = ctx.binding.resolveCallSignature(node);
  if (!sigId) {
    if (DEBUG && methodName)
      console.log(
        "[getDeclaredReturnType]",
        methodName,
        "No signature resolved"
      );
    return undefined;
  }

  // Get argument count for totality
  const argumentCount = node.arguments.length;

  // Extract explicit type arguments from call site if any
  // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
  const explicitTypeArgs = node.typeArguments
    ? node.typeArguments.map((ta) =>
        typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(ta))
      )
    : undefined;

  // Use TypeSystem.resolveCall() - guaranteed to return a result
  // NO FALLBACK: If TypeSystem returns unknownType, that's the answer
  const resolved = typeSystem.resolveCall({
    sigId,
    argumentCount,
    receiverType: receiverIrType,
    explicitTypeArgs,
  });

  if (DEBUG && methodName) {
    console.log(
      "[getDeclaredReturnType]",
      methodName,
      "TypeSystem returned:",
      resolved.returnType
    );
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
  ctx: ProgramContext
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
    // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
    const typeSystem = ctx.typeSystem;
    const targetType = typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(targetTypeNode)
    );
    const argExpr = convertExpression(argNode, ctx, undefined);

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
  const typeArguments = extractTypeArguments(node, ctx);
  const requiresSpecialization = checkIfRequiresSpecialization(node, ctx);

  // Convert callee first so we can access memberBinding and receiver type
  const callee = convertExpression(node.expression, ctx, undefined);

  // Extract receiver type for member method calls (e.g., dict.get() → dict's type)
  const receiverIrType =
    callee.kind === "memberAccess" ? callee.object.inferredType : undefined;

  // Resolve call (two-pass):
  // 1) Resolve parameter types (for expectedType threading)
  // 2) Convert arguments, then re-resolve with argTypes to infer generics deterministically
  const typeSystem = ctx.typeSystem;
  const sigId = ctx.binding.resolveCallSignature(node);
  const argumentCount = node.arguments.length;

  const explicitTypeArgs = node.typeArguments
    ? node.typeArguments.map((ta) =>
        typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(ta))
      )
    : undefined;

  const initialResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount,
        receiverType: receiverIrType,
        explicitTypeArgs,
      })
    : undefined;
  const initialParameterTypes = initialResolved?.parameterTypes;

  // Try to get argument passing from binding's parameter modifiers first (tsbindgen format),
  // then fall back to TypeScript declaration analysis (ref<T>/out<T>/in<T> wrapper types)
  const argumentPassingFromBinding = extractArgumentPassingFromBinding(
    callee,
    node.arguments.length
  );

  const isLambdaArg = (expr: ts.Expression): boolean => {
    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) return true;
    if (ts.isParenthesizedExpression(expr)) return isLambdaArg(expr.expression);
    return false;
  };

  // Pass 1: convert non-lambda arguments and infer type args from them.
  const argsWorking: (
    | IrCallExpression["arguments"][number]
    | undefined
  )[] = new Array(node.arguments.length);
  const argTypesForInference: (IrType | undefined)[] = Array(
    node.arguments.length
  ).fill(undefined);

  for (let index = 0; index < node.arguments.length; index++) {
    const arg = node.arguments[index];
    if (!arg) continue;

    const expectedType = initialParameterTypes?.[index];

    if (ts.isSpreadElement(arg)) {
      const spreadExpr = convertExpression(arg.expression, ctx, undefined);
      argsWorking[index] = {
        kind: "spread" as const,
        expression: spreadExpr,
        inferredType: spreadExpr.inferredType,
        sourceSpan: getSourceSpan(arg),
      };
      continue;
    }

    if (isLambdaArg(arg)) {
      // Defer lambda conversion until after we infer generic type args from
      // non-lambda arguments. This prevents "T vs inferred T" conflicts.
      continue;
    }

    const converted = convertExpression(arg, ctx, expectedType);
    argsWorking[index] = converted;
    argTypesForInference[index] = converted.inferredType;
  }

  const lambdaContextResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount,
        receiverType: receiverIrType,
        explicitTypeArgs,
        argTypes: argTypesForInference,
      })
    : initialResolved;

  const parameterTypesForLambdaContext =
    lambdaContextResolved?.parameterTypes ?? initialParameterTypes;

  // Pass 2: convert lambda arguments with inferred parameter types in scope.
  for (let index = 0; index < node.arguments.length; index++) {
    if (argsWorking[index]) continue;
    const arg = node.arguments[index];
    if (!arg) continue;
    if (ts.isSpreadElement(arg)) continue;
    if (!isLambdaArg(arg)) continue;

    const expectedType = parameterTypesForLambdaContext?.[index];
    const lambdaExpectedType =
      expectedType?.kind === "functionType"
        ? expectedType
        : expectedType
          ? typeSystem.delegateToFunctionType(expectedType) ?? expectedType
          : undefined;

    argsWorking[index] = convertExpression(arg, ctx, lambdaExpectedType);
  }

  const convertedArgs = argsWorking.map((a) => {
    if (!a) {
      throw new Error("ICE: call argument conversion produced a hole");
    }
    return a;
  });

  const argTypes = convertedArgs.map((a) =>
    a.kind === "spread" ? undefined : a.inferredType
  );

  const finalResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount,
        receiverType: receiverIrType,
        explicitTypeArgs,
        argTypes,
      })
    : lambdaContextResolved;

  const parameterTypes = finalResolved?.parameterTypes ?? initialParameterTypes;
  const inferredType = finalResolved?.returnType ?? ({ kind: "unknownType" } as const);
  const argumentPassing =
    argumentPassingFromBinding ??
    (finalResolved
      ? finalResolved.parameterModes.slice(0, node.arguments.length)
      : extractArgumentPassing(node, ctx));

  const narrowing: IrCallExpression["narrowing"] = (() => {
    const pred = finalResolved?.typePredicate;
    if (!pred) return undefined;
    if (pred.kind !== "param") return undefined;
    return {
      kind: "typePredicate",
      argIndex: pred.parameterIndex,
      targetType: pred.targetType,
    };
  })();

  return {
    kind: "call",
    callee,
    // Pass parameter types as expectedType for deterministic contextual typing
    // This ensures `spreadArray([1,2,3], [4,5,6])` with `number[]` params produces `double[]`
    arguments: convertedArgs,
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

// DELETED: getConstructedType - Phase 15 uses resolveCall.returnType instead

/**
 * Convert new expression
 *
 * Phase 15 (Alice's spec): Two-pass resolution for deterministic constructor typing.
 * 1) Resolve once (without argTypes) to get parameter types for expected-type threading.
 * 2) Convert non-lambda arguments first, collecting argTypes for inference.
 * 3) Re-resolve with argTypes to infer constructor type parameters.
 * 4) Convert lambda arguments using instantiated parameter types.
 * 5) Final resolve with full argTypes.
 * 6) inferredType MUST be finalResolved.returnType.
 */
export const convertNewExpression = (
  node: ts.NewExpression,
  ctx: ProgramContext
): IrNewExpression => {
  // Extract explicit type arguments (for IR output, not inference)
  const typeArguments = extractTypeArguments(node, ctx);
  const requiresSpecialization = checkIfRequiresSpecialization(node, ctx);

  // Convert callee (the constructor expression)
  const callee = convertExpression(node.expression, ctx, undefined);

  // Two-pass resolution (matching convertCallExpression pattern)
  const typeSystem = ctx.typeSystem;
  const sigId = ctx.binding.resolveConstructorSignature(node);
  const argumentCount = node.arguments?.length ?? 0;

  // Extract explicit type arguments from call site
  const explicitTypeArgs = node.typeArguments
    ? node.typeArguments.map((ta) =>
        typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(ta))
      )
    : undefined;

  // Initial resolution (without argTypes) for parameter type threading
  const initialResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount,
        explicitTypeArgs,
      })
    : undefined;
  const initialParameterTypes = initialResolved?.parameterTypes;

  const isLambdaArg = (expr: ts.Expression): boolean => {
    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) return true;
    if (ts.isParenthesizedExpression(expr)) return isLambdaArg(expr.expression);
    return false;
  };

  // Pass 1: convert non-lambda arguments and collect argTypes for inference
  const argsWorking: (IrNewExpression["arguments"][number] | undefined)[] =
    new Array(argumentCount);
  const argTypesForInference: (IrType | undefined)[] = Array(argumentCount).fill(
    undefined
  );

  const args = node.arguments ?? [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;

    const expectedType = initialParameterTypes?.[index];

    if (ts.isSpreadElement(arg)) {
      const spreadExpr = convertExpression(arg.expression, ctx, undefined);
      argsWorking[index] = {
        kind: "spread" as const,
        expression: spreadExpr,
        inferredType: spreadExpr.inferredType,
        sourceSpan: getSourceSpan(arg),
      };
      continue;
    }

    if (isLambdaArg(arg)) {
      // Defer lambda conversion until after generic type arg inference
      continue;
    }

    const converted = convertExpression(arg, ctx, expectedType);
    argsWorking[index] = converted;
    argTypesForInference[index] = converted.inferredType;
  }

  // Re-resolve with argTypes to infer constructor type parameters
  const lambdaContextResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount,
        explicitTypeArgs,
        argTypes: argTypesForInference,
      })
    : initialResolved;

  const parameterTypesForLambdaContext =
    lambdaContextResolved?.parameterTypes ?? initialParameterTypes;

  // Pass 2: convert lambda arguments with inferred parameter types
  for (let index = 0; index < args.length; index++) {
    if (argsWorking[index]) continue;
    const arg = args[index];
    if (!arg) continue;
    if (ts.isSpreadElement(arg)) continue;
    if (!isLambdaArg(arg)) continue;

    const expectedType = parameterTypesForLambdaContext?.[index];
    const lambdaExpectedType =
      expectedType?.kind === "functionType"
        ? expectedType
        : expectedType
          ? typeSystem.delegateToFunctionType(expectedType) ?? expectedType
          : undefined;

    argsWorking[index] = convertExpression(arg, ctx, lambdaExpectedType);
  }

  // Fill any remaining undefined slots (shouldn't happen, but be safe)
  const convertedArgs = argsWorking.map((a, index) => {
    if (a) return a;
    const arg = args[index];
    if (!arg) {
      throw new Error("ICE: new expression argument conversion produced a hole");
    }
    return convertExpression(arg, ctx, undefined);
  });

  // Collect final argTypes
  const argTypes = convertedArgs.map((a) =>
    a.kind === "spread" ? undefined : a.inferredType
  );

  // Final resolution with full argTypes
  const finalResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount,
        explicitTypeArgs,
        argTypes,
      })
    : lambdaContextResolved;

  // Phase 15: inferredType MUST be finalResolved.returnType
  // If sigId is missing, use unknownType (do not fabricate a nominal type)
  const inferredType: IrType = finalResolved?.returnType ?? { kind: "unknownType" };

  // Phase 18: IrNewExpression.typeArguments must include inferred type arguments.
  // The emitter relies on this field to emit generic constructor calls (e.g., new Box<int>(...)).
  const inferredTypeArguments =
    inferredType.kind === "referenceType" ? inferredType.typeArguments : undefined;
  const typeArgumentsForIr =
    typeArguments ??
    (inferredTypeArguments && inferredTypeArguments.length > 0
      ? inferredTypeArguments
      : undefined);

  return {
    kind: "new",
    callee,
    arguments: convertedArgs,
    inferredType,
    sourceSpan: getSourceSpan(node),
    typeArguments: typeArgumentsForIr,
    requiresSpecialization,
  };
};
