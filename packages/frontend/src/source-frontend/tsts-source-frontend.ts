import type {
  SourceFrontend,
  SourceProgramBuildOptions,
} from "./source-frontend.js";
import type { TstsSourceProgram } from "./tsts-source-program.js";
import { createTstsSourceProgram } from "./tsts-source-program.js";

export type TstsSourceFrontend = SourceFrontend<TstsSourceProgram>;

export const createTstsSourceFrontend = (): TstsSourceFrontend => ({
  engine: "tsts",
  createProgram: (
    filePaths: readonly string[],
    options: SourceProgramBuildOptions
  ): TstsSourceProgram =>
    createTstsSourceProgram(filePaths, {
      projectRoot: options.projectRoot,
      moduleResolutionPaths: options.moduleResolutionPaths,
      sourceDiagnosticRoots: options.sourceDiagnosticRoots,
    }),
});
