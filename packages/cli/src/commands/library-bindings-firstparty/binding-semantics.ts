import type {
  IrInterfaceMember,
  IrMethodDeclaration,
  IrParameter,
  IrType,
  IrTypeParameter,
} from "@tsonic/frontend";
import type {
  FirstPartyBindingsExport,
  FirstPartyBindingsMethod,
  FirstPartyValueDeclarator,
} from "./types.js";
import { normalizeTypeReferenceName } from "./portable-types.js";

export const moduleNamespaceToInternalSpecifier = (namespace: string): string => {
  const nsPath = namespace.length > 0 ? namespace : "index";
  return `./${nsPath}/internal/index.js`;
};

export const toClrTypeName = (
  namespace: string,
  typeName: string,
  arity?: number
): string => {
  const suffix = arity && arity > 0 ? `\`${arity}` : "";
  return `${namespace}.${typeName}${suffix}`;
};

export const toBindingTypeAlias = (
  namespace: string,
  typeName: string,
  arity?: number
): string => {
  const normalizedName = normalizeTypeReferenceName(typeName, arity);
  return namespace.length > 0
    ? `${namespace}.${normalizedName}`
    : normalizedName;
};

export const toStableId = (assemblyName: string, clrName: string): string => {
  return `${assemblyName}:${clrName}`;
};

export const primitiveSignatureType = (name: string): string => {
  const map: Readonly<Record<string, string>> = {
    string: "System.String",
    boolean: "System.Boolean",
    number: "System.Double",
    int: "System.Int32",
    char: "System.Char",
    null: "System.Object",
    undefined: "System.Object",
  };
  return map[name] ?? name;
};

export const isNumericValueType = (name: string): boolean => {
  return (
    name === "System.Int32" ||
    name === "System.Double" ||
    name === "System.Single" ||
    name === "System.Decimal" ||
    name === "System.Int64" ||
    name === "System.Int16" ||
    name === "System.UInt16" ||
    name === "System.UInt32" ||
    name === "System.UInt64" ||
    name === "System.Byte" ||
    name === "System.SByte"
  );
};

type BindingSemanticRewriteCaches = {
  readonly types: WeakMap<object, IrType>;
  readonly members: WeakMap<object, IrInterfaceMember>;
};

const createBindingSemanticRewriteCaches =
  (): BindingSemanticRewriteCaches => ({
    types: new WeakMap<object, IrType>(),
    members: new WeakMap<object, IrInterfaceMember>(),
  });

const rewriteBindingSemanticParameterInternal = (
  parameter: IrParameter,
  localTypeNameRemaps: ReadonlyMap<string, string>,
  caches: BindingSemanticRewriteCaches
): IrParameter => ({
  ...parameter,
  type: rewriteBindingSemanticTypeInternal(
    parameter.type,
    localTypeNameRemaps,
    caches
  ),
});

const rewriteBindingSemanticMemberInternal = (
  member: IrInterfaceMember,
  localTypeNameRemaps: ReadonlyMap<string, string>,
  caches: BindingSemanticRewriteCaches
): IrInterfaceMember => {
  const cached = caches.members.get(member);
  if (cached) return cached;

  if (member.kind === "propertySignature") {
    const rewritten: IrInterfaceMember = {
      ...member,
      type: member.type,
    };
    caches.members.set(member, rewritten);
    (rewritten as { type: typeof member.type }).type =
      rewriteBindingSemanticTypeInternal(
        member.type,
        localTypeNameRemaps,
        caches
      ) ?? member.type;
    return rewritten;
  }

  const rewritten: IrInterfaceMember = {
    ...member,
    parameters: member.parameters,
    returnType: member.returnType,
  };
  caches.members.set(member, rewritten);
  (rewritten as { parameters: typeof member.parameters }).parameters =
    member.parameters.map((parameter) =>
      rewriteBindingSemanticParameterInternal(
        parameter,
        localTypeNameRemaps,
        caches
      )
    );
  (rewritten as { returnType: typeof member.returnType }).returnType =
    rewriteBindingSemanticTypeInternal(
      member.returnType,
      localTypeNameRemaps,
      caches
    ) ?? member.returnType;
  return rewritten;
};

