import type { CheckedBindingKeyOf, CheckedMemberStorageOf, CheckedPhase, CheckedReferenceArgumentViewOf, CheckedSourceBindingFieldOf, CheckedSourceObjectHoldingOf, CheckedSourceObjectFieldReader,
  CheckedSourceObjectFieldsOf, CheckedSourceObjectRead, CheckedSourceStorageRead, CheckedVariableStorageOf,
  HirBody, HirCoreCapture, HirLocal, HirNode, PropertyAccessExpression, PropertyName, ReadWriteRootStorageOf, TypeAliasDeclaration, TypeNode, WritableRootStorageOf } from "./contract.js";
import type { DefId, LocalId, LocalRef, NodeId, TyId } from "../ids/contract.js";
import type { Member, MemberKey, ReferenceArgumentField, ReferenceArgumentView, SourceObjectField, SourceObjectFieldPresence, SourceObjectHolding, TypeTerm } from "../ir-types/contract.js";
import { compareAdmittedMemberKeys, compareMemberKeys, findMemberByKey } from "../ir-types/index.js";
import { resolveModuleBindingOn } from "./bindings.js";

function ordinaryObjectRepresentation(core: HirCoreCapture): boolean {
  return core.provider.kind === "available" && core.provider.value === null && core.markers.kind === "available"
    && core.markers.value.struct === null && core.markers.value.field === null && !core.markers.value.jsString;
}

function admittedOperand(node: HirNode, admit: CheckedSourceStorageRead["admit"]): HirNode | null {
  let current = node;
  while (current.kind === "ParenthesizedExpression") {
    if (!admit(1, 0)) return null;
    current = current.expression;
  }
  return current;
}

type ObjectAlias = TypeAliasDeclaration<CheckedPhase, "TypeAliasDeclaration"> & { readonly type: TypeLiteral };
type ObjectAliasReference = Extract<TypeNode<CheckedPhase>, { readonly kind: "TypeReference" | "ImportType" }>;
type ObjectContainer = TypeLiteral | ObjectAlias;

function isObjectAliasReference(annotation: TypeNode<CheckedPhase>): annotation is ObjectAliasReference {
  return annotation.kind === "TypeReference" || annotation.kind === "ImportType";
}

function objectAliasOwner(annotation: ObjectAliasReference, read: CheckedSourceStorageRead): DefId | null | undefined {
  if (annotation.typeArguments !== null) return null;
  const name = annotation.kind === "TypeReference" ? annotation.typeName
    : annotation.isTypeOf || annotation.attributes !== null ? null : annotation.qualifier;
  if (name === null || name.parent !== annotation.id || name.tsonic.role !== "type-name") return null;
  const resolution = name.tsonic.resolution;
  const recorded = annotation.tsonic.referencedDefinitions;
  if (resolution.kind === "declarations")
    return resolution.definitions.length === 1 && recorded.length === 1 && recorded[0] === resolution.definitions[0]
      ? resolution.definitions[0] : null;
  if (resolution.kind !== "binding" || recorded.length !== 0) return null;
  const occurrence = resolution.occurrence;
  const reached = resolveModuleBindingOn(read, occurrence, (work, records) => read.admit(work, records) ? null : occurrence);
  if (!("target" in reached)) return undefined;
  const target = reached.target;
  return target.kind === "available" && target.value.kind === "declarations" && target.value.definitions.length === 1
    ? target.value.definitions[0] : null;
}

function hasObjectLiteral(alias: TypeAliasDeclaration<CheckedPhase>): alias is ObjectAlias {
  return alias.kind === "TypeAliasDeclaration" && alias.type.kind === "TypeLiteral";
}

function ordinaryObjectAlias(definition: DefId, type: TyId, read: CheckedSourceStorageRead): ObjectAlias | null | undefined {
  const { itemOf, admit } = read;
  let selected = definition;
  let followed: Set<DefId> | null = null;
  for (;;) {
    const alias = itemOf(selected);
    if (alias?.kind !== "TypeAliasDeclaration" || alias.tsonic.definition !== selected || alias.typeParameters !== null
      || alias.tsonic.type.kind !== "available" || alias.tsonic.type.value !== type || !ordinaryObjectRepresentation(alias.tsonic.core)) return null;
    const target = alias.type;
    if (target.parent !== alias.id || target.tsonic.type.kind !== "available" || target.tsonic.type.value !== type
      || !ordinaryObjectRepresentation(target.tsonic.core)) return null;
    if (hasObjectLiteral(alias)) return alias;
    if (!isObjectAliasReference(target)) return null;
    if (!admit(1, 0)) return undefined;
    const next = objectAliasOwner(target, read);
    if (next == null) return next;
    if (!admit(1 + selected.length, followed === null ? 2 : 1)) return undefined;
    (followed ??= new Set()).add(selected);
    if (!admit(6 + next.length, 0)) return undefined;
    if (followed.has(next)) return null;
    selected = next;
  }
}

function ordinaryObjectContainer(annotation: TypeNode<CheckedPhase> | null, type: TyId, read: CheckedSourceStorageRead): ObjectContainer | null {
  if (annotation === null || annotation.tsonic.type.kind !== "available" || annotation.tsonic.type.value !== type) return null;
  if (annotation.kind === "TypeLiteral") return ordinaryObjectRepresentation(annotation.tsonic.core) ? annotation : null;
  if (!isObjectAliasReference(annotation)) return null;
  const definition = objectAliasOwner(annotation, read);
  if (definition == null) return null;
  return ordinaryObjectAlias(definition, type, read) ?? null;
}

