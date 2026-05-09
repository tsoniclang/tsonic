import type { IrType } from "../../../types/index.js";
import type { IrInterfaceMember, IrParameter } from "../../../types/helpers.js";
import { stableIrTypeKeyIfDeterministic } from "../../../types/type-ops.js";
import type { HeritageEdge } from "./types.js";

const heritageKindRank = (kind: HeritageEdge["kind"]): number =>
  kind === "extends" ? 0 : 1;

type HeritageKeyState = {
  readonly active: WeakMap<object, number>;
  nextCycleId: number;
};

const createHeritageKeyState = (): HeritageKeyState => ({
  active: new WeakMap<object, number>(),
  nextCycleId: 0,
});

const fallbackReferenceTypeKey = (
  type: Extract<IrType, { kind: "referenceType" }>,
  state: HeritageKeyState
): string => {
  if (type.structuralMembers && type.structuralMembers.length > 0) {
    throw new Error(
      `Cannot build heritage edge key for structural identity-less reference type '${type.name}'`
    );
  }

  const args = (type.typeArguments ?? [])
    .map((typeArgument) => heritageTypeArgumentKey(typeArgument, state))
    .join(",");
  return `unresolved-ref:${type.name}/${type.typeArguments?.length ?? 0}<${args}>`;
};

const orderedTypeListKey = (
  prefix: string,
  types: readonly IrType[],
  state: HeritageKeyState
): string =>
  `${prefix}:${types
    .map((type) => heritageTypeArgumentKey(type, state))
    .sort()
    .join("|")}`;

const parameterKey = (
  parameter: IrParameter,
  state: HeritageKeyState
): string => {
  const patternKey =
    parameter.pattern.kind === "identifierPattern"
      ? `id:${parameter.pattern.name}`
      : parameter.pattern.kind;
  const typeKey = parameter.type
    ? heritageTypeArgumentKey(parameter.type, state)
    : "none";
  return [
    patternKey,
    typeKey,
    parameter.isOptional ? "optional" : "required",
    parameter.isRest ? "rest" : "single",
    parameter.passing,
    parameter.isExtensionReceiver ? "extension" : "ordinary",
  ].join(":");
};

const interfaceMemberKey = (
  member: IrInterfaceMember,
  state: HeritageKeyState
): string => {
  if (member.kind === "propertySignature") {
    return [
      "prop",
      member.name,
      heritageTypeArgumentKey(member.type, state),
      member.isOptional ? "optional" : "required",
      member.isReadonly ? "readonly" : "mutable",
    ].join(":");
  }

  return [
    "method",
    member.name,
    (member.typeParameters ?? [])
      .map((typeParameter) =>
        [
          typeParameter.name,
          typeParameter.constraint
            ? heritageTypeArgumentKey(typeParameter.constraint, state)
            : "none",
          typeParameter.default
            ? heritageTypeArgumentKey(typeParameter.default, state)
            : "none",
          typeParameter.variance ?? "invariant",
          typeParameter.isStructuralConstraint ? "structural" : "nominal",
        ].join(":")
      )
      .join(","),
    member.parameters
      .map((parameter) => parameterKey(parameter, state))
      .join(","),
    member.returnType
      ? heritageTypeArgumentKey(member.returnType, state)
      : "void",
  ].join(":");
};

const heritageTypeArgumentKey = (
  type: IrType,
  state: HeritageKeyState
): string => {
  const stableKey = stableIrTypeKeyIfDeterministic(type);
  if (stableKey) return stableKey;

  const existingCycleId = state.active.get(type);
  if (existingCycleId !== undefined) {
    return `cycle:${existingCycleId}`;
  }

  const cycleId = state.nextCycleId;
  state.nextCycleId += 1;
  state.active.set(type, cycleId);

  try {
  switch (type.kind) {
    case "arrayType":
      return `arr:${heritageTypeArgumentKey(type.elementType, state)}:tuple:${(
        type.tuplePrefixElementTypes ?? []
      )
        .map((elementType) => heritageTypeArgumentKey(elementType, state))
        .join(",")}:rest:${
        type.tupleRestElementType
          ? heritageTypeArgumentKey(type.tupleRestElementType, state)
          : "none"
      }`;

    case "tupleType":
      return `tuple:${type.elementTypes
        .map((elementType) => heritageTypeArgumentKey(elementType, state))
        .join(",")}`;

    case "dictionaryType":
      return `dict:${heritageTypeArgumentKey(type.keyType, state)}=>${heritageTypeArgumentKey(type.valueType, state)}`;

    case "referenceType":
      return fallbackReferenceTypeKey(type, state);

    case "functionType":
      return `fn:${type.parameters
        .map((parameter) => parameterKey(parameter, state))
        .join("|")}->${heritageTypeArgumentKey(type.returnType, state)}`;

    case "objectType":
      return `obj:${type.members
        .map((member) => interfaceMemberKey(member, state))
        .sort()
        .join("|")}`;

    case "unionType":
      return orderedTypeListKey("union", type.types, state);

    case "intersectionType":
      return orderedTypeListKey("inter", type.types, state);

    case "primitiveType":
    case "literalType":
    case "typeParameterType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      throw new Error(
        `Cannot build deterministic heritage edge key for stable type kind '${type.kind}'`
      );
  }
  } finally {
    state.active.delete(type);
  }
};

export const heritageEdgeKey = (edge: HeritageEdge): string => {
  const state = createHeritageKeyState();
  const typeArgumentKey = edge.typeArguments
    .map((typeArgument) => heritageTypeArgumentKey(typeArgument, state))
    .join(",");
  return `${edge.kind}|${edge.targetStableId}|${typeArgumentKey}`;
};

export const compareHeritageEdges = (
  left: HeritageEdge,
  right: HeritageEdge
): number => {
  const leftRank = heritageKindRank(left.kind);
  const rightRank = heritageKindRank(right.kind);
  if (leftRank !== rightRank) return leftRank - rightRank;

  const target = left.targetStableId.localeCompare(right.targetStableId);
  if (target !== 0) return target;

  return heritageEdgeKey(left).localeCompare(heritageEdgeKey(right));
};
