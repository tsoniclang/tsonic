import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice, GoUnresolved } from "../../go/compat.js";
import { Pool, Mutex } from "../../go/sync.js";
import type { SourceFile, SourceFileMetaData } from "../ast/ast.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import type { SyncMap } from "../collections/syncmap.js";
import type { WorkGroup } from "../core/workgroup.js";
import type { ModeAwareCache } from "../module/cache.js";
import type { DiagAndArgs } from "../module/resolver.js";
import type { PackageId } from "../module/types.js";
import type { Path as Path_65a900c3 } from "../tspath/path.js";
import type { FileIncludeReason } from "./fileInclude.js";
import type { fileLoader, jsxRuntimeImportSpecifier, LibFile, processedFiles } from "./fileloader.js";
import type { includeProcessor } from "./includeprocessor.js";
import type { processingDiagnostic } from "./processingDiagnostic.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::type::parseTask","kind":"type","status":"implemented","sigHash":"b84c8bb585614968edfb61e882ab726f44a17b5de567af8dfc0e7ce09ac3dab5","bodyHash":"9037201e00d4b8ede35c542bf33697833860bf8d7e56f1f769452cde2fc18c1f"}
 *
 * Go source:
 * parseTask struct {
 * 	normalizedFilePath          string
 * 	path                        tspath.Path
 * 	file                        *ast.SourceFile
 * 	libFile                     *LibFile
 * 	redirectedParseTask         *parseTask
 * 	subTasks                    []*parseTask
 * 	loaded                      bool
 * 	startedSubTasks             bool
 * 	isForAutomaticTypeDirective bool
 * 	includeReason               *FileIncludeReason
 * 	packageId                   module.PackageId
 *
 * 	metadata                     ast.SourceFileMetaData
 * 	resolutionsInFile            module.ModeAwareCache[*module.ResolvedModule]
 * 	resolutionsTrace             []module.DiagAndArgs
 * 	typeResolutionsInFile        module.ModeAwareCache[*module.ResolvedTypeReferenceDirective]
 * 	typeResolutionsTrace         []module.DiagAndArgs
 * 	resolutionDiagnostics        []*ast.Diagnostic
 * 	processingDiagnostics        []*processingDiagnostic
 * 	importHelpersImportSpecifier *ast.StringLiteralNode
 * 	jsxRuntimeImportSpecifier    *jsxRuntimeImportSpecifier
 *
 * 	increaseDepth bool
 * 	elideOnDepth  bool
 *
 * 	loadedTask        *parseTask
 * 	allIncludeReasons []*FileIncludeReason
 * }
 */
