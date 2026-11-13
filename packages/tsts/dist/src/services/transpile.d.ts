import type { Diagnostic } from "../internal/ast/diagnostic.js";
export interface TranspileOptions {
    compilerOptions?: TranspileCompilerOptions;
    fileName?: string;
    reportDiagnostics?: boolean;
    moduleName?: string;
    renamedDependencies?: Record<string, string>;
}
export interface TranspileOutput {
    outputText: string;
    diagnostics: Diagnostic[];
    sourceMapText?: string;
}
export type TranspileCompilerOptions = Record<string, TranspileCompilerOptionValue>;
export type TranspileCompilerOptionValue = string | number | boolean | readonly string[] | readonly number[] | undefined;
export declare const barebonesLibContent = "interface Boolean {}\ninterface Function {}\ninterface CallableFunction {}\ninterface NewableFunction {}\ninterface IArguments {}\ninterface Number {}\ninterface Object {}\ninterface RegExp {}\ninterface String {}\ninterface Array<T> { length: number; [n: number]: T; }\ninterface SymbolConstructor {\n    (desc?: string | number): symbol;\n    for(name: string): symbol;\n    readonly toStringTag: symbol;\n}\ndeclare var Symbol: SymbolConstructor;\ninterface Symbol {\n    readonly [Symbol.toStringTag]: string;\n}";
export declare function transpileModule(input: string, options?: TranspileOptions): TranspileOutput;
export declare function transpileDeclaration(input: string, options?: TranspileOptions): TranspileOutput;
export declare function transpile(input: string, compilerOptions?: TranspileCompilerOptions, fileName?: string, diagnostics?: Diagnostic[], moduleName?: string): string;
export declare function formatDiagnostics(diagnostics: readonly Diagnostic[], currentDirectory?: string): string;
/**
 * The message text of one diagnostic, as the SDK's own diagnostic writer renders it: the diagnostic's message with its
 * arguments substituted, then each message of its chain on a line of its own, indented two spaces per level of
 * nesting. No file name, position, category or code, so the diagnostic need not have a file. Related information is
 * separate diagnostics and is not part of the text.
 */
export declare function flattenDiagnosticMessageText(diagnostic: Diagnostic, newLine?: string): string;
//# sourceMappingURL=transpile.d.ts.map