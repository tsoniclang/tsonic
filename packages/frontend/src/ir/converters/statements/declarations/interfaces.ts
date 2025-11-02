/**
 * Interface declaration converter
 */

import * as ts from "typescript";
import { IrInterfaceDeclaration, IrInterfaceMember } from "../../../types.js";
import { convertType } from "../../../type-converter.js";
import {
  hasExportModifier,
  hasReadonlyModifier,
  convertTypeParameters,
  convertParameters,
} from "../helpers.js";

/**
 * Convert interface member
 */
export const convertInterfaceMember = (
  node: ts.TypeElement,
  checker: ts.TypeChecker
): IrInterfaceMember | null => {
  if (ts.isPropertySignature(node) && node.type) {
    return {
      kind: "propertySignature",
      name:
        node.name && ts.isIdentifier(node.name) ? node.name.text : "[computed]",
      type: convertType(node.type, checker),
      isOptional: !!node.questionToken,
      isReadonly: hasReadonlyModifier(node),
    };
  }

  if (ts.isMethodSignature(node)) {
    return {
      kind: "methodSignature",
      name:
        node.name && ts.isIdentifier(node.name) ? node.name.text : "[computed]",
      typeParameters: convertTypeParameters(node.typeParameters, checker),
      parameters: convertParameters(node.parameters, checker),
      returnType: node.type ? convertType(node.type, checker) : undefined,
    };
  }

  return null;
};

/**
 * Convert interface declaration
 */
export const convertInterfaceDeclaration = (
  node: ts.InterfaceDeclaration,
  checker: ts.TypeChecker
): IrInterfaceDeclaration => {
  const extendsTypes =
    node.heritageClauses
      ?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)
      ?.types.map((t) => convertType(t, checker)) ?? [];

  return {
    kind: "interfaceDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, checker),
    extends: extendsTypes,
    members: node.members
      .map((m) => convertInterfaceMember(m, checker))
      .filter((m): m is IrInterfaceMember => m !== null),
    isExported: hasExportModifier(node),
  };
};
