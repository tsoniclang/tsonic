import type { CheckedPhase, CheckedSourceObjectParameterOf, CheckedVariableStorageOf, HirCoreCapture,
  ReadWriteRootStorageOf, WritableRootStorageOf } from "./contract.js";
import { unparenthesizedExpression } from "./walk.js";

function ordinaryObjectRepresentation(core: HirCoreCapture): boolean {
  return core.provider.kind === "available" && core.provider.value === null && core.markers.kind === "available"
    && core.markers.value.struct === null && core.markers.value.field === null && !core.markers.value.jsString;
}

export const checkedSourceObjectParameterOf: CheckedSourceObjectParameterOf = (body, access, nodeOf, itemOf) => {
  if (access.questionDotToken !== null || access.tsonic.role !== "value" || access.tsonic.origins.kind !== "available"
    || access.tsonic.origins.value.length !== 1 || access.tsonic.accessor.kind !== "available" || access.tsonic.accessor.value !== null) return null;
  const origin = access.tsonic.origins.value[0];
  if (origin?.kind !== "declared") return null;
  const receiver = unparenthesizedExpression<CheckedPhase>(access.expression);
  if (receiver.kind !== "Identifier" || receiver.tsonic.role !== "value" || receiver.tsonic.resolution.kind !== "local") return null;
  const local = receiver.tsonic.resolution.local;
  if (local.body !== body.body) return null;
  const localRow = body.locals[local.local];
  if (localRow?.id !== local.local || localRow.role !== "parameter" || localRow.declaration.kind !== "item"
    || localRow.checkerSlot.kind !== "available") return null;
  const formal = nodeOf(localRow.declaration);
  const type = localRow.checkerSlot.value;
  if (formal?.kind !== "Parameter" || formal.tsonic.parent !== body.owner || formal.tsonic.declaration.kind !== "local"
    || formal.tsonic.declaration.local.body !== local.body || formal.tsonic.declaration.local.local !== local.local
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
  const field = itemOf(origin.declaration);
  if (field?.kind !== "PropertySignature" || field.postfixToken !== null || field.tsonic.parent !== declaration
    || field.tsonic.declaration.kind !== "definition" || field.tsonic.declaration.definition !== origin.declaration
    || !ordinaryObjectRepresentation(field.tsonic.core)) return null;
  return { occurrence: { body: body.body, node: access.id }, local, declaration, field: origin.declaration, receiver: type };
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
