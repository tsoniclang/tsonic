import type { CheckedMemberStorageOf, CheckedPhase, CheckedSourceObjectHoldingOf, CheckedSourceObjectFieldOf, CheckedVariableStorageOf, HirCoreCapture,
  ReadWriteRootStorageOf, WritableRootStorageOf } from "./contract.js";
import { compareMemberKeys } from "../ir-types/index.js";
import { unparenthesizedExpression } from "./walk.js";

function ordinaryObjectRepresentation(core: HirCoreCapture): boolean {
  return core.provider.kind === "available" && core.provider.value === null && core.markers.kind === "available"
    && core.markers.value.struct === null && core.markers.value.field === null && !core.markers.value.jsString;
}

export const checkedSourceObjectHoldingOf: CheckedSourceObjectHoldingOf = (body, local, nodeOf, itemOf, admitAlias) => {
  if (local.body !== body.body) return null;
  let current = local.local;
  let localRow = body.locals[current];
  if (localRow?.id !== current || localRow.checkerSlot.kind !== "available") return null;
  const type = localRow.checkerSlot.value;
  while (localRow.role === "binding") {
    if (!admitAlias() || localRow.mutable || localRow.declaration.kind !== "item") return null;
    const declaration = nodeOf(localRow.declaration);
    if (declaration?.kind !== "VariableDeclaration" || declaration.id !== localRow.declaration.value.node
      || declaration.origin.module !== body.root.origin.module || declaration.initializer === null || declaration.tsonic.initializer === null
      || declaration.tsonic.declaration.kind !== "local" || declaration.tsonic.declaration.local.body !== local.body
      || declaration.tsonic.declaration.local.local !== current || checkedVariableStorageOf(declaration) !== type) return null;
    const initializer = unparenthesizedExpression<CheckedPhase>(declaration.initializer);
    if (initializer.kind !== "Identifier" || initializer.tsonic.role !== "value" || initializer.tsonic.resolution.kind !== "local"
      || initializer.tsonic.resolution.local.body !== local.body || initializer.tsonic.resolution.local.local >= current
      || initializer.tsonic.value.views.read.kind !== "available" || initializer.tsonic.value.views.read.value !== type) return null;
    current = initializer.tsonic.resolution.local.local;
    if (!admitAlias()) return null;
    localRow = body.locals[current];
    if (localRow?.id !== current || localRow.checkerSlot.kind !== "available" || localRow.checkerSlot.value !== type) return null;
  }
  if (localRow.role !== "parameter" || localRow.declaration.kind !== "item") return null;
  const formal = nodeOf(localRow.declaration);
  if (formal?.kind !== "Parameter" || formal.tsonic.parent !== body.owner || formal.tsonic.declaration.kind !== "local"
    || formal.tsonic.declaration.local.body !== local.body || formal.tsonic.declaration.local.local !== current
    || formal.type?.kind !== "TypeReference" || formal.type.typeArguments !== null || formal.dotDotDotToken !== null
    || formal.tsonic.declaredType.kind !== "available" || formal.tsonic.declaredType.value !== type
    || formal.type.tsonic.type.kind !== "available" || formal.type.tsonic.type.value !== type) return null;
  const passing = formal.tsonic.core.argumentPassing;
  if (passing.kind !== "available" || passing.value !== null && (passing.value.role !== "declaration" || passing.value.mode !== "by-value")) return null;
  const owners = formal.type.tsonic.referencedDefinitions;
  const declaration = owners[0];
  if (owners.length !== 1 || declaration === undefined) return null;
  const alias = itemOf(declaration);
  if (alias?.kind !== "TypeAliasDeclaration" || alias.tsonic.definition !== declaration || alias.type.kind !== "TypeLiteral"
    || alias.typeParameters !== null || alias.tsonic.type.kind !== "available" || alias.tsonic.type.value !== type
    || !ordinaryObjectRepresentation(alias.tsonic.core) || !ordinaryObjectRepresentation(alias.type.tsonic.core)) return null;
  return { local, declaration, receiver: type };
};

export const checkedSourceObjectFieldOf: CheckedSourceObjectFieldOf = (body, access, nodeOf, itemOf, admitAlias) => {
  if (access.questionDotToken !== null || access.tsonic.origins.kind !== "available"
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
  const field = itemOf(origin.declaration);
  if (field?.kind !== "PropertySignature" || field.postfixToken !== null || field.tsonic.parent !== formal.declaration
    || field.tsonic.declaration.kind !== "definition" || field.tsonic.declaration.definition !== origin.declaration
    || !ordinaryObjectRepresentation(field.tsonic.core)) return null;
  return { ...formal, occurrence: { body: body.body, node: access.id }, field: origin.declaration };
};

export const checkedMemberStorageOf: CheckedMemberStorageOf = access => {
  const target = access.tsonic;
  if (target.role !== "assignment-target" || target.place.kind !== "available" || access.questionDotToken !== null
    || access.name.kind !== "Identifier" || access.name.tsonic.role !== "property-name" || access.name.tsonic.key.kind !== "available")
    return null;
  const { base, step, read, write } = target.place.value;
  if (base.kind !== "receiver" || base.node !== access.expression.id || step?.kind !== "member"
    || compareMemberKeys(step.key, access.name.tsonic.key.value) !== 0 || write.kind !== "available" || write.value === null) return null;
  return target.access === "read-write"
    ? read.kind === "available" ? { read: read.value, write: write.value } : null
    : read.kind === "unavailable" && read.reason === "not-provided" ? { read: null, write: write.value } : null;
};

export const checkedVariableStorageOf: CheckedVariableStorageOf = declaration => {
  const { declaredType, inferredTypeBound } = declaration.tsonic;
  if (declaredType.kind !== "available") return null;
  if (declaredType.value !== null) return declaredType.value;
  return inferredTypeBound?.kind === "available" ? inferredTypeBound.value : null;
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
