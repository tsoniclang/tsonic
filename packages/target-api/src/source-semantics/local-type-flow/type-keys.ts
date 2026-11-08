import type { Node } from "@tsonic/tsts";
import type { SourceLiteralUnit } from "../../source-model/literals/domain.js";
import { sourceFiniteLiteralDomain, sourceOpenLiteralDomain } from "../../source-model/literals/domain.js";
import { sourceLiteralUnitKey } from "../../source-model/literals/key.js";
import type { SourceMemberKey, SourceMemberOrigin, SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceInputComponent } from "../../host-input/identities.js";
import type { SourceLiteralDomain } from "../../source-model/literals/domain.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import { sourceKeyDomainContains } from "./key-domains.js";
import { sourceProductionValues, sourceSemanticRefusal, type SourceSemanticProduction, type SourceSyntaxProduction } from "./semantic-production.js";
import { produceSourceSequenceElements } from "./tuple-layout.js";

export function sourceMemberKeyUnit(key: SourceMemberKey): SourceLiteralUnit {
  return key.kind === "unique-symbol" ? { kind: "symbol", declaration: key.declaration }
    : key.kind === "number" ? { kind: "number", value: key.value } : { kind: "string", value: key.value };
}

export function sourceMemberKeyFromUnit(unit: SourceLiteralUnit): SourceMemberKey | undefined {
  return unit.kind === "symbol" ? { kind: "unique-symbol", declaration: unit.declaration }
    : unit.kind === "number" ? { kind: "number", value: unit.value }
    : unit.kind === "string" ? { kind: "string", value: unit.value } : undefined;
}

