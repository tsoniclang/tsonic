import { mkdirSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../..")
);

export const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

export const buildTestTimeoutMs = 10 * 60 * 1000;
