/**
 * Call expression emitter
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import {
  emitTypeArgumentsAst,
  generateSpecializedName,
} from "../identifiers.js";
import { emitMemberAccess } from "../access.js";
import {
  isLValue,
  getPassingModifierFromCast,
  isJsonSerializerCall,
  isGlobalJsonCall,
  isInstanceMemberAccess,
  shouldEmitFluentExtensionCall,
  getTypeNamespace,
  registerJsonAotType,
  needsIntCast,
} from "./call-analysis.js";
import { extractCalleeNameFromAst } from "../../core/format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";

/**
 * Wrap an expression AST with an optional argument modifier (ref/out/in/params).
 */
const wrapArgModifier = (
  modifier: string | undefined,
  expr: CSharpExpressionAst
): CSharpExpressionAst =>
  modifier
    ? { kind: "argumentModifierExpression", modifier, expression: expr }
    : expr;

/**
 * Wrap an invocation AST with an optional (int) cast.
 */
const wrapIntCast = (
  needsCast: boolean,
  expr: CSharpExpressionAst
): CSharpExpressionAst =>
  needsCast
    ? {
        kind: "castExpression",
        type: { kind: "predefinedType", keyword: "int" },
        expression: expr,
      }
    : expr;

/**
 * Emit call arguments as typed AST array.
 * Handles spread (params), castModifier (ref/out from cast), and argumentPassing modes.
 */
const emitCallArguments = (
  args: readonly IrExpression[],
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [readonly CSharpExpressionAst[], EmitterContext] => {
  const parameterTypes = expr.parameterTypes ?? [];
  let currentContext = context;
  const argAsts: CSharpExpressionAst[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    const expectedType = parameterTypes[i];

    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push(wrapArgModifier("params", spreadAst));
      currentContext = ctx;
    } else {
      const castModifier = getPassingModifierFromCast(arg);
      if (castModifier && isLValue(arg)) {
        const [argAst, ctx] = emitExpressionAst(arg, currentContext);
        argAsts.push(wrapArgModifier(castModifier, argAst));
        currentContext = ctx;
      } else {
        const [argAst, ctx] = emitExpressionAst(
          arg,
          currentContext,
          expectedType
        );
        const passingMode = expr.argumentPassing?.[i];
        const modifier =
          passingMode && passingMode !== "value" && isLValue(arg)
            ? passingMode
            : undefined;
        argAsts.push(wrapArgModifier(modifier, argAst));
        currentContext = ctx;
      }
    }
  }

  return [argAsts, currentContext];
};

/**
 * Emit a JsonSerializer call with NativeAOT-compatible options.
 */
const emitJsonSerializerCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  method: "Serialize" | "Deserialize"
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  // Register the type with the JSON AOT registry
  if (method === "Serialize") {
    const firstArg = expr.arguments[0];
    if (firstArg && firstArg.kind !== "spread") {
      registerJsonAotType(firstArg.inferredType, context);
    }
  } else {
    const typeArg = expr.typeArguments?.[0];
    if (typeArg) {
      registerJsonAotType(typeArg, context);
    }
  }

  // Emit type arguments for Deserialize<T>
  let typeArgAsts: readonly CSharpTypeAst[] = [];
  if (expr.typeArguments && expr.typeArguments.length > 0) {
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

  // Add TsonicJson.Options when NativeAOT JSON context generation is enabled.
  if (context.options.jsonAotRegistry) {
    argAsts.push({
      kind: "identifierExpression",
      identifier: "TsonicJson.Options",
    });
  }

  const invocation: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: {
        kind: "identifierExpression",
        identifier: "global::System.Text.Json.JsonSerializer",
      },
      memberName: method,
    },
    arguments: argAsts,
    typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
  };
  return [invocation, currentContext];
};

/**
 * Emit a function call expression as CSharpExpressionAst
 */
