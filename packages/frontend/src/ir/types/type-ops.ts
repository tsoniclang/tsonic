import type { IrInterfaceMember, IrParameter } from "./helpers.js";
import type { IrType } from "./ir-types.js";
import { isKnownBuiltinReferenceType } from "../validation/known-builtin-reference-types.js";

export type IrSpreadTupleShape = {
  readonly prefixElementTypes: readonly IrType[];
  readonly restElementType?: IrType;
};

type StableTypeKeyState = {
  readonly seen: Map<object, number>;
  readonly keys: Map<object, string>;
  readonly semanticCycles: Map<string, string>;
  readonly parent?: StableTypeKeyState;
  nextId: number;
};

const createStableTypeKeyState = (): StableTypeKeyState => ({
  seen: new Map<object, number>(),
  keys: new Map<object, string>(),
  semanticCycles: new Map<string, string>(),
  nextId: 0,
});

const cloneStableTypeKeyState = (
  state: StableTypeKeyState
): StableTypeKeyState => ({
  seen: new Map<object, number>(),
  keys: state.keys,
  semanticCycles: state.semanticCycles,
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

const shouldDropLiteralInPresenceOfPrimitive = (
  type: IrType,
  primitiveFamilies: ReadonlySet<"string" | "number" | "boolean">
): boolean => {
  if (type.kind !== "literalType") {
    return false;
  }

  switch (typeof type.value) {
    case "string":
      return primitiveFamilies.has("string");
    case "number":
      return primitiveFamilies.has("number");
    case "boolean":
      return primitiveFamilies.has("boolean");
    default:
      return false;
  }
};

const isRuntimeNullishMember = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "null" || type.name === "undefined");

const INTRINSIC_REFERENCE_IDENTITIES: ReadonlyMap<string, string> = new Map([
  ["object", "intrinsic:object"],
  ["Array", "intrinsic:ts:Array"],
  ["ReadonlyArray", "intrinsic:ts:ReadonlyArray"],
  ["ArrayLike", "intrinsic:ts:ArrayLike"],
  ["Promise", "intrinsic:ts:Promise"],
  ["PromiseLike", "intrinsic:ts:PromiseLike"],
  ["Iterable", "intrinsic:ts:Iterable"],
  ["Iterator", "intrinsic:ts:Iterator"],
  ["IterableIterator", "intrinsic:ts:IterableIterator"],
  ["Generator", "intrinsic:ts:Generator"],
  ["AsyncIterable", "intrinsic:ts:AsyncIterable"],
  ["AsyncIterator", "intrinsic:ts:AsyncIterator"],
  ["AsyncIterableIterator", "intrinsic:ts:AsyncIterableIterator"],
  ["AsyncGenerator", "intrinsic:ts:AsyncGenerator"],
  ["ArrayBuffer", "intrinsic:js:ArrayBuffer"],
  ["SharedArrayBuffer", "intrinsic:js:SharedArrayBuffer"],
  ["DataView", "intrinsic:js:DataView"],
  ["Int8Array", "intrinsic:js:Int8Array"],
  ["Uint8Array", "intrinsic:js:Uint8Array"],
  ["Uint8ClampedArray", "intrinsic:js:Uint8ClampedArray"],
  ["Int16Array", "intrinsic:js:Int16Array"],
  ["Uint16Array", "intrinsic:js:Uint16Array"],
  ["Int32Array", "intrinsic:js:Int32Array"],
  ["Uint32Array", "intrinsic:js:Uint32Array"],
  ["Float32Array", "intrinsic:js:Float32Array"],
  ["Float64Array", "intrinsic:js:Float64Array"],
  ["BigInt64Array", "intrinsic:js:BigInt64Array"],
  ["BigUint64Array", "intrinsic:js:BigUint64Array"],
]);

const CORE_REFERENCE_CLR_IDENTITIES: ReadonlyMap<string, string> = new Map([
  ["bool", "System.Boolean"],
  ["Boolean", "System.Boolean"],
  ["byte", "System.Byte"],
  ["Byte", "System.Byte"],
  ["sbyte", "System.SByte"],
  ["SByte", "System.SByte"],
  ["short", "System.Int16"],
  ["Int16", "System.Int16"],
  ["ushort", "System.UInt16"],
  ["UInt16", "System.UInt16"],
  ["int", "System.Int32"],
  ["Int32", "System.Int32"],
  ["uint", "System.UInt32"],
  ["UInt32", "System.UInt32"],
  ["long", "System.Int64"],
  ["Int64", "System.Int64"],
  ["ulong", "System.UInt64"],
  ["UInt64", "System.UInt64"],
  ["nint", "System.IntPtr"],
  ["IntPtr", "System.IntPtr"],
  ["nuint", "System.UIntPtr"],
  ["UIntPtr", "System.UIntPtr"],
  ["float", "System.Single"],
  ["Single", "System.Single"],
  ["double", "System.Double"],
  ["Double", "System.Double"],
  ["decimal", "System.Decimal"],
  ["Decimal", "System.Decimal"],
  ["char", "System.Char"],
  ["Char", "System.Char"],
]);

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
  const opaqueMembers: IrType[] = [];
  for (const member of flattened) {
    const key = stableIrTypeKeyIfDeterministic(member);
    if (key) {
      deduped.set(key, member);
    } else {
      opaqueMembers.push(member);
    }
  }

  return [
    ...normalizeTypeList(Array.from(deduped.values()), createStableTypeKeyState()),
    ...opaqueMembers,
  ];
};

