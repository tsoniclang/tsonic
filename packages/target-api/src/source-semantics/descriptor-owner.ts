import type { Node } from "@tsonic/tsts";
import type { SourceDescriptorInput } from "../host-input/descriptor-input.js";
import type { SourceInputComponent } from "../host-input/identities.js";
import { sourceLiteralDomainUnion, sourceOpenLiteralDomain, sourceUnreachableLiteralDomain } from "../source-model/literals/domain.js";
import type {
  SourceComponentSelector, SourceConstructionDefinition, SourceDeferredProjection, SourceDescriptorView, SourceRefusal, SourceResult,
  SourceSumApplication, SourceSumFamily, SourceTypeBinding, SourceTypeComponent, SourceTypeEvidence, SourceUseDestination,
} from "../public/source/contracts.js";
import { createSourceComponentOwner } from "./descriptor-components.js";
import type { SourceProductionResult } from "../source-model/production.js";
import type { SourceDescriptorBuilder } from "./descriptor-contracts.js";
import { createSourceEvidenceOwner } from "./descriptor-evidence.js";
import { createSourceFamilyOwner } from "./descriptor-families.js";
import { createSourceDescriptorInterner } from "./descriptor-interner.js";
import { createSourceParameterOwner } from "./descriptor-parameters.js";
import { createSourceSubstitution } from "./descriptor-substitution.js";
import { createSourceInventoryOwner } from "./descriptor-inventory.js";
import type { SourceConstructionMemberHistory, SourceEvidenceDetails, SourceMemberInventory } from "./member-inventory.js";
import { substituteSourceEvidenceDetails } from "./descriptor-details.js";

export interface SourceDescriptorOwner {
  readonly builder: SourceDescriptorBuilder;
  readonly view: SourceDescriptorView;
  equivalent(left: SourceTypeEvidence, right: SourceTypeEvidence): boolean;
  observe<Value>(result: SourceResult<Value>): SourceResult<Value>;
  refusals(): readonly SourceRefusal[];
}

