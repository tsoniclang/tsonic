import type { bool, int } from "../../go/scalars.js";
import type { GoError, GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { Context } from "../../go/context.js";
import type { Writer } from "../../go/io.js";
import { Once } from "../../go/sync.js";
import { Bool } from "../../go/sync/atomic.js";
import type { CheckJsDirective, CommentDirective, FileReference, HasFileName, Node, SourceFile, SourceFileMetaData, StringLiteralLike } from "../ast/ast.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import type { Checker, Host as CheckerHost, Program as Program_e32ad451 } from "../checker/checker/state.js";
import type { Set } from "../collections/set.js";
import type { SyncMap } from "../collections/syncmap.js";
import type { CompilerOptions, ModuleKind, ModuleResolutionKind, ResolutionMode } from "../core/compileroptions.js";
import type { Tristate } from "../core/tristate.js";
import type { Locale } from "../locale/locale.js";
import type { ModeAwareCache } from "../module/cache.js";
import type { ResolvedModule, ResolvedTypeReferenceDirective } from "../module/types.js";
import type { ModuleSpecifierGenerationHost } from "../modulespecifiers/types.js";
import type { InfoCacheEntry } from "../packagejson/cache.js";
import type { RawSourceMap } from "../sourcemap/generator.js";
import type { KnownSymlinks } from "../symlinks/knownsymlinks.js";
import type { Tracing as Tracing_bcfc8412 } from "../tracing/tracing.js";
import type { ParsedCommandLine, SourceOutputAndProjectReference } from "../tsoptions/parsedcommandline.js";
import type { ComparePathsOptions, Path } from "../tspath/path.js";
import { type OutputPathsHost } from "../outputpaths/outputpaths.js";
import type { checkerPool, CheckerPool } from "./checkerpool.js";
import type { EmitOnly, SourceFileMayBeEmittedHost } from "./emitter.js";
import type { FileIncludeReason } from "./fileInclude.js";
import type { DuplicateSourceFile, LibFile, processedFiles } from "./fileloader.js";
import type { CompilerHost } from "./host.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::type::ProgramOptions","kind":"type","status":"implemented","sigHash":"9eb7d18f0dae3f15940de7ca327de6159681203c5eb38cedc77879444adaee3f","bodyHash":"fd2579730de2d43c0ed258754b40e4b212195c5b2a367c70b29872aca609e055"}
 *
 * Go source:
 * ProgramOptions struct {
 * 	Host                        CompilerHost
 * 	Config                      *tsoptions.ParsedCommandLine
 * 	UseSourceOfProjectReference bool
 * 	SingleThreaded              core.Tristate
 * 	CreateCheckerPool           func(*Program) CheckerPool
 * 	TypingsLocation             string
 * 	ProjectName                 string
 * 	Tracing                     *tracing.Tracing
 * }
 */
