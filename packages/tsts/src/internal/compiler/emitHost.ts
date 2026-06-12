import type { bool } from "@tsonic/core/types.js";
import type { GoError, GoPtr, GoSlice } from "../../go/compat.js";
import type { Context } from "../../go/context.js";
import type { FileReference, HasFileName, Node, SourceFile, StringLiteralLike } from "../ast/ast.js";
import type { ModifierFlags } from "../ast/modifierflags.js";
import { Checker_GetEmitResolver } from "../checker/checker/support.js";
import { EmitResolver_as_printer_EmitResolver } from "../checker/emitresolver.js";
import type { CompilerOptions, ModuleKind, ResolutionMode } from "../core/compileroptions.js";
import type { ResolvedModule } from "../module/types.js";
import type { InfoCacheEntry } from "../packagejson/cache.js";
import type { EmitHost as EmitHost_cf9bdcc7 } from "../printer/emithost.js";
import type { EmitResolver } from "../printer/emitresolver.js";
import type { ModuleSpecifierGenerationHost } from "../modulespecifiers/types.js";
import type { KnownSymlinks } from "../symlinks/knownsymlinks.js";
import type { DeclarationEmitHost, OutputPaths } from "../transformers/declarations/transform.js";
import type { SourceOutputAndProjectReference } from "../tsoptions/parsedcommandline.js";
import type { Path } from "../tspath/path.js";
import {
  GetOutputPathsFor,
  OutputPaths_DeclarationFilePath,
  OutputPaths_JsFilePath,
  type OutputPathsHost,
} from "../outputpaths/outputpaths.js";
import {
  Program_CommonSourceDirectory,
  Program_FileExists,
  Program_GetCurrentDirectory,
  Program_GetDefaultResolutionModeForFile,
  Program_GetEmitModuleFormatOfFile,
  Program_GetGlobalTypingsCacheLocation,
  Program_GetModeForUsageLocation,
  Program_GetNearestAncestorDirectoryWithPackageJson,
  Program_GetPackageJsonInfo,
  Program_GetProjectReferenceFromSource,
  Program_GetRedirectTargets,
  Program_GetResolvedModuleFromModuleSpecifier,
  Program_GetSourceFileFromReference,
  Program_GetSourceOfProjectReferenceIfOutputIncluded,
  Program_GetSymlinkCache,
  Program_GetTypeCheckerForFile,
  Program_Host,
  Program_IsEmitBlocked,
  Program_IsSourceFileFromExternalLibrary,
  Program_Options,
  Program_ResolveModuleName,
  Program_SourceFiles,
  Program_UseCaseSensitiveFileNames,
} from "./program.js";
import type { Program } from "./program.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::type::EmitHost","kind":"type","status":"implemented","sigHash":"86d3825eb042c6035fe2cb5b2b3b1f40c7a5774c29d4ec77071e82aed8b8c86b","bodyHash":"dc0f501b0419d89ed0f61f5c6ed9f3795209fe04cc433d9a41be9035ad8f5431"}
 *
 * Go source:
 * EmitHost interface {
 * 	printer.EmitHost
 * 	declarations.DeclarationEmitHost
 * 	Options() *core.CompilerOptions
 * 	SourceFiles() []*ast.SourceFile
 * 	UseCaseSensitiveFileNames() bool
 * 	GetCurrentDirectory() string
 * 	CommonSourceDirectory() string
 * 	IsEmitBlocked(file string) bool
 * }
 */
export interface EmitHost {
  readonly __tsgoEmbedded0?: EmitHost_cf9bdcc7;
  readonly __tsgoEmbedded1?: DeclarationEmitHost;
  Options(): GoPtr<CompilerOptions>;
  SourceFiles(): GoSlice<GoPtr<SourceFile>>;
  UseCaseSensitiveFileNames(): bool;
  GetCurrentDirectory(): string;
  CommonSourceDirectory(): string;
  IsEmitBlocked(file: string): bool;
  GetSymlinkCache(): GoPtr<KnownSymlinks>;
  GetGlobalTypingsCacheLocation(): string;
  GetProjectReferenceFromSource(path: Path): GoPtr<SourceOutputAndProjectReference>;
  GetRedirectTargets(path: Path): GoSlice<string>;
  GetSourceOfProjectReferenceIfOutputIncluded(file: HasFileName): string;
  FileExists(path: string): bool;
  GetNearestAncestorDirectoryWithPackageJson(dirname: string): string;
  GetPackageJsonInfo(pkgJsonPath: string): GoPtr<InfoCacheEntry>;
  GetDefaultResolutionModeForFile(file: HasFileName): ResolutionMode;
  GetResolvedModuleFromModuleSpecifier(file: HasFileName, moduleSpecifier: GoPtr<StringLiteralLike>): GoPtr<ResolvedModule>;
  GetModeForUsageLocation(file: HasFileName, moduleSpecifier: GoPtr<StringLiteralLike>): ResolutionMode;
  GetSourceFileFromReference(origin: GoPtr<SourceFile>, ref: GoPtr<FileReference>): GoPtr<SourceFile>;
  GetOutputPathsFor(file: GoPtr<SourceFile>, forceDtsPaths: bool): OutputPaths;
  GetResolutionModeOverride(node: GoPtr<Node>): ResolutionMode;
  GetEffectiveDeclarationFlags(node: GoPtr<Node>, flags: ModifierFlags): ModifierFlags;
  GetEmitResolver(): EmitResolver;
  WriteFile(fileName: string, text: string): GoError;
  GetEmitModuleFormatOfFile(file: HasFileName): ModuleKind;
  IsSourceFileFromExternalLibrary(file: GoPtr<SourceFile>): bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"1eaf36d863aae7827b50dade1231962fb35afdcba2c376799613c49744f60ca3"}
 *
 * Go source:
 * var _ EmitHost = (*emitHost)(nil)
 */
