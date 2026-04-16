import { createHash } from "node:crypto";
import type { CSharpTypeAst } from "../format/backend-ast/types.js";
import { stableTypeKeyFromAst } from "../format/backend-ast/utils.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";

export type RuntimeUnionCarrierMetadata = {
  readonly familyKey: string;
  readonly name?: string;
  readonly namespaceName?: string;
  readonly typeParameters?: readonly string[];
  readonly definitionMemberTypeAsts?: readonly CSharpTypeAst[];
  readonly accessModifier?: "public" | "internal";
};

export type RuntimeUnionCarrierDefinition = {
  readonly key: string;
  readonly name: string;
  readonly namespaceName: string;
  readonly fullName: string;
  readonly arity: number;
  readonly typeParameters: readonly string[];
  readonly memberTypeAsts: readonly CSharpTypeAst[];
  readonly memberTypeKeys: readonly string[];
  readonly accessModifier: "public" | "internal";
};

export type RuntimeUnionRegistry = {
  readonly definitions: Map<string, RuntimeUnionCarrierDefinition>;
  readonly definitionsByName: Map<string, RuntimeUnionCarrierDefinition>;
};

export const createRuntimeUnionRegistry = (): RuntimeUnionRegistry => ({
  definitions: new Map(),
  definitionsByName: new Map(),
});

const buildRuntimeUnionCarrierKey = (
  memberTypeAsts: readonly CSharpTypeAst[],
  metadata?: RuntimeUnionCarrierMetadata
): string =>
  metadata
    ? `union:${metadata.familyKey}`
    : `union:${buildAnonymousRuntimeUnionFamilyKey(memberTypeAsts)}`;

const buildAnonymousRuntimeUnionFamilyKey = (
  memberTypeAsts: readonly CSharpTypeAst[]
): string => {
  const genericArgumentPlaceholders = new Map<string, string>();
  let nextGenericArgumentId = 0;

  const getGenericArgumentPlaceholder = (type: CSharpTypeAst): string => {
    const key = stableTypeKeyFromAst(type);
    const existing = genericArgumentPlaceholders.get(key);
    if (existing) {
      return existing;
    }

    const placeholder = `$${nextGenericArgumentId}`;
    nextGenericArgumentId += 1;
    genericArgumentPlaceholders.set(key, placeholder);
    return placeholder;
  };

  const generalizeTypeAst = (
    type: CSharpTypeAst,
    inTypeArgument = false
  ): string => {
    if (inTypeArgument) {
      return getGenericArgumentPlaceholder(type);
    }

    switch (type.kind) {
      case "predefinedType":
        return `predefined:${type.keyword}`;
      case "identifierType": {
        const args =
          type.typeArguments && type.typeArguments.length > 0
            ? `<${type.typeArguments
                .map((typeArgument) => generalizeTypeAst(typeArgument, true))
                .join(",")}>`
            : "";
        return `identifier:${type.name}${args}`;
      }
      case "qualifiedIdentifierType": {
        const qualifiedName =
          type.name.aliasQualifier !== undefined
            ? `${type.name.aliasQualifier}::${type.name.segments.join(".")}`
            : type.name.segments.join(".");
        const args =
          type.typeArguments && type.typeArguments.length > 0
            ? `<${type.typeArguments
                .map((typeArgument) => generalizeTypeAst(typeArgument, true))
                .join(",")}>`
            : "";
        return `qualifiedIdentifier:${qualifiedName}${args}`;
      }
      case "nullableType":
        return `nullable:${generalizeTypeAst(type.underlyingType)}`;
      case "arrayType":
        return `array:${type.rank}:${generalizeTypeAst(type.elementType)}`;
      case "pointerType":
        return `pointer:${generalizeTypeAst(type.elementType)}`;
      case "tupleType":
        return `tuple:${type.elements
          .map((element) =>
            element.name
              ? `${generalizeTypeAst(element.type)}:${element.name}`
              : generalizeTypeAst(element.type)
          )
          .join("|")}`;
      case "varType":
        return "var";
      default: {
        const exhaustive: never = type;
        throw new Error(
          `ICE: Unhandled CSharpTypeAst kind '${(exhaustive as CSharpTypeAst).kind}' in buildAnonymousRuntimeUnionFamilyKey`
        );
      }
    }
  };

  return memberTypeAsts.map((member) => generalizeTypeAst(member)).join("|");
};

const buildRuntimeUnionCarrierName = (
  key: string,
  arity: number,
  metadata?: RuntimeUnionCarrierMetadata
): string => {
  if (metadata?.name) {
    return escapeCSharpIdentifier(metadata.name);
  }

  const hash = createHash("md5")
    .update(key)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  return `Union${arity}_${hash}`;
};

const DEFAULT_RUNTIME_UNION_NAMESPACE = "Tsonic.Internal";

const normalizeRuntimeUnionCarrierName = (name: string): string => {
  const normalized = name.startsWith("global::")
    ? name.slice("global::".length)
    : name;
  return normalized;
};

export const getRuntimeUnionCarrierDefinitionByName = (
  name: string,
  registry: RuntimeUnionRegistry | undefined
): RuntimeUnionCarrierDefinition | undefined => {
  const normalized = normalizeRuntimeUnionCarrierName(name);
  return (
    registry?.definitionsByName.get(normalized) ??
    registry?.definitionsByName.get(normalized.split(".").pop() ?? normalized)
  );
};

