import type {
  TsonicProjectConfig,
  TsonicWorkspaceConfig,
} from "../types.js";

export const WORKSPACE_ROOT = "/workspace";
export const PROJECT_ROOT = "/workspace/packages/myapp";

export const hasSurfaceRoot = (
  roots: readonly string[],
  surfacePackage: string
): boolean =>
  roots.includes(`node_modules/${surfacePackage}`) ||
  roots.some((root) =>
    new RegExp(
      `[/\\\\]${surfacePackage.split("/").at(-1)}[/\\\\]versions[/\\\\]\\d+$`
    ).test(root)
  );

export const makeWorkspaceConfig = (
  overrides: Partial<TsonicWorkspaceConfig> = {}
): TsonicWorkspaceConfig => ({
  dotnetVersion: "net10.0",
  ...overrides,
});

export const makeProjectConfig = (
  overrides: Partial<TsonicProjectConfig> = {}
): TsonicProjectConfig => ({
  rootNamespace: "MyApp",
  ...overrides,
});
