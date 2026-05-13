import type { IrInterfaceMember, IrType } from "../types/index.js";

type TypeRelations = {
  readonly typesEqual: (left: IrType, right: IrType) => boolean;
  readonly isAssignableTo: (source: IrType, target: IrType) => boolean;
};

type TypeIdentityScoreState = {
  readonly typeScores: WeakMap<object, number>;
  readonly memberScores: WeakMap<object, number>;
  readonly activeTypes: WeakSet<object>;
};

const maxIdentityScore = 1_000_000;

const createTypeIdentityScoreState = (): TypeIdentityScoreState => ({
  typeScores: new WeakMap<object, number>(),
  memberScores: new WeakMap<object, number>(),
  activeTypes: new WeakSet<object>(),
});

const addIdentityScores = (
  initial: number,
  values: readonly number[]
): number =>
  values.reduce(
    (total, value) => Math.min(maxIdentityScore, total + value),
    initial
  );

const scoreMemberIdentity = (
  member: IrInterfaceMember,
  state: TypeIdentityScoreState
): number => {
  const cached = state.memberScores.get(member);
  if (cached !== undefined) {
    return cached;
  }

  const score =
    member.kind === "propertySignature"
      ? addIdentityScores(2, [scoreTypeIdentity(member.type, state)])
      : addIdentityScores(3, [
          scoreOptionalTypeIdentity(member.returnType, state),
          ...member.parameters.map((parameter) =>
            scoreOptionalTypeIdentity(parameter.type, state)
          ),
        ]);

  state.memberScores.set(member, score);
  return score;
};

const scoreOptionalTypeIdentity = (
  type: IrType | undefined,
  state: TypeIdentityScoreState = createTypeIdentityScoreState()
): number => (type ? scoreTypeIdentity(type, state) : 0);

const scoreTypeIdentity = (
  type: IrType,
  state: TypeIdentityScoreState = createTypeIdentityScoreState()
): number => {
  const cached = state.typeScores.get(type);
  if (cached !== undefined) {
    return cached;
  }

  if (state.activeTypes.has(type)) {
    return 0;
  }

  state.activeTypes.add(type);

  try {
    let score: number;
    switch (type.kind) {
      case "referenceType": {
        score = addIdentityScores(100, [
          (type.typeId ? 40 : 0) +
            (type.resolvedClrType ? 20 : 0),
          ...(type.typeArguments ?? []).map((member) =>
            scoreTypeIdentity(member, state)
          ),
          ...(type.structuralMembers ?? []).map((member) =>
            scoreMemberIdentity(member, state)
          ),
        ]);
        break;
      }
      case "functionType":
        score = addIdentityScores(70, [
          scoreOptionalTypeIdentity(type.returnType, state),
          ...type.parameters.map((parameter) =>
            scoreOptionalTypeIdentity(parameter.type, state)
          ),
        ]);
        break;
      case "tupleType":
        score = addIdentityScores(
          60,
          type.elementTypes.map((elementType) =>
            scoreTypeIdentity(elementType, state)
          )
        );
        break;
      case "arrayType":
        score = addIdentityScores(55, [
          scoreTypeIdentity(type.elementType, state),
        ]);
        break;
      case "dictionaryType":
        score = addIdentityScores(55, [
          scoreTypeIdentity(type.keyType, state),
          scoreTypeIdentity(type.valueType, state),
        ]);
        break;
      case "intersectionType":
        score = addIdentityScores(
          50,
          type.types.map((member) => scoreTypeIdentity(member, state))
        );
        break;
      case "unionType":
        score = addIdentityScores(
          45,
          type.types.map((member) => scoreTypeIdentity(member, state))
        );
        break;
      case "objectType":
        score = addIdentityScores(
          40,
          type.members.map((member) => scoreMemberIdentity(member, state))
        );
        break;
      case "typeParameterType":
        score = 20;
        break;
      case "literalType":
        score = 15;
        break;
      case "primitiveType":
        score = 10;
        break;
      default:
        score = 5;
        break;
    }
    state.typeScores.set(type, score);
    return score;
  } finally {
    state.activeTypes.delete(type);
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
