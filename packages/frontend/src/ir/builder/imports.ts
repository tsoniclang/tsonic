/**
 * Import extraction from TypeScript source
 *
 * Uses ProgramContext for import conversion.
 */

import * as ts from "typescript";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { IrImport, IrImportSpecifier } from "../types.js";
import type { ProgramContext } from "../program-context.js";
import type { Binding } from "../binding/index.js";
import type { TypeAuthority } from "../type-system/type-system.js";
import type { TypeBinding } from "../../program/binding-types.js";
import { parseTsonicModuleRequest } from "../../program/module-resolution.js";
import { createDiagnostic } from "../../types/diagnostic.js";
import { getSourceLocation } from "../../program/diagnostics.js";
import { resolveImport } from "../../resolver.js";
import {
  memberSymbolIdFromStableId,
  moduleSymbolIdFromStableId,
  typeSymbolIdFromStableId,
} from "../../symbols/index.js";
import { extractRawExternalBindingsPayload } from "../../program/external-binding-payload.js";

const getSourceSpan = (
  node: ts.Node
): ReturnType<typeof getSourceLocation> | undefined => {
  try {
    const sourceFile = node.getSourceFile();
    if (!sourceFile) return undefined;
    return getSourceLocation(
      sourceFile,
      node.getStart(sourceFile),
      node.getWidth(sourceFile)
    );
  } catch {
    return undefined;
  }
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
  fallbackOwnerIdentity: string | undefined
): string =>
  type.members[0]?.binding.ownerIdentity ??
  fallbackOwnerIdentity ??
  "external-surface";

/**
 * Extract import declarations from source file.
 * Uses Binding layer to determine if each import is a type or value.
 * Uses ExternalBindingsResolver to detect external namespace imports.
 */
export const extractImports = (
  sourceFile: ts.SourceFile,
  ctx: ProgramContext
): readonly IrImport[] => {
  const imports: IrImport[] = [];
  const bindingsNamespaceCache = new Map<string, string | null>();

  const visitor = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const originalSource = node.moduleSpecifier.text;
      const source = originalSource;
      const resolvedImport = resolveImport(
        source,
        sourceFile.fileName,
        ctx.sourceRoot,
        {
          externalResolver: ctx.externalResolver,
          bindings: ctx.bindings,
          projectRoot: ctx.projectRoot,
          surface: ctx.surface,
          authoritativeTsonicPackageRoots: ctx.authoritativeTsonicPackageRoots,
          declarationModuleAliases: ctx.declarationModuleAliases,
        }
      );
      const isSourcePackage =
        resolvedImport.ok && resolvedImport.value.isSourcePackage === true;
      const resolvedPath =
        resolvedImport.ok && resolvedImport.value.resolvedPath
          ? resolvedImport.value.resolvedPath
          : undefined;
      const resolvedImportIsExternalSurface =
        resolvedImport.ok &&
        resolvedImport.value.resolutionKind === "externalSurface";
      const isLocal = resolvedImport.ok
        ? resolvedImport.value.isLocal
        : source.startsWith(".") || source.startsWith("/") || isSourcePackage;

      // Use import-driven resolution to detect external imports
      // This works for any package that provides bindings.json
      // Note: Bindings are loaded upfront by discoverAndLoadExternalBindings()
      // in dependency-graph.ts before IR building starts.
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

      // Check for module binding (Node.js API, etc.)
      const moduleBinding = getSourcePackageModuleBinding();
      const moduleBindingType =
        moduleBinding?.kind === "module" ? moduleBinding.type : undefined;
      const hasModuleBinding = moduleBindingType !== undefined;

      const specifiers = extractImportSpecifiers(
        node,
        ctx.binding,
        ctx.typeSystem
      );

      // Map imported export name -> specifier node for accurate diagnostics.
      const namedSpecifierNodes = new Map<string, ts.ImportSpecifier>();
      if (
        node.importClause?.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings)
      ) {
        for (const spec of node.importClause.namedBindings.elements) {
          namedSpecifierNodes.set((spec.propertyName ?? spec.name).text, spec);
        }
      }

      const findNearestBindingsJson = (
        filePath: string
      ): string | undefined => {
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

        // Facade modules live alongside their namespace directory:
        //   <root>/<Namespace>.d.ts + <root>/<Namespace>/bindings.json
        //   <root>/<Namespace>.js   + <root>/<Namespace>/bindings.json
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

        const exactInResolvedNamespace =
          findExactInNamespace(resolvedNamespace);
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

      // Resolve target identities for named imports from both external namespace
      // facades and module-bound surface facades (e.g. node:http ->
      // @tsonic/nodejs/nodejs.Http.js). Type imports must carry their owning
      // provider type into IR so the emitter never guesses between:
      //   - module object container types (e.g. nodejs.Http.http)
      //   - exported provider types (e.g. nodejs.Http.IncomingMessage)
      //
      // Value imports from external namespace facades additionally need flattened
      // declaring-type/member metadata because external namespaces cannot contain values.
      const resolvedSpecifiers = specifiers.map((spec) => {
        if (spec.kind !== "named") {
          return spec;
        }

        const owningNamespace =
          resolveTsbindgenNamespaceForNamedImport(spec.name) ??
          resolvedNamespace;
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
              ? typeBindingOwnerIdentity(
                  resolvedTypeBinding,
                  importOwnerIdentity
                )
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
              ? typeBindingOwnerIdentity(
                  resolvedTypeBinding,
                  importOwnerIdentity
                )
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
              typeBindingOwnerIdentity(
                resolvedTypeBinding,
                importOwnerIdentity
              ),
              resolvedTypeName,
              resolvedTypeBinding.stableId
            ),
          };
        }

        const exp = ctx.bindings.getTsbindgenExport(owningNamespace, spec.name);
        if (!exp) {
          // Airplane-grade: external namespaces have no namespace-level values.
          // If TS imports a value from an external namespace facade, there must
          // be an explicit declaring type + member binding. Otherwise the
          // compiler would have to guess.
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
            ? typeSymbolIdFromStableId(
                `${importOwnerIdentity}:${moduleBindingType}`
              )
            : undefined,
        moduleSymbolId:
          moduleBindingType && importOwnerIdentity
            ? moduleSymbolIdFromStableId(
                `${importOwnerIdentity}:${moduleBindingType}`
              )
            : undefined,
      });
    }
    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return imports;
};

