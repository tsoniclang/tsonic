import type { NodeId, SourceNodeRef } from "../ids/contract.js";
import type { CallExpression, CheckedLayoutConstructionOf, CheckedLayoutGeometryOperands, CheckedLayoutRoleOf, CheckedLayoutSource, CheckedLayoutSourceDeps, CheckedPhase, Expression, HirModuleBinding, HirNode,
  LayoutDescriptorKind, LayoutDescriptorOperand, LayoutDescriptorSyntaxFault, Phase, ReadLayoutDescriptor, ReadLayoutSelector, ResolveCheckedLayout,
  ResolveCheckedLayoutAlias } from "./contract.js";

const geometryNames: readonly LayoutDescriptorOperand[] = ["datalayout", "bytesize", "bytealignment", "stride"];
function* descriptorNames(kind: LayoutDescriptorKind): Generator<LayoutDescriptorOperand> {
  if (kind === "field") {
    yield "select";
    yield "byteoffset";
    yield "bytealignment";
    yield "fieldlayout";
    return;
  }
  yield* geometryNames;
  if (kind === "value") yield "fields";
  else {
    yield "elementlayout";
    yield "length";
  }
}

function invalidDescriptor(fault: LayoutDescriptorSyntaxFault): { readonly kind: "invalid"; readonly fault: LayoutDescriptorSyntaxFault } {
  return { kind: "invalid", fault };
}

function invalidSelector(at: NodeId): { readonly kind: "invalid"; readonly fault: { readonly kind: "invalid-selector"; readonly at: NodeId } } {
  return { kind: "invalid", fault: { kind: "invalid-selector", at } };
}

export const readLayoutSelector: ReadLayoutSelector = (input, admit) => {
  let stop = admit(1, 0);
  if (stop !== null) return { kind: "resource-stop", stop };
  if (input.kind !== "ArrowFunction") return invalidSelector(input.id);
  stop = admit(5, 0);
  if (stop !== null) return { kind: "resource-stop", stop };
  if (input.modifiers !== null || input.typeParameters !== null || input.asteriskToken !== null || input.fullSignature !== null)
    return invalidSelector(input.id);
  const formals = input.parameters.nodes;
  if (formals.length !== 1) return invalidSelector(input.id);
  stop = admit(6, 0);
  if (stop !== null) return { kind: "resource-stop", stop };
  const formal = formals[0];
  if (formal === undefined || formal.name.kind !== "Identifier" || formal.modifiers !== null || formal.dotDotDotToken !== null
    || formal.initializer !== null || formal.questionToken !== null) return invalidSelector(formal?.id ?? input.id);
  stop = admit(1, 0);
  if (stop !== null) return { kind: "resource-stop", stop };
  const access = input.body;
  if (access?.kind !== "PropertyAccessExpression") return invalidSelector(access?.id ?? input.id);
  stop = admit(3, 1);
  if (stop !== null) return { kind: "resource-stop", stop };
  if (access.questionDotToken !== null || access.name.kind !== "Identifier") return invalidSelector(access.id);
  const receiver = access.expression;
  return receiver.kind === "Identifier" ? { kind: "complete", value: { arrow: input, formal, access, receiver } }
    : invalidSelector(receiver.id);
};

