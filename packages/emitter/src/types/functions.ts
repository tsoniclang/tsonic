/**
 * Function type emission (global::System.Func<>, global::System.Action<>)
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "./emitter.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import { identifierType } from "../core/format/backend-ast/builders.js";

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
    const [typeAst, newContext] = emitTypeAst(paramType, currentContext);
    paramTypeAsts.push(
      (param.isOptional || param.initializer) && typeAst.kind !== "nullableType"
        ? { kind: "nullableType", underlyingType: typeAst }
        : typeAst
    );
    currentContext = newContext;
  }

  const returnTypeNode = type.returnType ?? { kind: "voidType" as const };
  const [returnTypeAst, newContext] = emitTypeAst(
    returnTypeNode,
    currentContext
  );

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
