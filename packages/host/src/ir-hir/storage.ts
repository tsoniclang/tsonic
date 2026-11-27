import type { CheckedMemberStorageOf, CheckedPhase, CheckedReferenceArgumentViewOf, CheckedSourceBindingFieldOf, CheckedSourceObjectHoldingOf, CheckedSourceObjectFieldsOf, CheckedSourceObjectRead, CheckedSourceStorageRead, CheckedVariableStorageOf,
  HirBody, HirCoreCapture, HirLocal, HirNode, PropertyAccessExpression, ReadWriteRootStorageOf, TypeNode, WritableRootStorageOf } from "./contract.js";
import type { DefId, LocalId, NodeId, TyId } from "../ids/contract.js";
import type { Member, ReferenceArgumentField, ReferenceArgumentView, SourceObjectField, SourceObjectFieldPresence, SourceObjectHolding, TypeTerm } from "../ir-types/contract.js";
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

function sourceObjectHolding<Proof>(accept: (holding: SourceObjectHolding, declaration: SourceObjectDeclaration) => Proof | null,
  ...[body, local, read]: Parameters<CheckedSourceObjectHoldingOf>): Proof | null {
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
  const { nodeOf, itemOf, admit } = read;
  const type = initial.checkerSlot.value;
  let inputs: { readonly body: HirBody; readonly local: LocalId }[] | null = null;
  let reached: Set<HirLocal> | null = null;
  let captured: Set<HirLocal> | null = null;
  let alias: DefId | null = null;
  let objectDeclaration: SourceObjectDeclaration | null = null;
  let current = initial.id;
  let currentBody = body;
  let localRow = initial;
  for (;;) {
    let actual: DefId | null = null;
    let actualDeclaration: SourceObjectDeclaration | null = null;
    for (;;) {
      if (reached?.has(localRow)) break;
      if (localRow.declaration.kind !== "item") return null;
      if (localRow.role === "capture") {
        if (captured?.has(localRow) || !admit(1, captured === null ? 2 : 1)) return null;
        const outer = captureStorage(currentBody, localRow, type, read);
        if (outer === null) return null;
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
        actualDeclaration = ordinaryObjectDeclaration(formal, formal.type, type, itemOf);
        if (actualDeclaration === null) return null;
        actual = actualDeclaration.kind === "TypeAliasDeclaration" ? actualDeclaration.tsonic.definition : localRow.declaration.value.owner;
        break;
      }
      if (localRow.role !== "binding" || !admit(1, 0)) return null;
      const declaration = nodeOf(localRow.declaration);
      if (declaration?.kind !== "VariableDeclaration" || declaration.id !== localRow.declaration.value.node
        || !("declaration" in declaration.tsonic) || declaration.origin.module !== currentBody.root.origin.module
        || declaration.tsonic.declaration.kind !== "local" || declaration.tsonic.declaration.local.body !== currentBody.body
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
      const initializer = unparenthesizedExpression<CheckedPhase>(declaration.initializer);
      if (initializer.kind !== "Identifier" || initializer.tsonic.role !== "value" || initializer.tsonic.resolution.kind !== "local"
        || initializer.tsonic.resolution.local.body !== currentBody.body || initializer.tsonic.resolution.local.local >= current
        || initializer.tsonic.value.views.read.kind !== "available" || initializer.tsonic.value.views.read.value !== type) return null;
      current = initializer.tsonic.resolution.local.local;
      if (!admit(1, 0)) return null;
      const next = currentBody.locals[current];
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
      reached?.add(localRow);
    }
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
  return alias === null || objectDeclaration === null ? null : accept({ local, declaration: alias, receiver: type }, objectDeclaration);
}

export const checkedSourceObjectHoldingOf: CheckedSourceObjectHoldingOf = (body, local, read) =>
  sourceObjectHolding(holding => holding, body, local, read);

type Property = Extract<HirNode, { readonly kind: "PropertySignature" }>;
type TypeLiteral = Extract<HirNode, { readonly kind: "TypeLiteral" }>;
type Access = PropertyAccessExpression<CheckedPhase>;
type FieldTypeOf = CheckedSourceObjectRead["typeOf"];
type FieldAdmission = CheckedSourceObjectRead["admit"];

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

export const checkedSourceObjectFieldsOf: CheckedSourceObjectFieldsOf = (body, read) => {
  const { nodeOf, itemOf, typeOf, admit } = read;
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
      field: reached.declaration, parent, requiredReference: presence === null ? value?.type ?? null : null, presence }, value };
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
      body, receiver.tsonic.resolution.local, read);
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
  position: number;
}

function directOrigin(origins: Member["origins"], declaration: DefId): boolean {
  const origin = origins[0];
  return origins.length === 1 && origin?.kind === "declared" && origin.declaration === declaration;
}

function referenceSurface(owner: DefId, syntax: TypeLiteral, type: TyId, read: CheckedSourceObjectRead): ReferenceSurface | null {
  if (!read.admit(1, 0)) return null;
  const term = read.typeOf(type);
  if (term?.kind !== "shape" || term.indexes.length !== 0 || term.calls.length !== 0 || term.constructs.length !== 0
    || term.members.length !== syntax.members.nodes.length || !read.admit(0, 1)) return null;
  return { owner, syntax, members: term.members };
}

