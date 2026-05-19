import type { IrType } from "@tsonic/frontend";
import type { EmitterContext, LocalTypeInfo } from "../../types.js";
import { structuralInterfaceContractKey } from "./local-types.js";
import { stripNullish } from "./nullish-value-helpers.js";
import { resolveLocalTypeInfo } from "./property-lookup-resolution.js";

export const localInterfaceInfoEmitsAsNative = (
  localInfo: LocalTypeInfo | undefined,
  namespace: string | undefined,
  name: string | undefined,
  context: EmitterContext
): boolean =>
  localInfo?.kind === "interface" &&
  (localInfo.members.some((member) => member.kind === "methodSignature") ||
    (namespace !== undefined &&
      name !== undefined &&
      context.options.structuralInterfaceContracts?.has(
        structuralInterfaceContractKey(namespace, name)
      ) === true));

export const referenceTypeEmitsAsNativeInterface = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  const stripped = stripNullish(type);
  if (stripped.kind !== "referenceType") {
    return false;
  }

  const resolvedLocal = resolveLocalTypeInfo(stripped, context);
  return localInterfaceInfoEmitsAsNative(
    resolvedLocal?.info,
    resolvedLocal?.namespace,
    resolvedLocal?.name,
    context
  );
};
