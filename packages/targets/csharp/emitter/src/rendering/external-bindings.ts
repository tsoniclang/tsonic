import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  Diagnostic,
  LoweringExternalBindingReferencePlan,
  LoweringDeclarationPlan,
  LoweringTypeRefPlan,
} from "@tsonic/frontend";
import { sourceQualifiedNameKey } from "./types.js";

export type ExternalMemberAccessibility = "public" | "protected" | "private";

type ExternalMemberMetadata = {
  readonly name: string;
  readonly kind: "method" | "property";
  readonly parameterCount: number;
  readonly accessibility: ExternalMemberAccessibility;
};

type ExternalTypeMetadata = {
  readonly bindingFile: string;
  readonly targetName: string;
  readonly sourceNames: readonly string[];
  readonly baseTypeName?: string;
  readonly interfaces: readonly string[];
  readonly members: readonly ExternalMemberMetadata[];
};

export type ExternalBindingMetadataIndex = {
  readonly diagnostics: readonly Diagnostic[];
  readonly resolveTargetName: (
    binding: LoweringExternalBindingReferencePlan
  ) => string | undefined;
  readonly resolveOverrideAccessibility: (
    heritageTypes: readonly LoweringTypeRefPlan[],
    member: LoweringDeclarationPlan
  ) => ExternalMemberAccessibility | undefined;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const numberValue = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const normalizeRuntimeName = (name: string): string =>
  name
    .replace(/^global::/u, "")
    .replace(/\+/gu, ".")
    .replace(/\$/gu, "_");

const mapVisibility = (
  visibility: string | undefined
): ExternalMemberAccessibility | undefined => {
  switch (visibility) {
    case "Public":
      return "public";
    case "Private":
      return "private";
    case "Protected":
    case "Family":
    case "ProtectedInternal":
    case "FamilyOrAssembly":
    case "FamilyAndAssembly":
      return "protected";
    default:
      return undefined;
  }
};

const bindingFilesUnder = (
  root: string,
  found: string[] = []
): readonly string[] => {
  if (!existsSync(root)) return found;
  const stat = statSync(root);
  if (!stat.isDirectory()) return found;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolutePath = join(root, entry.name);
    if (entry.isDirectory()) {
      bindingFilesUnder(absolutePath, found);
      continue;
    }
    if (entry.isFile() && entry.name === "bindings.json") {
      found.push(absolutePath);
    }
  }
  return found;
};

const parseMember = (
  value: unknown,
  kind: "method" | "property"
): ExternalMemberMetadata | undefined => {
  if (!isObjectRecord(value)) return undefined;
  const name = stringValue(value.targetName);
  const accessibility = mapVisibility(stringValue(value.visibility));
  if (!name || !accessibility) return undefined;
  const parameterCount =
    kind === "method" ? numberValue(value.parameterCount) : 0;
  if (parameterCount === undefined) return undefined;
  return {
    name,
    kind,
    parameterCount,
    accessibility,
  };
};

const parseMembers = (
  values: unknown,
  kind: "method" | "property"
): readonly ExternalMemberMetadata[] =>
  Array.isArray(values)
    ? values
        .map((value) => parseMember(value, kind))
        .filter(
          (member): member is ExternalMemberMetadata => member !== undefined
        )
    : [];

const targetNameFromTypeRef = (value: unknown): string | undefined =>
  isObjectRecord(value) ? stringValue(value.targetName) : undefined;

const typeSourceNames = (value: Record<string, unknown>): readonly string[] => {
  const sourceName = stringValue(value.sourceName);
  return sourceName ? [sourceName, `${sourceName}$instance`] : [];
};

const parseType = (
  bindingFile: string,
  value: unknown
): ExternalTypeMetadata | undefined => {
  if (!isObjectRecord(value)) return undefined;
  const targetName = stringValue(value.targetName);
  if (!targetName) return undefined;
  const sourceNames = typeSourceNames(value);
  if (sourceNames.length === 0) return undefined;
  return {
    bindingFile,
    targetName,
    sourceNames,
    baseTypeName: targetNameFromTypeRef(value.baseType),
    interfaces: Array.isArray(value.interfaces)
      ? value.interfaces
          .map(targetNameFromTypeRef)
          .filter((name): name is string => name !== undefined)
      : [],
    members: [
      ...parseMembers(value.methods, "method"),
      ...parseMembers(value.properties, "property"),
    ],
  };
};

const parseBindingFile = (
  filePath: string
): { readonly types: readonly ExternalTypeMetadata[] } => {
  const bindingFile = resolve(filePath);
  const json = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
  const types = isObjectRecord(json)
    ? isObjectRecord(json.targetSurface) &&
      Array.isArray(json.targetSurface.types)
      ? json.targetSurface.types
      : []
    : [];
  return {
    types: types
      .map((type) => parseType(bindingFile, type))
      .filter((type): type is ExternalTypeMetadata => type !== undefined),
  };
};

