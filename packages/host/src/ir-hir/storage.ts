import type { CheckedMemberStorageOf, CheckedPhase, CheckedSourceBindingFieldOf, CheckedSourceObjectHoldingOf, CheckedSourceObjectFieldsOf, CheckedVariableStorageOf,
  HirCoreCapture, HirNode, PropertyAccessExpression, ReadWriteRootStorageOf, TypeNode, WritableRootStorageOf } from "./contract.js";
import type { DefId, LocalId, NodeId, TyId } from "../ids/contract.js";
import type { SourceObjectField, SourceObjectFieldPresence, SourceObjectHolding } from "../ir-types/contract.js";
import { compareMemberKeys } from "../ir-types/index.js";
import { unparenthesizedExpression } from "./walk.js";

function ordinaryObjectRepresentation(core: HirCoreCapture): boolean {
  return core.provider.kind === "available" && core.provider.value === null && core.markers.kind === "available"
    && core.markers.value.struct === null && core.markers.value.field === null && !core.markers.value.jsString;
}

type SourceObjectDeclaration = Extract<HirNode, { readonly kind: "TypeAliasDeclaration" | "JSTypeAliasDeclaration" | "Parameter" | "VariableDeclaration" }>;

function ordinaryObjectDeclaration(declaration: SourceObjectDeclaration, annotation: TypeNode<CheckedPhase> | null, type: TyId,
  itemOf: (definition: DefId) => HirNode | null): SourceObjectDeclaration | null {
  if (annotation === null || annotation.tsonic.type.kind !== "available" || annotation.tsonic.type.value !== type) return null;
  if (annotation.kind === "TypeLiteral") return ordinaryObjectRepresentation(annotation.tsonic.core) ? declaration : null;
  if (annotation.kind !== "TypeReference" || annotation.typeArguments !== null) return null;
  const owners = annotation.tsonic.referencedDefinitions;
  const definition = owners[0];
  if (owners.length !== 1 || definition === undefined) return null;
  const alias = itemOf(definition);
  if (alias?.kind !== "TypeAliasDeclaration" || alias.tsonic.definition !== definition || alias.type.kind !== "TypeLiteral"
    || alias.typeParameters !== null || alias.tsonic.type.kind !== "available" || alias.tsonic.type.value !== type
    || !ordinaryObjectRepresentation(alias.tsonic.core) || !ordinaryObjectRepresentation(alias.type.tsonic.core)) return null;
  return alias;
}

