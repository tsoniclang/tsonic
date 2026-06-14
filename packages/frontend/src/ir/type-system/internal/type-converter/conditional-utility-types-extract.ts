import { TstsSyntax, type TstsNode } from "@tsonic/tsts";
import { IrType } from "../../../types.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";
import {
  isTypeParameterNode,
  flattenUnionIrType,
} from "./mapped-utility-types.js";
import {
  unwrapParens,
  flattenUnionTypeNodes,
} from "./conditional-utility-types-core.js";
import {
  asConverterNode,
  identifierText,
  nodeMembers,
  nodeParameters,
  nodeType,
  nodeTypeArguments,
} from "./tsts-syntax.js";

const convertParameterTuple = (
  parameters: readonly TstsNode[],
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType,
  defaultElementType: IrType
): IrType => ({
  kind: "tupleType",
  elementTypes: parameters.map((param) =>
    nodeType(param) ? convertType(nodeType(param)!, binding) : defaultElementType
  ),
});

const resolveTypeReferenceAliasDeclaration = (
  node: TstsNode,
  binding: Binding
): TstsNode | undefined => {
  if (!TstsSyntax.IsTypeReferenceNode(node)) return undefined;
  const declId = binding.resolveTypeReference(node);
  if (!declId) return undefined;
  const declInfo = (binding as BindingInternal)
    ._getHandleRegistry()
    .getDecl(declId);
  const decl = asConverterNode(declInfo?.declNode);
  return decl && TstsSyntax.IsTypeAliasDeclaration(decl) ? decl : undefined;
};

