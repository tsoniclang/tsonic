/**
 * Expression Type Inference — inferExpressionType
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
import type { TstsNode } from "@tsonic/tsts";
import {
  getTstsDeclaredTypeNode,
  getTstsIdentifierText,
  getTstsNodeNameText,
  getTstsNodeText,
  getTstsParameters,
  getTstsPropertyNodes,
  getTstsStatementNodes,
  getTstsTypeArguments,
  getTstsTypeParameterNodes,
  isTstsOptionalParameter,
  isTstsRestParameter,
  TstsSyntax,
} from "@tsonic/tsts";
import { inferNumericKindFromRaw } from "../types/numeric-helpers.js";
import { getBinaryResultKind } from "../types/numeric-kind.js";
import type { TypeSystemState } from "./type-system-state.js";
import { stripNullishForInference } from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";
import { convertTypeNode, resolveCall } from "./type-system-call-resolution.js";
import { attachConstructedReferenceMetadata } from "./constructor-return-metadata.js";
import { tryResolveDeterministicPropertyName } from "../syntax/property-names.js";
import {
  collectResolutionArgTypes,
  deriveTypeFromNumericKind,
  getExplicitTypeArgumentNodes,
  getNumericKindFromIrType,
  unwrapAwaitedForInference,
} from "./inference-utilities.js";
import { typeOfDecl } from "./inference-declarations.js";
import { typeOfMember, getIndexerInfo } from "./inference-member-resolution.js";

const isTstsNode = (node: unknown): node is TstsNode =>
  typeof node === "object" && node !== null && "Kind" in node;

const concreteTstsNodes = (
  nodes: readonly (TstsNode | undefined)[]
): readonly TstsNode[] =>
  nodes.filter((node): node is TstsNode => node !== undefined);

const unwrapExpression = (expr: TstsNode): TstsNode => {
  let current = expr;
  while (TstsSyntax.IsParenthesizedExpression(current)) {
    const inner = TstsSyntax.Node_Expression(current);
    if (!inner) return current;
    current = inner;
  }
  return current;
};

const isLambdaExpression = (expr: TstsNode): boolean => {
  const unwrapped = unwrapExpression(expr);
  return (
    TstsSyntax.IsArrowFunction(unwrapped) ||
    TstsSyntax.IsFunctionExpression(unwrapped)
  );
};

const isConstAssertionType = (node: TstsNode): boolean =>
  TstsSyntax.IsTypeReferenceNode(node) &&
  getTstsNodeNameText(TstsSyntax.AsTypeReferenceNode(node)?.TypeName) ===
    "const" &&
  getTstsTypeArguments(node).length === 0;

const inferEnclosingThisType = (node: TstsNode): IrType | undefined => {
  let current: TstsNode | undefined = node;

  while (current) {
    if (
      TstsSyntax.IsClassDeclaration(current) ||
      TstsSyntax.IsClassExpression(current)
    ) {
      const className = getTstsNodeNameText(current);
      if (!className) return undefined;

      const typeArguments = concreteTstsNodes(getTstsTypeParameterNodes(current)).map(
        (typeParameter): IrType => ({
          kind: "typeParameterType",
          name: getTstsNodeNameText(typeParameter) ?? "T",
        })
      );

      return {
        kind: "referenceType",
        name: className,
        ...(typeArguments.length > 0 ? { typeArguments } : {}),
      };
    }

    current = current.Parent;
  }

  return undefined;
};

const inferBlockReturnType = (
  state: TypeSystemState,
  body: TstsNode,
  env: ReadonlyMap<string, IrType>
): IrType | undefined => {
  const returns = concreteTstsNodes(getTstsStatementNodes(body)).filter(
    TstsSyntax.IsReturnStatement
  );
  if (returns.length === 0) return { kind: "voidType" };

  const firstReturn = returns[0];
  if (!firstReturn) return undefined;
  const firstExpr = TstsSyntax.Node_Expression(firstReturn);
  if (!firstExpr) return { kind: "voidType" };
  const first = inferExpressionType(state, firstExpr, env);
  if (!first) return undefined;

  for (let index = 1; index < returns.length; index++) {
    const returnExpr = TstsSyntax.Node_Expression(returns[index]);
    if (!returnExpr) continue;
    const current = inferExpressionType(state, returnExpr, env);
    if (!current || !typesEqual(current, first)) return undefined;
  }
  return first;
};

const inferCallExpressionReturnType = (
  state: TypeSystemState,
  call: TstsNode,
  env: ReadonlyMap<string, IrType>
): IrType | undefined => {
  const sigId = state.resolveCallSignature(call);
  if (!sigId) return undefined;

  const explicitTypeArgs = getTstsTypeArguments(call).map((typeArgument) =>
    convertTypeNode(state, typeArgument)
  );

  const callee = TstsSyntax.Node_Expression(call);
  const receiverType = (() => {
    if (!callee || !TstsSyntax.IsPropertyAccessExpression(callee)) {
      return undefined;
    }
    const receiverExpr = TstsSyntax.Node_Expression(callee);
    if (!receiverExpr) return undefined;
    const receiver = inferExpressionType(state, receiverExpr, env);
    return receiver && receiver.kind !== "unknownType" ? receiver : undefined;
  })();

  const args = concreteTstsNodes(TstsSyntax.Node_Arguments(call) ?? []);
  const argTypesWorking: (IrType | undefined)[] = Array(args.length).fill(
    undefined
  );

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;
    if (TstsSyntax.IsSpreadElement(arg)) {
      const spreadExpr = TstsSyntax.Node_Expression(arg);
      const spreadType = spreadExpr
        ? inferExpressionType(state, spreadExpr, env)
        : undefined;
      if (spreadType && spreadType.kind !== "unknownType") {
        argTypesWorking[index] = spreadType;
      }
      continue;
    }
    if (isLambdaExpression(arg)) continue;

    const argType = inferExpressionType(state, arg, env);
    if (argType && argType.kind !== "unknownType") {
      argTypesWorking[index] = argType;
    }
  }

  const resolutionArgs = collectResolutionArgTypes(argTypesWorking);
  const resolved = resolveCall(state, {
    sigId,
    argumentCount:
      resolutionArgs.argumentCount > 0
        ? resolutionArgs.argumentCount
        : args.length,
    receiverType,
    explicitTypeArgs: explicitTypeArgs.length > 0 ? explicitTypeArgs : undefined,
    argTypes:
      resolutionArgs.argumentCount > 0
        ? resolutionArgs.argTypes
        : argTypesWorking,
  });

  return resolved.returnType.kind === "unknownType"
    ? undefined
    : resolved.returnType;
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
  expr: unknown,
  env: ReadonlyMap<string, IrType>
): IrType | undefined => {
  if (!isTstsNode(expr)) return undefined;

  const inferObjectLiteralType = (
    objectExpr: TstsNode
  ): IrType | undefined => {
    const inferFunctionLikeType = (
      functionLike: TstsNode
    ): IrFunctionType | undefined => {
      const parameters = concreteTstsNodes(getTstsParameters(functionLike)).map(
        (parameter, index) => {
          const name = getTstsNodeNameText(parameter) ?? `arg${index}`;
          const typeNode = getTstsDeclaredTypeNode(parameter);
          const paramType = typeNode ? convertTypeNode(state, typeNode) : undefined;
          return {
            kind: "parameter" as const,
            pattern: {
              kind: "identifierPattern" as const,
              name,
            },
            type: paramType,
            initializer: undefined,
            isOptional: isTstsOptionalParameter(parameter),
            isRest: isTstsRestParameter(parameter),
            passing: "value" as const,
          };
        }
      );

      const localEnv = new Map(env);
      for (const parameter of parameters) {
        if (parameter.type !== undefined) {
          localEnv.set(parameter.pattern.name, parameter.type);
        }
      }

      const explicitReturnType = getTstsDeclaredTypeNode(functionLike)
        ? convertTypeNode(state, getTstsDeclaredTypeNode(functionLike))
        : undefined;
      const body = TstsSyntax.Node_Body(functionLike);
      const inferredReturnType =
        explicitReturnType ??
        (() => {
          if (!body) return undefined;
          if (TstsSyntax.IsBlock(body)) {
            return inferBlockReturnType(state, body, localEnv);
          }
          return inferExpressionType(state, body, localEnv);
        })();

      if (!inferredReturnType) return undefined;
      return {
        kind: "functionType",
        parameters,
        returnType: inferredReturnType,
      };
    };

    const accessors = new Map<string, { getter?: TstsNode; setter?: TstsNode }>();
    const members: IrInterfaceMember[] = [];

    for (const property of concreteTstsNodes(getTstsPropertyNodes(objectExpr))) {
      if (TstsSyntax.IsSpreadAssignment(property)) {
        return undefined;
      }

      if (
        TstsSyntax.IsGetAccessorDeclaration(property) ||
        TstsSyntax.IsSetAccessorDeclaration(property)
      ) {
        const name = tryResolveDeterministicPropertyName(
          TstsSyntax.Node_PropertyNameOrName(property)
        );
        if (!name) return undefined;
        const bucket = accessors.get(name) ?? {};
        if (TstsSyntax.IsGetAccessorDeclaration(property)) {
          bucket.getter = property;
        } else {
          bucket.setter = property;
        }
        accessors.set(name, bucket);
        continue;
      }

      if (TstsSyntax.IsPropertyAssignment(property)) {
        const name = tryResolveDeterministicPropertyName(
          TstsSyntax.Node_PropertyNameOrName(property)
        );
        if (!name) return undefined;
        const initializer = TstsSyntax.Node_Initializer(property);
        const propertyType = initializer
          ? inferExpressionType(state, initializer, env)
          : undefined;
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

      if (TstsSyntax.IsShorthandPropertyAssignment(property)) {
        const propertyName = getTstsNodeNameText(property);
        if (!propertyName) return undefined;
        const declId = state.resolveShorthandAssignment(property);
        const propertyType =
          declId !== undefined
            ? (() => {
                const fromEnv = env.get(propertyName);
                if (fromEnv && fromEnv.kind !== "unknownType") {
                  return fromEnv;
                }
                const fromDecl = typeOfDecl(state, declId);
                return fromDecl.kind === "unknownType" ? undefined : fromDecl;
              })()
            : inferExpressionType(state, TstsSyntax.Node_Name(property), env);
        if (!propertyType) return undefined;
        members.push({
          kind: "propertySignature",
          name: propertyName,
          type: propertyType,
          isOptional: false,
          isReadonly: false,
        });
        continue;
      }

      if (TstsSyntax.IsMethodDeclaration(property)) {
        const name = tryResolveDeterministicPropertyName(
          TstsSyntax.Node_PropertyNameOrName(property)
        );
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
        ? getTstsDeclaredTypeNode(accessor.getter)
          ? convertTypeNode(state, getTstsDeclaredTypeNode(accessor.getter))
          : inferFunctionLikeType(accessor.getter)?.returnType
        : undefined;
      const setterParam = concreteTstsNodes(getTstsParameters(accessor.setter))[0];
      const setterType = setterParam
        ? getTstsDeclaredTypeNode(setterParam)
          ? convertTypeNode(state, getTstsDeclaredTypeNode(setterParam))
          : undefined
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

  const unwrapped = unwrapExpression(expr);

  if (
    TstsSyntax.IsAsExpression(unwrapped) ||
    TstsSyntax.IsTypeAssertion(unwrapped)
  ) {
    const typeNode = TstsSyntax.Node_Type(unwrapped);
    const inner = TstsSyntax.Node_Expression(unwrapped);
    if (!typeNode) return undefined;
    if (isConstAssertionType(typeNode)) {
      return inner ? inferExpressionType(state, inner, env) : undefined;
    }

    return convertTypeNode(state, typeNode);
  }

  if (TstsSyntax.IsNonNullExpression(unwrapped)) {
    const innerExpr = TstsSyntax.Node_Expression(unwrapped);
    const inner = innerExpr ? inferExpressionType(state, innerExpr, env) : undefined;
    if (!inner || inner.kind === "unknownType") return undefined;
    return stripNullishForInference(inner);
  }

  if (TstsSyntax.IsAwaitExpression(unwrapped)) {
    const innerExpr = TstsSyntax.Node_Expression(unwrapped);
    const inner = innerExpr ? inferExpressionType(state, innerExpr, env) : undefined;
    if (!inner || inner.kind === "unknownType") return undefined;
    return unwrapAwaitedForInference(inner);
  }

  if (unwrapped.Kind === TstsSyntax.KindUndefinedKeyword) {
    return { kind: "primitiveType", name: "undefined" };
  }

  if (unwrapped.Kind === TstsSyntax.KindNullKeyword) {
    return { kind: "primitiveType", name: "null" };
  }

  if (unwrapped.Kind === TstsSyntax.KindThisKeyword) {
    return inferEnclosingThisType(unwrapped);
  }

  if (TstsSyntax.IsCallExpression(unwrapped)) {
    return inferCallExpressionReturnType(state, unwrapped, env);
  }

  if (TstsSyntax.IsNewExpression(unwrapped)) {
    const sigId = state.resolveConstructorSignature(unwrapped);
    if (!sigId) return undefined;

    const explicitTypeArgs = getExplicitTypeArgumentNodes(unwrapped).map(
      (typeArgument) => convertTypeNode(state, typeArgument)
    );

    const args = concreteTstsNodes(TstsSyntax.Node_Arguments(unwrapped) ?? []);
    const argTypesWorking: (IrType | undefined)[] = Array(args.length).fill(
      undefined
    );

    for (let index = 0; index < args.length; index++) {
      const arg = args[index];
      if (!arg) continue;
      if (TstsSyntax.IsSpreadElement(arg)) continue;
      if (isLambdaExpression(arg)) continue;

      const t = inferExpressionType(state, arg, env);
      if (t && t.kind !== "unknownType") {
        argTypesWorking[index] = t;
      }
    }

    const resolved = resolveCall(state, {
      sigId,
      argumentCount: args.length,
      explicitTypeArgs: explicitTypeArgs.length > 0 ? explicitTypeArgs : undefined,
      argTypes: argTypesWorking,
    });

    if (resolved.returnType.kind === "unknownType") {
      return undefined;
    }
    const constructorExpr = TstsSyntax.Node_Expression(unwrapped);
    const constructorType = constructorExpr
      ? inferExpressionType(state, constructorExpr, env)
      : undefined;
    return attachConstructedReferenceMetadata(
      resolved.returnType,
      constructorType
    );
  }

  if (TstsSyntax.IsPropertyAccessExpression(unwrapped)) {
    const receiverExpr = TstsSyntax.Node_Expression(unwrapped);
    const receiverType = receiverExpr
      ? inferExpressionType(state, receiverExpr, env)
      : undefined;
    if (!receiverType || receiverType.kind === "unknownType") return undefined;
    const memberName = getTstsNodeNameText(unwrapped);
    if (!memberName) return undefined;
    const memberType = typeOfMember(state, receiverType, {
      kind: "byName",
      name: memberName,
    });
    return memberType.kind === "unknownType" ? undefined : memberType;
  }

  if (TstsSyntax.IsElementAccessExpression(unwrapped)) {
    const objectExpr = TstsSyntax.Node_Expression(unwrapped);
    const objectType = objectExpr
      ? inferExpressionType(state, objectExpr, env)
      : undefined;
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

  if (TstsSyntax.IsIdentifier(unwrapped)) {
    const name = getTstsIdentifierText(unwrapped);
    if (!name) return undefined;
    const fromEnv = env.get(name);
    if (fromEnv) return fromEnv;
    const declId = state.resolveIdentifier(unwrapped);
    if (!declId) return undefined;
    const t = typeOfDecl(state, declId);
    return t.kind === "unknownType" ? undefined : t;
  }

  if (TstsSyntax.IsNumericLiteral(unwrapped)) {
    const numericKind = inferNumericKindFromRaw(getTstsNodeText(unwrapped) ?? "");
    return deriveTypeFromNumericKind(numericKind);
  }

  if (TstsSyntax.IsStringLiteral(unwrapped)) {
    return { kind: "primitiveType", name: "string" };
  }

  if (
    TstsSyntax.IsNoSubstitutionTemplateLiteral(unwrapped) ||
    TstsSyntax.IsTemplateExpression(unwrapped)
  ) {
    return { kind: "primitiveType", name: "string" };
  }

  if (
    unwrapped.Kind === TstsSyntax.KindTrueKeyword ||
    unwrapped.Kind === TstsSyntax.KindFalseKeyword
  ) {
    return { kind: "primitiveType", name: "boolean" };
  }

  if (TstsSyntax.IsArrayLiteralExpression(unwrapped)) {
    const elementTypes: IrType[] = [];
    for (const element of concreteTstsNodes(TstsSyntax.Node_Elements(unwrapped) ?? [])) {
      if (
        TstsSyntax.IsOmittedExpression(element) ||
        TstsSyntax.IsSpreadElement(element)
      ) {
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

  if (TstsSyntax.IsObjectLiteralExpression(unwrapped)) {
    return inferObjectLiteralType(unwrapped);
  }

  if (TstsSyntax.IsPrefixUnaryExpression(unwrapped)) {
    const prefix = TstsSyntax.AsPrefixUnaryExpression(unwrapped);
    if (prefix?.Operator === TstsSyntax.KindExclamationToken) {
      return { kind: "primitiveType", name: "boolean" };
    }
    return prefix?.Operand
      ? inferExpressionType(state, prefix.Operand, env)
      : undefined;
  }

  if (TstsSyntax.IsBinaryExpression(unwrapped)) {
    const binary = TstsSyntax.AsBinaryExpression(unwrapped);
    const op = binary?.OperatorToken?.Kind;
    const left = binary?.Left;
    const right = binary?.Right;
    if (!op || !left || !right) return undefined;

    if (
      op === TstsSyntax.KindEqualsEqualsToken ||
      op === TstsSyntax.KindEqualsEqualsEqualsToken ||
      op === TstsSyntax.KindExclamationEqualsToken ||
      op === TstsSyntax.KindExclamationEqualsEqualsToken ||
      op === TstsSyntax.KindLessThanToken ||
      op === TstsSyntax.KindLessThanEqualsToken ||
      op === TstsSyntax.KindGreaterThanToken ||
      op === TstsSyntax.KindGreaterThanEqualsToken
    ) {
      return { kind: "primitiveType", name: "boolean" };
    }

    if (
      op === TstsSyntax.KindAmpersandAmpersandToken ||
      op === TstsSyntax.KindBarBarToken
    ) {
      return { kind: "primitiveType", name: "boolean" };
    }

    if (
      op === TstsSyntax.KindPlusToken ||
      op === TstsSyntax.KindMinusToken ||
      op === TstsSyntax.KindAsteriskToken ||
      op === TstsSyntax.KindSlashToken ||
      op === TstsSyntax.KindPercentToken
    ) {
      const leftType = inferExpressionType(state, left, env);
      const rightType = inferExpressionType(state, right, env);
      if (!leftType || !rightType) return undefined;

      if (
        op === TstsSyntax.KindPlusToken &&
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

    if (
      op === TstsSyntax.KindAmpersandToken ||
      op === TstsSyntax.KindBarToken ||
      op === TstsSyntax.KindCaretToken ||
      op === TstsSyntax.KindLessThanLessThanToken ||
      op === TstsSyntax.KindGreaterThanGreaterThanToken ||
      op === TstsSyntax.KindGreaterThanGreaterThanGreaterThanToken
    ) {
      const leftType = inferExpressionType(state, left, env);
      const rightType = inferExpressionType(state, right, env);
      if (
        !leftType ||
        !rightType ||
        !getNumericKindFromIrType(leftType) ||
        !getNumericKindFromIrType(rightType)
      ) {
        return undefined;
      }

      return { kind: "primitiveType", name: "int" };
    }
  }

  return undefined;
};
