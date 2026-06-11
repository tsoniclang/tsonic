export type SourceFrontendEngine = "typescript" | "tsts";

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

export interface SourceFrontend {
  readonly engine: SourceFrontendEngine;
  transpileModule(
    sourceText: string,
    options?: SourceTranspileOptions
  ): Promise<SourceTranspileResult>;
}
