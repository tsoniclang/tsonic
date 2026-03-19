import type {
  IrInterfaceMember,
  IrParameter,
  IrType,
  IrTypeParameter,
} from "@tsonic/frontend";
import { normalizeTypeReferenceName } from "../portable-types.js";

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
