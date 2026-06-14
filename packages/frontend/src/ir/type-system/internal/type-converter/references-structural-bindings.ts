import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { TstsNode } from "@tsonic/tsts";
import {
  forEachTstsChild,
  getTstsContainingSourceFileName,
  isTstsDeclarationFileNode,
  TstsSyntax,
} from "@tsonic/tsts";
import type { DeclId } from "../../../type-system/types.js";
import { tsbindgenTargetTypeNameToTsTypeName } from "../../../../tsbindgen/names.js";
import { extractRawExternalBindingTypes } from "../../../../program/external-binding-payload.js";
import { resolveContainingSourcePackageNamespace } from "../../../../program/source-file-identity.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";
import { getTypeAliasRecursionCache } from "./references-normalize.js";
import {
  isWellKnownSymbolPropertyName,
  tryResolveDeterministicPropertyName,
} from "../../../syntax/property-names.js";
import {
  asConverterNode,
  containingSourceFileName,
  nodeMembers,
} from "./tsts-syntax.js";
import { getSourceBindingAliasFromDeclaration } from "../source-binding-markers.js";

export const isTsonicBindingsDeclarationFile = (fileName: string): boolean =>
  fileName.includes("/tsonic/bindings/") ||
  fileName.includes("\\tsonic\\bindings\\");

const bindingAliasTargetIdentityCache = new Map<
  string,
  ReadonlyMap<string, string>
>();

const tsonicSourcePackageFileCache = new Map<string, boolean>();