const rewriteBindingSemanticTypeInternal = (
  type: IrType | undefined,
  localTypeNameRemaps: ReadonlyMap<string, string>,
  caches: BindingSemanticRewriteCaches
): IrType | undefined => {
  if (!type) return undefined;

  const cached = caches.types.get(type);
  if (cached) return cached;

  switch (type.kind) {
    case "referenceType": {
      const rewrittenName = normalizeTypeReferenceName(
        localTypeNameRemaps.get(type.name) ?? type.name,
        type.typeArguments?.length
      );
      const rewritten: IrType = {
        ...type,
        name: rewrittenName,
        typeArguments: undefined,
        structuralMembers: undefined,
      };
      caches.types.set(type, rewritten);
      (
        rewritten as { typeArguments?: typeof type.typeArguments }
      ).typeArguments = type.typeArguments?.map((arg) =>
        rewriteBindingSemanticTypeInternal(arg, localTypeNameRemaps, caches)
      ) as readonly IrType[] | undefined;
      (
        rewritten as { structuralMembers?: typeof type.structuralMembers }
      ).structuralMembers = type.structuralMembers?.map((member) =>
        rewriteBindingSemanticMemberInternal(
          member,
          localTypeNameRemaps,
          caches
        )
      );
      return rewritten;
    }
    case "arrayType": {
      const rewritten: IrType = {
        ...type,
        elementType: type.elementType,
      };
      caches.types.set(type, rewritten);
      (rewritten as { elementType: typeof type.elementType }).elementType =
        rewriteBindingSemanticTypeInternal(
          type.elementType,
          localTypeNameRemaps,
          caches
        ) ?? type.elementType;
      return rewritten;
    }
    case "tupleType": {
      const rewritten: IrType = {
        ...type,
        elementTypes: type.elementTypes,
      };
      caches.types.set(type, rewritten);
      (rewritten as { elementTypes: typeof type.elementTypes }).elementTypes =
        type.elementTypes.map((elementType) =>
          rewriteBindingSemanticTypeInternal(
            elementType,
            localTypeNameRemaps,
            caches
          )
        ) as readonly IrType[];
      return rewritten;
    }
    case "functionType": {
      const rewritten: IrType = {
        ...type,
        parameters: type.parameters,
        returnType: type.returnType,
      };
      caches.types.set(type, rewritten);
      (rewritten as { parameters: typeof type.parameters }).parameters =
        type.parameters.map((parameter) =>
          rewriteBindingSemanticParameterInternal(
            parameter,
            localTypeNameRemaps,
            caches
          )
        );
      (rewritten as { returnType: typeof type.returnType }).returnType =
        rewriteBindingSemanticTypeInternal(
          type.returnType,
          localTypeNameRemaps,
          caches
        ) ?? type.returnType;
      return rewritten;
    }
    case "objectType": {
      const rewritten: IrType = {
        ...type,
        members: type.members,
      };
      caches.types.set(type, rewritten);
      (rewritten as { members: typeof type.members }).members = type.members.map(
        (member) =>
          rewriteBindingSemanticMemberInternal(
            member,
            localTypeNameRemaps,
            caches
          )
      );
      return rewritten;
    }
    case "dictionaryType": {
      const rewritten: IrType = {
        ...type,
        keyType: type.keyType,
        valueType: type.valueType,
      };
      caches.types.set(type, rewritten);
      (rewritten as { keyType: typeof type.keyType }).keyType =
        rewriteBindingSemanticTypeInternal(
          type.keyType,
          localTypeNameRemaps,
          caches
        ) ?? type.keyType;
      (rewritten as { valueType: typeof type.valueType }).valueType =
        rewriteBindingSemanticTypeInternal(
          type.valueType,
          localTypeNameRemaps,
          caches
        ) ?? type.valueType;
      return rewritten;
    }
    case "unionType":
    case "intersectionType": {
      const rewritten: IrType = {
        ...type,
        types: type.types,
      };
      caches.types.set(type, rewritten);
      (rewritten as { types: typeof type.types }).types = type.types.map(
        (candidate) =>
          rewriteBindingSemanticTypeInternal(
            candidate,
            localTypeNameRemaps,
            caches
          )
      ) as readonly IrType[];
      return rewritten;
    }
    default:
      return type;
  }
};

