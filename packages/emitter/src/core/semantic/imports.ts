/**
 * Import processing and resolution
 *
 * All imports are resolved to fully-qualified global:: references.
 * No using statements are emitted - everything uses explicit FQN.
 *
 * All CLR name resolution happens here using module map - the emitter
 * just uses the pre-computed clrName directly (no string parsing).
 */

import { IrImport, IrModule, IrImportSpecifier } from "@tsonic/frontend";
import { EmitterContext, ImportBinding, LocalTypeInfo } from "../../types.js";
import { resolveImportPath } from "./module-map.js";
import { emitCSharpName } from "../../naming-policy.js";
import { emitTypeAst } from "../../type-emitter.js";
import { renderTypeAst } from "../format/backend-ast/utils.js";

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

  const updatedContext = imports.reduce((ctx, imp) => {
    // CLR imports (from @tsonic/dotnet/* or similar packages)
    if (imp.isClr && imp.resolvedNamespace) {
      for (const spec of imp.specifiers) {
        const binding = createClrImportBinding(spec, imp.resolvedNamespace);
        if (binding) {
          importBindings.set(binding.localName, binding.importBinding);
        }
      }
      return ctx;
    }

    if (imp.isLocal) {
      // Local import - build ImportBindings with fully-qualified CLR names
      // NO using directive for local modules
      const moduleMap = ctx.options.moduleMap;
      const exportMap = ctx.options.exportMap;
      if (moduleMap) {
        const targetPath = resolveImportPath(module.filePath, imp.source);

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
          const targetModule = moduleMap.get(actualSourcePath);

          if (targetModule) {
            const binding = createImportBinding(
              spec,
              targetModule.namespace,
              targetModule.className,
              actualExportName,
              targetModule.hasTypeCollision,
              targetModule.exportedValueKinds,
              targetModule.localTypes,
              ctx
            );
            if (binding) {
              importBindings.set(binding.localName, binding.importBinding);
            }
          }
        }
        // If module not found in map, it's a compilation error - will be caught elsewhere
      }
      // No module map = single file compilation, no import bindings needed
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
 * - Type imports: clrName is global::namespace.TypeName
 * - Value imports: clrName is global::namespace, member is the export name
 */
const createClrImportBinding = (
  spec: IrImportSpecifier,
  namespace: string
): { localName: string; importBinding: ImportBinding } | null => {
  const localName = spec.localName;
  const namespaceFqn = `global::${namespace}`;

  if (spec.kind === "named") {
    // Use isType from frontend (determined by TS checker)
    const isType = spec.isType === true;

    if (isType) {
      // Type import: clrName is the type's FQN
      return {
        localName,
        importBinding: {
          kind: "type",
          clrName: spec.resolvedClrType
            ? `global::${spec.resolvedClrType}`
            : `${namespaceFqn}.${spec.name}`,
        },
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
 * - Type imports: clrName is the type's global:: FQN (global::namespace.TypeName)
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
              clrName: `global::${namespace}.${resolvedExportName}__Alias`,
            },
          };
        }

        if (localType.typeParameters.length > 0) {
          throw new Error(
            `ICE: Cannot import generic type alias '${resolvedExportName}' from '${namespace}'. Use a class/interface instead.`
          );
        }

        const [typeAst] = emitTypeAst(localType.type, {
          ...context,
          localTypes: targetLocalTypes,
          moduleNamespace: namespace,
          // Always fully qualify local types from the target module when erasing aliases,
          // so the resulting C# type is usable across files.
          qualifyLocalTypes: true,
        });
        const typeName = renderTypeAst(typeAst);

        return {
          localName,
          importBinding: {
            kind: "type",
            clrName: typeName,
          },
        };
      }

      // Type import: clrName is the type's FQN at namespace level.
      // (Classes/interfaces/enums are emitted at namespace scope.)
      return {
        localName,
        importBinding: {
          kind: "type",
          clrName: `global::${namespace}.${resolvedExportName}`,
        },
      };
    } else {
      const valueKind = exportedValueKinds?.get(resolvedExportName);
      const bucket = valueKind === "variable" ? "fields" : "methods";
      // Value import: clrName is the value container, member is the export name
      return {
        localName,
        importBinding: {
          kind: "value",
          clrName: valueContainerFqn,
          member: emitCSharpName(resolvedExportName, bucket, context),
        },
      };
    }
  }

  if (spec.kind === "default") {
    throw new Error(
      `Default imports are not supported for local modules (import ${localName} from ...). Use named exports or namespace imports.`
    );
  }

  if (spec.kind === "namespace") {
    // Namespace imports (import * as M) - bind to the value container class
    return {
      localName,
      importBinding: {
        kind: "namespace",
        clrName: valueContainerFqn,
      },
    };
  }

  return null;
};