export function createSourceDescriptorOwner(input: {
  assertNode(node: Node): void;
  input: SourceDescriptorInput;
  members(value: SourceTypeEvidence, original: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceMemberInventory>;
  receiverBindings(value: SourceTypeEvidence, direct: readonly SourceTypeBinding[]): SourceProductionResult<readonly SourceTypeBinding[]>;
  construction(occurrence: Node): SourceProductionResult<SourceMemberInventory>;
  project(originalSource: SourceTypeEvidence, source: SourceTypeEvidence, projection: SourceDeferredProjection,
    bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
}): SourceDescriptorOwner {
  const refusals = new Set<SourceRefusal>();
  interface Definition {
    readonly parameters: readonly Node[];
    readonly produce: () => SourceProductionResult<SourceTypeEvidence>;
    readonly members: () => SourceProductionResult<SourceMemberInventory>;
    result?: SourceResult<SourceTypeEvidence>;
    active: boolean;
  }
  const definitions = new WeakMap<Node | SourceConstructionDefinition, Map<"instance" | "value" | "construction", Definition>>();
  const definitionResults = new WeakMap<SourceTypeEvidence, SourceResult<SourceTypeEvidence>>();
  const derivedComponents = new WeakMap<SourceTypeEvidence, Map<string, SourceTypeEvidence>>();
  const constructions = new WeakMap<Node, { readonly produce: () => SourceProductionResult<SourceConstructionMemberHistory>; result?: SourceConstructionMemberHistory }>();
  const constructionInventories = new WeakMap<Node, SourceMemberInventory>();
  const components = createSourceComponentOwner({ assertNode: input.assertNode,
    assertSignature: value => interner.assertSignature(value), assertFamily: value => families.assertFamily(value),
    assertConstruction: value => interner.assertConstruction(value) });
  const interner = createSourceDescriptorInterner({ assertNode: input.assertNode,
    assertSignature: input.input.assertSignature, assertComponent: components.assert });
  const evidence = createSourceEvidenceOwner({ components, assertNode: input.assertNode,
    assertDescriptor: interner.assertDescriptor, assertOriginal: input.input.assertComponent,
    assertSum: value => families.assertApplication(value) });
  const parameters = createSourceParameterOwner({ assertNode: input.assertNode, evidence, interner, observe });
  const substitute = createSourceSubstitution({ components, evidence, interner, parameters,
    applyFamily: reapplyFamily, materialize: materializeFamily, intersection, project });
  const families = createSourceFamilyOwner({ components, evidence, interner, parameters, substitute });
  const members = createSourceInventoryOwner({ evidence, definition: produceMemberDefinition,
    join: (component, values) => join(component, "inferred", values, undefined) });

  function referenceDefinition(type: Extract<SourceTypeEvidence["type"], { readonly kind: "declared" | "construction-reference" }>): Definition {
    const owner = type.kind === "declared" ? type.declaration : type.definition;
    const facet = type.kind === "declared" ? type.facet : "construction";
    const selected = definitions.get(owner)?.get(facet);
    if (selected === undefined) throw new Error("A Source reference must register its original definition owner and exact facet before publication.");
    return selected;
  }

  function referenceArgument(type: Extract<SourceTypeEvidence["type"], { readonly kind: "declared" | "construction-reference" }>, index: number): SourceComponentSelector {
    return type.kind === "declared" ? { kind: "type-argument", declaration: type.declaration, index }
      : { kind: "construction-argument", definition: type.definition, index };
  }

  function produceMemberDefinition(value: SourceTypeEvidence): SourceProductionResult<SourceMemberInventory> {
    const record = evidence.record(value);
    if (value.type.kind === "declared" || value.type.kind === "construction-reference") {
      const declared = value.type;
      const owner = referenceDefinition(declared);
      const original = owner.members();
      if (original.kind !== "resolved") return original;
      const bindings = owner.parameters.map((declaration, index) => {
        const child = record.components.get(components.selectorKey(referenceArgument(declared, index)));
        if (child === undefined) throw new Error("An applied member inventory requires each original argument's evidence.");
        return { declaration, value: child.value };
      });
      const details = substituteSourceEvidenceDetails({ members: original.value, origins: record.details.origins },
        child => substitute(child, bindings), bindings, substitute);
      const selected = evidence.details(details).members;
      if (selected.kind === "definition" || selected.kind === "production") throw new Error("An original member producer must publish its metadata, not another production indirection.");
      return { kind: "resolved", value: selected };
    }
    if (record.original !== undefined) return input.members(value, record.original, record.requirementBindings);
    if (value.type.kind === "projection") {
      const selected = produceDefinition(value);
      return selected.kind === "resolved" ? members(selected.value) : selected;
    }
    throw new Error("Source-only member evidence requires its complete original inventory at production.");
  }

  function intrinsicDetails(): SourceEvidenceDetails {
    return { members: { kind: "complete", members: [], indexes: [] }, origins: { kind: "complete", nodes: [] } };
  }

  function familyDetails(application: SourceSumApplication): SourceEvidenceDetails {
    const origins = application.roles.map(role => evidence.record(role.value).details.origins);
    return { members: { kind: "definition" }, origins: origins.every(origin => origin.kind === "complete")
      ? { kind: "complete", nodes: Object.freeze([...new Set(origins.flatMap(origin => origin.kind === "complete" ? origin.nodes : []))]) }
      : { kind: "unavailable" } };
  }

  function observe<Value>(result: SourceResult<Value>): SourceResult<Value> {
    if (result.kind === "refused") {
      input.assertNode(result.site);
      if (result.related !== undefined) input.assertNode(result.related);
      if (result.source !== "tsonic") throw new Error("A Source refusal requires its canonical Source owner.");
      refusals.add(result);
    }
    return result;
  }

  function project(originalSource: SourceTypeEvidence, source: SourceTypeEvidence, projection: SourceDeferredProjection,
    bindings: readonly SourceTypeBinding[]): SourceResult<SourceTypeEvidence> {
    evidence.assert(originalSource);
    evidence.assert(source);
    parameters.bindings(bindings);
    const selected = input.project(originalSource, source, projection, bindings);
    if (selected.kind === "pending") throw new Error("A final Source projection requires its original dependencies to be solved before substitution.");
    if (selected.kind === "resolved") evidence.assert(selected.value);
    return observe(selected);
  }

  function materializeFamily(component: SourceTypeComponent, application: SourceSumApplication,
    original: SourceInputComponent | undefined): SourceTypeEvidence {
    components.assert(component);
    families.assertApplication(application);
    const type = interner.union(application.arms.map(arm => arm.type));
    const children = application.arms.map((value, index) => ({ selector: { kind: "sum-arm" as const, family: application.family, index }, value }));
    if (type.kind === "optional") {
      const present = families.present(application);
      const presentComponent = components.identity(component.root, [...component.path, { kind: "optional-value" }]);
      const value = materializeFamily(presentComponent, present, undefined);
      const payload: import("./descriptor-contracts.js").SourceEvidenceComponent = { selector: { kind: "optional-value" }, value };
      return evidence.create({ type, component,
        category: parameters.category({ kind: "choice", alternatives: application.arms.map(arm => arm.category) }, []),
        numeric: application.arms.length === 1 ? application.arms[0]!.numeric : undefined, sum: application },
      [...children, payload], original, sourceLiteralDomainUnion(application.arms.map(arm => evidence.record(arm).domain)), application.bindings, familyDetails(application));
    }
    return evidence.create({ type, component,
      category: parameters.category({ kind: "choice", alternatives: application.arms.map(arm => arm.category) }, []),
      numeric: application.arms.length === 1 ? application.arms[0]!.numeric : undefined, sum: application },
    children, original, sourceLiteralDomainUnion(application.arms.map(arm => evidence.record(arm).domain)), application.bindings, familyDetails(application));
  }

  function join(component: SourceTypeComponent, origin: "authored" | "inferred", roles: readonly SourceTypeEvidence[],
    original: SourceInputComponent | undefined): SourceResult<SourceTypeEvidence> {
    components.assert(component);
    roles.forEach(evidence.assert);
    if (original !== undefined) input.input.assertComponent(original);
    if (roles.length === 0) return { kind: "resolved", value: evidence.create({ type: interner.intrinsic("never"), component,
      category: { kind: "choice", alternatives: [] }, numeric: undefined, sum: undefined }, [], original, sourceUnreachableLiteralDomain, [], intrinsicDetails()) };
    if (roles.length === 1) {
      const selected = roles[0]!;
      if (selected.component === component && (original === undefined || evidence.record(selected).original === original)) return { kind: "resolved", value: selected };
      const record = evidence.record(selected);
      return { kind: "resolved", value: evidence.create({ ...selected, component }, [...record.components.values()], original, record.domain, record.requirementBindings, record.details) };
    }
    const declarations = new Set<Node>();
    for (const role of roles) for (const parameter of parameters.free(role)) declarations.add(parameter.declaration);
    const family = families.publish(component, origin, [...declarations], roles);
    const application = families.apply(family, []);
    return application.kind === "refused" ? observe(application)
      : { kind: "resolved", value: materializeFamily(component, application.value, original) };
  }

  function reapplyFamily(value: SourceSumApplication, bindings: readonly SourceTypeBinding[]): SourceResult<SourceSumApplication> {
    families.assertApplication(value);
    const supplied = parameters.bindings(bindings);
    const previous = new Map(value.bindings.map(binding => [binding.declaration, binding.value]));
    const replacements = new Map(supplied.map(binding => [binding.declaration, binding.value]));
    const applied: SourceTypeBinding[] = [];
    for (const declaration of value.family.parameters) {
      const original = previous.get(declaration);
      if (original === undefined) {
        const replacement = replacements.get(declaration);
        if (replacement !== undefined) applied.push({ declaration, value: replacement });
      } else {
        const replacement = substitute(original, supplied);
        if (replacement.kind === "refused") return observe(replacement);
        applied.push({ declaration, value: replacement.value });
      }
    }
    const result = observe(families.apply(value.family, applied));
    return result.kind === "refused" ? result : { kind: "resolved", value: families.retainSelection(value, result.value) };
  }

  function component(value: SourceTypeEvidence, selector: SourceComponentSelector): SourceResult<SourceTypeEvidence> {
    const record = evidence.record(value);
    const key = components.selectorKey(selector);
    const selected = record.components.get(key);
    if (selected !== undefined) return { kind: "resolved", value: selected.value };
    const derived = derivedComponents.get(value)?.get(key);
    if (derived !== undefined) return { kind: "resolved", value: derived };
    if (selector.kind === "sum-arm" && value.sum !== undefined) {
      families.assertFamily(selector.family);
      if (value.sum.family !== selector.family) throw new Error("A Source sum component requires its exact original family.");
      const arm = value.sum.arms[selector.index];
      if (arm === undefined) throw new Error("A Source sum component requires an actual published arm ordinal.");
      return { kind: "resolved", value: arm };
    }
    if (selector.kind === "tuple-slice" && value.type.kind === "tuple") {
      const end = value.type.elements.length - selector.endCount;
      if (selector.start > end) throw new Error("A Source tuple slice requires its exact original start and end-trim boundaries.");
      const children = value.type.elements.slice(selector.start, end).map((_element, index) => {
        const original = record.components.get(components.selectorKey({ kind: "tuple-element", index: index + selector.start }));
        if (original === undefined) throw new Error("A Source tuple slice requires every original element's evidence.");
        return { selector: { kind: "tuple-element" as const, index }, value: original.value };
      });
      const selected = evidence.create({ type: interner.tuple(value.type.elements.slice(selector.start, end), selector.readonly),
        component: components.identity(value.component.root, [...value.component.path, selector]),
        category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined }, children, undefined, sourceOpenLiteralDomain, record.requirementBindings,
      { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [] } });
      return retainComponent(value, key, selected);
    }
    if (selector.kind === "signature-tail" && (value.type.kind === "callable" || value.type.kind === "shape")) {
      const signature = [...value.type.calls, ...value.type.constructs].find(candidate => candidate.identity === selector.signature);
      if (signature === undefined || selector.start > signature.parameters.length) throw new Error("A Source signature tail requires its exact original signature and parameter boundary.");
      const children = signature.parameters.slice(selector.start).map((_parameter, index) => {
        const original = record.components.get(components.selectorKey({ kind: "parameter", signature: selector.signature, index: selector.start + index }));
        if (original === undefined) throw new Error("A Source signature tail requires every original parameter's evidence.");
        return { selector: { kind: "tuple-element" as const, index }, value: original.value };
      });
      const selected = evidence.create({ type: interner.tuple(signature.parameters.slice(selector.start), selector.readonly),
        component: components.identity(value.component.root, [...value.component.path, selector]),
        category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined }, children, undefined, sourceOpenLiteralDomain, record.requirementBindings,
      { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [] } });
      return retainComponent(value, key, selected);
    }
    if (value.type.kind === "declared" || value.type.kind === "construction-reference" || value.type.kind === "projection" || value.type.kind === "intersection") {
      const expanded = definition(value);
      if (expanded.kind === "refused") return expanded;
      if (expanded.value === value) throw new Error("A Source component requires a completed original definition, not an unresolved projection.");
      return component(expanded.value, selector);
    }
    throw new Error("A required Source component must be registered with its original evidence before publication.");
  }

  function retainComponent(original: SourceTypeEvidence, key: string, value: SourceTypeEvidence): SourceResult<SourceTypeEvidence> {
    let selected = derivedComponents.get(original);
    if (selected === undefined) { selected = new Map(); derivedComponents.set(original, selected); }
    selected.set(key, value);
    return { kind: "resolved", value };
  }

  function produceDefinition(value: SourceTypeEvidence): SourceProductionResult<SourceTypeEvidence> {
    const original = evidence.record(value);
    if (value.type.kind === "intersection") {
      const reduction = original.components.get(components.selectorKey({ kind: "intersection-result" }));
      if (reduction === undefined) throw new Error("A Source conjunction must retain its exact canonical reduction evidence.");
      return { kind: "resolved", value: reduction.value };
    }
    if (value.type.kind !== "declared" && value.type.kind !== "construction-reference" && value.type.kind !== "projection") return { kind: "resolved", value };
    const previous = definitionResults.get(value);
    if (previous !== undefined) return previous;
    if (value.type.kind === "projection") {
      const selected = original.components.get(components.selectorKey({ kind: "projection-source" }));
      if (selected === undefined) throw new Error("A deferred Source projection must retain its exact original source evidence.");
      const result = input.project(selected.value, selected.value, value.type.projection, original.requirementBindings);
      if (result.kind === "resolved") evidence.assert(result.value);
      if (result.kind !== "pending") definitionResults.set(value, observe(result));
      return result;
    }
    const declared = value.type;
    const selected = referenceDefinition(declared);
    if (selected.active) return { kind: "pending", dependencies: Object.freeze([value.component]) };
    if (selected.result === undefined) {
      selected.active = true;
      try {
        const result = selected.produce();
        if (result.kind === "pending") return result;
        if (result.kind === "resolved") evidence.assert(result.value);
        selected.result = observe(result);
      } finally { selected.active = false; }
    }
    if (selected.result.kind === "refused") { definitionResults.set(value, selected.result); return selected.result; }
    if (declared.typeArguments.length !== selected.parameters.length) throw new Error("A declared Source application requires its complete original parameter vector.");
    const bindings = selected.parameters.map((parameter, index) => {
      const argument = original.components.get(components.selectorKey(referenceArgument(declared, index)));
      if (argument === undefined || argument.value.type !== declared.typeArguments[index]) throw new Error("A declared Source argument requires its exact original evidence.");
      return { declaration: parameter, value: argument.value };
    });
    const result = observe(substitute(selected.result.value, bindings));
    definitionResults.set(value, result);
    return result;
  }

  function definition(value: SourceTypeEvidence): SourceResult<SourceTypeEvidence> {
    const result = produceDefinition(value);
    if (result.kind === "pending") throw new Error("A final Source definition requires its original inferred dependencies to be solved.");
    return result;
  }

  function intersection(component: SourceTypeComponent, parts: readonly SourceTypeEvidence[], result: SourceTypeEvidence,
    original: SourceInputComponent | undefined): SourceTypeEvidence {
    components.assert(component);
    parts.forEach(evidence.assert);
    const selected = evidence.record(result);
    return evidence.create({ ...result, type: interner.intersection(parts.map(part => part.type)), component },
      [...[...selected.components.values()].filter(child => child.selector.kind !== "intersection-member" &&
        child.selector.kind !== "intersection-result"), ...parts.map((value, index) => ({
        selector: { kind: "intersection-member" as const, index }, value })),
      { selector: { kind: "intersection-result" }, value: result }],
      original, selected.domain, selected.requirementBindings, selected.details);
  }

  const view: SourceDescriptorView = Object.freeze({ assertEvidence: evidence.assert, assertDescriptor: interner.assertDescriptor,
    scalarLiteral(value: SourceTypeEvidence) {
      const domain = evidence.record(value).domain;
      return domain.kind === "finite" && domain.values.length === 1
        ? Object.freeze({ kind: "present" as const, value: domain.values[0]! }) : Object.freeze({ kind: "none" as const });
    },
    component, substitute: (value: SourceTypeEvidence, bindings: readonly SourceTypeBinding[]) => observe(substitute(value, bindings)), definition,
    freeParameters: parameters.free, typeParameter: parameters.get,
    constraint: parameters.constraint, defaultType: parameters.defaultType });
  const builder: SourceDescriptorBuilder = Object.freeze({ ...view, intersection, primitive: interner.primitive, string: interner.string,
    assertDestination(value: SourceUseDestination): void {
      evidence.assert(value.declaration.type);
      evidence.assert(value.applied);
      const origin = value.declaration.origin;
      if (origin.kind === "declaration") input.assertNode(origin.declaration);
      else {
        interner.assertSignature(origin.signature);
        if (origin.declaration !== undefined) input.assertNode(origin.declaration);
      }
      if (value.application === undefined) {
        if (value.applied !== value.declaration.type) throw new Error("A nonapplied use must retain its identical original declared slot evidence.");
        return;
      }
      const application = value.application;
      if (application.kind === "call") {
        input.assertNode(application.identity.invocation);
        interner.assertSignature(application.identity.signature);
      } else {
        const receiver = application.receiver;
        const record = evidence.record(receiver);
        const direct: SourceTypeBinding[] = [];
        if (receiver.type.kind === "declared" || receiver.type.kind === "construction-reference") {
          const definition = referenceDefinition(receiver.type);
          for (const [index, parameter] of definition.parameters.entries()) {
            const child = record.components.get(components.selectorKey(referenceArgument(receiver.type, index)));
            if (child === undefined) throw new Error("An original receiver application requires its actual registered argument evidence.");
            direct.push({ declaration: parameter, value: child.value });
          }
        }
        const expected = input.receiverBindings(receiver, direct);
        if (expected.kind !== "resolved") throw new Error("A published receiver destination requires its original class and inherited environment to be solved.");
        const authenticated = parameters.bindings(expected.value);
        if (application.bindings.length !== authenticated.length || application.bindings.some((binding, index) => {
          const original = authenticated[index]!;
          return binding.declaration !== original.declaration || !evidence.equivalent(binding.value, original.value);
        })) throw new Error("A receiver destination must retain the exact ordered environment of its actual receiver evidence.");
      }
      const bindings = application.kind === "receiver" ? application.bindings
        : [...application.identity.classBindings, ...application.identity.signatureBindings];
      const selected = parameters.bindings(bindings);
      const applied = substitute(value.declaration.type, selected);
      if (applied.kind === "refused") throw new Error("A published use cannot replace its original failed substitution with successful evidence.");
      if (!evidence.equivalent(applied.value, value.applied)) throw new Error("A use destination requires the exact Source substitution of its original declared slot and authenticated application environment.");
    },
    intrinsic: interner.intrinsic, parameter: parameters.register, optional: interner.optional, union: interner.union,
    array: interner.array, tuple: interner.tuple, shape: interner.shape, callable: interner.callable,
    declared: interner.declared, projection: interner.projection, signature: interner.signature,
    constructionDefinition(occurrence: Node, captures: readonly Node[]): SourceConstructionDefinition {
      input.assertNode(occurrence);
      if (!input.input.ast.is.IsObjectLiteralExpression(occurrence)) throw new Error("A Source construction definition requires its actual original object literal.");
      captures.forEach(parameters.get);
      return interner.constructionDefinition(occurrence, captures);
    },
    constructionReference: interner.constructionReference,
    componentIdentity: components.identity,
    evidence: (value: SourceTypeEvidence, children: readonly import("./descriptor-contracts.js").SourceEvidenceComponent[], original: SourceInputComponent | undefined, domain: import("../source-model/literals/domain.js").SourceLiteralDomain,
      details: SourceEvidenceDetails) => evidence.create(value, children, original, domain, [], details),
    members, produceDefinition,
    registerConstruction(occurrence: Node, produce: () => SourceProductionResult<SourceConstructionMemberHistory>): void {
      input.assertNode(occurrence);
      if (!input.input.ast.is.IsObjectLiteralExpression(occurrence) && !input.input.ast.is.IsBindingElement(occurrence))
        throw new Error("A construction history subject must be its original literal or rest binding.");
      const previous = constructions.get(occurrence);
      if (previous !== undefined && previous.produce !== produce) throw new Error("Each original construction has one metadata producer.");
      if (previous === undefined) constructions.set(occurrence, { produce });
    },
    construction(occurrence: Node): SourceProductionResult<SourceMemberInventory> {
      input.assertNode(occurrence);
      const previous = constructionInventories.get(occurrence);
      if (previous !== undefined) return { kind: "resolved", value: previous };
      const selected = input.construction(occurrence);
      if (selected.kind !== "resolved") return selected;
      const inventory = evidence.details({ members: selected.value, origins: { kind: "complete", nodes: [occurrence] } }).members;
      if (inventory.kind === "definition" || inventory.kind === "production") throw new Error("A construction interpretation must publish its original metadata.");
      if (inventory.kind === "complete") constructionInventories.set(occurrence, inventory);
      return { kind: "resolved", value: inventory };
    },
    constructionHistory(occurrence: Node): SourceProductionResult<SourceConstructionMemberHistory> {
      input.assertNode(occurrence);
      const selected = constructions.get(occurrence);
      if (selected === undefined) return { kind: "pending", dependencies: Object.freeze([components.identity(occurrence, [])]) };
      if (selected.result !== undefined) return { kind: "resolved", value: selected.result };
      const result = selected.produce();
      if (result.kind !== "resolved") return result;
      if (result.value.occurrence !== occurrence) throw new Error("A construction history retains its exact original occurrence.");
      const evaluations = new Set<Node>();
      const steps = result.value.steps.map(step => {
        input.assertNode(step.evaluation);
        if (evaluations.has(step.evaluation)) throw new Error("A construction history evaluates each original step once.");
        evaluations.add(step.evaluation);
        if (step.kind === "own") {
          const inventory = evidence.details({ members: { kind: "complete", members: [step.member], indexes: [] },
            origins: { kind: "complete", nodes: [occurrence] } }).members;
          if (inventory.kind !== "complete") throw new Error("An own construction step retains its exact original row.");
          return Object.freeze({ ...step, member: inventory.members[0]! });
        }
        input.assertNode(step.operand);
        const excluded = Object.freeze(step.excluded.map(key => {
          if (key.kind === "symbol") input.assertNode(key.declaration);
          return Object.freeze({ ...key });
        }));
        return Object.freeze({ ...step, excluded, source: () => {
          const result = step.source();
          if (result.kind === "resolved") evidence.assert(result.value);
          return result;
        } });
      });
      const frozen = Object.freeze({ occurrence, steps: Object.freeze(steps) });
      selected.result = frozen;
      return { kind: "resolved", value: frozen };
    },
    sourceOriginSubjects: (value: SourceTypeEvidence) => evidence.record(value).details.origins,
    domain: (value: SourceTypeEvidence) => evidence.record(value).domain, join,
    originalComponent(value: SourceTypeEvidence) {
      const selected = evidence.record(value).original;
      return selected === undefined ? Object.freeze({ kind: "none" as const })
        : Object.freeze({ kind: "present" as const, value: selected });
    },
    define(identity: Parameters<SourceDescriptorBuilder["define"]>[0], selectedParameters: readonly Node[], produce: () => SourceProductionResult<SourceTypeEvidence>, selectedMembers: () => SourceProductionResult<SourceMemberInventory>): void {
      const declaration = identity.kind === "declaration" ? identity.declaration : identity.definition;
      const facet = identity.kind === "declaration" ? identity.facet : "construction";
      if (identity.kind === "declaration") input.assertNode(identity.declaration);
      else interner.assertConstruction(identity.definition);
      selectedParameters.forEach(parameters.get);
      if (identity.kind === "construction" && (identity.definition.captures.length !== selectedParameters.length ||
        identity.definition.captures.some((value, index) => value !== selectedParameters[index])))
        throw new Error("A construction definition requires its complete exact original capture inventory.");
      let facets = definitions.get(declaration);
      const previous = facets?.get(facet);
      if (previous !== undefined) {
        if (previous.parameters.length !== selectedParameters.length || previous.parameters.some((parameter, index) => parameter !== selectedParameters[index])) {
          throw new Error("An original Source definition has one exact ordered parameter vector.");
        }
        return;
      }
      if (facets === undefined) { facets = new Map(); definitions.set(declaration, facets); }
      facets.set(facet, { parameters: Object.freeze([...selectedParameters]), produce, members: selectedMembers, active: false });
    },
    publishFamily: families.publish, applyFamily: (family: SourceSumFamily, bindings: readonly SourceTypeBinding[]) => observe(families.apply(family, bindings)),
    substituteCategory: parameters.category, seal: () => view });
  return Object.freeze({ builder, view, equivalent: evidence.equivalent, observe, refusals: () => Object.freeze([...refusals]) });
}
