import type { IrInterfaceMember, IrParameter, IrType } from "@tsonic/frontend";
import { stableIrTypeKey } from "@tsonic/frontend";
import { createHash } from "node:crypto";
import type { EmitterContext } from "../../types.js";
import { resolveTypeAlias, stripNullish } from "./nullish-value-helpers.js";
import { getReferenceNominalIdentityKey } from "./reference-type-identity.js";

type ReferenceIrType = Extract<IrType, { kind: "referenceType" }>;

type ContextualKeyState = {
  readonly keys: WeakMap<object, string>;
  readonly ids: WeakMap<object, number>;
  readonly active: WeakSet<object>;
  readonly activeReferenceKeys: Set<string>;
  nextId: number;
};

const createContextualKeyState = (): ContextualKeyState => ({
  keys: new WeakMap<object, string>(),
  ids: new WeakMap<object, number>(),
  active: new WeakSet<object>(),
  activeReferenceKeys: new Set<string>(),
  nextId: 0,
});

const opaqueVisitKeys = new WeakMap<object, number>();
let nextOpaqueVisitKey = 0;
const maxContextualKeyLength = 8192;
const noContextualKey = Symbol("noContextualKey");
const contextualKeyCache = new WeakMap<
  object,
  WeakMap<object, string | typeof noContextualKey>
>();

const hashContextualKey = (text: string): string =>
  `hash:${createHash("sha256").update(text).digest("hex")}`;

const compactContextualKey = (key: string): string =>
  key.length <= maxContextualKeyLength ? key : hashContextualKey(key);

const joinContextualKeyParts = (
  parts: readonly string[],
  separator: string
): string => {
  const estimatedLength =
    parts.reduce((sum, part) => sum + part.length, 0) +
    Math.max(0, parts.length - 1) * separator.length;
  if (estimatedLength <= maxContextualKeyLength) {
    return parts.join(separator);
  }

  const hash = createHash("sha256");
  parts.forEach((part, index) => {
    if (index > 0) {
      hash.update(separator);
    }
    hash.update(part);
  });
  return `hash:${hash.digest("hex")}`;
};

const getOpaqueVisitKey = (type: IrType): string => {
  if (typeof type !== "object" || type === null) {
    return `opaque:${String(type)}`;
  }

  const existing = opaqueVisitKeys.get(type);
  if (existing !== undefined) {
    return `opaque:${existing}`;
  }

  const next = nextOpaqueVisitKey;
  nextOpaqueVisitKey += 1;
  opaqueVisitKeys.set(type, next);
  return `opaque:${next}`;
};

export const isIdentityLessReferenceStableKeyError = (
  error: unknown
): boolean =>
  error instanceof Error &&
  error.message.startsWith(
    "Cannot build stable type key for identity-less reference type "
  );

export const tryStableIrTypeKey = (type: IrType): string | undefined => {
  try {
    return stableIrTypeKey(type);
  } catch (error) {
    if (isIdentityLessReferenceStableKeyError(error)) {
      return undefined;
    }
    throw error;
  }
};

