import type {
  SourceFrontend,
  SourceTranspileOptions,
  SourceTranspileResult,
} from "./source-frontend.js";

type TstsTranspileOutput = {
  readonly outputText: string;
  readonly sourceMapText?: string;
  readonly diagnostics: readonly unknown[];
};

type TstsModule = {
  readonly formatDiagnostics: (diagnostics: readonly unknown[]) => string;
  readonly transpileModule: (
    sourceText: string,
    options: {
      readonly fileName?: string;
      readonly compilerOptions?: SourceTranspileOptions["compilerOptions"];
      readonly reportDiagnostics?: boolean;
    }
  ) => TstsTranspileOutput;
};

const loadTstsModule = async (): Promise<TstsModule> => {
  try {
    return (await import("@tsonic/tsts")) as TstsModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `The TSTS source frontend requires the optional @tsonic/tsts package. ${message}`
    );
  }
};

export const createTstsSourceFrontend = (): SourceFrontend => ({
  engine: "tsts",
  transpileModule: async (
    sourceText: string,
    options: SourceTranspileOptions = {}
  ): Promise<SourceTranspileResult> => {
    const { formatDiagnostics, transpileModule } = await loadTstsModule();
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
