import type { Node } from "@tsonic/tsts";
import type {
  SourceCategoryDomain, SourceResult, SourceTypeBinding, SourceTypeEvidence,
  SourceTypeParameter, SourceTypeParameterRequirement,
} from "../public/source/contracts.js";
import type { SourceEvidenceOwner } from "./descriptor-evidence.js";
import type { SourceDescriptorInterner } from "./descriptor-interner.js";
import { failTargetCompilerResourceLimit } from "../artifacts.js";
import { sourceTypeExpansionBudget } from "./type-expansion-budget.js";

export interface SourceParameterOwner {
  register(declaration: Node, owner: Node, index: number,
    captures: readonly Node[],
    constraint: () => SourceResult<SourceTypeParameterRequirement>,
    defaultType: () => SourceResult<SourceTypeParameterRequirement>): SourceTypeParameter;
  get(declaration: Node): SourceTypeParameter;
  constraint(parameter: SourceTypeParameter): SourceResult<SourceTypeParameterRequirement>;
  defaultType(parameter: SourceTypeParameter): SourceResult<SourceTypeParameterRequirement>;
  free(value: SourceTypeEvidence): readonly SourceTypeParameter[];
  registerDependencies(value: SourceTypeEvidence, children: readonly SourceTypeEvidence[]): void;
  category(value: SourceCategoryDomain, bindings: readonly SourceTypeBinding[]): SourceCategoryDomain;
  bindings(values: readonly SourceTypeBinding[]): readonly SourceTypeBinding[];
}

