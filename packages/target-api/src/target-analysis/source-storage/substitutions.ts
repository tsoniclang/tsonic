import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import type { SourceStorageIncomingQuery } from "./edges.js";

export type SourceStorageSubstitutions = ReadonlyMap<SourceStorageSubject, ReadonlySet<SourceStorageSubject>>;

export function createSourceStorageSubstitutions(
  source: TargetSourceProgram,
  step: () => boolean,
  subject: SourceStorageSubjectQuery,
  incoming: SourceStorageIncomingQuery,
  invocationOrigins: (origin: SourceStorageSubject, candidate: Node, invocation: Node) => ReadonlySet<SourceStorageSubject>,
  reserveRow: () => boolean,
) {
  const empty: SourceStorageSubstitutions = new Map();
  const bindingSets = new Map<string, SourceStorageSubstitutions>();
  const identities = new Map<SourceStorageSubject, number>();
  const identity = (subject: SourceStorageSubject): number => {
    let selected = identities.get(subject);
    if (selected === undefined) { selected = identities.size; identities.set(subject, selected); }
    return selected;
  };
  const origins = (origin: SourceStorageSubject, bindings: SourceStorageSubstitutions): ReadonlySet<SourceStorageSubject> => {
    const remaining = [origin];
    const checked = new Set<SourceStorageSubject>();
    const origins = new Set<SourceStorageSubject>();
    while (remaining.length !== 0 && step()) {
      const selected = remaining.pop()!;
      if (checked.has(selected)) continue;
      checked.add(selected);
      const bound = bindings.get(selected);
      if (bound !== undefined) {
        for (const actual of bound) { if (!step()) break; origins.add(actual); }
        continue;
      }
      const root = selected.projection.length === 0 ? undefined : subject(selected.node, selected.kind);
      const rootBindings = root === undefined ? undefined : bindings.get(root);
      if (rootBindings !== undefined) {
        for (const actual of rootBindings) {
          if (!step()) break;
          const projected = subject(actual.node, actual.kind, [...actual.projection, ...selected.projection]);
          if (projected !== undefined && !checked.has(projected)) remaining.push(projected);
        }
        continue;
      }
      const parents = incoming(selected);
      if (parents.size === 0) origins.add(selected);
      else for (const parent of parents) { if (!step()) break; remaining.push(parent); }
    }
    return origins;
  };
  const forInvocation = (candidate: Node, invocation: Node, parent: SourceStorageSubstitutions): SourceStorageSubstitutions | undefined => {
    const selected = new Map<SourceStorageSubject, ReadonlySet<SourceStorageSubject>>();
    for (const [formal, actuals] of parent) {
      if (!step()) return undefined;
      selected.set(formal, actuals);
    }
    const parameters = source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate)
      ? [] : source.ast.parameters(candidate);
    for (const parameter of [...parameters, candidate]) {
      if (parameter === undefined || !step()) continue;
      const formal = subject(parameter, parameter === candidate ? "receiver" : "value");
      if (formal === undefined) return undefined;
      const actual = new Set<SourceStorageSubject>();
      for (const origin of invocationOrigins(formal, candidate, invocation)) {
        for (const value of origins(origin, parent)) {
          if (!step()) return undefined;
          actual.add(value);
        }
      }
      selected.set(formal, actual);
    }
    const entries: { readonly formal: number; readonly actuals: readonly number[] }[] = [];
    for (const [formal, actuals] of selected) {
      if (!step()) return undefined;
      const indexes: number[] = [];
      for (const actual of actuals) {
        if (!step()) return undefined;
        indexes.push(identity(actual));
      }
      entries.push({ formal: identity(formal), actuals: indexes.sort((left, right) => left - right) });
    }
    entries.sort((left, right) => left.formal - right.formal);
    const key = entries.map(entry => `${entry.formal}:${entry.actuals.join(",")}`).join(";");
    const cached = bindingSets.get(key);
    if (cached !== undefined) return cached;
    for (const entry of entries) {
      if (!reserveRow()) return undefined;
      for (let index = 0; index < entry.actuals.length; index += 1) if (!reserveRow()) return undefined;
    }
    bindingSets.set(key, selected);
    return selected;
  };
  return Object.freeze({ empty, origins, forInvocation });
}
