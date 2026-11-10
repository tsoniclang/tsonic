import type { Node } from "@tsonic/tsts";
import type { SourceLiteralUnit } from "../../source-model/literals/domain.js";
import { sourceFiniteLiteralDomain, sourceOpenLiteralDomain } from "../../source-model/literals/domain.js";
import { sourceLiteralUnitKey, sourceNumericKeyValueKey } from "../../source-model/literals/key.js";
import type { SourceIndexedAccess, SourceIndexedSelection, SourceMemberKey, SourceMemberOrigin, SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceInputComponent } from "../../host-input/identities.js";
import type { SourceLiteralDomain } from "../../source-model/literals/domain.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import { sourceKeyDomainContains } from "./key-domains.js";
import { sourceProductionValues, sourceSemanticRefusal } from "./semantic-production.js";
import type { SourceSemanticProduction, SourceSyntaxProduction } from "./production-context.js";
import { produceSourceSequenceSelections } from "./tuple-layout.js";
import type { SourceIndexedAccessTemplate } from "../descriptor-contracts.js";
import { composeSourceTypeBindings } from "../descriptor-details.js";
import { produceSourceStringCharacter } from "./member-value.js";
import { sourceTypeExpansionBudget } from "../type-expansion-budget.js";
import { failTargetCompilerResourceLimit } from "../../artifacts.js";

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
  const selected = produceSourceIndexedAccess(context, { component: builder.componentIdentity(syntax, []), original: context.component,
    receiver: source.value, key: key.value, bindings: context.bindings }, []);
  return selected.kind !== "resolved" ? selected : { kind: "resolved", value: selected.value.result };
}

export function indexSource(context: SourceSemanticProduction, source: SourceTypeEvidence,
  key: SourceTypeEvidence): SourceProductionResult<readonly SourceTypeEvidence[]> {
  const selected = selectSourceIndex(context, source, key, []);
  return selected.kind !== "resolved" ? selected : { kind: "resolved", value: selected.value.values };
}

