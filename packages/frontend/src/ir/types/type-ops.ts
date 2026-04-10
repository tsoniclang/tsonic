import type { IrInterfaceMember, IrParameter } from "./helpers.js";
import type { IrType } from "./ir-types.js";

export type IrSpreadTupleShape = {
  readonly prefixElementTypes: readonly IrType[];
  readonly restElementType?: IrType;
};

type StableTypeKeyState = {
  readonly seen: Map<object, number>;
  readonly keys: Map<object, string>;
  readonly parent?: StableTypeKeyState;
  nextId: number;
};

const createStableTypeKeyState = (): StableTypeKeyState => ({
  seen: new Map<object, number>(),
  keys: new Map<object, string>(),
  nextId: 0,
});

const cloneStableTypeKeyState = (
  state: StableTypeKeyState
): StableTypeKeyState => ({
  seen: new Map<object, number>(),
  keys: state.keys,
  parent: state,
  nextId: state.nextId,
});

const findStableTypeNodeId = (
  state: StableTypeKeyState,
  node: object
): number | undefined => {
  const local = state.seen.get(node);
  if (local !== undefined) {
    return local;
  }

  return state.parent ? findStableTypeNodeId(state.parent, node) : undefined;
};

const findStableTypeKey = (
  state: StableTypeKeyState,
  node: object
): string | undefined => {
  const local = state.keys.get(node);
  if (local !== undefined) {
    return local;
  }

  return state.parent ? findStableTypeKey(state.parent, node) : undefined;
};

const beginStableTypeNode = (
  state: StableTypeKeyState,
  node: object
): { readonly id: number; readonly seenBefore: boolean } => {
  const existing = findStableTypeNodeId(state, node);
  if (existing !== undefined) {
    return { id: existing, seenBefore: true };
  }

  const id = state.nextId;
  state.nextId += 1;
  state.seen.set(node, id);
  return { id, seenBefore: false };
};

const sortByStableKey = <T>(
  values: readonly T[],
  getKey: (value: T, state: StableTypeKeyState) => string,
  state: StableTypeKeyState
): readonly T[] => {
  const keyed = values.map((value, index) => ({
    value,
    index,
    key: getKey(value, cloneStableTypeKeyState(state)),
  }));

  keyed.sort((left, right) => {
    const byKey = left.key.localeCompare(right.key);
    return byKey !== 0 ? byKey : left.index - right.index;
  });

  return keyed.map((entry) => entry.value);
};

const primitiveKey = (
  type: Extract<
    IrType,
    | { kind: "primitiveType" }
    | { kind: "literalType" }
    | { kind: "typeParameterType" }
    | { kind: "anyType" }
    | { kind: "unknownType" }
    | { kind: "voidType" }
    | { kind: "neverType" }
  >
): string => {
  switch (type.kind) {
    case "primitiveType":
      return `prim:${type.name}`;
    case "literalType":
      return `lit:${JSON.stringify(type.value)}`;
    case "typeParameterType":
      return `tp:${type.name}`;
    case "anyType":
      return "any";
    case "unknownType":
      return "unknown";
    case "voidType":
      return "void";
    case "neverType":
      return "never";
  }
};

const parameterKey = (
  param: IrParameter,
  state: StableTypeKeyState
): string => {
  const mode = param.passing ?? "value";
  const type = param.type ? stableIrTypeKeyImpl(param.type, state) : "unknown";
  return `p:${param.isRest ? 1 : 0}:${param.isOptional ? 1 : 0}:${mode}:${type}`;
};

const interfaceMemberKey = (
  member: IrInterfaceMember,
  state: StableTypeKeyState
): string => {
  if (member.kind === "propertySignature") {
    return `prop:${member.name}:${member.isReadonly ? 1 : 0}:${member.isOptional ? 1 : 0}:${stableIrTypeKeyImpl(member.type, state)}`;
  }

  const typeParamCount = member.typeParameters?.length ?? 0;
  const parameters = member.parameters
    .map((parameter) => parameterKey(parameter, state))
    .join("|");
  const returnType = member.returnType
    ? stableIrTypeKeyImpl(member.returnType, state)
    : "void";
  return `method:${member.name}:${typeParamCount}:${parameters}:${returnType}`;
};

const normalizeTypeList = (
  types: readonly IrType[],
  state: StableTypeKeyState
): readonly IrType[] => sortByStableKey(types, stableIrTypeKeyImpl, state);

const isRuntimeNullishMember = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "null" || type.name === "undefined");

