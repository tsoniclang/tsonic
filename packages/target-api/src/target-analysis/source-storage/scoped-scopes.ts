import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import { sourceStorageFormalOwner } from "./subjects.js";
import { sourceStorageSubjectType } from "./components.js";
import { sourceStorageProjectComponents } from "./component-projections.js";
import type { SourceStorageInvocationInputQuery } from "./invocation-inputs.js";
import type { createSourceStorageGraphQueries } from "./graph-queries.js";
import { sourceStorageReference } from "./scoped-model.js";
import { createSourceStorageScopedTraversal } from "./scoped-traversal.js";
import type { SourceStorageSubstitutionPath } from "./scoped-traversal.js";
import type { SourceStorageActivation, SourceStorageEquation, SourceStorageFrame, SourceStorageBinding, SourceStorageReference,
  SourceStorageScope, SourceStorageTerm, SourceStorageVariable } from "./scoped-model.js";

function scopedMemo<Memo>(budget: SourceStorageBudget, create: (add: (cost: number) => boolean) => Memo) {
  let active: Memo | undefined;
  return <Value>(collect: (memo: Memo) => Value): Value => {
    if (active !== undefined) return collect(active);
    return budget.withRows(rows => {
      const memo = create(rows.add);
      active = memo;
      try { return collect(memo); }
      finally { active = undefined; }
    });
  };
}

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
  const variablesFor = graphQueries.fixedPoint<SourceStorageScope, SourceStorageVariable>((scope, read, emit, forward) => {
    if (scope.kind === "variable") return emit(scope);
    const inputs = scope.kind === "substitution" ? [scope.scope]
      : [...scope.parents, ...scope.caller === undefined ? [] : [scope.caller],
        ...[...scope.entries.values()].flatMap(entries => entries.map(entry => entry.scope))];
    for (const input of inputs) {
      if (!budget.step()) return false;
      if (scope.kind !== "substitution") {
        if (!forward(input)) return false;
        continue;
      }
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
  interface TraversalMemo {
    readonly add: (cost: number) => boolean;
    readonly owners: Map<SourceStorageScope, Map<Node, SourceStorageScope | null>>;
    readonly families: Map<SourceStorageScope, SourceStorageEquation | null>;
    readonly lookups: Map<SourceStorageScope, Map<SourceStorageSubject, SourceStorageBinding | null>>;
  }
  const withTraversal = scopedMemo<TraversalMemo>(budget, add => ({ add, owners: new Map(), families: new Map(), lookups: new Map() }));
  const withQueryMemo = scopedMemo(budget, add => ({ add, applications: new Map<SourceStorageScope, Map<string, SourceStorageScope>>(),
    lookups: new Map<SourceStorageScope, Map<SourceStorageSubject, SourceStorageBinding | null>>() }));
  const substitutionKey = (substitutions: ReadonlyMap<SourceStorageVariable, SourceStorageScope>): string =>
    [...substitutions].map(([input, replacement]) => [identity(input), identity(replacement)] as const)
      .sort((left, right) => left[0] - right[0]).map(entry => entry.join(":")).join(";");
  const applyScope = (scope: SourceStorageScope, replacements: ReadonlyMap<SourceStorageVariable, SourceStorageScope>): SourceStorageScope | undefined => withQueryMemo(memo => {
    if (!budget.step()) return undefined;
    if (scope === empty || replacements.size === 0) return scope;
    if (scope.kind === "variable") return replacements.get(scope) ?? scope;
    const inputs = variablesFor(scope);
    if (inputs === undefined) return undefined;
    const selected = new Map<SourceStorageVariable, SourceStorageScope>();
    const candidates = replacements.size < inputs.size ? replacements.keys() : inputs;
    for (const input of candidates) {
      if (!budget.step()) return undefined;
      if (!inputs.has(input)) continue;
      const replacement = replacements.get(input);
      if (replacement !== undefined) selected.set(input, replacement);
    }
    if (selected.size === 0) return scope;
    const request = scope.kind === "substitution" ? substitutionKey(selected) : undefined;
    const applied = request === undefined ? undefined : memo.applications.get(scope)?.get(request);
    if (applied !== undefined) return applied;
    const remember = (result: SourceStorageScope): SourceStorageScope | undefined => {
      if (request === undefined) return result;
      const selections = memo.applications.get(scope);
      if (!memo.add(selections === undefined ? 2 : 1)) return undefined;
      const values = selections ?? new Map<string, SourceStorageScope>();
      values.set(request, result); memo.applications.set(scope, values);
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
    if (term.kind === "guarded") {
      const value = applyTerm(term.value, replacements);
      return value === undefined ? undefined : Object.freeze({ ...term, value });
    }
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
      return destination === undefined || receiver === undefined || value === undefined
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
  const project = (entry: SourceStorageReference, origin: SourceStorageSubject, retain: (cost: number) => boolean): readonly SourceStorageReference[] | undefined => {
    if (origin.projection.length === 0) return retain(1) ? [entry] : undefined;
    const selected: SourceStorageReference[] = [];
    const collect = (projection: SourceStorageSubject["projection"]): void => {
      const projected = subject(entry.subject.node, entry.subject.kind, projection);
      if (projected !== undefined && retain(1)) selected.push(Object.freeze({ ...entry, subject: projected,
        kind: entry.scope.kind === "frame" && entry.scope.boundary === "declaration" ? "reference" : entry.kind }));
    };
    if (!origin.projection.some(component => component.kind === "member"))
      collect([...entry.subject.projection, ...origin.projection]);
    else {
      const root = subject(origin.node, origin.kind);
      const from = sourceStorageSubjectType(source, entry.subject);
      const to = root === undefined ? undefined : sourceStorageSubjectType(source, root);
      if (from === undefined || to === undefined) return undefined;
      sourceStorageProjectComponents(entry.subject.projection, from, to, origin.projection,
        source.semantics.forNode(entry.subject.node), budget, collect);
    }
    return budget.failure() === undefined ? selected : undefined;
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
  const selectEntries = (origin: SourceStorageSubject, entries: readonly SourceStorageReference[],
    path: SourceStorageSubstitutionPath | undefined, retain: (cost: number) => boolean): SourceStorageBinding | undefined => {
    const terms: SourceStorageTerm[] = [];
    for (const entry of entries) {
      if (!budget.step()) return undefined;
      const projected = project(entry, origin, retain);
      if (projected === undefined) return undefined;
      for (const value of projected) {
        const applied = applyPath(value, path);
        if (applied === undefined) return undefined;
        terms.push(applied);
      }
    }
    return Object.freeze({ kind: "replace", terms: Object.freeze(terms) });
  };
  const selectVariable = (origin: SourceStorageSubject, variable: SourceStorageVariable,
    path: SourceStorageSubstitutionPath | undefined, retain: (cost: number) => boolean): SourceStorageBinding | undefined => {
    const owner = sourceStorageFormalOwner(origin, source.ast);
    if (owner === undefined) return undefined;
    let lexical = variable.capture === undefined ? variable.owner : source.ast.parent(variable.owner);
    while (lexical !== undefined && lexical !== owner) {
      if (!budget.step()) return undefined;
      lexical = source.ast.parent(lexical);
    }
    if (lexical !== owner) return undefined;
    const initial = entryInputFor(origin, variable);
    if (initial === undefined) return Object.freeze({ kind: "expand", variable });
    if (!retain(1)) return undefined;
    const selected = applyPath(sourceStorageReference(initial, variable.equation.initial), path);
    return selected === undefined ? undefined : Object.freeze({ kind: "replace", terms: Object.freeze([selected]) });
  };
  const selectInput = (origin: SourceStorageSubject, root: SourceStorageSubject, scope: SourceStorageScope,
    retain: (cost: number) => boolean): SourceStorageBinding | undefined => {
    if (scope.kind === "variable") return selectVariable(origin, scope, undefined, retain);
    const local = (scope.kind === "substitution" ? scope.scope : scope).entries.get(root);
    if (local !== undefined) {
      if (scope.kind === "frame") return selectEntries(origin, local, undefined, retain);
      return budget.withRows(rows => rows.add(1) ? selectEntries(origin, local,
        { replacements: scope.substitutions, parent: undefined }, retain) : undefined);
    }
    for (const current of traverse(scope)) {
      if (current.scope.kind === "variable") {
        const selected = selectVariable(origin, current.scope, current.path, retain);
        if (selected !== undefined) return selected;
        continue;
      }
      const entries = current.scope.entries.get(root);
      if (entries !== undefined) return selectEntries(origin, entries, current.path, retain);
    }
    return undefined;
  };
  const lookup = (origin: SourceStorageSubject, scope: SourceStorageScope): SourceStorageBinding | undefined => {
    if (!budget.step() || origin.kind !== "input" && origin.kind !== "receiver") return undefined;
    if (origin.projection.length !== 0 && scope.kind === "frame" && scope.boundary === "declaration" &&
      sourceStorageFormalOwner(origin, source.ast) === scope.owner) return undefined;
    const root = subject(origin.node, origin.kind);
    if (root === undefined) return undefined;
    const withInputs = scope.kind === "substitution" && scope.scope.entries.has(root) ? withQueryMemo : withTraversal;
    return withInputs(memo => {
      const selections = memo.lookups.get(scope);
      const retained = selections?.get(origin);
      if (retained !== undefined) return retained ?? undefined;
      const selected = selectInput(origin, root, scope, memo.add);
      if (budget.failure() !== undefined || !memo.add(selections === undefined ? 2 : 1)) return undefined;
      const inputs = selections ?? new Map<SourceStorageSubject, SourceStorageBinding | null>();
      inputs.set(origin, selected ?? null); memo.lookups.set(scope, inputs);
      return selected;
    });
  };
  const frames = new Map<string, SourceStorageFrame>();
  const declarations = new Map<Node, Map<SourceStorageScope, SourceStorageFrame>>();
  const declarationFor = (owner: Node, parent: SourceStorageScope): SourceStorageFrame | undefined => {
    if (!budget.step()) return undefined;
    const retained = declarations.get(owner);
    const cached = retained?.get(parent);
    if (cached !== undefined) return cached;
    const parameters = source.ast.is.IsClassDeclaration(owner) || source.ast.is.IsClassExpression(owner) ? [] : source.ast.parameters(owner);
    if (!rows.add(3 + (parameters.length + 1) * 2 + (retained === undefined ? 1 : 0))) return undefined;
    const entries = new Map<SourceStorageSubject, readonly SourceStorageReference[]>();
    const frame: SourceStorageFrame = Object.freeze({ kind: "frame", owner, boundary: "declaration", entries,
      parents: Object.freeze([parent]) });
    for (const parameter of [...parameters, owner]) {
      if (parameter === undefined || !budget.step()) continue;
      const input = subject(parameter, parameter === owner ? "receiver" : "input");
      if (input === undefined) return undefined;
      entries.set(input, Object.freeze([Object.freeze({ kind: "leaf", subject: input, scope: frame })]));
    }
    if (budget.failure() !== undefined) return undefined;
    const selections = retained ?? new Map<SourceStorageScope, SourceStorageFrame>();
    selections.set(parent, frame);
    declarations.set(owner, selections);
    identity(frame);
    return frame;
  };
  const frameFor = (candidate: Node, invocation: Node, parent: SourceStorageScope, captured: SourceStorageScope,
    equation?: SourceStorageEquation): SourceStorageFrame | undefined => {
    if (!budget.step()) return undefined;
    const key = `${[candidate, invocation, parent, captured].map(identity).join(":")}:${equation?.identity ?? ""}`;
    const cached = frames.get(key);
    if (cached !== undefined) return cached;
    const entries = new Map<SourceStorageSubject, readonly SourceStorageReference[]>();
    const frame: SourceStorageFrame = Object.freeze({ kind: "frame", owner: candidate, invocation, caller: parent, equation, entries,
      parents: Object.freeze([captured]) });
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
  const owningScope = (scope: SourceStorageScope, owner: Node): SourceStorageScope | undefined => withTraversal(memo => {
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
  const family = (scope: SourceStorageScope): SourceStorageEquation | undefined => withTraversal(memo => {
    if (!budget.step()) return undefined;
    if (scope === empty) return undefined;
    if (scope.kind === "variable") return scope.equation;
    if (scope.kind === "frame" && scope.equation !== undefined) return scope.equation;
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
    const pending: { readonly scope: SourceStorageScope; readonly invocation: Node }[] = [];
    const visited = new Set<SourceStorageScope>();
    let selected: SourceStorageActivation | undefined;
    let current: SourceStorageScope | undefined = scope;
    while (current !== undefined) {
      if (!budget.step()) return undefined;
      const retained = activationKeys.get(current);
      if (retained !== undefined) { selected = retained; break; }
      if (visited.has(current)) break;
      if (!temporary.add(1)) return undefined;
      visited.add(current);
      const frame: SourceStorageFrame | SourceStorageVariable = current.kind === "substitution" ? current.scope : current;
      if (frame.kind === "variable" || frame.invocation === undefined) {
        selected = intern(frame.kind === "variable"
          ? `v${frame.equation.identity}:${identity(frame.owner)}:${frame.capture === undefined ? "" : identity(frame.capture)}` : "root",
          frame.kind === "variable" ? frame : undefined);
        if (selected === undefined || !remember(current, selected)) return undefined;
        break;
      }
      if (!temporary.add(1)) return undefined;
      pending.push({ scope: current, invocation: frame.invocation });
      if (frame.caller === undefined) break;
      const caller: SourceStorageScope | undefined = current.kind === "substitution"
        ? applyScope(frame.caller, current.substitutions) : frame.caller;
      if (caller === undefined) return undefined;
      current = caller;
    }
    if (selected === undefined) {
      budget.reject("Source storage activation ownership must be acyclic."); return undefined;
    }
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      if (!budget.step()) return undefined;
      const current = pending[index]!;
      selected = intern(`f${identity(current.invocation)}:${selected.key}`, selected.variable);
      if (selected === undefined || !remember(current.scope, selected)) return undefined;
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
  return Object.freeze({ empty, identity, variable, variablesFor, applyScope, applyTerm, lookup, frameFor, declarationFor,
    isSymbolic: (value: SourceStorageReference): boolean => value.kind === "leaf" && value.scope.kind === "frame" &&
      value.scope.boundary === "declaration" && sourceStorageFormalOwner(value.subject, source.ast) === value.scope.owner,
    owningScope, family, activation, activationKey: (scope: SourceStorageScope) => activation(scope)?.key, formals,
    withQuery: <Value>(collect: () => Value): Value => withQueryMemo(() => collect()),
    withTraversal: <Value>(collect: () => Value): Value => withTraversal(() => collect()) });
}

export type SourceStorageScopes = ReturnType<typeof createSourceStorageScopes>;
