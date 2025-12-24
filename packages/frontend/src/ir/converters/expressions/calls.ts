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
 * Extract parameter types from resolved signature.
 * Used for threading expectedType to array literal arguments etc.
 *
 * Uses the resolved signature to get INSTANTIATED parameter types.
 * For example, for `dict.add(key, value)` where `dict: Dictionary<string, int>`,
 * this returns the instantiated types [string, int], not the formal types [TKey, TValue].
 *
 * CLR type aliases (like `int`) are preserved by:
 * 1. First checking the parameter's declaration type node (preserves imported aliases)
 * 2. Falling back to aliasSymbol mechanism for in-file type aliases
 *
 * Note: TypeScript's aliasSymbol is NOT preserved for imported type aliases,
 * so we must check the declaration's type node directly for imported types like
 * `int` from @tsonic/core/types.js.
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

    // Build parameter type array using instantiated types from signature
    const paramTypes: (IrType | undefined)[] = [];

    for (const sigParam of sigParams) {
      const decl = sigParam.valueDeclaration;

      // Strategy 1: Use the declaration's type node if available
      // This preserves imported CLR type aliases like `int` that TypeScript
      // would otherwise resolve to `number` without aliasSymbol
      if (decl && ts.isParameter(decl) && decl.type) {
        const irType = convertType(decl.type, checker);
        if (irType) {
          paramTypes.push(irType);
          continue;
        }
      }

      // Strategy 2: Fall back to getTypeOfSymbolAtLocation + convertTsTypeToIr
      // This handles cases where there's no declaration (rare) or type node
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
