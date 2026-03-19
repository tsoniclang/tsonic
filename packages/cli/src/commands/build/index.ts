import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { ResolvedConfig, Result } from "../../types.js";
import { generateCommand } from "../generate.js";
import { buildExecutable } from "./executable-build.js";
import { buildLibrary } from "./library-build.js";

export const buildCommand = (
  config: ResolvedConfig
): Result<{ outputPath: string }, string> => {
  const outputType = config.outputConfig.type ?? "executable";

  const generatedDir = (() => {
    if (!config.noGenerate) {
      const generateResult = generateCommand(config);
      if (!generateResult.ok) return generateResult;
      return { ok: true as const, value: generateResult.value.outputDir };
    }

    const outputDir = resolve(config.projectRoot, config.outputDirectory);
    const outputRel = relative(config.projectRoot, outputDir);
    if (!outputRel || outputRel.startsWith("..") || isAbsolute(outputRel)) {
      return {
        ok: false as const,
        error: `Refusing to use output outside project root. outputDirectory='${config.outputDirectory}' resolved to '${outputDir}'.`,
      };
    }
    if (!existsSync(outputDir)) {
      return {
        ok: false as const,
        error:
          `Generated output directory not found: ${outputDir}\n` +
          `Run \`tsonic generate\` first (or omit --no-generate).`,
      };
    }
    return { ok: true as const, value: outputDir };
  })();
  if (!generatedDir.ok) return generatedDir;

  const csprojPath = join(generatedDir.value, "tsonic.csproj");
  if (!existsSync(csprojPath)) {
    return {
      ok: false,
      error:
        `No tsonic.csproj found in ${generatedDir.value}/.\n` +
        `Run \`tsonic generate\` first (or omit --no-generate).`,
    };
  }

  return outputType === "library"
    ? buildLibrary(config, generatedDir.value)
    : buildExecutable(config, generatedDir.value);
};