export const rewriteBindingSemanticType = (
  type: IrType | undefined,
  localTypeNameRemaps: ReadonlyMap<string, string>
): IrType | undefined =>
  rewriteBindingSemanticTypeInternal(
    type,
    localTypeNameRemaps,
    createBindingSemanticRewriteCaches()
  );

export const rewriteBindingSemanticParameter = (
  parameter: IrParameter,
  localTypeNameRemaps: ReadonlyMap<string, string>
): IrParameter =>
  rewriteBindingSemanticParameterInternal(
    parameter,
    localTypeNameRemaps,
    createBindingSemanticRewriteCaches()
  );

export const buildSemanticSignature = (opts: {
  readonly typeParameters: readonly IrTypeParameter[] | undefined;
  readonly parameters: readonly IrParameter[];
  readonly returnType: IrType | undefined;
  readonly localTypeNameRemaps: ReadonlyMap<string, string>;
}):
  | {
      readonly typeParameters?: readonly string[];
      readonly parameters: readonly IrParameter[];
      readonly returnType?: IrType;
    }
  | undefined => {
  return {
    typeParameters: opts.typeParameters?.map(
      (typeParameter) => typeParameter.name
    ),
    parameters: opts.parameters.map((parameter) =>
      rewriteBindingSemanticParameter(parameter, opts.localTypeNameRemaps)
    ),
    returnType: rewriteBindingSemanticType(
      opts.returnType,
      opts.localTypeNameRemaps
    ),
  };
};

export const buildSemanticSignatureFromFunctionType = (
  type: Extract<IrType, { kind: "functionType" }>,
  localTypeNameRemaps: ReadonlyMap<string, string>
): {
  readonly typeParameters?: readonly string[];
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
} => ({
  typeParameters: undefined,
  parameters: type.parameters.map((parameter) =>
    rewriteBindingSemanticParameter(parameter, localTypeNameRemaps)
  ),
  returnType: rewriteBindingSemanticType(type.returnType, localTypeNameRemaps),
});

type BindingClrIdentityReattachCaches = {
  readonly types: WeakMap<object, IrType>;
  readonly members: WeakMap<object, IrInterfaceMember>;
};

const createBindingClrIdentityReattachCaches =
  (): BindingClrIdentityReattachCaches => ({
    types: new WeakMap<object, IrType>(),
    members: new WeakMap<object, IrInterfaceMember>(),
  });

const reattachBindingClrIdentityMemberInternal = (
  member: IrInterfaceMember,
  clrNamesByAlias: ReadonlyMap<string, string>,
  caches: BindingClrIdentityReattachCaches
): IrInterfaceMember => {
  const cached = caches.members.get(member);
  if (cached) return cached;

  if (member.kind === "propertySignature") {
    const rewritten: IrInterfaceMember = {
      ...member,
      type: member.type,
    };
    caches.members.set(member, rewritten);
    (rewritten as { type: typeof member.type }).type =
      reattachBindingClrIdentitiesInternal(
        member.type,
        clrNamesByAlias,
        caches
      ) ?? member.type;
    return rewritten;
  }

  const rewritten: IrInterfaceMember = {
    ...member,
    parameters: member.parameters,
    returnType: member.returnType,
  };
  caches.members.set(member, rewritten);
  (rewritten as { parameters: typeof member.parameters }).parameters =
    member.parameters.map((parameter) => ({
      ...parameter,
      type:
        reattachBindingClrIdentitiesInternal(
          parameter.type,
          clrNamesByAlias,
          caches
        ) ?? parameter.type,
    }));
  (rewritten as { returnType: typeof member.returnType }).returnType =
    reattachBindingClrIdentitiesInternal(
      member.returnType,
      clrNamesByAlias,
      caches
    ) ?? member.returnType;
  return rewritten;
};