function captureStorage(body: HirBody, local: HirLocal, type: TyId, read: CheckedSourceStorageRead):
  { readonly body: HirBody; readonly slot: HirLocal } | null {
  if (!read.admit(1, 0)) return null;
  const source = local.capturedFrom;
  if (source === null || source.body === body.body || local.declaration.kind !== "item") return null;
  let captured = false;
  for (let index = 0; index < body.captures.length; index += 1) {
    if (!read.admit(1, 0)) return null;
    const offered = body.captures[index];
    if (offered === undefined || !read.admit(2 + offered.body.length, 0)) return null;
    if (offered.body === source.body && offered.local === source.local) {
      captured = true;
      break;
    }
  }
  if (!captured || !read.admit(4 + source.body.length, 0)) return null;
  const outer = read.bodyOf(source.body);
  if (outer?.body !== source.body) return null;
  const slot = outer.locals[source.local];
  return slot?.id === source.local && slot.checkerSlot.kind === "available"
    && slot.checkerSlot.value === type && slot.declaration.kind === "item"
    && slot.declaration.value.owner === local.declaration.value.owner
    && slot.declaration.value.node === local.declaration.value.node && read.admit(0, 1) ? { body: outer, slot } : null;
}

interface SavedHolding<Proof> {
  readonly initializerBody: HirBody;
  readonly access: Access;
  readonly before: LocalRef;
  readonly resumeHolding: (field: CheckedField) => HoldingProof<Proof>;
}

type HoldingProof<Proof> = Proof | SavedHolding<Proof> | null;

function sourceObjectHolding<Proof>(accept: (holding: SourceObjectHolding, container: ObjectContainer, presence: SourceObjectFieldPresence | null) => Proof | null,
  body: HirBody, local: LocalRef, read: CheckedSourceObjectRead, before: LocalRef | null = null): HoldingProof<Proof> {
  let initial: HirLocal | undefined;
  if (local.body === body.body) {
    const own = body.locals[local.local];
    if (own?.id !== local.local) return null;
    initial = own;
  } else {
    for (let index = 0; index < body.locals.length; index += 1) {
      if (!read.admit(1, 0)) return null;
      const candidate = body.locals[index];
      if (candidate?.id !== index) return null;
      if (candidate.role !== "capture" || candidate.capturedFrom === null) continue;
      const source = candidate.capturedFrom;
      if (!read.admit(2 + source.body.length, 0)) return null;
      if (source.body !== local.body || source.local !== local.local) continue;
      if (initial !== undefined) return null;
      initial = candidate;
    }
  }
  if (initial?.checkerSlot.kind !== "available") return null;
  if (before !== null) {
    if (!read.admit(1, 0) || local.body === before.body && local.local >= before.local) return null;
    const source = initial.capturedFrom;
    if (source?.body === before.body && source.local >= before.local) return null;
  }
  const { nodeOf, admit } = read;
  const type = initial.checkerSlot.value;
  let inputs: { readonly body: HirBody; readonly local: LocalId }[] | null = null;
  let reached: Set<HirLocal> | null = null;
  let captured: Set<HirLocal> | null = null;
  let alias: DefId | null = null;
  let container: ObjectContainer | null = null;
  let presence: SourceObjectFieldPresence | null = null;
  let current = initial.id;
  let currentBody = body;
  let localRow = initial;
  const retain = (actual: DefId, actualContainer: ObjectContainer | null, optional: SourceObjectFieldPresence | null): boolean => {
    alias ??= actual;
    if (alias !== actual) return false;
    if (actualContainer !== null) {
      if (container !== null && (presence?.storage !== optional?.storage || presence?.present !== optional?.present)) return false;
      container ??= actualContainer;
      if (container !== actualContainer) return false;
      presence = optional;
    }
    reached?.add(localRow);
    return true;
  };
  const advance = (saved: CheckedField | null): HoldingProof<Proof> => {
    if (saved !== null) {
      const value = saved.value;
      if (value === null) return null;
      const optional = value.presence?.storage === type ? value.presence : null;
      if (optional === null && value.type !== type || !retain(value.container.kind === "TypeAliasDeclaration"
        ? value.container.tsonic.definition : saved.proof.field, value.container, optional)) return null;
    }
    for (;;) {
      let actual: DefId | null = null;
      let actualContainer: ObjectContainer | null = null;
      while (saved === null) {
        if (reached?.has(localRow)) break;
        if (localRow.declaration.kind !== "item") return null;
        if (localRow.role === "capture") {
          if (captured?.has(localRow) || !admit(1, captured === null ? 2 : 1)) return null;
          const outer = captureStorage(currentBody, localRow, type, read);
          if (outer === null || before !== null && outer.body.body === before.body && outer.slot.id >= before.local) return null;
          (captured ??= new Set()).add(localRow);
          current = outer.slot.id;
          currentBody = outer.body;
          localRow = outer.slot;
          continue;
        }
        if (localRow.role === "parameter") {
          const formal = nodeOf(localRow.declaration);
          if (formal?.kind !== "Parameter" || formal.id !== localRow.declaration.value.node || formal.tsonic.parent !== currentBody.owner
            || formal.tsonic.declaration.kind !== "local"
            || formal.tsonic.declaration.local.body !== currentBody.body || formal.tsonic.declaration.local.local !== current
            || formal.dotDotDotToken !== null || formal.tsonic.declaredType.kind !== "available" || formal.tsonic.declaredType.value !== type) return null;
          const passing = formal.tsonic.core.argumentPassing;
          if (passing.kind !== "available" || passing.value !== null &&
            (passing.value.role !== "declaration" || passing.value.mode !== "by-value")) return null;
          actualContainer = ordinaryObjectContainer(formal.type, type, read);
          if (actualContainer === null) return null;
          actual = actualContainer.kind === "TypeAliasDeclaration" ? actualContainer.tsonic.definition : localRow.declaration.value.owner;
          break;
        }
        if (localRow.role !== "binding" || !admit(1, 0)) return null;
        const declaration = nodeOf(localRow.declaration);
        if (declaration?.kind !== "VariableDeclaration" || declaration.id !== localRow.declaration.value.node
          || !("declaration" in declaration.tsonic) || declaration.origin.module !== currentBody.root.origin.module
          || declaration.tsonic.declaration.kind !== "local" || declaration.tsonic.declaration.local.body !== currentBody.body
          || declaration.tsonic.declaration.local.local !== current || checkedVariableStorageOf(declaration) !== type) return null;
        if (declaration.type !== null) {
          actualContainer = ordinaryObjectContainer(declaration.type, type, read);
          if (actualContainer === null) return null;
          actual = actualContainer.kind === "TypeAliasDeclaration" ? actualContainer.tsonic.definition : localRow.declaration.value.owner;
          break;
        }
        const root = declaration.initializer;
        const initializerBody = declaration.tsonic.initializer;
        if (root === null || initializerBody === null) return null;
        if (localRow.mutable) {
          const bound = declaration.tsonic.inferredTypeBound;
          if (bound?.kind !== "available" || typeof bound.value === "number" || bound.value.sources === null
            || bound.value.sources.length === 0) return null;
          actual = bound.value.alias;
          if (alias !== null && alias !== actual) return null;
          reached ??= new Set<HirLocal>();
          inputs ??= [];
          for (let index = 0; index < bound.value.sources.length; index += 1) {
            if (!admit(1, 1)) return null;
            const source = bound.value.sources[index];
            if (source === undefined) return null;
            inputs.push({ body: currentBody, local: source });
          }
          break;
        }
        const initializer = admittedOperand(root, admit);
        if (initializer?.kind === "PropertyAccessExpression") {
          if (initializer.tsonic.role !== "value" || initializer.tsonic.value.views.read.kind !== "available" ||
            initializer.tsonic.value.views.read.value !== type || root.parent !== declaration.id ||
            !admit(1 + initializerBody.length, 0)) return null;
          const placed = read.bodyOf(initializerBody);
          if (placed?.body !== initializerBody || placed.owner !== localRow.declaration.value.owner || placed.root !== root ||
            !admit(1, 2)) return null;
          return { initializerBody: placed, access: initializer, before: declaration.tsonic.declaration.local, resumeHolding: advance };
        }
        if (initializer?.kind !== "Identifier" || initializer.tsonic.role !== "value" || initializer.tsonic.resolution.kind !== "local"
          || initializer.tsonic.resolution.local.body !== currentBody.body || initializer.tsonic.resolution.local.local >= current
          || initializer.tsonic.value.views.read.kind !== "available" || initializer.tsonic.value.views.read.value !== type) return null;
        current = initializer.tsonic.resolution.local.local;
        if (!admit(1, 0)) return null;
        const next = currentBody.locals[current];
        if (next?.id !== current || next.checkerSlot.kind !== "available" || next.checkerSlot.value !== type) return null;
        localRow = next;
      }
      if (actual !== null && !retain(actual, actualContainer, null)) return null;
      saved = null;
      if (inputs === null || inputs.length === 0) break;
      if (!admit(1, 0)) return null;
      const incoming = inputs.pop();
      if (incoming === undefined) return null;
      current = incoming.local;
      currentBody = incoming.body;
      captured = null;
      const next = currentBody.locals[current];
      if (next?.id !== current || next.checkerSlot.kind !== "available" || next.checkerSlot.value !== type) return null;
      localRow = next;
    }
    return alias === null || container === null ? null : accept({ local, declaration: alias, receiver: type }, container, presence);
  };
  return advance(null);
}

