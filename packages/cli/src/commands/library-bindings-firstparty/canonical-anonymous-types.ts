import type {
  IrInterfaceMember,
  IrParameter,
  IrType,
} from "@tsonic/frontend";
import type {
  FirstPartyBindingsExport,
  FirstPartyBindingsType,
  SourceAnonymousStructuralAliasPlan,
} from "./types.js";

type RewriteCaches = {
  readonly types: WeakMap<object, IrType>;
  readonly members: WeakMap<object, IrInterfaceMember>;
};

const createRewriteCaches = (): RewriteCaches => ({
  types: new WeakMap<object, IrType>(),
  members: new WeakMap<object, IrInterfaceMember>(),
});

export const buildAnonymousAliasNamespaceMap = (
  aliases: readonly SourceAnonymousStructuralAliasPlan[]
): ReadonlyMap<string, string> =>
  new Map(
    aliases.map((alias) => [alias.name, alias.declaringNamespace] as const)
  );

const rewriteAnonymousMemberNamespaces = (
  member: IrInterfaceMember,
  aliasNamespacesByName: ReadonlyMap<string, string>,
  caches: RewriteCaches
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
      rewriteAnonymousTypeNamespaces(
        member.type,
        aliasNamespacesByName,
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
      rewriteAnonymousParameterNamespaces(
        parameter,
        aliasNamespacesByName,
        caches
      )
    );
  (rewritten as { returnType: typeof member.returnType }).returnType =
    rewriteAnonymousTypeNamespaces(
      member.returnType,
      aliasNamespacesByName,
      caches
    ) ?? member.returnType;
  return rewritten;
};

const rewriteAnonymousParameterNamespaces = (
  parameter: IrParameter,
  aliasNamespacesByName: ReadonlyMap<string, string>,
  caches: RewriteCaches
): IrParameter => ({
  ...parameter,
  type: rewriteAnonymousTypeNamespaces(
    parameter.type,
    aliasNamespacesByName,
    caches
  ),
});

export const rewriteAnonymousTypeNamespaces = (
  type: IrType | undefined,
  aliasNamespacesByName: ReadonlyMap<string, string>,
  caches: RewriteCaches = createRewriteCaches()
): IrType | undefined => {
  if (!type) return undefined;

  const cached = caches.types.get(type);
  if (cached) return cached;

  switch (type.kind) {
    case "referenceType": {
      const aliasNamespace = aliasNamespacesByName.get(type.name);
      const rewritten: IrType = {
        ...type,
        resolvedClrType: aliasNamespace
          ? `${aliasNamespace}.${type.name}`
          : type.resolvedClrType,
        typeArguments: undefined,
        structuralMembers: undefined,
      };
      caches.types.set(type, rewritten);
      (rewritten as { typeArguments?: typeof type.typeArguments }).typeArguments =
        type.typeArguments?.map((typeArgument) =>
          rewriteAnonymousTypeNamespaces(
            typeArgument,
            aliasNamespacesByName,
            caches
          )
        ) as readonly IrType[] | undefined;
      (
        rewritten as { structuralMembers?: typeof type.structuralMembers }
      ).structuralMembers = type.structuralMembers?.map((member) =>
        rewriteAnonymousMemberNamespaces(
          member,
          aliasNamespacesByName,
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
        rewriteAnonymousTypeNamespaces(
          type.elementType,
          aliasNamespacesByName,
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
          rewriteAnonymousTypeNamespaces(
            elementType,
            aliasNamespacesByName,
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
          rewriteAnonymousParameterNamespaces(
            parameter,
            aliasNamespacesByName,
            caches
          )
        );
      (rewritten as { returnType: typeof type.returnType }).returnType =
        rewriteAnonymousTypeNamespaces(
          type.returnType,
          aliasNamespacesByName,
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
      (rewritten as { members: typeof type.members }).members =
        type.members.map((member) =>
          rewriteAnonymousMemberNamespaces(
            member,
            aliasNamespacesByName,
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
        rewriteAnonymousTypeNamespaces(
          type.keyType,
          aliasNamespacesByName,
          caches
        ) ?? type.keyType;
      (rewritten as { valueType: typeof type.valueType }).valueType =
        rewriteAnonymousTypeNamespaces(
          type.valueType,
          aliasNamespacesByName,
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
          rewriteAnonymousTypeNamespaces(
            candidate,
            aliasNamespacesByName,
            caches
          )
      ) as readonly IrType[];
      return rewritten;
    }
    default:
      return type;
  }
};

export const rewriteAnonymousBindingExportNamespaces = (
  binding: FirstPartyBindingsExport,
  aliasNamespacesByName: ReadonlyMap<string, string>
): FirstPartyBindingsExport => ({
  ...binding,
  semanticType: rewriteAnonymousTypeNamespaces(
    binding.semanticType,
    aliasNamespacesByName
  ),
  semanticSignature: binding.semanticSignature
    ? {
        typeParameters: binding.semanticSignature.typeParameters,
        parameters: binding.semanticSignature.parameters.map((parameter) =>
          rewriteAnonymousParameterNamespaces(
            parameter,
            aliasNamespacesByName,
            createRewriteCaches()
          )
        ),
        returnType: rewriteAnonymousTypeNamespaces(
          binding.semanticSignature.returnType,
          aliasNamespacesByName
        ),
      }
    : undefined,
});

export const rewriteAnonymousBindingsTypeNamespaces = (
  typeBinding: FirstPartyBindingsType,
  aliasNamespacesByName: ReadonlyMap<string, string>
): FirstPartyBindingsType => ({
  ...typeBinding,
  methods: typeBinding.methods.map((method) => ({
    ...method,
    semanticSignature: method.semanticSignature
      ? {
          typeParameters: method.semanticSignature.typeParameters,
          parameters: method.semanticSignature.parameters.map((parameter) =>
            rewriteAnonymousParameterNamespaces(
              parameter,
              aliasNamespacesByName,
              createRewriteCaches()
            )
          ),
          returnType: rewriteAnonymousTypeNamespaces(
            method.semanticSignature.returnType,
            aliasNamespacesByName
          ),
        }
      : undefined,
  })),
  properties: typeBinding.properties.map((property) => ({
    ...property,
    semanticType: rewriteAnonymousTypeNamespaces(
      property.semanticType,
      aliasNamespacesByName
    ),
  })),
  fields: typeBinding.fields.map((field) => ({
    ...field,
    semanticType: rewriteAnonymousTypeNamespaces(
      field.semanticType,
      aliasNamespacesByName
    ),
  })),
});
