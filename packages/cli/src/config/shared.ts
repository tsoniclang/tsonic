import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Result } from "../types.js";

export const WORKSPACE_CONFIG_FILE = "tsonic.workspace.json";
export const PROJECT_CONFIG_FILE = "tsonic.json";
export const MSBUILD_PROPERTY_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const findWorkspaceConfig = (startDir: string): string | null => {
  let currentDir = resolve(startDir);

  for (;;) {
    const cfg = join(currentDir, WORKSPACE_CONFIG_FILE);
    if (existsSync(cfg)) return cfg;

    const parent = dirname(currentDir);
    if (parent === currentDir) return null;
    currentDir = parent;
  }
};

export const parseJsonFile = <T>(filePath: string): Result<T, string> => {
  try {
    const raw = readFileSync(filePath, "utf-8");
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export const listProjects = (workspaceRoot: string): readonly string[] => {
  const packagesDir = join(workspaceRoot, "packages");
  if (!existsSync(packagesDir)) return [];

  const projects: string[] = [];
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const projectDir = join(packagesDir, entry.name);
    if (existsSync(join(projectDir, PROJECT_CONFIG_FILE))) {
      projects.push(projectDir);
    }
  }
  return projects;
};

export const findProjectConfig = (
  startDir: string,
  workspaceRoot: string
): string | null => {
  let currentDir = resolve(startDir);
  const workspaceAbs = resolve(workspaceRoot);

  for (;;) {
    if (!currentDir.startsWith(workspaceAbs)) return null;

    const cfg = join(currentDir, PROJECT_CONFIG_FILE);
    if (existsSync(cfg)) {
      const rel = currentDir.slice(workspaceAbs.length).replace(/^[\\/]/, "");
      if (!rel.startsWith("packages/")) return null;
      return cfg;
    }

    if (currentDir === workspaceAbs) return null;
    const parent = dirname(currentDir);
    if (parent === currentDir) return null;
    currentDir = parent;
  }
};
