/**
 * EmitterContract — the interface that any Tsonic backend must implement.
 *
 * Plan-black: type-only forward declaration. No code imports this.
 * Plan-beta: the C# emitter implements this, new backends implement it too.
 */

import type { IrModule } from "@tsonic/frontend";

/**
 * Configuration provided to the backend by the compilation pipeline.
 */
export type EmitterConfig = {
  readonly projectRoot: string;
  readonly outputDir: string;
  readonly moduleMap: ReadonlyMap<string, string>;
  readonly typeRoots: readonly string[];
};

/**
 * Result of emitting a single module.
 */
export type EmitResult = {
  readonly fileName: string;
  readonly content: string;
  readonly diagnostics: readonly EmitDiagnostic[];
};

/**
 * Diagnostic from the emission phase.
 */
export type EmitDiagnostic = {
  readonly code: string;
  readonly message: string;
  readonly filePath?: string;
  readonly line?: number;
};

/**
 * The contract that every backend must satisfy.
 *
 * The compilation pipeline calls emitModule() for each IrModule,
 * then assembleOutput() to produce the final file content.
 */
export type EmitterContract = {
  /**
   * Emit a single module to the target language.
   */
  readonly emitModule: (module: IrModule, config: EmitterConfig) => EmitResult;

  /**
   * Return the file extension for the target language (e.g., ".cs", ".py").
   */
  readonly fileExtension: string;

  /**
   * Human-readable backend name (e.g., "csharp", "python").
   */
  readonly backendName: string;
};