const reattachBindingClrIdentitiesInternal = (
  type: IrType | undefined,
  clrNamesByAlias: ReadonlyMap<string, string>,
  caches: BindingClrIdentityReattachCaches
): IrType | undefined => {
  if (!type) return undefined;

  const cached = caches.types.get(type);
  if (cached) return cached;

  switch (type.kind) {
    case "referenceType": {
      const normalizedName = normalizeTypeReferenceName(
        type.name,
        type.typeArguments?.length
      );
      const rewritten: IrType = {
        ...type,
        resolvedClrType:
          type.resolvedClrType ??
          clrNamesByAlias.get(type.name) ??
          clrNamesByAlias.get(normalizedName),
        typeArguments: type.typeArguments,
        structuralMembers: type.structuralMembers,
      };
      caches.types.set(type, rewritten);
      (
        rewritten as { typeArguments?: typeof type.typeArguments }
      ).typeArguments = type.typeArguments?.map((argument) =>
        reattachBindingClrIdentitiesInternal(argument, clrNamesByAlias, caches)
      ) as readonly IrType[] | undefined;
      (
        rewritten as { structuralMembers?: typeof type.structuralMembers }
      ).structuralMembers = type.structuralMembers?.map((member) =>
        reattachBindingClrIdentityMemberInternal(
          member,
          clrNamesByAlias,
          caches
        )
      );
      return rewritten;
    }
    case "arrayType": {
      const rewritten: IrType = {
        ...type,
        elementType: type.elementType,
      };
      caches.types.set(type, rewritten);
      (rewritten as { elementType: typeof type.elementType }).elementType =
        reattachBindingClrIdentitiesInternal(
          type.elementType,
          clrNamesByAlias,
          caches
        ) ?? type.elementType;
      return rewritten;
    }
    case "tupleType": {
      const rewritten: IrType = {
        ...type,
        elementTypes: type.elementTypes,
      };
      caches.types.set(type, rewritten);
      (rewritten as { elementTypes: typeof type.elementTypes }).elementTypes =
        type.elementTypes.map((elementType) =>
          reattachBindingClrIdentitiesInternal(
            elementType,
            clrNamesByAlias,
            caches
          )
        ) as readonly IrType[];
      return rewritten;
    }
    case "functionType": {
      const rewritten: IrType = {
        ...type,
        parameters: type.parameters,
        returnType: type.returnType,
      };
      caches.types.set(type, rewritten);
      (rewritten as { parameters: typeof type.parameters }).parameters =
        type.parameters.map((parameter) => ({
          ...parameter,
          type:
            reattachBindingClrIdentitiesInternal(
              parameter.type,
              clrNamesByAlias,
              caches
            ) ?? parameter.type,
        }));
      (rewritten as { returnType: typeof type.returnType }).returnType =
        reattachBindingClrIdentitiesInternal(
          type.returnType,
          clrNamesByAlias,
          caches
        ) ?? type.returnType;
      return rewritten;
    }
    case "objectType": {
      const rewritten: IrType = {
        ...type,
        members: type.members,
      };
      caches.types.set(type, rewritten);
      (rewritten as { members: typeof type.members }).members = type.members.map(
        (member) =>
          reattachBindingClrIdentityMemberInternal(
            member,
            clrNamesByAlias,
            caches
          )
      );
      return rewritten;
    }
    case "dictionaryType": {
      const rewritten: IrType = {
        ...type,
        keyType: type.keyType,
        valueType: type.valueType,
      };
      caches.types.set(type, rewritten);
      (rewritten as { keyType: typeof type.keyType }).keyType =
        reattachBindingClrIdentitiesInternal(
          type.keyType,
          clrNamesByAlias,
          caches
        ) ?? type.keyType;
      (rewritten as { valueType: typeof type.valueType }).valueType =
        reattachBindingClrIdentitiesInternal(
          type.valueType,
          clrNamesByAlias,
          caches
        ) ?? type.valueType;
      return rewritten;
    }
    case "unionType":
    case "intersectionType": {
      const rewritten: IrType = {
        ...type,
        types: type.types,
      };
      caches.types.set(type, rewritten);
      (rewritten as { types: typeof type.types }).types = type.types.map(
        (member) =>
          reattachBindingClrIdentitiesInternal(member, clrNamesByAlias, caches)
      ) as readonly IrType[];
      return rewritten;
    }
    default:
      return type;
  }
};

export const reattachBindingClrIdentities = (
  type: IrType | undefined,
  clrNamesByAlias: ReadonlyMap<string, string>
): IrType | undefined =>
  reattachBindingClrIdentitiesInternal(
    type,
    clrNamesByAlias,
    createBindingClrIdentityReattachCaches()
  );

