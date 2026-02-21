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
import { createDiagnostic } from "../../types/diagnostic.js";
import { getSourceLocation } from "../../program/diagnostics.js";

const getSourceSpan = (node: ts.Node): ReturnType<typeof getSourceLocation> | undefined => {
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
      const source = node.moduleSpecifier.text;
      const isLocal = source.startsWith(".") || source.startsWith("/");

      // Use import-driven resolution to detect CLR imports
      // This works for any package that provides bindings.json
      // Note: Bindings are loaded upfront by discoverAndLoadClrBindings()
      // in dependency-graph.ts before IR building starts.
      const clrResolution = ctx.clrResolver.resolve(source);
      const isClr = clrResolution.isClr;
      const resolvedNamespace = clrResolution.isClr
        ? clrResolution.resolvedNamespace
        : undefined;
      const clrAssembly = clrResolution.isClr
        ? clrResolution.assembly
        : undefined;

      // Check for module binding (Node.js API, etc.)
      const moduleBinding = ctx.bindings.getBinding(source);
      const hasModuleBinding = moduleBinding?.kind === "module";

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
            typeof (parsed as { readonly namespace?: unknown }).namespace === "string"
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

      // Resolve optional tsbindgen flattened named exports for CLR imports.
      // This is used to bind named value imports (`import { x }`) to their
      // declaring CLR type/member (so the emitter can output valid C#).
      const resolvedSpecifiers =
        isClr && resolvedNamespace
          ? specifiers.map((spec) => {
              if (spec.kind !== "named") {
                return spec;
              }

              // Airplane-grade fallback: if TypeScript resolution can't prove this is a type
              // (e.g. due to module resolution / declaration file quirks), consult loaded
              // CLR bindings directly. CLR namespace imports frequently import types as
              // values (e.g. `import { List } ...`), and we must not misclassify those as
              // "value exports" requiring a flattened exports map.
              const isType =
                spec.isType === true || !!ctx.bindings.getType(spec.name);

              if (isType) {
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
                    expNamespace !== resolvedNamespace
                      ? `${expNamespace}.${spec.name}`
                      : undefined,
                };
              }

              // If this namespace facade re-exports values from other CLR namespaces,
              // the imported symbol will resolve to a declaration in that other
              // namespace's internal index. Use its owning bindings.json namespace
              // when looking up flattened export mappings.
              const expNamespace =
                resolveTsbindgenNamespaceForNamedImport(spec.name) ??
                resolvedNamespace;

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
            })
          : specifiers;

      // Assembly comes from CLR resolution (bindings.json) or module binding
      const resolvedAssembly =
        clrAssembly ?? (hasModuleBinding ? moduleBinding.assembly : undefined);

      imports.push({
        kind: "import",
        source,
        isLocal,
        isClr,
        specifiers: resolvedSpecifiers,
        resolvedNamespace,
        resolvedClrType: hasModuleBinding ? moduleBinding.type : undefined,
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
