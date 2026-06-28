import { Background } from "../go/context.js";
import { NewProgram, Program_BindSourceFiles, Program_GetBindDiagnostics, Program_GetConfigFileParsingDiagnostics, Program_GetDeclarationDiagnostics, Program_GetGlobalDiagnostics, Program_GetProgramDiagnostics, Program_GetSemanticDiagnostics, Program_GetSourceFile, Program_GetSourceFiles, Program_GetSuggestionDiagnostics, Program_GetSyntacticDiagnostics, Program_getSourceFilesToEmit, } from "../internal/compiler/program.js";
import { GetParsedCommandLineOfConfigFile } from "../internal/tsoptions/tsconfigparsing.js";
import { attachExtensionHost, finalizeExtensionSemantics, getExtensionHost } from "../extensions/index.js";
import { createCompilerHost, createInMemoryFileSystem } from "./embedding-host.js";
import { createTypeCheckerQueries } from "./type-checker.js";
import { createTypeShapeQueries } from "./type-shape.js";
import { createAstReader } from "./ast-reader.js";
export function createCompilerSession(options) {
    if (options.extensionHostOptions !== undefined) {
        attachExtensionHost(options.programOptions, options.extensionHostOptions);
    }
    const program = NewProgram(options.programOptions);
    const extensionHost = getExtensionHost(program);
    const context = options.context ?? Background();
    return createCompilerSessionFromProgram(program, options.programOptions.Host, options.programOptions.Config, extensionHost, context);
}
export function createCompilerSessionFromProgram(program, host, config, extensionHost = getExtensionHost(program), context = Background()) {
    const ast = createAstReader();
    const checker = createTypeCheckerQueries(program, { context });
    const types = createTypeShapeQueries(program, { context });
    return {
        program,
        host,
        config,
        extensionHost,
        ast,
        checker,
        types,
        getSourceFiles: () => Program_GetSourceFiles(program) ?? [],
        getSourceFile: (fileName) => Program_GetSourceFile(program, fileName),
        getSourceFilesToEmit: (targetSourceFile, forceDtsEmit = false) => Program_getSourceFilesToEmit(program, targetSourceFile, forceDtsEmit) ?? [],
        ensureBound: () => Program_BindSourceFiles(program),
        ensureChecked: (sourceFile) => Program_GetSemanticDiagnostics(program, context, sourceFile),
        getDiagnostics: (kind = "all", sourceFile) => getDiagnostics(program, context, kind, sourceFile),
        finalizeExtensions: () => finalizeExtensionSemantics(program),
        isFinalized: () => getExtensionHost(program)?.finalized === true,
    };
}
export function createCompilerSessionFromFiles(options) {
    const configFileName = options.configFileName ?? `${options.currentDirectory}/tsconfig.json`;
    const files = options.files instanceof Map ? new Map(options.files) : new Map(Object.entries(options.files));
    if (!files.has(configFileName)) {
        files.set(configFileName, JSON.stringify({
            compilerOptions: options.compilerOptions ?? {},
            files: options.rootFiles ?? inferRootFiles(options.currentDirectory, files),
        }));
    }
    const fileSystem = createInMemoryFileSystem({
        files,
        ...(options.useCaseSensitiveFileNames !== undefined ? { useCaseSensitiveFileNames: options.useCaseSensitiveFileNames } : {}),
    });
    const host = createCompilerHost({
        currentDirectory: options.currentDirectory,
        fileSystem,
    });
    const defaultOptions = {};
    const [config, configErrors] = GetParsedCommandLineOfConfigFile(configFileName, defaultOptions, undefined, host, undefined);
    if ((configErrors ?? []).length !== 0) {
        const programOptions = { Config: config, Host: host };
        return createCompilerSession({
            programOptions,
            ...(options.extensionHostOptions !== undefined ? { extensionHostOptions: options.extensionHostOptions } : {}),
            ...(options.context !== undefined ? { context: options.context } : {}),
        });
    }
    return createCompilerSession({
        programOptions: {
            Config: config,
            Host: host,
        },
        ...(options.extensionHostOptions !== undefined ? { extensionHostOptions: options.extensionHostOptions } : {}),
        ...(options.context !== undefined ? { context: options.context } : {}),
    });
}
function getDiagnostics(program, context, kind, sourceFile) {
    switch (kind) {
        case "config":
            return Program_GetConfigFileParsingDiagnostics(program);
        case "program":
            return Program_GetProgramDiagnostics(program);
        case "global":
            return Program_GetGlobalDiagnostics(program, context);
        case "syntactic":
            return Program_GetSyntacticDiagnostics(program, context, sourceFile);
        case "bind":
            return Program_GetBindDiagnostics(program, context, sourceFile);
        case "semantic":
            return Program_GetSemanticDiagnostics(program, context, sourceFile);
        case "suggestion":
            return Program_GetSuggestionDiagnostics(program, context, sourceFile);
        case "declaration":
            return Program_GetDeclarationDiagnostics(program, context, sourceFile);
        case "all":
            return [
                ...Program_GetConfigFileParsingDiagnostics(program),
                ...Program_GetProgramDiagnostics(program),
                ...Program_GetGlobalDiagnostics(program, context),
                ...Program_GetSyntacticDiagnostics(program, context, sourceFile),
                ...Program_GetBindDiagnostics(program, context, sourceFile),
                ...Program_GetSemanticDiagnostics(program, context, sourceFile),
            ];
    }
}
function inferRootFiles(currentDirectory, files) {
    const rootFiles = [];
    const prefix = currentDirectory.endsWith("/") ? currentDirectory : `${currentDirectory}/`;
    for (const fileName of files.keys()) {
        if (fileName === `${currentDirectory}/tsconfig.json`) {
            continue;
        }
        if (fileName.startsWith(prefix) && /\.(?:ts|tsx|js|jsx|mts|cts)$/.test(fileName)) {
            rootFiles.push(fileName.slice(prefix.length));
        }
    }
    return rootFiles.sort();
}
//# sourceMappingURL=compiler-session.js.map