export const referenceTypeIdentity = (
  type: Extract<IrType, { kind: "referenceType" }>
): string | undefined => {
  if (type.typeId?.stableId) {
    return `id:${type.typeId.stableId}`;
  }

  const clrName = type.typeId?.clrName ?? type.resolvedClrType;
  if (clrName) {
    return `clr:${getClrIdentityKey(clrName, type.typeArguments?.length ?? 0)}`;
  }

  const coreClrIdentity = CORE_REFERENCE_CLR_IDENTITIES.get(type.name);
  if (coreClrIdentity && (type.typeArguments?.length ?? 0) === 0) {
    return `clr:${getClrIdentityKey(coreClrIdentity)}`;
  }

  const intrinsicIdentity = INTRINSIC_REFERENCE_IDENTITIES.get(type.name);
  if (intrinsicIdentity) {
    return `${intrinsicIdentity}/${type.typeArguments?.length ?? 0}`;
  }

  if (isKnownBuiltinReferenceType(type.name)) {
    return `builtin:${type.name}/${type.typeArguments?.length ?? 0}`;
  }

  return undefined;
};

export const stripGlobalClrAlias = (name: string): string =>
  name.startsWith("global::") ? name.slice("global::".length) : name;

const parseSurfaceGenericIdentity = (
  rawName: string
): { readonly name: string; readonly arity: number } | undefined => {
  const openIndex = rawName.indexOf("<");
  if (openIndex < 0 || !rawName.endsWith(">")) {
    return undefined;
  }

  const argumentList = rawName.slice(openIndex + 1, -1);
  const arity = countTopLevelGenericArguments(argumentList);
  return arity === undefined
    ? undefined
    : { name: rawName.slice(0, openIndex), arity };
};

const countTopLevelGenericArguments = (
  argumentList: string
): number | undefined => {
  let depth = 0;
  let count = 1;
  let hasContent = false;

  for (const char of argumentList) {
    if (char === "<") {
      depth += 1;
      hasContent = true;
      continue;
    }

    if (char === ">") {
      depth -= 1;
      if (depth < 0) {
        return undefined;
      }
      continue;
    }

    if (char === "," && depth === 0) {
      count += 1;
      continue;
    }

    if (!/\s/.test(char)) {
      hasContent = true;
    }
  }

  return depth === 0 && hasContent ? count : undefined;
};

