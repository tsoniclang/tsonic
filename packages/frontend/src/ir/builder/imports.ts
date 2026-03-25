/**
 * Import extraction from TypeScript source
 *
 * Phase 5 Step 4: Uses ProgramContext instead of global singletons.
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

const clrTypeNameToCSharp = (clr: string): string =>
  clr.trim().replace(/`\d+/g, "").replace(/\+/g, ".");

/**
 * Extract import declarations from source file.
 * Uses Binding layer to determine if each import is a type or value.
 * Uses ClrBindingsResolver to detect CLR namespace imports.
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
          clrResolver: ctx.clrResolver,
          bindings: ctx.bindings,
          projectRoot: ctx.projectRoot,
          surface: ctx.surface,
          authoritativeTsonicPackageRoots: ctx.authoritativeTsonicPackageRoots,
        }
      );
      const isSourcePackage =
        resolvedImport.ok && resolvedImport.value.isSourcePackage === true;
      const resolvedPath =
        resolvedImport.ok && resolvedImport.value.resolvedPath
          ? resolvedImport.value.resolvedPath
          : undefined;
      const resolvedImportIsClr =
        resolvedImport.ok && resolvedImport.value.isClr === true;
      const isLocal =
        source.startsWith(".") || source.startsWith("/") || isSourcePackage;

      // Use import-driven resolution to detect CLR imports
      // This works for any package that provides bindings.json
      // Note: Bindings are loaded upfront by discoverAndLoadClrBindings()
      // in dependency-graph.ts before IR building starts.
      const clrResolution = ctx.clrResolver.resolve(source);
      const isClr =
        resolvedImportIsClr || (!resolvedImport.ok && clrResolution.isClr);
      const clrAssembly =
        isClr && clrResolution.isClr ? clrResolution.assembly : undefined;

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
      const resolvedNamespace = (() => {
        if (resolvedImportIsClr) {
          return resolvedImport.value.resolvedNamespace;
        }
        if (isClr && clrResolution.isClr) {
          return clrResolution.resolvedNamespace;
        }
        if (!moduleBindingType) {
          return undefined;
        }
        const lastDot = moduleBindingType.lastIndexOf(".");
        return lastDot > 0 ? moduleBindingType.slice(0, lastDot) : undefined;
      })();

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

        // Facade declarations live alongside their namespace directory:
        //   <root>/<Namespace>.d.ts  +  <root>/<Namespace>/bindings.json
        if (filePath.endsWith(".d.ts")) {
          const nsKey = basename(filePath).slice(0, -".d.ts".length);
          if (nsKey) {
            const sibling = join(dirname(filePath), nsKey, "bindings.json");
            if (existsSync(sibling)) return sibling;
          }
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
          const ns =
            parsed &&
            typeof parsed === "object" &&
            typeof (parsed as { readonly namespace?: unknown }).namespace ===
              "string"
              ? ((parsed as { readonly namespace: string }).namespace as string)
              : undefined;
          bindingsNamespaceCache.set(bindingsPath, ns ?? null);
          return ns;
        } catch {
          bindingsNamespaceCache.set(bindingsPath, null);
          return undefined;
        }
      };

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

      const resolveClrTypeBindingForNamedImport = (
        exportName: string,
        allowGlobalFallback: boolean
      ): TypeBinding | undefined => {
        const matchesExportName = (type: TypeBinding): boolean => {
          if (type.alias === exportName) return true;

          const simpleAliasMatch = type.alias?.match(/^(.+)_(\d+)$/);
          if (simpleAliasMatch?.[1] === exportName) return true;

          const simpleClrName = type.name.split(".").pop() ?? type.name;
          const normalizedClrName = simpleClrName.replace(/`\d+$/, "");
          return normalizedClrName === exportName;
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

        if (!allowGlobalFallback) {
          return undefined;
        }

        const globalMatch = ctx.bindings
          .getAllNamespaces()
          .flatMap((ns) => ns.types)
          .find(matchesExportName);
        if (globalMatch) return globalMatch;

        return ctx.bindings.getType(exportName);
      };

      // Resolve CLR identities for named imports from both CLR namespace facades
      // and module-bound surface facades (e.g. node:http -> @tsonic/nodejs/nodejs.Http.js).
      //
      // Type imports must carry their owning CLR type FQN into IR so the emitter
      // never guesses between:
      //   - module object container types (e.g. nodejs.Http.http)
      //   - exported CLR types (e.g. nodejs.Http.IncomingMessage)
      //
      // Value imports from CLR namespace facades additionally need flattened
      // declaring-type/member metadata because CLR namespaces cannot contain values.
      const resolvedSpecifiers = specifiers.map((spec) => {
        if (spec.kind !== "named") {
          return spec;
        }

        // Airplane-grade fallback: if TypeScript resolution can't prove this is a type
        // (e.g. due to declaration-file quirks), consult loaded CLR bindings directly
        // for CLR namespace facades. Module-bound surface imports rely on the TS import
        // form itself (`import type`) or checker result.
        const resolvedTypeBinding =
          (isClr || hasModuleBinding) && resolvedNamespace
            ? resolveClrTypeBindingForNamedImport(spec.name, !hasModuleBinding)
            : undefined;
        const isType = spec.isType === true;

        if (isType) {
          if (hasModuleBinding) {
            const expNamespace = resolveTsbindgenNamespaceForNamedImport(
              spec.name
            );
            return {
              ...spec,
              isType: true,
              resolvedClrType: resolvedTypeBinding?.name
                ? clrTypeNameToCSharp(resolvedTypeBinding.name)
                : (expNamespace ?? resolvedNamespace)
                  ? `${expNamespace ?? resolvedNamespace}.${spec.name}`
                  : spec.resolvedClrType,
            };
          }

          if (isClr && resolvedNamespace) {
            // If this facade re-exports CLR *types* from other namespaces,
            // resolve the true owning namespace and attach a per-import
            // CLR FQN for the emitter (so `new X()` emits in the correct
            // CLR namespace).
            const expNamespace =
              resolveTsbindgenNamespaceForNamedImport(spec.name) ??
              resolvedNamespace;
            return {
              ...spec,
              isType: true,
              resolvedClrType:
                (resolvedTypeBinding?.name
                  ? clrTypeNameToCSharp(resolvedTypeBinding.name)
                  : undefined) ??
                (expNamespace !== resolvedNamespace
                  ? `${expNamespace}.${spec.name}`
                  : undefined),
            };
          }

          return {
            ...spec,
            isType: true,
          };
        }

        if (!isClr || !resolvedNamespace) {
          return spec;
        }

        // If this namespace facade re-exports values from other CLR namespaces,
        // the imported symbol will resolve to a declaration in that other
        // namespace's internal index. Use its owning bindings.json namespace
        // when looking up flattened export mappings.
        const expNamespace =
          resolveTsbindgenNamespaceForNamedImport(spec.name) ??
          resolvedNamespace;
        if (resolvedTypeBinding) {
          return {
            ...spec,
            resolvedClrType: clrTypeNameToCSharp(resolvedTypeBinding.name),
          };
        }

        const exp = ctx.bindings.getTsbindgenExport(expNamespace, spec.name);
        if (!exp) {
          // Airplane-grade: C# has no namespace-level values.
          // If TS imports a *value* from a CLR namespace facade, we must have
          // an explicit binding to a declaring CLR type + member (tsbindgen exports mapping),
          // otherwise we would have to guess or emit invalid C#.
          //
          // Skip module bindings (e.g. @tsonic/nodejs/index.js) since those are
          // not CLR namespace facades.
          if (!hasModuleBinding) {
            const specNode = namedSpecifierNodes.get(spec.name);
            ctx.diagnostics.push(
              createDiagnostic(
                "TSN4004",
                "error",
                `Missing CLR binding for named value import '${spec.name}' from namespace '${resolvedNamespace}'.`,
                specNode ? getSourceSpan(specNode) : getSourceSpan(node),
                `This import refers to a value (function/const), but CLR namespaces cannot contain values. Regenerate bindings with tsbindgen so '${resolvedNamespace}/bindings.json' includes an 'exports' entry for '${spec.name}', or import the declaring container type and call it as a static member instead.`
              )
            );
          }
          return spec;
        }

        return {
          ...spec,
          resolvedClrValue: {
            declaringClrType: exp.declaringClrType,
            declaringAssemblyName: exp.declaringAssemblyName,
            memberName: exp.clrName,
          },
        };
      });

      // Assembly comes from CLR resolution (bindings.json) or module binding
      const resolvedAssembly =
        clrAssembly ??
        (moduleBinding?.kind === "module" ? moduleBinding.assembly : undefined);

      imports.push({
        kind: "import",
        source,
        isLocal,
        isClr,
        resolvedPath,
        specifiers: resolvedSpecifiers,
        resolvedNamespace,
        resolvedClrType: moduleBindingType,
        resolvedAssembly,
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
 * ALICE'S SPEC: Uses TypeSystem.isTypeDecl() to check declaration kind.
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

    // ALICE'S SPEC: Use TypeSystem.isTypeDecl() to check if declaration is a type
    return typeSystem.isTypeDecl(declId);
  } catch {
    return false;
  }
};
