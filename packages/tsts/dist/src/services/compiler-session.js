import { Background } from "../go/context.js";
import { SourceFile_FileName } from "../internal/ast/ast.js";
import { NewProgram, Program_BindSourceFiles, Program_GetBindDiagnostics, Program_GetConfigFileParsingDiagnostics, Program_GetDeclarationDiagnostics, Program_GetGlobalDiagnostics, Program_GetProgramDiagnostics, Program_GetSemanticDiagnostics, Program_GetSourceFile, Program_GetSuggestionDiagnostics, Program_GetSyntacticDiagnostics, Program_getSourceFilesToEmit, } from "../internal/compiler/program.js";
import { GetParsedCommandLineOfConfigFile } from "../internal/tsoptions/tsconfigparsing.js";
import { snapshotExtensionHostOptionsForCompilerSession, } from "../extensions/host.js";
import { attachExtensionHost, getExtensionHost } from "../extensions/index.js";
import { finalizeExtensionSemantics } from "../extensions/compiler-integration.js";
import { ProviderMaterializationCoordinator, } from "../extensions/provider-materialization.js";
import { createSourceFactQueries } from "../extensions/consumer.js";
import { getProviderVirtualArtifactForCompiler } from "../extensions/provider-virtual-internal.js";
import { createCompilerHost, createInMemoryFileSystem } from "./embedding-host.js";
export function createCompilerSession(options) {
    const context = options.context ?? Background();
    return createCompilerSessionForProgramOwner(createMaterializingProgramOwner(options.programOptions, options.extensionHostOptions ?? {}, context), options.programOptions.Host, options.programOptions.Config, context);
}
export function createCompilerSessionFromProgram(program, host, config, context = Background()) {
    if (program === undefined) {
        throw new Error("Compiler sessions require a compiler program.");
    }
    return createCompilerSessionForProgramOwner(createFixedProgramOwner(program, context), host, config, context);
}
function createCompilerSessionForProgramOwner(owner, host, config, context) {
    let checkedSourceProgram;
    return {
        get program() {
            return owner.program;
        },
        host,
        config,
        getSourceFilesToEmit: (targetSourceFile, forceDtsEmit = false) => {
            const targetFileName = targetSourceFile === undefined ? undefined : SourceFile_FileName(targetSourceFile);
            owner.prepareForSemanticQueries();
            const currentTargetSourceFile = targetFileName === undefined
                ? undefined
                : requireCurrentSourceFile(owner.program, targetFileName);
            return (Program_getSourceFilesToEmit(owner.program, currentTargetSourceFile, forceDtsEmit) ?? [])
                .filter((file) => getProviderVirtualArtifactForCompiler(requireExtensionHost(owner.program).providers, SourceFile_FileName(file))?.kind
                !== "canonical-export-owner");
        },
        ensureBound: () => Program_BindSourceFiles(owner.program),
        ensureChecked: (sourceFile) => {
            const fileName = sourceFile === undefined ? undefined : SourceFile_FileName(sourceFile);
            owner.prepareForSemanticQueries();
            return Program_GetSemanticDiagnostics(owner.program, context, fileName === undefined ? undefined : requireCurrentSourceFile(owner.program, fileName));
        },
        getDiagnostics: (kind = "all", sourceFile) => {
            const fileName = sourceFile === undefined ? undefined : SourceFile_FileName(sourceFile);
            if (diagnosticKindRequiresSemanticProgram(kind)) {
                owner.prepareForSemanticQueries();
            }
            return getDiagnostics(owner.program, context, kind, fileName === undefined ? undefined : requireCurrentSourceFile(owner.program, fileName));
        },
        checkSource: () => {
            if (checkedSourceProgram !== undefined) {
                return checkedSourceProgram;
            }
            const prepared = owner.prepareFinalizedProgram();
            const finalizedHost = prepared.finalizedHost;
            if (finalizedHost === undefined) {
                throw new Error("Checked source requires an attached source-extension host.");
            }
            const source = finalizedHost.getCompilerQueryContext(context);
            const checked = Object.freeze({
                ...source,
                program: prepared.program,
                sourceFiles: Object.freeze([...source.getSourceFiles()]),
                sourceFacts: createSourceFactQueries(finalizedHost),
                diagnostics: prepared.diagnostics,
                extensionDiagnostics: finalizedHost.diagnostics.all(),
            });
            checkedSourceProgram = checked;
            return checked;
        },
    };
}
function createFixedProgramOwner(program, context) {
    if (getExtensionHost(program) === undefined) {
        attachExtensionHost(program);
    }
    return {
        program,
        prepareForSemanticQueries() { },
        prepareFinalizedProgram() {
            const diagnostics = Object.freeze([...getDiagnostics(program, context, "all", undefined)]);
            return Object.freeze({
                program,
                diagnostics,
                finalizedHost: finalizeExtensionSemantics(program),
            });
        },
    };
}
function createMaterializingProgramOwner(baseProgramOptions, baseExtensionHostOptions, context) {
    const coordinator = new ProviderMaterializationCoordinator();
    const extensionHostOptionsSnapshot = snapshotExtensionHostOptionsForCompilerSession(baseExtensionHostOptions);
    let state = createProgramMaterializationRound(coordinator, baseProgramOptions, extensionHostOptionsSnapshot);
    let finalized;
    const rebuildForPendingDemands = () => {
        if (!state.round.hasPendingDemands()) {
            return false;
        }
        if (!coordinator.finishRound(state.round)) {
            throw new Error("Provider materialization recorded demands without monotonic progress.");
        }
        state = createProgramMaterializationRound(coordinator, baseProgramOptions, extensionHostOptionsSnapshot);
        return true;
    };
    const prepareForSemanticQueries = () => {
        if (finalized !== undefined || !state.round.hasIncrementalProvider()) {
            return;
        }
        while (true) {
            getDiagnostics(state.program, context, "all", undefined);
            if (!rebuildForPendingDemands()) {
                return;
            }
        }
    };
    const owner = {
        get program() {
            return state.program;
        },
        prepareForSemanticQueries,
        prepareFinalizedProgram() {
            if (finalized !== undefined) {
                return finalized;
            }
            while (true) {
                const diagnostics = Object.freeze([...getDiagnostics(state.program, context, "all", undefined)]);
                if (rebuildForPendingDemands()) {
                    continue;
                }
                const finalizedHost = finalizeExtensionSemantics(state.program);
                if (rebuildForPendingDemands()) {
                    continue;
                }
                coordinator.seal(state.round);
                finalized = Object.freeze({
                    program: state.program,
                    diagnostics,
                    finalizedHost,
                });
                return finalized;
            }
        },
    };
    return owner;
}
function createProgramMaterializationRound(coordinator, baseProgramOptions, baseExtensionHostOptions) {
    const extensionHostOptions = Object.freeze({ ...baseExtensionHostOptions });
    const round = coordinator.beginRound(extensionHostOptions);
    const programOptions = { ...baseProgramOptions };
    attachExtensionHost(programOptions, extensionHostOptions);
    const program = NewProgram(programOptions);
    if (program === undefined) {
        throw new Error("Compiler sessions require a compiler program.");
    }
    return Object.freeze({ program, round });
}
function requireExtensionHost(program) {
    const extensionHost = getExtensionHost(program);
    if (extensionHost === undefined) {
        throw new Error("Compiler session lost its attached source-extension host.");
    }
    return extensionHost;
}
function requireCurrentSourceFile(program, fileName) {
    const sourceFile = Program_GetSourceFile(program, fileName);
    if (sourceFile === undefined) {
        throw new Error(`Compiler session rebuild removed requested source file '${fileName}'.`);
    }
    return sourceFile;
}
function diagnosticKindRequiresSemanticProgram(kind) {
    return kind === "semantic"
        || kind === "suggestion"
        || kind === "declaration"
        || kind === "all";
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