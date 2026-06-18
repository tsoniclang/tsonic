import { Map as SyncGoMap } from "../../go/sync.js";
import { NewCompilerDiagnostic } from "../ast/diagnostic.js";
import { SyncMap_Delete, SyncMap_Load, SyncMap_Range, SyncMap_Store } from "../collections/syncmap.js";
import { SyncSet_Add, SyncSet_ToSlice } from "../collections/syncset.js";
import { NewCompilerHost } from "../compiler/host.js";
import { NewProgram, Program_FilesByPath } from "../compiler/program.js";
import { WatchOptions_WatchInterval } from "../core/watchoptions.js";
import { ParsedCommandLine_Locale, ParsedCommandLine_CompilerOptions, ParsedCommandLine_ExtendedSourceFiles, ParsedCommandLine_WildcardDirectories, ParsedCommandLine_ReloadFileNamesOfParsedCommandLine, } from "../tsoptions/parsedcommandline.js";
import { From as cachedvfsFrom, FS_as_vfs_FS as cachedvfsAsVfsFS, FS_DisableAndClearCache } from "../vfs/cachedvfs/cachedvfs.js";
import { FS_as_vfs_FS as trackingFSAsVfsFS } from "../vfs/trackingvfs/trackingvfs.js";
import { NewFileWatcher, FileWatcher_Run, FileWatcher_UpdateWatchState, FileWatcher_SetPollInterval, FileWatcher_WatchStateUninitialized, FileWatcher_HasChangesFromWatchState, FileWatcher_WatchStateEntry, } from "../vfs/vfswatch/vfswatch.js";
import * as diagnosticMessages from "../diagnostics/generated/messages.js";
import { GetTraceWithWriterFromSys } from "./tsc/emit.js";
import { NewProgram as IncrementalNewProgram, Program_GetProgram, } from "./incremental/program.js";
import { ReadBuildInfoProgram, NewBuildInfoReader, } from "./incremental/incremental.js";
import { CreateWatchStatusReporter } from "./tsc/diagnostics.js";
import { GetParsedCommandLineOfConfigFile } from "../tsoptions/tsconfigparsing.js";
import { ExtendedConfigCache_as_tsoptions_ExtendedConfigCache } from "./tsc/extendedconfigcache.js";
import { EmitFilesAndReportErrors } from "./tsc/emit.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::watchCompilerHost.GetSourceFile","kind":"method","status":"implemented","sigHash":"a46cae9b723ebb7938a073f5d67c1af9937c7e4e0f3ff022e90fda7c44dc3cbd","bodyHash":"6dc4e4f5f42f88a677159bd1e38a35cf0e2a718d201b22b3566b5e0a373cfaae"}
 *
 * Go source:
 * func (h *watchCompilerHost) GetSourceFile(opts ast.SourceFileParseOptions) *ast.SourceFile {
 * 	info := h.CompilerHost.FS().Stat(opts.FileName)
 *
 * 	if cached, ok := h.cache.Load(opts.Path); ok {
 * 		if info != nil && info.ModTime().Equal(cached.modTime) {
 * 			return cached.file
 * 		}
 * 	}
 *
 * 	file := h.CompilerHost.GetSourceFile(opts)
 * 	if file != nil {
 * 		if info != nil {
 * 			h.cache.Store(opts.Path, &cachedSourceFile{
 * 				file:    file,
 * 				modTime: info.ModTime(),
 * 			})
 * 		}
 * 	} else {
 * 		h.cache.Delete(opts.Path)
 * 	}
 * 	return file
 * }
 */
export function watchCompilerHost_GetSourceFile(receiver, opts) {
    const info = receiver.__tsgoEmbedded0.FS().Stat(opts.FileName);
    const [cached, ok] = SyncMap_Load(receiver.cache, opts.Path);
    if (ok) {
        if (info !== undefined && info.ModTime().Equal(cached.modTime)) {
            return cached.file;
        }
    }
    const file = receiver.__tsgoEmbedded0.GetSourceFile(opts);
    if (file !== undefined) {
        if (info !== undefined) {
            SyncMap_Store(receiver.cache, opts.Path, {
                file,
                modTime: info.ModTime(),
            });
        }
    }
    else {
        SyncMap_Delete(receiver.cache, opts.Path);
    }
    return file;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"e42466e9d55431436fd56f71ca20518e1ef306e5d2a89e987baac34aafe69adc"}
 *
 * Go source:
 * var _ tsc.Watcher = (*Watcher)(nil)
 */
