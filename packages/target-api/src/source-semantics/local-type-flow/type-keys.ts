import type { Node } from "@tsonic/tsts";
import type { SourceLiteralUnit } from "../../source-model/literals/domain.js";
import { sourceFiniteLiteralDomain, sourceOpenLiteralDomain } from "../../source-model/literals/domain.js";
import { sourceLiteralUnitKey } from "../../source-model/literals/key.js";
import type { SourceMemberKey, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import { produceSourceScalarLiteralDomain } from "./literal-domains.js";
import { sourceProductionValues, sourceSemanticRefusal, type SourceSemanticProduction, type SourceSyntaxProduction } from "./semantic-production.js";

export function sourceMemberKeyUnit(key: SourceMemberKey): SourceLiteralUnit {
  return key.kind === "unique-symbol" ? { kind: "symbol", declaration: key.declaration }
    : key.kind === "number" ? { kind: "number", value: key.value } : { kind: "string", value: key.value };
}

export function sourceKeyEvidence(context: SourceSemanticProduction, original: Node, unit: SourceLiteralUnit): SourceTypeEvidence {
  const { builder } = context;
  if (unit.kind !== "number" && unit.kind !== "string" && unit.kind !== "symbol") throw new Error("A Source property key requires an original property-key literal unit.");
  return builder.evidence({ type: unit.kind === "string" ? builder.string() : unit.kind === "number"
    ? builder.primitive("float64") : builder.intrinsic("symbol"), component: builder.componentIdentity(original, []),
  category: { kind: "known", category: unit.kind }, numeric: unit.kind === "number"
    ? { producer: original, kind: "literal", category: { kind: "known", category: "number" } } : undefined,
  sum: undefined }, [], undefined, sourceFiniteLiteralDomain([unit]));
}

export function sourceMemberKeyDomain(context: SourceSemanticProduction, member: {
  readonly name: string; readonly origin: import("../../public/source/contracts.js").SourceMemberOrigin;
}): SourceProductionResult<SourceLiteralUnit> {
  if (member.origin.kind === "mapped") return { kind: "resolved", value: sourceMemberKeyUnit(member.origin.key) };
  if (member.origin.kind === "class-prototype") return { kind: "resolved", value: { kind: "string", value: member.name } };
  const name = context.ast.name(member.origin.declaration);
  if (name === undefined) return sourceSemanticRefusal(member.origin.declaration, "An original member key has no original name component.");
  if (context.ast.is.IsIdentifier(name) || context.ast.is.IsStringLiteral(name)) return { kind: "resolved", value: { kind: "string", value: context.ast.text(name) } };
  const facts = context.input.describe(context.input.syntax(name));
  const domain = produceSourceScalarLiteralDomain(context.ast, name, facts);
  return domain.kind === "finite" && domain.values.length === 1 ? { kind: "resolved", value: domain.values[0]! }
    : sourceSemanticRefusal(name, "An original member key requires its exact finite literal or symbol component.");
}

export function produceSourceKeyOfType(context: SourceSyntaxProduction): SourceProductionResult<SourceTypeEvidence> {
  const { ast, builder, reader, syntax } = context;
  if (!ast.is.IsTypeOperatorNode(syntax) || ast.operatorKindName(syntax) !== "KindKeyOfKeyword") throw new Error("A Source keyof producer requires its original keyof TypeNode.");
  const operand = ast.as.AsTypeOperatorNode(syntax)?.Type;
  if (operand === undefined) return sourceSemanticRefusal(syntax, "An original keyof operand is missing.");
  const source = reader.describeSyntax(operand, context.bindings);
  if (source.kind !== "resolved") return source;
  if (builder.freeParameters(source.value).length > 0) return deferred(context, source.value);
  const definition = builder.definition(source.value);
  if (definition.kind === "refused") return definition;
  const type = definition.value.type;
  if (type.kind === "intrinsic" && (type.intrinsic === "never" || type.intrinsic === "unknown")) return builder.join(builder.componentIdentity(syntax, []), "authored", [], context.component);
  if (type.kind !== "shape") return sourceSemanticRefusal(syntax, "This keyof operand requires its original complete Source member and index domain.");
  const keys: SourceTypeEvidence[] = [];
  for (const member of type.members) {
    const unit = sourceMemberKeyDomain(context, member);
    if (unit.kind !== "resolved") return unit;
    keys.push(sourceKeyEvidence(context, syntax, unit.value));
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
  const definition = builder.definition(source);
  if (definition.kind === "refused") return definition;
  const value = definition.value, type = value.type, domain = builder.domain(key);
  if (type.kind === "array") {
    if (key.category.kind !== "known" || key.category.category !== "number") return sourceSemanticRefusal(key.component.root, "An array type index requires its original number key domain.");
    const element = builder.component(value, { kind: "array-element" });
    return element.kind === "refused" ? element : { kind: "resolved", value: [element.value] };
  }
  if (domain.kind !== "finite") {
    if (type.kind === "tuple" && key.category.kind === "known" && key.category.category === "number") {
      return sourceProductionValues(type.elements.map((_, index) => builder.component(value, { kind: "tuple-element", index })));
    }
    if (type.kind === "shape") {
      const index = type.indexes.find(index => index.key === key.type);
      if (index !== undefined) {
        const selected = builder.component(value, { kind: "index-value", declaration: index.declaration });
        return selected.kind === "refused" ? selected : { kind: "resolved", value: [selected.value] };
      }
    }
    return sourceSemanticRefusal(key.component.root, "An indexed type requires its original finite key or exact declared index domain.");
  }
  const values: SourceTypeEvidence[] = [];
  for (const unit of domain.values) {
    const name = sourceLiteralUnitKey(unit);
    if (name === undefined) return sourceSemanticRefusal(key.component.root, "This indexed type has a non-property key domain.");
    if (type.kind === "tuple" && name.kind === "name" && /^(0|[1-9][0-9]*)$/u.test(name.name)) {
      const ordinal = BigInt(name.name);
      if (ordinal >= BigInt(type.elements.length)) return sourceSemanticRefusal(key.component.root, "A tuple type index is outside its original element domain.");
      const selected = builder.component(value, { kind: "tuple-element", index: Number(ordinal) });
      if (selected.kind === "refused") return selected;
      values.push(selected.value);
      continue;
    }
    if (type.kind !== "shape") return sourceSemanticRefusal(source.component.root, "This indexed type requires its original Source member definition.");
    const matching = [];
    for (const member of type.members) {
      const original = sourceMemberKeyDomain(context, member);
      if (original.kind !== "resolved") return original;
      const memberName = sourceLiteralUnitKey(original.value);
      if (name.kind === "name" ? memberName?.kind === "name" && memberName.name === name.name
        : memberName?.kind === "symbol" && memberName.declaration === name.declaration) matching.push(member);
    }
    if (matching.length !== 1) return sourceSemanticRefusal(key.component.root, "An indexed type requires one exact original member for each selected key.");
    const selected = builder.component(value, { kind: "member", origin: matching[0]!.origin });
    if (selected.kind === "refused") return selected;
    values.push(selected.value);
  }
  return { kind: "resolved", value: Object.freeze(values) };
}

function deferred(context: SourceSyntaxProduction, source: SourceTypeEvidence): SourceProductionResult<SourceTypeEvidence> {
  const { builder, syntax } = context;
  const component = builder.componentIdentity(syntax, []);
  return { kind: "resolved", value: builder.evidence({ type: builder.projection(source.type, { kind: "component", component }),
    component, category: { kind: "dynamic" }, numeric: undefined, sum: undefined },
  [{ selector: { kind: "projection-source" }, value: source }], context.component, sourceOpenLiteralDomain) };
}
