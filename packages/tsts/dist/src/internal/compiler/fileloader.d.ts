import type { bool, int } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { Uint128 } from "../../go/github.com/zeebo/xxh3.js";
import { Mutex } from "../../go/sync.js";
import type { Int32 } from "../../go/sync/atomic.js";
import type { FileReference, HasFileName, Node, SourceFile, SourceFileMetaData, StringLiteralLike } from "../ast/ast.js";
import type { SourceFileParseOptions } from "../ast/parseoptions.js";
import type { NodeFactory } from "../ast/generated/factory.js";
import type { StringLiteralNode } from "../ast/generated/unions.js";
import type { Set } from "../collections/set.js";
import type { SyncMap } from "../collections/syncmap.js";
import type { CompilerOptions, ResolutionMode } from "../core/compileroptions.js";
import type { ScriptKind } from "../core/scriptkind.js";
import type { Message } from "../diagnostics/diagnostics.js";
import type { ModeAwareCache } from "../module/cache.js";
import type { DiagAndArgs, Resolver } from "../module/resolver.js";
import type { ResolvedModule, ResolvedTypeReferenceDirective } from "../module/types.js";
import type { ComparePathsOptions, Path as Path_9073472b } from "../tspath/path.js";
import type { FileIncludeReason } from "./fileInclude.js";
import type { filesParser, parseTask, resolvedRef } from "./filesparser.js";
import type { includeProcessor } from "./includeprocessor.js";
import type { processingDiagnostic } from "./processingDiagnostic.js";
import type { ProgramOptions } from "./program.js";
import type { projectReferenceFileMapper } from "./projectreferencefilemapper.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::type::libResolution","kind":"type","status":"implemented","sigHash":"9c4a426b0d3e59256e9a7dad7aff7add3d3d2f12512bed81cac56f4e53bc747b","bodyHash":"e4d76c1ba9ccfb10d7454bc6476b0b4aba5b90252da267c2a9e78887e7354047"}
 *
 * Go source:
 * libResolution struct {
 * 	libraryName string
 * 	resolution  *module.ResolvedModule
 * 	trace       []module.DiagAndArgs
 * }
 */
