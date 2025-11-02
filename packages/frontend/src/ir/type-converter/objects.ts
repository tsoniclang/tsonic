/**
 * Object/interface type conversion
 */

import * as ts from "typescript";
import {
  IrType,
  IrObjectType,
  IrInterfaceMember,
  IrPropertySignature,
  IrMethodSignature,
} from "../types.js";
import { convertParameters as convertParametersFromStatement } from "../statement-converter.js";

/**
 * Convert TypeScript object literal type to IR object type
 */
export const convertObjectType = (
  node: ts.TypeLiteralNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
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