export const checkedSourceObjectHoldingOf: CheckedSourceObjectHoldingOf = (body, local, storage, read) =>
  settleHolding(sourceObjectHolding((holding, _container, presence): "reference" | "reference-optional" | null =>
    holding.receiver !== storage ? null : presence === null ? "reference" : "reference-optional", body, local, read), read);

type Property = Extract<HirNode, { readonly kind: "PropertySignature" }>;
type TypeLiteral = Extract<HirNode, { readonly kind: "TypeLiteral" }>;
type Access = PropertyAccessExpression<CheckedPhase>;

interface FieldValue {
  readonly type: TyId;
  readonly container: ObjectContainer;
  readonly presence: SourceObjectFieldPresence | null;
}

function fieldContainer(annotation: TypeNode<CheckedPhase>, type: TyId, read: CheckedSourceObjectRead): FieldValue["container"] | null | undefined {
  if (annotation.kind === "TypeLiteral") return ordinaryObjectRepresentation(annotation.tsonic.core) ? annotation : null;
  if (!isObjectAliasReference(annotation)) return null;
  if (!read.admit(1, 0)) return undefined;
  const definition = objectAliasOwner(annotation, read);
  if (definition == null) return definition;
  if (!read.admit(6 + definition.length, 0)) return undefined;
  return ordinaryObjectAlias(definition, type, read);
}