function sourceObjectHolding<Proof>(accept: (holding: SourceObjectHolding, declaration: SourceObjectDeclaration) => Proof | null,
  ...[body, local, nodeOf, itemOf, admitAlias]: Parameters<CheckedSourceObjectHoldingOf>): Proof | null {
  if (local.body !== body.body) return null;
  const initial = body.locals[local.local];
  if (initial?.id !== local.local || initial.checkerSlot.kind !== "available") return null;
  const type = initial.checkerSlot.value;
  let inputs: LocalId[] | null = null;
  let reached: Set<LocalId> | null = null;
  let alias: DefId | null = null;
  let objectDeclaration: SourceObjectDeclaration | null = null;
  let current = local.local;
  let localRow = initial;
  for (;;) {
    let actual: DefId | null = null;
    let actualDeclaration: SourceObjectDeclaration | null = null;
    for (;;) {
      if (reached?.has(current)) break;
      if (localRow.declaration.kind !== "item") return null;
      if (localRow.role === "parameter") {
        const formal = nodeOf(localRow.declaration);
        if (formal?.kind !== "Parameter" || formal.id !== localRow.declaration.value.node || formal.tsonic.parent !== body.owner
          || formal.tsonic.declaration.kind !== "local"
          || formal.tsonic.declaration.local.body !== local.body || formal.tsonic.declaration.local.local !== current
          || formal.dotDotDotToken !== null || formal.tsonic.declaredType.kind !== "available" || formal.tsonic.declaredType.value !== type) return null;
        const passing = formal.tsonic.core.argumentPassing;
        if (passing.kind !== "available" || passing.value !== null &&
          (passing.value.role !== "declaration" || passing.value.mode !== "by-value")) return null;
        actualDeclaration = ordinaryObjectDeclaration(formal, formal.type, type, itemOf);
        if (actualDeclaration === null) return null;
        actual = actualDeclaration.kind === "TypeAliasDeclaration" ? actualDeclaration.tsonic.definition : localRow.declaration.value.owner;
        break;
      }
      if (localRow.role !== "binding" || !admitAlias()) return null;
      const declaration = nodeOf(localRow.declaration);
      if (declaration?.kind !== "VariableDeclaration" || declaration.id !== localRow.declaration.value.node
        || !("declaration" in declaration.tsonic) || declaration.origin.module !== body.root.origin.module
        || declaration.tsonic.declaration.kind !== "local" || declaration.tsonic.declaration.local.body !== local.body
        || declaration.tsonic.declaration.local.local !== current || checkedVariableStorageOf(declaration) !== type) return null;
      if (declaration.type !== null) {
        actualDeclaration = ordinaryObjectDeclaration(declaration, declaration.type, type, itemOf);
        if (actualDeclaration === null) return null;
        actual = actualDeclaration.kind === "TypeAliasDeclaration" ? actualDeclaration.tsonic.definition : localRow.declaration.value.owner;
        break;
      }
      if (declaration.initializer === null || declaration.tsonic.initializer === null) return null;
      if (localRow.mutable) {
        const bound = declaration.tsonic.inferredTypeBound;
        if (bound?.kind !== "available" || typeof bound.value === "number" || bound.value.sources === null
          || bound.value.sources.length === 0) return null;
        actual = bound.value.alias;
        if (alias !== null && alias !== actual) return null;
        reached ??= new Set<LocalId>();
        inputs ??= [];
        for (let index = 0; index < bound.value.sources.length; index += 1) {
          if (!admitAlias()) return null;
          const source = bound.value.sources[index];
          if (source === undefined) return null;
          inputs.push(source);
        }
        break;
      }
      const initializer = unparenthesizedExpression<CheckedPhase>(declaration.initializer);
      if (initializer.kind !== "Identifier" || initializer.tsonic.role !== "value" || initializer.tsonic.resolution.kind !== "local"
        || initializer.tsonic.resolution.local.body !== local.body || initializer.tsonic.resolution.local.local >= current
        || initializer.tsonic.value.views.read.kind !== "available" || initializer.tsonic.value.views.read.value !== type) return null;
      current = initializer.tsonic.resolution.local.local;
      if (!admitAlias()) return null;
      const next = body.locals[current];
      if (next?.id !== current || next.checkerSlot.kind !== "available" || next.checkerSlot.value !== type) return null;
      localRow = next;
    }
    if (actual !== null) {
      alias ??= actual;
      if (alias !== actual) return null;
      if (actualDeclaration !== null) {
        objectDeclaration ??= actualDeclaration;
        if (objectDeclaration !== actualDeclaration) return null;
      }
      reached?.add(current);
    }
    if (inputs === null || inputs.length === 0) break;
    if (!admitAlias()) return null;
    const incoming = inputs.pop();
    if (incoming === undefined) return null;
    current = incoming;
    const next = body.locals[current];
    if (next?.id !== current || next.checkerSlot.kind !== "available" || next.checkerSlot.value !== type) return null;
    localRow = next;
  }
  return alias === null || objectDeclaration === null ? null : accept({ local, declaration: alias, receiver: type }, objectDeclaration);
}

export const checkedSourceObjectHoldingOf: CheckedSourceObjectHoldingOf = (body, local, nodeOf, itemOf, admitAlias) =>
  sourceObjectHolding(holding => holding, body, local, nodeOf, itemOf, admitAlias);

