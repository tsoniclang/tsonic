/**
 * Call and new expression converters
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
  getTypeRegistry,
  getNominalEnv,
  getTypeSystem,
} from "../statements/declarations/registry.js";
import { substituteIrType } from "../../nominal-env.js";
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
 * Normalize receiver IR type to a fully-qualified nominal type name and type arguments.
 * Used for NominalEnv-based member type resolution.
 *
 * The nominal name is resolved to FQ using TypeRegistry when available.
 *
 * MIGRATION NOTE: Uses getTypeRegistry() singleton during Step 7 migration.
 * After migration complete, this logic may move to TypeSystem or use context.
 */
const normalizeReceiverToNominal = (
  receiverIrType: IrType
): { nominal: string; typeArgs: readonly IrType[] } | undefined => {
  // MIGRATION: Try TypeSystem first, fall back to legacy singleton
  const typeSystem = getTypeSystem();
  const registry = getTypeRegistry();

  // Suppress unused warning during migration - TypeSystem will be used after full migration
  void typeSystem;

  // Helper to resolve simple name to FQ name
  const toFQName = (simpleName: string): string => {
    if (!registry) return simpleName;
    // Try to get FQ name from registry
    const fqName = registry.getFQName(simpleName);
    // If name already contains ".", it might already be FQ
    if (!fqName && simpleName.includes(".")) return simpleName;
    return fqName ?? simpleName;
  };

  if (receiverIrType.kind === "referenceType") {
    return {
      nominal: toFQName(receiverIrType.name),
      typeArgs: receiverIrType.typeArguments ?? [],
    };
  }

  if (receiverIrType.kind === "arrayType") {
    // Array is a built-in type - resolve to FQ name
    return {
      nominal: toFQName("Array"),
      typeArgs: [receiverIrType.elementType],
    };
  }

  if (receiverIrType.kind === "primitiveType") {
    // Primitive types map to their wrapper types
    const nominalMap: Record<string, string | undefined> = {
      string: "String",
      number: "Number",
      boolean: "Boolean",
      int: "Int32",
    };
    const simpleName = nominalMap[receiverIrType.name];
    if (simpleName) {
      return { nominal: toFQName(simpleName), typeArgs: [] };
    }
  }

  return undefined;
};

/**
 * Extract parameter types from resolved signature.
 * Used for threading expectedType to array literal arguments etc.
 *
 * DETERMINISTIC TYPING: Uses NominalEnv to walk inheritance chains and substitute
 * type parameters. For `dict.add(key, value)` where `dict: Dictionary<int, Todo>`,
 * returns the substituted types [int, Todo] with CLR aliases preserved.
 *
 * @param node - Call or new expression
 * @param binding - Binding layer for symbol resolution
 * @param receiverIrType - IR type of the receiver (for member method calls)
 *
 * DETERMINISTIC TYPING: Uses TypeSystem.resolveCall() for proper substitution.
 * Falls back to legacy NominalEnv path during migration.
 */