export let __6e5ea12b_0: EmitHost = emitHost_as_compiler_EmitHost(undefined);

export function EmitHost_as_printer_EmitHost(receiver: EmitHost): EmitHost_cf9bdcc7 {
  return receiver.__tsgoEmbedded0!;
}

export function EmitHost_as_declarations_DeclarationEmitHost(receiver: EmitHost): DeclarationEmitHost {
  return receiver.__tsgoEmbedded1!;
}

export function emitHost_as_modulespecifiers_ModuleSpecifierGenerationHost(receiver: GoPtr<emitHost>): ModuleSpecifierGenerationHost {
  return {
    GetSymlinkCache: (): GoPtr<KnownSymlinks> => emitHost_GetSymlinkCache(receiver),
    CommonSourceDirectory: (): string => emitHost_CommonSourceDirectory(receiver),
    GetGlobalTypingsCacheLocation: (): string => emitHost_GetGlobalTypingsCacheLocation(receiver),
    UseCaseSensitiveFileNames: (): bool => emitHost_UseCaseSensitiveFileNames(receiver),
    GetCurrentDirectory: (): string => emitHost_GetCurrentDirectory(receiver),
    GetProjectReferenceFromSource: (path: Path): GoPtr<SourceOutputAndProjectReference> => emitHost_GetProjectReferenceFromSource(receiver, path),
    GetRedirectTargets: (path: Path): GoSlice<string> => emitHost_GetRedirectTargets(receiver, path),
    GetSourceOfProjectReferenceIfOutputIncluded: (file: HasFileName): string => emitHost_GetSourceOfProjectReferenceIfOutputIncluded(receiver, file),
    FileExists: (path: string): bool => emitHost_FileExists(receiver, path),
    GetNearestAncestorDirectoryWithPackageJson: (dirname: string): string => emitHost_GetNearestAncestorDirectoryWithPackageJson(receiver, dirname),
    GetPackageJsonInfo: (pkgJsonPath: string): GoPtr<InfoCacheEntry> => emitHost_GetPackageJsonInfo(receiver, pkgJsonPath),
    GetDefaultResolutionModeForFile: (file: HasFileName): ResolutionMode => emitHost_GetDefaultResolutionModeForFile(receiver, file),
    GetResolvedModuleFromModuleSpecifier: (file: HasFileName, moduleSpecifier: GoPtr<StringLiteralLike>): GoPtr<ResolvedModule> => emitHost_GetResolvedModuleFromModuleSpecifier(receiver, file, moduleSpecifier),
    GetModeForUsageLocation: (file: HasFileName, moduleSpecifier: GoPtr<StringLiteralLike>): ResolutionMode => emitHost_GetModeForUsageLocation(receiver, file, moduleSpecifier),
  };
}

export function emitHost_as_printer_EmitHost(receiver: GoPtr<emitHost>): EmitHost_cf9bdcc7 {
  return {
    Options: (): GoPtr<CompilerOptions> => emitHost_Options(receiver),
    SourceFiles: (): GoSlice<GoPtr<SourceFile>> => emitHost_SourceFiles(receiver),
    UseCaseSensitiveFileNames: (): bool => emitHost_UseCaseSensitiveFileNames(receiver),
    GetCurrentDirectory: (): string => emitHost_GetCurrentDirectory(receiver),
    CommonSourceDirectory: (): string => emitHost_CommonSourceDirectory(receiver),
    IsEmitBlocked: (file: string): bool => emitHost_IsEmitBlocked(receiver, file),
    WriteFile: (fileName: string, text: string): GoError => emitHost_WriteFile(receiver, fileName, text),
    GetEmitModuleFormatOfFile: (file: HasFileName): ModuleKind => emitHost_GetEmitModuleFormatOfFile(receiver, file),
    GetEmitResolver: (): EmitResolver => emitHost_GetEmitResolver(receiver),
    GetProjectReferenceFromSource: (path: Path): GoPtr<SourceOutputAndProjectReference> => emitHost_GetProjectReferenceFromSource(receiver, path),
    IsSourceFileFromExternalLibrary: (file: GoPtr<SourceFile>): bool => emitHost_IsSourceFileFromExternalLibrary(receiver, file),
  };
}

