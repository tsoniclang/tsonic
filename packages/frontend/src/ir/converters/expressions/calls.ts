/**
 * Call and new expression converters
 */

import * as ts from "typescript";
import { IrCallExpression, IrNewExpression } from "../../types.js";
import {
  getInferredType,
  getSourceSpan,
  extractTypeArguments,
  checkIfRequiresSpecialization,
} from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import { convertType, convertTsTypeToIr } from "../../type-converter.js";
import { IrType } from "../../types.js";

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
 * Safely convert a ts.Type to IrType
 */
const convertTsTypeToIrSafe = (
  tsType: ts.Type,
  node: ts.Node,
  checker: ts.TypeChecker
): IrType | undefined => {
  try {
    const typeNode = checker.typeToTypeNode(
      tsType,
      node,
      ts.NodeBuilderFlags.None
    );
    return typeNode
      ? convertType(typeNode, checker)
      : convertTsTypeToIr(tsType, checker);
  } catch {
    return undefined;
  }
};

/**
 * Extract type predicate narrowing metadata from a call expression.
 * Returns narrowing info if the callee is a type predicate function (x is T).
 */
const extractNarrowing = (
  node: ts.CallExpression,
  checker: ts.TypeChecker
): IrCallExpression["narrowing"] => {
  try {
    const sig = checker.getResolvedSignature(node);
    if (!sig) return undefined;

    const pred = checker.getTypePredicateOfSignature(sig);
    // We only handle "param is T" predicates (not "this is T")
    if (
      pred &&
      pred.kind === ts.TypePredicateKind.Identifier &&
      pred.parameterIndex !== undefined &&
      pred.type
    ) {
      const targetType = convertTsTypeToIrSafe(pred.type, node, checker);
      if (targetType) {
        return {
          kind: "typePredicate",
          argIndex: pred.parameterIndex,
          targetType,
        };
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
};

/**
 * Build a substitution map from type parameter names to their instantiated TypeNodes.
 *
 * For a call like `dict.add(key, value)` where `dict: Dictionary<int, Todo>`,
 * this returns a map: { "TKey" -> int TypeNode, "TValue" -> Todo TypeNode }
 *
 * The key insight is that the RECEIVER's type (Dictionary<int, Todo>) preserves
 * the type arguments as TypeNodes, which in turn preserve CLR type aliases.
 * TypeScript's type instantiation mechanism loses aliasSymbol, but TypeNodes don't.
 */
const buildTypeParameterSubstitutionMap = (
  node: ts.CallExpression | ts.NewExpression,
  checker: ts.TypeChecker
): ReadonlyMap<string, ts.TypeNode> | undefined => {
  // For method calls, get the receiver's type arguments
  // e.g., for dict.add(...), get Dictionary<int, Todo>'s type arguments
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression)
  ) {
    const receiver = node.expression.expression;
    const receiverType = checker.getTypeAtLocation(receiver);

    // Get the class/interface/type alias declaration that defines the type parameters
    // For type aliases like Dictionary_2<TKey, TValue>, use aliasSymbol
    // For classes/interfaces, use getSymbol()
    const symbol = receiverType.aliasSymbol ?? receiverType.getSymbol();
    if (!symbol) return undefined;

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return undefined;

    // Find the class/interface/type alias declaration with type parameters
    let typeParamDecls: readonly ts.TypeParameterDeclaration[] | undefined;
    for (const decl of declarations) {
      if (ts.isClassDeclaration(decl) && decl.typeParameters) {
        typeParamDecls = decl.typeParameters;
        break;
      }
      if (ts.isInterfaceDeclaration(decl) && decl.typeParameters) {
        typeParamDecls = decl.typeParameters;
        break;
      }
      if (ts.isTypeAliasDeclaration(decl) && decl.typeParameters) {
        typeParamDecls = decl.typeParameters;
        break;
      }
    }

    if (!typeParamDecls || typeParamDecls.length === 0) return undefined;

    // Get the type arguments from the receiver's type
    // IMPORTANT: We must trace back to the ORIGINAL source code AST to preserve
    // CLR type aliases like `int`. TypeScript's typeToTypeNode() does NOT preserve
    // type aliases - it synthesizes primitive keywords like NumberKeyword instead.
    //
    // Look for the variable declaration that has type arguments in:
    // 1. Explicit type annotation: const dict: Dictionary<int, Todo> = ...
    // 2. NewExpression initializer: const dict = new Dictionary<int, Todo>()
    // 3. Other declaration forms (property, parameter)
    const receiverSymbol = checker.getSymbolAtLocation(receiver);
    if (receiverSymbol) {
      const receiverDecls = receiverSymbol.getDeclarations();
      if (receiverDecls) {
        for (const decl of receiverDecls) {
          // Helper to build substitution map from type argument nodes
          const buildMapFromTypeArgs = (
            typeArgNodes: ts.NodeArray<ts.TypeNode>
          ): Map<string, ts.TypeNode> | undefined => {
            if (
              typeParamDecls &&
              typeArgNodes.length === typeParamDecls.length
            ) {
              const substitutionMap = new Map<string, ts.TypeNode>();
              for (let i = 0; i < typeParamDecls.length; i++) {
                const paramDecl = typeParamDecls[i];
                const argNode = typeArgNodes[i];
                if (paramDecl && argNode) {
                  substitutionMap.set(paramDecl.name.text, argNode);
                }
              }
              return substitutionMap;
            }
            return undefined;
          };

          // Check explicit type annotation first
          if (ts.isVariableDeclaration(decl) && decl.type) {
            if (ts.isTypeReferenceNode(decl.type) && decl.type.typeArguments) {
              const result = buildMapFromTypeArgs(decl.type.typeArguments);
              if (result) return result;
            }
          }

          // Check initializer: new Dictionary<int, Todo>()
          // This handles: const todos = new Dictionary<int, Todo>();
          if (ts.isVariableDeclaration(decl) && decl.initializer) {
            if (
              ts.isNewExpression(decl.initializer) &&
              decl.initializer.typeArguments
            ) {
              const result = buildMapFromTypeArgs(
                decl.initializer.typeArguments
              );
              if (result) return result;
            }
          }

          // Also check property declarations with type annotation
          if (
            ts.isPropertyDeclaration(decl) &&
            decl.type &&
            ts.isTypeReferenceNode(decl.type) &&
            decl.type.typeArguments
          ) {
            const result = buildMapFromTypeArgs(decl.type.typeArguments);
            if (result) return result;
          }

          // Check property declaration initializer
          if (ts.isPropertyDeclaration(decl) && decl.initializer) {
            if (
              ts.isNewExpression(decl.initializer) &&
              decl.initializer.typeArguments
            ) {
              const result = buildMapFromTypeArgs(
                decl.initializer.typeArguments
              );
              if (result) return result;
            }
          }

          // Check parameter declarations
          if (
            ts.isParameter(decl) &&
            decl.type &&
            ts.isTypeReferenceNode(decl.type) &&
            decl.type.typeArguments
          ) {
            const result = buildMapFromTypeArgs(decl.type.typeArguments);
            if (result) return result;
          }
        }
      }
    }
  }

  return undefined;
};

/**
 * Substitute type parameters in a TypeNode using the substitution map.
 * For a type like `TKey`, returns the substituted TypeNode (e.g., `int`).
 * For complex types like `List<TKey>`, recursively substitutes.
 *
 * Returns the substituted TypeNode, or undefined if no substitution needed.
 */
const substituteTypeNode = (
  typeNode: ts.TypeNode,
  substitutionMap: ReadonlyMap<string, ts.TypeNode>,
  checker: ts.TypeChecker
): ts.TypeNode | undefined => {
  // Handle type reference nodes (most common case)
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = ts.isIdentifier(typeNode.typeName)
      ? typeNode.typeName.text
      : typeNode.typeName.getText();

    // Direct substitution: if this is a type parameter, substitute it
    const substitution = substitutionMap.get(typeName);
    if (substitution) {
      return substitution;
    }

    // Recursive substitution: if this is a generic type, substitute its type arguments
    if (typeNode.typeArguments && typeNode.typeArguments.length > 0) {
      let anySubstituted = false;
      const newTypeArgs: ts.TypeNode[] = [];
      for (const arg of typeNode.typeArguments) {
        const substituted = substituteTypeNode(arg, substitutionMap, checker);
        if (substituted) {
          newTypeArgs.push(substituted);
          anySubstituted = true;
        } else {
          newTypeArgs.push(arg);
        }
      }
      if (anySubstituted) {
        // Create a new type reference with substituted type arguments
        // We use the factory to create a new node
        return ts.factory.createTypeReferenceNode(
          typeNode.typeName,
          newTypeArgs
        );
      }
    }
  }

  // Handle array types: T[] -> int[]
  if (ts.isArrayTypeNode(typeNode)) {
    const substituted = substituteTypeNode(
      typeNode.elementType,
      substitutionMap,
      checker
    );
    if (substituted) {
      return ts.factory.createArrayTypeNode(substituted);
    }
  }

  // Handle union types: T | null -> int | null
  if (ts.isUnionTypeNode(typeNode)) {
    let anySubstituted = false;
    const newTypes: ts.TypeNode[] = [];
    for (const member of typeNode.types) {
      const substituted = substituteTypeNode(member, substitutionMap, checker);
      if (substituted) {
        newTypes.push(substituted);
        anySubstituted = true;
      } else {
        newTypes.push(member);
      }
    }
    if (anySubstituted) {
      return ts.factory.createUnionTypeNode(newTypes);
    }
  }

  return undefined;
};

