/**
 * New expression converter
 *
 * Phase 15 (Alice's spec): Two-pass resolution for deterministic constructor typing.
 */

import * as ts from "typescript";
import { IrNewExpression } from "../../../types.js";
import {
  getSourceSpan,
  extractTypeArguments,
  checkIfRequiresSpecialization,
} from "../helpers.js";
import { convertExpression } from "../../../expression-converter.js";
import { IrType } from "../../../types.js";
import type { ProgramContext } from "../../../program-context.js";
import {
  type CallSiteArgModifier,
  unwrapCallSiteArgumentModifier,
  applyCallSiteArgumentModifiers,
  extractArgumentPassing,
} from "./call-site-analysis.js";

// DELETED: getConstructedType - Phase 15 uses resolveCall.returnType instead

/**
 * Convert new expression
 *
 * Phase 15 (Alice's spec): Two-pass resolution for deterministic constructor typing.
 * 1) Resolve once (without argTypes) to get parameter types for expected-type threading.
 * 2) Convert non-lambda arguments first, collecting argTypes for inference.
 * 3) Re-resolve with argTypes to infer constructor type parameters.
 * 4) Convert lambda arguments using instantiated parameter types.
 * 5) Final resolve with full argTypes.
 * 6) inferredType MUST be finalResolved.returnType.
 */
export const convertNewExpression = (
  node: ts.NewExpression,
  ctx: ProgramContext
): IrNewExpression => {
  // Extract explicit type arguments (for IR output, not inference)
  const typeArguments = extractTypeArguments(node, ctx);
  const requiresSpecialization = checkIfRequiresSpecialization(node, ctx);

  // Convert callee (the constructor expression)
  const callee = convertExpression(node.expression, ctx, undefined);

  // Two-pass resolution (matching convertCallExpression pattern)
  const typeSystem = ctx.typeSystem;
  const sigId = ctx.binding.resolveConstructorSignature(node);
  const argumentCount = node.arguments?.length ?? 0;
  const callSiteArgModifiers: (CallSiteArgModifier | undefined)[] = new Array(
    argumentCount
  ).fill(undefined);

  // Extract explicit type arguments from call site
  const explicitTypeArgs = node.typeArguments
    ? node.typeArguments.map((ta) =>
        typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(ta))
      )
    : undefined;

  // Initial resolution (without argTypes) for parameter type threading
  const initialResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount,
        explicitTypeArgs,
      })
    : undefined;
  const initialParameterTypes = initialResolved?.parameterTypes;

  const isLambdaArg = (expr: ts.Expression): boolean => {
    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) return true;
    if (ts.isParenthesizedExpression(expr)) return isLambdaArg(expr.expression);
    return false;
  };

  // Pass 1: convert non-lambda arguments and collect argTypes for inference
  const argsWorking: (IrNewExpression["arguments"][number] | undefined)[] =
    new Array(argumentCount);
  const argTypesForInference: (IrType | undefined)[] =
    Array(argumentCount).fill(undefined);

  const args = node.arguments ?? [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;

    const expectedType = initialParameterTypes?.[index];

    if (ts.isSpreadElement(arg)) {
      const spreadExpr = convertExpression(arg.expression, ctx, undefined);
      argsWorking[index] = {
        kind: "spread" as const,
        expression: spreadExpr,
        inferredType: spreadExpr.inferredType,
        sourceSpan: getSourceSpan(arg),
      };
      continue;
    }

    const unwrapped = unwrapCallSiteArgumentModifier(arg);
    if (unwrapped.modifier) {
      callSiteArgModifiers[index] = unwrapped.modifier;
    }

    if (isLambdaArg(unwrapped.expression)) {
      // Defer lambda conversion until after generic type arg inference
      continue;
    }

    const converted = convertExpression(
      unwrapped.expression,
      ctx,
      expectedType
    );
    argsWorking[index] = converted;
    argTypesForInference[index] = converted.inferredType;
  }

  // Re-resolve with argTypes to infer constructor type parameters
  const lambdaContextResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount,
        explicitTypeArgs,
        argTypes: argTypesForInference,
      })
    : initialResolved;

  const parameterTypesForLambdaContext =
    lambdaContextResolved?.parameterTypes ?? initialParameterTypes;

  // Pass 2: convert lambda arguments with inferred parameter types
  for (let index = 0; index < args.length; index++) {
    if (argsWorking[index]) continue;
    const arg = args[index];
    if (!arg) continue;
    if (ts.isSpreadElement(arg)) continue;
    const unwrapped = unwrapCallSiteArgumentModifier(arg);
    if (unwrapped.modifier) {
      callSiteArgModifiers[index] = unwrapped.modifier;
    }
    if (!isLambdaArg(unwrapped.expression)) continue;

    const expectedType = parameterTypesForLambdaContext?.[index];
    const lambdaExpectedType =
      expectedType?.kind === "functionType"
        ? expectedType
        : expectedType
          ? (typeSystem.delegateToFunctionType(expectedType) ?? expectedType)
          : undefined;

    argsWorking[index] = convertExpression(
      unwrapped.expression,
      ctx,
      lambdaExpectedType
    );
  }

  // Fill any remaining undefined slots (shouldn't happen, but be safe)
  const convertedArgs = argsWorking.map((a, index) => {
    if (a) return a;
    const arg = args[index];
    if (!arg) {
      throw new Error(
        "ICE: new expression argument conversion produced a hole"
      );
    }
    if (ts.isSpreadElement(arg)) {
      const spreadExpr = convertExpression(arg.expression, ctx, undefined);
      return {
        kind: "spread" as const,
        expression: spreadExpr,
        inferredType: spreadExpr.inferredType,
        sourceSpan: getSourceSpan(arg),
      };
    }
    const unwrapped = unwrapCallSiteArgumentModifier(arg);
    if (unwrapped.modifier) {
      callSiteArgModifiers[index] = unwrapped.modifier;
    }
    return convertExpression(unwrapped.expression, ctx, undefined);
  });

  // Collect final argTypes
  const argTypes = convertedArgs.map((a) =>
    a.kind === "spread" ? undefined : a.inferredType
  );

  // Final resolution with full argTypes
  const finalResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount,
        explicitTypeArgs,
        argTypes,
      })
    : lambdaContextResolved;

  // Phase 15: inferredType MUST be finalResolved.returnType
  // If sigId is missing, use unknownType (do not fabricate a nominal type)
  const inferredType: IrType = finalResolved?.returnType ?? {
    kind: "unknownType",
  };
  const parameterTypes = finalResolved?.parameterTypes ?? initialParameterTypes;
  const argumentPassingBase = finalResolved
    ? finalResolved.parameterModes.slice(0, argumentCount)
    : extractArgumentPassing(node, ctx);
  const argumentPassing = applyCallSiteArgumentModifiers(
    argumentPassingBase,
    callSiteArgModifiers,
    argumentCount,
    ctx,
    node
  );

  // Phase 18: IrNewExpression.typeArguments must include inferred type arguments.
  // The emitter relies on this field to emit generic constructor calls (e.g., new Box<int>(...)).
  const inferredTypeArguments =
    inferredType.kind === "referenceType"
      ? inferredType.typeArguments
      : undefined;
  const typeArgumentsForIr =
    typeArguments ??
    (inferredTypeArguments && inferredTypeArguments.length > 0
      ? inferredTypeArguments
      : undefined);

  return {
    kind: "new",
    callee,
    arguments: convertedArgs,
    inferredType,
    sourceSpan: getSourceSpan(node),
    argumentPassing,
    parameterTypes,
    typeArguments: typeArgumentsForIr,
    requiresSpecialization,
  };
};
