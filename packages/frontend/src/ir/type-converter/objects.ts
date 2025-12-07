/**
 * Object/interface type conversion
 */

import * as ts from "typescript";
import {
  IrType,
  IrObjectType,
  IrDictionaryType,
  IrInterfaceMember,
  IrPropertySignature,
  IrMethodSignature,
} from "../types.js";
import { convertParameters as convertParametersFromStatement } from "../statement-converter.js";

/**
 * Convert TypeScript object literal type to IR type.
 *
 * Returns IrDictionaryType for pure index signature types like:
 * - `{ [k: string]: T }`
 * - `{ [k: number]: T }`
 *
 * Returns IrObjectType for regular object types with named members.
 */
export const convertObjectType = (
  node: ts.TypeLiteralNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrObjectType | IrDictionaryType => {
  // Check for pure index signature type (no other members)
  const indexSignatures = node.members.filter(ts.isIndexSignatureDeclaration);
  const otherMembers = node.members.filter(
    (m) => !ts.isIndexSignatureDeclaration(m)
  );

  // If ONLY index signature(s) exist, convert to dictionary type
  const firstIndexSig = indexSignatures[0];
  if (firstIndexSig !== undefined && otherMembers.length === 0) {
    // Use the first index signature (TypeScript allows multiple, but we take first)
    const indexSig = firstIndexSig;
    const keyParam = indexSig.parameters[0];

    // Determine key type from parameter type
    const keyType: IrType = keyParam?.type
      ? convertKeyType(keyParam.type)
      : { kind: "primitiveType", name: "string" };

    // Determine value type - use anyType as marker if not specified
    // The IR soundness gate will catch this and emit TSN7414
    const valueType: IrType = indexSig.type
      ? convertType(indexSig.type, checker)
      : { kind: "anyType" };

    return {
      kind: "dictionaryType",
      keyType,
      valueType,
    };
  }

  // Regular object type with named members
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

/**
 * Convert index signature key type to IR type.
 * Only string and number are valid as index signature keys.
 */
const convertKeyType = (typeNode: ts.TypeNode): IrType => {
  if (typeNode.kind === ts.SyntaxKind.StringKeyword) {
    return { kind: "primitiveType", name: "string" };
  }
  if (typeNode.kind === ts.SyntaxKind.NumberKeyword) {
    return { kind: "primitiveType", name: "number" };
  }
  // Fallback to string for other cases
  return { kind: "primitiveType", name: "string" };
};
