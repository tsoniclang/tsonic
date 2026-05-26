/**
 * Declaration file classification, bindings resolution, target identity,
 * and type-alias erasure/recursion analysis helpers.
 *
 * Split from references-structural.ts for file-size compliance (< 500 LOC).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as ts from "typescript";
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

/**
 * Check whether a declaration file is a Tsonic-generated bindings artifact.
 *
 * We only apply aggressive declaration-file type-alias erasure to these files.
 * Airplane-grade rule: Never erase type aliases from external provider packages.
 * Those aliases often encode nominal types (interfaces, delegates, indexers)
 * and must remain NOMINAL.
 */
export const isTsonicBindingsDeclarationFile = (fileName: string): boolean => {
  // Cross-platform: handle both POSIX and Windows paths.
  return (
    fileName.includes("/tsonic/bindings/") ||
    fileName.includes("\\tsonic\\bindings\\")
  );
};

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
  decl: ts.TypeAliasDeclaration
): boolean => {
  const sourceFile = decl.getSourceFile();
  return (
    !sourceFile.isDeclarationFile ||
    isTsonicSourcePackageFile(sourceFile.fileName)
  );
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
  const declNode = (declInfo?.typeDeclNode ?? declInfo?.declNode) as
    | ts.Declaration
    | undefined;
  if (!declNode) return undefined;
  const sourceFile = declNode.getSourceFile();

  const fqName = declInfo?.fqName?.trim();
  if (!fqName) return undefined;

  if (
    !sourceFile.isDeclarationFile &&
    isTsonicSourcePackageFile(sourceFile.fileName) &&
    !ts.isTypeAliasDeclaration(declNode)
  ) {
    const sourcePackageNamespace = resolveContainingSourcePackageNamespace(
      sourceFile.fileName
    );
    if (sourcePackageNamespace) {
      return `${sourcePackageNamespace}.${fqName}`;
    }
  }

  if (
    !sourceFile.isDeclarationFile ||
    isTsonicSourcePackageFile(sourceFile.fileName)
  ) {
    return undefined;
  }

  const bindingsPath = findOwningBindingsJson(sourceFile.fileName);
  if (bindingsPath) {
    const exactTargetName =
      buildBindingAliasTargetIdentityMap(bindingsPath).get(fqName);
    return exactTargetName ?? fqName;
  }

  if (fqName.includes(".")) {
    return fqName;
  }

  return undefined;
};

/**
 * Determine whether a TS-only type alias target is safe to erase to its underlying shape.
 *
 * Erase only aliases whose targets are semantically transparent for lowering:
 * - references / arrays / primitive and literal aliases
 * - callable aliases
 * - intersections / indexed access / typeof / keyof / readonly-style wrappers
 *
 * Preserve aliases whose identity is required for stable lowering contracts:
 * - object/type-literal aliases (these lower to stable emitted shapes)
 * - union aliases (runtime-union/discriminant stability)
 * - tuple aliases (tuple lowering stability)
 * - mapped / conditional aliases (non-local shape selection)
 */
export const isSafeToEraseUserTypeAliasTarget = (
  node: ts.TypeNode
): boolean => {
  // Peel parentheses (e.g., type X = (Y))
  while (ts.isParenthesizedTypeNode(node)) {
    node = node.type;
  }

  if (
    ts.isTypeLiteralNode(node) ||
    ts.isTupleTypeNode(node) ||
    ts.isMappedTypeNode(node) ||
    ts.isConditionalTypeNode(node)
  ) {
    return false;
  }

  return (
    ts.isTypeReferenceNode(node) ||
    ts.isExpressionWithTypeArguments(node) ||
    ts.isArrayTypeNode(node) ||
    ts.isFunctionTypeNode(node) ||
    ts.isConstructorTypeNode(node) ||
    ts.isIntersectionTypeNode(node) ||
    ts.isTypeOperatorNode(node) ||
    ts.isIndexedAccessTypeNode(node) ||
    ts.isLiteralTypeNode(node) ||
    ts.isTypePredicateNode(node) ||
    node.kind === ts.SyntaxKind.AnyKeyword ||
    node.kind === ts.SyntaxKind.UnknownKeyword ||
    node.kind === ts.SyntaxKind.NeverKeyword ||
    node.kind === ts.SyntaxKind.VoidKeyword ||
    node.kind === ts.SyntaxKind.UndefinedKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword ||
    node.kind === ts.SyntaxKind.StringKeyword ||
    node.kind === ts.SyntaxKind.NumberKeyword ||
    node.kind === ts.SyntaxKind.BooleanKeyword ||
    node.kind === ts.SyntaxKind.ObjectKeyword ||
    node.kind === ts.SyntaxKind.SymbolKeyword ||
    node.kind === ts.SyntaxKind.BigIntKeyword
  );
};

