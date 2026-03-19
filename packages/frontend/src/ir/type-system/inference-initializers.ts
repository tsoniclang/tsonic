/**
 * Initializer & Call Return Type Inference
 *
 * Contains:
 * - tryInferTypeFromLiteralInitializer: simple literal → IrType
 * - tryInferReturnTypeFromCallExpression: call expression → return type
 * - tryInferTypeFromInitializer: variable initializer → IrType
 *
 * DAG position: depends on inference-utilities, inference-expressions,
 *               inference-declarations, inference-member-resolution
 */

import type { IrType } from "../types/index.js";
import * as ts from "typescript";
import { inferNumericKindFromRaw } from "../types/numeric-helpers.js";
import type { TypeSystemState } from "./type-system-state.js";
import { stripNullishForInference } from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";
import { convertTypeNode, resolveCall } from "./type-system-call-resolution.js";
import { resolveDynamicImportNamespace } from "../../resolver/dynamic-import.js";
import {
  isLambdaExpression,
  deriveTypeFromNumericKind,
  unwrapAwaitedForInference,
  collectResolutionArgTypes,
} from "./inference-utilities.js";
import {
  inferExpressionType,
  inferLambdaType,
} from "./inference-expressions.js";
import { typeOfDecl } from "./inference-declarations.js";
import { typeOfMember } from "./inference-member-resolution.js";

/**
 * Try to infer type from a variable declaration's literal initializer.
 *
 * DETERMINISM: Uses the raw lexeme form of the literal, not TS computed types.
 * Only handles simple literal initializers:
 * - Numeric literals → inferred via inferNumericKindFromRaw
 * - String literals → primitiveType("string")
 * - Boolean literals → primitiveType("boolean")
 *
 * Returns undefined if the initializer is not a simple literal.
 */
export const tryInferTypeFromLiteralInitializer = (
  _state: TypeSystemState,
  declNode: unknown
): IrType | undefined => {
  // TypeScript's VariableDeclaration has an `initializer` property
  const decl = declNode as {
    kind?: number;
    initializer?: {
      kind?: number;
      text?: string;
      getText?: () => string;
    };
  };

  // Must have an initializer
  if (!decl.initializer) return undefined;

  const init = decl.initializer;

  if (init.kind === ts.SyntaxKind.NumericLiteral && init.getText) {
    const raw = init.getText();
    const numericKind = inferNumericKindFromRaw(raw);
    return deriveTypeFromNumericKind(numericKind);
  }

  if (init.kind === ts.SyntaxKind.StringLiteral) {
    return { kind: "primitiveType", name: "string" };
  }

  if (
    init.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral ||
    init.kind === ts.SyntaxKind.TemplateExpression
  ) {
    return { kind: "primitiveType", name: "string" };
  }

  if (
    init.kind === ts.SyntaxKind.TrueKeyword ||
    init.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return { kind: "primitiveType", name: "boolean" };
  }

  // Not a simple literal - cannot infer
  return undefined;
};

/**
 * Try to infer type from a variable declaration's initializer using only
 * deterministic sources (declarations + explicit syntax).
 *
 * Handles:
 * - simple literals (delegates to tryInferTypeFromLiteralInitializer)
 * - call expressions where the callee has an explicit declared return type
 * - new expressions with explicit type arguments (or best-effort nominal type)
 * - identifier initializers (propagate deterministically)
 */