export const readLayoutDescriptor: ReadLayoutDescriptor = <P extends Phase, Stop extends object>(
  input: Expression<P>, kind: LayoutDescriptorKind, admit: (work: number, created: number) => Stop | null,
  retainField: (operand: Expression<P>) => Stop | null,
) => {
  const initial = admit(1, 0);
  if (initial !== null) return { kind: "resource-stop", stop: initial };
  if (input.kind !== "ObjectLiteralExpression") return invalidDescriptor({ kind: "not-inline", at: input.id });
  const reserve = admit(1, 1);
  if (reserve !== null) return { kind: "resource-stop", stop: reserve };
  const fields = input.properties.nodes;
  const found = new Map<LayoutDescriptorOperand, Expression<P>>();
  for (let position = 0; position < fields.length; position += 1) {
    const at = admit(1, 0);
    if (at !== null) return { kind: "resource-stop", stop: at };
    const property = fields[position];
    if (property === undefined) return invalidDescriptor({ kind: "invalid-property", at: input.id });
    if (property.kind !== "PropertyAssignment" && property.kind !== "ShorthandPropertyAssignment")
      return invalidDescriptor({ kind: "invalid-property", at: property.id });
    const name = property.name;
    if (name.kind !== "Identifier" && name.kind !== "StringLiteral")
      return invalidDescriptor({ kind: "invalid-property", at: property.id });
    const text = name.text;
    let key: LayoutDescriptorOperand | undefined;
    for (const candidate of descriptorNames(kind)) {
      const compare = admit(1, 0);
      if (compare !== null) return { kind: "resource-stop", stop: compare };
      if (text !== candidate) continue;
      key = candidate;
      break;
    }
    if (key === undefined) return invalidDescriptor({ kind: "unknown-property", at: name.id, name: text });
    if (found.has(key)) return invalidDescriptor({ kind: "duplicate-property", at: name.id, name: key });
    const read = admit(1, 1);
    if (read !== null) return { kind: "resource-stop", stop: read };
    if (property.modifiers !== null || property.postfixToken !== null || property.type !== null)
      return invalidDescriptor({ kind: "invalid-property", at: property.id });
    if (property.kind === "PropertyAssignment") found.set(key, property.initializer);
    else {
      if (name.kind !== "Identifier" || property.objectAssignmentInitializer !== null || property.equalsToken !== null)
        return invalidDescriptor({ kind: "invalid-property", at: property.id });
      found.set(key, name);
    }
  }
  for (const name of descriptorNames(kind)) {
    const at = admit(1, 0);
    if (at !== null) return { kind: "resource-stop", stop: at };
    if (!found.has(name)) return invalidDescriptor({ kind: "missing-property", at: input.id, name });
  }
  const lookup = (name: LayoutDescriptorOperand): Expression<P> => {
    const value = found.get(name);
    if (value === undefined) throw new Error("A completed layout descriptor retains every required operand.");
    return value;
  };
  const entries = kind === "value" ? lookup("fields") : null;
  if (entries !== null && entries.kind !== "ArrayLiteralExpression")
    return invalidDescriptor({ kind: "not-inline-fields", at: entries.id });
  if (entries !== null) {
    const at = admit(1, 0);
    if (at !== null) return { kind: "resource-stop", stop: at };
    const list = entries.elements.nodes;
    for (let position = 0; position < list.length; position += 1) {
      const at = admit(1, 0);
      if (at !== null) return { kind: "resource-stop", stop: at };
      const field = list[position];
      if (field === undefined || field.kind === "OmittedExpression" || field.kind === "SpreadElement")
        return invalidDescriptor({ kind: "invalid-field-entry", at: field?.id ?? entries.id });
      const retained = retainField(field);
      if (retained !== null) return { kind: "resource-stop", stop: retained };
    }
  }
  const result = admit(found.size, 1);
  if (result !== null) return { kind: "resource-stop", stop: result };
  if (kind === "field") {
    const select = readLayoutSelector<P, Stop>(lookup("select"), admit);
    return select.kind === "complete" ? { kind: "complete", value: { kind, descriptor: input, select: select.value,
      byteoffset: lookup("byteoffset"), bytealignment: lookup("bytealignment"), fieldlayout: lookup("fieldlayout") } } : select;
  }
  if (kind === "array") return { kind: "complete", value: {
    kind, descriptor: input, datalayout: lookup("datalayout"), bytesize: lookup("bytesize"), bytealignment: lookup("bytealignment"),
    stride: lookup("stride"), elementlayout: lookup("elementlayout"), length: lookup("length"),
  } };
  if (entries === null) throw new Error("A completed value descriptor retains its actual field array.");
  return { kind: "complete", value: { kind, descriptor: input, datalayout: lookup("datalayout"), bytesize: lookup("bytesize"),
    bytealignment: lookup("bytealignment"), stride: lookup("stride"), fields: entries } };
};

export const checkedLayoutConstructionOf: CheckedLayoutConstructionOf = node => {
  if (node.kind !== "CallExpression") return null;
  const capture = node.tsonic.memory;
  return capture.kind === "available" && capture.value !== null && capture.value.kind !== "data-layout" ? capture.value : null;
};

export const checkedLayoutRoleOf: CheckedLayoutRoleOf = call => {
  const observation = call.tsonic.observation;
  if (observation.kind === "available" && observation.value !== null) return observation.value.operation;
  const descriptor = checkedLayoutConstructionOf(call);
  switch (descriptor?.kind) {
    case "value": return "value-layout";
    case "array": return "array-layout";
    case "field": return "field-layout";
    default: return null;
  }
};

export const checkedLayoutGeometryOperands: CheckedLayoutGeometryOperands = capture => {
  const geometry = capture.kind === "field" ? [capture.byteOffsetExpression, capture.byteAlignmentExpression]
    : [capture.geometry.byteSizeExpression, capture.geometry.byteAlignmentExpression, capture.geometry.strideExpression];
  if (capture.kind === "array") geometry.push(capture.extentExpression);
  return geometry.filter(operand => operand !== null).sort((left, right) => left.value.node - right.value.node);
};

export function checkedLayoutGeometryOf(call: CallExpression<CheckedPhase>, name: string): SourceNodeRef | null {
  const layout = checkedLayoutConstructionOf(call);
  if (layout === null) return null;
  if (layout.kind === "field") {
    if (name === "byteoffset") return layout.byteOffsetExpression;
    return name === "bytealignment" ? layout.byteAlignmentExpression : null;
  }
  if (name === "bytesize") return layout.geometry.byteSizeExpression;
  if (name === "bytealignment") return layout.geometry.byteAlignmentExpression;
  if (name === "stride") return layout.geometry.strideExpression;
  return name === "length" && layout.kind === "array" ? layout.extentExpression : null;
}