export function produceSourceMemberKey(context: Pick<SourceSemanticProduction, "ast" | "input"> & {
  literalDomain(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceLiteralDomain>;
}, origin: SourceMemberOrigin, name: string, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceMemberKey> {
  if (origin.kind === "mapped") return { kind: "resolved", value: origin.key };
  if (origin.kind === "class-prototype") return { kind: "resolved", value: { kind: "string", value: name } };
  const originalName = context.ast.name(origin.declaration);
  if (originalName === undefined) return sourceSemanticRefusal(origin.declaration,
    "An original Source member requires its exact original key.");
  const domain = context.literalDomain(context.input.syntax(originalName), bindings);
  if (domain.kind !== "resolved") return domain;
  const key = domain.value.kind === "finite" && domain.value.values.length === 1
    ? sourceMemberKeyFromUnit(domain.value.values[0]!) : undefined;
  return key === undefined ? sourceSemanticRefusal(originalName,
    "An original Source member requires its canonical literal or symbol key evidence.") : { kind: "resolved", value: key };
}

export function sourceKeyEvidence(context: SourceSemanticProduction, original: Node, unit: SourceLiteralUnit): SourceTypeEvidence {
  const { builder } = context;
  if (unit.kind !== "number" && unit.kind !== "string" && unit.kind !== "symbol") throw new Error("A Source property key requires an original property-key literal unit.");
  return builder.evidence({ type: unit.kind === "string" ? builder.string() : unit.kind === "number"
    ? builder.primitive("float64") : builder.intrinsic("symbol"), component: builder.componentIdentity(original, []),
  category: { kind: "known", category: unit.kind }, numeric: unit.kind === "number"
    ? { producer: original, kind: "literal", category: { kind: "known", category: "number" } } : undefined,
  sum: undefined }, [], undefined, sourceFiniteLiteralDomain([unit]),
  { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [original] } });
}

export function produceSourceKeyOfType(context: SourceSyntaxProduction): SourceProductionResult<SourceTypeEvidence> {
  const { ast, builder, reader, syntax } = context;
  if (!ast.is.IsTypeOperatorNode(syntax) || ast.operatorKindName(syntax) !== "KindKeyOfKeyword") throw new Error("A Source keyof producer requires its original keyof TypeNode.");
  const operand = ast.as.AsTypeOperatorNode(syntax)?.Type;
  if (operand === undefined) return sourceSemanticRefusal(syntax, "An original keyof operand is missing.");
  const source = reader.describeSyntax(operand, context.bindings);
  if (source.kind !== "resolved") return source;
  if (builder.freeParameters(source.value).length > 0) return deferred(context, source.value);
  const definition = builder.produceDefinition(source.value);
  if (definition.kind !== "resolved") return definition;
  const type = definition.value.type;
  if (type.kind === "intrinsic" && (type.intrinsic === "never" || type.intrinsic === "unknown")) return builder.join(builder.componentIdentity(syntax, []), "authored", [], context.component);
  if (type.kind !== "shape") return sourceSemanticRefusal(syntax, "This keyof operand requires its original complete Source member and index domain.");
  const keys: SourceTypeEvidence[] = [];
  for (const member of type.members) {
    keys.push(sourceKeyEvidence(context, syntax, sourceMemberKeyUnit(member.key)));
  }
  for (const index of type.indexes) {
    const value = builder.component(definition.value, { kind: "index-key", declaration: index.declaration });
    if (value.kind === "refused") return value;
    keys.push(value.value);
  }
  return builder.join(builder.componentIdentity(syntax, []), "authored", keys, context.component);
}

export function produceSourceIndexedType(context: SourceSyntaxProduction): SourceProductionResult<SourceTypeEvidence> {
  const { ast, builder, reader, syntax } = context;
  if (!ast.is.IsIndexedAccessTypeNode(syntax)) throw new Error("A Source indexed producer requires its original indexed TypeNode.");
  const indexed = ast.as.AsIndexedAccessTypeNode(syntax);
  if (indexed?.ObjectType === undefined || indexed.IndexType === undefined) return sourceSemanticRefusal(syntax, "An original indexed type component is missing.");
  const source = reader.describeSyntax(indexed.ObjectType, context.bindings);
  if (source.kind !== "resolved") return source;
  const key = reader.describeSyntax(indexed.IndexType, context.bindings);
  if (key.kind !== "resolved") return key;
  if (builder.freeParameters(source.value).length > 0 || builder.freeParameters(key.value).length > 0) return deferred(context, source.value);
  const selected = indexSource(context, source.value, key.value);
  return selected.kind !== "resolved" ? selected : builder.join(builder.componentIdentity(syntax, []), "authored", selected.value, context.component);
}

export function indexSource(context: SourceSemanticProduction, source: SourceTypeEvidence,
  key: SourceTypeEvidence): SourceProductionResult<readonly SourceTypeEvidence[]> {
  const { builder } = context;
  if (source.sum !== undefined) {
    const values = sourceProductionValues(source.sum.arms.map(arm => indexSource(context, arm, key)));
    return values.kind !== "resolved" ? values : { kind: "resolved", value: values.value.flat() };
  }
  if (key.sum !== undefined) {
    const values = sourceProductionValues(key.sum.arms.map(arm => indexSource(context, source, arm)));
    return values.kind !== "resolved" ? values : { kind: "resolved", value: values.value.flat() };
  }
  const definition = builder.produceDefinition(source);
  if (definition.kind !== "resolved") return definition;
  const value = definition.value, type = value.type, domain = builder.domain(key);
  if (type.kind === "array") {
    if (key.category.kind !== "known" || key.category.category !== "number") return sourceSemanticRefusal(key.component.root, "An array type index requires its original number key domain.");
    const element = builder.component(value, { kind: "array-element" });
    return element.kind === "refused" ? element : { kind: "resolved", value: [element.value] };
  }
  if (domain.kind !== "finite") {
    if (type.kind === "tuple" && key.category.kind === "known" && key.category.category === "number") {
      return produceSourceSequenceElements(builder, value, undefined);
    }
  }
  if (type.kind === "tuple" && domain.kind === "finite") {
    const values: SourceTypeEvidence[] = [];
    for (const unit of domain.values) {
      const name = sourceLiteralUnitKey(unit);
      if (name === undefined) return sourceSemanticRefusal(key.component.root, "This indexed type has a non-property key domain.");
      if (name.kind === "name" && /^(0|[1-9][0-9]*)$/u.test(name.name)) {
        const ordinal = BigInt(name.name);
        const selected = produceSourceSequenceElements(builder, value, ordinal);
        if (selected.kind !== "resolved") return selected;
        if (selected.value.length === 0) return sourceSemanticRefusal(key.component.root, "A tuple type index is outside its original element domain.");
        values.push(...selected.value);
        continue;
      }
      return sourceSemanticRefusal(key.component.root, "A tuple type index requires its exact original numeric ordinal.");
    }
    return { kind: "resolved", value: Object.freeze(values) };
  }
  if (domain.kind === "finite" && domain.values.length > 1) {
    const values = sourceProductionValues(domain.values.map(unit => indexSource(context, value, sourceKeyEvidence(context, key.component.root, unit))));
    return values.kind !== "resolved" ? values : { kind: "resolved", value: values.value.flat() };
  }
  const selected = context.objects.indexed(value, key, (destination, source) => sourceKeyDomainContains(builder, destination, source));
  if (selected.kind !== "resolved") return selected;
  if (selected.value.kind === "unavailable") return sourceSemanticRefusal(key.component.root,
    `This indexed type has no complete canonical Source member selection: ${selected.value.reason}.`);
  const values: SourceTypeEvidence[] = [];
  for (const row of [...selected.value.members, ...selected.value.indexes]) {
    const read = row.readType();
    if (read.kind !== "resolved") return read;
    if (read.value.kind === "none") return sourceSemanticRefusal(key.component.root, "An indexed type requires each selected original readable component.");
    values.push(read.value.value);
  }
  return { kind: "resolved", value: Object.freeze(values) };
}

function deferred(context: SourceSyntaxProduction, source: SourceTypeEvidence): SourceProductionResult<SourceTypeEvidence> {
  const { builder, syntax } = context;
  const component = builder.componentIdentity(syntax, []);
  return { kind: "resolved", value: builder.evidence({ type: builder.projection(source.type, { kind: "component", component }),
    component, category: { kind: "dynamic" }, numeric: undefined, sum: undefined },
  [{ selector: { kind: "projection-source" }, value: source }], context.component, sourceOpenLiteralDomain,
  { members: { kind: "definition" }, origins: { kind: "complete", nodes: [syntax] } }) };
}
