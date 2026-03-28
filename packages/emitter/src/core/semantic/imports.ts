/**
 * Import processing and resolution
 *
 * All imports are resolved to fully-qualified global:: references.
 * No using statements are emitted - everything uses explicit FQN.
 *
 * All CLR name resolution happens here using module map - the emitter
 * just uses the pre-computed clrName directly (no string parsing).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { IrImport, IrModule, IrImportSpecifier } from "@tsonic/frontend";
import { EmitterContext, ImportBinding, LocalTypeInfo } from "../../types.js";
import type { ModuleIdentity } from "../../emitter-types/core.js";
import { canonicalizeFilePath, resolveImportPath } from "./module-map.js";
import { emitCSharpName } from "../../naming-policy.js";
import { emitTypeAst } from "../../type-emitter.js";
import { identifierType } from "../format/backend-ast/builders.js";
import {
  clrTypeNameToTypeAst,
  globallyQualifyTypeAst,
} from "../format/backend-ast/utils.js";

const projectedSourcePackagePathCache = new Map<string, string | null>();

const tryProjectSourcePackagePathToModuleKey = (
  resolvedPath: string
): string | undefined => {
  const normalizedPath = resolve(resolvedPath);
  const cached = projectedSourcePackagePathCache.get(normalizedPath);
  if (cached !== undefined) {
    return cached ?? undefined;
  }

  let currentDir = dirname(normalizedPath);
  for (;;) {
    const manifestPath = join(currentDir, "tsonic.package.json");
    const packageJsonPath = join(currentDir, "package.json");
    if (existsSync(manifestPath) && existsSync(packageJsonPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
          readonly kind?: unknown;
        };
        const packageJson = JSON.parse(
          readFileSync(packageJsonPath, "utf-8")
        ) as {
          readonly name?: unknown;
        };
        if (
          manifest.kind === "tsonic-source-package" &&
          typeof packageJson.name === "string" &&
          packageJson.name.length > 0
        ) {
          const relativeFromPackageRoot = relative(
            currentDir,
            normalizedPath
          ).replace(/\\/g, "/");
          if (
            relativeFromPackageRoot.length > 0 &&
            !relativeFromPackageRoot.startsWith("..") &&
            !isAbsolute(relativeFromPackageRoot)
          ) {
            const projected = canonicalizeFilePath(
              join(
                "node_modules",
                ...packageJson.name.split("/"),
                relativeFromPackageRoot
              )
            );
            projectedSourcePackagePathCache.set(normalizedPath, projected);
            return projected;
          }
        }
      } catch {
        // Ignore malformed package metadata and continue climbing.
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      projectedSourcePackagePathCache.set(normalizedPath, null);
      return undefined;
    }
    currentDir = parentDir;
  }
};

/**
 * Process imports and build ImportBindings for local and CLR modules.
 *
 * NOTE: No using statements are collected. All type/member references
 * are emitted as fully-qualified global:: names.
 *
 * - CLR imports: Build ImportBindings with fully-qualified global:: CLR names
 * - Local module imports: Build ImportBindings with fully-qualified CLR names
 */