function sameOccurrence(left: SourceNodeRef, right: SourceNodeRef): boolean {
  if (left.value.node !== right.value.node) return false;
  return left.kind === "item" ? right.kind === "item" && left.value.owner === right.value.owner
    : right.kind === "body" && left.value.body === right.value.body;
}

function absent(): { readonly kind: "complete"; readonly value: null } {
  return { kind: "complete", value: null };
}

export const resolveCheckedLayout: ResolveCheckedLayout = (deps, reference) => {
  const initial = deps.admit(1, 1);
  if (initial !== null) return { kind: "resource-stop", stop: initial };
  return resolveLayout(deps, deps.nodeOf(reference));
};

export const resolveCheckedLayoutAlias: ResolveCheckedLayoutAlias = (deps, body) => {
  const initial = deps.admit(1, 0);
  if (initial !== null) return { kind: "resource-stop", stop: initial };
  const root = body.root;
  if (root.kind !== "Identifier" && root.kind !== "ParenthesizedExpression") return absent();
  const qualify = deps.admit(2, 0);
  if (qualify !== null) return { kind: "resource-stop", stop: qualify };
  const declaration = deps.parentOf(root);
  if (declaration?.kind !== "VariableDeclaration" || declaration.tsonic.initializer !== body.body ||
    declaration.initializer !== root || deps.nodeOf({ kind: "body", value: { body: body.body, node: root.id } }) !== root)
    return absent();
  const list = deps.parentOf(declaration);
  if (list?.kind !== "VariableDeclarationList" || !list.flags.includes("Const")) return absent();
  let read = root;
  while (read.kind === "ParenthesizedExpression") {
    const stop = deps.admit(1, 0);
    if (stop !== null) return { kind: "resource-stop", stop };
    const child = read.expression;
    if (child.kind !== "ParenthesizedExpression" && child.kind !== "Identifier") return absent();
    read = child;
  }
  const prepare = deps.admit(1, 1);
  if (prepare !== null) return { kind: "resource-stop", stop: prepare };
  const resolved = resolveLayout(deps, read);
  if (resolved.kind === "resource-stop") return resolved;
  if (resolved.value === null) return absent();
  const ready = deps.admit(2, 2);
  return ready !== null ? { kind: "resource-stop", stop: ready }
    : { kind: "complete", value: { read: { body: body.body, node: read.id }, descriptor: resolved.value.capture.occurrence } };
};

function resolveLayout<Stop extends object>(deps: CheckedLayoutSourceDeps<Stop>, root: HirNode | null):
  { readonly kind: "complete"; readonly value: CheckedLayoutSource | null } | { readonly kind: "resource-stop"; readonly stop: Stop } {
  const visited = new Set<HirNode | HirModuleBinding>();
  let node = root;
  while (node !== null) {
    const step = deps.admit(1, 1);
    if (step !== null) return { kind: "resource-stop", stop: step };
    if (visited.has(node)) return absent();
    visited.add(node);
    if (node.kind === "ParenthesizedExpression") {
      node = node.expression;
      continue;
    }
    const layout = checkedLayoutConstructionOf(node);
    const memory = node.kind === "VariableDeclaration" ? node.tsonic.memory : null;
    const capture = layout ?? (memory?.kind === "available" && memory.value?.kind === "data-layout" ? memory.value : null);
    if (capture !== null) {
      const read = deps.admit(2, 1);
      if (read !== null) return { kind: "resource-stop", stop: read };
      const item = deps.itemOf(node);
      if (item === null || deps.nodeOf(capture.occurrence) !== node
        || capture.kind === "data-layout" && (capture.declaration.kind !== "available" || capture.declaration.value !== item.owner))
        return absent();
      return { kind: "complete", value: { definition: item.owner, capture, node } };
    }
    if (node.kind === "VariableDeclaration") {
      const read = deps.admit(2, 0);
      if (read !== null) return { kind: "resource-stop", stop: read };
      const parent = deps.parentOf(node);
      if (parent?.kind !== "VariableDeclarationList" || !parent.flags.includes("Const")) return absent();
      node = node.initializer;
      continue;
    }
    if (node.kind !== "Identifier" || node.tsonic.role !== "value") return absent();
    let resolution = node.tsonic.resolution;
    while (resolution.kind === "binding") {
      const read = deps.admit(2, 1);
      if (read !== null) return { kind: "resource-stop", stop: read };
      const binding = deps.bindingOf(resolution.occurrence);
      if (binding === null || visited.has(binding) || !sameOccurrence(resolution.occurrence, binding.occurrence)
        || binding.target.kind !== "available") return absent();
      visited.add(binding);
      resolution = binding.target.value;
    }
    const read = deps.admit(2, 0);
    if (read !== null) return { kind: "resource-stop", stop: read };
    const owner = resolution.kind === "local" ? deps.localDeclarationOf(resolution.local)
      : resolution.kind === "declarations" && resolution.definitions.length === 1
        ? deps.declarationSourceOf(resolution.definitions[0]) : null;
    if (owner === null) return absent();
    node = deps.nodeOf(owner);
  }
  return absent();
}
