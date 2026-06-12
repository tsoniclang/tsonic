import type { CompilerExtension } from "@tsonic/tsts";

export type SourceFrontendEngine = "tsts";

export type SourceProgramBuildOptions = {
  readonly extensions?: readonly CompilerExtension[];
  readonly projectRoot?: string;
  readonly runSemanticChecks?: boolean;
};

export type SourceTranspileOptions = {
  readonly fileName?: string;
  readonly compilerOptions?: Record<
    string,
    | string
    | number
    | boolean
    | readonly string[]
    | readonly number[]
    | undefined
  >;
};

export type SourceTranspileResult = {
  readonly engine: SourceFrontendEngine;
  readonly emitText: string;
  readonly sourceMapText?: string;
  readonly diagnosticsText: string;
  readonly diagnosticCount: number;
};

export interface SourceFrontend<TSourceProgram> {
  readonly engine: SourceFrontendEngine;
  createProgram(
    filePaths: readonly string[],
    options?: SourceProgramBuildOptions
  ): TSourceProgram;
}

export interface SourceTranspiler {
  readonly engine: SourceFrontendEngine;
  transpileModule(
    sourceText: string,
    options?: SourceTranspileOptions
  ): Promise<SourceTranspileResult>;
}
