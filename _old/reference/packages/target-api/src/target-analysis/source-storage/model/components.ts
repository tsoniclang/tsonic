import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceTypeEvidence } from "../../../public/source/contracts.js";
import { sourceLiteralUnitKey, type SourceLiteralKey } from "../../../source-model/literals/key.js";
import { Node_Expression } from "../../../source-navigation/ast.js";
import { sourceStorageOriginalSignature } from "./callable-heads.js";
import type { SourceStorageProjection, SourceStorageSubject } from "../../../source-model/storage.js";
import { sourceStorageIsMemberProjection } from "./subjects.js";
import type { SourceStorageProgram } from "./program.js";
import { sourceStorageValue } from "./program.js";

function aggregate(source: SourceStorageProgram, original: Node, values: readonly SourceTypeEvidence[]): SourceTypeEvidence | undefined {
  const selected = [...new Set(values)];
  for (const value of selected) source.facts.descriptors.assertEvidence(value);
  return selected.length === 0 ? undefined : selected.length === 1 ? selected[0]
    : sourceStorageValue(source.analysis.aggregate(original, Object.freeze(selected)));
}

export function sourceStoragePresentArms(source: SourceStorageProgram, value: SourceTypeEvidence): readonly SourceTypeEvidence[] {
  const pending = [value];
  const visited = new Set<SourceTypeEvidence>();
  const selected: SourceTypeEvidence[] = [];
  while (pending.length !== 0) {
    const current = pending.pop()!;
    source.work(current.component.root);
    source.facts.descriptors.assertEvidence(current);
    if (visited.has(current)) continue;
    visited.add(current);
    if (current.sum !== undefined) {
      pending.push(...current.sum.arms);
    } else if (current.type.kind === "optional") {
      pending.push(sourceStorageValue(source.facts.descriptors.component(current, { kind: "optional-value" })));
    } else if (current.type.kind !== "intrinsic" || current.type.intrinsic !== "absence" && current.type.intrinsic !== "never") {
      if (current.type.kind === "union") throw new Error("Storage requires the original registered Source sum arms.");
      selected.push(current);
    }
  }
  return Object.freeze(selected);
}

export function sourceStorageIsScalarType(value: SourceTypeEvidence, source: SourceStorageProgram): boolean {
  source.facts.descriptors.assertEvidence(value);
  const pending = [value.category];
  while (pending.length !== 0) {
    const category = pending.pop()!;
    if (category.kind === "choice") pending.push(...category.alternatives);
    else if (category.kind !== "known" || category.category === "object" || category.category === "function") return false;
  }
  return true;
}

export function sourcePresentStorageType(value: SourceTypeEvidence, source: SourceStorageProgram): SourceTypeEvidence | undefined {
  return aggregate(source, value.component.root, sourceStoragePresentArms(source, value));
}

export function sourceStorageAccessDeclarations(source: SourceStorageProgram, access: Node,
  mode: "read" | "write"): readonly Node[] | undefined {
  const selected = sourceStorageValue(source.facts.objects.use(access));
  if (mode === "read" ? selected.access === "write" : selected.access === "read") return Object.freeze([]);
  return mode === "read" ? selected.readDeclarations : selected.writeDeclarations;
}

export function sourceStorageDynamicMemberKey(source: SourceStorageProgram, access: Node): SourceLiteralKey | undefined {
  const selected = sourceStorageValue(source.facts.objects.use(access));
  if (selected.receiver.value.type.kind !== "intrinsic" || selected.receiver.value.type.intrinsic !== "any") return undefined;
  if (selected.key.kind === "present") {
    const domain = source.analysis.literalDomain(selected.key.value.value);
    return domain.kind === "finite" && domain.values.length === 1 ? sourceLiteralUnitKey(domain.values[0]!) : undefined;
  }
  const name = source.ast.name(access);
  if (name === undefined) return undefined;
  const key = sourceStorageValue(source.facts.objects.propertyName(name));
  return key.kind === "name" ? Object.freeze({ kind: "name", name: key.name })
    : key.kind === "symbol" || key.kind === "well-known-symbol" ? Object.freeze({ kind: "symbol", declaration: key.declaration }) : undefined;
}

