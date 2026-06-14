/**
 * Function type conversion
 *
 * Uses local parameter helpers without ProgramContext dependency.
 * Type conversion should NOT depend on statement conversion.
 */

import type { TstsNode } from "@tsonic/tsts";
import { TstsSyntax } from "@tsonic/tsts";
import {
  IrType,
  IrFunctionType,
  IrParameter,
  IrTypeParameter,
} from "../../../types.js";
import { convertBindingName } from "../../../syntax/binding-patterns.js";
import type { Binding } from "../../../binding/index.js";
import {
  nodeParameters,
  nodeType,
  nodeTypeParameters,
  identifierText,
  isOptionalParameter,
  isRestParameter,
  unwrapSourceParameterType,
} from "./tsts-syntax.js";

/**
 * Convert TypeScript function type to IR function type
 */
export const convertFunctionType = (
  node: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrFunctionType => {
  const typeParameters = convertFunctionTypeParameters(
    nodeTypeParameters(node),
    binding,
    convertType
  );
  return {
    kind: "functionType",
    ...(typeParameters ? { typeParameters } : {}),
    parameters: convertTypeParameters(nodeParameters(node), binding, convertType),
    returnType: nodeType(node)
      ? convertType(nodeType(node)!, binding)
      : { kind: "voidType" },
  };
};

const convertFunctionTypeParameters = (
  typeParameters: readonly TstsNode[] | undefined,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): readonly IrTypeParameter[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  return typeParameters.map((typeParameter) => ({
    kind: "typeParameter",
    name: identifierText(TstsSyntax.Node_Name(typeParameter)) ?? "_",
    constraint: TstsSyntax.AsTypeParameterDeclaration(typeParameter)?.Constraint
      ? convertType(
          TstsSyntax.AsTypeParameterDeclaration(typeParameter)!.Constraint!,
          binding
        )
      : undefined,
    default: TstsSyntax.AsTypeParameterDeclaration(typeParameter)?.DefaultType
      ? convertType(
          TstsSyntax.AsTypeParameterDeclaration(typeParameter)!.DefaultType!,
          binding
        )
      : undefined,
    variance: undefined,
    isStructuralConstraint:
      !!TstsSyntax.AsTypeParameterDeclaration(typeParameter)?.Constraint &&
      TstsSyntax.IsTypeLiteralNode(
        TstsSyntax.AsTypeParameterDeclaration(typeParameter)!.Constraint
      ),
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
