import type { IrInterfaceMember, IrType } from "../types/index.js";
import { stableIrTypeKeyIfDeterministic } from "../types/type-ops.js";

type TypeRelations = {
  readonly typesEqual: (left: IrType, right: IrType) => boolean;
  readonly isAssignableTo: (source: IrType, target: IrType) => boolean;
};

const inferenceOpaqueTypeIds = new WeakMap<object, number>();
let nextInferenceOpaqueTypeId = 0;

const scoreMemberIdentity = (
  member: IrInterfaceMember,
  seen: ReadonlySet<string>
): number => {
  if (member.kind === "propertySignature") {
    return 2 + scoreTypeIdentity(member.type, seen);
  }

  return (
    3 +
    member.parameters.reduce(
      (total, parameter) =>
        total + scoreOptionalTypeIdentity(parameter.type, seen),
      scoreOptionalTypeIdentity(member.returnType, seen)
    )
  );
};

const scoreOptionalTypeIdentity = (
  type: IrType | undefined,
  seen: ReadonlySet<string> = new Set<string>()
): number => (type ? scoreTypeIdentity(type, seen) : 0);

const scoreTypeIdentity = (
  type: IrType,
  seen: ReadonlySet<string> = new Set<string>()
): number => {
  const stableKey = stableIrTypeKeyIfDeterministic(type);
  const typeKey =
    stableKey ??
    (() => {
      const existing = inferenceOpaqueTypeIds.get(type);
      if (existing !== undefined) return `opaque:${existing}`;
      const next = nextInferenceOpaqueTypeId;
      nextInferenceOpaqueTypeId += 1;
      inferenceOpaqueTypeIds.set(type, next);
      return `opaque:${next}`;
    })();
  if (seen.has(typeKey)) {
    return 0;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(typeKey);

  switch (type.kind) {
    case "referenceType":
      return (
        100 +
        (type.typeId ? 40 : 0) +
        (type.resolvedClrType ? 20 : 0) +
        (type.typeArguments?.reduce(
          (total, member) => total + scoreTypeIdentity(member, nextSeen),
          0
        ) ?? 0) +
        (type.structuralMembers?.reduce(
          (total, member) => total + scoreMemberIdentity(member, nextSeen),
          0
        ) ?? 0)
      );
    case "functionType":
      return (
        70 +
        type.parameters.reduce(
          (total, parameter) =>
            total + scoreOptionalTypeIdentity(parameter.type, nextSeen),
          scoreOptionalTypeIdentity(type.returnType, nextSeen)
        )
      );
    case "tupleType":
      return (
        60 +
        type.elementTypes.reduce(
          (total, elementType) => total + scoreTypeIdentity(elementType, nextSeen),
          0
        )
      );
    case "arrayType":
      return 55 + scoreTypeIdentity(type.elementType, nextSeen);
    case "dictionaryType":
      return (
        55 +
        scoreTypeIdentity(type.keyType, nextSeen) +
        scoreTypeIdentity(type.valueType, nextSeen)
      );
    case "intersectionType":
      return (
        50 +
        type.types.reduce(
          (total, member) => total + scoreTypeIdentity(member, nextSeen),
          0
        )
      );
    case "unionType":
      return (
        45 +
        type.types.reduce(
          (total, member) => total + scoreTypeIdentity(member, nextSeen),
          0
        )
      );
    case "objectType":
      return (
        40 +
        type.members.reduce(
          (total, member) => total + scoreMemberIdentity(member, nextSeen),
          0
        )
      );
    case "typeParameterType":
      return 20;
    case "literalType":
      return 15;
    case "primitiveType":
      return 10;
    default:
      return 5;
  }
};

export const areEquivalentInferenceTypes = (
  relations: TypeRelations,
  left: IrType,
  right: IrType
): boolean =>
  relations.typesEqual(left, right) ||
  (relations.isAssignableTo(left, right) && relations.isAssignableTo(right, left));

export const choosePreferredEquivalentInferenceType = (
  relations: TypeRelations,
  existing: IrType,
  next: IrType
): IrType | undefined => {
  if (!areEquivalentInferenceTypes(relations, existing, next)) {
    return undefined;
  }

  const existingScore = scoreTypeIdentity(existing);
  const nextScore = scoreTypeIdentity(next);

  return nextScore > existingScore ? next : existing;
};