export let __30d59bfd_0 = Watcher_as_tsc_Watcher(undefined);
export function Watcher_as_tsc_Watcher(receiver) {
    return {
        DoCycle: () => Watcher_DoCycle(receiver),
    };
}
function newSyncMap() {
    return { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncGoMap() };
}
function newSyncSet() {
    return { m: newSyncMap() };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::func::createWatcher","kind":"func","status":"implemented","sigHash":"0e2d5121c1d046397f1a7ddb5f201fd49b57844625e305771faf15d864d02e49","bodyHash":"3d1989a8ae55a6bff236d90d814008c3c4126956c874c07741b4eafdd19efed4"}
 *
 * Go source:
 * func createWatcher(
 * 	sys tsc.System,
 * 	configParseResult *tsoptions.ParsedCommandLine,
 * 	compilerOptionsFromCommandLine *core.CompilerOptions,
 * 	reportDiagnostic tsc.DiagnosticReporter,
 * 	reportErrorSummary tsc.DiagnosticsReporter,
 * 	testing tsc.CommandLineTesting,
 * ) *Watcher {
 * 	w := &Watcher{
 * 		sys:                            sys,
 * 		config:                         configParseResult,
 * 		compilerOptionsFromCommandLine: compilerOptionsFromCommandLine,
 * 		reportDiagnostic:               reportDiagnostic,
 * 		reportErrorSummary:             reportErrorSummary,
 * 		reportWatchStatus:              tsc.CreateWatchStatusReporter(sys, configParseResult.Locale(), configParseResult.CompilerOptions(), testing),
 * 		testing:                        testing,
 * 		sourceFileCache:                &collections.SyncMap[tspath.Path, *cachedSourceFile]{},
 * 	}
 * 	if configParseResult.ConfigFile != nil {
 * 		w.configFileName = configParseResult.ConfigFile.SourceFile.FileName()
 * 	}
 * 	w.fileWatcher = vfswatch.NewFileWatcher(
 * 		sys.FS(),
 * 		w.config.ParsedConfig.WatchOptions.WatchInterval(),
 * 		testing != nil,
 * 		w.DoCycle,
 * 	)
 * 	return w
 * }
 */
export function createWatcher(sys, configParseResult, compilerOptionsFromCommandLine, reportDiagnostic, reportErrorSummary, testing) {
    const sourceFileCache = newSyncMap();
    const w = {
        mu: { Lock: () => { }, Unlock: () => { }, TryLock: () => true },
        sys,
        configFileName: "",
        config: configParseResult,
        compilerOptionsFromCommandLine,
        reportDiagnostic,
        reportErrorSummary,
        reportWatchStatus: CreateWatchStatusReporter(sys, ParsedCommandLine_Locale(configParseResult), ParsedCommandLine_CompilerOptions(configParseResult), testing),
        testing,
        program: undefined,
        extendedConfigCache: undefined,
        configModified: false,
        configHasErrors: false,
        configFilePaths: [],
        sourceFileCache: sourceFileCache,
        fileWatcher: undefined,
    };
    if (configParseResult.ConfigFile !== undefined && configParseResult.ConfigFile !== null) {
        w.configFileName = configParseResult.ConfigFile.SourceFile.fileName;
    }
    w.fileWatcher = NewFileWatcher(sys.FS(), WatchOptions_WatchInterval(configParseResult.ParsedConfig.WatchOptions), (testing !== undefined && testing !== null), () => Watcher_DoCycle(w));
    return w;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.start","kind":"method","status":"implemented","sigHash":"44effa08e1221210fdb230c2743c6ef028c8fe4f500822a548d45f1bfb7ce1a7","bodyHash":"f29e406b949841f264ec2b73f6d8218e60ad6f6b544c6e8e53d9ab22f943e0f2"}
 *
 * Go source:
 * func (w *Watcher) start() {
 * 	w.mu.Lock()
 * 	w.extendedConfigCache = &tsc.ExtendedConfigCache{}
 * 	host := compiler.NewCompilerHost(w.sys.GetCurrentDirectory(), w.sys.FS(), w.sys.DefaultLibraryPath(), w.extendedConfigCache, getTraceFromSys(w.sys, w.config.Locale(), w.testing))
 * 	w.program = incremental.ReadBuildInfoProgram(w.config, incremental.NewBuildInfoReader(host), host)
 *
 * 	if w.configFileName != "" {
 * 		w.configFilePaths = append([]string{w.configFileName}, w.config.ExtendedSourceFiles()...)
 * 	}
 *
 * 	w.reportWatchStatus(ast.NewCompilerDiagnostic(diagnostics.Starting_compilation_in_watch_mode))
 * 	w.doBuild()
 * 	w.mu.Unlock()
 *
 * 	if w.testing == nil {
 * 		w.fileWatcher.Run(w.sys.Now)
 * 	}
 * }
 */
export function Watcher_start(receiver) {
    // mu.Lock() / Unlock() omitted: TSTS is single-threaded
    receiver.extendedConfigCache = { m: newSyncMap() };
    const host = NewCompilerHost(receiver.sys.GetCurrentDirectory(), receiver.sys.FS(), receiver.sys.DefaultLibraryPath(), ExtendedConfigCache_as_tsoptions_ExtendedConfigCache(receiver.extendedConfigCache), GetTraceWithWriterFromSys(receiver.sys.Writer(), ParsedCommandLine_Locale(receiver.config), receiver.testing));
    receiver.program = ReadBuildInfoProgram(receiver.config, NewBuildInfoReader(host), host);
    if (receiver.configFileName !== "") {
        receiver.configFilePaths = [receiver.configFileName, ...ParsedCommandLine_ExtendedSourceFiles(receiver.config)];
    }
    receiver.reportWatchStatus(NewCompilerDiagnostic(diagnosticMessages.Starting_compilation_in_watch_mode));
    Watcher_doBuild(receiver);
    if (receiver.testing === undefined) {
        FileWatcher_Run(receiver.fileWatcher, () => receiver.sys.Now());
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.DoCycle","kind":"method","status":"implemented","sigHash":"ecaa47d3f54ab539ad5ba3eede04da38c22c27e5a87413f26108fe746bc7bbcc","bodyHash":"0755ab9b5dd14fd8d57295c27737eb0529e4f84f55d142b69d743107ca602537"}
 *
 * Go source:
 * func (w *Watcher) DoCycle() {
 * 	w.mu.Lock()
 * 	defer w.mu.Unlock()
 * 	if w.recheckTsConfig() {
 * 		return
 * 	}
 * 	if !w.fileWatcher.WatchStateUninitialized() && !w.configModified && !w.fileWatcher.HasChangesFromWatchState() {
 * 		if w.testing != nil {
 * 			w.testing.OnProgram(w.program)
 * 		}
 * 		return
 * 	}
 *
 * 	w.reportWatchStatus(ast.NewCompilerDiagnostic(diagnostics.File_change_detected_Starting_incremental_compilation))
 * 	w.doBuild()
 * }
 */
export function Watcher_DoCycle(receiver) {
    // mu.Lock() / defer mu.Unlock() omitted: TSTS is single-threaded
    if (Watcher_recheckTsConfig(receiver)) {
        return;
    }
    if (!FileWatcher_WatchStateUninitialized(receiver.fileWatcher) && !receiver.configModified && !FileWatcher_HasChangesFromWatchState(receiver.fileWatcher)) {
        if (receiver.testing !== undefined) {
            receiver.testing.OnProgram(receiver.program);
        }
        return;
    }
    receiver.reportWatchStatus(NewCompilerDiagnostic(diagnosticMessages.File_change_detected_Starting_incremental_compilation));
    Watcher_doBuild(receiver);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.doBuild","kind":"method","status":"implemented","sigHash":"9112331ae73eb271a810b6712651b29a463e2b35ea14864fcb6a363346b592b7","bodyHash":"3e8b6462f91d93458a2e115f56ffe19870462ed9272a2a084b7efe8e759c731e"}
 *
 * Go source:
 * func (w *Watcher) doBuild() {
 * 	if w.configModified {
 * 		w.sourceFileCache = &collections.SyncMap[tspath.Path, *cachedSourceFile]{}
 * 	}
 *
 * 	cached := cachedvfs.From(w.sys.FS())
 * 	tfs := &trackingvfs.FS{Inner: cached}
 * 	innerHost := compiler.NewCompilerHost(w.sys.GetCurrentDirectory(), tfs, w.sys.DefaultLibraryPath(), w.extendedConfigCache, getTraceFromSys(w.sys, w.config.Locale(), w.testing))
 * 	host := &watchCompilerHost{CompilerHost: innerHost, cache: w.sourceFileCache}
 *
 * 	var wildcardDirs map[string]bool
 * 	if w.config.ConfigFile != nil {
 * 		wildcardDirs = w.config.WildcardDirectories()
 * 		for dir := range wildcardDirs {
 * 			tfs.SeenFiles.Add(dir)
 * 		}
 * 		if len(wildcardDirs) > 0 {
 * 			w.config = w.config.ReloadFileNamesOfParsedCommandLine(w.sys.FS())
 * 		}
 * 	}
 * 	for _, path := range w.configFilePaths {
 * 		tfs.SeenFiles.Add(path)
 * 	}
 *
 * 	w.program = incremental.NewProgram(compiler.NewProgram(compiler.ProgramOptions{
 * 		Config: w.config,
 * 		Host:   host,
 * 	}), w.program, nil, w.testing != nil)
 *
 * 	result := w.compileAndEmit()
 * 	cached.DisableAndClearCache()
 * 	w.fileWatcher.UpdateWatchState(tfs.SeenFiles.ToSlice(), wildcardDirs)
 * 	w.fileWatcher.SetPollInterval(w.config.ParsedConfig.WatchOptions.WatchInterval())
 * 	w.configModified = false
 *
 * 	programFiles := w.program.GetProgram().FilesByPath()
 * 	w.sourceFileCache.Range(func(path tspath.Path, _ *cachedSourceFile) bool {
 * 		if _, ok := programFiles[path]; !ok {
 * 			w.sourceFileCache.Delete(path)
 * 		}
 * 		return true
 * 	})
 *
 * 	errorCount := len(result.Diagnostics)
 * 	if errorCount == 1 {
 * 		w.reportWatchStatus(ast.NewCompilerDiagnostic(diagnostics.Found_1_error_Watching_for_file_changes))
 * 	} else {
 * 		w.reportWatchStatus(ast.NewCompilerDiagnostic(diagnostics.Found_0_errors_Watching_for_file_changes, errorCount))
 * 	}
 *
 * 	if w.testing != nil {
 * 		w.testing.OnProgram(w.program)
 * 	}
 * }
 */
export function Watcher_doBuild(receiver) {
    if (receiver.configModified) {
        receiver.sourceFileCache = newSyncMap();
    }
    const cached = cachedvfsFrom(receiver.sys.FS());
    const tfsSeenFiles = newSyncSet();
    const tfs = {
        Inner: cachedvfsAsVfsFS(cached),
        SeenFiles: tfsSeenFiles,
    };
    const innerHost = NewCompilerHost(receiver.sys.GetCurrentDirectory(), trackingFSAsVfsFS(tfs), receiver.sys.DefaultLibraryPath(), ExtendedConfigCache_as_tsoptions_ExtendedConfigCache(receiver.extendedConfigCache), GetTraceWithWriterFromSys(receiver.sys.Writer(), ParsedCommandLine_Locale(receiver.config), receiver.testing));
    let wildcardDirs;
    if (receiver.config.ConfigFile !== undefined) {
        wildcardDirs = ParsedCommandLine_WildcardDirectories(receiver.config);
        for (const [dir] of wildcardDirs) {
            SyncSet_Add(tfs.SeenFiles, dir);
        }
        if (wildcardDirs.size > 0) {
            receiver.config = ParsedCommandLine_ReloadFileNamesOfParsedCommandLine(receiver.config, receiver.sys.FS());
        }
    }
    for (const path of receiver.configFilePaths) {
        SyncSet_Add(tfs.SeenFiles, path);
    }
    receiver.program = IncrementalNewProgram(NewProgram({ Config: receiver.config, Host: innerHost }), receiver.program, undefined, receiver.testing !== undefined);
    const result = Watcher_compileAndEmit(receiver);
    FS_DisableAndClearCache(cached);
    FileWatcher_UpdateWatchState(receiver.fileWatcher, SyncSet_ToSlice(tfsSeenFiles), wildcardDirs ?? new Map());
    FileWatcher_SetPollInterval(receiver.fileWatcher, WatchOptions_WatchInterval(receiver.config.ParsedConfig.WatchOptions));
    receiver.configModified = false;
    const programFiles = Program_FilesByPath(Program_GetProgram(receiver.program));
    SyncMap_Range(receiver.sourceFileCache, (path) => {
        if (!programFiles.has(path)) {
            SyncMap_Delete(receiver.sourceFileCache, path);
        }
        return true;
    });
    const errorCount = result.Diagnostics.length;
    if (errorCount === 1) {
        receiver.reportWatchStatus(NewCompilerDiagnostic(diagnosticMessages.Found_1_error_Watching_for_file_changes));
    }
    else {
        receiver.reportWatchStatus(NewCompilerDiagnostic(diagnosticMessages.Found_0_errors_Watching_for_file_changes, errorCount));
    }
    if (receiver.testing !== undefined) {
        receiver.testing.OnProgram(receiver.program);
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.compileAndEmit","kind":"method","status":"implemented","sigHash":"05d4e6cdd7e0f43d7ef232ee0965ba2d02987eef8698cce19e90676d88765889","bodyHash":"05e36bfbc522f925a718f7a89ac871104bd8a3cbba5e95c220cd3d90063878a7"}
 *
 * Go source:
 * func (w *Watcher) compileAndEmit() tsc.CompileAndEmitResult {
 * 	return tsc.EmitFilesAndReportErrors(tsc.EmitInput{
 * 		Sys:                w.sys,
 * 		ProgramLike:        w.program,
 * 		Program:            w.program.GetProgram(),
 * 		Config:             w.config,
 * 		ReportDiagnostic:   w.reportDiagnostic,
 * 		ReportErrorSummary: w.reportErrorSummary,
 * 		Writer:             w.sys.Writer(),
 * 		CompileTimes:       &tsc.CompileTimes{},
 * 		Testing:            w.testing,
 * 	})
 * }
 */
export function Watcher_compileAndEmit(receiver) {
    return EmitFilesAndReportErrors({
        Sys: receiver.sys,
        ProgramLike: receiver.program,
        Program: Program_GetProgram(receiver.program),
        Config: receiver.config,
        ReportDiagnostic: receiver.reportDiagnostic,
        ReportErrorSummary: receiver.reportErrorSummary,
        Writer: receiver.sys.Writer(),
        CompileTimes: {},
        Testing: receiver.testing,
    });
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.recheckTsConfig","kind":"method","status":"implemented","sigHash":"6fcb7c239a4aa41c93efb434f155a2dfc180916e73693d437db374172661ebf5","bodyHash":"5e7352cb8697108f4b6ef476ce793bb822f429fbf9da15b138b793f1194d7b92"}
 *
 * Go source:
 * func (w *Watcher) recheckTsConfig() bool {
 * 	if w.configFileName == "" {
 * 		return false
 * 	}
 *
 * 	if !w.configHasErrors && len(w.configFilePaths) > 0 {
 * 		changed := false
 * 		for _, path := range w.configFilePaths {
 * 			old, ok := w.fileWatcher.WatchStateEntry(path)
 * 			if !ok {
 * 				changed = true
 * 				break
 * 			}
 * 			s := w.sys.FS().Stat(path)
 * 			if !old.Exists {
 * 				if s != nil {
 * 					changed = true
 * 					break
 * 				}
 * 			} else {
 * 				if s == nil || !s.ModTime().Equal(old.ModTime) {
 * 					changed = true
 * 					break
 * 				}
 * 			}
 * 		}
 * 		if !changed {
 * 			return false
 * 		}
 * 	}
 *
 * 	extendedConfigCache := &tsc.ExtendedConfigCache{}
 * 	configParseResult, errors := tsoptions.GetParsedCommandLineOfConfigFile(w.configFileName, w.compilerOptionsFromCommandLine, nil, w.sys, extendedConfigCache)
 * 	if len(errors) > 0 {
 * 		for _, e := range errors {
 * 			w.reportDiagnostic(e)
 * 		}
 * 		w.configHasErrors = true
 * 		errorCount := len(errors)
 * 		if errorCount == 1 {
 * 			w.reportWatchStatus(ast.NewCompilerDiagnostic(diagnostics.Found_1_error_Watching_for_file_changes))
 * 		} else {
 * 			w.reportWatchStatus(ast.NewCompilerDiagnostic(diagnostics.Found_0_errors_Watching_for_file_changes, errorCount))
 * 		}
 * 		return true
 * 	}
 * 	if w.configHasErrors {
 * 		w.configModified = true
 * 	}
 * 	w.configHasErrors = false
 * 	w.configFilePaths = append([]string{w.configFileName}, configParseResult.ExtendedSourceFiles()...)
 * 	if !reflect.DeepEqual(w.config.ParsedConfig, configParseResult.ParsedConfig) {
 * 		w.configModified = true
 * 	}
 * 	w.config = configParseResult
 * 	w.extendedConfigCache = extendedConfigCache
 * 	return false
 * }
 */
export function Watcher_recheckTsConfig(receiver) {
    if (receiver.configFileName === "") {
        return false;
    }
    if (!receiver.configHasErrors && receiver.configFilePaths.length > 0) {
        let changed = false;
        for (const path of receiver.configFilePaths) {
            const [old, ok] = FileWatcher_WatchStateEntry(receiver.fileWatcher, path);
            if (!ok) {
                changed = true;
                break;
            }
            const s = receiver.sys.FS().Stat(path);
            if (!old.Exists) {
                if (s !== undefined && s !== null) {
                    changed = true;
                    break;
                }
            }
            else {
                if (s === undefined || s === null || !s.ModTime().Equal(old.ModTime)) {
                    changed = true;
                    break;
                }
            }
        }
        if (!changed) {
            return false;
        }
    }
    const extendedConfigCache = { m: newSyncMap() };
    const [configParseResult, errors] = GetParsedCommandLineOfConfigFile(receiver.configFileName, receiver.compilerOptionsFromCommandLine, undefined, receiver.sys, ExtendedConfigCache_as_tsoptions_ExtendedConfigCache(extendedConfigCache));
    if (errors.length > 0) {
        for (const e of errors) {
            receiver.reportDiagnostic(e);
        }
        receiver.configHasErrors = true;
        const errorCount = errors.length;
        if (errorCount === 1) {
            receiver.reportWatchStatus(NewCompilerDiagnostic(diagnosticMessages.Found_1_error_Watching_for_file_changes));
        }
        else {
            receiver.reportWatchStatus(NewCompilerDiagnostic(diagnosticMessages.Found_0_errors_Watching_for_file_changes, errorCount));
        }
        return true;
    }
    if (receiver.configHasErrors) {
        receiver.configModified = true;
    }
    receiver.configHasErrors = false;
    receiver.configFilePaths = [receiver.configFileName, ...ParsedCommandLine_ExtendedSourceFiles(configParseResult)];
    // reflect.DeepEqual equivalent: compare ParsedConfig by JSON equality
    if (JSON.stringify(receiver.config.ParsedConfig) !== JSON.stringify(configParseResult.ParsedConfig)) {
        receiver.configModified = true;
    }
    receiver.config = configParseResult;
    receiver.extendedConfigCache = extendedConfigCache;
    return false;
}
//# sourceMappingURL=watcher.js.map