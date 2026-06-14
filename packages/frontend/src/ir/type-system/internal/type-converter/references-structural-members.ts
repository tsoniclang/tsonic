import {
  getTstsHeritageTypeNodes,
  hasTstsPrivateModifier,
  hasTstsProtectedModifier,
  hasTstsReadonlyModifier,
  hasTstsStaticModifier,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import { IrType, IrDictionaryType, IrInterfaceMember } from "../../../types.js";
import { substituteIrType } from "../../../types/ir-substitution.js";
import { CORE_PRIMITIVE_TYPE_SET, getCorePrimitiveType } from "./primitives.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";
import { tryResolveDeterministicPropertyName } from "../../../syntax/property-names.js";
import { isOverloadStubImplementation } from "../../../syntax/overload-stubs.js";
import {
  classifyDictionaryKeyTypeNode,
  normalizeExpandedAliasType,
  getStructuralMembersCache,
  getTypeAliasBodyCache,
} from "./references-normalize.js";
import { shouldExtractFromDeclaration } from "./references-structural-bindings.js";
import { expandDirectAliasSyntax } from "./direct-alias-expansion.js";
import { makeDeclId } from "../../types.js";
import { isSourceBindingMarkerName } from "../source-binding-markers.js";
import {
  asConverterNode,
  containingSourceFileName,
  identifierText,
  isOptionalParameter,
  isRestParameter,
  nodeMembers,
  nodeParameters,
  nodeType,
  nodeTypeArguments,
} from "./tsts-syntax.js";

const isPublicInstanceClassMember = (member: TstsNode): boolean => {
  if (member.Kind === TstsSyntax.KindConstructor) return false;
  if (hasTstsStaticModifier(member)) return false;
  if (hasTstsPrivateModifier(member) || hasTstsProtectedModifier(member)) {
    return false;
  }
  return TstsSyntax.Node_Name(member)?.Kind !== TstsSyntax.KindPrivateIdentifier;
};

const getMemberName = (member: TstsNode): string | undefined =>
  tryResolveDeterministicPropertyName(TstsSyntax.Node_Name(member));

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

const memberMergeKey = (member: IrInterfaceMember): string =>
  member.kind === "propertySignature"
    ? `property:${member.name}`
    : `method:${member.name}:${member.parameters.length}`;

const typeElementsForDeclaration = (decl: TstsNode): readonly TstsNode[] => {
  if (TstsSyntax.IsInterfaceDeclaration(decl) || TstsSyntax.IsClassDeclaration(decl)) {
    return nodeMembers(decl);
  }
  if (TstsSyntax.IsTypeAliasDeclaration(decl)) {
    const body = TstsSyntax.AsTypeAliasDeclaration(decl)?.Type;
    return body && TstsSyntax.IsTypeLiteralNode(body) ? nodeMembers(body) : [];
  }
  return [];
};

export const extractStructuralMembersFromDeclarations = (
  declId: number | undefined,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): readonly IrInterfaceMember[] | undefined => {
  if (declId === undefined) {
    return undefined;
  }

  const structuralMembersCache = getStructuralMembersCache(binding);
  const cached = structuralMembersCache.get(declId);
  if (cached === "in-progress") {
    return undefined;
  }
  if (cached !== undefined) {
    return cached === null ? undefined : cached;
  }

  const registry = (binding as BindingInternal)._getHandleRegistry();
  const declInfo = registry.getDecl(makeDeclId(declId));
  const decl = asConverterNode(declInfo?.declNode);
  if (!decl) {
    structuralMembersCache.set(declId, null);
    return undefined;
  }

  if (!shouldExtractFromDeclaration(decl)) {
    structuralMembersCache.set(declId, null);
    return undefined;
  }

  structuralMembersCache.set(declId, "in-progress");

  try {
    const members: IrInterfaceMember[] = [];
    const accessorGroups = new Map<
      string,
      {
        getter?: TstsNode;
        setter?: TstsNode;
      }
    >();

    const getInheritedStructuralMembers = (): readonly IrInterfaceMember[] => {
      if (!TstsSyntax.IsInterfaceDeclaration(decl) && !TstsSyntax.IsClassDeclaration(decl)) {
        return [];
      }

      return getTstsHeritageTypeNodes(decl).flatMap((heritageType) =>
        heritageType
          ? collectMembersFromIrType(convertType(heritageType, binding))
          : []
      );
    };

    const typeElements = typeElementsForDeclaration(decl);
    if (typeElements.length === 0) {
      structuralMembersCache.set(declId, null);
      return undefined;
    }

    if (typeElements.some(TstsSyntax.IsIndexSignatureDeclaration)) {
      structuralMembersCache.set(declId, null);
      return undefined;
    }

    for (const member of typeElements) {
      if (
        TstsSyntax.IsGetAccessorDeclaration(member) ||
        TstsSyntax.IsSetAccessorDeclaration(member)
      ) {
        if (
          TstsSyntax.IsClassDeclaration(decl) &&
          !isPublicInstanceClassMember(member)
        ) {
          continue;
        }

        const accessorName = getMemberName(member);
        if (!accessorName || isSourceBindingMarkerName(accessorName)) {
          continue;
        }

        const existing = accessorGroups.get(accessorName) ?? {};
        if (TstsSyntax.IsGetAccessorDeclaration(member)) {
          existing.getter = member;
        } else {
          existing.setter = member;
        }
        accessorGroups.set(accessorName, existing);
        continue;
      }

      if (
        TstsSyntax.IsPropertySignatureDeclaration(member) ||
        TstsSyntax.IsPropertyDeclaration(member)
      ) {
        if (
          TstsSyntax.IsPropertyDeclaration(member) &&
          !isPublicInstanceClassMember(member)
        ) {
          continue;
        }

        const propName = getMemberName(member);
        if (!propName || isSourceBindingMarkerName(propName)) {
          continue;
        }

        const declTypeNode = nodeType(member);
        if (!declTypeNode) {
          continue;
        }

        if (TstsSyntax.IsTypeReferenceNode(declTypeNode)) {
          const typeName = identifierText(
            TstsSyntax.AsTypeReferenceNode(declTypeNode)?.TypeName
          );
          if (typeName && CORE_PRIMITIVE_TYPE_SET.has(typeName)) {
            const typeRefDeclId = binding.resolveTypeReference(declTypeNode);
            if (typeRefDeclId) {
              const typeRefDeclInfo = registry.getDecl(typeRefDeclId);
              const refDeclNode = asConverterNode(typeRefDeclInfo?.declNode);
              const refSourceFile = refDeclNode
                ? containingSourceFileName(refDeclNode)
                : undefined;
              if (refSourceFile?.includes("@tsonic/core")) {
                members.push({
                  kind: "propertySignature",
                  name: propName,
                  type: getCorePrimitiveType(typeName as "int" | "char"),
                  isOptional:
                    TstsSyntax.Node_QuestionToken(member) !== undefined,
                  isReadonly: hasTstsReadonlyModifier(member),
                });
                continue;
              }
            }
          }
        }

        members.push({
          kind: "propertySignature",
          name: propName,
          type: convertType(declTypeNode, binding),
          isOptional: TstsSyntax.Node_QuestionToken(member) !== undefined,
          isReadonly: hasTstsReadonlyModifier(member),
        });
      }

      if (
        TstsSyntax.IsMethodSignatureDeclaration(member) ||
        TstsSyntax.IsMethodDeclaration(member)
      ) {
        if (
          TstsSyntax.IsMethodDeclaration(member) &&
          !isPublicInstanceClassMember(member)
        ) {
          continue;
        }
        if (
          TstsSyntax.IsMethodDeclaration(member) &&
          isOverloadStubImplementation(member)
        ) {
          continue;
        }

        const methodName = getMemberName(member);
        if (!methodName) {
          continue;
        }

        members.push({
          kind: "methodSignature",
          name: methodName,
          parameters: nodeParameters(member).map((param, index) => ({
            kind: "parameter" as const,
            pattern: {
              kind: "identifierPattern" as const,
              name:
                identifierText(TstsSyntax.Node_Name(param)) ?? `arg${index}`,
            },
            type: nodeType(param)
              ? convertType(nodeType(param)!, binding)
              : undefined,
            isOptional: isOptionalParameter(param),
            isRest: isRestParameter(param),
            passing: "value" as const,
          })),
          returnType: nodeType(member)
            ? convertType(nodeType(member)!, binding)
            : undefined,
        });
      }
    }

    for (const [memberName, pair] of accessorGroups) {
      const getterTypeNode = pair.getter ? nodeType(pair.getter) : undefined;
      const setterTypeNode = pair.setter
        ? nodeType(nodeParameters(pair.setter)[0])
        : undefined;
      const propertyTypeNode = getterTypeNode ?? setterTypeNode;
      if (!propertyTypeNode) {
        continue;
      }

      members.push({
        kind: "propertySignature",
        name: memberName,
        type: convertType(propertyTypeNode, binding),
        isOptional: false,
        isReadonly: !!pair.getter && !pair.setter,
      });
    }

    const inheritedMembers = getInheritedStructuralMembers();
    const mergedMembers =
      inheritedMembers.length === 0
        ? members
        : [...inheritedMembers, ...members].reduce<IrInterfaceMember[]>(
            (acc, member) => {
              const existingIndex = acc.findIndex(
                (candidate) =>
                  memberMergeKey(candidate) === memberMergeKey(member)
              );
              if (existingIndex >= 0) {
                acc[existingIndex] = member;
              } else {
                acc.push(member);
              }
              return acc;
            },
            []
          );

    const result = mergedMembers.length > 0 ? mergedMembers : undefined;
    structuralMembersCache.set(declId, result ?? null);
    return result;
  } catch {
    structuralMembersCache.set(declId, null);
    return undefined;
  }
};

export const tryConvertPureIndexSignatureToDictionary = (
  decl: TstsNode,
  convertType: (node: TstsNode, binding: Binding) => IrType,
  binding: Binding
): IrDictionaryType | undefined => {
  const typeElements = typeElementsForDeclaration(decl);
  if (typeElements.length === 0) return undefined;

  const indexSignatures = typeElements.filter(
    TstsSyntax.IsIndexSignatureDeclaration
  );
  const otherMembers = typeElements.filter(
    (member) => !TstsSyntax.IsIndexSignatureDeclaration(member)
  );
  if (indexSignatures.length === 0 || otherMembers.length > 0) {
    return undefined;
  }

  const indexSig = indexSignatures[0];
  const keyParam = indexSig ? nodeParameters(indexSig)[0] : undefined;
  const keyTypeNode = keyParam ? nodeType(keyParam) : undefined;
  const keyType: IrType = keyTypeNode
    ? (classifyDictionaryKeyTypeNode(keyTypeNode) ?? {
        kind: "primitiveType",
        name: "string",
      })
    : { kind: "primitiveType", name: "string" };
  const indexSigType = indexSig ? nodeType(indexSig) : undefined;
  const valueType = indexSigType
    ? convertType(indexSigType, binding)
    : { kind: "anyType" as const };

  return {
    kind: "dictionaryType",
    keyType,
    valueType,
  };
};

export const expandTypeAliasBody = (
  declId: number,
  declNode: TstsNode,
  node: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType | undefined => {
  const directExpanded = expandDirectAliasSyntax(
    declNode,
    node,
    binding,
    convertType
  );
  if (directExpanded) {
    return normalizeExpandedAliasType(directExpanded);
  }

  const key = declId;
  const typeAliasBodyCache = getTypeAliasBodyCache(binding);
  const cached = typeAliasBodyCache.get(key);

  if (cached === "in-progress") {
    return undefined;
  }

  const aliasBody = TstsSyntax.AsTypeAliasDeclaration(declNode)?.Type;
  if (!aliasBody) {
    return undefined;
  }

  const base =
    cached ??
    (() => {
      typeAliasBodyCache.set(key, "in-progress");
      const converted = convertType(aliasBody, binding);
      typeAliasBodyCache.set(key, converted);
      return converted;
    })();

  const aliasTypeParams = (TstsSyntax.Node_TypeParameters(declNode) ?? [])
    .map((parameter) => identifierText(TstsSyntax.Node_Name(parameter)))
    .filter((name): name is string => name !== undefined);
  const refTypeArgs = nodeTypeArguments(node).map((t) =>
    convertType(t, binding)
  );

  if (aliasTypeParams.length > 0 && refTypeArgs.length > 0) {
    const subst = new Map<string, IrType>();
    for (
      let i = 0;
      i < Math.min(aliasTypeParams.length, refTypeArgs.length);
      i++
    ) {
      const name = aliasTypeParams[i];
      const arg = refTypeArgs[i];
      if (name && arg) subst.set(name, arg);
    }
    return normalizeExpandedAliasType(
      subst.size > 0 ? substituteIrType(base, subst) : base
    );
  }

  return normalizeExpandedAliasType(base);
};
