import type { IrType } from "../types/index.js";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import { computeReceiverSubstitution } from "./call-resolution-signatures.js";
import {
  substitutePolymorphicThis,
} from "./call-resolution-utilities.js";
import type {
  RawSignatureInfo,
  ResolvedCall,
  TypeSystemState,
} from "./type-system-state.js";

type WorkingPredicate = ResolvedCall["typePredicate"];

type WorkingSignature = {
  readonly workingParams: (IrType | undefined)[];
  readonly workingThisParam: IrType | undefined;
  readonly workingReturn: IrType;
  readonly workingPredicate: WorkingPredicate;
};

const collectTypeParameterNames = (
  type: IrType | undefined,
  acc: Set<string>
): void => {
  if (!type) return;

  switch (type.kind) {
    case "typeParameterType":
      acc.add(type.name);
      return;
    case "arrayType":
      collectTypeParameterNames(type.elementType, acc);
      return;
    case "tupleType":
      for (const element of type.elementTypes) {
        collectTypeParameterNames(element, acc);
      }
      return;
    case "dictionaryType":
      collectTypeParameterNames(type.keyType, acc);
      collectTypeParameterNames(type.valueType, acc);
      return;
    case "referenceType":
      for (const argument of type.typeArguments ?? []) {
        collectTypeParameterNames(argument, acc);
      }
      for (const member of type.structuralMembers ?? []) {
        if (member.kind === "propertySignature") {
          collectTypeParameterNames(member.type, acc);
        } else {
          for (const parameter of member.parameters) {
            collectTypeParameterNames(parameter.type, acc);
          }
          collectTypeParameterNames(member.returnType, acc);
        }
      }
      return;
    case "unionType":
    case "intersectionType":
      for (const member of type.types) {
        collectTypeParameterNames(member, acc);
      }
      return;
    case "functionType":
      for (const parameter of type.parameters) {
        collectTypeParameterNames(parameter.type, acc);
      }
      collectTypeParameterNames(type.returnType, acc);
      return;
    default:
      return;
  }
};

const collectReceiverGenericNames = (
  rawSig: RawSignatureInfo,
  signature: WorkingSignature
): Set<string> => {
  const names = new Set<string>();
  for (const parameter of signature.workingParams) {
    collectTypeParameterNames(parameter, names);
  }
  collectTypeParameterNames(signature.workingThisParam, names);
  collectTypeParameterNames(signature.workingReturn, names);
  if (signature.workingPredicate) {
    collectTypeParameterNames(signature.workingPredicate.targetType, names);
  }
  for (const methodTp of rawSig.typeParameters) {
    names.delete(methodTp.name);
  }
  return names;
};

export const applyReceiverSubstitution = (
  state: TypeSystemState,
  rawSig: RawSignatureInfo,
  effectiveReceiverType: IrType | undefined,
  signature: WorkingSignature
): WorkingSignature => {
  let {
    workingParams,
    workingThisParam,
    workingReturn,
    workingPredicate,
  } = signature;

  if (
    effectiveReceiverType &&
    rawSig.declaringTypeTsName &&
    rawSig.declaringMemberName
  ) {
    let receiverSubst = computeReceiverSubstitution(
      state,
      effectiveReceiverType,
      rawSig.declaringTypeTsName,
      rawSig.declaringMemberName,
      rawSig.declaringTypeParameterNames
    );

    if (
      (!receiverSubst || receiverSubst.size === 0) &&
      effectiveReceiverType.kind === "arrayType"
    ) {
      const receiverGenericNames = collectReceiverGenericNames(rawSig, {
        workingParams,
        workingThisParam,
        workingReturn,
        workingPredicate,
      });
      if (receiverGenericNames.size === 1) {
        const [only] = receiverGenericNames;
        if (only) {
          receiverSubst = new Map<string, IrType>([
            [only, effectiveReceiverType.elementType],
          ]);
        }
      }
    }

    if (receiverSubst && receiverSubst.size > 0) {
      workingParams = workingParams.map((parameter) =>
        parameter ? irSubstitute(parameter, receiverSubst) : undefined
      );
      if (workingThisParam) {
        workingThisParam = irSubstitute(workingThisParam, receiverSubst);
      }
      workingReturn = irSubstitute(workingReturn, receiverSubst);
      if (workingPredicate) {
        workingPredicate = {
          ...workingPredicate,
          targetType: irSubstitute(
            workingPredicate.targetType,
            receiverSubst as IrSubstitutionMap
          ),
        };
      }
    }
  }

  if (effectiveReceiverType) {
    workingParams = workingParams.map((parameter) =>
      parameter
        ? (substitutePolymorphicThis(parameter, effectiveReceiverType) ??
          parameter)
        : undefined
    );
    if (workingThisParam) {
      workingThisParam =
        substitutePolymorphicThis(workingThisParam, effectiveReceiverType) ??
        workingThisParam;
    }
    workingReturn =
      substitutePolymorphicThis(workingReturn, effectiveReceiverType) ??
      workingReturn;
    if (workingPredicate) {
      workingPredicate = {
        ...workingPredicate,
        targetType:
          substitutePolymorphicThis(
            workingPredicate.targetType,
            effectiveReceiverType
          ) ?? workingPredicate.targetType,
      };
    }
  }

  return {
    workingParams,
    workingThisParam,
    workingReturn,
    workingPredicate,
  };
};
