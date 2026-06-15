export type SourceFrontendEngine = "tsts";

export type SourceProgramBuildOptions = {
  readonly projectRoot: string;
  readonly moduleResolutionPaths: Readonly<Record<string, readonly string[]>>;
  readonly sourceDiagnosticFileNames: readonly string[];
};

export interface SourceFrontend<TSourceProgram> {
  readonly engine: SourceFrontendEngine;
  createProgram(
    filePaths: readonly string[],
    options: SourceProgramBuildOptions
  ): TSourceProgram;
}