export function produceSourceIndexedAccess(context: SourceSemanticProduction, template: SourceIndexedAccessTemplate,
  bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceIndexedAccess> {
  const { builder } = context;
  const environment = composeSourceTypeBindings(template.bindings, bindings, builder.substitute);
  if (environment.kind !== "resolved") return environment;
  const source = builder.substitute(template.receiver, environment.value);
  if (source.kind !== "resolved") return source;
  const key = builder.substitute(template.key, environment.value);
  if (key.kind !== "resolved") return key;
  const selected = selectSourceIndex(context, source.value, key.value, environment.value);
  if (selected.kind !== "resolved") return selected;
  const joined = builder.join(template.component, "authored", selected.value.values, template.original);
  if (joined.kind !== "resolved") return joined;
  const result = builder.withBindings(joined.value, environment.value);
  if (result.kind !== "resolved") return result;
  builder.registerIndexedAccess(result.value, { ...template, receiver: source.value, key: key.value, bindings: environment.value });
  return { kind: "resolved", value: Object.freeze({ receiver: source.value, key: key.value,
    typeBindings: environment.value, selections: selected.value.selections, result: result.value }) };
}

function selectSourceIndex(context: SourceSemanticProduction, source: SourceTypeEvidence,
  key: SourceTypeEvidence, bindings: readonly SourceTypeBinding[]): SourceProductionResult<{
    readonly selections: readonly SourceIndexedSelection[]; readonly values: readonly SourceTypeEvidence[];
  }> {
  const { builder } = context;
  let work = 0;
  const selections: SourceIndexedSelection[] = [];
  const values: SourceTypeEvidence[] = [];
  function charge(count = 1): void {
    if (count > sourceTypeExpansionBudget.types - work) failTargetCompilerResourceLimit("tsonic", "Source type expansion", "types",
      sourceTypeExpansionBudget.types, key.component.root);
    work += count;
  }
  function absence(original: SourceTypeEvidence): SourceTypeEvidence {
    charge();
    return builder.evidence({ type: builder.intrinsic("absence"), component: original.component,
      category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined }, [], undefined,
    { kind: "finite", values: [{ kind: "absence" }] },
    { members: { kind: "unavailable" }, origins: builder.sourceOriginSubjects(original) });
  }
  function select(source: SourceTypeEvidence, key: SourceTypeEvidence, depth: number): SourceProductionResult<true> {
    builder.assertEvidence(source);
    builder.assertEvidence(key);
    charge();
    if (depth >= sourceTypeExpansionBudget.depth) failTargetCompilerResourceLimit("tsonic", "Source type expansion", "depth",
      sourceTypeExpansionBudget.depth, key.component.root);
    if (source.sum !== undefined || key.sum !== undefined) {
      for (const arm of source.sum?.arms ?? [source]) for (const keyArm of key.sum?.arms ?? [key]) {
        const selected = select(arm, keyArm, depth + 1);
        if (selected.kind !== "resolved") return selected;
      }
      return { kind: "resolved", value: true };
    }
  const definition = builder.produceDefinition(source);
  if (definition.kind !== "resolved") return definition;
  const value = definition.value, type = value.type, domain = builder.domain(key);
  if (type.kind === "array") {
    if (key.category.kind !== "known" || key.category.category !== "number") return sourceSemanticRefusal(key.component.root, "An array type index requires its original number key domain.");
    const element = builder.component(value, { kind: "array-element" });
    if (element.kind !== "resolved") return element;
    charge();
    selections.push(Object.freeze({ kind: "component", receiver: value, selector: Object.freeze({ kind: "array-element" }), readType: element.value }));
    values.push(element.value);
    return { kind: "resolved", value: true };
  }
  if (type.kind === "string") {
    if (key.category.kind !== "known" || key.category.category !== "number") return sourceSemanticRefusal(key.component.root,
      "A Source string character index requires its canonical number key domain.");
    const character = produceSourceStringCharacter(context, key.component.root, value);
    if (character.kind !== "resolved") return character;
    charge();
    selections.push(Object.freeze({ kind: "string-character", receiver: value, readType: character.value }));
    values.push(character.value);
    return { kind: "resolved", value: true };
  }
  if (type.kind === "tuple") {
    const ordinals: (bigint | undefined)[] = [];
    if (domain.kind !== "finite" && key.category.kind === "known" && key.category.category === "number") ordinals.push(undefined);
    else if (domain.kind === "finite") for (const unit of domain.values) {
      charge();
      const name = sourceLiteralUnitKey(unit);
      if (name?.kind !== "name" || !/^(0|[1-9][0-9]*)$/u.test(name.name)) return sourceSemanticRefusal(key.component.root,
        "A tuple type index requires its exact original numeric ordinal.");
      ordinals.push(BigInt(name.name));
    }
    else return sourceSemanticRefusal(key.component.root, "A tuple type index requires its canonical number key domain.");
    for (const ordinal of ordinals) {
      const selected = produceSourceSequenceSelections(builder, value, ordinal);
      if (selected.kind !== "resolved") return selected;
      if (selected.value.length === 0) return sourceSemanticRefusal(key.component.root, "A tuple type index is outside its original element domain.");
      for (const slot of selected.value) {
        charge();
        selections.push(Object.freeze({ kind: "component", receiver: slot.receiver, selector: slot.selector, readType: slot.value }));
        values.push(slot.value);
        if (slot.optional) values.push(absence(slot.value));
      }
    }
    return { kind: "resolved", value: true };
  }
  if (domain.kind === "finite" && domain.values.length > 1) {
    for (const unit of domain.values) {
      charge();
      const selected = select(value, sourceKeyEvidence(context, key.component.root, unit), depth + 1);
      if (selected.kind !== "resolved") return selected;
    }
    return { kind: "resolved", value: true };
  }
  const selected = context.objects.indexed(value, key, (destination, source) => sourceKeyDomainContains(builder, destination, source));
  if (selected.kind !== "resolved") return selected;
  if (selected.value.kind === "unavailable") return sourceSemanticRefusal(key.component.root,
    `This indexed type has no complete canonical Source member selection: ${selected.value.reason}.`);
  for (const row of selected.value.members) {
    charge();
    const read = row.readType();
    if (read.kind !== "resolved") return read;
    if (read.value.kind === "none") return sourceSemanticRefusal(key.component.root, "An indexed type requires each selected original readable component.");
    if (row.readOrigins.length === 0) return sourceSemanticRefusal(key.component.root, "An indexed member requires all of its genuine original read origins.");
    const keys: SourceMemberKey[] = [];
    for (const origin of row.readOrigins) {
      charge();
      const selectedKey = produceSourceMemberKey({ ast: context.ast, input: context.input, literalDomain: context.reader.literalDomain }, origin, row.name, bindings);
      if (selectedKey.kind !== "resolved") return selectedKey;
      const same = (candidate: SourceMemberKey): boolean => candidate.kind === "unique-symbol" ? selectedKey.value.kind === "unique-symbol" && candidate.declaration === selectedKey.value.declaration
        : candidate.kind === "string" ? selectedKey.value.kind === "string" && candidate.value === selectedKey.value.value
        : selectedKey.value.kind === "number" && sourceNumericKeyValueKey(candidate.value) === sourceNumericKeyValueKey(selectedKey.value.value);
      if (!keys.some(same)) keys.push(selectedKey.value);
    }
    const readDeclarations = row.read === "accessor" ? row.getters : row.declarations;
    for (const selectedKey of keys) {
      charge(row.origins.length + row.readOrigins.length + readDeclarations.length + row.declarations.length + 1);
      selections.push(Object.freeze({ kind: "member", receiver: value, key: selectedKey,
        origins: Object.freeze([...row.origins]), readOrigins: Object.freeze([...row.readOrigins]),
        readDeclarations: Object.freeze([...readDeclarations]), selectedDeclarations: Object.freeze([...row.declarations]),
        optional: row.optional, readType: read.value.value }));
    }
    values.push(read.value.value);
    if (row.optional) values.push(absence(read.value.value));
  }
  for (const row of selected.value.indexes) {
    charge(row.declarations.length + 1);
    const read = row.readType();
    if (read.kind !== "resolved") return read;
    if (read.value.kind === "none") return sourceSemanticRefusal(key.component.root, "An indexed type requires each selected original readable index component.");
    selections.push(Object.freeze({ kind: "index", receiver: value, declarations: Object.freeze([...row.declarations]),
      readonly: row.readonly, readType: read.value.value }));
    values.push(read.value.value);
  }
  return { kind: "resolved", value: true };
  }
  const selected = select(source, key, 0);
  return selected.kind !== "resolved" ? selected : { kind: "resolved", value: Object.freeze({
    selections: Object.freeze(selections), values: Object.freeze(values) }) };
}

function deferred(context: SourceSyntaxProduction, source: SourceTypeEvidence): SourceProductionResult<SourceTypeEvidence> {
  const { builder, syntax } = context;
  const component = builder.componentIdentity(syntax, []);
  return { kind: "resolved", value: builder.evidence({ type: builder.projection(source.type, { kind: "component", component }),
    component, category: { kind: "dynamic" }, numeric: undefined, sum: undefined },
  [{ selector: { kind: "projection-source" }, value: source }], context.component, sourceOpenLiteralDomain,
  { members: { kind: "definition" }, origins: { kind: "complete", nodes: [syntax] } }) };
}
