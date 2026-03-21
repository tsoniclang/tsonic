/**
 * Duplicate type declaration suppression and deduplication planning.
 *
 * Extracted from emitter.ts — contains the logic that detects duplicate type
 * declarations across modules and builds suppression/canonicalization plans
 * so that only one copy of each structurally-identical type is emitted.
 */

import { Diagnostic, stableIrTypeKey, IrModule } from "@tsonic/frontend";
import type { IrStatement } from "@tsonic/frontend";

type EmittedTypeDeclaration = Extract<
  IrStatement,
  | { kind: "classDeclaration" }
  | { kind: "interfaceDeclaration" }
  | { kind: "enumDeclaration" }
  | { kind: "typeAliasDeclaration" }
>;

export type DuplicatePlanResult =
  | {
      readonly ok: true;
      readonly suppressed: ReadonlySet<string>;
      readonly canonicalLocalTypeTargets: ReadonlyMap<string, string>;
    }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

const isRuntimeTypeDeclaration = (
  stmt: IrStatement
): stmt is EmittedTypeDeclaration => {
  if (stmt.kind === "classDeclaration") return true;
  if (stmt.kind === "interfaceDeclaration") return true;
  if (stmt.kind === "enumDeclaration") return true;
  return (
    stmt.kind === "typeAliasDeclaration" && stmt.type.kind === "objectType"
  );
};

const duplicateGroupKey = (namespace: string, name: string): string =>
  `${namespace}::${name}`;

const canonicalLocalTargetKey = (namespace: string, name: string): string =>
  `${namespace}::${name}`;

type CanonicalizableStructuralDeclaration = Extract<
  EmittedTypeDeclaration,
  { kind: "interfaceDeclaration" } | { kind: "typeAliasDeclaration" }
>;

const isCanonicalizableStructuralDeclaration = (
  stmt: EmittedTypeDeclaration
): stmt is CanonicalizableStructuralDeclaration => {
  if (stmt.kind === "interfaceDeclaration") return !stmt.isExported;
  if (stmt.kind === "typeAliasDeclaration") {
    return stmt.type.kind === "objectType" && !stmt.isExported;
  }
  return false;
};

const stableCircularStringify = (value: unknown): string => {
  const seen = new WeakMap<object, number>();
  let nextId = 0;

  const normalize = (current: unknown): unknown => {
    if (current === null) return null;
    if (typeof current === "bigint") {
      return { $bigint: current.toString(10) };
    }
    if (typeof current !== "object") return current;

    const existing = seen.get(current);
    if (existing !== undefined) {
      return { $ref: existing };
    }

    const id = nextId;
    nextId += 1;
    seen.set(current, id);

    if (Array.isArray(current)) {
      return current.map((entry) => normalize(entry));
    }

    const normalized: Record<string, unknown> = { $id: id };
    for (const key of Object.keys(current).sort()) {
      if (key === "sourceSpan") continue;
      normalized[key] = normalize((current as Record<string, unknown>)[key]);
    }
    return normalized;
  };

  return JSON.stringify(normalize(value));
};

const semanticSignature = (stmt: EmittedTypeDeclaration): string => {
  if (stmt.kind === "interfaceDeclaration") {
    return stableCircularStringify({
      ...stmt,
      members: [...stmt.members].sort((a, b) => a.name.localeCompare(b.name)),
      extends: [...stmt.extends].sort((a, b) =>
        stableIrTypeKey(a).localeCompare(stableIrTypeKey(b))
      ),
    });
  }

  if (stmt.kind === "classDeclaration") {
    // Class member order is semantically significant: field initializers run in
    // declaration order. Only sort `implements` (order-independent) — preserve
    // member order to avoid false equivalence when initializer order differs.
    return stableCircularStringify({
      ...stmt,
      implements: [...stmt.implements].sort((a, b) =>
        stableIrTypeKey(a).localeCompare(stableIrTypeKey(b))
      ),
    });
  }

  // Type aliases: sort objectType members if applicable
  if (stmt.kind === "typeAliasDeclaration" && stmt.type.kind === "objectType") {
    return stableCircularStringify({
      ...stmt,
      type: {
        ...stmt.type,
        members: [...stmt.type.members].sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
      },
    });
  }

  // Enums: do NOT sort — member order is semantically significant
  // (implicit values depend on order)
  return stableCircularStringify(stmt);
};