export const isTsonicSourcePackageFile = (fileName: string): boolean => {
  const normalized = fileName.replace(/\\/g, "/");
  const cached = tsonicSourcePackageFileCache.get(normalized);
  if (cached !== undefined) return cached;

  let currentDir = dirname(fileName);
  while (true) {
    const manifestPath = join(currentDir, "tsonic.package.json");
    if (existsSync(manifestPath)) {
      try {
        const parsed = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
          readonly kind?: unknown;
        };
        const isSourcePackage = parsed.kind === "tsonic-source-package";
        tsonicSourcePackageFileCache.set(normalized, isSourcePackage);
        return isSourcePackage;
      } catch (error) {
        throw new Error(
          `Failed to read source package manifest '${manifestPath}': ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      tsonicSourcePackageFileCache.set(normalized, false);
      return false;
    }
    currentDir = parentDir;
  }
};

export const shouldPreserveUserTypeAliasIdentity = (
  decl: TstsNode
): boolean => {
  const fileName = containingSourceFileName(decl);
  if (!fileName) return false;
  return !isTstsDeclarationFileNode(decl) || isTsonicSourcePackageFile(fileName);
};

const findOwningBindingsJson = (fileName: string): string | undefined => {
  let currentDir = dirname(fileName);
  while (true) {
    const candidate = join(currentDir, "bindings.json");
    if (existsSync(candidate)) return candidate;

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  if (fileName.endsWith(".d.ts")) {
    const baseName = fileName.slice(0, -".d.ts".length);
    const lastSep = Math.max(
      baseName.lastIndexOf("/"),
      baseName.lastIndexOf("\\")
    );
    const stem = lastSep >= 0 ? baseName.slice(lastSep + 1) : baseName;
    if (stem.length > 0) {
      const sibling = join(dirname(fileName), stem, "bindings.json");
      if (existsSync(sibling)) return sibling;
    }
  }

  return undefined;
};

const buildBindingAliasTargetIdentityMap = (
  bindingsPath: string
): ReadonlyMap<string, string> => {
  const cached = bindingAliasTargetIdentityCache.get(bindingsPath);
  if (cached) return cached;

  const aliasToTarget = new Map<string, string>();

  try {
    const raw = JSON.parse(readFileSync(bindingsPath, "utf-8")) as unknown;
    const types = extractRawExternalBindingTypes(raw);
    if (types) {
      for (const type of types) {
        if (!type || typeof type !== "object") continue;
        const targetName = (type as { readonly targetName?: unknown })
          .targetName;
        if (typeof targetName !== "string" || targetName.trim().length === 0) {
          continue;
        }

        const tsAlias = tsbindgenTargetTypeNameToTsTypeName(targetName);
        const lastDot = targetName.lastIndexOf(".");
        if (lastDot <= 0) continue;

        const namespace = targetName.slice(0, lastDot);
        aliasToTarget.set(tsAlias, targetName);
        aliasToTarget.set(`${namespace}.${tsAlias}`, targetName);
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to read bindings metadata '${bindingsPath}': ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  bindingAliasTargetIdentityCache.set(bindingsPath, aliasToTarget);
  return aliasToTarget;
};

export const resolveSourceTargetIdentity = (
  declId: DeclId | undefined,
  binding: Binding
): string | undefined => {
  if (!declId) return undefined;
  const declInfo = (binding as BindingInternal)
    ._getHandleRegistry()
    .getDecl(declId);
  const declNode = asConverterNode(declInfo?.typeDeclNode ?? declInfo?.declNode);
  if (!declNode) return undefined;
  const fileName = getTstsContainingSourceFileName(declNode);
  if (!fileName) return undefined;

  const bindingsPath = findOwningBindingsJson(fileName);
  const markerQualifiedName = getSourceBindingAliasFromDeclaration(declNode);
  if (markerQualifiedName) {
    if (bindingsPath) {
      const exactTargetName =
        buildBindingAliasTargetIdentityMap(bindingsPath).get(
          markerQualifiedName
        );
      return exactTargetName ?? markerQualifiedName;
    }
    return markerQualifiedName;
  }

  const fqName = declInfo?.fqName?.trim();
  if (!fqName) return undefined;

  const isDeclarationFile = isTstsDeclarationFileNode(declNode);
  if (
    !isDeclarationFile &&
    isTsonicSourcePackageFile(fileName) &&
    !TstsSyntax.IsTypeAliasDeclaration(declNode)
  ) {
    const sourcePackageNamespace = resolveContainingSourcePackageNamespace(
      fileName
    );
    if (sourcePackageNamespace) {
      return `${sourcePackageNamespace}.${fqName}`;
    }
  }

  if (!isDeclarationFile || isTsonicSourcePackageFile(fileName)) {
    return undefined;
  }

  if (bindingsPath) {
    const exactTargetName =
      buildBindingAliasTargetIdentityMap(bindingsPath).get(fqName);
    return exactTargetName ?? fqName;
  }

  return fqName.includes(".") ? fqName : undefined;
};

export const isSafeToEraseUserTypeAliasTarget = (
  node: TstsNode
): boolean => {
  let current = node;
  while (TstsSyntax.IsParenthesizedTypeNode(current)) {
    const inner = TstsSyntax.AsParenthesizedTypeNode(current)?.Type;
    if (!inner) break;
    current = inner;
  }

  if (
    TstsSyntax.IsTypeLiteralNode(current) ||
    TstsSyntax.IsTupleTypeNode(current) ||
    TstsSyntax.IsMappedTypeNode(current) ||
    TstsSyntax.IsConditionalTypeNode(current)
  ) {
    return false;
  }

  return (
    TstsSyntax.IsTypeReferenceNode(current) ||
    TstsSyntax.IsExpressionWithTypeArguments(current) ||
    TstsSyntax.IsArrayTypeNode(current) ||
    TstsSyntax.IsFunctionTypeNode(current) ||
    TstsSyntax.IsConstructorTypeNode(current) ||
    TstsSyntax.IsIntersectionTypeNode(current) ||
    TstsSyntax.IsTypeOperatorNode(current) ||
    TstsSyntax.IsIndexedAccessTypeNode(current) ||
    TstsSyntax.IsLiteralTypeNode(current) ||
    TstsSyntax.IsTypePredicateNode(current) ||
    current.Kind === TstsSyntax.KindAnyKeyword ||
    current.Kind === TstsSyntax.KindUnknownKeyword ||
    current.Kind === TstsSyntax.KindNeverKeyword ||
    current.Kind === TstsSyntax.KindVoidKeyword ||
    current.Kind === TstsSyntax.KindUndefinedKeyword ||
    current.Kind === TstsSyntax.KindNullKeyword ||
    current.Kind === TstsSyntax.KindStringKeyword ||
    current.Kind === TstsSyntax.KindNumberKeyword ||
    current.Kind === TstsSyntax.KindBooleanKeyword ||
    current.Kind === TstsSyntax.KindObjectKeyword ||
    current.Kind === TstsSyntax.KindSymbolKeyword ||
    current.Kind === TstsSyntax.KindBigIntKeyword
  );
};

export const isRecursiveUserTypeAliasDeclaration = (
  declId: number,
  declNode: TstsNode,
  binding: Binding
): boolean => {
  const recursionCache = getTypeAliasRecursionCache(binding);
  const cached = recursionCache.get(declId);
  if (typeof cached === "boolean") {
    return cached;
  }

  const registry = (binding as BindingInternal)._getHandleRegistry();

  const referencesTargetAlias = (
    node: TstsNode,
    targetDeclId: number,
    activeAliasDeclIds: ReadonlySet<number>
  ): boolean => {
    if (TstsSyntax.IsTypeReferenceNode(node)) {
      const referencedDecl = binding.resolveTypeReference(node);
      if (referencedDecl) {
        if (referencedDecl.id === targetDeclId) {
          return true;
        }

        if (activeAliasDeclIds.has(referencedDecl.id)) {
          return false;
        }

        const referencedDeclInfo = registry.getDecl(referencedDecl);
        const referencedNode = asConverterNode(referencedDeclInfo?.declNode);
        if (
          referencedNode &&
          TstsSyntax.IsTypeAliasDeclaration(referencedNode) &&
          shouldPreserveUserTypeAliasIdentity(referencedNode) &&
          referencesTargetAlias(
            referencedNode,
            targetDeclId,
            new Set([...activeAliasDeclIds, referencedDecl.id])
          )
        ) {
          return true;
        }
      }
    }

    let found = false;
    forEachTstsChild(node, (child) => {
      if (found || !child) {
        return;
      }
      found = referencesTargetAlias(child, targetDeclId, activeAliasDeclIds);
    });
    return found;
  };

  const aliasType = TstsSyntax.AsTypeAliasDeclaration(declNode)?.Type;
  const isRecursive = aliasType
    ? referencesTargetAlias(aliasType, declId, new Set([declId]))
    : false;
  recursionCache.set(declId, isRecursive);
  return isRecursive;
};

export const shouldExtractFromDeclaration = (decl: TstsNode): boolean => {
  const fileName = containingSourceFileName(decl);
  if (!fileName) return false;
  const isDeclarationFile = isTstsDeclarationFileNode(decl);
  const isSourceBindingsDecl =
    isDeclarationFile && isTsonicBindingsDeclarationFile(fileName);
  const isSourcePackageFile =
    !isDeclarationFile && isTsonicSourcePackageFile(fileName);
  const hasExplicitSourceProtocolMember = (): boolean => {
    const members =
      TstsSyntax.IsInterfaceDeclaration(decl) ||
      TstsSyntax.IsClassDeclaration(decl)
        ? nodeMembers(decl)
        : TstsSyntax.IsTypeAliasDeclaration(decl) &&
            TstsSyntax.IsTypeLiteralNode(
              TstsSyntax.AsTypeAliasDeclaration(decl)?.Type
            )
          ? nodeMembers(TstsSyntax.AsTypeAliasDeclaration(decl)?.Type)
          : [];

    return members.some((member) => {
      const name = tryResolveDeterministicPropertyName(
        TstsSyntax.Node_Name(member)
      );
      return name !== undefined && isWellKnownSymbolPropertyName(name);
    });
  };

  if (
    (!isSourceBindingsDecl &&
      !isSourcePackageFile &&
      !hasExplicitSourceProtocolMember() &&
      fileName.includes("node_modules")) ||
    fileName.includes("lib.") ||
    (isDeclarationFile &&
      !isSourceBindingsDecl &&
      !hasExplicitSourceProtocolMember())
  ) {
    return false;
  }

  if (TstsSyntax.IsInterfaceDeclaration(decl)) {
    return true;
  }

  if (TstsSyntax.IsTypeAliasDeclaration(decl)) {
    return TstsSyntax.IsTypeLiteralNode(
      TstsSyntax.AsTypeAliasDeclaration(decl)?.Type
    );
  }

  return TstsSyntax.IsClassDeclaration(decl);
};
