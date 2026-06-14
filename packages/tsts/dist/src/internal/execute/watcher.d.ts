import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { Mutex } from "../../go/sync.js";
import type { Time } from "../../go/time.js";
import type { SourceFile } from "../ast/ast.js";
import type { SourceFileParseOptions } from "../ast/parseoptions.js";
import type { SyncMap } from "../collections/syncmap.js";
import type { CompilerHost } from "../compiler/host.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import type { ParsedCommandLine } from "../tsoptions/parsedcommandline.js";
import type { FileWatcher } from "../vfs/vfswatch/vfswatch.js";
import type { Program } from "./incremental/program.js";
import type { CommandLineTesting, CompileAndEmitResult, System, Watcher as Watcher_c5dada01 } from "./tsc/compile.js";
import type { DiagnosticReporter, DiagnosticsReporter } from "./tsc/diagnostics.js";
import { type ExtendedConfigCache } from "./tsc/extendedconfigcache.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::type::cachedSourceFile","kind":"type","status":"implemented","sigHash":"09687ae4d0bc82215aab8c91746d0029f4280a603b1e1c93497af1183820b31d","bodyHash":"d8cbeff6207c7c328d055bc4a712ff6c00e4ab0b726cdd0ec198ed1ff9651acb"}
 *
 * Go source:
 * cachedSourceFile struct {
 * 	file    *ast.SourceFile
 * 	modTime time.Time
 * }
 */
export interface cachedSourceFile {
    file: GoPtr<SourceFile>;
    modTime: Time;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::type::watchCompilerHost","kind":"type","status":"implemented","sigHash":"eb3c7200342a1a34fb91c95ca7076a8eda6eed0a985019ec60d54bfd7b9cc291","bodyHash":"ce7346e77b8cb4af4af48914b1cf6e56cef5dd98bd01b2e97738d8dd431b7677"}
 *
 * Go source:
 * watchCompilerHost struct {
 * 	compiler.CompilerHost
 * 	cache *collections.SyncMap[tspath.Path, *cachedSourceFile]
 * }
 */
export interface watchCompilerHost {
    readonly __tsgoEmbedded0?: CompilerHost;
    cache: GoPtr<SyncMap>;
}
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
export declare function watchCompilerHost_GetSourceFile(receiver: GoPtr<watchCompilerHost>, opts: SourceFileParseOptions): GoPtr<SourceFile>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::type::Watcher","kind":"type","status":"implemented","sigHash":"3c7720db1dd07fc5ed867242203119169d9e8b287c5f9fa9070d8b37e7c6e4e8","bodyHash":"ff8d52e8d6e5f0793b96008b45fa9eb4687e9208a5773fb631e1160d7b8811de"}
 *
 * Go source:
 * Watcher struct {
 * 	mu                             sync.Mutex
 * 	sys                            tsc.System
 * 	configFileName                 string
 * 	config                         *tsoptions.ParsedCommandLine
 * 	compilerOptionsFromCommandLine *core.CompilerOptions
 * 	reportDiagnostic               tsc.DiagnosticReporter
 * 	reportErrorSummary             tsc.DiagnosticsReporter
 * 	reportWatchStatus              tsc.DiagnosticReporter
 * 	testing                        tsc.CommandLineTesting
 *
 * 	program             *incremental.Program
 * 	extendedConfigCache *tsc.ExtendedConfigCache
 * 	configModified      bool
 * 	configHasErrors     bool
 * 	configFilePaths     []string
 *
 * 	sourceFileCache *collections.SyncMap[tspath.Path, *cachedSourceFile]
 * 	fileWatcher     *vfswatch.FileWatcher
 * }
 */
export interface Watcher {
    mu: Mutex;
    sys: System;
    configFileName: string;
    config: GoPtr<ParsedCommandLine>;
    compilerOptionsFromCommandLine: GoPtr<CompilerOptions>;
    reportDiagnostic: DiagnosticReporter;
    reportErrorSummary: DiagnosticsReporter;
    reportWatchStatus: DiagnosticReporter;
    testing: CommandLineTesting | undefined;
    program: GoPtr<Program>;
    extendedConfigCache: GoPtr<ExtendedConfigCache>;
    configModified: bool;
    configHasErrors: bool;
    configFilePaths: GoSlice<string>;
    sourceFileCache: GoPtr<SyncMap>;
    fileWatcher: GoPtr<FileWatcher>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"e42466e9d55431436fd56f71ca20518e1ef306e5d2a89e987baac34aafe69adc"}
 *
 * Go source:
 * var _ tsc.Watcher = (*Watcher)(nil)
 */
export declare let __30d59bfd_0: Watcher_c5dada01;
export declare function Watcher_as_tsc_Watcher(receiver: GoPtr<Watcher>): Watcher_c5dada01;
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
export declare function createWatcher(sys: System, configParseResult: GoPtr<ParsedCommandLine>, compilerOptionsFromCommandLine: GoPtr<CompilerOptions>, reportDiagnostic: DiagnosticReporter, reportErrorSummary: DiagnosticsReporter, testing: CommandLineTesting | undefined): GoPtr<Watcher>;
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
export declare function Watcher_start(receiver: GoPtr<Watcher>): void;
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
export declare function Watcher_DoCycle(receiver: GoPtr<Watcher>): void;
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
export declare function Watcher_doBuild(receiver: GoPtr<Watcher>): void;
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
export declare function Watcher_compileAndEmit(receiver: GoPtr<Watcher>): CompileAndEmitResult;
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
export declare function Watcher_recheckTsConfig(receiver: GoPtr<Watcher>): bool;
//# sourceMappingURL=watcher.d.ts.map