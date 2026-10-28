import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageStore } from "../graph/stored-values.js";
import type { SourceStorageStoredProjection } from "../graph/store-projections.js";
import type { SourceStorageCallEffect, SourceStorageCallbackEntry, SourceStorageDomainBoundary } from "../model/types.js";
import type { createSourceStorageExecutionRegions } from "../graph/execution-regions.js";
import type { createSourceStorageMemberFlow } from "../graph/member-flow.js";
import type { createSourceStorageContextInputs } from "./context-inputs.js";
import type { createSourceStorageGuardedValues } from "../graph/guarded-values.js";
import type { SourceStorageContextLocation } from "../graph/context-locations.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageInvocationInputQuery, SourceStorageInvocationInputSelectionQuery } from "../graph/invocation-inputs.js";
import { sourceStorageNativeInputSlots } from "../graph/invocation-inputs.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageAccessorInvocation, SourceStorageReduction, SourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageFormalOwner } from "../model/subjects.js";
import { sourceStorageSubjectType } from "../model/components.js";

export interface SourceStorageScopedTransport {
  declarationIsAmbient(declaration: Node): boolean | undefined;
  readonly subject: SourceStorageSubjectQuery;
  readonly invocationTargets: ReadonlyMap<Node, SourceStorageSubject>;
  readonly invocationEffects: ReadonlyMap<Node, SourceStorageCallEffect>;
  readonly invocationDeclarations: ReadonlyMap<Node, Node>;
  readonly invocations: ReadonlySet<Node>;
  readonly visitedNodes: readonly Node[];
  readonly pointerInvocations: ReadonlySet<Node>;
  readonly thrownOrigins: ReadonlyMap<Node, ReadonlySet<SourceStorageSubject>>;
  readonly unresolvedThrows: ReadonlyMap<Node, string>;
  pointerAccessors(invocation: Node): ReadonlySet<Node> | undefined;
  resumedImplementations(invocation: Node): ReadonlySet<Node> | undefined;
  readonly accessorTargets: ReadonlyMap<Node, readonly SourceStorageAccessorInvocation[]>;
  readonly invocationInputs: SourceStorageInvocationInputQuery;
  readonly inputSlotsFor: SourceStorageInvocationInputSelectionQuery;
  readonly sourceFiles: readonly SourceFile[];
  readonly regions: ReturnType<typeof createSourceStorageExecutionRegions>;
  readonly memberFlow: ReturnType<typeof createSourceStorageMemberFlow>;
  readonly guardedValues: ReturnType<typeof createSourceStorageGuardedValues>;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  sourceFileFor(subject: SourceStorageSubject): SourceFile | undefined;
  locationFor(node: Node | undefined): SourceStorageSubject | undefined;
  nativeConstructorsFor(subject: SourceStorageSubject): readonly Node[] | undefined;
  bindingInputFor(subject: SourceStorageSubject): SourceStorageSubject | undefined;
  incomingFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
  readonly contextualInputs: ReturnType<typeof createSourceStorageContextInputs>;
  contextLocation(subject: SourceStorageSubject): SourceStorageContextLocation | undefined;
  storedValuesFor(subject: SourceStorageSubject): readonly SourceStorageStoredProjection[] | undefined;
  storesFor(subject: SourceStorageSubject): Iterable<SourceStorageStore> | undefined;
  storesIn(region: Node): Iterable<SourceStorageStore> | undefined;
  invocationImplementations(invocation: Node): ReadonlySet<Node>;
  hasOnlySourceImplementations(invocation: Node): boolean;
  callbackEntriesFor(invocation: Node): readonly SourceStorageCallbackEntry[];
  callbackImplementationsFor(entry: SourceStorageCallbackEntry): ReadonlySet<Node>;
  callbackInputFrontiersFor(invocation: Node): ReadonlySet<Omit<SourceStorageDomainBoundary, "bindings"> & {
    readonly callback?: SourceStorageCallbackEntry;
  }> | undefined;
  memberAccessorsFor(declaration: Node): ReadonlySet<Node> | undefined;
  isOpaque(invocation: Node): boolean;
}

