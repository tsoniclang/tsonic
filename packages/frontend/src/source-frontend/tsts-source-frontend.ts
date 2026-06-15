import type {
  SourceFrontend,
  SourceProgramBuildOptions,
  SourceTranspiler,
  SourceTranspileOptions,
  SourceTranspileResult,
} from "./source-frontend.js";
import { formatDiagnostics, transpileModule } from "@tsonic/tsts";
import type { TstsSourceProgram } from "./tsts-source-program.js";
import { createTstsSourceProgram } from "./tsts-source-program.js";

export type TstsSourceFrontend = SourceFrontend<TstsSourceProgram> &
  SourceTranspiler;

export const createTstsSourceFrontend = (): TstsSourceFrontend => ({
  engine: "tsts",
  createProgram: (
    filePaths: readonly string[],
    options: SourceProgramBuildOptions
  ): TstsSourceProgram =>
    createTstsSourceProgram(filePaths, {
      extensions: options.extensions,
      projectRoot: options.projectRoot,
      runSemanticChecks: options.runSemanticChecks,
      sourceDiagnosticFileNames: options.sourceDiagnosticFileNames,
    }),
  transpileModule: async (
    sourceText: string,
    options: SourceTranspileOptions = {}
  ): Promise<SourceTranspileResult> => {
    const output = transpileModule(sourceText, {
      fileName: options.fileName,
      compilerOptions: options.compilerOptions,
      reportDiagnostics: true,
    });
    const diagnosticsText = formatDiagnostics(output.diagnostics);
    return {
      engine: "tsts",
      emitText: output.outputText,
      sourceMapText: output.sourceMapText,
      diagnosticsText,
      diagnosticCount: output.diagnostics.length,
    };
  },
});
