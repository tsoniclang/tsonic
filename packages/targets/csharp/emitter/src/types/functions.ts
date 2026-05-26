/**
 * Function type emission (global::System.Func<>, global::System.Action<>)
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "./emitter.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import {
  identifierType,
  nullableType,
} from "../core/format/backend-ast/builders.js";
import { unwrapParameterModifierType } from "../core/semantic/parameter-modifier-types.js";

const objectNullableType = (): CSharpTypeAst =>
  nullableType({ kind: "predefinedType", keyword: "object" });

const isRuntimeNullishType = (type: IrType): boolean =>
  (type.kind === "primitiveType" &&
    (type.name === "null" || type.name === "undefined")) ||
  type.kind === "voidType";

const isUnconstrainedGenericNullishUnion = (type: IrType): boolean => {
  if (type.kind !== "unionType") {
    return false;
  }

  const nonNullishMembers = type.types.filter(
    (member): member is IrType =>
      member !== undefined && !isRuntimeNullishType(member)
  );
  const nullishMembers = type.types.filter(
    (member): member is IrType =>
      member !== undefined && isRuntimeNullishType(member)
  );

  return (
    nonNullishMembers.length === 1 &&
    nullishMembers.length > 0 &&
    nonNullishMembers[0]?.kind === "typeParameterType"
  );
};

/**
 * Emit function types as CSharpTypeAst (identifierType nodes for Func<>/Action<>)
 */
export const emitFunctionType = (
  type: Extract<IrType, { kind: "functionType" }>,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  // For function types, we'll use Func<> or Action<> delegates
  const paramTypeAsts: CSharpTypeAst[] = [];
  let currentContext = context;

  for (const param of type.parameters) {
    const paramType = param.type ?? { kind: "anyType" as const };
    const unwrappedParamType = unwrapParameterModifierType(paramType) ?? paramType;
    const [typeAst, newContext] = emitTypeAst(
      unwrappedParamType,
      currentContext
    );
    paramTypeAsts.push(
      (param.isOptional || param.initializer) && typeAst.kind !== "nullableType"
        ? { kind: "nullableType", underlyingType: typeAst }
        : typeAst
    );
    currentContext = newContext;
  }

  const returnTypeNode = type.returnType ?? { kind: "voidType" as const };
  const [returnTypeAst, newContext] = isUnconstrainedGenericNullishUnion(
    returnTypeNode
  )
    ? [objectNullableType(), currentContext]
    : emitTypeAst(returnTypeNode, currentContext);

  // Check if return type is void (predefinedType with keyword "void")
  const isVoidReturn =
    returnTypeAst.kind === "predefinedType" && returnTypeAst.keyword === "void";

  if (isVoidReturn) {
    if (paramTypeAsts.length === 0) {
      return [identifierType("global::System.Action"), newContext];
    }
    return [identifierType("global::System.Action", paramTypeAsts), newContext];
  }

  if (paramTypeAsts.length === 0) {
    return [identifierType("global::System.Func", [returnTypeAst]), newContext];
  }

  return [
    identifierType("global::System.Func", [...paramTypeAsts, returnTypeAst]),
    newContext,
  ];
};
