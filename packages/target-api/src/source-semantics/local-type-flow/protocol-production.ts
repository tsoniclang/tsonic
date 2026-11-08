import type { Node } from "@tsonic/tsts";
import type { SourceInputAtomicIteration, SourceInputIterationMechanism, SourceInputProtocolQueries } from "../../host-input/protocol-input.js";
import type { SourceInputSignature } from "../../host-input/identities.js";
import type { SourceAnalysisFacts } from "../../source-model/program.js";
import type { SourceAtomicIterationMechanism, SourceGenerator, SourceIteration, SourceIterationMechanism, SourceIterationValues, SourceYield } from "../../source-model/protocols.js";
import type { SourcePresence, SourceResult, SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import { sourcePresentLiteralDomain } from "../../source-model/literals/domain.js";
import { produceSourceAwaitedType } from "./awaited.js";
import { createSourceProductionCache } from "./production-cache.js";
import { produceSourceReceiverBindings } from "./callable-production.js";
import type { SourceCallableProduction } from "./production-context.js";
import type { SourceProducedSignature } from "./application-data.js";
import { sourceProductionValues, sourceSemanticRefusal } from "./semantic-production.js";
import { produceSourceSequenceElements } from "./tuple-layout.js";

interface SourceProtocolProduction extends SourceCallableProduction {
  readonly protocolInput: SourceInputProtocolQueries;
  signature(original: SourceInputSignature, bindings: readonly SourceTypeBinding[], root: Node): SourceProductionResult<SourceProducedSignature>;
}

interface SourceProducedIteration {
  readonly element: SourceTypeEvidence;
  readonly completion: SourceTypeEvidence;
  readonly mechanism: SourceAtomicIterationMechanism;
}

export function createSourceSolvedProtocolFacts(context: SourceProtocolProduction): {
  readonly facts: Pick<SourceAnalysisFacts, "iteration" | "generator" | "yield">;
  iteration(node: Node): SourceProductionResult<SourcePresence<SourceIteration>>;
  generator(node: Node): SourceProductionResult<SourcePresence<SourceGenerator>>;
  yield(node: Node): SourceProductionResult<SourcePresence<SourceYield>>;
  element(source: SourceTypeEvidence, occurrence: Node): SourceProductionResult<SourceTypeEvidence>;
} {
  const { ast, builder, reader, protocolInput, objects } = context;
  const none = Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "none" }) } as const);
  const present = <Value>(value: Value): SourceProductionResult<SourcePresence<Value>> => ({ kind: "resolved", value: { kind: "present", value } });
  const dependency = (node: Node) => builder.componentIdentity(node, []);
  const iterations = createSourceProductionCache<Node, SourcePresence<SourceIteration>>({ dependency, produce: iteration });
  const generators = createSourceProductionCache<Node, SourcePresence<SourceGenerator>>({ dependency, produce: generator });
  const yields = createSourceProductionCache<Node, SourcePresence<SourceYield>>({ dependency, produce: yielded });

  function absent(node: Node): SourceTypeEvidence {
    return builder.evidence({ type: builder.intrinsic("void"), component: dependency(node), category: { kind: "known", category: "absence" },
      numeric: undefined, sum: undefined }, [], undefined, { kind: "finite", values: [{ kind: "absence" }] },
    { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [node] } });
  }
  function callableResult(value: SourceTypeEvidence): SourceProductionResult<SourceTypeEvidence> {
    const definition = builder.produceDefinition(value);
    if (definition.kind !== "resolved") return definition;
    const type = definition.value.type;
    if ((type.kind !== "shape" && type.kind !== "callable") || type.calls.length === 0) return sourceSemanticRefusal(value.component.root,
      "An original iterator protocol member requires its actual Source call signature.");
    const results = sourceProductionValues(type.calls.map(signature => builder.component(definition.value, { kind: "result", signature: signature.identity })));
    return results.kind !== "resolved" ? results : builder.join(value.component, "inferred", results.value, undefined);
  }
  function readProtocolMember(value: SourceTypeEvidence, role: "next" | "done" | "value"): SourceProductionResult<SourceTypeEvidence | undefined> {
    const selected = objects.protocolMember(value, role);
    if (selected.kind !== "resolved") return selected;
    if (selected.value.kind === "unavailable") return sourceSemanticRefusal(value.component.root,
      "An original iterator protocol requires its complete canonical Source member inventory.");
    if (selected.value.kind === "none") return { kind: "resolved", value: undefined };
    const read = selected.value.value.readType();
    return read.kind !== "resolved" ? read : { kind: "resolved", value: read.value.kind === "present" ? read.value.value : undefined };
  }
  function iteratorValues(iterator: SourceTypeEvidence): SourceProductionResult<SourceIterationValues> {
    const next = readProtocolMember(iterator, "next");
    if (next.kind !== "resolved") return next;
    if (next.value === undefined) return sourceSemanticRefusal(iterator.component.root, "An original iterator has no canonical readable next member.");
    const nextResult = callableResult(next.value);
    if (nextResult.kind !== "resolved") return nextResult;
    const awaited = produceSourceAwaitedType(context, nextResult.value);
    if (awaited.kind !== "resolved") return awaited;
    const yielded: SourceTypeEvidence[] = [], completed: SourceTypeEvidence[] = [];
    for (const arm of awaited.value.sum?.arms ?? [awaited.value]) {
      const done = readProtocolMember(arm, "done"), value = readProtocolMember(arm, "value");
      if (done.kind !== "resolved") return done;
      if (value.kind !== "resolved") return value;
      if (value.value === undefined) return sourceSemanticRefusal(arm.component.root, "An original iterator result requires its readable value component.");
      const domain = done.value === undefined ? undefined : builder.domain(done.value);
      if (domain?.kind !== "finite") return sourceSemanticRefusal(arm.component.root,
        "An original iterator result requires an exact Source completion discriminant, not a checked result type.");
      if (domain.values.every(value => value.kind === "boolean" && value.value)) completed.push(value.value);
      else if (domain.values.every(value => value.kind === "absence" || value.kind === "boolean" && !value.value)) yielded.push(value.value);
      else return sourceSemanticRefusal(arm.component.root, "An original iterator result mixes completed and yielded domains without an owned arm relation.");
    }
    const nextDefinition = builder.produceDefinition(next.value);
    if (nextDefinition.kind !== "resolved") return nextDefinition;
    const nextType = nextDefinition.value.type;
    if (nextType.kind !== "shape" && nextType.kind !== "callable") throw new Error("An original next protocol value must retain its callable descriptor.");
    const resumed: SourceTypeEvidence[] = [];
    for (const signature of nextType.calls) {
      if (signature.parameters.length === 0) { resumed.push(absent(signature.identity.declaration ?? iterator.component.root)); continue; }
      const parameter = builder.component(nextDefinition.value, { kind: "parameter", signature: signature.identity, index: 0 });
      if (parameter.kind === "refused") return parameter;
      for (const arm of parameter.value.sum?.arms ?? [parameter.value]) {
        const defined = builder.produceDefinition(arm);
        if (defined.kind !== "resolved") return defined;
        if (defined.value.type.kind === "tuple") {
          if (defined.value.type.elements.length === 0) continue;
          const value = builder.component(defined.value, { kind: "tuple-element", index: 0 });
          if (value.kind === "refused") return value;
          resumed.push(value.value);
        } else if (defined.value.type.kind === "array") {
          const value = builder.component(defined.value, { kind: "array-element" });
          if (value.kind === "refused") return value;
          resumed.push(value.value);
        } else resumed.push(defined.value);
      }
    }
    const joined = sourceProductionValues([builder.join(iterator.component, "inferred", yielded, undefined),
      builder.join(iterator.component, "inferred", completed, undefined), builder.join(iterator.component, "inferred", resumed, undefined)]);
    return joined.kind !== "resolved" ? joined : { kind: "resolved", value: { yielded: joined.value[0]!, completed: joined.value[1]!, resumed: joined.value[2]! } };
  }
  function bindingsFor(value: SourceTypeEvidence): SourceProductionResult<readonly SourceTypeBinding[]> {
    return produceSourceReceiverBindings(context, value, []);
  }
  function atomic(source: SourceTypeEvidence, occurrence: Node, mechanism: SourceInputAtomicIteration | undefined): SourceProductionResult<SourceProducedIteration> {
    const definition = builder.produceDefinition(source);
    if (definition.kind !== "resolved") return definition;
    const type = definition.value.type;
    const completion = absent(occurrence);
    if (type.kind === "array" || type.kind === "tuple") {
      const children = produceSourceSequenceElements(builder, definition.value, undefined);
      if (children.kind !== "resolved") return children;
      const element = builder.join(dependency(occurrence), "inferred", children.value, undefined);
      if (element.kind === "refused") return element;
      const index = builder.evidence({ type: builder.primitive("int64"), component: dependency(occurrence), category: { kind: "known", category: "number" },
        numeric: { producer: occurrence, kind: "operation", category: { kind: "known", category: "number" } }, sum: undefined },
      [], undefined, sourcePresentLiteralDomain, { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [occurrence] } });
      return { kind: "resolved", value: { element: element.value, completion,
        mechanism: { kind: mechanism?.kind === "array-like-index-adapted-to-async" ? mechanism.kind : "array-like-index", source, index } } };
    }
    if (type.kind === "string") return { kind: "resolved", value: { element: definition.value, completion,
      mechanism: { kind: mechanism?.kind === "string-code-unit-index-adapted-to-async" ? mechanism.kind : "string-code-unit-index", source } } };
    if (mechanism === undefined || !("protocol" in mechanism)) return sourceSemanticRefusal(occurrence,
      "This original iterable requires its factual iterator selection and solved Source protocol components.");
    const bindings = bindingsFor(source);
    if (bindings.kind !== "resolved") return bindings;
    const memberComponent = mechanism.protocol.iterator.read;
    if (memberComponent === undefined) return sourceSemanticRefusal(occurrence, "An original selected iterator has no readable member component.");
    const member = context.place(memberComponent, bindings.value);
    if (member.kind !== "resolved") return member;
    const calls = sourceProductionValues(mechanism.protocol.calls.map(original => context.signature(original, bindings.value, occurrence)));
    if (calls.kind !== "resolved") return calls;
    const iterator = builder.join(dependency(occurrence), "inferred", calls.value.map(call => call.result), undefined);
    if (iterator.kind === "refused") return iterator;
    const values = iteratorValues(iterator.value);
    if (values.kind !== "resolved") return values;
    return { kind: "resolved", value: { element: values.value.yielded, completion: values.value.completed,
      mechanism: { kind: mechanism.kind, source, protocol: { kind: "selected-iterator-member", source, values: values.value,
        declarations: mechanism.protocol.declarations, origins: mechanism.protocol.iterator.declarations.map(declaration => ({ kind: "declared", declaration })),
        member: member.value, iterator: iterator.value } } } };
  }
  function iterable(source: SourceTypeEvidence, occurrence: Node, mechanism: SourceInputIterationMechanism | undefined):
    SourceProductionResult<{ readonly element: SourceTypeEvidence; readonly completion: SourceTypeEvidence; readonly mechanism: SourceIterationMechanism }> {
    const arms = source.sum?.roles.map(role => role.value) ?? [source];
    const raw = mechanism?.kind === "union" ? mechanism.alternatives : mechanism === undefined || mechanism.kind === "property-key-enumeration" ? [] : [mechanism];
    if (raw.length > 1 && raw.length !== arms.length) return sourceSemanticRefusal(occurrence,
      "An original iterable union requires its exact original role-to-protocol witness vector.");
    const selected = sourceProductionValues(arms.map((arm, index) => atomic(arm, occurrence, raw[index] ?? raw[0])));
    if (selected.kind !== "resolved") return selected;
    const element = builder.join(dependency(occurrence), "inferred", selected.value.map(value => value.element), undefined);
    if (element.kind === "refused") return element;
    const completion = builder.join(dependency(occurrence), "inferred", selected.value.map(value => value.completion), undefined);
    if (completion.kind === "refused") return completion;
    return { kind: "resolved", value: { element: element.value, completion: completion.value,
      mechanism: selected.value.length === 1 ? selected.value[0]!.mechanism : { kind: "union", alternatives: selected.value.map(value => value.mechanism) } } };
  }
  function iteration(occurrence: Node): SourceProductionResult<SourcePresence<SourceIteration>> {
    const original = protocolInput.iteration(occurrence);
    if (original.kind === "none") return none;
    const value = context.value(original.value.operand, []);
    if (value.kind !== "resolved") return value;
    const source = { occurrence: original.value.operand, value: value.value };
    if (original.value.kind === "for-in") {
      const key = builder.evidence({ type: builder.string(), component: dependency(occurrence), category: { kind: "known", category: "string" },
        numeric: undefined, sum: undefined }, [], undefined, sourcePresentLiteralDomain,
      { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [occurrence] } });
      return present({ subject: { kind: "for-in", node: occurrence }, iterationKind: "for-in", source, element: key,
        key: { kind: "present", value: key }, completion: { kind: "none" }, mechanism: { kind: "property-key-enumeration" } });
    }
    const selected = iterable(value.value, occurrence, original.value.mechanism.kind === "present" ? original.value.mechanism.value : undefined);
    if (selected.kind !== "resolved") return selected;
    const common = { source, element: selected.value.element, key: { kind: "none" as const },
      completion: { kind: "present" as const, value: selected.value.completion }, mechanism: selected.value.mechanism };
    return original.value.kind === "spread" ? present({ ...common, subject: { kind: "spread", node: occurrence }, iterationKind: "spread" })
      : present({ ...common, subject: { kind: "for-of", node: occurrence }, iterationKind: original.value.kind });
  }
  function generator(declaration: Node): SourceProductionResult<SourcePresence<SourceGenerator>> {
    const original = protocolInput.generator(declaration);
    if (original.kind === "none") return none;
    const annotation = ast.typeNode(declaration);
    if (annotation === undefined) return sourceSemanticRefusal(declaration,
      "An inferred generator requires its solved yielded, resumed, and completion declaration application.", "TSONIC_LOCAL_TYPE_SIGNATURE");
    const result = reader.describeSyntax(annotation, []);
    if (result.kind !== "resolved") return result;
    const values = iteratorValues(result.value);
    if (values.kind !== "resolved") return values;
    const binding = original.value.returnTypeBinding;
    return present({ declaration, kind: original.value.kind, result: result.value, values: values.value,
      returnBinding: binding.kind === "none" ? binding : { kind: "present", value: { declaration: binding.value, value: values.value.completed } } });
  }
  function yielded(occurrence: Node): SourceProductionResult<SourcePresence<SourceYield>> {
    const original = protocolInput.yield(occurrence);
    if (original.kind === "none") return none;
    const owner = generators.query(original.value.generator, []);
    if (owner.kind !== "resolved") return owner;
    if (owner.value.kind === "none") return sourceSemanticRefusal(occurrence, "An original yield requires its canonical generator owner.");
    const generator = owner.value.value;
    if (original.value.kind === "value") {
      if (original.value.operand.kind === "none") return present({ occurrence, kind: "value", generator,
        yielded: generator.values.yielded, resumed: generator.values.resumed, operand: { kind: "none" } });
      const operand = context.value(original.value.operand.value, []);
      if (operand.kind !== "resolved") return operand;
      return present({ occurrence, kind: "value", generator, yielded: generator.values.yielded, resumed: generator.values.resumed,
        operand: { kind: "present", value: { occurrence: original.value.operand.value, value: operand.value } } });
    }
    if (original.value.operand.kind === "none") throw new Error("An original delegated yield requires its operand.");
    const source = context.value(original.value.operand.value, []);
    if (source.kind !== "resolved") return source;
    const selected = iterable(source.value, occurrence, original.value.mechanism.kind === "present" ? original.value.mechanism.value : undefined);
    if (selected.kind !== "resolved") return selected;
    return present({ occurrence, kind: "delegate", generator, yielded: selected.value.element, resumed: generator.values.resumed,
      operand: { occurrence: original.value.operand.value, value: source.value }, delegation: selected.value.mechanism,
      values: { yielded: selected.value.element, completed: selected.value.completion, resumed: generator.values.resumed } });
  }
  function settle<Value>(node: Node, result: SourceProductionResult<Value>): SourceResult<Value> {
    return result.kind === "pending" ? sourceSemanticRefusal(node, "This original protocol depends on an unresolved Source component.", "TSONIC_LOCAL_TYPE_SELF_REFERENCE") : result;
  }
  return Object.freeze({ iteration: node => iterations.query(node, []), generator: node => generators.query(node, []), yield: node => yields.query(node, []),
    element(source, occurrence) {
      const original = protocolInput.iteration(occurrence);
      const selected = iterable(source, occurrence, original.kind === "present" && original.value.mechanism.kind === "present" ? original.value.mechanism.value : undefined);
      return selected.kind !== "resolved" ? selected : { kind: "resolved", value: selected.value.element };
    }, facts: Object.freeze({ iteration: (node: Node) => settle(node, iterations.query(node, [])),
      generator: (node: Node) => settle(node, generators.query(node, [])), yield: (node: Node) => settle(node, yields.query(node, [])) }) });
}