export function sourceStorageDynamicMemberDeclarations(source: SourceStorageProgram, receiver: SourceStorageSubject,
  key: SourceLiteralKey, mode: "read" | "write", step: () => boolean):
  { readonly type: SourceTypeEvidence; readonly declarations: readonly Node[] } | undefined {
  const type = sourceStorageSubjectType(source, receiver);
  if (type === undefined) return undefined;
  const declarations = new Set<Node>();
  for (const arm of sourceStoragePresentArms(source, type)) {
    if (!step()) return undefined;
    const selected = sourceStorageValue(source.analysis.settle(source.analysis.objects.named(arm, key)));
    if (selected.kind !== "available") return undefined;
    for (const row of selected.members) {
      if (!step()) return undefined;
      const available = sourceStorageValue(source.analysis.settle(mode === "read" ? row.readType() : row.writeType()));
      if (available.kind === "none") return undefined;
      const origins = mode === "read" && row.read === "accessor" ? row.getters
        : mode === "write" && row.setters.length !== 0 ? row.setters : row.declarations;
      for (const declaration of origins) declarations.add(declaration);
    }
  }
  return declarations.size === 0 ? undefined : Object.freeze({ type, declarations: Object.freeze([...declarations]) });
}

function indexedElement(source: SourceStorageProgram, value: SourceTypeEvidence): SourceTypeEvidence | undefined {
  if (value.type.kind === "array") return sourceStorageValue(source.facts.descriptors.component(value, { kind: "array-element" }));
  if (value.type.kind === "tuple") {
    const selected: SourceTypeEvidence[] = [];
    for (const [index, element] of value.type.elements.entries()) {
      source.work(value.component.root);
      const child = sourceStorageValue(source.facts.descriptors.component(value, { kind: "tuple-element", index }));
      const type = element.kind === "rest" ? indexedElement(source, child) : child;
      if (type === undefined) return undefined;
      selected.push(type);
    }
    return aggregate(source, value.component.root, selected);
  }
  const members = sourceStorageValue(source.analysis.settle(source.analysis.inventory.members(value)));
  if (members.kind !== "complete") return undefined;
  const selected: SourceTypeEvidence[] = [];
  for (const index of members.indexes) {
    source.work(value.component.root);
    const key = sourceStorageValue(source.analysis.settle(index.keyType()));
    source.facts.descriptors.assertEvidence(key);
    if (key.category.kind !== "known" || key.category.category !== "number") continue;
    const read = sourceStorageValue(source.analysis.settle(index.readType()));
    if (read.kind === "none") return undefined;
    selected.push(read.value);
  }
  return aggregate(source, value.component.root, selected);
}

export function sourceStorageComponentType(value: SourceTypeEvidence, component: SourceStorageProjection,
  source: SourceStorageProgram): SourceTypeEvidence | undefined {
  const selected: SourceTypeEvidence[] = [];
  for (const arm of sourceStoragePresentArms(source, value)) {
    let child: SourceTypeEvidence | undefined;
    if (sourceStorageIsMemberProjection(component)) {
      const member = sourceStorageValue(source.facts.objects.correspondingMember(arm, arm, component.declaration, "read"));
      if (member.kind === "none" || member.value.kind !== "present" ||
        component.kind === "method-value" && member.value.source.read !== "method") return undefined;
      child = member.value.source.readType;
    } else if (component.kind === "tuple-element") {
      const element = arm.type.kind === "tuple" ? arm.type.elements[component.index] : undefined;
      if (element === undefined || element.kind === "rest") return undefined;
      child = sourceStorageValue(source.facts.descriptors.component(arm, { kind: "tuple-element", index: component.index }));
    } else child = indexedElement(source, arm);
    if (child === undefined) return undefined;
    selected.push(child);
  }
  return aggregate(source, value.component.root, selected);
}

export function sourceStorageOriginalComponents(from: SourceTypeEvidence, to: SourceTypeEvidence,
  component: SourceStorageProjection, source: SourceStorageProgram): Iterable<SourceStorageProjection> {
  source.facts.descriptors.assertEvidence(from);
  source.facts.descriptors.assertEvidence(to);
  if (sourceStorageIsMemberProjection(component)) {
    if (from === to) return [component];
    const member = sourceStorageValue(source.facts.objects.correspondingMember(from, to, component.declaration, "read"));
    if (member.kind !== "present" || member.value.kind !== "present") return [];
    const current = member.value;
    if (current.source.read === "unavailable" || (component.kind === "method-value" ? current.destination.read !== "method"
      : current.destination.read !== "property" && current.destination.read !== "accessor")) return [];
    const selected = current.source;
    return (selected.read === "accessor" ? selected.getters : selected.declarations).map(declaration =>
      Object.freeze({ kind: selected.read === "method" ? "method-value" as const : "member" as const, declaration }));
  }
  if (component.kind === "array-element") return sourceStorageComponents(from, source);
  return sourceStoragePresentArms(source, from).every(arm => arm.type.kind === "tuple") ? [component] : [{ kind: "array-element" }];
}