function fieldValue(property: Property, read: CheckedSourceObjectRead): FieldValue | null | undefined {
  const { typeOf, admit } = read;
  if (!admit(1, 0)) return undefined;
  const annotation = property.type;
  const declared = property.tsonic.declaredType;
  if (annotation === null || annotation.parent !== property.id || declared.kind !== "available" || declared.value === null
    || annotation.tsonic.type.kind !== "available" || annotation.tsonic.type.value !== declared.value) return null;
  if (annotation.kind === "TypeLiteral" || isObjectAliasReference(annotation)) {
    if (typeOf(declared.value)?.kind !== "shape") return null;
    if (!admit(1, 0)) return undefined;
    const container = fieldContainer(annotation, declared.value, read);
    if (container === null || container === undefined) return container;
    return admit(1, 1) ? { type: declared.value, container, presence: null } : undefined;
  }
  if (annotation.kind !== "UnionType" || annotation.types.nodes.length !== 2) return null;
  if (!admit(1, 0)) return undefined;
  const storage = typeOf(declared.value);
  if (storage?.kind !== "optional") return null;
  let present: FieldValue["container"] | null = null;
  let absent = false;
  for (let ordinal = 0; ordinal < 2; ordinal += 1) {
    if (!admit(1, 0)) return undefined;
    const arm = annotation.types.nodes[ordinal];
    if (arm === undefined || arm.parent !== annotation.id || arm.tsonic.type.kind !== "available") return null;
    if (arm.kind === "TypeLiteral" || isObjectAliasReference(arm)) {
      if (present !== null || arm.tsonic.type.value !== storage.value) return null;
      if (!admit(1, 0)) return undefined;
      if (typeOf(storage.value)?.kind !== "shape") return null;
      const container = fieldContainer(arm, storage.value, read);
      if (container === null || container === undefined) return container;
      present = container;
    } else {
      if (absent || (arm.kind !== "UndefinedKeyword" && (arm.kind !== "LiteralType" || arm.literal.kind !== "NullKeyword"))) return null;
      if (!admit(1, 0)) return undefined;
      const type = typeOf(arm.tsonic.type.value);
      if (type?.kind !== "intrinsic" || type.intrinsic !== "absence") return null;
      absent = true;
    }
  }
  if (present === null || !absent) return null;
  return admit(1, 2) ? { type: storage.value, container: present,
    presence: { storage: declared.value, present: storage.value } } : undefined;
}

function selectedField(access: Access): DefId | null {
  if (access.questionDotToken !== null || access.tsonic.role === "enum-member" || access.tsonic.role === "array-extent" || access.tsonic.origins.kind !== "available"
    || access.tsonic.origins.value.length !== 1 || access.tsonic.accessor.kind !== "available" || access.tsonic.accessor.value !== null) return null;
  const origin = access.tsonic.origins.value[0];
  if (origin?.kind !== "declared") return null;
  if (access.tsonic.role === "assignment-target") {
    if (checkedMemberStorageOf(access) === null || access.tsonic.place.kind !== "available") return null;
    const step = access.tsonic.place.value.step;
    const chosen = step?.kind === "member" && step.origins.length === 1 ? step.origins[0] : undefined;
    if (chosen?.kind !== "declared" || chosen.declaration !== origin.declaration) return null;
  }
  return origin.declaration;
}

interface ReachedField {
  readonly access: Access;
  readonly declaration: DefId;
}

interface CheckedField {
  readonly access: Access;
  readonly proof: SourceObjectField;
  readonly value: FieldValue | null;
}

function sourceObjectFields(body: HirBody, read: CheckedSourceObjectRead) {
  const { nodeOf, itemOf, admit } = read;
  let fields: Map<NodeId, CheckedField> | null = null;
  const select = (reached: ReachedField, holding: SourceObjectHolding, container: FieldValue["container"], parent: SourceObjectField | null): CheckedField | null => {
    if (!admit(1, 0)) return null;
    const property = qualifiedSourceField(holding.declaration, container, reached.declaration, itemOf);
    if (property === null) return null;
    const value = fieldValue(property, read);
    if (value === undefined) return null;
    const access = reached.access;
    const payload = access.tsonic;
    const presence = value?.presence ?? null;
    if (presence !== null && (payload.role === "assignment-target" ? checkedMemberStorageOf(access)?.write !== presence.storage
      : payload.role !== "value" || payload.value.views.read.kind !== "available"
        || payload.value.views.read.value !== presence.storage && payload.value.views.read.value !== presence.present)) return null;
    if (!admit(1, fields === null ? 5 : 4)) return null;
    const row: CheckedField = { access, proof: { ...holding, occurrence: { body: body.body, node: access.id },
      field: reached.declaration, parent, requiredReference: presence === null ? value?.type ?? null : null, presence }, value };
    (fields ??= new Map()).set(access.id, row);
    return row;
  };
  const field = (access: Access, before: LocalRef | null, role: "value" | null): HoldingProof<CheckedField> => {
    let current = access;
    let pending: ReachedField[] | null = null;
    let visited: Set<Access> | null = null;
    const finish = (base: CheckedField | null): CheckedField | null => {
      let ready = base;
      while (ready !== null && pending !== null && pending.length !== 0) {
        if (!admit(1, 0)) return null;
        const next = pending.pop();
        if (next === undefined || ready.value === null) return null;
        const payload = current.tsonic;
        if (payload.role !== "value" || payload.value.views.read.kind !== "available" || payload.value.views.read.value !== ready.value.type) return null;
        const { local, field } = ready.proof;
        if (!admit(0, 1)) return null;
        ready = select(next, { local, declaration: field, receiver: ready.value.type }, ready.value.container, ready.proof);
        current = next.access;
      }
      return ready;
    };
    for (;;) {
      if (!admit(1, 0)) return null;
      const prior = fields?.get(current.id);
      if (prior === undefined) {
        if (visited?.has(current) === true || nodeOf({ kind: "body", value: { body: body.body, node: current.id } }) !== current) return null;
      } else if (prior.access !== current) return null;
      if (current === access && role !== null && current.tsonic.role !== role) return null;
      if (prior !== undefined) return finish(prior);
      const declaration = selectedField(current);
      if (declaration === null) return null;
      const receiver = admittedOperand(current.expression, admit);
      if (receiver === null) return null;
      if (receiver.kind === "PropertyAccessExpression") {
        if (!admit(1, pending === null ? 5 : 3)) return null;
        (visited ??= new Set()).add(current);
        (pending ??= []).push({ access: current, declaration });
        current = receiver;
        continue;
      }
      if (receiver.kind !== "Identifier" || receiver.tsonic.role !== "value" || receiver.tsonic.resolution.kind !== "local"
        || !admit(0, 1)) return null;
      return sourceObjectHolding((holding, container, presence) => {
        const actual = presentHolding(receiver, holding, presence, read);
        return actual === null ? null : finish(select({ access: current, declaration }, actual, container, null));
      },
        body, receiver.tsonic.resolution.local, read, before);
    }
  };
  return { field, ready: (node: NodeId) => fields?.get(node)?.proof ?? null };
}

