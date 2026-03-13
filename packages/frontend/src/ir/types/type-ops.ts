import type { IrInterfaceMember, IrParameter } from "./helpers.js";
import type { IrType } from "./ir-types.js";

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

const parameterKey = (param: IrParameter): string => {
  const mode = param.passing ?? "value";
  const type = param.type ? stableIrTypeKey(param.type) : "unknown";
  return `p:${param.isRest ? 1 : 0}:${param.isOptional ? 1 : 0}:${mode}:${type}`;
};

const interfaceMemberKey = (member: IrInterfaceMember): string => {
  if (member.kind === "propertySignature") {
    return `prop:${member.name}:${member.isReadonly ? 1 : 0}:${member.isOptional ? 1 : 0}:${stableIrTypeKey(member.type)}`;
  }

  const typeParamCount = member.typeParameters?.length ?? 0;
  const parameters = member.parameters.map(parameterKey).join("|");
  const returnType = member.returnType
    ? stableIrTypeKey(member.returnType)
    : "void";
  return `method:${member.name}:${typeParamCount}:${parameters}:${returnType}`;
};

const normalizeTypeList = (types: readonly IrType[]): readonly IrType[] => {
  return [...types].sort((a, b) =>
    stableIrTypeKey(a).localeCompare(stableIrTypeKey(b))
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

export const stableIrTypeKey = (type: IrType): string => {
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
      return `arr:${stableIrTypeKey(type.elementType)}`;

    case "tupleType":
      return `tuple:${type.elementTypes.map(stableIrTypeKey).join(",")}`;

    case "dictionaryType":
      return `dict:${stableIrTypeKey(type.keyType)}=>${stableIrTypeKey(type.valueType)}`;

    case "referenceType": {
      const args = (type.typeArguments ?? []).map((t) =>
        t ? stableIrTypeKey(t) : "unknown"
      );
      const members = type.structuralMembers
        ? [...type.structuralMembers]
            .sort((a, b) =>
              interfaceMemberKey(a).localeCompare(interfaceMemberKey(b))
            )
            .map(interfaceMemberKey)
            .join("|")
        : "";
      return `ref:${referenceTypeIdentity(type)}:${args.join(",")}:${members}`;
    }

    case "functionType": {
      const params = type.parameters.map(parameterKey).join("|");
      const returnType = stableIrTypeKey(type.returnType);
      return `fn:${params}->${returnType}`;
    }

    case "objectType": {
      const members = [...type.members]
        .sort((a, b) =>
          interfaceMemberKey(a).localeCompare(interfaceMemberKey(b))
        )
        .map(interfaceMemberKey)
        .join("|");
      return `obj:${members}`;
    }

    case "unionType":
      return `union:${normalizeTypeList(type.types).map(stableIrTypeKey).join("|")}`;

    case "intersectionType":
      return `inter:${normalizeTypeList(type.types).map(stableIrTypeKey).join("|")}`;
  }
};

export const irTypesEqual = (left: IrType, right: IrType): boolean =>
  stableIrTypeKey(left) === stableIrTypeKey(right);

export const normalizedUnionType = (types: readonly IrType[]): IrType => {
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
  const normalized = normalizeTypeList(Array.from(deduped.values()));
  if (normalized.length === 1) {
    const single = normalized[0];
    if (single) return single;
  }
  return { kind: "unionType", types: normalized };
};
