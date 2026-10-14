import type { Node } from "@tsonic/tsts";
import { AsExpressionWithTypeArguments, sourceConstructorParametersMatch } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/types.js";
import { sourceStorageClassValue, sourceStorageInstanceInitializers, sourceStorageInvokedClass,
  sourceStorageSuperConstructor } from "../model/construction.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageBindings, SourceStorageConstructionClass, SourceStorageConstructionSelection,
  SourceStorageQueries, SourceStorageUnresolved } from "../model/types.js";

type ConstructionQueries = Pick<SourceStorageQueries, "boundActivationsFor" | "bindingsForInvocation" |
  "executionRegionsFor" | "instanceRegionsFor">;

export function createSourceStorageConstructionQuery(source: TargetSourceProgram, budget: SourceStorageBudget,
  queries: ConstructionQueries): (invocation: Node, bindings: SourceStorageBindings) => SourceStorageConstructionSelection {
  const cache = new Map<Node, Map<SourceStorageBindings, SourceStorageConstructionSelection>>();
  const rows = budget.createRows();
  const unresolved = (reason: string): SourceStorageUnresolved => Object.freeze({ kind: "unresolved", reason });
  return (invocation, bindings) => {
    if (!budget.step()) return unresolved(budget.failure()!);
    const existing = cache.get(invocation)?.get(bindings);
    if (existing !== undefined) return existing;
    return budget.withRows(temporary => {
      const root = sourceStorageInvokedClass(invocation, source, budget.step);
      if (root === undefined) return unresolved(budget.failure() ?? "Construction execution requires its actual checked source class value.");
      const selected = source.semantics.forNode(invocation).operations.call(invocation);
      if (selected?.sourceSelectedSignatureKind !== "resolved") return unresolved("Construction execution requires its checked selected signature.");
      const effective = source.navigation.classConstructors(root);
      if (effective.kind === "unresolved") return unresolved(effective.reason);
      const declaration = source.semantics.forNode(invocation).declarations.signatureDeclaration(selected.selectedSignature);
      let matchingSignatures = 0;
      for (const signature of effective.signatures) {
        if (!budget.step()) return unresolved(budget.failure()!);
        if (sourceConstructorParametersMatch(signature.parameters, selected.sourceSelectedSignatureParameters) &&
          (declaration === undefined || signature.declaration === declaration)) matchingSignatures += 1;
      }
      if (matchingSignatures !== 1) return unresolved("Construction execution requires exact inherited signature and parameter declaration correspondence.");
      const owners: Node[] = [];
      const seen = new Set<Node>();
      let current = root;
      let implementation: Node | undefined;
      while (true) {
        if (!budget.step() || !temporary.add(1)) return unresolved(budget.failure()!);
        if (seen.has(current)) return unresolved("Construction execution requires an acyclic checked source class lineage.");
        seen.add(current);
        owners.push(current);
        const constructors = source.navigation.classConstructors(current);
        if (constructors.kind === "unresolved") return unresolved(constructors.reason);
        if (!constructors.implicit) {
          const selectedBody = declaration === undefined ? undefined : source.navigation.callableImplementation(declaration);
          const candidate = selectedBody?.kind === "resolved" ? selectedBody.implementation.declaration : undefined;
          if (candidate === undefined || !source.ast.is.IsConstructorDeclaration(candidate) || source.ast.parent(candidate) !== current ||
            source.ast.body(candidate) === undefined || !source.navigation.isProjectDeclaration(candidate)) {
            return unresolved("Construction execution requires the actual implemented source constructor; imported native body contracts belong to the native premise producer.");
          }
          implementation = candidate;
          break;
        }
        const heritage = source.navigation.declaredHeritage(current);
        if (heritage.kind === "unresolved") return unresolved(heritage.reason);
        const bases = heritage.edges.filter(edge => edge.kind === "extends");
        if (bases.length === 0) break;
        if (bases.length !== 1) return unresolved("Construction execution requires one exact checked source base class.");
        const expression = AsExpressionWithTypeArguments(source.ast, bases[0]!.heritage)?.Expression;
        const base = sourceStorageClassValue(expression, source, budget.step);
        if (base === undefined) return unresolved(budget.failure() ??
          "Inherited construction requires its actual source base value; imported native body contracts remain unresolved here.");
        current = base;
      }
      const allocation = sourceStorageAllocation(source, budget, queries, invocation, bindings);
      if (allocation.kind === "unresolved") return allocation;
      const inventory = queries.instanceRegionsFor(allocation.call);
      if (inventory.kind === "unresolved") return inventory;
      const inventoryOwners = new Map<Node, Set<Node>>();
      for (const region of inventory.regions) {
        const nodes = inventoryOwners.get(region.owner);
        if (!budget.step() || !temporary.add(nodes === undefined ? 3 : 1)) return unresolved(budget.failure()!);
        if (nodes?.has(region.node)) return unresolved("Construction execution requires distinct original instance initializer identities.");
        const identities = nodes ?? new Set<Node>();
        identities.add(region.node);
        inventoryOwners.set(region.owner, identities);
      }
      const classes: SourceStorageConstructionClass[] = [];
      for (const owner of owners) {
        if (!budget.step()) return unresolved(budget.failure()!);
        const initializers = sourceStorageInstanceInitializers(owner, source, budget.step);
        const identities = inventoryOwners.get(owner);
        if (initializers.length !== (identities?.size ?? 0) || initializers.some(node => !identities!.has(node))) {
          return unresolved("Construction execution requires its exact class-owned instance initializer identities.");
        }
        const regions: SourceStorageConstructionClass["regions"][number][] = [];
        if (initializers.length !== 0) {
          const selection = queries.bindingsForInvocation(owner, allocation.call, allocation.callerBindings);
          if (selection.kind === "unresolved") return selection;
          for (const node of initializers) {
            if (!budget.step()) return unresolved(budget.failure()!);
            regions.push(Object.freeze({ node, selection }));
          }
        }
        if (!temporary.add(1 + initializers.length)) return unresolved(budget.failure()!);
        classes.push(Object.freeze({ owner, regions: Object.freeze(regions) }));
      }
      let callable: Extract<SourceStorageConstructionSelection, { readonly kind: "resolved" }>["implementation"];
      if (implementation !== undefined) {
        const regions = queries.executionRegionsFor(implementation, invocation, bindings);
        if (regions.kind === "unresolved") return regions;
        const selection = queries.bindingsForInvocation(implementation, invocation, bindings);
        if (selection.kind === "unresolved") return selection;
        callable = Object.freeze({ declaration: implementation, body: source.ast.body(implementation)!, regions: regions.nodes, selection });
      }
      const cost = 3 + classes.length + classes.reduce((count, entry) => count + entry.regions.length * 2, 0) +
        (callable?.regions.length ?? 0);
      if (budget.failure() !== undefined || !rows.add(cost)) return unresolved(budget.failure()!);
      const result: SourceStorageConstructionSelection = Object.freeze({ kind: "resolved", root, allocation: allocation.call,
        classes: Object.freeze(classes), implementation: callable });
      const retained = cache.get(invocation) ?? new Map<SourceStorageBindings, SourceStorageConstructionSelection>();
      retained.set(bindings, result);
      cache.set(invocation, retained);
      return result;
    });
  };
}