function settleHolding<Proof extends object | "reference" | "reference-optional">(result: HoldingProof<Proof>, read: CheckedSourceObjectRead): Proof | null {
  if (result === null || typeof result !== "object" || !("resumeHolding" in result)) return result;
  for (;;) {
    if (!read.admit(1, 3)) return null;
    const active = new Set<HirBody>();
    active.add(result.initializerBody);
    const pending: SavedHolding<CheckedField>[] = [];
    let field = sourceObjectFields(result.initializerBody, read).field(result.access, result.before, null);
    for (;;) {
      if (field === null) return null;
      if ("resumeHolding" in field) {
        if (!read.admit(1, 0) || active.has(field.initializerBody) || !read.admit(1, 3)) return null;
        active.add(field.initializerBody);
        pending.push(field);
        field = sourceObjectFields(field.initializerBody, read).field(field.access, field.before, null);
        continue;
      }
      if (pending.length === 0) break;
      if (!read.admit(1, 0)) return null;
      const next = pending.pop();
      if (next === undefined) return null;
      active.delete(next.initializerBody);
      field = next.resumeHolding(field);
    }
    result = result.resumeHolding(field);
    if (result === null || typeof result !== "object" || !("resumeHolding" in result)) return result;
  }
}

export const checkedSourceObjectFieldsOf: CheckedSourceObjectFieldsOf = (body, read) => {
  const source = sourceObjectFields(body, read);
  const field: CheckedSourceObjectFieldReader = access => settleHolding(source.field(access, null, null), read)?.proof ?? null;
  const presence = (operand: HirNode): SourceObjectFieldPresence | null => {
    if (operand.kind === "PropertyAccessExpression") return settleHolding(source.field(operand, null, "value"), read)?.proof.presence ?? null;
    if (operand.kind !== "Identifier" || !read.admit(1, 0) ||
      read.nodeOf({ kind: "body", value: { body: body.body, node: operand.id } }) !== operand) return null;
    const payload = operand.tsonic;
    if (payload.role !== "value" || payload.resolution.kind !== "local" || payload.value.views.read.kind !== "available") return null;
    const actual = payload.value.views.read.value;
    return settleHolding(sourceObjectHolding((_holding, _container, value) =>
      value !== null && (value.storage === actual || value.present === actual) ? value : null,
    body, payload.resolution.local, read), read);
  };
  return { field, presence, ready: source.ready };
};

function presentHolding(operand: HirNode, holding: SourceObjectHolding, presence: SourceObjectFieldPresence | null,
  read: CheckedSourceObjectRead): SourceObjectHolding | null {
  if (presence === null) return holding;
  if (operand.kind !== "Identifier" || operand.tsonic.role !== "value" || operand.tsonic.value.views.read.kind !== "available" ||
    operand.tsonic.value.views.read.value !== presence.present || !read.admit(1, 1)) return null;
  return { ...holding, receiver: presence.present };
}

function heldObjectOperand<Proof extends object>(body: HirBody, operand: HirNode, read: CheckedSourceObjectRead,
  select: (holding: SourceObjectHolding, container: FieldValue["container"], parent: SourceObjectField | null) => Proof | null): Proof | null {
  if (operand.kind === "Identifier" && operand.tsonic.role === "value" && operand.tsonic.resolution.kind === "local")
    return settleHolding(sourceObjectHolding((holding, container, presence) => {
      const actual = presentHolding(operand, holding, presence, read);
      return actual === null ? null : select(actual, container, null);
    },
      body, operand.tsonic.resolution.local, read), read);
  if (operand.kind !== "PropertyAccessExpression" || operand.tsonic.role !== "value" || !read.admit(1, 3)) return null;
  const source = settleHolding(sourceObjectFields(body, read).field(operand, null, null), read);
  if (source === null || source.value === null) return null;
  const view = operand.tsonic.value.views.read;
  if (view.kind !== "available" || view.value !== source.value.type || !read.admit(0, 1)) return null;
  const { local, field } = source.proof;
  return select({ local, declaration: field, receiver: source.value.type }, source.value.container, source.proof);
}

function qualifiedSourceField(owner: DefId, container: FieldValue["container"], definition: DefId, itemOf: (definition: DefId) => HirNode | null) {
  if (container.kind === "TypeAliasDeclaration") {
    owner = container.tsonic.definition;
    container = container.type;
  }
  const field = itemOf(definition);
  if (field?.kind !== "PropertySignature" || field.postfixToken?.kind === "ExclamationToken" || field.tsonic.parent !== owner
    || field.parent !== container.id
    || field.tsonic.declaration.kind !== "definition" || field.tsonic.declaration.definition !== definition
    || !ordinaryObjectRepresentation(field.tsonic.core)) return null;
  return field;
}

