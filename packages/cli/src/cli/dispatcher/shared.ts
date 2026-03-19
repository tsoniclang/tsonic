import type { CliOptions, Result } from "../../types.js";

export type ParsedCliArgs = {
  readonly command: string;
  readonly positionals: string[];
  readonly options: CliOptions;
  readonly programArgs?: string[];
};

export type DispatcherError = {
  readonly code: number;
  readonly error: string;
};

export const mergeUniqueFrameworkReferences = (
  left: readonly (string | { readonly id: string })[],
  right: readonly (string | { readonly id: string })[]
): readonly (string | { readonly id: string })[] => {
  const out: Array<string | { readonly id: string }> = [];
  const seen = new Set<string>();
  const push = (ref: string | { readonly id: string }): void => {
    const id = (typeof ref === "string" ? ref : ref.id).toLowerCase();
    if (seen.has(id)) return;
    seen.add(id);
    out.push(ref);
  };
  for (const ref of left) push(ref);
  for (const ref of right) push(ref);
  return out;
};

export const mergeUniquePackageReferences = (
  left: readonly { readonly id: string; readonly version: string }[],
  right: readonly { readonly id: string; readonly version: string }[]
): Result<
  readonly { readonly id: string; readonly version: string }[],
  string
> => {
  const byId = new Map<
    string,
    { readonly id: string; readonly version: string }
  >();
  const add = (pkg: {
    readonly id: string;
    readonly version: string;
  }): Result<void, string> => {
    const key = pkg.id.toLowerCase();
    const existing = byId.get(key);
    if (existing && existing.version !== pkg.version) {
      return {
        ok: false,
        error:
          `Conflicting PackageReference versions for '${pkg.id}': '${existing.version}' vs '${pkg.version}'.\n` +
          `Use a single version at the workspace level.`,
      };
    }
    byId.set(key, pkg);
    return { ok: true, value: undefined };
  };

  for (const pkg of left) {
    const result = add(pkg);
    if (!result.ok) return result;
  }
  for (const pkg of right) {
    const result = add(pkg);
    if (!result.ok) return result;
  }

  const merged = Array.from(byId.values()).sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  return { ok: true, value: merged };
};
