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
} from "../statements/declarations/registry.js";
import { substituteIrType } from "../../nominal-env.js";

/**
 * Extract argument passing modes from resolved signature
 * Returns array aligned with arguments, indicating ref/out/in/value for each
 */
const extractArgumentPassing = (
  node: ts.CallExpression | ts.NewExpression,
  checker: ts.TypeChecker
): readonly ("value" | "ref" | "out" | "in")[] | undefined => {
  try {
    const signature = checker.getResolvedSignature(node);
    if (!signature || !signature.declaration) {
      return undefined;
    }

    const decl = signature.declaration;
    let parameters: readonly ts.ParameterDeclaration[] = [];

    // Extract parameters from declaration
    if (
      ts.isFunctionDeclaration(decl) ||
      ts.isMethodDeclaration(decl) ||
      ts.isConstructorDeclaration(decl) ||
      ts.isArrowFunction(decl) ||
      ts.isFunctionExpression(decl)
    ) {
      parameters = decl.parameters;
    }

    if (parameters.length === 0) {
      return undefined;
    }

    // Build passing mode for each parameter
    const passingModes: ("value" | "ref" | "out" | "in")[] = [];

    for (const param of parameters) {
      let passing: "value" | "ref" | "out" | "in" = "value";

      // Check if parameter type is ref<T>, out<T>, or in<T>
      if (
        param.type &&
        ts.isTypeReferenceNode(param.type) &&
        ts.isIdentifier(param.type.typeName)
      ) {
        const typeName = param.type.typeName.text;
        if (
          (typeName === "ref" || typeName === "out" || typeName === "in") &&
          param.type.typeArguments &&
          param.type.typeArguments.length > 0
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
  checker: ts.TypeChecker
): IrCallExpression["narrowing"] => {
  try {
    const sig = checker.getResolvedSignature(node);
    if (!sig || !sig.declaration) return undefined;

    const pred = checker.getTypePredicateOfSignature(sig);
    // We only handle "param is T" predicates (not "this is T")
    if (
      pred &&
      pred.kind === ts.TypePredicateKind.Identifier &&
      pred.parameterIndex !== undefined
    ) {
      // DETERMINISTIC: Get target type from declaration's type predicate TypeNode
      const decl = sig.declaration;
      if (
        (ts.isFunctionDeclaration(decl) ||
          ts.isMethodDeclaration(decl) ||
          ts.isArrowFunction(decl)) &&
        decl.type &&
        ts.isTypePredicateNode(decl.type)
      ) {
        const targetTypeNode = decl.type.type;
        if (targetTypeNode) {
          const targetType = convertType(targetTypeNode, checker);
          if (targetType) {
            return {
              kind: "typePredicate",
              argIndex: pred.parameterIndex,
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
 */
const normalizeReceiverToNominal = (
  receiverIrType: IrType
): { nominal: string; typeArgs: readonly IrType[] } | undefined => {
  const registry = getTypeRegistry();

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
 * @param checker - TypeChecker for symbol resolution
 * @param receiverIrType - IR type of the receiver (for member method calls)
 */
const extractParameterTypes = (
  node: ts.CallExpression | ts.NewExpression,
  checker: ts.TypeChecker,
  receiverIrType?: IrType
): readonly (IrType | undefined)[] | undefined => {
  try {
    const signature = checker.getResolvedSignature(node);
    if (!signature) {
      return undefined;
    }

    const sigParams = signature.getParameters();

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

    // If TS signature has no declaration (e.g., noLib mode with intrinsic array type),
    // fall back to TypeRegistry lookup for member method parameters
    if (sigParams.length === 0 && memberDeclaringType && registry) {
      const entry = registry.resolveNominal(memberDeclaringType);
      if (
        entry &&
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const methodName = node.expression.name.text;
        const member = entry.members.get(methodName);
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

              const irType = convertType(param.type, checker);
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

    if (sigParams.length === 0) {
      return undefined;
    }

    // Build parameter type array
    const paramTypes: (IrType | undefined)[] = [];

    // Get the type parameter names from the enclosing function's signature
    const funcTypeParams = new Set<string>();
    const sigDecl = signature.getDeclaration();
    if (sigDecl && sigDecl.typeParameters) {
      for (const tp of sigDecl.typeParameters) {
        funcTypeParams.add(tp.name.text);
      }
    }

    for (const sigParam of sigParams) {
      const decl = sigParam.valueDeclaration;

      if (decl && ts.isParameter(decl) && decl.type) {
        // Check if this is a method-level type parameter (unsubstituted)
        const isMethodTypeParam =
          ts.isTypeReferenceNode(decl.type) &&
          ts.isIdentifier(decl.type.typeName) &&
          funcTypeParams.has(decl.type.typeName.text);

        if (
          isMethodTypeParam &&
          !inheritanceSubst?.has(decl.type.typeName.text)
        ) {
          // Method type parameter without substitution - inferred from argument
          paramTypes.push(undefined);
          continue;
        }

        // Convert to IR and apply inheritance substitution
        const irType = convertType(decl.type, checker);
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
  checker: ts.TypeChecker
): ts.TypeNode | undefined => {
  const callee = node.expression;

  // Only handle identifiers for now
  if (!ts.isIdentifier(callee)) return undefined;

  const symbol = checker.getSymbolAtLocation(callee);
  if (!symbol) return undefined;

  const decls = symbol.getDeclarations();
  if (!decls || decls.length === 0) return undefined;

  for (const decl of decls) {
    // Check variable declaration with explicit type
    if (ts.isVariableDeclaration(decl) && decl.type) {
      return decl.type;
    }

    // Check parameter with explicit type
    if (ts.isParameter(decl) && decl.type) {
      return decl.type;
    }

    // Check variable declaration with initializer that's a call
    // e.g., const counter = makeCounter(); where makeCounter(): () => number
    if (ts.isVariableDeclaration(decl) && decl.initializer) {
      if (ts.isCallExpression(decl.initializer)) {
        // Recursively get the return type of the initializer call
        const initReturnType = getDeclaredReturnType(decl.initializer, checker);
        if (initReturnType) {
          // Convert back to a synthetic type node (we can work with IrType)
          // Actually, we need the TypeNode, not IrType
          // Let's try a different approach: look at the function declaration
          const initSig = checker.getResolvedSignature(decl.initializer);
          if (initSig?.declaration) {
            // Get the declared return type of the function being called
            let returnTypeNode: ts.TypeNode | undefined;
            const initDecl = initSig.declaration;
            if (
              ts.isFunctionDeclaration(initDecl) ||
              ts.isMethodDeclaration(initDecl) ||
              ts.isArrowFunction(initDecl) ||
              ts.isFunctionExpression(initDecl)
            ) {
              returnTypeNode = initDecl.type;
            }
            if (returnTypeNode) {
              return returnTypeNode;
            }
          }
        }
      }
    }
  }

  return undefined;
};

export const getDeclaredReturnType = (
  node: ts.CallExpression | ts.NewExpression,
  checker: ts.TypeChecker,
  receiverIrType?: IrType
): IrType | undefined => {
  try {
    // 1. Get resolved signature
    const signature = checker.getResolvedSignature(node);

    // 2. Try to extract return TypeNode from declaration
    const decl = signature?.declaration;
    let returnTypeNode: ts.TypeNode | undefined;

    if (decl) {
      if (
        ts.isMethodSignature(decl) ||
        ts.isMethodDeclaration(decl) ||
        ts.isFunctionDeclaration(decl) ||
        ts.isCallSignatureDeclaration(decl)
      ) {
        returnTypeNode = decl.type;
      } else if (ts.isArrowFunction(decl) || ts.isFunctionExpression(decl)) {
        returnTypeNode = decl.type;
      } else if (ts.isConstructorDeclaration(decl)) {
        // For constructors, the return type is the class type
        // Get it from the parent class declaration
        const classDecl = decl.parent;
        if (ts.isClassDeclaration(classDecl) && classDecl.name) {
          // For new expressions, use the callee's type with type arguments
          if (ts.isNewExpression(node) && node.typeArguments) {
            // Return a reference type with explicit type arguments
            return {
              kind: "referenceType",
              name: classDecl.name.text,
              typeArguments: node.typeArguments.map((ta) =>
                convertType(ta, checker)
              ),
            };
          }
          // No explicit type args - return simple reference
          return { kind: "referenceType", name: classDecl.name.text };
        }
        return undefined;
      }
    }

    // 3. Fallback for function-typed variables
    // For calls like `counter()` where `counter: () => number` or `counter = makeCounter()`
    // Try to get the return type from the callee's declared type
    if (!returnTypeNode && ts.isCallExpression(node)) {
      const calleeDeclaredType = getCalleesDeclaredType(node, checker);
      if (calleeDeclaredType) {
        returnTypeNode = getReturnTypeFromFunctionType(calleeDeclaredType);
      }
    }

    if (!returnTypeNode) return undefined;

    // 4. Convert to IrType first (DETERMINISTIC: from TypeNode, not TS inference)
    const baseReturnType = convertType(returnTypeNode, checker);
    if (!baseReturnType) return undefined;

    // 5. Apply inheritance substitution via NominalEnv for member method calls
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

    // 6. No inheritance substitution needed - return base type
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
  checker: ts.TypeChecker
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
    const targetType = convertType(targetTypeNode, checker);
    const argExpr = convertExpression(argNode, checker, undefined);

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
  const typeArguments = extractTypeArguments(node, checker);
  const requiresSpecialization = checkIfRequiresSpecialization(node, checker);
  const narrowing = extractNarrowing(node, checker);

  // Convert callee first so we can access memberBinding and receiver type
  const callee = convertExpression(node.expression, checker, undefined);

  // Extract receiver type for member method calls (e.g., dict.get() → dict's type)
  const receiverIrType =
    callee.kind === "memberAccess" ? callee.object.inferredType : undefined;

  // Extract parameter types with receiver type for inheritance substitution
  const parameterTypes = extractParameterTypes(node, checker, receiverIrType);

  // Try to get argument passing from binding's parameter modifiers first (tsbindgen format),
  // then fall back to TypeScript declaration analysis (ref<T>/out<T>/in<T> wrapper types)
  const argumentPassing =
    extractArgumentPassingFromBinding(callee, node.arguments.length) ??
    extractArgumentPassing(node, checker);

  // DETERMINISTIC TYPING: Return type comes ONLY from declared TypeNodes.
  // NO fallback to TS inference - that loses CLR type aliases.
  // If getDeclaredReturnType returns undefined, use unknownType as poison
  // so validation can emit TSN5201.
  const declaredReturnType = getDeclaredReturnType(
    node,
    checker,
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
          checker,
          undefined
        );
        return {
          kind: "spread" as const,
          expression: spreadExpr,
          inferredType: spreadExpr.inferredType,
          sourceSpan: getSourceSpan(arg),
        };
      }
      return convertExpression(arg, checker, expectedType);
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
  checker: ts.TypeChecker
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
        typeArguments: node.typeArguments.map((ta) => convertType(ta, checker)),
      };
    }
  }

  // No explicit type arguments - check if the target is generic
  // DETERMINISTIC TYPING: If the type is generic and type args are missing,
  // we cannot infer them deterministically. Return unknownType to trigger TSN5202.
  const symbol = checker.getSymbolAtLocation(node.expression);
  if (symbol) {
    // Get the declared type of the symbol
    const declaredType = checker.getDeclaredTypeOfSymbol(symbol);
    // Check if it has type parameters (is generic)
    const typeParams = (declaredType as ts.InterfaceType).typeParameters;
    if (typeParams && typeParams.length > 0) {
      // Generic type without explicit type arguments - poison with unknownType
      // Validation will emit TSN5202
      return { kind: "unknownType" as const };
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
  checker: ts.TypeChecker
): IrNewExpression => {
  // Extract type arguments from the constructor signature
  const typeArguments = extractTypeArguments(node, checker);
  const requiresSpecialization = checkIfRequiresSpecialization(node, checker);
  const parameterTypes = extractParameterTypes(node, checker);

  // For new expressions, the type is the constructed type from the type reference.
  // Unlike function calls, constructors don't need "return type" annotations.
  // The type is simply what we're instantiating: `new Foo<int>()` → `Foo<int>`.
  const inferredType = getConstructedType(node, checker);

  return {
    kind: "new",
    callee: convertExpression(node.expression, checker, undefined),
    // Pass parameter types as expectedType for deterministic contextual typing
    arguments:
      node.arguments?.map((arg, index) => {
        const expectedType = parameterTypes?.[index];
        if (ts.isSpreadElement(arg)) {
          // DETERMINISTIC: Use expression's inferredType directly
          const spreadExpr = convertExpression(
            arg.expression,
            checker,
            undefined
          );
          return {
            kind: "spread" as const,
            expression: spreadExpr,
            inferredType: spreadExpr.inferredType,
            sourceSpan: getSourceSpan(arg),
          };
        }
        return convertExpression(arg, checker, expectedType);
      }) ?? [],
    inferredType,
    sourceSpan: getSourceSpan(node),
    typeArguments,
    requiresSpecialization,
  };
};
