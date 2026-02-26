/**
 * TypeSystem Inference — Expression Type Inference, Declaration/Member Queries,
 * and Declaration Inspection Utilities
 *
 * Extracted from the monolithic type-system.ts. Contains:
 * - Expression type inference (inferExpressionType, inferLambdaType)
 * - Declaration type queries (typeOfDecl, typeOfMember, typeOfMemberId)
 * - Initializer inference (tryInferTypeFromLiteralInitializer, tryInferTypeFromInitializer)
 * - Call return type inference (tryInferReturnTypeFromCallExpression)
 * - Declaration inspection utilities (hasTypeParameters, isTypeDecl, etc.)
 *
 * DAG position: depends on type-system-state, type-system-relations, type-system-call-resolution
 */

import type {
  IrType,
  IrFunctionType,
  IrParameter,
  IrReferenceType,
} from "../types/index.js";
import * as ts from "typescript";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import { inferNumericKindFromRaw } from "../types/numeric-helpers.js";
import {
  getBinaryResultKind,
  TSONIC_TO_NUMERIC_KIND,
} from "../types/numeric-kind.js";
import type { NumericKind } from "../types/numeric-kind.js";
import type { DeclId, SignatureId, MemberId, TypeSyntaxId } from "./types.js";
import { unknownType, voidType } from "./types.js";
import type {
  TypeSystemState,
  Site,
  MemberRef,
  DeclKind,
} from "./type-system-state.js";
import {
  emitDiagnostic,
  normalizeToNominal,
  isNullishPrimitive,
  makeMemberCacheKey,
  stripNullishForInference,
} from "./type-system-state.js";
import { typesEqual, containsTypeParameter } from "./type-system-relations.js";
import {
  convertTypeNode,
  lookupStructuralMember,
  resolveCall,
  delegateToFunctionType,
} from "./type-system-call-resolution.js";

// ─────────────────────────────────────────────────────────────────────────
// typeOfDecl — Get declared type of a declaration
// ─────────────────────────────────────────────────────────────────────────

/**
 * Derive IrType from NumericKind (deterministic, no TypeScript).
 * Mirrors the logic in literals.ts deriveTypeFromNumericIntent.
 */
export const deriveTypeFromNumericKind = (kind: NumericKind): IrType => {
  if (kind === "Int32") return { kind: "referenceType", name: "int" };
  if (kind === "Int64") return { kind: "referenceType", name: "long" };
  if (kind === "Double") return { kind: "primitiveType", name: "number" };
  if (kind === "Single") return { kind: "referenceType", name: "float" };
  if (kind === "Byte") return { kind: "referenceType", name: "byte" };
  if (kind === "Int16") return { kind: "referenceType", name: "short" };
  if (kind === "UInt32") return { kind: "referenceType", name: "uint" };
  if (kind === "UInt64") return { kind: "referenceType", name: "ulong" };
  if (kind === "UInt16") return { kind: "referenceType", name: "ushort" };
  if (kind === "SByte") return { kind: "referenceType", name: "sbyte" };
  // Default to double for unknown
  return { kind: "primitiveType", name: "number" };
};

export const unwrapParens = (expr: ts.Expression): ts.Expression => {
  let current: ts.Expression = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
};

export const isLambdaExpression = (expr: ts.Expression): boolean => {
  const unwrapped = unwrapParens(expr);
  return ts.isArrowFunction(unwrapped) || ts.isFunctionExpression(unwrapped);
};

export const getNumericKindFromIrType = (
  type: IrType
): NumericKind | undefined => {
  if (type.kind === "primitiveType" && type.name === "number") return "Double";
  if (type.kind === "primitiveType") {
    return TSONIC_TO_NUMERIC_KIND.get(type.name);
  }
  if (type.kind === "referenceType") {
    return TSONIC_TO_NUMERIC_KIND.get(type.name);
  }
  return undefined;
};

