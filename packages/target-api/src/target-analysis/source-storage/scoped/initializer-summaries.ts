import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageReference, type SourceStorageFrame, type SourceStorageScope,
  type SourceStorageTerm } from "../graph/scoped-model.js";
import type { SourceStorageCreationContext } from "./activation-keys.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { createSourceStorageScopedKeys } from "./scoped-keys.js";

export function createSourceStorageInitializerSummaries(source: TargetSourceProgram, budget: SourceStorageBudget,
  scopes: SourceStorageScopes, creation: SourceStorageCreationContext,
  keys: ReturnType<typeof createSourceStorageScopedKeys>) {
  const summaries = new Map<SourceStorageSubject, Map<string, SourceStorageFrame>>();
  const rows = budget.createRows();
  return Object.freeze({
    instantiate(value: SourceStorageSubject, scope: SourceStorageScope): SourceStorageTerm | undefined {
      const owner = creation.ownerFor(value);
      if (owner === undefined || !source.ast.is.IsClassDeclaration(owner) && !source.ast.is.IsClassExpression(owner) ||
        scope.kind !== "frame" || scope.owner !== owner || scope.invocation === undefined)
        return sourceStorageReference(value, scope);
      const footprint = creation.footprints.select(value);
      if (footprint === undefined) return undefined;
      return budget.withRows(temporary => {
        const inputs: { readonly subject: SourceStorageSubject; readonly term: SourceStorageTerm }[] = [];
        for (const input of footprint.ports) {
          if (!budget.step() || !temporary.add(1)) return undefined;
          inputs.push({ subject: input, term: sourceStorageReference(input, scope) });
        }
        for (const location of footprint.locations) {
          if (!budget.step()) return undefined;
          const capturedOwner = creation.ownerFor(location);
          if (capturedOwner === owner) continue;
          const captured = capturedOwner === undefined ? scopes.empty : scopes.owningScope(scope, capturedOwner);
          if (captured === undefined) return sourceStorageReference(value, scope);
          if (!temporary.add(1)) return undefined;
          inputs.push({ subject: location, term: sourceStorageReference(location, captured) });
        }
        const context = keys.context([inputs]);
        if (context === undefined) return undefined;
        const contexts = summaries.get(value);
        const parameter = contexts?.get(context);
        if (parameter === undefined) {
          if (!rows.add(contexts === undefined ? 2 : 1)) return undefined;
          const selected = contexts ?? new Map<string, SourceStorageFrame>();
          selected.set(context, scope);
          summaries.set(value, selected);
          return sourceStorageReference(value, scope);
        }
        return parameter === scope ? sourceStorageReference(value, scope)
          : Object.freeze({ kind: "instantiation", value: sourceStorageReference(value, parameter), parameter, scope });
      });
    },
    release(): void { summaries.clear(); rows.release(); },
  });
}
