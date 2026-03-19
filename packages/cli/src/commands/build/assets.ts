import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Result } from "../../types.js";

type ProjectAssets = {
  readonly targets?: Record<string, unknown>;
  readonly libraries?: Record<
    string,
    { readonly type?: string; readonly path?: string }
  >;
  readonly packageFolders?: Record<string, unknown>;
};

type AssemblyNameConflict = {
  readonly assemblyName: string;
  readonly library: string;
  readonly assetPath: string;
};

const readProjectAssets = (
  assetsPath: string
): Result<ProjectAssets, string> => {
  if (!existsSync(assetsPath)) {
    return { ok: false, error: `Restore assets not found at ${assetsPath}` };
  }

  try {
    const parsed = JSON.parse(readFileSync(assetsPath, "utf-8")) as ProjectAssets;
    return { ok: true, value: parsed };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse ${assetsPath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const findAssemblyNameConflicts = (
  assets: ProjectAssets,
  outputName: string
): readonly AssemblyNameConflict[] => {
  const targets = assets.targets ?? {};
  const wanted = `${outputName}.dll`.toLowerCase();
  const librariesById = assets.libraries ?? {};
  const conflicts: AssemblyNameConflict[] = [];

  for (const [targetKey, targetValue] of Object.entries(targets)) {
    if (!targetKey || !targetValue || typeof targetValue !== "object") continue;

    for (const [libKey, libValue] of Object.entries(
      targetValue as Record<string, unknown>
    )) {
      if (!libKey || !libValue || typeof libValue !== "object") continue;
      if (librariesById[libKey]?.type === "project") continue;

      for (const sectionName of ["compile", "runtime"] as const) {
        const section = (libValue as Record<string, unknown>)[sectionName];
        if (!section || typeof section !== "object") continue;

        for (const assetPath of Object.keys(section as Record<string, unknown>)) {
          const normalized = assetPath.replace(/\\/g, "/");
          const parts = normalized.split("/");
          const file = parts.length > 0 ? parts[parts.length - 1] : undefined;
          if (!file || !file.toLowerCase().endsWith(".dll")) continue;
          if (file.toLowerCase() !== wanted) continue;
          conflicts.push({ assemblyName: outputName, library: libKey, assetPath });
        }
      }
    }
  }

  const seen = new Set<string>();
  const unique: AssemblyNameConflict[] = [];
  for (const conflict of conflicts) {
    const key = `${conflict.library}::${conflict.assetPath}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(conflict);
  }

  unique.sort(
    (left, right) =>
      left.library.localeCompare(right.library) ||
      left.assetPath.localeCompare(right.assetPath)
  );
  return unique;
};

export const assertNoOutputAssemblyNameConflicts = (
  generatedDir: string,
  outputName: string,
  libraries: readonly string[]
): Result<void, string> => {
  const wantedDll = `${outputName}.dll`.toLowerCase();
  const libraryConflicts = libraries
    .map((pathLike) => pathLike.replace(/\\/g, "/"))
    .filter((pathLike) => {
      const parts = pathLike.split("/");
      const file = parts.length > 0 ? parts[parts.length - 1] : undefined;
      return file?.toLowerCase() === wantedDll;
    })
    .sort((left, right) => left.localeCompare(right));

  const assetsPath = join(generatedDir, "obj", "project.assets.json");
  const assetsResult = readProjectAssets(assetsPath);
  if (!assetsResult.ok) return assetsResult;

  const nugetConflicts = findAssemblyNameConflicts(assetsResult.value, outputName);
  if (libraryConflicts.length === 0 && nugetConflicts.length === 0) {
    return { ok: true, value: undefined };
  }

  const lines: string[] = [];
  lines.push(
    `outputName '${outputName}' conflicts with a referenced assembly named '${outputName}.dll'.`
  );
  lines.push("");
  lines.push("Conflicting references:");
  for (const lib of libraryConflicts) lines.push(`  - ${lib}`);
  for (const conflict of nugetConflicts) {
    lines.push(`  - ${conflict.library} (${conflict.assetPath})`);
  }
  lines.push("");
  const suggested = outputName.endsWith(".App") ? undefined : `${outputName}.App`;
  lines.push(
    suggested
      ? `Fix: rename \`outputName\` in your project's tsonic.json (suggested: '${suggested}') and rebuild.`
      : "Fix: rename `outputName` in your project's tsonic.json to a unique name and rebuild."
  );

  return { ok: false, error: lines.join("\n") };
};
