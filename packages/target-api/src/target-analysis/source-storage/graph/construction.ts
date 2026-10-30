import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/types.js";
import { sourceStorageAllocations, sourceStorageClassLineages } from "../model/construction.js";
import { sourceConstructionExpression, sourceInstanceInitializers } from "../../../source-navigation/class-initialization.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageBindings, SourceStorageConstructionClass, SourceStorageConstructionSelection, SourceStorageQueries, SourceStorageUnresolved } from "../model/types.js";

type ConstructionQueries = Pick<SourceStorageQueries, "subject" | "bindingsForInvocation" |
  "executionRegionsFor" | "subjectFor" | "storageProducersFor">;
type Construction = Extract<SourceStorageConstructionSelection, { readonly kind: "resolved" }>["alternatives"][number];

export function createSourceStorageConstructionQuery(source: TargetSourceProgram, budget: SourceStorageBudget,
  queries: ConstructionQueries, nativeConstructorsFor: (subject: SourceStorageSubject) => readonly Node[] | undefined):
  (invocation: Node, bindings: SourceStorageBindings) => SourceStorageConstructionSelection {
  const cache = new Map<Node, Map<SourceStorageBindings, SourceStorageConstructionSelection>>();
  const rows = budget.createRows();
  const unresolved = (reason: string): SourceStorageUnresolved => Object.freeze({ kind: "unresolved", reason });
  return (invocation, bindings) => {
    if (!budget.step()) return unresolved(budget.failure()!);
    const existing = cache.get(invocation)?.get(bindings);
    if (existing !== undefined) return existing;
    return budget.withRows(temporary => {
      const expression = sourceConstructionExpression(invocation, source, budget.step);
      if (expression === undefined) return unresolved(budget.failure() ??
        "Construction execution requires its actual checked source class value.");
      const selected = source.semantics.forNode(invocation).operations.call(invocation);
      if (selected?.sourceSelectedSignatureKind !== "resolved")
        return unresolved("Construction execution requires its checked selected signature.");
      const target = queries.subjectFor(expression);
      if (target.kind === "unresolved") return target;
      const producers = queries.storageProducersFor(target.subject, bindings);
      if (producers.kind !== "complete") return unresolved(producers.kind === "unresolved" ? producers.reason
        : "Construction execution requires a closed actual class-value domain, not an externally mutable or opaque constructor.");
      let failure: string | undefined;
      const lineages = sourceStorageClassLineages(source, budget, new Set(producers.producers), {
        nativeConstructorsFor,
        subjectFor(node) {
          if (node === undefined) return undefined;
          const selected = queries.subjectFor(node);
          if (selected.kind === "unresolved") { failure = selected.reason; return undefined; }
          return selected.subject;
        },
        valuesFor(subject, context) {
          const selected = queries.storageProducersFor(subject, context);
          if (selected.kind !== "complete") {
            failure = selected.kind === "unresolved" ? selected.reason
              : "Inherited construction requires its closed actual base-class value.";
            return undefined;
          }
          return new Set(selected.producers);
        },
      });
      if (lineages === undefined || lineages.length === 0 || lineages.some(lineage => !lineage.complete))
        return unresolved(failure ?? budget.failure() ??
          "Construction execution requires a complete actual source class lineage; imported native body contracts belong to the native premise producer.");
      const allocations = sourceStorageAllocations(source, budget, invocation, bindings, (owner, context) => {
        const receiver = queries.subject(owner, "receiver");
        if (receiver.kind === "unresolved") return receiver;
        const selected = queries.storageProducersFor(receiver.subject, context);
        return selected.kind === "complete" ? selected.producers : selected.kind === "unresolved" ? selected
          : unresolved("Constructor execution requires its closed actual allocation receiver domain.");
      });
      if (allocations.kind === "unresolved") return allocations;
      const alternatives: Construction[] = [];
      let cost = 2;
      for (const lineage of lineages) for (const allocation of allocations.allocations) {
        if (!budget.step()) return unresolved(budget.failure()!);
        const root = lineage.classes[0]?.subject.node;
        if (root === undefined) return unresolved("Source construction execution requires its actual source class owner, not an imported native body.");
        const classes: SourceStorageConstructionClass[] = [];
        for (const value of lineage.classes) {
          if (!budget.step()) return unresolved(budget.failure()!);
          const owner = value.subject.node;
          const initializers = sourceInstanceInitializers(owner, source, budget.step);
          if (initializers === undefined) return unresolved(budget.failure() ?? "Source construction requires completed checked instance initializer evidence.");
          const regions: SourceStorageConstructionClass["regions"][number][] = [];
          if (initializers.length !== 0) {
            const selection = queries.bindingsForInvocation(owner, allocation.call, allocation.callerBindings, value);
            if (selection.kind === "unresolved") return selection;
            for (const node of initializers) {
              if (!budget.step()) return unresolved(budget.failure()!);
              regions.push(Object.freeze({ node, selection }));
            }
          }
          if (!temporary.add(1 + initializers.length)) return unresolved(budget.failure()!);
          classes.push(Object.freeze({ owner, regions: Object.freeze(regions) }));
        }
        let implementation: Construction["implementation"];
        if (lineage.implementation !== undefined) {
          const declaration = lineage.implementation;
          const regions = queries.executionRegionsFor(declaration, invocation, bindings);
          if (regions.kind === "unresolved") return regions;
          const selection = queries.bindingsForInvocation(declaration, invocation, bindings,
            lineage.classes[lineage.classes.length - 1]!);
          if (selection.kind === "unresolved") return selection;
          implementation = Object.freeze({ declaration, body: source.ast.body(declaration)!,
            regions: regions.nodes, selection });
        }
        cost += 3 + classes.length + classes.reduce((count, entry) => count + entry.regions.length * 2, 0) +
          (implementation?.regions.length ?? 0);
        alternatives.push(Object.freeze({ root, allocation: allocation.call, classes: Object.freeze(classes), implementation }));
      }
      if (budget.failure() !== undefined || !rows.add(cost)) return unresolved(budget.failure()!);
      const result: SourceStorageConstructionSelection = Object.freeze({ kind: "resolved", alternatives: Object.freeze(alternatives) });
      const retained = cache.get(invocation) ?? new Map<SourceStorageBindings, SourceStorageConstructionSelection>();
      retained.set(bindings, result);
      cache.set(invocation, retained);
      return result;
    });
  };
}