export interface ProgramOptions {
    Host: CompilerHost;
    Config: GoPtr<ParsedCommandLine>;
    UseSourceOfProjectReference?: bool;
    SingleThreaded?: Tristate;
    CreateCheckerPool?: (arg0: GoPtr<Program>) => CheckerPool;
    TypingsLocation?: string;
    ProjectName?: string;
    Tracing?: GoPtr<Tracing_bcfc8412>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::ProgramOptions.canUseProjectReferenceSource","kind":"method","status":"implemented","sigHash":"ec0b72e7f02ed0bbf938625750f60c5c5ca5fb65607e514b72a434b8d968f95a","bodyHash":"5e9030cdbbc310a7c9c2432c0044f7f9256331e4eb290b6426f0aa7d4db4e9f3"}
 *
 * Go source:
 * func (p *ProgramOptions) canUseProjectReferenceSource() bool {
 * 	return p.UseSourceOfProjectReference && !p.Config.CompilerOptions().DisableSourceOfProjectReferenceRedirect.IsTrue()
 * }
 */
export declare function ProgramOptions_canUseProjectReferenceSource(receiver: GoPtr<ProgramOptions>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::type::lazyValue","kind":"type","status":"implemented","sigHash":"26023d6be91e21c7ab20729c24c040bb5e0c2f767af281019b4e6bae319804c6","bodyHash":"d28e8d5d6874537a2c68d64a17214cc70da04090a3c356622024a2c49606be78"}
 *
 * Go source:
 * lazyValue[T any] struct {
 * 	value       *T
 * 	once        sync.Once
 * 	initialized atomic.Bool
 * }
 */
export interface lazyValue<T = unknown> {
    value: GoPtr<T>;
    once: Once;
    initialized: Bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::lazyValue.getValue","kind":"method","status":"implemented","sigHash":"b3467f442b9cfa32947eba0eea2cf4372f53e1c8fd4a277db69238e17ffb21a5","bodyHash":"4804cfb815d6bf3b02be370eeee374aeab086784886459b6edcdadc273a91eb2"}
 *
 * Go source:
 * func (l *lazyValue[T]) getValue(compute func() *T) *T {
 * 	l.once.Do(func() {
 * 		if l.value == nil {
 * 			l.value = compute()
 * 		}
 * 		l.initialized.Store(true)
 * 	})
 * 	return l.value
 * }
 */
export declare function lazyValue_getValue<T>(receiver: GoPtr<lazyValue<T>>, compute: () => GoPtr<T>): GoPtr<T>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::lazyValue.tryReuse","kind":"method","status":"implemented","sigHash":"eeb3dce026db714361936f193c70dd4d92b89cbc0a94ef79943f6230766d8aa9","bodyHash":"525ce6f090dd6df60bbd9189dcd947505a08508842f33e5feaa9c5eab2104912"}
 *
 * Go source:
 * func (l *lazyValue[T]) tryReuse(from *lazyValue[T]) {
 * 	if from.initialized.Load() {
 * 		l.value = from.value
 * 		l.initialized.Store(true)
 * 	}
 * }
 */
export declare function lazyValue_tryReuse<T>(receiver: GoPtr<lazyValue<T>>, from_: GoPtr<lazyValue<T>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::type::packageNamesInfo","kind":"type","status":"implemented","sigHash":"b1133be40de190cc9ad88f29fa923d2eabb6da9c0a4536486cd5f1cd440e4c40","bodyHash":"bfeaa7189f0877fc81a2ff5b75fe178c5c5a2cb2d25b4d8a16a334184e413361"}
 *
 * Go source:
 * packageNamesInfo struct {
 * 	resolved           *collections.Set[string]
 * 	unresolved         *collections.Set[string]
 * 	deepImportPackages *collections.Set[string]
 * }
 */
export interface packageNamesInfo {
    resolved: GoPtr<Set<string>>;
    unresolved: GoPtr<Set<string>>;
    deepImportPackages: GoPtr<Set<string>>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::type::Program","kind":"type","status":"implemented","sigHash":"c60019065d3ec9810ed2446897b82620c3db486992de68fd6eea46cab24d5e45","bodyHash":"226134a82a0b16b10bc9114dc0e1985fa956b94e77464701479ad0a96d9e4462"}
 *
 * Go source:
 * Program struct {
 * 	opts        ProgramOptions
 * 	checkerPool CheckerPool // always set; used as fallback for project system pools
 *
 * 	// compilerCheckerPool is set only when the built-in compiler checker pool is in use
 * 	// (i.e. CreateCheckerPool was not provided). It enables grouped parallel iteration,
 * 	// non-exclusive access for emit, and direct global diagnostics collection.
 * 	compilerCheckerPool *checkerPool
 *
 * 	comparePathsOptions tspath.ComparePathsOptions
 *
 * 	processedFiles
 *
 * 	usesUriStyleNodeCoreModules core.Tristate
 *
 * 	commonSourceDirectory     string
 * 	commonSourceDirectoryOnce sync.Once
 *
 * 	declarationDiagnosticCache collections.SyncMap[*ast.SourceFile, []*ast.Diagnostic]
 *
 * 	programDiagnostics         []*ast.Diagnostic
 * 	hasEmitBlockingDiagnostics collections.Set[tspath.Path]
 *
 * 	sourceFilesToEmitOnce sync.Once
 * 	sourceFilesToEmit     []*ast.SourceFile
 *
 * 	// Cached unresolved imports for ATA
 * 	unresolvedImports lazyValue[collections.Set[string]]
 * 	knownSymlinks     lazyValue[symlinks.KnownSymlinks]
 *
 * 	// Used by auto-imports
 * 	packageNames lazyValue[packageNamesInfo]
 *
 * 	// Used by workspace/symbol
 * 	hasTSFileOnce sync.Once
 * 	hasTSFile     bool
 *
 * 	// Cached map of package names to whether they bundle types
 * 	packagesMapOnce sync.Once
 * 	packagesMap     map[string]bool
 * }
 */
export interface Program {
    opts: ProgramOptions;
    checkerPool: CheckerPool | undefined;
    compilerCheckerPool: GoPtr<checkerPool>;
    comparePathsOptions: ComparePathsOptions;
    readonly __tsgoEmbedded0?: processedFiles;
    usesUriStyleNodeCoreModules: Tristate;
    commonSourceDirectory: string;
    commonSourceDirectoryOnce: Once;
    declarationDiagnosticCache: SyncMap<GoPtr<SourceFile>, GoSlice<GoPtr<Diagnostic>>>;
    programDiagnostics: GoSlice<GoPtr<Diagnostic>>;
    hasEmitBlockingDiagnostics: Set<Path>;
    sourceFilesToEmitOnce: Once;
    sourceFilesToEmit: GoSlice<GoPtr<SourceFile>>;
    unresolvedImports: lazyValue<Set<string>>;
    knownSymlinks: lazyValue<KnownSymlinks>;
    packageNames: lazyValue<packageNamesInfo>;
    hasTSFileOnce: Once;
    hasTSFile: bool;
    packagesMapOnce: Once;
    packagesMap: GoMap<string, bool>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.FileExists","kind":"method","status":"implemented","sigHash":"fc912035af474961c38b93b1b1845c470bb60819f12b82dd9aaafe4e5b4ba38c","bodyHash":"d371b161b6227e07be6e74bdafa2f8f32e1ab5ab45b4106f580797f058d2cba6"}
 *
 * Go source:
 * func (p *Program) FileExists(path string) bool {
 * 	return p.Host().FS().FileExists(path)
 * }
 */
export declare function Program_FileExists(receiver: GoPtr<Program>, path: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetCurrentDirectory","kind":"method","status":"implemented","sigHash":"49421efcb8d09dde8f656aa85d37c9bcf5954c7e34a9270d5e0337d215a26e9a","bodyHash":"17c6b03ad95cea96c9e1072e18f946024d22802b80b6548147684eb34c424499"}
 *
 * Go source:
 * func (p *Program) GetCurrentDirectory() string {
 * 	return p.Host().GetCurrentDirectory()
 * }
 */
export declare function Program_GetCurrentDirectory(receiver: GoPtr<Program>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetGlobalTypingsCacheLocation","kind":"method","status":"implemented","sigHash":"96959a9eaae02a63df920de2286450b775a650152b33092cc73145621516b3b9","bodyHash":"67cc3378cf8d8b2f179c6ba15afecc4e2eee49f3849a20c67a6985ac7c6e371b"}
 *
 * Go source:
 * func (p *Program) GetGlobalTypingsCacheLocation() string {
 * 	return p.opts.TypingsLocation
 * }
 */
export declare function Program_GetGlobalTypingsCacheLocation(receiver: GoPtr<Program>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetNearestAncestorDirectoryWithPackageJson","kind":"method","status":"implemented","sigHash":"3a507a72bd6f35c1a4d41f2ea49ac2bcfdc4af76350d933869a5566c8f3dc685","bodyHash":"e34138d0577fca4a5dd031add97581701da88b86376a8f0247820478037be235"}
 *
 * Go source:
 * func (p *Program) GetNearestAncestorDirectoryWithPackageJson(dirname string) string {
 * 	scoped := p.resolver.GetPackageScopeForPath(dirname)
 * 	if scoped != nil && scoped.Exists() {
 * 		return scoped.PackageDirectory
 * 	}
 * 	return ""
 * }
 */
export declare function Program_GetNearestAncestorDirectoryWithPackageJson(receiver: GoPtr<Program>, dirname: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetPackageJsonInfo","kind":"method","status":"implemented","sigHash":"b35499705a40b88298678165b7f45dd9224e167636b559449bf543dac304379e","bodyHash":"b48ea91adf2048315f7ec64fbdbbc22c3722fc6653b2377602dc3867e2358e9e"}
 *
 * Go source:
 * func (p *Program) GetPackageJsonInfo(pkgJsonPath string) *packagejson.InfoCacheEntry {
 * 	directory := tspath.GetDirectoryPath(pkgJsonPath)
 * 	scoped := p.resolver.GetPackageScopeForPath(directory)
 * 	if scoped != nil && scoped.Exists() && scoped.PackageDirectory == directory {
 * 		return scoped
 * 	}
 * 	return nil
 * }
 */
export declare function Program_GetPackageJsonInfo(receiver: GoPtr<Program>, pkgJsonPath: string): GoPtr<InfoCacheEntry>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetRedirectTargets","kind":"method","status":"implemented","sigHash":"daa3b7276bc94f309aa85376da97480b2cc006ef2f6dd9f7a1735be2e8cc3edf","bodyHash":"8843ee4c0ab7672f6e3c639c445fc399fb97b707b18222978f4d33bd657d2112"}
 *
 * Go source:
 * func (p *Program) GetRedirectTargets(path tspath.Path) []string {
 * 	return p.redirectTargetsMap[path]
 * }
 */
export declare function Program_GetRedirectTargets(receiver: GoPtr<Program>, path: Path): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetSourceOfProjectReferenceIfOutputIncluded","kind":"method","status":"implemented","sigHash":"cf149aec4713f436ef479bc037332a1495ee8576d04d9b26c372fa8022241991","bodyHash":"2e11d3603c6952926a9ec9ae1976cd1b1e84844e38fa18eec48f6ddda35ffaa3"}
 *
 * Go source:
 * func (p *Program) GetSourceOfProjectReferenceIfOutputIncluded(file ast.HasFileName) string {
 * 	if source, ok := p.outputFileToProjectReferenceSource[file.Path()]; ok {
 * 		return source
 * 	}
 * 	return file.FileName()
 * }
 */
export declare function Program_GetSourceOfProjectReferenceIfOutputIncluded(receiver: GoPtr<Program>, file: HasFileName): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetProjectReferenceFromSource","kind":"method","status":"implemented","sigHash":"2095e9d5c9d3f9eaaa3f419e539f9bc33ecfce2cb795a859351a7e750f0e94f3","bodyHash":"b55a7fa8d7b159eba73a59d3433ce3c7291ea23a0118618f27edd94011fd7904"}
 *
 * Go source:
 * func (p *Program) GetProjectReferenceFromSource(path tspath.Path) *tsoptions.SourceOutputAndProjectReference {
 * 	return p.projectReferenceFileMapper.getProjectReferenceFromSource(path)
 * }
 */
export declare function Program_GetProjectReferenceFromSource(receiver: GoPtr<Program>, path: Path): GoPtr<SourceOutputAndProjectReference>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.IsSourceFromProjectReference","kind":"method","status":"implemented","sigHash":"30766b98273eee304899a8a66eae4a27bc46c7367c16e1601d1cf2367f4695a7","bodyHash":"fd68693096a0eb93c25d7bebe6f9d9f569a0b140ca05c5ceb6cdd2806064b3d6"}
 *
 * Go source:
 * func (p *Program) IsSourceFromProjectReference(path tspath.Path) bool {
 * 	return p.projectReferenceFileMapper.isSourceFromProjectReference(path)
 * }
 */
export declare function Program_IsSourceFromProjectReference(receiver: GoPtr<Program>, path: Path): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetProjectReferenceFromOutputDts","kind":"method","status":"implemented","sigHash":"04b57beebace0fbdea12ca0e14d189e66f63cd6eb49f09ff81dd068f0906acfd","bodyHash":"7face0063bc26791d6a9558e6522acf3f970491a3c621a05fd0f91f92a8513ea"}
 *
 * Go source:
 * func (p *Program) GetProjectReferenceFromOutputDts(path tspath.Path) *tsoptions.SourceOutputAndProjectReference {
 * 	return p.projectReferenceFileMapper.getProjectReferenceFromOutputDts(path)
 * }
 */
export declare function Program_GetProjectReferenceFromOutputDts(receiver: GoPtr<Program>, path: Path): GoPtr<SourceOutputAndProjectReference>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetResolvedProjectReferenceFor","kind":"method","status":"implemented","sigHash":"8e85fa3e5b4cffc13653f82b39b0891a4ffa9b7b0c1e4212088efcd1f91c95f6","bodyHash":"9780971bd4ad36b7125ebe5c09acc833652370d020ad1745e6413b5354fa310a"}
 *
 * Go source:
 * func (p *Program) GetResolvedProjectReferenceFor(path tspath.Path) (*tsoptions.ParsedCommandLine, bool) {
 * 	return p.projectReferenceFileMapper.getResolvedReferenceFor(path)
 * }
 */
export declare function Program_GetResolvedProjectReferenceFor(receiver: GoPtr<Program>, path: Path): [GoPtr<ParsedCommandLine>, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetRedirectForResolution","kind":"method","status":"implemented","sigHash":"131f48f30f099827074ce4455f5b2cc01ac7eb2140bfd8fb3b244cf4b5bbefdf","bodyHash":"1031ed5fdc463461633faf239dfba0be98299661111a94516bc04ab9294f0c80"}
 *
 * Go source:
 * func (p *Program) GetRedirectForResolution(file ast.HasFileName) *tsoptions.ParsedCommandLine {
 * 	redirect, _ := p.projectReferenceFileMapper.getRedirectForResolution(file)
 * 	return redirect
 * }
 */
export declare function Program_GetRedirectForResolution(receiver: GoPtr<Program>, file: HasFileName): GoPtr<ParsedCommandLine>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetParseFileRedirect","kind":"method","status":"implemented","sigHash":"9d46b66c6a83be5a07a3a876ea4b6df5b5ff7d14e6f2cbf5f2cf36751c0b0d7a","bodyHash":"15a7ef8c9f0c793ef4a8a617312fe3eff26e9df50dd47886cefc57f7bbfa8c8d"}
 *
 * Go source:
 * func (p *Program) GetParseFileRedirect(fileName string) string {
 * 	return p.projectReferenceFileMapper.getParseFileRedirect(ast.NewHasFileName(fileName, p.toPath(fileName)))
 * }
 */
export declare function Program_GetParseFileRedirect(receiver: GoPtr<Program>, fileName: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetResolvedProjectReferences","kind":"method","status":"implemented","sigHash":"788ba86529f0d3db0ff340dc7d30f82cdf049656168dd37489b3e82a9e9563de","bodyHash":"1cede2bbd3c08599a45e26f042327f71d886bad3408f56eeb9fe28d4233f2258"}
 *
 * Go source:
 * func (p *Program) GetResolvedProjectReferences() []*tsoptions.ParsedCommandLine {
 * 	return p.projectReferenceFileMapper.getResolvedProjectReferences()
 * }
 */
export declare function Program_GetResolvedProjectReferences(receiver: GoPtr<Program>): GoSlice<GoPtr<ParsedCommandLine>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.RangeResolvedProjectReference","kind":"method","status":"implemented","sigHash":"991d6ba156d64c903de9474973c0ef3b82cda7b05e2e741cc331b53cb4e8dbea","bodyHash":"8e95bb09d1992ec19fea0369abe7e1064a80bb9da7be954e9440cd1c8a2b368f"}
 *
 * Go source:
 * func (p *Program) RangeResolvedProjectReference(f func(path tspath.Path, config *tsoptions.ParsedCommandLine, parent *tsoptions.ParsedCommandLine, index int) bool) bool {
 * 	return p.projectReferenceFileMapper.rangeResolvedProjectReference(f)
 * }
 */
export declare function Program_RangeResolvedProjectReference(receiver: GoPtr<Program>, f: (path: Path, config: GoPtr<ParsedCommandLine>, parent: GoPtr<ParsedCommandLine>, index: int) => bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.RangeResolvedProjectReferenceInChildConfig","kind":"method","status":"implemented","sigHash":"21d1cf7926668889fdcd4cd3389111acf6304b7792b2a59893e1dc4a6e3d59bc","bodyHash":"97c0881822325fb33c531c07044788038f60f737e1157ca416a5dfdfe294351c"}
 *
 * Go source:
 * func (p *Program) RangeResolvedProjectReferenceInChildConfig(
 * 	childConfig *tsoptions.ParsedCommandLine,
 * 	f func(path tspath.Path, config *tsoptions.ParsedCommandLine, parent *tsoptions.ParsedCommandLine, index int) bool,
 * ) bool {
 * 	return p.projectReferenceFileMapper.rangeResolvedProjectReferenceInChildConfig(childConfig, f)
 * }
 */
export declare function Program_RangeResolvedProjectReferenceInChildConfig(receiver: GoPtr<Program>, childConfig: GoPtr<ParsedCommandLine>, f: (path: Path, config: GoPtr<ParsedCommandLine>, parent: GoPtr<ParsedCommandLine>, index: int) => bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.UseCaseSensitiveFileNames","kind":"method","status":"implemented","sigHash":"59abc6749f71dee6255755c5682f466ab593c39d9ea1b06d0864db7e4999a2e6","bodyHash":"f01ec68dddf5dbd251a057c70f41ed99563aec6c7b3c6bef882fc90b0ec85546"}
 *
 * Go source:
 * func (p *Program) UseCaseSensitiveFileNames() bool {
 * 	return p.Host().FS().UseCaseSensitiveFileNames()
 * }
 */
export declare function Program_UseCaseSensitiveFileNames(receiver: GoPtr<Program>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.UsesUriStyleNodeCoreModules","kind":"method","status":"implemented","sigHash":"290d2a5d2197835f8003b3f9d67737d0b82445c9a585a07e74734179e3a08c39","bodyHash":"2cbf3aaaa176b75ceba6ba12842173ab0749fa4095f9d29a4d384a32e82bab16"}
 *
 * Go source:
 * func (p *Program) UsesUriStyleNodeCoreModules() core.Tristate {
 * 	return p.usesUriStyleNodeCoreModules
 * }
 */
export declare function Program_UsesUriStyleNodeCoreModules(receiver: GoPtr<Program>): Tristate;
export declare function Program_as_outputpaths_OutputPathsHost(receiver: GoPtr<Program>): OutputPathsHost;
export declare function Program_as_emitter_SourceFileMayBeEmittedHost(receiver: GoPtr<Program>): SourceFileMayBeEmittedHost;
export declare function Program_as_modulespecifiers_ModuleSpecifierGenerationHost(receiver: GoPtr<Program>): ModuleSpecifierGenerationHost;
export declare function Program_as_checker_Host(receiver: GoPtr<Program>): CheckerHost;
export declare function Program_as_checker_Program(receiver: GoPtr<Program>): Program_e32ad451;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"9211ec5bcaa0345245688aba2615ed9d45b569522876a02a1f6040a4ace25b46"}
 *
 * Go source:
 * var _ checker.Program = (*Program)(nil)
 */
export declare let __7d754c38_0: Program_e32ad451;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetSourceFileFromReference","kind":"method","status":"implemented","sigHash":"d17110acc4563d1cc15b71c7c34578869a09f5420d3f57151d53da44c275e35a","bodyHash":"fa60f7bd6b6821c8baf868087040d91ae551ba151dd64012f963992d886ff221"}
 *
 * Go source:
 * func (p *Program) GetSourceFileFromReference(origin *ast.SourceFile, ref *ast.FileReference) *ast.SourceFile {
 * 	// TODO: The module loader in corsa is fairly different than strada, it should probably be able to expose this functionality at some point,
 * 	// rather than redoing the logic approximately here, since most of the related logic now lives in module.Resolver
 * 	// Still, without the failed lookup reporting that only the loader does, this isn't terribly complicated
 *
 * 	fileName := tspath.ResolvePath(tspath.GetDirectoryPath(origin.FileName()), ref.FileName)
 * 	supportedExtensionsBase := tsoptions.GetSupportedExtensions(p.Options(), nil /*extraFileExtensions* /)
 * 	supportedExtensions := tsoptions.GetSupportedExtensionsWithJsonIfResolveJsonModule(p.Options(), supportedExtensionsBase)
 * 	allowNonTsExtensions := p.Options().AllowNonTsExtensions.IsTrue()
 * 	if tspath.HasExtension(fileName) {
 * 		if !allowNonTsExtensions {
 * 			canonicalFileName := tspath.GetCanonicalFileName(fileName, p.UseCaseSensitiveFileNames())
 * 			supported := false
 * 			for _, group := range supportedExtensions {
 * 				if tspath.FileExtensionIsOneOf(canonicalFileName, group) {
 * 					supported = true
 * 					break
 * 				}
 * 			}
 * 			if !supported {
 * 				return nil // unsupported extensions are forced to fail
 * 			}
 * 		}
 *
 * 		return p.GetSourceFileForResolvedModule(fileName)
 * 	}
 * 	if allowNonTsExtensions {
 * 		extensionless := p.GetSourceFileForResolvedModule(fileName)
 * 		if extensionless != nil {
 * 			return extensionless
 * 		}
 * 	}
 *
 * 	// Only try adding extensions from the first supported group (which should be .ts/.tsx/.d.ts)
 * 	for _, ext := range supportedExtensions[0] {
 * 		result := p.GetSourceFileForResolvedModule(fileName + ext)
 * 		if result != nil {
 * 			return result
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Program_GetSourceFileFromReference(receiver: GoPtr<Program>, origin: GoPtr<SourceFile>, ref: GoPtr<FileReference>): GoPtr<SourceFile>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::NewProgram","kind":"func","status":"implemented","sigHash":"a124c4f6a47008ca4e3457fd95247b6cb4c9c33b70716c69b709067d1bb2518e","bodyHash":"4326c0257817239b27d2abe91f2f64d5fad21b33e7fd92f4d0de4b45eaf741b5"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"Extension-enabled ProgramOptions attach their ExtensionHost to the constructed Program so checker and consumer seams are program-scoped; no-extension programs remain on the exact TS-Go path."}
 *
 * Go source:
 * func NewProgram(opts ProgramOptions) *Program {
 * 	p := &Program{opts: opts}
 * 	if p.opts.Tracing != nil {
 * 		defer p.opts.Tracing.Push(tracing.PhaseProgram, "createProgram", map[string]any{"configFilePath": opts.Config.CompilerOptions().ConfigFilePath}, true)()
 * 	}
 * 	p.processedFiles = processAllProgramFiles(p.opts, p.SingleThreaded())
 * 	p.initCheckerPool()
 * 	p.verifyCompilerOptions()
 * 	return p
 * }
 */
export declare function NewProgram(opts: ProgramOptions): GoPtr<Program>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.UpdateProgram","kind":"method","status":"implemented","sigHash":"097d85513c9c582286da9c22bc2c9f5b1879006347dc4b6bf85f79c2b301cd05","bodyHash":"81f4986f608f54ad7ae60db8e41b0ad10e4830f66fa0ff27e3e7e829f1fce643"}
 *
 * Go source:
 * // The returned *ast.SourceFile is the changed file as acquired through newHost; it is nil
 * // only if the host cannot locate the file (e.g. it was deleted). Callers that manage
 * // host-side parse caches must release this exact pointer when the old program could not be
 * // reused, since it was acquired speculatively before that decision was made.
 * func (p *Program) UpdateProgram(changedFilePath tspath.Path, newHost CompilerHost, createCheckerPool func(*Program) CheckerPool) (*Program, *ast.SourceFile, bool) {
 * 	newOpts := p.opts
 * 	newOpts.Host = newHost
 * 	if createCheckerPool != nil {
 * 		newOpts.CreateCheckerPool = createCheckerPool
 * 	}
 *
 * 	oldFile := p.filesByPath[changedFilePath]
 * 	newFile := newHost.GetSourceFile(oldFile.ParseOptions())
 *
 * 	// If this file is part of a package redirect group (same package installed in multiple
 * 	// node_modules locations), we need to rebuild the program because the redirect targets
 * 	// might need recalculation.
 * 	_, inRedirectFiles := p.redirectFilesByPath[changedFilePath]
 * 	_, isRedirectTarget := p.redirectTargetsMap[changedFilePath]
 * 	if inRedirectFiles || isRedirectTarget {
 * 		return NewProgram(newOpts), newFile, false
 * 	}
 *
 * 	if !canReplaceFileInProgram(oldFile, newFile) {
 * 		return NewProgram(newOpts), newFile, false
 * 	}
 * 	if oldNeedsImportHelpers := p.importHelpersImportSpecifiers[oldFile.Path()] != nil; oldNeedsImportHelpers != p.needsImportHelpersImportSpecifier(newFile) {
 * 		return NewProgram(newOpts), newFile, false
 * 	}
 * 	// TODO: reverify compiler options when config has changed?
 * 	result := &Program{
 * 		opts:                        newOpts,
 * 		comparePathsOptions:         p.comparePathsOptions,
 * 		processedFiles:              p.processedFiles,
 * 		usesUriStyleNodeCoreModules: p.usesUriStyleNodeCoreModules,
 * 		programDiagnostics:          p.programDiagnostics,
 * 		hasEmitBlockingDiagnostics:  p.hasEmitBlockingDiagnostics,
 * 	}
 * 	result.unresolvedImports.tryReuse(&p.unresolvedImports)
 * 	result.knownSymlinks.tryReuse(&p.knownSymlinks)
 * 	result.packageNames.tryReuse(&p.packageNames)
 * 	result.initCheckerPool()
 * 	index := core.FindIndex(result.files, func(file *ast.SourceFile) bool { return file.Path() == newFile.Path() })
 * 	result.files = slices.Clone(result.files)
 * 	result.files[index] = newFile
 * 	result.filesByPath = maps.Clone(result.filesByPath)
 * 	result.filesByPath[newFile.Path()] = newFile
 * 	updateFileIncludeProcessor(result)
 * 	return result, newFile, true
 * }
 */
export declare function Program_UpdateProgram(receiver: GoPtr<Program>, changedFilePath: Path, newHost: CompilerHost, createCheckerPool: (arg0: GoPtr<Program>) => CheckerPool): [GoPtr<Program>, GoPtr<SourceFile>, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.initCheckerPool","kind":"method","status":"implemented","sigHash":"000437a9efbeaad3221bebdc1fb51c128da3df5f1289c1e71ea96c2ddca562d2","bodyHash":"c1348d869dff90302d9643f3d779322026d520080df4e64ebdff23c5cb82c90a"}
 *
 * Go source:
 * func (p *Program) initCheckerPool() {
 * 	if !p.finishedProcessing {
 * 		panic("Program must finish processing files before initializing checker pool")
 * 	}
 *
 * 	if p.opts.CreateCheckerPool != nil {
 * 		p.checkerPool = p.opts.CreateCheckerPool(p)
 * 	} else {
 * 		pool := newCheckerPoolWithTracing(p, p.opts.Tracing)
 * 		p.checkerPool = pool
 * 		p.compilerCheckerPool = pool
 * 	}
 * }
 */
export declare function Program_initCheckerPool(receiver: GoPtr<Program>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetCheckerPool","kind":"method","status":"implemented","sigHash":"366050abc6a31e95bec7998d21cc67dbc0de33075b90f132b3753745b4e78356","bodyHash":"b9be1dff87c3190f592ec2fdc2be9674000b34b0d11856cf858ac8b70b6ede27"}
 *
 * Go source:
 * // GetCheckerPool returns the checker pool associated with this program.
 * func (p *Program) GetCheckerPool() CheckerPool {
 * 	return p.checkerPool
 * }
 */
export declare function Program_GetCheckerPool(receiver: GoPtr<Program>): CheckerPool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::canReplaceFileInProgram","kind":"func","status":"implemented","sigHash":"4f8fd32177e983587505934059babd27f42b0d687899b031ac73f14c2924ef7a","bodyHash":"f64fa43a750022e7e6e78a294444faf9a31e9bb05c60aa9a2872f188cbc75ac5"}
 *
 * Go source:
 * func canReplaceFileInProgram(file1 *ast.SourceFile, file2 *ast.SourceFile) bool {
 * 	return file2 != nil &&
 * 		file1.ParseOptions() == file2.ParseOptions() &&
 * 		file1.UsesUriStyleNodeCoreModules == file2.UsesUriStyleNodeCoreModules &&
 * 		slices.EqualFunc(file1.Imports(), file2.Imports(), equalModuleSpecifiers) &&
 * 		slices.EqualFunc(file1.ModuleAugmentations, file2.ModuleAugmentations, equalModuleAugmentationNames) &&
 * 		slices.Equal(file1.AmbientModuleNames, file2.AmbientModuleNames) &&
 * 		slices.EqualFunc(file1.ReferencedFiles, file2.ReferencedFiles, equalFileReferences) &&
 * 		slices.EqualFunc(file1.TypeReferenceDirectives, file2.TypeReferenceDirectives, equalFileReferences) &&
 * 		slices.EqualFunc(file1.LibReferenceDirectives, file2.LibReferenceDirectives, equalFileReferences) &&
 * 		equalCheckJSDirectives(file1.CheckJsDirective, file2.CheckJsDirective)
 * }
 */
export declare function canReplaceFileInProgram(file1: GoPtr<SourceFile>, file2: GoPtr<SourceFile>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.needsImportHelpersImportSpecifier","kind":"method","status":"implemented","sigHash":"1c70bf32d9548dc6b9c333b3d4a17d9621bdb2d1f4425b6fc44eab874b88ec9a","bodyHash":"947e6aeb675d5743ece09c80086987e8505fc14d01d40dd813e646ba4a65fce6"}
 *
 * Go source:
 * func (p *Program) needsImportHelpersImportSpecifier(file *ast.SourceFile) bool {
 * 	redirect, _ := p.projectReferenceFileMapper.getRedirectForResolution(file)
 * 	optionsForFile := module.GetCompilerOptionsWithRedirect(p.opts.Config.CompilerOptions(), redirect)
 * 	if !optionsForFile.ImportHelpers.IsTrue() {
 * 		return false
 * 	}
 * 	isJavaScriptFile := ast.IsSourceFileJS(file)
 * 	isExternalModuleFile := ast.IsExternalModule(file)
 * 	if !isJavaScriptFile && (file.IsDeclarationFile || (!optionsForFile.GetIsolatedModules() && !isExternalModuleFile)) {
 * 		return false
 * 	}
 * 	return true
 * }
 */
export declare function Program_needsImportHelpersImportSpecifier(receiver: GoPtr<Program>, file: GoPtr<SourceFile>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::equalModuleSpecifiers","kind":"func","status":"implemented","sigHash":"4544cb65d07ffe43d581d18a3f180f117f978bd5bf9ccff7e1e9821b1ddd69c7","bodyHash":"1da1c10ce726048554664838914e3d477c932f71b0c4e62ccffc7defe488afee"}
 *
 * Go source:
 * func equalModuleSpecifiers(n1 *ast.Node, n2 *ast.Node) bool {
 * 	return n1.Kind == n2.Kind && (!ast.IsStringLiteral(n1) || n1.Text() == n2.Text())
 * }
 */
export declare function equalModuleSpecifiers(n1: GoPtr<Node>, n2: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::equalModuleAugmentationNames","kind":"func","status":"implemented","sigHash":"a045b82c7c9e78b034629e2295dfafa92acd413c93ae0ad5025ce1698d1c4ac9","bodyHash":"fe52098f06efd6d09c534ea350d22e55414382eebcb88ab92ccf91b95f32d919"}
 *
 * Go source:
 * func equalModuleAugmentationNames(n1 *ast.Node, n2 *ast.Node) bool {
 * 	return n1.Kind == n2.Kind && n1.Text() == n2.Text()
 * }
 */
export declare function equalModuleAugmentationNames(n1: GoPtr<Node>, n2: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::equalFileReferences","kind":"func","status":"implemented","sigHash":"126c1d7c7d26f623ea6c87363446aecc52fb011f5aaf335f82d8956fb2aa4a8d","bodyHash":"54cde93049133f91ef5c42e3459e362f54ee95c7d58a5d2d0895f737d7c7ff1e"}
 *
 * Go source:
 * func equalFileReferences(f1 *ast.FileReference, f2 *ast.FileReference) bool {
 * 	return f1.FileName == f2.FileName && f1.ResolutionMode == f2.ResolutionMode && f1.Preserve == f2.Preserve
 * }
 */
export declare function equalFileReferences(f1: GoPtr<FileReference>, f2: GoPtr<FileReference>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::equalCheckJSDirectives","kind":"func","status":"implemented","sigHash":"5aa4e224238cf5857efacd83f24769ea55944909e67223b34ad99d4b78dd8340","bodyHash":"008a63737ee185ed2cb1850830f835224ecb26e9a1b8708e0d72712d25eb0e96"}
 *
 * Go source:
 * func equalCheckJSDirectives(d1 *ast.CheckJsDirective, d2 *ast.CheckJsDirective) bool {
 * 	return d1 == nil && d2 == nil || d1 != nil && d2 != nil && d1.Enabled == d2.Enabled
 * }
 */
export declare function equalCheckJSDirectives(d1: GoPtr<CheckJsDirective>, d2: GoPtr<CheckJsDirective>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.SourceFiles","kind":"method","status":"implemented","sigHash":"608e18c5721ca7f7e807977f05ba791d60021445a1ac8adb068fab9d371cd435","bodyHash":"a8630ab8702571369a8b815c33814e4ffcd48fdd2d84f1b0d7c6011c987882b8"}
 *
 * Go source:
 * func (p *Program) SourceFiles() []*ast.SourceFile               { return p.files }
 */
export declare function Program_SourceFiles(receiver: GoPtr<Program>): GoSlice<GoPtr<SourceFile>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.DuplicateSourceFiles","kind":"method","status":"implemented","sigHash":"6052d32bc61ab054cbf2e71007b9576670d714a54c815a6601ac8a2661322350","bodyHash":"f7b6fd746f261523a7b3594e3f6cbcc94a2d98e539326ccb8a296643c90c1a65"}
 *
 * Go source:
 * func (p *Program) DuplicateSourceFiles() []*DuplicateSourceFile { return p.duplicateSourceFiles }
 */
export declare function Program_DuplicateSourceFiles(receiver: GoPtr<Program>): GoSlice<GoPtr<DuplicateSourceFile>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.Options","kind":"method","status":"implemented","sigHash":"818bcf698efc58e835b155c2301c3e4526057d6a332c7110d77edb167dbd54de","bodyHash":"1b42b9b0120ec643e60db42c9d57bc1377595f0d693876643eea700a4f8a03ec"}
 *
 * Go source:
 * func (p *Program) Options() *core.CompilerOptions               { return p.opts.Config.CompilerOptions() }
 */
export declare function Program_Options(receiver: GoPtr<Program>): GoPtr<CompilerOptions>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.CommandLine","kind":"method","status":"implemented","sigHash":"4b37ffe140b96df28d6f0687f406a7fd51ebce286244b7cad9eaeef4ef273ab5","bodyHash":"0a15a21663269a63012b067c450e563758d22ea3418718ca8ee1313acee3ed8d"}
 *
 * Go source:
 * func (p *Program) CommandLine() *tsoptions.ParsedCommandLine    { return p.opts.Config }
 */
export declare function Program_CommandLine(receiver: GoPtr<Program>): GoPtr<ParsedCommandLine>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.Host","kind":"method","status":"implemented","sigHash":"b1bb3471775e3489a88821d8204f7d237db0c537e1c70d2d77da6843d38b8105","bodyHash":"dd57aa9a7f9771b1754d0a30f2980bc3e888eba53f4a4d218b791df21d27a06d"}
 *
 * Go source:
 * func (p *Program) Host() CompilerHost                           { return p.opts.Host }
 */
export declare function Program_Host(receiver: GoPtr<Program>): CompilerHost;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.Tracing","kind":"method","status":"implemented","sigHash":"ab20db87195fe8af07ec6bf25797b635efb77a21fec2ed7d46a950dd05fbe306","bodyHash":"3353d24ab4cf86c8710ab9399c7e49db2f85117e4e5b88863ed4d8444ca55b71"}
 *
 * Go source:
 * func (p *Program) Tracing() *tracing.Tracing                    { return p.opts.Tracing }
 */
export declare function Program_Tracing(receiver: GoPtr<Program>): GoPtr<Tracing_bcfc8412>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetConfigFileParsingDiagnostics","kind":"method","status":"implemented","sigHash":"a5bd0bd1fc1c78e44ba8319a3319cb03633083eced257f55b1566222533f268a","bodyHash":"409df864dd15ccde15265e4ff9a4b9842fd692746efc9c74a3381533dd7d0dbc"}
 *
 * Go source:
 * func (p *Program) GetConfigFileParsingDiagnostics() []*ast.Diagnostic {
 * 	return slices.Clip(p.opts.Config.GetConfigFileParsingDiagnostics())
 * }
 */
export declare function Program_GetConfigFileParsingDiagnostics(receiver: GoPtr<Program>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetUnresolvedImports","kind":"method","status":"implemented","sigHash":"b5213501873a4601d4e2b5adc0da370c43e6a25707032a45d422911e790e36d6","bodyHash":"8152b9c5af5c72d2cdc69978c9e5e47bfe7a7e96e87a96f78f7b4f2145da97f1"}
 *
 * Go source:
 * func (p *Program) GetUnresolvedImports() *collections.Set[string] {
 * 	return p.unresolvedImports.getValue(p.extractUnresolvedImports)
 * }
 */
export declare function Program_GetUnresolvedImports(receiver: GoPtr<Program>): GoPtr<Set<string>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.extractUnresolvedImports","kind":"method","status":"implemented","sigHash":"2e680105768a1ba9a4da4b54dec265ba0bc97afa31696124e68f88dac6334ae7","bodyHash":"bb7dccb9654ac3276a34784ae00d51a0f47b8ebd35839919c50273f3685a7102"}
 *
 * Go source:
 * func (p *Program) extractUnresolvedImports() *collections.Set[string] {
 * 	unresolvedSet := &collections.Set[string]{}
 *
 * 	for _, sourceFile := range p.files {
 * 		unresolvedImports := p.extractUnresolvedImportsFromSourceFile(sourceFile)
 * 		for _, imp := range unresolvedImports {
 * 			unresolvedSet.Add(imp)
 * 		}
 * 	}
 *
 * 	return unresolvedSet
 * }
 */
export declare function Program_extractUnresolvedImports(receiver: GoPtr<Program>): GoPtr<Set<string>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.extractUnresolvedImportsFromSourceFile","kind":"method","status":"implemented","sigHash":"1e18f9e0b1ed8ef4b0685953e7d655edbc1bc18a6f86d8e3fc9f5f5a82584dea","bodyHash":"a4047f7c63c4aa67ce5026bf7d0e541d1756a3c4fd8b53929f9abe0f740714e1"}
 *
 * Go source:
 * func (p *Program) extractUnresolvedImportsFromSourceFile(file *ast.SourceFile) []string {
 * 	var unresolvedImports []string
 *
 * 	resolvedModules := p.resolvedModules[file.Path()]
 * 	for cacheKey, resolution := range resolvedModules {
 * 		resolved := resolution.IsResolved()
 * 		if (!resolved || !tspath.ExtensionIsOneOf(resolution.Extension, tspath.SupportedTSExtensionsWithJsonFlat)) &&
 * 			!tspath.IsExternalModuleNameRelative(cacheKey.Name) {
 * 			unresolvedImports = append(unresolvedImports, cacheKey.Name)
 * 		}
 * 	}
 *
 * 	return unresolvedImports
 * }
 */
export declare function Program_extractUnresolvedImportsFromSourceFile(receiver: GoPtr<Program>, file: GoPtr<SourceFile>): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.SingleThreaded","kind":"method","status":"implemented","sigHash":"8a982734284cda94896ef3e8c885f215edb405bfd7f16ac83cd57cde9b378af6","bodyHash":"43de00a6d58b2498cec0a847dd41cb27f129b4d04a0a42bc88103a66b2f940dc"}
 *
 * Go source:
 * func (p *Program) SingleThreaded() bool {
 * 	return p.opts.SingleThreaded.DefaultIfUnknown(p.Options().SingleThreaded).IsTrue()
 * }
 */
export declare function Program_SingleThreaded(receiver: GoPtr<Program>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.BindSourceFiles","kind":"method","status":"implemented","sigHash":"adbb681ce817a1474ae6c753e2045b27ef0b0ead57fdc141f8e63bb8642fd42f","bodyHash":"a081f0a968bb98f7febda2f9fbca79e39349341857a100b2765475a5f6784907"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"After normal TS-Go binding, provider virtual modules publish source declaration identities and source facts; programs without an attached extension host remain on the direct TS-Go path."}
 *
 * Go source:
 * func (p *Program) BindSourceFiles() {
 * 	wg := core.NewWorkGroup(p.SingleThreaded())
 * 	for _, file := range p.files {
 * 		if !file.IsBound() {
 * 			wg.Queue(func() {
 * 				if p.opts.Tracing != nil {
 * 					defer p.opts.Tracing.Push(tracing.PhaseBind, "bindSourceFile", map[string]any{"path": string(file.Path())}, true)()
 * 				}
 * 				binder.BindSourceFile(file)
 * 			})
 * 		}
 * 	}
 * 	wg.RunAndWait()
 * }
 */
export declare function Program_BindSourceFiles(receiver: GoPtr<Program>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetTypeChecker","kind":"method","status":"implemented","sigHash":"7f22b10d2f692dbfc5270037934530f76bb2909dc53fc1119c05c25fbc471cd8","bodyHash":"cbdce83a975e1d2153dce5ca6086d02ed510fa392847bce836e1fc753d68a1e2"}
 *
 * Go source:
 * func (p *Program) GetTypeChecker(ctx context.Context) (*checker.Checker, func()) {
 * 	if p.compilerCheckerPool != nil {
 * 		return p.compilerCheckerPool.getCheckerNonExclusive()
 * 	}
 * 	return p.checkerPool.GetChecker(ctx, nil)
 * }
 */
export declare function Program_GetTypeChecker(receiver: GoPtr<Program>, ctx: Context): [GoPtr<Checker>, () => void];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.ForEachCheckerParallel","kind":"method","status":"implemented","sigHash":"5a3006370d25c05251a48a40a185f9e41f887e1fbbc47f61a778ef9ad9ac33d5","bodyHash":"98d0a408c865da878b147713646aa4a39db708358c2756f15f0dfb3e307145ea"}
 *
 * Go source:
 * func (p *Program) ForEachCheckerParallel(cb func(idx int, c *checker.Checker)) {
 * 	if p.compilerCheckerPool != nil {
 * 		p.compilerCheckerPool.forEachCheckerParallel(cb)
 * 	}
 * }
 */
export declare function Program_ForEachCheckerParallel(receiver: GoPtr<Program>, cb: (idx: int, c: GoPtr<Checker>) => void): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetTypeCheckerForFile","kind":"method","status":"implemented","sigHash":"1e9f5cdc23ad2cc53c97af88539ba8f5c29e9faf05c932ff496ba8f901c370b3","bodyHash":"105a452d53394524fe809ec05f4e1c875b0ae939ec1bfaf6cfc687698c14ff69"}
 *
 * Go source:
 * func (p *Program) GetTypeCheckerForFile(ctx context.Context, file *ast.SourceFile) (*checker.Checker, func()) {
 * 	if p.compilerCheckerPool != nil {
 * 		return p.compilerCheckerPool.getCheckerForFileNonExclusive(file)
 * 	}
 * 	return p.checkerPool.GetChecker(ctx, file)
 * }
 */
export declare function Program_GetTypeCheckerForFile(receiver: GoPtr<Program>, ctx: Context, file: GoPtr<SourceFile>): [GoPtr<Checker>, () => void];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetTypeCheckerForFileExclusive","kind":"method","status":"implemented","sigHash":"e1d0b0bd38d97ea1e440c824b55c973914ec69b0657ebfe3153c18e9293790e0","bodyHash":"09499b81345800d341766f7ee0144b3004422afd5f552bb6d6346efdf0de166d"}
 *
 * Go source:
 * func (p *Program) GetTypeCheckerForFileExclusive(ctx context.Context, file *ast.SourceFile) (*checker.Checker, func()) {
 * 	if p.compilerCheckerPool != nil {
 * 		return p.compilerCheckerPool.getCheckerForFileExclusive(ctx, file)
 * 	}
 * 	return p.checkerPool.GetChecker(ctx, file)
 * }
 */
export declare function Program_GetTypeCheckerForFileExclusive(receiver: GoPtr<Program>, ctx: Context, file: GoPtr<SourceFile>): [GoPtr<Checker>, () => void];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetResolvedModule","kind":"method","status":"implemented","sigHash":"eb787d5ddb04bd874d214bb1cc82f727b68073d11a36c71c8c9206e1f4b258d4","bodyHash":"afc0e26f02f1fa37d95a61b23c47e468f9be6fb43d435fff3763db29b4d001a7"}
 *
 * Go source:
 * func (p *Program) GetResolvedModule(file ast.HasFileName, moduleReference string, mode core.ResolutionMode) *module.ResolvedModule {
 * 	if resolutions, ok := p.resolvedModules[file.Path()]; ok {
 * 		if resolved, ok := resolutions[module.ModeAwareCacheKey{Name: moduleReference, Mode: mode}]; ok {
 * 			return resolved
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Program_GetResolvedModule(receiver: GoPtr<Program>, file: HasFileName, moduleReference: string, mode: ResolutionMode): GoPtr<ResolvedModule>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetResolvedModuleFromModuleSpecifier","kind":"method","status":"implemented","sigHash":"02a6e4a4695bd3db8a306f22abd65633f27cca0edcba16fc5da0f535b9e8aad8","bodyHash":"606a5fd6eda306c6206d30e0247632407b602ca4607304d2325f8a9c22528d38"}
 *
 * Go source:
 * func (p *Program) GetResolvedModuleFromModuleSpecifier(file ast.HasFileName, moduleSpecifier *ast.StringLiteralLike) *module.ResolvedModule {
 * 	if !ast.IsStringLiteralLike(moduleSpecifier) {
 * 		panic("moduleSpecifier must be a StringLiteralLike")
 * 	}
 * 	mode := p.GetModeForUsageLocation(file, moduleSpecifier)
 * 	return p.GetResolvedModule(file, moduleSpecifier.Text(), mode)
 * }
 */
export declare function Program_GetResolvedModuleFromModuleSpecifier(receiver: GoPtr<Program>, file: HasFileName, moduleSpecifier: GoPtr<StringLiteralLike>): GoPtr<ResolvedModule>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetResolvedModules","kind":"method","status":"implemented","sigHash":"da91cb47c6a885908aa99b705ab7e6a069659a4186a8f807641d2fc622ea0e6e","bodyHash":"b6658a5be9c6947dcccd152b6c97e689551c4b50bc5a511463e2033ce81aaf94"}
 *
 * Go source:
 * func (p *Program) GetResolvedModules() map[tspath.Path]module.ModeAwareCache[*module.ResolvedModule] {
 * 	return p.resolvedModules
 * }
 */
export declare function Program_GetResolvedModules(receiver: GoPtr<Program>): GoMap<Path, ModeAwareCache<GoPtr<ResolvedModule>>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetPackagesMap","kind":"method","status":"implemented","sigHash":"03785ca54279e316b56cd7c042292a5a71949c299b02ad076e1fda139bc4b76c","bodyHash":"8e59d71dbb2799981c89206a293f22ce88773c3fdc569c2814547a06c0a88584"}
 *
 * Go source:
 * func (p *Program) GetPackagesMap() map[string]bool {
 * 	p.packagesMapOnce.Do(func() {
 * 		p.packagesMap = make(map[string]bool)
 * 		for _, resolvedModulesInFile := range p.resolvedModules {
 * 			for _, mod := range resolvedModulesInFile {
 * 				if mod.PackageId.Name != "" {
 * 					p.packagesMap[mod.PackageId.Name] = p.packagesMap[mod.PackageId.Name] || mod.Extension == tspath.ExtensionDts
 * 				}
 * 			}
 * 		}
 * 	})
 * 	return p.packagesMap
 * }
 */
export declare function Program_GetPackagesMap(receiver: GoPtr<Program>): GoMap<string, bool>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.collectDiagnostics","kind":"method","status":"implemented","sigHash":"124e0090ae352ee76aa7b31ad4da3be50da7c5737365b0a14c7fcff73f002e78","bodyHash":"ca301f1777e2a458258c4bf7939d82416cdd6fdef5438f961928bf63785edee4"}
 *
 * Go source:
 * func (p *Program) collectDiagnostics(ctx context.Context, sourceFile *ast.SourceFile, concurrent bool, collect func(context.Context, *ast.SourceFile) []*ast.Diagnostic) []*ast.Diagnostic {
 * 	var result []*ast.Diagnostic
 * 	if sourceFile != nil {
 * 		result = collect(ctx, sourceFile)
 * 	} else {
 * 		diagnostics := p.collectDiagnosticsFromFiles(ctx, p.files, concurrent, collect)
 * 		result = slices.Concat(diagnostics...)
 * 	}
 * 	return SortAndDeduplicateDiagnostics(result)
 * }
 */
export declare function Program_collectDiagnostics(receiver: GoPtr<Program>, ctx: Context, sourceFile: GoPtr<SourceFile>, concurrent: bool, collect: (arg0: Context, arg1: GoPtr<SourceFile>) => GoSlice<GoPtr<Diagnostic>>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.collectDiagnosticsFromFiles","kind":"method","status":"implemented","sigHash":"9144f49fb3417b26eeadc037bd2267b2fa8e312a015b1343138387df643df1b5","bodyHash":"f7485aa15aa7256dec49f5785a0b59becd0d74ecb18dda9d2ce3997221a4d9fe"}
 *
 * Go source:
 * func (p *Program) collectDiagnosticsFromFiles(ctx context.Context, sourceFiles []*ast.SourceFile, concurrent bool, collect func(context.Context, *ast.SourceFile) []*ast.Diagnostic) [][]*ast.Diagnostic {
 * 	diagnostics := make([][]*ast.Diagnostic, len(sourceFiles))
 * 	wg := core.NewWorkGroup(!concurrent || p.SingleThreaded())
 * 	for i, file := range sourceFiles {
 * 		wg.Queue(func() {
 * 			diagnostics[i] = collect(ctx, file)
 * 		})
 * 	}
 * 	wg.RunAndWait()
 * 	return diagnostics
 * }
 */
export declare function Program_collectDiagnosticsFromFiles(receiver: GoPtr<Program>, ctx: Context, sourceFiles: GoSlice<GoPtr<SourceFile>>, concurrent: bool, collect: (arg0: Context, arg1: GoPtr<SourceFile>) => GoSlice<GoPtr<Diagnostic>>): GoSlice<GoSlice<GoPtr<Diagnostic>>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.collectCheckerDiagnostics","kind":"method","status":"implemented","sigHash":"51b1af4466cb4d0534fd7782470e7a60e57b6d407e86bbebb938dac174a4f05a","bodyHash":"3ae1f043e02be01ef6006fd6879b5910500e1a3ee875630aa445069020e69359"}
 *
 * Go source:
 * func (p *Program) collectCheckerDiagnostics(ctx context.Context, sourceFile *ast.SourceFile, collect func(context.Context, *checker.Checker, *ast.SourceFile) []*ast.Diagnostic) []*ast.Diagnostic {
 * 	if sourceFile != nil {
 * 		if p.SkipTypeChecking(sourceFile, false) {
 * 			return nil
 * 		}
 * 		c, done := p.GetTypeCheckerForFileExclusive(ctx, sourceFile)
 * 		result := collect(ctx, c, sourceFile)
 * 		done()
 * 		return SortAndDeduplicateDiagnostics(result)
 * 	}
 * 	return SortAndDeduplicateDiagnostics(slices.Concat(p.collectCheckerDiagnosticsFromFiles(ctx, p.files, collect)...))
 * }
 */
export declare function Program_collectCheckerDiagnostics(receiver: GoPtr<Program>, ctx: Context, sourceFile: GoPtr<SourceFile>, collect: (arg0: Context, arg1: GoPtr<Checker>, arg2: GoPtr<SourceFile>) => GoSlice<GoPtr<Diagnostic>>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.collectCheckerDiagnosticsFromFiles","kind":"method","status":"implemented","sigHash":"6c8971e48d6bae50278c40718b6b259e90eb1e626abb7ae5fbbabf424eb24261","bodyHash":"9cfe7a80720fb87a365dd8f5cc4240ab9c5fc71382d105763ab6a43ce58b1e2c"}
 *
 * Go source:
 * func (p *Program) collectCheckerDiagnosticsFromFiles(ctx context.Context, sourceFiles []*ast.SourceFile, collect func(context.Context, *checker.Checker, *ast.SourceFile) []*ast.Diagnostic) [][]*ast.Diagnostic {
 * 	diagnostics := make([][]*ast.Diagnostic, len(sourceFiles))
 * 	if p.compilerCheckerPool != nil {
 * 		p.compilerCheckerPool.forEachCheckerGroupDo(ctx, sourceFiles, p.SingleThreaded(), func(c *checker.Checker, fileIndex int, file *ast.SourceFile) {
 * 			diagnostics[fileIndex] = collect(ctx, c, file)
 * 		})
 * 	} else {
 * 		wg := core.NewWorkGroup(p.SingleThreaded())
 * 		for i, file := range sourceFiles {
 * 			if p.SkipTypeChecking(file, false) {
 * 				continue
 * 			}
 * 			wg.Queue(func() {
 * 				c, done := p.checkerPool.GetChecker(ctx, file)
 * 				diagnostics[i] = collect(ctx, c, file)
 * 				done()
 * 			})
 * 		}
 * 		wg.RunAndWait()
 * 	}
 * 	return diagnostics
 * }
 */
export declare function Program_collectCheckerDiagnosticsFromFiles(receiver: GoPtr<Program>, ctx: Context, sourceFiles: GoSlice<GoPtr<SourceFile>>, collect: (arg0: Context, arg1: GoPtr<Checker>, arg2: GoPtr<SourceFile>) => GoSlice<GoPtr<Diagnostic>>): GoSlice<GoSlice<GoPtr<Diagnostic>>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetSyntacticDiagnostics","kind":"method","status":"implemented","sigHash":"5b7931971e5188c205afc074b2b9cf7fc2773d14b5ad5a3d43cd75043f1dbe21","bodyHash":"1bda46865064eb8cc42e2cd09b256086035279f05e0fa57141469199d9792e28"}
 *
 * Go source:
 * func (p *Program) GetSyntacticDiagnostics(ctx context.Context, sourceFile *ast.SourceFile) []*ast.Diagnostic {
 * 	return p.collectDiagnostics(ctx, sourceFile, false /*concurrent* /, func(_ context.Context, file *ast.SourceFile) []*ast.Diagnostic {
 * 		diags := core.Concatenate(file.Diagnostics(), file.JSDiagnostics())
 * 		// For JS files that won't be checked by the checker (no checkJs/ts-check), we need
 * 		// program-level syntactic checks that require compiler options. This mirrors Strada's
 * 		// getJSSyntacticDiagnosticsForFile in program.ts.
 * 		if ast.IsSourceFileJS(file) && !ast.IsCheckJSEnabledForFile(file, p.Options()) {
 * 			diags = append(diags, getAdditionalJSSyntacticDiagnostics(file, p.Options())...)
 * 		}
 * 		return diags
 * 	})
 * }
 */
export declare function Program_GetSyntacticDiagnostics(receiver: GoPtr<Program>, ctx: Context, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::getAdditionalJSSyntacticDiagnostics","kind":"func","status":"implemented","sigHash":"4cc134e32ccd6eb365106c7b13be731a4c16d12b9df6e3157876d7e86a0987a1","bodyHash":"a22d56db91f9912ae834bbb4dd0f947aabc7e73a3d7c4c17587fb36a709a52d4"}
 *
 * Go source:
 * func getAdditionalJSSyntacticDiagnostics(file *ast.SourceFile, options *core.CompilerOptions) []*ast.Diagnostic {
 * 	if options.ExperimentalDecorators.IsTrue() {
 * 		return nil
 * 	}
 * 	var diags []*ast.Diagnostic
 * 	// Parameter decorators are only valid with experimentalDecorators. Without it,
 * 	// the checker would report this, but the checker doesn't run on unchecked JS files.
 * 	var walk ast.Visitor
 * 	walk = func(node *ast.Node) bool {
 * 		if node.SubtreeFacts()&ast.SubtreeContainsDecorators == 0 {
 * 			return false
 * 		}
 * 		if node.Kind == ast.KindParameter && ast.HasDecorators(node) {
 * 			decorator := core.Find(node.ModifierNodes(), ast.IsDecorator)
 * 			if decorator != nil {
 * 				diags = append(diags, ast.NewDiagnostic(file, decorator.Loc, diagnostics.Decorators_are_not_valid_here))
 * 			}
 * 		}
 * 		node.ForEachChild(walk)
 * 		return false
 * 	}
 * 	file.AsNode().ForEachChild(walk)
 * 	return diags
 * }
 */
export declare function getAdditionalJSSyntacticDiagnostics(file: GoPtr<SourceFile>, options: GoPtr<CompilerOptions>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetBindDiagnostics","kind":"method","status":"implemented","sigHash":"095da506f9a3fd3269680f3ea12f04dfced3daec560c8cc8df2fe01d23a70933","bodyHash":"f6c8852b40bcb61a165361ac7131698cf8e257dfab659607bb4ce1d8b48bd30c"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"Single-file binding also records provider virtual module facts after normal TS-Go binding; no-extension programs remain unchanged."}
 *
 * Go source:
 * func (p *Program) GetBindDiagnostics(ctx context.Context, sourceFile *ast.SourceFile) []*ast.Diagnostic {
 * 	if sourceFile != nil {
 * 		binder.BindSourceFile(sourceFile)
 * 	} else {
 * 		p.BindSourceFiles()
 * 	}
 * 	return p.collectDiagnostics(ctx, sourceFile, false /*concurrent* /, func(_ context.Context, file *ast.SourceFile) []*ast.Diagnostic {
 * 		return file.BindDiagnostics()
 * 	})
 * }
 */
export declare function Program_GetBindDiagnostics(receiver: GoPtr<Program>, ctx: Context, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetSemanticDiagnostics","kind":"method","status":"implemented","sigHash":"bcc981c426c3f57d04542f3263562ddee4d27f91f7f301bdb982d72820e92c2a","bodyHash":"0b0cd7dfbd0c07892569d7456156b81b17ea53d19683a187b810ba8cd57e8718"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"Extension-owned semantic diagnostics are appended to the normal TSTS semantic diagnostic channel after TS-Go checking; no-extension programs return the exact TS-Go result."}
 *
 * Go source:
 * func (p *Program) GetSemanticDiagnostics(ctx context.Context, sourceFile *ast.SourceFile) []*ast.Diagnostic {
 * 	return p.collectCheckerDiagnostics(ctx, sourceFile, p.getSemanticDiagnosticsWithChecker)
 * }
 */
export declare function Program_GetSemanticDiagnostics(receiver: GoPtr<Program>, ctx: Context, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetSemanticDiagnosticsWithoutNoEmitFiltering","kind":"method","status":"implemented","sigHash":"d3d9c2f85f878717309d4b733bc00728a9022c33d1c199c86ccdf25566f1b67a","bodyHash":"214d5d450b18e7c7c4643d91816182a617d3eb3c8732e5e57212cbce0dc32ee1"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"Extension-owned semantic diagnostics are appended per source file before final sort/deduplication; no-extension programs return the exact TS-Go result."}
 *
 * Go source:
 * func (p *Program) GetSemanticDiagnosticsWithoutNoEmitFiltering(ctx context.Context, sourceFiles []*ast.SourceFile) map[*ast.SourceFile][]*ast.Diagnostic {
 * 	allDiags := p.collectCheckerDiagnosticsFromFiles(ctx, sourceFiles, p.getBindAndCheckDiagnosticsWithChecker)
 * 	result := make(map[*ast.SourceFile][]*ast.Diagnostic, len(sourceFiles))
 * 	for i, diags := range allDiags {
 * 		result[sourceFiles[i]] = SortAndDeduplicateDiagnostics(diags)
 * 	}
 * 	return result
 * }
 */
export declare function Program_GetSemanticDiagnosticsWithoutNoEmitFiltering(receiver: GoPtr<Program>, ctx: Context, sourceFiles: GoSlice<GoPtr<SourceFile>>): GoMap<GoPtr<SourceFile>, GoSlice<GoPtr<Diagnostic>>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetSuggestionDiagnostics","kind":"method","status":"implemented","sigHash":"90d9d4190153ef91a9d8c50bd06a034bfeb4aed45ba7b3c553be5c1f9519f7be","bodyHash":"949c8a81c4ad4fb8f03b35aef3b3c7f2c8b74574651b608b95309b3d0b1faf0a"}
 *
 * Go source:
 * func (p *Program) GetSuggestionDiagnostics(ctx context.Context, sourceFile *ast.SourceFile) []*ast.Diagnostic {
 * 	return p.collectCheckerDiagnostics(ctx, sourceFile, p.getSuggestionDiagnosticsWithChecker)
 * }
 */
export declare function Program_GetSuggestionDiagnostics(receiver: GoPtr<Program>, ctx: Context, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetProgramDiagnostics","kind":"method","status":"implemented","sigHash":"26d89878cad6bdc89a718a62296967d3f30a5323975dac05f14234c33e3559d5","bodyHash":"0249fa629ce89987da7bcc065f99315a2c78de2ea1643508108fcf8222c35e31"}
 *
 * Go source:
 * func (p *Program) GetProgramDiagnostics() []*ast.Diagnostic {
 * 	return SortAndDeduplicateDiagnostics(core.Concatenate(
 * 		p.programDiagnostics,
 * 		p.includeProcessor.getDiagnostics(p).GetGlobalDiagnostics(),
 * 	))
 * }
 */
export declare function Program_GetProgramDiagnostics(receiver: GoPtr<Program>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetIncludeProcessorDiagnostics","kind":"method","status":"implemented","sigHash":"8f118bd3b19429cb32fc1f20ad63ecbc44b27028ee32d85d3862551c9d3fa44d","bodyHash":"2ea2e5ba03a3c16aad0a0c1f749ff436abcde9220f108ba853778e96c06ebd27"}
 *
 * Go source:
 * func (p *Program) GetIncludeProcessorDiagnostics(sourceFile *ast.SourceFile) []*ast.Diagnostic {
 * 	if p.SkipTypeChecking(sourceFile, false) {
 * 		return nil
 * 	}
 * 	filtered, _ := p.getDiagnosticsWithPrecedingDirectives(sourceFile, p.includeProcessor.getDiagnostics(p).GetDiagnosticsForFile(sourceFile.FileName()))
 * 	return filtered
 * }
 */
export declare function Program_GetIncludeProcessorDiagnostics(receiver: GoPtr<Program>, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.SkipTypeChecking","kind":"method","status":"implemented","sigHash":"e1c9c4921b79fdb73618b7a2e06277fe7b8e0454477101d14845e9493a0ec692","bodyHash":"c5da946318e4365ac1de12fb68a45f867cf0bfbf13ce2f837d9a1db85634c4d6"}
 *
 * Go source:
 * func (p *Program) SkipTypeChecking(sourceFile *ast.SourceFile, ignoreNoCheck bool) bool {
 * 	return (!ignoreNoCheck && p.Options().NoCheck.IsTrue()) ||
 * 		p.Options().SkipLibCheck.IsTrue() && sourceFile.IsDeclarationFile ||
 * 		p.Options().SkipDefaultLibCheck.IsTrue() && p.IsSourceFileDefaultLibrary(sourceFile.Path()) ||
 * 		p.IsSourceFromProjectReference(sourceFile.Path()) ||
 * 		!p.canIncludeBindAndCheckDiagnostics(sourceFile)
 * }
 */
export declare function Program_SkipTypeChecking(receiver: GoPtr<Program>, sourceFile: GoPtr<SourceFile>, ignoreNoCheck: bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.canIncludeBindAndCheckDiagnostics","kind":"method","status":"implemented","sigHash":"8276847e4a290cb8dae4937fae38b775db9b679ce669a5a26d3ae6ddd6893b68","bodyHash":"cdf39b1041bac77043acf8ea3226fed02d20c607e0f80f4d54e5e777d4fa2678"}
 *
 * Go source:
 * func (p *Program) canIncludeBindAndCheckDiagnostics(sourceFile *ast.SourceFile) bool {
 * 	if sourceFile.CheckJsDirective != nil && !sourceFile.CheckJsDirective.Enabled {
 * 		return false
 * 	}
 *
 * 	if sourceFile.ScriptKind == core.ScriptKindTS || sourceFile.ScriptKind == core.ScriptKindTSX || sourceFile.ScriptKind == core.ScriptKindExternal {
 * 		return true
 * 	}
 *
 * 	isJS := sourceFile.ScriptKind == core.ScriptKindJS || sourceFile.ScriptKind == core.ScriptKindJSX
 * 	isCheckJS := isJS && ast.IsCheckJSEnabledForFile(sourceFile, p.Options())
 * 	isPlainJS := ast.IsPlainJSFile(sourceFile, p.Options().CheckJs)
 *
 * 	// By default, only type-check .ts, .tsx, Deferred, plain JS, checked JS and External
 * 	// - plain JS: .js files with no // ts-check and checkJs: undefined
 * 	// - check JS: .js files with either // ts-check or checkJs: true
 * 	// - external: files that are added by plugins
 * 	return isPlainJS || isCheckJS || sourceFile.ScriptKind == core.ScriptKindDeferred
 * }
 */
export declare function Program_canIncludeBindAndCheckDiagnostics(receiver: GoPtr<Program>, sourceFile: GoPtr<SourceFile>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.getSourceFilesToEmit","kind":"method","status":"implemented","sigHash":"3c8a73c97308d3345d56635603b4df341f1b6e1e5cadfe2da4a5623c6bc9dbe5","bodyHash":"bff12f538921561a7ae145218b7c93329ff0e914ac5b57a71fff6b4572f14281"}
 *
 * Go source:
 * func (p *Program) getSourceFilesToEmit(targetSourceFile *ast.SourceFile, forceDtsEmit bool) []*ast.SourceFile {
 * 	if targetSourceFile == nil && !forceDtsEmit {
 * 		p.sourceFilesToEmitOnce.Do(func() {
 * 			p.sourceFilesToEmit = getSourceFilesToEmit(p, nil, false)
 * 		})
 * 		return p.sourceFilesToEmit
 * 	}
 * 	return getSourceFilesToEmit(p, targetSourceFile, forceDtsEmit)
 * }
 */
export declare function Program_getSourceFilesToEmit(receiver: GoPtr<Program>, targetSourceFile: GoPtr<SourceFile>, forceDtsEmit: bool): GoSlice<GoPtr<SourceFile>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.verifyCompilerOptions","kind":"method","status":"implemented","sigHash":"077d344c33eac5f06e7ebc368fe85b0d94a968ec929fb31061adafdeadd171e1","bodyHash":"c65aaabfc27bbb5d88eb65246f2765f5ebbede9ed6b7a96c8db8968b59e1ffff"}
 *
 * Go source:
 * func (p *Program) verifyCompilerOptions() {
 * 	options := p.Options()
 *
 * 	sourceFile := core.Memoize(func() *ast.SourceFile {
 * 		configFile := p.opts.Config.ConfigFile
 * 		if configFile == nil {
 * 			return nil
 * 		}
 * 		return configFile.SourceFile
 * 	})
 *
 * 	configFilePath := core.Memoize(func() string {
 * 		file := sourceFile()
 * 		if file != nil {
 * 			return file.FileName()
 * 		}
 * 		return ""
 * 	})
 *
 * 	getCompilerOptionsPropertySyntax := core.Memoize(func() *ast.PropertyAssignment {
 * 		return tsoptions.ForEachTsConfigPropArray(sourceFile(), "compilerOptions", core.Identity)
 * 	})
 *
 * 	getCompilerOptionsObjectLiteralSyntax := core.Memoize(func() *ast.ObjectLiteralExpression {
 * 		compilerOptionsProperty := getCompilerOptionsPropertySyntax()
 * 		if compilerOptionsProperty != nil &&
 * 			compilerOptionsProperty.Initializer != nil &&
 * 			ast.IsObjectLiteralExpression(compilerOptionsProperty.Initializer) {
 * 			return compilerOptionsProperty.Initializer.AsObjectLiteralExpression()
 * 		}
 * 		return nil
 * 	})
 *
 * 	createOptionDiagnosticInObjectLiteralSyntax := func(objectLiteral *ast.ObjectLiteralExpression, onKey bool, key1 string, key2 string, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 		diag := tsoptions.ForEachPropertyAssignment(objectLiteral, key1, func(property *ast.PropertyAssignment) *ast.Diagnostic {
 * 			return tsoptions.CreateDiagnosticForNodeInSourceFile(sourceFile(), core.IfElse(onKey, property.Name(), property.Initializer), message, args...)
 * 		}, key2)
 * 		if diag != nil {
 * 			p.programDiagnostics = append(p.programDiagnostics, diag)
 * 		}
 * 		return diag
 * 	}
 *
 * 	createCompilerOptionsDiagnostic := func(message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 		compilerOptionsProperty := getCompilerOptionsPropertySyntax()
 * 		var diag *ast.Diagnostic
 * 		if compilerOptionsProperty != nil {
 * 			diag = tsoptions.CreateDiagnosticForNodeInSourceFile(sourceFile(), compilerOptionsProperty.Name(), message, args...)
 * 		} else {
 * 			diag = ast.NewCompilerDiagnostic(message, args...)
 * 		}
 * 		p.programDiagnostics = append(p.programDiagnostics, diag)
 * 		return diag
 * 	}
 *
 * 	createDiagnosticForOption := func(onKey bool, option1 string, option2 string, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 		diag := createOptionDiagnosticInObjectLiteralSyntax(getCompilerOptionsObjectLiteralSyntax(), onKey, option1, option2, message, args...)
 * 		if diag == nil {
 * 			diag = createCompilerOptionsDiagnostic(message, args...)
 * 		}
 * 		return diag
 * 	}
 *
 * 	createDiagnosticForOptionName := func(message *diagnostics.Message, option1 string, option2 string, args ...any) {
 * 		newArgs := make([]any, 0, len(args)+2)
 * 		newArgs = append(newArgs, option1, option2)
 * 		newArgs = append(newArgs, args...)
 * 		createDiagnosticForOption(true /*onKey* /, option1, option2, message, newArgs...)
 * 	}
 *
 * 	createOptionValueDiagnostic := func(option1 string, message *diagnostics.Message, args ...any) {
 * 		createDiagnosticForOption(false /*onKey* /, option1, "", message, args...)
 * 	}
 *
 * 	createRemovedOptionDiagnostic := func(name string, value string, useInstead string) {
 * 		var message *diagnostics.Message
 * 		var args []any
 * 		if value == "" {
 * 			message = diagnostics.Option_0_has_been_removed_Please_remove_it_from_your_configuration
 * 			args = []any{name}
 * 		} else {
 * 			message = diagnostics.Option_0_1_has_been_removed_Please_remove_it_from_your_configuration
 * 			args = []any{name, value}
 * 		}
 *
 * 		diag := createDiagnosticForOption(value == "", name, "", message, args...)
 * 		if useInstead != "" {
 * 			diag.AddMessageChain(ast.NewCompilerDiagnostic(diagnostics.Use_0_instead, useInstead))
 * 		}
 * 	}
 *
 * 	// Removed in TS7
 *
 * 	if options.BaseUrl != "" {
 * 		// BaseUrl will have been turned absolute by this point.
 * 		var useInstead string
 * 		if configFilePath() != "" {
 * 			relative := tspath.GetRelativePathFromFile(configFilePath(), options.BaseUrl, p.comparePathsOptions)
 * 			if !(strings.HasPrefix(relative, "./") || strings.HasPrefix(relative, "../")) {
 * 				relative = "./" + relative
 * 			}
 * 			suggestion := tspath.CombinePaths(relative, "*")
 * 			useInstead = fmt.Sprintf(`"paths": {"*": [%s]}`, core.Must(json.Marshal(suggestion)))
 * 		}
 * 		createRemovedOptionDiagnostic("baseUrl", "", useInstead)
 * 	}
 *
 * 	if options.OutFile != "" {
 * 		createRemovedOptionDiagnostic("outFile", "", "")
 * 	}
 *
 * 	if options.Target == core.ScriptTargetES5 {
 * 		createRemovedOptionDiagnostic("target", "ES5", "")
 * 	}
 *
 * 	if options.Module == core.ModuleKindAMD {
 * 		createRemovedOptionDiagnostic("module", "AMD", "")
 * 	}
 * 	if options.Module == core.ModuleKindSystem {
 * 		createRemovedOptionDiagnostic("module", "System", "")
 * 	}
 * 	if options.Module == core.ModuleKindUMD {
 * 		createRemovedOptionDiagnostic("module", "UMD", "")
 * 	}
 *
 * 	if options.ModuleResolution == core.ModuleResolutionKindClassic {
 * 		createRemovedOptionDiagnostic("moduleResolution", "Classic", "")
 * 	}
 *
 * 	if options.AlwaysStrict.IsFalse() {
 * 		createRemovedOptionDiagnostic("alwaysStrict", "false", "")
 * 	}
 *
 * 	if options.ESModuleInterop.IsFalse() {
 * 		createRemovedOptionDiagnostic("esModuleInterop", "false", "")
 * 	}
 *
 * 	if options.AllowSyntheticDefaultImports.IsFalse() {
 * 		createRemovedOptionDiagnostic("allowSyntheticDefaultImports", "false", "")
 * 	}
 *
 * 	if options.ModuleResolution == core.ModuleResolutionKindNode10 {
 * 		createRemovedOptionDiagnostic("moduleResolution", "node10", "")
 * 	}
 *
 * 	if !options.DownlevelIteration.IsUnknown() {
 * 		createRemovedOptionDiagnostic("downlevelIteration", "", "")
 * 	}
 *
 * 	if options.StrictPropertyInitialization.IsTrue() && !options.GetStrictOptionValue(options.StrictNullChecks) {
 * 		createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "strictPropertyInitialization", "strictNullChecks")
 * 	}
 * 	if options.ExactOptionalPropertyTypes.IsTrue() && !options.GetStrictOptionValue(options.StrictNullChecks) {
 * 		createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "exactOptionalPropertyTypes", "strictNullChecks")
 * 	}
 *
 * 	if options.IsolatedDeclarations.IsTrue() {
 * 		if options.GetAllowJS() {
 * 			createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_with_option_1, "allowJs", "isolatedDeclarations")
 * 		}
 * 		if !options.GetEmitDeclarations() {
 * 			createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_without_specifying_option_1_or_option_2, "isolatedDeclarations", "declaration", "composite")
 * 		}
 * 	}
 *
 * 	if options.InlineSourceMap.IsTrue() {
 * 		if options.SourceMap.IsTrue() {
 * 			createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_with_option_1, "sourceMap", "inlineSourceMap")
 * 		}
 * 		if options.MapRoot != "" {
 * 			createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_with_option_1, "mapRoot", "inlineSourceMap")
 * 		}
 * 	}
 *
 * 	if options.Composite.IsTrue() {
 * 		if options.Declaration.IsFalse() {
 * 			createDiagnosticForOptionName(diagnostics.Composite_projects_may_not_disable_declaration_emit, "declaration", "")
 * 		}
 * 		if options.Incremental.IsFalse() {
 * 			createDiagnosticForOptionName(diagnostics.Composite_projects_may_not_disable_incremental_compilation, "declaration", "")
 * 		}
 * 	}
 *
 * 	if options.TsBuildInfoFile == "" && options.Incremental.IsTrue() && options.ConfigFilePath == "" {
 * 		createCompilerOptionsDiagnostic(diagnostics.Option_incremental_is_only_valid_with_a_known_configuration_file_like_tsconfig_json_or_when_tsBuildInfoFile_is_explicitly_provided)
 * 	}
 *
 * 	p.verifyProjectReferences()
 *
 * 	if options.Composite.IsTrue() {
 * 		var rootPaths collections.Set[tspath.Path]
 * 		for _, fileName := range p.opts.Config.FileNames() {
 * 			rootPaths.Add(p.toPath(fileName))
 * 		}
 *
 * 		for _, file := range p.files {
 * 			if sourceFileMayBeEmitted(file, p, false) && !rootPaths.Has(file.Path()) {
 * 				p.includeProcessor.addProcessingDiagnostic(&processingDiagnostic{
 * 					kind: processingDiagnosticKindExplainingFileInclude,
 * 					data: &includeExplainingDiagnostic{
 * 						file:    file.Path(),
 * 						message: diagnostics.File_0_is_not_listed_within_the_file_list_of_project_1_Projects_must_list_all_files_or_use_an_include_pattern,
 * 						args:    []any{file.FileName(), configFilePath()},
 * 					},
 * 				})
 * 			}
 * 		}
 * 	}
 *
 * 	forEachOptionPathsSyntax := func(callback func(*ast.PropertyAssignment) *ast.Diagnostic) *ast.Diagnostic {
 * 		return tsoptions.ForEachPropertyAssignment(getCompilerOptionsObjectLiteralSyntax(), "paths", callback)
 * 	}
 *
 * 	createDiagnosticForOptionPaths := func(onKey bool, key string, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 		diag := forEachOptionPathsSyntax(func(pathProp *ast.PropertyAssignment) *ast.Diagnostic {
 * 			if ast.IsObjectLiteralExpression(pathProp.Initializer) {
 * 				return createOptionDiagnosticInObjectLiteralSyntax(pathProp.Initializer.AsObjectLiteralExpression(), onKey, key, "", message, args...)
 * 			}
 * 			return nil
 * 		})
 * 		if diag == nil {
 * 			diag = createCompilerOptionsDiagnostic(message, args...)
 * 		}
 * 		return diag
 * 	}
 *
 * 	createDiagnosticForOptionPathKeyValue := func(key string, valueIndex int, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 		diag := forEachOptionPathsSyntax(func(pathProp *ast.PropertyAssignment) *ast.Diagnostic {
 * 			if ast.IsObjectLiteralExpression(pathProp.Initializer) {
 * 				return tsoptions.ForEachPropertyAssignment(pathProp.Initializer.AsObjectLiteralExpression(), key, func(keyProps *ast.PropertyAssignment) *ast.Diagnostic {
 * 					initializer := keyProps.Initializer
 * 					if ast.IsArrayLiteralExpression(initializer) {
 * 						elements := initializer.ElementList()
 * 						if elements != nil && len(elements.Nodes) > valueIndex {
 * 							diag := tsoptions.CreateDiagnosticForNodeInSourceFile(sourceFile(), elements.Nodes[valueIndex], message, args...)
 * 							p.programDiagnostics = append(p.programDiagnostics, diag)
 * 							return diag
 * 						}
 * 					}
 * 					return nil
 * 				})
 * 			}
 * 			return nil
 * 		})
 * 		if diag == nil {
 * 			diag = createCompilerOptionsDiagnostic(message, args...)
 * 		}
 * 		return diag
 * 	}
 *
 * 	for key, value := range options.Paths.Entries() {
 * 		// !!! This code does not handle cases where where the path mappings have the wrong types,
 * 		// as that information is mostly lost during the parsing process.
 * 		if !hasZeroOrOneAsteriskCharacter(key) {
 * 			createDiagnosticForOptionPaths(true /*onKey* /, key, diagnostics.Pattern_0_can_have_at_most_one_Asterisk_character, key)
 * 		}
 * 		if value == nil {
 * 			createDiagnosticForOptionPaths(false /*onKey* /, key, diagnostics.Substitutions_for_pattern_0_should_be_an_array, key)
 * 		} else if len(value) == 0 {
 * 			createDiagnosticForOptionPaths(false /*onKey* /, key, diagnostics.Substitutions_for_pattern_0_shouldn_t_be_an_empty_array, key)
 * 		}
 * 		for i, subst := range value {
 * 			if !hasZeroOrOneAsteriskCharacter(subst) {
 * 				createDiagnosticForOptionPathKeyValue(key, i, diagnostics.Substitution_0_in_pattern_1_can_have_at_most_one_Asterisk_character, subst, key)
 * 			}
 * 			if !tspath.PathIsRelative(subst) && !tspath.PathIsAbsolute(subst) {
 * 				createDiagnosticForOptionPathKeyValue(key, i, diagnostics.Non_relative_paths_are_not_allowed_Did_you_forget_a_leading_Slash)
 * 			}
 * 		}
 * 	}
 *
 * 	if options.SourceMap.IsFalseOrUnknown() && options.InlineSourceMap.IsFalseOrUnknown() {
 * 		if options.InlineSources.IsTrue() {
 * 			createDiagnosticForOptionName(diagnostics.Option_0_can_only_be_used_when_either_option_inlineSourceMap_or_option_sourceMap_is_provided, "inlineSources", "")
 * 		}
 * 		if options.SourceRoot != "" {
 * 			createDiagnosticForOptionName(diagnostics.Option_0_can_only_be_used_when_either_option_inlineSourceMap_or_option_sourceMap_is_provided, "sourceRoot", "")
 * 		}
 * 	}
 *
 * 	if options.MapRoot != "" && !(options.SourceMap.IsTrue() || options.DeclarationMap.IsTrue()) {
 * 		// Error to specify --mapRoot without --sourcemap
 * 		createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_without_specifying_option_1_or_option_2, "mapRoot", "sourceMap", "declarationMap")
 * 	}
 *
 * 	if options.DeclarationDir != "" {
 * 		if !options.GetEmitDeclarations() {
 * 			createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_without_specifying_option_1_or_option_2, "declarationDir", "declaration", "composite")
 * 		}
 * 	}
 *
 * 	if options.DeclarationMap.IsTrue() && !options.GetEmitDeclarations() {
 * 		createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_without_specifying_option_1_or_option_2, "declarationMap", "declaration", "composite")
 * 	}
 *
 * 	if options.Lib != nil && options.NoLib.IsTrue() {
 * 		createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_with_option_1, "lib", "noLib")
 * 	}
 *
 * 	if options.IsolatedModules.IsTrue() || options.VerbatimModuleSyntax.IsTrue() {
 * 		if options.PreserveConstEnums.IsFalse() {
 * 			createDiagnosticForOptionName(diagnostics.Option_preserveConstEnums_cannot_be_disabled_when_0_is_enabled, core.IfElse(options.VerbatimModuleSyntax.IsTrue(), "verbatimModuleSyntax", "isolatedModules"), "preserveConstEnums")
 * 		}
 * 	}
 *
 * 	if options.OutDir != "" ||
 * 		options.RootDir != "" ||
 * 		options.SourceRoot != "" ||
 * 		options.MapRoot != "" ||
 * 		(options.GetEmitDeclarations() && options.DeclarationDir != "") {
 * 		// !!! sheetal checkSourceFilesBelongToPath - for root Dir and configFile - explaining why file is in the program
 * 		dir := p.CommonSourceDirectory()
 * 		if options.OutDir != "" && dir == "" && core.Some(p.files, func(f *ast.SourceFile) bool { return tspath.GetRootLength(f.FileName()) > 1 }) {
 * 			createDiagnosticForOptionName(diagnostics.Cannot_find_the_common_subdirectory_path_for_the_input_files, "outDir", "")
 * 		}
 * 	}
 *
 * 	if !options.NoEmit.IsTrue() &&
 * 		!options.Composite.IsTrue() &&
 * 		options.RootDir == "" &&
 * 		options.ConfigFilePath != "" &&
 * 		(options.OutDir != "" ||
 * 			(options.GetEmitDeclarations() && options.DeclarationDir != "") ||
 * 			options.OutFile != "") {
 * 		// Check if rootDir inferred changed and issue diagnostic
 * 		dir := p.CommonSourceDirectory()
 * 		var emittedFiles []string
 * 		for _, file := range p.files {
 * 			if !file.IsDeclarationFile && sourceFileMayBeEmitted(file, p, false) {
 * 				emittedFiles = append(emittedFiles, file.FileName())
 * 			}
 * 		}
 * 		dir59 := outputpaths.GetComputedCommonSourceDirectory(emittedFiles, p.GetCurrentDirectory(), p.UseCaseSensitiveFileNames())
 * 		if dir59 != "" && tspath.GetCanonicalFileName(dir, p.UseCaseSensitiveFileNames()) != tspath.GetCanonicalFileName(dir59, p.UseCaseSensitiveFileNames()) {
 * 			// change in layout
 * 			var option1 string
 * 			if options.OutFile != "" {
 * 				option1 = "outFile"
 * 			} else if options.OutDir != "" {
 * 				option1 = "outDir"
 * 			} else {
 * 				option1 = "declarationDir"
 * 			}
 * 			var option2 string
 * 			if options.OutFile == "" && options.OutDir != "" {
 * 				option2 = "declarationDir"
 * 			}
 * 			diag := createDiagnosticForOption(
 * 				true, /*onKey* /
 * 				option1,
 * 				option2,
 * 				diagnostics.The_common_source_directory_of_0_is_1_The_rootDir_setting_must_be_explicitly_set_to_this_or_another_path_to_adjust_your_output_s_file_layout,
 * 				tspath.GetBaseFileName(options.ConfigFilePath),
 * 				tspath.GetRelativePathFromFile(options.ConfigFilePath, dir59, p.comparePathsOptions),
 * 			)
 * 			diag.AddMessageChain(ast.NewCompilerDiagnostic(diagnostics.Visit_https_Colon_Slash_Slashaka_ms_Slashts6_for_migration_information))
 * 		}
 * 	}
 *
 * 	if options.CheckJs.IsTrue() && !options.GetAllowJS() {
 * 		createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "checkJs", "allowJs")
 * 	}
 *
 * 	if options.EmitDeclarationOnly.IsTrue() {
 * 		if !options.GetEmitDeclarations() {
 * 			createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_without_specifying_option_1_or_option_2, "emitDeclarationOnly", "declaration", "composite")
 * 		}
 * 	}
 *
 * 	if options.EmitDecoratorMetadata.IsTrue() && options.ExperimentalDecorators.IsFalseOrUnknown() {
 * 		createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "emitDecoratorMetadata", "experimentalDecorators")
 * 	}
 *
 * 	if options.JsxFactory != "" {
 * 		if options.ReactNamespace != "" {
 * 			createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_with_option_1, "reactNamespace", "jsxFactory")
 * 		}
 * 		if options.Jsx == core.JsxEmitReactJSX || options.Jsx == core.JsxEmitReactJSXDev {
 * 			createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_when_option_jsx_is_1, "jsxFactory", options.Jsx.String())
 * 		}
 * 		if parser.ParseIsolatedEntityName(options.JsxFactory) == nil {
 * 			createOptionValueDiagnostic("jsxFactory", diagnostics.Invalid_value_for_jsxFactory_0_is_not_a_valid_identifier_or_qualified_name, options.JsxFactory)
 * 		}
 * 	} else if options.ReactNamespace != "" && !scanner.IsIdentifierText(options.ReactNamespace, core.LanguageVariantStandard) {
 * 		createOptionValueDiagnostic("reactNamespace", diagnostics.Invalid_value_for_reactNamespace_0_is_not_a_valid_identifier, options.ReactNamespace)
 * 	}
 *
 * 	if options.JsxFragmentFactory != "" {
 * 		if options.JsxFactory == "" {
 * 			createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_without_specifying_option_1, "jsxFragmentFactory", "jsxFactory")
 * 		}
 * 		if options.Jsx == core.JsxEmitReactJSX || options.Jsx == core.JsxEmitReactJSXDev {
 * 			createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_when_option_jsx_is_1, "jsxFragmentFactory", options.Jsx.String())
 * 		}
 * 		if parser.ParseIsolatedEntityName(options.JsxFragmentFactory) == nil {
 * 			createOptionValueDiagnostic("jsxFragmentFactory", diagnostics.Invalid_value_for_jsxFragmentFactory_0_is_not_a_valid_identifier_or_qualified_name, options.JsxFragmentFactory)
 * 		}
 * 	}
 *
 * 	if options.ReactNamespace != "" {
 * 		if options.Jsx == core.JsxEmitReactJSX || options.Jsx == core.JsxEmitReactJSXDev {
 * 			createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_when_option_jsx_is_1, "reactNamespace", options.Jsx.String())
 * 		}
 * 	}
 *
 * 	if options.JsxImportSource != "" {
 * 		if options.Jsx == core.JsxEmitReact {
 * 			createDiagnosticForOptionName(diagnostics.Option_0_cannot_be_specified_when_option_jsx_is_1, "jsxImportSource", options.Jsx.String())
 * 		}
 * 	}
 *
 * 	moduleKind := options.GetEmitModuleKind()
 *
 * 	if options.AllowImportingTsExtensions.IsTrue() && !(options.NoEmit.IsTrue() || options.EmitDeclarationOnly.IsTrue() || options.RewriteRelativeImportExtensions.IsTrue()) {
 * 		createOptionValueDiagnostic("allowImportingTsExtensions", diagnostics.Option_allowImportingTsExtensions_can_only_be_used_when_one_of_noEmit_emitDeclarationOnly_or_rewriteRelativeImportExtensions_is_set)
 * 	}
 *
 * 	moduleResolution := options.GetModuleResolutionKind()
 * 	if options.ResolvePackageJsonExports.IsTrue() && !moduleResolutionSupportsPackageJsonExportsAndImports(moduleResolution) {
 * 		createDiagnosticForOptionName(diagnostics.Option_0_can_only_be_used_when_moduleResolution_is_set_to_node16_nodenext_or_bundler, "resolvePackageJsonExports", "")
 * 	}
 * 	if options.ResolvePackageJsonImports.IsTrue() && !moduleResolutionSupportsPackageJsonExportsAndImports(moduleResolution) {
 * 		createDiagnosticForOptionName(diagnostics.Option_0_can_only_be_used_when_moduleResolution_is_set_to_node16_nodenext_or_bundler, "resolvePackageJsonImports", "")
 * 	}
 * 	if options.CustomConditions != nil && !moduleResolutionSupportsPackageJsonExportsAndImports(moduleResolution) {
 * 		createDiagnosticForOptionName(diagnostics.Option_0_can_only_be_used_when_moduleResolution_is_set_to_node16_nodenext_or_bundler, "customConditions", "")
 * 	}
 *
 * 	if moduleResolution == core.ModuleResolutionKindBundler && !emitModuleKindIsNonNodeESM(moduleKind) && moduleKind != core.ModuleKindPreserve && moduleKind != core.ModuleKindCommonJS {
 * 		createOptionValueDiagnostic("moduleResolution", diagnostics.Option_0_can_only_be_used_when_module_is_set_to_preserve_commonjs_or_es2015_or_later, "bundler")
 * 	}
 *
 * 	if core.ModuleKindNode16 <= moduleKind && moduleKind <= core.ModuleKindNodeNext &&
 * 		!(core.ModuleResolutionKindNode16 <= moduleResolution && moduleResolution <= core.ModuleResolutionKindNodeNext) {
 * 		moduleKindName := moduleKind.String()
 * 		var moduleResolutionName string
 * 		if v, ok := core.ModuleKindToModuleResolutionKind[moduleKind]; ok {
 * 			moduleResolutionName = v.String()
 * 		} else {
 * 			moduleResolutionName = "Node16"
 * 		}
 * 		createOptionValueDiagnostic("moduleResolution", diagnostics.Option_moduleResolution_must_be_set_to_0_or_left_unspecified_when_option_module_is_set_to_1, moduleResolutionName, moduleKindName)
 * 	} else if core.ModuleResolutionKindNode16 <= moduleResolution && moduleResolution <= core.ModuleResolutionKindNodeNext &&
 * 		!(core.ModuleKindNode16 <= moduleKind && moduleKind <= core.ModuleKindNodeNext) {
 * 		moduleResolutionName := moduleResolution.String()
 * 		createOptionValueDiagnostic("module", diagnostics.Option_module_must_be_set_to_0_when_option_moduleResolution_is_set_to_1, moduleResolutionName, moduleResolutionName)
 * 	}
 *
 * 	// !!! The below needs filesByName, which is not equivalent to p.filesByPath.
 *
 * 	// If the emit is enabled make sure that every output file is unique and not overwriting any of the input files
 * 	if !options.NoEmit.IsTrue() && !options.SuppressOutputPathCheck.IsTrue() {
 * 		var emitFilesSeen collections.Set[string]
 *
 * 		// Verify that all the emit files are unique and don't overwrite input files
 * 		verifyEmitFilePath := func(emitFileName string) {
 * 			if emitFileName != "" {
 * 				emitFilePath := p.toPath(emitFileName)
 * 				// Report error if the output overwrites input file
 * 				if _, ok := p.filesByPath[emitFilePath]; ok {
 * 					diag := ast.NewCompilerDiagnostic(diagnostics.Cannot_write_file_0_because_it_would_overwrite_input_file, emitFileName)
 * 					if configFilePath() == "" {
 * 						// The program is from either an inferred project or an external project
 * 						diag.AddMessageChain(ast.NewCompilerDiagnostic(diagnostics.Adding_a_tsconfig_json_file_will_help_organize_projects_that_contain_both_TypeScript_and_JavaScript_files_Learn_more_at_https_Colon_Slash_Slashaka_ms_Slashtsconfig))
 * 					}
 * 					p.blockEmittingOfFile(emitFileName, diag)
 * 				}
 *
 * 				var emitFileKey string
 * 				if !p.Host().FS().UseCaseSensitiveFileNames() {
 * 					emitFileKey = tspath.ToFileNameLowerCase(string(emitFilePath))
 * 				} else {
 * 					emitFileKey = string(emitFilePath)
 * 				}
 *
 * 				// Report error if multiple files write into same file
 * 				if emitFilesSeen.Has(emitFileKey) {
 * 					// Already seen the same emit file - report error
 * 					p.blockEmittingOfFile(emitFileName, ast.NewCompilerDiagnostic(diagnostics.Cannot_write_file_0_because_it_would_be_overwritten_by_multiple_input_files, emitFileName))
 * 				} else {
 * 					emitFilesSeen.Add(emitFileKey)
 * 				}
 * 			}
 * 		}
 *
 * 		outputpaths.ForEachEmittedFile(p, options, func(emitFileNames *outputpaths.OutputPaths, sourceFile *ast.SourceFile) bool {
 * 			verifyEmitFilePath(emitFileNames.JsFilePath())
 * 			verifyEmitFilePath(emitFileNames.SourceMapFilePath())
 * 			verifyEmitFilePath(emitFileNames.DeclarationFilePath())
 * 			verifyEmitFilePath(emitFileNames.DeclarationMapPath())
 * 			return false
 * 		}, p.getSourceFilesToEmit(nil, false), false)
 * 		verifyEmitFilePath(p.opts.Config.GetBuildInfoFileName())
 * 	}
 * }
 */
export declare function Program_verifyCompilerOptions(receiver: GoPtr<Program>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.blockEmittingOfFile","kind":"method","status":"implemented","sigHash":"c96c781237b1980acd22e79aaaa602327c78cb095740c5cc91ff83de3031b1d3","bodyHash":"0c0cbb43c48adad6d9049aa1d12d13a5a344cbe04fd090dd961f79e61ba0a33e"}
 *
 * Go source:
 * func (p *Program) blockEmittingOfFile(emitFileName string, diag *ast.Diagnostic) {
 * 	p.hasEmitBlockingDiagnostics.Add(p.toPath(emitFileName))
 * 	p.programDiagnostics = append(p.programDiagnostics, diag)
 * }
 */
export declare function Program_blockEmittingOfFile(receiver: GoPtr<Program>, emitFileName: string, diag: GoPtr<Diagnostic>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.IsEmitBlocked","kind":"method","status":"implemented","sigHash":"6bf019df57aa8ab727f7176b278d0e89eb0caa7b99bbf6d31eaaa712cd22c8cd","bodyHash":"a0f9bc863cc2a92fffc61615c424836541471db54ce880e39a03c4861ef84059"}
 *
 * Go source:
 * func (p *Program) IsEmitBlocked(emitFileName string) bool {
 * 	return p.hasEmitBlockingDiagnostics.Has(p.toPath(emitFileName))
 * }
 */
export declare function Program_IsEmitBlocked(receiver: GoPtr<Program>, emitFileName: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.verifyProjectReferences","kind":"method","status":"implemented","sigHash":"cb81aeefa8f159be6f8c0425d4919e3bc29189150aeff7a34a16c620dcc1b841","bodyHash":"397374f237a504cf399da42ed3c66c464ac334472b60d78f5e1f84d11c47e459"}
 *
 * Go source:
 * func (p *Program) verifyProjectReferences() {
 * 	buildInfoFileName := core.IfElse(!p.Options().SuppressOutputPathCheck.IsTrue(), p.opts.Config.GetBuildInfoFileName(), "")
 * 	createDiagnosticForReference := func(config *tsoptions.ParsedCommandLine, index int, message *diagnostics.Message, args ...any) {
 * 		diag := tsoptions.CreateDiagnosticAtReferenceSyntax(config, index, message, args...)
 * 		if diag == nil {
 * 			diag = ast.NewCompilerDiagnostic(message, args...)
 * 		}
 * 		p.programDiagnostics = append(p.programDiagnostics, diag)
 * 	}
 *
 * 	p.RangeResolvedProjectReference(func(path tspath.Path, config *tsoptions.ParsedCommandLine, parent *tsoptions.ParsedCommandLine, index int) bool {
 * 		ref := parent.ProjectReferences()[index]
 * 		// !!! Deprecated in 5.0 and removed since 5.5
 * 		// verifyRemovedProjectReference(ref, parent, index);
 * 		if config == nil {
 * 			createDiagnosticForReference(parent, index, diagnostics.File_0_not_found, ref.Path)
 * 			return true
 * 		}
 * 		refOptions := config.CompilerOptions()
 * 		if !refOptions.Composite.IsTrue() || refOptions.NoEmit.IsTrue() {
 * 			if len(parent.FileNames()) > 0 {
 * 				if !refOptions.Composite.IsTrue() {
 * 					createDiagnosticForReference(parent, index, diagnostics.Referenced_project_0_must_have_setting_composite_Colon_true, ref.Path)
 * 				}
 * 				if refOptions.NoEmit.IsTrue() {
 * 					createDiagnosticForReference(parent, index, diagnostics.Referenced_project_0_may_not_disable_emit, ref.Path)
 * 				}
 * 			}
 * 		}
 * 		if buildInfoFileName != "" && buildInfoFileName == config.GetBuildInfoFileName() {
 * 			createDiagnosticForReference(parent, index, diagnostics.Cannot_write_file_0_because_it_will_overwrite_tsbuildinfo_file_generated_by_referenced_project_1, buildInfoFileName, ref.Path)
 * 			p.hasEmitBlockingDiagnostics.Add(p.toPath(buildInfoFileName))
 * 		}
 * 		return true
 * 	})
 * }
 */
export declare function Program_verifyProjectReferences(receiver: GoPtr<Program>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::hasZeroOrOneAsteriskCharacter","kind":"func","status":"implemented","sigHash":"c85c0244ba29cdd35813a987e01f767e83e79446e0057021489cf72a833854f2","bodyHash":"32eb42f18e2c51902e5a2f58606d5b19b19ea3cd6cd756951782401c41793630"}
 *
 * Go source:
 * func hasZeroOrOneAsteriskCharacter(str string) bool {
 * 	seenAsterisk := false
 * 	for _, ch := range str {
 * 		if ch == '*' {
 * 			if !seenAsterisk {
 * 				seenAsterisk = true
 * 			} else {
 * 				// have already seen asterisk
 * 				return false
 * 			}
 * 		}
 * 	}
 * 	return true
 * }
 */
export declare function hasZeroOrOneAsteriskCharacter(str: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::moduleResolutionSupportsPackageJsonExportsAndImports","kind":"func","status":"implemented","sigHash":"ffa431f5ea2177742a52f59fa43ad007a5d922958202a5c83fbc120f31406946","bodyHash":"8fff4fca20bade8c09a91af75dda94d508667657301fb429e5ee9a70845df34e"}
 *
 * Go source:
 * func moduleResolutionSupportsPackageJsonExportsAndImports(moduleResolution core.ModuleResolutionKind) bool {
 * 	return moduleResolution >= core.ModuleResolutionKindNode16 && moduleResolution <= core.ModuleResolutionKindNodeNext ||
 * 		moduleResolution == core.ModuleResolutionKindBundler
 * }
 */
export declare function moduleResolutionSupportsPackageJsonExportsAndImports(moduleResolution: ModuleResolutionKind): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::emitModuleKindIsNonNodeESM","kind":"func","status":"implemented","sigHash":"a0bbeac925b62f7bda274e6743864d9676bc62bd277f81481040659ca54e9daa","bodyHash":"966c1a501e5da48ddc10142fb8904ca007d3c8753d22bccd5596d96b096b0184"}
 *
 * Go source:
 * func emitModuleKindIsNonNodeESM(moduleKind core.ModuleKind) bool {
 * 	return moduleKind >= core.ModuleKindES2015 && moduleKind <= core.ModuleKindESNext
 * }
 */
export declare function emitModuleKindIsNonNodeESM(moduleKind: ModuleKind): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetGlobalDiagnostics","kind":"method","status":"implemented","sigHash":"af850db7e0012d4a166325e0bfc7157e77f96394fcf83ca8e2841cbe7899ce6e","bodyHash":"341c36b45ed10cb633b9c8ef41f06ce51072514e3053966089be68d6e24753cf"}
 *
 * Go source:
 * func (p *Program) GetGlobalDiagnostics(ctx context.Context) []*ast.Diagnostic {
 * 	if len(p.files) == 0 {
 * 		return nil
 * 	}
 * 	if p.compilerCheckerPool != nil {
 * 		return p.compilerCheckerPool.GetGlobalDiagnostics()
 * 	}
 * 	// For external pools (project system), global diagnostics are collected
 * 	// incrementally as checkers are used, not via a bulk query.
 * 	return nil
 * }
 */
export declare function Program_GetGlobalDiagnostics(receiver: GoPtr<Program>, ctx: Context): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetDeclarationDiagnostics","kind":"method","status":"implemented","sigHash":"c3917b6b1826f05f4b2c8ab649d4c7b1e31dc6031facb585157d92dde07a9fa4","bodyHash":"a96a64fe445cbc89370cfd1a5427734010aadfb9096374fdb668b2efc6ccb7c6"}
 *
 * Go source:
 * func (p *Program) GetDeclarationDiagnostics(ctx context.Context, sourceFile *ast.SourceFile) []*ast.Diagnostic {
 * 	return p.collectDiagnostics(ctx, sourceFile, true /*concurrent* /, p.getDeclarationDiagnosticsForFile)
 * }
 */
export declare function Program_GetDeclarationDiagnostics(receiver: GoPtr<Program>, ctx: Context, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::FilterNoEmitSemanticDiagnostics","kind":"func","status":"implemented","sigHash":"5e6ed69f28095291eb89e0af0888bcd352e47d8aea82eadea016b77b2908aac5","bodyHash":"ea80c8d631aab1599946381ca064b78a0692a64d1cbc128b3d9a3e05f8a47712"}
 *
 * Go source:
 * func FilterNoEmitSemanticDiagnostics(diagnostics []*ast.Diagnostic, options *core.CompilerOptions) []*ast.Diagnostic {
 * 	if !options.NoEmit.IsTrue() {
 * 		return diagnostics
 * 	}
 * 	return core.Filter(diagnostics, func(d *ast.Diagnostic) bool {
 * 		return !d.SkippedOnNoEmit()
 * 	})
 * }
 */
export declare function FilterNoEmitSemanticDiagnostics(diags: GoSlice<GoPtr<Diagnostic>>, options: GoPtr<CompilerOptions>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.getSemanticDiagnosticsWithChecker","kind":"method","status":"implemented","sigHash":"1b2927878abfa426f8e674d5a82927fbd22894eaf9d5357fa6d75d1c4659bcd1","bodyHash":"a9540bbd5e53b32192ca4a03320434bcc5b203eeb9309dd804513a70ebe04bd0"}
 *
 * Go source:
 * func (p *Program) getSemanticDiagnosticsWithChecker(ctx context.Context, c *checker.Checker, sourceFile *ast.SourceFile) []*ast.Diagnostic {
 * 	return core.Concatenate(
 * 		FilterNoEmitSemanticDiagnostics(p.getBindAndCheckDiagnosticsWithChecker(ctx, c, sourceFile), p.Options()),
 * 		p.GetIncludeProcessorDiagnostics(sourceFile),
 * 	)
 * }
 */
export declare function Program_getSemanticDiagnosticsWithChecker(receiver: GoPtr<Program>, ctx: Context, c: GoPtr<Checker>, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.getBindAndCheckDiagnosticsWithChecker","kind":"method","status":"implemented","sigHash":"58024f4d99ada564df7a23698f4cc8b6567aebe9250892ed517fdaae0f7ab8be","bodyHash":"c692dec725a0f679b5f3c530607a70c1efda4dbcf2b03c2aeb6de6c86e56976e"}
 * @tsgo-override {"category":"extension-host","allow":["body"],"reason":"Checker diagnostics force binding in TS-Go; provider virtual files must also publish their source declaration facts before source analysis consumes them. No-extension programs remain on the direct TS-Go path."}
 *
 * Go source:
 * func (p *Program) getBindAndCheckDiagnosticsWithChecker(ctx context.Context, fileChecker *checker.Checker, sourceFile *ast.SourceFile) []*ast.Diagnostic {
 * 	compilerOptions := p.Options()
 * 	if p.SkipTypeChecking(sourceFile, false) {
 * 		return nil
 * 	}
 *
 * 	// Checker creation forces binding, so bind diagnostics will be populated.
 * 	diags := slices.Clip(sourceFile.BindDiagnostics())
 * 	diags = append(diags, fileChecker.GetDiagnostics(ctx, sourceFile)...)
 *
 * 	isPlainJS := ast.IsPlainJSFile(sourceFile, compilerOptions.CheckJs)
 * 	if isPlainJS {
 * 		return core.Filter(diags, func(d *ast.Diagnostic) bool {
 * 			return plainJSErrors.Has(d.Code())
 * 		})
 * 	}
 *
 * 	isJS := sourceFile.ScriptKind == core.ScriptKindJS || sourceFile.ScriptKind == core.ScriptKindJSX
 * 	isCheckJS := isJS && ast.IsCheckJSEnabledForFile(sourceFile, compilerOptions)
 * 	if isCheckJS {
 * 		diags = append(diags, sourceFile.JSDocDiagnostics()...)
 * 	}
 *
 * 	filtered, directivesByLine := p.getDiagnosticsWithPrecedingDirectives(sourceFile, diags)
 * 	for _, directive := range directivesByLine {
 * 		// Above we changed all used directive kinds to @ts-ignore, so any @ts-expect-error directives that
 * 		// remain are unused and thus errors.
 * 		if directive.Kind == ast.CommentDirectiveKindExpectError {
 * 			filtered = append(filtered, ast.NewDiagnostic(sourceFile, directive.Loc, diagnostics.Unused_ts_expect_error_directive))
 * 		}
 * 	}
 * 	return filtered
 * }
 */
export declare function Program_getBindAndCheckDiagnosticsWithChecker(receiver: GoPtr<Program>, ctx: Context, fileChecker: GoPtr<Checker>, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.getDiagnosticsWithPrecedingDirectives","kind":"method","status":"implemented","sigHash":"cfad4c54294ed6238befb391c0c1cdc142c1e9810460139fbd1e08b7d3ece4f3","bodyHash":"7b20e030799de4f003e3d4a21755d0f0f52da30754ddd389539cecaf3ea50d7f"}
 *
 * Go source:
 * func (p *Program) getDiagnosticsWithPrecedingDirectives(sourceFile *ast.SourceFile, diags []*ast.Diagnostic) ([]*ast.Diagnostic, map[int]ast.CommentDirective) {
 * 	if len(sourceFile.CommentDirectives) == 0 {
 * 		return diags, nil
 * 	}
 * 	// Build map of directives by line number
 * 	directivesByLine := make(map[int]ast.CommentDirective)
 * 	for _, directive := range sourceFile.CommentDirectives {
 * 		line := scanner.GetECMALineOfPosition(sourceFile, directive.Loc.Pos())
 * 		directivesByLine[line] = directive
 * 	}
 * 	lineStarts := scanner.GetECMALineStarts(sourceFile)
 * 	filtered := make([]*ast.Diagnostic, 0, len(diags))
 * 	for _, diagnostic := range diags {
 * 		ignoreDiagnostic := false
 * 		for line := scanner.ComputeLineOfPosition(lineStarts, diagnostic.Pos()) - 1; line >= 0; line-- {
 * 			// If line contains a @ts-ignore or @ts-expect-error directive, ignore this diagnostic and change
 * 			// the directive kind to @ts-ignore to indicate it was used.
 * 			if directive, ok := directivesByLine[line]; ok {
 * 				ignoreDiagnostic = true
 * 				directive.Kind = ast.CommentDirectiveKindIgnore
 * 				directivesByLine[line] = directive
 * 				break
 * 			}
 * 			// Stop searching backwards when we encounter a line that isn't blank or a comment.
 * 			if !isCommentOrBlankLine(sourceFile.Text(), int(lineStarts[line])) {
 * 				break
 * 			}
 * 		}
 * 		if !ignoreDiagnostic {
 * 			filtered = append(filtered, diagnostic)
 * 		}
 * 	}
 * 	return filtered, directivesByLine
 * }
 */
export declare function Program_getDiagnosticsWithPrecedingDirectives(receiver: GoPtr<Program>, sourceFile: GoPtr<SourceFile>, diags: GoSlice<GoPtr<Diagnostic>>): [GoSlice<GoPtr<Diagnostic>>, GoMap<int, CommentDirective>];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.getDeclarationDiagnosticsForFile","kind":"method","status":"implemented","sigHash":"342ad0d3ce5ef039ad93dcb41c26af4af6823117e0dda02880de2cdc3363dd4b","bodyHash":"45459b62826b0ecaca3562e5e1800604b59cf18ed45f334bb5aa59fac21bbf38"}
 *
 * Go source:
 * func (p *Program) getDeclarationDiagnosticsForFile(ctx context.Context, sourceFile *ast.SourceFile) []*ast.Diagnostic {
 * 	if sourceFile.IsDeclarationFile {
 * 		return []*ast.Diagnostic{}
 * 	}
 *
 * 	if cached, ok := p.declarationDiagnosticCache.Load(sourceFile); ok {
 * 		return cached
 * 	}
 *
 * 	host, done := newEmitHost(ctx, p, sourceFile)
 * 	defer done()
 * 	diagnostics := getDeclarationDiagnostics(host, sourceFile)
 * 	diagnostics, _ = p.declarationDiagnosticCache.LoadOrStore(sourceFile, diagnostics)
 * 	return diagnostics
 * }
 */
export declare function Program_getDeclarationDiagnosticsForFile(receiver: GoPtr<Program>, ctx: Context, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.getSuggestionDiagnosticsWithChecker","kind":"method","status":"implemented","sigHash":"3f4cddb03eb443780d3e6d49fe4e18d093b340e664670eb829a660fe3f87116c","bodyHash":"77902dc26f70d565ae83bdbbf1bdcfd57de81927f43efdf43895db078201b6ca"}
 *
 * Go source:
 * func (p *Program) getSuggestionDiagnosticsWithChecker(ctx context.Context, fileChecker *checker.Checker, sourceFile *ast.SourceFile) []*ast.Diagnostic {
 * 	if p.SkipTypeChecking(sourceFile, false) {
 * 		return nil
 * 	}
 *
 * 	// Checker creation forces binding, so bind suggestion diagnostics will be populated.
 * 	diags := slices.Clip(sourceFile.BindSuggestionDiagnostics)
 * 	diags = append(diags, fileChecker.GetSuggestionDiagnostics(ctx, sourceFile)...)
 *
 * 	return diags
 * }
 */
export declare function Program_getSuggestionDiagnosticsWithChecker(receiver: GoPtr<Program>, ctx: Context, fileChecker: GoPtr<Checker>, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::isCommentOrBlankLine","kind":"func","status":"implemented","sigHash":"2cf9546cf1f4a3932154b336798580469e7bcadd259f7c0f4e9d328775d9cf32","bodyHash":"181187b0653b308451071bde6a0b3df4df3caa084f138690dcb08ff4e124b55e"}
 *
 * Go source:
 * func isCommentOrBlankLine(text string, pos int) bool {
 * 	for pos < len(text) && (text[pos] == ' ' || text[pos] == '\t') {
 * 		pos++
 * 	}
 * 	return pos == len(text) ||
 * 		pos < len(text) && (text[pos] == '\r' || text[pos] == '\n') ||
 * 		pos+1 < len(text) && text[pos] == '/' && text[pos+1] == '/'
 * }
 */
export declare function isCommentOrBlankLine(text: string, pos: int): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::SortAndDeduplicateDiagnostics","kind":"func","status":"implemented","sigHash":"9915c58133857e0f27b023ab28200543e6b2ff75f632810af0fa3f2a9021027a","bodyHash":"3f32e7d0dec67ac2088362abad58f7ee732df988deca8063d504672d0e130a98"}
 *
 * Go source:
 * func SortAndDeduplicateDiagnostics(diagnostics []*ast.Diagnostic) []*ast.Diagnostic {
 * 	diagnostics = slices.Clone(diagnostics)
 * 	slices.SortFunc(diagnostics, ast.CompareDiagnostics)
 * 	return compactAndMergeRelatedInfos(diagnostics)
 * }
 */
export declare function SortAndDeduplicateDiagnostics(diags: GoSlice<GoPtr<Diagnostic>>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::compactAndMergeRelatedInfos","kind":"func","status":"implemented","sigHash":"42709cae8871346e6c6a3377b0e66bcbe09454353ad492549702e97ff9075513","bodyHash":"e765bda8e871e462ee82676791c0e23190a24aa3ca2eb57fefec4b4ae6fb8b40"}
 *
 * Go source:
 * func compactAndMergeRelatedInfos(diagnostics []*ast.Diagnostic) []*ast.Diagnostic {
 * 	if len(diagnostics) < 2 {
 * 		return diagnostics
 * 	}
 * 	i := 0
 * 	j := 0
 * 	for i < len(diagnostics) {
 * 		d := diagnostics[i]
 * 		n := 1
 * 		for i+n < len(diagnostics) && ast.EqualDiagnosticsNoRelatedInfo(d, diagnostics[i+n]) {
 * 			n++
 * 		}
 * 		if n > 1 {
 * 			var relatedInfos []*ast.Diagnostic
 * 			for k := range n {
 * 				relatedInfos = append(relatedInfos, diagnostics[i+k].RelatedInformation()...)
 * 			}
 * 			if relatedInfos != nil {
 * 				slices.SortFunc(relatedInfos, ast.CompareDiagnostics)
 * 				relatedInfos = slices.CompactFunc(relatedInfos, ast.EqualDiagnostics)
 * 				d = d.Clone().SetRelatedInfo(relatedInfos)
 * 			}
 * 		}
 * 		diagnostics[j] = d
 * 		i += n
 * 		j++
 * 	}
 * 	clear(diagnostics[j:])
 * 	return diagnostics[:j]
 * }
 */
export declare function compactAndMergeRelatedInfos(diags: GoSlice<GoPtr<Diagnostic>>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.LineCount","kind":"method","status":"implemented","sigHash":"f10bc6c1d012957be80fc2c82135f28c10e0f5ebcead3a557baacb7533a19fe0","bodyHash":"98dca52e376bba00065af66e2a513c420a93ae28bad0ff6044e925b8bef176ba"}
 *
 * Go source:
 * func (p *Program) LineCount() int {
 * 	var count int
 * 	for _, file := range p.files {
 * 		count += len(file.ECMALineMap())
 * 	}
 * 	return count
 * }
 */
export declare function Program_LineCount(receiver: GoPtr<Program>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.IdentifierCount","kind":"method","status":"implemented","sigHash":"0ec8ead5b1bca16814afbbc1fdfd6465b36249696759818aec213064e87467b5","bodyHash":"c1bff123e740b122cc1516b9775cb92d35fb18e3011fca96d311ebe3f44d0dde"}
 *
 * Go source:
 * func (p *Program) IdentifierCount() int {
 * 	var count int
 * 	for _, file := range p.files {
 * 		count += file.IdentifierCount
 * 	}
 * 	return count
 * }
 */
export declare function Program_IdentifierCount(receiver: GoPtr<Program>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.SymbolCount","kind":"method","status":"implemented","sigHash":"b648897f379bb8af20af2508807d12f45cc3539dd2f7bde6d018990c18612e94","bodyHash":"0fce1efcada135f5bb7e9808ee7cd5044e48050c0fe5b7999bf2a941622fce67"}
 *
 * Go source:
 * func (p *Program) SymbolCount() int {
 * 	var count int
 * 	for _, file := range p.files {
 * 		count += file.SymbolCount
 * 	}
 * 	var val atomic.Uint32
 * 	val.Store(uint32(count))
 * 	p.ForEachCheckerParallel(func(_ int, c *checker.Checker) {
 * 		val.Add(c.SymbolCount)
 * 	})
 * 	return int(val.Load())
 * }
 */
export declare function Program_SymbolCount(receiver: GoPtr<Program>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.TypeCount","kind":"method","status":"implemented","sigHash":"2a5a60d5b8150f23591fb16721161d51534a05214f87a2f69bec91c862590e35","bodyHash":"9381bd6319b3f045a6e3a7ed31778a1fecfdacdd84c58770cc6b181377816b8a"}
 *
 * Go source:
 * func (p *Program) TypeCount() int {
 * 	var val atomic.Uint32
 * 	p.ForEachCheckerParallel(func(_ int, c *checker.Checker) {
 * 		val.Add(c.TypeCount)
 * 	})
 * 	return int(val.Load())
 * }
 */
export declare function Program_TypeCount(receiver: GoPtr<Program>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.InstantiationCount","kind":"method","status":"implemented","sigHash":"bf058749e3c8e0ab455bdd89855fa4afa4b2b2d095db962676c9a720b5b9adb1","bodyHash":"5469acf90ba945546cfdb1aba74fecad2c2c043018fe7d3a65222de32118141a"}
 *
 * Go source:
 * func (p *Program) InstantiationCount() int {
 * 	var val atomic.Uint32
 * 	p.ForEachCheckerParallel(func(_ int, c *checker.Checker) {
 * 		val.Add(c.TotalInstantiationCount)
 * 	})
 * 	return int(val.Load())
 * }
 */
export declare function Program_InstantiationCount(receiver: GoPtr<Program>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.Program","kind":"method","status":"implemented","sigHash":"a674f6f932c9fa66b91e09e0c7f555d210360200ee171bdabfe75135c557be72","bodyHash":"43e21a7ad625637994cc740f3bee508adae857ff15009683a049fb25dd5f9bb5"}
 *
 * Go source:
 * func (p *Program) Program() *Program {
 * 	return p
 * }
 */
export declare function Program_Program(receiver: GoPtr<Program>): GoPtr<Program>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetSourceFileMetaData","kind":"method","status":"implemented","sigHash":"1e40507ef9422b126edb9064cfed4ee395402334152905447c67b1e1507e702b","bodyHash":"3195515a9c80a0557180035cbd260caeb8dfa0d24a3a6342c74be93c638a11bc"}
 *
 * Go source:
 * func (p *Program) GetSourceFileMetaData(path tspath.Path) ast.SourceFileMetaData {
 * 	return p.sourceFileMetaDatas[path]
 * }
 */
export declare function Program_GetSourceFileMetaData(receiver: GoPtr<Program>, path: Path): SourceFileMetaData;
export declare function Program_GetEmitModuleFormatOfFile(receiver: GoPtr<Program>, sourceFile: HasFileName): ModuleKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetEmitSyntaxForUsageLocation","kind":"method","status":"implemented","sigHash":"2ef4a9bd8c4c108a9ae28a13a2cbd638242c0f18cf11674026f9754cd5d72433","bodyHash":"fd469f113107be68cbd0c94c004e205b82a5881e4e44ac50b58f73cc0cc5b9b0"}
 *
 * Go source:
 * func (p *Program) GetEmitSyntaxForUsageLocation(sourceFile ast.HasFileName, location *ast.StringLiteralLike) core.ResolutionMode {
 * 	return getEmitSyntaxForUsageLocationWorker(sourceFile.FileName(), p.sourceFileMetaDatas[sourceFile.Path()], location, p.projectReferenceFileMapper.getCompilerOptionsForFile(sourceFile))
 * }
 */
export declare function Program_GetEmitSyntaxForUsageLocation(receiver: GoPtr<Program>, sourceFile: HasFileName, location: GoPtr<StringLiteralLike>): ResolutionMode;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetImpliedNodeFormatForEmit","kind":"method","status":"implemented","sigHash":"203188fee2b3c8e9166e87495595c67553777b96c58081adb3c170d64e27331a","bodyHash":"0874925ed7752d4c18bd5c2e5bf7dc5a8b89cb52a343930244805b4b82de991c"}
 *
 * Go source:
 * func (p *Program) GetImpliedNodeFormatForEmit(sourceFile ast.HasFileName) core.ResolutionMode {
 * 	return ast.GetImpliedNodeFormatForEmitWorker(sourceFile.FileName(), p.projectReferenceFileMapper.getCompilerOptionsForFile(sourceFile).GetEmitModuleKind(), p.GetSourceFileMetaData(sourceFile.Path()))
 * }
 */
export declare function Program_GetImpliedNodeFormatForEmit(receiver: GoPtr<Program>, sourceFile: HasFileName): ResolutionMode;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetModeForUsageLocation","kind":"method","status":"implemented","sigHash":"d772e66f00d4427e8d13ad24d5b9d49a0a9346ee17a8d8f3768bd2d44013d3c2","bodyHash":"f1966eba4a889580fbe0bf9284c110c9ccb4f19875b4191961f9f98a673533e8"}
 *
 * Go source:
 * func (p *Program) GetModeForUsageLocation(sourceFile ast.HasFileName, location *ast.StringLiteralLike) core.ResolutionMode {
 * 	return getModeForUsageLocation(sourceFile.FileName(), p.sourceFileMetaDatas[sourceFile.Path()], location, p.projectReferenceFileMapper.getCompilerOptionsForFile(sourceFile))
 * }
 */
export declare function Program_GetModeForUsageLocation(receiver: GoPtr<Program>, sourceFile: HasFileName, location: GoPtr<StringLiteralLike>): ResolutionMode;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetDefaultResolutionModeForFile","kind":"method","status":"implemented","sigHash":"251cee09e6eff3a3a9c2901d4f11df0c8f042893ddfd0bbf8ddeb6f09a97b90b","bodyHash":"534a4d68a955d0ec453303739bbf231f61a7ff45f804fc68f73d0c456d7e052e"}
 *
 * Go source:
 * func (p *Program) GetDefaultResolutionModeForFile(sourceFile ast.HasFileName) core.ResolutionMode {
 * 	return getDefaultResolutionModeForFile(sourceFile.FileName(), p.sourceFileMetaDatas[sourceFile.Path()], p.projectReferenceFileMapper.getCompilerOptionsForFile(sourceFile))
 * }
 */
export declare function Program_GetDefaultResolutionModeForFile(receiver: GoPtr<Program>, sourceFile: HasFileName): ResolutionMode;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.IsSourceFileDefaultLibrary","kind":"method","status":"implemented","sigHash":"459e2eb7d34fee27688587398e4ee323c035b5f58ac2b198ee38c195c78b1f01","bodyHash":"806c2aa2f33d21e526fe60d9dc515a675856758f0af86e11a2b18d08afa86eb4"}
 *
 * Go source:
 * func (p *Program) IsSourceFileDefaultLibrary(path tspath.Path) bool {
 * 	_, ok := p.libFiles[path]
 * 	return ok
 * }
 */
export declare function Program_IsSourceFileDefaultLibrary(receiver: GoPtr<Program>, path: Path): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.IsGlobalTypingsFile","kind":"method","status":"implemented","sigHash":"ed6e1496e45f6c1d1dc5067be9d1ac6e4ef4f76ae45d232825c7d919d7c3ca95","bodyHash":"8e62bd0ffdd0c14525d91bbe29d0966f0f43ceee077284c769cec21d1bec23a2"}
 *
 * Go source:
 * func (p *Program) IsGlobalTypingsFile(fileName string) bool {
 * 	if !tspath.IsDeclarationFileName(fileName) {
 * 		return false
 * 	}
 * 	return tspath.ContainsPath(p.GetGlobalTypingsCacheLocation(), fileName, p.comparePathsOptions)
 * }
 */
export declare function Program_IsGlobalTypingsFile(receiver: GoPtr<Program>, fileName: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetDefaultLibFile","kind":"method","status":"implemented","sigHash":"8ce0d7e33d7833ea5fb8ec7c5b8cacdd214fe0099f1ea74c7274e8f48c15cb7e","bodyHash":"6ad085a399fb3c267b2519f4164b81640e8f0d13be49c052200f8fe3f6477e48"}
 *
 * Go source:
 * func (p *Program) GetDefaultLibFile(path tspath.Path) *LibFile {
 * 	if libFile, ok := p.libFiles[path]; ok {
 * 		return libFile
 * 	}
 * 	return nil
 * }
 */
export declare function Program_GetDefaultLibFile(receiver: GoPtr<Program>, path: Path): GoPtr<LibFile>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.CommonSourceDirectory","kind":"method","status":"implemented","sigHash":"937483ca5bd530054d5ba315e96d4b45935515604e16ae770a62e2b3763ef557","bodyHash":"8d127abef7f7bbd9c7f1e2fb3b9e0c803559826788cf7b9a2ae13c57db621cff"}
 *
 * Go source:
 * func (p *Program) CommonSourceDirectory() string {
 * 	p.commonSourceDirectoryOnce.Do(func() {
 * 		p.commonSourceDirectory = outputpaths.GetCommonSourceDirectory(
 * 			p.Options(),
 * 			func() []string {
 * 				var files []string
 * 				for _, file := range p.files {
 * 					if sourceFileMayBeEmitted(file, p, false /*forceDtsEmit* /) {
 * 						files = append(files, file.FileName())
 * 					}
 * 				}
 * 				return files
 * 			},
 * 			p.GetCurrentDirectory(),
 * 			p.UseCaseSensitiveFileNames(),
 * 			p.checkSourceFilesBelongToPath,
 * 		)
 * 	})
 * 	return p.commonSourceDirectory
 * }
 */
export declare function Program_CommonSourceDirectory(receiver: GoPtr<Program>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.checkSourceFilesBelongToPath","kind":"method","status":"implemented","sigHash":"8cecb85222182aa47aab6f17ea783e121c7da0c58143b277e78d731b96f8a268","bodyHash":"c5556644b9f6a6e1839e93fc48107775a60195287b62c448a7d6304ca20ddf81"}
 *
 * Go source:
 * func (p *Program) checkSourceFilesBelongToPath(sourceFiles []string, rootDirectory string) bool {
 * 	allFilesBelongToPath := true
 * 	for _, file := range sourceFiles {
 * 		absoluteSourceFilePath := tspath.GetCanonicalFileName(tspath.GetNormalizedAbsolutePath(file, p.GetCurrentDirectory()), p.UseCaseSensitiveFileNames())
 * 		if !tspath.ContainsPath(rootDirectory, file, p.comparePathsOptions) {
 * 			p.includeProcessor.addProcessingDiagnostic(&processingDiagnostic{
 * 				kind: processingDiagnosticKindExplainingFileInclude,
 * 				data: &includeExplainingDiagnostic{
 * 					file:    tspath.Path(absoluteSourceFilePath),
 * 					message: diagnostics.File_0_is_not_under_rootDir_1_rootDir_is_expected_to_contain_all_source_files,
 * 					args:    []any{file, rootDirectory},
 * 				},
 * 			})
 * 			allFilesBelongToPath = false
 * 		}
 * 	}
 *
 * 	return allFilesBelongToPath
 * }
 */
export declare function Program_checkSourceFilesBelongToPath(receiver: GoPtr<Program>, sourceFiles: GoSlice<string>, rootDirectory: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::type::WriteFileData","kind":"type","status":"implemented","sigHash":"d02490559e7148904b3f7b5cb45b50fc74ceda7b7b8f1867e80c5e3c4fa1c2f4","bodyHash":"e6fe73d2896a49d500f38236d0752b6a65a8c754fc8813de34a9afa374cfb4a3"}
 *
 * Go source:
 * WriteFileData struct {
 * 	SourceMapUrlPos int
 * 	BuildInfo       any
 * 	Diagnostics     []*ast.Diagnostic
 * 	SkippedDtsWrite bool
 * }
 */
export interface WriteFileData {
    SourceMapUrlPos: int;
    BuildInfo: unknown;
    Diagnostics: GoSlice<GoPtr<Diagnostic>>;
    SkippedDtsWrite: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::type::WriteFile","kind":"type","status":"implemented","sigHash":"ba248e1607ef5b04f34850638b47f043fd241cbd5b280e645682cff6e5c82cda","bodyHash":"6623636b568197a088ad3a5bfae97fe3b1a313f92d8cce82e952a6b3377a3ebc"}
 *
 * Go source:
 * WriteFile func(fileName string, text string, data *WriteFileData) error
 */
export type WriteFile = (fileName: string, text: string, data: GoPtr<WriteFileData>) => GoError;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::type::EmitOptions","kind":"type","status":"implemented","sigHash":"83ed49471ad2467500bc809d9a9f0d63d64794c8e634e9fce9d4baf6375d0a61","bodyHash":"5653afb4ca3dcd588dcbb73c6cd0144bf3603504503b2785ee45b7bac68521bc"}
 *
 * Go source:
 * EmitOptions struct {
 * 	TargetSourceFile *ast.SourceFile // Single file to emit. If `nil`, emits all files
 * 	EmitOnly         EmitOnly
 * 	WriteFile        WriteFile
 * }
 */
export interface EmitOptions {
    TargetSourceFile: GoPtr<SourceFile>;
    EmitOnly: EmitOnly;
    WriteFile: WriteFile;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::type::EmitResult","kind":"type","status":"implemented","sigHash":"2b25aa59d895e79438eb5e11a2f176f46472bb77b9e5124546e1db4ee3fb05fb","bodyHash":"95514003bfcb59d4414b8dab535aca2f66de7283ac74f432d494df29dc155936"}
 *
 * Go source:
 * EmitResult struct {
 * 	EmitSkipped  bool
 * 	Diagnostics  []*ast.Diagnostic      // Contains declaration emit diagnostics
 * 	EmittedFiles []string               // Array of files the compiler wrote to disk
 * 	SourceMaps   []*SourceMapEmitResult // Array of sourceMapData if compiler emitted sourcemaps
 * }
 */
export interface EmitResult {
    EmitSkipped: bool;
    Diagnostics: GoSlice<GoPtr<Diagnostic>>;
    EmittedFiles: GoSlice<string>;
    SourceMaps: GoSlice<GoPtr<SourceMapEmitResult>>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::type::SourceMapEmitResult","kind":"type","status":"implemented","sigHash":"7ad85d13512052f6531bc4053ced1acc97e80e662f021a4ebac5cec2388f8c36","bodyHash":"22345f7177b657f5674396ef506612d7908308709f384d89c29696dca67d4d77"}
 *
 * Go source:
 * SourceMapEmitResult struct {
 * 	InputSourceFileNames []string // Input source file (which one can use on program to get the file), 1:1 mapping with the sourceMap.sources list
 * 	SourceMap            *sourcemap.RawSourceMap
 * 	GeneratedFile        string
 * }
 */
export interface SourceMapEmitResult {
    InputSourceFileNames: GoSlice<string>;
    SourceMap: GoPtr<RawSourceMap>;
    GeneratedFile: string;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.Emit","kind":"method","status":"implemented","sigHash":"7abab2f1a8e2d654d7db6e62222718c78cca49738cce59150dd2a0a133db89f1","bodyHash":"a6bfc6bb99bba33be0c2fd9ddbc85c9459b21f5bb689eddbdf8e08161de8e071"}
 *
 * Go source:
 * func (p *Program) Emit(ctx context.Context, options EmitOptions) *EmitResult {
 * 	if tr := p.opts.Tracing; tr != nil {
 * 		defer tr.Push(tracing.PhaseEmit, "emit", nil, true)()
 * 	}
 *
 * 	if options.EmitOnly != EmitOnlyForcedDts {
 * 		result := HandleNoEmitOnError(
 * 			ctx,
 * 			p,
 * 			options.TargetSourceFile,
 * 		)
 * 		if result != nil || ctx.Err() != nil {
 * 			return result
 * 		}
 * 	}
 *
 * 	newLine := p.Options().NewLine.GetNewLineCharacter()
 * 	writerPool := &sync.Pool{
 * 		New: func() any {
 * 			return printer.NewTextWriter(newLine, 0)
 * 		},
 * 	}
 * 	wg := core.NewWorkGroup(p.SingleThreaded())
 * 	var emitters []*emitter
 * 	sourceFiles := p.getSourceFilesToEmit(options.TargetSourceFile, options.EmitOnly == EmitOnlyForcedDts)
 *
 * 	for _, sourceFile := range sourceFiles {
 * 		emitter := &emitter{
 * 			writer:     nil,
 * 			sourceFile: sourceFile,
 * 			emitOnly:   options.EmitOnly,
 * 			writeFile:  options.WriteFile,
 * 			tr:         p.opts.Tracing,
 * 		}
 * 		emitters = append(emitters, emitter)
 * 		wg.Queue(func() {
 * 			host, done := newEmitHost(ctx, p, sourceFile)
 * 			defer done()
 * 			emitter.host = host
 *
 * 			// take an unused writer
 * 			writer := writerPool.Get().(printer.EmitTextWriter)
 * 			writer.Clear()
 *
 * 			// attach writer and perform emit
 * 			emitter.writer = writer
 * 			emitter.paths = outputpaths.GetOutputPathsFor(sourceFile, host.Options(), host, options.EmitOnly == EmitOnlyForcedDts)
 * 			emitter.emit()
 * 			emitter.writer = nil
 *
 * 			// put the writer back in the pool
 * 			writerPool.Put(writer)
 * 		})
 * 	}
 *
 * 	// wait for emit to complete
 * 	wg.RunAndWait()
 *
 * 	// collect results from emit, preserving input order
 * 	return CombineEmitResults(core.Map(emitters, func(e *emitter) *EmitResult {
 * 		return &e.emitResult
 * 	}))
 * }
 */
export declare function Program_Emit(receiver: GoPtr<Program>, ctx: Context, options: EmitOptions): GoPtr<EmitResult>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::CombineEmitResults","kind":"func","status":"implemented","sigHash":"d342ab3c98b22d1fcf89ec01659c0c81d8e00f090a4ad4393812d90e6190186f","bodyHash":"18a1df50f9e1e8ff48f58ecb7f71d9508abd693c69bfa5eb853de9f2537feef3"}
 *
 * Go source:
 * func CombineEmitResults(results []*EmitResult) *EmitResult {
 * 	result := &EmitResult{}
 * 	for _, emitResult := range results {
 * 		if emitResult == nil {
 * 			continue // Skip nil results
 * 		}
 * 		if emitResult.EmitSkipped {
 * 			result.EmitSkipped = true
 * 		}
 * 		result.Diagnostics = append(result.Diagnostics, emitResult.Diagnostics...)
 * 		result.EmittedFiles = append(result.EmittedFiles, emitResult.EmittedFiles...)
 * 		if emitResult.SourceMaps != nil {
 * 			result.SourceMaps = append(result.SourceMaps, emitResult.SourceMaps...)
 * 		}
 * 	}
 * 	return result
 * }
 */
export declare function CombineEmitResults(results: GoSlice<GoPtr<EmitResult>>): GoPtr<EmitResult>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::type::ProgramLike","kind":"type","status":"implemented","sigHash":"45c6e989acc4aaba77f0d584525ceb25ca00c5414248da6530c643ddac31b5c1","bodyHash":"f4ac1b6b329fc5133cc1f242b5040885638a4bd626ec4c5c9912fec1a3613300"}
 *
 * Go source:
 * ProgramLike interface {
 * 	Options() *core.CompilerOptions
 * 	GetSourceFile(path string) *ast.SourceFile
 * 	GetSourceFiles() []*ast.SourceFile
 * 	GetConfigFileParsingDiagnostics() []*ast.Diagnostic
 * 	GetSyntacticDiagnostics(ctx context.Context, file *ast.SourceFile) []*ast.Diagnostic
 * 	GetBindDiagnostics(ctx context.Context, file *ast.SourceFile) []*ast.Diagnostic
 * 	GetProgramDiagnostics() []*ast.Diagnostic
 * 	GetGlobalDiagnostics(ctx context.Context) []*ast.Diagnostic
 * 	GetSemanticDiagnostics(ctx context.Context, file *ast.SourceFile) []*ast.Diagnostic
 * 	GetDeclarationDiagnostics(ctx context.Context, file *ast.SourceFile) []*ast.Diagnostic
 * 	GetSuggestionDiagnostics(ctx context.Context, file *ast.SourceFile) []*ast.Diagnostic
 * 	Emit(ctx context.Context, options EmitOptions) *EmitResult
 * 	CommonSourceDirectory() string
 * 	IsSourceFileDefaultLibrary(path tspath.Path) bool
 * 	Program() *Program
 * }
 */
export interface ProgramLike {
    Options(): GoPtr<CompilerOptions>;
    GetSourceFile(path: string): GoPtr<SourceFile>;
    GetSourceFiles(): GoSlice<GoPtr<SourceFile>>;
    GetConfigFileParsingDiagnostics(): GoSlice<GoPtr<Diagnostic>>;
    GetSyntacticDiagnostics(ctx: Context, file: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
    GetBindDiagnostics(ctx: Context, file: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
    GetProgramDiagnostics(): GoSlice<GoPtr<Diagnostic>>;
    GetGlobalDiagnostics(ctx: Context): GoSlice<GoPtr<Diagnostic>>;
    GetSemanticDiagnostics(ctx: Context, file: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
    GetDeclarationDiagnostics(ctx: Context, file: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
    GetSuggestionDiagnostics(ctx: Context, file: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
    Emit(ctx: Context, options: EmitOptions): GoPtr<EmitResult>;
    CommonSourceDirectory(): string;
    IsSourceFileDefaultLibrary(path: Path): bool;
    Program(): GoPtr<Program>;
}
export declare function Program_as_compiler_ProgramLike(receiver: GoPtr<Program>): ProgramLike;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::HandleNoEmitOnError","kind":"func","status":"implemented","sigHash":"28dba03229c19cfc96503e26722fab84ad25ac1c5bb4e6ee84ed503249aba001","bodyHash":"276c17cab1d1e914af5e55db9e8e65af56b0ba34792f6f3b7211910b122d49f6"}
 *
 * Go source:
 * func HandleNoEmitOnError(ctx context.Context, program ProgramLike, file *ast.SourceFile) *EmitResult {
 * 	if !program.Options().NoEmitOnError.IsTrue() {
 * 		return nil // No emit on error is not set, so we can proceed with emitting
 * 	}
 *
 * 	diagnostics := GetDiagnosticsOfAnyProgram(
 * 		ctx,
 * 		program,
 * 		file,
 * 		true,
 * 		program.GetBindDiagnostics,
 * 		program.GetSemanticDiagnostics,
 * 	)
 * 	if len(diagnostics) == 0 {
 * 		return nil // No diagnostics, so we can proceed with emitting
 * 	}
 * 	return &EmitResult{
 * 		Diagnostics: diagnostics,
 * 		EmitSkipped: true,
 * 	}
 * }
 */
export declare function HandleNoEmitOnError(ctx: Context, program: ProgramLike, file: GoPtr<SourceFile>): GoPtr<EmitResult>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::func::GetDiagnosticsOfAnyProgram","kind":"func","status":"implemented","sigHash":"83c1b7952f0c3423e8da28b9f912beda2d8a85c7d4385beed1bbae4c8c45876b","bodyHash":"61bcff9a2f65f8cd53b0f29e8d69499e04c7faea584b8d36dbf386aaf0867171"}
 *
 * Go source:
 * func GetDiagnosticsOfAnyProgram(
 * 	ctx context.Context,
 * 	program ProgramLike,
 * 	file *ast.SourceFile,
 * 	skipNoEmitCheckForDtsDiagnostics bool,
 * 	getBindDiagnostics func(context.Context, *ast.SourceFile) []*ast.Diagnostic,
 * 	getSemanticDiagnostics func(context.Context, *ast.SourceFile) []*ast.Diagnostic,
 * ) []*ast.Diagnostic {
 * 	allDiagnostics := slices.Clip(program.GetConfigFileParsingDiagnostics())
 * 	configFileParsingDiagnosticsLength := len(allDiagnostics)
 *
 * 	allDiagnostics = append(allDiagnostics, program.GetSyntacticDiagnostics(ctx, file)...)
 *
 * 	// If we didn't have any syntactic errors, then also try getting the program (options),
 * 	// global and semantic errors.
 * 	if len(allDiagnostics) == configFileParsingDiagnosticsLength {
 * 		allDiagnostics = append(allDiagnostics, program.GetProgramDiagnostics()...)
 *
 * 		// Do binding early so we can track the time.
 * 		getBindDiagnostics(ctx, file)
 *
 * 		if program.Options().ListFilesOnly.IsFalseOrUnknown() {
 * 			allDiagnostics = append(allDiagnostics, program.GetGlobalDiagnostics(ctx)...)
 *
 * 			if len(allDiagnostics) == configFileParsingDiagnosticsLength {
 * 				allDiagnostics = append(allDiagnostics, getSemanticDiagnostics(ctx, file)...)
 * 				// Ask for the global diagnostics again (they were empty above); we may have found new during checking, e.g. missing globals.
 * 				allDiagnostics = append(allDiagnostics, program.GetGlobalDiagnostics(ctx)...)
 * 			}
 *
 * 			if (skipNoEmitCheckForDtsDiagnostics || program.Options().NoEmit.IsTrue()) && program.Options().GetEmitDeclarations() && len(allDiagnostics) == configFileParsingDiagnosticsLength {
 * 				allDiagnostics = append(allDiagnostics, program.GetDeclarationDiagnostics(ctx, file)...)
 * 			}
 * 		}
 * 	}
 * 	return allDiagnostics
 * }
 */
export declare function GetDiagnosticsOfAnyProgram(ctx: Context, program: ProgramLike, file: GoPtr<SourceFile>, skipNoEmitCheckForDtsDiagnostics: bool, getBindDiagnostics: (arg0: Context, arg1: GoPtr<SourceFile>) => GoSlice<GoPtr<Diagnostic>>, getSemanticDiagnostics: (arg0: Context, arg1: GoPtr<SourceFile>) => GoSlice<GoPtr<Diagnostic>>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.toPath","kind":"method","status":"implemented","sigHash":"f69013146a9fb21694dd0447ba3918451fcd7d018ac573a4613b054e34187cc9","bodyHash":"38485a1b4f535d3c17d5500614e4fc6b4837eeacb031292e9c97e8d7064f58e3"}
 *
 * Go source:
 * func (p *Program) toPath(filename string) tspath.Path {
 * 	return tspath.ToPath(filename, p.GetCurrentDirectory(), p.UseCaseSensitiveFileNames())
 * }
 */
export declare function Program_toPath(receiver: GoPtr<Program>, filename: string): Path;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetSourceFile","kind":"method","status":"implemented","sigHash":"56cce9e525da96018c543df9736e11cf42843f64fba5cd520ca422b7a1518b7c","bodyHash":"f6ce34c95c1cb6c2233d7d9dd0ae6a58d0ff321c86abd4a12a35a85b5fe057ef"}
 *
 * Go source:
 * func (p *Program) GetSourceFile(filename string) *ast.SourceFile {
 * 	path := p.toPath(filename)
 * 	return p.GetSourceFileByPath(path)
 * }
 */
export declare function Program_GetSourceFile(receiver: GoPtr<Program>, filename: string): GoPtr<SourceFile>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetSourceFileForResolvedModule","kind":"method","status":"implemented","sigHash":"69f2f701eeb2d3cb93185ba919c652be48f9055ced866c71a482cc7880d6487e","bodyHash":"6bc7846894161c8b11a884c107c38ab6879fefb8e54489a3153ab94bad11fa4d"}
 *
 * Go source:
 * func (p *Program) GetSourceFileForResolvedModule(fileName string) *ast.SourceFile {
 * 	file := p.GetSourceFile(fileName)
 * 	if file == nil {
 * 		filename := p.GetParseFileRedirect(fileName)
 * 		if filename != "" {
 * 			return p.GetSourceFile(filename)
 * 		}
 * 	}
 * 	return file
 * }
 */
export declare function Program_GetSourceFileForResolvedModule(receiver: GoPtr<Program>, fileName: string): GoPtr<SourceFile>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.FilesByPath","kind":"method","status":"implemented","sigHash":"aa7f24705fa768a6d9ed006b6ea017e37b685fd706ae3d1abf92e940f42ce592","bodyHash":"1c7418b9f388a704627e5a5c8f91ddc5d562765539be6a9717d811f3ad71427d"}
 *
 * Go source:
 * func (p *Program) FilesByPath() map[tspath.Path]*ast.SourceFile {
 * 	return p.filesByPath
 * }
 */
export declare function Program_FilesByPath(receiver: GoPtr<Program>): GoMap<Path, GoPtr<SourceFile>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetSourceFileByPath","kind":"method","status":"implemented","sigHash":"93d3f5cd2c450223cbebd65db29759c4ba9e1e11ceefbf4da2cfbd7803591f4c","bodyHash":"b3f396d7c3787c99f75a1079c96d98c2415f4ae313be7a638386dd5ceb73969b"}
 *
 * Go source:
 * func (p *Program) GetSourceFileByPath(path tspath.Path) *ast.SourceFile {
 * 	return p.filesByPath[path]
 * }
 */
export declare function Program_GetSourceFileByPath(receiver: GoPtr<Program>, path: Path): GoPtr<SourceFile>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.HasSameFileNames","kind":"method","status":"implemented","sigHash":"2e10b08a05d61b52123910ce12be10cc5dd9aa56d9c3478451ed60ef6b331faf","bodyHash":"f5d0d85c91026580a419e1efdb600fdb2a88d967129952e87e3d0012c53ece3a"}
 *
 * Go source:
 * func (p *Program) HasSameFileNames(other *Program) bool {
 * 	return maps.EqualFunc(p.filesByPath, other.filesByPath, func(a, b *ast.SourceFile) bool {
 * 		// checks for casing differences on case-insensitive file systems
 * 		return a.FileName() == b.FileName()
 * 	}) && maps.EqualFunc(p.redirectFilesByPath, other.redirectFilesByPath, func(a, b *redirectsFile) bool {
 * 		return a.FileName() == b.FileName()
 * 	})
 * }
 */
export declare function Program_HasSameFileNames(receiver: GoPtr<Program>, other: GoPtr<Program>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetSourceFiles","kind":"method","status":"implemented","sigHash":"4da95b79293a0779cef5715d311692fc13cb693566e29be4b9a1a1cd3daa0d2d","bodyHash":"b0dd849fce20f34ecde5112b24e04f5e5833a6ba13f49a6ac75eabc477184886"}
 *
 * Go source:
 * func (p *Program) GetSourceFiles() []*ast.SourceFile {
 * 	return p.files
 * }
 */
export declare function Program_GetSourceFiles(receiver: GoPtr<Program>): GoSlice<GoPtr<SourceFile>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetIncludeReasons","kind":"method","status":"implemented","sigHash":"dd29fca2b6838ce96ba4bf323041fa7d981ba77a09dfc4cb5ad04ac4edbf3c89","bodyHash":"100bb880c578a9af4765b7ccafb76112c6177f7f25fca0e4480c18b6bb29e15c"}
 *
 * Go source:
 * func (p *Program) GetIncludeReasons() map[tspath.Path][]*FileIncludeReason {
 * 	return p.includeProcessor.fileIncludeReasons
 * }
 */
export declare function Program_GetIncludeReasons(receiver: GoPtr<Program>): GoMap<Path, GoSlice<GoPtr<FileIncludeReason>>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.IsMissingPath","kind":"method","status":"implemented","sigHash":"04652ace2a4230553969bc9fb5fcd0a7e115b155055a65ef94a184441f6412ae","bodyHash":"a531855b80acb5fc274a73aaad2202ceb9568bb5245b01d7c6128199d7c1a3ce"}
 *
 * Go source:
 * func (p *Program) IsMissingPath(path tspath.Path) bool {
 * 	return slices.ContainsFunc(p.missingFiles, func(missingPath string) bool {
 * 		return p.toPath(missingPath) == path
 * 	})
 * }
 */
export declare function Program_IsMissingPath(receiver: GoPtr<Program>, path: Path): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.ExplainFiles","kind":"method","status":"implemented","sigHash":"e666f5eb699cdd988c5f7196d09dc04e2b641201d4835664b005a53d6426ae21","bodyHash":"c76f92c45f48d113ed543ad48e0291ede62d7886a54e45d4abd97fc4711c9c36"}
 *
 * Go source:
 * func (p *Program) ExplainFiles(w io.Writer, locale locale.Locale) {
 * 	toRelativeFileName := func(fileName string) string {
 * 		return tspath.GetRelativePathFromDirectory(p.GetCurrentDirectory(), fileName, p.comparePathsOptions)
 * 	}
 * 	filesExplained := 0
 * 	explainFile := func(file ast.HasFileName) {
 * 		fmt.Fprintln(w, toRelativeFileName(file.FileName()))
 * 		for _, reason := range p.includeProcessor.fileIncludeReasons[file.Path()] {
 * 			fmt.Fprintln(w, "  ", reason.toDiagnostic(p, true).Localize(locale))
 * 		}
 * 		for _, diag := range p.includeProcessor.explainRedirectAndImpliedFormat(p, file.Path(), toRelativeFileName) {
 * 			fmt.Fprintln(w, "  ", diag.Localize(locale))
 * 		}
 * 		filesExplained++
 * 	}
 *
 * 	redirectFiles := slices.Collect(maps.Values(p.redirectFilesByPath))
 * 	slices.SortFunc(redirectFiles, func(a, b *redirectsFile) int {
 * 		return a.index - b.index
 * 	})
 *
 * 	files := p.GetSourceFiles()
 * 	sourceFileIndex := 0
 * 	explainSourceFiles := func(endIndex int) {
 * 		for filesExplained < endIndex {
 * 			explainFile(files[sourceFileIndex])
 * 			sourceFileIndex++
 * 		}
 * 	}
 *
 * 	for _, redirectFile := range redirectFiles {
 * 		// Explain all sourceFiles till we reach this redirectFile index
 * 		explainSourceFiles(redirectFile.index)
 * 		explainFile(redirectFile)
 * 	}
 *
 * 	// Explain any remaining sourceFiles
 * 	explainSourceFiles(len(files) + len(redirectFiles))
 * }
 */
export declare function Program_ExplainFiles(receiver: GoPtr<Program>, w: Writer, locale: Locale): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetLibFileFromReference","kind":"method","status":"implemented","sigHash":"83b9b2396187d6efe197c68da10ad549bee50b684a500da00b00bc9904dc53e6","bodyHash":"c0eb516702ecfe3c163a17c064509129ac7e0eac055eeb69ac7b9b963bf900ab"}
 *
 * Go source:
 * func (p *Program) GetLibFileFromReference(ref *ast.FileReference) *ast.SourceFile {
 * 	path, ok := tsoptions.GetLibFileName(ref.FileName)
 * 	if !ok {
 * 		return nil
 * 	}
 * 	if sourceFile, ok := p.filesByPath[tspath.Path(path)]; ok {
 * 		return sourceFile
 * 	}
 * 	return nil
 * }
 */
export declare function Program_GetLibFileFromReference(receiver: GoPtr<Program>, ref: GoPtr<FileReference>): GoPtr<SourceFile>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetResolvedTypeReferenceDirectiveFromTypeReferenceDirective","kind":"method","status":"implemented","sigHash":"1d9b862b8296a30f3159fcd86ffcf348fff2636f951bbd25cf0862ac060327cb","bodyHash":"c19d2b93554f59d00021b9c5a14f365bc2451f77b06bb9e7c31212220e129ece"}
 *
 * Go source:
 * func (p *Program) GetResolvedTypeReferenceDirectiveFromTypeReferenceDirective(typeRef *ast.FileReference, sourceFile *ast.SourceFile) *module.ResolvedTypeReferenceDirective {
 * 	if resolutions, ok := p.typeResolutionsInFile[sourceFile.Path()]; ok {
 * 		if resolved, ok := resolutions[module.ModeAwareCacheKey{Name: typeRef.FileName, Mode: p.getModeForTypeReferenceDirectiveInFile(typeRef, sourceFile)}]; ok {
 * 			return resolved
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Program_GetResolvedTypeReferenceDirectiveFromTypeReferenceDirective(receiver: GoPtr<Program>, typeRef: GoPtr<FileReference>, sourceFile: GoPtr<SourceFile>): GoPtr<ResolvedTypeReferenceDirective>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetResolvedTypeReferenceDirectives","kind":"method","status":"implemented","sigHash":"f3c33f8d4696f8abb437609f1da0e76ea173e3723b42fbe095c7330f9fc3c016","bodyHash":"ad9db4680067a6d25ce50e1bc3fa939363f3a839ff390879a64674981aa5326f"}
 *
 * Go source:
 * func (p *Program) GetResolvedTypeReferenceDirectives() map[tspath.Path]module.ModeAwareCache[*module.ResolvedTypeReferenceDirective] {
 * 	return p.typeResolutionsInFile
 * }
 */
export declare function Program_GetResolvedTypeReferenceDirectives(receiver: GoPtr<Program>): GoMap<Path, ModeAwareCache<GoPtr<ResolvedTypeReferenceDirective>>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.getModeForTypeReferenceDirectiveInFile","kind":"method","status":"implemented","sigHash":"bfc866ed97eb9967a233b81e0647c9ab80371077347b7ab01f3b892503e72fa6","bodyHash":"d6538c28f32d1939e5e43c6181bb378d971cca6bd44c3b27ea85d4ad6ae2887b"}
 *
 * Go source:
 * func (p *Program) getModeForTypeReferenceDirectiveInFile(ref *ast.FileReference, sourceFile *ast.SourceFile) core.ResolutionMode {
 * 	if ref.ResolutionMode != core.ResolutionModeNone {
 * 		return ref.ResolutionMode
 * 	}
 * 	return p.GetDefaultResolutionModeForFile(sourceFile)
 * }
 */
export declare function Program_getModeForTypeReferenceDirectiveInFile(receiver: GoPtr<Program>, ref: GoPtr<FileReference>, sourceFile: GoPtr<SourceFile>): ResolutionMode;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.IsSourceFileFromExternalLibrary","kind":"method","status":"implemented","sigHash":"bff36fa42f49c031a1761b16dd91d64e60d9582ce8bde3e7674db4ef507aba27","bodyHash":"420580d085f52d596fbf10014e70dffe0f3446c2c57cded601e62a6749b691db"}
 *
 * Go source:
 * func (p *Program) IsSourceFileFromExternalLibrary(file *ast.SourceFile) bool {
 * 	return p.sourceFilesFoundSearchingNodeModules.Has(file.Path())
 * }
 */
export declare function Program_IsSourceFileFromExternalLibrary(receiver: GoPtr<Program>, file: GoPtr<SourceFile>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetJSXRuntimeImportSpecifier","kind":"method","status":"implemented","sigHash":"77020f69dcc4a03021eeb6641e952dbb0bd7337cbac7f373202550bdc45ffaf1","bodyHash":"ae5047e14035c9fe22092dab6e10f0850e37152b006b854dc33a30a9d47b6b6a"}
 *
 * Go source:
 * func (p *Program) GetJSXRuntimeImportSpecifier(path tspath.Path) (moduleReference string, specifier *ast.Node) {
 * 	if result := p.jsxRuntimeImportSpecifiers[path]; result != nil {
 * 		return result.moduleReference, result.specifier
 * 	}
 * 	return "", nil
 * }
 */
export declare function Program_GetJSXRuntimeImportSpecifier(receiver: GoPtr<Program>, path: Path): [string, GoPtr<Node>];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetImportHelpersImportSpecifier","kind":"method","status":"implemented","sigHash":"3b5178d721b7324f5b4a82060374aa8df1d20f459c98ea7387aad3674ddbced7","bodyHash":"34997325fb5966b015aaefc1012bef60c6b4c00323678de977147e5e6cb09757"}
 *
 * Go source:
 * func (p *Program) GetImportHelpersImportSpecifier(path tspath.Path) *ast.Node {
 * 	return p.importHelpersImportSpecifiers[path]
 * }
 */
export declare function Program_GetImportHelpersImportSpecifier(receiver: GoPtr<Program>, path: Path): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.SourceFileMayBeEmitted","kind":"method","status":"implemented","sigHash":"9fb8f8a01f94af0b564949750d403a9173a9fdaba589f06b4ada3056cb7a5ff5","bodyHash":"4d0259c8ec4f1818290049549547b9c1e1711490f4aaf2c3aa61db6af3563894"}
 *
 * Go source:
 * func (p *Program) SourceFileMayBeEmitted(sourceFile *ast.SourceFile, forceDtsEmit bool) bool {
 * 	return sourceFileMayBeEmitted(sourceFile, p, forceDtsEmit)
 * }
 */
export declare function Program_SourceFileMayBeEmitted(receiver: GoPtr<Program>, sourceFile: GoPtr<SourceFile>, forceDtsEmit: bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.ResolvedPackageNames","kind":"method","status":"implemented","sigHash":"595264da7bbb204d855c8d22db5da39f36512a379395fbff736ddafdf5248a30","bodyHash":"0a1e084ddcdb0a72f257e8ab15a0033cec69964f7aba3cbe2bccb9dc83e9a478"}
 *
 * Go source:
 * func (p *Program) ResolvedPackageNames() *collections.Set[string] {
 * 	return p.collectPackageNames().resolved
 * }
 */
export declare function Program_ResolvedPackageNames(receiver: GoPtr<Program>): GoPtr<Set<string>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.UnresolvedPackageNames","kind":"method","status":"implemented","sigHash":"a839f1703ff3c9364a248bc95c0323810358b5034c12adc07ae6e5aba8cf937d","bodyHash":"69f93be88c0b0c03dbff20bdb13cc9d9d9fd4e69c37770e794e81838d4667f9e"}
 *
 * Go source:
 * func (p *Program) UnresolvedPackageNames() *collections.Set[string] {
 * 	return p.collectPackageNames().unresolved
 * }
 */
export declare function Program_UnresolvedPackageNames(receiver: GoPtr<Program>): GoPtr<Set<string>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.DeepImportPackageNames","kind":"method","status":"implemented","sigHash":"c139be1518025bdcaea27c57cbd5eefef08c80dd33bfa7744fc211b5ba427891","bodyHash":"63949777d99e886a3eacbda860111ccb77436254613033e20128e6f1e96f0749"}
 *
 * Go source:
 * func (p *Program) DeepImportPackageNames() *collections.Set[string] {
 * 	return p.collectPackageNames().deepImportPackages
 * }
 */
export declare function Program_DeepImportPackageNames(receiver: GoPtr<Program>): GoPtr<Set<string>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.collectPackageNames","kind":"method","status":"implemented","sigHash":"48bd1d40dc59b3b222b445f4d905a5c7b6991751c29cfadbed625d7869a41037","bodyHash":"482b399397b0a23ad5296b541a075a6d443fc1dc4cd770fa050e226492740f96"}
 *
 * Go source:
 * func (p *Program) collectPackageNames() *packageNamesInfo {
 * 	return p.packageNames.getValue(func() *packageNamesInfo {
 * 		packageNames := &packageNamesInfo{&collections.Set[string]{}, &collections.Set[string]{}, &collections.Set[string]{}}
 * 		for _, file := range p.files {
 * 			if p.IsSourceFileDefaultLibrary(file.Path()) || p.IsSourceFileFromExternalLibrary(file) || strings.Contains(file.FileName(), "/node_modules/") {
 * 				// Checking for /node_modules/ is a little imprecise, but ATA treats locally installed typings
 * 				// as root files, which would not pass IsSourceFileFromExternalLibrary.
 * 				continue
 * 			}
 * 			for _, imp := range file.Imports() {
 * 				if tspath.IsExternalModuleNameRelative(imp.Text()) {
 * 					continue
 * 				}
 * 				if resolvedModules, ok := p.resolvedModules[file.Path()]; ok {
 * 					key := module.ModeAwareCacheKey{Name: imp.Text(), Mode: p.GetModeForUsageLocation(file, imp)}
 * 					if resolvedModule, ok := resolvedModules[key]; ok && resolvedModule.IsResolved() {
 * 						if !resolvedModule.IsExternalLibraryImport {
 * 							continue
 * 						}
 * 						// Priority order for getting package name:
 * 						// 1. PackageId.Name (requires both name and version in package.json)
 * 						name := resolvedModule.PackageId.Name
 * 						if name == "" {
 * 							// 2. GetPackageScopeForPath - get name from package.json in the package directory
 * 							if packageScope := p.resolver.GetPackageScopeForPath(resolvedModule.ResolvedFileName); packageScope != nil && packageScope.Exists() {
 * 								if scopeName, ok := packageScope.Contents.Name.GetValue(); ok {
 * 									name = scopeName
 * 								}
 * 							}
 * 						}
 * 						if name == "" {
 * 							// 3. GetPackageNameFromDirectory - extract from node_modules path
 * 							name = modulespecifiers.GetPackageNameFromDirectory(resolvedModule.ResolvedFileName)
 * 						}
 * 						// 4. If all fail, don't add empty string
 * 						if name != "" {
 * 							packageNames.resolved.Add(name)
 * 							// Detect deep imports: subpath imports in packages without exports.
 * 							// These are imports like "lodash/fp" where the package has no exports
 * 							// map, so auto-import can only find them via recursive directory search.
 * 							_, rest := module.ParsePackageName(imp.Text())
 * 							if rest != "" {
 * 								if scope := p.resolver.GetPackageScopeForPath(resolvedModule.ResolvedFileName); scope != nil && scope.Exists() && !scope.Contents.Exports.IsPresent() {
 * 									packageNames.deepImportPackages.Add(module.GetPackageNameFromTypesPackageName(name))
 * 								}
 * 							}
 * 						}
 * 						continue
 * 					}
 * 				}
 * 				packageNames.unresolved.Add(imp.Text())
 * 			}
 * 		}
 * 		return packageNames
 * 	})
 * }
 */
export declare function Program_collectPackageNames(receiver: GoPtr<Program>): GoPtr<packageNamesInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.IsLibFile","kind":"method","status":"implemented","sigHash":"a1329db2cd0433236a96806172e5409b6da0f5539b315ee486aa39d1a8b14c87","bodyHash":"672dc3b06a9bec2a1920789ad5d915d29c8cf78cafa1d42e259c26376e3ab83b"}
 *
 * Go source:
 * func (p *Program) IsLibFile(sourceFile *ast.SourceFile) bool {
 * 	_, ok := p.libFiles[sourceFile.Path()]
 * 	return ok
 * }
 */
export declare function Program_IsLibFile(receiver: GoPtr<Program>, sourceFile: GoPtr<SourceFile>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.HasTSFile","kind":"method","status":"implemented","sigHash":"daa0d52b9d2c75eef5437ddef5cbff5d77738e46410a079e9216c1c3b828fd74","bodyHash":"388ccd6dc611e6cfe8953658b507f34787d607ea74d4c3d6bc37a8072e55966d"}
 *
 * Go source:
 * func (p *Program) HasTSFile() bool {
 * 	p.hasTSFileOnce.Do(func() {
 * 		for _, file := range p.files {
 * 			if tspath.HasImplementationTSFileExtension(file.FileName()) {
 * 				p.hasTSFile = true
 * 				break
 * 			}
 * 		}
 * 	})
 * 	return p.hasTSFile
 * }
 */
export declare function Program_HasTSFile(receiver: GoPtr<Program>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.GetSymlinkCache","kind":"method","status":"implemented","sigHash":"4c5876cf3bd9e74ae4f0a799368a3cb07a3e5e11b174ed412544e58588d9fb62","bodyHash":"b48f49ef970285762a0361287ca77b4f32dcc61f3766f46d3c3a0909a02798ff"}
 *
 * Go source:
 * func (p *Program) GetSymlinkCache() *symlinks.KnownSymlinks {
 * 	return p.knownSymlinks.getValue(func() *symlinks.KnownSymlinks {
 * 		knownSymlinks := symlinks.NewKnownSymlink(p.GetCurrentDirectory(), p.UseCaseSensitiveFileNames())
 *
 * 		// Resolved modules store realpath information when they're resolved inside node_modules
 * 		if len(p.resolvedModules) > 0 || len(p.typeResolutionsInFile) > 0 {
 * 			knownSymlinks.SetSymlinksFromResolutions(p.ForEachResolvedModule, p.ForEachResolvedTypeReferenceDirective)
 * 		}
 *
 * 		// Check other dependencies for symlinks
 * 		var seenPackageJsons collections.Set[tspath.Path]
 * 		for filePath, meta := range p.sourceFileMetaDatas {
 * 			if meta.PackageJsonDirectory == "" ||
 * 				!p.SourceFileMayBeEmitted(p.GetSourceFileByPath(filePath), false) ||
 * 				!seenPackageJsons.AddIfAbsent(p.toPath(meta.PackageJsonDirectory)) {
 * 				continue
 * 			}
 * 			packageJsonName := tspath.CombinePaths(meta.PackageJsonDirectory, "package.json")
 * 			info := p.GetPackageJsonInfo(packageJsonName)
 * 			if info.GetContents() == nil {
 * 				continue
 * 			}
 *
 * 			for dep := range info.GetContents().GetRuntimeDependencyNames().Keys() {
 * 				// Skip work in common case: we already saved a symlink for this package directory
 * 				// in the node_modules adjacent to this package.json
 * 				possibleDirectoryPath := p.toPath(tspath.CombinePaths(meta.PackageJsonDirectory, "node_modules", dep))
 * 				if knownSymlinks.HasDirectory(possibleDirectoryPath) {
 * 					continue
 * 				}
 * 				if !strings.HasPrefix(dep, "@types") {
 * 					possibleTypesDirectoryPath := p.toPath(tspath.CombinePaths(meta.PackageJsonDirectory, "node_modules", module.GetTypesPackageName(dep)))
 * 					if knownSymlinks.HasDirectory(possibleTypesDirectoryPath) {
 * 						continue
 * 					}
 * 				}
 *
 * 				if packageResolution := p.resolver.ResolvePackageDirectory(dep, packageJsonName, core.ResolutionModeCommonJS, nil); packageResolution.IsResolved() {
 * 					knownSymlinks.ProcessResolution(
 * 						tspath.CombinePaths(packageResolution.OriginalPath, "package.json"),
 * 						tspath.CombinePaths(packageResolution.ResolvedFileName, "package.json"),
 * 					)
 * 				}
 * 			}
 * 		}
 * 		return knownSymlinks
 * 	})
 * }
 */
export declare function Program_GetSymlinkCache(receiver: GoPtr<Program>): GoPtr<KnownSymlinks>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.ResolveModuleName","kind":"method","status":"implemented","sigHash":"8dda9fc3b8a83d8df64d2a67fc34ed6e037084e40e6361cc83e850b523540c03","bodyHash":"493dc8d5587f52234e9b68d6bfba783fed40761ce28688319734972784d1fc19"}
 *
 * Go source:
 * func (p *Program) ResolveModuleName(moduleName string, containingFile string, resolutionMode core.ResolutionMode) *module.ResolvedModule {
 * 	resolved, _ := p.resolver.ResolveModuleName(moduleName, containingFile, resolutionMode, nil)
 * 	return resolved
 * }
 */
export declare function Program_ResolveModuleName(receiver: GoPtr<Program>, moduleName: string, containingFile: string, resolutionMode: ResolutionMode): GoPtr<ResolvedModule>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.ForEachResolvedModule","kind":"method","status":"implemented","sigHash":"fd6993e3483550000e477f723fb21fbc3a793b9f704d3fad95d86d16fec33d4e","bodyHash":"8e461ed6193dede82c3671e322408b8043558809ffc8649b4a836704d7a11855"}
 *
 * Go source:
 * func (p *Program) ForEachResolvedModule(callback func(resolution *module.ResolvedModule, moduleName string, mode core.ResolutionMode, filePath tspath.Path), file *ast.SourceFile) {
 * 	forEachResolution(p.resolvedModules, callback, file)
 * }
 */
export declare function Program_ForEachResolvedModule(receiver: GoPtr<Program>, callback: (resolution: GoPtr<ResolvedModule>, moduleName: string, mode: ResolutionMode, filePath: Path) => void, file: GoPtr<SourceFile>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::method::Program.ForEachResolvedTypeReferenceDirective","kind":"method","status":"implemented","sigHash":"195a83c38de7c14d24c816cf3628f62f60a1d2f9d043270b6bb985af3f2e7dcc","bodyHash":"94fbd1dc1451941cac3014c632ca12f4858d492a2dddf60b05b4ecc1c02b0a65"}
 *
 * Go source:
 * func (p *Program) ForEachResolvedTypeReferenceDirective(callback func(resolution *module.ResolvedTypeReferenceDirective, moduleName string, mode core.ResolutionMode, filePath tspath.Path), file *ast.SourceFile) {
 * 	forEachResolution(p.typeResolutionsInFile, callback, file)
 * }
 */
export declare function Program_ForEachResolvedTypeReferenceDirective(receiver: GoPtr<Program>, callback: (resolution: GoPtr<ResolvedTypeReferenceDirective>, moduleName: string, mode: ResolutionMode, filePath: Path) => void, file: GoPtr<SourceFile>): void;
export declare function forEachResolution<T>(resolutionCache: GoMap<Path, ModeAwareCache<T>>, callback: (resolution: T, moduleName: string, mode: ResolutionMode, filePath: Path) => void, file: GoPtr<SourceFile>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/program.go::varGroup::plainJSErrors","kind":"varGroup","status":"implemented","sigHash":"f55145f3906b495bb0164c522458cdc580f30a349f9018d3b5169e2e2db37142","bodyHash":"48990861d064ce52bd7233791b94a3cc842458153926cc7968feff0b9173d355"}
 *
 * Go source:
 * var plainJSErrors = collections.NewSetFromItems(
 * 	// binder errors
 * 	diagnostics.Cannot_redeclare_block_scoped_variable_0.Code(),
 * 	diagnostics.A_module_cannot_have_multiple_default_exports.Code(),
 * 	diagnostics.Another_export_default_is_here.Code(),
 * 	diagnostics.The_first_export_default_is_here.Code(),
 * 	diagnostics.Identifier_expected_0_is_a_reserved_word_at_the_top_level_of_a_module.Code(),
 * 	diagnostics.Identifier_expected_0_is_a_reserved_word_in_strict_mode_Modules_are_automatically_in_strict_mode.Code(),
 * 	diagnostics.Identifier_expected_0_is_a_reserved_word_that_cannot_be_used_here.Code(),
 * 	diagnostics.X_constructor_is_a_reserved_word.Code(),
 * 	diagnostics.X_delete_cannot_be_called_on_an_identifier_in_strict_mode.Code(),
 * 	diagnostics.Code_contained_in_a_class_is_evaluated_in_JavaScript_s_strict_mode_which_does_not_allow_this_use_of_0_For_more_information_see_https_Colon_Slash_Slashdeveloper_mozilla_org_Slashen_US_Slashdocs_SlashWeb_SlashJavaScript_SlashReference_SlashStrict_mode.Code(),
 * 	diagnostics.Invalid_use_of_0_Modules_are_automatically_in_strict_mode.Code(),
 * 	diagnostics.Invalid_use_of_0_in_strict_mode.Code(),
 * 	diagnostics.A_label_is_not_allowed_here.Code(),
 * 	diagnostics.X_with_statements_are_not_allowed_in_strict_mode.Code(),
 * 	// grammar errors
 * 	diagnostics.A_break_statement_can_only_be_used_within_an_enclosing_iteration_or_switch_statement.Code(),
 * 	diagnostics.A_break_statement_can_only_jump_to_a_label_of_an_enclosing_statement.Code(),
 * 	diagnostics.A_class_declaration_without_the_default_modifier_must_have_a_name.Code(),
 * 	diagnostics.A_class_member_cannot_have_the_0_keyword.Code(),
 * 	diagnostics.A_comma_expression_is_not_allowed_in_a_computed_property_name.Code(),
 * 	diagnostics.A_continue_statement_can_only_be_used_within_an_enclosing_iteration_statement.Code(),
 * 	diagnostics.A_continue_statement_can_only_jump_to_a_label_of_an_enclosing_iteration_statement.Code(),
 * 	diagnostics.A_default_clause_cannot_appear_more_than_once_in_a_switch_statement.Code(),
 * 	diagnostics.A_default_export_must_be_at_the_top_level_of_a_file_or_module_declaration.Code(),
 * 	diagnostics.A_definite_assignment_assertion_is_not_permitted_in_this_context.Code(),
 * 	diagnostics.A_destructuring_declaration_must_have_an_initializer.Code(),
 * 	diagnostics.A_get_accessor_cannot_have_parameters.Code(),
 * 	diagnostics.A_rest_element_cannot_contain_a_binding_pattern.Code(),
 * 	diagnostics.A_rest_element_cannot_have_a_property_name.Code(),
 * 	diagnostics.A_rest_element_cannot_have_an_initializer.Code(),
 * 	diagnostics.A_rest_element_must_be_last_in_a_destructuring_pattern.Code(),
 * 	diagnostics.A_rest_parameter_cannot_have_an_initializer.Code(),
 * 	diagnostics.A_rest_parameter_must_be_last_in_a_parameter_list.Code(),
 * 	diagnostics.A_rest_parameter_or_binding_pattern_may_not_have_a_trailing_comma.Code(),
 * 	diagnostics.A_return_statement_cannot_be_used_inside_a_class_static_block.Code(),
 * 	diagnostics.A_set_accessor_cannot_have_rest_parameter.Code(),
 * 	diagnostics.A_set_accessor_must_have_exactly_one_parameter.Code(),
 * 	diagnostics.An_export_declaration_can_only_be_used_at_the_top_level_of_a_module.Code(),
 * 	diagnostics.An_export_declaration_cannot_have_modifiers.Code(),
 * 	diagnostics.An_import_declaration_can_only_be_used_at_the_top_level_of_a_module.Code(),
 * 	diagnostics.An_import_declaration_cannot_have_modifiers.Code(),
 * 	diagnostics.An_object_member_cannot_be_declared_optional.Code(),
 * 	diagnostics.Argument_of_dynamic_import_cannot_be_spread_element.Code(),
 * 	diagnostics.Cannot_assign_to_private_method_0_Private_methods_are_not_writable.Code(),
 * 	diagnostics.Cannot_redeclare_identifier_0_in_catch_clause.Code(),
 * 	diagnostics.Catch_clause_variable_cannot_have_an_initializer.Code(),
 * 	diagnostics.Class_decorators_can_t_be_used_with_static_private_identifier_Consider_removing_the_experimental_decorator.Code(),
 * 	diagnostics.Classes_can_only_extend_a_single_class.Code(),
 * 	diagnostics.Classes_may_not_have_a_field_named_constructor.Code(),
 * 	diagnostics.Did_you_mean_to_use_a_Colon_An_can_only_follow_a_property_name_when_the_containing_object_literal_is_part_of_a_destructuring_pattern.Code(),
 * 	diagnostics.Duplicate_label_0.Code(),
 * 	diagnostics.Dynamic_imports_can_only_accept_a_module_specifier_and_an_optional_set_of_attributes_as_arguments.Code(),
 * 	diagnostics.X_for_await_loops_cannot_be_used_inside_a_class_static_block.Code(),
 * 	diagnostics.JSX_attributes_must_only_be_assigned_a_non_empty_expression.Code(),
 * 	diagnostics.JSX_elements_cannot_have_multiple_attributes_with_the_same_name.Code(),
 * 	diagnostics.JSX_expressions_may_not_use_the_comma_operator_Did_you_mean_to_write_an_array.Code(),
 * 	diagnostics.JSX_property_access_expressions_cannot_include_JSX_namespace_names.Code(),
 * 	diagnostics.Jump_target_cannot_cross_function_boundary.Code(),
 * 	diagnostics.Line_terminator_not_permitted_before_arrow.Code(),
 * 	diagnostics.Modifiers_cannot_appear_here.Code(),
 * 	diagnostics.Only_a_single_variable_declaration_is_allowed_in_a_for_in_statement.Code(),
 * 	diagnostics.Only_a_single_variable_declaration_is_allowed_in_a_for_of_statement.Code(),
 * 	diagnostics.Private_identifiers_are_not_allowed_outside_class_bodies.Code(),
 * 	diagnostics.Private_identifiers_are_only_allowed_in_class_bodies_and_may_only_be_used_as_part_of_a_class_member_declaration_property_access_or_on_the_left_hand_side_of_an_in_expression.Code(),
 * 	diagnostics.Property_0_is_not_accessible_outside_class_1_because_it_has_a_private_identifier.Code(),
 * 	diagnostics.Tagged_template_expressions_are_not_permitted_in_an_optional_chain.Code(),
 * 	diagnostics.The_left_hand_side_of_a_for_of_statement_may_not_be_async.Code(),
 * 	diagnostics.The_variable_declaration_of_a_for_in_statement_cannot_have_an_initializer.Code(),
 * 	diagnostics.The_variable_declaration_of_a_for_of_statement_cannot_have_an_initializer.Code(),
 * 	diagnostics.Trailing_comma_not_allowed.Code(),
 * 	diagnostics.Variable_declaration_list_cannot_be_empty.Code(),
 * 	diagnostics.X_0_and_1_operations_cannot_be_mixed_without_parentheses.Code(),
 * 	diagnostics.X_0_expected.Code(),
 * 	diagnostics.X_0_is_not_a_valid_meta_property_for_keyword_1_Did_you_mean_2.Code(),
 * 	diagnostics.X_0_list_cannot_be_empty.Code(),
 * 	diagnostics.X_0_modifier_already_seen.Code(),
 * 	diagnostics.X_0_modifier_cannot_appear_on_a_constructor_declaration.Code(),
 * 	diagnostics.X_0_modifier_cannot_appear_on_a_module_or_namespace_element.Code(),
 * 	diagnostics.X_0_modifier_cannot_appear_on_a_parameter.Code(),
 * 	diagnostics.X_0_modifier_cannot_appear_on_class_elements_of_this_kind.Code(),
 * 	diagnostics.X_0_modifier_cannot_be_used_here.Code(),
 * 	diagnostics.X_0_modifier_must_precede_1_modifier.Code(),
 * 	diagnostics.X_0_declarations_can_only_be_declared_inside_a_block.Code(),
 * 	diagnostics.X_0_declarations_must_be_initialized.Code(),
 * 	diagnostics.X_extends_clause_already_seen.Code(),
 * 	diagnostics.X_let_is_not_allowed_to_be_used_as_a_name_in_let_or_const_declarations.Code(),
 * 	diagnostics.Class_constructor_may_not_be_a_generator.Code(),
 * 	diagnostics.Class_constructor_may_not_be_an_accessor.Code(),
 * 	diagnostics.X_await_expressions_are_only_allowed_within_async_functions_and_at_the_top_levels_of_modules.Code(),
 * 	diagnostics.X_await_using_statements_are_only_allowed_within_async_functions_and_at_the_top_levels_of_modules.Code(),
 * 	diagnostics.Private_field_0_must_be_declared_in_an_enclosing_class.Code(),
 * 	// Type errors
 * 	diagnostics.This_condition_will_always_return_0_since_JavaScript_compares_objects_by_reference_not_value.Code(),
 * )
 */
export declare const plainJSErrors: GoPtr<Set<int>>;
//# sourceMappingURL=program.d.ts.map