export const isRecursiveUserTypeAliasDeclaration = (
  declId: number,
  declNode: ts.TypeAliasDeclaration,
  binding: Binding
): boolean => {
  const recursionCache = getTypeAliasRecursionCache(binding);
  const cached = recursionCache.get(declId);
  if (typeof cached === "boolean") {
    return cached;
  }

  const registry = (binding as BindingInternal)._getHandleRegistry();

  const referencesTargetAlias = (
    node: ts.Node,
    targetDeclId: number,
    activeAliasDeclIds: ReadonlySet<number>
  ): boolean => {
    if (ts.isTypeReferenceNode(node)) {
      const referencedDecl = binding.resolveTypeReference(node);
      if (referencedDecl) {
        if (referencedDecl.id === targetDeclId) {
          return true;
        }

        if (activeAliasDeclIds.has(referencedDecl.id)) {
          return false;
        }

        const referencedDeclInfo = registry.getDecl(referencedDecl);
        const referencedNode = referencedDeclInfo?.declNode as
          | ts.Declaration
          | undefined;
        if (
          referencedNode &&
          ts.isTypeAliasDeclaration(referencedNode) &&
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
    node.forEachChild((child) => {
      if (found) {
        return;
      }
      found = referencesTargetAlias(child, targetDeclId, activeAliasDeclIds);
    });
    return found;
  };

  const isRecursive = referencesTargetAlias(
    declNode.type,
    declId,
    new Set([declId])
  );
  recursionCache.set(declId, isRecursive);
  return isRecursive;
};

/**
 * Check if a declaration should have structural members extracted.
 *
 * Only extract for:
 * - Interfaces (InterfaceDeclaration)
 * - Type aliases to object types (TypeAliasDeclaration with TypeLiteralNode)
 *
 * Do NOT extract for:
 * - Classes (have implementation, not just shape)
 * - Enums, namespaces
 * - Library types (from node_modules or lib.*.d.ts)
 * - Type aliases to primitives, unions, functions, etc.
 */
export const shouldExtractFromDeclaration = (decl: ts.Declaration): boolean => {
  const sourceFile = decl.getSourceFile();
  const fileName = sourceFile.fileName;
  const isSourceBindingsDecl =
    sourceFile.isDeclarationFile && isTsonicBindingsDeclarationFile(fileName);
  const isSourcePackageFile =
    !sourceFile.isDeclarationFile && isTsonicSourcePackageFile(fileName);
  const hasExplicitSourceProtocolMember = (): boolean => {
    const members = ts.isInterfaceDeclaration(decl)
      ? decl.members
      : ts.isClassDeclaration(decl)
        ? decl.members
        : ts.isTypeAliasDeclaration(decl) && ts.isTypeLiteralNode(decl.type)
          ? decl.type.members
          : undefined;

    if (!members) {
      return false;
    }

    return members.some((member) => {
      if (!("name" in member)) {
        return false;
      }
      const name = tryResolveDeterministicPropertyName(member.name);
      return name !== undefined && isWellKnownSymbolPropertyName(name);
    });
  };

  // Skip external library types, but keep first-party/source-package bindings
  // extractable even when they are installed under node_modules.
  //
  // This is required for the full installed-package class:
  // - source-package callback/contextual typing
  // - imported structural/container value recovery
  // - sibling type closure across package boundaries
  //
  // Tsonic-generated bindings under node_modules are not "external libraries"
  // in the tsbindgen sense; they are the authoritative first-party semantic
  // surface and must preserve structural shape.
  if (
    (!isSourceBindingsDecl &&
      !isSourcePackageFile &&
      !hasExplicitSourceProtocolMember() &&
      fileName.includes("node_modules")) ||
    fileName.includes("lib.") ||
    (sourceFile.isDeclarationFile &&
      !isSourceBindingsDecl &&
      !hasExplicitSourceProtocolMember())
  ) {
    return false;
  }

  // Only extract for interfaces
  if (ts.isInterfaceDeclaration(decl)) {
    return true;
  }

  // Only extract for type aliases that resolve to object types
  if (ts.isTypeAliasDeclaration(decl)) {
    // Check if the alias is to an object type (TypeLiteral)
    return ts.isTypeLiteralNode(decl.type);
  }

  // Class instance members can participate in deterministic contextual typing
  // even when the consuming module never imports the class directly (for example
  // callback parameter types inferred from an imported query surface). Preserve
  // the public instance shape so the soundness gate and member typing can see
  // the real class members without weakening to `any`.
  if (ts.isClassDeclaration(decl)) {
    return true;
  }

  // Don't extract for enums, etc.
  return false;
};
