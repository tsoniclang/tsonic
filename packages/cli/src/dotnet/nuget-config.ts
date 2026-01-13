import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Result } from "../types.js";

const DEFAULT_NUGET_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
</configuration>
`;

const findProjectNugetConfig = (projectRoot: string): string | null => {
  const candidates = [
    "nuget.config",
    "NuGet.Config",
    "NuGet.config",
    "Nuget.Config",
    "Nuget.config",
  ];

  for (const name of candidates) {
    const path = join(projectRoot, name);
    if (existsSync(path)) return path;
  }

  return null;
};

/**
 * Resolve the NuGet configuration file for restore/publish/build.
 *
 * Why this exists:
 * - NuGet searches parent directories for nuget.config files.
 * - If the project lives under a repo with a machine-specific local feed
 *   (e.g. "/home/jeswin/..."), restore can fail on fresh machines (NU1301).
 *
 * Policy:
 * - If the project provides its own nuget.config, use it (standard .NET behavior).
 * - Otherwise, generate a deterministic default config under `.tsonic/nuget/`
 *   that uses only nuget.org.
 */
export const resolveNugetConfigFile = (
  projectRoot: string
): Result<string, string> => {
  const projectConfig = findProjectNugetConfig(projectRoot);
  if (projectConfig) return { ok: true, value: resolve(projectConfig) };

  const dir = join(projectRoot, ".tsonic", "nuget");
  const configPath = join(dir, "tsonic.nuget.config");

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(configPath, DEFAULT_NUGET_CONFIG, "utf-8");
    return { ok: true, value: resolve(configPath) };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to write default NuGet config: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

