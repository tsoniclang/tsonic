import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { TypeMemberKind } from "../../emitter-types/core.js";
import { getIdentifierTypeName } from "../format/backend-ast/utils.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";

export type TypeMemberNameBucket =
  | "methods"
  | "properties"
  | "fields"
  | "enumMembers";

const stripGlobalPrefix = (name: string): string =>
  name.startsWith("global::") ? name.slice("global::".length) : name;

export const typeMemberKindToBucket = (
  kind: TypeMemberKind | undefined
): TypeMemberNameBucket => {
  switch (kind) {
    case "method":
      return "methods";
    case "field":
      return "fields";
    case "enumMember":
      return "enumMembers";
    default:
      return "properties";
  }
};

export const lookupLocalTypeMemberKind = (
  receiverTypeName: string,
  memberName: string,
  context: EmitterContext
): TypeMemberKind | undefined => {
  const local = context.localTypes?.get(receiverTypeName);
  if (!local) return undefined;

  if (local.kind === "enum") {
    return local.members.includes(memberName) ? "enumMember" : undefined;
  }

  if (local.kind === "typeAlias") {
    if (local.type.kind !== "objectType") return undefined;
    const found = local.type.members.find(
      (member) => member.name === memberName
    );
    if (!found) return undefined;
    return found.kind === "methodSignature" ? "method" : "property";
  }

  for (const member of local.members) {
    if (!("name" in member) || member.name !== memberName) continue;
    if (
      member.kind === "methodDeclaration" ||
      member.kind === "methodSignature"
    ) {
      return "method";
    }
    if (member.kind === "propertySignature") return "property";
    if (member.kind === "propertyDeclaration") {
      return member.getterBody || member.setterBody ? "property" : "field";
    }
  }

  return undefined;
};

export const resolveTypeMemberIndexFqn = (
  receiverType: IrType | undefined,
  context: EmitterContext,
  receiverBindingName?: string
): string | undefined => {
  if (!receiverType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(receiverType), context);
  if (resolved.kind !== "referenceType") {
    return undefined;
  }

  if (resolved.resolvedClrType) {
    return stripGlobalPrefix(resolved.resolvedClrType);
  }

  const bindingName = receiverBindingName ?? resolved.name;
  const binding = context.importBindings?.get(bindingName);
  if (binding?.kind !== "type") {
    return undefined;
  }

  const typeName = getIdentifierTypeName(binding.typeAst);
  return typeName ? stripGlobalPrefix(typeName) : undefined;
};

export const resolveTypeMemberIndexMap = (
  receiverType: IrType | undefined,
  context: EmitterContext,
  receiverBindingName?: string
): ReadonlyMap<string, TypeMemberKind> | undefined => {
  const receiverFqn = resolveTypeMemberIndexFqn(
    receiverType,
    context,
    receiverBindingName
  );
  return receiverFqn
    ? context.options.typeMemberIndex?.get(receiverFqn)
    : undefined;
};

export const resolveTypeMemberKind = (
  receiverType: IrType | undefined,
  memberName: string,
  context: EmitterContext,
  receiverBindingName?: string
): TypeMemberKind | undefined => {
  if (!receiverType) {
    return receiverBindingName
      ? lookupLocalTypeMemberKind(receiverBindingName, memberName, context)
      : undefined;
  }

  const resolved = resolveTypeAlias(stripNullish(receiverType), context);

  if (resolved.kind === "objectType") {
    const found = resolved.members.find((member) => member.name === memberName);
    if (!found) return undefined;
    return found.kind === "methodSignature" ? "method" : "property";
  }

  if (resolved.kind !== "referenceType") {
    return receiverBindingName
      ? lookupLocalTypeMemberKind(receiverBindingName, memberName, context)
      : undefined;
  }

  if (resolved.structuralMembers?.length) {
    const structuralMember = resolved.structuralMembers.find(
      (member) => member.name === memberName
    );
    if (structuralMember) {
      return structuralMember.kind === "methodSignature"
        ? "method"
        : "property";
    }
  }

  const localKind = lookupLocalTypeMemberKind(
    resolved.name,
    memberName,
    context
  );
  if (localKind) {
    return localKind;
  }

  if (receiverBindingName && receiverBindingName !== resolved.name) {
    const bindingKind = lookupLocalTypeMemberKind(
      receiverBindingName,
      memberName,
      context
    );
    if (bindingKind) {
      return bindingKind;
    }
  }

  return resolveTypeMemberIndexMap(resolved, context, receiverBindingName)?.get(
    memberName
  );
};
