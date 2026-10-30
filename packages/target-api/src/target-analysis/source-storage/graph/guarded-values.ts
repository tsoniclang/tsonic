import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { selectSourceNativeValueGuard } from "../../../source-semantics/native-value-guards.js";
import { selectSourceGuardedValueMembers, type SourceNativeGuard } from "../../value-flow-conditions.js";
import { sourceConstructionExpression } from "../../../source-navigation/class-initialization.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { sourceStorageHasOriginalCallableValue, type SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageIsScalarType, sourceStorageSubjectType } from "../model/components.js";

export interface SourceStorageValueGuards {
  readonly key: string;
  readonly references: readonly Node[];
}

interface GuardPlan {
  readonly identity: number;
  readonly predicates: readonly Node[];
}

type GuardPredicate =
  | { readonly kind: "nominal"; readonly declaration: Node }
  | { readonly kind: "absence"; readonly negated: boolean };

type GuardCandidate =
  | { readonly kind: "absence" }
  | { readonly kind: "present"; readonly declaration?: Node };

export function createSourceStorageGuardedValues(source: TargetSourceProgram, budget: SourceStorageBudget,
  classValues: (expression: Node) => readonly {
    readonly classes: readonly { readonly subject: SourceStorageSubject }[]; readonly complete: boolean;
  }[] | undefined) {
  const { ast, navigation } = source;
  const context = { ast, navigation, sourceFacts: source.sourceFacts,
    semanticsFor: (node: Node) => source.semantics.forNode(node) };
  const retained = budget.createRows();
  const plans = new Map<Node, GuardPlan | null>();
  const admissions = new Map<Node, Map<SourceStorageSubject, boolean | null>>();
  const conjunctions = new Map<string, SourceStorageValueGuards | null>();
  const classMatches = (candidate: Node, target: Node): boolean | undefined => budget.withRows(rows => {
    let current = candidate;
    const visited = new Set<Node>();
    while (true) {
      if (!budget.step()) return undefined;
      if (current === target) return true;
      if (visited.has(current) || !rows.add(1)) return undefined;
      visited.add(current);
      const heritage = navigation.declaredHeritage(current);
      if (heritage.kind !== "resolved") return undefined;
      const bases = heritage.edges.filter(edge => edge.kind === "extends");
      if (bases.length === 0) return false;
      if (bases.length !== 1) return undefined;
      const base = bases[0]!.target.declaration;
      if (!ast.is.IsClassDeclaration(base) && !ast.is.IsClassExpression(base)) return undefined;
      current = base;
    }
  });
  const instanceOf = (owner: SourceStorageSubject, target: Node): boolean | undefined => {
    if (owner.projection.length !== 0) return undefined;
    if (ast.is.IsArrayLiteralExpression(owner.node) || ast.is.IsObjectLiteralExpression(owner.node) ||
      sourceStorageHasOriginalCallableValue(owner, ast)) return false;
    const file = ast.getSourceFile(owner.node);
    const type = sourceStorageSubjectType(source, owner, file);
    if (type !== undefined && file !== undefined) {
      const semantics = source.semantics.forFile(file);
      if (sourceStorageIsScalarType(type, semantics) || semantics.types.isNullish(type) ||
        semantics.types.isVoidLike(type) || semantics.types.isNever(type)) return false;
    }
    const expression = sourceConstructionExpression(owner.node, source, budget.step);
    const declaration = expression === undefined ? undefined : navigation.sourceReferenceFor(expression)?.declaration;
    if (declaration !== undefined && (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration)))
      return classMatches(declaration, target);
    const lineages = expression === undefined ? undefined : classValues(expression);
    if (lineages === undefined || lineages.length === 0) return undefined;
    let result: boolean | undefined;
    for (const lineage of lineages) {
      if (!budget.step()) return undefined;
      const candidate = lineage.classes[0]?.subject.node;
      const matches = candidate === undefined ? undefined : classMatches(candidate, target);
      if (matches === undefined || result !== undefined && result !== matches) return undefined;
      result = matches;
    }
    return result;
  };
  const absent = (owner: SourceStorageSubject): boolean | undefined => {
    const file = ast.getSourceFile(owner.node);
    const type = sourceStorageSubjectType(source, owner, file);
    if (file === undefined || type === undefined) return undefined;
    const { types } = source.semantics.forFile(file);
    const members = types.isUnion(type) ? types.unionOrIntersectionTypes(type) : [type];
    let result: boolean | undefined;
    for (const member of members) {
      if (!budget.step()) return undefined;
      if (types.isNever(member)) continue;
      let selected: boolean;
      if (types.isNullish(member) || types.isVoidLike(member)) selected = true;
      else {
        if (types.isAny(member) || types.isUnknown(member)) return undefined;
        const present = types.nonNullableType(member);
        if (present === undefined || !types.isIdentical(member, present)) return undefined;
        selected = false;
      }
      if (result !== undefined && selected !== result) return undefined;
      result = selected;
    }
    return result;
  };
  const testOwner = (owner: SourceStorageSubject, predicate: GuardPredicate): boolean | undefined => {
    if (predicate.kind === "nominal") return instanceOf(owner, predicate.declaration);
    const result = absent(owner);
    return result === undefined ? undefined : result !== predicate.negated;
  };
  const guardFor = (expression: Node): SourceNativeGuard<GuardPredicate> | undefined => {
    if (!budget.step()) return undefined;
    const guard = selectSourceNativeValueGuard(context, expression);
    if (guard?.kind === "absence") return { sourceOperand: guard.sourceOperand,
      predicate: { kind: "absence", negated: guard.negated } };
    if (guard?.kind !== "nominal") return undefined;
    if (ast.is.IsClassDeclaration(guard.declaration) || ast.is.IsClassExpression(guard.declaration))
      return { sourceOperand: guard.sourceOperand, predicate: { kind: "nominal", declaration: guard.declaration } };
    const lineages = classValues(guard.sourceConstructor);
    if (lineages === undefined || lineages.length === 0 || lineages.some(lineage => !lineage.complete)) return undefined;
    const target = lineages[0]?.classes[0]?.subject.node;
    return target === undefined || lineages.some(lineage => lineage.classes[0]?.subject.node !== target) ? undefined : { sourceOperand: guard.sourceOperand,
      predicate: { kind: "nominal", declaration: target } };
  };
  const planFor = (reference: Node): GuardPlan | undefined => budget.withRows(rows => {
    if (!budget.step()) return undefined;
    if (plans.has(reference)) return plans.get(reference) ?? undefined;
    const predicates = new Set<Node>();
    const selected = selectSourceGuardedValueMembers(context, reference, [reference], guardFor, (_member, predicate) => {
      if (predicate.kind === "nominal" && !predicates.has(predicate.declaration) && rows.add(1)) predicates.add(predicate.declaration);
      return undefined;
    });
    if (budget.failure() !== undefined || !retained.add(1 + predicates.size)) return undefined;
    const plan = selected === undefined ? null : Object.freeze({ identity: plans.size, predicates: Object.freeze([...predicates]) });
    plans.set(reference, plan);
    return plan ?? undefined;
  });
  const appliesTo = (reference: Node): boolean | undefined => {
    const plan = planFor(reference);
    return budget.failure() === undefined ? plan !== undefined : undefined;
  };
  const admits = (owner: SourceStorageSubject, reference: Node): boolean | undefined => {
    if (!budget.step()) return undefined;
    const previous = admissions.get(reference);
    const cached = previous?.get(owner);
    if (cached !== undefined) return cached ?? undefined;
    let unknown = false;
    const selected = selectSourceGuardedValueMembers(context, reference, [owner], guardFor, (subject, predicate) => {
      const result = testOwner(subject, predicate);
      unknown ||= result === undefined;
      return result;
    });
    if (budget.failure() !== undefined || !retained.add(previous === undefined ? 2 : 1)) return undefined;
    const admitted = selected === undefined ? null : selected.length === 0 ? false : unknown ? null : true;
    const values = previous ?? new Map<SourceStorageSubject, boolean | null>();
    values.set(owner, admitted);
    admissions.set(reference, values);
    return admitted ?? undefined;
  };
  const conjoin = (existing: SourceStorageValueGuards | undefined, reference: Node): SourceStorageValueGuards | null | undefined =>
    budget.withRows(rows => {
      const plan = planFor(reference);
      if (plan === undefined || existing?.references.includes(reference)) return existing;
      const references = [...existing?.references ?? [], reference];
      if (!rows.add(references.length)) return undefined;
      references.sort((left, right) => plans.get(left)!.identity - plans.get(right)!.identity);
      const key = references.map(reference => plans.get(reference)!.identity).join(":");
      if (conjunctions.has(key)) return conjunctions.get(key);
      const predicates = new Set<Node>();
      for (const reference of references) for (const predicate of plans.get(reference)!.predicates) {
        if (!budget.step()) return undefined;
        if (!predicates.has(predicate)) {
          if (!rows.add(1)) return undefined;
          predicates.add(predicate);
        }
      }
      if (!rows.add(predicates.size + 2)) return undefined;
      const possibilities: GuardCandidate[] = [{ kind: "absence" }, { kind: "present" }];
      for (const declaration of predicates) {
        if (!budget.step()) return undefined;
        possibilities.push({ kind: "present", declaration });
      }
      let candidates: readonly GuardCandidate[] = possibilities;
      for (const reference of references) {
        if (!budget.step()) return undefined;
        candidates = selectSourceGuardedValueMembers(context, reference, candidates, guardFor,
          (candidate, predicate) => predicate.kind === "absence" ? (candidate.kind === "absence") !== predicate.negated
            : candidate.kind === "absence" || candidate.declaration === undefined ? false
              : classMatches(candidate.declaration, predicate.declaration)) ?? candidates;
      }
      if (budget.failure() !== undefined || !retained.add(1 + (candidates.length === 0 ? 0 : references.length))) return undefined;
      const selected = candidates.length === 0 ? null : Object.freeze({ key, references: Object.freeze(references) });
      conjunctions.set(key, selected);
      return selected;
    });
  return Object.freeze({ appliesTo, admits, conjoin });
}
