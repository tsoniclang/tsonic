import {
  IrType,
  type TypeBinding as FrontendTypeBinding,
} from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import type { LocalTypeInfo } from "../emitter-types/core.js";
import { resolveLocalTypeInfo } from "../core/semantic/type-resolution.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import { clrTypeNameToTypeAst } from "../core/format/backend-ast/utils.js";
import { tryContextualTypeIdentityKey } from "../core/semantic/deterministic-type-keys.js";

type StructuralReferenceMember = Extract<
  NonNullable<
    Extract<IrType, { kind: "referenceType" }>["structuralMembers"]
  >[number],
  { kind: "propertySignature" | "methodSignature" }
>;

type BindingStructuralPropertyMember = {
  readonly kind: "property";
  readonly alias: string;
  readonly semanticType: IrType;
  readonly semanticOptional?: boolean;
};

type BindingStructuralMethodMember = {
  readonly kind: "method";
  readonly alias: string;
  readonly semanticSignature: NonNullable<
    FrontendTypeBinding["members"][number]["semanticSignature"]
  >;
};

type StructuralSignatureMember =
  | StructuralReferenceMember
  | BindingStructuralPropertyMember
  | BindingStructuralMethodMember;

type LocalStructuralPropertyMember = {
  readonly kind: "property";
  readonly alias: string;
  readonly semanticType: IrType;
  readonly semanticOptional?: boolean;
};

type LocalStructuralMethodMember = {
  readonly kind: "method";
  readonly alias: string;
  readonly parameters: readonly IrType[];
  readonly returnType: IrType;
};

type StructuralReferenceMatch = {
  readonly key: string;
  readonly name: string;
  readonly resolvedClrType: string;
  readonly isExternal: boolean;
};

const toGlobalClr = (clr: string): string => {
  const trimmed = clr.trim();
  return trimmed.startsWith("global::") ? trimmed : `global::${trimmed}`;
};

const stableStructuralIrTypeKey = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  if (type.kind === "literalType") {
    if (typeof type.value === "string") {
      return tryContextualTypeIdentityKey(
        { kind: "primitiveType", name: "string" },
        context
      );
    }
    if (typeof type.value === "number") {
      return tryContextualTypeIdentityKey(
        { kind: "primitiveType", name: "number" },
        context
      );
    }
    if (typeof type.value === "boolean") {
      return tryContextualTypeIdentityKey(
        { kind: "primitiveType", name: "boolean" },
        context
      );
    }
  }

  if (type.kind === "unionType") {
    return tryContextualTypeIdentityKey(
      {
        ...type,
        types: type.types.map((member) =>
          stableStructuralComparableType(member)
        ),
      },
      context
    );
  }

  return tryContextualTypeIdentityKey(type, context);
};

const stableStructuralComparableType = (type: IrType): IrType => {
  if (type.kind === "literalType") {
    if (typeof type.value === "string") {
      return { kind: "primitiveType", name: "string" };
    }
    if (typeof type.value === "number") {
      return { kind: "primitiveType", name: "number" };
    }
    if (typeof type.value === "boolean") {
      return { kind: "primitiveType", name: "boolean" };
    }
  }
  if (type.kind === "unionType") {
    return {
      ...type,
      types: type.types.map((member) => stableStructuralComparableType(member)),
    };
  }
  return type;
};

const getStructuralMemberSignatureKey = (
  member: StructuralSignatureMember,
  context: EmitterContext
): string | undefined => {
  if (member.kind === "propertySignature") {
    const typeKey = stableStructuralIrTypeKey(member.type, context);
    return typeKey
      ? `prop:${member.name}:${member.isOptional ? "opt" : "req"}:${
          member.isReadonly ? "ro" : "rw"
        }:${typeKey}`
      : undefined;
  }
  if (member.kind === "methodSignature") {
    const parameters: string[] = [];
    for (const parameter of member.parameters) {
      const parameterKey = stableStructuralIrTypeKey(
        parameter.type ?? { kind: "unknownType" },
        context
      );
      if (!parameterKey) {
        return undefined;
      }
      parameters.push(parameterKey);
    }
    const returnTypeKey = stableStructuralIrTypeKey(
      member.returnType ?? { kind: "unknownType" },
      context
    );
    return returnTypeKey
      ? `method:${member.name}:${parameters.join(",")}:${
          member.parameters.length
        }:${returnTypeKey}`
      : undefined;
  }
  if (member.kind === "property") {
    const typeKey = stableStructuralIrTypeKey(member.semanticType, context);
    return typeKey
      ? `prop:${member.alias}:${
          member.semanticOptional === true ? "opt" : "req"
        }:rw:${typeKey}`
      : undefined;
  }
  const parameters: string[] = [];
  for (const parameter of member.semanticSignature.parameters) {
    const parameterKey = stableStructuralIrTypeKey(
      parameter.type ?? { kind: "unknownType" },
      context
    );
    if (!parameterKey) {
      return undefined;
    }
    parameters.push(parameterKey);
  }
  const returnTypeKey = stableStructuralIrTypeKey(
    member.semanticSignature.returnType ?? { kind: "unknownType" },
    context
  );
  return returnTypeKey
    ? `method:${member.alias}:${parameters.join(",")}:${
        member.semanticSignature.parameters.length
      }:${returnTypeKey}`
    : undefined;
};

