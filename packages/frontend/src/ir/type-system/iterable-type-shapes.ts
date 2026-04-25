import type { IrType } from "../types/index.js";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import {
  createLocalTypeIdentityState,
  localTypeIdentityKey,
} from "../types/type-ops.js";
import type { TypeSystemState } from "./type-system-state.js";
import { normalizeToNominal } from "./type-system-state.js";

export type IterableShape = {
  readonly mode: "sync" | "async";
  readonly elementType: IrType;
};

const iterableVisitKeyState = createLocalTypeIdentityState();

const iterableVisitKey = (type: IrType): string => {
  return localTypeIdentityKey(type, iterableVisitKeyState);
};

const SYNC_ITERABLE_TS_NAMES = new Set([
  "Array",
  "ReadonlyArray",
  "Iterable",
  "IterableIterator",
  "Iterator",
  "Generator",
  "Set",
  "ReadonlySet",
  "Map",
  "ReadonlyMap",
  "IEnumerable",
  "IEnumerable_1",
]);

const ASYNC_ITERABLE_TS_NAMES = new Set([
  "AsyncIterable",
  "AsyncIterableIterator",
  "AsyncGenerator",
  "IAsyncEnumerable",
  "IAsyncEnumerable_1",
]);

const normalizeIterableOperand = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  if (type.kind === "unionType") {
    const nonNullish = type.types.filter(
      (part) =>
        !(
          part.kind === "primitiveType" &&
          (part.name === "null" || part.name === "undefined")
        )
    );
    if (nonNullish.length === 1) {
      return nonNullish[0];
    }
  }

  if (type.kind === "intersectionType") {
    const preferred =
      type.types.find((part) => part.kind === "arrayType") ??
      type.types.find((part) => part.kind === "tupleType") ??
      type.types.find((part) => {
        if (part.kind !== "referenceType") return false;
        return !part.name.endsWith("$views");
      });
    return preferred ?? type;
  }

  return type;
};

const deriveTupleIterationElementType = (
  elementTypes: readonly IrType[]
): IrType | undefined => {
  if (elementTypes.length === 0) {
    return undefined;
  }
  if (elementTypes.length === 1) {
    return elementTypes[0];
  }
  return {
    kind: "unionType",
    types: [...elementTypes],
  };
};

const getReferenceTypeNames = (
  state: TypeSystemState,
  type: Extract<IrType, { kind: "referenceType" }>
): { readonly tsName: string; readonly clrName: string | undefined } => {
  const normalized = normalizeToNominal(state, type);
  const entry = normalized
    ? state.unifiedCatalog.getByTypeId(normalized.typeId)
    : undefined;

  return {
    tsName: entry?.typeId.tsName ?? normalized?.typeId.tsName ?? type.name,
    clrName:
      entry?.typeId.clrName ??
      normalized?.typeId.clrName ??
      type.typeId?.clrName ??
      type.resolvedClrType,
  };
};

const normalizeIterableTypeName = (
  name: string | undefined
): string | undefined => name?.replace(/\$instance$/, "");