export const processImports = (
  imports: readonly IrImport[],
  context: EmitterContext,
  module: IrModule
): EmitterContext => {
  const importBindings = new Map<string, ImportBinding>();

  const registerImportBinding = (
    spec: IrImportSpecifier,
    binding: { localName: string; importBinding: ImportBinding } | null
  ): void => {
    if (!binding) {
      return;
    }

    importBindings.set(binding.localName, binding.importBinding);

    if (
      spec.kind === "named" &&
      spec.isType === true &&
      spec.localName !== spec.name &&
      !importBindings.has(spec.name)
    ) {
      importBindings.set(spec.name, binding.importBinding);
    }
  };

  const resolveLocalTarget = (
    moduleMap: NonNullable<EmitterContext["options"]["moduleMap"]>,
    source: string,
    resolvedPath: string | undefined
  ): { readonly path: string; readonly module: ModuleIdentity } | undefined => {
    const relativeTargetPath = resolveImportPath(module.filePath, source);
    const resolvedTargetPath = resolvedPath
      ? canonicalizeFilePath(resolvedPath)
      : undefined;
    const projectedSourcePackagePath = resolvedPath
      ? tryProjectSourcePackagePathToModuleKey(resolvedPath)
      : undefined;
    const nodeModulesTargetPath = (() => {
      if (!resolvedTargetPath) return undefined;
      const marker = "/node_modules/";
      const index = resolvedTargetPath.lastIndexOf(marker);
      return index === -1 ? undefined : resolvedTargetPath.slice(index + 1);
    })();

    const directCandidates = [
      relativeTargetPath,
      resolvedTargetPath,
      nodeModulesTargetPath,
      projectedSourcePackagePath,
    ].filter((candidate): candidate is string => !!candidate);

    for (const candidate of directCandidates) {
      const identity = moduleMap.get(candidate);
      if (identity) {
        return {
          path: candidate,
          module: identity,
        };
      }
    }

    if (!resolvedTargetPath) {
      return undefined;
    }

    const suffixMatches = [...moduleMap.entries()].filter(([key]) => {
      if (key === resolvedTargetPath) return true;
      return resolvedTargetPath.endsWith(`/${key}`);
    });

    if (suffixMatches.length !== 1) {
      return undefined;
    }

    const firstMatch = suffixMatches[0];
    if (!firstMatch) {
      return undefined;
    }

    const [matchedPath, matchedModule] = firstMatch;
    return {
      path: matchedPath,
      module: matchedModule,
    };
  };

  const createBindingsBackedImportBinding = (
    spec: IrImportSpecifier,
    resolvedNamespace: string | undefined
  ): { localName: string; importBinding: ImportBinding } | null => {
    const inferredNamespace =
      resolvedNamespace ??
      (spec.kind === "named" && spec.resolvedClrType
        ? (() => {
            const lastDot = spec.resolvedClrType.lastIndexOf(".");
            return lastDot > 0
              ? spec.resolvedClrType.slice(0, lastDot)
              : undefined;
          })()
        : undefined) ??
      (spec.kind === "named" && spec.resolvedClrValue
        ? (() => {
            const lastDot =
              spec.resolvedClrValue.declaringClrType.lastIndexOf(".");
            return lastDot > 0
              ? spec.resolvedClrValue.declaringClrType.slice(0, lastDot)
              : undefined;
          })()
        : undefined);

    if (!inferredNamespace) {
      return null;
    }

    if (spec.kind === "named") {
      const isType = spec.isType === true;
      if (!isType && !spec.resolvedClrType && !spec.resolvedClrValue) {
        return null;
      }
    }

    return createClrImportBinding(spec, inferredNamespace);
  };

  const updatedContext = imports.reduce((ctx, imp) => {
    // Pure module bindings (for example bare `node:fs`) still bypass local
    // module-map resolution and bind directly to their CLR container/type.
    //
    // Installed source-package redirects remain `isLocal` on purpose. For
    // those we must resolve through the inlined source graph so named re-exports
    // bind to the actual generated container/type locations rather than the
    // coarse module binding root from `bindings.json`.
    if (imp.resolvedClrType && !imp.isLocal) {
      const moduleClrType = `global::${imp.resolvedClrType}`;
      for (const spec of imp.specifiers) {
        const binding = createModuleImportBinding(
          spec,
          moduleClrType,
          imp.resolvedNamespace
        );
        registerImportBinding(spec, binding);
      }
      return ctx;
    }

    if (imp.isLocal) {
      // Local import - build ImportBindings with fully-qualified CLR names
      // NO using directive for local modules
      const moduleMap = ctx.options.moduleMap;
      const exportMap = ctx.options.exportMap;
      let resolvedFromModuleMap = false;
      if (moduleMap) {
        const resolvedTarget = resolveLocalTarget(
          moduleMap,
          imp.source,
          imp.resolvedPath
        );
        const targetPath = resolvedTarget?.path;

        // Process each import specifier - may need to resolve re-exports
        for (const spec of imp.specifiers) {
          const exportName =
            spec.kind === "named"
              ? spec.name
              : spec.kind === "default"
                ? ""
                : "";

          // Check if this is a re-export - look up in export map
          const reexportKey = `${targetPath}:${exportName}`;
          const reexportSource = exportMap?.get(reexportKey);

          // Determine the actual source module
          const actualSourcePath = reexportSource?.sourceFile ?? targetPath;
          const actualExportName = reexportSource?.sourceName ?? exportName;
          const targetModule = actualSourcePath
            ? moduleMap.get(actualSourcePath)
            : resolvedTarget?.module;

          if (targetModule) {
            resolvedFromModuleMap = true;
            const binding = createImportBinding(
              spec,
              targetModule.namespace,
              targetModule.className,
              actualExportName,
              targetModule.hasTypeCollision,
              targetModule.exportedValueKinds,
              targetModule.exportedValueCallArities,
              targetModule.localTypes,
              ctx
            );
            registerImportBinding(spec, binding);
          }
        }
        // If module not found in map, it's a compilation error - will be caught elsewhere
      }

      if (!resolvedFromModuleMap) {
        for (const spec of imp.specifiers) {
          const binding = createBindingsBackedImportBinding(
            spec,
            imp.resolvedNamespace
          );
          registerImportBinding(spec, binding);
        }
      }
      // No module map = single file compilation, no import bindings needed
    }

    // CLR imports (from @tsonic/dotnet/* or similar packages)
    if (imp.isClr && imp.resolvedNamespace) {
      for (const spec of imp.specifiers) {
        const binding = createClrImportBinding(spec, imp.resolvedNamespace);
        registerImportBinding(spec, binding);
      }
      return ctx;
    }

    // External packages not supported in MVP
    return ctx;
  }, context);

  // Add import bindings to context
  return {
    ...updatedContext,
    importBindings,
  };
};

