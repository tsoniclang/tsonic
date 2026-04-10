import { createHash } from "node:crypto";
import type { CSharpTypeAst } from "../format/backend-ast/types.js";
import { stableTypeKeyFromAst } from "../format/backend-ast/utils.js";

export type RuntimeUnionCarrierDefinition = {
  readonly key: string;
  readonly name: string;
  readonly arity: number;
  readonly memberTypeAsts: readonly CSharpTypeAst[];
  readonly memberTypeKeys: readonly string[];
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
  semanticFamilyKey?: string
): string =>
  semanticFamilyKey
    ? `union:${semanticFamilyKey}`
    : `union:${memberTypeAsts
        .map((member) => stableTypeKeyFromAst(member))
        .join("|")}`;

const buildRuntimeUnionCarrierName = (
  key: string,
  arity: number
): string => {
  const hash = createHash("md5")
    .update(key)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
  return `Union${arity}_${hash}`;
};

const normalizeRuntimeUnionCarrierName = (name: string): string => {
  const normalized = name.startsWith("global::")
    ? name.slice("global::".length)
    : name;
  const leaf = normalized.split(".").pop() ?? normalized;
  return leaf;
};

export const getRuntimeUnionCarrierDefinitionByName = (
  name: string,
  registry: RuntimeUnionRegistry | undefined
): RuntimeUnionCarrierDefinition | undefined =>
  registry?.definitionsByName.get(normalizeRuntimeUnionCarrierName(name));

export const getOrRegisterRuntimeUnionCarrier = (
  memberTypeAsts: readonly CSharpTypeAst[],
  registry: RuntimeUnionRegistry | undefined,
  semanticFamilyKey?: string
): RuntimeUnionCarrierDefinition => {
  const key = buildRuntimeUnionCarrierKey(memberTypeAsts, semanticFamilyKey);
  const existing = registry?.definitions.get(key);
  if (existing) {
    return existing;
  }

  const memberTypeKeys = memberTypeAsts.map((member) =>
    stableTypeKeyFromAst(member)
  );
  const definition: RuntimeUnionCarrierDefinition = {
    key,
    name: buildRuntimeUnionCarrierName(key, memberTypeAsts.length),
    arity: memberTypeAsts.length,
    memberTypeAsts: [...memberTypeAsts],
    memberTypeKeys,
  };
  registry?.definitions.set(key, definition);
  registry?.definitionsByName.set(definition.name, definition);
  return definition;
};
