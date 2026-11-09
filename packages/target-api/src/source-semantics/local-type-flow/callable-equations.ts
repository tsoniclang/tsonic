import type { Node } from "@tsonic/tsts";
import type { SourceComponentSelector, SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceSemanticProduction } from "./production-context.js";
import { sourceKeyDomainContains } from "./key-domains.js";
import { sourceEvidenceExtends } from "./evidence-relations.js";
import { sourceTypeExpansionBudget } from "../type-expansion-budget.js";
import { failTargetCompilerResourceLimit } from "../../artifacts.js";

export interface SourceCallableEquation {
  readonly template: SourceTypeEvidence;
  readonly actual: SourceTypeEvidence;
  readonly direction: "input" | "result";
}

export function produceSourceCallableBindings(context: SourceSemanticProduction & {
  equivalent(left: SourceTypeEvidence, right: SourceTypeEvidence): boolean;
}, root: Node, variables: readonly Node[], initial: readonly SourceTypeBinding[], equations: readonly SourceCallableEquation[]):
  SourceProductionResult<readonly SourceTypeBinding[]> {
  const { builder, objects } = context;
  const parameters = new Set(variables);
  const selected = new Map(initial.map(binding => [binding.declaration, binding.value]));
  const constraints = new Map<Node, { readonly inputs: SourceTypeEvidence[]; readonly results: SourceTypeEvidence[] }>();
  const active = new WeakMap<SourceTypeEvidence, Set<SourceTypeEvidence>>();
  const completed = new WeakMap<SourceTypeEvidence, WeakMap<SourceTypeEvidence, Set<SourceCallableEquation["direction"]>>>();
  let work = 0;
  function charge(count = 1): void {
    if (count > sourceTypeExpansionBudget.types - work) failTargetCompilerResourceLimit("tsonic", "Source type expansion", "types", sourceTypeExpansionBudget.types, root);
    work += count;
  }
  const pending = (...values: readonly SourceTypeEvidence[]): SourceProductionResult<never> =>
    ({ kind: "pending", dependencies: Object.freeze([...new Set(values.map(value => value.component))]) });

  function equate(template: SourceTypeEvidence, actual: SourceTypeEvidence, direction: SourceCallableEquation["direction"], depth: number): SourceProductionResult<true> {
    builder.assertEvidence(template);
    builder.assertEvidence(actual);
    charge();
    if (depth >= sourceTypeExpansionBudget.depth) failTargetCompilerResourceLimit("tsonic", "Source type expansion", "depth", sourceTypeExpansionBudget.depth, root);
    if (completed.get(template)?.get(actual)?.has(direction)) return { kind: "resolved", value: true };
    if (template.type.kind === "parameter" && parameters.has(template.type.declaration)) {
      const declaration = template.type.declaration;
      let values = constraints.get(declaration);
      if (values === undefined) { values = { inputs: [], results: [] }; constraints.set(declaration, values); }
      const targets = direction === "input" ? values.inputs : values.results;
      if (!targets.some(value => context.equivalent(value, actual))) { charge(); targets.push(actual); }
      return { kind: "resolved", value: true };
    }
    if (!builder.freeParameters(template).some(parameter => parameters.has(parameter.declaration))) return { kind: "resolved", value: true };
    if (active.get(template)?.has(actual)) return pending(template, actual);
    let path = active.get(template);
    if (path === undefined) { path = new Set(); active.set(template, path); }
    path.add(actual);
    try {
      const result = parts(template, actual, direction, depth);
      if (result.kind === "resolved") {
        let pairs = completed.get(template);
        if (pairs === undefined) { pairs = new WeakMap(); completed.set(template, pairs); }
        let directions = pairs.get(actual);
        if (directions === undefined) { directions = new Set(); pairs.set(actual, directions); }
        directions.add(direction);
      }
      return result;
    } finally { path.delete(actual); }
  }

  function child(template: SourceTypeEvidence, actual: SourceTypeEvidence, first: SourceComponentSelector,
    second: SourceComponentSelector, direction: SourceCallableEquation["direction"], depth: number): SourceProductionResult<true> {
    const left = builder.component(template, first);
    if (left.kind !== "resolved") return left;
    const right = builder.component(actual, second);
    return right.kind !== "resolved" ? right : equate(left.value, right.value, direction, depth + 1);
  }

  function parts(template: SourceTypeEvidence, actual: SourceTypeEvidence, direction: SourceCallableEquation["direction"], depth: number): SourceProductionResult<true> {
    if (template.type.kind === "declared" && actual.type.kind === "declared" && template.type.declaration === actual.type.declaration && template.type.facet === actual.type.facet) {
      if (template.type.typeArguments.length !== actual.type.typeArguments.length) return pending(template, actual);
      for (let index = 0; index < template.type.typeArguments.length; index++) {
        const result = child(template, actual, { kind: "type-argument", declaration: template.type.declaration, index },
          { kind: "type-argument", declaration: actual.type.declaration, index }, direction, depth);
        if (result.kind !== "resolved") return result;
      }
      return { kind: "resolved", value: true };
    }
    const left = builder.produceDefinition(template);
    if (left.kind !== "resolved") return left;
    const right = builder.produceDefinition(actual);
    if (right.kind !== "resolved") return right;
    if (left.value !== template || right.value !== actual) return equate(left.value, right.value, direction, depth + 1);
    if (template.type.kind === "array" && actual.type.kind === "array") return child(template, actual,
      { kind: "array-element" }, { kind: "array-element" }, direction, depth);
    if (template.type.kind === "optional" && actual.type.kind === "optional") return child(template, actual,
      { kind: "optional-value" }, { kind: "optional-value" }, direction, depth);
    if (template.type.kind === "tuple" && actual.type.kind === "tuple") {
      if (template.type.elements.length !== actual.type.elements.length) return pending(template, actual);
      for (let index = 0; index < template.type.elements.length; index++) {
        if (template.type.elements[index]!.kind !== actual.type.elements[index]!.kind) return pending(template, actual);
        const result = child(template, actual, { kind: "tuple-element", index }, { kind: "tuple-element", index }, direction, depth);
        if (result.kind !== "resolved") return result;
      }
      return { kind: "resolved", value: true };
    }
    if (template.type.kind === "shape" && actual.type.kind === "shape") {
      const pairs = objects.correspondence(actual, template, "read", (required, supplied) => sourceKeyDomainContains(builder, required, supplied));
      if (pairs.kind !== "resolved") return pairs;
      if (pairs.value.kind !== "available") return pending(template, actual);
      for (const pair of pairs.value.members) {
        charge();
        if (pair.kind !== "present" || pair.source.readType === undefined || pair.destination.readType === undefined) return pending(template, actual);
        const result = equate(pair.destination.readType, pair.source.readType, direction, depth + 1);
        if (result.kind !== "resolved") return result;
      }
      for (const pair of pairs.value.indexes) for (const source of pair.sources) {
        charge();
        if (source.coverage !== "yes" || pair.destination.readType === undefined || source.source.readType === undefined) return pending(template, actual);
        const result = equate(pair.destination.readType, source.source.readType, direction, depth + 1);
        if (result.kind !== "resolved") return result;
      }
      return { kind: "resolved", value: true };
    }
    return pending(template, actual);
  }

  for (const binding of initial) { builder.typeParameter(binding.declaration); builder.assertEvidence(binding.value); }
  for (const declaration of variables) builder.typeParameter(declaration);
  for (const equation of equations) {
    const result = equate(equation.template, equation.actual, equation.direction, 0);
    if (result.kind !== "resolved") return result;
  }
  for (const declaration of variables) {
    const values = constraints.get(declaration);
    const known = selected.get(declaration);
    if (known !== undefined) continue;
    if (values === undefined) return { kind: "pending", dependencies: Object.freeze(equations.map(equation => equation.template.component)) };
    let value: SourceTypeEvidence;
    if (values.inputs.length > 0) {
      const joined = builder.join(builder.componentIdentity(root, []), "inferred", values.inputs, undefined);
      if (joined.kind !== "resolved") return joined;
      value = joined.value;
    } else {
      const candidates = values.results;
      if (candidates.length !== 1) return { kind: "pending", dependencies: Object.freeze(candidates.map(value => value.component)) };
      value = candidates[0]!;
    }
    selected.set(declaration, value);
  }
  const environment = Object.freeze([...selected].map(([declaration, value]) => Object.freeze({ declaration, value })));
  for (const declaration of variables) {
    const values = constraints.get(declaration);
    const supplied = selected.get(declaration);
    if (supplied === undefined) throw new Error("A solved Source callable environment includes every original API-body binder.");
    for (const constraint of values?.results ?? []) {
      const required = builder.substitute(constraint, environment);
      if (required.kind !== "resolved") return required;
      const admitted = sourceEvidenceExtends(context, supplied, required.value);
      if (admitted.kind !== "resolved") return admitted;
      if (admitted.value !== "yes") return pending(supplied, required.value);
    }
  }
  return { kind: "resolved", value: environment };
}
