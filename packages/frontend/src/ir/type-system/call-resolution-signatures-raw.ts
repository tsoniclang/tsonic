/**
 * Raw signature extraction and structural member lookup.
 *
 * Contains getRawSignature for extracting raw signatures from HandleRegistry
 * and lookupStructuralMember for object type member lookup.
 *
 * DAG position: depends on type-system-state, call-resolution-utilities
 */

import type { IrType, IrFunctionType } from "../types/index.js";
import * as ts from "typescript";
import type { TypeParameterInfo, ParameterMode, SignatureId } from "./types.js";
import { unknownType, voidType } from "./types.js";
import type {
  TypeSystemState,
  RawSignatureInfo,
  TypePredicateResult,
  Site,
} from "./type-system-state.js";
import { emitDiagnostic, addUndefinedToType } from "./type-system-state.js";
import { convertTypeNode } from "./call-resolution-utilities.js";

// ─────────────────────────────────────────────────────────────────────────
// getRawSignature — Extract raw signature from HandleRegistry
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get or compute raw signature info from SignatureId.
 * Caches the result for subsequent calls.
 */
export const getRawSignature = (
  state: TypeSystemState,
  sigId: SignatureId
): RawSignatureInfo | undefined => {
  const cached = state.signatureRawCache.get(sigId.id);
  if (cached) return cached;

  const sigInfo = state.handleRegistry.getSignature(sigId);
  if (!sigInfo) return undefined;

  // Convert parameter types from TypeNodes to IrTypes
  const effectiveParameters = sigInfo.resolvedParameters ?? sigInfo.parameters;

  const parameterTypes: (IrType | undefined)[] = effectiveParameters.map((p) => {
    const baseType = p.typeNode
      ? convertTypeNode(state, p.typeNode)
      : undefined;
    if (!baseType) return undefined;
    // Optional/defaulted parameters must accept explicit `undefined` at call sites.
    return p.isOptional ? addUndefinedToType(baseType) : baseType;
  });

  // Convert a TypeScript `this:` parameter type (if present) to an IrType.
  const thisParameterType: IrType | undefined = (() => {
    const n = sigInfo.thisTypeNode as ts.TypeNode | undefined;
    return n ? convertTypeNode(state, n) : undefined;
  })();

  // Extract parameter modes
  const parameterModes: ParameterMode[] = effectiveParameters.map(
    (p) => p.mode ?? "value"
  );

  // Extract parameter names
  const parameterNames: string[] = effectiveParameters.map((p) => p.name);

  const isConstructor = sigInfo.declaringMemberName === "constructor";
  // Extract type parameters.
  //
  // Constructors of generic classes do not declare their own type-parameter list in
  // TypeScript syntax, but constructor call resolution must still infer the enclosing
  // class type parameters from arguments / expected return context so `new Box(value)`
  // emits `new Box<T>(value)` when appropriate.
  const typeParameters: TypeParameterInfo[] = (
    isConstructor
      ? (sigInfo.typeParameters && sigInfo.typeParameters.length > 0
          ? sigInfo.typeParameters
          : (sigInfo.declaringTypeParameterNames ?? []).map((name) => ({
              name,
              constraintNode: undefined,
              defaultNode: undefined,
            }))
        ).map((tp) => ({
          name: tp.name,
          constraint: tp.constraintNode
            ? convertTypeNode(state, tp.constraintNode)
            : undefined,
          defaultType: tp.defaultNode
            ? convertTypeNode(state, tp.defaultNode)
            : undefined,
        }))
      : (sigInfo.typeParameters ?? []).map((tp) => ({
          name: tp.name,
          constraint: tp.constraintNode
            ? convertTypeNode(state, tp.constraintNode)
            : undefined,
          defaultType: tp.defaultNode
            ? convertTypeNode(state, tp.defaultNode)
            : undefined,
        }))
  );

  const hasDeclaredReturnType =
    sigInfo.returnTypeNode !== undefined || isConstructor;

  // Convert return type
  const returnType: IrType = (() => {
    if (sigInfo.returnTypeNode)
      return convertTypeNode(state, sigInfo.returnTypeNode);

    // Class constructor declarations do not have return type annotations in TS syntax.
    // Deterministically synthesize the constructed instance type using the declaring
    // identity captured in Binding and the (class) type parameters captured for the
    // constructor signature.
    if (isConstructor && sigInfo.declaringTypeTsName) {
      const typeArguments = typeParameters.map(
        (tp) =>
          ({
            kind: "typeParameterType" as const,
            name: tp.name,
          }) satisfies IrType
      );

      return {
        kind: "referenceType",
        name: sigInfo.declaringTypeTsName,
        ...(typeArguments.length > 0 ? { typeArguments } : {}),
      };
    }

    return voidType;
  })();

  // Extract type predicate (already extracted in Binding at registration time)
  let typePredicate: TypePredicateResult | undefined;
  if (sigInfo.typePredicate) {
    const pred = sigInfo.typePredicate;
    const targetType = convertTypeNode(state, pred.targetTypeNode);
    if (pred.kind === "param") {
      typePredicate = {
        kind: "param",
        parameterIndex: pred.parameterIndex,
        targetType,
      };
    } else {
      typePredicate = {
        kind: "this",
        targetType,
      };
    }
  }

  const rawSig: RawSignatureInfo = {
    parameterTypes,
    parameterFlags: effectiveParameters.map((parameter) => ({
      isRest: parameter.isRest,
      isOptional: parameter.isOptional,
    })),
    thisParameterType,
    returnType,
    hasDeclaredReturnType,
    parameterModes,
    typeParameters,
    parameterNames,
    typePredicate,
    declaringTypeTsName: sigInfo.declaringTypeTsName,
    declaringTypeParameterNames: sigInfo.declaringTypeParameterNames,
    declaringMemberName: sigInfo.declaringMemberName,
  };

  state.signatureRawCache.set(sigId.id, rawSig);
  return rawSig;
};

