/**
 * Function type conversion
 *
 * Uses local parameter helpers without ProgramContext dependency.
 * Type conversion should NOT depend on statement conversion.
 */

import * as ts from "typescript";
import {
  IrType,
  IrFunctionType,
  IrParameter,
  IrTypeParameter,
} from "../../../types.js";
import { convertBindingName } from "../../../syntax/binding-patterns.js";
import type { Binding } from "../../../binding/index.js";
import { unwrapSourceParameterType } from "../../../source-wrapper-semantics.js";

/**
 * Convert TypeScript function type to IR function type
 */
export const convertFunctionType = (
  node: ts.FunctionTypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrFunctionType => {
  const typeParameters = convertFunctionTypeParameters(
    node.typeParameters,
    binding,
    convertType
  );
  return {
    kind: "functionType",
    ...(typeParameters ? { typeParameters } : {}),
    parameters: convertTypeParameters(node.parameters, binding, convertType),
    returnType: convertType(node.type, binding),
  };
};

const convertFunctionTypeParameters = (
  typeParameters: readonly ts.TypeParameterDeclaration[] | undefined,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): readonly IrTypeParameter[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  return typeParameters.map((typeParameter) => ({
    kind: "typeParameter",
    name: typeParameter.name.text,
    constraint: typeParameter.constraint
      ? convertType(typeParameter.constraint, binding)
      : undefined,
    default: typeParameter.default
      ? convertType(typeParameter.default, binding)
      : undefined,
    variance: undefined,
    isStructuralConstraint:
      !!typeParameter.constraint &&
      ts.isTypeLiteralNode(typeParameter.constraint),
    structuralMembers: undefined,
  }));
};

/**
 * Convert parameters for type signatures (no initializers, no ProgramContext).
 *
 * This is used for FunctionTypeNode and MethodSignature in type contexts.
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
    const unwrapped = unwrapSourceParameterType(
      param.type,
      binding.getSourceFact
    );

    // Convert type if present
    const paramType = unwrapped.typeNode
      ? convertType(unwrapped.typeNode, binding)
      : undefined;

    return {
      kind: "parameter" as const,
      pattern: convertBindingName(param.name),
      type: paramType,
      // Type signatures don't have initializers
      initializer: undefined,
      isOptional: !!param.questionToken,
      isRest: !!param.dotDotDotToken,
      passing: unwrapped.passing,
    };
  });
};
