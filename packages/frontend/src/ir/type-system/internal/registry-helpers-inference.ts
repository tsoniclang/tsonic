/**
 * Expression and member type inference helpers for TypeRegistry.
 *
 * These helpers consume TSTS syntax nodes. They only infer syntax-local facts
 * needed to seed the IR type registry; flow and checker semantics stay behind
 * the TSTS source semantic facade.
 */

import type { TstsNode } from "@tsonic/tsts";
import {
  getTstsDeclaredTypeNode,
  getTstsNodeNameText,
  getTstsParameters,
  getTstsPropertyNameText,
  getTstsTypeParameterNodes,
  isTstsOptionalParameter,
  isTstsRestParameter,
  TstsSyntax,
} from "@tsonic/tsts";
import type {
  IrType,
  IrMethodSignature,
  IrInterfaceMember,
  IrTypeParameter,
} from "../../types/index.js";
import { irTypesEqual } from "../../types/type-ops.js";
import type { ConvertTypeFn } from "./type-registry.js";

const concreteTstsNodes = (
  nodes: readonly (TstsNode | undefined)[]
): readonly TstsNode[] =>
  nodes.filter((node): node is TstsNode => node !== undefined);

const typeReferenceNameFromConstructorExpression = (
  expression: TstsNode | undefined
): string | undefined => {
  if (!expression) return undefined;
  if (TstsSyntax.IsIdentifier(expression)) {
    return TstsSyntax.Node_Text(expression);
  }
  if (TstsSyntax.IsPropertyAccessExpression(expression)) {
    const left = typeReferenceNameFromConstructorExpression(
      TstsSyntax.Node_Expression(expression)
    );
    const right = getTstsNodeNameText(expression);
    return left && right ? `${left}.${right}` : right;
  }
  return undefined;
};

const unwrapExpression = (expression: TstsNode): TstsNode => {
  let current = expression;
  while (TstsSyntax.IsParenthesizedExpression(current)) {
    const inner = TstsSyntax.Node_Expression(current);
    if (!inner) break;
    current = inner;
  }
  return current;
};

const parameterToIr = (
  parameter: TstsNode,
  index: number,
  convertType: ConvertTypeFn
) => ({
  kind: "parameter" as const,
  pattern: {
    kind: "identifierPattern" as const,
    name: getTstsNodeNameText(parameter) ?? `arg${index}`,
  },
  type: getTstsDeclaredTypeNode(parameter)
    ? convertType(getTstsDeclaredTypeNode(parameter)!)
    : undefined,
  initializer: undefined,
  isOptional: isTstsOptionalParameter(parameter),
  isRest: isTstsRestParameter(parameter),
  passing: "value" as const,
});

const typeParameterToIr = (
  typeParameter: TstsNode,
  convertType: ConvertTypeFn
): IrTypeParameter => {
  const data = TstsSyntax.AsTypeParameterDeclaration(typeParameter);
  const constraint = data?.Constraint;
  const defaultType = data?.DefaultType;
  return {
    kind: "typeParameter",
    name: getTstsNodeNameText(typeParameter) ?? "T",
    constraint: constraint ? convertType(constraint) : undefined,
    default: defaultType ? convertType(defaultType) : undefined,
    variance: undefined,
    isStructuralConstraint: constraint?.Kind === TstsSyntax.KindTypeLiteral,
    structuralMembers: undefined,
  };
};

const typeParametersToIr = (
  node: TstsNode,
  convertType: ConvertTypeFn
): readonly IrTypeParameter[] | undefined => {
  const typeParameters = concreteTstsNodes(getTstsTypeParameterNodes(node)).map(
    (typeParameter) => typeParameterToIr(typeParameter, convertType)
  );
  return typeParameters.length > 0 ? typeParameters : undefined;
};

const inferBlockReturnType = (
  body: TstsNode | undefined,
  convertType: ConvertTypeFn
): IrType | undefined => {
  if (!body) return undefined;
  const returns = (TstsSyntax.Node_Statements(body) ?? []).filter(
    (statement): statement is TstsNode =>
      statement !== undefined && TstsSyntax.IsReturnStatement(statement)
  );
  if (returns.length === 0) return { kind: "voidType" };
  const firstExpression = TstsSyntax.Node_Expression(returns[0]);
  return firstExpression
    ? inferExpressionTypeSyntax(firstExpression, convertType)
    : { kind: "voidType" };
};

