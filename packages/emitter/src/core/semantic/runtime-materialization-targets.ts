import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { getIdentifierTypeName } from "../format/backend-ast/utils.js";
import {
  resolveLocalTypeInfo,
  resolveTypeAlias,
  substituteTypeArgs,
} from "./type-resolution.js";
import { expandRuntimeUnionMembers } from "./runtime-union-expansion.js";

export const resolveRuntimeMaterializationTargetType = (
  target: IrType,
  context: EmitterContext
): IrType => {
  if (target.kind === "referenceType") {
    const typeInfoResult = resolveLocalTypeInfo(target, context);
    const typeInfo = typeInfoResult?.info;
    if (typeInfo?.kind === "typeAlias") {
      if (typeInfo.type.kind === "objectType") {
        return target;
      }

      const substituted =
        target.typeArguments && target.typeArguments.length > 0
          ? substituteTypeArgs(
              typeInfo.type,
              typeInfo.typeParameters,
              target.typeArguments
            )
          : typeInfo.type;
      return resolveRuntimeMaterializationTargetType(substituted, context);
    }
  }

  if (target.kind === "referenceType" && target.typeArguments?.length) {
    const importBinding = context.importBindings?.get(target.name);
    const clrName =
      importBinding?.kind === "type"
        ? (getIdentifierTypeName(importBinding.typeAst) ?? "")
        : "";
    if (clrName.endsWith(".ExtensionMethods")) {
      const shape = target.typeArguments[0];
      if (shape) {
        return resolveRuntimeMaterializationTargetType(shape, context);
      }
    }
  }

  if (target.kind === "intersectionType") {
    for (const part of target.types) {
      const resolved = resolveRuntimeMaterializationTargetType(part, context);
      if (
        resolved.kind !== "intersectionType" &&
        resolved.kind !== "objectType"
      ) {
        return resolved;
      }
    }

    const fallback = target.types[0];
    return fallback
      ? resolveRuntimeMaterializationTargetType(fallback, context)
      : target;
  }

  if (target.kind === "unionType") {
    const expandedMembers = expandRuntimeUnionMembers(target, context);
    if (expandedMembers.length === 0) {
      return target;
    }

    if (expandedMembers.length === 1) {
      return expandedMembers[0] ?? target;
    }

    return {
      kind: "unionType",
      types: expandedMembers,
    };
  }

  const resolved = resolveTypeAlias(target, context);
  if (resolved !== target) {
    if (target.kind === "referenceType" && resolved.kind === "objectType") {
      return target;
    }
    return resolveRuntimeMaterializationTargetType(resolved, context);
  }

  return target;
};
