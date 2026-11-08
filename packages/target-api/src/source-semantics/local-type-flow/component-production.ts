import type { SourceInputCallCandidate } from "../../host-input/call-input.js";
import type { SourceInputComponent } from "../../host-input/identities.js";
import type { SourceAuthoredArgument, SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceEvidenceComponent, SourceProductionResult } from "../descriptor-contracts.js";
import { sourcePresentLiteralDomain } from "../../source-model/literals/domain.js";
import { produceSourceArgumentPlaces, produceSourceEffectiveArguments } from "./argument-places.js";
import { produceSourceCallableSignature, type SourceCallableProduction } from "./callable-production.js";
import { sourceProductionValues, sourceSemanticRefusal } from "./semantic-production.js";
import { sourceTypeFlowTypeSyntax } from "./value-syntax.js";

export function produceSourceApplicationComponent(context: SourceCallableProduction, original: SourceInputComponent,
  bindings: readonly SourceTypeBinding[], candidate: SourceInputCallCandidate): SourceProductionResult<SourceTypeEvidence> {
  const { input, builder, reader, objects } = context;
  input.assertComponent(original);
  const component = reader.componentIdentity(original);
  const first = original.path[0];
  let value: SourceProductionResult<SourceTypeEvidence>;
  let offset = 0;
  if (first?.kind === "argument-place" || first?.kind === "argument-tail" || first?.kind === "parameter-place" || first?.kind === "parameter-tail") {
    if (original.root !== candidate.application.invocation) throw new Error("An original call-place component must belong to its exact candidate invocation.");
    const arguments_: SourceAuthoredArgument[] = [];
    for (const argument of candidate.sourceArguments) {
      const value = context.value(argument.expression, bindings);
      if (value.kind !== "resolved") return value;
      arguments_.push({ occurrence: argument.occurrence, form: argument.form, operand: { kind: "resolved", value: { occurrence: argument.expression, value: value.value } } });
    }
    const expanded = produceSourceEffectiveArguments(builder, arguments_);
    if (expanded.kind !== "resolved") return expanded;
    if (first.kind === "argument-place") {
      const selected = expanded.value[first.index];
      if (selected === undefined) return sourceSemanticRefusal(original.root, "An original argument component lies outside its complete Source effective vector.");
      value = { kind: "resolved", value: selected.source };
    } else if (first.kind === "argument-tail") value = tuple(expanded.value.slice(first.start).map(argument => ({
      kind: argument.sourceForm === "spread-sequence" ? "rest" : "required", value: argument.source,
    })));
    else {
      const signature = produceSourceCallableSignature(context, candidate.application.signature, bindings, candidate.application.class?.declaration);
      if (signature.kind !== "resolved") return signature;
      const places = produceSourceArgumentPlaces({ builder, invocation: original.root, sourceArguments: arguments_, parameters: signature.value.parameters });
      if (places.kind !== "resolved") return places;
      if (places.value.kind === "not-applicable") return sourceSemanticRefusal(places.value.site, places.value.message, "TSONIC_LOCAL_TYPE_GENERIC");
      if (first.kind === "parameter-place") {
        const selected = places.value.values.find(place => place.effectiveArgumentIndex === first.index);
        if (selected === undefined) return sourceSemanticRefusal(original.root, "An original formal component lies outside its complete Source parameter-place vector.");
        value = { kind: "resolved", value: selected.destination };
      } else if (first.kind === "parameter-tail") {
        const start = first.start;
        value = tuple(places.value.values.filter(place => place.effectiveArgumentIndex >= start).map(place => ({
          kind: place.parameterForm === "rest-sequence" ? "rest" : "required", value: place.destination,
        })));
      } else throw new Error("An original formal component requires its exact place or tail selector.");
    }
    offset = 1;
  } else value = sourceTypeFlowTypeSyntax(context.ast, original.root)
    ? reader.describeSyntax(original.root, bindings) : context.value(original.root, bindings);
  if (value.kind !== "resolved") return value;
  for (let index = offset; index < original.path.length; index++) {
    const part = original.path[index]!;
    const selected = builder.produceDefinition(value.value);
    if (selected.kind !== "resolved") return selected;
    if (part.kind === "member") {
      const subject = { kind: "evidence" as const, value: selected.value };
      const pair = objects.correspondingDeclarations(subject, subject, "source", part.declaration);
      if (pair.kind !== "resolved") return pair;
      if (pair.value.kind !== "present" || pair.value.value.kind === "absent") return sourceSemanticRefusal(original.root,
        "An original member component requires its authenticated Source declaration and access-role inventory.");
      const row = pair.value.value.source;
      const member = part.access === "write" ? row.writeType() : row.readType();
      if (member.kind !== "resolved") return member;
      if (member.value.kind === "none") return sourceSemanticRefusal(original.root, "An original member component is unavailable in its exact access role.");
      value = { kind: "resolved", value: member.value.value };
    } else if (part.kind === "element" && selected.value.type.kind === "tuple") {
      const elements = sourceProductionValues(selected.value.type.elements.map((_, ordinal) => builder.component(selected.value, { kind: "tuple-element", index: ordinal })));
      value = elements.kind !== "resolved" ? elements : builder.join(component, "inferred", elements.value, original);
    } else value = builder.component(selected.value, component.path[index]!);
    if (value.kind !== "resolved") return value;
  }
  return builder.join(component, "inferred", [value.value], original);

  function tuple(elements: readonly { readonly kind: "required" | "rest"; readonly value: SourceTypeEvidence }[]): SourceProductionResult<SourceTypeEvidence> {
    const children: SourceEvidenceComponent[] = elements.map((element, index) => ({ selector: { kind: "tuple-element", index }, value: element.value }));
    return { kind: "resolved", value: builder.evidence({ type: builder.tuple(elements.map(element => ({ kind: element.kind, type: element.value.type })), false),
      component, category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined }, children, undefined,
    sourcePresentLiteralDomain, { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [original.root] } }) };
  }
}
