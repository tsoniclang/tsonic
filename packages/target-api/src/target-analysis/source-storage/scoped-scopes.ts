import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import type { SourceStorageInvocationInputQuery } from "./invocation-inputs.js";
import type { createSourceStorageGraphQueries } from "./graph-queries.js";
import { sourceStorageReference } from "./scoped-model.js";
import { createSourceStorageScopedTraversal } from "./scoped-traversal.js";
import type { SourceStorageSubstitutionPath } from "./scoped-traversal.js";
import type { SourceStorageActivation, SourceStorageEquation, SourceStorageFrame, SourceStorageReduction, SourceStorageReference,
  SourceStorageScope, SourceStorageTerm, SourceStorageVariable } from "./scoped-model.js";

export function createSourceStorageScopes(source: TargetSourceProgram, budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery, invocationInputs: SourceStorageInvocationInputQuery,
  graphQueries: ReturnType<typeof createSourceStorageGraphQueries>,
  entryInputFor: (origin: SourceStorageSubject, variable: SourceStorageVariable) => SourceStorageSubject | undefined) {
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
  const variable = (equation: SourceStorageEquation, owner: Node, capture?: Node): SourceStorageVariable | undefined => {
    if (!budget.step()) return undefined;
    const key = `${equation.identity}:${identity(owner)}:${capture === undefined ? "" : identity(capture)}`;
    const cached = variables.get(key);
    if (cached !== undefined) return cached;
    if (!rows.add(1)) return undefined;
    const selected = Object.freeze({ kind: "variable" as const, equation, owner, capture });
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
  interface QueryMemo {
    readonly add: (cost: number) => boolean;
    readonly applications: Map<SourceStorageScope, { readonly key: string; readonly result: SourceStorageScope }>;
    readonly owners: Map<SourceStorageScope, Map<Node, SourceStorageScope | null>>;
    readonly families: Map<SourceStorageScope, SourceStorageEquation | null>;
    readonly lookups: Map<SourceStorageScope, Map<SourceStorageSubject, SourceStorageReduction | null>>;
  }
  let activeMemo: QueryMemo | undefined;
  const withMemo = <Value>(collect: (memo: QueryMemo) => Value): Value => {
    if (activeMemo !== undefined) return collect(activeMemo);
    return budget.withRows(temporary => {
      const memo: QueryMemo = { add: temporary.add, applications: new Map(), owners: new Map(), families: new Map(), lookups: new Map() };
      activeMemo = memo;
      try { return collect(memo); }
      finally { activeMemo = undefined; memo.applications.clear(); memo.owners.clear(); memo.families.clear(); memo.lookups.clear(); }
    });
  };
  const substitutionKey = (substitutions: ReadonlyMap<SourceStorageVariable, SourceStorageScope>): string =>
    [...substitutions].map(([input, replacement]) => [identity(input), identity(replacement)] as const)
      .sort((left, right) => left[0] - right[0]).map(entry => entry.join(":")).join(";");
  const applyScope = (scope: SourceStorageScope, replacements: ReadonlyMap<SourceStorageVariable, SourceStorageScope>): SourceStorageScope | undefined => withMemo(memo => {
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
    const request = scope.kind === "substitution" ? substitutionKey(selected) : undefined;
    const applied = request === undefined ? undefined : memo.applications.get(scope);
    if (applied !== undefined && applied.key === request) return applied.result;
    const remember = (result: SourceStorageScope): SourceStorageScope | undefined => {
      if (request === undefined) return result;
      if (applied === undefined && !memo.add(1)) return undefined;
      memo.applications.set(scope, Object.freeze({ key: request, result }));
      return result;
    };
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
    const key = substitutionKey(substitutions);
    const retained = views.get(base);
    const cached = retained?.get(key);
    if (cached !== undefined) return remember(cached);
    if (!rows.add(1 + substitutions.size + (retained === undefined ? 1 : 0))) return undefined;
    const result = Object.freeze({ kind: "substitution" as const, scope: base, substitutions });
    const selections = retained ?? new Map<string, SourceStorageScope>();
    selections.set(key, result);
    views.set(base, selections);
    return remember(result);
  });
  const applyTerm = (term: SourceStorageTerm, replacements: ReadonlyMap<SourceStorageVariable, SourceStorageScope>): SourceStorageTerm | undefined => {
    if (!budget.step()) return undefined;
    if (term.kind === "execution-root" || term.kind === "empty") return term;
    if (term.kind === "transition") {
      const condition = applyTerm(term.condition, replacements);
      if (condition === undefined) return undefined;
      return budget.withRows(temporary => {
        const free = new Map<SourceStorageVariable, SourceStorageScope>();
        for (const [input, replacement] of replacements) {
          if (!budget.step()) return undefined;
          if (input === term.capture) continue;
          if (!temporary.add(1)) return undefined;
          free.set(input, replacement);
        }
        const value = free.size === 0 ? term.value : applyTerm(term.value, free);
        return value === undefined ? undefined : Object.freeze({ ...term, condition, value });
      });
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
  const traverse = createSourceStorageScopedTraversal(budget);
  const applyPath = (term: SourceStorageTerm, path: SourceStorageSubstitutionPath | undefined): SourceStorageTerm | undefined => {
    let selected: SourceStorageTerm | undefined = term;
    for (let current = path; current !== undefined; current = current.parent) {
      if (!budget.step() || selected === undefined) return undefined;
      selected = applyTerm(selected, current.replacements);
    }
    return selected;
  };
  const selectInput = (origin: SourceStorageSubject, scope: SourceStorageScope,
    retain: (cost: number) => boolean): SourceStorageReduction | undefined => {
    const root = subject(origin.node, origin.kind);
    if (root === undefined) return undefined;
    for (const current of traverse(scope)) {
      if (current.scope.kind === "variable") {
        const initial = entryInputFor(origin, current.scope);
        if (initial !== undefined) {
          if (!retain(1)) return undefined;
          const selected = applyPath(sourceStorageReference(initial, current.scope.equation.initial), current.path);
          return selected === undefined ? undefined : Object.freeze({ kind: "replace", terms: Object.freeze([selected]) });
        }
        return { kind: "expand", variable: current.scope };
      }
      const entries = current.scope.entries.get(root);
      if (entries !== undefined) {
        const terms: SourceStorageTerm[] = [];
        for (const entry of entries) {
          if (!budget.step() || !retain(1)) return undefined;
          const projected = project(entry, origin);
          const applied = projected === undefined ? undefined : applyPath(projected, current.path);
          if (applied === undefined) return undefined;
          terms.push(applied);
        }
        return Object.freeze({ kind: "replace", terms: Object.freeze(terms) });
      }
    }
    return undefined;
  };
  const lookup = (origin: SourceStorageSubject, scope: SourceStorageScope): SourceStorageReduction | undefined => {
    if (!budget.step() || origin.kind !== "input" && origin.kind !== "receiver") return undefined;
    return withMemo(memo => {
      const selections = memo.lookups.get(scope);
      const retained = selections?.get(origin);
      if (retained !== undefined) return retained ?? undefined;
      const selected = selectInput(origin, scope, memo.add);
      if (budget.failure() !== undefined || !memo.add(selections === undefined ? 2 : 1)) return undefined;
      const inputs = selections ?? new Map<SourceStorageSubject, SourceStorageReduction | null>();
      inputs.set(origin, selected ?? null); memo.lookups.set(scope, inputs);
      return selected;
    });
  };
  const frames = new Map<string, SourceStorageFrame>();
  const frameFor = (candidate: Node, invocation: Node, parent: SourceStorageScope, captured: SourceStorageScope,
    equation?: SourceStorageEquation): SourceStorageFrame | undefined => {
    if (!budget.step()) return undefined;
    const key = `${[candidate, invocation, parent, captured].map(identity).join(":")}:${equation?.identity ?? ""}`;
    const cached = frames.get(key);
    if (cached !== undefined) return cached;
    const entries = new Map<SourceStorageSubject, readonly SourceStorageReference[]>();
    const frame: SourceStorageFrame = Object.freeze({ kind: "frame", owner: candidate, invocation, caller: parent, equation, entries,
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
  const owningScope = (scope: SourceStorageScope, owner: Node): SourceStorageScope | undefined => withMemo(memo => {
    if (!budget.step()) return undefined;
    if (scope === empty) return undefined;
    if (scope.kind !== "substitution" && scope.owner === owner) return scope;
    const selections = memo.owners.get(scope);
    const retained = selections?.get(owner);
    if (retained !== undefined) return retained ?? undefined;
    let selected: SourceStorageScope | undefined;
    for (const current of traverse(scope)) {
      if (current.scope.owner !== owner) continue;
      selected = current.scope;
      for (let path = current.path; path !== undefined; path = path.parent) {
        if (!budget.step() || selected === undefined) return undefined;
        selected = applyScope(selected, path.replacements);
      }
      break;
    }
    if (budget.failure() !== undefined || !memo.add(selections === undefined ? 2 : 1)) return undefined;
    const values = selections ?? new Map<Node, SourceStorageScope | null>();
    values.set(owner, selected ?? null);
    memo.owners.set(scope, values);
    return selected;
  });
  const family = (scope: SourceStorageScope): SourceStorageEquation | undefined => withMemo(memo => {
    if (!budget.step()) return undefined;
    if (scope === empty) return undefined;
    if (scope.kind === "variable") return scope.equation;
    const retained = memo.families.get(scope);
    if (retained !== undefined) return retained ?? undefined;
    let equation: SourceStorageEquation | undefined;
    for (const current of traverse(scope, "caller")) {
      if (current.scope.equation === undefined) continue;
      equation = current.scope.equation;
      break;
    }
    if (budget.failure() !== undefined || !memo.add(1)) return undefined;
    memo.families.set(scope, equation ?? null);
    return equation;
  });
  const activationKeys = new Map<SourceStorageScope, SourceStorageActivation>();
  const activations = new Map<string, SourceStorageActivation>();
  const activation = (scope: SourceStorageScope): SourceStorageActivation | undefined => budget.withRows(temporary => {
    if (!budget.step()) return undefined;
    if (activationKeys.has(scope)) return activationKeys.get(scope);
    const intern = (key: string, variable: SourceStorageVariable | undefined): SourceStorageActivation | undefined => {
      let selected = activations.get(key);
      if (selected !== undefined) return selected;
      if (!rows.add(2)) return undefined;
      selected = Object.freeze({ key: `${activations.size}`, variable }); activations.set(key, selected);
      return selected;
    };
    const remember = (scope: SourceStorageScope, value: SourceStorageActivation): boolean => {
      if (activationKeys.has(scope)) return true;
      if (!rows.add(1)) return false;
      activationKeys.set(scope, value);
      return true;
    };
    const pending: { readonly scope: SourceStorageFrame; readonly unmodified: boolean }[] = [];
    let selected: SourceStorageActivation | undefined;
    for (const current of traverse(scope, "caller")) {
      if (!budget.step()) return undefined;
      const retained = current.path === undefined ? activationKeys.get(current.scope) : undefined;
      if (retained !== undefined) { selected = retained; break; }
      if (current.scope.kind === "variable" || current.scope.invocation === undefined) {
        selected = intern(current.scope.kind === "variable"
          ? `v${current.scope.equation.identity}:${identity(current.scope.owner)}:${current.scope.capture === undefined ? "" : identity(current.scope.capture)}` : "root",
          current.scope.kind === "variable" ? current.scope : undefined);
        if (selected === undefined || !remember(current.scope, selected)) return undefined;
        break;
      }
      if (!temporary.add(1)) return undefined;
      pending.push({ scope: current.scope, unmodified: current.path === undefined });
    }
    if (selected === undefined) {
      budget.reject("Source storage activation ownership must be acyclic."); return undefined;
    }
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      if (!budget.step()) return undefined;
      const current = pending[index]!;
      selected = intern(`f${identity(current.scope.invocation!)}:${selected.key}`, selected.variable);
      if (selected === undefined || current.unmodified && !remember(current.scope, selected)) return undefined;
    }
    return remember(scope, selected) ? selected : undefined;
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
    owningScope, family, activation, activationKey: (scope: SourceStorageScope) => activation(scope)?.key, formals,
    withQuery: <Value>(collect: () => Value): Value => withMemo(() => collect()) });
}

export type SourceStorageScopes = ReturnType<typeof createSourceStorageScopes>;