export const getOrRegisterRuntimeUnionCarrier = (
  memberTypeAsts: readonly CSharpTypeAst[],
  registry: RuntimeUnionRegistry | undefined,
  metadata?: RuntimeUnionCarrierMetadata
): RuntimeUnionCarrierDefinition => {
  const key = buildRuntimeUnionCarrierKey(memberTypeAsts, metadata);
  const existing = registry?.definitions.get(key);
  if (existing) {
    if (!registry || !metadata) {
      return existing;
    }

    const defaultName = buildRuntimeUnionCarrierName(
      key,
      existing.arity,
      undefined
    );
    const nextName = metadata.name
      ? escapeCSharpIdentifier(metadata.name)
      : existing.name;
    if (
      metadata.name &&
      existing.name !== nextName &&
      existing.name !== defaultName
    ) {
      throw new Error(
        `ICE: Conflicting runtime union carrier names for family '${metadata.familyKey}': '${existing.name}' vs '${nextName}'.`
      );
    }

    const nextNamespaceName =
      metadata.namespaceName ?? existing.namespaceName;
    if (
      metadata.namespaceName &&
      existing.namespaceName !== metadata.namespaceName &&
      existing.namespaceName !== DEFAULT_RUNTIME_UNION_NAMESPACE
    ) {
      throw new Error(
        `ICE: Conflicting runtime union carrier namespaces for family '${metadata.familyKey}': '${existing.namespaceName}' vs '${metadata.namespaceName}'.`
      );
    }

    const defaultTypeParameters = Array.from(
      { length: existing.arity },
      (_, index) => `T${index + 1}`
    );
    const nextTypeParameters =
      metadata.typeParameters?.map(escapeCSharpIdentifier) ??
      existing.typeParameters;
    if (
      metadata.typeParameters &&
      existing.typeParameters.join(",") !== nextTypeParameters.join(",") &&
      existing.typeParameters.join(",") !== defaultTypeParameters.join(",")
    ) {
      throw new Error(
        `ICE: Conflicting runtime union carrier type parameters for family '${metadata.familyKey}'.`
      );
    }

    const defaultDefinitionMemberTypeAsts = defaultTypeParameters.map(
      (typeParameter) => ({
        kind: "identifierType" as const,
        name: typeParameter,
      })
    );
    const nextDefinitionMemberTypeAsts =
      metadata.definitionMemberTypeAsts ?? existing.memberTypeAsts;
    if (
      metadata.definitionMemberTypeAsts &&
      existing.memberTypeAsts.length === metadata.definitionMemberTypeAsts.length &&
      existing.memberTypeAsts.some(
        (memberTypeAst, index) =>
          stableTypeKeyFromAst(memberTypeAst) !==
            stableTypeKeyFromAst(
              metadata.definitionMemberTypeAsts?.[index] ?? memberTypeAst
            )
      ) &&
      existing.memberTypeAsts.some(
        (memberTypeAst, index) =>
          stableTypeKeyFromAst(memberTypeAst) !==
          stableTypeKeyFromAst(
            defaultDefinitionMemberTypeAsts[index] ?? memberTypeAst
          )
      )
    ) {
      throw new Error(
        `ICE: Conflicting runtime union carrier definition members for family '${metadata.familyKey}'.`
      );
    }

    const nextAccessModifier =
      existing.accessModifier === "public" ||
      metadata.accessModifier === "public"
        ? "public"
        : "internal";

    if (
      existing.name === nextName &&
      existing.namespaceName === nextNamespaceName &&
      existing.typeParameters.join(",") === nextTypeParameters.join(",") &&
      existing.accessModifier === nextAccessModifier &&
      existing.memberTypeAsts.length === nextDefinitionMemberTypeAsts.length &&
      existing.memberTypeAsts.every(
        (memberTypeAst, index) =>
          stableTypeKeyFromAst(memberTypeAst) ===
          stableTypeKeyFromAst(
            nextDefinitionMemberTypeAsts[index] ?? memberTypeAst
          )
      )
    ) {
      return existing;
    }

    registry.definitionsByName.delete(existing.name);
    registry.definitionsByName.delete(existing.fullName);

    const upgraded: RuntimeUnionCarrierDefinition = {
      ...existing,
      name: nextName,
      namespaceName: nextNamespaceName,
      fullName: `${nextNamespaceName}.${nextName}`,
      typeParameters: nextTypeParameters,
      memberTypeAsts: [...nextDefinitionMemberTypeAsts],
      accessModifier: nextAccessModifier,
    };
    registry.definitions.set(key, upgraded);
    registry.definitionsByName.set(upgraded.name, upgraded);
    registry.definitionsByName.set(upgraded.fullName, upgraded);
    return upgraded;
  }

  const memberTypeKeys = memberTypeAsts.map((member) =>
    stableTypeKeyFromAst(member)
  );
  const namespaceName =
    metadata?.namespaceName ?? DEFAULT_RUNTIME_UNION_NAMESPACE;
  const name = buildRuntimeUnionCarrierName(key, memberTypeAsts.length, metadata);
  const typeParameters =
    metadata?.typeParameters?.map(escapeCSharpIdentifier) ??
    Array.from({ length: memberTypeAsts.length }, (_, index) => `T${index + 1}`);
  const definitionMemberTypeAsts =
    metadata?.definitionMemberTypeAsts ??
    typeParameters.map((typeParameter) => ({
      kind: "identifierType" as const,
      name: typeParameter,
    }));
  const definition: RuntimeUnionCarrierDefinition = {
    key,
    name,
    namespaceName,
    fullName: `${namespaceName}.${name}`,
    arity: memberTypeAsts.length,
    typeParameters,
    memberTypeAsts: [...definitionMemberTypeAsts],
    memberTypeKeys,
    accessModifier: metadata?.accessModifier ?? "public",
  };
  registry?.definitions.set(key, definition);
  registry?.definitionsByName.set(definition.name, definition);
  registry?.definitionsByName.set(definition.fullName, definition);
  return definition;
};
