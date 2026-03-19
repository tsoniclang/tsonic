/**
 * Expression Type Inference — inferExpressionType and inferLambdaType
 *
 * Deterministically infer an expression's type using only:
 * - local lambda parameter environment
 * - declaration types (typeOfDecl)
 * - numeric literal lexeme rules
 *
 * DAG position: depends on inference-utilities, inference-member-resolution,
 *               inference-initializers, inference-declarations
 */

import type {
  IrType,
  IrFunctionType,
  IrInterfaceMember,
} from "../types/index.js";
import * as ts from "typescript";
import { inferNumericKindFromRaw } from "../types/numeric-helpers.js";
import { getBinaryResultKind } from "../types/numeric-kind.js";
import type { TypeSystemState } from "./type-system-state.js";
import { stripNullishForInference } from "./type-system-state.js";
import { typesEqual, containsTypeParameter } from "./type-system-relations.js";
import {
  convertTypeNode,
  resolveCall,
  delegateToFunctionType,
} from "./type-system-call-resolution.js";
import { tryResolveDeterministicPropertyName } from "../syntax/property-names.js";
import {
  unwrapParens,
  isLambdaExpression,
  deriveTypeFromNumericKind,
  getNumericKindFromIrType,
  unwrapAwaitedForInference,
} from "./inference-utilities.js";
import { typeOfDecl } from "./inference-declarations.js";
import { typeOfMember, getIndexerInfo } from "./inference-member-resolution.js";
import { tryInferReturnTypeFromCallExpression } from "./inference-initializers.js";

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
  const inferObjectLiteralType = (
    objectExpr: ts.ObjectLiteralExpression
  ): IrType | undefined => {
    const inferFunctionLikeType = (
      functionLike:
        | ts.ArrowFunction
        | ts.FunctionExpression
        | ts.MethodDeclaration
        | ts.GetAccessorDeclaration
    ): IrFunctionType | undefined => {
      const parameters =
        "parameters" in functionLike
          ? functionLike.parameters.map((p, index) => {
              const name = ts.isIdentifier(p.name)
                ? p.name.text
                : `arg${index}`;
              const paramType = p.type
                ? convertTypeNode(state, p.type)
                : undefined;
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
            })
          : [];

      const localEnv = new Map(env);
      for (const parameter of parameters) {
        if (
          parameter.pattern.kind === "identifierPattern" &&
          parameter.type !== undefined
        ) {
          localEnv.set(parameter.pattern.name, parameter.type);
        }
      }

      const explicitReturnType =
        "type" in functionLike && functionLike.type
          ? convertTypeNode(state, functionLike.type)
          : undefined;
      const inferredReturnType =
        explicitReturnType ??
        (() => {
          if (
            ts.isMethodDeclaration(functionLike) ||
            ts.isGetAccessor(functionLike)
          ) {
            if (!functionLike.body) return undefined;
            const returns = functionLike.body.statements.filter(
              ts.isReturnStatement
            );
            if (returns.length === 0) return { kind: "voidType" as const };
            const firstExpr = returns[0]?.expression;
            if (!firstExpr) return { kind: "voidType" as const };
            const first = inferExpressionType(state, firstExpr, localEnv);
            if (!first) return undefined;
            for (let i = 1; i < returns.length; i++) {
              const expr = returns[i]?.expression;
              if (!expr) continue;
              const current = inferExpressionType(state, expr, localEnv);
              if (!current || !typesEqual(current, first)) return undefined;
            }
            return first;
          }

          if (ts.isBlock(functionLike.body)) {
            const returns = functionLike.body.statements.filter(
              ts.isReturnStatement
            );
            if (returns.length === 0) return { kind: "voidType" as const };
            const firstExpr = returns[0]?.expression;
            if (!firstExpr) return { kind: "voidType" as const };
            const first = inferExpressionType(state, firstExpr, localEnv);
            if (!first) return undefined;
            for (let i = 1; i < returns.length; i++) {
              const expr = returns[i]?.expression;
              if (!expr) continue;
              const current = inferExpressionType(state, expr, localEnv);
              if (!current || !typesEqual(current, first)) return undefined;
            }
            return first;
          }

          return inferExpressionType(state, functionLike.body, localEnv);
        })();

      if (!inferredReturnType) return undefined;
      return {
        kind: "functionType",
        parameters,
        returnType: inferredReturnType,
      };
    };

    const accessors = new Map<
      string,
      { getter?: ts.GetAccessorDeclaration; setter?: ts.SetAccessorDeclaration }
    >();
    const members: IrInterfaceMember[] = [];

    for (const property of objectExpr.properties) {
      if (ts.isSpreadAssignment(property)) {
        return undefined;
      }

      if (
        ts.isGetAccessorDeclaration(property) ||
        ts.isSetAccessorDeclaration(property)
      ) {
        const name = tryResolveDeterministicPropertyName(property.name);
        if (!name) return undefined;
        const bucket = accessors.get(name) ?? {};
        if (ts.isGetAccessorDeclaration(property)) {
          bucket.getter = property;
        } else {
          bucket.setter = property;
        }
        accessors.set(name, bucket);
        continue;
      }

      if (ts.isPropertyAssignment(property)) {
        const name = tryResolveDeterministicPropertyName(property.name);
        if (!name) return undefined;
        const propertyType = inferExpressionType(
          state,
          property.initializer,
          env
        );
        if (!propertyType) return undefined;
        members.push({
          kind: "propertySignature",
          name,
          type: propertyType,
          isOptional: false,
          isReadonly: false,
        });
        continue;
      }

      if (ts.isShorthandPropertyAssignment(property)) {
        const declId = state.resolveShorthandAssignment(property);
        const propertyType =
          declId !== undefined
            ? (() => {
                const fromEnv = env.get(property.name.text);
                if (fromEnv && fromEnv.kind !== "unknownType") {
                  return fromEnv;
                }
                const fromDecl = typeOfDecl(state, declId);
                return fromDecl.kind === "unknownType" ? undefined : fromDecl;
              })()
            : inferExpressionType(state, property.name, env);
        if (!propertyType) return undefined;
        members.push({
          kind: "propertySignature",
          name: property.name.text,
          type: propertyType,
          isOptional: false,
          isReadonly: false,
        });
        continue;
      }

      if (ts.isMethodDeclaration(property)) {
        const name = tryResolveDeterministicPropertyName(property.name);
        if (!name) return undefined;
        const methodType = inferFunctionLikeType(property);
        if (!methodType) return undefined;
        members.push({
          kind: "methodSignature",
          name,
          parameters: methodType.parameters,
          returnType: methodType.returnType,
        });
        continue;
      }

      return undefined;
    }

    for (const [name, accessor] of accessors) {
      const getterType = accessor.getter
        ? "type" in accessor.getter && accessor.getter.type
          ? convertTypeNode(state, accessor.getter.type)
          : inferFunctionLikeType(accessor.getter)?.returnType
        : undefined;
      const setterParam = accessor.setter?.parameters[0];
      const setterType = setterParam?.type
        ? convertTypeNode(state, setterParam.type)
        : undefined;
      const propertyType = getterType ?? setterType;
      if (!propertyType) return undefined;
      members.push({
        kind: "propertySignature",
        name,
        type: propertyType,
        isOptional: false,
        isReadonly: accessor.setter === undefined,
      });
    }

    return { kind: "objectType", members };
  };

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

  if (unwrapped.kind === ts.SyntaxKind.UndefinedKeyword) {
    return { kind: "primitiveType", name: "undefined" };
  }

  if (unwrapped.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "primitiveType", name: "null" };
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

  if (ts.isArrayLiteralExpression(unwrapped)) {
    const elementTypes: IrType[] = [];
    for (const element of unwrapped.elements) {
      if (ts.isOmittedExpression(element) || ts.isSpreadElement(element)) {
        return undefined;
      }
      const elementType = inferExpressionType(state, element, env);
      if (!elementType) return undefined;
      elementTypes.push(elementType);
    }

    if (elementTypes.length === 0) {
      return undefined;
    }

    const first = elementTypes[0];
    if (first && elementTypes.every((type) => typesEqual(type, first))) {
      return { kind: "arrayType", elementType: first };
    }

    return { kind: "tupleType", elementTypes };
  }

  if (ts.isObjectLiteralExpression(unwrapped)) {
    return inferObjectLiteralType(unwrapped);
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