const collectCanonicalRuntimeUnionFamilyMembers = (
  type: Extract<IrType, { kind: "unionType" }>
): readonly IrType[] => {
  const flattened: IrType[] = [];

  const visit = (candidate: IrType): void => {
    if (isRuntimeNullishMember(candidate)) {
      return;
    }

    if (candidate.kind === "unionType") {
      for (const member of candidate.types) {
        visit(member);
      }
      return;
    }

    flattened.push(candidate);
  };

  for (const member of type.types) {
    visit(member);
  }

  if (type.preserveRuntimeLayout) {
    return flattened;
  }

  const deduped = new Map<string, IrType>();
  for (const member of flattened) {
    deduped.set(stableIrTypeKey(member), member);
  }

  return normalizeTypeList(
    Array.from(deduped.values()),
    createStableTypeKeyState()
  );
};

export const referenceTypeIdentity = (
  type: Extract<IrType, { kind: "referenceType" }>
): string =>
  type.typeId?.stableId
    ? `id:${type.typeId.stableId}`
    : type.resolvedClrType
      ? `clr:${type.resolvedClrType}`
      : `name:${type.name}`;

const getReferenceTypeAsyncWrapperKind = (
  type: Extract<IrType, { kind: "referenceType" }>
): "generic" | "nongeneric" | undefined => {
  const simpleName = type.name.split(".").pop() ?? type.name;
  const clrName = (type.resolvedClrType ?? type.name).replace(/^global::/, "");
  const typeArgumentCount = type.typeArguments?.length ?? 0;

  const isPromiseLike =
    simpleName === "Promise" || simpleName === "PromiseLike";
  if (isPromiseLike) {
    return typeArgumentCount === 1 ? "generic" : undefined;
  }

  const isTaskLike =
    simpleName === "Task" ||
    simpleName === "ValueTask" ||
    simpleName === "Task_1" ||
    simpleName === "Task`1" ||
    simpleName === "ValueTask_1" ||
    simpleName === "ValueTask`1" ||
    clrName === "System.Threading.Tasks.Task" ||
    clrName === "System.Threading.Tasks.ValueTask" ||
    clrName.startsWith("System.Threading.Tasks.Task`1") ||
    clrName.startsWith("System.Threading.Tasks.ValueTask`1");
  if (isTaskLike) {
    if (typeArgumentCount === 1) {
      return "generic";
    }
    return "nongeneric";
  }

  return undefined;
};

export const isAwaitableIrType = (type: IrType): boolean =>
  type.kind === "referenceType" &&
  getReferenceTypeAsyncWrapperKind(type) !== undefined;

export const getAwaitedIrType = (type: IrType): IrType | undefined => {
  if (type.kind !== "referenceType") return undefined;

  const wrapperKind = getReferenceTypeAsyncWrapperKind(type);
  if (!wrapperKind) return undefined;
  if (wrapperKind === "nongeneric") {
    return { kind: "voidType" };
  }

  const inner = type.typeArguments?.[0];
  return inner;
};

export const unwrapAsyncWrapperType = (type: IrType): IrType | undefined => {
  const awaited = getAwaitedIrType(type);
  return awaited?.kind === "voidType" ? undefined : awaited;
};

export const getSpreadTupleShape = (
  type: IrType
): IrSpreadTupleShape | undefined => {
  if (type.kind === "tupleType") {
    return {
      prefixElementTypes: type.elementTypes,
    };
  }

  if (
    type.kind === "arrayType" &&
    ((type.tuplePrefixElementTypes?.length ?? 0) > 0 ||
      type.tupleRestElementType !== undefined)
  ) {
    return {
      prefixElementTypes: type.tuplePrefixElementTypes ?? [],
      restElementType: type.tupleRestElementType,
    };
  }

  return undefined;
};

