import { basename } from "node:path";

const BUILT_IN_RUNTIME_DLLS = new Set(
  ["Tsonic.Runtime.dll", "Tsonic.JSRuntime.dll", "nodejs.dll"].map((n) =>
    n.toLowerCase()
  )
);

export const isBuiltInRuntimeDllName = (dllFileName: string): boolean =>
  BUILT_IN_RUNTIME_DLLS.has(dllFileName.toLowerCase());

export const isBuiltInRuntimeDllPath = (pathLike: string): boolean =>
  isBuiltInRuntimeDllName(basename(pathLike));