const buildLocalTypeStructuralSignature = (
  localInfo: LocalTypeInfo | undefined,
  context: EmitterContext
): string | undefined => {
  if (
    !localInfo ||
    (localInfo.kind !== "class" && localInfo.kind !== "interface")
  ) {
    return undefined;
  }

  const rawMembers = localInfo.members
    .flatMap<LocalStructuralPropertyMember | LocalStructuralMethodMember>(
      (member) => {
        if (member.kind === "propertyDeclaration" && member.type) {
          return {
            kind: "property",
            alias: member.name,
            semanticType: member.type,
            semanticOptional: false,
          };
        }
        if (member.kind === "propertySignature" && member.type) {
          return {
            kind: "property",
            alias: member.name,
            semanticType: member.type,
            semanticOptional: member.isOptional,
          };
        }
        if (member.kind === "methodDeclaration") {
          return {
            kind: "method",
            alias: member.name,
            parameters: member.parameters.map(
              (parameter) => parameter.type ?? { kind: "unknownType" }
            ),
            returnType: member.returnType ?? { kind: "unknownType" },
          };
        }
        if (member.kind === "methodSignature") {
          return {
            kind: "method",
            alias: member.name,
            parameters: member.parameters.map(
              (parameter) => parameter.type ?? { kind: "unknownType" }
            ),
            returnType: member.returnType ?? { kind: "unknownType" },
          };
        }
        return [];
      }
    );

  const members: string[] = [];
  for (const member of rawMembers) {
    if (member.kind === "property") {
      const typeKey = stableStructuralIrTypeKey(member.semanticType, context);
      if (!typeKey) {
        return undefined;
      }
      members.push(
        `prop:${member.alias}:${
          member.semanticOptional === true ? "opt" : "req"
        }:rw:${typeKey}`
      );
      continue;
    }

    const parameterKeys: string[] = [];
    for (const parameter of member.parameters) {
      const parameterKey = stableStructuralIrTypeKey(parameter, context);
      if (!parameterKey) {
        return undefined;
      }
      parameterKeys.push(parameterKey);
    }
    const returnTypeKey = stableStructuralIrTypeKey(member.returnType, context);
    if (!returnTypeKey) {
      return undefined;
    }
    members.push(
      `method:${member.alias}:${parameterKeys.join(",")}:${
        member.parameters.length
      }:${returnTypeKey}`
    );
  }
  members.sort();

  return members.length === 0 ? undefined : members.join("|");
};

const buildReferenceStructuralSignature = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): string | undefined => {
  const rawMembers = (type.structuralMembers ?? [])
    .filter(
      (member): member is StructuralReferenceMember =>
        member.kind === "propertySignature" || member.kind === "methodSignature"
    );

  const members: string[] = [];
  for (const member of rawMembers) {
    const memberKey = getStructuralMemberSignatureKey(member, context);
    if (!memberKey) {
      return undefined;
    }
    members.push(memberKey);
  }
  members.sort();

  return members.length === 0 ? undefined : members.join("|");
};

const buildBindingStructuralSignature = (
  binding: FrontendTypeBinding,
  context: EmitterContext
): string | undefined => {
  const rawMembers = binding.members
    .flatMap<StructuralSignatureMember>((member) => {
      if (member.kind === "property" && member.semanticType) {
        return {
          kind: "property",
          alias: member.alias,
          semanticType: member.semanticType,
          semanticOptional: member.semanticOptional,
        };
      }
      if (member.kind === "method" && member.semanticSignature) {
        return {
          kind: "method",
          alias: member.alias,
          semanticSignature: member.semanticSignature,
        };
      }
      return [];
    });

  const members: string[] = [];
  for (const member of rawMembers) {
    const memberKey = getStructuralMemberSignatureKey(member, context);
    if (!memberKey) {
      return undefined;
    }
    members.push(memberKey);
  }
  members.sort();

  return members.length === 0 ? undefined : members.join("|");
};

