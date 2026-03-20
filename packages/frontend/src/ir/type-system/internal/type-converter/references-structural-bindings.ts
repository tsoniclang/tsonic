/**
 * Declaration file classification, bindings resolution, CLR identity,
 * and type-alias erasure/recursion analysis helpers.
 *
 * Split from references-structural.ts for file-size compliance (< 500 LOC).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as ts from "typescript";
import type { DeclId } from "../../../type-system/types.js";
import { tsbindgenClrTypeNameToTsTypeName } from "../../../../tsbindgen/names.js";
import { extractRawDotnetBindingTypes } from "../../../../program/dotnet-binding-payload.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";
import { getTypeAliasRecursionCache } from "./references-normalize.js";

/**
 * Check whether a declaration file is a Tsonic-generated bindings artifact.
 *
 * We only apply aggressive declaration-file type-alias erasure to these files.
 * Airplane-grade rule: Never erase type aliases from tsbindgen-produced stdlib
 * packages (e.g., @tsonic/dotnet, @tsonic/core). Those aliases often encode CLR
 * nominal types (interfaces, delegates, indexers) and must remain NOMINAL.
 */
export const isTsonicBindingsDeclarationFile = (fileName: string): boolean => {
  // Cross-platform: handle both POSIX and Windows paths.
  return (
    fileName.includes("/tsonic/bindings/") ||
    fileName.includes("\\tsonic\\bindings\\")
  );
};

const bindingAliasClrIdentityCache = new Map<
  string,
  ReadonlyMap<string, string>
>();

const tsonicSourcePackageFileCache = new Map<string, boolean>();

export const isInstalledTsonicSourcePackageFile = (
  fileName: string
): boolean => {
  const normalized = fileName.replace(/\\/g, "/");
  const cached = tsonicSourcePackageFileCache.get(normalized);
  if (cached !== undefined) return cached;

  if (!normalized.includes("/node_modules/")) {
    tsonicSourcePackageFileCache.set(normalized, false);
    return false;
  }

  let currentDir = dirname(fileName);
  while (true) {
    const manifestPath = join(currentDir, "tsonic", "package-manifest.json");
    if (existsSync(manifestPath)) {
      try {
        const parsed = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
          readonly kind?: unknown;
        };
        const isSourcePackage = parsed.kind === "tsonic-source-package";
        tsonicSourcePackageFileCache.set(normalized, isSourcePackage);
        return isSourcePackage;
      } catch {
        tsonicSourcePackageFileCache.set(normalized, false);
        return false;
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
    isInstalledTsonicSourcePackageFile(sourceFile.fileName)
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

const buildBindingAliasClrIdentityMap = (
  bindingsPath: string
): ReadonlyMap<string, string> => {
  const cached = bindingAliasClrIdentityCache.get(bindingsPath);
  if (cached) return cached;

  const aliasToClr = new Map<string, string>();

  try {
    const raw = JSON.parse(readFileSync(bindingsPath, "utf-8")) as unknown;
    const types = extractRawDotnetBindingTypes(raw);
    if (types) {
      for (const type of types) {
        if (!type || typeof type !== "object") continue;
        const clrName = (type as { readonly clrName?: unknown }).clrName;
        if (typeof clrName !== "string" || clrName.trim().length === 0) {
          continue;
        }

        const tsAlias = tsbindgenClrTypeNameToTsTypeName(clrName);
        const lastDot = clrName.lastIndexOf(".");
        if (lastDot <= 0) continue;

        const namespace = clrName.slice(0, lastDot);
        aliasToClr.set(`${namespace}.${tsAlias}`, clrName);
      }
    }
  } catch {
    // Fall through to the conservative fallback.
  }

  bindingAliasClrIdentityCache.set(bindingsPath, aliasToClr);
  return aliasToClr;
};

export const resolveSourceBindingsClrIdentity = (
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
  if (!declNode.getSourceFile().isDeclarationFile) return undefined;
  if (!isTsonicBindingsDeclarationFile(declNode.getSourceFile().fileName)) {
    return undefined;
  }

  const fqName = declInfo?.fqName?.trim();
  if (!fqName || !fqName.includes(".")) return undefined;

  const bindingsPath = findOwningBindingsJson(
    declNode.getSourceFile().fileName
  );
  if (bindingsPath) {
    const exactClrName =
      buildBindingAliasClrIdentityMap(bindingsPath).get(fqName);
    if (exactClrName) return exactClrName;
  }

  return fqName;
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
    ts.isUnionTypeNode(node) ||
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
  if (cached === "in-progress") {
    return true;
  }
  if (typeof cached === "boolean") {
    return cached;
  }

  recursionCache.set(declId, "in-progress");
  const registry = (binding as BindingInternal)._getHandleRegistry();
  let isRecursive = false;

  const visit = (node: ts.Node): void => {
    if (isRecursive) return;

    if (ts.isTypeReferenceNode(node)) {
      const referencedDecl = binding.resolveTypeReference(node);
      if (referencedDecl) {
        if (referencedDecl.id === declId) {
          isRecursive = true;
          return;
        }

        const referencedDeclInfo = registry.getDecl(referencedDecl);
        const referencedNode = referencedDeclInfo?.declNode as
          | ts.Declaration
          | undefined;
        if (
          referencedNode &&
          ts.isTypeAliasDeclaration(referencedNode) &&
          shouldPreserveUserTypeAliasIdentity(referencedNode) &&
          isRecursiveUserTypeAliasDeclaration(
            referencedDecl.id,
            referencedNode,
            binding
          )
        ) {
          isRecursive = true;
          return;
        }
      }
    }

    node.forEachChild(visit);
  };

  visit(declNode.type);
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
  const isInstalledSourcePackageFile =
    !sourceFile.isDeclarationFile &&
    isInstalledTsonicSourcePackageFile(fileName);

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
      !isInstalledSourcePackageFile &&
      fileName.includes("node_modules")) ||
    fileName.includes("lib.") ||
    (sourceFile.isDeclarationFile && !isSourceBindingsDecl)
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
