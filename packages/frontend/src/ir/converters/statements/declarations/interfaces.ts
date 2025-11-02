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
 * Check if a type reference is the struct marker
 */
const isStructMarker = (
  typeRef: ts.ExpressionWithTypeArguments,
  checker: ts.TypeChecker
): boolean => {
  const symbol = checker.getSymbolAtLocation(typeRef.expression);
  return symbol?.escapedName === "struct" || symbol?.escapedName === "Struct";
};

/**
 * Check if an interface declaration IS the struct marker itself (should be filtered out)
 */
const isMarkerInterface = (node: ts.InterfaceDeclaration): boolean => {
  const name = node.name.text;
  if (name !== "struct" && name !== "Struct") {
    return false;
  }

  // Check if it has only the __brand property
  const members = node.members;
  if (members.length !== 1) {
    return false;
  }

  const member = members[0];
  if (!member || !ts.isPropertySignature(member)) {
    return false;
  }

  const memberName =
    member.name && ts.isIdentifier(member.name) ? member.name.text : "";
  return memberName === "__brand";
};

/**
 * Convert interface declaration
 * Returns null for marker interfaces that should be filtered out
 */
export const convertInterfaceDeclaration = (
  node: ts.InterfaceDeclaration,
  checker: ts.TypeChecker
): IrInterfaceDeclaration | null => {
  // Filter out marker interfaces completely
  if (isMarkerInterface(node)) {
    return null;
  }
  // Detect struct marker in extends clause
  let isStruct = false;
  const extendsClause = node.heritageClauses?.find(
    (h) => h.token === ts.SyntaxKind.ExtendsKeyword
  );
  const extendsTypes =
    extendsClause?.types
      .filter((t) => {
        if (isStructMarker(t, checker)) {
          isStruct = true;
          return false; // Remove marker from extends
        }
        return true;
      })
      .map((t) => convertType(t, checker)) ?? [];

  const allMembers = node.members
    .map((m) => convertInterfaceMember(m, checker))
    .filter((m): m is IrInterfaceMember => m !== null);

  // Filter out __brand property if this is a struct
  const finalMembers = isStruct
    ? allMembers.filter(
        (m) => m.kind !== "propertySignature" || m.name !== "__brand"
      )
    : allMembers;

  return {
    kind: "interfaceDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, checker),
    extends: extendsTypes,
    members: finalMembers,
    isExported: hasExportModifier(node),
    isStruct,
  };
};