const stableIrTypeKeyImpl = (
  type: IrType,
  state: StableTypeKeyState
): string => {
  const cached = findStableTypeKey(state, type);
  if (cached !== undefined) {
    return cached;
  }

  const visit = beginStableTypeNode(state, type);
  if (visit.seenBefore) {
    return `cycle:${visit.id}`;
  }

  state.keys.set(type, `cycle:${visit.id}`);

  let key: string;
  switch (type.kind) {
    case "primitiveType":
    case "literalType":
    case "typeParameterType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      key = primitiveKey(type);
      break;

    case "arrayType":
      key = `arr#${visit.id}:${stableIrTypeKeyImpl(type.elementType, state)}:tuple:${(
        type.tuplePrefixElementTypes ?? []
      )
        .map((elementType) => stableIrTypeKeyImpl(elementType, state))
        .join(
          ","
        )}:rest:${type.tupleRestElementType ? stableIrTypeKeyImpl(type.tupleRestElementType, state) : "none"}`;
      break;

    case "tupleType":
      key = `tuple#${visit.id}:${type.elementTypes
        .map((elementType) => stableIrTypeKeyImpl(elementType, state))
        .join(",")}`;
      break;

    case "dictionaryType":
      key = `dict#${visit.id}:${stableIrTypeKeyImpl(type.keyType, state)}=>${stableIrTypeKeyImpl(
        type.valueType,
        state
      )}`;
      break;

    case "referenceType": {
      const args = (type.typeArguments ?? []).map((t) =>
        t ? stableIrTypeKeyImpl(t, state) : "unknown"
      );
      const members =
        type.structuralMembers &&
        !type.typeId?.stableId &&
        !type.resolvedClrType
          ? sortByStableKey(type.structuralMembers, interfaceMemberKey, state)
              .map((member) => interfaceMemberKey(member, state))
              .join("|")
          : "";
      key = `ref#${visit.id}:${referenceTypeIdentity(type)}:${args.join(",")}:${members}`;
      break;
    }

    case "functionType": {
      const params = type.parameters
        .map((parameter) => parameterKey(parameter, state))
        .join("|");
      const returnType = stableIrTypeKeyImpl(type.returnType, state);
      key = `fn#${visit.id}:${params}->${returnType}`;
      break;
    }

    case "objectType": {
      const members = sortByStableKey(type.members, interfaceMemberKey, state)
        .map((member) => interfaceMemberKey(member, state))
        .join("|");
      key = `obj#${visit.id}:${members}`;
      break;
    }

    case "unionType":
      key = `union#${visit.id}:${normalizeTypeList(type.types, state)
        .map((member) => stableIrTypeKeyImpl(member, state))
        .join("|")}`;
      break;

    case "intersectionType":
      key = `inter#${visit.id}:${normalizeTypeList(type.types, state)
        .map((member) => stableIrTypeKeyImpl(member, state))
        .join("|")}`;
      break;
  }

  state.keys.set(type, key);
  return key;
};

export const stableIrTypeKey = (type: IrType): string =>
  stableIrTypeKeyImpl(type, createStableTypeKeyState());

export const runtimeUnionCarrierFamilyKey = (
  type: Extract<IrType, { kind: "unionType" }>
): string => {
  if (type.runtimeCarrierFamilyKey) {
    return type.runtimeCarrierFamilyKey;
  }

  const canonicalMembers = collectCanonicalRuntimeUnionFamilyMembers(type);

  if (type.preserveRuntimeLayout) {
    return `runtime-union:preserve:${canonicalMembers
      .map((member) => stableIrTypeKey(member))
      .join("|")}`;
  }

  return `runtime-union:canonical:${canonicalMembers
    .map((member) => stableIrTypeKey(member))
    .join("|")}`;
};

export const irTypesEqual = (left: IrType, right: IrType): boolean =>
  stableIrTypeKey(left) === stableIrTypeKey(right);

export type NormalizedUnionTypeOptions = {
  readonly preserveRuntimeLayout?: true;
  readonly runtimeCarrierFamilyKey?: string;
};

export const normalizedUnionType = (
  types: readonly IrType[],
  options: NormalizedUnionTypeOptions = {}
): IrType => {
  const flattened: IrType[] = [];
  const pushFlattened = (type: IrType): void => {
    if (type.kind === "unionType") {
      for (const member of type.types) {
        pushFlattened(member);
      }
      return;
    }
    flattened.push(type);
  };
  for (const t of types) pushFlattened(t);

  const deduped = new Map<string, IrType>();
  for (const t of flattened) {
    deduped.set(stableIrTypeKey(t), t);
  }
  const normalized = normalizeTypeList(
    Array.from(deduped.values()),
    createStableTypeKeyState()
  );
  if (normalized.length === 1) {
    const single = normalized[0];
    if (single) return single;
  }
  const unionType: Extract<IrType, { kind: "unionType" }> = {
    kind: "unionType",
    types: normalized,
    ...(options.preserveRuntimeLayout === true
      ? { preserveRuntimeLayout: true as const }
      : {}),
  };
  return {
    ...unionType,
    runtimeCarrierFamilyKey:
      options.runtimeCarrierFamilyKey ?? runtimeUnionCarrierFamilyKey(unionType),
  };
};
