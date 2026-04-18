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
  registerJsonRuntimeSupport,
} from "./call-analysis.js";
import { containsTypeParameter } from "../../core/semantic/type-resolution.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import { normalizeClrQualifiedName } from "../../core/format/backend-ast/utils.js";
import { emitTypeArgumentsAst } from "../identifiers.js";
import { buildExactGlobalBindingReference } from "../exact-global-bindings.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";

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
  if (
    type.kind === "referenceType" &&
    (type.name === "JsValue" ||
      type.resolvedClrType === "Tsonic.Runtime.JsValue" ||
      type.resolvedClrType === "global::Tsonic.Runtime.JsValue")
  ) {
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
      type.name === "JsValue" ||
      type.resolvedClrType === "System.Object" ||
      type.resolvedClrType === "Tsonic.Runtime.JsValue" ||
      type.resolvedClrType === "global::Tsonic.Runtime.JsValue")
  ) {
    return false;
  }
  return !containsTypeParameter(type);
};

const emitRuntimeJsonParseCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;
  const argAsts: CSharpExpressionAst[] = [];

  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push(spreadAst);
      currentContext = ctx;
      continue;
    }

    const [argAst, ctx] = emitExpressionAst(arg, currentContext);
    argAsts.push(argAst);
    currentContext = ctx;
  }

  const jsonOwnerExpression =
    expr.callee.kind === "memberAccess" && expr.callee.memberBinding
      ? identifierExpression(
          normalizeClrQualifiedName(expr.callee.memberBinding.type, true)
        )
      : buildExactGlobalBindingReference("JSON", context);

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: jsonOwnerExpression,
        memberName: "parse",
      },
      arguments: argAsts,
    },
    currentContext,
  ];
};

const emitRuntimeJsonStringifyCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  registerJsonRuntimeSupport(context);
  let currentContext = context;
  const argAsts: CSharpExpressionAst[] = [];

  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push(spreadAst);
      currentContext = ctx;
      continue;
    }

    const [argAst, ctx] = emitExpressionAst(arg, currentContext);
    argAsts.push(argAst);
    currentContext = ctx;
  }

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: identifierExpression(
          `global::${context.options.rootNamespace ?? "TsonicApp"}.TsonicJsonRuntime`
        ),
        memberName: "Stringify",
      },
      arguments: argAsts,
    },
    currentContext,
  ];
};

const emitJsonSerializerCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  method: "Serialize" | "Deserialize",
  deserializeTypeOverride?: IrType
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
  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push(spreadAst);
      currentContext = ctx;
    } else {
      const [argAst, ctx] = emitExpressionAst(arg, currentContext);
      argAsts.push(argAst);
      currentContext = ctx;
    }
  }

  // Only pass the generated JSON AOT options when this call site actually
  // participates in the NativeAOT JSON rewrite. Broad global JSON.parse(...)
  // calls stay on the js-surface parse path and should not force AOT metadata.
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
      return emitRuntimeJsonStringifyCall(expr, context);
    }
    return emitJsonSerializerCall(expr, context, method);
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

  return emitRuntimeJsonParseCall(expr, context);
};

export { emitJsonSerializerCall, emitGlobalJsonCall };
