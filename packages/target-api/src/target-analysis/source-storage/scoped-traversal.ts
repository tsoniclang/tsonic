import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageScope, SourceStorageVariable } from "./scoped-model.js";

export interface SourceStorageSubstitutionPath {
  readonly replacements: ReadonlyMap<SourceStorageVariable, SourceStorageScope>;
  readonly parent: SourceStorageSubstitutionPath | undefined;
}

export function createSourceStorageScopedTraversal(budget: SourceStorageBudget) {
  return function* (scope: SourceStorageScope, direction: "lexical" | "caller" = "lexical") {
    const rows = budget.createRows();
    const frontier = budget.createRows();
    let maximumFrontier = 0;
    const paths = new Map<ReadonlyMap<SourceStorageVariable, SourceStorageScope>,
      Map<SourceStorageSubstitutionPath | undefined, SourceStorageSubstitutionPath>>();
    const pending: { readonly scope: SourceStorageScope; readonly path: SourceStorageSubstitutionPath | undefined }[] = [];
    const visited = new Map<SourceStorageSubstitutionPath | undefined, Set<SourceStorageScope>>();
    const schedule = (scope: SourceStorageScope, path: SourceStorageSubstitutionPath | undefined): boolean => {
      if (!budget.step()) return false;
      const retained = visited.get(path);
      if (retained?.has(scope)) return true;
      if (!rows.add(retained === undefined ? 2 : 1)) return false;
      if (pending.length === maximumFrontier) {
        if (!frontier.add(1)) return false;
        maximumFrontier += 1;
      }
      const selected = retained ?? new Set<SourceStorageScope>();
      selected.add(scope); visited.set(path, selected); pending.push({ scope, path });
      return true;
    };
    try {
      if (!schedule(scope, undefined)) return;
      while (pending.length !== 0) {
        if (!budget.step()) return;
        const current = pending.pop()!;
        if (current.scope.kind === "substitution") {
          const selections = paths.get(current.scope.substitutions);
          let path = selections?.get(current.path);
          if (path === undefined) {
            if (!rows.add(selections === undefined ? 3 : 2)) return;
            path = Object.freeze({ replacements: current.scope.substitutions, parent: current.path });
            const selected = selections ?? new Map<SourceStorageSubstitutionPath | undefined, SourceStorageSubstitutionPath>();
            selected.set(current.path, path); paths.set(current.scope.substitutions, selected);
          }
          if (!schedule(current.scope.scope, path)) return;
          continue;
        }
        if (current.scope.kind === "variable") {
          let path = current.path;
          while (path !== undefined) {
            if (!budget.step()) return;
            if (path.replacements.has(current.scope)) break;
            path = path.parent;
          }
          if (path !== undefined) {
            if (!schedule(path.replacements.get(current.scope)!, path.parent)) return;
            continue;
          }
        }
        yield { scope: current.scope, path: current.path };
        if (current.scope.kind === "variable") {
          if (current.scope.capture === undefined && !schedule(current.scope.equation.initial, current.path)) return;
        } else if (direction === "caller") {
          if (current.scope.caller !== undefined && !schedule(current.scope.caller, current.path)) return;
        } else for (let index = current.scope.parents.length - 1; index >= 0; index -= 1) {
          if (!schedule(current.scope.parents[index]!, current.path)) return;
        }
      }
    } finally {
      pending.length = 0; paths.clear(); visited.clear(); frontier.release(); rows.release();
    }
  };
}