export const resolveFunctionTypeFromValueDeclarator = (
  declarator: FirstPartyValueDeclarator | undefined
): Extract<IrType, { kind: "functionType" }> | undefined => {
  if (declarator?.type?.kind === "functionType") {
    return declarator.type;
  }

  const initializerType = declarator?.initializer?.inferredType;
  if (initializerType?.kind === "functionType") {
    return initializerType;
  }

  return undefined;
};

export const stableSerializeBindingSemanticValue = (value: unknown): string => {
  const seen = new Map<object, number>();

  const encode = (current: unknown): unknown => {
    if (current === null || current === undefined) {
      return null;
    }

    if (typeof current !== "object") {
      return current;
    }

    const cachedId = seen.get(current);
    if (cachedId !== undefined) {
      return { $ref: cachedId };
    }

    const id = seen.size;
    seen.set(current, id);

    if (Array.isArray(current)) {
      return {
        $id: id,
        $array: current.map((item) => encode(item)),
      };
    }

    const encoded: Record<string, unknown> = { $id: id };
    for (const key of Object.keys(current).sort((left, right) =>
      left.localeCompare(right)
    )) {
      encoded[key] = encode((current as Record<string, unknown>)[key]);
    }
    return encoded;
  };

  return JSON.stringify(encode(value));
};

export const areBindingSemanticSignaturesEqual = (
  left:
    | {
        readonly typeParameters?: readonly string[];
        readonly parameters: readonly IrParameter[];
        readonly returnType?: IrType;
      }
    | undefined,
  right:
    | {
        readonly typeParameters?: readonly string[];
        readonly parameters: readonly IrParameter[];
        readonly returnType?: IrType;
      }
    | undefined
): boolean =>
  stableSerializeBindingSemanticValue(left) ===
  stableSerializeBindingSemanticValue(right);

export const areBindingSemanticsEqual = (
  left: FirstPartyBindingsExport,
  right: FirstPartyBindingsExport
): boolean =>
  left.kind === right.kind &&
  left.clrName === right.clrName &&
  left.declaringClrType === right.declaringClrType &&
  left.declaringAssemblyName === right.declaringAssemblyName &&
  left.semanticOptional === right.semanticOptional &&
  stableSerializeBindingSemanticValue(left.semanticType) ===
    stableSerializeBindingSemanticValue(right.semanticType) &&
  areBindingSemanticSignaturesEqual(
    left.semanticSignature,
    right.semanticSignature
  );

export const isIrTypeNode = (value: unknown): value is IrType => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const kind = candidate.kind;
  if (typeof kind !== "string") {
    return false;
  }

  switch (kind) {
    case "primitiveType":
      return typeof candidate.name === "string";
    case "referenceType":
    case "typeParameterType":
      return typeof candidate.name === "string";
    case "arrayType":
      return "elementType" in candidate;
    case "tupleType":
      return Array.isArray(candidate.elementTypes);
    case "functionType":
      return Array.isArray(candidate.parameters) && "returnType" in candidate;
    case "objectType":
      return Array.isArray(candidate.members);
    case "dictionaryType":
      return "keyType" in candidate && "valueType" in candidate;
    case "unionType":
    case "intersectionType":
      return Array.isArray(candidate.types);
    case "literalType":
      return "value" in candidate;
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return true;
  }

  return false;
};