export const unwrapAwaitedForInference = (type: IrType): IrType => {
  if (type.kind === "unionType") {
    return {
      kind: "unionType",
      types: type.types.map((t) => (t ? unwrapAwaitedForInference(t) : t)),
    };
  }

  if (
    type.kind === "referenceType" &&
    (type.name === "Promise" || type.name === "PromiseLike")
  ) {
    const inner = type.typeArguments?.[0];
    if (inner) return unwrapAwaitedForInference(inner);
  }

  if (type.kind === "referenceType") {
    const clrName = type.typeId?.clrName;
    if (
      clrName === "System.Threading.Tasks.Task" ||
      clrName === "System.Threading.Tasks.ValueTask"
    ) {
      return voidType;
    }

    if (
      clrName?.startsWith("System.Threading.Tasks.Task`") ||
      clrName?.startsWith("System.Threading.Tasks.ValueTask`")
    ) {
      const inner = type.typeArguments?.[0];
      if (inner) return unwrapAwaitedForInference(inner);
    }
  }

  return type;
};

/**
 * Deterministically infer an expression's type using only:
 * - local lambda parameter environment
 * - declaration types (typeOfDecl)
 * - numeric literal lexeme rules
 *
 * This is intentionally small: it's used only to type lambda bodies for
 * initializer-driven generic inference (e.g., `Enumerable.select(..., x => x * 2)`).
 */
