/**
 * Import extraction from TSTS source files.
 *
 * Uses ProgramContext for import conversion.
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type {
  ExtensionImportBinding,
  ExtensionModuleImport,
  TstsNode,
  TstsSourceFile,
} from "@tsonic/tsts";
import {
  getTstsContainingSourceFile,
  getTstsNodeLocation,
} from "@tsonic/tsts";
import { IrImport, IrImportSpecifier } from "../types.js";
import type { ProgramContext } from "../program-context.js";
import type { Binding } from "../binding/index.js";
import type { TypeAuthority } from "../type-system/type-system.js";
import type { TypeBinding } from "../../program/binding-types.js";
import { parseTsonicModuleRequest } from "../../program/module-resolution.js";
import { createDiagnostic } from "../../types/diagnostic.js";
import { resolveImport } from "../../resolver.js";
import {
  memberSymbolIdFromStableId,
  moduleSymbolIdFromStableId,
  typeSymbolIdFromStableId,
} from "../../symbols/index.js";
import { extractRawExternalBindingsPayload } from "../../program/external-binding-payload.js";
import { getProgramSourceFileName } from "../../program/queries.js";

const getSourceSpan = (
  node: TstsNode
): ReturnType<typeof getTstsNodeLocation> | undefined => {
  const sourceFile = getTstsContainingSourceFile(node);
  return sourceFile ? getTstsNodeLocation(sourceFile, node) : undefined;
};

const normalizeProviderQualifiedTypeName = (targetName: string): string =>
  targetName.trim().replace(/`\d+/g, "").replace(/\+/g, ".");

const typeSymbolIdForExternalType = (
  ownerIdentity: string,
  providerQualifiedName: string,
  stableId?: string
) =>
  typeSymbolIdFromStableId(
    stableId ?? `${ownerIdentity}:${providerQualifiedName}`
  );

const typeBindingOwnerIdentity = (
  type: TypeBinding,
  defaultOwnerIdentity: string | undefined
): string =>
  type.members[0]?.binding.ownerIdentity ??
  defaultOwnerIdentity ??
  "external-surface";

/**
 * Extract import declarations from source file.
 * Uses Binding layer to determine if each import is a type or value.
 * Uses ExternalBindingsResolver to detect external namespace imports.
 */
