import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageContextFootprint } from "../graph/context-footprints.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import type { SourceStorageActivation, SourceStorageFrame, SourceStorageScope, SourceStorageScopeParameter, SourceStorageVariable } from "../graph/scoped-model.js";
import type { SourceStorageBudget, SourceStorageRows } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import { sourceStorageFormalOwner } from "../model/subjects.js";
import type { SourceStorageCallbackEntry } from "../model/types.js";

export interface SourceStorageCreationContext {
  readonly footprints: { select(subject: SourceStorageSubject): SourceStorageContextFootprint | undefined };
  ownerFor(subject: SourceStorageSubject): Node | undefined;
}

export function sourceStorageActivationOwner(source: TargetSourceProgram,
  enclosing: (node: Node) => Node | undefined, subject: SourceStorageSubject): Node | undefined {
  if (subject.kind === "input" && source.ast.is.IsParameterDeclaration(subject.node)) return sourceStorageFormalOwner(subject, source);
  const region = enclosing(subject.node);
  return subject.kind === "return" || subject.kind === "receiver" ? subject.node
    : region === undefined ? undefined : sourceStorageRegionOwner(source.ast, region);
}

export function createSourceStorageActivationKeys(budget: SourceStorageBudget, rows: SourceStorageRows,
  queries: {
    readonly empty: SourceStorageFrame;
    readonly subject: SourceStorageSubjectQuery;
    identity(value: object): number;
    callbackKey(callback: SourceStorageCallbackEntry | undefined): string;
    owningScope(scope: SourceStorageScope, owner: Node): SourceStorageScope | undefined;
    applyScope(scope: SourceStorageScope, substitutions: ReadonlyMap<SourceStorageScopeParameter, SourceStorageScope>): SourceStorageScope | undefined;
    declarationFor(owner: Node, parent: SourceStorageScope): SourceStorageFrame | undefined;
  }, context: SourceStorageCreationContext) {
  const activationKeys = new Map<SourceStorageScope, SourceStorageActivation>();
  const activations = new Map<string, SourceStorageActivation>();
  let rootActivation: SourceStorageActivation | undefined;
  const creationScopes = (scope: SourceStorageScope, frame: SourceStorageFrame): readonly SourceStorageScope[] | undefined => {
    if (frame.owner === undefined) return undefined;
    const subject = queries.subject(frame.owner);
    const footprint = subject === undefined ? undefined : context.footprints.select(subject);
    if (footprint === undefined) return undefined;
    return budget.withRows(temporary => {
      const selected = new Set<SourceStorageScope>();
      const owners = new Set<Node>();
      for (const inputs of [footprint.ports, footprint.locations]) for (const input of inputs) {
        if (!budget.step()) return undefined;
        const owner = context.ownerFor(input);
        if (owner === undefined || owner === frame.owner || owners.has(owner)) continue;
        if (!temporary.add(1)) return undefined;
        owners.add(owner);
        let found = false;
        for (const parent of frame.parents) {
          if (!budget.step()) return undefined;
          const captured = scope.kind === "substitution" ? queries.applyScope(parent, scope.substitutions) : parent;
          const actual = captured === undefined ? undefined : queries.owningScope(captured, owner);
          if (actual === undefined) continue;
          found = true;
          if (!selected.has(actual) && !temporary.add(1)) return undefined;
          selected.add(actual);
        }
        if (!found) {
          // No captured scope binds this enclosing owner: the walk is unbound for it, so its activation is the owner's
          // symbolic declaration activation (any activation), exactly as unbound formals are declaration leaves.
          const symbolic = queries.declarationFor(owner, queries.empty);
          if (symbolic === undefined) {
            budget.reject("Source storage activations require a symbolic declaration scope for an unbound creation-footprint owner.");
            return undefined;
          }
          if (!selected.has(symbolic) && !temporary.add(1)) return undefined;
          selected.add(symbolic);
        }
      }
      return Object.freeze([...selected]);
    });
  };
  const activation = (scope: SourceStorageScope): SourceStorageActivation | undefined => budget.withRows(temporary => {
    if (!budget.step()) return undefined;
    if (rootActivation === undefined) {
      if (!budget.step() || !rows.add(2)) return undefined;
      rootActivation = Object.freeze({ key: "root", variable: undefined, closed: true,
        owner: undefined, creation: Object.freeze([]), invocation: undefined, parent: undefined });
    }
    const root = rootActivation;
    const noCreation = root.creation;
    if (scope === queries.empty) return root;
    const cached = activationKeys.get(scope);
    if (cached !== undefined) return cached;
    const intern = (key: string, variable: SourceStorageVariable | undefined, owner: Node | undefined,
      creation: readonly SourceStorageActivation[],
      context: { readonly invocation: Node; readonly parent: SourceStorageActivation; readonly nativeEntry?: string } | undefined): SourceStorageActivation | undefined => {
      const retained = activations.get(key);
      if (retained !== undefined) return retained;
      if (!rows.add(2 + creation.length)) return undefined;
      const closed = variable === undefined && creation.every(value => value.closed) &&
        (context === undefined || context.parent.closed);
      const selected: SourceStorageActivation = Object.freeze(context === undefined
        ? { key: `${activations.size}`, variable, closed, owner, creation, invocation: undefined, parent: undefined }
        : { key: `${activations.size}`, variable, closed, owner, creation,
          invocation: context.invocation, parent: context.parent, nativeEntry: context.nativeEntry });
      activations.set(key, selected);
      return selected;
    };
    const remember = (scope: SourceStorageScope, value: SourceStorageActivation): boolean => {
      if (activationKeys.has(scope)) return true;
      if (!rows.add(1)) return false;
      activationKeys.set(scope, value);
      return true;
    };
    const pending: ({ readonly kind: "visit"; readonly scope: SourceStorageScope } |
      { readonly kind: "complete"; readonly scope: SourceStorageScope; readonly frame: SourceStorageFrame;
        readonly captures: readonly SourceStorageScope[]; readonly caller: SourceStorageScope | undefined })[] =
      [{ kind: "visit", scope }];
    const active = new Set<SourceStorageScope>();
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const current = pending.pop();
      if (current === undefined) return undefined;
      if (activationKeys.has(current.scope)) continue;
      if (current.kind === "visit") {
        if (active.has(current.scope)) {
          budget.reject("Source storage activation ownership must be acyclic."); return undefined;
        }
        const frame = current.scope.kind === "substitution" ? current.scope.scope : current.scope;
        if (current.scope === queries.empty) continue;
        if (frame.kind === "variable") {
          const selected = intern(`v${frame.equation.identity}:${queries.identity(frame.owner)}:${frame.capture === undefined ? "" : queries.identity(frame.capture)}:${queries.callbackKey(frame.callback)}`,
              frame, frame.owner, noCreation, undefined);
          if (selected === undefined || !remember(current.scope, selected)) return undefined;
          continue;
        }
        const caller = frame.caller === undefined ? undefined : current.scope.kind === "substitution"
          ? queries.applyScope(frame.caller, current.scope.substitutions) : frame.caller;
        if (frame.owner === undefined || frame.invocation !== undefined && caller === undefined) {
          budget.reject("Source storage activation ownership must be acyclic and retain its actual callable owner and invocation caller."); return undefined;
        }
        const captures = creationScopes(current.scope, frame);
        if (captures === undefined || !temporary.add(2 + captures.length)) return undefined;
        active.add(current.scope);
        pending.push({ kind: "complete", scope: current.scope, frame, captures, caller });
        for (const captured of captures) pending.push({ kind: "visit", scope: captured });
        if (caller !== undefined) pending.push({ kind: "visit", scope: caller });
        continue;
      }
      const creation: SourceStorageActivation[] = [];
      for (const captured of current.captures) {
        if (!budget.step()) return undefined;
        const selected = captured === queries.empty ? root : activationKeys.get(captured);
        if (selected === undefined) return undefined;
        creation.push(selected);
      }
      const parent = current.caller === undefined ? undefined : current.caller === queries.empty ? root : activationKeys.get(current.caller);
      if (current.caller !== undefined && parent === undefined) return undefined;
      const nativeEntry = current.frame.callback === undefined ? undefined : queries.callbackKey(current.frame.callback);
      const owner = current.frame.owner;
      if (owner === undefined) return undefined;
      const context = current.frame.invocation === undefined ? undefined : parent === undefined ? undefined
        : { invocation: current.frame.invocation, parent, nativeEntry };
      if (current.frame.invocation !== undefined && context === undefined) return undefined;
      const selected = intern(
        `${current.frame.invocation === undefined ? "d" : `f${queries.identity(current.frame.invocation)}`}:${queries.identity(owner)}:${nativeEntry ?? ""}:${parent?.key ?? ""}:${creation.map(value => value.key).join(":")}`,
        undefined, owner, Object.freeze(creation), context);
      if (selected === undefined || !remember(current.scope, selected)) return undefined;
      active.delete(current.scope);
    }
    return activationKeys.get(scope);
  });
  return activation;
}