interface ReferenceSurface {
  readonly owner: DefId;
  readonly syntax: TypeLiteral;
  readonly members: readonly Member[];
}

interface ReferenceField {
  readonly declaration: DefId;
  readonly type: TyId;
  readonly nested: FieldValue | null;
}

interface ReferenceFrame {
  readonly caller: ReferenceSurface;
  readonly formal: ReferenceSurface;
  readonly parent: number | null;
  readonly callerAlias: ObjectAlias | null;
  readonly formalAlias: ObjectAlias | null;
  position: number;
}

function directOrigin(origins: Member["origins"], declaration: DefId): boolean {
  const origin = origins[0];
  return origins.length === 1 && origin?.kind === "declared" && origin.declaration === declaration;
}

function isStaticTextPropertyName(name: PropertyName<CheckedPhase>):
  name is Extract<PropertyName<CheckedPhase>, { readonly kind: "Identifier" | "StringLiteral" }> {
  return name.kind === "Identifier" || name.kind === "StringLiteral";
}

function matchesStaticTextPropertyName(name: PropertyName<CheckedPhase>, key: string, admit: CheckedSourceObjectRead["admit"]): boolean {
  if (!isStaticTextPropertyName(name)) return false;
  const text = name.text;
  return admit(text.length + key.length, 0) && text === key;
}

function referenceSurface(owner: DefId, container: ObjectContainer, type: TyId, read: CheckedSourceObjectRead): ReferenceSurface | null {
  if (!read.admit(1, 0)) return null;
  const syntax = container.kind === "TypeLiteral" ? container : container.type;
  const term = read.typeOf(type);
  if (term?.kind !== "shape" || term.indexes.length !== 0 || term.calls.length !== 0 || term.constructs.length !== 0
    || term.members.length !== syntax.members.nodes.length || !read.admit(0, 1)) return null;
  return { owner: container.kind === "TypeAliasDeclaration" ? container.tsonic.definition : owner, syntax, members: term.members };
}

function referenceField(surface: ReferenceSurface, member: Member, read: CheckedSourceObjectRead): ReferenceField | null {
  if (!read.admit(1, 0) || member.kind !== "property" || member.key.kind === "symbol" || member.read === null
    || (member.readonly ? member.write !== null : member.write !== member.read)) return null;
  const origin = member.origins[0];
  if (member.origins.length !== 1 || origin?.kind !== "declared" || !directOrigin(member.readOrigins, origin.declaration)
    || (member.readonly ? member.writeOrigins.length !== 0 : !directOrigin(member.writeOrigins, origin.declaration))) return null;
  const field = qualifiedSourceField(surface.owner, surface.syntax, origin.declaration, read.itemOf);
  if (field === null || (field.postfixToken?.kind === "QuestionToken") !== member.optional
    || (member.key.kind === "text" ? !matchesStaticTextPropertyName(field.name, member.key.value, read.admit)
      : field.name.kind !== "NumericLiteral")) return null;
  const annotation = field.type;
  const declared = field.tsonic.declaredType;
  if (annotation === null || annotation.parent !== field.id || declared.kind !== "available" || declared.value === null
    || annotation.tsonic.type.kind !== "available" || annotation.tsonic.type.value !== declared.value) return null;
  const nested = fieldValue(field, read);
  if (nested === undefined || !read.admit(1, 0)) return null;
  const storage = read.typeOf(member.read);
  const present = storage?.kind === "optional" ? storage.value : member.read;
  if (present !== declared.value && member.read !== declared.value
    || member.read !== declared.value && !member.optional
    || nested !== null && (present !== nested.type || (storage?.kind === "optional") !== (nested.presence !== null || member.optional))
    || !read.admit(0, 1)) return null;
  return { declaration: origin.declaration, type: member.read, nested };
}

function nativeLeaf(type: TypeTerm | undefined): boolean {
  return type?.kind === "primitive" || type?.kind === "string"
    || type?.kind === "intrinsic" && type.intrinsic === "bigint";
}

function enterReferenceAlias(alias: ObjectAlias, ancestors: Set<ObjectAlias> | null,
  admit: CheckedSourceObjectRead["admit"]): Set<ObjectAlias> | null {
  if (!admit(1, 0) || ancestors?.has(alias) || !admit(1, ancestors === null ? 2 : 1)) return null;
  return (ancestors ?? new Set()).add(alias);
}

