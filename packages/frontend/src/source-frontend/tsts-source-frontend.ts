import type {
  SourceFrontend,
  SourceTranspileOptions,
  SourceTranspileResult,
} from "./source-frontend.js";
import { formatDiagnostics, transpileModule } from "@tsonic/tsts";

export const createTstsSourceFrontend = (): SourceFrontend => ({
  engine: "tsts",
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