export const emitCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  // Void promise resolve: emit as zero-arg call when safe.
  if (
    expr.callee.kind === "identifier" &&
    context.voidResolveNames?.has(expr.callee.name)
  ) {
    const isZeroArg = expr.arguments.length === 0;
    const isSingleUndefined =
      expr.arguments.length === 1 &&
      expr.arguments[0]?.kind === "identifier" &&
      expr.arguments[0].name === "undefined";

    if (isZeroArg || isSingleUndefined) {
      const [calleeAst, calleeCtx] = emitExpressionAst(expr.callee, context);
      return [
        {
          kind: "invocationExpression",
          expression: calleeAst,
          arguments: [],
        },
        calleeCtx,
      ];
    }
  }

  // Check for JsonSerializer calls (NativeAOT support)
  const jsonCall = isJsonSerializerCall(expr.callee);
  if (jsonCall) {
    return emitJsonSerializerCall(expr, context, jsonCall.method);
  }

  // Check for global JSON.stringify/parse calls
  const globalJsonCall = isGlobalJsonCall(expr.callee);
  if (globalJsonCall) {
    return emitJsonSerializerCall(expr, context, globalJsonCall.method);
  }

  // EF Core query canonicalization: ToList().ToArray() → ToArray()
  if (
    expr.callee.kind === "memberAccess" &&
    expr.callee.property === "ToArray" &&
    expr.arguments.length === 0 &&
    expr.callee.object.kind === "call"
  ) {
    const innerCall = expr.callee.object;

    if (
      innerCall.callee.kind === "memberAccess" &&
      innerCall.callee.memberBinding?.isExtensionMethod &&
      isInstanceMemberAccess(innerCall.callee, context) &&
      innerCall.callee.memberBinding.type.startsWith(
        "System.Linq.Enumerable"
      ) &&
      innerCall.callee.memberBinding.member === "ToList" &&
      innerCall.arguments.length === 0
    ) {
      let currentContext = context;

      currentContext.usings.add("System.Linq");

      const receiverExpr = innerCall.callee.object;
      const [receiverAst, receiverCtx] = emitExpressionAst(
        receiverExpr,
        currentContext
      );
      currentContext = receiverCtx;

      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: receiverAst,
            memberName: "ToArray",
          },
          arguments: [],
        },
        currentContext,
      ];
    }
  }

  // Extension method lowering: emit explicit static invocation with receiver as first arg.
  if (
    expr.callee.kind === "memberAccess" &&
    expr.callee.memberBinding?.isExtensionMethod &&
    isInstanceMemberAccess(expr.callee, context)
  ) {
    let currentContext = context;

    const binding = expr.callee.memberBinding;
    const receiverExpr = expr.callee.object;

    const [receiverAst, receiverContext] = emitExpressionAst(
      receiverExpr,
      currentContext
    );
    currentContext = receiverContext;

    // Fluent extension method path
    if (shouldEmitFluentExtensionCall(binding.type, binding.member)) {
      const ns = getTypeNamespace(binding.type);
      if (ns) {
        currentContext.usings.add(ns);
      }

      let typeArgAsts: readonly CSharpTypeAst[] = [];
      if (expr.typeArguments && expr.typeArguments.length > 0) {
        const [typeArgs, typeContext] = emitTypeArgumentsAst(
          expr.typeArguments,
          currentContext
        );
        typeArgAsts = typeArgs;
        currentContext = typeContext;
      }

      const [argAsts, argContext] = emitCallArguments(
        expr.arguments,
        expr,
        currentContext
      );
      currentContext = argContext;

      const memberAccess: CSharpExpressionAst = expr.isOptional
        ? {
            kind: "conditionalMemberAccessExpression",
            expression: receiverAst,
            memberName: binding.member,
          }
        : {
            kind: "memberAccessExpression",
            expression: receiverAst,
            memberName: binding.member,
          };

      const invocation: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: memberAccess,
        arguments: argAsts,
        typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
      };

      return [
        wrapIntCast(needsIntCast(expr, binding.member), invocation),
        currentContext,
      ];
    }

    let finalCalleeName = `global::${binding.type}.${binding.member}`;

    let typeArgAsts: readonly CSharpTypeAst[] = [];
    if (expr.typeArguments && expr.typeArguments.length > 0) {
      if (expr.requiresSpecialization) {
        const [specializedName, specContext] = generateSpecializedName(
          finalCalleeName,
          expr.typeArguments,
          currentContext
        );
        finalCalleeName = specializedName;
        currentContext = specContext;
      } else {
        const [typeArgs, typeContext] = emitTypeArgumentsAst(
          expr.typeArguments,
          currentContext
        );
        typeArgAsts = typeArgs;
        currentContext = typeContext;
      }
    }

    const [argAsts, argContext] = emitCallArguments(
      expr.arguments,
      expr,
      currentContext
    );
    currentContext = argContext;

    // Prepend receiver as first argument (static extension call)
    const allArgAsts: readonly CSharpExpressionAst[] = [
      receiverAst,
      ...argAsts,
    ];

    const invocation: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: {
        kind: "identifierExpression",
        identifier: finalCalleeName,
      },
      arguments: allArgAsts,
      typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
    };

    // Wrap in ToArray() if result type is array
    const callAst: CSharpExpressionAst =
      expr.inferredType?.kind === "arrayType"
        ? {
            kind: "invocationExpression",
            expression: {
              kind: "identifierExpression",
              identifier: "global::System.Linq.Enumerable.ToArray",
            },
            arguments: [invocation],
          }
        : invocation;

    return [
      wrapIntCast(needsIntCast(expr, finalCalleeName), callAst),
      currentContext,
    ];
  }

  // Regular function call
  const [calleeAst, newContext] =
    expr.callee.kind === "memberAccess"
      ? emitMemberAccess(expr.callee, context, "call")
      : emitExpressionAst(expr.callee, context);
  let currentContext = newContext;

  let calleeExpr: CSharpExpressionAst = calleeAst;
  let typeArgAsts: readonly CSharpTypeAst[] = [];

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      const calleeText = extractCalleeNameFromAst(calleeAst);
      const [specializedName, specContext] = generateSpecializedName(
        calleeText,
        expr.typeArguments,
        currentContext
      );
      calleeExpr = {
        kind: "identifierExpression",
        identifier: specializedName,
      };
      currentContext = specContext;
    } else {
      const [typeArgs, typeContext] = emitTypeArgumentsAst(
        expr.typeArguments,
        currentContext
      );
      typeArgAsts = typeArgs;
      currentContext = typeContext;
    }
  }

  const [argAsts, argContext] = emitCallArguments(
    expr.arguments,
    expr,
    currentContext
  );
  currentContext = argContext;

  // Build the invocation target (may need optional chaining wrapper)
  const invocationTarget: CSharpExpressionAst = expr.isOptional
    ? (() => {
        // Optional call: callee?.(args) — in C# this requires the callee to be
        // a delegate and the call to be ?.Invoke(). For member access callees
        // the optional chaining is already handled by the member access emitter.
        // For identifiers, emit callee?.Invoke(args).
        if (calleeExpr.kind === "identifierExpression") {
          return {
            kind: "conditionalMemberAccessExpression" as const,
            expression: calleeExpr,
            memberName: "Invoke",
          };
        }
        return calleeExpr;
      })()
    : calleeExpr;

  const invocation: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: invocationTarget,
    arguments: argAsts,
    typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
  };

  const calleeText = extractCalleeNameFromAst(calleeAst);
  return [
    wrapIntCast(needsIntCast(expr, calleeText), invocation),
    currentContext,
  ];
};
