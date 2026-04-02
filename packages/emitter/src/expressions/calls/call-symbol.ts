import { IrExpression, IrType } from "@tsonic/frontend";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import type { EmitterContext } from "../../types.js";
import { emitCallArguments } from "./call-arguments.js";

const SYMBOL_DESCRIPTION_TYPE: IrType = {
  kind: "referenceType",
  name: "object",
  typeArguments: [],
};

export const emitGlobalSymbolCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const args = expr.arguments.filter(
    (arg): arg is IrExpression => arg.kind !== "spread"
  );

  if (args.length !== expr.arguments.length) {
    throw new Error("ICE: Symbol(...) does not support spread arguments.");
  }

  if (args.length > 1) {
    throw new Error("ICE: Symbol(...) received more than one argument.");
  }

  const [emittedArgs, nextContext] = emitCallArguments(
    args,
    expr,
    context,
    args.length === 0 ? [] : [SYMBOL_DESCRIPTION_TYPE]
  );

  return [
    {
      kind: "invocationExpression",
      expression: identifierExpression("global::Tsonic.Runtime.Symbol.Create"),
      arguments: emittedArgs,
    },
    nextContext,
  ];
};
