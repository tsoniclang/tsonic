import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageTerm, SourceStorageReduction } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { createSourceStorageExecutionContext } from "./execution-context.js";
import type { SourceStorageChildContext, SourceStoragePendingReduction } from "./child-reduction.js";

export interface SourceStorageTransitionSuccessorContext extends Pick<ReturnType<typeof createSourceStorageExecutionContext>, "instanceCaptures"> {
  readonly source: TargetSourceProgram;
  readonly scopes: SourceStorageScopes;
  readonly absent: Extract<SourceStorageReduction, { readonly kind: "replace" }>;
  replaceChild(child: SourceStorageTerm, replace: (child: SourceStorageTerm) => SourceStorageTerm,
    context?: SourceStorageChildContext): SourceStoragePendingReduction | undefined;
}

export function createSourceStorageTransitionSuccessors(context: SourceStorageTransitionSuccessorContext) {
  const { source, scopes, absent, instanceCaptures, replaceChild } = context;
  const { ast, navigation } = source;
  return (term: Extract<SourceStorageTerm, { readonly kind: "transition" }>): SourceStoragePendingReduction | undefined => {
    if (term.condition.kind === "input-frontier") return { kind: "replace", terms: [term.condition] };
    if (term.condition.kind !== "leaf") return replaceChild(term.condition, condition =>
      condition === term.condition ? term : Object.freeze({ ...term, condition }), { contributes: false });
    const node = term.condition.subject.node;
    if (ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node)) {
      const owner = ast.is.IsConstructorDeclaration(term.capture.owner) ? ast.parent(term.capture.owner) : term.capture.owner;
      if (owner === undefined) return undefined;
      const captures = instanceCaptures(term.capture.owner, term.condition);
      if (captures === undefined) return undefined;
      const terms: SourceStorageTerm[] = [];
      for (const captured of captures) {
        const value = scopes.applyTerm(term.value, new Map([[term.capture, captured.bindings]]));
        if (value === undefined) return undefined;
        terms.push(value);
      }
      return { kind: "replace", terms };
    } else {
      const selected = navigation.callableImplementation(node);
      if (selected.kind !== "resolved") return { kind: "replace", terms: [] };
      if (selected.implementation.declaration !== term.capture.owner) return absent;
    }
    const value = scopes.applyTerm(term.value, new Map([[term.capture, term.condition.scope]]));
    return value === undefined ? undefined : { kind: "replace", terms: [value] };
  };
}