export const serializeRecursiveBindingType = (
  type: IrType,
  serialize: (value: unknown) => unknown
): IrType => {
  switch (type.kind) {
    case "primitiveType":
      return { ...type };
    case "referenceType":
      return {
        kind: "referenceType",
        name: type.name,
        ...(type.typeArguments
          ? {
              typeArguments: type.typeArguments.map(
                (argument) => serialize(argument) as IrType
              ),
            }
          : {}),
        ...(type.resolvedClrType
          ? { resolvedClrType: type.resolvedClrType }
          : {}),
        ...(type.typeId ? { typeId: { ...type.typeId } } : {}),
      };
    case "typeParameterType":
      return { ...type };
    case "arrayType":
      return {
        kind: "arrayType",
        elementType: serialize(type.elementType) as IrType,
        ...(type.origin ? { origin: type.origin } : {}),
        ...(type.tuplePrefixElementTypes
          ? {
              tuplePrefixElementTypes: type.tuplePrefixElementTypes.map(
                (elementType) => serialize(elementType) as IrType
              ),
            }
          : {}),
        ...(type.tupleRestElementType
          ? {
              tupleRestElementType: serialize(
                type.tupleRestElementType
              ) as IrType,
            }
          : {}),
      };
    case "tupleType":
      return {
        kind: "tupleType",
        elementTypes: type.elementTypes.map(
          (elementType) => serialize(elementType) as IrType
        ),
      };
    case "functionType":
      return {
        kind: "functionType",
        parameters: type.parameters.map(
          (parameter) => serialize(parameter) as IrParameter
        ),
        returnType: serialize(type.returnType) as IrType,
      };
    case "objectType":
      return {
        kind: "objectType",
        members: type.members.map(
          (member) => serialize(member) as IrInterfaceMember
        ),
      };
    case "dictionaryType":
      return {
        kind: "dictionaryType",
        keyType: serialize(type.keyType) as IrType,
        valueType: serialize(type.valueType) as IrType,
      };
    case "unionType":
      return {
        kind: "unionType",
        types: type.types.map((member) => serialize(member) as IrType),
      };
    case "intersectionType":
      return {
        kind: "intersectionType",
        types: type.types.map((member) => serialize(member) as IrType),
      };
    case "literalType":
      return { ...type };
    case "anyType":
      return { kind: "anyType" };
    case "unknownType":
      return { kind: "unknownType" };
    case "voidType":
      return { kind: "voidType" };
    case "neverType":
      return { kind: "neverType" };
  }
};

export const serializeBindingsJsonSafe = <T>(value: T): T => {
  const active = new Set<object>();
  const cache = new Map<object, unknown>();

  const collapseRecursiveValue = (current: object): unknown => {
    if (isIrTypeNode(current)) {
      return serializeRecursiveBindingType(current, serialize);
    }

    const collapsed: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(current)) {
      if (
        child === null ||
        typeof child === "string" ||
        typeof child === "number" ||
        typeof child === "boolean"
      ) {
        collapsed[key] = child;
      }
    }
    return collapsed;
  };

  const serialize = (current: unknown): unknown => {
    if (current === null || current === undefined) {
      return current;
    }

    if (
      typeof current === "string" ||
      typeof current === "number" ||
      typeof current === "boolean"
    ) {
      return current;
    }

    if (typeof current !== "object") {
      return current;
    }

    if (active.has(current)) {
      return collapseRecursiveValue(current);
    }

    const cached = cache.get(current);
    if (cached !== undefined) {
      return cached;
    }

    if (Array.isArray(current)) {
      const cloned: unknown[] = [];
      cache.set(current, cloned);
      active.add(current);
      for (const item of current) {
        cloned.push(serialize(item));
      }
      active.delete(current);
      return cloned;
    }

    if (isIrTypeNode(current)) {
      active.add(current);
      const cloned = serializeRecursiveBindingType(current, serialize);
      cache.set(current, cloned);
      active.delete(current);
      return cloned;
    }

    const cloned: Record<string, unknown> = {};
    cache.set(current, cloned);
    active.add(current);
    for (const [key, child] of Object.entries(current)) {
      cloned[key] = serialize(child);
    }
    active.delete(current);
    return cloned;
  };

  return serialize(value) as T;
};

export const toSignatureType = (
  type: IrType | undefined,
  typeParametersInScope: readonly string[],
  localTypeNameRemaps: ReadonlyMap<string, string> = new Map()
): string => {
  if (!type) return "System.Object";

  switch (type.kind) {
    case "primitiveType":
      return primitiveSignatureType(type.name);
    case "literalType":
      if (typeof type.value === "string") return "System.String";
      if (typeof type.value === "boolean") return "System.Boolean";
      if (typeof type.value === "number") return "System.Double";
      return "System.Object";
    case "voidType":
      return "System.Void";
    case "neverType":
    case "unknownType":
    case "anyType":
      return "System.Object";
    case "typeParameterType":
      return type.name;
    case "arrayType":
      return `${toSignatureType(type.elementType, typeParametersInScope, localTypeNameRemaps)}[]`;
    case "tupleType":
    case "objectType":
    case "functionType":
    case "dictionaryType":
      return "System.Object";
    case "intersectionType":
      return toSignatureType(
        type.types[0],
        typeParametersInScope,
        localTypeNameRemaps
      );
    case "unionType": {
      const nonUndefined = type.types.filter((candidate) => {
        return !(
          candidate.kind === "primitiveType" && candidate.name === "undefined"
        );
      });
      if (nonUndefined.length === 1 && nonUndefined[0]) {
        const single = toSignatureType(
          nonUndefined[0],
          typeParametersInScope,
          localTypeNameRemaps
        );
        if (isNumericValueType(single)) {
          return `System.Nullable\`1[[${single}]]`;
        }
        return single;
      }
      return "System.Object";
    }
    case "referenceType": {
      if (typeParametersInScope.includes(type.name)) return type.name;
      const normalizedName = normalizeTypeReferenceName(
        localTypeNameRemaps.get(type.name) ?? type.name,
        type.typeArguments?.length
      );
      if (!type.typeArguments || type.typeArguments.length === 0) {
        return normalizedName;
      }
      const args = type.typeArguments
        .map((arg) =>
          toSignatureType(arg, typeParametersInScope, localTypeNameRemaps)
        )
        .join(",");
      return `${normalizedName}[[${args}]]`;
    }
    default:
      return "System.Object";
  }
};

