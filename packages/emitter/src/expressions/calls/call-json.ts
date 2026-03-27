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
import { buildExactGlobalBindingReference } from "../exact-global-bindings.js";

const getRuntimeObjectHelperParameterOverrides = (
  expr: Extract<IrExpression, { kind: "call" }>,
  argCount: number
): readonly (IrType | undefined)[] | undefined => {
  if (
    expr.callee.kind !== "memberAccess" ||
    expr.callee.isComputed ||
    expr.callee.object.kind !== "identifier" ||
    expr.callee.object.name !== "Object" ||
    (expr.callee.property !== "entries" &&
      expr.callee.property !== "keys" &&
      expr.callee.property !== "values")
  ) {
    return undefined;
  }

  if (argCount === 0) {
    return undefined;
  }

  const overrides: (IrType | undefined)[] = Array.from(
    { length: argCount },
    () => undefined
  );
  overrides[0] = {
    kind: "referenceType",
    name: "object",
    resolvedClrType: "System.Object",
  };
  return overrides;
};

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
  if (
    type.kind === "referenceType" &&
    (type.name === "object" || type.resolvedClrType === "System.Object")
  ) {
    return false;
  }
  return !containsTypeParameter(type);
};

const emitRuntimeJsonParseCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  typeArgument: CSharpTypeAst
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

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: buildExactGlobalBindingReference("JSON", context),
        memberName: "parse",
      },
      arguments: argAsts,
      typeArguments: [typeArgument],
    },
    currentContext,
  ];
};

const emitRuntimeJsonStringifyCall = (
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

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: buildExactGlobalBindingReference("JSON", context),
        memberName: "stringify",
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
  // participates in the NativeAOT JSON rewrite. Non-generic JSON.parse(...)
  // intentionally returns unknown and should emit plain JsonSerializer calls
  // without requiring the generated helper.
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
  method: "Serialize" | "Deserialize"
): [CSharpExpressionAst, EmitterContext] => {
  if (method === "Serialize") {
    const firstArg = expr.arguments[0];
    const sourceType =
      firstArg && firstArg.kind !== "spread"
        ? firstArg.inferredType
        : undefined;
    if (!isConcreteGlobalJsonStringifySource(sourceType)) {
      return emitRuntimeJsonStringifyCall(expr, context);
    }
    return emitJsonSerializerCall(expr, context, method);
  }

  const deserializeTarget =
    expr.typeArguments?.[0] ??
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

  return emitRuntimeJsonParseCall(expr, context, {
    kind: "predefinedType",
    keyword: "object",
  });
};

export {
  getRuntimeObjectHelperParameterOverrides,
  emitJsonSerializerCall,
  emitGlobalJsonCall,
};