/**
 * Extract parameter types from resolved signature.
 * Used for threading expectedType to array literal arguments etc.
 *
 * Uses the resolved signature to get INSTANTIATED parameter types.
 * For example, for `dict.add(key, value)` where `dict: Dictionary<int, Todo>`,
 * this returns the instantiated types [int, Todo], not the formal types [TKey, TValue].
 *
 * CLR type aliases (like `int`) are preserved by:
 * 1. For non-type-parameter declarations: use the declaration's type node directly
 * 2. For type parameters: use TypeNode substitution to preserve CLR aliases
 *
 * The key insight is that TypeScript's type instantiation mechanism loses
 * aliasSymbol, but the original TypeNodes in variable declarations preserve
 * the type aliases. We trace back to those TypeNodes and substitute.
 */
const extractParameterTypes = (
  node: ts.CallExpression | ts.NewExpression,
  checker: ts.TypeChecker
): readonly (IrType | undefined)[] | undefined => {
  try {
    const signature = checker.getResolvedSignature(node);
    if (!signature) {
      return undefined;
    }

    const sigParams = signature.getParameters();
    if (sigParams.length === 0) {
      return undefined;
    }

    // Build type parameter substitution map from receiver's type arguments
    // This preserves CLR type aliases through generic instantiation
    const substitutionMap = buildTypeParameterSubstitutionMap(node, checker);

    // Build parameter type array using instantiated types from signature
    const paramTypes: (IrType | undefined)[] = [];

    for (const sigParam of sigParams) {
      const decl = sigParam.valueDeclaration;

      // Get the declaration's type node if available
      if (decl && ts.isParameter(decl) && decl.type) {
        // Check if the declaration type is a type parameter
        const declType = checker.getTypeAtLocation(decl.type);
        const isTypeParameter = Boolean(
          declType.flags & ts.TypeFlags.TypeParameter
        );

        if (isTypeParameter && substitutionMap) {
          // Type parameter case: use substitution map to preserve CLR aliases
          const substituted = substituteTypeNode(
            decl.type,
            substitutionMap,
            checker
          );
          if (substituted) {
            const irType = convertType(substituted, checker);
            if (irType) {
              paramTypes.push(irType);
              continue;
            }
          }
        } else if (!isTypeParameter) {
          // Non-type-parameter: use declaration type node directly
          // This preserves imported CLR type aliases like `int`
          const irType = convertType(decl.type, checker);
          if (irType) {
            paramTypes.push(irType);
            continue;
          }
        }
      }

      // Fallback: Use instantiated type from getTypeOfSymbolAtLocation
      // This handles cases where substitution doesn't apply or fails
      const paramType = checker.getTypeOfSymbolAtLocation(
        sigParam,
        decl ?? node
      );
      const irType = convertTsTypeToIr(paramType, checker);
      paramTypes.push(irType);
    }

    return paramTypes;
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
): IrCallExpression => {
  // Extract type arguments from the call signature
  const typeArguments = extractTypeArguments(node, checker);
  const requiresSpecialization = checkIfRequiresSpecialization(node, checker);
  const narrowing = extractNarrowing(node, checker);
  const parameterTypes = extractParameterTypes(node, checker);

  // Convert callee first so we can access its memberBinding
  const callee = convertExpression(node.expression, checker);

  // Try to get argument passing from binding's parameter modifiers first (tsbindgen format),
  // then fall back to TypeScript declaration analysis (ref<T>/out<T>/in<T> wrapper types)
  const argumentPassing =
    extractArgumentPassingFromBinding(callee, node.arguments.length) ??
    extractArgumentPassing(node, checker);

  return {
    kind: "call",
    callee,
    arguments: node.arguments.map((arg) => {
      if (ts.isSpreadElement(arg)) {
        return {
          kind: "spread" as const,
          expression: convertExpression(arg.expression, checker),
          sourceSpan: getSourceSpan(arg),
        };
      }
      return convertExpression(arg, checker);
    }),
    isOptional: node.questionDotToken !== undefined,
    inferredType: getInferredType(node, checker),
    sourceSpan: getSourceSpan(node),
    typeArguments,
    requiresSpecialization,
    argumentPassing,
    parameterTypes,
    narrowing,
  };
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

  return {
    kind: "new",
    callee: convertExpression(node.expression, checker),
    arguments:
      node.arguments?.map((arg) => {
        if (ts.isSpreadElement(arg)) {
          return {
            kind: "spread" as const,
            expression: convertExpression(arg.expression, checker),
            sourceSpan: getSourceSpan(arg),
          };
        }
        return convertExpression(arg, checker);
      }) ?? [],
    inferredType: getInferredType(node, checker),
    sourceSpan: getSourceSpan(node),
    typeArguments,
    requiresSpecialization,
  };
};
