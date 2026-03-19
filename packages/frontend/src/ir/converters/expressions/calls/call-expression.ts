/**
 * Call expression converter
 *
 * Contains convertCallExpression: intrinsic calls, dynamic imports,
 * and general call expression conversion with two-pass argument
 * resolution for generic type inference.
 *
 * ALICE'S SPEC: All call resolution goes through TypeSystem.resolveCall().
 */

import * as ts from "typescript";
import {
  IrCallExpression,
  IrAsInterfaceExpression,
  IrTryCastExpression,
  IrStackAllocExpression,
  IrDefaultOfExpression,
  IrNameOfExpression,
  IrSizeOfExpression,
} from "../../../types.js";
import {
  getSourceSpan,
  extractTypeArguments,
  checkIfRequiresSpecialization,
} from "../helpers.js";
import { convertExpression } from "../../../expression-converter.js";
import { IrType } from "../../../types.js";
import type { ProgramContext } from "../../../program-context.js";
import { createDiagnostic } from "../../../../types/diagnostic.js";
import { expandParameterTypesForArguments } from "../../../type-system/type-system-call-resolution.js";
import {
  type CallSiteArgModifier,
  deriveSubstitutionsFromExpectedReturn,
  substituteTypeParameters,
  unwrapCallSiteArgumentModifier,
  applyCallSiteArgumentModifiers,
  extractArgumentPassing,
  extractArgumentPassingFromBinding,
} from "./call-site-analysis.js";
import {
  convertDynamicImportNamespaceObject,
  getDynamicImportPromiseType,
} from "../dynamic-import.js";
import { isIdentifierFromCore } from "../../../../core-intrinsics/provenance.js";
import { narrowTypeByArrayShape } from "../../array-type-guards.js";
import {
  chooseCallableCandidate,
  collectResolutionArguments,
  isArrayIsArrayCall,
} from "./call-resolution.js";

/**
 * Convert call expression
 */