export const buildParameterModifiers = (
  parameters: readonly IrParameter[]
): readonly {
  readonly index: number;
  readonly modifier: "ref" | "out" | "in";
}[] => {
  const modifiers = parameters
    .map((parameter, index) => {
      if (parameter.passing === "value") return undefined;
      return { index, modifier: parameter.passing };
    })
    .filter((modifier) => modifier !== undefined);

  return modifiers;
};

export const makeMethodBinding = (opts: {
  readonly declaringClrType: string;
  readonly declaringAssemblyName: string;
  readonly methodName: string;
  readonly parameters: readonly IrParameter[];
  readonly returnType: IrType | undefined;
  readonly typeParameters?: readonly IrTypeParameter[];
  readonly overloadFamily?: import("@tsonic/frontend").IrOverloadFamilyMember;
  readonly arity: number;
  readonly parameterModifiers: readonly {
    readonly index: number;
    readonly modifier: "ref" | "out" | "in";
  }[];
  readonly isStatic: boolean;
  readonly isAbstract?: boolean;
  readonly isVirtual?: boolean;
  readonly isOverride?: boolean;
  readonly isSealed?: boolean;
  readonly localTypeNameRemaps?: ReadonlyMap<string, string>;
}): FirstPartyBindingsMethod => {
  const typeParameterScope = Array.from(
    new Set(
      opts.parameters
        .map((parameter) =>
          parameter.type?.kind === "typeParameterType"
            ? parameter.type.name
            : undefined
        )
        .filter((name): name is string => name !== undefined)
    )
  );

  const normalizedSignature = `${opts.methodName}|(${opts.parameters
    .map((parameter) =>
      toSignatureType(
        parameter.type,
        typeParameterScope,
        opts.localTypeNameRemaps
      )
    )
    .join(",")}):${toSignatureType(
    opts.returnType,
    typeParameterScope,
    opts.localTypeNameRemaps
  )}|static=${opts.isStatic ? "true" : "false"}`;
  const stableId = `${toStableId(
    opts.declaringAssemblyName,
    opts.declaringClrType
  )}::method:${opts.methodName}|${normalizedSignature}`;

  return {
    stableId,
    clrName: opts.methodName,
    normalizedSignature,
    semanticSignature: buildSemanticSignature({
      typeParameters: opts.typeParameters,
      parameters: opts.parameters,
      returnType: opts.returnType,
      localTypeNameRemaps: opts.localTypeNameRemaps ?? new Map(),
    }),
    overloadFamily: opts.overloadFamily,
    arity: opts.arity,
    parameterCount: opts.parameters.length,
    isStatic: opts.isStatic,
    isAbstract: opts.isAbstract ?? false,
    isVirtual: opts.isVirtual ?? false,
    isOverride: opts.isOverride ?? false,
    isSealed: opts.isSealed ?? false,
    declaringClrType: opts.declaringClrType,
    declaringAssemblyName: opts.declaringAssemblyName,
    parameterModifiers:
      opts.parameterModifiers.length > 0 ? opts.parameterModifiers : undefined,
    isExtensionMethod: false,
  };
};

export const isPublicOverloadSurfaceMethod = (
  member: IrMethodDeclaration
): boolean => member.overloadFamily?.role !== "implementation";
