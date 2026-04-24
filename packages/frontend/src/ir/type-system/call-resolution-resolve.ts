/**
 * Call Resolution Resolve — Main resolveCall entry point.
 *
 * Contains the resolveCall function that orchestrates signature loading,
 * receiver substitution, and method type parameter inference.
 *
 * DAG position: depends on type-system-state, type-system-relations,
 * call-resolution-utilities, call-resolution-signatures, call-resolution-inference
 */

import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import type { IrType } from "../types/index.js";
import type {
  TypeSystemState,
  CallQuery,
  ResolvedCall,
} from "./type-system-state.js";
import {
  emitDiagnostic,
  stripTsonicExtensionWrappers,
  poisonedCall,
  resolveTypeIdByName,
} from "./type-system-state.js";
import {
  expandParameterTypesForArguments,
  buildResolvedRestParameter,
  containsMethodTypeParameter,
  collectExpectedReturnCandidates,
  delegateToFunctionType,
} from "./call-resolution-utilities.js";
import { getRawSignature } from "./call-resolution-signatures.js";
import { refineResolvedParameterTypesForArguments } from "./call-resolution-inference.js";
import { applyReceiverSubstitution } from "./call-resolution-receiver-substitution.js";
import { resolveMethodTypeSubstitution } from "./call-resolution-method-substitution.js";
import { isAssignableTo, typesEqual } from "./type-system-relations.js";
import { referenceTypeIdentity } from "../types/type-ops.js";

// ─────────────────────────────────────────────────────────────────────────
// resolveCall — Main entry point for call resolution
// ─────────────────────────────────────────────────────────────────────────

const matchesConstructorExpectedReturnShape = (
  actual: IrType,
  expected: IrType
): boolean => {
  if (typesEqual(actual, expected)) {
    return true;
  }

  if (actual.kind === "referenceType" && expected.kind === "referenceType") {
    const actualIdentity = referenceTypeIdentity(actual);
    const expectedIdentity = referenceTypeIdentity(expected);
    if (
      actualIdentity === undefined ||
      expectedIdentity === undefined ||
      actualIdentity !== expectedIdentity
    ) {
      return false;
    }

    const actualTypeArguments = actual.typeArguments ?? [];
    const expectedTypeArguments = expected.typeArguments ?? [];
    if (actualTypeArguments.length !== expectedTypeArguments.length) {
      return false;
    }

    return actualTypeArguments.every((argument: IrType, index: number) => {
      const expectedArgument = expectedTypeArguments[index];
      return (
        argument !== undefined &&
        expectedArgument !== undefined &&
        matchesConstructorExpectedReturnShape(argument, expectedArgument)
      );
    });
  }

  return false;
};

type DeferredLambdaInferenceAnalysis = {
  readonly deferredOnly: ReadonlySet<string>;
  readonly blocked: ReadonlySet<string>;
};

const analyzeDeferredLambdaInferencePositions = (
  state: TypeSystemState,
  type: IrType,
  unresolved: ReadonlySet<string>
): DeferredLambdaInferenceAnalysis => {
  const deferredOnly = new Set<string>();
  const blocked = new Set<string>();

  const visit = (
    current: IrType,
    position: "normal" | "deferredReturn"
  ): void => {
    if (current.kind === "typeParameterType") {
      if (!unresolved.has(current.name)) {
        return;
      }

      if (position === "deferredReturn") {
        deferredOnly.add(current.name);
      } else {
        blocked.add(current.name);
      }
      return;
    }

    const delegateShape =
      current.kind === "referenceType"
        ? delegateToFunctionType(state, current)
        : undefined;
    if (delegateShape) {
      visit(delegateShape, position);
      return;
    }

    switch (current.kind) {
      case "referenceType":
        for (const typeArgument of current.typeArguments ?? []) {
          if (typeArgument) {
            visit(typeArgument, position);
          }
        }
        return;

      case "arrayType":
        visit(current.elementType, position);
        return;

      case "tupleType":
        for (const elementType of current.elementTypes) {
          if (elementType) {
            visit(elementType, position);
          }
        }
        return;

      case "functionType":
        for (const parameter of current.parameters) {
          if (parameter.type) {
            visit(parameter.type, "normal");
          }
        }
        visit(current.returnType, "deferredReturn");
        return;

      case "unionType":
      case "intersectionType":
        for (const member of current.types) {
          if (member) {
            visit(member, position);
          }
        }
        return;

      case "objectType":
        for (const member of current.members) {
          if (member.kind === "propertySignature") {
            visit(member.type, position);
            continue;
          }

          if (member.kind === "methodSignature") {
            for (const parameter of member.parameters) {
              if (parameter.type) {
                visit(parameter.type, "normal");
              }
            }
            if (member.returnType) {
              visit(member.returnType, "deferredReturn");
            }
          }
        }
        return;

      default:
        return;
    }
  };

  visit(type, "normal");

  for (const name of blocked) {
    deferredOnly.delete(name);
  }

  return {
    deferredOnly,
    blocked,
  };
};

