import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { getReferenceClrIdentityKey } from "./clr-type-identity.js";
import { resolveLocalTypeInfo } from "./property-member-lookup.js";

type ReferenceIrType = Extract<IrType, { kind: "referenceType" }>;

export const getReferenceNominalIdentityKey = (
  type: ReferenceIrType,
  context: EmitterContext
): string | undefined => {
  if (type.typeId?.stableId) {
    return `id:${type.typeId.stableId}`;
  }

  const clrIdentity = getReferenceClrIdentityKey(type);
  if (clrIdentity) {
    return `clr:${clrIdentity}`;
  }

  const arity = type.typeArguments?.length ?? 0;
  const localInfo = resolveLocalTypeInfo(type, context);
  if (!localInfo) {
    return undefined;
  }

  const canonicalTarget = context.options.canonicalLocalTypeTargets?.get(
    `${localInfo.namespace}::${localInfo.name}`
  );
  return `local:${canonicalTarget ?? `${localInfo.namespace}.${localInfo.name}`}/${arity}`;
};

export const referenceTypesHaveNominalIdentity = (
  left: ReferenceIrType,
  right: ReferenceIrType,
  context: EmitterContext
): boolean =>
  getReferenceNominalIdentityKey(left, context) !== undefined ||
  getReferenceNominalIdentityKey(right, context) !== undefined;

export const referenceTypesShareNominalIdentity = (
  left: ReferenceIrType,
  right: ReferenceIrType,
  context: EmitterContext
): boolean => {
  const leftIdentity = getReferenceNominalIdentityKey(left, context);
  const rightIdentity = getReferenceNominalIdentityKey(right, context);
  return (
    leftIdentity !== undefined &&
    rightIdentity !== undefined &&
    leftIdentity === rightIdentity
  );
};
