import type { LocalTypeInfo } from "../../emitter-types/core.js";

export type LocalTypeLookupCandidate = {
  readonly name: string;
  readonly fromEmittedObjectAlias: boolean;
};

const EMITTED_OBJECT_ALIAS_PATTERN = /^(.+)__Alias(?:_\d+)?$/;

const getSimpleLookupName = (typeName: string): string =>
  typeName.includes(".") ? (typeName.split(".").pop() ?? typeName) : typeName;

const getEmittedObjectAliasSourceName = (
  simpleName: string
): string | undefined => {
  const match = EMITTED_OBJECT_ALIAS_PATTERN.exec(simpleName);
  return match?.[1] && match[1].length > 0 ? match[1] : undefined;
};

export const getLocalTypeLookupCandidates = (
  typeName: string
): readonly LocalTypeLookupCandidate[] => {
  const candidates: LocalTypeLookupCandidate[] = [];
  const seen = new Set<string>();

  const add = (name: string, fromEmittedObjectAlias: boolean): void => {
    if (name.length === 0 || seen.has(name)) {
      return;
    }
    seen.add(name);
    candidates.push({ name, fromEmittedObjectAlias });
  };

  const addWithObjectAliasSource = (name: string): void => {
    add(name, false);
    const sourceName = getEmittedObjectAliasSourceName(name);
    if (sourceName) {
      add(sourceName, true);
    }
  };

  const simpleLookupName = getSimpleLookupName(typeName);
  addWithObjectAliasSource(simpleLookupName);

  if (simpleLookupName.endsWith("$instance")) {
    const baseName = simpleLookupName.slice(0, -"$instance".length);
    addWithObjectAliasSource(baseName);

    const unsuffixedBaseName = baseName.replace(/_\d+$/, "");
    addWithObjectAliasSource(unsuffixedBaseName);
  }

  return candidates;
};

export const canUseLocalTypeLookupCandidate = (
  info: LocalTypeInfo,
  candidate: LocalTypeLookupCandidate
): boolean =>
  !candidate.fromEmittedObjectAlias ||
  (info.kind === "typeAlias" && info.type.kind === "objectType");