export function sourceStorageTransparentInput(subject: SourceStorageSubject, ast: AstReader,
  transport: Pick<SourceStorageScopedTransport, "incomingFor">): SourceStorageSubject | undefined {
  if (subject.kind !== "value" || subject.projection.length !== 0) return undefined;
  const parents = transport.incomingFor(subject);
  const input = parents.size === 1 ? parents.values().next().value : undefined;
  if (input?.kind === "input" && input.node === subject.node) return input;
  return ast.is.IsVariableDeclaration(subject.node) && ast.variableDeclarationKind(subject.node) === "const" ? input : undefined;
}

export function createSourceStorageBindingInputs(ast: AstReader,
  transport: Pick<SourceStorageScopedTransport, "incomingFor" | "guardedValues">,
  budget: SourceStorageBudget): (subject: SourceStorageSubject) => SourceStorageSubject | undefined {
  const selections = new Map<SourceStorageSubject, SourceStorageSubject | null>();
  const retained = budget.createRows();
  return subject => {
    if (!budget.step()) return undefined;
    if (subject.projection.length !== 0) return undefined;
    const transparent = sourceStorageTransparentInput(subject, ast, transport);
    if (transparent !== undefined) return transparent;
    if (subject.kind !== "value" || !ast.is.IsIdentifier(subject.node) && ast.kindName(subject.node) !== "KindThisKeyword")
      return undefined;
    const previous = selections.get(subject);
    if (previous !== undefined) return previous ?? undefined;
    const selected = budget.withRows(rows => {
      let current = subject;
      let first: SourceStorageSubject | undefined;
      const visited = new Set<SourceStorageSubject>();
      while (current.kind === "value") {
        if (!budget.step()) return undefined;
        if (current.projection.length !== 0) return undefined;
        if (visited.has(current)) {
          budget.reject("Source storage binding aliases require an acyclic exact input."); return undefined;
        }
        if (!rows.add(1)) return undefined;
        visited.add(current);
        const completed = current === subject ? undefined : selections.get(current);
        if (completed !== undefined) return completed === null ? undefined : first ?? completed;
        let input = sourceStorageTransparentInput(current, ast, transport);
        if (input === undefined) {
          if (!ast.is.IsIdentifier(current.node) && ast.kindName(current.node) !== "KindThisKeyword" ||
            transport.guardedValues.appliesTo(current.node) !== false) return undefined;
          const inputs = transport.incomingFor(current);
          input = inputs.size === 1 ? inputs.values().next().value : undefined;
        }
        if (input === undefined) return undefined;
        first ??= input;
        current = input;
      }
      return current.kind === "input" || current.kind === "receiver" ? first : undefined;
    });
    if (budget.failure() !== undefined || !retained.add(1)) return undefined;
    selections.set(subject, selected ?? null);
    return selected;
  };
}

