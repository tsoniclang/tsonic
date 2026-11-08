import type { Node } from "@tsonic/tsts";
import type { SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceEvidenceComponent } from "../descriptor-contracts.js";
import type { SourceConstructionMemberHistory, SourceMemberInventory, SourceMemberInventoryRow } from "../member-inventory.js";
import type { SourceLiteralKey } from "../../source-model/literals/key.js";
import { sourceLiteralDomainUnion, sourcePresentLiteralDomain } from "../../source-model/literals/domain.js";
import { Node_Initializer } from "../../source-navigation/ast.js";
import { indexSource, produceSourceMemberKey, sourceKeyEvidence } from "./type-keys.js";
import { produceSourceComponentLiteralDomain } from "./literal-domains.js";
import { produceSourceMemberInventory } from "./member-production.js";
import { sourceProductionValues, sourceSemanticRefusal } from "./semantic-production.js";
import type { SourceDeclarationProduction } from "./production-context.js";
import { substituteSourceEvidenceDetails } from "../descriptor-details.js";

export function produceSourceBindingSource(context: SourceDeclarationProduction, declaration: Node,
  bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence> {
  const { ast, reader } = context;
  const pattern = ast.parent(declaration);
  const owner = pattern === undefined ? undefined : ast.parent(pattern);
  if (owner === undefined) throw new Error("An original binding requires its actual source owner.");
  const annotation = ast.typeNode(owner);
  if (annotation !== undefined) return reader.describeSyntax(annotation, bindings);
  if (ast.is.IsBindingElement(owner)) return produceSourceBindingValue(context, owner, bindings, true);
  const initializer = Node_Initializer(ast, owner);
  if (initializer !== undefined) return context.value(initializer, bindings);
  const slot = context.context.declared(owner, bindings);
  return slot.kind !== "resolved" ? slot : { kind: "resolved", value: slot.value.type };
}

export function produceSourceBindingHistory(context: SourceDeclarationProduction, declaration: Node): SourceProductionResult<SourceConstructionMemberHistory> {
  const { ast, input } = context;
  input.assertNode(declaration);
  const pattern = ast.parent(declaration);
  const owner = pattern === undefined ? undefined : ast.parent(pattern);
  if (!ast.is.IsBindingElement(declaration) || ast.as.AsBindingElement(declaration)?.DotDotDotToken === undefined ||
    pattern === undefined || !ast.is.IsObjectBindingPattern(pattern) || owner === undefined)
    throw new Error("A rest construction history requires its exact original object-rest binding.");
  const excluded: SourceLiteralKey[] = [];
  for (const sibling of ast.elements(pattern)) {
    if (sibling === undefined) throw new Error("An original rest binding requires every preceding original binding key.");
    if (sibling === declaration) break;
    if (!ast.is.IsBindingElement(sibling)) throw new Error("An original object pattern retains its exact binding vector.");
    const name = ast.as.AsBindingElement(sibling)?.PropertyName ?? ast.name(sibling);
    if (name === undefined) throw new Error("An original rest exclusion requires its actual property name.");
    const selected = context.context.propertyName(name);
    if (selected.kind !== "resolved") return selected;
    if (selected.value.kind === "unproven") return sourceSemanticRefusal(name, selected.value.reason);
    excluded.push(selected.value.kind === "name" ? selected.value : { kind: "symbol", declaration: selected.value.declaration });
  }
  return { kind: "resolved", value: Object.freeze({ occurrence: declaration, steps: Object.freeze([Object.freeze({
    kind: "rest" as const, evaluation: declaration, operand: Node_Initializer(ast, owner) ?? owner,
    excluded: Object.freeze(excluded), source: () => produceSourceBindingSource(context, declaration, []) })]) }) };
}

export function produceSourceBindingValue(context: SourceDeclarationProduction, declaration: Node,
  bindings: readonly SourceTypeBinding[], includeDefault: boolean): SourceProductionResult<SourceTypeEvidence> {
  const { ast, builder, input } = context;
  if (!ast.is.IsBindingElement(declaration)) throw new Error("A Source binding projection requires its original binding element.");
  const binding = ast.as.AsBindingElement(declaration);
  const pattern = ast.parent(declaration);
  const owner = pattern === undefined ? undefined : ast.parent(pattern);
  if (binding === undefined || pattern === undefined || owner === undefined) throw new Error("An original binding requires its complete authored parent edge.");
  const original = produceSourceBindingSource(context, declaration, bindings);
  if (original.kind !== "resolved") return original;
  let value: SourceProductionResult<SourceTypeEvidence>;
  if (ast.is.IsArrayBindingPattern(pattern)) {
    const index = ast.elements(pattern).indexOf(declaration);
    if (index < 0) throw new Error("An original array binding must retain its exact original element ordinal.");
    const defined = builder.produceDefinition(original.value);
    if (defined.kind !== "resolved") return defined;
    if (binding.DotDotDotToken !== undefined) {
      if (defined.value.type.kind === "tuple") value = builder.component(defined.value, { kind: "tuple-slice", start: index, endCount: 0, readonly: false });
      else if (defined.value.type.kind === "array") {
        const element = builder.component(defined.value, { kind: "array-element" });
        if (element.kind === "refused") return element;
        const members = produceSourceMemberInventory(context, declaration, bindings, element.value);
        if (members.kind !== "resolved") return members;
        value = { kind: "resolved", value: builder.evidence({ type: builder.array(element.value.type, false),
          component: builder.componentIdentity(declaration, []), category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined },
        [{ selector: { kind: "array-element" }, value: element.value }], input.syntax(declaration), sourcePresentLiteralDomain,
        { members: members.value, origins: { kind: "complete", nodes: [declaration] } }) };
      } else return sourceSemanticRefusal(declaration, "An original array-rest binding requires a solved Source sequence.");
    } else {
      const selected = indexSource(context, defined.value, sourceKeyEvidence(context, declaration, { kind: "number", value: { kind: "integer", value: BigInt(index) } }));
      value = selected.kind !== "resolved" ? selected : builder.join(builder.componentIdentity(declaration, []), "inferred", selected.value, input.syntax(declaration));
    }
  } else if (ast.is.IsObjectBindingPattern(pattern)) {
    if (binding.DotDotDotToken !== undefined) value = objectRest();
    else {
      const name = binding.PropertyName ?? ast.name(declaration);
      if (name === undefined) throw new Error("An original property binding requires its authored key.");
      const key = context.context.propertyName(name);
      if (key.kind !== "resolved") return key;
      if (key.value.kind === "unproven") return sourceSemanticRefusal(name, key.value.reason);
      const unit = key.value.kind === "name" ? { kind: "string" as const, value: key.value.name }
        : { kind: "symbol" as const, declaration: key.value.declaration };
      const selected = indexSource(context, original.value, sourceKeyEvidence(context, name, unit));
      value = selected.kind !== "resolved" ? selected : builder.join(builder.componentIdentity(declaration, []), "inferred", selected.value, input.syntax(declaration));
    }
  } else throw new Error("An original binding element must belong to its actual array or object pattern.");
  if (value.kind !== "resolved" || !includeDefault || binding.Initializer === undefined) return value;
  const fallback = context.value(binding.Initializer, bindings);
  if (fallback.kind !== "resolved") return fallback;
  const defined = value.value.type.kind === "optional" ? builder.component(value.value, { kind: "optional-value" }) : value;
  if (defined.kind !== "resolved") return defined;
  const values = (defined.value.sum?.arms ?? [defined.value]).filter(arm => !(arm.type.kind === "intrinsic" && arm.type.intrinsic === "absence"));
  return builder.join(builder.componentIdentity(declaration, []), "inferred", [...values, fallback.value], input.syntax(declaration));

  function objectRest(): SourceProductionResult<SourceTypeEvidence> {
    const history = context.objects.construction(declaration, declaration, { domain: sourceLiteralDomainUnion,
      read: (original, values) => builder.join(builder.componentIdentity(original, []), "inferred", values, undefined) });
    if (history.kind !== "resolved") return history;
    if (history.value.kind !== "complete") return sourceSemanticRefusal(declaration, "An original object-rest binding requires a complete Source member inventory.");
    const inventory = substituteSourceEvidenceDetails({ members: history.value.inventory, origins: { kind: "complete", nodes: [declaration] } },
      value => builder.substitute(value, bindings), bindings, builder.substitute).members;
    if (inventory.kind !== "complete") throw new Error("An applied rest construction retains its complete canonical original inventory.");
    const selected = inventory.members;
    const values = sourceProductionValues(selected.map(row => row.readType()));
    if (values.kind !== "resolved") return values;
    const members: Extract<SourceTypeEvidence["type"], { kind: "shape" }>["members"][number][] = [];
    const children: SourceEvidenceComponent[] = [];
    const rows: SourceMemberInventoryRow[] = [];
    const indexes: Extract<SourceTypeEvidence["type"], { kind: "shape" }>["indexes"][number][] = [];
    const indexRows: Extract<SourceMemberInventory, { kind: "complete" }>["indexes"][number][] = [];
    for (const [index, row] of selected.entries()) {
      const value = values.value[index]!;
      if (value.kind === "none") continue;
      const origin = row.readOrigins[0];
      if (origin === undefined) return sourceSemanticRefusal(declaration, "A copied original Source member requires its exact readable origin.");
      const key = produceSourceMemberKey({ ast, input, literalDomain: (original, bindings) =>
        produceSourceComponentLiteralDomain({ ast, input, builder, value: context.value, component: context.place }, original, bindings) },
      origin, row.name, bindings);
      if (key.kind !== "resolved") return key;
      members.push({ name: row.name, key: key.value, origin, optional: row.optional, readonly: false, type: value.value.type });
      children.push({ selector: { kind: "member", origin }, value: value.value });
      rows.push(row);
    }
    for (const row of inventory.indexes) {
      const key = row.keyType();
      if (key.kind !== "resolved") return key;
      const read = row.readType();
      if (read.kind !== "resolved") return read;
      if (read.value.kind === "none") continue;
      for (const declaration of row.declarations) {
        indexes.push({ declaration, key: key.value.type, value: read.value.value.type, readonly: false });
        children.push({ selector: { kind: "index-key", declaration }, value: key.value },
          { selector: { kind: "index-value", declaration }, value: read.value.value });
      }
      indexRows.push({ ...row, readonly: false, writeType: row.readType });
    }
    return { kind: "resolved", value: builder.evidence({ type: builder.shape({ members, indexes, calls: [], constructs: [] }),
      component: builder.componentIdentity(declaration, []), category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined },
    children, input.syntax(declaration), sourcePresentLiteralDomain,
    { members: { kind: "complete", members: rows, indexes: indexRows }, origins: { kind: "complete", nodes: [declaration] } }) };
  }
}
