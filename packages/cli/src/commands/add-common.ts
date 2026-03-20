export type {
  AddCommandOptions,
  Exec,
  ExecResult,
} from "./add-common/shared.js";
export {
  defaultBindingsPackageNameForDll,
  defaultBindingsPackageNameForFramework,
  defaultBindingsPackageNameForNuget,
  defaultExec,
  normalizeNpmName,
  npmInstallDevDependency,
  resolveFromProjectRoot,
  writeTsonicJson,
} from "./add-common/shared.js";
export {
  resolvePackageRoot,
  resolveTsbindgenDllPath,
} from "./add-common/package-resolution.js";
export type { DotnetRuntime } from "./add-common/runtime.js";
export {
  listDotnetRuntimes,
  resolveTsonicRuntimeDllDir,
} from "./add-common/runtime.js";
export type { GeneratedBindingsKind } from "./add-common/generated-bindings.js";
export {
  bindingsStoreDir,
  ensureGeneratedBindingsPackageJson,
  ensurePackageJson,
  installGeneratedBindingsPackage,
} from "./add-common/generated-bindings.js";
export type { TsbindgenClosureOutput } from "./add-common/tsbindgen.js";
export {
  tsbindgenGenerate,
  tsbindgenResolveClosure,
} from "./add-common/tsbindgen.js";
