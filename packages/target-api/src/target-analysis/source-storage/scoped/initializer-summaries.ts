import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageReference, type SourceStorageFrame, type SourceStorageScope,
  type SourceStorageTerm } from "../graph/scoped-model.js";
import type { SourceStorageCreationContext } from "./activation-keys.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { createSourceStorageScopedKeys } from "./scoped-keys.js";

interface SourceStorageInitializer {
  readonly owner: Node;
  readonly ports: readonly SourceStorageSubject[];
  readonly captures: readonly { readonly subject: SourceStorageSubject; readonly owner: Node | undefined }[];
  readonly contexts: Map<string | undefined, SourceStorageFrame>;
}

export function createSourceStorageInitializerSummaries(source: TargetSourceProgram, budget: SourceStorageBudget,
  scopes: SourceStorageScopes, creation: SourceStorageCreationContext,
  keys: ReturnType<typeof createSourceStorageScopedKeys>) {
  const summaries = new Map<SourceStorageSubject, SourceStorageInitializer>();
  const rows = budget.createRows();
  const initializer = (value: SourceStorageSubject): SourceStorageInitializer | undefined => {
    const retained = summaries.get(value);
    if (retained !== undefined) return retained;
    const owner = creation.ownerFor(value);
    if (owner === undefined || !source.ast.is.IsClassDeclaration(owner) && !source.ast.is.IsClassExpression(owner)) return undefined;
    const footprint = creation.footprints.select(value);
    if (footprint === undefined) return undefined;
    const captures: { readonly subject: SourceStorageSubject; readonly owner: Node | undefined }[] = [];
    for (const location of footprint.locations) {
      if (!budget.step()) return undefined;
      const capturedOwner = creation.ownerFor(location);
      if (capturedOwner !== owner) captures.push({ subject: location, owner: capturedOwner });
    }
    if (!rows.add(2 + footprint.ports.size + captures.length)) return undefined;
    const selected = Object.freeze({ owner, ports: Object.freeze([...footprint.ports]),
      captures: Object.freeze(captures), contexts: new Map<string | undefined, SourceStorageFrame>() });
    summaries.set(value, selected);
    return selected;
  };
  return Object.freeze({
    instantiate(value: SourceStorageSubject, scope: SourceStorageScope): SourceStorageTerm | undefined {
      const selected = initializer(value);
      if (budget.failure() !== undefined) return undefined;
      if (selected === undefined || scope.kind !== "frame" || scope.owner !== selected.owner || scope.invocation === undefined)
        return sourceStorageReference(value, scope);
      return budget.withRows(temporary => {
        const inputs: { readonly subject: SourceStorageSubject; readonly term: SourceStorageTerm }[] = [];
        for (const input of selected.ports) {
          if (!budget.step() || !temporary.add(1)) return undefined;
          inputs.push({ subject: input, term: sourceStorageReference(input, scope) });
        }
        for (const capture of selected.captures) {
          if (!budget.step()) return undefined;
          const captured = capture.owner === undefined ? scopes.empty : scopes.owningScope(scope, capture.owner);
          if (captured === undefined) return sourceStorageReference(value, scope);
          if (!temporary.add(1)) return undefined;
          inputs.push({ subject: capture.subject, term: sourceStorageReference(capture.subject, captured) });
        }
        const context = inputs.length === 0 ? undefined : keys.context([inputs]);
        if (inputs.length !== 0 && context === undefined) return undefined;
        const parameter = selected.contexts.get(context);
        if (parameter === undefined) {
          if (!rows.add(1)) return undefined;
          selected.contexts.set(context, scope);
          return sourceStorageReference(value, scope);
        }
        return parameter === scope ? sourceStorageReference(value, scope)
          : Object.freeze({ kind: "instantiation", value: sourceStorageReference(value, parameter), parameter, scope });
      });
    },
    release(): void { summaries.clear(); rows.release(); },
  });
}
