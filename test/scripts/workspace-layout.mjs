import { isAbsolute, resolve, sep } from "node:path";
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
  tsonicRust: resolve(testWorkspaceRoot, "tsonic-rust"),
  csharpJs: resolve(testWorkspaceRoot, "csharp-js"),
  csharpNodejs: resolve(testWorkspaceRoot, "csharp-nodejs"),
  csharpRuntime: resolve(testWorkspaceRoot, "csharp-runtime"),
});

export const testScopeRepositoryKeys = Object.freeze({
  tsonic: "tsonic", "tsonic-csharp": "tsonicCsharp", "tsonic-rust": "tsonicRust",
  "csharp-js": "csharpJs", "csharp-nodejs": "csharpNodejs", "csharp-runtime": "csharpRuntime",
});

export function testPath(path) {
  return path.split(sep).join("/");
}

export function testTaskName(value) {
  return value.replaceAll(/[^A-Za-z0-9._-]+/gu, "-");
}