export function createSourceParameterOwner(input: {
  assertNode(node: Node): void;
  evidence: SourceEvidenceOwner;
  interner: SourceDescriptorInterner;
  objectKey(value: object): number;
  observe<Value>(result: SourceResult<Value>): SourceResult<Value>;
}): SourceParameterOwner {
  interface ParameterRecord {
    readonly value: SourceTypeParameter;
    readonly captures: readonly Node[];
    readonly constraint: () => SourceResult<SourceTypeParameterRequirement>;
    readonly defaultType: () => SourceResult<SourceTypeParameterRequirement>;
    constraintResult?: SourceResult<SourceTypeParameterRequirement>;
    defaultResult?: SourceResult<SourceTypeParameterRequirement>;
  }
  const declarations = new WeakMap<Node, ParameterRecord>();
  const parameters = new WeakMap<SourceTypeParameter, ParameterRecord>();
  interface Environment {
    readonly key: string;
    readonly bound: ReadonlySet<Node>;
    readonly bindings: ReadonlyMap<Node, SourceTypeEvidence>;
  }
  interface Summary {
    readonly parameters: readonly SourceTypeParameter[];
    readonly complete: boolean;
    readonly height: number;
  }
  const summaries = new WeakMap<SourceTypeEvidence, Map<string, Summary>>();
  const captureSummaries = new WeakMap<Node, Map<string, Summary>>();
  const dependencies = new WeakMap<SourceTypeEvidence, readonly SourceTypeEvidence[]>();

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
    let work = 0;
    const active = new WeakMap<SourceTypeEvidence, Set<string>>();
    const requirements = new WeakMap<Node, Set<string>>();
    const resolving = new Set<Node>();
    const empty: Summary = { parameters: [], complete: true, height: 0 };
    const recursive: Summary = { parameters: [], complete: false, height: 0 };

    function charge(count = 1): void {
      if (count > sourceTypeExpansionBudget.types - work)
        failTargetCompilerResourceLimit("tsonic", "Source type expansion", "types", sourceTypeExpansionBudget.types, value.component.root);
      work += count;
    }

    function depth(selected: number): void {
      if (selected > sourceTypeExpansionBudget.depth)
        failTargetCompilerResourceLimit("tsonic", "Source type expansion", "depth", sourceTypeExpansionBudget.depth, value.component.root);
    }

    function environment(bound: ReadonlySet<Node>, bindings: ReadonlyMap<Node, SourceTypeEvidence>): Environment {
      charge(1 + bound.size + bindings.size);
      const nodeKeys = (nodes: ReadonlySet<Node>): readonly number[] => [...nodes].map(input.objectKey).sort((left, right) => left - right);
      const bindingKeys = [...bindings].map(([declaration, evidence]) => [input.objectKey(declaration), input.objectKey(evidence)] as const)
        .sort((left, right) => left[0] - right[0]);
      return { key: JSON.stringify([nodeKeys(bound), bindingKeys]), bound, bindings };
    }

    function merge(parts: Iterable<Summary>): Summary {
      charge();
      const found: SourceTypeParameter[] = [];
      const seen = new Set<Node>();
      let complete = true;
      let height = 0;
      for (const part of parts) {
        complete &&= part.complete;
        height = Math.max(height, part.height);
        for (const parameter of part.parameters) {
          charge();
          if (!seen.has(parameter.declaration)) { seen.add(parameter.declaration); found.push(parameter); }
        }
      }
      return { parameters: Object.freeze(found), complete, height };
    }

    function descended(summary: Summary): Summary {
      return { ...summary, height: summary.height + 1 };
    }

    function captures(declaration: Node, current: Environment, level: number): Summary {
      const record = parameterRecord(get(declaration));
      if (record.captures.length === 0) return empty;
      const retained = captureSummaries.get(declaration)?.get(current.key);
      if (retained !== undefined) { depth(level + retained.height); return retained; }
      let path = requirements.get(declaration);
      if (path?.has(current.key)) return recursive;
      charge();
      if (path === undefined) { path = new Set(); requirements.set(declaration, path); }
      path.add(current.key);
      try {
        const result = merge(function* () { for (const captured of record.captures) yield descended(parameter(captured, current, level + 1)); }());
        if (result.complete) {
          let entries = captureSummaries.get(declaration);
          if (entries === undefined) { entries = new Map(); captureSummaries.set(declaration, entries); }
          entries.set(current.key, result);
        }
        return result;
      } finally { path.delete(current.key); }
    }

    function parameter(declaration: Node, current: Environment, level: number): Summary {
      depth(level);
      charge();
      const selected = get(declaration);
      if (current.bound.has(declaration)) return captures(declaration, current, level);
      const replacement = current.bindings.get(declaration);
      if (replacement?.type.kind === "parameter" && replacement.type.declaration === declaration) {
        charge(current.bindings.size + 1);
        const bindings = new Map(current.bindings);
        bindings.delete(declaration);
        return descended(visit(replacement, environment(current.bound, bindings), level + 1));
      }
      if (replacement !== undefined && !resolving.has(declaration)) {
        charge();
        resolving.add(declaration);
        try { return descended(visit(replacement, current, level + 1)); }
        finally { resolving.delete(declaration); }
      }
      return merge([{ parameters: [selected], complete: replacement === undefined, height: 0 }, captures(declaration, current, level)]);
    }

    function categoryParameters(category: SourceCategoryDomain, current: Environment, level: number): Summary {
      depth(level);
      charge();
      if (category.kind === "parameter") return parameter(category.declaration, current, level);
      if (category.kind !== "choice") return empty;
      return merge(function* () { for (const alternative of category.alternatives) yield descended(categoryParameters(alternative, current, level + 1)); }());
    }

    function visit(selected: SourceTypeEvidence, inherited: Environment, level: number): Summary {
      input.evidence.assert(selected);
      depth(level);
      const retained = summaries.get(selected)?.get(inherited.key);
      if (retained !== undefined) { depth(level + retained.height); return retained; }
      if (active.get(selected)?.has(inherited.key)) return recursive;
      charge();
      const record = input.evidence.record(selected);
      let current = inherited;
      if (record.requirementBindings.length > 0) {
        charge(inherited.bindings.size + record.requirementBindings.length);
        const bindings = new Map(inherited.bindings);
        for (const binding of record.requirementBindings) { get(binding.declaration); input.evidence.assert(binding.value); bindings.set(binding.declaration, binding.value); }
        current = environment(inherited.bound, bindings);
      }
      let path = active.get(selected);
      if (path === undefined) { path = new Set(); active.set(selected, path); }
      path.add(inherited.key);
      try {
        function* parts(): Generator<Summary> {
          if (selected.type.kind === "parameter") yield parameter(selected.type.declaration, current, level);
          yield categoryParameters(selected.category, current, level);
          for (const child of record.components.values()) {
            charge();
            const selector = child.selector;
            const signature = selector.kind === "parameter" || selector.kind === "receiver" || selector.kind === "result" || selector.kind === "signature-tail"
              ? selector.signature : undefined;
            let childEnvironment = current;
            if (signature !== undefined && signature.typeParameters.some(declaration => !current.bound.has(declaration))) {
              charge(current.bound.size + signature.typeParameters.length);
              const bound = new Set(current.bound);
              for (const declaration of signature.typeParameters) { get(declaration); bound.add(declaration); }
              childEnvironment = environment(bound, current.bindings);
            }
            if (signature !== undefined) for (const declaration of signature.typeParameters) yield captures(declaration, childEnvironment, level);
            yield descended(visit(child.value, childEnvironment, level + 1));
          }
          if (selected.sum !== undefined) for (const arm of selected.sum.arms) { charge(); yield descended(visit(arm, current, level + 1)); }
          for (const child of dependencies.get(selected) ?? []) { charge(); yield descended(visit(child, current, level + 1)); }
        }
        const result = merge(parts());
        depth(level + result.height);
        if (result.complete) {
          let entries = summaries.get(selected);
          if (entries === undefined) { entries = new Map(); summaries.set(selected, entries); }
          entries.set(inherited.key, result);
        }
        return result;
      } finally { path.delete(inherited.key); }
    }

    return visit(value, environment(new Set(), new Map()), 0).parameters;
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
    registerDependencies(value: SourceTypeEvidence, children: readonly SourceTypeEvidence[]): void {
      input.evidence.assert(value);
      children.forEach(input.evidence.assert);
      const previous = dependencies.get(value);
      if (previous !== undefined) {
        if (previous.length !== children.length || previous.some((child, index) => child !== children[index]))
          throw new Error("Canonical Source provenance retains one immutable original child inventory.");
        return;
      }
      if (summaries.has(value)) throw new Error("Canonical Source provenance must register its children before binder discovery or publication.");
      dependencies.set(value, Object.freeze([...children]));
    },
    register(declaration: Node, owner: Node, index: number,
      captures: readonly Node[],
      constraint: () => SourceResult<SourceTypeParameterRequirement>,
      defaultType: () => SourceResult<SourceTypeParameterRequirement>): SourceTypeParameter {
      input.assertNode(declaration);
      input.assertNode(owner);
      captures.forEach(input.assertNode);
      if (!Number.isSafeInteger(index) || index < 0) throw new Error("An original Source binder requires its exact nonnegative ordinal.");
      const previous = declarations.get(declaration);
      if (previous !== undefined) {
        if (previous.value.owner !== owner || previous.value.index !== index) throw new Error("An original Source binder has one owner and ordinal.");
        if (previous.captures.length !== captures.length || previous.captures.some((value, ordinal) => value !== captures[ordinal]))
          throw new Error("An original Source binder has one exact requirement capture inventory.");
        return previous.value;
      }
      const value = Object.freeze({ declaration, owner, index, type: input.interner.parameter(declaration) });
      const record: ParameterRecord = { value, captures: Object.freeze([...captures]), constraint, defaultType };
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
