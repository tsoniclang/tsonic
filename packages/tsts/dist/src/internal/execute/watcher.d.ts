import type { bool, int } from "../../go/scalars.js";
import type { GoChan, GoError, GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { Context } from "../../go/context.js";
import type { Closer, Writer } from "../../go/io.js";
import type { Mutex } from "../../go/sync.js";
import type { Time } from "../../go/time.js";
import type { SourceFile } from "../ast/ast.js";
import type { SourceFileParseOptions } from "../ast/parseoptions.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import type { Set } from "../collections/set.js";
import type { SyncMap } from "../collections/syncmap.js";
import type { CompilerHost } from "../compiler/host.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import * as fswatch from "../fswatch/fswatch.js";
import type { ParsedCommandLine } from "../tsoptions/parsedcommandline.js";
import type { ComparePathsOptions, Path } from "../tspath/path.js";
import type { Program } from "./incremental/program.js";
import type { CommandLineTesting, CompileAndEmitResult, System, Watcher as Watcher_c5dada01 } from "./tsc/compile.js";
import type { DiagnosticReporter, DiagnosticsReporter } from "./tsc/diagnostics.js";
import { type ExtendedConfigCache } from "./tsc/extendedconfigcache.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::type::WatchBackend","kind":"type","status":"implemented","sigHash":"ad815e0a21cc8c6e319df712880e433c1539399f1e25a7f19dfce9c6e00b2bdf","bodyHash":"140f1cb5f0d22e83414406aaf8ce6533dcadc555fc9d6f0d05210ea3ebe4c5b2"}
 *
 * Go source:
 * // WatchBackend abstracts fswatch.Watcher for testing
 * WatchBackend interface {
 * 	WatchDirectory(dir string, fn fswatch.WatchCallback, recursive bool, ignore func(string) bool) (io.Closer, error)
 * }
 */
