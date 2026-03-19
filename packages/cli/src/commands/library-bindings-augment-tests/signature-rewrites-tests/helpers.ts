import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResolvedConfig } from "../../../types.js";

export const withBindingsWorkspace = (
  prefix: string,
  callback: (opts: {
    readonly dir: string;
    readonly srcDir: string;
    readonly bindingsOutDir: string;
  }) => void
): void => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  try {
    const srcDir = join(dir, "src");
    const bindingsOutDir = join(dir, "dist", "tsonic", "bindings");
    mkdirSync(srcDir, { recursive: true });
    callback({ dir, srcDir, bindingsOutDir });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

export const writeInternalFacade = (opts: {
  readonly bindingsOutDir: string;
  readonly internalLines: readonly string[];
  readonly facadeLines: readonly string[];
  readonly internalSubdir?: string;
}): { readonly internalIndex: string; readonly facadePath: string } => {
  const internalDir = join(
    opts.bindingsOutDir,
    opts.internalSubdir ?? "TestApp",
    "internal"
  );
  mkdirSync(internalDir, { recursive: true });
  const internalIndex = join(internalDir, "index.d.ts");
  writeFileSync(
    internalIndex,
    opts.internalLines.join("\n") + "\n",
    "utf-8"
  );

  const facadePath = join(opts.bindingsOutDir, "TestApp.d.ts");
  writeFileSync(facadePath, opts.facadeLines.join("\n") + "\n", "utf-8");
  return { internalIndex, facadePath };
};

export const createResolvedConfig = (
  dir: string,
  opts?: {
    readonly typeRoots?: readonly string[];
  }
): ResolvedConfig =>
  ({
    workspaceRoot: dir,
    projectRoot: dir,
    sourceRoot: "src",
    rootNamespace: "TestApp",
    entryPoint: "src/index.ts",
    typeRoots: [...(opts?.typeRoots ?? [])],
    libraries: [],
  }) as unknown as ResolvedConfig;
