import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import type { SourceStorageInvocationInputQuery } from "./invocation-inputs.js";
import type { createSourceStorageGraphQueries } from "./graph-queries.js";
import { sourceStorageReference } from "./scoped-model.js";
import type { SourceStorageEquation, SourceStorageFrame, SourceStorageReduction, SourceStorageReference,
  SourceStorageScope, SourceStorageTerm, SourceStorageVariable } from "./scoped-model.js";

export function createSourceStorageScopes(source: TargetSourceProgram, budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery, invocationInputs: SourceStorageInvocationInputQuery,
  graphQueries: ReturnType<typeof createSourceStorageGraphQueries>) {
  const rows = budget.createRows();
  const identities = new Map<object, number>();
  const identity = (value: object): number => {
    const cached = identities.get(value);
    if (cached !== undefined) return cached;
    if (!rows.add(1)) return -1;
    const selected = identities.size;
    identities.set(value, selected);
    return selected;
  };
  const empty: SourceStorageFrame = Object.freeze({ kind: "frame", entries: new Map(), parents: Object.freeze([]) });
  identity(empty);
  const variables = new Map<string, SourceStorageVariable>();
  const variable = (equation: SourceStorageEquation, owner: Node): SourceStorageVariable | undefined => {
    if (!budget.step()) return undefined;
    const key = `${equation.identity}:${identity(owner)}`;
    const cached = variables.get(key);
    if (cached !== undefined) return cached;
    if (!rows.add(1)) return undefined;
    const selected = Object.freeze({ kind: "variable" as const, equation, owner });
    variables.set(key, selected);
    return selected;
  };
  const variablesFor = graphQueries.fixedPoint<SourceStorageScope, SourceStorageVariable>((scope, read, emit) => {
    if (scope.kind === "variable") return emit(scope);
    const inputs = scope.kind === "substitution" ? [scope.scope]
      : [...scope.parents, ...[...scope.entries.values()].flatMap(entries => entries.map(entry => entry.scope))];
    for (const input of inputs) {
      if (!budget.step()) return false;
      const variables = read(input);
      if (variables === undefined) return false;
      for (const variable of variables) {
        if (!budget.step()) return false;
        const replacement = scope.kind === "substitution" ? scope.substitutions.get(variable) : undefined;
        if (replacement === undefined) { if (!emit(variable)) return false; }
        else {
          const values = read(replacement);
          if (values === undefined) return false;
          for (const value of values) if (!budget.step() || !emit(value)) return false;
        }
      }
    }
    return true;
  });
  const views = new Map<SourceStorageScope, Map<string, SourceStorageScope>>();
  const applyScope = (scope: SourceStorageScope, replacements: ReadonlyMap<SourceStorageVariable, SourceStorageScope>): SourceStorageScope | undefined => {
    if (!budget.step()) return undefined;
    if (scope.kind === "variable") return replacements.get(scope) ?? scope;
    const inputs = variablesFor(scope);
    if (inputs === undefined) return undefined;
    const selected = new Map<SourceStorageVariable, SourceStorageScope>();
    for (const input of inputs) {
      if (!budget.step()) return undefined;
      const replacement = replacements.get(input);
      if (replacement !== undefined) selected.set(input, replacement);
    }
    if (selected.size === 0) return scope;
    const base = scope.kind === "substitution" ? scope.scope : scope;
    const substitutions = new Map<SourceStorageVariable, SourceStorageScope>();
    if (scope.kind === "substitution") for (const [input, replacement] of scope.substitutions) {
      const applied = applyScope(replacement, selected);
      if (applied === undefined) return undefined;
      substitutions.set(input, applied);
    }
    const originals = variablesFor(base);
    if (originals === undefined) return undefined;
    for (const [input, replacement] of selected) {
      if (!budget.step()) return undefined;
      if (originals.has(input) && !substitutions.has(input)) substitutions.set(input, replacement);
    }
    const key = [...substitutions].map(([input, replacement]) => [identity(input), identity(replacement)] as const)
      .sort((left, right) => left[0] - right[0]).map(entry => entry.join(":")).join(";");
    const retained = views.get(base);
    const cached = retained?.get(key);
    if (cached !== undefined) return cached;
    if (!rows.add(1 + substitutions.size + (retained === undefined ? 1 : 0))) return undefined;
    const result = Object.freeze({ kind: "substitution" as const, scope: base, substitutions });
    const selections = retained ?? new Map<string, SourceStorageScope>();
    selections.set(key, result);
    views.set(base, selections);
    return result;
  };
  const applyTerm = (term: SourceStorageTerm, replacements: ReadonlyMap<SourceStorageVariable, SourceStorageScope>): SourceStorageTerm | undefined => {
    if (!budget.step()) return undefined;
    if (term.kind === "execution-root") return term;
    if (term.kind === "guard") {
      const condition = applyTerm(term.condition, replacements);
      const value = applyTerm(term.value, replacements);
      return condition === undefined || value === undefined ? undefined : Object.freeze({ ...term, condition, value });
    }
    if (term.kind === "store") {
      const destination = applyTerm(term.destination, replacements);
      const receiver = applyTerm(term.receiver, replacements);
      const value = applyTerm(term.value, replacements);
      return destination?.kind !== "leaf" && destination?.kind !== "reference" || receiver === undefined || value === undefined
        ? undefined : Object.freeze({ ...term, destination, receiver, value });
    }
    const scope = applyScope(term.scope, replacements);
    if (scope === undefined) return undefined;
    if (term.kind === "application") {
      const callee = applyTerm(term.callee, replacements);
      return callee === undefined ? undefined : Object.freeze({ ...term, scope, callee });
    }
    if (term.kind === "member") {
      const receiver = applyTerm(term.receiver, replacements);
      return receiver === undefined ? undefined : Object.freeze({ ...term, scope, receiver });
    }
    return Object.freeze({ ...term, scope });
  };
  const project = (entry: SourceStorageReference, origin: SourceStorageSubject): SourceStorageReference | undefined => {
    if (origin.projection.length === 0) return entry;
    const projected = subject(entry.subject.node, entry.subject.kind, [...entry.subject.projection, ...origin.projection]);
    return projected === undefined ? undefined : sourceStorageReference(projected, entry.scope);
  };
  const lookup = (origin: SourceStorageSubject, scope: SourceStorageScope): SourceStorageReduction | undefined => budget.withRows(temporary => {
    if (!budget.step() || origin.kind !== "input" && origin.kind !== "receiver") return undefined;
    const pending: { readonly scope: SourceStorageScope;
      readonly substitutions: readonly ReadonlyMap<SourceStorageVariable, SourceStorageScope>[] }[] = [{ scope, substitutions: [] }];
    const visited = new Map<SourceStorageScope, Set<string>>();
    const root = subject(origin.node, origin.kind);
    if (root === undefined) return undefined;
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const current = pending.pop()!;
      const key = current.substitutions.map(value => identity(value)).join(";");
      const checked = visited.get(current.scope);
      if (checked?.has(key)) continue;
      if (!temporary.add(checked === undefined ? 2 : 1)) return undefined;
      const retained = checked ?? new Set<string>(); retained.add(key); visited.set(current.scope, retained);
      const variable = current.scope.kind === "variable" ? current.scope : undefined;
      const replacementIndex = variable === undefined ? -1 : current.substitutions.findIndex(value => value.has(variable));
      if (replacementIndex >= 0) {
        pending.push({ scope: current.substitutions[replacementIndex]!.get(variable!)!,
          substitutions: current.substitutions.slice(replacementIndex + 1) });
        continue;
      }
      if (current.scope.kind === "substitution") {
        pending.push({ scope: current.scope.scope, substitutions: [current.scope.substitutions, ...current.substitutions] });
        continue;
      }
      if (current.scope.kind === "variable") {
        if (origin.kind === "receiver" || origin.kind === "input") return { kind: "expand", variable: current.scope };
        continue;
      }
      const entries = current.scope.entries.get(root);
      if (entries !== undefined) {
        const terms: SourceStorageTerm[] = [];
        for (const entry of entries) {
          if (!budget.step()) return undefined;
          let applied: SourceStorageTerm | undefined = project(entry, origin);
          for (const replacements of current.substitutions) {
            if (applied === undefined) return undefined;
            applied = applyTerm(applied, replacements);
          }
          if (applied === undefined) return undefined;
          terms.push(applied);
        }
        return Object.freeze({ kind: "replace", terms: Object.freeze(terms) });
      }
      for (let index = current.scope.parents.length - 1; index >= 0; index -= 1)
        pending.push({ scope: current.scope.parents[index]!, substitutions: current.substitutions });
    }
    return undefined;
  });
  const frames = new Map<string, SourceStorageFrame>();
  const frameFor = (candidate: Node, invocation: Node, parent: SourceStorageScope, captured: SourceStorageScope): SourceStorageFrame | undefined => {
    if (!budget.step()) return undefined;
    const key = [candidate, invocation, parent, captured].map(identity).join(":");
    const cached = frames.get(key);
    if (cached !== undefined) return cached;
    const entries = new Map<SourceStorageSubject, readonly SourceStorageReference[]>();
    const frame: SourceStorageFrame = Object.freeze({ kind: "frame", owner: candidate, invocation, caller: parent, entries,
      parents: Object.freeze(captured === parent ? [parent] : [captured, parent]) });
    const parameters = source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate) ? [] : source.ast.parameters(candidate);
    for (const parameter of [...parameters, candidate]) {
      if (parameter === undefined) continue;
      if (!budget.step()) return undefined;
      const formal = subject(parameter, parameter === candidate ? "receiver" : "input");
      if (formal === undefined) return undefined;
      const selected = invocationInputs(formal, candidate, invocation);
      const values: SourceStorageReference[] = [];
      for (const input of selected.subjects) {
        if (!budget.step()) return undefined;
        if (input !== formal) values.push(sourceStorageReference(input, selected.context === "callee" ? frame : parent));
      }
      if (values.length === 0) continue;
      entries.set(formal, Object.freeze(values));
    }
    if (budget.failure() !== undefined || !rows.add(1 + entries.size + [...entries.values()].reduce((cost, values) => cost + values.length, 0))) return undefined;
    frames.set(key, frame);
    identity(frame);
    return frame;
  };
  const find = (scope: SourceStorageScope, match: (scope: SourceStorageScope) => boolean): SourceStorageScope | undefined => budget.withRows(temporary => {
    const pending = [scope]; const visited = new Set<SourceStorageScope>();
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      if (!temporary.add(1)) return undefined;
      visited.add(current);
      if (match(current)) return current;
      if (current.kind === "variable") pending.push(current.equation.initial);
      else if (current.kind === "substitution") {
        const selected = find(current.scope, match);
        if (selected !== undefined) return applyScope(selected, current.substitutions);
      } else for (let index = current.parents.length - 1; index >= 0; index -= 1) pending.push(current.parents[index]!);
    }
    return undefined;
  });
  const owningScope = (scope: SourceStorageScope, owner: Node): SourceStorageScope | undefined =>
    find(scope, current => current.kind !== "substitution" && current.owner === owner);
  const family = (scope: SourceStorageScope): SourceStorageEquation | undefined => {
    const selected = find(scope, current => current.kind === "variable");
    return selected?.kind === "variable" ? selected.equation : undefined;
  };
  const activationKeys = new Map<SourceStorageScope, string>();
  const activations = new Map<string, string>();
  const activationKey = (scope: SourceStorageScope): string | undefined => budget.withRows(temporary => {
    const pending: { readonly scope: SourceStorageScope; readonly children: Iterator<SourceStorageScope> }[] = [];
    const visiting = new Set<SourceStorageScope>();
    const enter = (scope: SourceStorageScope): boolean => {
      if (visiting.has(scope)) { budget.reject("Source storage activation ownership must be acyclic."); return false; }
      if (!temporary.add(1)) return false;
      visiting.add(scope);
      const children = scope.kind === "substitution" ? [scope.scope, ...scope.substitutions.values()]
        : scope.kind === "frame" && scope.caller !== undefined ? [scope.caller] : [];
      pending.push({ scope, children: children[Symbol.iterator]() });
      return true;
    };
    if (!budget.step()) return undefined;
    if (activationKeys.has(scope)) return activationKeys.get(scope);
    if (!enter(scope)) return undefined;
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const current = pending[pending.length - 1]!;
      const next = current.children.next();
      if (!next.done) {
        if (!activationKeys.has(next.value) && !enter(next.value)) return undefined;
        continue;
      }
      const owner = current.scope;
      let key: string;
      if (owner.kind === "variable") key = `v${owner.equation.identity}:${identity(owner.owner)}`;
      else if (owner.kind === "substitution") key = `s${activationKeys.get(owner.scope)};${[...owner.substitutions]
        .map(([input, replacement]) => [identity(input), activationKeys.get(replacement)] as const)
        .sort((left, right) => left[0] - right[0]).map(entry => entry.join(":")).join(";")}`;
      else key = owner.invocation === undefined ? "root" : `f${identity(owner.invocation)}:${activationKeys.get(owner.caller!)}`;
      let selected = activations.get(key);
      if (!rows.add(selected === undefined ? 2 : 1)) return undefined;
      if (selected === undefined) { selected = `${activations.size}`; activations.set(key, selected); }
      activationKeys.set(owner, selected);
      visiting.delete(owner); pending.pop();
    }
    return activationKeys.get(scope);
  });
  const formals = (scope: SourceStorageScope): ReadonlySet<SourceStorageSubject> | undefined => budget.withRows(temporary => {
    const selected = new Set<SourceStorageSubject>(); const visited = new Set<SourceStorageScope>(); const pending = [scope];
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      if (!temporary.add(1)) return undefined;
      visited.add(current);
      if (current.kind === "variable") {
        const parameters = source.ast.is.IsClassDeclaration(current.owner) || source.ast.is.IsClassExpression(current.owner)
          ? [] : source.ast.parameters(current.owner);
        for (const parameter of [...parameters, current.owner]) {
          if (parameter === undefined || !budget.step()) continue;
          const formal = subject(parameter, parameter === current.owner ? "receiver" : "input");
          if (formal !== undefined) selected.add(formal);
        }
        pending.push(current.equation.initial);
      } else if (current.kind === "substitution") pending.push(current.scope, ...current.substitutions.values());
      else {
        for (const formal of current.entries.keys()) { if (!budget.step()) return undefined; selected.add(formal); }
        pending.push(...current.parents);
      }
    }
    return selected;
  });
  return Object.freeze({ empty, identity, variable, variablesFor, applyScope, applyTerm, lookup, frameFor,
    owningScope, family, activationKey, formals });
}

export type SourceStorageScopes = ReturnType<typeof createSourceStorageScopes>;
