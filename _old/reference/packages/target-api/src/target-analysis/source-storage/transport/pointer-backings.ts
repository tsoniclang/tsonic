import type { SourceStorageProgram } from "../model/program.js";
import type { Node } from "@tsonic/tsts";
import { sourceStorageValue } from "../model/program.js";
import type { SourceTypedLocationOperation } from "../../../source-model/pointers.js";

import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../../../source-model/storage.js";

export function createSourceStoragePointerBackings(source: SourceStorageProgram, budget: SourceStorageBudget, queries: {
  subjectFor(node: Node): SourceStorageSubject | undefined;
  locationFor(node: Node): SourceStorageSubject | undefined;
  originsFor(subject: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined;
}) {
  const typedOperation = (occurrence: Node): SourceTypedLocationOperation | undefined => {
    const selected = sourceStorageValue(source.facts.protocols.pointerOperation(occurrence));
    return selected.kind === "present" && selected.value.family === "typed-location" ? selected.value : undefined;
  };
  const backingsFor = (expression: Node): ReadonlySet<SourceStorageSubject> | undefined => budget.withRows(rows => {
    const selected = queries.subjectFor(expression);
    if (selected === undefined) return undefined;
    const pending = [selected];
    const visited = new Set<SourceStorageSubject>();
    const result = new Set<SourceStorageSubject>();
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      if (!rows.add(1)) return undefined;
      visited.add(current);
      const origins = queries.originsFor(current);
      if (origins === undefined) return undefined;
      for (const origin of origins) {
        if (!budget.step()) return undefined;
        if (origin.kind !== "value" || origin.projection.length !== 0) continue;
        const operation = typedOperation(origin.node);
        if (operation?.operation === "address-of") {
          const location = queries.locationFor(operation.storage.occurrence);
          if (location !== undefined && !result.has(location) && rows.add(1)) result.add(location);
        } else if (operation?.operation === "project-pointer") {
          const next = queries.subjectFor(operation.pointer.occurrence);
          if (next !== undefined && rows.add(1)) pending.push(next);
        }
      }
    }
    return budget.failure() === undefined ? result : undefined;
  });
  const accessorsFor = (invocation: Node): ReadonlySet<Node> | undefined => budget.withRows(rows => {
    const operation = typedOperation(invocation);
    const result = new Set<Node>();
    if (operation?.operation !== "load" && operation?.operation !== "store") return result;
    const pointer = queries.subjectFor(operation.pointer.occurrence);
    if (pointer === undefined) return undefined;
    const pending = [pointer];
    const visited = new Set<SourceStorageSubject>();
    const accessor = (expression: Node): boolean => {
      const subject = queries.subjectFor(expression);
      const values = subject === undefined ? undefined : queries.originsFor(subject);
      if (values === undefined) return false;
      for (const value of values) {
        if (!budget.step()) return false;
        const selected = source.facts.navigation.callableImplementation(value.node);
        if (value.kind !== "value" || value.projection.length !== 0 || selected.kind !== "resolved" ||
          source.ast.body(selected.implementation.declaration) === undefined) continue;
        const owner = selected.implementation.declaration;
        if (!result.has(owner) && rows.add(1)) result.add(owner);
      }
      return budget.failure() === undefined;
    };
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const subject = pending.pop()!;
      if (visited.has(subject)) continue;
      if (!rows.add(1)) return undefined;
      visited.add(subject);
      const values = queries.originsFor(subject);
      if (values === undefined) return undefined;
      for (const value of values) {
        if (!budget.step()) return undefined;
        if (value.kind !== "value" || value.projection.length !== 0) continue;
        const selected = typedOperation(value.node);
        if (selected?.operation === "bind-pointer") {
          if (!accessor((operation.operation === "load" ? selected.read : selected.write).occurrence)) return undefined;
        } else if (selected?.operation === "project-pointer") {
          if (!accessor((operation.operation === "load" ? selected.fromSource : selected.toSource).occurrence)) return undefined;
          const pointer = queries.subjectFor(selected.pointer.occurrence);
          if (pointer !== undefined && rows.add(1)) pending.push(pointer);
        }
      }
    }
    return result;
  });
  return Object.freeze({ backingsFor, accessorsFor });
}
