import type { Node } from "@tsonic/tsts";
import type {
  SourceCategoryDomain, SourceResult, SourceTypeBinding, SourceTypeEvidence,
  SourceTypeParameter, SourceTypeParameterRequirement,
} from "../public/source/contracts.js";
import type { SourceEvidenceOwner } from "./descriptor-evidence.js";
import type { SourceDescriptorInterner } from "./descriptor-interner.js";

export interface SourceParameterOwner {
  register(declaration: Node, owner: Node, index: number,
    constraint: () => SourceResult<SourceTypeParameterRequirement>,
    defaultType: () => SourceResult<SourceTypeParameterRequirement>): SourceTypeParameter;
  get(declaration: Node): SourceTypeParameter;
  constraint(parameter: SourceTypeParameter): SourceResult<SourceTypeParameterRequirement>;
  defaultType(parameter: SourceTypeParameter): SourceResult<SourceTypeParameterRequirement>;
  free(value: SourceTypeEvidence): readonly SourceTypeParameter[];
  category(value: SourceCategoryDomain, bindings: readonly SourceTypeBinding[]): SourceCategoryDomain;
  bindings(values: readonly SourceTypeBinding[]): readonly SourceTypeBinding[];
}

export function createSourceParameterOwner(input: {
  assertNode(node: Node): void;
  evidence: SourceEvidenceOwner;
  interner: SourceDescriptorInterner;
  observe<Value>(result: SourceResult<Value>): SourceResult<Value>;
}): SourceParameterOwner {
  interface ParameterRecord {
    readonly value: SourceTypeParameter;
    readonly constraint: () => SourceResult<SourceTypeParameterRequirement>;
    readonly defaultType: () => SourceResult<SourceTypeParameterRequirement>;
    constraintResult?: SourceResult<SourceTypeParameterRequirement>;
    defaultResult?: SourceResult<SourceTypeParameterRequirement>;
  }
  const declarations = new WeakMap<Node, ParameterRecord>();
  const parameters = new WeakMap<SourceTypeParameter, ParameterRecord>();
  const freeParameters = new WeakMap<SourceTypeEvidence, readonly SourceTypeParameter[]>();

  function get(declaration: Node): SourceTypeParameter {
    input.assertNode(declaration);
    const selected = declarations.get(declaration);
    if (selected === undefined) throw new Error("An original Source binder must be registered before its evidence is published.");
    return selected.value;
  }

  function parameterRecord(parameter: SourceTypeParameter): ParameterRecord {
    const selected = parameters.get(parameter);
    if (selected === undefined) throw new Error("A Source binder must belong to this exact descriptor view.");
    return selected;
  }

  function requirement(value: SourceResult<SourceTypeParameterRequirement>): SourceResult<SourceTypeParameterRequirement> {
    if (value.kind === "resolved" && value.value.kind === "type") input.evidence.assert(value.value.value);
    return input.observe(value);
  }

  function bindings(values: readonly SourceTypeBinding[]): readonly SourceTypeBinding[] {
    const seen = new Set<Node>();
    for (const value of values) {
      get(value.declaration);
      input.evidence.assert(value.value);
      if (seen.has(value.declaration)) throw new Error("A Source application must bind each original parameter exactly once.");
      seen.add(value.declaration);
    }
    return Object.freeze(values.map(value => Object.freeze({ ...value })));
  }

  function free(value: SourceTypeEvidence): readonly SourceTypeParameter[] {
    input.evidence.assert(value);
    const previous = freeParameters.get(value);
    if (previous !== undefined) return previous;
    const found: SourceTypeParameter[] = [];
    const seen = new Set<Node>();
    const visited = new Set<SourceTypeEvidence>();
    function append(declaration: Node, bound: ReadonlySet<Node>): void {
      if (bound.has(declaration) || seen.has(declaration)) return;
      const selected = get(declaration);
      seen.add(declaration);
      found.push(selected);
    }
    function categoryParameters(category: SourceCategoryDomain, bound: ReadonlySet<Node>): void {
      if (category.kind === "parameter") append(category.declaration, bound);
      else if (category.kind === "choice") category.alternatives.forEach(alternative => categoryParameters(alternative, bound));
    }
    function visit(selected: SourceTypeEvidence, bound: ReadonlySet<Node>): void {
      if (visited.has(selected)) return;
      visited.add(selected);
      if (selected.type.kind === "parameter") append(selected.type.declaration, bound);
      categoryParameters(selected.category, bound);
      for (const child of input.evidence.record(selected).components.values()) {
        const selector = child.selector;
        const signature = selector.kind === "parameter" || selector.kind === "receiver" || selector.kind === "result" || selector.kind === "signature-tail"
          ? selector.signature : undefined;
        const childBound = signature === undefined ? bound : new Set([...bound, ...signature.typeParameters]);
        visit(child.value, childBound);
      }
      if (selected.sum !== undefined) for (const arm of selected.sum.arms) visit(arm, bound);
      visited.delete(selected);
    }
    visit(value, new Set());
    const selected = Object.freeze(found);
    freeParameters.set(value, selected);
    return selected;
  }

  function category(value: SourceCategoryDomain, values: readonly SourceTypeBinding[]): SourceCategoryDomain {
    const selected = bindings(values);
    const substitutions = new Map(selected.map(binding => [binding.declaration, binding.value.category]));
    const active = new Set<Node>();
    function apply(current: SourceCategoryDomain): SourceCategoryDomain {
      if (current.kind === "parameter") {
        get(current.declaration);
        const replacement = substitutions.get(current.declaration);
        if (replacement === undefined || active.has(current.declaration)) return input.evidence.category(current);
        active.add(current.declaration);
        const result = apply(replacement);
        active.delete(current.declaration);
        return result;
      }
      if (current.kind !== "choice") return input.evidence.category(current);
      const alternatives: SourceCategoryDomain[] = [];
      const seen = new Set<string>();
      for (const alternative of current.alternatives) {
        const applied = apply(alternative);
        for (const member of applied.kind === "choice" ? applied.alternatives : [applied]) {
          const key = input.evidence.categoryKey(member);
          if (!seen.has(key)) { seen.add(key); alternatives.push(member); }
        }
      }
      if (alternatives.length === 0) return input.evidence.category({ kind: "choice", alternatives });
      return alternatives.length === 1 ? alternatives[0]! : input.evidence.category({ kind: "choice", alternatives });
    }
    return apply(value);
  }

  return Object.freeze({
    get, free, category, bindings,
    register(declaration: Node, owner: Node, index: number,
      constraint: () => SourceResult<SourceTypeParameterRequirement>,
      defaultType: () => SourceResult<SourceTypeParameterRequirement>): SourceTypeParameter {
      input.assertNode(declaration);
      input.assertNode(owner);
      if (!Number.isSafeInteger(index) || index < 0) throw new Error("An original Source binder requires its exact nonnegative ordinal.");
      const previous = declarations.get(declaration);
      if (previous !== undefined) {
        if (previous.value.owner !== owner || previous.value.index !== index) throw new Error("An original Source binder has one owner and ordinal.");
        return previous.value;
      }
      const value = Object.freeze({ declaration, owner, index, type: input.interner.parameter(declaration) });
      const record: ParameterRecord = { value, constraint, defaultType };
      declarations.set(declaration, record);
      parameters.set(value, record);
      return value;
    },
    constraint(parameter: SourceTypeParameter): SourceResult<SourceTypeParameterRequirement> {
      const selected = parameterRecord(parameter);
      return selected.constraintResult ??= requirement(selected.constraint());
    },
    defaultType(parameter: SourceTypeParameter): SourceResult<SourceTypeParameterRequirement> {
      const selected = parameterRecord(parameter);
      return selected.defaultResult ??= requirement(selected.defaultType());
    },
  });
}