const tryGetKnownReferenceIterableShape = (
  state: TypeSystemState,
  type: Extract<IrType, { kind: "referenceType" }>
): IterableShape | undefined => {
  const { tsName, clrName } = getReferenceTypeNames(state, type);
  const normalizedTsName = normalizeIterableTypeName(tsName);
  const clrBaseName = normalizeIterableTypeName(
    clrName?.split(".").pop()?.replace(/`1$/, "")
  );
  const firstTypeArg = type.typeArguments?.[0];
  const secondTypeArg = type.typeArguments?.[1];

  if (
    (SYNC_ITERABLE_TS_NAMES.has(normalizedTsName ?? "") ||
      clrBaseName === "IEnumerable") &&
    firstTypeArg
  ) {
    if (normalizedTsName === "Map" || normalizedTsName === "ReadonlyMap") {
      return firstTypeArg && secondTypeArg
        ? {
            mode: "sync",
            elementType: {
              kind: "tupleType",
              elementTypes: [firstTypeArg, secondTypeArg],
            },
          }
        : undefined;
    }

    return {
      mode: "sync",
      elementType: firstTypeArg,
    };
  }

  if (
    (ASYNC_ITERABLE_TS_NAMES.has(normalizedTsName ?? "") ||
      clrBaseName === "IAsyncEnumerable") &&
    firstTypeArg
  ) {
    return {
      mode: "async",
      elementType: firstTypeArg,
    };
  }

  return undefined;
};

const resolveNominalMemberReturnTypes = (
  state: TypeSystemState,
  type: Extract<IrType, { kind: "referenceType" }>,
  memberName: string
): readonly IrType[] => {
  const normalized = normalizeToNominal(state, type);
  if (!normalized) {
    return [];
  }

  const lookupResult = state.nominalEnv.findMemberDeclaringType(
    normalized.typeId,
    normalized.typeArgs,
    memberName
  );
  if (!lookupResult) {
    return [];
  }

  const memberEntry = state.unifiedCatalog.getMember(
    lookupResult.declaringTypeId,
    memberName
  );
  if (!memberEntry) {
    return [];
  }

  const substituteType = (candidate: IrType | undefined): IrType | undefined =>
    candidate
      ? irSubstitute(candidate, lookupResult.substitution as IrSubstitutionMap)
      : undefined;

  const result: IrType[] = [];
  const propertyType = substituteType(memberEntry.type);
  if (propertyType) {
    result.push(propertyType);
  }

  for (const signature of memberEntry.signatures ?? []) {
    const returnType = substituteType(signature.returnType);
    if (returnType) {
      result.push(returnType);
    }
  }

  return result;
};

const resolveStructuralMemberReturnTypes = (
  type: Extract<IrType, { kind: "referenceType" }>,
  memberName: string
): readonly IrType[] => {
  const result: IrType[] = [];

  for (const member of type.structuralMembers ?? []) {
    if (member.kind === "propertySignature" && member.name === memberName) {
      result.push(member.type);
      continue;
    }

    if (
      member.kind === "methodSignature" &&
      member.name === memberName &&
      member.parameters.length === 0 &&
      member.returnType
    ) {
      result.push(member.returnType);
    }
  }

  return result;
};

export const getIterableShape = (
  state: TypeSystemState,
  type: IrType | undefined,
  visited: ReadonlySet<string> = new Set<string>()
): IterableShape | undefined => {
  const normalized = normalizeIterableOperand(type);
  if (!normalized) {
    return undefined;
  }

  const visitKey = iterableVisitKey(normalized);
  if (visited.has(visitKey)) {
    return undefined;
  }
  const nextVisited = new Set(visited);
  nextVisited.add(visitKey);

  if (normalized.kind === "arrayType") {
    return {
      mode: "sync",
      elementType: normalized.elementType,
    };
  }

  if (normalized.kind === "tupleType") {
    const elementType = deriveTupleIterationElementType(
      normalized.elementTypes
    );
    return elementType
      ? {
          mode: "sync",
          elementType,
        }
      : undefined;
  }

  if (normalized.kind !== "referenceType") {
    return undefined;
  }

  const knownShape = tryGetKnownReferenceIterableShape(state, normalized);
  if (knownShape) {
    return knownShape;
  }

  for (const returnType of resolveStructuralMemberReturnTypes(
    normalized,
    "[symbol:iterator]"
  )) {
    const nested = getIterableShape(state, returnType, nextVisited);
    if (nested) {
      return {
        mode: "sync",
        elementType: nested.elementType,
      };
    }
  }

  for (const returnType of resolveNominalMemberReturnTypes(
    state,
    normalized,
    "[symbol:iterator]"
  )) {
    const nested = getIterableShape(state, returnType, nextVisited);
    if (nested) {
      return {
        mode: "sync",
        elementType: nested.elementType,
      };
    }
  }

  for (const returnType of resolveStructuralMemberReturnTypes(
    normalized,
    "[symbol:asyncIterator]"
  )) {
    const nested = getIterableShape(state, returnType, nextVisited);
    if (nested) {
      return {
        mode: "async",
        elementType: nested.elementType,
      };
    }
  }

  for (const returnType of resolveNominalMemberReturnTypes(
    state,
    normalized,
    "[symbol:asyncIterator]"
  )) {
    const nested = getIterableShape(state, returnType, nextVisited);
    if (nested) {
      return {
        mode: "async",
        elementType: nested.elementType,
      };
    }
  }

  return undefined;
};