function sourceStorageAllocation(source: TargetSourceProgram, budget: SourceStorageBudget, queries: ConstructionQueries,
  invocation: Node, bindings: SourceStorageBindings): SourceStorageUnresolved |
  { readonly kind: "resolved"; readonly call: Node; readonly callerBindings: SourceStorageBindings } {
  return budget.withRows(temporary => {
    const seen = new Set<SourceStorageBindings>();
    let call = invocation;
    let callerBindings = bindings;
    while (!source.ast.is.IsNewExpression(call)) {
      if (!budget.step()) return Object.freeze({ kind: "unresolved", reason: budget.failure()! });
      const base = sourceStorageSuperConstructor(call, source, budget.step);
      if (base === undefined || seen.has(callerBindings)) return Object.freeze({ kind: "unresolved",
        reason: "Constructor execution requires the actual checked allocation activation, not guessed heritage order." });
      if (!temporary.add(1)) return Object.freeze({ kind: "unresolved", reason: budget.failure()! });
      seen.add(callerBindings);
      const selected = queries.boundActivationsFor(base.owner, callerBindings);
      if (selected.kind === "unresolved") return selected;
      const activation = selected.activations.length === 1 ? selected.activations[0] : undefined;
      if (activation === undefined || activation.kind !== "invocation") return Object.freeze({ kind: "unresolved",
        reason: "Constructor execution requires one exact owning allocation activation." });
      call = activation.invocation;
      callerBindings = activation.callerBindings;
    }
    return Object.freeze({ kind: "resolved", call, callerBindings });
  });
}
