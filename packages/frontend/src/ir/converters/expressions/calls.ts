/**
 * Call and new expression converters
 *
 * ALICE'S SPEC: All call resolution goes through TypeSystem.resolveCall().
 * Falls back to NominalEnv for inherited method return types that TypeSystem
 * can't resolve (e.g., String.substring from String$instance).
 *
 * TODO(alice): The NominalEnv fallback should be removed once TypeSystem
 * properly handles inherited methods from extended interfaces.
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
import {
  getTypeSystem,
  _internalGetTypeRegistry,
  _internalGetNominalEnv,
} from "../statements/declarations/registry.js";
import { substituteIrType } from "../../nominal-env.js";
import {
  normalizeToClrFQ,
  PRIMITIVE_TO_CLR_FQ,
} from "../../clr-type-mappings.js";
import type { Binding } from "../../binding/index.js";

/**
 * Extract argument passing modes from resolved signature
 * Returns array aligned with arguments, indicating ref/out/in/value for each
 */
const extractArgumentPassing = (
  node: ts.CallExpression | ts.NewExpression,
  binding: Binding
): readonly ("value" | "ref" | "out" | "in")[] | undefined => {
  try {
    // Handle both CallExpression and NewExpression
    const sigId = ts.isCallExpression(node)
      ? binding.resolveCallSignature(node)
      : binding.resolveConstructorSignature(node);
    if (!sigId) return undefined;

    const sigInfo = binding.getHandleRegistry().getSignature(sigId);
    if (!sigInfo?.parameters || sigInfo.parameters.length === 0) {
      return undefined;
    }

    // Build passing mode for each parameter from stored TypeNodes
    const passingModes: ("value" | "ref" | "out" | "in")[] = [];

    for (const param of sigInfo.parameters) {
      let passing: "value" | "ref" | "out" | "in" = "value";
      const paramTypeNode = param.typeNode as ts.TypeNode | undefined;

      // Check if parameter type is ref<T>, out<T>, or in<T>
      if (
        paramTypeNode &&
        ts.isTypeReferenceNode(paramTypeNode) &&
        ts.isIdentifier(paramTypeNode.typeName)
      ) {
        const typeName = paramTypeNode.typeName.text;
        if (
          (typeName === "ref" || typeName === "out" || typeName === "in") &&
          paramTypeNode.typeArguments &&
          paramTypeNode.typeArguments.length > 0
        ) {
          passing = typeName === "in" ? "in" : typeName;
        }
      }

      passingModes.push(passing);
    }

    return passingModes;
  } catch {
    return undefined;
  }
};

/**
 * Extract type predicate narrowing metadata from a call expression.
 * Returns narrowing info if the callee is a type predicate function (x is T).
 *
 * DETERMINISTIC: Gets the target type from the predicate's declaration TypeNode.
 */
