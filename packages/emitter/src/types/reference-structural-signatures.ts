import {
  IrType,
  stableIrTypeKey,
  type TypeBinding as FrontendTypeBinding,
} from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import type { LocalTypeInfo } from "../emitter-types/core.js";
import { resolveLocalTypeInfo } from "../core/semantic/type-resolution.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import { clrTypeNameToTypeAst } from "../core/format/backend-ast/utils.js";

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

const stableStructuralIrTypeKey = (type: IrType): string => {
  if (type.kind === "literalType") {
    if (typeof type.value === "string") {
      return stableIrTypeKey({ kind: "primitiveType", name: "string" });
    }
    if (typeof type.value === "number") {
      return stableIrTypeKey({ kind: "primitiveType", name: "number" });
    }
    if (typeof type.value === "boolean") {
      return stableIrTypeKey({ kind: "primitiveType", name: "boolean" });
    }
  }

  if (type.kind === "unionType") {
    return stableIrTypeKey({
      ...type,
      types: type.types.map((member) => stableStructuralComparableType(member)),
    });
  }

  return stableIrTypeKey(type);
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
  member: StructuralSignatureMember
): string => {
  if (member.kind === "propertySignature") {
    return `prop:${member.name}:${member.isOptional ? "opt" : "req"}:${member.isReadonly ? "ro" : "rw"}:${stableStructuralIrTypeKey(member.type)}`;
  }
  if (member.kind === "methodSignature") {
    const parameters = member.parameters.map((parameter) =>
      stableStructuralIrTypeKey(parameter.type ?? { kind: "unknownType" })
    );
    return `method:${member.name}:${parameters.join(",")}:${member.parameters.length}:${stableStructuralIrTypeKey(member.returnType ?? { kind: "unknownType" })}`;
  }
  if (member.kind === "property") {
    return `prop:${member.alias}:${member.semanticOptional === true ? "opt" : "req"}:rw:${stableStructuralIrTypeKey(member.semanticType)}`;
  }
  const parameters = member.semanticSignature.parameters.map((parameter) =>
    stableStructuralIrTypeKey(parameter.type ?? { kind: "unknownType" })
  );
  return `method:${member.alias}:${parameters.join(",")}:${member.semanticSignature.parameters.length}:${stableStructuralIrTypeKey(member.semanticSignature.returnType ?? { kind: "unknownType" })}`;
};

const buildLocalTypeStructuralSignature = (
  localInfo: LocalTypeInfo | undefined
): string | undefined => {
  if (
    !localInfo ||
    (localInfo.kind !== "class" && localInfo.kind !== "interface")
  ) {
    return undefined;
  }

  const members = localInfo.members
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
    )
    .map((member) => {
      if (member.kind === "property") {
        return `prop:${member.alias}:${member.semanticOptional === true ? "opt" : "req"}:rw:${stableStructuralIrTypeKey(member.semanticType)}`;
      }
      return `method:${member.alias}:${member.parameters
        .map((parameter) => stableStructuralIrTypeKey(parameter))
        .join(
          ","
        )}:${member.parameters.length}:${stableStructuralIrTypeKey(member.returnType)}`;
    })
    .sort();

  return members.length === 0 ? undefined : members.join("|");
};

const buildReferenceStructuralSignature = (
  type: Extract<IrType, { kind: "referenceType" }>
): string | undefined => {
  const members = (type.structuralMembers ?? [])
    .filter(
      (member): member is StructuralReferenceMember =>
        member.kind === "propertySignature" || member.kind === "methodSignature"
    )
    .map(getStructuralMemberSignatureKey)
    .sort();

  return members.length === 0 ? undefined : members.join("|");
};

const buildBindingStructuralSignature = (
  binding: FrontendTypeBinding
): string | undefined => {
  const members = binding.members
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
    })
    .map(getStructuralMemberSignatureKey)
    .sort();

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
    buildReferenceStructuralSignature(type) ??
    buildLocalTypeStructuralSignature(
      resolveLocalTypeInfo(type, context)?.info
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

      const localSignature = buildLocalTypeStructuralSignature(info);
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
    const bindingSignature = buildBindingStructuralSignature(binding);
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
    buildReferenceStructuralSignature(type) ??
    buildLocalTypeStructuralSignature(
      resolveLocalTypeInfo(type, context)?.info
    );
  if (!signature) {
    return undefined;
  }

  const matches = new Map<string, FrontendTypeBinding>();
  for (const binding of context.bindingsRegistry?.values() ?? []) {
    const bindingSignature = buildBindingStructuralSignature(binding);
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
