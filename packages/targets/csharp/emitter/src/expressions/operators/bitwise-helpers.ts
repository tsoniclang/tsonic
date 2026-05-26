import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { referenceTypeHasClrIdentity } from "../../core/semantic/clr-type-identity.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
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

const isJsNumberBitwiseType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" && resolved.name === "number") ||
    (resolved.kind === "literalType" && typeof resolved.value === "number") ||
    (resolved.kind === "referenceType" &&
      (resolved.name === "double" ||
        referenceTypeHasClrIdentity(resolved, [
          "System.Double",
          "global::System.Double",
        ])))
  );
};

const JS_RUNTIME_BITWISE_METHODS: Readonly<Record<string, string>> = {
  "&": "BitwiseAnd",
  "|": "BitwiseOr",
  "^": "BitwiseXor",
  "<<": "LeftShift",
  ">>": "SignedRightShift",
  ">>>": "UnsignedRightShift",
};

const runtimeOperatorCall = (
  methodName: string,
  args: readonly CSharpExpressionAst[]
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: identifierExpression("global::Tsonic.Runtime.Operators"),
    memberName: methodName,
  },
  arguments: args,
});

export const emitJsNumberBitwiseOperation = (
  operator: string,
  leftAst: CSharpExpressionAst,
  rightAst: CSharpExpressionAst,
  leftType: IrType | undefined,
  rightType: IrType | undefined,
  context: EmitterContext
): CSharpExpressionAst | undefined => {
  const methodName = JS_RUNTIME_BITWISE_METHODS[operator];
  if (!methodName) {
    return undefined;
  }

  return isJsNumberBitwiseType(leftType, context) ||
    isJsNumberBitwiseType(rightType, context)
    ? runtimeOperatorCall(methodName, [leftAst, rightAst])
    : undefined;
};

export const emitJsNumberBitwiseNot = (
  operandAst: CSharpExpressionAst,
  operandType: IrType | undefined,
  context: EmitterContext
): CSharpExpressionAst | undefined =>
  isJsNumberBitwiseType(operandType, context)
    ? runtimeOperatorCall("BitwiseNot", [operandAst])
    : undefined;

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
