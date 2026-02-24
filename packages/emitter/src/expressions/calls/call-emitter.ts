/**
 * Call expression emitter
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitTypeArguments, generateSpecializedName } from "../identifiers.js";
import { formatPostfixExpressionText } from "../parentheses.js";
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

/**
 * Emit a JsonSerializer call with NativeAOT-compatible options.
 * Rewrites:
 *   JsonSerializer.Serialize(value) → JsonSerializer.Serialize(value, TsonicJson.Options)
 *   JsonSerializer.Deserialize<T>(json) → JsonSerializer.Deserialize<T>(json, TsonicJson.Options)
 */
const emitJsonSerializerCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  method: "Serialize" | "Deserialize"
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;

  // Register the type with the JSON AOT registry
  if (method === "Serialize") {
    // For Serialize, get type from first argument's inferredType
    const firstArg = expr.arguments[0];
    if (firstArg && firstArg.kind !== "spread") {
      registerJsonAotType(firstArg.inferredType, context);
    }
  } else {
    // For Deserialize, get type from type arguments
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
  const args: string[] = [];
  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      const [spreadFrag, ctx] = emitExpression(arg.expression, currentContext);
      args.push(spreadFrag.text);
      currentContext = ctx;
    } else {
      const [argFrag, ctx] = emitExpression(arg, currentContext);
      args.push(argFrag.text);
      currentContext = ctx;
    }
  }

  // Add TsonicJson.Options only when NativeAOT JSON context generation is enabled.
  if (context.options.jsonAotRegistry) {
    args.push("TsonicJson.Options");
  }

  const text = `global::System.Text.Json.JsonSerializer.${method}${typeArgsStr}(${args.join(", ")})`;
  return [{ text }, currentContext];
};

/**
 * Emit a function call expression
 */
