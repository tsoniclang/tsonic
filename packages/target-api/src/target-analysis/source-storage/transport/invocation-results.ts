import type { Node } from "@tsonic/tsts";
import { AsExpressionWithTypeArguments } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageBoundSubject, SourceStorageSubstitutions } from "../scoped/substitutions.js";

interface SourceStorageInvocationResultQueries {
  readonly subject: SourceStorageSubjectQuery;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  valuesFor(subject: SourceStorageSubject, bindings: SourceStorageSubstitutions): ReadonlySet<SourceStorageBoundSubject> | undefined;
  targetFor(invocation: Node): SourceStorageSubject | undefined;
  bindingsFor(candidate: Node, invocation: Node, bindings: SourceStorageSubstitutions,
    captured: SourceStorageSubstitutions, callee: SourceStorageSubject | undefined): SourceStorageSubstitutions | undefined;
  hasResultAlias(invocation: Node): boolean;
}

export interface SourceStorageInvocationResultQueriesContract {
  forInvocation(candidate: Node, invocation: Node, bindings: SourceStorageSubstitutions,
    capture?: SourceStorageBoundSubject): ReadonlySet<SourceStorageSubstitutions>;
  hasAllocation(subject: SourceStorageSubject): boolean;
}

export interface SourceStorageClassValue<Bindings> {
  readonly subject: SourceStorageSubject;
  readonly bindings: Bindings;
}

export function sourceStorageClassLineages<Bindings>(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  values: ReadonlySet<SourceStorageClassValue<Bindings>> | undefined,
  queries: {
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    valuesFor(subject: SourceStorageSubject, bindings: Bindings): ReadonlySet<SourceStorageClassValue<Bindings>> | undefined;
  },
  captureOwner?: Node | "heritage",
): readonly { readonly classes: readonly SourceStorageClassValue<Bindings>[]; readonly complete: boolean;
  readonly implementation: Node | undefined }[] | undefined {
  if (values === undefined) return undefined;
  return budget.withRows(rows => {
    const lineages: { readonly classes: readonly SourceStorageClassValue<Bindings>[]; readonly complete: boolean;
      readonly implementation: Node | undefined }[] = [];
    const pending: { readonly value: SourceStorageClassValue<Bindings>;
      readonly classes: readonly SourceStorageClassValue<Bindings>[] }[] = [];
    const schedule = (value: SourceStorageClassValue<Bindings>,
      classes: readonly SourceStorageClassValue<Bindings>[]): boolean => {
      if (!rows.add(2 + classes.length)) return false;
      pending.push({ value, classes });
      return true;
    };
    const finish = (classes: readonly SourceStorageClassValue<Bindings>[], complete: boolean, implementation?: Node): boolean => {
      if (!rows.add(2 + classes.length)) return false;
      lineages.push(Object.freeze({ classes: Object.freeze([...classes]), complete, implementation }));
      return true;
    };
    for (const value of values) if (!budget.step() || !schedule(value, [])) return undefined;
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const { value, classes } = pending.pop()!;
      const node = value.subject.node;
      if (value.subject.kind !== "value" || value.subject.projection.length !== 0 ||
        !source.ast.is.IsClassDeclaration(node) && !source.ast.is.IsClassExpression(node) ||
        !source.navigation.isProjectDeclaration(node) ||
        classes.some(previous => previous.subject === value.subject && previous.bindings === value.bindings)) {
        if (!finish(classes, false)) return undefined;
        continue;
      }
      const lineage = [...classes, value];
      if (captureOwner === node) {
        if (!finish(lineage, true)) return undefined;
        continue;
      }
      if (captureOwner === undefined) {
        const constructors = source.navigation.classConstructors(node);
        if (constructors.kind !== "resolved") {
          if (!finish(lineage, false)) return undefined;
          continue;
        }
        if (!constructors.implicit) {
          const implemented = source.ast.members(node).filter(member => member !== undefined &&
            source.ast.is.IsConstructorDeclaration(member) && source.ast.body(member) !== undefined);
          if (!finish(lineage, implemented.length === 1, implemented.length === 1 ? implemented[0] : undefined)) return undefined;
          continue;
        }
      }
      const heritage = source.navigation.declaredHeritage(node);
      if (heritage.kind !== "resolved") {
        if (!finish(lineage, false)) return undefined;
        continue;
      }
      const bases = heritage.edges.filter(edge => edge.kind === "extends");
      if (bases.length === 0) {
        if (!finish(lineage, true)) return undefined;
        continue;
      }
      if (bases.length !== 1) {
        if (!finish(lineage, false)) return undefined;
        continue;
      }
      const subject = queries.subjectFor(AsExpressionWithTypeArguments(source.ast, bases[0]!.heritage)?.Expression);
      const inherited = subject === undefined ? undefined : queries.valuesFor(subject, value.bindings);
      if (inherited === undefined) return undefined;
      for (const selected of inherited) if (!budget.step() || !schedule(selected, lineage)) return undefined;
    }
    return Object.freeze(lineages);
  });
}

