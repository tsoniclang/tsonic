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
