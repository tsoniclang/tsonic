import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import { identifierType } from "../core/format/backend-ast/builders.js";

export const buildNativeArrayInteropWrapAst = (
  receiverAst: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: {
      kind: "typeReferenceExpression",
      type: identifierType("global::Tsonic.Internal.ArrayInterop"),
    },
    memberName: "WrapArray",
  },
  arguments: [receiverAst],
});
