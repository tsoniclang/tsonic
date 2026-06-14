import type { TstsNode } from "@tsonic/tsts";
import {
  getTstsDeclaredTypeNode,
  getTstsHeritageTypeNodes,
  getTstsMemberNodes,
  getTstsNodeNameText,
  getTstsParameters,
  hasTstsPrivateModifier,
  hasTstsProtectedModifier,
  hasTstsReadonlyModifier,
  hasTstsStaticModifier,
  isTstsOptionalParameter,
  isTstsRestParameter,
  TstsSyntax,
} from "@tsonic/tsts";
import type { IrInterfaceMember, IrType } from "../types/index.js";
import { isOverloadStubImplementation } from "../syntax/overload-stubs.js";
import { tryResolveDeterministicPropertyName } from "../syntax/property-names.js";
import type { TypeSystemState } from "./type-system-state.js";

const isPublicInstanceClassMember = (member: TstsNode): boolean => {
  if (TstsSyntax.IsConstructorDeclaration(member)) return false;
  if (hasTstsStaticModifier(member)) return false;
  if (hasTstsPrivateModifier(member) || hasTstsProtectedModifier(member)) {
    return false;
  }
  return (
    TstsSyntax.Node_PropertyNameOrName(member)?.Kind !==
    TstsSyntax.KindPrivateIdentifier
  );
};

const isSyntheticStructuralName = (name: string): boolean =>
  name.startsWith("__tsonic_type_") ||
  name.startsWith("__tsonic_binding_alias_");

const collectMembersFromIrType = (
  type: IrType
): readonly IrInterfaceMember[] => {
  if (type.kind === "referenceType") return type.structuralMembers ?? [];
  if (type.kind === "objectType") return type.members;
  if (type.kind === "intersectionType") {
    return type.types.flatMap(collectMembersFromIrType);
  }
  return [];
};

const concreteTstsNodes = (
  nodes: readonly (TstsNode | undefined)[]
): readonly TstsNode[] =>
  nodes.filter((node): node is TstsNode => node !== undefined);

const collectInheritedMembers = (
  state: TypeSystemState,
  declaration: TstsNode
): readonly IrInterfaceMember[] =>
  getTstsHeritageTypeNodes(declaration).flatMap((heritageType) =>
    collectMembersFromIrType(state.convertTypeNodeRaw(heritageType))
  );

const getDeclarationMembers = (
  declaration: TstsNode
): readonly TstsNode[] | undefined => {
  if (
    TstsSyntax.IsClassDeclaration(declaration) ||
    TstsSyntax.IsInterfaceDeclaration(declaration)
  ) {
    return concreteTstsNodes(getTstsMemberNodes(declaration));
  }

  if (TstsSyntax.IsTypeAliasDeclaration(declaration)) {
    const typeNode = getTstsDeclaredTypeNode(declaration);
    if (typeNode?.Kind === TstsSyntax.KindTypeLiteral) {
      return concreteTstsNodes(TstsSyntax.Node_Members(typeNode) ?? []);
    }
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
  for (const member of inheritedMembers)
    byKey.set(memberMergeKey(member), member);
  for (const member of ownMembers) byKey.set(memberMergeKey(member), member);
  return [...byKey.values()];
};

export const extractNominalStructuralMembers = (
  state: TypeSystemState,
  declaration: TstsNode | undefined
): readonly IrInterfaceMember[] | undefined => {
  if (!declaration) return undefined;

  const members = getDeclarationMembers(declaration);
  if (!members) return undefined;
  if (members.some(TstsSyntax.IsIndexSignatureDeclaration)) return undefined;

  const ownMembers: IrInterfaceMember[] = [];
  const accessors = new Map<
    string,
    {
      getter?: TstsNode;
      setter?: TstsNode;
    }
  >();

  for (const member of members) {
    if (TstsSyntax.IsClassDeclaration(declaration)) {
      if (!isPublicInstanceClassMember(member)) continue;
    }

    if (
      TstsSyntax.IsGetAccessorDeclaration(member) ||
      TstsSyntax.IsSetAccessorDeclaration(member)
    ) {
      const name = tryResolveDeterministicPropertyName(
        TstsSyntax.Node_PropertyNameOrName(member)
      );
      if (!name || isSyntheticStructuralName(name)) continue;
      const existing = accessors.get(name) ?? {};
      if (TstsSyntax.IsGetAccessorDeclaration(member)) existing.getter = member;
      if (TstsSyntax.IsSetAccessorDeclaration(member)) existing.setter = member;
      accessors.set(name, existing);
      continue;
    }

    if (
      TstsSyntax.IsPropertySignatureDeclaration(member) ||
      TstsSyntax.IsPropertyDeclaration(member)
    ) {
      const name = tryResolveDeterministicPropertyName(
        TstsSyntax.Node_PropertyNameOrName(member)
      );
      const typeNode = getTstsDeclaredTypeNode(member);
      if (!name || isSyntheticStructuralName(name) || !typeNode) continue;
      ownMembers.push({
        kind: "propertySignature",
        name,
        type: state.convertTypeNodeRaw(typeNode),
        isOptional: TstsSyntax.Node_QuestionToken(member) !== undefined,
        isReadonly: hasTstsReadonlyModifier(member),
      });
      continue;
    }

    if (
      TstsSyntax.IsMethodSignatureDeclaration(member) ||
      TstsSyntax.IsMethodDeclaration(member)
    ) {
      if (
        TstsSyntax.IsMethodDeclaration(member) &&
        isOverloadStubImplementation(member)
      ) {
        continue;
      }
      const name = tryResolveDeterministicPropertyName(
        TstsSyntax.Node_PropertyNameOrName(member)
      );
      if (!name || isSyntheticStructuralName(name)) continue;
      ownMembers.push({
        kind: "methodSignature",
        name,
        parameters: concreteTstsNodes(getTstsParameters(member)).map(
          (parameter, index) => ({
            kind: "parameter",
            pattern: {
              kind: "identifierPattern",
              name: getTstsNodeNameText(parameter) ?? `arg${index}`,
            },
            type: getTstsDeclaredTypeNode(parameter)
              ? state.convertTypeNodeRaw(getTstsDeclaredTypeNode(parameter))
              : undefined,
            isOptional: isTstsOptionalParameter(parameter),
            isRest: isTstsRestParameter(parameter),
            passing: "value",
          })
        ),
        returnType: getTstsDeclaredTypeNode(member)
          ? state.convertTypeNodeRaw(getTstsDeclaredTypeNode(member))
          : undefined,
      });
    }
  }

  for (const [name, pair] of accessors) {
    const setterParam = concreteTstsNodes(getTstsParameters(pair.setter))[0];
    const typeNode =
      getTstsDeclaredTypeNode(pair.getter) ??
      (setterParam ? getTstsDeclaredTypeNode(setterParam) : undefined);
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
    TstsSyntax.IsClassDeclaration(declaration) ||
    TstsSyntax.IsInterfaceDeclaration(declaration)
      ? collectInheritedMembers(state, declaration)
      : [];
  const result = mergeMembers(inheritedMembers, ownMembers);
  return result.length > 0 ? result : undefined;
};
