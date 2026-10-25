import type { Node } from "@tsonic/tsts";
import { AsExpressionWithTypeArguments, Node_Expression, Node_Initializer, sourceClassFieldIsTypeOnly } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageUnresolved } from "./types.js";
import type { SourceStorageSubject } from "./subjects.js";

export interface SourceStorageClassValue<Bindings> {
  readonly subject: SourceStorageSubject;
  readonly bindings: Bindings;
}

export interface SourceStorageClassLineage<Bindings> {
  readonly classes: readonly SourceStorageClassValue<Bindings>[];
  readonly complete: boolean;
  readonly implementation: Node | undefined;
  readonly nativeBase: (SourceStorageClassValue<Bindings> & { readonly constructors: readonly Node[] }) | undefined;
}

export function sourceStorageClassLineages<Bindings>(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  values: ReadonlySet<SourceStorageClassValue<Bindings>> | undefined,
  queries: {
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    nativeConstructorsFor(subject: SourceStorageSubject): readonly Node[] | undefined;
    valuesFor(subject: SourceStorageSubject, bindings: Bindings): ReadonlySet<SourceStorageClassValue<Bindings>> | undefined;
  },
  mode?: "heritage",
): readonly SourceStorageClassLineage<Bindings>[] | undefined {
  if (values === undefined) return undefined;
  return budget.withRows(rows => {
    const lineages: SourceStorageClassLineage<Bindings>[] = [];
    const pending: { readonly value: SourceStorageClassValue<Bindings>;
      readonly classes: readonly SourceStorageClassValue<Bindings>[] }[] = [];
    const schedule = (value: SourceStorageClassValue<Bindings>,
      classes: readonly SourceStorageClassValue<Bindings>[]): boolean => {
      if (!rows.add(2 + classes.length)) return false;
      pending.push({ value, classes });
      return true;
    };
    const finish = (classes: readonly SourceStorageClassValue<Bindings>[], complete: boolean, implementation?: Node,
      nativeBase?: SourceStorageClassLineage<Bindings>["nativeBase"]): boolean => {
      if (!rows.add(2 + classes.length + (nativeBase === undefined ? 0 : 4))) return false;
      lineages.push(Object.freeze({ classes: Object.freeze([...classes]), complete, implementation, nativeBase }));
      return true;
    };
    for (const value of values) if (!budget.step() || !schedule(value, [])) return undefined;
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const { value, classes } = pending.pop()!;
      const node = value.subject.node;
      if (value.subject.kind !== "value" || value.subject.projection.length !== 0 ||
        classes.some(previous => previous.subject === value.subject && previous.bindings === value.bindings)) {
        if (!finish(classes, false)) return undefined;
        continue;
      }
      if (!source.ast.is.IsClassDeclaration(node) && !source.ast.is.IsClassExpression(node) ||
        !source.navigation.isProjectDeclaration(node)) {
        const constructors = queries.nativeConstructorsFor(value.subject);
        const nativeBase = constructors === undefined || constructors.length === 0 ? undefined
          : Object.freeze({ ...value, constructors });
        if (!finish(classes, nativeBase !== undefined, undefined, nativeBase)) return undefined;
        continue;
      }
      const lineage = [...classes, value];
      if (mode === undefined) {
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

export function sourceStorageInstanceCaptures<Bindings>(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  candidate: Node,
  values: ReadonlySet<SourceStorageClassValue<Bindings>> | undefined,
  queries: {
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    nativeConstructorsFor(subject: SourceStorageSubject): readonly Node[] | undefined;
    valuesFor(subject: SourceStorageSubject, bindings: Bindings): ReadonlySet<SourceStorageClassValue<Bindings>> | undefined;
  },
): ReadonlySet<SourceStorageClassValue<Bindings>> | undefined {
  const constructor = source.ast.is.IsConstructorDeclaration(candidate);
  const owner = constructor ? source.ast.parent(candidate) : candidate;
  if (owner === undefined) return undefined;
  const lineages = sourceStorageClassLineages(source, budget, values, queries, constructor ? undefined : "heritage");
  if (lineages === undefined || lineages.some(lineage => !lineage.complete)) return undefined;
  const captures = new Set<SourceStorageClassValue<Bindings>>();
  for (const lineage of lineages) for (const selected of lineage.classes) {
    if (!budget.step()) return undefined;
    if (constructor && lineage.implementation !== candidate) continue;
    if (selected.subject.node === owner) captures.add(selected);
  }
  return captures;
}

export function sourceStorageConstructionExpression(invocation: Node, source: TargetSourceProgram,
  step: () => boolean): Node | undefined {
  return source.ast.is.IsNewExpression(invocation) ? Node_Expression(source.ast, invocation)
    : sourceStorageSuperConstructor(invocation, source, step)?.callee;
}

export function sourceStorageSuperConstructor(
  invocation: Node,
  source: TargetSourceProgram,
  step: () => boolean,
): { readonly owner: Node; readonly callee: Node } | undefined {
  const { ast, navigation } = source;
  if (!ast.is.IsCallExpression(invocation) || ast.kindName(Node_Expression(ast, invocation)) !== "KindSuperKeyword") return undefined;
  for (let owner = ast.parent(invocation); owner !== undefined && step(); owner = ast.parent(owner)) {
    if (!ast.is.IsConstructorDeclaration(owner)) continue;
    const declaration = ast.parent(owner);
    if (declaration === undefined) return undefined;
    const heritage = navigation.declaredHeritage(declaration);
    if (heritage.kind !== "resolved") return undefined;
    const bases = heritage.edges.filter(edge => edge.kind === "extends");
    const callee = bases.length === 1 ? AsExpressionWithTypeArguments(ast, bases[0]!.heritage)?.Expression : undefined;
    return callee === undefined ? undefined : Object.freeze({ owner, callee });
  }
  return undefined;
}

export function sourceStorageInstanceInitializers(declaration: Node, source: TargetSourceProgram,
  step: () => boolean): readonly Node[] {
  const initializers: Node[] = [];
  for (const member of source.ast.members(declaration)) {
    if (!step()) break;
    if (member === undefined || !source.ast.is.IsPropertyDeclaration(member) || source.ast.hasModifierKind(member, "static") ||
      sourceClassFieldIsTypeOnly(source.ast, member)) continue;
    const initializer = Node_Initializer(source.ast, member);
    if (initializer !== undefined) initializers.push(initializer);
  }
  return initializers;
}

export function sourceStorageAllocations<Bindings>(source: TargetSourceProgram, budget: SourceStorageBudget,
  invocation: Node, bindings: Bindings,
  receiverOriginsFor: (owner: Node, bindings: Bindings) => SourceStorageUnresolved |
    readonly { readonly subject: SourceStorageSubject; readonly bindings: Bindings }[]): SourceStorageUnresolved |
  { readonly kind: "resolved"; readonly allocations: readonly { readonly call: Node; readonly callerBindings: Bindings }[] } {
  return budget.withRows(temporary => {
    if (source.ast.is.IsNewExpression(invocation)) return Object.freeze({ kind: "resolved",
      allocations: Object.freeze([Object.freeze({ call: invocation, callerBindings: bindings })]) });
    const base = sourceStorageSuperConstructor(invocation, source, budget.step);
    if (base === undefined) return Object.freeze({ kind: "unresolved",
      reason: "Constructor execution requires its actual checked allocation receiver, not guessed heritage order." });
    const selected = receiverOriginsFor(base.owner, bindings);
    if ("kind" in selected) return selected;
    const allocations: { readonly call: Node; readonly callerBindings: Bindings }[] = [];
    const seen = new Map<Node, Set<Bindings>>();
    for (const origin of selected) {
      if (!budget.step()) return Object.freeze({ kind: "unresolved", reason: budget.failure()! });
      if (origin.subject.kind !== "value" || origin.subject.projection.length !== 0 || !source.ast.is.IsNewExpression(origin.subject.node))
        return Object.freeze({ kind: "unresolved", reason: "Constructor execution requires every actual receiver origin to identify its checked allocation." });
      const previous = seen.get(origin.subject.node);
      if (previous?.has(origin.bindings)) continue;
      if (!temporary.add(previous === undefined ? 3 : 2)) return Object.freeze({ kind: "unresolved", reason: budget.failure()! });
      const contexts = previous ?? new Set<Bindings>();
      contexts.add(origin.bindings);
      seen.set(origin.subject.node, contexts);
      allocations.push(Object.freeze({ call: origin.subject.node, callerBindings: origin.bindings }));
    }
    return allocations.length === 0 ? Object.freeze({ kind: "unresolved",
      reason: "Constructor execution has no completed actual allocation receiver." })
      : Object.freeze({ kind: "resolved", allocations: Object.freeze(allocations) });
  });
}
