import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { referenceTypeHasClrIdentity } from "../../core/semantic/clr-type-identity.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";

export const BITWISE_OPERATORS = new Set(["&", "|", "^", "<<", ">>", ">>>"]);

const JS_BITWISE_NUMBERISH_CLR_NAMES = new Set([
  "System.Int32",
  "global::System.Int32",
  "System.Double",
  "global::System.Double",
]);

const isJsBitwiseNumberishType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" &&
      (resolved.name === "number" || resolved.name === "int")) ||
    (resolved.kind === "literalType" && typeof resolved.value === "number") ||
    (resolved.kind === "referenceType" &&
      (resolved.name === "int" ||
        resolved.name === "double" ||
        referenceTypeHasClrIdentity(resolved, JS_BITWISE_NUMBERISH_CLR_NAMES)))
  );
};

export const castBitwiseOperandToInt = (
  ast: CSharpExpressionAst,
  type: IrType | undefined,
  context: EmitterContext
): CSharpExpressionAst =>
  isJsBitwiseNumberishType(type, context)
    ? {
        kind: "castExpression",
        type: { kind: "predefinedType", keyword: "int" },
        expression: ast,
      }
    : ast;
