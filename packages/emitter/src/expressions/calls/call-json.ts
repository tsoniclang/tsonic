/**
 * JSON serialization call emission.
 * Handles JSON.parse/JSON.stringify as System.Text.Json.JsonSerializer calls.
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import {
  registerJsonAotExpressionTypes,
  registerJsonAotType,
} from "./call-analysis.js";
import { containsTypeParameter } from "../../core/semantic/type-resolution.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import { emitTypeArgumentsAst } from "../identifiers.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import { referenceTypeHasClrIdentity } from "../../core/semantic/clr-type-identity.js";

const SYSTEM_OBJECT_CLR_NAMES = new Set([
  "System.Object",
  "global::System.Object",
]);

const isConcreteGlobalJsonParseTarget = (
  type: IrType | undefined
): type is IrType => {
  if (!type) return false;
  if (
    type.kind === "unknownType" ||
    type.kind === "anyType" ||
    type.kind === "voidType" ||
    type.kind === "neverType"
  ) {
    return false;
  }
  if (type.kind === "unionType" || type.kind === "intersectionType") {
    return false;
  }
  return !containsTypeParameter(type);
};

const isConcreteGlobalJsonStringifySource = (
  type: IrType | undefined
): type is IrType => {
  if (!type) return false;
  if (
    type.kind === "unknownType" ||
    type.kind === "anyType" ||
    type.kind === "voidType" ||
    type.kind === "neverType" ||
    type.kind === "typeParameterType"
  ) {
    return false;
  }
  if (type.kind === "unionType" || type.kind === "intersectionType") {
    return false;
  }
  if (type.kind === "dictionaryType") {
    return false;
  }
  if (
    type.kind === "referenceType" &&
    (type.name === "object" ||
      referenceTypeHasClrIdentity(type, SYSTEM_OBJECT_CLR_NAMES))
  ) {
    return false;
  }
  return !containsTypeParameter(type);
};

const emitJsonSerializerCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  method: "Serialize" | "Deserialize",
  deserializeTypeOverride?: IrType,
  serializeSourceTypeOverride?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  // Register the type with the JSON AOT registry
  if (method === "Serialize") {
    const firstArg = expr.arguments[0];
    if (firstArg && firstArg.kind !== "spread") {
      registerJsonAotExpressionTypes(firstArg, context);
    }
  } else {
    const typeArg = deserializeTypeOverride ?? expr.typeArguments?.[0];
    if (typeArg) {
      registerJsonAotType(typeArg, context);
    }
  }

  // Emit type arguments for Deserialize<T>
  let typeArgAsts: readonly CSharpTypeAst[] = [];
  const deserializeIrType =
    method === "Deserialize"
      ? (deserializeTypeOverride ?? expr.typeArguments?.[0])
      : undefined;
  if (deserializeIrType) {
    const [typeArgs, typeContext] = emitTypeArgumentsAst(
      [deserializeIrType],
      currentContext
    );
    typeArgAsts = typeArgs;
    currentContext = typeContext;
  } else if (expr.typeArguments && expr.typeArguments.length > 0) {
    const [typeArgs, typeContext] = emitTypeArgumentsAst(
      expr.typeArguments,
      currentContext
    );
    typeArgAsts = typeArgs;
    currentContext = typeContext;
  }

  // Emit arguments
  const argAsts: CSharpExpressionAst[] = [];
  for (let index = 0; index < expr.arguments.length; index += 1) {
    const arg = expr.arguments[index];
    if (!arg) {
      continue;
    }
    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push(spreadAst);
      currentContext = ctx;
    } else {
      const [argAst, ctx] = emitExpressionAst(
        arg,
        currentContext,
        method === "Serialize" && index === 0
          ? serializeSourceTypeOverride
          : undefined
      );
      argAsts.push(argAst);
      currentContext = ctx;
    }
  }

  if (context.options.jsonAotRegistry?.needsJsonAot) {
    argAsts.push(
      identifierExpression(
        `global::${context.options.rootNamespace}.TsonicJson.Options`
      )
    );
  }

  const invocation: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: identifierExpression(
        "global::System.Text.Json.JsonSerializer"
      ),
      memberName: method,
    },
    arguments: argAsts,
    typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
  };
  return [invocation, currentContext];
};

const emitGlobalJsonCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  method: "Serialize" | "Deserialize",
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  if (method === "Serialize") {
    const firstArg = expr.arguments[0];
    const sourceType =
      firstArg && firstArg.kind !== "spread"
        ? (resolveEffectiveExpressionType(firstArg, context) ??
          firstArg.inferredType)
        : undefined;
    if (!isConcreteGlobalJsonStringifySource(sourceType)) {
      throw new Error(
        "ICE: JSON.stringify reached emitter without a closed, NativeAOT-serializable source type"
      );
    }
    return emitJsonSerializerCall(expr, context, method, undefined, sourceType);
  }

  const deserializeTarget =
    expr.typeArguments?.[0] ??
    (isConcreteGlobalJsonParseTarget(expectedType)
      ? expectedType
      : undefined) ??
    (isConcreteGlobalJsonParseTarget(expr.inferredType)
      ? expr.inferredType
      : undefined);

  if (deserializeTarget) {
    return emitJsonSerializerCall(
      expr,
      context,
      "Deserialize",
      deserializeTarget
    );
  }

  throw new Error(
    "ICE: JSON.parse reached emitter without an explicit or inferred closed target type"
  );
};

export { emitJsonSerializerCall, emitGlobalJsonCall };