const extractNarrowing = (
  node: ts.CallExpression,
  binding: Binding
): IrCallExpression["narrowing"] => {
  try {
    const sigId = binding.resolveCallSignature(node);
    if (!sigId) return undefined;

    const sigInfo = binding.getHandleRegistry().getSignature(sigId);
    if (!sigInfo) return undefined;

    // Check if return type is a type predicate
    const returnTypeNode = sigInfo.returnTypeNode as ts.TypeNode | undefined;
    if (returnTypeNode && ts.isTypePredicateNode(returnTypeNode)) {
      const predNode = returnTypeNode;

      // We only handle "param is T" predicates (not "this is T")
      if (ts.isIdentifier(predNode.parameterName) && predNode.type) {
        // Find the parameter index
        const paramName = predNode.parameterName.text;
        const paramIndex = sigInfo.parameters.findIndex(
          (p) => p.name === paramName
        );

        if (paramIndex >= 0) {
          const targetType = convertType(predNode.type, binding);
          if (targetType) {
            return {
              kind: "typePredicate",
              argIndex: paramIndex,
              targetType,
            };
          }
        }
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
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
/**
 * Extract return type from a FunctionTypeNode.
 * For `() => number`, returns the `number` TypeNode.
 */
const getReturnTypeFromFunctionType = (
  typeNode: ts.TypeNode
): ts.TypeNode | undefined => {
  if (ts.isFunctionTypeNode(typeNode)) {
    return typeNode.type;
  }
  return undefined;
};

/**
 * Get the declared type of a callee from its variable/parameter declaration.
 * For function-typed identifiers, returns the function type.
 */
const getCalleesDeclaredType = (
  node: ts.CallExpression,
  binding: Binding
): ts.TypeNode | undefined => {
  const callee = node.expression;

  // Only handle identifiers for now
  if (!ts.isIdentifier(callee)) return undefined;

  const declId = binding.resolveIdentifier(callee);
  if (!declId) return undefined;

  const declInfo = binding.getHandleRegistry().getDecl(declId);
  if (!declInfo) return undefined;

  // Check for explicit type node on the declaration
  if (declInfo.typeNode) {
    return declInfo.typeNode as ts.TypeNode;
  }

  // For function-typed variables declared from a call expression,
  // we'd need the declaration node to get the initializer.
  // The current DeclInfo only has typeNode, so we can't access initializers.
  // This is a limitation - we'll return undefined and let validation handle it.

  return undefined;
};

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

/**
 * Fallback for getDeclaredReturnType when Binding can't resolve the signature.
 * Uses Binding.resolvePropertyAccess to get the method's return type.
 *
 * TODO(alice): This fallback should be removed once TypeSystem properly
 * handles inherited methods from extended interfaces.
 */
const getDeclaredReturnTypeFallback = (
  node: ts.CallExpression,
  binding: Binding
): IrType | undefined => {
  // Only for member method calls: obj.method()
  if (!ts.isPropertyAccessExpression(node.expression)) return undefined;

  // Resolve the method as a property access
  const memberId = binding.resolvePropertyAccess(node.expression);
  if (!memberId) return undefined;

  const memberInfo = binding.getHandleRegistry().getMember(memberId);
  if (!memberInfo?.typeNode) return undefined;

  const typeNode = memberInfo.typeNode as ts.TypeNode;

  // If it's a function type node (property with function type), extract return type
  if (ts.isFunctionTypeNode(typeNode)) {
    return convertType(typeNode.type, binding);
  }

  // For method signatures, typeNode is already the return type node
  return convertType(typeNode, binding);
};

/**
 * Normalize receiver IR type to a fully-qualified CLR nominal type name and type arguments.
 * Used for NominalEnv-based member type resolution.
 *
 * Uses hardcoded CLR mappings for @tsonic/globals and @tsonic/core types.
 * These are fundamental runtime types with fixed CLR identities.
 */
const normalizeReceiverToNominal = (
  receiverIrType: IrType
): { nominal: string; typeArgs: readonly IrType[] } | undefined => {
  if (receiverIrType.kind === "referenceType") {
    // Normalize reference type names to CLR FQ names
    const clrFQ = normalizeToClrFQ(receiverIrType.name);
    return {
      nominal: clrFQ,
      typeArgs: receiverIrType.typeArguments ?? [],
    };
  }

  if (receiverIrType.kind === "arrayType") {
    return {
      nominal: "System.Array",
      typeArgs: [receiverIrType.elementType],
    };
  }

  if (receiverIrType.kind === "primitiveType") {
    // Use CLR FQ mappings for all primitive types
    const clrFQ = PRIMITIVE_TO_CLR_FQ[receiverIrType.name];
    if (clrFQ) {
      return { nominal: clrFQ, typeArgs: [] };
    }
  }

  return undefined;
};

/**
 * Fallback for getDeclaredReturnType using NominalEnv to walk inheritance chains.
 * Used for member method calls on types with inherited methods from globals
 * (e.g., s.substring() where String extends String$instance from @tsonic/dotnet).
 *
 * TODO(alice): This fallback should be removed once TypeSystem properly
 * handles inherited methods from extended interfaces.
 */
const getDeclaredReturnTypeNominalEnvFallback = (
  node: ts.CallExpression,
  receiverIrType: IrType | undefined,
  binding: Binding
): IrType | undefined => {
  const DEBUG = process.env.DEBUG_NOMINALENV === "1";

  // Only for member method calls: obj.method()
  if (!ts.isPropertyAccessExpression(node.expression)) return undefined;
  if (!receiverIrType || receiverIrType.kind === "unknownType") return undefined;

  const registry = _internalGetTypeRegistry();
  const nominalEnv = _internalGetNominalEnv();
  if (!registry || !nominalEnv) {
    if (DEBUG) console.log("[NominalEnvFallback] registry or nominalEnv is null");
    return undefined;
  }

  const methodName = node.expression.name.text;
  const normalized = normalizeReceiverToNominal(receiverIrType);
  if (!normalized) {
    if (DEBUG) console.log("[NominalEnvFallback] normalization failed for", receiverIrType);
    return undefined;
  }

  if (DEBUG) console.log("[NominalEnvFallback] Looking up", methodName, "on", normalized.nominal);

  // Try to find the method in the type's inheritance chain
  const result = nominalEnv.findMemberDeclaringType(
    normalized.nominal,
    normalized.typeArgs,
    methodName
  );
  if (!result) {
    if (DEBUG) console.log("[NominalEnvFallback] findMemberDeclaringType returned null");
    if (DEBUG) console.log("[NominalEnvFallback] Inheritance chain:", nominalEnv.getInheritanceChain(normalized.nominal));
    return undefined;
  }

  if (DEBUG) console.log("[NominalEnvFallback] Found in", result.targetNominal);

  // Get the method's return type from TypeRegistry
  const legacyEntry = registry.getLegacyEntry(result.targetNominal);
  if (!legacyEntry) {
    if (DEBUG) console.log("[NominalEnvFallback] No legacy entry for", result.targetNominal);
    return undefined;
  }

  const member = legacyEntry.members.get(methodName);
  if (
    member?.kind !== "method" ||
    !member.signatures ||
    member.signatures.length === 0
  ) {
    if (DEBUG) console.log("[NominalEnvFallback] Member not found or not a method:", member);
    return undefined;
  }

  // Use first signature's return type
  const methodSig = member.signatures[0]!;
  if (!methodSig.type) {
    if (DEBUG) console.log("[NominalEnvFallback] No return type on signature");
    return undefined;
  }

  const baseReturnType = convertType(methodSig.type, binding);
  if (!baseReturnType) {
    if (DEBUG) console.log("[NominalEnvFallback] convertType returned undefined");
    return undefined;
  }

  if (DEBUG) console.log("[NominalEnvFallback] Return type:", baseReturnType);

  // Apply inheritance substitution
  return substituteIrType(baseReturnType, result.substitution);
};

/**
 * Get the declared return type from a call or new expression's signature.
 *
 * ALICE'S SPEC: Uses TypeSystem.resolveCall() as primary source.
 * Falls back to Binding for inherited methods not in TypeRegistry
 * (e.g., String.substring from String$instance).
 *
 * TODO(alice): The Binding fallback should be removed once TypeRegistry
 * properly handles inherited members from extended interfaces.
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

  // For call expressions, try TypeSystem.resolveCall() first
  const typeSystem = getTypeSystem();

  const sigId = binding.resolveCallSignature(node);
  if (sigId && typeSystem) {
    // Get argument count for totality
    const argumentCount = node.arguments.length;

    // Extract explicit type arguments from call site if any
    const explicitTypeArgs =
      node.typeArguments?.map((ta) => convertType(ta, binding)) ?? undefined;

    // Use TypeSystem.resolveCall() - guaranteed to return a result
    const resolved = typeSystem.resolveCall({
      sigId,
      argumentCount,
      receiverType: receiverIrType,
      explicitTypeArgs,
    });

    if (DEBUG && methodName) {
      console.log("[getDeclaredReturnType]", methodName, "TypeSystem returned:", resolved.returnType);
    }

    // If TypeSystem returned a valid return type (not unknownType), use it
    if (resolved.returnType.kind !== "unknownType") {
      return resolved.returnType;
    }
    // Fall through to fallbacks
  } else if (DEBUG && methodName) {
    console.log("[getDeclaredReturnType]", methodName, "sigId:", sigId, "typeSystem:", !!typeSystem);
  }

  // Fallback 1: Function-typed variables like `counter()` where `counter: () => number`
  const calleeDeclaredType = getCalleesDeclaredType(node, binding);
  if (calleeDeclaredType) {
    const returnTypeNode = getReturnTypeFromFunctionType(calleeDeclaredType);
    if (returnTypeNode) {
      if (DEBUG && methodName) console.log("[getDeclaredReturnType]", methodName, "Fallback 1 hit");
      return convertType(returnTypeNode, binding);
    }
  }

  // Fallback 2: Try Binding.resolvePropertyAccess for member methods
  const fallbackResult = getDeclaredReturnTypeFallback(node, binding);
  if (fallbackResult) {
    if (DEBUG && methodName) console.log("[getDeclaredReturnType]", methodName, "Fallback 2 returned:", fallbackResult);
    return fallbackResult;
  }

  // Fallback 3: NominalEnv lookup for inherited methods
  // (e.g., s.substring() where String extends String$instance)
  const nominalEnvResult = getDeclaredReturnTypeNominalEnvFallback(
    node,
    receiverIrType,
    binding
  );
  if (nominalEnvResult) {
    if (DEBUG && methodName) console.log("[getDeclaredReturnType]", methodName, "Fallback 3 returned:", nominalEnvResult);
    return nominalEnvResult;
  }

  if (DEBUG && methodName) console.log("[getDeclaredReturnType]", methodName, "ALL FALLBACKS FAILED");
  return undefined;
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
  // Use Binding to resolve the type and check for type parameters
  if (ts.isIdentifier(node.expression)) {
    const declId = binding.resolveIdentifier(node.expression);
    if (declId) {
      const declInfo = binding.getHandleRegistry().getDecl(declId);
      // Check the declaration node for type parameters
      const declNode = declInfo?.declNode as ts.Declaration | undefined;
      if (declNode) {
        const hasTypeParams =
          (ts.isClassDeclaration(declNode) &&
            declNode.typeParameters &&
            declNode.typeParameters.length > 0) ||
          (ts.isInterfaceDeclaration(declNode) &&
            declNode.typeParameters &&
            declNode.typeParameters.length > 0) ||
          (ts.isTypeAliasDeclaration(declNode) &&
            declNode.typeParameters &&
            declNode.typeParameters.length > 0);
        if (hasTypeParams) {
          // Generic type without explicit type arguments - poison with unknownType
          // Validation will emit TSN5202
          return { kind: "unknownType" as const };
        }
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
