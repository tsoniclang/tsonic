import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceErrorStorageSubject, SourceErrorStorageSubjectQuery } from "./error-storage-subjects.js";

export type SourceErrorInvalidationBindings = ReadonlyMap<SourceErrorStorageSubject, ReadonlySet<SourceErrorStorageSubject>>;

export function createSourceErrorInvalidationBindings(
  source: TargetSourceProgram,
  step: () => boolean,
  subject: SourceErrorStorageSubjectQuery,
  incoming: ReadonlyMap<SourceErrorStorageSubject, ReadonlySet<SourceErrorStorageSubject>>,
  invocationOrigins: (origin: SourceErrorStorageSubject, candidate: Node, invocation: Node) => ReadonlySet<SourceErrorStorageSubject>,
) {
  const empty: SourceErrorInvalidationBindings = new Map();
  const bindingSets = new Map<string, SourceErrorInvalidationBindings>();
  const identities = new Map<SourceErrorStorageSubject, number>();
  const identity = (subject: SourceErrorStorageSubject): number => {
    let selected = identities.get(subject);
    if (selected === undefined) { selected = identities.size; identities.set(subject, selected); }
    return selected;
  };
  const origins = (origin: SourceErrorStorageSubject, bindings: SourceErrorInvalidationBindings): ReadonlySet<SourceErrorStorageSubject> => {
    const remaining = [origin];
    const checked = new Set<SourceErrorStorageSubject>();
    const origins = new Set<SourceErrorStorageSubject>();
    while (remaining.length !== 0 && step()) {
      const selected = remaining.pop()!;
      if (checked.has(selected)) continue;
      checked.add(selected);
      const bound = bindings.get(selected);
      if (bound !== undefined) { for (const actual of bound) origins.add(actual); continue; }
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
      const parents = incoming.get(selected);
      if (parents === undefined || parents.size === 0) origins.add(selected);
      else remaining.push(...parents);
    }
    return origins;
  };
  const forInvocation = (candidate: Node, invocation: Node, parent: SourceErrorInvalidationBindings): SourceErrorInvalidationBindings => {
    const selected = new Map(parent);
    const parameters = source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate)
      ? [] : source.ast.parameters(candidate);
    for (const parameter of [...parameters, candidate]) {
      if (parameter === undefined || !step()) continue;
      const formal = subject(parameter, parameter === candidate ? "receiver" : "value")!;
      const actual = new Set<SourceErrorStorageSubject>();
      for (const origin of invocationOrigins(formal, candidate, invocation)) {
        for (const value of origins(origin, parent)) actual.add(value);
      }
      selected.set(formal, actual);
    }
    const key = [...selected].map(([formal, origins]) => [identity(formal),
      [...origins].map(identity).sort((left, right) => left - right)] as const)
      .sort((left, right) => left[0] - right[0]).map(([formal, origins]) => `${formal}:${origins.join(",")}`).join(";");
    const cached = bindingSets.get(key);
    if (cached !== undefined) return cached;
    bindingSets.set(key, selected);
    return selected;
  };
  return Object.freeze({ empty, origins, forInvocation });
}