const primitiveContextualKey = (
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

const getObjectNodeId = (type: object, state: ContextualKeyState): number => {
  const existing = state.ids.get(type);
  if (existing !== undefined) {
    return existing;
  }

  const next = state.nextId;
  state.nextId += 1;
  state.ids.set(type, next);
  return next;
};

const contextualParameterKey = (
  parameter: IrParameter,
  context: EmitterContext,
  state: ContextualKeyState
): string | undefined => {
  const typeKey = parameter.type
    ? contextualTypeIdentityKey(parameter.type, context, state)
    : "unknown";
  if (!typeKey) {
    return undefined;
  }

  return `p:${parameter.isRest ? 1 : 0}:${parameter.isOptional ? 1 : 0}:${
    parameter.passing ?? "value"
  }:${typeKey}`;
};

const contextualMemberKey = (
  member: IrInterfaceMember,
  context: EmitterContext,
  state: ContextualKeyState
): string | undefined => {
  if (member.kind === "propertySignature") {
    const typeKey = contextualTypeIdentityKey(member.type, context, state);
    return typeKey
      ? `prop:${member.name}:${member.isReadonly ? 1 : 0}:${
          member.isOptional ? 1 : 0
        }:${typeKey}`
      : undefined;
  }

  const parameterKeys: string[] = [];
  for (const parameter of member.parameters) {
    const parameterKey = contextualParameterKey(parameter, context, state);
    if (!parameterKey) {
      return undefined;
    }
    parameterKeys.push(parameterKey);
  }

  const returnTypeKey = member.returnType
    ? contextualTypeIdentityKey(member.returnType, context, state)
    : "void";
  if (!returnTypeKey) {
    return undefined;
  }

  return compactContextualKey(
    `method:${member.name}:${member.typeParameters?.length ?? 0}:${joinContextualKeyParts(
      parameterKeys,
      "|"
    )}:${returnTypeKey}`
  );
};

const contextualReferenceTypeIdentityKey = (
  type: ReferenceIrType,
  context: EmitterContext,
  state: ContextualKeyState
): string | undefined => {
  const rawIdentity =
    getReferenceNominalIdentityKey(type, context) ??
    type.typeId?.stableId ??
    type.typeId?.tsName ??
    type.name;
  const rawReferenceKey = `ref:${rawIdentity}`;
  if (state.activeReferenceKeys.has(rawReferenceKey)) {
    return `cycle:${rawReferenceKey}`;
  }

  state.activeReferenceKeys.add(rawReferenceKey);
  try {
    const identity = getReferenceNominalIdentityKey(type, context);
    const argumentKeys: string[] = [];
    for (const argument of type.typeArguments ?? []) {
      const argumentKey = contextualTypeIdentityKey(argument, context, state);
      if (!argumentKey) {
        return undefined;
      }
      argumentKeys.push(argumentKey);
    }

    if (identity) {
      return compactContextualKey(
        `ref:${identity}<${joinContextualKeyParts(argumentKeys, ",")}>`
      );
    }

    const resolved = resolveTypeAlias(stripNullish(type), context);
    if (resolved !== type) {
      if (resolved.kind !== "referenceType") {
        return contextualTypeIdentityKey(resolved, context, state);
      }
      return contextualReferenceTypeIdentityKey(resolved, context, state);
    }

    if (!type.structuralMembers) {
      return undefined;
    }

    const memberKeys: string[] = [];
    for (const member of type.structuralMembers ?? []) {
      const memberKey = contextualMemberKey(member, context, state);
      if (!memberKey) {
        return undefined;
      }
      memberKeys.push(memberKey);
    }

    return compactContextualKey(
      `ref:structural<${joinContextualKeyParts(
        argumentKeys,
        ","
      )}>{${joinContextualKeyParts([...memberKeys].sort(), "|")}}`
    );
  } finally {
    state.activeReferenceKeys.delete(rawReferenceKey);
  }
};

const contextualTypeIdentityKey = (
  type: IrType,
  context: EmitterContext,
  state: ContextualKeyState
): string | undefined => {
  const cached = state.keys.get(type);
  if (cached !== undefined) {
    return cached;
  }

  const id = getObjectNodeId(type, state);
  if (state.active.has(type)) {
    return `cycle:${id}`;
  }

  state.active.add(type);
  try {
    let key: string | undefined;
    switch (type.kind) {
      case "primitiveType":
      case "literalType":
      case "typeParameterType":
      case "anyType":
      case "unknownType":
      case "voidType":
      case "neverType":
        key = primitiveContextualKey(type);
        break;

      case "referenceType":
        key = contextualReferenceTypeIdentityKey(type, context, state);
        break;

      case "arrayType": {
        const elementKey = contextualTypeIdentityKey(
          type.elementType,
          context,
          state
        );
        if (!elementKey) {
          key = undefined;
          break;
        }
        const tuplePrefixKeys: string[] = [];
        for (const elementType of type.tuplePrefixElementTypes ?? []) {
          const elementTypeKey = contextualTypeIdentityKey(
            elementType,
            context,
            state
          );
          if (!elementTypeKey) {
            key = undefined;
            break;
          }
          tuplePrefixKeys.push(elementTypeKey);
        }
        if (
          key === undefined &&
          tuplePrefixKeys.length !== (type.tuplePrefixElementTypes ?? []).length
        ) {
          break;
        }
        const restKey = type.tupleRestElementType
          ? contextualTypeIdentityKey(type.tupleRestElementType, context, state)
          : "none";
        key = restKey
          ? compactContextualKey(
              `arr:${elementKey}:tuple:${joinContextualKeyParts(
                tuplePrefixKeys,
                ","
              )}:rest:${restKey}`
            )
          : undefined;
        break;
      }

      case "tupleType": {
        const elementKeys: string[] = [];
        for (const elementType of type.elementTypes) {
          const elementKey = contextualTypeIdentityKey(
            elementType,
            context,
            state
          );
          if (!elementKey) {
            key = undefined;
            break;
          }
          elementKeys.push(elementKey);
        }
        key =
          key === undefined && elementKeys.length !== type.elementTypes.length
            ? undefined
            : compactContextualKey(
                `tuple:${joinContextualKeyParts(elementKeys, ",")}`
              );
        break;
      }

      case "dictionaryType": {
        const keyKey = contextualTypeIdentityKey(type.keyType, context, state);
        const valueKey = contextualTypeIdentityKey(
          type.valueType,
          context,
          state
        );
        key = keyKey && valueKey ? `dict:${keyKey}=>${valueKey}` : undefined;
        break;
      }

      case "functionType": {
        const parameterKeys: string[] = [];
        for (const parameter of type.parameters) {
          const parameterKey = contextualParameterKey(
            parameter,
            context,
            state
          );
          if (!parameterKey) {
            key = undefined;
            break;
          }
          parameterKeys.push(parameterKey);
        }
        if (
          key === undefined &&
          parameterKeys.length !== type.parameters.length
        ) {
          break;
        }
        const returnKey = contextualTypeIdentityKey(
          type.returnType,
          context,
          state
        );
        key = returnKey
          ? compactContextualKey(
              `fn:${joinContextualKeyParts(parameterKeys, "|")}=>${returnKey}`
            )
          : undefined;
        break;
      }

      case "objectType": {
        const memberKeys: string[] = [];
        for (const member of type.members) {
          const memberKey = contextualMemberKey(member, context, state);
          if (!memberKey) {
            key = undefined;
            break;
          }
          memberKeys.push(memberKey);
        }
        key =
          key === undefined && memberKeys.length !== type.members.length
            ? undefined
            : compactContextualKey(
                `obj:${joinContextualKeyParts([...memberKeys].sort(), "|")}`
              );
        break;
      }

      case "unionType":
      case "intersectionType": {
        const memberKeys: string[] = [];
        for (const member of type.types) {
          const memberKey = contextualTypeIdentityKey(member, context, state);
          if (!memberKey) {
            key = undefined;
            break;
          }
          memberKeys.push(memberKey);
        }
        if (key === undefined && memberKeys.length !== type.types.length) {
          break;
        }
        const orderedKeys =
          type.kind === "unionType" && type.preserveRuntimeLayout
            ? memberKeys
            : [...memberKeys].sort();
        key = compactContextualKey(
          `${type.kind === "unionType" ? "union" : "inter"}:${joinContextualKeyParts(
            orderedKeys,
            "|"
          )}`
        );
        break;
      }
    }

    if (key !== undefined) {
      state.keys.set(type, key);
    }
    return key;
  } finally {
    state.active.delete(type);
  }
};

export const tryContextualTypeIdentityKey = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  if (typeof type !== "object" || type === null) {
    return undefined;
  }

  const contextObject = context as object;
  const cachedByContext = contextualKeyCache.get(type);
  const cached = cachedByContext?.get(contextObject);
  if (cached !== undefined) {
    return cached === noContextualKey ? undefined : cached;
  }

  const key = contextualTypeIdentityKey(
    type,
    context,
    createContextualKeyState()
  );
  const nextByContext = cachedByContext ?? new WeakMap();
  nextByContext.set(contextObject, key ?? noContextualKey);
  if (!cachedByContext) {
    contextualKeyCache.set(type, nextByContext);
  }
  return key;
};

export const getContextualTypeVisitKey = (
  type: IrType,
  context: EmitterContext
): string =>
  tryContextualTypeIdentityKey(type, context) ?? getOpaqueVisitKey(type);

export const describeIrTypeForDiagnostics = (
  type: IrType,
  context: EmitterContext
): string =>
  tryContextualTypeIdentityKey(type, context) ??
  tryStableIrTypeKey(type) ??
  `${type.kind}:${getOpaqueVisitKey(type)}`;