function referenceField(surface: ReferenceSurface, member: Member, read: CheckedSourceObjectRead): ReferenceField | null {
  if (!read.admit(1, 0) || member.kind !== "property" || member.key.kind !== "text" || member.read === null
    || (member.readonly ? member.write !== null : member.write !== member.read)) return null;
  const origin = member.origins[0];
  if (member.origins.length !== 1 || origin?.kind !== "declared" || !directOrigin(member.readOrigins, origin.declaration)
    || (member.readonly ? member.writeOrigins.length !== 0 : !directOrigin(member.writeOrigins, origin.declaration))) return null;
  const field = qualifiedSourceField(surface.owner, surface.syntax, origin.declaration, read.itemOf);
  if (field === null || field.name.kind !== "Identifier" || (field.postfixToken?.kind === "QuestionToken") !== member.optional
    || !read.admit(field.name.text.length + member.key.value.length, 0) || field.name.text !== member.key.value) return null;
  const annotation = field.type;
  const declared = field.tsonic.declaredType;
  if (annotation === null || annotation.parent !== field.id || declared.kind !== "available" || declared.value === null
    || annotation.tsonic.type.kind !== "available" || annotation.tsonic.type.value !== declared.value) return null;
  const nested = fieldValue(field, read.typeOf, read.admit);
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

export const checkedReferenceArgumentViewOf: CheckedReferenceArgumentViewOf = (site, read) => {
  if (!read.admit(1, 0) || site.argument.body !== site.body.body || site.endpoint.role !== "api-body"
    || site.endpoint.body === null || site.formal.passing !== "by-value" || site.formal.kind === "rest"
    || !Number.isSafeInteger(site.ordinal) || site.ordinal < 0 || Object.is(site.ordinal, -0)) return null;
  let argument = read.nodeOf({ kind: "body", value: site.argument });
  if (argument?.id !== site.argument.node) return null;
  while (argument.kind === "ParenthesizedExpression") {
    if (!read.admit(1, 0)) return null;
    argument = argument.expression;
  }
  if (argument.kind !== "Identifier" || argument.tsonic.role !== "value" || argument.tsonic.resolution.kind !== "local"
    || argument.tsonic.value.views.read.kind !== "available" || argument.tsonic.value.views.read.value !== site.caller
    || !read.admit(1, 0)) return null;
  const caller = sourceObjectHolding((holding, declaration) => holding.receiver === site.caller && declaration.type?.kind === "TypeLiteral"
    ? referenceSurface(holding.declaration, declaration.type, site.caller, read) : null,
  site.body, argument.tsonic.resolution.local, read);
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
  const declaration = ordinaryObjectDeclaration(parameter, parameter.type, site.formal.type, read.itemOf);
  if (declaration?.type?.kind !== "TypeLiteral") return null;
  const owner = declaration.kind === "TypeAliasDeclaration" ? declaration.tsonic.definition : site.formal.declaration;
  const formal = referenceSurface(owner, declaration.type, site.formal.type, read);
  if (formal === null || !read.admit(1, 4)) return null;
  const fields: ReferenceArgumentField[] = [];
  const result: ReferenceArgumentView = { caller: site.caller, formal: site.formal.type, fields };
  const pending: ReferenceFrame[] = [{ caller, formal, parent: null, position: 0 }];
  while (pending.length !== 0) {
    if (!read.admit(1, 0)) return null;
    const frame = pending[pending.length - 1];
    if (frame === undefined || frame.caller.members.length !== frame.formal.members.length) return null;
    if (frame.position === frame.caller.members.length) {
      pending.pop();
      continue;
    }
    const argumentMember = frame.caller.members[frame.position];
    const formalMember = frame.formal.members[frame.position];
    frame.position += 1;
    if (argumentMember?.key.kind !== "text" || formalMember?.key.kind !== "text"
      || argumentMember.readonly !== formalMember.readonly || argumentMember.optional !== formalMember.optional
      || !read.admit(argumentMember.key.value.length + formalMember.key.value.length, 0)
      || compareMemberKeys(argumentMember.key, formalMember.key) !== 0) return null;
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
      const caller = referenceSurface(source.declaration, source.nested.container, source.nested.type, read);
      if (caller === null) return null;
      const formal = referenceSurface(destination.declaration, destination.nested.container, destination.nested.type, read);
      if (formal === null || !read.admit(1, 1)) return null;
      pending.push({ caller, formal, parent: fields.length, position: 0 });
    }
    if (!read.admit(1, 1)) return null;
    fields.push({ parent: frame.parent, caller: source.declaration, formal: destination.declaration,
      callerType: source.type, formalType: destination.type });
  }
  return result;
};

export const checkedSourceBindingFieldOf: CheckedSourceBindingFieldOf = (body, element, key, definition, read) => {
  const { nodeOf, itemOf, typeOf, admit } = read;
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
      : { ...holding, occurrence, field: definition, parent: null, requiredReference: value?.presence === null ? value.type : null,
        presence: value?.presence ?? null };
  }, body, receiver.tsonic.resolution.local, read);
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
