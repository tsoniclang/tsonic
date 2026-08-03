import { basename, dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { rm } from "node:fs/promises";

export function resolveTsgoOutputPaths(configPath, shownConfig) {
  const configDirectory = dirname(resolve(configPath));
  const outDir = shownConfig?.compilerOptions?.outDir;
  if (typeof outDir !== "string" || outDir.length === 0) {
    throw new Error(`TS-Go project '${configPath}' must declare compilerOptions.outDir.`);
  }
  const outputDirectory = isAbsolute(outDir) ? resolve(outDir) : resolve(configDirectory, outDir);
  if (basename(outputDirectory) !== "dist") {
    throw new Error(`Refusing to clean non-canonical TS-Go output directory '${outputDirectory}'; expected a directory named 'dist'.`);
  }
  const tsBuildInfoFile = shownConfig?.compilerOptions?.tsBuildInfoFile;
  const buildInfoPath = typeof tsBuildInfoFile === "string" && tsBuildInfoFile.length > 0
    ? isAbsolute(tsBuildInfoFile)
      ? resolve(tsBuildInfoFile)
      : resolve(configDirectory, tsBuildInfoFile)
    : undefined;
  return { outputDirectory, buildInfoPath };
}

async function main() {
  const configPath = process.argv[2];
  if (configPath === undefined) {
    throw new Error("Usage: clean-tsgo-output.mjs <tsconfig-path>");
  }
  let shownConfigText = "";
  for await (const chunk of process.stdin) {
    shownConfigText += chunk;
  }
  const shownConfig = JSON.parse(shownConfigText);
  const { outputDirectory, buildInfoPath } = resolveTsgoOutputPaths(configPath, shownConfig);
  await rm(outputDirectory, { recursive: true, force: true });
  if (buildInfoPath !== undefined && !buildInfoPath.startsWith(`${outputDirectory}/`)) {
    await rm(buildInfoPath, { force: true });
  }
}

if (process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
