/**
 * Expression and member type inference helpers for TypeRegistry.
 *
 * Split from registry-helpers.ts for file-size compliance (< 500 LOC).
 */

import * as ts from "typescript";
import type {
  IrType,
  IrMethodSignature,
  IrInterfaceMember,
} from "../../types/index.js";
import { irTypesEqual } from "../../types/type-ops.js";
import { tryResolveDeterministicPropertyName } from "../../syntax/property-names.js";
import type { ConvertTypeFn } from "./type-registry.js";

export const inferExpressionTypeSyntax = (
  expr: ts.Expression,
  convertType: ConvertTypeFn
): IrType | undefined => {
  let current = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }

  if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
    return convertType(current.type);
  }

  if (ts.isNonNullExpression(current)) {
    return inferExpressionTypeSyntax(current.expression, convertType);
  }

  if (
    ts.isStringLiteral(current) ||
    ts.isNoSubstitutionTemplateLiteral(current)
  ) {
    return { kind: "primitiveType", name: "string" };
  }

  if (ts.isNumericLiteral(current)) {
    return { kind: "primitiveType", name: "number" };
  }

  if (
    current.kind === ts.SyntaxKind.TrueKeyword ||
    current.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return { kind: "primitiveType", name: "boolean" };
  }

  if (current.kind === ts.SyntaxKind.UndefinedKeyword) {
    return { kind: "primitiveType", name: "undefined" };
  }

  if (current.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "primitiveType", name: "null" };
  }

  if (ts.isArrayLiteralExpression(current)) {
    const elementTypes: IrType[] = [];
    for (const element of current.elements) {
      if (ts.isOmittedExpression(element) || ts.isSpreadElement(element)) {
        return undefined;
      }
      const elementType = inferExpressionTypeSyntax(element, convertType);
      if (!elementType) return undefined;
      elementTypes.push(elementType);
    }

    if (elementTypes.length === 0) return undefined;
    const first = elementTypes[0];
    if (
      first &&
      elementTypes.every((candidate) => irTypesEqual(candidate, first))
    ) {
      return { kind: "arrayType", elementType: first };
    }

    return { kind: "tupleType", elementTypes };
  }

  if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
    const parameters = current.parameters.map((parameter, index) => ({
      kind: "parameter" as const,
      pattern: {
        kind: "identifierPattern" as const,
        name: ts.isIdentifier(parameter.name)
          ? parameter.name.text
          : `arg${index}`,
      },
      type: parameter.type ? convertType(parameter.type) : undefined,
      initializer: undefined,
      isOptional: !!parameter.questionToken,
      isRest: !!parameter.dotDotDotToken,
      passing: "value" as const,
    }));

    const returnType = current.type
      ? convertType(current.type)
      : ts.isBlock(current.body)
        ? (() => {
            const returns = current.body.statements.filter(
              ts.isReturnStatement
            );
            if (returns.length === 0) return { kind: "voidType" as const };
            const firstExpr = returns[0]?.expression;
            return firstExpr
              ? inferExpressionTypeSyntax(firstExpr, convertType)
              : { kind: "voidType" as const };
          })()
        : inferExpressionTypeSyntax(current.body, convertType);

    if (!returnType) return undefined;
    return {
      kind: "functionType",
      parameters,
      returnType,
    };
  }

  if (ts.isObjectLiteralExpression(current)) {
    const members: IrInterfaceMember[] = [];
    for (const property of current.properties) {
      if (
        ts.isSpreadAssignment(property) ||
        ts.isShorthandPropertyAssignment(property)
      ) {
        return undefined;
      }

      if (ts.isPropertyAssignment(property)) {
        const name = tryResolveDeterministicPropertyName(property.name);
        if (!name) return undefined;
        const propertyType = inferExpressionTypeSyntax(
          property.initializer,
          convertType
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

      if (ts.isMethodDeclaration(property)) {
        const name = tryResolveDeterministicPropertyName(property.name);
        if (!name) return undefined;
        const parameters = property.parameters.map((parameter, index) => ({
          kind: "parameter" as const,
          pattern: {
            kind: "identifierPattern" as const,
            name: ts.isIdentifier(parameter.name)
              ? parameter.name.text
              : `arg${index}`,
          },
          type: parameter.type ? convertType(parameter.type) : undefined,
          initializer: undefined,
          isOptional: !!parameter.questionToken,
          isRest: !!parameter.dotDotDotToken,
          passing: "value" as const,
        }));
        const returnType = property.type
          ? convertType(property.type)
          : property.body
            ? (() => {
                const returns = property.body.statements.filter(
                  ts.isReturnStatement
                );
                if (returns.length === 0) return { kind: "voidType" as const };
                const firstExpr = returns[0]?.expression;
                return firstExpr
                  ? inferExpressionTypeSyntax(firstExpr, convertType)
                  : { kind: "voidType" as const };
              })()
            : undefined;
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
  member:
    | ts.PropertyDeclaration
    | ts.GetAccessorDeclaration
    | ts.SetAccessorDeclaration,
  convertType: ConvertTypeFn
): IrType | undefined => {
  if ("type" in member && member.type) {
    return convertType(member.type);
  }

  if (ts.isPropertyDeclaration(member) && member.initializer) {
    return inferExpressionTypeSyntax(member.initializer, convertType);
  }

  if (ts.isGetAccessorDeclaration(member) && member.body) {
    const returns = member.body.statements.filter(ts.isReturnStatement);
    if (returns.length === 0) return undefined;
    const firstExpr = returns[0]?.expression;
    return firstExpr
      ? inferExpressionTypeSyntax(firstExpr, convertType)
      : undefined;
  }

  if (ts.isSetAccessorDeclaration(member)) {
    const valueParam = member.parameters[0];
    if (valueParam?.type) {
      return convertType(valueParam.type);
    }
  }

  return undefined;
};

/**
 * Convert method declaration to IrMethodSignature
 */
export const convertMethodToSignature = (
  method: ts.MethodDeclaration,
  convertType: ConvertTypeFn
): IrMethodSignature => ({
  kind: "methodSignature",
  name: tryResolveDeterministicPropertyName(method.name) ?? "[computed]",
  parameters: method.parameters.map((p) => ({
    kind: "parameter" as const,
    pattern: {
      kind: "identifierPattern" as const,
      name: ts.isIdentifier(p.name) ? p.name.text : "param",
    },
    type: p.type ? convertType(p.type) : undefined,
    isOptional: !!p.questionToken || !!p.initializer,
    isRest: !!p.dotDotDotToken,
    passing: "value" as const,
  })),
  returnType: method.type ? convertType(method.type) : undefined,
  typeParameters: method.typeParameters?.map((tp) => ({
    kind: "typeParameter" as const,
    name: tp.name.text,
    constraint: tp.constraint ? convertType(tp.constraint) : undefined,
    default: tp.default ? convertType(tp.default) : undefined,
  })),
});

/**
 * Convert method signature to IrMethodSignature
 */
export const convertMethodSignatureToIr = (
  method: ts.MethodSignature,
  convertType: ConvertTypeFn
): IrMethodSignature => ({
  kind: "methodSignature",
  name: tryResolveDeterministicPropertyName(method.name) ?? "[computed]",
  parameters: method.parameters.map((p) => ({
    kind: "parameter" as const,
    pattern: {
      kind: "identifierPattern" as const,
      name: ts.isIdentifier(p.name) ? p.name.text : "param",
    },
    type: p.type ? convertType(p.type) : undefined,
    isOptional: !!p.questionToken || !!p.initializer,
    isRest: !!p.dotDotDotToken,
    passing: "value" as const,
  })),
  returnType: method.type ? convertType(method.type) : undefined,
  typeParameters: method.typeParameters?.map((tp) => ({
    kind: "typeParameter" as const,
    name: tp.name.text,
    constraint: tp.constraint ? convertType(tp.constraint) : undefined,
    default: tp.default ? convertType(tp.default) : undefined,
  })),
});