export interface libResolution {
    libraryName: string;
    resolution: GoPtr<ResolvedModule>;
    trace: GoSlice<DiagAndArgs>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::type::LibFile","kind":"type","status":"implemented","sigHash":"bf419babcf44aa80355bb0cbaf14de8ad8d4e1c9da9f61a05cf6fc8b198f6844","bodyHash":"60fa112afbe91c85cafb531bcf5ff90d2cdf9f63f0392b95e8dce53a0af88972"}
 *
 * Go source:
 * LibFile struct {
 * 	Name     string
 * 	path     string
 * 	Replaced bool
 * }
 */
export interface LibFile {
    Name: string;
    path: string;
    Replaced: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::type::sourceFileFromReferenceDiagnostic","kind":"type","status":"implemented","sigHash":"5575a945d804bbf98768f6f77ae02771b72b575c973a621c39d6190b06088cb0","bodyHash":"2e36564bef99b83a80be013933b919ca2b0e004d4aa2ee4b79df7d443c76f153"}
 *
 * Go source:
 * sourceFileFromReferenceDiagnostic struct {
 * 	message *diagnostics.Message
 * 	args    []any
 * }
 */
export interface sourceFileFromReferenceDiagnostic {
    message: GoPtr<Message>;
    args: GoSlice<unknown>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::type::fileLoader","kind":"type","status":"implemented","sigHash":"640c2e70b10d0f41c89ddbb8e17c1450c30708c7ecfe96ea898d3b1fcc7ac018","bodyHash":"a14a3a5e54fd3daccffc78fd299c9d164b8e65f28eacb7acaa08056aceec5d48"}
 *
 * Go source:
 * fileLoader struct {
 * 	opts                                           ProgramOptions
 * 	resolver                                       *module.Resolver
 * 	defaultLibraryPath                             string
 * 	comparePathsOptions                            tspath.ComparePathsOptions
 * 	supportedExtensions                            [][]string
 * 	supportedExtensionsWithJsonIfResolveJsonModule [][]string
 *
 * 	filesParser *filesParser
 * 	rootTasks   []*parseTask
 *
 * 	totalFileCount atomic.Int32
 * 	libFileCount   atomic.Int32
 *
 * 	factoryMu sync.Mutex
 * 	factory   ast.NodeFactory
 *
 * 	projectReferenceFileMapper *projectReferenceFileMapper
 * 	dtsDirectories             collections.Set[tspath.Path]
 *
 * 	pathForLibFileCache       collections.SyncMap[string, *LibFile]
 * 	pathForLibFileResolutions collections.SyncMap[tspath.Path, *libResolution]
 * }
 */
export interface fileLoader {
    opts: ProgramOptions;
    resolver: GoPtr<Resolver>;
    defaultLibraryPath: string;
    comparePathsOptions: ComparePathsOptions;
    supportedExtensions: GoSlice<GoSlice<string>>;
    supportedExtensionsWithJsonIfResolveJsonModule: GoSlice<GoSlice<string>>;
    filesParser: GoPtr<filesParser>;
    rootTasks: GoSlice<GoPtr<parseTask>>;
    totalFileCount: Int32;
    libFileCount: Int32;
    factoryMu: Mutex;
    factory: NodeFactory;
    projectReferenceFileMapper: GoPtr<projectReferenceFileMapper>;
    dtsDirectories: Set<Path_9073472b>;
    pathForLibFileCache: SyncMap<string, GoPtr<LibFile>>;
    pathForLibFileResolutions: SyncMap<Path_9073472b, GoPtr<libResolution>>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::type::redirectsFile","kind":"type","status":"implemented","sigHash":"e4da8645d7c73f33b93a913cfe22055650df62d1b1e9ea134179f8e449df76a4","bodyHash":"98465c4d933e90856d3ad288cdc16610cb5bf1042cf038f7c15a92eb8c43f3ce"}
 *
 * Go source:
 * redirectsFile struct {
 * 	// Index of file at which this redirect file needs to be iterated
 * 	index    int
 * 	fileName string
 * 	path     tspath.Path
 * 	target   tspath.Path
 * }
 */
export interface redirectsFile {
    index: int;
    fileName: string;
    path: Path_9073472b;
    target: Path_9073472b;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::type::DuplicateSourceFile","kind":"type","status":"implemented","sigHash":"577779d2362a3a20679f3e15f081a200d90667dfc939c2535bd2018a133ea1b2","bodyHash":"73d081f139c902a3834edf1386eedc44b153c379106da4e9a2ba25e800e9d9e0"}
 *
 * Go source:
 * DuplicateSourceFile struct {
 * 	ParseOptions ast.SourceFileParseOptions
 * 	Hash         xxh3.Uint128
 * 	ScriptKind   core.ScriptKind
 * }
 */
export interface DuplicateSourceFile {
    ParseOptions: SourceFileParseOptions;
    Hash: Uint128;
    ScriptKind: ScriptKind;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"8284e921f9f925885aeaa798132fe24f86ec0403613b3a5953059d91a14dc916"}
 *
 * Go source:
 * var _ ast.HasFileName = (*redirectsFile)(nil)
 */
export declare let __386f9302_0: HasFileName;
export declare function redirectsFile_as_ast_HasFileName(receiver: GoPtr<redirectsFile>): HasFileName;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::redirectsFile.FileName","kind":"method","status":"implemented","sigHash":"75f16d7260cdae7adab9134a6e3293c46bcac545ff2222df21ccd9a2b326c537","bodyHash":"6a52ade887033bafb1496dc973e98f22ed49ea433c3596388a9bf86f248c4787"}
 *
 * Go source:
 * func (r *redirectsFile) FileName() string {
 * 	return r.fileName
 * }
 */
export declare function redirectsFile_FileName(receiver: GoPtr<redirectsFile>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::redirectsFile.Path","kind":"method","status":"implemented","sigHash":"a588537cee38b3b1c288ccd68de3e13cc03d3aeb06497b65de4fdf568c6490be","bodyHash":"1d9ab312206e9214fe42e3378a0abe52e9f63cbb33ccf36ea530daa80cc7583f"}
 *
 * Go source:
 * func (r *redirectsFile) Path() tspath.Path {
 * 	return r.path
 * }
 */
export declare function redirectsFile_Path(receiver: GoPtr<redirectsFile>): Path_9073472b;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::type::processedFiles","kind":"type","status":"implemented","sigHash":"7943b133480b0774cf9dcb87dcbd11f23c130fb74645e79c839af3bd8c17afbe","bodyHash":"cc8bfc2d42bb25fc775d0d74db74cd221d078e197d83632870b68b149875039e"}
 *
 * Go source:
 * processedFiles struct {
 * 	resolver *module.Resolver
 * 	files    []*ast.SourceFile
 * 	// duplicateSourceFiles tracks parsed files loaded during program construction
 * 	// that were later dropped from the final program, such as losing filename
 * 	// casing variants for the same path or files hidden behind package redirect
 * 	// deduplication. Their parse-cache acquires still need to be balanced when
 * 	// the program is disposed.
 * 	duplicateSourceFiles          []*DuplicateSourceFile
 * 	filesByPath                   map[tspath.Path]*ast.SourceFile
 * 	projectReferenceFileMapper    *projectReferenceFileMapper
 * 	missingFiles                  []string
 * 	resolvedModules               map[tspath.Path]module.ModeAwareCache[*module.ResolvedModule]
 * 	typeResolutionsInFile         map[tspath.Path]module.ModeAwareCache[*module.ResolvedTypeReferenceDirective]
 * 	sourceFileMetaDatas           map[tspath.Path]ast.SourceFileMetaData
 * 	jsxRuntimeImportSpecifiers    map[tspath.Path]*jsxRuntimeImportSpecifier
 * 	importHelpersImportSpecifiers map[tspath.Path]*ast.StringLiteralNode
 * 	libFiles                      map[tspath.Path]*LibFile
 * 	// List of present unsupported extensions
 * 	sourceFilesFoundSearchingNodeModules collections.Set[tspath.Path]
 * 	includeProcessor                     *includeProcessor
 * 	// if file was included using source file and its output is actually part of program
 * 	// this contains mapping from output to source file
 * 	outputFileToProjectReferenceSource map[tspath.Path]string
 * 	// Key is a file path. Value is the list of files that redirect to it (same package, different install location)
 * 	redirectTargetsMap map[tspath.Path][]string
 * 	// filesByPath for redirect files
 * 	redirectFilesByPath map[tspath.Path]*redirectsFile
 * 	finishedProcessing  bool
 * }
 */
export interface processedFiles {
    resolver: GoPtr<Resolver>;
    files: GoSlice<GoPtr<SourceFile>>;
    duplicateSourceFiles: GoSlice<GoPtr<DuplicateSourceFile>>;
    filesByPath: GoMap<Path_9073472b, GoPtr<SourceFile>>;
    projectReferenceFileMapper: GoPtr<projectReferenceFileMapper>;
    missingFiles: GoSlice<string>;
    resolvedModules: GoMap<Path_9073472b, ModeAwareCache<GoPtr<ResolvedModule>>>;
    typeResolutionsInFile: GoMap<Path_9073472b, ModeAwareCache<GoPtr<ResolvedTypeReferenceDirective>>>;
    sourceFileMetaDatas: GoMap<Path_9073472b, SourceFileMetaData>;
    jsxRuntimeImportSpecifiers: GoMap<Path_9073472b, GoPtr<jsxRuntimeImportSpecifier>>;
    importHelpersImportSpecifiers: GoMap<Path_9073472b, GoPtr<StringLiteralNode>>;
    libFiles: GoMap<Path_9073472b, GoPtr<LibFile>>;
    sourceFilesFoundSearchingNodeModules: Set<Path_9073472b>;
    includeProcessor: GoPtr<includeProcessor>;
    outputFileToProjectReferenceSource: GoMap<Path_9073472b, string>;
    redirectTargetsMap: GoMap<Path_9073472b, GoSlice<string>>;
    redirectFilesByPath: GoMap<Path_9073472b, GoPtr<redirectsFile>>;
    finishedProcessing: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::type::jsxRuntimeImportSpecifier","kind":"type","status":"implemented","sigHash":"c7c3aa35d41ca2c809bfeb2f73fc39840fa20fea0020be7fd143bdcf01a8ec24","bodyHash":"fe53efca2d1916a5695a2d330225a63552c1ac3aac722240e4e2cefcfc96ae2d"}
 *
 * Go source:
 * jsxRuntimeImportSpecifier struct {
 * 	moduleReference string
 * 	specifier       *ast.StringLiteralNode
 * }
 */
export interface jsxRuntimeImportSpecifier {
    moduleReference: string;
    specifier: GoPtr<StringLiteralNode>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::func::processAllProgramFiles","kind":"func","status":"implemented","sigHash":"e38059a13537c31d50a7ef49c7d0d511f7b51bcbfa1e1375a459fe88a6b62a6f","bodyHash":"d480563f6ce2ad89532596ed6fb94becd172fbecf039dc11100a6f4651d5f558"}
 *
 * Go source:
 * func processAllProgramFiles(
 * 	opts ProgramOptions,
 * 	singleThreaded bool,
 * ) processedFiles {
 * 	compilerOptions := opts.Config.CompilerOptions()
 * 	rootFiles := opts.Config.FileNames()
 * 	supportedExtensions := tsoptions.GetSupportedExtensions(compilerOptions, nil /*extraFileExtensions* /)
 * 	supportedExtensionsWithJsonIfResolveJsonModule := tsoptions.GetSupportedExtensionsWithJsonIfResolveJsonModule(compilerOptions, supportedExtensions)
 * 	var maxNodeModuleJsDepth int
 * 	if p := opts.Config.CompilerOptions().MaxNodeModuleJsDepth; p != nil {
 * 		maxNodeModuleJsDepth = *p
 * 	}
 * 	loader := fileLoader{
 * 		opts:               opts,
 * 		defaultLibraryPath: tspath.GetNormalizedAbsolutePath(opts.Host.DefaultLibraryPath(), opts.Host.GetCurrentDirectory()),
 * 		comparePathsOptions: tspath.ComparePathsOptions{
 * 			UseCaseSensitiveFileNames: opts.Host.FS().UseCaseSensitiveFileNames(),
 * 			CurrentDirectory:          opts.Host.GetCurrentDirectory(),
 * 		},
 * 		filesParser: &filesParser{
 * 			wg:       core.NewWorkGroup(singleThreaded),
 * 			maxDepth: maxNodeModuleJsDepth,
 * 		},
 * 		rootTasks:           make([]*parseTask, 0, len(rootFiles)+len(compilerOptions.Lib)),
 * 		supportedExtensions: supportedExtensions,
 * 		supportedExtensionsWithJsonIfResolveJsonModule: supportedExtensionsWithJsonIfResolveJsonModule,
 * 	}
 * 	loader.addProjectReferenceTasks(singleThreaded)
 * 	loader.resolver = module.NewResolver(loader.projectReferenceFileMapper.host, compilerOptions, opts.TypingsLocation, opts.ProjectName)
 * 	if opts.Tracing != nil {
 * 		defer opts.Tracing.Push(tracing.PhaseProgram, "processRootFiles", map[string]any{"count": len(rootFiles)}, false)()
 * 	}
 * 	for index, rootFile := range rootFiles {
 * 		loader.addRootFileTask(rootFile, nil, &FileIncludeReason{kind: fileIncludeKindRootFile, data: index})
 * 	}
 * 	if len(rootFiles) > 0 && compilerOptions.NoLib.IsFalseOrUnknown() {
 * 		if compilerOptions.Lib == nil {
 * 			name := tsoptions.GetDefaultLibFileName(compilerOptions)
 * 			libFile := loader.pathForLibFile(name)
 * 			loader.addRootTask(libFile.path, libFile, &FileIncludeReason{kind: fileIncludeKindLibFile})
 *
 * 		} else {
 * 			for index, lib := range compilerOptions.Lib {
 * 				if name, ok := tsoptions.GetLibFileName(lib); ok {
 * 					libFile := loader.pathForLibFile(name)
 * 					loader.addRootTask(libFile.path, libFile, &FileIncludeReason{kind: fileIncludeKindLibFile, data: index})
 * 				}
 * 				// !!! error on unknown name
 * 			}
 * 		}
 * 	}
 *
 * 	if len(rootFiles) > 0 {
 * 		loader.addAutomaticTypeDirectiveTasks()
 * 	}
 *
 * 	loader.filesParser.parse(&loader, loader.rootTasks)
 *
 * 	// Clear out loader and host to ensure its not used post program creation
 * 	loader.projectReferenceFileMapper.loader = nil
 * 	loader.projectReferenceFileMapper.host = nil
 *
 * 	return loader.filesParser.getProcessedFiles(&loader)
 * }
 */
export declare function processAllProgramFiles(opts: ProgramOptions, singleThreaded: bool): processedFiles;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.toPath","kind":"method","status":"implemented","sigHash":"7c9074c3d28cdd4479feef6e1fe40c3c70ab3d0918765a966f719f08949747b4","bodyHash":"9631877cd97a7240a54e42cc55ab4571dacc24837ef8312c29601a72cbf4dd28"}
 *
 * Go source:
 * func (p *fileLoader) toPath(file string) tspath.Path {
 * 	return tspath.ToPath(file, p.opts.Host.GetCurrentDirectory(), p.opts.Host.FS().UseCaseSensitiveFileNames())
 * }
 */
export declare function fileLoader_toPath(receiver: GoPtr<fileLoader>, file: string): Path_9073472b;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.addRootTask","kind":"method","status":"implemented","sigHash":"f3c47eb09c6c8037dceb4cd1fc8294827d3fd23c33a47efb3bce00d555752408","bodyHash":"b8c4a28214ecd5bb09d1bfb2fe1a7a56eda4226b73f22287f28760dd51777035"}
 *
 * Go source:
 * func (p *fileLoader) addRootTask(fileName string, libFile *LibFile, includeReason *FileIncludeReason) {
 * 	absPath := tspath.GetNormalizedAbsolutePath(fileName, p.opts.Host.GetCurrentDirectory())
 * 	if p.opts.Config.CompilerOptions().AllowNonTsExtensions.IsTrue() || tspath.HasExtension(absPath) {
 * 		p.rootTasks = append(p.rootTasks, &parseTask{
 * 			normalizedFilePath: absPath,
 * 			libFile:            libFile,
 * 			includeReason:      includeReason,
 * 		})
 * 	}
 * }
 */
export declare function fileLoader_addRootTask(receiver: GoPtr<fileLoader>, fileName: string, libFile: GoPtr<LibFile>, includeReason: GoPtr<FileIncludeReason>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.addRootFileTask","kind":"method","status":"implemented","sigHash":"a071cb8c5c4e4dff113edf5f094da60e566c68d7c5b18b38905d7621fea6c305","bodyHash":"0f0572225075257726c994bbe42000170e104120165d9481d485937729309773"}
 *
 * Go source:
 * func (p *fileLoader) addRootFileTask(fileName string, libFile *LibFile, includeReason *FileIncludeReason) {
 * 	currDir := p.opts.Host.GetCurrentDirectory()
 * 	absPath := tspath.GetNormalizedAbsolutePath(fileName, currDir)
 * 	containingFile := currDir
 * 	if p.opts.Config.ConfigFile != nil {
 * 		containingFile = tspath.GetNormalizedAbsolutePath(p.opts.Config.ConfigFile.SourceFile.FileName(), currDir)
 * 	}
 * 	resolvedFile, diagnostic := p.getSourceFileFromReference(absPath, fileName, containingFile, includeReason)
 * 	rootTask := &parseTask{
 * 		normalizedFilePath: resolvedFile,
 * 		libFile:            libFile,
 * 		includeReason:      includeReason,
 * 	}
 * 	if diagnostic != nil {
 * 		rootTask.normalizedFilePath = absPath
 * 		rootTask.processingDiagnostics = []*processingDiagnostic{{
 * 			kind: processingDiagnosticKindExplainingFileInclude,
 * 			data: &includeExplainingDiagnostic{
 * 				diagnosticReason: includeReason,
 * 				message:          diagnostic.message,
 * 				args:             diagnostic.args,
 * 			},
 * 		}}
 * 	}
 * 	p.rootTasks = append(p.rootTasks, rootTask)
 * }
 */
export declare function fileLoader_addRootFileTask(receiver: GoPtr<fileLoader>, fileName: string, libFile: GoPtr<LibFile>, includeReason: GoPtr<FileIncludeReason>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.addAutomaticTypeDirectiveTasks","kind":"method","status":"implemented","sigHash":"f5d5a87ae477bd51246a8626c53a867cd6f1fc2005079eff03a78995ed2effe4","bodyHash":"d3560a6225f4742de9947bc72c01ac1d6a81b47d038229d5ac68b4a258ae2b08"}
 *
 * Go source:
 * func (p *fileLoader) addAutomaticTypeDirectiveTasks() {
 * 	var containingDirectory string
 * 	compilerOptions := p.opts.Config.CompilerOptions()
 * 	if compilerOptions.ConfigFilePath != "" {
 * 		containingDirectory = tspath.GetDirectoryPath(compilerOptions.ConfigFilePath)
 * 	} else {
 * 		containingDirectory = p.opts.Host.GetCurrentDirectory()
 * 	}
 * 	containingFileName := tspath.CombinePaths(containingDirectory, module.InferredTypesContainingFile)
 * 	p.rootTasks = append(p.rootTasks, &parseTask{
 * 		normalizedFilePath:          containingFileName,
 * 		isForAutomaticTypeDirective: true,
 * 	})
 * }
 */
export declare function fileLoader_addAutomaticTypeDirectiveTasks(receiver: GoPtr<fileLoader>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.resolveAutomaticTypeDirectives","kind":"method","status":"implemented","sigHash":"d5630a21f4c873881f4d09a4a659e797d51c13879d5787cde8b7fc03204fb7e2","bodyHash":"4c2ad4bce41cf4536367bc81da99da3c94ecf47ceed7318cfd12d0c9d62752a2"}
 *
 * Go source:
 * func (p *fileLoader) resolveAutomaticTypeDirectives(containingFileName string) (
 * 	toParse []resolvedRef,
 * 	typeResolutionsInFile module.ModeAwareCache[*module.ResolvedTypeReferenceDirective],
 * 	typeResolutionsTrace []module.DiagAndArgs,
 * 	pDiagnostics []*processingDiagnostic,
 * ) {
 * 	automaticTypeDirectiveNames := module.GetAutomaticTypeDirectiveNames(p.opts.Config.CompilerOptions(), p.opts.Host)
 * 	if len(automaticTypeDirectiveNames) != 0 {
 * 		toParse = make([]resolvedRef, 0, len(automaticTypeDirectiveNames))
 * 		typeResolutionsInFile = make(module.ModeAwareCache[*module.ResolvedTypeReferenceDirective], len(automaticTypeDirectiveNames))
 * 		for _, name := range automaticTypeDirectiveNames {
 * 			// Under node16/nodenext module resolution, load `types`/ata include names as cjs resolution results by passing an `undefined` mode.
 * 			// Under bundler module resolution, this also triggers the "import" condition to be used.
 * 			resolutionMode := core.ResolutionModeNone
 * 			resolved, trace := p.resolver.ResolveTypeReferenceDirective(name, containingFileName, resolutionMode, nil)
 * 			var traceDone func()
 * 			if p.opts.Tracing != nil {
 * 				traceDone = p.opts.Tracing.Push(tracing.PhaseProgram, "processTypeReferenceDirective", map[string]any{"directive": name, "hasResolved": resolved.IsResolved(), "refKind": int(fileIncludeKindAutomaticTypeDirectiveFile)}, false)
 * 			}
 * 			typeResolutionsInFile[module.ModeAwareCacheKey{Name: name, Mode: resolutionMode}] = resolved
 * 			typeResolutionsTrace = append(typeResolutionsTrace, trace...)
 * 			if resolved.IsResolved() {
 * 				toParse = append(toParse, resolvedRef{
 * 					fileName:      resolved.ResolvedFileName,
 * 					increaseDepth: resolved.IsExternalLibraryImport,
 * 					elideOnDepth:  false,
 * 					includeReason: &FileIncludeReason{
 * 						kind: fileIncludeKindAutomaticTypeDirectiveFile,
 * 						data: &automaticTypeDirectiveFileData{name, resolved.PackageId},
 * 					},
 * 					packageId: resolved.PackageId,
 * 				})
 * 			} else {
 * 				pDiagnostics = append(pDiagnostics, &processingDiagnostic{
 * 					kind: processingDiagnosticKindExplainingFileInclude,
 * 					data: &includeExplainingDiagnostic{
 * 						diagnosticReason: &FileIncludeReason{
 * 							kind: fileIncludeKindAutomaticTypeDirectiveFile,
 * 							data: &automaticTypeDirectiveFileData{typeReference: name},
 * 						},
 * 						message: diagnostics.Cannot_find_type_definition_file_for_0,
 * 						args:    []any{name},
 * 					},
 * 				})
 * 			}
 * 			if traceDone != nil {
 * 				traceDone()
 * 			}
 * 		}
 * 	}
 * 	return toParse, typeResolutionsInFile, typeResolutionsTrace, pDiagnostics
 * }
 */
export declare function fileLoader_resolveAutomaticTypeDirectives(receiver: GoPtr<fileLoader>, containingFileName: string): [GoSlice<resolvedRef>, ModeAwareCache<GoPtr<ResolvedTypeReferenceDirective>>, GoSlice<DiagAndArgs>, GoSlice<GoPtr<processingDiagnostic>>];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.addProjectReferenceTasks","kind":"method","status":"implemented","sigHash":"414eafd094b4778ca682c98d86977ed3cd737b1860570319ced4831b56ecbf84","bodyHash":"7c6f771759c491825ca11f95b609fae7c7e226f46d2ffd3cd63e5f1e927d135e"}
 *
 * Go source:
 * func (p *fileLoader) addProjectReferenceTasks(singleThreaded bool) {
 * 	p.projectReferenceFileMapper = &projectReferenceFileMapper{
 * 		opts: p.opts,
 * 		host: p.opts.Host,
 * 	}
 * 	projectReferences := p.opts.Config.ResolvedProjectReferencePaths()
 * 	if len(projectReferences) == 0 {
 * 		return
 * 	}
 *
 * 	parser := &projectReferenceParser{
 * 		loader: p,
 * 		wg:     core.NewWorkGroup(singleThreaded),
 * 	}
 * 	rootTasks := createProjectReferenceParseTasks(projectReferences)
 * 	parser.parse(rootTasks)
 * }
 */
export declare function fileLoader_addProjectReferenceTasks(receiver: GoPtr<fileLoader>, singleThreaded: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.sortLibs","kind":"method","status":"implemented","sigHash":"089062017b14852bc2a6a6fb030d1dbccfc3eaa83357f5b30372c9aadb0b78d1","bodyHash":"ef72130b66802cb219b02ce3f51b01e511ba45550d812e491831edf7ef3dfb96"}
 *
 * Go source:
 * func (p *fileLoader) sortLibs(libFiles []*ast.SourceFile) {
 * 	slices.SortFunc(libFiles, func(f1 *ast.SourceFile, f2 *ast.SourceFile) int {
 * 		return cmp.Compare(p.getDefaultLibFilePriority(f1), p.getDefaultLibFilePriority(f2))
 * 	})
 * }
 */
export declare function fileLoader_sortLibs(receiver: GoPtr<fileLoader>, libFiles: GoSlice<GoPtr<SourceFile>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.getDefaultLibFilePriority","kind":"method","status":"implemented","sigHash":"29ee2103e7fd671229456e38cd308ceb42905ea2e5b1483bf0abda56ec00b434","bodyHash":"c9c7c67c7b3230a46837eb0ed7c5266c270e35b95f8e8fba8e5cd2ec6813e08a"}
 *
 * Go source:
 * func (p *fileLoader) getDefaultLibFilePriority(a *ast.SourceFile) int {
 * 	// defaultLibraryPath and a.FileName() are absolute and normalized; a prefix check should suffice.
 * 	defaultLibraryPath := tspath.RemoveTrailingDirectorySeparator(p.defaultLibraryPath)
 * 	aFileName := a.FileName()
 *
 * 	if strings.HasPrefix(aFileName, defaultLibraryPath) && len(aFileName) > len(defaultLibraryPath) && aFileName[len(defaultLibraryPath)] == tspath.DirectorySeparator {
 * 		// avoid tspath.GetBaseFileName; we know these paths are already absolute and normalized.
 * 		basename := aFileName[strings.LastIndexByte(aFileName, tspath.DirectorySeparator)+1:]
 * 		if basename == "lib.d.ts" || basename == "lib.es6.d.ts" {
 * 			return 0
 * 		}
 * 		name := strings.TrimSuffix(strings.TrimPrefix(basename, "lib."), ".d.ts")
 * 		index := slices.Index(tsoptions.Libs, name)
 * 		if index != -1 {
 * 			return index + 1
 * 		}
 * 	}
 * 	return len(tsoptions.Libs) + 2
 * }
 */
export declare function fileLoader_getDefaultLibFilePriority(receiver: GoPtr<fileLoader>, a: GoPtr<SourceFile>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.loadSourceFileMetaData","kind":"method","status":"implemented","sigHash":"52b29481881acea04f31c6031f028ef2d8dd0bb77e94245bbfa6d3738f7b12a2","bodyHash":"0b67c7e4d0c687b4e8b65171f738960dc56d8b732b97620160aaeac15581a66c"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"Provider virtual modules have no package.json scope; physical files still use the exact TS-Go metadata path."}
 *
 * Go source:
 * func (p *fileLoader) loadSourceFileMetaData(fileName string) ast.SourceFileMetaData {
 * 	packageJsonScope := p.resolver.GetPackageScopeForPath(tspath.GetDirectoryPath(fileName))
 * 	moduleResolutionKind := p.opts.Config.CompilerOptions().GetModuleResolutionKind()
 *
 * 	var packageJsonType, packageJsonDirectory string
 * 	if packageJsonScope.Exists() {
 * 		packageJsonDirectory = packageJsonScope.PackageDirectory
 * 		if value, ok := packageJsonScope.Contents.Type.GetValue(); ok {
 * 			if !tspath.FileExtensionIsOneOf(fileName, []string{tspath.ExtensionMts, tspath.ExtensionCts, tspath.ExtensionMjs, tspath.ExtensionCjs}) &&
 * 				core.ModuleResolutionKindNode16 <= moduleResolutionKind && moduleResolutionKind <= core.ModuleResolutionKindNodeNext || strings.Contains(fileName, "/node_modules/") {
 * 				packageJsonType = value
 * 			}
 * 		}
 * 	}
 *
 * 	impliedNodeFormat := ast.GetImpliedNodeFormatForFile(fileName, packageJsonType)
 * 	return ast.SourceFileMetaData{
 * 		PackageJsonType:      packageJsonType,
 * 		PackageJsonDirectory: packageJsonDirectory,
 * 		ImpliedNodeFormat:    impliedNodeFormat,
 * 	}
 * }
 */
export declare function fileLoader_loadSourceFileMetaData(receiver: GoPtr<fileLoader>, fileName: string): SourceFileMetaData;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.parseSourceFile","kind":"method","status":"implemented","sigHash":"45c6977d82282b19c08f6059d643aa2034209ab4ddf126043c0fffae9e981589","bodyHash":"28b5a6e09da0f3ba3f68069ea7ec09c3a3d7c56c72dd2aad6b19746d4dd8ed8c"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"Provider virtual modules are parsed from structured provider source text instead of the host filesystem; physical files still call Host.GetSourceFile exactly as TS-Go does."}
 *
 * Go source:
 * func (p *fileLoader) parseSourceFile(t *parseTask) *ast.SourceFile {
 * 	if p.opts.Tracing != nil {
 * 		defer p.opts.Tracing.Push(tracing.PhaseParse, "createSourceFile", map[string]any{"path": t.normalizedFilePath}, true)()
 * 	}
 * 	path := p.toPath(t.normalizedFilePath)
 * 	options := p.projectReferenceFileMapper.getCompilerOptionsForFile(t)
 * 	sourceFile := p.opts.Host.GetSourceFile(ast.SourceFileParseOptions{
 * 		FileName:                       t.normalizedFilePath,
 * 		Path:                           path,
 * 		ExternalModuleIndicatorOptions: ast.GetExternalModuleIndicatorOptions(t.normalizedFilePath, options, t.metadata),
 * 	})
 * 	return sourceFile
 * }
 */
export declare function fileLoader_parseSourceFile(receiver: GoPtr<fileLoader>, t: GoPtr<parseTask>): GoPtr<SourceFile>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.isSupportedExtension","kind":"method","status":"implemented","sigHash":"815105cde155224009eeae741a7901f7d4f1cd7c0e1e87ee3da4d48f080171ee","bodyHash":"130842c3ebf6435390d1db20debd0dea05d3dff30a9ec4cb8aede777c00a72d7"}
 *
 * Go source:
 * func (p *fileLoader) isSupportedExtension(canonicalFileName string) bool {
 * 	for _, group := range p.supportedExtensionsWithJsonIfResolveJsonModule {
 * 		if tspath.FileExtensionIsOneOf(canonicalFileName, group) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function fileLoader_isSupportedExtension(receiver: GoPtr<fileLoader>, canonicalFileName: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.getSourceFileFromReference","kind":"method","status":"implemented","sigHash":"aa8770197d1fc35b01983334e70441bfcf0222c038a99f1fb32f2a5a9e57e4fe","bodyHash":"403124a48ec3b00d8f2e2dcb9947686a54d1462727de465dc7c6504ef82b80dd"}
 *
 * Go source:
 * func (p *fileLoader) getSourceFileFromReference(
 * 	fileName string,
 * 	referenceText string,
 * 	containingFile string,
 * 	includeReason *FileIncludeReason,
 * ) (string, *sourceFileFromReferenceDiagnostic) {
 * 	options := p.opts.Config.CompilerOptions()
 * 	allowNonTsExtensions := options.AllowNonTsExtensions.IsTrue()
 * 	diagnosticFileName := tspath.NormalizeSlashes(referenceText)
 *
 * 	if tspath.HasExtension(fileName) {
 * 		canonicalFileName := tspath.GetCanonicalFileName(fileName, p.opts.Host.FS().UseCaseSensitiveFileNames())
 * 		if !allowNonTsExtensions && !p.isSupportedExtension(canonicalFileName) {
 * 			if tspath.HasJSFileExtension(canonicalFileName) {
 * 				return "", &sourceFileFromReferenceDiagnostic{message: diagnostics.File_0_is_a_JavaScript_file_Did_you_mean_to_enable_the_allowJs_option, args: []any{diagnosticFileName}}
 * 			}
 * 			return "", &sourceFileFromReferenceDiagnostic{message: diagnostics.File_0_has_an_unsupported_extension_The_only_supported_extensions_are_1, args: []any{diagnosticFileName, "'" + strings.Join(core.Flatten(p.supportedExtensions), "', '") + "'"}}
 * 		}
 *
 * 		if !p.opts.Host.FS().FileExists(fileName) {
 * 			return "", &sourceFileFromReferenceDiagnostic{message: diagnostics.File_0_not_found, args: []any{diagnosticFileName}}
 * 		}
 *
 * 		if includeReason.isReferencedFile() && tspath.GetCanonicalFileName(containingFile, p.opts.Host.FS().UseCaseSensitiveFileNames()) == canonicalFileName {
 * 			return "", &sourceFileFromReferenceDiagnostic{message: diagnostics.A_file_cannot_have_a_reference_to_itself}
 * 		}
 * 		return fileName, nil
 * 	}
 *
 * 	if allowNonTsExtensions && p.opts.Host.FS().FileExists(fileName) {
 * 		return fileName, nil
 * 	}
 *
 * 	if allowNonTsExtensions {
 * 		return "", &sourceFileFromReferenceDiagnostic{message: diagnostics.File_0_not_found, args: []any{diagnosticFileName}}
 * 	}
 *
 * 	for _, ext := range p.supportedExtensions[0] {
 * 		candidate := fileName + ext
 * 		if p.opts.Host.FS().FileExists(candidate) {
 * 			return candidate, nil
 * 		}
 * 	}
 *
 * 	return "", &sourceFileFromReferenceDiagnostic{message: diagnostics.Could_not_resolve_the_path_0_with_the_extensions_Colon_1, args: []any{diagnosticFileName, "'" + strings.Join(core.Flatten(p.supportedExtensions), "', '") + "'"}}
 * }
 */
export declare function fileLoader_getSourceFileFromReference(receiver: GoPtr<fileLoader>, fileName: string, referenceText: string, containingFile: string, includeReason: GoPtr<FileIncludeReason>): [string, GoPtr<sourceFileFromReferenceDiagnostic>];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.resolveTripleslashPathReference","kind":"method","status":"implemented","sigHash":"dc1782934b78538f4b4e345dc9f82cb86d9a14bb07fcb202249d66017806a553","bodyHash":"f299bf40a882589570f87a88a47d8e02b3125f8bad6996f3bd7cedfb89b765aa"}
 *
 * Go source:
 * func (p *fileLoader) resolveTripleslashPathReference(moduleName string, containingFile string, index int) (*resolvedRef, *processingDiagnostic) {
 * 	basePath := tspath.GetDirectoryPath(containingFile)
 * 	referencedFileName := moduleName
 *
 * 	if !tspath.IsRootedDiskPath(moduleName) {
 * 		referencedFileName = tspath.CombinePaths(basePath, moduleName)
 * 	}
 * 	normalizedFileName := tspath.NormalizePath(referencedFileName)
 * 	includeReason := &FileIncludeReason{
 * 		kind: fileIncludeKindReferenceFile,
 * 		data: &referencedFileData{
 * 			file:  p.toPath(containingFile),
 * 			index: index,
 * 		},
 * 	}
 *
 * 	resolvedFileName, diagnostic := p.getSourceFileFromReference(
 * 		normalizedFileName,
 * 		moduleName,
 * 		containingFile,
 * 		includeReason,
 * 	)
 * 	if diagnostic != nil {
 * 		return nil, &processingDiagnostic{
 * 			kind: processingDiagnosticKindExplainingFileInclude,
 * 			data: &includeExplainingDiagnostic{
 * 				diagnosticReason: includeReason,
 * 				message:          diagnostic.message,
 * 				args:             diagnostic.args,
 * 			},
 * 		}
 * 	}
 *
 * 	return &resolvedRef{
 * 		fileName:      resolvedFileName,
 * 		includeReason: includeReason,
 * 	}, nil
 * }
 */
export declare function fileLoader_resolveTripleslashPathReference(receiver: GoPtr<fileLoader>, moduleName: string, containingFile: string, index: int): [GoPtr<resolvedRef>, GoPtr<processingDiagnostic>];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.resolveTypeReferenceDirectives","kind":"method","status":"implemented","sigHash":"3ceb6eaf8b39721cdbeb0a7e0db48b1fbb489ceffa7421c841664b85ec63b78f","bodyHash":"550e99bd1dd2f8aeb163ec0c22c09029fdeed846c49f65566949512cf48ba359"}
 *
 * Go source:
 * func (p *fileLoader) resolveTypeReferenceDirectives(t *parseTask) {
 * 	file := t.file
 * 	if len(file.TypeReferenceDirectives) == 0 {
 * 		return
 * 	}
 * 	if p.opts.Tracing != nil {
 * 		defer p.opts.Tracing.Push(tracing.PhaseProgram, "resolveTypeReferenceDirectiveNamesWorker", map[string]any{"containingFileName": file.FileName()}, false)()
 * 	}
 * 	meta := t.metadata
 *
 * 	typeResolutionsInFile := make(module.ModeAwareCache[*module.ResolvedTypeReferenceDirective], len(file.TypeReferenceDirectives))
 * 	var typeResolutionsTrace []module.DiagAndArgs
 * 	for index, ref := range file.TypeReferenceDirectives {
 * 		redirect, fileName := p.projectReferenceFileMapper.getRedirectForResolution(file)
 * 		resolutionMode := getModeForTypeReferenceDirectiveInFile(ref, file, meta, module.GetCompilerOptionsWithRedirect(p.opts.Config.CompilerOptions(), redirect))
 * 		resolved, trace := p.resolver.ResolveTypeReferenceDirective(ref.FileName, fileName, resolutionMode, redirect)
 * 		var traceDone func()
 * 		if p.opts.Tracing != nil {
 * 			traceDone = p.opts.Tracing.Push(tracing.PhaseProgram, "processTypeReferenceDirective", map[string]any{"directive": ref.FileName, "hasResolved": resolved.IsResolved(), "refKind": int(fileIncludeKindTypeReferenceDirective), "refPath": string(t.path)}, false)
 * 		}
 * 		typeResolutionsInFile[module.ModeAwareCacheKey{Name: ref.FileName, Mode: resolutionMode}] = resolved
 * 		includeReason := &FileIncludeReason{
 * 			kind: fileIncludeKindTypeReferenceDirective,
 * 			data: &referencedFileData{
 * 				file:  t.path,
 * 				index: index,
 * 			},
 * 		}
 * 		typeResolutionsTrace = append(typeResolutionsTrace, trace...)
 *
 * 		if resolved.IsResolved() {
 * 			t.addSubTask(resolvedRef{
 * 				fileName:      resolved.ResolvedFileName,
 * 				increaseDepth: resolved.IsExternalLibraryImport,
 * 				elideOnDepth:  false,
 * 				includeReason: includeReason,
 * 				packageId:     resolved.PackageId,
 * 			}, nil)
 * 		} else {
 * 			t.processingDiagnostics = append(t.processingDiagnostics, &processingDiagnostic{
 * 				kind: processingDiagnosticKindUnknownReference,
 * 				data: includeReason,
 * 			})
 * 		}
 * 		if traceDone != nil {
 * 			traceDone()
 * 		}
 * 	}
 *
 * 	t.typeResolutionsInFile = typeResolutionsInFile
 * 	t.typeResolutionsTrace = typeResolutionsTrace
 * }
 */
export declare function fileLoader_resolveTypeReferenceDirectives(receiver: GoPtr<fileLoader>, t: GoPtr<parseTask>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::constGroup::externalHelpersModuleNameText","kind":"constGroup","status":"implemented","sigHash":"42b8d30f6cec123c960fc65215bb7957d60e1e2100a713e6f60422dd65ee175e","bodyHash":"9598756e07f54fbbeeb49a14467ace04549a5c8108fe4f60b889da06a509b940"}
 *
 * Go source:
 * const externalHelpersModuleNameText = "tslib"
 */
export declare const externalHelpersModuleNameText: string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.resolveImportsAndModuleAugmentations","kind":"method","status":"implemented","sigHash":"30cd1cfb29885870bb53f7e50b9173e5bd146206f9dd8a020faf33710e3f44dc","bodyHash":"4171ca82fab8e6403e0310bc745bd8eb0680c1c25558125fe9ff409afeaecafd"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"Provider-owned module specifiers resolve through TargetBindingProvider before physical module resolution; unowned modules and no-extension programs remain on the exact TS-Go path, and owned rejection does not fall back to files."}
 *
 * Go source:
 * func (p *fileLoader) resolveImportsAndModuleAugmentations(t *parseTask) {
 * 	if p.opts.Tracing != nil {
 * 		defer p.opts.Tracing.Push(tracing.PhaseProgram, "resolveModuleNamesWorker", map[string]any{"containingFileName": t.file.FileName()}, false)()
 * 	}
 * 	file := t.file
 * 	meta := t.metadata
 *
 * 	moduleNames := make([]*ast.Node, 0, len(file.Imports())+len(file.ModuleAugmentations)+2)
 *
 * 	isJavaScriptFile := ast.IsSourceFileJS(file)
 * 	isExternalModuleFile := ast.IsExternalModule(file)
 *
 * 	redirect, fileName := p.projectReferenceFileMapper.getRedirectForResolution(file)
 * 	optionsForFile := module.GetCompilerOptionsWithRedirect(p.opts.Config.CompilerOptions(), redirect)
 * 	if isJavaScriptFile || (!file.IsDeclarationFile && (optionsForFile.GetIsolatedModules() || isExternalModuleFile)) {
 * 		if optionsForFile.ImportHelpers.IsTrue() {
 * 			specifier := p.createSyntheticImport(externalHelpersModuleNameText, file)
 * 			moduleNames = append(moduleNames, specifier)
 * 			t.importHelpersImportSpecifier = specifier
 * 		}
 * 	}
 *
 * 	if file.ScriptKind == core.ScriptKindJSX || file.ScriptKind == core.ScriptKindTSX {
 * 		jsxImport := ast.GetJSXRuntimeImport(ast.GetJSXImplicitImportBase(optionsForFile, file), optionsForFile)
 * 		if jsxImport != "" {
 * 			specifier := p.createSyntheticImport(jsxImport, file)
 * 			moduleNames = append(moduleNames, specifier)
 * 			t.jsxRuntimeImportSpecifier = &jsxRuntimeImportSpecifier{
 * 				moduleReference: jsxImport,
 * 				specifier:       specifier,
 * 			}
 * 		}
 * 	}
 *
 * 	importsStart := len(moduleNames)
 *
 * 	moduleNames = append(moduleNames, file.Imports()...)
 * 	for _, imp := range file.ModuleAugmentations {
 * 		if imp.Kind == ast.KindStringLiteral {
 * 			moduleNames = append(moduleNames, imp)
 * 		}
 * 		// Do nothing if it's an Identifier; we don't need to do module resolution for `declare global`.
 * 	}
 *
 * 	if len(moduleNames) != 0 {
 * 		resolutionsInFile := make(module.ModeAwareCache[*module.ResolvedModule], len(moduleNames))
 * 		var resolutionsTrace []module.DiagAndArgs
 *
 * 		for index, entry := range moduleNames {
 * 			moduleName := entry.Text()
 * 			if moduleName == "" {
 * 				continue
 * 			}
 *
 * 			mode := getModeForUsageLocation(file.FileName(), meta, entry, optionsForFile)
 * 			resolvedModule, trace := p.resolver.ResolveModuleName(moduleName, fileName, mode, redirect)
 * 			resolutionsInFile[module.ModeAwareCacheKey{Name: moduleName, Mode: mode}] = resolvedModule
 * 			resolutionsTrace = append(resolutionsTrace, trace...)
 *
 * 			if !resolvedModule.IsResolved() {
 * 				continue
 * 			}
 *
 * 			resolvedFileName := resolvedModule.ResolvedFileName
 * 			isFromNodeModulesSearch := resolvedModule.IsExternalLibraryImport
 * 			// Don't treat redirected files as JS files.
 * 			isJsFile := !tspath.FileExtensionIsOneOf(resolvedFileName, tspath.SupportedTSExtensionsWithJsonFlat) && p.projectReferenceFileMapper.getRedirectParsedCommandLineForResolution(ast.NewHasFileName(resolvedFileName, p.toPath(resolvedFileName))) == nil
 * 			isJsFileFromNodeModules := isFromNodeModulesSearch && isJsFile && strings.Contains(resolvedFileName, "/node_modules/")
 *
 * 			// add file to program only if:
 * 			// - resolution was successful
 * 			// - noResolve is falsy
 * 			// - module name comes from the list of imports
 * 			// - it's not a top level JavaScript module that exceeded the search max
 *
 * 			importIndex := index - importsStart
 *
 * 			shouldAddFile := moduleName != "" &&
 * 				module.GetResolutionDiagnostic(optionsForFile, resolvedModule, file) == nil &&
 * 				!optionsForFile.NoResolve.IsTrue() &&
 * 				!(isJsFile && !optionsForFile.GetAllowJS()) &&
 * 				(importIndex < 0 || (importIndex < len(file.Imports()) && (ast.IsInJSFile(file.Imports()[importIndex]) || file.Imports()[importIndex].Flags&ast.NodeFlagsJSDoc == 0)))
 *
 * 			if shouldAddFile {
 * 				t.addSubTask(resolvedRef{
 * 					fileName:      resolvedFileName,
 * 					increaseDepth: resolvedModule.IsExternalLibraryImport,
 * 					elideOnDepth:  isJsFileFromNodeModules,
 * 					includeReason: &FileIncludeReason{
 * 						kind: fileIncludeKindImport,
 * 						data: &referencedFileData{
 * 							file:      t.path,
 * 							index:     importIndex,
 * 							synthetic: core.IfElse(importIndex < 0, entry, nil),
 * 						},
 * 					},
 * 					packageId: resolvedModule.PackageId,
 * 				}, nil)
 * 			}
 * 		}
 *
 * 		t.resolutionsInFile = resolutionsInFile
 * 		t.resolutionsTrace = resolutionsTrace
 * 	}
 * }
 */
export declare function fileLoader_resolveImportsAndModuleAugmentations(receiver: GoPtr<fileLoader>, t: GoPtr<parseTask>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.createSyntheticImport","kind":"method","status":"implemented","sigHash":"7506739428c6fe0901660f04fe5dadabc7edef1f9e9d8f4e31d2e403be2ff222","bodyHash":"60cb368221790967dac9258ee6f2c17b041fa4958887ed5c708b1b7024ac9b06"}
 *
 * Go source:
 * func (p *fileLoader) createSyntheticImport(text string, file *ast.SourceFile) *ast.StringLiteralNode {
 * 	p.factoryMu.Lock()
 * 	defer p.factoryMu.Unlock()
 * 	externalHelpersModuleReference := p.factory.NewStringLiteral(text, ast.TokenFlagsNone)
 * 	importDecl := p.factory.NewImportDeclaration(nil, nil, externalHelpersModuleReference, nil)
 * 	externalHelpersModuleReference.Parent = importDecl
 * 	importDecl.Parent = file.AsNode()
 * 	return externalHelpersModuleReference
 * }
 */
export declare function fileLoader_createSyntheticImport(receiver: GoPtr<fileLoader>, text: string, file: GoPtr<SourceFile>): GoPtr<StringLiteralNode>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.pathForLibFile","kind":"method","status":"implemented","sigHash":"b2680645d713772d080c54de200347fdb7ec655d4e99847a4093a2537faf0b06","bodyHash":"4960e9e4f465d31610cfae01bf77be4f15ffa0837bb4c20873f17ee46da65e30"}
 *
 * Go source:
 * func (p *fileLoader) pathForLibFile(name string) *LibFile {
 * 	if cached, ok := p.pathForLibFileCache.Load(name); ok {
 * 		return cached
 * 	}
 *
 * 	path := tspath.CombinePaths(p.defaultLibraryPath, name)
 * 	replaced := false
 * 	if p.opts.Config.CompilerOptions().LibReplacement.IsTrue() && name != "lib.d.ts" {
 * 		libraryName := getLibraryNameFromLibFileName(name)
 * 		resolveFrom := getInferredLibraryNameResolveFrom(p.opts.Config.CompilerOptions(), p.opts.Host.GetCurrentDirectory(), name)
 * 		resolution, trace := p.resolveLibrary(libraryName, resolveFrom)
 * 		if resolution.IsResolved() {
 * 			path = resolution.ResolvedFileName
 * 			replaced = true
 * 		}
 * 		p.pathForLibFileResolutions.LoadOrStore(p.toPath(resolveFrom), &libResolution{
 * 			libraryName: libraryName,
 * 			resolution:  resolution,
 * 			trace:       trace,
 * 		})
 * 	}
 *
 * 	libPath, _ := p.pathForLibFileCache.LoadOrStore(name, &LibFile{name, path, replaced})
 * 	return libPath
 * }
 */
export declare function fileLoader_pathForLibFile(receiver: GoPtr<fileLoader>, name: string): GoPtr<LibFile>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.resolveLibrary","kind":"method","status":"implemented","sigHash":"39cc443bb78b3ec22b291425386d2286803c465de79b3999527058e33f976863","bodyHash":"3ddbfe4ac5194990404adaf2dc8a5806d8fe91eb7c58fe6c10bbe71ce35c8088"}
 *
 * Go source:
 * func (p *fileLoader) resolveLibrary(libraryName, resolveFrom string) (*module.ResolvedModule, []module.DiagAndArgs) {
 * 	if tr := p.opts.Tracing; tr != nil {
 * 		defer tr.Push(tracing.PhaseProgram, "resolveLibrary", map[string]any{"resolveFrom": resolveFrom}, false)()
 * 	}
 * 	return p.resolver.ResolveModuleName(libraryName, resolveFrom, core.ModuleKindCommonJS, nil)
 * }
 */
export declare function fileLoader_resolveLibrary(receiver: GoPtr<fileLoader>, libraryName: string, resolveFrom: string): [GoPtr<ResolvedModule>, GoSlice<DiagAndArgs>];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::func::getLibraryNameFromLibFileName","kind":"func","status":"implemented","sigHash":"8793ce508273544979b21a5ac0ff1988bf37e86c992abdd87f662666ed290136","bodyHash":"792029ff24d571e1c603d013876d236e33cf8029b0d943428ccf496df2b39d28"}
 *
 * Go source:
 * func getLibraryNameFromLibFileName(libFileName string) string {
 * 	// Support resolving to lib.dom.d.ts -> @typescript/lib-dom, and
 * 	//                      lib.dom.iterable.d.ts -> @typescript/lib-dom/iterable
 * 	//                      lib.es2015.symbol.wellknown.d.ts -> @typescript/lib-es2015/symbol-wellknown
 * 	components := strings.Split(libFileName, ".")
 * 	var path strings.Builder
 * 	path.WriteString("@typescript/lib-")
 * 	if len(components) > 1 {
 * 		path.WriteString(components[1])
 * 	}
 * 	i := 2
 * 	for i < len(components) && components[i] != "" && components[i] != "d" {
 * 		if i == 2 {
 * 			path.WriteByte('/')
 * 		} else {
 * 			path.WriteByte('-')
 * 		}
 * 		path.WriteString(components[i])
 * 		i++
 * 	}
 * 	return path.String()
 * }
 */
export declare function getLibraryNameFromLibFileName(libFileName: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::func::getInferredLibraryNameResolveFrom","kind":"func","status":"implemented","sigHash":"c4da469f2e8f20ea3eebd5e771b5543a607d47862f82a3b65b8e3f6099ef50cc","bodyHash":"65f6f7bf9f794469e2b8a3673a65520bc338f5fc623f8552264b4bd6bea1b373"}
 *
 * Go source:
 * func getInferredLibraryNameResolveFrom(options *core.CompilerOptions, currentDirectory string, libFileName string) string {
 * 	var containingDirectory string
 * 	if options.ConfigFilePath != "" {
 * 		containingDirectory = tspath.GetDirectoryPath(options.ConfigFilePath)
 * 	} else {
 * 		containingDirectory = currentDirectory
 * 	}
 * 	return tspath.CombinePaths(containingDirectory, "__lib_node_modules_lookup_"+libFileName+"__.ts")
 * }
 */
export declare function getInferredLibraryNameResolveFrom(options: GoPtr<CompilerOptions>, currentDirectory: string, libFileName: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::func::getModeForTypeReferenceDirectiveInFile","kind":"func","status":"implemented","sigHash":"9a10fcb7295ac15292b0204f36bf4e92006cb111a9af9017f4faa888cdc0b059","bodyHash":"193ba2d60ba1885ca9933232f1f503ab7ca655597291e9e8e9927384eb35ddd1"}
 *
 * Go source:
 * func getModeForTypeReferenceDirectiveInFile(ref *ast.FileReference, file *ast.SourceFile, meta ast.SourceFileMetaData, options *core.CompilerOptions) core.ResolutionMode {
 * 	if ref.ResolutionMode != core.ResolutionModeNone {
 * 		return ref.ResolutionMode
 * 	} else {
 * 		return getDefaultResolutionModeForFile(file.FileName(), meta, options)
 * 	}
 * }
 */
export declare function getModeForTypeReferenceDirectiveInFile(ref: GoPtr<FileReference>, file: GoPtr<SourceFile>, meta: SourceFileMetaData, options: GoPtr<CompilerOptions>): ResolutionMode;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::func::getDefaultResolutionModeForFile","kind":"func","status":"implemented","sigHash":"ce824386f11d93f13230aebf5fae6d83d6ae6ec5a3394a2a52c93d9c5c97bd7e","bodyHash":"7b3a0ab701cd68aa26014972e6aca8b586e26306c80ccb31996798eaec4b061c"}
 *
 * Go source:
 * func getDefaultResolutionModeForFile(fileName string, meta ast.SourceFileMetaData, options *core.CompilerOptions) core.ResolutionMode {
 * 	if importSyntaxAffectsModuleResolution(options) {
 * 		return ast.GetImpliedNodeFormatForEmitWorker(fileName, options.GetEmitModuleKind(), meta)
 * 	} else {
 * 		return core.ResolutionModeNone
 * 	}
 * }
 */
export declare function getDefaultResolutionModeForFile(fileName: string, meta: SourceFileMetaData, options: GoPtr<CompilerOptions>): ResolutionMode;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::func::getModeForUsageLocation","kind":"func","status":"implemented","sigHash":"58050306a95793ddc695fa0585e8d32351baa9743b2db0cc12e2909733e0cc5d","bodyHash":"0564aca300fd99097ce4ac3c0df13752f0fd6b7c6b9da06cc1bbcd06922909f8"}
 *
 * Go source:
 * func getModeForUsageLocation(fileName string, meta ast.SourceFileMetaData, usage *ast.StringLiteralLike, options *core.CompilerOptions) core.ResolutionMode {
 * 	if ast.IsImportDeclaration(usage.Parent) || usage.Parent.Kind == ast.KindJSImportDeclaration || ast.IsExportDeclaration(usage.Parent) || ast.IsJSDocImportTag(usage.Parent) {
 * 		isTypeOnly := ast.IsExclusivelyTypeOnlyImportOrExport(usage.Parent)
 * 		if isTypeOnly {
 * 			var override core.ResolutionMode
 * 			var ok bool
 * 			switch usage.Parent.Kind {
 * 			case ast.KindImportDeclaration, ast.KindJSImportDeclaration:
 * 				override, ok = usage.Parent.AsImportDeclaration().Attributes.GetResolutionModeOverride()
 * 			case ast.KindExportDeclaration:
 * 				override, ok = usage.Parent.AsExportDeclaration().Attributes.GetResolutionModeOverride()
 * 			case ast.KindJSDocImportTag:
 * 				override, ok = usage.Parent.AsJSDocImportTag().Attributes.GetResolutionModeOverride()
 * 			}
 * 			if ok {
 * 				return override
 * 			}
 * 		}
 * 	}
 * 	if ast.IsLiteralTypeNode(usage.Parent) && ast.IsImportTypeNode(usage.Parent.Parent) {
 * 		if override, ok := usage.Parent.Parent.AsImportTypeNode().Attributes.GetResolutionModeOverride(); ok {
 * 			return override
 * 		}
 * 	}
 *
 * 	if options != nil && importSyntaxAffectsModuleResolution(options) {
 * 		return getEmitSyntaxForUsageLocationWorker(fileName, meta, usage, options)
 * 	}
 *
 * 	return core.ResolutionModeNone
 * }
 */
export declare function getModeForUsageLocation(fileName: string, meta: SourceFileMetaData, usage: GoPtr<StringLiteralLike>, options: GoPtr<CompilerOptions>): ResolutionMode;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::func::importSyntaxAffectsModuleResolution","kind":"func","status":"implemented","sigHash":"a2c4d8caab8a7474399ed099b491a329c1aacf86af9b8cd6cb7d1db86485f27e","bodyHash":"22eac4aea406b39b150154b1165d2987818b24e772d249aafe3502ba9dfe4980"}
 *
 * Go source:
 * func importSyntaxAffectsModuleResolution(options *core.CompilerOptions) bool {
 * 	moduleResolution := options.GetModuleResolutionKind()
 * 	return core.ModuleResolutionKindNode16 <= moduleResolution && moduleResolution <= core.ModuleResolutionKindNodeNext ||
 * 		options.GetResolvePackageJsonExports() || options.GetResolvePackageJsonImports()
 * }
 */
export declare function importSyntaxAffectsModuleResolution(options: GoPtr<CompilerOptions>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::func::getEmitSyntaxForUsageLocationWorker","kind":"func","status":"implemented","sigHash":"233a50d9eccacec19528553ffa1d014dadf79f622bf7639bf321b6ca29c174c4","bodyHash":"3fc3b4aeaf98a8d5dc2d7b3dd04f271dfb04895f6dbdfa45a295321277062343"}
 *
 * Go source:
 * func getEmitSyntaxForUsageLocationWorker(fileName string, meta ast.SourceFileMetaData, usage *ast.Node, options *core.CompilerOptions) core.ResolutionMode {
 * 	if ast.IsRequireCall(usage.Parent, false /*requireStringLiteralLikeArgument* /) || ast.IsExternalModuleReference(usage.Parent) && ast.IsImportEqualsDeclaration(usage.Parent.Parent) {
 * 		return core.ModuleKindCommonJS
 * 	}
 * 	fileEmitMode := ast.GetEmitModuleFormatOfFileWorker(fileName, options, meta)
 * 	if ast.IsImportCall(ast.WalkUpParenthesizedExpressions(usage.Parent)) {
 * 		if ast.ShouldTransformImportCall(fileName, options, fileEmitMode) {
 * 			return core.ModuleKindCommonJS
 * 		} else {
 * 			return core.ModuleKindESNext
 * 		}
 * 	}
 * 	// If we're in --module preserve on an input file, we know that an import
 * 	// is an import. But if this is a declaration file, we'd prefer to use the
 * 	// impliedNodeFormat. Since we want things to be consistent between the two,
 * 	// we need to issue errors when the user writes ESM syntax in a definitely-CJS
 * 	// file, until/unless declaration emit can indicate a true ESM import. On the
 * 	// other hand, writing CJS syntax in a definitely-ESM file is fine, since declaration
 * 	// emit preserves the CJS syntax.
 * 	if fileEmitMode == core.ModuleKindCommonJS {
 * 		return core.ModuleKindCommonJS
 * 	} else {
 * 		if fileEmitMode.IsNonNodeESM() || fileEmitMode == core.ModuleKindPreserve {
 * 			return core.ModuleKindESNext
 * 		}
 * 	}
 * 	return core.ModuleKindNone
 * }
 */
export declare function getEmitSyntaxForUsageLocationWorker(fileName: string, meta: SourceFileMetaData, usage: GoPtr<Node>, options: GoPtr<CompilerOptions>): ResolutionMode;
//# sourceMappingURL=fileloader.d.ts.map