export interface WatchBackend {
    WatchDirectory(dir: string, fn: fswatch.WatchCallback, recursive: bool, ignore: (arg0: string) => bool): [Closer, GoError];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::type::commandLineTestingWithWatchBackend","kind":"type","status":"implemented","sigHash":"ce3fdfa6fd1041d540c36429ab7598ea110a0b34b4c41c5ee21bd06b6931b1fb","bodyHash":"137e9631fd866cfd3fd04363bb50f3deeaf3ac12e0d1fd879ec3029ae5a40690"}
 *
 * Go source:
 * commandLineTestingWithWatchBackend interface {
 * 	WatchBackend() WatchBackend
 * }
 */
export interface commandLineTestingWithWatchBackend {
    WatchBackend(): WatchBackend;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::type::fswatchBackend","kind":"type","status":"implemented","sigHash":"4c347ba74b1a9ce3606059fecb847ae6dcbcce6cc78bf0b328e1a7a807ba7bfd","bodyHash":"69f7acc181649aac13638c79d93289d4926f9c30e2d7a8a606d37c88d9faa772"}
 *
 * Go source:
 * fswatchBackend struct{ inner fswatch.Watcher }
 */
export interface fswatchBackend {
    inner: fswatch.Watcher;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::fswatchBackend.WatchDirectory","kind":"method","status":"implemented","sigHash":"1e3e4a824503894486b98ac403d3357b3b4eddb2002ff093ada507e03e8b11b5","bodyHash":"035eb1fd487fe5cd009cc0166ef458a50a3805beb467f22af346c73ffb4c5fa0"}
 *
 * Go source:
 * func (b *fswatchBackend) WatchDirectory(dir string, fn fswatch.WatchCallback, recursive bool, ignore func(string) bool) (io.Closer, error) {
 * 	var opts []fswatch.WatchOption
 * 	if recursive {
 * 		opts = append(opts, fswatch.WithRecursive())
 * 	}
 * 	if ignore != nil {
 * 		opts = append(opts, fswatch.WithIgnore(ignore))
 * 	}
 * 	return b.inner.WatchDirectory(dir, fn, opts...)
 * }
 */
export declare function fswatchBackend_WatchDirectory(receiver: GoPtr<fswatchBackend>, dir: string, fn: fswatch.WatchCallback, recursive: bool, ignore: (arg0: string) => bool): [Closer, GoError];
export declare function fswatchBackend_as_WatchBackend(receiver: GoPtr<fswatchBackend>): WatchBackend;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::type::watchedDir","kind":"type","status":"implemented","sigHash":"529c48a4a0430446c841f0076a0da86ea53a672f4c2a8b059aea84bec0285889","bodyHash":"c244ad3d279d5734f2d9a7322393c36e7d75e4e4e09087d8b04238de4f336cf9"}
 *
 * Go source:
 * watchedDir struct {
 * 	closer    io.Closer
 * 	recursive bool
 * }
 */
export interface watchedDir {
    closer: Closer;
    recursive: bool;
}
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
    cache: GoPtr<SyncMap<Path, GoPtr<cachedSourceFile>>>;
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
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::type::Watcher","kind":"type","status":"implemented","sigHash":"3c7720db1dd07fc5ed867242203119169d9e8b287c5f9fa9070d8b37e7c6e4e8","bodyHash":"29d3af1861e35e18a7e98592483d25451028be1a2bc29ccf1b340aff188129bb"}
 *
 * Go source:
 * Watcher struct {
 * 	mu                             sync.Mutex
 * 	sys                            tsc.System
 * 	configFileName                 string
 * 	config                         *tsoptions.ParsedCommandLine
 * 	compilerOptionsFromCommandLine *core.CompilerOptions
 * 	commandLineRaw                 *collections.OrderedMap[string, any]
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
 *
 * 	backend      WatchBackend
 * 	watchedDirs  map[string]*watchedDir        // dir path → watch state
 * 	seenFiles    *collections.Set[tspath.Path] // all build dependencies (for event filtering)
 * 	configMtimes map[string]time.Time
 * 	doCycleCh    chan struct{}
 * 	debugLog     io.Writer // nil = silent; set via TS_WATCH_DEBUG
 *
 * 	changedMu       sync.Mutex
 * 	changedPaths    map[string]fswatch.EventKind // event path → last event kind
 * 	changedOverflow bool                         // true on ErrOverflow; forces full scan fallback
 * }
 */
export interface Watcher {
    mu: Mutex;
    sys: System;
    configFileName: string;
    config: GoPtr<ParsedCommandLine>;
    compilerOptionsFromCommandLine: GoPtr<CompilerOptions>;
    commandLineRaw: GoPtr<OrderedMap<string, unknown>>;
    reportDiagnostic: DiagnosticReporter;
    reportErrorSummary: DiagnosticsReporter;
    reportWatchStatus: DiagnosticReporter;
    testing: CommandLineTesting | undefined;
    program: GoPtr<Program>;
    extendedConfigCache: GoPtr<ExtendedConfigCache>;
    configModified: bool;
    configHasErrors: bool;
    configFilePaths: GoSlice<string>;
    sourceFileCache: GoPtr<SyncMap<Path, GoPtr<cachedSourceFile>>>;
    backend: WatchBackend | undefined;
    watchedDirs: GoMap<string, GoPtr<watchedDir>>;
    seenFiles: GoPtr<Set<Path>>;
    configMtimes: GoMap<string, Time>;
    doCycleCh: GoChan<{
        readonly __tsgoEmpty?: never;
    }, "bidirectional">;
    debugLog: Writer | undefined;
    changedMu: Mutex;
    changedPaths: GoMap<string, fswatch.EventKind> | undefined;
    changedOverflow: bool;
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
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::func::createWatcher","kind":"func","status":"implemented","sigHash":"0bd5b51e65f4826577017b4b24ad4ee240e6a42a38f2d93cc31bd1a9a18b236a","bodyHash":"12870c9f290fa1cd7fc36df04ca12aa36715870782b08ed80decd22d5e80ecfc"}
 *
 * Go source:
 * func createWatcher(
 * 	sys tsc.System,
 * 	configParseResult *tsoptions.ParsedCommandLine,
 * 	compilerOptionsFromCommandLine *core.CompilerOptions,
 * 	commandLineRaw *collections.OrderedMap[string, any],
 * 	reportDiagnostic tsc.DiagnosticReporter,
 * 	reportErrorSummary tsc.DiagnosticsReporter,
 * 	testing tsc.CommandLineTesting,
 * ) *Watcher {
 * 	w := &Watcher{
 * 		sys:                            sys,
 * 		config:                         configParseResult,
 * 		compilerOptionsFromCommandLine: compilerOptionsFromCommandLine,
 * 		commandLineRaw:                 commandLineRaw,
 * 		reportDiagnostic:               reportDiagnostic,
 * 		reportErrorSummary:             reportErrorSummary,
 * 		reportWatchStatus:              tsc.CreateWatchStatusReporter(sys, configParseResult.Locale(), configParseResult.CompilerOptions(), testing),
 * 		testing:                        testing,
 * 		sourceFileCache:                &collections.SyncMap[tspath.Path, *cachedSourceFile]{},
 * 		doCycleCh:                      make(chan struct{}, 1),
 * 		watchedDirs:                    make(map[string]*watchedDir),
 * 	}
 * 	if configParseResult.ConfigFile != nil {
 * 		w.configFileName = configParseResult.ConfigFile.SourceFile.FileName()
 * 	}
 * 	if t, ok := testing.(commandLineTestingWithWatchBackend); ok {
 * 		w.backend = t.WatchBackend()
 * 	}
 * 	return w
 * }
 */
export declare function createWatcher(sys: System, configParseResult: GoPtr<ParsedCommandLine>, compilerOptionsFromCommandLine: GoPtr<CompilerOptions>, commandLineRaw: GoPtr<OrderedMap<string, unknown>>, reportDiagnostic: DiagnosticReporter, reportErrorSummary: DiagnosticsReporter, testing: CommandLineTesting | undefined): GoPtr<Watcher>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.start","kind":"method","status":"implemented","sigHash":"7d0d0436308235fb0f443515a52ee9c102c605640ee9215d0bc93ddd23182af2","bodyHash":"1d6146ad9385b2dd815d6531cc58bb06ed26f98dff26b6f7bdf03c7df02f47ef"}
 *
 * Go source:
 * func (w *Watcher) start(ctx context.Context) {
 * 	w.mu.Lock()
 * 	w.extendedConfigCache = &tsc.ExtendedConfigCache{}
 * 	host := compiler.NewCompilerHost(w.sys.GetCurrentDirectory(), w.sys.FS(), w.sys.DefaultLibraryPath(), w.extendedConfigCache, getTraceFromSys(w.sys, w.config.Locale(), w.testing))
 * 	w.program = incremental.ReadBuildInfoProgram(w.config, incremental.NewBuildInfoReader(host), host)
 *
 * 	if w.configFileName != "" {
 * 		w.configFilePaths = append([]string{w.configFileName}, w.config.ExtendedSourceFiles()...)
 * 	}
 *
 * 	if w.sys.GetEnvironmentVariable("TS_WATCH_DEBUG") != "" {
 * 		w.debugLog = w.sys.Writer()
 * 	}
 *
 * 	if w.testing == nil && w.backend == nil {
 * 		fsw := fswatch.Default()
 * 		w.backend = &fswatchBackend{inner: fsw}
 * 		if w.debugLog != nil {
 * 			fmt.Fprintf(w.debugLog, "[watch] using %s backend\n", fsw.Name())
 * 		}
 * 	}
 *
 * 	w.reportWatchStatus(ast.NewCompilerDiagnostic(diagnostics.Starting_compilation_in_watch_mode))
 * 	w.doBuild()
 * 	w.mu.Unlock()
 *
 * 	if w.testing == nil {
 * 		for {
 * 			select {
 * 			case <-ctx.Done():
 * 				w.closeAllWatches()
 * 				return
 * 			case <-w.doCycleCh:
 * 				w.DoCycle()
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Watcher_start(receiver: GoPtr<Watcher>, ctx: Context): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.computeDesiredWatches","kind":"method","status":"implemented","sigHash":"b44015b60ec8bb6c2989049374eef0e2dc35e20035b82454b3be8ddf5e89dd4b","bodyHash":"b7232318ed6edf349bfa307c6507c6d4fbd260ac0c9eea37bad99b32362c984b"}
 *
 * Go source:
 * func (w *Watcher) computeDesiredWatches(seenFilePaths []string) map[string]bool {
 * 	cwd := w.sys.GetCurrentDirectory()
 *
 * 	desiredDirs := make(map[string]bool) // dir → recursive
 *
 * 	// Wildcard directories from tsconfig (recursive or non-recursive)
 * 	if w.config.ConfigFile != nil {
 * 		for dir, recursive := range w.config.WildcardDirectories() {
 * 			realDir := w.sys.FS().Realpath(dir)
 * 			desiredDirs[realDir] = recursive
 * 		}
 * 	}
 *
 * 	// For no-config CLI mode, ensure CWD is watched
 * 	if w.config.ConfigFile == nil && len(desiredDirs) == 0 {
 * 		dir := w.sys.FS().Realpath(cwd)
 * 		desiredDirs[dir] = false
 * 	}
 *
 * 	// Config file parent directories as non-recursive watches
 * 	for _, cfgPath := range w.configFilePaths {
 * 		realPath := w.sys.FS().Realpath(cfgPath)
 * 		dir := tspath.GetDirectoryPath(realPath)
 * 		if _, has := desiredDirs[dir]; !has {
 * 			desiredDirs[dir] = false
 * 		}
 * 	}
 *
 * 	// For no-config CLI mode, also watch the CLI-specified files' directories
 * 	if w.config.ConfigFile == nil {
 * 		for _, fileName := range w.config.FileNames() {
 * 			absPath := tspath.GetNormalizedAbsolutePath(fileName, cwd)
 * 			realPath := w.sys.FS().Realpath(absPath)
 * 			dir := tspath.GetDirectoryPath(realPath)
 * 			if _, has := desiredDirs[dir]; !has {
 * 				desiredDirs[dir] = false
 * 			}
 * 		}
 * 	}
 *
 * 	// Add parent directories for seen files not covered by existing dir watches.
 * 	// Resolve ancestor fallbacks first so coverage checks use final dirs.
 * 	resolvedDirs := w.resolveDesiredDirs(desiredDirs)
 *
 * 	opts := w.comparePathsOptions()
 * 	for _, filePath := range seenFilePaths {
 * 		dir := tspath.GetDirectoryPath(filePath)
 * 		covered := false
 * 		for wdir, recursive := range resolvedDirs {
 * 			if recursive {
 * 				if tspath.ContainsPath(wdir, dir, opts) {
 * 					covered = true
 * 					break
 * 				}
 * 			} else if dir == wdir {
 * 				covered = true
 * 				break
 * 			}
 * 		}
 * 		if !covered {
 * 			if canWatchDirectory(dir) {
 * 				resolvedDirs[dir] = false
 * 			}
 * 		}
 * 	}
 *
 * 	// Re-resolve in case newly added dirs don't exist
 * 	return w.resolveDesiredDirs(resolvedDirs)
 * }
 */
export declare function Watcher_computeDesiredWatches(receiver: GoPtr<Watcher>, seenFilePaths: GoSlice<string>): GoMap<string, bool>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.reconcileWatches","kind":"method","status":"implemented","sigHash":"137684afd9741e7134f6b7367a524bdfc78450ce2b819d8a77f9e7c3ae6e7b83","bodyHash":"2272d744fb0cf1b4e8f79f108fef62b8a47996f195c66b8e293dc5455b2e24ea"}
 *
 * Go source:
 * func (w *Watcher) reconcileWatches(seenFilePaths []string) {
 * 	if w.backend == nil {
 * 		return
 * 	}
 *
 * 	desiredDirs := w.computeDesiredWatches(seenFilePaths)
 *
 * 	// Reconcile directory watches using DiffMaps, performing effects inline
 * 	core.DiffMapsFunc(
 * 		w.watchedDirs,
 * 		desiredDirs,
 * 		func(wd *watchedDir, recursive bool) bool { return wd.recursive == recursive },
 * 		func(dir string, recursive bool) {
 * 			if w.debugLog != nil {
 * 				fmt.Fprintf(w.debugLog, "[watch] watching directory %s (recursive=%v)\n", dir, recursive)
 * 			}
 * 			w.createDirWatch(dir, recursive)
 * 		},
 * 		func(dir string, wd *watchedDir) {
 * 			if w.debugLog != nil {
 * 				fmt.Fprintf(w.debugLog, "[watch] closing stale dir watch: %s\n", dir)
 * 			}
 * 			wd.closer.Close()
 * 			delete(w.watchedDirs, dir)
 * 		},
 * 		func(dir string, wd *watchedDir, recursive bool) {
 * 			if w.debugLog != nil {
 * 				fmt.Fprintf(w.debugLog, "[watch] recreating dir watch %s (recursive %v→%v)\n", dir, wd.recursive, recursive)
 * 			}
 * 			wd.closer.Close()
 * 			delete(w.watchedDirs, dir)
 * 			w.createDirWatch(dir, recursive)
 * 		},
 * 	)
 * }
 */
export declare function Watcher_reconcileWatches(receiver: GoPtr<Watcher>, seenFilePaths: GoSlice<string>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.comparePathsOptions","kind":"method","status":"implemented","sigHash":"41c4a990b40652573eb143e5f1e5686d1c9e6ae0eda2b5cf2d34f1010a7f007e","bodyHash":"ff700a4d73c489098be768d356863b939ba23dc58baf3411cf90b5e83cfdd22b"}
 *
 * Go source:
 * func (w *Watcher) comparePathsOptions() tspath.ComparePathsOptions {
 * 	return tspath.ComparePathsOptions{
 * 		UseCaseSensitiveFileNames: w.sys.FS().UseCaseSensitiveFileNames(),
 * 		CurrentDirectory:          w.sys.GetCurrentDirectory(),
 * 	}
 * }
 */
export declare function Watcher_comparePathsOptions(receiver: GoPtr<Watcher>): ComparePathsOptions;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.resolveDesiredDirs","kind":"method","status":"implemented","sigHash":"42a27531bac61ec64b473542421b8be19da4b6ef3fbb6013172ec8efa554c777","bodyHash":"ca9a11a7c24ca3aef43a1abc540daf582ce70c4a81afe279be1c30eb8064d16a"}
 *
 * Go source:
 * func (w *Watcher) resolveDesiredDirs(desiredDirs map[string]bool) map[string]bool {
 * 	resolved := make(map[string]bool, len(desiredDirs))
 * 	for dir, recursive := range desiredDirs {
 * 		watchDir := dir
 * 		watchRecursive := recursive
 * 		for !w.sys.FS().DirectoryExists(watchDir) {
 * 			parent := tspath.GetDirectoryPath(watchDir)
 * 			if parent == watchDir {
 * 				break
 * 			}
 * 			watchDir = parent
 * 			watchRecursive = false // ancestor fallbacks are always non-recursive
 * 		}
 * 		if !w.sys.FS().DirectoryExists(watchDir) || !canWatchDirectory(watchDir) {
 * 			if w.debugLog != nil {
 * 				fmt.Fprintf(w.debugLog, "[watch] no watchable ancestor for %s\n", dir)
 * 			}
 * 			continue
 * 		}
 * 		if watchDir != dir && w.debugLog != nil {
 * 			fmt.Fprintf(w.debugLog, "[watch] resolved %s to ancestor %s\n", dir, watchDir)
 * 		}
 * 		if existing, has := resolved[watchDir]; has {
 * 			resolved[watchDir] = existing || watchRecursive
 * 		} else {
 * 			resolved[watchDir] = watchRecursive
 * 		}
 * 	}
 * 	return resolved
 * }
 */
export declare function Watcher_resolveDesiredDirs(receiver: GoPtr<Watcher>, desiredDirs: GoMap<string, bool>): GoMap<string, bool>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::func::canWatchDirectory","kind":"func","status":"implemented","sigHash":"9b407958cdee916eaa92b71c4db58447654dab7359159902e942bd83d188804c","bodyHash":"0590d0287fb40e03524e7d5fe569c0700de58832d5ae4f17a2c57e69bd7279be"}
 *
 * Go source:
 * func canWatchDirectory(dir string) bool {
 * 	components := tspath.GetPathComponents(dir, "")
 * 	length := len(components)
 * 	if length <= 2 {
 * 		return false
 * 	}
 * 	rootLength := perceivedOsRootLengthForWatching(components)
 * 	return length > rootLength+1
 * }
 */
export declare function canWatchDirectory(dir: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::func::perceivedOsRootLengthForWatching","kind":"func","status":"implemented","sigHash":"0a756a7b4b3f8237148a2a833a8ceeb1bb3d7abdcb881f95bda0d76439e68189","bodyHash":"2d58ed7b4a09facf22ce5587d9706f862f7898ba4f5a0f783570353f16fa9db3"}
 *
 * Go source:
 * func perceivedOsRootLengthForWatching(components []string) int {
 * 	length := len(components)
 * 	if length <= 1 {
 * 		return 1
 * 	}
 * 	root := components[0]
 * 	indexAfterOsRoot := 1
 * 	isDosStyle := len(root) >= 2 && tspath.IsVolumeCharacter(root[0]) && root[1] == ':'
 *
 * 	if root != "/" && !isDosStyle && len(components) > 1 {
 * 		// Check for UNC-like paths: //server/c$/...
 * 		if len(components[1]) >= 2 && tspath.IsVolumeCharacter(components[1][0]) && strings.HasSuffix(components[1], "$") {
 * 			if length == 2 {
 * 				return 2
 * 			}
 * 			indexAfterOsRoot = 2
 * 			isDosStyle = true
 * 		}
 * 	}
 *
 * 	if isDosStyle && (indexAfterOsRoot >= length || !strings.EqualFold(components[indexAfterOsRoot], "users")) {
 * 		return indexAfterOsRoot
 * 	}
 *
 * 	if indexAfterOsRoot < length && strings.EqualFold(components[indexAfterOsRoot], "workspaces") {
 * 		// Codespaces: /workspaces repos are hoisted here
 * 		return indexAfterOsRoot + 1
 * 	}
 *
 * 	// /home/username or C:/Users/username
 * 	return indexAfterOsRoot + 2
 * }
 */
export declare function perceivedOsRootLengthForWatching(components: GoSlice<string>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.createDirWatch","kind":"method","status":"implemented","sigHash":"58cec7fc79659b13bfe29319f0dd80bfb0e0eaa18948db37177b57964db4b257","bodyHash":"942ffd8baafd15198e88bb383d78a2ae2dae2646e2bc48807d66223725f40bde"}
 *
 * Go source:
 * func (w *Watcher) createDirWatch(dir string, recursive bool) {
 * 	entry := &watchedDir{recursive: recursive}
 * 	cb := func(events []fswatch.Event, err error) {
 * 		if err != nil && errors.Is(err, fswatch.ErrWatchTerminated) {
 * 			w.handleWatchTerminated(dir, entry)
 * 			return
 * 		}
 * 		w.onWatchEvents(events, err)
 * 	}
 * 	watch, err := w.backend.WatchDirectory(dir, cb, recursive, shouldIgnoreWatchPath)
 * 	if err != nil {
 * 		if w.debugLog != nil {
 * 			fmt.Fprintf(w.debugLog, "[watch] failed to watch directory %s: %v\n", dir, err)
 * 		}
 * 		return
 * 	}
 * 	entry.closer = watch
 * 	w.watchedDirs[dir] = entry
 * }
 */
export declare function Watcher_createDirWatch(receiver: GoPtr<Watcher>, dir: string, recursive: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.closeAllWatches","kind":"method","status":"implemented","sigHash":"88e992a9cf8215b8c85b86d0e6c7aa6b18468604d7b34c5fb5b7a18d32ddef6c","bodyHash":"a018498e91e84a7d217cc56b2a271e5eb225d19b8364e6e9e8997a2d6aa2706a"}
 *
 * Go source:
 * func (w *Watcher) closeAllWatches() {
 * 	w.mu.Lock()
 * 	dirs := make([]io.Closer, 0, len(w.watchedDirs))
 * 	for dir, wd := range w.watchedDirs {
 * 		dirs = append(dirs, wd.closer)
 * 		delete(w.watchedDirs, dir)
 * 	}
 * 	w.mu.Unlock()
 * 	for _, c := range dirs {
 * 		c.Close()
 * 	}
 * }
 */
export declare function Watcher_closeAllWatches(receiver: GoPtr<Watcher>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.handleWatchTerminated","kind":"method","status":"implemented","sigHash":"8a29d4b82f74421af716ae88d1e770b4718e497fdf30def070ebacf188a6cb80","bodyHash":"a4ede80b727cc110f679d98b6fc40ede4cf5a327cc7f1511e24a5a9cfff377c7"}
 *
 * Go source:
 * func (w *Watcher) handleWatchTerminated(dir string, identity *watchedDir) {
 * 	if w.debugLog != nil {
 * 		fmt.Fprintf(w.debugLog, "[watch] watch terminated: %s\n", dir)
 * 	}
 * 	var staleCloser io.Closer
 * 	w.mu.Lock()
 * 	if wd, ok := w.watchedDirs[dir]; ok && wd == identity {
 * 		staleCloser = wd.closer
 * 		delete(w.watchedDirs, dir)
 * 	}
 * 	w.mu.Unlock()
 * 	if staleCloser != nil {
 * 		staleCloser.Close()
 * 	}
 * 	w.changedMu.Lock()
 * 	w.changedOverflow = true
 * 	w.changedMu.Unlock()
 * 	w.signalDoCycle()
 * }
 */
export declare function Watcher_handleWatchTerminated(receiver: GoPtr<Watcher>, dir: string, identity: GoPtr<watchedDir>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::func::shouldIgnoreWatchPath","kind":"func","status":"implemented","sigHash":"99b41dd7f9360b314b755ae9685dc59602023d663ffb8debfd99cd66932f6b3c","bodyHash":"5593f72449e9b936346ee47630dd22d81040fd753c14318a1c92ed4d1b833516"}
 *
 * Go source:
 * func shouldIgnoreWatchPath(path string) bool {
 * 	p := tspath.NormalizeSlashes(path)
 * 	return strings.HasSuffix(p, "/.git") ||
 * 		strings.Contains(p, "/.git/") ||
 * 		strings.Contains(p, "/node_modules/.") ||
 * 		strings.Contains(p, "/.#")
 * }
 */
export declare function shouldIgnoreWatchPath(path: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.onWatchEvents","kind":"method","status":"implemented","sigHash":"8ebbd994d903dee6830477ee58cbca30213f25fe1345249b77ed238988f35ce6","bodyHash":"e927117d4b007639cab72161239fb7c75d59256c35b8643961ecfdd94da9bcad"}
 *
 * Go source:
 * func (w *Watcher) onWatchEvents(events []fswatch.Event, err error) {
 * 	if err != nil {
 * 		if errors.Is(err, fswatch.ErrOverflow) {
 * 			if w.debugLog != nil {
 * 				fmt.Fprintf(w.debugLog, "[watch] event overflow, triggering rebuild\n")
 * 			}
 * 			w.changedMu.Lock()
 * 			w.changedOverflow = true
 * 			w.changedMu.Unlock()
 * 			w.signalDoCycle()
 * 			return
 * 		}
 * 		fmt.Fprintf(w.sys.Writer(), "Warning: File watch error: %v\n", err)
 * 		return
 * 	}
 *
 * 	if len(events) > 0 {
 * 		if w.debugLog != nil {
 * 			fmt.Fprintf(w.debugLog, "[watch] %d event(s): ", len(events))
 * 			for i, e := range events {
 * 				if i > 0 {
 * 					fmt.Fprint(w.debugLog, ", ")
 * 				}
 * 				if i >= 5 {
 * 					fmt.Fprintf(w.debugLog, "... and %d more", len(events)-i)
 * 					break
 * 				}
 * 				fmt.Fprintf(w.debugLog, "%s %s", e.Kind, e.Path)
 * 			}
 * 			fmt.Fprintln(w.debugLog)
 * 		}
 * 		w.changedMu.Lock()
 * 		if w.changedPaths == nil {
 * 			w.changedPaths = make(map[string]fswatch.EventKind, len(events))
 * 		}
 * 		for _, e := range events {
 * 			w.changedPaths[e.Path] = e.Kind
 * 		}
 * 		w.changedMu.Unlock()
 * 		w.signalDoCycle()
 * 	}
 * }
 */
export declare function Watcher_onWatchEvents(receiver: GoPtr<Watcher>, events: GoSlice<fswatch.Event>, err: GoError): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.signalDoCycle","kind":"method","status":"implemented","sigHash":"4021f870ed90e2e1da20d6bac83c8132eefef29df54e299f9b2b0cfc04adde13","bodyHash":"1ccb56100d9336cffd40388f93ab5d831267f684ab7459f2d714f4b54bf102d8"}
 *
 * Go source:
 * func (w *Watcher) signalDoCycle() {
 * 	select {
 * 	case w.doCycleCh <- struct{}{}:
 * 		// Signal sent; the DoCycle loop will pick it up.
 * 	default:
 * 		// A signal is already pending; coalesced.
 * 	}
 * }
 */
export declare function Watcher_signalDoCycle(receiver: GoPtr<Watcher>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.DoCycle","kind":"method","status":"implemented","sigHash":"ecaa47d3f54ab539ad5ba3eede04da38c22c27e5a87413f26108fe746bc7bbcc","bodyHash":"8dbc08d1ff9c8b85693ac0b87a02fd666d8f9edc0ada33f02242a0e09c3e8a65"}
 *
 * Go source:
 * func (w *Watcher) DoCycle() {
 * 	w.mu.Lock()
 * 	defer w.mu.Unlock()
 *
 * 	w.changedMu.Lock()
 * 	changedPaths := w.changedPaths
 * 	overflow := w.changedOverflow
 * 	w.changedPaths = nil
 * 	w.changedOverflow = false
 * 	w.changedMu.Unlock()
 *
 * 	hasEvents := len(changedPaths) > 0 || overflow
 *
 * 	if w.recheckTsConfig() {
 * 		return
 * 	}
 *
 * 	if hasEvents && !overflow && !w.configModified {
 * 		// Filter fswatch events against known dependencies
 * 		if w.isRelevantChange(changedPaths) {
 * 			w.evictChangedSourceFiles(changedPaths)
 * 		} else {
 * 			if w.debugLog != nil {
 * 				fmt.Fprintf(w.debugLog, "[watch] DoCycle: %d event(s) not relevant to compilation, skipping rebuild\n", len(changedPaths))
 * 			}
 * 			if w.testing != nil {
 * 				w.testing.OnProgram(w.program)
 * 			}
 * 			return
 * 		}
 * 	} else if overflow {
 * 		// Overflow: evict the entire source file cache to force re-build
 * 		w.sourceFileCache = &collections.SyncMap[tspath.Path, *cachedSourceFile]{}
 * 	} else if !hasEvents && !w.configModified {
 * 		// No events and no config change
 * 		if w.debugLog != nil {
 * 			fmt.Fprintf(w.debugLog, "[watch] DoCycle: no events, skipping\n")
 * 		}
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
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.isRelevantChange","kind":"method","status":"implemented","sigHash":"0f930cb42f5edbd2c4bce9cc84482df324a0ca9dedcb8a19442d8c5f56636dad","bodyHash":"23923f0fcd05048ff1fac7d347faf4e8e576b0ece4fd7f3daf43bc5c9c823be8"}
 *
 * Go source:
 * func (w *Watcher) isRelevantChange(changedPaths map[string]fswatch.EventKind) bool {
 * 	caseSensitive := w.sys.FS().UseCaseSensitiveFileNames()
 * 	cwd := w.sys.GetCurrentDirectory()
 * 	opts := w.comparePathsOptions()
 * 	for eventPath := range changedPaths {
 * 		p := tspath.ToPath(eventPath, cwd, caseSensitive)
 * 		if w.seenFiles.Has(p) {
 * 			return true
 * 		}
 * 		if w.config.ConfigFile != nil && w.config.PossiblyMatchesFileName(eventPath) {
 * 			return true
 * 		}
 * 		if w.config.ConfigFile != nil && w.config.PossiblyMatchesDirectoryName(p) {
 * 			return true
 * 		}
 * 		// If a directory was created under an ancestor fallback watch,
 * 		// treat it as relevant — it may be on the path to a previously
 * 		// non-existent directory we want to watch. Err on the side of
 * 		// false positives (unnecessary rebuild) over false negatives
 * 		// (missed rebuild).
 * 		if w.sys.FS().DirectoryExists(eventPath) {
 * 			for dir := range w.watchedDirs {
 * 				if tspath.ContainsPath(dir, eventPath, opts) {
 * 					return true
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Watcher_isRelevantChange(receiver: GoPtr<Watcher>, changedPaths: GoMap<string, fswatch.EventKind>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.doBuild","kind":"method","status":"implemented","sigHash":"9112331ae73eb271a810b6712651b29a463e2b35ea14864fcb6a363346b592b7","bodyHash":"697edaf268e701477e520d63ceb93b762273cdc1602acda5a6b09ed9ae325014"}
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
 *
 * 	caseSensitive := w.sys.FS().UseCaseSensitiveFileNames()
 * 	cwd := w.sys.GetCurrentDirectory()
 * 	seenSlice := tfs.SeenFiles.ToSlice()
 * 	w.seenFiles = collections.NewSetWithSizeHint[tspath.Path](len(seenSlice))
 * 	for _, p := range seenSlice {
 * 		w.seenFiles.Add(tspath.ToPath(p, cwd, caseSensitive))
 * 	}
 *
 * 	w.configMtimes = make(map[string]time.Time, len(w.configFilePaths))
 * 	for _, cfgPath := range w.configFilePaths {
 * 		if s := w.sys.FS().Stat(cfgPath); s != nil {
 * 			w.configMtimes[cfgPath] = s.ModTime()
 * 		}
 * 	}
 *
 * 	w.reconcileWatches(seenSlice)
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
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.evictChangedSourceFiles","kind":"method","status":"implemented","sigHash":"e60b9c7673f470e0f11a958a772036134c4eb21fdb7d17d65e1dedcbb8d7ad7a","bodyHash":"16cd4d44ca6c88761e74a3ed933121675d98ee336d0b1be7a8a61b5efb5fa4b5"}
 *
 * Go source:
 * func (w *Watcher) evictChangedSourceFiles(changedPaths map[string]fswatch.EventKind) {
 * 	caseSensitive := w.sys.FS().UseCaseSensitiveFileNames()
 * 	cwd := w.sys.GetCurrentDirectory()
 * 	for eventPath := range changedPaths {
 * 		p := tspath.ToPath(eventPath, cwd, caseSensitive)
 * 		if _, ok := w.sourceFileCache.Load(p); ok {
 * 			if w.debugLog != nil {
 * 				fmt.Fprintf(w.debugLog, "[watch] evicting cached source file: %s\n", p)
 * 			}
 * 			w.sourceFileCache.Delete(p)
 * 		}
 * 	}
 * }
 */
export declare function Watcher_evictChangedSourceFiles(receiver: GoPtr<Watcher>, changedPaths: GoMap<string, fswatch.EventKind>): void;
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
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.recheckTsConfig","kind":"method","status":"implemented","sigHash":"6fcb7c239a4aa41c93efb434f155a2dfc180916e73693d437db374172661ebf5","bodyHash":"d32e511a3f4d76788abd9de731e4f618fa6ff79fa98f62e8d4fe56854dbb119b"}
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
 * 			oldMtime, ok := w.configMtimes[path]
 * 			s := w.sys.FS().Stat(path)
 * 			if !ok {
 * 				if s != nil {
 * 					changed = true
 * 					break
 * 				}
 * 			} else if s == nil || !s.ModTime().Equal(oldMtime) {
 * 				changed = true
 * 				break
 * 			}
 * 		}
 * 		if !changed {
 * 			return false
 * 		}
 * 	}
 *
 * 	configParseResult := w.parseConfigFile()
 * 	if configParseResult == nil {
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
 * 	return false
 * }
 */
export declare function Watcher_recheckTsConfig(receiver: GoPtr<Watcher>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/watcher.go::method::Watcher.parseConfigFile","kind":"method","status":"implemented","sigHash":"2bea31445687e678bd54f1ec1577c8eb6232268ad1a233bf0cbec7c989badd5a","bodyHash":"0366d768d3f9ebb43f96e1876f1a72df85f5e8a4a5f42996a3b72c9ad7158a6d"}
 *
 * Go source:
 * func (w *Watcher) parseConfigFile() *tsoptions.ParsedCommandLine {
 * 	extendedConfigCache := &tsc.ExtendedConfigCache{}
 * 	configParseResult, errors := tsoptions.GetParsedCommandLineOfConfigFile(w.configFileName, w.compilerOptionsFromCommandLine, w.commandLineRaw, w.sys, extendedConfigCache)
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
 * 		return nil
 * 	}
 * 	w.extendedConfigCache = extendedConfigCache
 * 	return configParseResult
 * }
 */
export declare function Watcher_parseConfigFile(receiver: GoPtr<Watcher>): GoPtr<ParsedCommandLine>;
//# sourceMappingURL=watcher.d.ts.map