import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { selectSourceNativeValueGuard } from "../../source-semantics/native-value-guards.js";
import { selectSourceGuardedValueMembers } from "../../source-semantics/value-flow-conditions.js";
import { sourceStorageClassValue, sourceStorageConstructedClass } from "./construction.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";

export function createSourceStorageGuardedValues(source: TargetSourceProgram, budget: SourceStorageBudget) {
  const { ast, navigation } = source;
  const context = { ast, navigation, sourceFacts: source.sourceFacts,
    semanticsFor: (node: Node) => source.semantics.forNode(node) };
  const instanceOf = (owner: SourceStorageSubject, target: Node): boolean | undefined => {
    if (owner.projection.length !== 0) return undefined;
    let current = sourceStorageConstructedClass(owner.node, source, () => budget.step());
    return budget.withRows(rows => {
      const visited = new Set<Node>();
      while (current !== undefined) {
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
      return undefined;
    });
  };
  const guardFor = (expression: Node) => {
    if (!budget.step()) return undefined;
    const guard = selectSourceNativeValueGuard(context, expression);
    if (guard?.kind !== "nominal") return undefined;
    const target = sourceStorageClassValue(guard.sourceConstructor, source, () => budget.step());
    return target === undefined ? undefined : { sourceOperand: guard.sourceOperand, predicate: target };
  };
  const appliesTo = (reference: Node): boolean | undefined => {
    if (!budget.step()) return undefined;
    const selected = selectSourceGuardedValueMembers(context, reference, [reference], guardFor, () => undefined);
    return budget.failure() === undefined ? selected !== undefined : undefined;
  };
  const admits = (owner: SourceStorageSubject, reference: Node): boolean | undefined => {
    if (!budget.step()) return undefined;
    const selected = selectSourceGuardedValueMembers(context, reference, [owner], guardFor, instanceOf);
    return budget.failure() !== undefined || selected === undefined ? undefined : selected.length !== 0;
  };
  return Object.freeze({ appliesTo, admits });
}
