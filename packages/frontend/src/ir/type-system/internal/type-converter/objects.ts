/**
 * Object/interface type conversion
 *
 * Uses local helpers without ProgramContext dependency.
 * Type conversion should NOT depend on statement conversion.
 */

import type { TstsNode } from "@tsonic/tsts";
import { TstsSyntax } from "@tsonic/tsts";
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
import { tryResolveDeterministicPropertyName } from "../../../syntax/property-names.js";
import type { Binding } from "../../../binding/index.js";
import {
  isOptionalParameter,
  isReadonlyMember,
  isRestParameter,
  nodeMembers,
  nodeNameText,
  nodeParameters,
  nodeType,
  unwrapSourceParameterType,
} from "./tsts-syntax.js";

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
  node: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrObjectType | IrDictionaryType => {
  // Check for pure index signature type (no other members)
  const membersSyntax = nodeMembers(node);
  const indexSignatures = membersSyntax.filter(
    TstsSyntax.IsIndexSignatureDeclaration
  );
  const otherMembers = membersSyntax.filter(
    (member) => !TstsSyntax.IsIndexSignatureDeclaration(member)
  );

  // If ONLY index signature(s) exist, convert to dictionary type
  const firstIndexSig = indexSignatures[0];
  if (firstIndexSig !== undefined && otherMembers.length === 0) {
    // Use the first index signature (TypeScript allows multiple, but we take first)
    const indexSig = firstIndexSig;
    const keyParam = nodeParameters(indexSig)[0];

    // Determine key type from parameter type
    const keyType: IrType = keyParam && nodeType(keyParam)
      ? convertKeyType(nodeType(keyParam)!)
      : { kind: "primitiveType", name: "string" };

    // Determine value type - use anyType as marker if not specified
    // The IR soundness gate will catch this and emit TSN7414
    const valueType: IrType = nodeType(indexSig)
      ? convertType(nodeType(indexSig)!, binding)
      : { kind: "anyType" };

    return {
      kind: "dictionaryType",
      keyType,
      valueType,
    };
  }

  // Regular object type with named members
  const members: IrInterfaceMember[] = [];

  membersSyntax.forEach((member) => {
    if (TstsSyntax.IsPropertySignatureDeclaration(member) && nodeType(member)) {
      const memberName = tryResolveDeterministicPropertyName(
        TstsSyntax.Node_Name(member)
      );
      if (!memberName) {
        return;
      }
      const propSig: IrPropertySignature = {
        kind: "propertySignature",
        name: memberName,
        type: convertType(nodeType(member)!, binding),
        isOptional: TstsSyntax.Node_QuestionToken(member) !== undefined,
        isReadonly: isReadonlyMember(member),
      };
      members.push(propSig);
    } else if (TstsSyntax.IsMethodSignatureDeclaration(member)) {
      const memberName =
        tryResolveDeterministicPropertyName(TstsSyntax.Node_Name(member)) ??
        nodeNameText(member);
      if (!memberName) {
        return;
      }
      const methSig: IrMethodSignature = {
        kind: "methodSignature",
        name: memberName,
        parameters: convertTypeParameters(
          nodeParameters(member),
          binding,
          convertType
        ),
        returnType: nodeType(member)
          ? convertType(nodeType(member)!, binding)
          : undefined,
      };
      members.push(methSig);
    }
  });

  return { kind: "objectType", members, structuralOrigin: "inlineStructural" };
};

/**
 * Convert index signature key type to IR type.
 * Supported key domains are string, number, and symbol.
 */
const convertKeyType = (typeNode: TstsNode): IrType => {
  if (typeNode.Kind === TstsSyntax.KindStringKeyword) {
    return { kind: "primitiveType", name: "string" };
  }
  if (typeNode.Kind === TstsSyntax.KindNumberKeyword) {
    return { kind: "primitiveType", name: "number" };
  }
  if (
    typeNode.Kind === TstsSyntax.KindSymbolKeyword ||
    (TstsSyntax.IsTypeReferenceNode(typeNode) &&
      nodeNameText(typeNode) === "symbol")
  ) {
    return { kind: "referenceType", name: "object" };
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
  parameters: readonly TstsNode[],
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): readonly IrParameter[] => {
  return parameters.map((param) => {
    const unwrapped = unwrapSourceParameterType(
      nodeType(param),
      binding.getSourceFact
    );

    // Convert type if present
    const paramType = unwrapped.typeNode
      ? convertType(unwrapped.typeNode, binding)
      : undefined;

    return {
      kind: "parameter" as const,
      pattern: TstsSyntax.Node_Name(param)
        ? convertBindingName(TstsSyntax.Node_Name(param)!)
        : { kind: "identifierPattern", name: "_unknown" },
      type: paramType,
      // Type signatures don't have initializers
      initializer: undefined,
      isOptional: isOptionalParameter(param),
      isRest: isRestParameter(param),
      passing: unwrapped.passing,
    };
  });
};