export const checkedReferenceArgumentViewOf: CheckedReferenceArgumentViewOf = (site, read) => {
  if (!read.admit(1, 0) || site.argument.body !== site.body.body || site.endpoint.role !== "api-body"
    || site.endpoint.body === null || site.formal.passing !== "by-value" || site.formal.kind === "rest"
    || !Number.isSafeInteger(site.ordinal) || site.ordinal < 0 || Object.is(site.ordinal, -0)) return null;
  const original = read.nodeOf({ kind: "body", value: site.argument });
  if (original?.id !== site.argument.node) return null;
  const argument = admittedOperand(original, read.admit);
  if (argument?.kind !== "Identifier" && argument?.kind !== "PropertyAccessExpression" || argument.tsonic.role !== "value"
    || argument.kind === "Identifier" && argument.tsonic.resolution.kind !== "local"
    || argument.tsonic.value.views.read.kind !== "available" || argument.tsonic.value.views.read.value !== site.caller
    || !read.admit(1, 0)) return null;
  const caller = heldObjectOperand(site.body, argument, read, (holding, container) => {
    if (holding.receiver !== site.caller) return null;
    return referenceSurface(holding.declaration, container, site.caller, read);
  });
  if (caller === null || !read.admit(1, 0)) return null;
  const callable = read.itemOf(site.endpoint.declaration);
  if (callable?.kind !== "FunctionDeclaration" || callable.tsonic.definition !== site.endpoint.declaration
    || callable.tsonic.body !== site.endpoint.body) return null;
  let endpoint = false;
  for (let position = 0; position < callable.tsonic.signatures.length; position += 1) {
    if (!read.admit(1, 0)) return null;
    const offered = callable.tsonic.signatures[position];
    if (offered?.role === "api-body" && offered.declaration === site.endpoint.declaration
      && offered.signature === site.endpoint.signature && offered.body === site.endpoint.body) {
      endpoint = true;
      break;
    }
  }
  if (!endpoint || !read.admit(1, 0)) return null;
  const header = callable.parameters.nodes[site.ordinal];
  const parameter = read.itemOf(site.formal.declaration);
  if (header === undefined || parameter !== header || parameter.parent !== callable.id || parameter.tsonic.parent !== site.endpoint.declaration
    || parameter.tsonic.declaration.kind !== "local" || parameter.tsonic.declaration.local.body !== site.endpoint.body
    || parameter.dotDotDotToken !== null || parameter.tsonic.declaredType.kind !== "available"
    || parameter.tsonic.declaredType.value !== site.formal.type) return null;
  const passing = parameter.tsonic.core.argumentPassing;
  if (passing.kind !== "available" || passing.value !== null && (passing.value.role !== "declaration" || passing.value.mode !== "by-value")
    || !read.admit(1, 0)) return null;
  const container = ordinaryObjectContainer(parameter.type, site.formal.type, read);
  if (container === null) return null;
  const formal = referenceSurface(site.formal.declaration, container, site.formal.type, read);
  if (formal === null || !read.admit(1, 4)) return null;
  const fields: ReferenceArgumentField[] = [];
  const result: ReferenceArgumentView = { caller: site.caller, formal: site.formal.type, fields };
  const pending: ReferenceFrame[] = [{ caller, formal, parent: null, callerAlias: null, formalAlias: null, position: 0 }];
  let callerAliases: Set<ObjectAlias> | null = null;
  let formalAliases: Set<ObjectAlias> | null = null;
  while (pending.length !== 0) {
    if (!read.admit(1, 0)) return null;
    const frame = pending[pending.length - 1];
    if (frame === undefined || frame.caller.members.length !== frame.formal.members.length) return null;
    if (frame.position === frame.caller.members.length) {
      if (frame.callerAlias !== null) {
        if (!read.admit(1, 0)) return null;
        callerAliases?.delete(frame.callerAlias);
      }
      if (frame.formalAlias !== null) {
        if (!read.admit(1, 0)) return null;
        formalAliases?.delete(frame.formalAlias);
      }
      pending.pop();
      continue;
    }
    const argumentMember = frame.caller.members[frame.position];
    const formalMember = frame.formal.members[frame.position];
    frame.position += 1;
    if (argumentMember === undefined || formalMember === undefined || argumentMember.key.kind === "symbol" || formalMember.key.kind === "symbol"
      || argumentMember.readonly !== formalMember.readonly || argumentMember.optional !== formalMember.optional
      || compareAdmittedMemberKeys(argumentMember.key, formalMember.key, work => read.admit(work, 0)) !== 0) return null;
    const source = referenceField(frame.caller, argumentMember, read);
    if (source === null) return null;
    const destination = referenceField(frame.formal, formalMember, read);
    if (destination === null || (source.nested === null) !== (destination.nested === null)) return null;
    if (source.nested === null || destination.nested === null) {
      if (source.type !== destination.type || !read.admit(1, 0)) return null;
      const type = read.typeOf(source.type);
      if (type?.kind === "optional" ? !read.admit(1, 0) || !nativeLeaf(read.typeOf(type.value)) : !nativeLeaf(type)) return null;
    } else {
      if ((source.nested.presence === null) !== (destination.nested.presence === null)) return null;
      const callerContainer = source.nested.container;
      const formalContainer = destination.nested.container;
      const callerAlias = callerContainer.kind === "TypeAliasDeclaration" ? callerContainer : null;
      const formalAlias = formalContainer.kind === "TypeAliasDeclaration" ? formalContainer : null;
      if (callerAlias !== null) {
        callerAliases = enterReferenceAlias(callerAlias, callerAliases, read.admit);
        if (callerAliases === null) return null;
      }
      if (formalAlias !== null) {
        formalAliases = enterReferenceAlias(formalAlias, formalAliases, read.admit);
        if (formalAliases === null) return null;
      }
      const caller = referenceSurface(callerAlias?.tsonic.definition ?? source.declaration,
        callerContainer.kind === "TypeLiteral" ? callerContainer : callerContainer.type, source.nested.type, read);
      if (caller === null) return null;
      const formal = referenceSurface(formalAlias?.tsonic.definition ?? destination.declaration,
        formalContainer.kind === "TypeLiteral" ? formalContainer : formalContainer.type, destination.nested.type, read);
      if (formal === null || !read.admit(1, 1)) return null;
      pending.push({ caller, formal, parent: fields.length, callerAlias, formalAlias, position: 0 });
    }
    if (!read.admit(1, 1)) return null;
    fields.push({ parent: frame.parent, caller: source.declaration, formal: destination.declaration,
      callerType: source.type, formalType: destination.type });
  }
  return result;
};