type Property = Extract<HirNode, { readonly kind: "PropertySignature" }>;
type TypeLiteral = Extract<HirNode, { readonly kind: "TypeLiteral" }>;
type Access = PropertyAccessExpression<CheckedPhase>;
type FieldTypeOf = Parameters<CheckedSourceObjectFieldsOf>[3];
type FieldAdmission = Parameters<CheckedSourceObjectFieldsOf>[4];

interface FieldValue {
  readonly type: TyId;
  readonly container: TypeLiteral;
  readonly presence: SourceObjectFieldPresence | null;
}

function fieldValue(property: Property, typeOf: FieldTypeOf, admit: FieldAdmission): FieldValue | null | undefined {
  if (!admit(1, 0)) return undefined;
  const annotation = property.type;
  const declared = property.tsonic.declaredType;
  if (annotation === null || annotation.parent !== property.id || declared.kind !== "available" || declared.value === null
    || annotation.tsonic.type.kind !== "available" || annotation.tsonic.type.value !== declared.value) return null;
  if (annotation.kind === "TypeLiteral" && ordinaryObjectRepresentation(annotation.tsonic.core)) {
    if (!admit(1, 0)) return undefined;
    if (typeOf(declared.value)?.kind !== "shape") return null;
    return admit(1, 1) ? { type: declared.value, container: annotation, presence: null } : undefined;
  }
  if (annotation.kind !== "UnionType" || annotation.types.nodes.length !== 2) return null;
  if (!admit(1, 0)) return undefined;
  const storage = typeOf(declared.value);
  if (storage?.kind !== "optional") return null;
  let present: TypeLiteral | null = null;
  let absent = false;
  for (let ordinal = 0; ordinal < 2; ordinal += 1) {
    if (!admit(1, 0)) return undefined;
    const arm = annotation.types.nodes[ordinal];
    if (arm === undefined || arm.parent !== annotation.id || arm.tsonic.type.kind !== "available") return null;
    if (arm.kind === "TypeLiteral") {
      if (present !== null || arm.tsonic.type.value !== storage.value || !ordinaryObjectRepresentation(arm.tsonic.core)) return null;
      if (!admit(1, 0)) return undefined;
      if (typeOf(storage.value)?.kind !== "shape") return null;
      present = arm;
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

export const checkedSourceObjectFieldsOf: CheckedSourceObjectFieldsOf = (body, nodeOf, itemOf, typeOf, admit) => {
  let fields: Map<NodeId, CheckedField> | null = null;
  const select = (reached: ReachedField, holding: SourceObjectHolding, container: TypeLiteral, parent: SourceObjectField | null): CheckedField | null => {
    if (!admit(1, 0)) return null;
    const property = qualifiedSourceField(holding.declaration, container, reached.declaration, itemOf);
    if (property === null) return null;
    const value = fieldValue(property, typeOf, admit);
    if (value === undefined) return null;
    const access = reached.access;
    const payload = access.tsonic;
    const presence = value?.presence ?? null;
    if (presence !== null && (payload.role === "assignment-target" ? checkedMemberStorageOf(access)?.write !== presence.storage
      : payload.role !== "value" || payload.value.views.read.kind !== "available"
        || payload.value.views.read.value !== presence.storage && payload.value.views.read.value !== presence.present)) return null;
    if (!admit(1, fields === null ? 5 : 4)) return null;
    const row: CheckedField = { access, proof: { ...holding, occurrence: { body: body.body, node: access.id },
      field: reached.declaration, parent, presence }, value };
    (fields ??= new Map()).set(access.id, row);
    return row;
  };
  const field: ReturnType<CheckedSourceObjectFieldsOf>["field"] = access => {
    let current = access;
    let pending: ReachedField[] | null = null;
    let visited: Set<Access> | null = null;
    let ready: CheckedField | null;
    for (;;) {
      if (!admit(1, 0)) return null;
      const prior = fields?.get(current.id);
      if (prior !== undefined) {
        if (prior.access !== current) return null;
        ready = prior;
        break;
      }
      if (visited?.has(current) === true || nodeOf({ kind: "body", value: { body: body.body, node: current.id } }) !== current) return null;
      const declaration = selectedField(current);
      if (declaration === null) return null;
      let receiver = current.expression;
      while (receiver.kind === "ParenthesizedExpression") {
        if (!admit(1, 0)) return null;
        receiver = receiver.expression;
      }
      if (receiver.kind === "PropertyAccessExpression") {
        if (!admit(1, pending === null ? 5 : 3)) return null;
        (visited ??= new Set()).add(current);
        (pending ??= []).push({ access: current, declaration });
        current = receiver;
        continue;
      }
      if (receiver.kind !== "Identifier" || receiver.tsonic.role !== "value" || receiver.tsonic.resolution.kind !== "local"
        || !admit(0, 1)) return null;
      ready = sourceObjectHolding((holding, owner) => owner.type?.kind === "TypeLiteral"
        ? select({ access: current, declaration }, holding, owner.type, null) : null,
      body, receiver.tsonic.resolution.local, nodeOf, itemOf, () => admit(1, 0));
      break;
    }
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
    return ready?.proof ?? null;
  };
  return { field, ready: node => fields?.get(node)?.proof ?? null };
};

function qualifiedSourceField(owner: DefId, container: TypeLiteral, definition: DefId, itemOf: (definition: DefId) => HirNode | null) {
  const field = itemOf(definition);
  if (field?.kind !== "PropertySignature" || field.postfixToken?.kind === "ExclamationToken" || field.tsonic.parent !== owner
    || field.parent !== container.id
    || field.tsonic.declaration.kind !== "definition" || field.tsonic.declaration.definition !== definition
    || !ordinaryObjectRepresentation(field.tsonic.core)) return null;
  return field;
}

export const checkedSourceBindingFieldOf: CheckedSourceBindingFieldOf = (body, element, key, definition, nodeOf, itemOf, typeOf, admit) => {
  const occurrence = { body: body.body, node: element.id };
  if (!admit(1, 0) || nodeOf({ kind: "body", value: occurrence }) !== element || element.parent === null
    || element.name?.kind !== "Identifier" || element.dotDotDotToken !== null || key.kind !== "text") return null;
  const written = element.propertyName;
  if (written !== null && (written.kind !== "Identifier" || written.tsonic.role !== "property-name"
    || written.tsonic.key.kind !== "available" || written.tsonic.key.value.kind !== "text" || written.tsonic.key.value.value !== written.text)) return null;
  const selector = written?.text ?? element.name.text;
  if (!admit(key.value.length + selector.length, 0) || key.value !== selector) return null;
  const pattern = nodeOf({ kind: "body", value: { body: body.body, node: element.parent } });
  if (pattern?.kind !== "ObjectBindingPattern" || pattern.parent === null || !admit(1, 0)) return null;
  const owner = nodeOf({ kind: "body", value: { body: body.body, node: pattern.parent } });
  if (owner?.kind !== "VariableDeclaration" || owner.name !== pattern || owner.initializer === null) return null;
  const receiver = unparenthesizedExpression<CheckedPhase>(owner.initializer);
  if (receiver.kind !== "Identifier" || receiver.tsonic.role !== "value" || receiver.tsonic.resolution.kind !== "local") return null;
  return sourceObjectHolding((holding, declaration) => {
    if (declaration.type?.kind !== "TypeLiteral" || !admit(1, 0)) return null;
    const field = qualifiedSourceField(holding.declaration, declaration.type, definition, itemOf);
    if (field?.name.kind !== "Identifier" || !admit(field.name.text.length + key.value.length, 0) || field.name.text !== key.value) return null;
    const value = fieldValue(field, typeOf, admit);
    return value === undefined || !admit(0, 1) ? null
      : { ...holding, occurrence, field: definition, parent: null, presence: value?.presence ?? null };
  }, body, receiver.tsonic.resolution.local, nodeOf, itemOf, () => admit(1, 0));
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