export const emitCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Void promise resolve: emit as zero-arg call when safe.
  // C# Action (zero-arg) cannot accept arguments, so resolve() and resolve(undefined)
  // both map to resolve(). Only strip when there are no arguments or a single
  // `undefined` identifier — other argument forms may have side effects that must
  // not be dropped. Name-based matching is scoped to the executor body; shadowing
  // the resolve name inside the executor is technically possible but extremely rare.
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
      const [calleeFrag, calleeCtx] = emitExpression(expr.callee, context);
      const calleeText = formatPostfixExpressionText(
        expr.callee,
        calleeFrag.text
      );
      return [{ text: `${calleeText}()` }, calleeCtx];
    }
  }

  // Check for JsonSerializer calls (NativeAOT support)
  const jsonCall = isJsonSerializerCall(expr.callee);
  if (jsonCall) {
    return emitJsonSerializerCall(expr, context, jsonCall.method);
  }

  // Check for global JSON.stringify/parse calls
  // These compile to JsonSerializer.Serialize/Deserialize
  const globalJsonCall = isGlobalJsonCall(expr.callee);
  if (globalJsonCall) {
    return emitJsonSerializerCall(expr, context, globalJsonCall.method);
  }

  // EF Core query precompilation has a known limitation: `query.ToList().ToArray()`
  // fails to precompile (captured locals may be treated as "unknown identifiers").
  // Since `ToList().ToArray()` is equivalent to `ToArray()` for IEnumerable<T>,
  // canonicalize this pattern to `query.ToArray()` so NativeAOT precompilation works.
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

      // Ensure extension methods are in scope.
      currentContext.usings.add("System.Linq");

      const receiverExpr = innerCall.callee.object;
      const [receiverFrag, receiverCtx] = emitExpression(
        receiverExpr,
        currentContext
      );
      currentContext = receiverCtx;

      const receiverText = formatPostfixExpressionText(
        receiverExpr,
        receiverFrag.text
      );

      const text = `${receiverText}.ToArray()`;
      return [{ text }, currentContext];
    }
  }

  // Extension method lowering: emit explicit static invocation with receiver as first arg.
  // This avoids relying on C# `using` directives for extension method discovery.
  if (
    expr.callee.kind === "memberAccess" &&
    expr.callee.memberBinding?.isExtensionMethod &&
    isInstanceMemberAccess(expr.callee, context)
  ) {
    let currentContext = context;

    const binding = expr.callee.memberBinding;
    const receiverExpr = expr.callee.object;

    const [receiverFrag, receiverContext] = emitExpression(
      receiverExpr,
      currentContext
    );
    currentContext = receiverContext;

    // Some ecosystems (notably EF Core query precompilation) require fluent syntax
    // so the tooling can locate queries in syntax trees. For those namespaces,
    // emit `receiver.Method(...)` and add a `using` directive for the namespace.
    if (shouldEmitFluentExtensionCall(binding.type, binding.member)) {
      const ns = getTypeNamespace(binding.type);
      if (ns) {
        currentContext.usings.add(ns);
      }

      // Handle generic type arguments
      let typeArgsStr = "";
      if (expr.typeArguments && expr.typeArguments.length > 0) {
        const [typeArgs, typeContext] = emitTypeArguments(
          expr.typeArguments,
          currentContext
        );
        typeArgsStr = typeArgs;
        currentContext = typeContext;
      }

      // Get parameter types from IR (extracted from resolved signature in frontend)
      const parameterTypes = expr.parameterTypes ?? [];

      const args: string[] = [];
      for (let i = 0; i < expr.arguments.length; i++) {
        const arg = expr.arguments[i];
        if (!arg) continue;

        const expectedType = parameterTypes[i];

        if (arg.kind === "spread") {
          const [spreadFrag, ctx] = emitExpression(
            arg.expression,
            currentContext
          );
          args.push(`params ${spreadFrag.text}`);
          currentContext = ctx;
        } else {
          const castModifier = getPassingModifierFromCast(arg);
          if (castModifier && isLValue(arg)) {
            const [argFrag, ctx] = emitExpression(arg, currentContext);
            args.push(`${castModifier} ${argFrag.text}`);
            currentContext = ctx;
          } else {
            const [argFrag, ctx] = emitExpression(
              arg,
              currentContext,
              expectedType
            );
            const passingMode = expr.argumentPassing?.[i];
            const prefix =
              passingMode && passingMode !== "value" && isLValue(arg)
                ? `${passingMode} `
                : "";
            args.push(`${prefix}${argFrag.text}`);
            currentContext = ctx;
          }
        }
      }

      const receiverText = formatPostfixExpressionText(
        receiverExpr,
        receiverFrag.text
      );
      const op = expr.isOptional ? "?." : ".";
      const baseCallText = `${receiverText}${op}${binding.member}${typeArgsStr}(${args.join(", ")})`;

      const text = needsIntCast(expr, binding.member)
        ? `(int)${baseCallText}`
        : baseCallText;
      return [{ text }, currentContext];
    }

    let finalCalleeName = `global::${binding.type}.${binding.member}`;

    // Handle generic type arguments
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
    const args: string[] = [receiverFrag.text];

    for (let i = 0; i < expr.arguments.length; i++) {
      const arg = expr.arguments[i];
      if (!arg) continue;

      const expectedType = parameterTypes[i];

      if (arg.kind === "spread") {
        const [spreadFrag, ctx] = emitExpression(
          arg.expression,
          currentContext
        );
        args.push(`params ${spreadFrag.text}`);
        currentContext = ctx;
      } else {
        const castModifier = getPassingModifierFromCast(arg);
        if (castModifier && isLValue(arg)) {
          const [argFrag, ctx] = emitExpression(arg, currentContext);
          args.push(`${castModifier} ${argFrag.text}`);
          currentContext = ctx;
        } else {
          const [argFrag, ctx] = emitExpression(
            arg,
            currentContext,
            expectedType
          );
          const passingMode = expr.argumentPassing?.[i];
          const prefix =
            passingMode && passingMode !== "value" && isLValue(arg)
              ? `${passingMode} `
              : "";
          args.push(`${prefix}${argFrag.text}`);
          currentContext = ctx;
        }
      }
    }

    const baseCallText = `${finalCalleeName}${typeArgsStr}(${args.join(", ")})`;

    // JS runtime helpers often return List<T> for array-like results, while the IR
    // models them as native CLR arrays. When the IR expects an array, coerce via
    // Enumerable.ToArray to preserve the IR contract.
    const callText =
      expr.inferredType?.kind === "arrayType"
        ? `global::System.Linq.Enumerable.ToArray(${baseCallText})`
        : baseCallText;

    const text = needsIntCast(expr, finalCalleeName)
      ? `(int)${callText}`
      : callText;
    return [{ text }, currentContext];
  }

  // Regular function call
  const [calleeFrag, newContext] =
    expr.callee.kind === "memberAccess"
      ? emitMemberAccess(expr.callee, context, "call")
      : emitExpression(expr.callee, context);
  let currentContext = newContext;

  // Handle generic type arguments
  let typeArgsStr = "";
  let finalCalleeName = calleeFrag.text;

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      // Monomorphisation: Generate specialized method name
      // e.g., process<string> → process__string
      const [specializedName, specContext] = generateSpecializedName(
        calleeFrag.text,
        expr.typeArguments,
        currentContext
      );
      finalCalleeName = specializedName;
      currentContext = specContext;
    } else {
      // Emit explicit type arguments for generic call
      // e.g., identity<string>(value)
      const [typeArgs, typeContext] = emitTypeArguments(
        expr.typeArguments,
        currentContext
      );
      typeArgsStr = typeArgs;
      currentContext = typeContext;
    }
  }

  // Get parameter types from IR (extracted from resolved signature in frontend)
  const parameterTypes = expr.parameterTypes ?? [];

  const args: string[] = [];
  for (let i = 0; i < expr.arguments.length; i++) {
    const arg = expr.arguments[i];
    if (!arg) continue; // Skip undefined (shouldn't happen in valid IR)

    // Get expected type for this argument from parameter types
    const expectedType = parameterTypes[i];

    if (arg.kind === "spread") {
      // Spread in function call
      const [spreadFrag, ctx] = emitExpression(arg.expression, currentContext);
      args.push(`params ${spreadFrag.text}`);
      currentContext = ctx;
    } else {
      // Check if this argument has an explicit `as out<T>` / `as ref<T>` / `as inref<T>` cast
      const castModifier = getPassingModifierFromCast(arg);

      if (castModifier && isLValue(arg)) {
        // Emit the expression without the cast wrapper, with the modifier prefix
        // For `value as out<int>`, emit `out value`
        const [argFrag, ctx] = emitExpression(arg, currentContext);
        args.push(`${castModifier} ${argFrag.text}`);
        currentContext = ctx;
      } else {
        const [argFrag, ctx] = emitExpression(
          arg,
          currentContext,
          expectedType
        );
        // Check if this argument needs ref/out/in prefix from function signature
        // Only add prefix if argument is an lvalue (identifier or member access)
        const passingMode = expr.argumentPassing?.[i];
        const prefix =
          passingMode && passingMode !== "value" && isLValue(arg)
            ? `${passingMode} `
            : "";
        args.push(`${prefix}${argFrag.text}`);
        currentContext = ctx;
      }
    }
  }

  // For member-access calls, the receiver parenthesization is already handled inside
  // `emitMemberAccess`. Wrapping the full `obj.Member` in parentheses can change meaning
  // in C# (e.g., `(obj.Member)()` attempts to invoke a delegate rather than calling a method).
  const calleeText =
    expr.callee.kind === "memberAccess"
      ? `${finalCalleeName}${typeArgsStr}`
      : formatPostfixExpressionText(
          expr.callee,
          `${finalCalleeName}${typeArgsStr}`
        );

  const callOp = expr.isOptional ? "?." : "";
  const callText = `${calleeText}${callOp}(${args.join(", ")})`;

  // Add cast if needed (e.g., Math.floor returning double but asserted as int)
  const text = needsIntCast(expr, finalCalleeName)
    ? `(int)${callText}`
    : callText;

  return [{ text }, currentContext];
};
