import { Background } from "../go/context.js";
import { SourceFile_FileName } from "../internal/ast/ast.js";
import { NewProgram, Program_BindSourceFiles, Program_GetBindDiagnostics, Program_GetConfigFileParsingDiagnostics, Program_GetDeclarationDiagnostics, Program_GetGlobalDiagnostics, Program_GetProgramDiagnostics, Program_GetSemanticDiagnostics, Program_GetSourceFile, Program_GetSuggestionDiagnostics, Program_GetSyntacticDiagnostics, Program_getSourceFilesToEmit, } from "../internal/compiler/program.js";
import { GetParsedCommandLineOfConfigFile } from "../internal/tsoptions/tsconfigparsing.js";
import { extensionHostAttachElaboration, extensionHostRunElaboration, extensionHostRetireCompilerProgram, snapshotExtensionHostOptionsForCompilerSession, } from "../extensions/host.js";
import { attachExtensionHost, getExtensionHost } from "../extensions/index.js";
import { finalizeExtensionSemantics } from "../extensions/compiler-integration.js";
import { ProviderMaterializationCoordinator, } from "../extensions/provider-materialization.js";
import { SourceElaborationCoordinator, isSourceElaborationSuspension } from "../extensions/source-elaboration.js";
import { createSourceFactQueries } from "../extensions/consumer.js";
import { getProviderVirtualArtifactForCompiler } from "../extensions/provider-virtual-internal.js";
import { createCompilerHost, createInMemoryFileSystem } from "./embedding-host.js";
import { createCompilerSessionHost } from "./compiler-session-source.js";
export function createCompilerSession(options) {
    const context = options.context ?? Background();
    const host = createCompilerSessionHost(options.programOptions.Host);
    return createCompilerSessionForProgramOwner(createMaterializingProgramOwner({ ...options.programOptions, Host: host }, options.extensionHostOptions ?? {}, context, options.sourceElaborationLimits), host, options.programOptions.Config, context);
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
            return owner.query(program => {
                const currentTargetSourceFile = targetFileName === undefined ? undefined : requireCurrentSourceFile(program, targetFileName);
                return (Program_getSourceFilesToEmit(program, currentTargetSourceFile, forceDtsEmit) ?? [])
                    .filter(file => getProviderVirtualArtifactForCompiler(requireExtensionHost(program).providers, SourceFile_FileName(file))?.kind
                    !== "canonical-export-owner");
            });
        },
        ensureBound: () => owner.query(program => Program_BindSourceFiles(program)),
        ensureChecked: (sourceFile) => {
            const fileName = sourceFile === undefined ? undefined : SourceFile_FileName(sourceFile);
            return owner.query(program => diagnosticsOrEmpty(Program_GetSemanticDiagnostics(program, context, fileName === undefined ? undefined : requireCurrentSourceFile(program, fileName))));
        },
        getDiagnostics: (kind = "all", sourceFile) => {
            const fileName = sourceFile === undefined ? undefined : SourceFile_FileName(sourceFile);
            const read = (program) => getDiagnostics(program, context, kind, fileName === undefined ? undefined : requireCurrentSourceFile(program, fileName));
            return diagnosticKindRequiresSemanticProgram(kind) ? owner.query(read) : read(owner.program);
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
    if (requireExtensionHost(program).hasSourceElaboration) {
        throw new Error("Source elaboration requires a compiler session that owns fresh program creation.");
    }
    return {
        program,
        query: operation => operation(program),
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
function createMaterializingProgramOwner(baseProgramOptions, baseExtensionHostOptions, context, sourceElaborationLimits) {
    const coordinator = new ProviderMaterializationCoordinator();
    const elaborationCoordinator = new SourceElaborationCoordinator(sourceElaborationLimits);
    const extensionHostOptionsSnapshot = snapshotExtensionHostOptionsForCompilerSession(baseExtensionHostOptions);
    let state = createProgramMaterializationRound(coordinator, elaborationCoordinator, baseProgramOptions, extensionHostOptionsSnapshot);
    let finalized;
    let failed = false;
    const fail = (error) => {
        failed = true;
        requireExtensionHost(state.program)[extensionHostRetireCompilerProgram]();
        throw error;
    };
    const rebuildForPendingDemands = () => {
        const providerPending = state.round.hasPendingDemands();
        if (!providerPending && state.elaboration?.needsReplay() !== true) {
            return false;
        }
        const providerChanged = coordinator.finishRound(state.round);
        if (providerPending && !providerChanged) {
            throw new Error("Provider materialization recorded demands without monotonic progress.");
        }
        if (state.elaboration !== undefined)
            elaborationCoordinator.finishRound(state.elaboration, providerChanged);
        requireExtensionHost(state.program)[extensionHostRetireCompilerProgram]();
        state = createProgramMaterializationRound(coordinator, elaborationCoordinator, baseProgramOptions, extensionHostOptionsSnapshot);
        return true;
    };
    const query = (operation) => {
        if (failed)
            throw new Error("Compiler session preparation previously failed.");
        if (finalized !== undefined)
            return operation(finalized.program);
        while (true) {
            try {
                if (state.elaboration !== undefined)
                    Program_BindSourceFiles(state.program);
                requireExtensionHost(state.program)[extensionHostRunElaboration]();
                if (rebuildForPendingDemands())
                    continue;
                if (state.elaboration !== undefined || state.round.hasIncrementalProvider()) {
                    getDiagnostics(state.program, context, "all", undefined);
                    if (rebuildForPendingDemands())
                        continue;
                }
                const result = operation(state.program);
                if (rebuildForPendingDemands())
                    continue;
                return result;
            }
            catch (error) {
                if (state.elaboration !== undefined && isSourceElaborationSuspension(error, state.elaboration)) {
                    try {
                        if (rebuildForPendingDemands())
                            continue;
                    }
                    catch (replayError) {
                        return fail(replayError);
                    }
                }
                return fail(error);
            }
        }
    };
    const owner = {
        get program() {
            return state.program;
        },
        query,
        prepareFinalizedProgram() {
            if (finalized !== undefined) {
                return finalized;
            }
            const prepared = query(program => {
                const diagnostics = Object.freeze([...getDiagnostics(program, context, "all", undefined)]);
                const finalizedHost = finalizeExtensionSemantics(program);
                return Object.freeze({ program, diagnostics, finalizedHost });
            });
            try {
                if (state.elaboration !== undefined)
                    elaborationCoordinator.seal(state.elaboration);
                coordinator.seal(state.round);
            }
            catch (error) {
                return fail(error);
            }
            finalized = prepared;
            return finalized;
        },
    };
    return owner;
}
function createProgramMaterializationRound(coordinator, elaborationCoordinator, baseProgramOptions, baseExtensionHostOptions) {
    const extensionHostOptions = Object.freeze({ ...baseExtensionHostOptions });
    const round = coordinator.beginRound(extensionHostOptions);
    const programOptions = { ...baseProgramOptions };
    attachExtensionHost(programOptions, extensionHostOptions);
    const program = NewProgram(programOptions);
    if (program === undefined) {
        throw new Error("Compiler sessions require a compiler program.");
    }
    const extensionHost = requireExtensionHost(program);
    if (extensionHost.hasSourceElaboration) {
        const elaboration = elaborationCoordinator.beginRound(extensionHost.getCompilerQueryContext());
        extensionHost[extensionHostAttachElaboration](elaboration);
        return Object.freeze({ program, round, elaboration });
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
    return kind === "bind"
        || kind === "semantic"
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
            ...(options.sourceElaborationLimits === undefined ? {} : { sourceElaborationLimits: options.sourceElaborationLimits }),
            ...(options.extensionHostOptions !== undefined ? { extensionHostOptions: options.extensionHostOptions } : {}),
            ...(options.context !== undefined ? { context: options.context } : {}),
        });
    }
    return createCompilerSession({
        ...(options.sourceElaborationLimits === undefined ? {} : { sourceElaborationLimits: options.sourceElaborationLimits }),
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
            return diagnosticsOrEmpty(Program_GetConfigFileParsingDiagnostics(program));
        case "program":
            return diagnosticsOrEmpty(Program_GetProgramDiagnostics(program));
        case "global":
            return diagnosticsOrEmpty(Program_GetGlobalDiagnostics(program, context));
        case "syntactic":
            return diagnosticsOrEmpty(Program_GetSyntacticDiagnostics(program, context, sourceFile));
        case "bind":
            return diagnosticsOrEmpty(Program_GetBindDiagnostics(program, context, sourceFile));
        case "semantic":
            return diagnosticsOrEmpty(Program_GetSemanticDiagnostics(program, context, sourceFile));
        case "suggestion":
            return diagnosticsOrEmpty(Program_GetSuggestionDiagnostics(program, context, sourceFile));
        case "declaration":
            return diagnosticsOrEmpty(Program_GetDeclarationDiagnostics(program, context, sourceFile));
        case "all":
            return [
                ...diagnosticsOrEmpty(Program_GetConfigFileParsingDiagnostics(program)),
                ...diagnosticsOrEmpty(Program_GetProgramDiagnostics(program)),
                ...diagnosticsOrEmpty(Program_GetGlobalDiagnostics(program, context)),
                ...diagnosticsOrEmpty(Program_GetSyntacticDiagnostics(program, context, sourceFile)),
                ...diagnosticsOrEmpty(Program_GetBindDiagnostics(program, context, sourceFile)),
                ...diagnosticsOrEmpty(Program_GetSemanticDiagnostics(program, context, sourceFile)),
            ];
    }
}
function diagnosticsOrEmpty(diagnostics) {
    return diagnostics ?? [];
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