function checkedWrittenBindingKey(written: PropertyName<CheckedPhase>): MemberKey | null {
  if ((!isStaticTextPropertyName(written) && written.kind !== "NumericLiteral") || written.tsonic.role !== "property-name") return null;
  const key = written.tsonic.key;
  if (key.kind !== "available") return null;
  return written.kind === "NumericLiteral" ? key.value.kind === "number" ? key.value : null
    : key.value.kind === "text" && key.value.value === written.text ? key.value : null;
}

export const checkedBindingKeyOf: CheckedBindingKeyOf = element => {
  if (element.name?.kind !== "Identifier" || element.dotDotDotToken !== null) return null;
  return element.propertyName === null ? { kind: "text", value: element.name.text } : checkedWrittenBindingKey(element.propertyName);
};

export const checkedSourceBindingFieldOf: CheckedSourceBindingFieldOf = (body, element, key, definition, read) => {
  const { nodeOf, itemOf, admit } = read;
  const occurrence = { body: body.body, node: element.id };
  if (!admit(1, 0) || nodeOf({ kind: "body", value: occurrence }) !== element || element.parent === null
    || element.name?.kind !== "Identifier" || element.dotDotDotToken !== null || key.kind === "symbol") return null;
  const keyWork = (work: number) => admit(work, 0);
  if (element.propertyName === null) {
    if (key.kind !== "text" || !matchesStaticTextPropertyName(element.name, key.value, admit)) return null;
  } else {
    const selector = checkedWrittenBindingKey(element.propertyName);
    if (selector === null || compareAdmittedMemberKeys(key, selector, keyWork) !== 0) return null;
  }
  const pattern = nodeOf({ kind: "body", value: { body: body.body, node: element.parent } });
  if (pattern?.kind !== "ObjectBindingPattern" || pattern.parent === null || !admit(1, 0)) return null;
  const owner = nodeOf({ kind: "body", value: { body: body.body, node: pattern.parent } });
  if (owner?.kind !== "VariableDeclaration" || owner.name !== pattern || owner.initializer === null) return null;
  const receiver = admittedOperand(owner.initializer, admit);
  if (receiver === null) return null;
  const select = (holding: SourceObjectHolding, container: FieldValue["container"], parent: SourceObjectField | null): SourceObjectField | null => {
    if (!admit(1, 0)) return null;
    const field = qualifiedSourceField(holding.declaration, container, definition, itemOf);
    if (field === null) return null;
    if (key.kind === "text") {
      if (!matchesStaticTextPropertyName(field.name, key.value, admit)) return null;
    } else {
      if (field.name.kind !== "NumericLiteral" || !admit(1, 0)) return null;
      const type = read.typeOf(holding.receiver);
      const member = type?.kind === "shape" ? findMemberByKey(type.members, key, keyWork) : null;
      if (member?.kind !== "property" || member.read === null || !directOrigin(member.origins, definition)
        || !directOrigin(member.readOrigins, definition)) return null;
    }
    const value = fieldValue(field, read);
    return value === undefined || !admit(0, 1) ? null
      : { ...holding, occurrence, field: definition, parent, requiredReference: value?.presence === null ? value.type : null,
        presence: value?.presence ?? null };
  };
  return heldObjectOperand(body, receiver, read, select);
};

export const checkedMemberStorageOf: CheckedMemberStorageOf = access => {
  const target = access.tsonic;
  if (target.role !== "assignment-target" || target.place.kind !== "available" || access.questionDotToken !== null) return null;
  const { base, step, read, write } = target.place.value;
  if (base.kind !== "receiver" || base.node !== access.expression.id || write.kind !== "available" || write.value === null) return null;
  if (access.kind === "ElementAccessExpression") {
    if (step?.kind !== "index" || step.expression !== access.argumentExpression.id) return null;
  } else if (step?.kind !== "member" || access.name.kind !== "Identifier" || access.name.tsonic.role !== "property-name"
    || access.name.tsonic.key.kind !== "available" || compareMemberKeys(step.key, access.name.tsonic.key.value) !== 0) return null;
  return target.access === "read-write"
    ? read.kind === "available" ? { read: read.value, write: write.value } : null
    : read.kind === "unavailable" && read.reason === "not-provided" ? { read: null, write: write.value } : null;
};

export const checkedVariableStorageOf: CheckedVariableStorageOf = declaration => {
  if (!("inferredTypeBound" in declaration.tsonic)) return null;
  const { declaredType, inferredTypeBound } = declaration.tsonic;
  if (declaredType.kind !== "available") return null;
  if (declaredType.value !== null) return declaredType.value;
  return inferredTypeBound?.kind === "available"
    ? typeof inferredTypeBound.value === "number" ? inferredTypeBound.value : inferredTypeBound.value.type : null;
};

export const writableRootStorageOf: WritableRootStorageOf = (place, resolution) => {
  if (place.kind !== "available" || place.value.step !== null || place.value.base.kind !== "root"
    || place.value.write.kind !== "available" || place.value.write.value === null) return null;
  const root = place.value.base.resolution;
  if (resolution.kind === "local" && root.kind === "local") {
    if (root.local.body !== resolution.local.body || root.local.local !== resolution.local.local) return null;
  } else if (resolution.kind === "declarations" && root.kind === "declarations") {
    if (resolution.definitions.length !== 1 || resolution.definitions[0] === undefined || root.definitions.length !== 1
      || root.definitions[0] !== resolution.definitions[0]) return null;
  } else return null;
  return place.value.write.value;
};

export const readWriteRootStorageOf: ReadWriteRootStorageOf = (place, resolution) => {
  const selected = writableRootStorageOf(place, resolution);
  return selected !== null && place.kind === "available" && place.value.read.kind === "available"
    && place.value.read.value === selected ? selected : null;
};