export interface parseTask {
    normalizedFilePath: string;
    path: Path_65a900c3;
    file: GoPtr<SourceFile>;
    libFile: GoPtr<LibFile>;
    redirectedParseTask: GoPtr<parseTask>;
    subTasks: GoSlice<GoPtr<parseTask>>;
    loaded: bool;
    startedSubTasks: bool;
    isForAutomaticTypeDirective: bool;
    includeReason: GoPtr<FileIncludeReason>;
    packageId: PackageId;
    metadata: SourceFileMetaData;
    resolutionsInFile: ModeAwareCache;
    resolutionsTrace: GoSlice<DiagAndArgs>;
    typeResolutionsInFile: ModeAwareCache;
    typeResolutionsTrace: GoSlice<DiagAndArgs>;
    resolutionDiagnostics: GoSlice<GoPtr<Diagnostic>>;
    processingDiagnostics: GoSlice<GoPtr<processingDiagnostic>>;
    importHelpersImportSpecifier: GoPtr<GoUnresolved<"github.com/microsoft/typescript-go/internal/ast.StringLiteralNode">>;
    jsxRuntimeImportSpecifier: GoPtr<jsxRuntimeImportSpecifier>;
    increaseDepth: bool;
    elideOnDepth: bool;
    loadedTask: GoPtr<parseTask>;
    allIncludeReasons: GoSlice<GoPtr<FileIncludeReason>>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::method::parseTask.FileName","kind":"method","status":"implemented","sigHash":"2df8b8a351e8c1eaec0da053e2c85917b17d2df633e41cce81b55e9682a3ccd4","bodyHash":"13e3c9a23784b03ff24ed67282f2f09a63d45de1c1ef16248e2a272196185109"}
 *
 * Go source:
 * func (t *parseTask) FileName() string {
 * 	return t.normalizedFilePath
 * }
 */
export declare function parseTask_FileName(receiver: GoPtr<parseTask>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::method::parseTask.Path","kind":"method","status":"implemented","sigHash":"9062bb96bbb26b2bf4fc68b2f1bc8a97bb920cdaecc9a326b2320335e7c7fc2c","bodyHash":"4faef12947746efc5f2f2814d37afe88a9cb523ef39ef909a7abf2402b47a21b"}
 *
 * Go source:
 * func (t *parseTask) Path() tspath.Path {
 * 	return t.path
 * }
 */
export declare function parseTask_Path(receiver: GoPtr<parseTask>): Path_65a900c3;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::method::parseTask.load","kind":"method","status":"implemented","sigHash":"af7c55efe5242848312d3c1b0508d2b9ec9c78063b2547aea4383cb82d2555ac","bodyHash":"07b7219142d8ecc72292b82bd9f7692c5b2b7aee8f66b4283d2100e4795ebb9e"}
 *
 * Go source:
 * func (t *parseTask) load(loader *fileLoader) {
 * 	t.loaded = true
 * 	if t.isForAutomaticTypeDirective {
 * 		t.loadAutomaticTypeDirectives(loader)
 * 		return
 * 	}
 * 	if loader.opts.Tracing != nil {
 * 		defer loader.opts.Tracing.Push(tracing.PhaseProgram, "findSourceFile", map[string]any{"fileName": t.normalizedFilePath}, false)()
 * 	}
 * 	redirect := loader.projectReferenceFileMapper.getParseFileRedirect(t)
 * 	if redirect != "" {
 * 		t.redirect(loader, redirect)
 * 		return
 * 	}
 *
 * 	if tspath.HasExtension(t.normalizedFilePath) {
 * 		compilerOptions := loader.opts.Config.CompilerOptions()
 * 		allowNonTsExtensions := compilerOptions.AllowNonTsExtensions.IsTrue()
 * 		if !allowNonTsExtensions {
 * 			canonicalFileName := tspath.GetCanonicalFileName(t.normalizedFilePath, loader.opts.Host.FS().UseCaseSensitiveFileNames())
 * 			if !loader.isSupportedExtension(canonicalFileName) {
 * 				if tspath.HasJSFileExtension(canonicalFileName) {
 * 					t.processingDiagnostics = append(t.processingDiagnostics, &processingDiagnostic{
 * 						kind: processingDiagnosticKindExplainingFileInclude,
 * 						data: &includeExplainingDiagnostic{
 * 							diagnosticReason: t.includeReason,
 * 							message:          diagnostics.File_0_is_a_JavaScript_file_Did_you_mean_to_enable_the_allowJs_option,
 * 							args:             []any{t.normalizedFilePath},
 * 						},
 * 					})
 * 				} else {
 * 					t.processingDiagnostics = append(t.processingDiagnostics, &processingDiagnostic{
 * 						kind: processingDiagnosticKindExplainingFileInclude,
 * 						data: &includeExplainingDiagnostic{
 * 							diagnosticReason: t.includeReason,
 * 							message:          diagnostics.File_0_has_an_unsupported_extension_The_only_supported_extensions_are_1,
 * 							args:             []any{t.normalizedFilePath, "'" + strings.Join(core.Flatten(loader.supportedExtensions), "', '") + "'"},
 * 						},
 * 					})
 * 				}
 * 				return
 * 			}
 * 		}
 * 	}
 *
 * 	loader.totalFileCount.Add(1)
 * 	if t.libFile != nil {
 * 		loader.libFileCount.Add(1)
 * 		// Default lib files are all scripts; we can safely skip looking up their package.json
 * 		// to avoid adding spurious lookups to file watcher tracking.
 * 		t.metadata = ast.SourceFileMetaData{ImpliedNodeFormat: core.ResolutionModeCommonJS}
 * 	} else {
 * 		t.metadata = loader.loadSourceFileMetaData(t.normalizedFilePath)
 * 	}
 *
 * 	file := loader.parseSourceFile(t)
 * 	if file == nil {
 * 		return
 * 	}
 *
 * 	t.file = file
 * 	t.subTasks = make([]*parseTask, 0, len(file.ReferencedFiles)+len(file.Imports())+len(file.ModuleAugmentations))
 *
 * 	compilerOptions := loader.opts.Config.CompilerOptions()
 * 	if !compilerOptions.NoResolve.IsTrue() {
 * 		for index, ref := range file.ReferencedFiles {
 * 			resolvedRef, processingDiagnostic := loader.resolveTripleslashPathReference(ref.FileName, file.FileName(), index)
 * 			if processingDiagnostic != nil {
 * 				t.processingDiagnostics = append(t.processingDiagnostics, processingDiagnostic)
 * 				continue
 * 			}
 * 			t.addSubTask(*resolvedRef, nil)
 * 		}
 *
 * 		loader.resolveTypeReferenceDirectives(t)
 * 	}
 *
 * 	if compilerOptions.NoLib != core.TSTrue {
 * 		for index, lib := range file.LibReferenceDirectives {
 * 			includeReason := &FileIncludeReason{
 * 				kind: fileIncludeKindLibReferenceDirective,
 * 				data: &referencedFileData{
 * 					file:  t.path,
 * 					index: index,
 * 				},
 * 			}
 * 			if name, ok := tsoptions.GetLibFileName(lib.FileName); ok {
 * 				libFile := loader.pathForLibFile(name)
 * 				t.addSubTask(resolvedRef{
 * 					fileName:      libFile.path,
 * 					includeReason: includeReason,
 * 				}, libFile)
 * 			} else {
 * 				t.processingDiagnostics = append(t.processingDiagnostics, &processingDiagnostic{
 * 					kind: processingDiagnosticKindUnknownReference,
 * 					data: includeReason,
 * 				})
 * 			}
 * 		}
 * 	}
 *
 * 	loader.resolveImportsAndModuleAugmentations(t)
 * }
 */
export declare function parseTask_load(receiver: GoPtr<parseTask>, loader: GoPtr<fileLoader>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::method::parseTask.redirect","kind":"method","status":"implemented","sigHash":"30af1006c43e542b25ac756482b318314d4f54abb28edc2b19d8306195d2883f","bodyHash":"211f0a4f19f57640341406e3d9893b13e81e99aec37f7283165ce139a3b6c4f2"}
 *
 * Go source:
 * func (t *parseTask) redirect(loader *fileLoader, fileName string) {
 * 	t.redirectedParseTask = &parseTask{
 * 		normalizedFilePath: tspath.NormalizePath(fileName),
 * 		libFile:            t.libFile,
 * 		includeReason:      t.includeReason,
 * 	}
 * 	// increaseDepth and elideOnDepth are not copied to redirects, otherwise their depth would be double counted.
 * 	t.subTasks = []*parseTask{t.redirectedParseTask}
 * }
 */
export declare function parseTask_redirect(receiver: GoPtr<parseTask>, loader: GoPtr<fileLoader>, fileName: string): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::method::parseTask.loadAutomaticTypeDirectives","kind":"method","status":"implemented","sigHash":"c77943ea85d98fb5922b0edf5e745da60101d7f7f827a3ff4826b46ea67dbc24","bodyHash":"c65beb200dfe9ffd35f2ac36d66fe8c87e1d4e6bbadf604a0d43ffcac4a993dd"}
 *
 * Go source:
 * func (t *parseTask) loadAutomaticTypeDirectives(loader *fileLoader) {
 * 	if loader.opts.Tracing != nil {
 * 		defer loader.opts.Tracing.Push(tracing.PhaseProgram, "processTypeReferences", nil, false)()
 * 	}
 * 	toParseTypeRefs, typeResolutionsInFile, typeResolutionsTrace, pDiagnostics := loader.resolveAutomaticTypeDirectives(t.normalizedFilePath)
 * 	t.typeResolutionsInFile = typeResolutionsInFile
 * 	t.typeResolutionsTrace = typeResolutionsTrace
 * 	t.processingDiagnostics = append(t.processingDiagnostics, pDiagnostics...)
 * 	for _, typeResolution := range toParseTypeRefs {
 * 		t.addSubTask(typeResolution, nil)
 * 	}
 * }
 */
export declare function parseTask_loadAutomaticTypeDirectives(receiver: GoPtr<parseTask>, loader: GoPtr<fileLoader>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::type::resolvedRef","kind":"type","status":"implemented","sigHash":"b745f422a6fb663c016c9c88ce4ddf26a08d1363b9d0388124d82091d751d53d","bodyHash":"d498a8ac78f30feb947e61fcf62d99074a76585ce8827e15528737c6a9c8e2fa"}
 *
 * Go source:
 * resolvedRef struct {
 * 	fileName      string
 * 	increaseDepth bool
 * 	elideOnDepth  bool
 * 	includeReason *FileIncludeReason
 * 	packageId     module.PackageId
 * }
 */
export interface resolvedRef {
    fileName: string;
    increaseDepth: bool;
    elideOnDepth: bool;
    includeReason: GoPtr<FileIncludeReason>;
    packageId: PackageId;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::method::parseTask.addSubTask","kind":"method","status":"implemented","sigHash":"c28256ed2eecf4ca236298bdcab619db9cda9b98007d707d355a556a39ca7f8e","bodyHash":"51e0ef00a31e2ab9bd9d6f8e4e5a9cefeeb5dd3975489c7d634036a6aaf9aff1"}
 *
 * Go source:
 * func (t *parseTask) addSubTask(ref resolvedRef, libFile *LibFile) {
 * 	normalizedFilePath := tspath.NormalizePath(ref.fileName)
 * 	subTask := &parseTask{
 * 		normalizedFilePath: normalizedFilePath,
 * 		libFile:            libFile,
 * 		increaseDepth:      ref.increaseDepth,
 * 		elideOnDepth:       ref.elideOnDepth,
 * 		includeReason:      ref.includeReason,
 * 		packageId:          ref.packageId,
 * 	}
 * 	t.subTasks = append(t.subTasks, subTask)
 * }
 */
export declare function parseTask_addSubTask(receiver: GoPtr<parseTask>, ref: resolvedRef, libFile: GoPtr<LibFile>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::type::filesParser","kind":"type","status":"implemented","sigHash":"eeb31d9c280c841ed07aa4ae9205776d8829e5534bd5ad7204cecfd91efd4c49","bodyHash":"78ce5e466819582f0ecdfb097eebd983c5b6d0ef4e624a0b205376ecfda66b0f"}
 *
 * Go source:
 * filesParser struct {
 * 	wg             core.WorkGroup
 * 	taskDataByPath collections.SyncMap[tspath.Path, *parseTaskData]
 * 	maxDepth       int
 * }
 */
export interface filesParser {
    wg: WorkGroup;
    taskDataByPath: SyncMap;
    maxDepth: int;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::varGroup::parseTaskDataPool","kind":"varGroup","status":"implemented","sigHash":"9a754b609fc6b864cbc22463440afff1edc12b41faa8ebcd31287a5039152ee1","bodyHash":"1027fb1da62e20abd62d3eb2a2d491e001f4472b428ecad97632327167879c41"}
 *
 * Go source:
 * var parseTaskDataPool = sync.Pool{
 * 	New: func() any {
 * 		return &parseTaskData{
 * 			tasks: make(map[string]*parseTask, 1),
 * 		}
 * 	},
 * }
 */
export declare const parseTaskDataPool: Pool<parseTaskData>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::func::getParseTaskData","kind":"func","status":"implemented","sigHash":"8d9651b61a70c4cfc41c23cd4cdef42bbdbaa08330468eb5d6041a4e6a3b8093","bodyHash":"df5fa29639bcc00774e0e668f83be876a85094debf5191124a91cc69adad74af"}
 *
 * Go source:
 * func getParseTaskData(task *parseTask) *parseTaskData {
 * 	td := parseTaskDataPool.Get().(*parseTaskData)
 * 	td.tasks[task.normalizedFilePath] = task
 * 	td.lowestDepth = math.MaxInt
 * 	return td
 * }
 */
export declare function getParseTaskData(task: GoPtr<parseTask>): GoPtr<parseTaskData>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::func::putParseTaskData","kind":"func","status":"implemented","sigHash":"4c8f88199b0398d285c74b4ee3245e1d6ce216ff9cc5c68891263174836bffbc","bodyHash":"dffd014f3d9dd2cd6261ed492c38de0ffbfa6709845e70d8b0ffcb4a38e595fb"}
 *
 * Go source:
 * func putParseTaskData(td *parseTaskData) {
 * 	clear(td.tasks)
 * 	parseTaskDataPool.Put(td)
 * }
 */
export declare function putParseTaskData(td: GoPtr<parseTaskData>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::type::parseTaskData","kind":"type","status":"implemented","sigHash":"d7e90acd5b01b1a59e7566423ae6e309820fc4321ba2c8b7b03f137b80507667","bodyHash":"40fb88623f3adf4d02baaa108ddbe27d93394e1c715d4b25a0bfb4f649d414e6"}
 *
 * Go source:
 * parseTaskData struct {
 * 	// map of tasks by file casing
 * 	tasks           map[string]*parseTask
 * 	mu              sync.Mutex
 * 	lowestDepth     int
 * 	startedSubTasks bool
 * 	packageId       module.PackageId
 * }
 */
export interface parseTaskData {
    tasks: GoMap<string, GoPtr<parseTask>>;
    mu: Mutex;
    lowestDepth: int;
    startedSubTasks: bool;
    packageId: PackageId;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::method::filesParser.parse","kind":"method","status":"implemented","sigHash":"86a57d08041d66fc09ee925b32908c5e68839480a56a5c8ff7923f62ec4fe21a","bodyHash":"e44b1cf4151050e9eb7edf95b8aa580b3a58a89c0807de78bc9c24cf0371ad43"}
 *
 * Go source:
 * func (w *filesParser) parse(loader *fileLoader, tasks []*parseTask) {
 * 	w.start(loader, tasks, 0)
 * 	w.wg.RunAndWait()
 * }
 */
export declare function filesParser_parse(receiver: GoPtr<filesParser>, loader: GoPtr<fileLoader>, tasks: GoSlice<GoPtr<parseTask>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::method::filesParser.start","kind":"method","status":"implemented","sigHash":"311dbc1f98d2f8725ae00d5bdecdca95f07971751568fddc688ae6f6cf399036","bodyHash":"5836ad620307c3d6e2f0165bdd1f873e8e036956c72202a066c2eb5fdd85ebcd"}
 *
 * Go source:
 * func (w *filesParser) start(loader *fileLoader, tasks []*parseTask, depth int) {
 * 	for i, task := range tasks {
 * 		task.path = loader.toPath(task.normalizedFilePath)
 * 		candidate := getParseTaskData(task)
 * 		data, loaded := w.taskDataByPath.LoadOrStore(task.path, candidate)
 * 		if loaded {
 * 			putParseTaskData(candidate)
 * 		}
 *
 * 		w.wg.Queue(func() {
 * 			data.mu.Lock()
 * 			defer data.mu.Unlock()
 *
 * 			startSubtasks := false
 * 			if loaded {
 * 				if existingTask, ok := data.tasks[task.normalizedFilePath]; ok {
 * 					tasks[i].loadedTask = existingTask
 * 				} else {
 * 					data.tasks[task.normalizedFilePath] = task
 * 					// This is new task for file name - so load subtasks if there was loading for any other casing
 * 					startSubtasks = data.startedSubTasks
 * 				}
 * 			}
 *
 * 			// Propagate packageId to data if we have one and data doesn't yet
 * 			if data.packageId.Name == "" && task.packageId.Name != "" {
 * 				data.packageId = task.packageId
 * 			}
 *
 * 			currentDepth := core.IfElse(task.increaseDepth, depth+1, depth)
 * 			if currentDepth < data.lowestDepth {
 * 				// If we're seeing this task at a lower depth than before,
 * 				// reprocess its subtasks to ensure they are loaded.
 * 				data.lowestDepth = currentDepth
 * 				startSubtasks = true
 * 				data.startedSubTasks = true
 * 			}
 *
 * 			if task.elideOnDepth && currentDepth > w.maxDepth {
 * 				return
 * 			}
 *
 * 			for _, taskByFileName := range data.tasks {
 * 				loadSubTasks := startSubtasks
 * 				if !taskByFileName.loaded {
 * 					taskByFileName.load(loader)
 * 					if taskByFileName.redirectedParseTask != nil {
 * 						// Always load redirected task
 * 						loadSubTasks = true
 * 						data.startedSubTasks = true
 * 					}
 * 				}
 * 				if !taskByFileName.startedSubTasks && loadSubTasks {
 * 					taskByFileName.startedSubTasks = true
 * 					w.start(loader, taskByFileName.subTasks, data.lowestDepth)
 * 				}
 * 			}
 * 		})
 * 	}
 * }
 */
export declare function filesParser_start(receiver: GoPtr<filesParser>, loader: GoPtr<fileLoader>, tasks: GoSlice<GoPtr<parseTask>>, depth: int): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::method::filesParser.getProcessedFiles","kind":"method","status":"implemented","sigHash":"c2e51238eff6336f328f007677443bb0ad8f7de5dbabc6a436aefff300edc302","bodyHash":"9345aef10513c9a43308890522ecc220cfeb875670275fef029af29efb317200"}
 *
 * Go source:
 * func (w *filesParser) getProcessedFiles(loader *fileLoader) processedFiles {
 * 	totalFileCount := int(loader.totalFileCount.Load())
 * 	libFileCount := int(loader.libFileCount.Load())
 *
 * 	var missingFiles []string
 * 	var duplicateSourceFiles []*DuplicateSourceFile
 * 	files := make([]*ast.SourceFile, 0, totalFileCount-libFileCount)
 * 	libFiles := make([]*ast.SourceFile, 0, totalFileCount) // totalFileCount here since we append files to it later to construct the final list
 *
 * 	filesByPath := make(map[tspath.Path]*ast.SourceFile, totalFileCount)
 * 	// stores 'filename -> file association' ignoring case
 * 	// used to track cases when two file names differ only in casing
 * 	var tasksSeenByNameIgnoreCase map[string]*parseTask
 * 	if loader.comparePathsOptions.UseCaseSensitiveFileNames {
 * 		tasksSeenByNameIgnoreCase = make(map[string]*parseTask, totalFileCount)
 * 	}
 *
 * 	includeProcessor := &includeProcessor{
 * 		fileIncludeReasons: make(map[tspath.Path][]*FileIncludeReason, totalFileCount),
 * 	}
 * 	var outputFileToProjectReferenceSource map[tspath.Path]string
 * 	if !loader.opts.canUseProjectReferenceSource() {
 * 		outputFileToProjectReferenceSource = make(map[tspath.Path]string, totalFileCount)
 * 	}
 * 	resolvedModules := make(map[tspath.Path]module.ModeAwareCache[*module.ResolvedModule], totalFileCount+1)
 * 	typeResolutionsInFile := make(map[tspath.Path]module.ModeAwareCache[*module.ResolvedTypeReferenceDirective], totalFileCount)
 * 	sourceFileMetaDatas := make(map[tspath.Path]ast.SourceFileMetaData, totalFileCount)
 * 	var jsxRuntimeImportSpecifiers map[tspath.Path]*jsxRuntimeImportSpecifier
 * 	var importHelpersImportSpecifiers map[tspath.Path]*ast.StringLiteralNode
 * 	var sourceFilesFoundSearchingNodeModules collections.Set[tspath.Path]
 * 	libFilesMap := make(map[tspath.Path]*LibFile, libFileCount)
 *
 * 	var redirectTargetsMap map[tspath.Path][]string
 * 	var redirectFilesByPath map[tspath.Path]*redirectsFile
 * 	var packageIdToSourceFile map[module.PackageId]*ast.SourceFile
 * 	if !loader.opts.Config.CompilerOptions().DeduplicatePackages.IsFalse() {
 * 		redirectTargetsMap = make(map[tspath.Path][]string)
 * 		packageIdToSourceFile = make(map[module.PackageId]*ast.SourceFile)
 * 	}
 *
 * 	var collectFiles func(tasks []*parseTask, seen map[*parseTaskData]string)
 * 	collectFiles = func(tasks []*parseTask, seen map[*parseTaskData]string) {
 * 		for _, task := range tasks {
 * 			includeReason := task.includeReason
 * 			// Exclude automatic type directive tasks from include reason processing,
 * 			// as these are internal implementation details and should not contribute
 * 			// to the reasons for including files.
 * 			if task.redirectedParseTask == nil && !task.isForAutomaticTypeDirective {
 * 				if task.loadedTask != nil {
 * 					task = task.loadedTask
 * 				}
 * 				w.addIncludeReason(includeProcessor, task, includeReason)
 * 			}
 * 			data, _ := w.taskDataByPath.Load(task.path)
 * 			if !task.loaded {
 * 				continue
 * 			}
 *
 * 			// ensure we only walk each task once
 * 			if checkedName, ok := seen[data]; ok {
 * 				if task.file != nil && checkedName != task.normalizedFilePath {
 * 					duplicateSourceFiles = append(duplicateSourceFiles, &DuplicateSourceFile{
 * 						ParseOptions: task.file.ParseOptions(),
 * 						Hash:         task.file.Hash,
 * 						ScriptKind:   task.file.ScriptKind,
 * 					})
 * 				}
 * 				if !loader.opts.Config.CompilerOptions().ForceConsistentCasingInFileNames.IsFalse() {
 * 					// Check if it differs only in drive letters its ok to ignore that error:
 * 					checkedAbsolutePath := tspath.GetNormalizedAbsolutePathWithoutRoot(checkedName, loader.comparePathsOptions.CurrentDirectory)
 * 					inputAbsolutePath := tspath.GetNormalizedAbsolutePathWithoutRoot(task.normalizedFilePath, loader.comparePathsOptions.CurrentDirectory)
 * 					if checkedAbsolutePath != inputAbsolutePath {
 * 						includeProcessor.addProcessingDiagnosticsForFileCasing(task.path, checkedName, task.normalizedFilePath, includeReason)
 * 					}
 * 				}
 * 				continue
 * 			} else {
 * 				seen[data] = task.normalizedFilePath
 * 			}
 *
 * 			if tasksSeenByNameIgnoreCase != nil {
 * 				pathLowerCase := tspath.ToFileNameLowerCase(string(task.path))
 * 				if taskByIgnoreCase, ok := tasksSeenByNameIgnoreCase[pathLowerCase]; ok {
 * 					includeProcessor.addProcessingDiagnosticsForFileCasing(taskByIgnoreCase.path, taskByIgnoreCase.normalizedFilePath, task.normalizedFilePath, includeReason)
 * 				} else {
 * 					tasksSeenByNameIgnoreCase[pathLowerCase] = task
 * 				}
 * 			}
 *
 * 			for _, trace := range task.typeResolutionsTrace {
 * 				loader.opts.Host.Trace(trace.Message, trace.Args...)
 * 			}
 * 			for _, trace := range task.resolutionsTrace {
 * 				loader.opts.Host.Trace(trace.Message, trace.Args...)
 * 			}
 *
 * 			file := task.file
 * 			if packageIdToSourceFile != nil && data.packageId.Name != "" {
 * 				if packageIdFile, exists := packageIdToSourceFile[data.packageId]; exists {
 * 					if file != nil {
 * 						// Package deduplication keeps the first package instance in the
 * 						// program, but we still parsed this file and acquired it through
 * 						// the host, so snapshot disposal must release that extra owner.
 * 						duplicateSourceFiles = append(duplicateSourceFiles, &DuplicateSourceFile{
 * 							ParseOptions: file.ParseOptions(),
 * 							Hash:         file.Hash,
 * 							ScriptKind:   file.ScriptKind,
 * 						})
 * 					}
 * 					redirectTargetsMap[packageIdFile.Path()] = append(redirectTargetsMap[packageIdFile.Path()], task.normalizedFilePath)
 * 					if redirectFilesByPath == nil {
 * 						redirectFilesByPath = make(map[tspath.Path]*redirectsFile, totalFileCount)
 * 					}
 * 					redirectFilesByPath[task.path] = &redirectsFile{
 * 						index:    len(files) + len(redirectFilesByPath),
 * 						fileName: task.normalizedFilePath,
 * 						path:     task.path,
 * 						target:   packageIdFile.Path(),
 * 					}
 * 					filesByPath[task.path] = packageIdFile
 * 					if data.lowestDepth > 0 {
 * 						sourceFilesFoundSearchingNodeModules.Add(task.path)
 * 					}
 * 					continue
 * 				} else if file != nil {
 * 					packageIdToSourceFile[data.packageId] = file
 * 				}
 * 			}
 *
 * 			if subTasks := task.subTasks; len(subTasks) > 0 {
 * 				collectFiles(subTasks, seen)
 * 			}
 *
 * 			// Exclude automatic type directive tasks from include reason processing,
 * 			// as these are internal implementation details and should not contribute
 * 			// to the reasons for including files.
 * 			if task.redirectedParseTask != nil {
 * 				if !loader.opts.canUseProjectReferenceSource() {
 * 					outputFileToProjectReferenceSource[task.redirectedParseTask.path] = task.FileName()
 * 				}
 * 				continue
 * 			}
 *
 * 			if task.isForAutomaticTypeDirective {
 * 				typeResolutionsInFile[task.path] = task.typeResolutionsInFile
 * 				if len(task.processingDiagnostics) > 0 {
 * 					includeProcessor.processingDiagnostics = append(includeProcessor.processingDiagnostics, task.processingDiagnostics...)
 * 				}
 * 				continue
 * 			}
 *
 * 			path := task.path
 *
 * 			if len(task.processingDiagnostics) > 0 {
 * 				includeProcessor.processingDiagnostics = append(includeProcessor.processingDiagnostics, task.processingDiagnostics...)
 * 			}
 *
 * 			if file == nil {
 * 				missingFiles = append(missingFiles, task.normalizedFilePath)
 * 				continue
 * 			}
 *
 * 			if task.libFile != nil {
 * 				libFiles = append(libFiles, file)
 * 				libFilesMap[path] = task.libFile
 * 			} else {
 * 				files = append(files, file)
 * 			}
 * 			filesByPath[path] = file
 * 			resolvedModules[path] = task.resolutionsInFile
 * 			typeResolutionsInFile[path] = task.typeResolutionsInFile
 * 			sourceFileMetaDatas[path] = task.metadata
 *
 * 			if task.jsxRuntimeImportSpecifier != nil {
 * 				if jsxRuntimeImportSpecifiers == nil {
 * 					jsxRuntimeImportSpecifiers = make(map[tspath.Path]*jsxRuntimeImportSpecifier, totalFileCount)
 * 				}
 * 				jsxRuntimeImportSpecifiers[path] = task.jsxRuntimeImportSpecifier
 * 			}
 * 			if task.importHelpersImportSpecifier != nil {
 * 				if importHelpersImportSpecifiers == nil {
 * 					importHelpersImportSpecifiers = make(map[tspath.Path]*ast.StringLiteralNode, totalFileCount)
 * 				}
 * 				importHelpersImportSpecifiers[path] = task.importHelpersImportSpecifier
 * 			}
 * 			if data.lowestDepth > 0 {
 * 				sourceFilesFoundSearchingNodeModules.Add(path)
 * 			}
 * 		}
 * 	}
 *
 * 	collectFiles(loader.rootTasks, make(map[*parseTaskData]string, totalFileCount))
 * 	loader.sortLibs(libFiles)
 *
 * 	allFiles := append(libFiles, files...)
 * 	for _, redirectFile := range redirectFilesByPath {
 * 		redirectFile.index += len(libFiles)
 * 	}
 *
 * 	keys := slices.Collect(loader.pathForLibFileResolutions.Keys())
 * 	slices.Sort(keys)
 * 	for _, key := range keys {
 * 		value, _ := loader.pathForLibFileResolutions.Load(key)
 * 		resolvedModules[key] = module.ModeAwareCache[*module.ResolvedModule]{
 * 			module.ModeAwareCacheKey{Name: value.libraryName, Mode: core.ModuleKindCommonJS}: value.resolution,
 * 		}
 * 		for _, trace := range value.trace {
 * 			loader.opts.Host.Trace(trace.Message, trace.Args...)
 * 		}
 * 	}
 *
 * 	return processedFiles{
 * 		finishedProcessing:                   true,
 * 		resolver:                             loader.resolver,
 * 		files:                                allFiles,
 * 		duplicateSourceFiles:                 duplicateSourceFiles,
 * 		filesByPath:                          filesByPath,
 * 		projectReferenceFileMapper:           loader.projectReferenceFileMapper,
 * 		resolvedModules:                      resolvedModules,
 * 		typeResolutionsInFile:                typeResolutionsInFile,
 * 		sourceFileMetaDatas:                  sourceFileMetaDatas,
 * 		jsxRuntimeImportSpecifiers:           jsxRuntimeImportSpecifiers,
 * 		importHelpersImportSpecifiers:        importHelpersImportSpecifiers,
 * 		sourceFilesFoundSearchingNodeModules: sourceFilesFoundSearchingNodeModules,
 * 		libFiles:                             libFilesMap,
 * 		missingFiles:                         missingFiles,
 * 		includeProcessor:                     includeProcessor,
 * 		outputFileToProjectReferenceSource:   outputFileToProjectReferenceSource,
 * 		redirectTargetsMap:                   redirectTargetsMap,
 * 		redirectFilesByPath:                  redirectFilesByPath,
 * 	}
 * }
 */
export declare function filesParser_getProcessedFiles(receiver: GoPtr<filesParser>, loader: GoPtr<fileLoader>): processedFiles;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::method::filesParser.addIncludeReason","kind":"method","status":"implemented","sigHash":"9dcd71b8e12af711fc23d3b04a24b61ccf39d9c661ee4e131c13a1f34065fc17","bodyHash":"d94dd02981186d5198061606d7348af0df871d7d3732442beceef9dad1b364cb"}
 *
 * Go source:
 * func (w *filesParser) addIncludeReason(includeProcessor *includeProcessor, task *parseTask, reason *FileIncludeReason) {
 * 	if task.redirectedParseTask != nil {
 * 		w.addIncludeReason(includeProcessor, task.redirectedParseTask, reason)
 * 	} else if task.loaded {
 * 		if existing, ok := includeProcessor.fileIncludeReasons[task.path]; ok {
 * 			includeProcessor.fileIncludeReasons[task.path] = append(existing, reason)
 * 		} else {
 * 			includeProcessor.fileIncludeReasons[task.path] = []*FileIncludeReason{reason}
 * 		}
 * 	}
 * }
 */
export declare function filesParser_addIncludeReason(receiver: GoPtr<filesParser>, includeProcessor: GoPtr<includeProcessor>, task: GoPtr<parseTask>, reason: GoPtr<FileIncludeReason>): void;
//# sourceMappingURL=filesparser.d.ts.map