const parseClrIdentity = (
  rawName: string
): { readonly name: string; readonly arity: number | undefined } => {
  const normalizedName = stripGlobalClrAlias(rawName.trim());
  const surfaceGeneric = parseSurfaceGenericIdentity(normalizedName);
  const identityName = surfaceGeneric?.name ?? normalizedName;
  const genericMatch = /^(.*)`([0-9]+)$/.exec(identityName);
  if (!genericMatch) {
    return { name: identityName, arity: surfaceGeneric?.arity };
  }

  return {
    name: genericMatch[1] ?? identityName,
    arity: Number(genericMatch[2]),
  };
};

export const getClrIdentityKey = (
  rawName: string,
  typeArgumentArity = 0
): string => {
  const parsed = parseClrIdentity(rawName);
  const arity = parsed.arity ?? typeArgumentArity;
  return `${parsed.name}/${arity}`;
};

export const referenceTypeHasClrIdentity = (
  type: Extract<IrType, { kind: "referenceType" }>,
  rawNames: Iterable<string>
): boolean => {
  const typeKey = type.typeId?.clrName
    ? getClrIdentityKey(type.typeId.clrName, type.typeArguments?.length ?? 0)
    : type.resolvedClrType
      ? getClrIdentityKey(type.resolvedClrType, type.typeArguments?.length ?? 0)
      : undefined;
  if (!typeKey) {
    return false;
  }

  for (const rawName of rawNames) {
    if (typeKey === getClrIdentityKey(rawName, type.typeArguments?.length ?? 0)) {
      return true;
    }
  }

  return false;
};

const coarseParameterRecursionIdentity = (param: IrParameter): string => {
  const mode = param.passing ?? "value";
  return `p:${param.isRest ? 1 : 0}:${param.isOptional ? 1 : 0}:${mode}`;
};

const coarseInterfaceMemberRecursionIdentity = (
  member: IrInterfaceMember
): string => {
  if (member.kind === "propertySignature") {
    return `prop:${member.name}:${member.isReadonly ? 1 : 0}:${member.isOptional ? 1 : 0}`;
  }

  const typeParamCount = member.typeParameters?.length ?? 0;
  const parameters = member.parameters
    .map((parameter) => coarseParameterRecursionIdentity(parameter))
    .join("|");
  return `method:${member.name}:${typeParamCount}:${parameters}`;
};

const coarseTypeHeadIdentity = (type: IrType, depth = 0): string => {
  const maxDepth = 6;

  switch (type.kind) {
    case "primitiveType":
    case "literalType":
    case "typeParameterType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return primitiveKey(type);

    case "arrayType":
      return depth >= maxDepth
        ? "arr:*"
        : `arr:${coarseTypeHeadIdentity(type.elementType, depth + 1)}`;

    case "tupleType":
      return `tuple:${type.elementTypes.length}`;

    case "dictionaryType":
      return depth >= maxDepth
        ? "dict:*"
        : `dict:${coarseTypeHeadIdentity(type.keyType, depth + 1)}=>${coarseTypeHeadIdentity(type.valueType, depth + 1)}`;

    case "referenceType": {
      const identity = referenceTypeIdentity(type);
      if (!identity && !type.structuralMembers) {
        throw new Error(
          `Cannot build stable type key for identity-less reference type '${type.name}'`
        );
      }
      const args =
        depth >= maxDepth
          ? "*"
          : (type.typeArguments ?? [])
        .map((arg) =>
          arg ? coarseTypeHeadIdentity(arg, depth + 1) : "unknown"
        )
        .join(",");
      const members = (type.structuralMembers ?? [])
        .map((member) => coarseInterfaceMemberRecursionIdentity(member))
        .sort()
        .join("|");
      return `ref:${identity ?? "structural"}:${args}:${members}`;
    }

    case "functionType":
      return `fn:${type.parameters
        .map((parameter) => coarseParameterRecursionIdentity(parameter))
        .join("|")}`;

    case "objectType":
      return `obj:${type.members
        .map((member) => coarseInterfaceMemberRecursionIdentity(member))
        .sort()
        .join("|")}`;

    case "unionType":
      return depth >= maxDepth
        ? "union:*"
        : `union:${type.types
            .map((member) => coarseTypeHeadIdentity(member, depth + 1))
            .sort()
            .join("|")}`;

    case "intersectionType":
      return depth >= maxDepth
        ? "inter:*"
        : `inter:${type.types
            .map((member) => coarseTypeHeadIdentity(member, depth + 1))
            .sort()
            .join("|")}`;
  }
};

const coarseTypeRecursionIdentity = (
  type: IrType,
  seen: Map<IrType, number> = new Map()
): string => {
  const seenId = seen.get(type);
  if (seenId !== undefined) {
    return `cycle:${seenId}`;
  }

  switch (type.kind) {
    case "primitiveType":
    case "literalType":
    case "typeParameterType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return primitiveKey(type);

    case "arrayType":
      return `arr:${coarseTypeHeadIdentity(type.elementType)}`;

    case "tupleType":
      return `tuple:${type.elementTypes.length}`;

    case "dictionaryType":
      return `dict:${coarseTypeHeadIdentity(type.keyType)}=>${coarseTypeHeadIdentity(type.valueType)}`;

    case "referenceType":
      {
        const identity = referenceTypeIdentity(type);
        if (!identity && !type.structuralMembers) {
          throw new Error(
            `Cannot build stable type key for identity-less reference type '${type.name}'`
          );
        }
        return `ref:${identity ?? "structural"}:${(type.typeArguments ?? [])
          .map((arg) => (arg ? coarseTypeHeadIdentity(arg) : "unknown"))
          .join(",")}:${(type.structuralMembers ?? [])
          .map((member) => coarseInterfaceMemberRecursionIdentity(member))
          .sort()
          .join("|")}`;
      }

    case "functionType":
      return `fn:${type.parameters
        .map((parameter) => coarseParameterRecursionIdentity(parameter))
        .join("|")}`;

    case "objectType":
      return `obj:${type.members
        .map((member) => coarseInterfaceMemberRecursionIdentity(member))
        .sort()
        .join("|")}`;

    case "unionType":
      return `union:${type.types
        .map((member) => coarseTypeHeadIdentity(member))
        .sort()
        .join("|")}`;

    case "intersectionType":
      return `inter:${type.types
        .map((member) => coarseTypeHeadIdentity(member))
        .sort()
        .join("|")}`;
  }
};

const stableTypeRecursionIdentity = (type: IrType): string | undefined => {
  switch (type.kind) {
    case "primitiveType":
    case "literalType":
    case "typeParameterType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return undefined;
    default:
      return coarseTypeRecursionIdentity(type);
  }
};

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

  const semanticIdentity = stableTypeRecursionIdentity(type);
  const semanticCycleKey = semanticIdentity
    ? state.semanticCycles.get(semanticIdentity)
    : undefined;
  if (semanticCycleKey !== undefined) {
    state.keys.set(type, semanticCycleKey);
    return semanticCycleKey;
  }

  if (semanticIdentity) {
    state.semanticCycles.set(semanticIdentity, `cycle:${visit.id}`);
  }

  let key: string;
  try {
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
        key = `arr:${stableIrTypeKeyImpl(type.elementType, state)}:tuple:${(
          type.tuplePrefixElementTypes ?? []
        )
          .map((elementType) => stableIrTypeKeyImpl(elementType, state))
          .join(
            ","
          )}:rest:${type.tupleRestElementType ? stableIrTypeKeyImpl(type.tupleRestElementType, state) : "none"}`;
        break;

      case "tupleType":
        key = `tuple:${type.elementTypes
          .map((elementType) => stableIrTypeKeyImpl(elementType, state))
          .join(",")}`;
        break;

      case "dictionaryType":
        key = `dict:${stableIrTypeKeyImpl(type.keyType, state)}=>${stableIrTypeKeyImpl(
          type.valueType,
          state
        )}`;
        break;

      case "referenceType": {
        const identity = referenceTypeIdentity(type);
        if (!identity && !type.structuralMembers) {
          throw new Error(
            `Cannot build stable type key for identity-less reference type '${type.name}'`
          );
        }
        const args = (type.typeArguments ?? []).map((t) =>
          t ? stableIrTypeKeyImpl(t, state) : "unknown"
        );
        const members =
          type.structuralMembers &&
          !identity
            ? sortByStableKey(type.structuralMembers, interfaceMemberKey, state)
                .map((member) => interfaceMemberKey(member, state))
                .join("|")
            : "";
        key = `ref:${identity ?? "structural"}:${args.join(",")}:${members}`;
        break;
      }

      case "functionType": {
        const params = type.parameters
          .map((parameter) => parameterKey(parameter, state))
          .join("|");
        const returnType = stableIrTypeKeyImpl(type.returnType, state);
        key = `fn:${params}->${returnType}`;
        break;
      }

      case "objectType": {
        const members = sortByStableKey(type.members, interfaceMemberKey, state)
          .map((member) => interfaceMemberKey(member, state))
          .join("|");
        key = `obj:${members}`;
        break;
      }

      case "unionType":
        key = `union:${normalizeTypeList(type.types, state)
          .map((member) => stableIrTypeKeyImpl(member, state))
          .join("|")}`;
        break;

      case "intersectionType":
        key = `inter:${normalizeTypeList(type.types, state)
          .map((member) => stableIrTypeKeyImpl(member, state))
          .join("|")}`;
        break;
    }
  } finally {
    if (
      semanticIdentity &&
      state.semanticCycles.get(semanticIdentity) === `cycle:${visit.id}`
    ) {
      state.semanticCycles.delete(semanticIdentity);
    }
  }

  state.keys.set(type, key);
  return key;
};

export const stableIrTypeKey = (type: IrType): string =>
  stableIrTypeKeyImpl(type, createStableTypeKeyState());

const isIdentityLessReferenceStableKeyError = (error: unknown): boolean =>
  error instanceof Error &&
  error.message.startsWith(
    "Cannot build stable type key for identity-less reference type "
  );

const isRecursiveStableKeyOverflow = (error: unknown): boolean =>
  error instanceof RangeError &&
  error.message.toLowerCase().includes("call stack");

export const stableIrTypeKeyIfDeterministic = (
  type: IrType
): string | undefined => {
  try {
    return stableIrTypeKey(type);
  } catch (error) {
    if (
      isIdentityLessReferenceStableKeyError(error) ||
      isRecursiveStableKeyOverflow(error)
    ) {
      return undefined;
    }
    throw error;
  }
};

export type LocalTypeIdentityState = {
  readonly opaqueIds: WeakMap<object, number>;
  readonly active: WeakSet<object>;
  nextOpaqueId: number;
};

export const createLocalTypeIdentityState = (): LocalTypeIdentityState => ({
  opaqueIds: new WeakMap<object, number>(),
  active: new WeakSet<object>(),
  nextOpaqueId: 0,
});

const localOpaqueTypeKey = (
  type: object,
  state: LocalTypeIdentityState
): string => {
  const existing = state.opaqueIds.get(type);
  if (existing !== undefined) {
    return `opaque:${existing}`;
  }

  const next = state.nextOpaqueId;
  state.nextOpaqueId += 1;
  state.opaqueIds.set(type, next);
  return `opaque:${next}`;
};

export const localTypeIdentityKey = (
  type: IrType,
  state: LocalTypeIdentityState
): string => {
  switch (type.kind) {
    case "primitiveType":
    case "literalType":
    case "typeParameterType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return primitiveKey(type);

    case "arrayType":
      if (state.active.has(type)) {
        return localOpaqueTypeKey(type, state);
      }
      state.active.add(type);
      try {
        return `arr:${localTypeIdentityKey(type.elementType, state)}`;
      } finally {
        state.active.delete(type);
      }

    case "tupleType":
      if (state.active.has(type)) {
        return localOpaqueTypeKey(type, state);
      }
      state.active.add(type);
      try {
        return `tuple:${type.elementTypes
          .map((elementType) => localTypeIdentityKey(elementType, state))
          .join(",")}`;
      } finally {
        state.active.delete(type);
      }

    case "dictionaryType":
      if (state.active.has(type)) {
        return localOpaqueTypeKey(type, state);
      }
      state.active.add(type);
      try {
        return `dict:${localTypeIdentityKey(type.keyType, state)}=>${localTypeIdentityKey(type.valueType, state)}`;
      } finally {
        state.active.delete(type);
      }

    case "referenceType": {
      const identity = referenceTypeIdentity(type);
      if (!identity) {
        return localOpaqueTypeKey(type, state);
      }
      if (state.active.has(type)) {
        return `ref:${identity}<${localOpaqueTypeKey(type, state)}>`;
      }
      state.active.add(type);
      try {
        const args = (type.typeArguments ?? [])
          .map((arg) => localTypeIdentityKey(arg, state))
          .join(",");
        return `ref:${identity}<${args}>`;
      } finally {
        state.active.delete(type);
      }
    }

    case "functionType":
    case "objectType":
    case "unionType":
    case "intersectionType":
      return localOpaqueTypeKey(type, state);
  }
};

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

export const irTypesEqual = (left: IrType, right: IrType): boolean => {
  try {
    return stableIrTypeKey(left) === stableIrTypeKey(right);
  } catch (error) {
    if (isIdentityLessReferenceStableKeyError(error)) {
      return false;
    }
    throw error;
  }
};

export type NormalizedUnionTypeOptions = {
  readonly preserveRuntimeLayout?: true;
  readonly runtimeCarrierFamilyKey?: string;
  readonly runtimeCarrierName?: string;
  readonly runtimeCarrierNamespace?: string;
  readonly runtimeCarrierTypeParameters?: readonly string[];
  readonly runtimeCarrierTypeArguments?: readonly IrType[];
};

export type RuntimeUnionAliasCarrierOptions = {
  readonly aliasName: string;
  readonly fullyQualifiedName: string;
  readonly namespaceName?: string;
  readonly typeParameters?: readonly string[];
  readonly typeArguments?: readonly IrType[];
};

const namespaceFromFullyQualifiedName = (
  fullyQualifiedName: string
): string | undefined => {
  const lastDot = fullyQualifiedName.lastIndexOf(".");
  return lastDot > 0 ? fullyQualifiedName.slice(0, lastDot) : undefined;
};

export const runtimeUnionAliasCarrierFamilyKey = (
  fullyQualifiedName: string
): string => `runtime-union:alias:${fullyQualifiedName}`;

const isRuntimeNullishCarrierMember = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "null" || type.name === "undefined");

const runtimeCarrierShapeKey = (type: IrType): string | undefined => {
  if (isRuntimeNullishCarrierMember(type)) {
    return undefined;
  }

  if (type.kind === "literalType") {
    switch (typeof type.value) {
      case "string":
        return "prim:string";
      case "number":
        return "prim:number";
      case "boolean":
        return "prim:boolean";
    }
  }

  if (type.kind === "primitiveType") {
    return `prim:${type.name}`;
  }

  return stableIrTypeKeyIfDeterministic(type);
};

export const hasRuntimeUnionCarrierShape = (type: IrType): boolean => {
  if (type.kind !== "unionType") {
    return false;
  }

  const runtimeKeys = new Set<string>();
  const visit = (candidate: IrType): void => {
    if (candidate.kind === "unionType" && !candidate.preserveRuntimeLayout) {
      for (const member of candidate.types) {
        visit(member);
      }
      return;
    }

    const key = runtimeCarrierShapeKey(candidate);
    if (key) {
      runtimeKeys.add(key);
    }
  };

  for (const member of type.types) {
    visit(member);
  }

  return runtimeKeys.size >= 2;
};

export const stampRuntimeUnionAliasCarrier = (
  type: IrType,
  options: RuntimeUnionAliasCarrierOptions
): IrType => {
  if (type.kind !== "unionType" || !hasRuntimeUnionCarrierShape(type)) {
    return type;
  }

  return {
    ...type,
    preserveRuntimeLayout: true,
    runtimeCarrierFamilyKey: runtimeUnionAliasCarrierFamilyKey(
      options.fullyQualifiedName
    ),
    runtimeCarrierName: options.aliasName,
    runtimeCarrierNamespace:
      options.namespaceName ??
      namespaceFromFullyQualifiedName(options.fullyQualifiedName),
    runtimeCarrierTypeParameters: options.typeParameters,
    runtimeCarrierTypeArguments: options.typeArguments,
  };
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

  const primitiveFamilies = new Set<"string" | "number" | "boolean">();
  for (const type of flattened) {
    if (
      type.kind === "primitiveType" &&
      (type.name === "string" ||
        type.name === "number" ||
        type.name === "boolean")
    ) {
      primitiveFamilies.add(type.name);
    }
  }

  const canonicalized = flattened.filter(
    (type) => !shouldDropLiteralInPresenceOfPrimitive(type, primitiveFamilies)
  );

  const deduped = new Map<string, IrType>();
  const opaqueMembers: IrType[] = [];
  for (const t of canonicalized) {
    const key = stableIrTypeKeyIfDeterministic(t);
    if (key) {
      deduped.set(key, t);
    } else {
      opaqueMembers.push(t);
    }
  }
  const normalized = [
    ...normalizeTypeList(Array.from(deduped.values()), createStableTypeKeyState()),
    ...opaqueMembers,
  ];
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
    ...(options.runtimeCarrierFamilyKey !== undefined
      ? { runtimeCarrierFamilyKey: options.runtimeCarrierFamilyKey }
      : {}),
    ...(options.runtimeCarrierName !== undefined
      ? { runtimeCarrierName: options.runtimeCarrierName }
      : {}),
    ...(options.runtimeCarrierNamespace !== undefined
      ? { runtimeCarrierNamespace: options.runtimeCarrierNamespace }
      : {}),
    ...(options.runtimeCarrierTypeParameters !== undefined
      ? { runtimeCarrierTypeParameters: options.runtimeCarrierTypeParameters }
      : {}),
    ...(options.runtimeCarrierTypeArguments !== undefined
      ? { runtimeCarrierTypeArguments: options.runtimeCarrierTypeArguments }
      : {}),
  };
  return unionType;
};
