import { rewriteSourceTypeText } from "../source-type-text.js";
import { printTypeParameters, renderPortableType } from "../portable-types.js";
import type {
  AnonymousStructuralAliasInfo,
  SourceAliasPlan,
} from "../types.js";

export const renderSourceAliasPlan = (
  plan: SourceAliasPlan,
  anonymousStructuralAliases: ReadonlyMap<string, AnonymousStructuralAliasInfo>
): {
  readonly line: string;
  readonly internalImport?: string;
} => {
  const containsInlineStructuralObjectType = (
    type: import("@tsonic/frontend").IrType
  ): boolean => {
    switch (type.kind) {
      case "objectType":
        return true;
      case "arrayType":
        return containsInlineStructuralObjectType(type.elementType);
      case "tupleType":
        return type.elementTypes.some(containsInlineStructuralObjectType);
      case "unionType":
      case "intersectionType":
        return type.types.some(containsInlineStructuralObjectType);
      case "dictionaryType":
        return (
          containsInlineStructuralObjectType(type.keyType) ||
          containsInlineStructuralObjectType(type.valueType)
        );
      case "functionType":
        return (
          type.parameters.some((parameter) =>
            parameter.type
              ? containsInlineStructuralObjectType(parameter.type)
              : false
          ) ||
          (type.returnType
            ? containsInlineStructuralObjectType(type.returnType)
            : false)
        );
      case "referenceType":
        return (type.typeArguments ?? []).some(
          containsInlineStructuralObjectType
        );
      default:
        return false;
    }
  };
  const shouldPreserveSourceAliasText = (() => {
    if (!plan.sourceAlias) return false;
    if (/\btypeof\b/.test(plan.sourceAlias.typeText)) {
      return false;
    }
    if (/[{]/.test(plan.sourceAlias.typeText)) {
      return false;
    }
    return !containsInlineStructuralObjectType(plan.declaration.type);
  })();
  const sourceTypeParams =
    plan.sourceAlias?.typeParametersText ??
    printTypeParameters(plan.declaration.typeParameters);

  if (plan.declaration.type.kind === "objectType") {
    const arity = plan.declaration.typeParameters?.length ?? 0;
    const internalName = `${plan.declaration.name}__Alias${arity > 0 ? `_${arity}` : ""}`;
    const typeArgs =
      plan.sourceAlias && plan.sourceAlias.typeParameterNames.length > 0
        ? `<${plan.sourceAlias.typeParameterNames.join(", ")}>`
        : plan.declaration.typeParameters &&
            plan.declaration.typeParameters.length > 0
          ? `<${plan.declaration.typeParameters.map((tp) => tp.name).join(", ")}>`
          : "";
    return {
      line: `export type ${plan.declaration.name}${sourceTypeParams} = ${internalName}${typeArgs};`,
      internalImport: internalName,
    };
  }

  const rhs = renderPortableType(
    plan.declaration.type,
    plan.declaration.typeParameters?.map((tp) => tp.name) ?? [],
    new Map(),
    anonymousStructuralAliases
  );
  return {
    line: `export type ${plan.declaration.name}${sourceTypeParams} = ${
      shouldPreserveSourceAliasText && plan.sourceAlias
        ? rewriteSourceTypeText(
            plan.sourceAlias.typeText,
            new Map(),
            anonymousStructuralAliases
          )
        : rhs
    };`,
  };
};