const externalBindingKey = (
  binding: LoweringExternalBindingReferencePlan
): string => `${resolve(binding.bindingFile)}#${binding.sourceName}`;

const resolveHeritageOwnerNames = (
  resolveTargetName: (
    binding: LoweringExternalBindingReferencePlan
  ) => string | undefined,
  type: LoweringTypeRefPlan
): readonly string[] => {
  if (type.kind !== "named") return [];
  if (type.externalBinding) {
    const targetName = resolveTargetName(type.externalBinding);
    return targetName ? [normalizeRuntimeName(targetName)] : [];
  }
  const sourceQualifiedName = sourceQualifiedNameKey(type.sourceQualifiedName);
  if (sourceQualifiedName) {
    return [normalizeRuntimeName(sourceQualifiedName)];
  }
  return [];
};

const resolveCommonAccessibility = (
  members: readonly ExternalMemberMetadata[]
): ExternalMemberAccessibility | undefined => {
  const first = members[0]?.accessibility;
  return first && members.every((member) => member.accessibility === first)
    ? first
    : undefined;
};

const memberKind = (
  member: LoweringDeclarationPlan
): "method" | "property" | undefined => {
  switch (member.declarationKind) {
    case "method":
      return "method";
    case "property":
      return "property";
    default:
      return undefined;
  }
};

export const createExternalBindingMetadataIndex = (
  roots: readonly string[] | undefined
): ExternalBindingMetadataIndex => {
  const diagnostics: Diagnostic[] = [];
  const byQualifiedName = new Map<string, ExternalTypeMetadata>();
  const bySourceBinding = new Map<string, ExternalTypeMetadata | "ambiguous">();
  const loadedBindingFiles = new Set<string>();

  const addSourceBinding = (type: ExternalTypeMetadata): void => {
    for (const sourceName of type.sourceNames) {
      const key = externalBindingKey({
        bindingFile: type.bindingFile,
        sourceName,
      });
      const existing = bySourceBinding.get(key);
      if (!existing) {
        bySourceBinding.set(key, type);
        continue;
      }
      if (existing !== "ambiguous" && existing.targetName === type.targetName) {
        continue;
      }
      bySourceBinding.set(key, "ambiguous");
    }
  };

  const loadBindingFile = (filePath: string): void => {
    const bindingFile = resolve(filePath);
    if (loadedBindingFiles.has(bindingFile)) return;
    loadedBindingFiles.add(bindingFile);
    if (!existsSync(bindingFile)) return;
    try {
      for (const type of parseBindingFile(bindingFile).types) {
        byQualifiedName.set(type.targetName, type);
        addSourceBinding(type);
      }
    } catch (cause) {
      diagnostics.push({
        code: "TSN9002",
        severity: "error",
        message: `Failed to read external binding metadata '${bindingFile}': ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }
  };

  for (const root of roots ?? []) {
    for (const filePath of bindingFilesUnder(root)) {
      loadBindingFile(filePath);
    }
  }

  const findMemberAccessibility = (
    ownerQualifiedName: string,
    member: LoweringDeclarationPlan,
    seen: ReadonlySet<string> = new Set()
  ): ExternalMemberAccessibility | undefined => {
    if (seen.has(ownerQualifiedName)) return undefined;
    const nextSeen = new Set(seen);
    nextSeen.add(ownerQualifiedName);
    const owner = byQualifiedName.get(ownerQualifiedName);
    if (!owner || !member.name) return undefined;
    const kind = memberKind(member);
    if (!kind) return undefined;
    const matchingMembers = owner.members.filter(
      (candidate) =>
        candidate.kind === kind &&
        candidate.name === member.name &&
        candidate.parameterCount === member.parameters.length
    );
    const direct = resolveCommonAccessibility(matchingMembers);
    if (direct) return direct;
    const inheritedOwners = [
      ...(owner.baseTypeName ? [owner.baseTypeName] : []),
      ...owner.interfaces,
    ];
    for (const inheritedOwner of inheritedOwners) {
      const inherited = findMemberAccessibility(
        inheritedOwner,
        member,
        nextSeen
      );
      if (inherited) return inherited;
    }
    return undefined;
  };

  const resolveTargetName = (
    binding: LoweringExternalBindingReferencePlan
  ): string | undefined => {
    const key = externalBindingKey(binding);
    if (!bySourceBinding.has(key)) loadBindingFile(binding.bindingFile);
    const type = bySourceBinding.get(key);
    return type && type !== "ambiguous" ? type.targetName : undefined;
  };

  return {
    diagnostics,
    resolveTargetName,
    resolveOverrideAccessibility: (heritageTypes, member) => {
      if (!member.override || member.accessibilityExplicit) return undefined;
      for (const heritageType of heritageTypes) {
        for (const ownerName of resolveHeritageOwnerNames(
          resolveTargetName,
          heritageType
        )) {
          const accessibility = findMemberAccessibility(ownerName, member);
          if (accessibility) return accessibility;
        }
      }
      return undefined;
    },
  };
};