export function emitHost_as_declarations_DeclarationEmitHost(receiver: GoPtr<emitHost>): DeclarationEmitHost {
  return {
    __tsgoEmbedded0: emitHost_as_modulespecifiers_ModuleSpecifierGenerationHost(receiver),
    GetSymlinkCache: (): GoPtr<KnownSymlinks> => emitHost_GetSymlinkCache(receiver),
    CommonSourceDirectory: (): string => emitHost_CommonSourceDirectory(receiver),
    GetGlobalTypingsCacheLocation: (): string => emitHost_GetGlobalTypingsCacheLocation(receiver),
    UseCaseSensitiveFileNames: (): bool => emitHost_UseCaseSensitiveFileNames(receiver),
    GetCurrentDirectory: (): string => emitHost_GetCurrentDirectory(receiver),
    GetProjectReferenceFromSource: (path: Path): GoPtr<SourceOutputAndProjectReference> => emitHost_GetProjectReferenceFromSource(receiver, path),
    GetRedirectTargets: (path: Path): GoSlice<string> => emitHost_GetRedirectTargets(receiver, path),
    GetSourceOfProjectReferenceIfOutputIncluded: (file: HasFileName): string => emitHost_GetSourceOfProjectReferenceIfOutputIncluded(receiver, file),
    FileExists: (path: string): bool => emitHost_FileExists(receiver, path),
    GetNearestAncestorDirectoryWithPackageJson: (dirname: string): string => emitHost_GetNearestAncestorDirectoryWithPackageJson(receiver, dirname),
    GetPackageJsonInfo: (pkgJsonPath: string): GoPtr<InfoCacheEntry> => emitHost_GetPackageJsonInfo(receiver, pkgJsonPath),
    GetDefaultResolutionModeForFile: (file: HasFileName): ResolutionMode => emitHost_GetDefaultResolutionModeForFile(receiver, file),
    GetResolvedModuleFromModuleSpecifier: (file: HasFileName, moduleSpecifier: GoPtr<StringLiteralLike>): GoPtr<ResolvedModule> => emitHost_GetResolvedModuleFromModuleSpecifier(receiver, file, moduleSpecifier),
    GetModeForUsageLocation: (file: HasFileName, moduleSpecifier: GoPtr<StringLiteralLike>): ResolutionMode => emitHost_GetModeForUsageLocation(receiver, file, moduleSpecifier),
    GetSourceFileFromReference: (origin: GoPtr<SourceFile>, ref: GoPtr<FileReference>): GoPtr<SourceFile> => emitHost_GetSourceFileFromReference(receiver, origin, ref),
    GetOutputPathsFor: (file: GoPtr<SourceFile>, forceDtsPaths: bool): OutputPaths => emitHost_GetOutputPathsFor(receiver, file, forceDtsPaths),
    GetResolutionModeOverride: (node: GoPtr<Node>): ResolutionMode => emitHost_GetResolutionModeOverride(receiver, node),
    GetEffectiveDeclarationFlags: (node: GoPtr<Node>, flags: ModifierFlags): ModifierFlags => emitHost_GetEffectiveDeclarationFlags(receiver, node, flags),
    GetEmitResolver: (): EmitResolver => emitHost_GetEmitResolver(receiver),
  };
}

export function emitHost_as_outputpaths_OutputPathsHost(receiver: GoPtr<emitHost>): OutputPathsHost {
  return {
    CommonSourceDirectory: (): string => emitHost_CommonSourceDirectory(receiver),
    GetCurrentDirectory: (): string => emitHost_GetCurrentDirectory(receiver),
    UseCaseSensitiveFileNames: (): bool => emitHost_UseCaseSensitiveFileNames(receiver),
  };
}

