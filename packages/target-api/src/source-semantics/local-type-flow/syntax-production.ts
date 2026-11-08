import type { SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import { sourceFiniteLiteralDomain, sourceOpenLiteralDomain } from "../../source-model/literals/domain.js";
import { sourceLiteralUnitKey } from "../../source-model/literals/key.js";
import { produceSourceConditionalType } from "./conditional-descriptors.js";
import { produceSourceMappedType } from "./mapped-types.js";
import { produceSourceIndexedType, produceSourceKeyOfType, sourceKeyEvidence } from "./type-keys.js";
import { sourceEvidenceExtends } from "./evidence-relations.js";
import { sourceProductionValues, sourceSemanticRefusal, type SourceSyntaxProduction } from "./semantic-production.js";

export function produceSourceSyntaxType(context: SourceSyntaxProduction): SourceProductionResult<SourceTypeEvidence> {
  const { ast, syntax } = context;
  if (ast.is.IsConditionalTypeNode(syntax)) return produceSourceConditionalType(context);
  if (ast.is.IsMappedTypeNode(syntax)) return produceSourceMappedType(context);
  if (ast.is.IsIndexedAccessTypeNode(syntax)) return produceSourceIndexedType(context);
  if (ast.is.IsTypeOperatorNode(syntax) && ast.operatorKindName(syntax) === "KindKeyOfKeyword") return produceSourceKeyOfType(context);
  if (ast.is.IsTemplateLiteralTypeNode(syntax)) return template(context);
  if (ast.is.IsIntersectionTypeNode(syntax)) return intersection(context);
  throw new Error("A Source syntax production request requires its original canonical semantic syntax kind.");
}

function defer(context: SourceSyntaxProduction, source: SourceTypeEvidence): SourceProductionResult<SourceTypeEvidence> {
  const { builder, syntax } = context;
  const component = builder.componentIdentity(syntax, []);
  return { kind: "resolved", value: builder.evidence({ type: builder.projection(source.type, { kind: "component", component }),
    component, category: { kind: "dynamic" }, numeric: undefined, sum: undefined },
  [{ selector: { kind: "projection-source" }, value: source }], context.component, sourceOpenLiteralDomain) };
}

function template(context: SourceSyntaxProduction): SourceProductionResult<SourceTypeEvidence> {
  const { ast, syntax, builder, reader } = context;
  if (!ast.is.IsTemplateLiteralTypeNode(syntax)) throw new Error("A Source template producer requires its actual template TypeNode.");
  const node = ast.as.AsTemplateLiteralTypeNode(syntax);
  if (node?.Head === undefined) return sourceSemanticRefusal(syntax, "An original template type requires its head component.");
  let texts: string[] = [ast.text(node.Head)];
  for (const part of node.TemplateSpans?.Nodes ?? []) {
    if (part === undefined || !ast.is.IsTemplateLiteralTypeSpan(part)) return sourceSemanticRefusal(syntax, "An original template type span is missing.");
    const span = ast.as.AsTemplateLiteralTypeSpan(part);
    if (span?.Type === undefined || span.Literal === undefined) return sourceSemanticRefusal(part, "An original template type requires both interpolation and suffix components.");
    const selected = reader.describeSyntax(span.Type, context.bindings);
    if (selected.kind !== "resolved") return selected;
    if (builder.freeParameters(selected.value).length > 0) return defer(context, selected.value);
    const domain = builder.domain(selected.value);
    if (domain.kind === "unreachable") return builder.join(builder.componentIdentity(syntax, []), "authored", [], context.component);
    if (domain.kind !== "finite") return { kind: "resolved", value: builder.evidence({ type: builder.string(), component: builder.componentIdentity(syntax, []),
      category: { kind: "known", category: "string" }, numeric: undefined, sum: undefined }, [], context.component, sourceOpenLiteralDomain) };
    const units: string[] = [];
    for (const value of domain.values) {
      const key = sourceLiteralUnitKey(value);
      const text = key?.kind === "name" ? key.name : value.kind === "boolean" ? String(value.value)
        : value.kind === "bigint" ? value.value.toString() : undefined;
      if (text === undefined) return sourceSemanticRefusal(part, "This template interpolation has no exact Source text domain.");
      units.push(text);
    }
    const suffix = ast.text(span.Literal);
    texts = texts.flatMap(prefix => units.map(unit => prefix + unit + suffix));
  }
  return { kind: "resolved", value: builder.evidence({ type: builder.string(), component: builder.componentIdentity(syntax, []),
    category: { kind: "known", category: "string" }, numeric: undefined, sum: undefined }, [], context.component,
  sourceFiniteLiteralDomain(texts.map(value => ({ kind: "string", value })))) };
}

function intersection(context: SourceSyntaxProduction): SourceProductionResult<SourceTypeEvidence> {
  const { ast, syntax, builder, reader } = context;
  const selected = sourceProductionValues(ast.children(syntax).map(child => child === undefined
    ? sourceSemanticRefusal(syntax, "An original intersection component is missing.") : reader.describeSyntax(child, context.bindings)));
  if (selected.kind !== "resolved") return selected;
  const finite = selected.value.find(value => builder.domain(value).kind === "finite");
  if (finite !== undefined) {
    const domain = builder.domain(finite);
    if (domain.kind !== "finite") throw new Error("A selected finite intersection must retain its exact domain.");
    const values: SourceTypeEvidence[] = [];
    for (const unit of domain.values) {
      if (unit.kind !== "number" && unit.kind !== "string" && unit.kind !== "symbol") return sourceSemanticRefusal(syntax,
        "This finite intersection requires its original supported literal category.");
      const value = sourceKeyEvidence(context, syntax, unit);
      let admitted = true;
      for (const required of selected.value) {
        const relation = sourceEvidenceExtends(context, value, required);
        if (relation.kind !== "resolved") return relation;
        if (relation.value === "deferred") return defer(context, required);
        admitted &&= relation.value === "yes";
      }
      if (admitted) values.push(value);
    }
    return builder.join(builder.componentIdentity(syntax, []), "authored", values, context.component);
  }
  for (const value of selected.value) if (builder.freeParameters(value).length > 0) return defer(context, value);
  const first = selected.value[0];
  if (first === undefined) return sourceSemanticRefusal(syntax, "An original intersection must retain its operand vector.");
  if (selected.value.every(value => value.type === first.type)) return builder.join(builder.componentIdentity(syntax, []), "authored", [first], context.component);
  return sourceSemanticRefusal(syntax, "This intersection requires a single complete Source structural composition proof.");
}