const canonicalStructuralGroupKey = (
  stmt: CanonicalizableStructuralDeclaration
): string => {
  if (stmt.kind === "interfaceDeclaration") {
    return `iface::${stmt.name}::${stableCircularStringify({
      typeParameters: stmt.typeParameters ?? [],
      extends: [...stmt.extends].sort((a, b) =>
        stableIrTypeKey(a).localeCompare(stableIrTypeKey(b))
      ),
      members: [...stmt.members].sort((a, b) => a.name.localeCompare(b.name)),
    })}`;
  }

  // Type alias with objectType — sort members
  if (stmt.type.kind === "objectType") {
    return `alias::${stmt.name}::${stableCircularStringify({
      typeParameters: stmt.typeParameters ?? [],
      type: {
        ...stmt.type,
        members: [...stmt.type.members].sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
      },
    })}`;
  }

  return `alias::${stmt.name}::${stableCircularStringify({
    typeParameters: stmt.typeParameters ?? [],
    type: stmt.type,
  })}`;
};

const emittedDeclarationName = (stmt: EmittedTypeDeclaration): string => {
  if (stmt.kind === "typeAliasDeclaration" && stmt.type.kind === "objectType") {
    return `${stmt.name}__Alias`;
  }
  return stmt.name;
};

const suppressionKey = (
  filePath: string,
  stmt: EmittedTypeDeclaration
): string => `${filePath}::${stmt.kind}::${stmt.name}`;

export const planDuplicateTypeSuppression = (
  modules: readonly IrModule[]
): DuplicatePlanResult => {
  const groups = new Map<
    string,
    Array<{
      readonly filePath: string;
      readonly namespace: string;
      readonly stmt: EmittedTypeDeclaration;
      readonly signature: string;
    }>
  >();
  const structuralGroups = new Map<
    string,
    Array<{
      readonly filePath: string;
      readonly namespace: string;
      readonly stmt: CanonicalizableStructuralDeclaration;
    }>
  >();

  for (const module of modules) {
    for (const stmt of module.body) {
      if (!isRuntimeTypeDeclaration(stmt)) continue;

      const key = duplicateGroupKey(module.namespace, stmt.name);
      const entries = groups.get(key) ?? [];
      entries.push({
        filePath: module.filePath,
        namespace: module.namespace,
        stmt,
        signature: semanticSignature(stmt),
      });
      groups.set(key, entries);

      if (isCanonicalizableStructuralDeclaration(stmt)) {
        const structuralKey = canonicalStructuralGroupKey(stmt);
        const structuralEntries = structuralGroups.get(structuralKey) ?? [];
        structuralEntries.push({
          filePath: module.filePath,
          namespace: module.namespace,
          stmt,
        });
        structuralGroups.set(structuralKey, structuralEntries);
      }
    }
  }

  const suppressed = new Set<string>();
  const canonicalLocalTypeTargets = new Map<string, string>();
  const errors: Diagnostic[] = [];

  for (const [key, entries] of groups) {
    if (entries.length <= 1) continue;
    const ordered = [...entries].sort((a, b) =>
      a.filePath.localeCompare(b.filePath)
    );
    const first = ordered[0];
    if (!first) continue;
    const firstSig = first.signature;

    for (let i = 1; i < ordered.length; i += 1) {
      const entry = ordered[i];
      if (!entry) continue;
      if (entry.signature === firstSig) {
        suppressed.add(suppressionKey(entry.filePath, entry.stmt));
        continue;
      }

      errors.push({
        code: "TSN3003",
        severity: "error",
        message:
          `Cross-module type declaration collision for '${key}'. ` +
          `Multiple files declare the same namespace/type name with different shapes: ` +
          `${first.filePath}, ${entry.filePath}.`,
        hint: "Rename one declaration or make the declarations shape-identical so the duplicate can be deduplicated deterministically.",
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  for (const entries of structuralGroups.values()) {
    if (entries.length <= 1) continue;
    const ordered = [...entries].sort((a, b) =>
      a.filePath.localeCompare(b.filePath)
    );
    const canonical = ordered[0];
    if (!canonical) continue;
    const canonicalFqn = `${canonical.namespace}.${emittedDeclarationName(canonical.stmt)}`;

    for (let i = 1; i < ordered.length; i += 1) {
      const entry = ordered[i];
      if (!entry) continue;

      suppressed.add(suppressionKey(entry.filePath, entry.stmt));

      if (entry.namespace === canonical.namespace) {
        continue;
      }

      canonicalLocalTypeTargets.set(
        canonicalLocalTargetKey(entry.namespace, entry.stmt.name),
        canonicalFqn
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, suppressed, canonicalLocalTypeTargets };
};