// ─────────────────────────────────────────────────────────────────────────
// lookupStructuralMember — Structural (object) type member lookup
// ─────────────────────────────────────────────────────────────────────────

/**
 * Look up a member on a structural (object) type.
 */
export const lookupStructuralMember = (
  state: TypeSystemState,
  type: IrType,
  memberName: string,
  site?: Site
): IrType => {
  const addUndefinedToTypeLocal = (t: IrType): IrType => {
    const undefinedType: IrType = {
      kind: "primitiveType",
      name: "undefined",
    };
    if (t.kind === "unionType") {
      const hasUndefined = t.types.some(
        (x) => x.kind === "primitiveType" && x.name === "undefined"
      );
      return hasUndefined ? t : { ...t, types: [...t.types, undefinedType] };
    }
    return { kind: "unionType", types: [t, undefinedType] };
  };

  if (type.kind === "objectType") {
    const member = type.members.find((m) => m.name === memberName);
    if (member) {
      if (member.kind === "propertySignature") {
        return member.isOptional
          ? addUndefinedToTypeLocal(member.type)
          : member.type;
      }
      // Method signature - return function type using the same parameters
      if (member.kind === "methodSignature") {
        const typeParameters = member.typeParameters;
        const funcType: IrFunctionType = {
          kind: "functionType",
          ...(typeParameters ? { typeParameters } : {}),
          parameters: member.parameters,
          returnType: member.returnType ?? voidType,
        };
        return funcType;
      }
    }
  }
  if (
    type.kind === "referenceType" &&
    type.structuralMembers &&
    type.structuralMembers.length > 0
  ) {
    const member = type.structuralMembers.find((m) => m.name === memberName);
    if (member) {
      if (member.kind === "propertySignature") {
        return member.isOptional
          ? addUndefinedToTypeLocal(member.type)
          : member.type;
      }
      if (member.kind === "methodSignature") {
        const typeParameters = member.typeParameters;
        const funcType: IrFunctionType = {
          kind: "functionType",
          ...(typeParameters ? { typeParameters } : {}),
          parameters: member.parameters,
          returnType: member.returnType ?? voidType,
        };
        return funcType;
      }
    }
  }
  if (site) {
    emitDiagnostic(
      state,
      "TSN5203",
      `Member '${memberName}' not found on structural type`,
      site
    );
  }
  return unknownType;
};
