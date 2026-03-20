import { IrPropertyDeclaration, IrType, stableIrTypeKey } from "@tsonic/frontend";
import {
  resolveTypeAlias,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import type { EmitterContext } from "../types.js";
import type { LocalTypeInfo } from "../emitter-types/core.js";
import { parseBindingPropertyType } from "./structural-property-model.js";

export const resolveAnonymousStructuralReferenceType = (
  type: IrType,
  context: EmitterContext
): IrType | undefined => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind !== "objectType") return undefined;

  const currentNamespace =
    context.moduleNamespace ?? context.options.rootNamespace;
  const targetProps = resolved.members
    .filter(
      (
        member
      ): member is Extract<
        typeof member,
        { kind: "propertySignature"; name: string }
      > => member.kind === "propertySignature"
    )
    .map((member) => ({
      name: member.name,
      isOptional: member.isOptional,
      typeKey: stableIrTypeKey(member.type),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  if (targetProps.length === 0) return undefined;

  const matches: {
    readonly key: string;
    readonly name: string;
    readonly resolvedClrType: string;
    readonly isExternal: boolean;
  }[] = [];
  const collectMatches = (
    localTypes: ReadonlyMap<string, LocalTypeInfo>,
    namespace: string
  ): void => {
    for (const [typeName, info] of localTypes.entries()) {
      if (info.kind !== "class" || !typeName.startsWith("__Anon_")) continue;
      const candidateProps = info.members
        .filter(
          (member): member is IrPropertyDeclaration & { type: IrType } =>
            member.kind === "propertyDeclaration" && member.type !== undefined
        )
        .map((member) => ({
          name: member.name,
          isOptional: false,
          typeKey: stableIrTypeKey(member.type),
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
      if (
        candidateProps.length === targetProps.length &&
        candidateProps.every(
          (prop, index) =>
            prop.name === targetProps[index]?.name &&
            prop.isOptional === targetProps[index]?.isOptional &&
            prop.typeKey === targetProps[index]?.typeKey
        )
      ) {
        const resolvedClrType = `${namespace}.${typeName}`;
        matches.push({
          key: resolvedClrType,
          name: typeName,
          resolvedClrType,
          isExternal: namespace !== currentNamespace,
        });
      }
    }
  };

  if (context.localTypes) {
    collectMatches(context.localTypes, currentNamespace);
  }
  if (context.options.moduleMap) {
    for (const module of context.options.moduleMap.values()) {
      if (module.localTypes) {
        collectMatches(module.localTypes, module.namespace);
      }
    }
  }

  const registry = context.bindingsRegistry;
  if (registry && registry.size > 0) {
    for (const binding of registry.values()) {
      const simpleAlias = binding.alias.split(".").pop() ?? binding.alias;
      const simpleName = binding.name.split(".").pop() ?? binding.name;
      if (
        !simpleAlias.startsWith("__Anon_") &&
        !simpleName.startsWith("__Anon_")
      ) {
        continue;
      }
      if (binding.members.some((member) => member.kind === "method")) continue;

      const candidateProps = binding.members
        .filter(
          (
            member
          ): member is (typeof binding.members)[number] & {
            kind: "property";
          } => member.kind === "property"
        )
        .map((member) => ({
          name: member.alias,
          isOptional: member.semanticOptional === true,
          typeKey: stableIrTypeKey(
            member.semanticType ?? parseBindingPropertyType(member.signature)
          ),
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

      if (
        candidateProps.length !== targetProps.length ||
        !candidateProps.every(
          (prop, index) =>
            prop.name === targetProps[index]?.name &&
            prop.isOptional === targetProps[index]?.isOptional &&
            prop.typeKey === targetProps[index]?.typeKey
        )
      ) {
        continue;
      }

      const resolvedClrType = binding.name;
      matches.push({
        key: resolvedClrType,
        name: simpleAlias.startsWith("__Anon_") ? simpleAlias : simpleName,
        resolvedClrType,
        isExternal: !resolvedClrType.startsWith(`${currentNamespace}.`),
      });
    }
  }

  if (matches.length === 0) return undefined;

  const uniqueMatches = new Map(matches.map((match) => [match.key, match]));
  const deduped = [...uniqueMatches.values()];
  if (deduped.length === 1) {
    const onlyMatch = deduped[0];
    if (!onlyMatch) return undefined;
    return {
      kind: "referenceType",
      name: onlyMatch.name,
      resolvedClrType: onlyMatch.resolvedClrType,
    } satisfies IrType;
  }

  const externalMatches = deduped.filter((match) => match.isExternal);
  if (externalMatches.length === 1) {
    const onlyExternal = externalMatches[0];
    if (!onlyExternal) return undefined;
    return {
      kind: "referenceType",
      name: onlyExternal.name,
      resolvedClrType: onlyExternal.resolvedClrType,
    } satisfies IrType;
  }

  return undefined;
};
