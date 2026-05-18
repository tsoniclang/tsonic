import * as ts from "typescript";
import type { IrInterfaceMember, IrType } from "../types/index.js";
import { isOverloadStubImplementation } from "../syntax/overload-stubs.js";
import { tryResolveDeterministicPropertyName } from "../syntax/property-names.js";
import type { TypeSystemState } from "./type-system-state.js";

const getModifiers = (node: ts.Node): readonly ts.ModifierLike[] | undefined =>
  ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;

const hasModifier = (
  modifiers: readonly ts.ModifierLike[] | undefined,
  kind: ts.SyntaxKind
): boolean => modifiers?.some((modifier) => modifier.kind === kind) ?? false;

const isPublicInstanceClassMember = (member: ts.ClassElement): boolean => {
  if (ts.isConstructorDeclaration(member)) return false;
  const modifiers = getModifiers(member);
  if (hasModifier(modifiers, ts.SyntaxKind.StaticKeyword)) return false;
  if (
    hasModifier(modifiers, ts.SyntaxKind.PrivateKeyword) ||
    hasModifier(modifiers, ts.SyntaxKind.ProtectedKeyword)
  ) {
    return false;
  }
  return !("name" in member && member.name && ts.isPrivateIdentifier(member.name));
};

const isSyntheticStructuralName = (name: string): boolean =>
  name.startsWith("__tsonic_type_") ||
  name.startsWith("__tsonic_binding_alias_");

const collectMembersFromIrType = (type: IrType): readonly IrInterfaceMember[] => {
  if (type.kind === "referenceType") return type.structuralMembers ?? [];
  if (type.kind === "objectType") return type.members;
  if (type.kind === "intersectionType") {
    return type.types.flatMap(collectMembersFromIrType);
  }
  return [];
};

const collectInheritedMembers = (
  state: TypeSystemState,
  declaration: ts.ClassDeclaration | ts.InterfaceDeclaration
): readonly IrInterfaceMember[] =>
  (declaration.heritageClauses ?? []).flatMap((clause) =>
    clause.types.flatMap((heritageType) =>
      collectMembersFromIrType(state.convertTypeNodeRaw(heritageType))
    )
  );

const getDeclarationMembers = (
  declaration: ts.Declaration
): ts.NodeArray<ts.ClassElement> | ts.NodeArray<ts.TypeElement> | undefined => {
  if (ts.isClassDeclaration(declaration)) return declaration.members;
  if (ts.isInterfaceDeclaration(declaration)) return declaration.members;
  if (
    ts.isTypeAliasDeclaration(declaration) &&
    ts.isTypeLiteralNode(declaration.type)
  ) {
    return declaration.type.members;
  }
  return undefined;
};

const memberMergeKey = (member: IrInterfaceMember): string => {
  if (member.kind === "propertySignature") return `property:${member.name}`;
  const parameterKey = member.parameters
    .map((parameter) => parameter.type?.kind ?? "unknown")
    .join(",");
  return `method:${member.name}:${member.parameters.length}:${parameterKey}`;
};

const mergeMembers = (
  inheritedMembers: readonly IrInterfaceMember[],
  ownMembers: readonly IrInterfaceMember[]
): readonly IrInterfaceMember[] => {
  const byKey = new Map<string, IrInterfaceMember>();
  for (const member of inheritedMembers) byKey.set(memberMergeKey(member), member);
  for (const member of ownMembers) byKey.set(memberMergeKey(member), member);
  return [...byKey.values()];
};

export const extractNominalStructuralMembers = (
  state: TypeSystemState,
  declaration: ts.Declaration | undefined
): readonly IrInterfaceMember[] | undefined => {
  if (!declaration) return undefined;

  const members = getDeclarationMembers(declaration);
  if (!members) return undefined;
  if (members.some(ts.isIndexSignatureDeclaration)) return undefined;

  const ownMembers: IrInterfaceMember[] = [];
  const accessors = new Map<
    string,
    {
      getter?: ts.GetAccessorDeclaration;
      setter?: ts.SetAccessorDeclaration;
    }
  >();

  for (const member of members) {
    if (ts.isClassDeclaration(declaration)) {
      if (!isPublicInstanceClassMember(member as ts.ClassElement)) continue;
    }

    if (
      ts.isGetAccessorDeclaration(member) ||
      ts.isSetAccessorDeclaration(member)
    ) {
      const name = tryResolveDeterministicPropertyName(member.name);
      if (!name || isSyntheticStructuralName(name)) continue;
      const existing = accessors.get(name) ?? {};
      if (ts.isGetAccessorDeclaration(member)) existing.getter = member;
      if (ts.isSetAccessorDeclaration(member)) existing.setter = member;
      accessors.set(name, existing);
      continue;
    }

    if (ts.isPropertySignature(member) || ts.isPropertyDeclaration(member)) {
      const name = tryResolveDeterministicPropertyName(member.name);
      if (!name || isSyntheticStructuralName(name) || !member.type) continue;
      ownMembers.push({
        kind: "propertySignature",
        name,
        type: state.convertTypeNodeRaw(member.type),
        isOptional: !!member.questionToken,
        isReadonly: hasModifier(getModifiers(member), ts.SyntaxKind.ReadonlyKeyword),
      });
      continue;
    }

    if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) {
      if (ts.isMethodDeclaration(member) && isOverloadStubImplementation(member)) {
        continue;
      }
      const name = tryResolveDeterministicPropertyName(member.name);
      if (!name || isSyntheticStructuralName(name)) continue;
      ownMembers.push({
        kind: "methodSignature",
        name,
        parameters: member.parameters.map((parameter, index) => ({
          kind: "parameter",
          pattern: ts.isIdentifier(parameter.name)
            ? { kind: "identifierPattern", name: parameter.name.text }
            : { kind: "identifierPattern", name: `arg${index}` },
          type: parameter.type
            ? state.convertTypeNodeRaw(parameter.type)
            : undefined,
          isOptional: !!parameter.questionToken,
          isRest: !!parameter.dotDotDotToken,
          passing: "value",
        })),
        returnType: member.type
          ? state.convertTypeNodeRaw(member.type)
          : undefined,
      });
    }
  }

  for (const [name, pair] of accessors) {
    const typeNode = pair.getter?.type ?? pair.setter?.parameters[0]?.type;
    if (!typeNode) continue;
    ownMembers.push({
      kind: "propertySignature",
      name,
      type: state.convertTypeNodeRaw(typeNode),
      isOptional: false,
      isReadonly: !!pair.getter && !pair.setter,
    });
  }

  const inheritedMembers =
    ts.isClassDeclaration(declaration) || ts.isInterfaceDeclaration(declaration)
      ? collectInheritedMembers(state, declaration)
      : [];
  const result = mergeMembers(inheritedMembers, ownMembers);
  return result.length > 0 ? result : undefined;
};
