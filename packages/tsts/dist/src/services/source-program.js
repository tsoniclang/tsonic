import { Background } from "../go/context.js";
import { NewCompilerHost } from "../internal/compiler/host.js";
import { NewProgram, Program_BindSourceFiles, Program_GetConfigFileParsingDiagnostics, Program_GetProgramDiagnostics, Program_GetSemanticDiagnostics, Program_GetSourceFiles, Program_GetSyntacticDiagnostics, Program_GetTypeCheckerForFile, } from "../internal/compiler/program.js";
import { ParseCommandLine } from "../internal/tsoptions/commandlineparser.js";
import { FS as createOsFs } from "../internal/vfs/osvfs/os.js";
import { TSTrue } from "../internal/core/tristate.js";
import { NewOrderedMapWithSizeHint, OrderedMap_Set } from "../internal/collections/ordered_map.js";
import { ParsedCommandLine_CompilerOptions } from "../internal/tsoptions/parsedcommandline.js";
import { createExtensionHost } from "../extensions/extension-host.js";
import { createExtensionCheckerHandle, createExtensionTypeChecker, } from "../extensions/checker-facade.js";
import { createExtensionModuleGraph } from "../extensions/module-graph.js";
const isDefined = (value) => value !== undefined;
const appendCompilerOption = (args, key, value) => {
    if (value === undefined) {
        return;
    }
    args.push(`--${key}`);
    if (value === true) {
        return;
    }
    if (Array.isArray(value)) {
        args.push(value.join(","));
        return;
    }
    args.push(String(value));
};
const appendCompilerOptions = (args, compilerOptions) => {
    if (!compilerOptions) {
        return;
    }
    for (const key of Object.keys(compilerOptions).sort()) {
        appendCompilerOption(args, key, compilerOptions[key]);
    }
};
const sourceProgramCommandLineArgs = (filePaths, options) => {
    const args = ["--ignoreConfig"];
    appendCompilerOptions(args, options.compilerOptions);
    appendCompilerOptions(args, {
        pretty: false,
        noEmit: true,
        noLib: true,
    });
    args.push(...filePaths);
    return args;
};
const applyModuleResolutionPaths = (parsed, options, projectRoot) => {
    const moduleResolutionPaths = options.moduleResolutionPaths;
    if (!moduleResolutionPaths) {
        return;
    }
    const entries = Object.entries(moduleResolutionPaths).filter(([specifier, targetPaths]) => specifier.length > 0 && targetPaths.length > 0);
    if (entries.length === 0) {
        return;
    }
    const paths = NewOrderedMapWithSizeHint(entries.length);
    for (const [specifier, targetPaths] of entries) {
        OrderedMap_Set(paths, specifier, [...targetPaths]);
    }
    const compilerOptions = ParsedCommandLine_CompilerOptions(parsed);
    compilerOptions.Paths = paths;
    compilerOptions.PathsBasePath = options.moduleResolutionBaseUrl ?? projectRoot;
};
const collectDefinedDiagnostics = (diagnostics) => diagnostics.filter(isDefined);
const collectCompilerDiagnostics = (program, sourceFiles, runSemanticChecks) => {
    const diagnostics = [];
    diagnostics.push(...collectDefinedDiagnostics(Program_GetConfigFileParsingDiagnostics(program)));
    for (const sourceFile of sourceFiles) {
        diagnostics.push(...collectDefinedDiagnostics(Program_GetSyntacticDiagnostics(program, Background(), sourceFile)));
        if (runSemanticChecks) {
            diagnostics.push(...collectDefinedDiagnostics(Program_GetSemanticDiagnostics(program, Background(), sourceFile)));
        }
    }
    diagnostics.push(...collectDefinedDiagnostics(Program_GetProgramDiagnostics(program)));
    return diagnostics;
};
export const createCompilerSourceProgram = (filePaths, options = {}) => {
    const projectRoot = options.projectRoot ?? process.cwd();
    const fs = createOsFs();
    const parseHost = {
        FS: () => fs,
        GetCurrentDirectory: () => projectRoot,
    };
    const parsed = ParseCommandLine(sourceProgramCommandLineArgs(filePaths, options), parseHost);
    applyModuleResolutionPaths(parsed, options, projectRoot);
    const host = NewCompilerHost(projectRoot, fs, projectRoot, undefined, undefined);
    const program = NewProgram({
        Host: host,
        Config: parsed,
        UseSourceOfProjectReference: false,
        SingleThreaded: TSTrue,
        TypingsLocation: "",
        ProjectName: "",
        Tracing: undefined,
    });
    const sourceFiles = Program_GetSourceFiles(program).filter(isDefined);
    const extensionHost = createExtensionHost(options.extensions ?? []);
    const withTypeChecker = (sourceFile, run) => {
        const [checker, release] = Program_GetTypeCheckerForFile(program, Background(), sourceFile);
        try {
            return run(createExtensionTypeChecker(checker));
        }
        finally {
            release();
        }
    };
    extensionHost.configure();
    for (const sourceFile of sourceFiles) {
        extensionHost.afterParseSourceFile(sourceFile, program);
    }
    Program_BindSourceFiles(program);
    for (const sourceFile of sourceFiles) {
        extensionHost.afterBindSourceFile(sourceFile, program);
    }
    if (options.runSemanticChecks === true ||
        options.runExtensionChecks === true) {
        for (const sourceFile of sourceFiles) {
            const [checker, release] = Program_GetTypeCheckerForFile(program, Background(), sourceFile);
            try {
                extensionHost.afterCheckSourceFile(sourceFile, createExtensionCheckerHandle(checker), program);
            }
            finally {
                release();
            }
        }
        extensionHost.afterCheckProgram(program, sourceFiles);
    }
    extensionHost.validateProgram(program, sourceFiles);
    return {
        program,
        sourceFiles,
        moduleGraph: createExtensionModuleGraph(program, sourceFiles),
        extensionHost,
        diagnostics: collectCompilerDiagnostics(program, sourceFiles, options.runSemanticChecks === true),
        extensionDiagnostics: extensionHost.diagnostics.all(),
        withTypeChecker,
    };
};
//# sourceMappingURL=source-program.js.map