export const inferExpressionTypeSyntax = (
  expression: TstsNode,
  convertType: ConvertTypeFn
): IrType | undefined => {
  const current = unwrapExpression(expression);

  if (TstsSyntax.IsAsExpression(current)) {
    const typeNode = TstsSyntax.Node_Type(current);
    return typeNode ? convertType(typeNode) : undefined;
  }

  if (TstsSyntax.IsNonNullExpression(current)) {
    const inner = TstsSyntax.Node_Expression(current);
    return inner ? inferExpressionTypeSyntax(inner, convertType) : undefined;
  }

  if (
    TstsSyntax.IsStringLiteral(current) ||
    TstsSyntax.IsNoSubstitutionTemplateLiteral(current)
  ) {
    return { kind: "primitiveType", name: "string" };
  }

  if (TstsSyntax.IsNumericLiteral(current)) {
    return { kind: "primitiveType", name: "number" };
  }

  if (
    current.Kind === TstsSyntax.KindTrueKeyword ||
    current.Kind === TstsSyntax.KindFalseKeyword
  ) {
    return { kind: "primitiveType", name: "boolean" };
  }

  if (current.Kind === TstsSyntax.KindUndefinedKeyword) {
    return { kind: "primitiveType", name: "undefined" };
  }

  if (current.Kind === TstsSyntax.KindNullKeyword) {
    return { kind: "primitiveType", name: "null" };
  }

  if (TstsSyntax.IsArrayLiteralExpression(current)) {
    const elementTypes: IrType[] = [];
    for (const element of TstsSyntax.Node_Elements(current) ?? []) {
      if (
        !element ||
        TstsSyntax.IsOmittedExpression(element) ||
        TstsSyntax.IsSpreadElement(element)
      ) {
        return undefined;
      }
      const elementType = inferExpressionTypeSyntax(element, convertType);
      if (!elementType) return undefined;
      elementTypes.push(elementType);
    }
    const first = elementTypes[0];
    if (!first) return undefined;
    return elementTypes.every((candidate) => irTypesEqual(candidate, first))
      ? { kind: "arrayType", elementType: first }
      : { kind: "tupleType", elementTypes };
  }

  if (TstsSyntax.IsNewExpression(current)) {
    const typeName = typeReferenceNameFromConstructorExpression(
      TstsSyntax.Node_Expression(current)
    );
    if (!typeName) return undefined;
    const typeArguments = (TstsSyntax.Node_TypeArguments(current) ?? [])
      .filter((node): node is TstsNode => node !== undefined)
      .map(convertType);
    if (typeName === "Array" || typeName === "ReadonlyArray") {
      const elementType = typeArguments[0];
      return elementType ? { kind: "arrayType", elementType } : undefined;
    }
    return {
      kind: "referenceType",
      name: typeName,
      typeArguments,
      structuralOrigin: "namedReference",
    };
  }

  if (
    TstsSyntax.IsArrowFunction(current) ||
    TstsSyntax.IsFunctionExpression(current)
  ) {
    const parameters = concreteTstsNodes(getTstsParameters(current)).map(
      (parameter, index) => parameterToIr(parameter, index, convertType)
    );
    const explicitReturnType = getTstsDeclaredTypeNode(current);
    const body = TstsSyntax.Node_Body(current);
    const returnType = explicitReturnType
      ? convertType(explicitReturnType)
      : body && TstsSyntax.IsBlock(body)
        ? inferBlockReturnType(body, convertType)
        : body
          ? inferExpressionTypeSyntax(body, convertType)
          : undefined;
    return returnType
      ? {
          kind: "functionType",
          parameters,
          returnType,
        }
      : undefined;
  }

  if (TstsSyntax.IsObjectLiteralExpression(current)) {
    const members: IrInterfaceMember[] = [];
    for (const property of TstsSyntax.Node_Properties(current) ?? []) {
      if (
        !property ||
        TstsSyntax.IsSpreadAssignment(property) ||
        TstsSyntax.IsShorthandPropertyAssignment(property)
      ) {
        return undefined;
      }
      const name = getTstsPropertyNameText(property) ?? getTstsNodeNameText(property);
      if (!name) return undefined;

      if (TstsSyntax.IsPropertyAssignment(property)) {
        const initializer = TstsSyntax.Node_Initializer(property);
        const propertyType = initializer
          ? inferExpressionTypeSyntax(initializer, convertType)
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

      if (TstsSyntax.IsMethodDeclaration(property)) {
        const parameters = concreteTstsNodes(getTstsParameters(property)).map(
          (parameter, index) => parameterToIr(parameter, index, convertType)
        );
        const returnType =
          getTstsDeclaredTypeNode(property) !== undefined
            ? convertType(getTstsDeclaredTypeNode(property)!)
            : inferBlockReturnType(TstsSyntax.Node_Body(property), convertType);
        if (!returnType) return undefined;
        members.push({
          kind: "methodSignature",
          name,
          parameters,
          returnType,
        });
        continue;
      }

      return undefined;
    }

    return { kind: "objectType", members };
  }

  return undefined;
};

export const inferMemberType = (
  member: TstsNode,
  convertType: ConvertTypeFn
): IrType | undefined => {
  const explicitType = getTstsDeclaredTypeNode(member);
  if (explicitType) {
    return convertType(explicitType);
  }

  if (TstsSyntax.IsPropertyDeclaration(member)) {
    const initializer = TstsSyntax.Node_Initializer(member);
    return initializer
      ? inferExpressionTypeSyntax(initializer, convertType)
      : undefined;
  }

  if (TstsSyntax.IsGetAccessorDeclaration(member)) {
    return inferBlockReturnType(TstsSyntax.Node_Body(member), convertType);
  }

  if (TstsSyntax.IsSetAccessorDeclaration(member)) {
    const [parameter] = concreteTstsNodes(getTstsParameters(member));
    const parameterType = parameter ? getTstsDeclaredTypeNode(parameter) : undefined;
    return parameterType ? convertType(parameterType) : undefined;
  }

  return undefined;
};

export const convertMethodToSignature = (
  method: TstsNode,
  convertType: ConvertTypeFn
): IrMethodSignature => {
  const parameters = concreteTstsNodes(getTstsParameters(method)).map(
    (parameter, index) => parameterToIr(parameter, index, convertType)
  );
  return {
    kind: "methodSignature",
    name: getTstsPropertyNameText(method) ?? getTstsNodeNameText(method) ?? "method",
    typeParameters: typeParametersToIr(method, convertType),
    parameters,
    returnType: getTstsDeclaredTypeNode(method)
      ? convertType(getTstsDeclaredTypeNode(method)!)
      : { kind: "voidType" },
  };
};

export const convertMethodSignatureToIr = convertMethodToSignature;
