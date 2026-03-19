import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildTestTimeoutMs, linkDir, repoRoot } from "../helpers.js";

export { buildTestTimeoutMs };

export const withMaximusWorkspace = (callback: (dir: string) => void): void => {
  const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-maximus-"));
  try {
    mkdirSync(join(dir, "packages", "core", "src"), { recursive: true });
    mkdirSync(join(dir, "packages", "app", "src"), { recursive: true });
    mkdirSync(join(dir, "node_modules"), { recursive: true });
    callback(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

export const writeWorkspaceFile = (
  dir: string,
  relativePath: string,
  lines: readonly string[]
): void => {
  const targetPath = join(dir, relativePath);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, lines.join("\n"), "utf-8");
};

export const writeWorkspaceJson = (
  dir: string,
  relativePath: string,
  value: unknown
): void => {
  const targetPath = join(dir, relativePath);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(
    targetPath,
    JSON.stringify(value, null, 2) + "\n",
    "utf-8"
  );
};

export const linkWorkspaceDependencies = (dir: string): void => {
  linkDir(
    join(repoRoot, "node_modules/@tsonic/dotnet"),
    join(dir, "node_modules/@tsonic/dotnet")
  );
  linkDir(
    join(repoRoot, "node_modules/@tsonic/core"),
    join(dir, "node_modules/@tsonic/core")
  );
  linkDir(
    join(repoRoot, "node_modules/@tsonic/globals"),
    join(dir, "node_modules/@tsonic/globals")
  );
  linkDir(
    join(dir, "packages", "core"),
    join(dir, "node_modules/@acme/core")
  );
};

export const runCliBuild = (
  dir: string,
  wsConfigPath: string,
  project: "core" | "app"
): void => {
  const cliPath = join(repoRoot, "packages/cli/dist/index.js");
  const result = spawnSync(
    "node",
    [cliPath, "build", "--project", project, "--config", wsConfigPath, "--quiet"],
    { cwd: dir, encoding: "utf-8" }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `build failed for ${project}`);
  }
};

export const collectDtsText = (root: string): string =>
  collectDts(root)
    .map((path) => readFileSync(path, "utf-8"))
    .join("\n");

const collectDts = (root: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectDts(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".d.ts")) {
      out.push(entryPath);
    }
  }
  return out;
};

export const readRootBindings = (
  bindingsDir: string
): {
  readonly path: string;
  readonly content: {
    producer?: { tool?: unknown; mode?: unknown };
    exports?: Record<string, unknown>;
  };
} => {
  const rootBindingsPath = join(bindingsDir, "Acme.Core", "bindings.json");
  if (!existsSync(rootBindingsPath)) {
    throw new Error(`Missing bindings file at ${rootBindingsPath}`);
  }
  return {
    path: rootBindingsPath,
    content: JSON.parse(readFileSync(rootBindingsPath, "utf-8")) as {
      producer?: { tool?: unknown; mode?: unknown };
      exports?: Record<string, unknown>;
    },
  };
};