export function sourceStorageInputBinding(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes,
  term: SourceStorageReference, initializer: Node | undefined): SourceStorageReduction | undefined {
  const owner = sourceStorageFormalOwner(term.subject, source);
  if (term.subject.projection.length !== 0) {
    const base = scopes.inputBase(term.subject, term.scope);
    if (base === undefined) return undefined;
    const selected = base === term.subject ? undefined : scopes.lookup(base, term.scope);
    const value = selected?.kind === "replace" && selected.terms.length === 1 ? selected.terms[0] : undefined;
    const symbolic = value !== undefined && (value.kind === "leaf" || value.kind === "input-frontier") &&
      value.subject === base && scopes.isSymbolic(value);
    if (selected !== undefined && !symbolic) {
      const remaining = transport.subject(term.subject.node, term.subject.kind,
        term.subject.projection.slice(base.projection.length));
      return remaining === undefined ? undefined : { kind: "project", inputs: [sourceStorageReference(base, term.scope)],
        select: value => budget.withRows(temporary => scopes.project(value, remaining, temporary.add, base, term.scope)) };
    }
  }
  const bound = scopes.lookup(term.subject, term.scope);
  if (bound?.kind === "expand") return bound;
  const unresolved = (reason: string): Extract<SourceStorageReduction, { readonly kind: "replace" }> => ({ kind: "replace", terms: [Object.freeze({
    kind: "unresolved", subject: term.subject, scope: term.scope, reason,
  })] });
  if (bound?.initialization === "initialized") return bound;
  if (initializer !== undefined && term.subject.projection.length !== 0) {
    const root = transport.subject(term.subject.node, "input");
    return root === undefined ? undefined : { kind: "project", inputs: [sourceStorageReference(root, term.scope)],
      select: value => budget.withRows(temporary => scopes.project(value, term.subject, temporary.add, undefined, term.scope)) };
  }
  if (initializer === undefined) return bound;
  const fallback = transport.subjectFor(initializer);
  if (fallback === undefined) return unresolved("An initialized input requires its exact checked default value.");
  const activation = owner === undefined ? undefined : scopes.boundActivation(term.scope, owner);
  const native = activation?.nativeEntry;
  if (owner !== undefined && activation !== undefined && native !== undefined) {
    const semantics = source.semantics.forNode(native.invocation);
    const inputs = sourceStorageNativeInputSlots(source, owner, term.subject,
      transport.inputSlotsFor(owner, native.invocation, native.callback), semantics, budget.step);
    if (inputs !== undefined && inputs.length !== 0 && inputs.every(input => input.absent || input.type !== undefined &&
      (semantics.types.isNullish(input.type) || semantics.types.isVoidLike(input.type))))
      return { kind: "replace", terms: [sourceStorageReference(fallback, activation.scope)] };
  }
  if (bound === undefined) {
    const inputs = transport.incomingFor(term.subject);
    if (inputs.size === 0) return undefined;
    const defaultValue = sourceStorageReference(fallback, term.scope);
    return { kind: "project", inputs: [...inputs].map(value => sourceStorageReference(value, term.scope)),
      select: value => sourceStorageInitializedValue(source, budget, scopes, term, defaultValue, value) };
  }
  if (activation === undefined || activation.invocation === undefined && activation.nativeEntry === undefined)
    return bound;
  const defaultValue = sourceStorageReference(fallback, activation.scope);
  if (bound.initialization === "absent") return { kind: "replace", terms: [defaultValue] };
  return { kind: "project", inputs: bound.terms,
    select: value => sourceStorageInitializedValue(source, budget, scopes, term, defaultValue, value) };
}

export function sourceStorageInitializedValue(source: TargetSourceProgram, budget: SourceStorageBudget,
  scopes: SourceStorageScopes, input: SourceStorageReference, fallback: SourceStorageReference,
  value: SourceStorageReference | Extract<import("../graph/scoped-model.js").SourceStorageTerm,
    { readonly kind: "empty" | "input-frontier" }>):
    readonly import("../graph/scoped-model.js").SourceStorageTerm[] | undefined {
  if (!budget.step()) return undefined;
  if (value.kind === "empty") return [value.absence === undefined ? value : fallback];
  if (value.subject.kind === "input") {
    const selected = scopes.lookup(value.subject, value.scope);
    if (selected?.kind === "replace" && selected.initialization === "absent") return [fallback];
  }
  const unresolved = (reason: string) => [Object.freeze({ kind: "unresolved" as const, subject: input.subject, scope: input.scope, reason })];
  const file = source.ast.getSourceFile(value.subject.node);
  const type = file === undefined || !source.semantics.includes(file) ? undefined : sourceStorageSubjectType(source, value.subject, file);
  if (type === undefined || file === undefined || value.subject === input.subject && value.scope === input.scope) return unresolved(
    "An initialized input requires exact checked presence or absence of its actual value.");
  const types = source.semantics.forFile(file).types;
  if (types.isNullish(type) || types.isVoidLike(type)) return [fallback];
  const present = types.nonNullableType(type);
  return !types.isAny(type) && !types.isUnknown(type) && present !== undefined && types.isIdentical(type, present)
    ? [value] : unresolved("An initialized input has unresolved actual absence correspondence.");
}

export function sourceStorageStoredValue(ast: AstReader, store: SourceStorageStore,
  value: SourceStorageSubject | undefined, scope: import("../graph/scoped-model.js").SourceStorageScope):
    import("../graph/scoped-model.js").SourceStorageTerm | undefined {
  if (value !== undefined) return sourceStorageReference(value, scope);
  return store.kind === "mutation" && store.values.length === 0 && store.reason === undefined && ast.is.IsDeleteExpression(store.operation)
    ? Object.freeze({ kind: "empty", absence: sourceStorageReference(store.storage, scope) }) : undefined;
}