/**
 * Extract import specifiers from an import declaration.
 * Uses Binding layer to determine if each named import is a type or value.
 */
export const extractImportSpecifiers = (
  node: ts.ImportDeclaration,
  binding: Binding,
  typeSystem: TypeAuthority
): readonly IrImportSpecifier[] => {
  const specifiers: IrImportSpecifier[] = [];

  if (node.importClause) {
    // Default import
    if (node.importClause.name) {
      specifiers.push({
        kind: "default",
        localName: node.importClause.name.text,
      });
    }

    // Named or namespace imports
    if (node.importClause.namedBindings) {
      if (ts.isNamespaceImport(node.importClause.namedBindings)) {
        specifiers.push({
          kind: "namespace",
          localName: node.importClause.namedBindings.name.text,
        });
      } else if (ts.isNamedImports(node.importClause.namedBindings)) {
        node.importClause.namedBindings.elements.forEach((spec) => {
          const isType = isTypeImport(spec, binding, typeSystem);
          specifiers.push({
            kind: "named",
            name: (spec.propertyName ?? spec.name).text,
            localName: spec.name.text,
            isType,
          });
        });
      }
    }
  }

  return specifiers;
};

/**
 * Determine if an import specifier refers to a type (interface, class, type alias, enum).
 * Uses TypeSystem.isTypeDecl() to check declaration kind.
 */
const isTypeImport = (
  spec: ts.ImportSpecifier,
  binding: Binding,
  typeSystem: TypeAuthority
): boolean => {
  try {
    const importClause = spec.parent.parent;
    if (ts.isImportClause(importClause) && importClause.isTypeOnly) {
      return true;
    }

    // TypeScript's isTypeOnly flag on the specifier itself (for `import { type Foo }`)
    if (spec.isTypeOnly) {
      return true;
    }

    // Use Binding to resolve the import to its declaration
    const declId = binding.resolveImport(spec);
    if (!declId) {
      return false;
    }

    // Use TypeSystem.isTypeDecl() to check if the declaration is a type.
    return typeSystem.isTypeDecl(declId);
  } catch {
    return false;
  }
};
