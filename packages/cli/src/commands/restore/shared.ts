import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Result } from "../../types.js";
import {
  defaultExec,
  type AddCommandOptions,
  type Exec,
} from "../add-common.js";

export type RestoreOptions = AddCommandOptions;

export type PackageReference = { readonly id: string; readonly version: string };

export type ProjectAssets = {
  readonly targets?: Record<string, unknown>;
  readonly libraries?: Record<
    string,
    { readonly type?: string; readonly path?: string }
  >;
  readonly packageFolders?: Record<string, unknown>;
};

export type PackageTarget = {
  readonly libKey: string;
  readonly packageId: string;
  readonly version: string;
  readonly dlls: readonly string[];
  readonly dependencies: readonly string[];
};

export const normalizePkgId = (id: string): string => id.trim().toLowerCase();

export const pickPackageFolder = (
  assets: ProjectAssets
): string | undefined => {
  const folders = assets.packageFolders
    ? Object.keys(assets.packageFolders)
    : [];
  if (folders.length === 0) return undefined;
  return folders[0];
};

export const findTargetKey = (
  assets: ProjectAssets,
  tfm: string
): string | undefined => {
  const targets = assets.targets ? Object.keys(assets.targets) : [];
  if (targets.includes(tfm)) return tfm;
  return targets.find((key) => key.startsWith(`${tfm}/`));
};

export const parseLibKey = (
  libKey: string
): { readonly id: string; readonly version: string } | undefined => {
  const idx = libKey.indexOf("/");
  if (idx <= 0) return undefined;
  const id = libKey.slice(0, idx);
  const version = libKey.slice(idx + 1);
  if (!id || !version) return undefined;
  return { id, version };
};

export const collectPackageTargets = (
  assets: ProjectAssets,
  targetKey: string,
  packageFolder: string
): ReadonlyMap<string, PackageTarget> => {
  const targets = assets.targets?.[targetKey];
  const libraries = assets.libraries ?? {};
  const byLibrary = new Map<string, PackageTarget>();

  if (!targets || typeof targets !== "object") return byLibrary;

  for (const [libKey, libValue] of Object.entries(
    targets as Record<string, unknown>
  )) {
    if (!libKey || !libValue || typeof libValue !== "object") continue;
    const parsed = parseLibKey(libKey);
    if (!parsed) continue;

    const libInfo = libraries[libKey];
    if (!libInfo || libInfo.type !== "package" || !libInfo.path) continue;

    const depsObj = (libValue as Record<string, unknown>).dependencies;
    const dependencies =
      depsObj && typeof depsObj === "object"
        ? Object.keys(depsObj as Record<string, unknown>).filter(Boolean)
        : [];

    const compile = (libValue as Record<string, unknown>).compile;
    const dlls =
      compile && typeof compile === "object"
        ? Object.keys(compile as Record<string, unknown>)
            .filter((pathLike) => pathLike.toLowerCase().endsWith(".dll"))
            .map((pathLike) => join(packageFolder, libInfo.path as string, pathLike))
        : [];

    byLibrary.set(libKey, {
      libKey,
      packageId: parsed.id,
      version: parsed.version,
      dlls,
      dependencies,
    });
  }

  return byLibrary;
};

export const writeRestoreProject = (
  restoreDir: string,
  targetFramework: string,
  packageReferences: readonly PackageReference[]
): Result<string, string> => {
  try {
    mkdirSync(restoreDir, { recursive: true });
    const csprojPath = join(restoreDir, "tsonic.nuget.restore.csproj");
    const itemGroup = packageReferences
      .map(
        (pkg) =>
          `    <PackageReference Include="${pkg.id}" Version="${pkg.version}" />`
      )
      .join("\n");

    const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>${targetFramework}</TargetFramework>
    <ImplicitUsings>false</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
${itemGroup}
  </ItemGroup>
</Project>
`;
    writeFileSync(csprojPath, csproj, "utf-8");
    return { ok: true, value: csprojPath };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to write restore project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export const dotnetRestore = (
  restoreProjectPath: string,
  nugetConfigFile: string,
  options: RestoreOptions,
  exec: Exec = defaultExec
): Result<string, string> => {
  const restoreDir = dirname(restoreProjectPath);
  const result = exec(
    "dotnet",
    ["restore", restoreProjectPath, "--configfile", nugetConfigFile],
    restoreDir,
    options.verbose ? "inherit" : "pipe"
  );
  if (result.status !== 0) {
    const msg = result.stderr || result.stdout || "Unknown error";
    return { ok: false, error: `dotnet restore failed:\n${msg}` };
  }

  const assetsPath = join(restoreDir, "obj", "project.assets.json");
  if (!existsSync(assetsPath)) {
    return {
      ok: false,
      error: `Restore succeeded but assets file missing: ${assetsPath}`,
    };
  }
  return { ok: true, value: assetsPath };
};

export const addUniqueFrameworkReference = (
  arr: Array<string | { readonly id: string; readonly types?: string | false }>,
  value: string
): void => {
  if (
    !arr.some(
      (ref) =>
        (typeof ref === "string" ? ref : ref.id).toLowerCase() ===
        value.toLowerCase()
    )
  ) {
    arr.push(value);
  }
};

export const pathIsWithin = (pathLike: string, dir: string): boolean => {
  const normalizedDir = dir.endsWith("/") ? dir : `${dir}/`;
  const normalizedPath = pathLike.replace(/\\/g, "/");
  const normalizedBase = normalizedDir.replace(/\\/g, "/");
  return normalizedPath.startsWith(normalizedBase);
};

export const normalizeLibraryKey = (pathLike: string): string =>
  pathLike.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();

export const parseProjectAssets = (
  assetsPath: string
): Result<ProjectAssets, string> => {
  try {
    return {
      ok: true,
      value: JSON.parse(readFileSync(assetsPath, "utf-8")) as ProjectAssets,
    };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse project.assets.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
