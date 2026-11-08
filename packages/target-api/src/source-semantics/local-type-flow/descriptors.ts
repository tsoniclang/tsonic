import type { Node } from "@tsonic/tsts";
import type { SourceDescriptorInput, SourceInputSignatureFacts, SourceInputTypeFacts } from "../../host-input/descriptor-input.js";
import type { SourceInputComponent, SourceInputComponentPart, SourceInputSignature } from "../../host-input/identities.js";
import type { SourceCategoryDomain, SourceComponentSelector, SourceResult, SourceSignatureIdentity, SourceTypeBinding, SourceTypeDescriptor, SourceTypeDescriptorSignature, SourceTypeEvidence, SourceTypeParameterRequirement } from "../../public/source/contracts.js";
import type { SourceLiteralDomain } from "../../source-model/literals/domain.js";
import { sourceOpenLiteralDomain } from "../../source-model/literals/domain.js";
import type { SourceDescriptorBuilder, SourceDescriptorProductionHooks, SourceDescriptorReader, SourceEvidenceComponent, SourceProductionResult } from "../descriptor-contracts.js";

export interface SourceDescriptorReaderInput {
  readonly input: SourceDescriptorInput;
  readonly builder: SourceDescriptorBuilder;
  readonly hooks: SourceDescriptorProductionHooks;
  scalarDomain(original: Node, facts: SourceInputTypeFacts): SourceLiteralDomain;
  syntaxProduction(component: SourceInputComponent, syntax: Node, bindings: readonly SourceTypeBinding[], reader: SourceDescriptorReader): SourceProductionResult<SourceTypeEvidence>;
  observe<Value>(result: SourceResult<Value>): SourceResult<Value>;
}