export const convertCallExpression = (
  node: ts.CallExpression,
  ctx: ProgramContext,
  expectedType?: IrType
):
  | IrCallExpression
  | IrAsInterfaceExpression
  | IrTryCastExpression
  | IrStackAllocExpression
  | IrDefaultOfExpression
  | IrNameOfExpression
  | IrSizeOfExpression => {
  const isCoreLangIntrinsicCall = (name: string): boolean =>
    ts.isIdentifier(node.expression) &&
    node.expression.text === name &&
    isIdentifierFromCore(ctx.checker, node.expression, "lang");

  const extractNameofTarget = (expr: ts.Expression): string | undefined => {
    if (ts.isIdentifier(expr)) return expr.text;
    if (expr.kind === ts.SyntaxKind.ThisKeyword) return "this";
    if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
    return undefined;
  };

  const isSupportedSizeofTarget = (type: IrType): boolean => {
    if (type.kind === "primitiveType") {
      return (
        type.name === "number" ||
        type.name === "int" ||
        type.name === "boolean" ||
        type.name === "char"
      );
    }

    if (type.kind !== "referenceType") return false;

    const name = type.resolvedClrType ?? type.name;
    return (
      name === "byte" ||
      name === "sbyte" ||
      name === "short" ||
      name === "ushort" ||
      name === "int" ||
      name === "uint" ||
      name === "long" ||
      name === "ulong" ||
      name === "nint" ||
      name === "nuint" ||
      name === "int128" ||
      name === "uint128" ||
      name === "float" ||
      name === "double" ||
      name === "half" ||
      name === "decimal" ||
      name === "bool" ||
      name === "char" ||
      name === "System.Guid" ||
      name === "global::System.Guid" ||
      name === "System.DateTime" ||
      name === "global::System.DateTime" ||
      name === "System.DateOnly" ||
      name === "global::System.DateOnly" ||
      name === "System.TimeOnly" ||
      name === "global::System.TimeOnly" ||
      name === "System.TimeSpan" ||
      name === "global::System.TimeSpan"
    );
  };

  // asinterface<T>(x) - compile-time-only interface view (no runtime casts).
  if (
    isCoreLangIntrinsicCall("asinterface") &&
    node.typeArguments &&
    node.typeArguments.length === 1 &&
    node.arguments.length === 1
  ) {
    const targetTypeNode = node.typeArguments[0];
    const argNode = node.arguments[0];
    if (!targetTypeNode || !argNode) {
      throw new Error(
        "ICE: asinterface requires exactly 1 type argument and 1 argument"
      );
    }

    const typeSystem = ctx.typeSystem;
    const targetType = typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(targetTypeNode)
    );
    const argExpr = convertExpression(argNode, ctx, targetType);

    return {
      kind: "asinterface",
      expression: argExpr,
      targetType,
      inferredType: targetType,
      sourceSpan: getSourceSpan(node),
    };
  }

  // istype<T>(x) - compiler-only type guard for overload specialization.
  // Erased at compile time; converted to IR call for narrowing/specialization.
  if (
    ts.isIdentifier(node.expression) &&
    node.expression.text === "istype" &&
    node.typeArguments &&
    node.typeArguments.length === 1 &&
    node.arguments.length === 1
  ) {
    const targetTypeNode = node.typeArguments[0];
    const argNode = node.arguments[0];
    if (!targetTypeNode || !argNode) {
      throw new Error(
        "ICE: istype requires exactly 1 type argument and 1 argument"
      );
    }

    const typeSystem = ctx.typeSystem;
    const targetType = typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(targetTypeNode)
    );
    const argExpr = convertExpression(argNode, ctx, undefined);
    const callee = convertExpression(node.expression, ctx, undefined);

    return {
      kind: "call",
      callee,
      arguments: [argExpr],
      isOptional: false,
      inferredType: { kind: "primitiveType", name: "boolean" },
      typeArguments: [targetType],
      sourceSpan: getSourceSpan(node),
    };
  }

  // Check for defaultof<T>() - language intrinsic for default value.
  // defaultof<T>() compiles to C#: default(T)
  if (
    isCoreLangIntrinsicCall("defaultof") &&
    node.typeArguments &&
    node.typeArguments.length === 1 &&
    node.arguments.length === 0
  ) {
    const targetTypeNode = node.typeArguments[0];
    if (!targetTypeNode) {
      throw new Error("ICE: defaultof requires exactly 1 type argument");
    }

    const typeSystem = ctx.typeSystem;
    const targetType = typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(targetTypeNode)
    );

    return {
      kind: "defaultof",
      targetType,
      inferredType: targetType,
      sourceSpan: getSourceSpan(node),
    };
  }

  if (
    isCoreLangIntrinsicCall("nameof") &&
    (!node.typeArguments || node.typeArguments.length === 0) &&
    node.arguments.length === 1
  ) {
    const argNode = node.arguments[0];
    if (!argNode) {
      throw new Error("ICE: nameof requires exactly 1 argument");
    }

    const targetName = extractNameofTarget(argNode);
    if (!targetName) {
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN7443",
          "error",
          "'nameof(...)' currently supports identifiers, 'this', and dotted member access only.",
          getSourceSpan(node)
        )
      );
      return {
        kind: "nameof",
        name: "",
        inferredType: { kind: "primitiveType", name: "string" },
        sourceSpan: getSourceSpan(node),
      };
    }

    return {
      kind: "nameof",
      name: targetName,
      inferredType: { kind: "primitiveType", name: "string" },
      sourceSpan: getSourceSpan(node),
    };
  }

  if (
    isCoreLangIntrinsicCall("sizeof") &&
    node.typeArguments &&
    node.typeArguments.length === 1 &&
    node.arguments.length === 0
  ) {
    const targetTypeNode = node.typeArguments[0];
    if (!targetTypeNode) {
      throw new Error("ICE: sizeof requires exactly 1 type argument");
    }

    const typeSystem = ctx.typeSystem;
    const targetType = typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(targetTypeNode)
    );

    if (!isSupportedSizeofTarget(targetType)) {
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN7443",
          "error",
          "'sizeof<T>()' requires a known value-compatible type (primitive numeric/bool/char or known CLR struct).",
          getSourceSpan(node)
        )
      );
    }

    return {
      kind: "sizeof",
      targetType,
      inferredType: { kind: "primitiveType", name: "int" },
      sourceSpan: getSourceSpan(node),
    };
  }

  // Check for trycast<T>(x) - special intrinsic for safe casting
  // trycast<T>(x) compiles to C#: x as T (safe cast, returns null on failure)
  if (
    isCoreLangIntrinsicCall("trycast") &&
    node.typeArguments &&
    node.typeArguments.length === 1 &&
    node.arguments.length === 1
  ) {
    // We've verified length === 1 above, so these are guaranteed to exist
    const targetTypeNode = node.typeArguments[0];
    const argNode = node.arguments[0];
    if (!targetTypeNode || !argNode) {
      throw new Error(
        "ICE: trycast requires exactly 1 type argument and 1 argument"
      );
    }
    // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
    const typeSystem = ctx.typeSystem;
    const targetType = typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(targetTypeNode)
    );
    const argExpr = convertExpression(argNode, ctx, undefined);

    // Build union type T | null for inferredType
    const nullType: IrType = { kind: "primitiveType", name: "null" };
    const unionType: IrType = {
      kind: "unionType",
      types: [targetType, nullType],
    };

    return {
      kind: "trycast",
      expression: argExpr,
      targetType,
      inferredType: unionType,
      sourceSpan: getSourceSpan(node),
    };
  }

  // Check for stackalloc<T>(size) - language intrinsic for stack allocation.
  // stackalloc<T>(size) compiles to C#: stackalloc T[size]
  if (
    isCoreLangIntrinsicCall("stackalloc") &&
    node.typeArguments &&
    node.typeArguments.length === 1 &&
    node.arguments.length === 1
  ) {
    const elementTypeNode = node.typeArguments[0];
    const sizeNode = node.arguments[0];
    if (!elementTypeNode || !sizeNode) {
      throw new Error(
        "ICE: stackalloc requires exactly 1 type argument and 1 argument"
      );
    }

    const typeSystem = ctx.typeSystem;
    const elementType = typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(elementTypeNode)
    );
    const sizeExpr = convertExpression(sizeNode, ctx, {
      kind: "primitiveType",
      name: "int",
    });

    return {
      kind: "stackalloc",
      elementType,
      size: sizeExpr,
      inferredType: {
        kind: "referenceType",
        name: "Span",
        typeArguments: [elementType],
      },
      sourceSpan: getSourceSpan(node),
    };
  }

  // Dynamic import expressions are preserved as normal calls.
  //
  // For deterministic closed-world local modules, we additionally attach:
  // - Promise<namespaceObject> inferred type
  // - a synthesized namespace object IR payload for the emitter
  //
  // Unsupported/open-world forms remain Promise<unknown> and are rejected by
  // source validation before emission.
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    const typeArguments = extractTypeArguments(node, ctx);
    const requiresSpecialization = checkIfRequiresSpecialization(node, ctx);
    const callee = convertExpression(node.expression, ctx, undefined);
    const dynamicImportNamespace = convertDynamicImportNamespaceObject(
      node,
      ctx
    );
    const args: IrCallExpression["arguments"][number][] = [];
    for (const arg of node.arguments) {
      if (ts.isSpreadElement(arg)) {
        const spreadExpr = convertExpression(arg.expression, ctx, undefined);
        args.push({
          kind: "spread",
          expression: spreadExpr,
          inferredType: spreadExpr.inferredType,
          sourceSpan: getSourceSpan(arg),
        });
      } else {
        args.push(convertExpression(arg, ctx, undefined));
      }
    }

    return {
      kind: "call",
      callee,
      arguments: args,
      isOptional: node.questionDotToken !== undefined,
      inferredType: getDynamicImportPromiseType(node, ctx) ?? {
        kind: "referenceType",
        name: "Promise",
        typeArguments: [{ kind: "unknownType" }],
      },
      sourceSpan: getSourceSpan(node),
      typeArguments,
      requiresSpecialization,
      dynamicImportNamespace,
    };
  }

  // Extract type arguments from the call signature
  const typeArguments = extractTypeArguments(node, ctx);
  const requiresSpecialization = checkIfRequiresSpecialization(node, ctx);

  // Convert callee first so we can access memberBinding and receiver type
  const callee = convertExpression(node.expression, ctx, undefined);

  // Extract receiver type for member method calls (e.g., dict.get() -> dict's type)
  const receiverIrType =
    callee.kind === "memberAccess" ? callee.object.inferredType : undefined;

  // Resolve call (two-pass):
  // 1) Resolve parameter types (for expectedType threading)
  // 2) Convert arguments, then re-resolve with argTypes to infer generics deterministically
  const typeSystem = ctx.typeSystem;
  const sigId = ctx.binding.resolveCallSignature(node);
  const argumentCount = node.arguments.length;
  const callSiteArgModifiers: (CallSiteArgModifier | undefined)[] = new Array(
    argumentCount
  ).fill(undefined);

  const explicitTypeArgs = node.typeArguments
    ? node.typeArguments.map((ta) =>
        typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(ta))
      )
    : undefined;

  const specializedMemberFunctionType = (() => {
    if (!ts.isPropertyAccessExpression(node.expression)) return undefined;
    if (!receiverIrType) return undefined;

    const memberId = ctx.binding.resolvePropertyAccess(node.expression);
    if (!memberId) return undefined;

    const memberType = typeSystem.typeOfMemberId(memberId, receiverIrType);
    return chooseCallableCandidate(memberType, argumentCount, ctx);
  })();

  // If we can't resolve a signature handle (common for calls through function-typed
  // variables), fall back to the callee's inferred function type.
  const calleeFunctionType = (() => {
    if (specializedMemberFunctionType) {
      return specializedMemberFunctionType;
    }

    const t = callee.inferredType;
    return chooseCallableCandidate(t, argumentCount, ctx);
  })();

  if (!sigId && calleeFunctionType) {
    const params = calleeFunctionType.parameters;
    const paramTypesForArgs = expandParameterTypesForArguments(
      params,
      params.map((parameter) => parameter.type),
      node.arguments.length
    );

    const args: IrCallExpression["arguments"][number][] = [];
    for (let i = 0; i < node.arguments.length; i++) {
      const arg = node.arguments[i];
      if (!arg) continue;

      const expectedType = paramTypesForArgs[i];
      if (ts.isSpreadElement(arg)) {
        const spreadExpr = convertExpression(arg.expression, ctx, undefined);
        args.push({
          kind: "spread",
          expression: spreadExpr,
          inferredType: spreadExpr.inferredType,
          sourceSpan: getSourceSpan(arg),
        });
        continue;
      }

      const unwrapped = unwrapCallSiteArgumentModifier(arg);
      if (unwrapped.modifier) {
        callSiteArgModifiers[i] = unwrapped.modifier;
      }
      args.push(convertExpression(unwrapped.expression, ctx, expectedType));
    }

    const argumentPassing = applyCallSiteArgumentModifiers(
      extractArgumentPassing(node, ctx),
      callSiteArgModifiers,
      argumentCount,
      ctx,
      node
    );

    return {
      kind: "call",
      callee,
      arguments: args,
      isOptional: node.questionDotToken !== undefined,
      inferredType: calleeFunctionType.returnType,
      sourceSpan: getSourceSpan(node),
      typeArguments,
      requiresSpecialization,
      argumentPassing,
      parameterTypes: paramTypesForArgs,
      restParameter: (() => {
        const restIndex = params.findIndex((parameter) => parameter.isRest);
        if (restIndex < 0) return undefined;
        return {
          index: restIndex,
          arrayType: params[restIndex]?.type,
          elementType: paramTypesForArgs[restIndex],
        };
      })(),
    };
  }

  const initialResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount,
        receiverType: receiverIrType,
        explicitTypeArgs,
        expectedReturnType: expectedType,
      })
    : undefined;
  const expectedReturnCandidates = expectedType
    ? typeSystem.collectExpectedReturnCandidates(expectedType)
    : undefined;
  const initialParameterTypes = (() => {
    const substitutions = deriveSubstitutionsFromExpectedReturn(
      initialResolved?.returnType,
      expectedReturnCandidates
    );
    if (!substitutions || !initialResolved?.parameterTypes) {
      return initialResolved?.parameterTypes;
    }
    return initialResolved.parameterTypes.map((t) =>
      substituteTypeParameters(t, substitutions)
    );
  })();

  const isLambdaArg = (expr: ts.Expression): boolean => {
    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) return true;
    if (ts.isParenthesizedExpression(expr)) return isLambdaArg(expr.expression);
    return false;
  };

  const isExplicitlyTypedLambdaArg = (expr: ts.Expression): boolean => {
    if (ts.isParenthesizedExpression(expr)) {
      return isExplicitlyTypedLambdaArg(expr.expression);
    }

    if (!ts.isArrowFunction(expr) && !ts.isFunctionExpression(expr)) {
      return false;
    }

    if (expr.type) return true;
    if (expr.typeParameters && expr.typeParameters.length > 0) return true;
    return expr.parameters.some((p) => p.type !== undefined);
  };

  const shouldDeferLambdaForInference = (expr: ts.Expression): boolean =>
    isLambdaArg(expr) && !isExplicitlyTypedLambdaArg(expr);

  // Pass 1: convert non-lambda arguments and infer type args from them.
  const argsWorking: (IrCallExpression["arguments"][number] | undefined)[] =
    new Array(node.arguments.length);
  const argTypesForInference: (IrType | undefined)[] = Array(
    node.arguments.length
  ).fill(undefined);

  for (let index = 0; index < node.arguments.length; index++) {
    const arg = node.arguments[index];
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

    if (shouldDeferLambdaForInference(unwrapped.expression)) {
      // Defer *untyped* lambda conversion until after we infer generic type args
      // from other arguments. Explicitly typed lambdas are safe to convert early
      // and often provide the only deterministic inference signal.
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

  const lambdaContextResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount,
        receiverType: receiverIrType,
        explicitTypeArgs,
        argTypes: argTypesForInference,
        expectedReturnType: expectedType,
      })
    : initialResolved;

  const parameterTypesForLambdaContext =
    lambdaContextResolved?.parameterTypes ?? initialParameterTypes;

  // Pass 2: convert lambda arguments with inferred parameter types in scope.
  //
  // IMPORTANT (airplane-grade):
  // Lambdas may have been converted in Pass 1 (e.g., because they have explicit
  // parameter annotations) before we had a fully resolved call signature.
  //
  // In those cases, block-bodied arrows can lose contextual return types and be
  // treated as `void`, which then mis-emits `return expr;` as:
  //   expr;
  //   return;
  //
  // Re-convert *all* lambda arguments here using the resolved parameter type so
  // contextual parameter + return typing is applied deterministically.
  for (let index = 0; index < node.arguments.length; index++) {
    const arg = node.arguments[index];
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

  const convertedArgs = argsWorking.map((a) => {
    if (!a) {
      throw new Error("ICE: call argument conversion produced a hole");
    }
    return a;
  });

  const argTypes = convertedArgs.map((a) =>
    a.kind === "spread" ? undefined : a.inferredType
  );

  const resolutionArgs = collectResolutionArguments(convertedArgs);

  const finalResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount:
          resolutionArgs.argumentCount > 0
            ? resolutionArgs.argumentCount
            : argumentCount,
        receiverType: receiverIrType,
        explicitTypeArgs,
        argTypes:
          resolutionArgs.argumentCount > 0 ? resolutionArgs.argTypes : argTypes,
        expectedReturnType: expectedType,
      })
    : lambdaContextResolved;

  const parameterTypes = finalResolved?.parameterTypes ?? initialParameterTypes;
  const surfaceParameterTypes =
    finalResolved?.surfaceParameterTypes ?? parameterTypes;
  const inferredType = (() => {
    const resolvedReturnType = finalResolved?.returnType;
    if (!resolvedReturnType) {
      return { kind: "unknownType" } as const;
    }

    // Airplane-grade rule:
    // When a call target is already typed as a function value and the resolved
    // signature has no declared return annotation, the IR must preserve the
    // callee's deterministically inferred function return type instead of
    // collapsing the call to `void`.
    //
    // This matters for synthesized object-literal methods and other
    // function-valued members where the TS signature handle may originate from
    // syntax without an explicit return type while the frontend has already
    // recovered a precise function type from the body.
    if (
      finalResolved?.hasDeclaredReturnType === false &&
      calleeFunctionType?.returnType &&
      (resolvedReturnType.kind === "voidType" ||
        resolvedReturnType.kind === "unknownType" ||
        resolvedReturnType.kind === "anyType")
    ) {
      return calleeFunctionType.returnType;
    }

    return resolvedReturnType;
  })();
  const argumentPassingFromBinding = extractArgumentPassingFromBinding(
    callee,
    node.arguments.length,
    ctx,
    parameterTypes,
    argTypes
  );
  const argumentPassing =
    argumentPassingFromBinding ??
    (finalResolved
      ? finalResolved.parameterModes.slice(0, node.arguments.length)
      : extractArgumentPassing(node, ctx));
  const argumentPassingWithOverrides = applyCallSiteArgumentModifiers(
    argumentPassing,
    callSiteArgModifiers,
    argumentCount,
    ctx,
    node
  );

  const narrowing: IrCallExpression["narrowing"] = (() => {
    if (ts.isCallExpression(node) && isArrayIsArrayCall(node.expression)) {
      const currentType = argTypes[0];
      const targetType = narrowTypeByArrayShape(
        ctx.typeSystem,
        currentType,
        true
      );
      if (targetType) {
        return {
          kind: "typePredicate",
          argIndex: 0,
          targetType,
        };
      }
    }

    const pred = finalResolved?.typePredicate;
    if (pred?.kind === "param") {
      return {
        kind: "typePredicate",
        argIndex: pred.parameterIndex,
        targetType: pred.targetType,
      };
    }

    return undefined;
  })();

  return {
    kind: "call",
    callee,
    // Pass parameter types as expectedType for deterministic contextual typing
    // This ensures `spreadArray([1,2,3], [4,5,6])` with `number[]` params produces `double[]`
    arguments: convertedArgs,
    isOptional: node.questionDotToken !== undefined,
    inferredType,
    allowUnknownInferredType: finalResolved?.hasDeclaredReturnType ?? false,
    sourceSpan: getSourceSpan(node),
    typeArguments,
    requiresSpecialization,
    argumentPassing: argumentPassingWithOverrides,
    parameterTypes,
    surfaceParameterTypes,
    restParameter: finalResolved?.restParameter,
    surfaceRestParameter: finalResolved?.surfaceRestParameter,
    narrowing,
  };
};
