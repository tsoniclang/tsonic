import type { CheckedMemberStorageOf, CheckedPhase, CheckedSourceObjectHoldingOf, CheckedSourceObjectFieldOf, CheckedVariableStorageOf, HirCoreCapture,
  HirNode, ReadWriteRootStorageOf, TypeNode, WritableRootStorageOf } from "./contract.js";
import type { DefId, LocalId, TyId } from "../ids/contract.js";
import { compareMemberKeys } from "../ir-types/index.js";
import { unparenthesizedExpression } from "./walk.js";

function ordinaryObjectRepresentation(core: HirCoreCapture): boolean {
  return core.provider.kind === "available" && core.provider.value === null && core.markers.kind === "available"
    && core.markers.value.struct === null && core.markers.value.field === null && !core.markers.value.jsString;
}

function ordinaryObjectDeclaration(owner: DefId, annotation: TypeNode<CheckedPhase> | null, type: TyId,
  itemOf: (definition: DefId) => HirNode | null): DefId | null {
  if (annotation === null || annotation.tsonic.type.kind !== "available" || annotation.tsonic.type.value !== type) return null;
  if (annotation.kind === "TypeLiteral") return ordinaryObjectRepresentation(annotation.tsonic.core) ? owner : null;
  if (annotation.kind !== "TypeReference" || annotation.typeArguments !== null) return null;
  const owners = annotation.tsonic.referencedDefinitions;
  const declaration = owners[0];
  if (owners.length !== 1 || declaration === undefined) return null;
  const alias = itemOf(declaration);
  if (alias?.kind !== "TypeAliasDeclaration" || alias.tsonic.definition !== declaration || alias.type.kind !== "TypeLiteral"
    || alias.typeParameters !== null || alias.tsonic.type.kind !== "available" || alias.tsonic.type.value !== type
    || !ordinaryObjectRepresentation(alias.tsonic.core) || !ordinaryObjectRepresentation(alias.type.tsonic.core)) return null;
  return declaration;
}

export const checkedSourceObjectHoldingOf: CheckedSourceObjectHoldingOf = (body, local, nodeOf, itemOf, admitAlias) => {
  if (local.body !== body.body) return null;
  const initial = body.locals[local.local];
  if (initial?.id !== local.local || initial.checkerSlot.kind !== "available") return null;
  const type = initial.checkerSlot.value;
  let inputs: LocalId[] | null = null;
  let reached: Set<LocalId> | null = null;
  let alias: DefId | null = null;
  let current = local.local;
  let localRow = initial;
  for (;;) {
    let actual: DefId | null = null;
    for (;;) {
      if (reached?.has(current)) break;
      if (localRow.declaration.kind !== "item") return null;
      if (localRow.role === "parameter") {
        const formal = nodeOf(localRow.declaration);
        if (formal?.kind !== "Parameter" || formal.tsonic.parent !== body.owner || formal.tsonic.declaration.kind !== "local"
          || formal.tsonic.declaration.local.body !== local.body || formal.tsonic.declaration.local.local !== current
          || formal.dotDotDotToken !== null || formal.tsonic.declaredType.kind !== "available" || formal.tsonic.declaredType.value !== type) return null;
        const passing = formal.tsonic.core.argumentPassing;
        if (passing.kind !== "available" || passing.value !== null &&
          (passing.value.role !== "declaration" || passing.value.mode !== "by-value")) return null;
        actual = ordinaryObjectDeclaration(localRow.declaration.value.owner, formal.type, type, itemOf);
        if (actual === null) return null;
        break;
      }
      if (localRow.role !== "binding" || !admitAlias()) return null;
      const declaration = nodeOf(localRow.declaration);
      if (declaration?.kind !== "VariableDeclaration" || declaration.id !== localRow.declaration.value.node
        || !("declaration" in declaration.tsonic) || declaration.origin.module !== body.root.origin.module
        || declaration.tsonic.declaration.kind !== "local" || declaration.tsonic.declaration.local.body !== local.body
        || declaration.tsonic.declaration.local.local !== current || checkedVariableStorageOf(declaration) !== type) return null;
      if (declaration.type !== null) {
        actual = ordinaryObjectDeclaration(localRow.declaration.value.owner, declaration.type, type, itemOf);
        if (actual === null) return null;
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
  return alias === null ? null : { local, declaration: alias, receiver: type };
};

export const checkedSourceObjectFieldOf: CheckedSourceObjectFieldOf = (body, access, nodeOf, itemOf, admitAlias) => {
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
  const receiver = unparenthesizedExpression<CheckedPhase>(access.expression);
  if (receiver.kind !== "Identifier" || receiver.tsonic.role !== "value" || receiver.tsonic.resolution.kind !== "local") return null;
  const formal = checkedSourceObjectHoldingOf(body, receiver.tsonic.resolution.local, nodeOf, itemOf, admitAlias);
  if (formal === null) return null;
  const declaration = itemOf(formal.declaration);
  if (declaration?.kind !== "TypeAliasDeclaration" && declaration?.kind !== "Parameter" && declaration?.kind !== "VariableDeclaration"
    || declaration.type?.kind !== "TypeLiteral") return null;
  const field = itemOf(origin.declaration);
  if (field?.kind !== "PropertySignature" || field.postfixToken !== null || field.tsonic.parent !== formal.declaration
    || field.parent !== declaration.type.id
    || field.tsonic.declaration.kind !== "definition" || field.tsonic.declaration.definition !== origin.declaration
    || !ordinaryObjectRepresentation(field.tsonic.core)) return null;
  return { ...formal, occurrence: { body: body.body, node: access.id }, field: origin.declaration };
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