const extractParameterTypes = (
  node: ts.CallExpression | ts.NewExpression,
  binding: Binding,
  receiverIrType?: IrType
): readonly (IrType | undefined)[] | undefined => {
  try {
    // Handle both CallExpression and NewExpression
    const sigId = ts.isCallExpression(node)
      ? binding.resolveCallSignature(node)
      : binding.resolveConstructorSignature(node);
    if (!sigId) return undefined;

    const sigInfo = binding.getHandleRegistry().getSignature(sigId);
    if (!sigInfo) return undefined;

    // MIGRATION: Try TypeSystem.resolveCall() first (Alice's spec)
    const typeSystem = getTypeSystem();
    if (typeSystem && sigId) {
      // Extract explicit type arguments from call site if any
      const explicitTypeArgs =
        node.typeArguments?.map((ta) => convertType(ta, binding)) ?? undefined;

      const resolved = typeSystem.resolveCall({
        sigId,
        receiverType: receiverIrType,
        explicitTypeArgs,
      });

      // If TypeSystem returned non-empty parameter types, use them
      if (resolved.parameterTypes.length > 0) {
        return resolved.parameterTypes;
      }
      // Otherwise fall through to legacy path
    }

    // LEGACY PATH: Direct NominalEnv access (deprecated after migration)
    // Get NominalEnv substitution for member method calls
    const registry = getTypeRegistry();
    const nominalEnv = getNominalEnv();
    let inheritanceSubst: ReadonlyMap<string, IrType> | undefined;
    let memberDeclaringType: string | undefined;

    // For member method calls, get substitution from inheritance chain
    if (
      receiverIrType &&
      receiverIrType.kind !== "unknownType" &&
      registry &&
      nominalEnv &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const methodName = node.expression.name.text;
      const normalized = normalizeReceiverToNominal(receiverIrType);
      if (normalized) {
        const result = nominalEnv.findMemberDeclaringType(
          normalized.nominal,
          normalized.typeArgs,
          methodName
        );
        if (result) {
          inheritanceSubst = result.substitution;
          memberDeclaringType = result.targetNominal;
        }
      }
    }

    const parameters = sigInfo.parameters;

    // If signature has no parameters but we found member declaring type,
    // fall back to TypeRegistry lookup for member method parameters
    // NOTE: Uses legacy API during migration period (Step 3)
    if (parameters.length === 0 && memberDeclaringType && registry) {
      const legacyEntry = registry.getLegacyEntry(memberDeclaringType);
      if (
        legacyEntry &&
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const methodName = node.expression.name.text;
        const member = legacyEntry.members.get(methodName);
        if (
          member?.kind === "method" &&
          member.signatures &&
          member.signatures.length > 0
        ) {
          const methodSig = member.signatures[0]!;

          // Get method-level type parameters
          const methodTypeParams = new Set<string>();
          if (methodSig.typeParameters) {
            for (const tp of methodSig.typeParameters) {
              methodTypeParams.add(tp.name.text);
            }
          }

          const paramTypes: (IrType | undefined)[] = [];
          for (const param of methodSig.parameters) {
            if (param.type) {
              // Check if this is a method-level type parameter
              const isMethodTypeParam =
                ts.isTypeReferenceNode(param.type) &&
                ts.isIdentifier(param.type.typeName) &&
                methodTypeParams.has(param.type.typeName.text);

              if (
                isMethodTypeParam &&
                !inheritanceSubst?.has(param.type.typeName.text)
              ) {
                // Method type parameter without substitution - inferred from argument
                paramTypes.push(undefined);
                continue;
              }

              const irType = convertType(param.type, binding);
              if (irType && inheritanceSubst) {
                paramTypes.push(substituteIrType(irType, inheritanceSubst));
              } else if (irType) {
                paramTypes.push(irType);
              } else {
                paramTypes.push(undefined);
              }
            } else {
              paramTypes.push(undefined);
            }
          }
          return paramTypes;
        }
      }
      return undefined;
    }

    if (parameters.length === 0) {
      return undefined;
    }

    // Build parameter type array from stored TypeNodes
    const paramTypes: (IrType | undefined)[] = [];

    // Get the type parameter names from the signature's stored info
    const funcTypeParams = new Set<string>(
      sigInfo.typeParameters?.map((tp) => tp.name) ?? []
    );

    for (const param of parameters) {
      const paramTypeNode = param.typeNode as ts.TypeNode | undefined;

      if (paramTypeNode) {
        // Check if this is a method-level type parameter (unsubstituted)
        const isMethodTypeParam =
          ts.isTypeReferenceNode(paramTypeNode) &&
          ts.isIdentifier(paramTypeNode.typeName) &&
          funcTypeParams.has(paramTypeNode.typeName.text);

        if (
          isMethodTypeParam &&
          !inheritanceSubst?.has(paramTypeNode.typeName.text)
        ) {
          // Method type parameter without substitution - inferred from argument
          paramTypes.push(undefined);
          continue;
        }

        // Convert to IR and apply inheritance substitution
        const irType = convertType(paramTypeNode, binding);
        if (irType && inheritanceSubst) {
          paramTypes.push(substituteIrType(irType, inheritanceSubst));
        } else if (irType) {
          paramTypes.push(irType);
        } else {
          paramTypes.push(undefined);
        }
        continue;
      }

      paramTypes.push(undefined);
    }

    return paramTypes;
  } catch {
    return undefined;
  }
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
 * Get the declared return type from a call or new expression's signature.
 *
 * DETERMINISTIC TYPING: Uses TypeSystem.resolveCall() for proper substitution.
 * Falls back to legacy paths for edge cases during migration.
 */
export const getDeclaredReturnType = (
  node: ts.CallExpression | ts.NewExpression,
  binding: Binding,
  receiverIrType?: IrType
): IrType | undefined => {
  try {
    // 1. Get resolved signature through Binding
    // Handle both CallExpression and NewExpression
    const sigId = ts.isCallExpression(node)
      ? binding.resolveCallSignature(node)
      : binding.resolveConstructorSignature(node);

    // MIGRATION: Try TypeSystem.resolveCall() first for call expressions
    const typeSystem = getTypeSystem();
    if (typeSystem && sigId && ts.isCallExpression(node)) {
      const explicitTypeArgs =
        node.typeArguments?.map((ta) => convertType(ta, binding)) ?? undefined;

      const resolved = typeSystem.resolveCall({
        sigId,
        receiverType: receiverIrType,
        explicitTypeArgs,
      });

      // If TypeSystem returned a valid return type (not unknownType), use it
      if (resolved.returnType.kind !== "unknownType") {
        return resolved.returnType;
      }
      // Otherwise fall through to legacy path
    }

    const sigInfo = sigId
      ? binding.getHandleRegistry().getSignature(sigId)
      : undefined;

    // 2. Try to extract return TypeNode from signature info
    let returnTypeNode: ts.TypeNode | undefined = sigInfo?.returnTypeNode as
      | ts.TypeNode
      | undefined;

    // Handle constructor case: For new expressions, the "return type" is the class type
    // Constructors don't have return type annotations - the type is the class being instantiated
    if (ts.isNewExpression(node) && !returnTypeNode) {
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
    }

    // 3. Fallback for function-typed variables
    // For calls like `counter()` where `counter: () => number` or `counter = makeCounter()`
    // Try to get the return type from the callee's declared type
    if (!returnTypeNode && ts.isCallExpression(node)) {
      const calleeDeclaredType = getCalleesDeclaredType(node, binding);
      if (calleeDeclaredType) {
        returnTypeNode = getReturnTypeFromFunctionType(calleeDeclaredType);
      }
    }

    // 4. Fallback for member method calls using TypeRegistry/NominalEnv
    // For calls like `s.substring(0, 5)` where Binding can't resolve the signature
    // (common with noLib: true where globals augment String but checker doesn't know)
    if (
      !returnTypeNode &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      receiverIrType
    ) {
      const registry = getTypeRegistry();
      const nominalEnv = getNominalEnv();

      if (registry && nominalEnv) {
        const methodName = node.expression.name.text;
        const normalized = normalizeReceiverToNominal(receiverIrType);

        if (normalized) {
          // Try to find the method in the type's inheritance chain
          const result = nominalEnv.findMemberDeclaringType(
            normalized.nominal,
            normalized.typeArgs,
            methodName
          );

          if (result) {
            // Get the method's return type from TypeRegistry
            // NOTE: Uses legacy API during migration period (Step 3)
            const legacyEntry = registry.getLegacyEntry(result.targetNominal);
            if (legacyEntry) {
              const member = legacyEntry.members.get(methodName);
              if (
                member?.kind === "method" &&
                member.signatures &&
                member.signatures.length > 0
              ) {
                // Use first signature's return type
                const methodSig = member.signatures[0]!;
                if (methodSig.type) {
                  const baseReturnType = convertType(methodSig.type, binding);
                  if (baseReturnType) {
                    // Apply inheritance substitution
                    return substituteIrType(
                      baseReturnType,
                      result.substitution
                    );
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!returnTypeNode) return undefined;

    // 5. Convert to IrType first (DETERMINISTIC: from TypeNode, not TS inference)
    const baseReturnType = convertType(returnTypeNode, binding);
    if (!baseReturnType) return undefined;

    // 6. Apply inheritance substitution via NominalEnv for member method calls
    const registry = getTypeRegistry();
    const nominalEnv = getNominalEnv();

    if (
      receiverIrType &&
      receiverIrType.kind !== "unknownType" &&
      registry &&
      nominalEnv &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const methodName = node.expression.name.text;
      const normalized = normalizeReceiverToNominal(receiverIrType);
      if (normalized) {
        const result = nominalEnv.findMemberDeclaringType(
          normalized.nominal,
          normalized.typeArgs,
          methodName
        );
        if (result) {
          return substituteIrType(baseReturnType, result.substitution);
        }
      }
    }

    // 7. No inheritance substitution needed - return base type
    return baseReturnType;
  } catch {
    return undefined;
  }
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