export const expandReturnType = (
  fArg: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType | null => {
  if (isTypeParameterNode(fArg, binding)) {
    return null;
  }

  const unwrapped = unwrapParens(fArg);
  if (TstsSyntax.IsUnionTypeNode(unwrapped)) {
    const results: IrType[] = [];
    for (const member of flattenUnionTypeNodes(unwrapped)) {
      const result = expandReturnType(member, binding, convertType);
      if (!result) return null;
      results.push(result);
    }
    const flat = results.flatMap((type) => flattenUnionIrType(type));
    if (flat.length === 0) return { kind: "neverType" };
    if (flat.length === 1) return flat[0] ?? { kind: "neverType" };
    return { kind: "unionType", types: flat };
  }

  if (TstsSyntax.IsFunctionTypeNode(unwrapped)) {
    return nodeType(unwrapped)
      ? convertType(nodeType(unwrapped)!, binding)
      : { kind: "voidType" };
  }

  const aliasDecl = resolveTypeReferenceAliasDeclaration(unwrapped, binding);
  const aliasType = aliasDecl
    ? TstsSyntax.AsTypeAliasDeclaration(aliasDecl)?.Type
    : undefined;
  if (aliasType && TstsSyntax.IsFunctionTypeNode(aliasType)) {
    return nodeType(aliasType)
      ? convertType(nodeType(aliasType)!, binding)
      : { kind: "voidType" };
  }

  if (TstsSyntax.IsTypeQueryNode(unwrapped)) {
    const exprName = TstsSyntax.AsTypeQueryNode(unwrapped)?.ExprName;
    if (exprName && TstsSyntax.IsIdentifier(exprName)) {
      const declId = binding.resolveIdentifier(exprName);
      if (declId) {
        const declInfo = (binding as BindingInternal)
          ._getHandleRegistry()
          .getDecl(declId);
        const decl = asConverterNode(declInfo?.declNode);

        if (
          decl &&
          (TstsSyntax.IsFunctionDeclaration(decl) ||
            TstsSyntax.IsMethodDeclaration(decl))
        ) {
          return nodeType(decl) ? convertType(nodeType(decl)!, binding) : null;
        }

        if (decl && TstsSyntax.IsVariableDeclaration(decl) && nodeType(decl)) {
          return expandReturnType(nodeType(decl)!, binding, convertType);
        }
      }
    }
  }

  return null;
};

export const expandParameters = (
  fArg: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType | null => {
  if (isTypeParameterNode(fArg, binding)) {
    return null;
  }

  let functionType: TstsNode | undefined;

  if (TstsSyntax.IsFunctionTypeNode(fArg)) {
    functionType = fArg;
  }

  if (!functionType && TstsSyntax.IsTypeReferenceNode(fArg)) {
    const aliasDecl = resolveTypeReferenceAliasDeclaration(fArg, binding);
    const aliasType = aliasDecl
      ? TstsSyntax.AsTypeAliasDeclaration(aliasDecl)?.Type
      : undefined;
    if (aliasType && TstsSyntax.IsFunctionTypeNode(aliasType)) {
      functionType = aliasType;
    }
  }

  if (!functionType && TstsSyntax.IsTypeQueryNode(fArg)) {
    const exprName = TstsSyntax.AsTypeQueryNode(fArg)?.ExprName;
    if (exprName && TstsSyntax.IsIdentifier(exprName)) {
      const declId = binding.resolveIdentifier(exprName);
      if (declId) {
        const declInfo = (binding as BindingInternal)
          ._getHandleRegistry()
          .getDecl(declId);
        const decl = asConverterNode(declInfo?.declNode);

        if (
          decl &&
          (TstsSyntax.IsFunctionDeclaration(decl) ||
            TstsSyntax.IsMethodDeclaration(decl))
        ) {
          return convertParameterTuple(
            nodeParameters(decl),
            binding,
            convertType,
            { kind: "anyType" }
          );
        }

        if (decl && TstsSyntax.IsVariableDeclaration(decl) && nodeType(decl)) {
          return expandParameters(nodeType(decl)!, binding, convertType);
        }
      }
    }
  }

  if (!functionType) {
    return null;
  }

  return convertParameterTuple(nodeParameters(functionType), binding, convertType, {
    kind: "anyType",
  });
};

export const expandAwaited = (
  tArg: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType | null => {
  if (isTypeParameterNode(tArg, binding)) {
    return null;
  }

  if (TstsSyntax.IsTypeReferenceNode(tArg)) {
    const name = identifierText(TstsSyntax.AsTypeReferenceNode(tArg)?.TypeName);
    const innerArg = nodeTypeArguments(tArg)[0];
    if ((name === "Promise" || name === "PromiseLike") && innerArg) {
      return (
        expandAwaited(innerArg, binding, convertType) ??
        convertType(innerArg, binding)
      );
    }
  }

  return convertType(tArg, binding);
};

export const expandConstructorParameters = (
  ctorArg: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType | null => {
  if (isTypeParameterNode(ctorArg, binding)) {
    return null;
  }

  const unwrapped = unwrapParens(ctorArg);
  if (TstsSyntax.IsUnionTypeNode(unwrapped)) {
    const members: IrType[] = [];
    for (const member of flattenUnionTypeNodes(unwrapped)) {
      const expanded = expandConstructorParameters(
        member,
        binding,
        convertType
      );
      if (!expanded) return null;
      members.push(expanded);
    }
    if (members.length === 0) return { kind: "neverType" };
    if (members.length === 1) return members[0] ?? { kind: "neverType" };
    return { kind: "unionType", types: members };
  }

  if (TstsSyntax.IsConstructorTypeNode(unwrapped)) {
    return convertParameterTuple(
      nodeParameters(unwrapped),
      binding,
      convertType,
      { kind: "unknownType" }
    );
  }

  const aliasDecl = resolveTypeReferenceAliasDeclaration(unwrapped, binding);
  const aliasType = aliasDecl
    ? TstsSyntax.AsTypeAliasDeclaration(aliasDecl)?.Type
    : undefined;
  if (aliasType && TstsSyntax.IsConstructorTypeNode(aliasType)) {
    return convertParameterTuple(
      nodeParameters(aliasType),
      binding,
      convertType,
      { kind: "unknownType" }
    );
  }

  if (TstsSyntax.IsTypeQueryNode(unwrapped)) {
    const exprName = TstsSyntax.AsTypeQueryNode(unwrapped)?.ExprName;
    if (!exprName || !TstsSyntax.IsIdentifier(exprName)) return null;
    const declId = binding.resolveIdentifier(exprName);
    if (!declId) return null;
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    const decl = asConverterNode(declInfo?.declNode);
    if (!decl) return null;

    if (TstsSyntax.IsClassDeclaration(decl)) {
      const ctor = nodeMembers(decl).find(
        TstsSyntax.IsConstructorDeclaration
      );
      return convertParameterTuple(
        ctor ? nodeParameters(ctor) : [],
        binding,
        convertType,
        { kind: "unknownType" }
      );
    }

    if (TstsSyntax.IsVariableDeclaration(decl) && nodeType(decl)) {
      return expandConstructorParameters(nodeType(decl)!, binding, convertType);
    }
  }

  return null;
};

export const expandInstanceType = (
  ctorArg: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType | null => {
  if (isTypeParameterNode(ctorArg, binding)) {
    return null;
  }

  const unwrapped = unwrapParens(ctorArg);
  if (TstsSyntax.IsUnionTypeNode(unwrapped)) {
    const members: IrType[] = [];
    for (const member of flattenUnionTypeNodes(unwrapped)) {
      const expanded = expandInstanceType(member, binding, convertType);
      if (!expanded) return null;
      members.push(expanded);
    }
    if (members.length === 0) return { kind: "neverType" };
    if (members.length === 1) return members[0] ?? { kind: "neverType" };
    return { kind: "unionType", types: members };
  }

  if (TstsSyntax.IsConstructorTypeNode(unwrapped)) {
    return nodeType(unwrapped)
      ? convertType(nodeType(unwrapped)!, binding)
      : { kind: "unknownType" };
  }

  const aliasDecl = resolveTypeReferenceAliasDeclaration(unwrapped, binding);
  const aliasType = aliasDecl
    ? TstsSyntax.AsTypeAliasDeclaration(aliasDecl)?.Type
    : undefined;
  if (aliasType && TstsSyntax.IsConstructorTypeNode(aliasType)) {
    return nodeType(aliasType)
      ? convertType(nodeType(aliasType)!, binding)
      : { kind: "unknownType" };
  }

  if (TstsSyntax.IsTypeQueryNode(unwrapped)) {
    const exprName = TstsSyntax.AsTypeQueryNode(unwrapped)?.ExprName;
    if (!exprName || !TstsSyntax.IsIdentifier(exprName)) return null;
    const declId = binding.resolveIdentifier(exprName);
    if (!declId) return null;
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    const decl = asConverterNode(declInfo?.declNode);
    if (!decl) return null;

    if (TstsSyntax.IsClassDeclaration(decl)) {
      const className = identifierText(TstsSyntax.Node_Name(decl));
      return className
        ? { kind: "referenceType", name: className }
        : { kind: "unknownType" };
    }

    if (TstsSyntax.IsVariableDeclaration(decl) && nodeType(decl)) {
      return expandInstanceType(nodeType(decl)!, binding, convertType);
    }
  }

  return null;
};