export const extractImports = (
  sourceFile: TstsSourceFile,
  ctx: ProgramContext
): readonly IrImport[] => {
  const imports: IrImport[] = [];
  const bindingsNamespaceCache = new Map<string, string | null>();
  const sourceFileName = getProgramSourceFileName(sourceFile);

  for (const importModule of ctx.moduleGraph.getImports(sourceFile)) {
    const node = importModule.importNode;
    if (!node) {
      continue;
    }
    const source = importModule.specifier;
    const resolvedImport = resolveImport(source, sourceFileName, ctx.sourceRoot, {
      externalResolver: ctx.externalResolver,
      bindings: ctx.bindings,
      projectRoot: ctx.projectRoot,
      surface: ctx.surface,
      authoritativeTsonicPackageRoots: ctx.authoritativeTsonicPackageRoots,
      declarationModuleAliases: ctx.declarationModuleAliases,
    });
    const isSourcePackage =
      resolvedImport.ok && resolvedImport.value.isSourcePackage === true;
    const resolvedPath =
      importModule.resolvedModule?.resolvedFileName ??
      (resolvedImport.ok && resolvedImport.value.resolvedPath
        ? resolvedImport.value.resolvedPath
        : undefined);
    const resolvedImportIsExternalSurface =
      resolvedImport.ok &&
      resolvedImport.value.resolutionKind === "externalSurface";
    const isLocal = resolvedImport.ok
      ? resolvedImport.value.isLocal
      : source.startsWith(".") || source.startsWith("/") || isSourcePackage;

    const externalResolution = ctx.externalResolver.resolve(source);
    const isExternalSurfaceImport =
      resolvedImportIsExternalSurface ||
      (!resolvedImport.ok && externalResolution.kind === "externalSurface");
    const externalOwnerIdentity =
      isExternalSurfaceImport && externalResolution.kind === "externalSurface"
        ? externalResolution.ownerIdentity
        : resolvedImport.ok
          ? resolvedImport.value.providerOwnerIdentity
          : undefined;

    const getSourcePackageModuleBinding = (): ReturnType<
      ProgramContext["bindings"]["getBindingByKind"]
    > => {
      const exact = ctx.bindings.getBindingByKind(source, "module");
      if (exact) {
        return exact;
      }

      const request = parseTsonicModuleRequest(source);
      const subpath = request?.subpath;
      if (!subpath) {
        return undefined;
      }

      const normalizedSubpath = subpath.replace(/\\/g, "/");
      const withoutExtension = normalizedSubpath.replace(
        /\.(?:[cm]?ts|[cm]?js)$/i,
        ""
      );
      const candidates = [
        withoutExtension,
        withoutExtension.split("/").pop(),
        `node:${withoutExtension}`,
        `node:${withoutExtension.split("/").pop() ?? ""}`,
      ].filter(
        (candidate): candidate is string =>
          typeof candidate === "string" && candidate.length > 0
      );

      for (const candidate of candidates) {
        const binding = ctx.bindings.getBindingByKind(candidate, "module");
        if (binding) {
          return binding;
        }
      }

      return undefined;
    };

    const moduleBinding = getSourcePackageModuleBinding();
    const moduleBindingType =
      moduleBinding?.kind === "module" ? moduleBinding.type : undefined;
    const hasModuleBinding = moduleBindingType !== undefined;

    const specifiers = extractImportSpecifiers(
      importModule,
      ctx.binding,
      ctx.typeSystem
    );

    const namedSpecifierNodes = new Map<string, TstsNode>();
    for (const importBinding of importModule.bindings) {
      if (importBinding.kind === "named" && importBinding.bindingNode) {
        namedSpecifierNodes.set(
          importBinding.importedName,
          importBinding.bindingNode
        );
      }
    }

    const findNearestBindingsJson = (filePath: string): string | undefined => {
      let dir = dirname(filePath);
      for (let i = 0; i < 12; i++) {
        const candidate = join(dir, "bindings.json");
        if (existsSync(candidate)) return candidate;
        const parent = dirname(dir);
        if (parent === dir) return undefined;
        dir = parent;
      }
      return undefined;
    };

    const findOwningBindingsJson = (filePath: string): string | undefined => {
      const nearest = findNearestBindingsJson(filePath);
      if (nearest) return nearest;

      const nsKey = (() => {
        if (filePath.endsWith(".d.ts")) {
          return basename(filePath).slice(0, -".d.ts".length);
        }
        if (filePath.endsWith(".ts")) {
          return basename(filePath).slice(0, -".ts".length);
        }
        if (filePath.endsWith(".js")) {
          return basename(filePath).slice(0, -".js".length);
        }
        return undefined;
      })();
      if (nsKey) {
        const sibling = join(dirname(filePath), nsKey, "bindings.json");
        if (existsSync(sibling)) return sibling;
      }

      return undefined;
    };

    const readNamespaceFromBindingsJson = (
      bindingsPath: string
    ): string | undefined => {
      const cached = bindingsNamespaceCache.get(bindingsPath);
      if (cached !== undefined) return cached ?? undefined;

      try {
        const raw = readFileSync(bindingsPath, "utf-8");
        const parsed = JSON.parse(raw) as unknown;
        const ns = extractRawExternalBindingsPayload(parsed)?.namespace;
        bindingsNamespaceCache.set(bindingsPath, ns ?? null);
        return ns;
      } catch {
        bindingsNamespaceCache.set(bindingsPath, null);
        return undefined;
      }
    };

    const declarationFacadeNamespace =
      resolvedPath !== undefined
        ? (() => {
            const bindingsPath = findOwningBindingsJson(resolvedPath);
            return bindingsPath
              ? readNamespaceFromBindingsJson(bindingsPath)
              : undefined;
          })()
        : undefined;

    const resolvedNamespace = (() => {
      if (
        resolvedImportIsExternalSurface &&
        resolvedImport.value.resolvedNamespace
      ) {
        return resolvedImport.value.resolvedNamespace;
      }
      if (
        isExternalSurfaceImport &&
        externalResolution.kind === "externalSurface"
      ) {
        return externalResolution.resolvedNamespace;
      }
      if (declarationFacadeNamespace) {
        return declarationFacadeNamespace;
      }
      if (!moduleBindingType) {
        return undefined;
      }
      const lastDot = moduleBindingType.lastIndexOf(".");
      return lastDot > 0 ? moduleBindingType.slice(0, lastDot) : undefined;
    })();

    const resolveTsbindgenNamespaceForNamedImport = (
      exportName: string
    ): string | undefined => {
      const specNode = namedSpecifierNodes.get(exportName);
      if (!specNode) return undefined;

      const declId = ctx.binding.resolveImport(specNode);
      if (!declId) return undefined;

      const declPath = ctx.binding.getSourceFilePathOfDecl(declId);
      if (!declPath) return undefined;

      const bindingsPath = findOwningBindingsJson(declPath);
      if (!bindingsPath) return undefined;

      return readNamespaceFromBindingsJson(bindingsPath);
    };

    const resolveExternalTypeBindingForNamedImport = (
      exportName: string
    ): TypeBinding | undefined => {
      const matchesExportName = (type: TypeBinding): boolean => {
        if (type.alias === exportName) return true;

        const simpleAliasMatch = type.alias?.match(/^(.+)_(\d+)$/);
        if (simpleAliasMatch?.[1] === exportName) return true;

        const simpleTargetName = type.name.split(".").pop() ?? type.name;
        const normalizedTargetName = simpleTargetName.replace(/`\d+$/, "");
        return normalizedTargetName === exportName;
      };

      const findExactInNamespace = (
        namespace: string | undefined
      ): TypeBinding | undefined => {
        if (!namespace) return undefined;
        const namespaceBinding = ctx.bindings.getNamespace(namespace);
        const exact = namespaceBinding?.types.find(matchesExportName);
        if (exact) return exact;
        return undefined;
      };

      const exactInResolvedNamespace = findExactInNamespace(resolvedNamespace);
      if (exactInResolvedNamespace) {
        return exactInResolvedNamespace;
      }

      const owningNamespace =
        resolveTsbindgenNamespaceForNamedImport(exportName);
      if (owningNamespace && owningNamespace !== resolvedNamespace) {
        const exact = findExactInNamespace(owningNamespace);
        if (exact) return exact;
      }

      return undefined;
    };

    const importOwnerIdentity =
      externalOwnerIdentity ??
      (moduleBinding?.kind === "module"
        ? moduleBinding.ownerIdentity
        : undefined);

    const resolvedSpecifiers = specifiers.map((spec) => {
      if (spec.kind !== "named") {
        return spec;
      }

      const owningNamespace =
        resolveTsbindgenNamespaceForNamedImport(spec.name) ?? resolvedNamespace;
      const resolvedTypeBinding = owningNamespace
        ? resolveExternalTypeBindingForNamedImport(spec.name)
        : undefined;
      const isType = spec.isType === true;

      if (isType) {
        if (hasModuleBinding) {
          const resolvedTypeName = resolvedTypeBinding?.name
            ? normalizeProviderQualifiedTypeName(resolvedTypeBinding.name)
            : owningNamespace
              ? `${owningNamespace}.${spec.name}`
              : spec.providerQualifiedName;
          const ownerIdentity = resolvedTypeBinding
            ? typeBindingOwnerIdentity(resolvedTypeBinding, importOwnerIdentity)
            : (importOwnerIdentity ?? "external-surface");
          return {
            ...spec,
            isType: true,
            providerQualifiedName: resolvedTypeName,
            typeSymbolId: resolvedTypeName
              ? typeSymbolIdForExternalType(
                  ownerIdentity,
                  resolvedTypeName,
                  resolvedTypeBinding?.stableId
                )
              : spec.typeSymbolId,
          };
        }

        if (owningNamespace || resolvedTypeBinding?.name) {
          const ownerIdentity = resolvedTypeBinding
            ? typeBindingOwnerIdentity(resolvedTypeBinding, importOwnerIdentity)
            : (importOwnerIdentity ?? "external-surface");
          const resolvedTypeName =
            (resolvedTypeBinding?.name
              ? normalizeProviderQualifiedTypeName(resolvedTypeBinding.name)
              : undefined) ?? `${owningNamespace}.${spec.name}`;
          return {
            ...spec,
            isType: true,
            providerQualifiedName: resolvedTypeName,
            typeSymbolId: typeSymbolIdForExternalType(
              ownerIdentity,
              resolvedTypeName,
              resolvedTypeBinding?.stableId
            ),
          };
        }

        return {
          ...spec,
          isType: true,
        };
      }

      if (!owningNamespace) {
        return spec;
      }

      if (resolvedTypeBinding) {
        const resolvedTypeName = normalizeProviderQualifiedTypeName(
          resolvedTypeBinding.name
        );
        return {
          ...spec,
          providerQualifiedName: resolvedTypeName,
          typeSymbolId: typeSymbolIdForExternalType(
            typeBindingOwnerIdentity(resolvedTypeBinding, importOwnerIdentity),
            resolvedTypeName,
            resolvedTypeBinding.stableId
          ),
        };
      }

      const exp = ctx.bindings.getTsbindgenExport(owningNamespace, spec.name);
      if (!exp) {
        if (!hasModuleBinding) {
          const specNode = namedSpecifierNodes.get(spec.name);
          ctx.diagnostics.push(
            createDiagnostic(
              "TSN4004",
              "error",
              `Missing external binding for named value import '${spec.name}' from namespace '${owningNamespace}'.`,
              specNode ? getSourceSpan(specNode) : getSourceSpan(node),
              `This import refers to a value (function/const), but external namespaces cannot contain values. Regenerate bindings with tsbindgen so '${owningNamespace}/bindings.json' includes an 'exports' entry for '${spec.name}', or import the declaring container type and call it as a static member instead.`
            )
          );
        }
        return spec;
      }

      return {
        ...spec,
        providerValue: {
          ownerQualifiedName: exp.ownerQualifiedName,
          ownerIdentity: exp.ownerIdentity,
          memberName: exp.targetName,
        },
        memberSymbolId: memberSymbolIdFromStableId(
          `${exp.ownerIdentity}:${exp.ownerQualifiedName}.${exp.targetName}`
        ),
      };
    });

    imports.push({
      kind: "import",
      source,
      isLocal,
      isExternalSurface: isExternalSurfaceImport || hasModuleBinding,
      resolutionKind: isLocal
        ? "local"
        : isExternalSurfaceImport || hasModuleBinding
          ? "externalSurface"
          : "phantomTypeOnly",
      resolvedPath,
      specifiers: resolvedSpecifiers,
      resolvedNamespace,
      providerQualifiedName: moduleBindingType,
      providerOwnerIdentity: importOwnerIdentity,
      typeSymbolId:
        moduleBindingType && importOwnerIdentity
          ? typeSymbolIdFromStableId(`${importOwnerIdentity}:${moduleBindingType}`)
          : undefined,
      moduleSymbolId:
        moduleBindingType && importOwnerIdentity
          ? moduleSymbolIdFromStableId(
              `${importOwnerIdentity}:${moduleBindingType}`
            )
          : undefined,
    });
  }

  return imports;
};

/**
 * Extract import specifiers from an import declaration.
 * Uses Binding layer to determine if each named import is a type or value.
 */
export const extractImportSpecifiers = (
  importModule: ExtensionModuleImport,
  binding: Binding,
  typeSystem: TypeAuthority
): readonly IrImportSpecifier[] => {
  const specifiers: IrImportSpecifier[] = [];
  for (const importBinding of importModule.bindings) {
    if (importBinding.kind === "default") {
      specifiers.push({
        kind: "default",
        localName: importBinding.localName,
      });
      continue;
    }

    if (importBinding.kind === "namespace") {
      specifiers.push({
        kind: "namespace",
        localName: importBinding.localName,
      });
      continue;
    }

    specifiers.push({
      kind: "named",
      name: importBinding.importedName,
      localName: importBinding.localName,
      isType: isTypeImport(importBinding, binding, typeSystem),
    });
  }

  return specifiers;
};

/**
 * Determine if an import specifier refers to a type (interface, class, type alias, enum).
 * Uses TypeSystem.isTypeDecl() to check declaration kind.
 */
const isTypeImport = (
  importBinding: ExtensionImportBinding,
  binding: Binding,
  typeSystem: TypeAuthority
): boolean => {
  if (importBinding.kind !== "named") {
    return false;
  }

  if (importBinding.isTypeOnly) {
    return true;
  }

  if (!importBinding.bindingNode) {
    return false;
  }

  const declId = binding.resolveImport(importBinding.bindingNode);
  if (!declId) {
    return false;
  }

  return typeSystem.isTypeDecl(declId);
};
