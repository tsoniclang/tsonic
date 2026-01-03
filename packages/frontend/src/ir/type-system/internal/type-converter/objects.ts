/**
 * Object/interface type conversion
 *
 * Phase 5 Step 4: Uses local parameter helper (no ProgramContext dependency).
 * Type conversion should NOT depend on statement conversion.
 */

import * as ts from "typescript";
import {
  IrType,
  IrObjectType,
  IrDictionaryType,
  IrInterfaceMember,
  IrPropertySignature,
  IrMethodSignature,
  IrParameter,
} from "../../../types.js";
import { convertBindingName } from "../../../syntax/binding-patterns.js";
import type { Binding } from "../../../binding/index.js";

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
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
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
      ? convertType(indexSig.type, binding)
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
        type: convertType(member.type, binding),
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
        parameters: convertTypeParameters(
          member.parameters,
          binding,
          convertType
        ),
        returnType: member.type ? convertType(member.type, binding) : undefined,
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

/**
 * Convert parameters for method signatures (no initializers, no ProgramContext).
 *
 * This is used for MethodSignature in type contexts.
 * Unlike statement-converter's convertParameters, this:
 * - Does NOT convert initializers (type signatures don't have them)
 * - Does NOT require ProgramContext
 * - Takes a convertType function for type node conversion
 */
const convertTypeParameters = (
  parameters: ts.NodeArray<ts.ParameterDeclaration>,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): readonly IrParameter[] => {
  return parameters.map((param) => {
    let passing: "value" | "ref" | "out" | "in" = "value";
    let actualType: ts.TypeNode | undefined = param.type;

    // Detect ref<T>, out<T>, in<T>, inref<T> wrapper types
    if (
      param.type &&
      ts.isTypeReferenceNode(param.type) &&
      ts.isIdentifier(param.type.typeName)
    ) {
      const typeName = param.type.typeName.text;
      if (
        (typeName === "ref" ||
          typeName === "out" ||
          typeName === "in" ||
          typeName === "inref") &&
        param.type.typeArguments &&
        param.type.typeArguments.length > 0
      ) {
        // Set passing mode (both "in" and "inref" map to C# "in")
        passing =
          typeName === "in" || typeName === "inref"
            ? "in"
            : (typeName as "ref" | "out");
        // Extract wrapped type
        actualType = param.type.typeArguments[0];
      }
    }

    // Convert type if present
    const paramType = actualType ? convertType(actualType, binding) : undefined;

    return {
      kind: "parameter" as const,
      pattern: convertBindingName(param.name),
      type: paramType,
      // Type signatures don't have initializers
      initializer: undefined,
      isOptional: !!param.questionToken,
      isRest: !!param.dotDotDotToken,
      passing,
    };
  });
};