const isCompilerGeneratedStructuralName = (name: string | undefined): boolean =>
  !!name && (name.startsWith("__Anon_") || name.startsWith("__Rest_"));

const collectCanonicalStructuralMatches = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): readonly StructuralReferenceMatch[] => {
  if (!isCompilerGeneratedStructuralName(type.name)) {
    return [];
  }

  const signature =
    buildReferenceStructuralSignature(type, context) ??
    buildLocalTypeStructuralSignature(
      resolveLocalTypeInfo(type, context)?.info,
      context
    );
  if (!signature) {
    return [];
  }

  const currentNamespace =
    context.moduleNamespace ?? context.options.rootNamespace;
  const matches = new Map<string, StructuralReferenceMatch>();
  const addMatch = (
    name: string,
    resolvedClrType: string,
    isExternal: boolean
  ): void => {
    matches.set(resolvedClrType, {
      key: resolvedClrType,
      name,
      resolvedClrType,
      isExternal,
    });
  };

  const collectLocalMatches = (
    localTypes: ReadonlyMap<string, LocalTypeInfo>,
    namespace: string
  ): void => {
    for (const [typeName, info] of localTypes.entries()) {
      if (!isCompilerGeneratedStructuralName(typeName)) {
        continue;
      }

      const localSignature = buildLocalTypeStructuralSignature(info, context);
      if (!localSignature || localSignature !== signature) {
        continue;
      }

      addMatch(
        typeName,
        `${namespace}.${typeName}`,
        namespace !== currentNamespace
      );
    }
  };

  if (context.localTypes) {
    collectLocalMatches(context.localTypes, currentNamespace);
  }
  if (context.options.moduleMap) {
    for (const module of context.options.moduleMap.values()) {
      if (!module.localTypes) {
        continue;
      }
      collectLocalMatches(module.localTypes, module.namespace);
    }
  }

  for (const binding of context.bindingsRegistry?.values() ?? []) {
    const bindingSignature = buildBindingStructuralSignature(binding, context);
    if (!bindingSignature || bindingSignature !== signature) {
      continue;
    }

    const aliasLeaf = binding.alias.split(".").pop() ?? binding.alias;
    const nameLeaf = binding.name.split(".").pop() ?? binding.name;
    const preferredName = isCompilerGeneratedStructuralName(aliasLeaf)
      ? aliasLeaf
      : nameLeaf;
    if (!isCompilerGeneratedStructuralName(preferredName)) {
      continue;
    }

    addMatch(
      preferredName,
      binding.name,
      !binding.name.startsWith(`${currentNamespace}.`)
    );
  }

  return [...matches.values()];
};

const pickCanonicalStructuralMatch = (
  type: Extract<IrType, { kind: "referenceType" }>,
  matches: readonly StructuralReferenceMatch[]
): StructuralReferenceMatch | undefined => {
  if (matches.length === 0) {
    return undefined;
  }

  const exactNameMatches = matches.filter((match) => match.name === type.name);
  if (exactNameMatches.length === 1) {
    return exactNameMatches[0];
  }

  if (matches.length === 1) {
    return matches[0];
  }

  const externalMatches = matches.filter((match) => match.isExternal);
  if (externalMatches.length === 1) {
    return externalMatches[0];
  }

  return undefined;
};

export const resolveBindingBackedStructuralTypeAst = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): CSharpTypeAst | undefined => {
  if (!type.structuralMembers || type.structuralMembers.length === 0) {
    return undefined;
  }
  if (!type.name.startsWith("__Anon_")) {
    return undefined;
  }

  const signature =
    buildReferenceStructuralSignature(type, context) ??
    buildLocalTypeStructuralSignature(
      resolveLocalTypeInfo(type, context)?.info,
      context
    );
  if (!signature) {
    return undefined;
  }

  const matches = new Map<string, FrontendTypeBinding>();
  for (const binding of context.bindingsRegistry?.values() ?? []) {
    const bindingSignature = buildBindingStructuralSignature(binding, context);
    if (!bindingSignature || bindingSignature !== signature) {
      continue;
    }
    matches.set(binding.name, binding);
  }

  if (matches.size !== 1) {
    return undefined;
  }

  const match = [...matches.values()][0];
  return match ? clrTypeNameToTypeAst(toGlobalClr(match.name)) : undefined;
};

export const resolveCanonicalStructuralReferenceTypeAst = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): CSharpTypeAst | undefined => {
  const match = pickCanonicalStructuralMatch(
    type,
    collectCanonicalStructuralMatches(type, context)
  );
  return match
    ? clrTypeNameToTypeAst(toGlobalClr(match.resolvedClrType))
    : undefined;
};