export function* sourceStorageComponents(value: SourceTypeEvidence, source: SourceStorageProgram): Iterable<SourceStorageProjection> {
  const indexes = new Set<number>();
  let indexed = false;
  for (const arm of sourceStoragePresentArms(source, value)) {
    if (arm.type.kind === "tuple") {
      for (const [index, element] of arm.type.elements.entries()) if (element.kind !== "rest") indexes.add(index);
    } else if (indexedElement(source, arm) !== undefined) indexed = true;
  }
  for (const index of indexes) yield Object.freeze({ kind: "tuple-element", index });
  if (indexed) yield Object.freeze({ kind: "array-element" });
}

export function sourceStorageArrayLiteralType(source: SourceStorageProgram, node: Node): SourceTypeEvidence {
  return sourceStorageValue(source.facts.values.type(node));
}

export function sourceStorageSubjectType(source: SourceStorageProgram, value: SourceStorageSubject,
  sourceFile?: SourceFile): SourceTypeEvidence | undefined {
  source.facts.navigation.callableRoles(value.node);
  if (sourceFile !== undefined && sourceFile !== source.ast.getSourceFile(value.node)) return undefined;
  let selected: SourceTypeEvidence | undefined;
  if (value.kind === "return") {
    const original = sourceStorageOriginalSignature(source, value.node,
      source.facts.navigation.callableRoles(value.node).body ? "body" : "signature");
    if (original === undefined) return undefined;
    const generator = sourceStorageValue(source.facts.protocols.generator(value.node));
    if (generator.kind === "present") selected = generator.value.values.completed;
    else {
      selected = sourceStorageValue(source.facts.descriptors.component(original.value,
        { kind: "result", signature: original.signature.identity }));
      if (source.ast.hasModifierKind(value.node, "async"))
        selected = sourceStorageValue(source.facts.descriptors.component(selected, { kind: "awaited" }));
    }
  } else if (value.kind === "receiver") {
    selected = sourceStorageReceiverType(source, value.node);
  } else if (value.kind === "input" || value.kind === "member") {
    selected = sourceStorageValue(source.facts.values.declaredSlot(value.node)).type;
  } else {
    const operand = source.ast.is.IsSpreadElement(value.node) ? Node_Expression(source.ast, value.node) : value.node;
    if (operand === undefined) return undefined;
    const declaration = source.ast.is.IsVariableDeclaration(operand) || source.ast.is.IsParameterDeclaration(operand) ||
      source.facts.navigation.callableRoles(operand).signature || source.ast.is.IsClassDeclaration(operand);
    selected = declaration ? sourceStorageValue(source.facts.values.declaredSlot(operand)).type
      : sourceStorageValue(source.facts.values.type(operand));
  }
  for (const component of value.projection) {
    if (selected === undefined) return undefined;
    selected = sourceStorageComponentType(selected, component, source);
  }
  return selected;
}

function sourceStorageReceiverType(source: SourceStorageProgram, node: Node): SourceTypeEvidence | undefined {
  const visited = new Set<Node>();
  while (!visited.has(node)) {
    source.work(node);
    visited.add(node);
    if (source.ast.is.IsClassDeclaration(node) || source.ast.is.IsClassExpression(node)) {
      const original = sourceStorageValue(source.analysis.settle(source.analysis.declared(node, Object.freeze([]))));
      source.facts.descriptors.assertEvidence(original.type);
      if (original.origin.kind !== "declaration" || original.origin.declaration !== node ||
        original.type.type.kind !== "declared" || original.type.type.declaration !== node)
        throw new Error("A class receiver template requires its exact original declared-instance owner.");
      return original.type;
    }
    const original = sourceStorageOriginalSignature(source, node,
      source.facts.navigation.callableRoles(node).body ? "body" : "signature");
    if (original?.signature.receiver !== undefined)
      return sourceStorageValue(source.facts.descriptors.component(original.value,
        { kind: "receiver", signature: original.signature.identity }));
    if (!source.ast.is.IsArrowFunction(node)) return undefined;
    const enclosing = source.analysis.enclosing(node, "body", original => { source.work(original); return true; });
    if (enclosing === undefined) return undefined;
    node = enclosing;
  }
  return undefined;
}

export function sourceIndexedStorageProjection(source: SourceStorageProgram, occurrence: Node): readonly SourceStorageProjection[] {
  const selected = sourceStorageValue(source.facts.objects.use(occurrence));
  const projections: SourceStorageProjection[] = [];
  for (const arm of selected.arms) {
    if (arm.kind !== "index") continue;
    if (arm.selection.kind === "tuple-element") projections.push(Object.freeze({ kind: "tuple-element", index: arm.selection.index }));
    else if (arm.selection.kind === "array-element") projections.push(Object.freeze({ kind: "array-element" }));
  }
  return Object.freeze(projections.filter((projection, index) => projections.findIndex(previous => previous.kind === projection.kind &&
    (previous.kind !== "tuple-element" || projection.kind === "tuple-element" && previous.index === projection.index)) === index));
}
