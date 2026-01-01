/**
 * Interface declaration converter
 */

import * as ts from "typescript";
import {
  IrInterfaceDeclaration,
  IrInterfaceMember,
  IrTypeAliasDeclaration,
  IrType,
} from "../../../types.js";
import { convertType } from "../../../type-converter.js";
import {
  hasExportModifier,
  hasReadonlyModifier,
  convertTypeParameters,
  convertParameters,
} from "../helpers.js";
import type { Binding } from "../../../binding/index.js";

/**
 * Convert interface member
 */
export const convertInterfaceMember = (
  node: ts.TypeElement,
  binding: Binding
): IrInterfaceMember | null => {
  if (ts.isPropertySignature(node) && node.type) {
    return {
      kind: "propertySignature",
      name:
        node.name && ts.isIdentifier(node.name) ? node.name.text : "[computed]",
      type: convertType(node.type, binding),
      isOptional: !!node.questionToken,
      isReadonly: hasReadonlyModifier(node),
    };
  }

  if (ts.isMethodSignature(node)) {
    return {
      kind: "methodSignature",
      name:
        node.name && ts.isIdentifier(node.name) ? node.name.text : "[computed]",
      typeParameters: convertTypeParameters(node.typeParameters, binding),
      parameters: convertParameters(node.parameters, binding),
      returnType: node.type ? convertType(node.type, binding) : undefined,
    };
  }

  return null;
};

/**
 * Check if a type reference is the struct marker.
 * DETERMINISTIC: Uses only the AST expression text, not TypeScript type resolution.
 */
const isStructMarker = (typeRef: ts.ExpressionWithTypeArguments): boolean => {
  // Check the expression directly - it should be an identifier named "struct" or "Struct"
  if (ts.isIdentifier(typeRef.expression)) {
    const name = typeRef.expression.text;
    return name === "struct" || name === "Struct";
  }
  return false;
};

/**
 * Check if an interface has only index signatures (no property/method members).
 * Returns the dictionary type info if so, undefined otherwise.
 *
 * This handles interfaces like:
 *   interface NumberIndexed { [key: number]: string; }
 *
 * These should be lowered to type aliases for Dictionary<K, V>.
 */
const extractIndexSignatureOnlyInterface = (
  node: ts.InterfaceDeclaration,
  binding: Binding
): { keyType: IrType; valueType: IrType } | undefined => {
  const members = node.members;

  // Must have exactly one member
  if (members.length !== 1) {
    return undefined;
  }

  const member = members[0];
  if (!member || !ts.isIndexSignatureDeclaration(member)) {
    return undefined;
  }

  // Extract key type from the index signature parameter
  const param = member.parameters[0];
  if (!param || !param.type) {
    return undefined;
  }

  const keyType = convertType(param.type, binding);

  // Only allow string or number keys (enforced by TSN7413)
  if (
    keyType.kind !== "primitiveType" ||
    (keyType.name !== "string" && keyType.name !== "number")
  ) {
    return undefined;
  }

  // Extract value type
  if (!member.type) {
    return undefined;
  }

  const valueType = convertType(member.type, binding);

  return { keyType, valueType };
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
 * Returns null for marker interfaces that should be filtered out.
 * Returns a type alias for index-signature-only interfaces (lowered to Dictionary).
 */
export const convertInterfaceDeclaration = (
  node: ts.InterfaceDeclaration,
  binding: Binding
): IrInterfaceDeclaration | IrTypeAliasDeclaration | null => {
  // Filter out marker interfaces completely
  if (isMarkerInterface(node)) {
    return null;
  }

  // Check for index-signature-only interface → lower to type alias for dictionary
  const dictInfo = extractIndexSignatureOnlyInterface(node, binding);
  if (dictInfo) {
    return {
      kind: "typeAliasDeclaration",
      name: node.name.text,
      typeParameters: convertTypeParameters(node.typeParameters, binding),
      type: {
        kind: "dictionaryType",
        keyType: dictInfo.keyType,
        valueType: dictInfo.valueType,
      },
      isExported: hasExportModifier(node),
      isStruct: false,
    };
  }
  // Detect struct marker in extends clause
  let isStruct = false;
  const extendsClause = node.heritageClauses?.find(
    (h) => h.token === ts.SyntaxKind.ExtendsKeyword
  );
  const extendsTypes =
    extendsClause?.types
      .filter((t) => {
        if (isStructMarker(t)) {
          isStruct = true;
          return false; // Remove marker from extends
        }
        return true;
      })
      .map((t) => convertType(t, binding)) ?? [];

  const allMembers = node.members
    .map((m) => convertInterfaceMember(m, binding))
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
    typeParameters: convertTypeParameters(node.typeParameters, binding),
    extends: extendsTypes,
    members: finalMembers,
    isExported: hasExportModifier(node),
    isStruct,
  };
};
