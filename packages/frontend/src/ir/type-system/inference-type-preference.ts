import type { IrInterfaceMember, IrType } from "../types/index.js";

type TypeRelations = {
  readonly typesEqual: (left: IrType, right: IrType) => boolean;
  readonly isAssignableTo: (source: IrType, target: IrType) => boolean;
};

const scoreMemberIdentity = (
  member: IrInterfaceMember,
  seen: WeakSet<object>
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
  seen: WeakSet<object> = new WeakSet<object>()
): number => (type ? scoreTypeIdentity(type, seen) : 0);

const scoreTypeIdentity = (
  type: IrType,
  seen: WeakSet<object> = new WeakSet<object>()
): number => {
  if (seen.has(type)) {
    return 0;
  }

  seen.add(type);

  try {
    switch (type.kind) {
      case "referenceType":
        return (
          100 +
          (type.typeId ? 40 : 0) +
          (type.resolvedClrType ? 20 : 0) +
          (type.typeArguments?.reduce(
            (total, member) => total + scoreTypeIdentity(member, seen),
            0
          ) ?? 0) +
          (type.structuralMembers?.reduce(
            (total, member) => total + scoreMemberIdentity(member, seen),
            0
          ) ?? 0)
        );
      case "functionType":
        return (
          70 +
          type.parameters.reduce(
            (total, parameter) =>
              total + scoreOptionalTypeIdentity(parameter.type, seen),
            scoreOptionalTypeIdentity(type.returnType, seen)
          )
        );
      case "tupleType":
        return (
          60 +
          type.elementTypes.reduce(
            (total, elementType) =>
              total + scoreTypeIdentity(elementType, seen),
            0
          )
        );
      case "arrayType":
        return 55 + scoreTypeIdentity(type.elementType, seen);
      case "dictionaryType":
        return (
          55 +
          scoreTypeIdentity(type.keyType, seen) +
          scoreTypeIdentity(type.valueType, seen)
        );
      case "intersectionType":
        return (
          50 +
          type.types.reduce(
            (total, member) => total + scoreTypeIdentity(member, seen),
            0
          )
        );
      case "unionType":
        return (
          45 +
          type.types.reduce(
            (total, member) => total + scoreTypeIdentity(member, seen),
            0
          )
        );
      case "objectType":
        return (
          40 +
          type.members.reduce(
            (total, member) => total + scoreMemberIdentity(member, seen),
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
  } finally {
    seen.delete(type);
  }
};

export const areEquivalentInferenceTypes = (
  relations: TypeRelations,
  left: IrType,
  right: IrType
): boolean =>
  relations.typesEqual(left, right) ||
  (relations.isAssignableTo(left, right) &&
    relations.isAssignableTo(right, left));

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