export function sourceStorageInstanceCaptures(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  candidate: Node,
  values: ReadonlySet<SourceStorageBoundSubject> | undefined,
  queries: Pick<SourceStorageInvocationResultQueries, "subjectFor" | "valuesFor">,
): ReadonlySet<SourceStorageBoundSubject> | undefined {
  const constructor = source.ast.is.IsConstructorDeclaration(candidate);
  const owner = constructor ? source.ast.parent(candidate) : candidate;
  if (owner === undefined) return undefined;
  const lineages = sourceStorageClassLineages(source, budget, values, queries, constructor ? undefined : owner);
  if (lineages === undefined || lineages.some(lineage => !lineage.complete)) return undefined;
  const captures = new Set<SourceStorageBoundSubject>();
  for (const lineage of lineages) for (const selected of lineage.classes) {
    if (!budget.step()) return undefined;
    if (constructor && lineage.implementation !== candidate) continue;
    if (selected.subject.node === owner) captures.add(selected);
  }
  return captures;
}

export function createSourceStorageInvocationResults(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  queries: SourceStorageInvocationResultQueries,
): SourceStorageInvocationResultQueriesContract {
  const hasAllocation = (subject: SourceStorageSubject): boolean => source.ast.is.IsNewExpression(subject.node) &&
    !queries.hasResultAlias(subject.node);
  const forInvocation = (candidate: Node, invocation: Node, bindings: SourceStorageSubstitutions, capture?: SourceStorageBoundSubject) => {
    const target = queries.targetFor(invocation);
    const states = new Set<SourceStorageSubstitutions>();
    if (target === undefined) {
      if (capture !== undefined) return states;
      const selected = queries.bindingsFor(candidate, invocation, bindings, bindings, undefined);
      if (selected !== undefined) states.add(selected);
      return states;
    }
    const values = queries.valuesFor(target, bindings);
    if (values === undefined) return states;
    const owner = source.ast.is.IsConstructorDeclaration(candidate) ? source.ast.parent(candidate) : candidate;
    const captures = new Set<SourceStorageBoundSubject>();
    if (owner !== undefined && (source.ast.is.IsClassDeclaration(owner) || source.ast.is.IsClassExpression(owner))) {
      const selected = sourceStorageInstanceCaptures(source, budget, candidate, values, queries);
      if (selected === undefined) return states;
      for (const value of selected) captures.add(value);
    } else for (const value of values) {
      if (!budget.step()) break;
      const selected = source.navigation.callableImplementation(value.subject.node);
      if (selected.kind === "resolved" && selected.implementation.declaration === candidate) captures.add(value);
    }
    for (const captured of captures) {
      if (!budget.step()) break;
      if (capture !== undefined && (captured.subject !== capture.subject || captured.bindings !== capture.bindings)) continue;
      const selected = queries.bindingsFor(candidate, invocation, bindings, captured.bindings, captured.subject);
      if (selected !== undefined) states.add(selected);
    }
    return states;
  };
  return Object.freeze({ forInvocation, hasAllocation });
}