export function createSourceTypeDescriptorReader(options: SourceDescriptorReaderInput): SourceDescriptorReader {
  const { input, builder, hooks } = options;
  const cache = new WeakMap<SourceInputComponent, Map<string, SourceResult<SourceTypeEvidence>>>();
  const active = new WeakMap<SourceInputComponent, Set<string>>();
  const ids = new WeakMap<object, number>();
  const signatures = new WeakMap<SourceInputSignature, SourceSignatureIdentity>();
  const registering = new Set<Node>();
  let nextId = 0;

  function identity(value: object): number {
    const previous = ids.get(value);
    if (previous !== undefined) return previous;
    const selected = nextId++;
    ids.set(value, selected);
    return selected;
  }

  function signature(value: SourceInputSignature): SourceSignatureIdentity {
    input.assertSignature(value);
    const previous = signatures.get(value);
    if (previous !== undefined) return previous;
    value.typeParameters.forEach(register);
    const selected = builder.signature(value.owner, value.signatureKind, value, value.declaration, value.typeParameters);
    signatures.set(value, selected);
    return selected;
  }

  function selector(value: SourceInputComponentPart): SourceComponentSelector {
    switch (value.kind) {
      case "member": return { kind: "member", origin: { kind: "declared", declaration: value.declaration } };
      case "element": return { kind: "array-element" };
      case "optional-value": case "index-key": case "index-value": case "type-argument": case "tuple-element": case "tuple-slice": return value;
      case "parameter": return { kind: "parameter", signature: signature(value.signature), index: value.index };
      case "receiver": case "result": return { kind: value.kind, signature: signature(value.signature) };
      case "signature-tail": return { ...value, signature: signature(value.signature) };
      case "union-member": case "argument-place": case "parameter-place": case "argument-tail": case "parameter-tail": return value;
    }
  }

  function component(value: SourceInputComponent) {
    input.assertComponent(value);
    return builder.componentIdentity(value.root, value.path.map(selector));
  }

  function requirement(value: SourceInputComponent | undefined): SourceResult<SourceTypeParameterRequirement> {
    if (value === undefined) return { kind: "resolved", value: { kind: "none" } };
    const selected = describeComponent(value, []);
    if (selected.kind === "pending") throw new Error("A final binder requirement needs its original dependencies solved before the query.");
    return selected.kind === "refused" ? selected : { kind: "resolved", value: { kind: "type", value: selected.value } };
  }

  function register(declaration: Node): void {
    input.assertNode(declaration);
    if (registering.has(declaration)) return;
    const facts = input.describe(input.syntax(declaration));
    if (facts.kind !== "parameter") throw new Error("A Source signature binder requires its original parameter component.");
    registering.add(declaration);
    builder.parameter(facts.parameter, facts.owner, facts.index, facts.captures,
      () => requirement(facts.constraint), () => requirement(facts.defaultType));
    facts.captures.forEach(register);
    registering.delete(declaration);
  }

  function unsupported(value: SourceInputComponent): SourceResult<never> {
    return options.observe(Object.freeze({ kind: "refused", source: "tsonic", code: "TSONIC_LOCAL_TYPE_UNSUPPORTED", site: value.root,
      message: "This source operation has no proven local type-flow rule or required checked evidence is unavailable. Annotate the value or the selected signature." }));
  }

  function scalar(facts: SourceInputTypeFacts & { readonly kind: "scalar" }): SourceTypeDescriptor {
    if (facts.primitive !== undefined) return builder.primitive(facts.primitive.kind);
    if (facts.scalar === "number") return builder.primitive("float64");
    if (facts.scalar === "boolean") return builder.primitive("bool");
    return facts.scalar === "string" ? builder.string() : builder.intrinsic(facts.scalar);
  }

  function category(facts: SourceInputTypeFacts): SourceCategoryDomain {
    if (facts.primitive !== undefined) return { kind: "known", category: facts.primitive.runtimeBase };
    if (facts.kind === "parameter") return { kind: "parameter", declaration: facts.parameter };
    if (facts.kind !== "scalar") return { kind: "known", category: facts.kind === "structure" && facts.calls.length > 0 ? "function" : "object" };
    return facts.scalar === "any" || facts.scalar === "unknown" ? { kind: "dynamic" }
      : facts.scalar === "never" ? { kind: "choice", alternatives: [] }
      : { kind: "known", category: facts.scalar === "void" ? "absence" : facts.scalar };
  }

  function publish(facts: SourceInputTypeFacts, type: SourceTypeDescriptor, children: readonly SourceEvidenceComponent[],
    domain: SourceLiteralDomain = sourceOpenLiteralDomain): SourceTypeEvidence {
    const selectedCategory = category(facts);
    return builder.evidence({ type, component: component(facts.component), category: selectedCategory,
      numeric: selectedCategory.kind === "known" && (selectedCategory.category === "number" || selectedCategory.category === "bigint")
        ? { producer: facts.authoredTypeNode ?? facts.component.root, category: selectedCategory, kind: facts.literal === undefined ? "declared" : "literal" } : undefined,
      sum: undefined }, children, facts.component, domain);
  }

  function readSignature(facts: SourceInputSignatureFacts, bindings: readonly SourceTypeBinding[], children: SourceEvidenceComponent[]): SourceProductionResult<SourceTypeDescriptorSignature> {
    const selectedIdentity = signature(facts.identity);
    const refusal = hooks.signatureRefusal(selectedIdentity);
    if (refusal !== undefined) return options.observe(refusal);
    const local = bindings.filter(binding => !selectedIdentity.typeParameters.includes(binding.declaration));
    const parameters: SourceTypeDescriptorSignature["parameters"][number][] = [];
    let receiver: SourceTypeDescriptorSignature["receiver"];
    if (facts.receiver !== undefined) {
      const value = describeComponent(facts.receiver, local);
      if (value.kind !== "resolved") return value;
      children.push({ selector: { kind: "receiver", signature: selectedIdentity }, value: value.value });
      const declaration = input.describeSignature(facts.identity).receiver?.declaration;
      receiver = { ...(declaration === undefined ? {} : { declaration }), type: value.value.type };
    }
    for (const [index, parameter] of facts.parameters.entries()) {
      const value = describeComponent(parameter.value, local);
      if (value.kind !== "resolved") return value;
      parameters.push({ kind: parameter.kind, ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration }), type: value.value.type });
      children.push({ selector: { kind: "parameter", signature: selectedIdentity, index }, value: value.value });
    }
    const result = describeComponent(facts.result, local);
    if (result.kind !== "resolved") return result;
    children.push({ selector: { kind: "result", signature: selectedIdentity }, value: result.value });
    return { kind: "resolved", value: { identity: selectedIdentity, ...(receiver === undefined ? {} : { receiver }), parameters, result: result.value.type } };
  }

  function read(facts: SourceInputTypeFacts, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence> {
    const syntax = facts.authoredTypeNode;
    if (syntax !== undefined && (input.ast.is.IsConditionalTypeNode(syntax) || input.ast.is.IsMappedTypeNode(syntax) || input.ast.is.IsTemplateLiteralTypeNode(syntax) || input.ast.is.IsIntersectionTypeNode(syntax) ||
      input.ast.is.IsIndexedAccessTypeNode(syntax) || input.ast.is.IsTypeOperatorNode(syntax) && input.ast.operatorKindName(syntax) === "KindKeyOfKeyword"))
      return options.syntaxProduction(facts.component, syntax, bindings, reader);
    if (facts.kind === "unavailable") return facts.declaration === undefined ? unsupported(facts.component) : hooks.declaredValue(facts.component, facts.declaration, bindings);
    if (facts.kind === "parameter") {
      register(facts.parameter);
      return builder.substitute(publish(facts, builder.typeParameter(facts.parameter).type, []), bindings);
    }
    if (facts.kind === "scalar") return { kind: "resolved", value: publish(facts, scalar(facts), [], options.scalarDomain(syntax ?? facts.component.root, facts)) };
    if (facts.kind === "union") {
      const roles: SourceTypeEvidence[] = [];
      for (const member of facts.members) {
        const selected = describeComponent(member, bindings);
        if (selected.kind !== "resolved") return selected;
        roles.push(selected.value);
      }
      return builder.join(component(facts.component), "authored", roles, facts.component);
    }
    const children: SourceEvidenceComponent[] = [];
    if (facts.kind === "declared") {
      facts.parameters.forEach(register);
      if (facts.parameters.length !== facts.arguments.length) throw new Error("A declared Source application must retain its complete original binder vector.");
      const arguments_: SourceTypeDescriptor[] = [];
      for (const [index, argument] of facts.arguments.entries()) {
        const selected = describeComponent(argument, bindings);
        if (selected.kind !== "resolved") return selected;
        arguments_.push(selected.value.type);
        children.push({ selector: { kind: "type-argument", declaration: facts.declaration, index }, value: selected.value });
      }
      builder.define(facts.declaration, facts.parameters, () => facts.definition === undefined
        ? hooks.declaredValue(facts.component, facts.declaration, []) : describeComponent(facts.definition, []));
      return { kind: "resolved", value: publish(facts, builder.declared({ declaration: facts.declaration, typeArguments: arguments_,
        ...(facts.extent === undefined ? {} : { extent: facts.extent }) }), children) };
    }
    if (facts.kind === "array") {
      const element = describeComponent(facts.element, bindings);
      if (element.kind !== "resolved") return element;
      children.push({ selector: { kind: "array-element" }, value: element.value });
      return { kind: "resolved", value: publish(facts, builder.array(element.value.type, facts.readonly), children) };
    }
    if (facts.kind === "tuple") {
      const elements: Extract<SourceTypeDescriptor, { readonly kind: "tuple" }>["elements"][number][] = [];
      for (const [index, element] of facts.elements.entries()) {
        const selected = describeComponent(element.value, bindings);
        if (selected.kind !== "resolved") return selected;
        elements.push({ kind: element.kind, type: selected.value.type, ...(element.declaration === undefined ? {} : { declaration: element.declaration }) });
        children.push({ selector: { kind: "tuple-element", index }, value: selected.value });
      }
      return { kind: "resolved", value: publish(facts, builder.tuple(elements, facts.readonly), children) };
    }
    const members: Extract<SourceTypeDescriptor, { readonly kind: "shape" }>["members"][number][] = [];
    for (const member of facts.members) {
      const original = member.read ?? member.write;
      const declaration = member.declarations[0];
      if (original === undefined || declaration === undefined || member.declarations.some(value => value !== declaration)) return unsupported(facts.component);
      const selected = describeComponent(original, bindings);
      if (selected.kind !== "resolved") return selected;
      const origin = { kind: "declared" as const, declaration };
      members.push({ name: member.name, origin, optional: member.optional, readonly: member.readonly, type: selected.value.type });
      children.push({ selector: { kind: "member", origin }, value: selected.value });
    }
    const indexes: Extract<SourceTypeDescriptor, { readonly kind: "shape" }>["indexes"][number][] = [];
    for (const index of facts.indexes) {
      const key = describeComponent(index.key, bindings);
      if (key.kind !== "resolved") return key;
      const value = describeComponent(index.value, bindings);
      if (value.kind !== "resolved") return value;
      indexes.push({ declaration: index.declaration, readonly: index.readonly, key: key.value.type, value: value.value.type });
      children.push({ selector: { kind: "index-key", declaration: index.declaration }, value: key.value },
        { selector: { kind: "index-value", declaration: index.declaration }, value: value.value });
    }
    const calls: SourceTypeDescriptorSignature[] = [], constructs: SourceTypeDescriptorSignature[] = [];
    for (const [source, destination] of [[facts.calls, calls], [facts.constructs, constructs]] as const) for (const value of source) {
      const selected = readSignature(value, bindings, children);
      if (selected.kind !== "resolved") return selected;
      destination.push(selected.value);
    }
    const shape = { members, indexes, calls, constructs };
    return { kind: "resolved", value: publish(facts, members.length === 0 && indexes.length === 0 && (calls.length > 0 || constructs.length > 0)
      ? builder.callable({ calls, constructs }) : builder.shape(shape), children) };
  }

  function describeComponent(original: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence> {
    input.assertComponent(original);
    const seen = new Set<Node>();
    for (const binding of bindings) {
      input.assertNode(binding.declaration);
      builder.assertEvidence(binding.value);
      if (seen.has(binding.declaration)) throw new Error("A Source read requires one value for each original binder.");
      seen.add(binding.declaration);
    }
    const key = JSON.stringify(bindings.map(binding => [identity(binding.declaration), identity(binding.value)]));
    const previous = cache.get(original)?.get(key);
    if (previous !== undefined) return previous;
    let reading = active.get(original);
    if (reading === undefined) { reading = new Set(); active.set(original, reading); }
    if (reading.has(key)) return { kind: "pending", dependencies: [component(original)] };
    reading.add(key);
    try {
      const result = read(input.describe(original), bindings);
      if (result.kind === "pending") return result;
      let results = cache.get(original);
      if (results === undefined) { results = new Map(); cache.set(original, results); }
      results.set(key, options.observe(result));
      return result;
    } finally { reading.delete(key); }
  }

  const reader: SourceDescriptorReader = Object.freeze({
    describeSyntax(node: Node, bindings: readonly SourceTypeBinding[]) {
      input.assertNode(node);
      return describeComponent(input.syntax(node), bindings);
    },
    describeComponent,
    inheritedBindings(original: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<readonly SourceTypeBinding[]> {
      input.assertComponent(original);
      const facts = input.describe(original);
      if (facts.kind !== "declared") return { kind: "resolved", value: Object.freeze([...bindings]) };
      const result = new Map(bindings.map(binding => [binding.declaration, binding]));
      for (const [index, declaration] of facts.parameters.entries()) {
        if (result.has(declaration)) continue;
        const argument = facts.arguments[index];
        if (argument === undefined) throw new Error("A declared inherited binding requires its exact original argument.");
        const value = describeComponent(argument, bindings);
        if (value.kind !== "resolved") return value;
        result.set(declaration, { declaration, value: value.value });
      }
      return { kind: "resolved", value: Object.freeze([...result.values()]) };
    },
  });
  return reader;
}