export const tryInferReturnTypeFromCallExpression = (
  state: TypeSystemState,
  call: ts.CallExpression,
  env: ReadonlyMap<string, IrType>
): IrType | undefined => {
  if (call.expression.kind === ts.SyntaxKind.ImportKeyword) {
    const resolution = resolveDynamicImportNamespace(
      call,
      call.getSourceFile().fileName,
      {
        checker: state.checker,
        compilerOptions: state.tsCompilerOptions,
        sourceFilesByPath: state.sourceFilesByPath,
      }
    );

    if (resolution.ok) {
      const members = resolution.entries.flatMap((entry) => {
        const declId = state.resolveIdentifier(entry.declarationName);
        if (!declId) return [];

        const memberType = typeOfDecl(state, declId);
        if (memberType.kind === "unknownType") return [];

        return [
          {
            kind: "propertySignature" as const,
            name: entry.exportName,
            type: memberType,
            isOptional: false,
            isReadonly: true,
          },
        ];
      });

      return {
        kind: "referenceType",
        name: "Promise",
        typeArguments: [
          members.length === 0
            ? { kind: "referenceType", name: "object" }
            : {
                kind: "objectType",
                members,
              },
        ],
      };
    }
  }

  const sigId = state.resolveCallSignature(call);
  if (!sigId) return undefined;

  const explicitTypeArgs =
    call.typeArguments && call.typeArguments.length > 0
      ? call.typeArguments.map((ta) => convertTypeNode(state, ta))
      : undefined;

  const receiverType = (() => {
    if (!ts.isPropertyAccessExpression(call.expression)) return undefined;
    const receiverExpr = call.expression.expression;
    const receiver = inferExpressionType(state, receiverExpr, env);
    return receiver && receiver.kind !== "unknownType" ? receiver : undefined;
  })();

  const argumentCount = call.arguments.length;

  // Two-pass: resolve once to get expected parameter types, then infer non-lambda args,
  // then infer lambda arg types (from expected types + body), then final resolve.
  const initialResolved = resolveCall(state, {
    sigId,
    argumentCount,
    receiverType,
    explicitTypeArgs,
  });
  const initialParameterTypes = initialResolved.parameterTypes;

  const argTypesWorking: (IrType | undefined)[] =
    Array(argumentCount).fill(undefined);

  for (let index = 0; index < call.arguments.length; index++) {
    const arg = call.arguments[index];
    if (!arg) continue;
    if (ts.isSpreadElement(arg)) {
      const spreadType = inferExpressionType(state, arg.expression, env);
      if (spreadType && spreadType.kind !== "unknownType") {
        argTypesWorking[index] = spreadType;
      }
      continue;
    }
    if (isLambdaExpression(arg)) continue;

    if (ts.isNumericLiteral(arg)) {
      const numericKind = inferNumericKindFromRaw(arg.getText());
      argTypesWorking[index] = deriveTypeFromNumericKind(numericKind);
      continue;
    }

    if (ts.isStringLiteral(arg)) {
      argTypesWorking[index] = { kind: "primitiveType", name: "string" };
      continue;
    }

    if (
      arg.kind === ts.SyntaxKind.TrueKeyword ||
      arg.kind === ts.SyntaxKind.FalseKeyword
    ) {
      argTypesWorking[index] = {
        kind: "primitiveType",
        name: "boolean",
      };
      continue;
    }

    if (ts.isIdentifier(arg)) {
      const argDeclId = state.resolveIdentifier(arg);
      if (!argDeclId) continue;
      const t = typeOfDecl(state, argDeclId);
      if (t.kind !== "unknownType") {
        argTypesWorking[index] = t;
      }
      continue;
    }

    if (ts.isCallExpression(arg)) {
      const t = tryInferReturnTypeFromCallExpression(state, arg, env);
      if (t) {
        argTypesWorking[index] = t;
      }
      continue;
    }

    if (ts.isNewExpression(arg)) {
      const nestedSigId = state.resolveConstructorSignature(arg);
      if (!nestedSigId) continue;

      const nestedExplicitTypeArgs =
        arg.typeArguments && arg.typeArguments.length > 0
          ? arg.typeArguments.map((ta) => convertTypeNode(state, ta))
          : undefined;

      const nestedResolved = resolveCall(state, {
        sigId: nestedSigId,
        argumentCount: arg.arguments?.length ?? 0,
        explicitTypeArgs: nestedExplicitTypeArgs,
      });

      if (nestedResolved.returnType.kind !== "unknownType") {
        argTypesWorking[index] = nestedResolved.returnType;
      }
      continue;
    }

    // Fallback: infer from a small deterministic expression set (identifiers, literals,
    // arithmetic, nested member/index access, calls, etc).
    const t = inferExpressionType(state, arg, env);
    if (t && t.kind !== "unknownType") {
      argTypesWorking[index] = t;
      continue;
    }
  }

  const lambdaResolutionArgs = collectResolutionArgTypes(argTypesWorking);

  const lambdaContextResolved = resolveCall(state, {
    sigId,
    argumentCount:
      lambdaResolutionArgs.argumentCount > 0
        ? lambdaResolutionArgs.argumentCount
        : argumentCount,
    receiverType,
    explicitTypeArgs,
    argTypes:
      lambdaResolutionArgs.argumentCount > 0
        ? lambdaResolutionArgs.argTypes
        : argTypesWorking,
  });

  const parameterTypesForLambdaContext =
    lambdaContextResolved.parameterTypes ?? initialParameterTypes;

  for (let index = 0; index < call.arguments.length; index++) {
    const arg = call.arguments[index];
    if (!arg) continue;
    if (ts.isSpreadElement(arg)) continue;
    if (!isLambdaExpression(arg)) continue;

    const expectedType = parameterTypesForLambdaContext[index];
    const lambdaType = inferLambdaType(state, arg, expectedType);
    if (lambdaType) {
      argTypesWorking[index] = lambdaType;
    }
  }

  const finalResolutionArgs = collectResolutionArgTypes(argTypesWorking);

  const finalResolved = resolveCall(state, {
    sigId,
    argumentCount:
      finalResolutionArgs.argumentCount > 0
        ? finalResolutionArgs.argumentCount
        : argumentCount,
    receiverType,
    explicitTypeArgs,
    argTypes:
      finalResolutionArgs.argumentCount > 0
        ? finalResolutionArgs.argTypes
        : argTypesWorking,
  });

  return finalResolved.returnType.kind === "unknownType"
    ? undefined
    : finalResolved.returnType;
};

