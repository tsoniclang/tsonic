/**
 * Module representation types for Tsonic compiler
 */

export type ImportKind = "local" | "dotnet" | "node_module";

export type Import = {
  readonly kind: ImportKind;
  readonly specifier: string; // Original import specifier
  readonly resolvedPath?: string; // Resolved file path for local imports
  readonly namespace?: string; // .NET namespace for dotnet imports
  readonly importedNames: readonly ImportedName[];
};

export type ImportedName = {
  readonly name: string;
  readonly alias?: string;
};

export type Export =
  | {
      readonly kind: "named";
      readonly name: string;
      readonly localName: string;
    }
  | { readonly kind: "default"; readonly localName: string }
  | {
      readonly kind: "namespace";
      readonly name: string;
      readonly localName: string;
    }
  | {
      readonly kind: "reexport";
      readonly fromModule: string;
      readonly exports: readonly ImportedName[];
    };

export type ModuleInfo = {
  readonly filePath: string;
  readonly sourceText: string;
  readonly imports: readonly Import[];
  readonly exports: readonly Export[];
  readonly hasTopLevelCode: boolean;
  readonly namespace?: string; // Will be computed from directory structure
  readonly className?: string; // Will be computed from file name
};

export type ModuleGraph = {
  readonly modules: ReadonlyMap<string, ModuleInfo>;
  readonly dependencies: ReadonlyMap<string, readonly string[]>;
  readonly dependents: ReadonlyMap<string, readonly string[]>;
  readonly entryPoints: readonly string[];
};

export const createModuleInfo = (
  filePath: string,
  sourceText: string,
  imports: readonly Import[] = [],
  exports: readonly Export[] = [],
  hasTopLevelCode: boolean = false,
  namespace?: string,
  className?: string
): ModuleInfo => ({
  filePath,
  sourceText,
  imports,
  exports,
  hasTopLevelCode,
  namespace,
  className,
});

export const createModuleGraph = (
  modules: ReadonlyMap<string, ModuleInfo> = new Map(),
  dependencies: ReadonlyMap<string, readonly string[]> = new Map(),
  dependents: ReadonlyMap<string, readonly string[]> = new Map(),
  entryPoints: readonly string[] = []
): ModuleGraph => ({
  modules,
  dependencies,
  dependents,
  entryPoints,
});

export const addModule = (
  graph: ModuleGraph,
  module: ModuleInfo
): ModuleGraph => {
  const newModules = new Map(graph.modules);
  newModules.set(module.filePath, module);

  return {
    ...graph,
    modules: newModules,
  };
};

export const isLocalImport = (importSpec: string): boolean =>
  importSpec.startsWith(".") || importSpec.startsWith("/");

export const isDotNetImport = (importSpec: string): boolean =>
  !isLocalImport(importSpec) &&
  !importSpec.includes("/") &&
  /^[A-Z]/.test(importSpec);
