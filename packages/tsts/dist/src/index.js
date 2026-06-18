export { CommandLine } from "./internal/execute/tsc.js";
export { NewCachedFSCompilerHost, NewCompilerHost, } from "./internal/compiler/host.js";
export { NewProgram } from "./internal/compiler/program.js";
export { ParseBuildCommandLine, ParseCommandLine, } from "./internal/tsoptions/commandlineparser.js";
export { barebonesLibContent, formatDiagnostics, transpile, transpileDeclaration, transpileModule, } from "./services/transpile.js";
export { createCompilerSourceProgram } from "./services/source-program.js";
export { collectTstsModuleClosure } from "./services/module-closure.js";
export { discoverTstsDeclarationGlobalImports, discoverTstsDeclarationModuleAliases, } from "./services/declaration-module-aliases.js";
export * from "./extensions/index.js";
//# sourceMappingURL=index.js.map