export function emitHost_as_compiler_EmitHost(receiver: GoPtr<emitHost>): EmitHost {
  return {
    __tsgoEmbedded0: emitHost_as_printer_EmitHost(receiver),
    __tsgoEmbedded1: emitHost_as_declarations_DeclarationEmitHost(receiver),
    GetSymlinkCache: (): GoPtr<KnownSymlinks> => emitHost_GetSymlinkCache(receiver),
    CommonSourceDirectory: (): string => emitHost_CommonSourceDirectory(receiver),
    GetGlobalTypingsCacheLocation: (): string => emitHost_GetGlobalTypingsCacheLocation(receiver),
    UseCaseSensitiveFileNames: (): bool => emitHost_UseCaseSensitiveFileNames(receiver),
    GetCurrentDirectory: (): string => emitHost_GetCurrentDirectory(receiver),
    GetProjectReferenceFromSource: (path: Path): GoPtr<SourceOutputAndProjectReference> => emitHost_GetProjectReferenceFromSource(receiver, path),
    GetRedirectTargets: (path: Path): GoSlice<string> => emitHost_GetRedirectTargets(receiver, path),
    GetSourceOfProjectReferenceIfOutputIncluded: (file: HasFileName): string => emitHost_GetSourceOfProjectReferenceIfOutputIncluded(receiver, file),
    FileExists: (path: string): bool => emitHost_FileExists(receiver, path),
    GetNearestAncestorDirectoryWithPackageJson: (dirname: string): string => emitHost_GetNearestAncestorDirectoryWithPackageJson(receiver, dirname),
    GetPackageJsonInfo: (pkgJsonPath: string): GoPtr<InfoCacheEntry> => emitHost_GetPackageJsonInfo(receiver, pkgJsonPath),
    GetDefaultResolutionModeForFile: (file: HasFileName): ResolutionMode => emitHost_GetDefaultResolutionModeForFile(receiver, file),
    GetResolvedModuleFromModuleSpecifier: (file: HasFileName, moduleSpecifier: GoPtr<StringLiteralLike>): GoPtr<ResolvedModule> => emitHost_GetResolvedModuleFromModuleSpecifier(receiver, file, moduleSpecifier),
    GetModeForUsageLocation: (file: HasFileName, moduleSpecifier: GoPtr<StringLiteralLike>): ResolutionMode => emitHost_GetModeForUsageLocation(receiver, file, moduleSpecifier),
    GetSourceFileFromReference: (origin: GoPtr<SourceFile>, ref: GoPtr<FileReference>): GoPtr<SourceFile> => emitHost_GetSourceFileFromReference(receiver, origin, ref),
    GetOutputPathsFor: (file: GoPtr<SourceFile>, forceDtsPaths: bool): OutputPaths => emitHost_GetOutputPathsFor(receiver, file, forceDtsPaths),
    GetResolutionModeOverride: (node: GoPtr<Node>): ResolutionMode => emitHost_GetResolutionModeOverride(receiver, node),
    GetEffectiveDeclarationFlags: (node: GoPtr<Node>, flags: ModifierFlags): ModifierFlags => emitHost_GetEffectiveDeclarationFlags(receiver, node, flags),
    GetEmitResolver: (): EmitResolver => emitHost_GetEmitResolver(receiver),
    Options: (): GoPtr<CompilerOptions> => emitHost_Options(receiver),
    SourceFiles: (): GoSlice<GoPtr<SourceFile>> => emitHost_SourceFiles(receiver),
    IsEmitBlocked: (file: string): bool => emitHost_IsEmitBlocked(receiver, file),
    WriteFile: (fileName: string, text: string): GoError => emitHost_WriteFile(receiver, fileName, text),
    GetEmitModuleFormatOfFile: (file: HasFileName): ModuleKind => emitHost_GetEmitModuleFormatOfFile(receiver, file),
    IsSourceFileFromExternalLibrary: (file: GoPtr<SourceFile>): bool => emitHost_IsSourceFileFromExternalLibrary(receiver, file),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::type::emitHost","kind":"type","status":"implemented","sigHash":"82a8160ff4f5bebeb3e890a32bc68c27a504ee28ed1414475783e6f93c9ed5fb","bodyHash":"ec0aedbd3cd85f7ed02a0f05dd030e3ab5e099c642013dc9e6950c43b9867c27"}
 *
 * Go source:
 * emitHost struct {
 * 	program      *Program
 * 	emitResolver printer.EmitResolver
 * }
 */
export interface emitHost {
  program: GoPtr<Program>;
  emitResolver: EmitResolver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::func::newEmitHost","kind":"func","status":"implemented","sigHash":"377586cc6bb0ee18b8a142078f4a59c05d021896e0d1b269ac5348099fd51bbd","bodyHash":"9d31d9950d67c9f58374c46931826b3abe7fbbac931f953ac316a107b9f0a4ed"}
 *
 * Go source:
 * func newEmitHost(ctx context.Context, program *Program, file *ast.SourceFile) (*emitHost, func()) {
 * 	checker, done := program.GetTypeCheckerForFile(ctx, file)
 * 	return &emitHost{
 * 		program:      program,
 * 		emitResolver: checker.GetEmitResolver(),
 * 	}, done
 * }
 */
export function newEmitHost(ctx: Context, program: GoPtr<Program>, file: GoPtr<SourceFile>): [GoPtr<emitHost>, () => void] {
  const [checker, done] = Program_GetTypeCheckerForFile(program, ctx, file);
  const emitResolver = EmitResolver_as_printer_EmitResolver(Checker_GetEmitResolver(checker));
  return [{ program, emitResolver }, done];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetModeForUsageLocation","kind":"method","status":"implemented","sigHash":"fc560f86320b97f1f35a1a8696de5afa5ecacfa3fc3c63956dc48c3049be96d3","bodyHash":"3fbda809aa93a9a5c9bfa31b49640af8ae43148f5cf144ec99d1e4144cd6c980"}
 *
 * Go source:
 * func (host *emitHost) GetModeForUsageLocation(file ast.HasFileName, moduleSpecifier *ast.StringLiteralLike) core.ResolutionMode {
 * 	return host.program.GetModeForUsageLocation(file, moduleSpecifier)
 * }
 */
export function emitHost_GetModeForUsageLocation(receiver: GoPtr<emitHost>, file: HasFileName, moduleSpecifier: GoPtr<StringLiteralLike>): ResolutionMode {
  return Program_GetModeForUsageLocation(receiver!.program, file, moduleSpecifier);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetResolvedModuleFromModuleSpecifier","kind":"method","status":"implemented","sigHash":"cfdae610398bd748bca9ba6bc024b3ae94d904bd5edcdc0b78a542b8155013a4","bodyHash":"1a20f10409ac3faf544af7807ec23de57038b22e71705215c83d53df41c6c167"}
 *
 * Go source:
 * func (host *emitHost) GetResolvedModuleFromModuleSpecifier(file ast.HasFileName, moduleSpecifier *ast.StringLiteralLike) *module.ResolvedModule {
 * 	return host.program.GetResolvedModuleFromModuleSpecifier(file, moduleSpecifier)
 * }
 */
export function emitHost_GetResolvedModuleFromModuleSpecifier(receiver: GoPtr<emitHost>, file: HasFileName, moduleSpecifier: GoPtr<StringLiteralLike>): GoPtr<ResolvedModule> {
  return Program_GetResolvedModuleFromModuleSpecifier(receiver!.program, file, moduleSpecifier);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetDefaultResolutionModeForFile","kind":"method","status":"implemented","sigHash":"af23a403126d8ed749bcaa5aaf7fdd4e24b1ecb7f90b056abe37bbfaa49386cf","bodyHash":"58eb67c7be9c78afbc672b397b8982fff2c73d992bac1e93c60ea06e0d9ce02d"}
 *
 * Go source:
 * func (host *emitHost) GetDefaultResolutionModeForFile(file ast.HasFileName) core.ResolutionMode {
 * 	return host.program.GetDefaultResolutionModeForFile(file)
 * }
 */
export function emitHost_GetDefaultResolutionModeForFile(receiver: GoPtr<emitHost>, file: HasFileName): ResolutionMode {
  return Program_GetDefaultResolutionModeForFile(receiver!.program, file);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetEmitModuleFormatOfFile","kind":"method","status":"implemented","sigHash":"e7affbcc0eeb0b90adad23e1eb9022c4f5cd6ac41a3d525fdfcb719f7d69e3d4","bodyHash":"9d8f1c077a841ba1a9c0124b2aa91e475927acab1d0c81dec1a80967f7c94260"}
 *
 * Go source:
 * func (host *emitHost) GetEmitModuleFormatOfFile(file ast.HasFileName) core.ModuleKind {
 * 	return host.program.GetEmitModuleFormatOfFile(file)
 * }
 */
export function emitHost_GetEmitModuleFormatOfFile(receiver: GoPtr<emitHost>, file: HasFileName): ModuleKind {
  return Program_GetEmitModuleFormatOfFile(receiver!.program, file);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.FileExists","kind":"method","status":"implemented","sigHash":"29a077517078ac670f9f0a17dd73b0fb7a9ca7d26b9919fe79a80c6887bd93bc","bodyHash":"b71e9138f14c5e558b3fdfdf03a358972e893915f93212281189f3cfe766bfb7"}
 *
 * Go source:
 * func (host *emitHost) FileExists(path string) bool {
 * 	return host.program.FileExists(path)
 * }
 */
export function emitHost_FileExists(receiver: GoPtr<emitHost>, path: string): bool {
  return Program_FileExists(receiver!.program, path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetGlobalTypingsCacheLocation","kind":"method","status":"implemented","sigHash":"44763cff9591a8a01139e3b792e836ed0bd7a7d26f97513ed8fb2bb1c16d1b6f","bodyHash":"daac9c89a92540fcc49af7c1db0e2f303c0ca19602aa512c4f1ac7dce9cc9fe5"}
 *
 * Go source:
 * func (host *emitHost) GetGlobalTypingsCacheLocation() string {
 * 	return host.program.GetGlobalTypingsCacheLocation()
 * }
 */
export function emitHost_GetGlobalTypingsCacheLocation(receiver: GoPtr<emitHost>): string {
  return Program_GetGlobalTypingsCacheLocation(receiver!.program);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetNearestAncestorDirectoryWithPackageJson","kind":"method","status":"implemented","sigHash":"dbc85b889c9f7ea5467ecf24615ecd56439a03c925fa6e553e725f08328853a4","bodyHash":"2e803aefe7eb1a795d010498b398d64d1d443eb765840f7dd83f60125528dccc"}
 *
 * Go source:
 * func (host *emitHost) GetNearestAncestorDirectoryWithPackageJson(dirname string) string {
 * 	return host.program.GetNearestAncestorDirectoryWithPackageJson(dirname)
 * }
 */
export function emitHost_GetNearestAncestorDirectoryWithPackageJson(receiver: GoPtr<emitHost>, dirname: string): string {
  return Program_GetNearestAncestorDirectoryWithPackageJson(receiver!.program, dirname);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetPackageJsonInfo","kind":"method","status":"implemented","sigHash":"a7a07ab02a0d37ee2518194b93ee1482eba9ab1572c1032b3afcdb815d1ced0d","bodyHash":"2137eed27387458ff59271301885d3eff1a6883b1a60107b83165dd316864e8c"}
 *
 * Go source:
 * func (host *emitHost) GetPackageJsonInfo(pkgJsonPath string) *packagejson.InfoCacheEntry {
 * 	return host.program.GetPackageJsonInfo(pkgJsonPath)
 * }
 */
export function emitHost_GetPackageJsonInfo(receiver: GoPtr<emitHost>, pkgJsonPath: string): GoPtr<InfoCacheEntry> {
  return Program_GetPackageJsonInfo(receiver!.program, pkgJsonPath);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetSourceOfProjectReferenceIfOutputIncluded","kind":"method","status":"implemented","sigHash":"88a184e609f0420dc593b4b149e0128978ba1e3a236094ea7fb6bd8982d6a976","bodyHash":"51fe1e269a4175bfb5d398a754ac45ef6760fc84bd481948d518e271962db4df"}
 *
 * Go source:
 * func (host *emitHost) GetSourceOfProjectReferenceIfOutputIncluded(file ast.HasFileName) string {
 * 	return host.program.GetSourceOfProjectReferenceIfOutputIncluded(file)
 * }
 */
export function emitHost_GetSourceOfProjectReferenceIfOutputIncluded(receiver: GoPtr<emitHost>, file: HasFileName): string {
  return Program_GetSourceOfProjectReferenceIfOutputIncluded(receiver!.program, file);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetProjectReferenceFromSource","kind":"method","status":"implemented","sigHash":"d9aede4821850d82ef1e0b3153d05eaf655b231f7c7a29b91781bc366f2bda68","bodyHash":"501f9b6214421107ddbf4942a18b4008cdb9cdb5614b5e6a0ae6caa448ce8f94"}
 *
 * Go source:
 * func (host *emitHost) GetProjectReferenceFromSource(path tspath.Path) *tsoptions.SourceOutputAndProjectReference {
 * 	return host.program.GetProjectReferenceFromSource(path)
 * }
 */
export function emitHost_GetProjectReferenceFromSource(receiver: GoPtr<emitHost>, path: Path): GoPtr<SourceOutputAndProjectReference> {
  return Program_GetProjectReferenceFromSource(receiver!.program, path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetRedirectTargets","kind":"method","status":"implemented","sigHash":"26b434fb5ba1f6e2bdb359ff307de3961797bf93c3a5e84b894064b5e963b6f1","bodyHash":"90d921ec4cc3cc3a9a068a277126013094317f292af6fbda7125aa0c2f07378f"}
 *
 * Go source:
 * func (host *emitHost) GetRedirectTargets(path tspath.Path) []string {
 * 	return host.program.GetRedirectTargets(path)
 * }
 */
export function emitHost_GetRedirectTargets(receiver: GoPtr<emitHost>, path: Path): GoSlice<string> {
  return Program_GetRedirectTargets(receiver!.program, path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetEffectiveDeclarationFlags","kind":"method","status":"implemented","sigHash":"a712c4c9a747747aebb8b8c3b9e92c58070f6543ace774fba23d01d953660370","bodyHash":"ac9288e5aa686d596d5d119357335e0a1912c59ae2f604bb08f1ef452ec86f9a"}
 *
 * Go source:
 * func (host *emitHost) GetEffectiveDeclarationFlags(node *ast.Node, flags ast.ModifierFlags) ast.ModifierFlags {
 * 	return host.GetEmitResolver().GetEffectiveDeclarationFlags(node, flags)
 * }
 */
export function emitHost_GetEffectiveDeclarationFlags(receiver: GoPtr<emitHost>, node: GoPtr<Node>, flags: ModifierFlags): ModifierFlags {
  return emitHost_GetEmitResolver(receiver).GetEffectiveDeclarationFlags(node, flags);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetOutputPathsFor","kind":"method","status":"implemented","sigHash":"d83670f4bf8f9d6213f49144513fd1de5456e96978086d49dbd4567f101ae2ec","bodyHash":"4c83aca0272336a36aa7679e2b8773f3213c134ed9282c3bf1d35b42a65f9d7b"}
 *
 * Go source:
 * func (host *emitHost) GetOutputPathsFor(file *ast.SourceFile, forceDtsPaths bool) declarations.OutputPaths {
 * 	// TODO: cache
 * 	return outputpaths.GetOutputPathsFor(file, host.Options(), host, forceDtsPaths)
 * }
 */
export function emitHost_GetOutputPathsFor(receiver: GoPtr<emitHost>, file: GoPtr<SourceFile>, forceDtsPaths: bool): OutputPaths {
  const host = emitHost_as_outputpaths_OutputPathsHost(receiver);
  const result = GetOutputPathsFor(file, emitHost_Options(receiver), host, forceDtsPaths);
  return {
    DeclarationFilePath: (): string => OutputPaths_DeclarationFilePath(result),
    JsFilePath: (): string => OutputPaths_JsFilePath(result),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetResolutionModeOverride","kind":"method","status":"implemented","sigHash":"1f55097ce8f906adbe4199adaa1b62efb875522271a65de28e69d9c285025681","bodyHash":"d821a1ea5f9f1068609df08e61c4362b6fce5f9410677d408e9c86884797ced7"}
 *
 * Go source:
 * func (host *emitHost) GetResolutionModeOverride(node *ast.Node) core.ResolutionMode {
 * 	return host.GetEmitResolver().GetResolutionModeOverride(node)
 * }
 */
export function emitHost_GetResolutionModeOverride(receiver: GoPtr<emitHost>, node: GoPtr<Node>): ResolutionMode {
  return emitHost_GetEmitResolver(receiver).GetResolutionModeOverride(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetSourceFileFromReference","kind":"method","status":"implemented","sigHash":"3a411e83b1d1649b912ba2bbf193754a6ebc14f3cec7ad8643457fb934b2a55d","bodyHash":"3cdb2dc2d19d3909c259b8363bdbb066f11f38d51eb773cfda9d71cf70ae5b19"}
 *
 * Go source:
 * func (host *emitHost) GetSourceFileFromReference(origin *ast.SourceFile, ref *ast.FileReference) *ast.SourceFile {
 * 	return host.program.GetSourceFileFromReference(origin, ref)
 * }
 */
export function emitHost_GetSourceFileFromReference(receiver: GoPtr<emitHost>, origin: GoPtr<SourceFile>, ref: GoPtr<FileReference>): GoPtr<SourceFile> {
  return Program_GetSourceFileFromReference(receiver!.program, origin, ref);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.Options","kind":"method","status":"implemented","sigHash":"cf6443df21f906e297f0e87e42afce93724f6f5b1325cb5e8d4698e487c21e4b","bodyHash":"e2814be4bbf2b64fa0e98f085b59a852b71c35ebe8771a2099aba07bbc36f242"}
 *
 * Go source:
 * func (host *emitHost) Options() *core.CompilerOptions { return host.program.Options() }
 */
export function emitHost_Options(receiver: GoPtr<emitHost>): GoPtr<CompilerOptions> {
  return Program_Options(receiver!.program);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.SourceFiles","kind":"method","status":"implemented","sigHash":"86c7b6b6b40bf827a41304fdec779271be74f5c3e30a0144a2e66a7e134e37c5","bodyHash":"2359cd987019615d4b223f3c37e819c3a7a473d9feb5b47d423ff93c8e7e713d"}
 *
 * Go source:
 * func (host *emitHost) SourceFiles() []*ast.SourceFile { return host.program.SourceFiles() }
 */
export function emitHost_SourceFiles(receiver: GoPtr<emitHost>): GoSlice<GoPtr<SourceFile>> {
  return Program_SourceFiles(receiver!.program);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetCurrentDirectory","kind":"method","status":"implemented","sigHash":"7e21c267c018a4667efe8349136d5417bfe61070de5b785b281b62da0d8806e7","bodyHash":"ed257f19f3f3a012bc06b19e0ae2435fe452f31d987e655b3d7a2e2cd16dd429"}
 *
 * Go source:
 * func (host *emitHost) GetCurrentDirectory() string    { return host.program.GetCurrentDirectory() }
 */
export function emitHost_GetCurrentDirectory(receiver: GoPtr<emitHost>): string {
  return Program_GetCurrentDirectory(receiver!.program);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.CommonSourceDirectory","kind":"method","status":"implemented","sigHash":"a3db1102fca4e45ba4e1fd70c4f361acdc577b0f914e3556a0c1d628dbbf3fa9","bodyHash":"211b0047aa69059b1ff197889447c28c11c4a654f35a98e24f966603b5b37642"}
 *
 * Go source:
 * func (host *emitHost) CommonSourceDirectory() string  { return host.program.CommonSourceDirectory() }
 */
export function emitHost_CommonSourceDirectory(receiver: GoPtr<emitHost>): string {
  return Program_CommonSourceDirectory(receiver!.program);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.UseCaseSensitiveFileNames","kind":"method","status":"implemented","sigHash":"b8b1872559f27b673d94fa77f2fa5f986c3a8f1c56e118e2b094d42fff90cdca","bodyHash":"c1223db47c2fad715ae40cc43a76eedd960446d8af8dca222d0ec3f1164ed5db"}
 *
 * Go source:
 * func (host *emitHost) UseCaseSensitiveFileNames() bool {
 * 	return host.program.UseCaseSensitiveFileNames()
 * }
 */
export function emitHost_UseCaseSensitiveFileNames(receiver: GoPtr<emitHost>): bool {
  return Program_UseCaseSensitiveFileNames(receiver!.program);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.IsEmitBlocked","kind":"method","status":"implemented","sigHash":"e07d61c3e724057ce2f92882e16b7f3ac0489a5fabf07b2971001a2532174736","bodyHash":"0bfb0ac94b3b01236b2c3c892a8010c2c89490ebd113d0817c31539a991e7aff"}
 *
 * Go source:
 * func (host *emitHost) IsEmitBlocked(file string) bool {
 * 	return host.program.IsEmitBlocked(file)
 * }
 */
export function emitHost_IsEmitBlocked(receiver: GoPtr<emitHost>, file: string): bool {
  return Program_IsEmitBlocked(receiver!.program, file);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.WriteFile","kind":"method","status":"implemented","sigHash":"8b047a8f632ae735fe504ec0a0b5d818ce226187a0779cd4b05e309427bf7058","bodyHash":"1534fedd8b6bd8711cf09ec4aca0bdc049cbb05be3b0565c2daa581a5c291c20"}
 *
 * Go source:
 * func (host *emitHost) WriteFile(fileName string, text string) error {
 * 	return host.program.Host().FS().WriteFile(fileName, text)
 * }
 */
export function emitHost_WriteFile(receiver: GoPtr<emitHost>, fileName: string, text: string): GoError {
  return Program_Host(receiver!.program).FS().WriteFile(fileName, text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetEmitResolver","kind":"method","status":"implemented","sigHash":"9c5f371868c855caab9c6e4aa283b2667377b1bc7286d27a8948e414a11c1bce","bodyHash":"7778b9bbe351f5fabe5924d8a5bb3e45fb64bf4e1eff4807950049fde53f0e01"}
 *
 * Go source:
 * func (host *emitHost) GetEmitResolver() printer.EmitResolver {
 * 	return host.emitResolver
 * }
 */
export function emitHost_GetEmitResolver(receiver: GoPtr<emitHost>): EmitResolver {
  return receiver!.emitResolver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.IsSourceFileFromExternalLibrary","kind":"method","status":"implemented","sigHash":"7cd83aca9ae75be2ef2025aa1b5dbc5c37bf12bda72b909c1a1c2ae36c13e40d","bodyHash":"c37ca07f4bee6dd92b0ea7f392f1230d5b5d5ae3cf787035861aa068eda17e88"}
 *
 * Go source:
 * func (host *emitHost) IsSourceFileFromExternalLibrary(file *ast.SourceFile) bool {
 * 	return host.program.IsSourceFileFromExternalLibrary(file)
 * }
 */
export function emitHost_IsSourceFileFromExternalLibrary(receiver: GoPtr<emitHost>, file: GoPtr<SourceFile>): bool {
  return Program_IsSourceFileFromExternalLibrary(receiver!.program, file);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.GetSymlinkCache","kind":"method","status":"implemented","sigHash":"bf7c644af870582decc0cd8ead49a0663f4492f3f6bb87e785784bf97eb85f57","bodyHash":"1aa4b871e875250601fde5ee8451a4b20c26d43387f747faa647df0c18fb35a3"}
 *
 * Go source:
 * func (host *emitHost) GetSymlinkCache() *symlinks.KnownSymlinks {
 * 	return host.program.GetSymlinkCache()
 * }
 */
export function emitHost_GetSymlinkCache(receiver: GoPtr<emitHost>): GoPtr<KnownSymlinks> {
  return Program_GetSymlinkCache(receiver!.program);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitHost.go::method::emitHost.ResolveModuleName","kind":"method","status":"implemented","sigHash":"0c7462e235eb0006e9136e0243cadd9d5d66149e308cfc33dc014de215de5e50","bodyHash":"ac2fcd58016a7c6ebc4adc9eb958127362cd6090cc439afea0d8d87232621654"}
 *
 * Go source:
 * func (host *emitHost) ResolveModuleName(moduleName string, containingFile string, resolutionMode core.ResolutionMode) *module.ResolvedModule {
 * 	resolved, _ := host.program.resolver.ResolveModuleName(moduleName, containingFile, resolutionMode, nil)
 * 	return resolved
 * }
 */
export function emitHost_ResolveModuleName(receiver: GoPtr<emitHost>, moduleName: string, containingFile: string, resolutionMode: ResolutionMode): GoPtr<ResolvedModule> {
  return Program_ResolveModuleName(receiver!.program, moduleName, containingFile, resolutionMode);
}