export const resolveCall = (
  state: TypeSystemState,
  query: CallQuery
): ResolvedCall => {
  const {
    sigId,
    argumentCount,
    receiverType,
    explicitTypeArgs,
    argTypes,
    expectedReturnType,
    site,
  } = query;

  // Extension method scopes are modeled as TS-only wrapper types (e.g. __TsonicExt_Ef<T>).
  // They must erase to their underlying CLR shapes for deterministic call inference.
  const effectiveReceiverType = receiverType
    ? stripTsonicExtensionWrappers(receiverType)
    : undefined;

  // 1. Load raw signature (cached)
  const rawSig = getRawSignature(state, sigId);
  if (!rawSig) {
    // BINDING CONTRACT VIOLATION (Alice's spec): If Binding returned a
    // SignatureId, HandleRegistry.getSignature(sigId) MUST succeed.
    // This indicates a bug in Binding, not a normal runtime condition.
    //
    // However, we cannot throw during normal compilation as it would
    // crash the compiler. Instead, emit diagnostic and return poisoned
    // result with correct arity.
    emitDiagnostic(
      state,
      "TSN5203",
      `Cannot resolve signature (Binding contract violation: ID ${sigId.id} not in HandleRegistry)`,
      site
    );
    return poisonedCall(argumentCount, state.diagnostics.slice());
  }

  // 2. Start with raw types
  let workingParams = [...rawSig.parameterTypes];
  let workingThisParam = rawSig.thisParameterType;
  let workingReturn = rawSig.returnType;
  let workingPredicate = rawSig.typePredicate;

  if (
    rawSig.constructsDeclaringType &&
    query.declaringClrType &&
    workingReturn.kind === "referenceType"
  ) {
    const arity = workingReturn.typeArguments?.length;
    const typeId =
      resolveTypeIdByName(state, query.declaringClrType, arity) ??
      resolveTypeIdByName(state, query.declaringClrType);
    workingReturn = {
      ...workingReturn,
      ...(typeId ? { typeId, resolvedClrType: typeId.clrName } : {}),
      ...(!typeId ? { resolvedClrType: query.declaringClrType } : {}),
    };
  }

  ({ workingParams, workingThisParam, workingReturn, workingPredicate } =
    applyReceiverSubstitution(
      state,
      rawSig,
      effectiveReceiverType,
      query.declaringClrType,
      {
        workingParams,
        workingThisParam,
        workingReturn,
        workingPredicate,
      }
    ));

  // 4. Compute call substitution (method type params)
  const methodTypeParams = rawSig.typeParameters;
  if (methodTypeParams.length > 0) {
    const substitution = resolveMethodTypeSubstitution(
      state,
      rawSig,
      {
        argTypes,
        explicitTypeArgs,
        expectedReturnType,
        receiverType: effectiveReceiverType,
      },
      site,
      workingParams,
      workingThisParam,
      workingReturn,
      workingPredicate
    );
    if (substitution.kind === "error") {
      return poisonedCall(argumentCount, state.diagnostics.slice());
    }
    const callSubst = substitution.substitution;

    // Apply call substitution
    if (callSubst.size > 0) {
      workingParams = workingParams.map((p) =>
        p ? irSubstitute(p, callSubst) : undefined
      );
      workingReturn = irSubstitute(workingReturn, callSubst);
      if (workingPredicate) {
        workingPredicate =
          workingPredicate.kind === "param"
            ? {
                ...workingPredicate,
                targetType: irSubstitute(
                  workingPredicate.targetType,
                  callSubst as IrSubstitutionMap
                ),
              }
            : {
                ...workingPredicate,
                targetType: irSubstitute(
                  workingPredicate.targetType,
                  callSubst as IrSubstitutionMap
                ),
              };
      }
    }

    // Check for unresolved method type parameters (after explicit/arg/default inference)
    const unresolved = new Set(
      methodTypeParams
        .map((tp) => tp.name)
        .filter((name) => !callSubst.has(name))
    );
    const hasUnresolvedReturnSurface = containsMethodTypeParameter(
      workingReturn,
      unresolved
    );
    const deferredLambdaInferableNames = new Set<string>();
    const hasUnresolvedParameterSurface = workingParams.some(
      (parameterType) => {
        if (!parameterType) {
          return false;
        }

        const analysis = analyzeDeferredLambdaInferencePositions(
          state,
          parameterType,
          unresolved
        );

        for (const name of analysis.deferredOnly) {
          deferredLambdaInferableNames.add(name);
        }

        return analysis.blocked.size > 0;
      }
    );
    const hasUnresolvedThisSurface =
      !!workingThisParam &&
      containsMethodTypeParameter(workingThisParam, unresolved);
    const hasUnresolvedPredicateSurface =
      !!workingPredicate &&
      containsMethodTypeParameter(workingPredicate.targetType, unresolved);
    const hasUnresolvedReturnSurfaceOutsideDeferredLambdaInference =
      hasUnresolvedReturnSurface &&
      [...unresolved].some((name) => {
        if (!deferredLambdaInferableNames.has(name)) {
          return containsMethodTypeParameter(workingReturn, new Set([name]));
        }
        return false;
      });
    const preservesExpectedConstructorReturn =
      rawSig.declaringMemberName === "constructor" &&
      query.expectedReturnType !== undefined &&
      collectExpectedReturnCandidates(state, query.expectedReturnType).some(
        (candidate) =>
          matchesConstructorExpectedReturnShape(workingReturn, candidate) ||
          (isAssignableTo(state, workingReturn, candidate) &&
            isAssignableTo(state, candidate, workingReturn))
      );
    const preservesExpectedConstructorSurface =
      preservesExpectedConstructorReturn &&
      rawSig.declaringMemberName === "constructor";
    if (
      unresolved.size > 0 &&
      (hasUnresolvedThisSurface ||
        hasUnresolvedPredicateSurface ||
        (!preservesExpectedConstructorSurface &&
          hasUnresolvedParameterSurface) ||
        (!preservesExpectedConstructorSurface &&
          hasUnresolvedReturnSurfaceOutsideDeferredLambdaInference))
    ) {
      emitDiagnostic(
        state,
        "TSN5202",
        "Signature contains unresolved type parameters - explicit type arguments required",
        site
      );
      return poisonedCall(argumentCount, state.diagnostics.slice());
    }
  }

  const resolved: ResolvedCall = {
    thisParameterType: workingThisParam,
    restParameter: buildResolvedRestParameter(
      rawSig.parameterFlags,
      workingParams
    ),
    surfaceRestParameter: buildResolvedRestParameter(
      rawSig.parameterFlags,
      workingParams
    ),
    surfaceParameterTypes: expandParameterTypesForArguments(
      rawSig.parameterFlags,
      workingParams,
      argumentCount
    ),
    parameterTypes: refineResolvedParameterTypesForArguments(
      state,
      rawSig.parameterFlags,
      workingParams,
      argTypes,
      argumentCount
    ),
    parameterModes: rawSig.parameterModes,
    returnType: workingReturn,
    hasDeclaredReturnType: rawSig.hasDeclaredReturnType,
    typePredicate: workingPredicate,
    selectionMeta: {
      hasRestParameter: rawSig.parameterFlags.some(
        (parameter) => parameter.isRest
      ),
      typeParamCount: rawSig.typeParameters.length,
      parameterCount: rawSig.parameterTypes.length,
      stableId: String(sigId.id),
    },
    diagnostics: [],
  };

  return resolved;
};
