import {
  forEachTstsChild,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import type { IrType } from "../../../types.js";
import { stampRuntimeUnionAliasCarrier } from "../../../types.js";
import { substituteIrType } from "../../../types/ir-substitution.js";
import { convertFunctionType } from "./functions.js";
import type { Binding } from "../../../binding/index.js";
import type { DeclId } from "../../../type-system/types.js";
import {
  normalizeProviderInternalQualifiedName,
  normalizeNamespaceAliasQualifiedName,
  normalizeExpandedAliasType,
  getTypeAliasBodyCache,
} from "./references-normalize.js";
import {
  resolveContainingSourcePackageNamespace,
  resolveContainingSourcePackageOwnerIdentity,
} from "../../../../program/source-file-identity.js";
import { typeSymbolIdFromStableId } from "../../../../symbols/symbol-ids.js";
import type { TypeId } from "../universe/types.js";
import {
  isTsonicBindingsDeclarationFile,
  isSafeToEraseUserTypeAliasTarget,
  isTsonicSourcePackageFile,
  isRecursiveUserTypeAliasDeclaration,
  shouldPreserveUserTypeAliasIdentity,
  expandTypeAliasBody,
} from "./references-structural.js";
import { expandDirectAliasSyntax } from "./direct-alias-expansion.js";
import {
  containingSourceFileName,
  entityNameToText as entityNameToTextInternal,
  identifierText,
  isDeclarationFileNode,
  nodeTypeArguments,
} from "./tsts-syntax.js";

export const entityNameToText = (entityName: TstsNode | undefined): string =>
  entityNameToTextInternal(entityName);

const aliasNameText = (declNode: TstsNode): string =>
  identifierText(TstsSyntax.Node_Name(declNode)) ?? "_alias";

const unwrapParenthesizedTypeNode = (node: TstsNode): TstsNode => {
  let current = node;
  while (TstsSyntax.IsParenthesizedTypeNode(current)) {
    const inner = TstsSyntax.AsParenthesizedTypeNode(current)?.Type;
    if (!inner) break;
    current = inner;
  }
  return current;
};

const isDirectUnionTypeAliasDeclaration = (node: TstsNode): boolean => {
  const aliasBody = TstsSyntax.AsTypeAliasDeclaration(node)?.Type;
  return !!aliasBody && TstsSyntax.IsUnionTypeNode(unwrapParenthesizedTypeNode(aliasBody));
};

const sourceObjectAliasExpansionStack = new WeakSet<TstsNode>();

const buildSourceAliasIdentity = (
  declNode: TstsNode,
  aliasName: string,
  options: { readonly objectAliasCarrier: boolean } = {
    objectAliasCarrier: false,
  }
):
  | {
      readonly providerQualifiedName: string;
      readonly typeId: TypeId;
    }
  | undefined => {
  const sourceFileName = containingSourceFileName(declNode);
  if (
    !sourceFileName ||
    isDeclarationFileNode(declNode) ||
    !isTsonicSourcePackageFile(sourceFileName)
  ) {
    return undefined;
  }

  const sourcePackageNamespace =
    resolveContainingSourcePackageNamespace(sourceFileName);
  const ownerIdentity = resolveContainingSourcePackageOwnerIdentity(sourceFileName);
  if (!sourcePackageNamespace || !ownerIdentity) {
    return undefined;
  }

  const sourceQualifiedName = `${sourcePackageNamespace}.${aliasName}`;
  const stableId = `${ownerIdentity}:${sourceQualifiedName}`;
  const providerQualifiedName = options.objectAliasCarrier
    ? `${sourceQualifiedName}__Alias`
    : sourceQualifiedName;

  return {
    providerQualifiedName,
    typeId: {
      stableId,
      symbolId: typeSymbolIdFromStableId(stableId),
      providerName: providerQualifiedName,
      ownerIdentity,
      sourceName: aliasName,
      origin: "source",
    },
  };
};

const buildSourceObjectAliasReference = (
  node: TstsNode,
  typeName: string,
  declNode: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType | undefined => {
  if (typeName.includes(".")) {
    return undefined;
  }

  const sourceFileName = containingSourceFileName(declNode);
  if (
    !sourceFileName ||
    isDeclarationFileNode(declNode) ||
    !isTsonicSourcePackageFile(sourceFileName)
  ) {
    return undefined;
  }

  const sourceDecl = TstsSyntax.AsTypeAliasDeclaration(declNode);
  const aliasBody = sourceDecl?.Type
    ? unwrapParenthesizedTypeNode(sourceDecl.Type)
    : undefined;
  if (!aliasBody || !TstsSyntax.IsTypeLiteralNode(aliasBody)) {
    return undefined;
  }

  const refTypeArgs = nodeTypeArguments(node).map((typeArgument) =>
    convertType(typeArgument, binding)
  );
  const aliasName = aliasNameText(declNode);
  const sourceAliasIdentity = buildSourceAliasIdentity(declNode, aliasName, {
    objectAliasCarrier: true,
  });
  const referenceBase: Extract<IrType, { kind: "referenceType" }> = {
    kind: "referenceType",
    name: aliasName,
    ...(refTypeArgs.length > 0 ? { typeArguments: refTypeArgs } : {}),
    ...sourceAliasIdentity,
  };

  if (sourceObjectAliasExpansionStack.has(declNode)) {
    return referenceBase;
  }

  sourceObjectAliasExpansionStack.add(declNode);
  const convertedBody = (() => {
    try {
      return convertType(aliasBody, binding);
    } finally {
      sourceObjectAliasExpansionStack.delete(declNode);
    }
  })();
  if (convertedBody.kind !== "objectType") {
    return undefined;
  }

  const aliasTypeParams = (TstsSyntax.Node_TypeParameters(declNode) ?? [])
    .map((typeParameter) => identifierText(TstsSyntax.Node_Name(typeParameter)))
    .filter((name): name is string => name !== undefined);
  const substitutedBody =
    aliasTypeParams.length > 0 && refTypeArgs.length > 0
      ? (() => {
          const substitution = new Map<string, IrType>();
          for (
            let index = 0;
            index < Math.min(aliasTypeParams.length, refTypeArgs.length);
            index++
          ) {
            const name = aliasTypeParams[index];
            const argument = refTypeArgs[index];
            if (name && argument) {
              substitution.set(name, argument);
            }
          }

          const substituted =
            substitution.size > 0
              ? substituteIrType(convertedBody, substitution)
              : convertedBody;
          return substituted.kind === "objectType"
            ? substituted
            : convertedBody;
        })()
      : convertedBody;

  return {
    ...referenceBase,
    structuralMembers: substitutedBody.members,
    structuralOrigin: "namedReference",
  };
};

export const handleTypeAliasDeclaration = (
  node: TstsNode,
  typeName: string,
  declId: DeclId,
  declInfo: {
    readonly valueDeclNode?: unknown;
  },
  declNode: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType | undefined => {
  const alias = TstsSyntax.AsTypeAliasDeclaration(declNode);
  const aliasBody = alias?.Type;
  if (!aliasBody) {
    return undefined;
  }
  const valueDeclNode = declInfo.valueDeclNode as TstsNode | undefined;
  const hasRuntimeValueDeclaration =
    valueDeclNode !== undefined &&
    !TstsSyntax.IsTypeAliasDeclaration(valueDeclNode) &&
    !TstsSyntax.IsInterfaceDeclaration(valueDeclNode);

  const stampSourceAliasCarrier = (type: IrType): IrType => {
    if (isDeclarationFileNode(declNode)) {
      return type;
    }

    const aliasName = aliasNameText(declNode);
    const fullyQualifiedName = binding.getFullyQualifiedName(declId) ?? aliasName;

    return stampRuntimeUnionAliasCarrier(type, {
      aliasName,
      fullyQualifiedName,
      typeParameters: (TstsSyntax.Node_TypeParameters(declNode) ?? [])
        .map((typeParameter) => identifierText(TstsSyntax.Node_Name(typeParameter)))
        .filter((name): name is string => name !== undefined),
      typeArguments: nodeTypeArguments(node).map((typeArgument) =>
        convertType(typeArgument, binding)
      ),
    });
  };

  const convertFunctionAliasBody = (functionTypeNode: TstsNode): IrType => {
    const fnType = convertFunctionType(functionTypeNode, binding, convertType);

    const aliasTypeParams = (TstsSyntax.Node_TypeParameters(declNode) ?? [])
      .map((typeParameter) => identifierText(TstsSyntax.Node_Name(typeParameter)))
      .filter((name): name is string => name !== undefined);
    const refTypeArgs = nodeTypeArguments(node).map((typeArgument) =>
      convertType(typeArgument, binding)
    );

    if (aliasTypeParams.length > 0 && refTypeArgs.length > 0) {
      const subst = new Map<string, IrType>();
      for (
        let index = 0;
        index < Math.min(aliasTypeParams.length, refTypeArgs.length);
        index++
      ) {
        const name = aliasTypeParams[index];
        const arg = refTypeArgs[index];
        if (name && arg) subst.set(name, arg);
      }

      return normalizeExpandedAliasType(
        subst.size > 0 ? substituteIrType(fnType, subst) : fnType
      );
    }

    return normalizeExpandedAliasType(fnType);
  };

  if (
    aliasNameText(declNode).startsWith("ExtensionMethods_") &&
    nodeTypeArguments(node).length === 1
  ) {
    const shape = nodeTypeArguments(node)[0];
    return shape ? convertType(shape, binding) : { kind: "unknownType" };
  }

  if (TstsSyntax.IsFunctionTypeNode(aliasBody)) {
    if (isDeclarationFileNode(declNode)) {
      const fileName = containingSourceFileName(declNode);
      if (
        fileName &&
        isTsonicBindingsDeclarationFile(fileName) &&
        !hasRuntimeValueDeclaration
      ) {
        return convertFunctionAliasBody(aliasBody);
      }
    } else {
      return convertFunctionAliasBody(aliasBody);
    }
  }

  if (isDirectUnionTypeAliasDeclaration(declNode)) {
    const preserveAliasIdentity = shouldPreserveUserTypeAliasIdentity(declNode);
    if (preserveAliasIdentity && !isDeclarationFileNode(declNode)) {
      const sourceAliasIdentity = buildSourceAliasIdentity(
        declNode,
        aliasNameText(declNode)
      );
      if (sourceAliasIdentity) {
        const refTypeArgs = nodeTypeArguments(node).map((typeArgument) =>
          convertType(typeArgument, binding)
        );
        return {
          kind: "referenceType",
          name: typeName,
          ...(refTypeArgs.length > 0 ? { typeArguments: refTypeArgs } : {}),
          ...sourceAliasIdentity,
          structuralOrigin: "namedReference",
        };
      }

      if (isRecursiveUserTypeAliasDeclaration(declId.id, declNode, binding)) {
        return undefined;
      }
      return undefined;
    }

    const recursive = isRecursiveUserTypeAliasDeclaration(
      declId.id,
      declNode,
      binding
    );
    if (!hasRuntimeValueDeclaration && !recursive) {
      const expanded = expandTypeAliasBody(
        declId.id,
        declNode,
        node,
        binding,
        convertType
      );
      if (expanded) {
        return preserveAliasIdentity
          ? stampSourceAliasCarrier(expanded)
          : expanded;
      }
    }

    if (preserveAliasIdentity) {
      return undefined;
    }
  }

  if (!isDeclarationFileNode(declNode)) {
    const sourceObjectAlias = buildSourceObjectAliasReference(
      node,
      typeName,
      declNode,
      binding,
      convertType
    );
    if (sourceObjectAlias) {
      return sourceObjectAlias;
    }
  }

  const fileName = containingSourceFileName(declNode);
  if (
    isDeclarationFileNode(declNode) &&
    fileName &&
    isTsonicBindingsDeclarationFile(fileName) &&
    !hasRuntimeValueDeclaration &&
    !TstsSyntax.IsConditionalTypeNode(aliasBody)
  ) {
    const expanded = expandTypeAliasBody(
      declId.id,
      declNode,
      node,
      binding,
      convertType
    );
    if (expanded) return expanded;
  }

  if (!isDeclarationFileNode(declNode)) {
    const directExpanded = expandDirectAliasSyntax(
      declNode,
      node,
      binding,
      convertType
    );
    if (directExpanded) {
      return stampSourceAliasCarrier(
        normalizeExpandedAliasType(directExpanded)
      );
    }
  }

  if (
    !isDeclarationFileNode(declNode) &&
    isSafeToEraseUserTypeAliasTarget(aliasBody) &&
    !isRecursiveUserTypeAliasDeclaration(declId.id, declNode, binding)
  ) {
    const key = declId.id;
    const typeAliasBodyCache = getTypeAliasBodyCache(binding);
    const cached = typeAliasBodyCache.get(key);

    if (cached !== "in-progress") {
      const expanded = expandTypeAliasBody(
        declId.id,
        declNode,
        node,
        binding,
        convertType
      );
      if (expanded) return stampSourceAliasCarrier(expanded);
    }
  }

  const aliasTypeParameters = TstsSyntax.Node_TypeParameters(declNode) ?? [];
  const firstParameter = aliasTypeParameters[0];
  const hasTsbindgenDefaultSentinel =
    nodeTypeArguments(node).length > 0 &&
    aliasTypeParameters.length === 1 &&
    !!firstParameter &&
    !!TstsSyntax.AsTypeParameterDeclaration(firstParameter)?.DefaultType &&
    TstsSyntax.IsTypeReferenceNode(
      TstsSyntax.AsTypeParameterDeclaration(firstParameter)?.DefaultType
    ) &&
    entityNameToText(
      TstsSyntax.AsTypeReferenceNode(
        TstsSyntax.AsTypeParameterDeclaration(firstParameter)?.DefaultType
      )?.TypeName
    ) === "__";

  if (
    hasTsbindgenDefaultSentinel &&
    TstsSyntax.IsConditionalTypeNode(aliasBody)
  ) {
    const expected = `${typeName}_${nodeTypeArguments(node).length}`;
    let found: string | undefined;

    const visit = (typeNode: TstsNode): void => {
      if (found) return;

      if (TstsSyntax.IsTypeReferenceNode(typeNode)) {
        const raw = entityNameToText(
          TstsSyntax.AsTypeReferenceNode(typeNode)?.TypeName
        );
        const normalized = normalizeNamespaceAliasQualifiedName(
          normalizeProviderInternalQualifiedName(raw)
        );
        if (normalized === expected) {
          found = normalized;
        }
        return;
      }

      forEachTstsChild(typeNode, (child) => {
        if (child) visit(child);
      });
    };

    visit(aliasBody);

    if (found) {
      return {
        kind: "referenceType",
        name: found,
        typeArguments: nodeTypeArguments(node).map((typeArgument) =>
          convertType(typeArgument, binding)
        ),
      };
    }
  }

  return undefined;
};