/**
 * Create import binding for CLR types/values.
 * CLR types are emitted with global:: FQN.
 *
 * - Type imports: typeAst is the type's fully-qualified AST
 * - Value imports: clrName is global::namespace, member is the export name
 */
const createClrImportBinding = (
  spec: IrImportSpecifier,
  namespace: string
): { localName: string; importBinding: ImportBinding } | null => {
  const localName = spec.localName;
  const namespaceFqn = `global::${namespace}`;
  const createTypeBinding = (clrName: string): ImportBinding => ({
    kind: "type",
    typeAst: clrTypeNameToTypeAst(clrName),
  });

  if (spec.kind === "named") {
    // Use isType from frontend (determined by TS checker)
    const isType = spec.isType === true;

    if (isType) {
      // Type import: preserve the type as AST instead of rendering text eagerly
      return {
        localName,
        importBinding: createTypeBinding(
          spec.resolvedClrType
            ? `global::${spec.resolvedClrType}`
            : `${namespaceFqn}.${spec.name}`
        ),
      };
    } else {
      // Value import:
      // - If tsbindgen provided a flattened export mapping, bind directly to
      //   the declaring CLR type + member.
      if (spec.resolvedClrValue) {
        return {
          localName,
          importBinding: {
            kind: "value",
            clrName: `global::${spec.resolvedClrValue.declaringClrType}`,
            member: spec.resolvedClrValue.memberName,
          },
        };
      }
      if (spec.resolvedClrType) {
        return {
          localName,
          importBinding: {
            kind: "namespace",
            clrName: `global::${spec.resolvedClrType}`,
          },
        };
      }
      throw new Error(
        `ICE: Missing resolvedClrValue for CLR value import '${spec.name}' from '${namespace}'.`
      );
    }
  }

  if (spec.kind === "namespace") {
    // Namespace imports (import * as NS) - bind to the namespace
    return {
      localName,
      importBinding: {
        kind: "namespace",
        clrName: namespaceFqn,
      },
    };
  }

  // Default imports not supported for CLR namespaces
  return null;
};

/**
 * Create import binding with fully-qualified global:: CLR names.
 * Uses isType from frontend (set by TS checker) to determine kind.
 *
 * - Type imports: typeAst is the type's fully-qualified AST
 * - Value imports: clrName is the container global:: FQN, member is the export name
 * - Namespace imports: clrName is the container global:: FQN
 */
