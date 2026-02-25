/**
 * Call expression emitter
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeArguments, generateSpecializedName } from "../identifiers.js";
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
import { printExpression } from "../../core/format/backend-ast/printer.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";

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
  let typeArgsStr = "";
  if (expr.typeArguments && expr.typeArguments.length > 0) {
    const [typeArgs, typeContext] = emitTypeArguments(
      expr.typeArguments,
      currentContext
    );
    typeArgsStr = typeArgs;
    currentContext = typeContext;
  }

  // Emit arguments
  const argTexts: string[] = [];
  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argTexts.push(printExpression(spreadAst));
      currentContext = ctx;
    } else {
      const [argAst, ctx] = emitExpressionAst(arg, currentContext);
      argTexts.push(printExpression(argAst));
      currentContext = ctx;
    }
  }

  // Add TsonicJson.Options when NativeAOT JSON context generation is enabled.
  if (context.options.jsonAotRegistry) {
    argTexts.push("TsonicJson.Options");
  }

  const text = `global::System.Text.Json.JsonSerializer.${method}${typeArgsStr}(${argTexts.join(", ")})`;
  return [{ kind: "identifierExpression", identifier: text }, currentContext];
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
    const receiverText = printExpression(receiverAst);

    // Fluent extension method path
    if (shouldEmitFluentExtensionCall(binding.type, binding.member)) {
      const ns = getTypeNamespace(binding.type);
      if (ns) {
        currentContext.usings.add(ns);
      }

      let typeArgsStr = "";
      if (expr.typeArguments && expr.typeArguments.length > 0) {
        const [typeArgs, typeContext] = emitTypeArguments(
          expr.typeArguments,
          currentContext
        );
        typeArgsStr = typeArgs;
        currentContext = typeContext;
      }

      const parameterTypes = expr.parameterTypes ?? [];

      const argTexts: string[] = [];
      for (let i = 0; i < expr.arguments.length; i++) {
        const arg = expr.arguments[i];
        if (!arg) continue;

        const expectedType = parameterTypes[i];

        if (arg.kind === "spread") {
          const [spreadAst, ctx] = emitExpressionAst(
            arg.expression,
            currentContext
          );
          argTexts.push(`params ${printExpression(spreadAst)}`);
          currentContext = ctx;
        } else {
          const castModifier = getPassingModifierFromCast(arg);
          if (castModifier && isLValue(arg)) {
            const [argAst, ctx] = emitExpressionAst(arg, currentContext);
            argTexts.push(`${castModifier} ${printExpression(argAst)}`);
            currentContext = ctx;
          } else {
            const [argAst, ctx] = emitExpressionAst(
              arg,
              currentContext,
              expectedType
            );
            const passingMode = expr.argumentPassing?.[i];
            const prefix =
              passingMode && passingMode !== "value" && isLValue(arg)
                ? `${passingMode} `
                : "";
            argTexts.push(`${prefix}${printExpression(argAst)}`);
            currentContext = ctx;
          }
        }
      }

      const op = expr.isOptional ? "?." : ".";
      const baseCallText = `${printExpression(receiverAst)}${op}${binding.member}${typeArgsStr}(${argTexts.join(", ")})`;

      const text = needsIntCast(expr, binding.member)
        ? `(int)${baseCallText}`
        : baseCallText;
      return [
        { kind: "identifierExpression", identifier: text },
        currentContext,
      ];
    }

    let finalCalleeName = `global::${binding.type}.${binding.member}`;

    let typeArgsStr = "";
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
        const [typeArgs, typeContext] = emitTypeArguments(
          expr.typeArguments,
          currentContext
        );
        typeArgsStr = typeArgs;
        currentContext = typeContext;
      }
    }

    const parameterTypes = expr.parameterTypes ?? [];
    const argTexts: string[] = [receiverText];

    for (let i = 0; i < expr.arguments.length; i++) {
      const arg = expr.arguments[i];
      if (!arg) continue;

      const expectedType = parameterTypes[i];

      if (arg.kind === "spread") {
        const [spreadAst, ctx] = emitExpressionAst(
          arg.expression,
          currentContext
        );
        argTexts.push(`params ${printExpression(spreadAst)}`);
        currentContext = ctx;
      } else {
        const castModifier = getPassingModifierFromCast(arg);
        if (castModifier && isLValue(arg)) {
          const [argAst, ctx] = emitExpressionAst(arg, currentContext);
          argTexts.push(`${castModifier} ${printExpression(argAst)}`);
          currentContext = ctx;
        } else {
          const [argAst, ctx] = emitExpressionAst(
            arg,
            currentContext,
            expectedType
          );
          const passingMode = expr.argumentPassing?.[i];
          const prefix =
            passingMode && passingMode !== "value" && isLValue(arg)
              ? `${passingMode} `
              : "";
          argTexts.push(`${prefix}${printExpression(argAst)}`);
          currentContext = ctx;
        }
      }
    }

    const baseCallText = `${finalCalleeName}${typeArgsStr}(${argTexts.join(", ")})`;

    const callText =
      expr.inferredType?.kind === "arrayType"
        ? `global::System.Linq.Enumerable.ToArray(${baseCallText})`
        : baseCallText;

    const text = needsIntCast(expr, finalCalleeName)
      ? `(int)${callText}`
      : callText;
    return [{ kind: "identifierExpression", identifier: text }, currentContext];
  }

  // Regular function call
  const [calleeAst, newContext] =
    expr.callee.kind === "memberAccess"
      ? emitMemberAccess(expr.callee, context, "call")
      : emitExpressionAst(expr.callee, context);
  let currentContext = newContext;

  let typeArgsStr = "";
  let calleeText = printExpression(calleeAst);

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      const [specializedName, specContext] = generateSpecializedName(
        calleeText,
        expr.typeArguments,
        currentContext
      );
      calleeText = specializedName;
      currentContext = specContext;
    } else {
      const [typeArgs, typeContext] = emitTypeArguments(
        expr.typeArguments,
        currentContext
      );
      typeArgsStr = typeArgs;
      currentContext = typeContext;
    }
  }

  const parameterTypes = expr.parameterTypes ?? [];

  const argTexts: string[] = [];
  for (let i = 0; i < expr.arguments.length; i++) {
    const arg = expr.arguments[i];
    if (!arg) continue;

    const expectedType = parameterTypes[i];

    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argTexts.push(`params ${printExpression(spreadAst)}`);
      currentContext = ctx;
    } else {
      const castModifier = getPassingModifierFromCast(arg);

      if (castModifier && isLValue(arg)) {
        const [argAst, ctx] = emitExpressionAst(arg, currentContext);
        argTexts.push(`${castModifier} ${printExpression(argAst)}`);
        currentContext = ctx;
      } else {
        const [argAst, ctx] = emitExpressionAst(
          arg,
          currentContext,
          expectedType
        );
        const passingMode = expr.argumentPassing?.[i];
        const prefix =
          passingMode && passingMode !== "value" && isLValue(arg)
            ? `${passingMode} `
            : "";
        argTexts.push(`${prefix}${printExpression(argAst)}`);
        currentContext = ctx;
      }
    }
  }

  const callOp = expr.isOptional ? "?." : "";
  const callText = `${calleeText}${typeArgsStr}${callOp}(${argTexts.join(", ")})`;

  const text = needsIntCast(expr, calleeText) ? `(int)${callText}` : callText;

  return [{ kind: "identifierExpression", identifier: text }, currentContext];
};
