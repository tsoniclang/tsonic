import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const tsonicRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const configuredWorkspaceRoot = process.env.TSONICLANG_WORKSPACE_ROOT;
if (configuredWorkspaceRoot !== undefined && !isAbsolute(configuredWorkspaceRoot)) {
  throw new Error("TSONICLANG_WORKSPACE_ROOT must be an absolute path.");
}

export const testWorkspaceRoot = configuredWorkspaceRoot === undefined
  ? resolve(tsonicRoot, "..")
  : resolve(configuredWorkspaceRoot);

export const testRepositoryRoots = Object.freeze({
  tsonic: tsonicRoot,
  tsonicCsharp: resolve(testWorkspaceRoot, "tsonic-csharp"),
  csharpJs: resolve(testWorkspaceRoot, "csharp-js"),
  csharpNodejs: resolve(testWorkspaceRoot, "csharp-nodejs"),
  csharpRuntime: resolve(testWorkspaceRoot, "csharp-runtime"),
});
