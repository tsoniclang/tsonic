import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Result } from "../../types.js";
import { defaultExec, type Exec } from "./shared.js";

export const resolveTsonicRuntimeDllDir = (
  workspaceRoot: string
): Result<string, string> => {
  const candidates = [
    join(workspaceRoot, "libs"),
    join(workspaceRoot, "node_modules", "@tsonic", "cli", "runtime"),
    resolve(join(dirname(fileURLToPath(import.meta.url)), "../../../runtime")),
    resolve(join(dirname(fileURLToPath(import.meta.url)), "../../runtime")),
    resolve(join(dirname(fileURLToPath(import.meta.url)), "../runtime")),
  ];

  for (const dir of candidates) {
    const dll = join(dir, "Tsonic.Runtime.dll");
    if (existsSync(dll)) return { ok: true, value: dir };
  }

  return {
    ok: false,
    error:
      "Tsonic.Runtime.dll not found.\n" +
      "Fix: ensure the CLI runtime is present (node_modules/@tsonic/cli/runtime) or place Tsonic.Runtime.dll in libs/.",
  };
};

export type DotnetRuntime = {
  readonly name: string;
  readonly version: string;
  readonly dir: string;
};

export const listDotnetRuntimes = (
  cwd: string,
  exec: Exec = defaultExec
): Result<readonly DotnetRuntime[], string> => {
  const result = exec("dotnet", ["--list-runtimes"], cwd, "pipe");
  if (result.status !== 0) {
    const msg = result.stderr || result.stdout || "Unknown error";
    return { ok: false, error: `dotnet --list-runtimes failed:\n${msg}` };
  }

  const lines = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const entries: DotnetRuntime[] = [];
  for (const line of lines) {
    const match = line.match(/^(\S+)\s+(\S+)\s+\[(.+)\]$/);
    if (!match) continue;
    const [, name, version, baseDir] = match;
    if (!name || !version || !baseDir) continue;
    entries.push({ name, version, dir: join(baseDir, version) });
  }

  const byName = new Map<string, DotnetRuntime>();
  const parseVer = (version: string): number[] =>
    version
      .split(".")
      .map((part) => Number.parseInt(part, 10))
      .map((n) => (Number.isFinite(n) ? n : 0));
  const cmp = (left: string, right: string): number => {
    const leftVersion = parseVer(left);
    const rightVersion = parseVer(right);
    const len = Math.max(leftVersion.length, rightVersion.length);
    for (let index = 0; index < len; index++) {
      const delta = (leftVersion[index] ?? 0) - (rightVersion[index] ?? 0);
      if (delta !== 0) return delta;
    }
    return 0;
  };

  for (const entry of entries) {
    const existing = byName.get(entry.name);
    if (!existing || cmp(existing.version, entry.version) < 0) {
      byName.set(entry.name, entry);
    }
  }

  return { ok: true, value: Array.from(byName.values()) };
};
