/**
 * `instanceof` target type resolution for backend-neutral guard lowering.
 *
 * This is not a branch type engine. TSTS owns use-site narrowed types; this
 * helper only identifies the source type represented by the right-hand
 * constructor expression so the lowering plan can carry a deterministic guard
 * target.
 */

import {
  getTstsContainingSourceFile,
  getTstsIdentifierText,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import type { ProgramContext } from "../program-context.js";
import { stableIrTypeKeyIfDeterministic, type IrType } from "../types.js";
import { referenceTypeIdentity } from "../types/type-ops.js";
import { simpleBindingContributesTypeIdentity } from "../../program/binding-registry.js";
import { tsbindgenTargetTypeNameToTsTypeName } from "../../tsbindgen/names.js";
import {
  resolveContainingSourcePackageNamespace,
  resolveSourceFileNamespace,
  resolveSourceFileOwnerIdentity,
} from "../../program/source-file-identity.js";
import { typeSymbolIdFromStableId } from "../../symbols/symbol-ids.js";
import type { DeclId } from "../type-system/index.js";
import {
  getAccessPathTarget,
  getCurrentTypeForAccessPath,
} from "./access-paths.js";

const opaqueTypeIds = new WeakMap<object, number>();
let nextOpaqueTypeId = 0;

const unwrapExpression = (expr: TstsNode): TstsNode => {
  let current = expr;
  while (TstsSyntax.IsParenthesizedExpression(current)) {
    const expression = TstsSyntax.Node_Expression(current);
    if (!expression) return current;
    current = expression;
  }
  return current;
};

const visitKeyForType = (type: IrType): string => {
  const stableKey = stableIrTypeKeyIfDeterministic(type);
  if (stableKey) return stableKey;
  if (type.kind === "referenceType") {
    const identity = referenceTypeIdentity(type);
    if (identity) {
      return `ref:${identity}`;
    }
    if (!type.structuralMembers) {
      return `unresolved-ref:${type.name}/${type.typeArguments?.length ?? 0}`;
    }
  }
  const existing = opaqueTypeIds.get(type);
  if (existing !== undefined) return `opaque:${existing}`;
  const next = nextOpaqueTypeId;
  nextOpaqueTypeId += 1;
  opaqueTypeIds.set(type, next);
  return `opaque:${next}`;
};

export const resolveInstanceofTargetType = (
  expr: TstsNode,
  ctx: ProgramContext
): IrType | undefined => {
  const tryResolveExplicitGlobalBindingTargetType = (
    identifier: TstsNode
  ): IrType | undefined => {
    const identifierText = getTstsIdentifierText(identifier);
    if (!identifierText) {
      return undefined;
    }
    const simpleBinding = ctx.bindings.getExactBindingByKind(
      identifierText,
      "global"
    );
    if (
      !simpleBinding ||
      !simpleBindingContributesTypeIdentity(simpleBinding)
    ) {
      return undefined;
    }

    const identityTargetType = simpleBinding.staticType ?? simpleBinding.type;
    return {
      kind: "referenceType",
      name: tsbindgenTargetTypeNameToTsTypeName(identityTargetType),
      providerQualifiedName: identityTargetType,
    };
  };

  const isAnonymousStructuralReferenceType = (type: IrType): boolean =>
    type.kind === "referenceType" &&
    type.name.startsWith("__Anon_") &&
    (type.structuralMembers?.length ?? 0) > 0;

  const tryResolveConstructTargetFromTypeNode = (
    node: TstsNode | undefined
  ): IrType | undefined => {
    if (!node) {
      return undefined;
    }

    if (TstsSyntax.IsParenthesizedTypeNode(node)) {
      return tryResolveConstructTargetFromTypeNode(
        TstsSyntax.AsParenthesizedTypeNode(node)?.Type
      );
    }

    if (TstsSyntax.IsConstructorTypeNode(node)) {
      return ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(TstsSyntax.Node_Type(node) ?? node)
      );
    }

    if (TstsSyntax.IsTypeLiteralNode(node)) {
      const targets = new Map<string, IrType>();
      for (const member of TstsSyntax.Node_Members(node) ?? []) {
        if (
          !member ||
          !TstsSyntax.IsConstructSignatureDeclaration(member) ||
          !TstsSyntax.Node_Type(member)
        ) {
          continue;
        }

        const target = ctx.typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(TstsSyntax.Node_Type(member)!)
        );
        if (target.kind === "unknownType") {
          continue;
        }

        const preferred = selectPreferredTargetType(target) ?? target;
        const key = stableIrTypeKeyIfDeterministic(preferred);
        if (key) {
          targets.set(key, preferred);
        }
      }

      return targets.size === 1
        ? Array.from(targets.values())[0]
        : undefined;
    }

    if (TstsSyntax.IsIntersectionTypeNode(node)) {
      const targets = new Map<string, IrType>();
      for (const member of TstsSyntax.AsIntersectionTypeNode(node)?.Types
        ?.Nodes ?? []) {
        if (!member) continue;
        const target = tryResolveConstructTargetFromTypeNode(member);
        if (!target) {
          continue;
        }
        const key = stableIrTypeKeyIfDeterministic(target);
        if (key) {
          targets.set(key, target);
        }
      }

      return targets.size === 1
        ? Array.from(targets.values())[0]
        : undefined;
    }

    return undefined;
  };

  const tryResolveConstructTargetFromDecl = (
    declId: DeclId
  ): IrType | undefined => {
    const declNode = ctx.binding.getValueDeclarationNode(declId);
    if (
      ctx.binding.getKindOfDecl(declId) === "class" &&
      declNode &&
      TstsSyntax.IsClassDeclaration(declNode) &&
      getTstsIdentifierText(TstsSyntax.Node_Name(declNode))
    ) {
      const sourceFile = getTstsContainingSourceFile(declNode);
      const fileName = sourceFile?.FileName();
      if (!sourceFile || !fileName) {
        return undefined;
      }
      const normalizedFileName = fileName.replace(/\\/g, "/");
      const isExternalPackageSource =
        normalizedFileName.includes("/node_modules/");
      if (!sourceFile.IsDeclarationFile) {
        const sourcePackageNamespace = resolveContainingSourcePackageNamespace(
          fileName
        );
        const sourceNamespace =
          sourcePackageNamespace ??
          (!isExternalPackageSource
            ? resolveSourceFileNamespace(
                fileName,
                ctx.sourceRoot,
                ctx.rootNamespace
              )
            : undefined);
        if (sourceNamespace) {
          const simpleName = getTstsIdentifierText(TstsSyntax.Node_Name(declNode))!;
          const providerQualifiedName = `${sourceNamespace}.${simpleName}`;
          const ownerIdentity = resolveSourceFileOwnerIdentity(
            fileName,
            ctx.sourceRoot,
            ctx.rootNamespace
          );
          const stableId = `${ownerIdentity}:${providerQualifiedName}`;
          return {
            kind: "referenceType",
            name: simpleName,
            providerQualifiedName,
            typeId: {
              stableId,
              symbolId: typeSymbolIdFromStableId(stableId),
              sourceName: simpleName,
              ownerIdentity,
              providerName: providerQualifiedName,
              origin: "source",
            },
          };
        }
      }
    }

    const nodes: (TstsNode | undefined)[] = [
      ctx.binding.getTypeNodeOfDecl(declId),
      declNode && TstsSyntax.IsVariableDeclaration(declNode)
        ? TstsSyntax.Node_Type(declNode)
        : undefined,
    ];

    for (const node of nodes) {
      const target = tryResolveConstructTargetFromTypeNode(node);
      if (target) {
        return target;
      }
    }

    return undefined;
  };

  const tryResolvePrototypeTargetType = (
    type: IrType,
    seen: Set<string>
  ): IrType | undefined => {
    const typeKey = visitKeyForType(type);
    if (seen.has(typeKey)) {
      return undefined;
    }

    const prototypeType = ctx.typeSystem.typeOfMember(type, {
      kind: "byName",
      name: "prototype",
    });
    if (!prototypeType || prototypeType.kind === "unknownType") {
      return undefined;
    }

    const nextSeen = new Set(seen);
    nextSeen.add(typeKey);
    return selectPreferredTargetType(prototypeType, nextSeen);
  };

  const selectPreferredTargetType = (
    type: IrType,
    seen = new Set<string>()
  ): IrType | undefined => {
    if (
      type.kind === "unknownType" ||
      type.kind === "objectType" ||
      type.kind === "anyType"
    ) {
      return undefined;
    }

    if (isAnonymousStructuralReferenceType(type)) {
      return undefined;
    }

    if (type.kind === "referenceType") {
      const prototypeTarget = tryResolvePrototypeTargetType(type, seen);
      return prototypeTarget ?? type;
    }

    if (type.kind === "arrayType" || type.kind === "tupleType") {
      return type;
    }

    if (type.kind === "intersectionType") {
      const prototypeTarget = tryResolvePrototypeTargetType(type, seen);
      if (prototypeTarget) {
        return prototypeTarget;
      }

      const targets = new Map<string, IrType>();
      for (const member of type.types) {
        const selected = selectPreferredTargetType(member, seen);
        if (!selected) {
          continue;
        }
        const key = stableIrTypeKeyIfDeterministic(selected);
        if (key) {
          targets.set(key, selected);
        }
      }

      return targets.size === 1
        ? Array.from(targets.values())[0]
        : undefined;
    }

    return undefined;
  };

  const unwrapped = unwrapExpression(expr);

  if (TstsSyntax.IsIdentifier(unwrapped)) {
    const declId = ctx.binding.resolveIdentifier(unwrapped);
    let declaredValueTarget: IrType | undefined;
    if (declId) {
      const constructorTarget = tryResolveConstructTargetFromDecl(declId);
      if (constructorTarget) {
        return constructorTarget;
      }

      const declType = ctx.typeSystem.typeOfDecl(declId);
      const preferredDeclType = selectPreferredTargetType(declType);
      if (preferredDeclType) {
        if (preferredDeclType !== declType) {
          return preferredDeclType;
        }
        declaredValueTarget ??= preferredDeclType;
      }

      const valueReadType = ctx.typeSystem.typeOfValueRead(declId);
      const preferredValueReadType = selectPreferredTargetType(valueReadType);
      if (preferredValueReadType) {
        if (preferredValueReadType !== valueReadType) {
          return preferredValueReadType;
        }
        declaredValueTarget ??= preferredValueReadType;
      }
    }

    const explicitBindingTarget =
      tryResolveExplicitGlobalBindingTargetType(unwrapped);
    if (explicitBindingTarget) {
      return explicitBindingTarget;
    }

    return declaredValueTarget;
  }

  const accessTarget = getAccessPathTarget(unwrapped, ctx);
  if (!accessTarget) return undefined;

  const type = getCurrentTypeForAccessPath(accessTarget, ctx);
  if (!type) return undefined;

  const preferred = selectPreferredTargetType(type);
  if (preferred) {
    return preferred;
  }

  return undefined;
};
