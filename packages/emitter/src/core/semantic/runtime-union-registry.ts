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
    : `union:${memberTypeAsts
        .map((member) => stableTypeKeyFromAst(member))
        .join("|")}`;

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
    return existing;
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