export const inferExpressionType = (
  state: TypeSystemState,
  expr: ts.Expression,
  env: ReadonlyMap<string, IrType>
): IrType | undefined => {
  const unwrapped = unwrapParens(expr);

  if (ts.isAsExpression(unwrapped) || ts.isTypeAssertionExpression(unwrapped)) {
    return convertTypeNode(state, unwrapped.type);
  }

  if (ts.isNonNullExpression(unwrapped)) {
    const inner = inferExpressionType(state, unwrapped.expression, env);
    if (!inner || inner.kind === "unknownType") return undefined;
    return stripNullishForInference(inner);
  }

  if (ts.isAwaitExpression(unwrapped)) {
    const inner = inferExpressionType(state, unwrapped.expression, env);
    if (!inner || inner.kind === "unknownType") return undefined;
    return unwrapAwaitedForInference(inner);
  }

  if (ts.isCallExpression(unwrapped)) {
    return tryInferReturnTypeFromCallExpression(state, unwrapped, env);
  }

  if (ts.isNewExpression(unwrapped)) {
    const sigId = state.resolveConstructorSignature(unwrapped);
    if (!sigId) return undefined;

    const explicitTypeArgs =
      unwrapped.typeArguments && unwrapped.typeArguments.length > 0
        ? unwrapped.typeArguments.map((ta) => convertTypeNode(state, ta))
        : undefined;

    const argumentCount = unwrapped.arguments?.length ?? 0;
    const argTypesWorking: (IrType | undefined)[] =
      Array(argumentCount).fill(undefined);

    const args = unwrapped.arguments ?? [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (!arg) continue;
      if (ts.isSpreadElement(arg)) continue;
      if (isLambdaExpression(arg)) continue;

      const t = inferExpressionType(state, arg, env);
      if (t && t.kind !== "unknownType") {
        argTypesWorking[i] = t;
      }
    }

    const resolved = resolveCall(state, {
      sigId,
      argumentCount,
      explicitTypeArgs,
      argTypes: argTypesWorking,
    });

    return resolved.returnType.kind === "unknownType"
      ? undefined
      : resolved.returnType;
  }

  if (ts.isPropertyAccessExpression(unwrapped)) {
    const receiverType = inferExpressionType(state, unwrapped.expression, env);
    if (!receiverType || receiverType.kind === "unknownType") return undefined;
    const memberType = typeOfMember(state, receiverType, {
      kind: "byName",
      name: unwrapped.name.text,
    });
    return memberType.kind === "unknownType" ? undefined : memberType;
  }

  if (ts.isElementAccessExpression(unwrapped)) {
    const objectType = inferExpressionType(state, unwrapped.expression, env);
    if (!objectType || objectType.kind === "unknownType") return undefined;

    if (objectType.kind === "arrayType") {
      return objectType.elementType;
    }

    if (objectType.kind === "dictionaryType") {
      return objectType.valueType;
    }

    if (objectType.kind === "primitiveType" && objectType.name === "string") {
      return { kind: "primitiveType", name: "string" };
    }

    if (objectType.kind === "referenceType") {
      return getIndexerInfo(state, objectType)?.valueType;
    }

    return undefined;
  }

  if (ts.isIdentifier(unwrapped)) {
    const fromEnv = env.get(unwrapped.text);
    if (fromEnv) return fromEnv;
    const declId = state.resolveIdentifier(unwrapped);
    if (!declId) return undefined;
    const t = typeOfDecl(state, declId);
    return t.kind === "unknownType" ? undefined : t;
  }

  if (ts.isNumericLiteral(unwrapped)) {
    const numericKind = inferNumericKindFromRaw(unwrapped.getText());
    return deriveTypeFromNumericKind(numericKind);
  }

  if (ts.isStringLiteral(unwrapped)) {
    return { kind: "primitiveType", name: "string" };
  }

  if (
    ts.isNoSubstitutionTemplateLiteral(unwrapped) ||
    ts.isTemplateExpression(unwrapped)
  ) {
    return { kind: "primitiveType", name: "string" };
  }

  if (
    unwrapped.kind === ts.SyntaxKind.TrueKeyword ||
    unwrapped.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return { kind: "primitiveType", name: "boolean" };
  }

  if (ts.isPrefixUnaryExpression(unwrapped)) {
    if (unwrapped.operator === ts.SyntaxKind.ExclamationToken) {
      return { kind: "primitiveType", name: "boolean" };
    }
    return inferExpressionType(state, unwrapped.operand, env);
  }

  if (ts.isBinaryExpression(unwrapped)) {
    const op = unwrapped.operatorToken.kind;

    // Comparisons / equality always return boolean.
    if (
      op === ts.SyntaxKind.EqualsEqualsToken ||
      op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      op === ts.SyntaxKind.LessThanToken ||
      op === ts.SyntaxKind.LessThanEqualsToken ||
      op === ts.SyntaxKind.GreaterThanToken ||
      op === ts.SyntaxKind.GreaterThanEqualsToken
    ) {
      return { kind: "primitiveType", name: "boolean" };
    }

    if (
      op === ts.SyntaxKind.AmpersandAmpersandToken ||
      op === ts.SyntaxKind.BarBarToken
    ) {
      return { kind: "primitiveType", name: "boolean" };
    }

    if (
      op === ts.SyntaxKind.PlusToken ||
      op === ts.SyntaxKind.MinusToken ||
      op === ts.SyntaxKind.AsteriskToken ||
      op === ts.SyntaxKind.SlashToken ||
      op === ts.SyntaxKind.PercentToken
    ) {
      const leftType = inferExpressionType(state, unwrapped.left, env);
      const rightType = inferExpressionType(state, unwrapped.right, env);
      if (!leftType || !rightType) return undefined;

      // String concatenation
      if (
        op === ts.SyntaxKind.PlusToken &&
        ((leftType.kind === "primitiveType" && leftType.name === "string") ||
          (rightType.kind === "primitiveType" && rightType.name === "string"))
      ) {
        return { kind: "primitiveType", name: "string" };
      }

      const leftKind = getNumericKindFromIrType(leftType);
      const rightKind = getNumericKindFromIrType(rightType);
      if (!leftKind || !rightKind) return undefined;

      return deriveTypeFromNumericKind(
        getBinaryResultKind(leftKind, rightKind)
      );
    }
  }

  return undefined;
};