export const tryInferTypeFromInitializer = (
  state: TypeSystemState,
  declNode: unknown
): IrType | undefined => {
  const literalType = tryInferTypeFromLiteralInitializer(state, declNode);
  if (literalType) return literalType;

  if (!declNode || typeof declNode !== "object") return undefined;

  const node = declNode as ts.Node;
  if (!ts.isVariableDeclaration(node)) return undefined;
  let init = node.initializer;
  if (!init) return undefined;

  while (ts.isParenthesizedExpression(init)) {
    init = init.expression;
  }

  // Explicit type assertions are deterministic sources for variable typing.
  // This supports patterns like:
  //   const xs = numbers as unknown as LinqSeq<int>;
  // where the user intentionally supplies the type at the assertion site.
  if (ts.isAsExpression(init) || ts.isTypeAssertionExpression(init)) {
    return convertTypeNode(state, init.type);
  }

  if (ts.isNonNullExpression(init)) {
    const inner = inferExpressionType(state, init.expression, new Map());
    if (!inner || inner.kind === "unknownType") return undefined;
    return stripNullishForInference(inner);
  }

  if (ts.isAwaitExpression(init)) {
    const inner = inferExpressionType(state, init.expression, new Map());
    if (!inner || inner.kind === "unknownType") return undefined;
    return unwrapAwaitedForInference(inner);
  }

  if (ts.isCallExpression(init)) {
    return tryInferReturnTypeFromCallExpression(state, init, new Map());
  }

  if (isLambdaExpression(init)) {
    return inferLambdaType(state, init, undefined);
  }

  if (ts.isArrayLiteralExpression(init)) {
    // Deterministic array literal typing for variable declarations:
    // infer `T[]` only when all element types are deterministically known and equal.
    const elementTypes: IrType[] = [];
    const emptyEnv = new Map<string, IrType>();
    for (const el of init.elements) {
      if (ts.isOmittedExpression(el)) {
        return undefined;
      }
      if (ts.isSpreadElement(el)) {
        return undefined;
      }

      const t = inferExpressionType(state, el, emptyEnv);
      if (!t || t.kind === "unknownType") {
        return undefined;
      }
      elementTypes.push(t);
    }

    if (elementTypes.length === 0) return undefined;
    const first = elementTypes[0];
    if (first && elementTypes.every((t) => typesEqual(t, first))) {
      return { kind: "arrayType", elementType: first };
    }

    return undefined;
  }

  const fallback = inferExpressionType(state, init, new Map());
  if (fallback && fallback.kind !== "unknownType") {
    return fallback;
  }

  // Phase 15: NewExpression branch - use constructor signature with argTypes
  if (ts.isNewExpression(init)) {
    const sigId = state.resolveConstructorSignature(init);
    if (!sigId) return undefined;

    const explicitTypeArgs =
      init.typeArguments && init.typeArguments.length > 0
        ? init.typeArguments.map((ta) => convertTypeNode(state, ta))
        : undefined;

    // Derive argTypes conservatively from syntax (same pattern as CallExpression)
    const args = init.arguments ?? [];
    const argTypes: (IrType | undefined)[] = args.map((arg) => {
      if (ts.isSpreadElement(arg)) return undefined;

      if (ts.isNumericLiteral(arg)) {
        const numericKind = inferNumericKindFromRaw(arg.getText());
        return deriveTypeFromNumericKind(numericKind);
      }

      if (ts.isStringLiteral(arg)) {
        return { kind: "primitiveType" as const, name: "string" };
      }

      if (
        arg.kind === ts.SyntaxKind.TrueKeyword ||
        arg.kind === ts.SyntaxKind.FalseKeyword
      ) {
        return { kind: "primitiveType" as const, name: "boolean" };
      }

      if (ts.isIdentifier(arg)) {
        const argDeclId = state.resolveIdentifier(arg);
        if (!argDeclId) return undefined;
        const t = typeOfDecl(state, argDeclId);
        return t.kind === "unknownType" ? undefined : t;
      }

      // Recursive handling for nested new expressions
      if (ts.isNewExpression(arg)) {
        const nestedSigId = state.resolveConstructorSignature(arg);
        if (!nestedSigId) return undefined;

        const nestedExplicitTypeArgs =
          arg.typeArguments && arg.typeArguments.length > 0
            ? arg.typeArguments.map((ta) => convertTypeNode(state, ta))
            : undefined;

        const nestedResolved = resolveCall(state, {
          sigId: nestedSigId,
          argumentCount: arg.arguments?.length ?? 0,
          explicitTypeArgs: nestedExplicitTypeArgs,
        });

        return nestedResolved.returnType.kind === "unknownType"
          ? undefined
          : nestedResolved.returnType;
      }

      return undefined;
    });

    // Resolve constructor call with argTypes for inference
    const resolved = resolveCall(state, {
      sigId,
      argumentCount: args.length,
      explicitTypeArgs,
      argTypes,
    });

    return resolved.returnType.kind === "unknownType"
      ? undefined
      : resolved.returnType;
  }

  if (ts.isIdentifier(init)) {
    const sourceDeclId = state.resolveIdentifier(init);
    if (!sourceDeclId) return undefined;
    const sourceType = typeOfDecl(state, sourceDeclId);
    return sourceType.kind === "unknownType" ? undefined : sourceType;
  }

  // Property access: const output = response.outputStream
  // DETERMINISTIC: Infer via TypeSystem member lookup on a deterministically typed receiver.
  if (ts.isPropertyAccessExpression(init)) {
    const receiverType = inferExpressionType(state, init.expression, new Map());
    if (!receiverType || receiverType.kind === "unknownType") return undefined;

    const memberType = typeOfMember(state, receiverType, {
      kind: "byName",
      name: init.name.text,
    });

    return memberType.kind === "unknownType" ? undefined : memberType;
  }

  // Element access: const first = items[0]
  // DETERMINISTIC: Infer element type from a deterministically typed receiver.
  if (ts.isElementAccessExpression(init)) {
    const inferred = inferExpressionType(state, init, new Map());
    return inferred && inferred.kind !== "unknownType" ? inferred : undefined;
  }

  const inferred = inferExpressionType(state, init, new Map());
  if (inferred && inferred.kind !== "unknownType") {
    return inferred;
  }

  return undefined;
};
