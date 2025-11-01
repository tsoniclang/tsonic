/**
 * Type converter - TypeScript types to IR types
 */

import * as ts from "typescript";
import {
  IrType,
  IrPrimitiveType,
  IrFunctionType,
  IrObjectType,
  IrPattern,
  IrObjectPatternProperty,
  IrInterfaceMember,
  IrPropertySignature,
  IrMethodSignature,
} from "./types.js";
import { convertParameters as convertParametersFromStatement } from "./statement-converter.js";

export const convertType = (
  typeNode: ts.TypeNode,
  checker: ts.TypeChecker
): IrType => {
  // Primitive types
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = ts.isIdentifier(typeNode.typeName)
      ? typeNode.typeName.text
      : typeNode.typeName.getText();

    // Check for primitive type names
    const primitiveTypes: Record<string, IrPrimitiveType["name"]> = {
      string: "string",
      number: "number",
      boolean: "boolean",
      null: "null",
      undefined: "undefined",
    };

    const primitiveName = primitiveTypes[typeName];
    if (primitiveName) {
      return {
        kind: "primitiveType",
        name: primitiveName,
      };
    }

    // Reference type (user-defined or library)
    return {
      kind: "referenceType",
      name: typeName,
      typeArguments: typeNode.typeArguments?.map((t) =>
        convertType(t, checker)
      ),
    };
  }

  if (typeNode.kind === ts.SyntaxKind.StringKeyword) {
    return { kind: "primitiveType", name: "string" };
  }
  if (typeNode.kind === ts.SyntaxKind.NumberKeyword) {
    return { kind: "primitiveType", name: "number" };
  }
  if (typeNode.kind === ts.SyntaxKind.BooleanKeyword) {
    return { kind: "primitiveType", name: "boolean" };
  }
  if (typeNode.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "primitiveType", name: "null" };
  }
  if (typeNode.kind === ts.SyntaxKind.UndefinedKeyword) {
    return { kind: "primitiveType", name: "undefined" };
  }
  if (typeNode.kind === ts.SyntaxKind.VoidKeyword) {
    return { kind: "voidType" };
  }
  if (typeNode.kind === ts.SyntaxKind.AnyKeyword) {
    return { kind: "anyType" };
  }
  if (typeNode.kind === ts.SyntaxKind.UnknownKeyword) {
    return { kind: "unknownType" };
  }
  if (typeNode.kind === ts.SyntaxKind.NeverKeyword) {
    return { kind: "neverType" };
  }

  // Array types
  if (ts.isArrayTypeNode(typeNode)) {
    return {
      kind: "arrayType",
      elementType: convertType(typeNode.elementType, checker),
    };
  }

  // Function types
  if (ts.isFunctionTypeNode(typeNode)) {
    return convertFunctionType(typeNode, checker);
  }

  // Object/interface types
  if (ts.isTypeLiteralNode(typeNode)) {
    return convertObjectType(typeNode, checker);
  }

  // Union types
  if (ts.isUnionTypeNode(typeNode)) {
    return {
      kind: "unionType",
      types: typeNode.types.map((t) => convertType(t, checker)),
    };
  }

  // Intersection types
  if (ts.isIntersectionTypeNode(typeNode)) {
    return {
      kind: "intersectionType",
      types: typeNode.types.map((t) => convertType(t, checker)),
    };
  }

  // Literal types
  if (ts.isLiteralTypeNode(typeNode)) {
    const literal = typeNode.literal;
    if (ts.isStringLiteral(literal)) {
      return { kind: "literalType", value: literal.text };
    }
    if (ts.isNumericLiteral(literal)) {
      return { kind: "literalType", value: Number(literal.text) };
    }
    if (literal.kind === ts.SyntaxKind.TrueKeyword) {
      return { kind: "literalType", value: true };
    }
    if (literal.kind === ts.SyntaxKind.FalseKeyword) {
      return { kind: "literalType", value: false };
    }
  }

  // Parenthesized types
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return convertType(typeNode.type, checker);
  }

  // Default to any type for unsupported types
  return { kind: "anyType" };
};

const convertFunctionType = (
  node: ts.FunctionTypeNode,
  checker: ts.TypeChecker
): IrFunctionType => {
  return {
    kind: "functionType",
    parameters: convertParametersFromStatement(node.parameters, checker),
    returnType: convertType(node.type, checker),
  };
};

const convertObjectType = (
  node: ts.TypeLiteralNode,
  checker: ts.TypeChecker
): IrObjectType => {
  const members: IrInterfaceMember[] = [];

  node.members.forEach((member) => {
    if (ts.isPropertySignature(member) && member.type) {
      const propSig: IrPropertySignature = {
        kind: "propertySignature",
        name:
          member.name && ts.isIdentifier(member.name)
            ? member.name.text
            : "[computed]",
        type: convertType(member.type, checker),
        isOptional: !!member.questionToken,
        isReadonly: !!member.modifiers?.some(
          (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
        ),
      };
      members.push(propSig);
    } else if (ts.isMethodSignature(member)) {
      const methSig: IrMethodSignature = {
        kind: "methodSignature",
        name:
          member.name && ts.isIdentifier(member.name)
            ? member.name.text
            : "[computed]",
        parameters: convertParametersFromStatement(member.parameters, checker),
        returnType: member.type ? convertType(member.type, checker) : undefined,
      };
      members.push(methSig);
    }
  });

  return { kind: "objectType", members };
};

export const convertBindingName = (name: ts.BindingName): IrPattern => {
  if (ts.isIdentifier(name)) {
    return {
      kind: "identifierPattern",
      name: name.text,
    };
  }

  if (ts.isArrayBindingPattern(name)) {
    return {
      kind: "arrayPattern",
      elements: name.elements.map((elem) => {
        if (ts.isOmittedExpression(elem)) {
          return undefined; // Hole in array pattern
        }
        if (ts.isBindingElement(elem)) {
          return convertBindingName(elem.name);
        }
        return undefined;
      }),
    };
  }

  if (ts.isObjectBindingPattern(name)) {
    const properties: IrObjectPatternProperty[] = [];

    name.elements.forEach((elem) => {
      if (elem.dotDotDotToken) {
        // Rest property
        properties.push({
          kind: "rest",
          pattern: convertBindingName(elem.name),
        });
      } else {
        const key = elem.propertyName
          ? ts.isIdentifier(elem.propertyName)
            ? elem.propertyName.text
            : elem.propertyName.getText()
          : ts.isIdentifier(elem.name)
            ? elem.name.text
            : "[computed]";

        properties.push({
          kind: "property",
          key,
          value: convertBindingName(elem.name),
          shorthand: !elem.propertyName,
        });
      }
    });

    return {
      kind: "objectPattern",
      properties,
    };
  }

  // Default to identifier pattern (should not reach here normally)
  return {
    kind: "identifierPattern",
    name: "_unknown",
  };
};