export const inferLambdaType = (
  state: TypeSystemState,
  expr: ts.Expression,
  expectedType: IrType | undefined
): IrFunctionType | undefined => {
  const unwrapped = unwrapParens(expr);
  if (!ts.isArrowFunction(unwrapped) && !ts.isFunctionExpression(unwrapped)) {
    return undefined;
  }

  const expectedFnType =
    expectedType?.kind === "functionType"
      ? expectedType
      : expectedType
        ? delegateToFunctionType(state, expectedType)
        : undefined;

  const parameters = unwrapped.parameters.map((p, index) => {
    const name = ts.isIdentifier(p.name) ? p.name.text : `arg${index}`;
    const paramType = p.type
      ? convertTypeNode(state, p.type)
      : expectedFnType?.parameters[index]?.type;

    return {
      kind: "parameter" as const,
      pattern: {
        kind: "identifierPattern" as const,
        name,
      },
      type: paramType,
      initializer: undefined,
      isOptional: !!p.questionToken,
      isRest: !!p.dotDotDotToken,
      passing: "value" as const,
    };
  });

  const env = new Map<string, IrType>();
  for (const p of parameters) {
    if (p.pattern.kind === "identifierPattern" && p.pattern.name && p.type) {
      env.set(p.pattern.name, p.type);
    }
  }

  const explicitReturnType =
    "type" in unwrapped && unwrapped.type
      ? convertTypeNode(state, unwrapped.type)
      : undefined;
  const expectedReturnType = expectedFnType?.returnType;

  const inferredReturnType =
    explicitReturnType ??
    (expectedReturnType && !containsTypeParameter(expectedReturnType)
      ? expectedReturnType
      : undefined) ??
    (() => {
      if (ts.isBlock(unwrapped.body)) {
        const returns: ts.Expression[] = [];
        const visit = (n: ts.Node): void => {
          if (ts.isFunctionLike(n) && n !== unwrapped) return;
          if (ts.isReturnStatement(n) && n.expression) {
            returns.push(n.expression);
          }
          n.forEachChild(visit);
        };
        unwrapped.body.forEachChild(visit);

        if (returns.length === 0) return { kind: "voidType" as const };

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const first = inferExpressionType(state, returns[0]!, env);
        if (!first) return undefined;
        for (let i = 1; i < returns.length; i++) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const t = inferExpressionType(state, returns[i]!, env);
          if (!t || !typesEqual(t, first)) return undefined;
        }
        return first;
      }

      return inferExpressionType(state, unwrapped.body, env);
    })();

  if (!inferredReturnType) return undefined;

  return {
    kind: "functionType",
    parameters,
    returnType: inferredReturnType,
  };
};

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
    if (ts.isSpreadElement(arg)) continue;
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

  const lambdaContextResolved = resolveCall(state, {
    sigId,
    argumentCount,
    receiverType,
    explicitTypeArgs,
    argTypes: argTypesWorking,
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

  const finalResolved = resolveCall(state, {
    sigId,
    argumentCount,
    receiverType,
    explicitTypeArgs,
    argTypes: argTypesWorking,
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

export const typeOfDecl = (state: TypeSystemState, declId: DeclId): IrType => {
  // Check cache first
  const cached = state.declTypeCache.get(declId.id);
  if (cached) return cached;

  const declInfo = state.handleRegistry.getDecl(declId);
  if (!declInfo) {
    emitDiagnostic(state, "TSN5203", "Cannot resolve declaration");
    const result = unknownType;
    state.declTypeCache.set(declId.id, result);
    return result;
  }

  let result: IrType;

  if (declInfo.typeNode) {
    // Explicit type annotation - convert to IR
    result = convertTypeNode(state, declInfo.typeNode);
  } else if (
    declInfo.kind === "class" ||
    declInfo.kind === "interface" ||
    declInfo.kind === "enum"
  ) {
    // Class/interface/enum - return reference type
    result = {
      kind: "referenceType",
      name: declInfo.fqName ?? "unknown",
    } as IrReferenceType;
  } else if (declInfo.kind === "function") {
    // Function without type annotation - need to build function type from signature
    // For now, return unknownType as we need the signature ID
    emitDiagnostic(
      state,
      "TSN5201",
      `Function '${declInfo.fqName ?? "unknown"}' requires explicit return type`
    );
    result = unknownType;
  } else if (declInfo.kind === "variable" && declInfo.declNode) {
    // Variable without type annotation - infer from deterministic initializer
    const inferred = tryInferTypeFromInitializer(state, declInfo.declNode);
    if (inferred) {
      result = inferred;
    } else {
      // Not a simple literal - require explicit type annotation
      emitDiagnostic(
        state,
        "TSN5201",
        `Declaration requires explicit type annotation`
      );
      result = unknownType;
    }
  } else {
    // Parameter or other declaration without type annotation
    emitDiagnostic(
      state,
      "TSN5201",
      `Declaration requires explicit type annotation`
    );
    result = unknownType;
  }

  state.declTypeCache.set(declId.id, result);
  return result;
};

// ─────────────────────────────────────────────────────────────────────────
// typeOfMember — Get declared type of a member (with inheritance substitution)
// ─────────────────────────────────────────────────────────────────────────

export const typeOfMember = (
  state: TypeSystemState,
  receiver: IrType,
  member: MemberRef,
  site?: Site
): IrType => {
  const memberName = member.kind === "byName" ? member.name : "unknown"; // MemberId.name not defined yet

  // Common nullish unions (T | undefined | null) should behave like T for member lookup.
  // This preserves deterministic typing for patterns like:
  //   const url = request.url; if (!url) return; url.absolutePath
  const effectiveReceiver =
    receiver.kind === "unionType"
      ? (() => {
          const nonNullish = receiver.types.filter(
            (t) => t && !isNullishPrimitive(t)
          );
          return nonNullish.length === 1 && nonNullish[0]
            ? nonNullish[0]
            : receiver;
        })()
      : receiver;

  // 1. Normalize receiver to nominal form
  const normalized = normalizeToNominal(state, effectiveReceiver);
  if (!normalized) {
    // Handle structural types (objectType)
    if (
      effectiveReceiver.kind === "objectType" ||
      (effectiveReceiver.kind === "referenceType" &&
        effectiveReceiver.structuralMembers)
    ) {
      return lookupStructuralMember(state, effectiveReceiver, memberName, site);
    }
    emitDiagnostic(
      state,
      "TSN5203",
      `Cannot resolve member '${memberName}' on type`,
      site
    );
    return unknownType;
  }

  // 2. Check cache (use clrName as key for compatibility)
  const cacheKey = makeMemberCacheKey(
    normalized.typeId.stableId,
    memberName,
    normalized.typeArgs
  );
  const cached = state.memberDeclaredTypeCache.get(cacheKey);
  if (cached) return cached;

  // 3. Use NominalEnv to find declaring type + substitution (Phase 6: TypeId-based)
  const lookupResult = state.nominalEnv.findMemberDeclaringType(
    normalized.typeId,
    normalized.typeArgs,
    memberName
  );

  // 4a. If NominalEnv found the member, get its declared type from Universe
  if (lookupResult) {
    const memberEntry = state.unifiedCatalog.getMember(
      lookupResult.declaringTypeId,
      memberName
    );

    // Property/field member: return its declared type.
    const memberType = memberEntry?.type;
    if (memberType) {
      const result = irSubstitute(memberType, lookupResult.substitution);
      state.memberDeclaredTypeCache.set(cacheKey, result);
      return result;
    }

    // Method member: materialize a callable function type from the first signature.
    // Call resolution (resolveCall) uses SignatureId for overload selection; this
    // type is used only to keep member access expressions deterministic.
    const firstSig = memberEntry?.signatures?.[0];
    if (firstSig) {
      const funcType: IrFunctionType = {
        kind: "functionType",
        parameters: firstSig.parameters.map(
          (p): IrParameter => ({
            kind: "parameter",
            pattern: {
              kind: "identifierPattern",
              name: p.name,
            },
            type: p.type,
            initializer: undefined,
            isOptional: p.isOptional,
            isRest: p.isRest,
            passing: p.mode,
          })
        ),
        returnType: firstSig.returnType,
      };

      const result = irSubstitute(funcType, lookupResult.substitution);
      state.memberDeclaredTypeCache.set(cacheKey, result);
      return result;
    }
  }

  // 5. Member not found anywhere
  emitDiagnostic(state, "TSN5203", `Member '${memberName}' not found`, site);
  return unknownType;
};

export const parseIndexerKeyClrType = (
  stableId: string
): string | undefined => {
  const memberSep = stableId.indexOf("::");
  if (memberSep < 0) return undefined;

  const bracketStart = stableId.indexOf("[", memberSep);
  if (bracketStart < 0) return undefined;

  let depth = 0;
  let bracketEnd = -1;
  for (let i = bracketStart; i < stableId.length; i++) {
    const ch = stableId[i];
    if (ch === "[") depth++;
    if (ch === "]") {
      depth--;
      if (depth === 0) {
        bracketEnd = i;
        break;
      }
    }
  }
  if (bracketEnd < 0) return undefined;

  const rawParams = stableId.slice(bracketStart + 1, bracketEnd);

  // Split on top-level commas to support nested generic types.
  const splitTopLevel = (value: string): string[] => {
    const parts: string[] = [];
    let start = 0;
    let bracketDepth = 0;
    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      if (c === "[") bracketDepth++;
      else if (c === "]" && bracketDepth > 0) bracketDepth--;
      else if (c === "," && bracketDepth === 0) {
        parts.push(value.slice(start, i).trim());
        start = i + 1;
      }
    }
    parts.push(value.slice(start).trim());
    return parts.filter((p) => p.length > 0);
  };

  const params = splitTopLevel(rawParams);
  if (params.length !== 1) return undefined;

  const first = params[0];
  if (!first) return undefined;

  // Strip assembly qualification (", Assembly, Version=..., ...") if present.
  const withoutAsm = first.includes(",")
    ? (first.split(",")[0] ?? first)
    : first;
  return withoutAsm.trim();
};

export const getIndexerInfo = (
  state: TypeSystemState,
  receiver: IrType,
  _site?: Site
): { readonly keyClrType: string; readonly valueType: IrType } | undefined => {
  const normalized = normalizeToNominal(state, receiver);
  if (!normalized) return undefined;

  // Walk inheritance chain to find the first indexer property.
  const chain = state.nominalEnv.getInheritanceChain(normalized.typeId);
  for (const typeId of chain) {
    const members = state.unifiedCatalog.getMembers(typeId);
    const indexers = Array.from(members.values()).filter(
      (m) => m.memberKind === "property" && m.isIndexer
    );

    if (indexers.length === 0) continue;
    if (indexers.length > 1) return undefined;

    const indexer = indexers[0];
    if (!indexer?.type) return undefined;

    const keyClrType = parseIndexerKeyClrType(indexer.stableId);
    if (!keyClrType) return undefined;

    const inst = state.nominalEnv.getInstantiation(
      normalized.typeId,
      normalized.typeArgs,
      typeId
    );
    const valueType =
      inst && inst.size > 0
        ? irSubstitute(indexer.type, inst as IrSubstitutionMap)
        : indexer.type;

    return { keyClrType, valueType };
  }

  return undefined;
};

// ─────────────────────────────────────────────────────────────────────────
// hasTypeParameters — Check if declaration has type parameters
// ─────────────────────────────────────────────────────────────────────────

export const hasTypeParameters = (
  state: TypeSystemState,
  declId: DeclId
): boolean => {
  const declInfo = state.handleRegistry.getDecl(declId);
  if (!declInfo?.declNode) return false;

  // Check the declaration node for type parameters
  // We need to import ts to check for type parameter declarations
  // Access the declNode as any to check for typeParameters property
  const declNode = declInfo.declNode as {
    typeParameters?: readonly unknown[];
  };
  return !!(declNode.typeParameters && declNode.typeParameters.length > 0);
};

// ─────────────────────────────────────────────────────────────────────────
// typeOfMemberId — Get type of member by handle
// ─────────────────────────────────────────────────────────────────────────

export const typeOfMemberId = (
  state: TypeSystemState,
  memberId: MemberId
): IrType => {
  const memberInfo = state.handleRegistry.getMember(memberId);
  if (!memberInfo) {
    return unknownType;
  }

  // If the member has a type node, convert it
  if (memberInfo.typeNode) {
    return convertTypeNode(state, memberInfo.typeNode);
  }

  // Otherwise, attempt to recover type deterministically from the member declaration.
  // This is required for namespace imports (`import * as X`) where members are
  // function declarations / const declarations (no typeNode captured by Binding).
  const decl = memberInfo.declNode as ts.Declaration | undefined;
  if (decl) {
    if (ts.isFunctionDeclaration(decl)) {
      // Determinism: require explicit parameter + return annotations.
      if (!decl.type) return unknownType;
      if (decl.parameters.some((p) => p.type === undefined)) return unknownType;

      const parameters: readonly IrParameter[] = decl.parameters.map((p) => ({
        kind: "parameter",
        pattern: {
          kind: "identifierPattern",
          name: ts.isIdentifier(p.name) ? p.name.text : "param",
        },
        type: p.type ? convertTypeNode(state, p.type) : undefined,
        initializer: undefined,
        isOptional: !!p.questionToken || !!p.initializer,
        isRest: !!p.dotDotDotToken,
        passing: "value",
      }));

      const returnType = convertTypeNode(state, decl.type);
      const fnType: IrFunctionType = {
        kind: "functionType",
        parameters,
        returnType,
      };
      return fnType;
    }

    if (ts.isVariableDeclaration(decl)) {
      if (decl.type) return convertTypeNode(state, decl.type);
      const inferred = tryInferTypeFromInitializer(state, decl);
      return inferred ?? unknownType;
    }
  }

  return unknownType;
};

// ─────────────────────────────────────────────────────────────────────────
// getFQNameOfDecl — Get fully-qualified name of declaration
// ─────────────────────────────────────────────────────────────────────────

export const getFQNameOfDecl = (
  state: TypeSystemState,
  declId: DeclId
): string | undefined => {
  const declInfo = state.handleRegistry.getDecl(declId);
  return declInfo?.fqName;
};

// ─────────────────────────────────────────────────────────────────────────
// isTypeDecl — Check if declaration is a type
// ─────────────────────────────────────────────────────────────────────────

export const isTypeDecl = (state: TypeSystemState, declId: DeclId): boolean => {
  const declInfo = state.handleRegistry.getDecl(declId);
  if (!declInfo) return false;

  const typeKinds: readonly DeclKind[] = [
    "interface",
    "class",
    "typeAlias",
    "enum",
  ];
  return typeKinds.includes(declInfo.kind);
};

// ─────────────────────────────────────────────────────────────────────────
// isInterfaceDecl — Check if declaration is an interface
// ─────────────────────────────────────────────────────────────────────────

export const isInterfaceDecl = (
  state: TypeSystemState,
  declId: DeclId
): boolean => {
  const declInfo = state.handleRegistry.getDecl(declId);
  return declInfo?.kind === "interface";
};

// ─────────────────────────────────────────────────────────────────────────
// isTypeAliasToObjectLiteral — Check if type alias points to object literal
// ─────────────────────────────────────────────────────────────────────────

export const isTypeAliasToObjectLiteral = (
  state: TypeSystemState,
  declId: DeclId
): boolean => {
  const declInfo = state.handleRegistry.getDecl(declId);
  if (!declInfo || declInfo.kind !== "typeAlias") return false;

  // Check if the typeNode is a type literal node
  // We need to access the declNode to get the type alias declaration
  const declNode = declInfo.declNode as
    | { type?: { kind?: number } }
    | undefined;
  if (!declNode?.type) return false;

  return declNode.type.kind === ts.SyntaxKind.TypeLiteral;
};

// ─────────────────────────────────────────────────────────────────────────
// signatureHasConditionalReturn — Check for conditional return type
// ─────────────────────────────────────────────────────────────────────────

export const signatureHasConditionalReturn = (
  state: TypeSystemState,
  sigId: SignatureId
): boolean => {
  const sigInfo = state.handleRegistry.getSignature(sigId);
  if (!sigInfo) return false;

  const returnTypeNode = sigInfo.returnTypeNode as
    | { kind?: number }
    | undefined;
  if (!returnTypeNode) return false;

  return returnTypeNode.kind === ts.SyntaxKind.ConditionalType;
};

// ─────────────────────────────────────────────────────────────────────────
// signatureHasVariadicTypeParams — Check for variadic type parameters
// ─────────────────────────────────────────────────────────────────────────

export const signatureHasVariadicTypeParams = (
  state: TypeSystemState,
  sigId: SignatureId
): boolean => {
  const sigInfo = state.handleRegistry.getSignature(sigId);
  if (!sigInfo) return false;

  if (!sigInfo.typeParameters) return false;

  for (const typeParam of sigInfo.typeParameters) {
    const constraintNode = typeParam.constraintNode as
      | {
          kind?: number;
          elementType?: { kind?: number; typeName?: { text?: string } };
        }
      | undefined;
    if (!constraintNode) continue;

    // Check if constraint is an array type (variadic pattern: T extends unknown[])
    if (constraintNode.kind === ts.SyntaxKind.ArrayType) {
      const elementType = constraintNode.elementType;
      if (!elementType) continue;

      // Check for unknown[] or any[] constraint
      if (
        elementType.kind === ts.SyntaxKind.UnknownKeyword ||
        elementType.kind === ts.SyntaxKind.AnyKeyword
      ) {
        return true;
      }

      // Also check for type reference to "unknown" or "any"
      const typeName = elementType.typeName?.text;
      if (typeName === "unknown" || typeName === "any") {
        return true;
      }
    }
  }

  return false;
};

// ─────────────────────────────────────────────────────────────────────────
// declHasTypeAnnotation — Check if declaration has explicit type
// ─────────────────────────────────────────────────────────────────────────

export const declHasTypeAnnotation = (
  state: TypeSystemState,
  declId: DeclId
): boolean => {
  const declInfo = state.handleRegistry.getDecl(declId);
  return declInfo?.typeNode !== undefined;
};

// ─────────────────────────────────────────────────────────────────────────
// checkTsClassMemberOverride — Check if member can be overridden
// ─────────────────────────────────────────────────────────────────────────

/**
 * Check if a class member overrides a base class member.
 *
 * ALICE'S SPEC: Uses captured ClassMemberNames (pure data) from Binding.
 * No TS AST inspection, no SyntaxKind numbers. TS-version safe.
 */
export const checkTsClassMemberOverride = (
  state: TypeSystemState,
  declId: DeclId,
  memberName: string,
  memberKind: "method" | "property"
): { isOverride: boolean; isShadow: boolean } => {
  const declInfo = state.handleRegistry.getDecl(declId);
  const members = declInfo?.classMemberNames;

  // No class member info available
  if (!members) {
    return { isOverride: false, isShadow: false };
  }

  // Check if base class has this member
  const has =
    memberKind === "method"
      ? members.methods.has(memberName)
      : members.properties.has(memberName);

  // In TypeScript, all methods can be overridden (no `final` keyword)
  return has
    ? { isOverride: true, isShadow: false }
    : { isOverride: false, isShadow: false };
};

// ─────────────────────────────────────────────────────────────────────────
// typeFromSyntax — Convert captured type syntax to IrType
// ─────────────────────────────────────────────────────────────────────────

/**
 * Convert a captured type syntax to IrType.
 *
 * This method takes a TypeSyntaxId handle (opaque to caller) and looks up
 * the captured TypeNode in the HandleRegistry, then converts it.
 *
 * ALICE'S SPEC (Phase 2): TypeSystem receives opaque handles, not ts.TypeNode.
 */
export const typeFromSyntax = (
  state: TypeSystemState,
  typeSyntaxId: TypeSyntaxId
): IrType => {
  const syntaxInfo = state.handleRegistry.getTypeSyntax(typeSyntaxId);
  if (!syntaxInfo) {
    // Invalid handle - return unknownType
    return { kind: "unknownType" };
  }
  // Phase 5: convertTypeNode accepts unknown, cast is inside type-system/internal
  return convertTypeNode(state, syntaxInfo.typeNode);
};
