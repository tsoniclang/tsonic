import { mkdirSync, readFileSync, symlinkSync } from "node:fs";
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

export type GeneratedFirstPartyBindingsJson = {
  readonly namespace?: unknown;
  readonly producer?: { readonly tool?: unknown; readonly mode?: unknown };
  readonly semanticSurface?: {
    readonly types?: readonly Record<string, unknown>[];
    readonly exports?: Readonly<Record<string, unknown>>;
  };
  readonly dotnet?: {
    readonly types?: readonly Record<string, unknown>[];
    readonly exports?: Readonly<Record<string, unknown>>;
  };
};

export const readFirstPartyBindingsJson = (
  bindingsPath: string
): GeneratedFirstPartyBindingsJson =>
  JSON.parse(
    readFileSync(bindingsPath, "utf-8")
  ) as GeneratedFirstPartyBindingsJson;