const createImportBinding = (
  spec: IrImportSpecifier,
  namespace: string,
  containerClassName: string,
  resolvedExportName: string,
  hasTypeCollision: boolean = false,
  exportedValueKinds: ReadonlyMap<string, "function" | "variable"> | undefined,
  exportedValueCallArities: ReadonlyMap<string, readonly number[]> | undefined,
  targetLocalTypes: ReadonlyMap<string, LocalTypeInfo> | undefined,
  context: EmitterContext
): { localName: string; importBinding: ImportBinding } | null => {
  const localName = spec.localName;
  // Value exports live in ClassName__Module when there's a type collision, otherwise in ClassName
  const valueContainerName = hasTypeCollision
    ? `${containerClassName}__Module`
    : containerClassName;
  const valueContainerFqn = `global::${namespace}.${valueContainerName}`;

  if (spec.kind === "named") {
    // Use isType from frontend (determined by TS checker)
    const isType = spec.isType === true;

    if (isType) {
      const localType = targetLocalTypes?.get(resolvedExportName);

      // Type aliases:
      // - Structural aliases (`type T = { ... }`) are emitted as `T__Alias` classes
      // - Non-structural aliases are erased to their underlying type at emission time
      if (localType?.kind === "typeAlias") {
        if (localType.type.kind === "objectType") {
          return {
            localName,
            importBinding: {
              kind: "type",
              typeAst: identifierType(
                `global::${namespace}.${resolvedExportName}__Alias`
              ),
              aliasType: localType.type,
              aliasTypeParameters: localType.typeParameters,
            },
          };
        }

        if (localType.typeParameters.length > 0) {
          return null;
        }

        const [typeAst] = emitTypeAst(localType.type, {
          ...context,
          localTypes: targetLocalTypes,
          moduleNamespace: namespace,
          // Always fully qualify local types from the target module when erasing aliases,
          // so the resulting C# type is usable across files.
          qualifyLocalTypes: true,
        });

        return {
          localName,
          importBinding: {
            kind: "type",
            typeAst: globallyQualifyTypeAst(typeAst),
            aliasType: localType.type,
            aliasTypeParameters: localType.typeParameters,
          },
        };
      }

      // Type import: clrName is the type's FQN at namespace level.
      // (Classes/interfaces/enums are emitted at namespace scope.)
      return {
        localName,
        importBinding: {
          kind: "type",
          typeAst: identifierType(`global::${namespace}.${resolvedExportName}`),
        },
      };
    } else {
      const valueKind = exportedValueKinds?.get(resolvedExportName);
      const bucket = valueKind === "variable" ? "fields" : "methods";
      const localType = targetLocalTypes?.get(resolvedExportName);
      const typeAst =
        localType?.kind === "class" || localType?.kind === "enum"
          ? identifierType(`global::${namespace}.${resolvedExportName}`)
          : undefined;
      // Value import: clrName is the value container, member is the export name
      return {
        localName,
        importBinding: {
          kind: "value",
          clrName: valueContainerFqn,
          member: emitCSharpName(resolvedExportName, bucket, context),
          valueKind,
          typeAst,
          runtimeOmittableCallArities:
            exportedValueCallArities?.get(resolvedExportName),
        },
      };
    }
  }

  if (spec.kind === "default") {
    return {
      localName,
      importBinding: {
        kind: "namespace",
        clrName: valueContainerFqn,
        memberKinds: exportedValueKinds,
        memberCallArities: exportedValueCallArities,
        moduleObject: true,
      },
    };
  }

  if (spec.kind === "namespace") {
    // Namespace imports (import * as M) - bind to the value container class
    return {
      localName,
      importBinding: {
        kind: "namespace",
        clrName: valueContainerFqn,
        memberKinds: exportedValueKinds,
        memberCallArities: exportedValueCallArities,
        moduleObject: true,
      },
    };
  }

  return null;
};

const createModuleImportBinding = (
  spec: IrImportSpecifier,
  moduleClrType: string,
  clrNamespace: string | undefined
): { localName: string; importBinding: ImportBinding } | null => {
  const localName = spec.localName;
  const normalizedModuleClrType = moduleClrType.startsWith("global::")
    ? moduleClrType.slice("global::".length)
    : moduleClrType;
  const moduleObjectName = (() => {
    const lastDot = normalizedModuleClrType.lastIndexOf(".");
    return lastDot >= 0
      ? normalizedModuleClrType.slice(lastDot + 1)
      : normalizedModuleClrType;
  })();

  if (spec.kind === "namespace") {
    return {
      localName,
      importBinding: {
        kind: "namespace",
        clrName: moduleClrType,
        moduleObject: true,
      },
    };
  }

  if (spec.kind === "default") {
    return {
      localName,
      importBinding: {
        kind: "namespace",
        clrName: moduleClrType,
        moduleObject: true,
      },
    };
  }

  if (spec.kind === "named") {
    if (spec.resolvedClrType) {
      return {
        localName,
        importBinding: {
          kind: "namespace",
          clrName: `global::${spec.resolvedClrType}`,
        },
      };
    }

    if (spec.isType === true) {
      const clrName = spec.resolvedClrType
        ? `global::${spec.resolvedClrType}`
        : clrNamespace
          ? `global::${clrNamespace}.${spec.name}`
          : undefined;
      if (!clrName) {
        throw new Error(
          `ICE: Missing CLR type mapping for module import type '${spec.name}'.`
        );
      }
      return {
        localName,
        importBinding: {
          kind: "type",
          typeAst: clrTypeNameToTypeAst(clrName),
        },
      };
    }

    // Canonical module-object import:
    // import { fs } from "node:fs"  -> bind local fs to module container type.
    if (spec.name === moduleObjectName) {
      return {
        localName,
        importBinding: {
          kind: "namespace",
          clrName: moduleClrType,
        },
      };
    }

    // Value import passthrough: import { readFileSync as read } ...
    return {
      localName,
      importBinding: {
        kind: "value",
        clrName: moduleClrType,
        member: spec.name,
        moduleObject: true,
      },
    };
  }
  return null;
};
