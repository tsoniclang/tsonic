import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice, GoUnresolved } from "../../go/compat.js";
import { NewGoStructMap } from "../../go/compat.js";
import { Pool, Mutex, Once } from "../../go/sync.js";
import { Join as strings_Join } from "../../go/strings.js";
import type { SourceFile, SourceFileMetaData } from "../ast/ast.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import { SyncMap_Load, SyncMap_Store } from "../collections/syncmap.js";
import type { SyncMap } from "../collections/syncmap.js";
import { IfElse, Flatten } from "../core/core.js";
import { ResolutionModeCommonJS } from "../core/compileroptions.js";
import { TSTrue, Tristate_IsTrue, Tristate_IsFalse, Tristate_IsFalseOrUnknown } from "../core/tristate.js";
import type { WorkGroup } from "../core/workgroup.js";
import { File_0_has_an_unsupported_extension_The_only_supported_extensions_are_1, File_0_is_a_JavaScript_file_Did_you_mean_to_enable_the_allowJs_option } from "../diagnostics/generated/messages.js";
import type { ModeAwareCache } from "../module/cache.js";
import type { DiagAndArgs } from "../module/resolver.js";
import { PackageId_String } from "../module/types.js";
import type { PackageId, ResolvedModule, ResolvedTypeReferenceDirective } from "../module/types.js";
import { GetNormalizedAbsolutePathWithoutRoot, NormalizePath, ToFileNameLowerCase } from "../tspath/path.js";
import type { Path as Path_65a900c3 } from "../tspath/path.js";
import { HasExtension, GetCanonicalFileName } from "../tspath/path.js";
import { HasJSFileExtension } from "../tspath/extension.js";
import { ParsedCommandLine_CompilerOptions, ParsedCommandLine_ResolvedProjectReferencePaths } from "../tsoptions/parsedcommandline.js";
import { SourceFile_FileName, SourceFile_Path, SourceFile_ParseOptions } from "../ast/ast.js";
import { GetLibFileName } from "../tsoptions/enummaps.js";
import { fileIncludeKindLibReferenceDirective } from "./fileInclude.js";
import type { FileIncludeReason } from "./fileInclude.js";
import type { referencedFileData } from "./fileInclude.js";
import { projectReferenceFileMapper_getParseFileRedirect } from "./projectreferencefilemapper.js";
import type { HasFileName } from "../ast/ast.js";
import {
  fileLoader_toPath,
  fileLoader_isSupportedExtension,
  fileLoader_loadSourceFileMetaData,
  fileLoader_parseSourceFile,
  fileLoader_resolveTripleslashPathReference,
  fileLoader_resolveTypeReferenceDirectives,
  fileLoader_resolveAutomaticTypeDirectives,
  fileLoader_resolveImportsAndModuleAugmentations,
  fileLoader_pathForLibFile,
  fileLoader_sortLibs,
} from "./fileloader.js";
import { ProgramOptions_canUseProjectReferenceSource } from "./program.js";
import type { fileLoader, jsxRuntimeImportSpecifier, LibFile, processedFiles, redirectsFile, DuplicateSourceFile, libResolution } from "./fileloader.js";
import type { includeProcessor } from "./includeprocessor.js";
import { processingDiagnosticKindExplainingFileInclude, processingDiagnosticKindUnknownReference } from "./processingDiagnostic.js";
import type { processingDiagnostic, includeExplainingDiagnostic } from "./processingDiagnostic.js";
import { SyncMap_LoadOrStore } from "../collections/syncmap.js";
import { MaxInt } from "../../go/math.js";
import { Map as sync_Map } from "../../go/sync.js";
import { Set_Add } from "../collections/set.js";
import type { Set as Set_collections } from "../collections/set.js";
import { Collect, Sort } from "../../go/slices.js";
import { SyncMap_Keys } from "../collections/syncmap.js";
import { ModuleKindCommonJS } from "../core/compileroptions.js";
import type { ModeAwareCacheKey } from "../module/types.js";
import {
  includeProcessor_addProcessingDiagnosticsForFileCasing,
} from "./includeprocessor.js";
import * as strings from "../../go/strings.js";

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
export function parseTask_FileName(receiver: GoPtr<parseTask>): string {
  return receiver!.normalizedFilePath;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::method::parseTask.Path","kind":"method","status":"implemented","sigHash":"9062bb96bbb26b2bf4fc68b2f1bc8a97bb920cdaecc9a326b2320335e7c7fc2c","bodyHash":"4faef12947746efc5f2f2814d37afe88a9cb523ef39ef909a7abf2402b47a21b"}
 *
 * Go source:
 * func (t *parseTask) Path() tspath.Path {
 * 	return t.path
 * }
 */
export function parseTask_Path(receiver: GoPtr<parseTask>): Path_65a900c3 {
  return receiver!.path;
}

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
export function parseTask_load(receiver: GoPtr<parseTask>, loader: GoPtr<fileLoader>): void {
  receiver!.loaded = true;
  if (receiver!.isForAutomaticTypeDirective) {
    parseTask_loadAutomaticTypeDirectives(receiver, loader);
    return;
  }
  // loader.opts.Tracing is omitted (single-threaded, tracing is a no-op)
  const receiverAsHasFileName: HasFileName = {
    FileName: () => parseTask_FileName(receiver),
    Path: () => parseTask_Path(receiver),
  };
  const redirect = projectReferenceFileMapper_getParseFileRedirect(loader!.projectReferenceFileMapper, receiverAsHasFileName);
  if (redirect !== "") {
    parseTask_redirect(receiver, loader, redirect);
    return;
  }

  if (HasExtension(receiver!.normalizedFilePath)) {
    const compilerOptions = ParsedCommandLine_CompilerOptions(loader!.opts.Config);
    const allowNonTsExtensions = Tristate_IsTrue(compilerOptions!.AllowNonTsExtensions);
    if (!allowNonTsExtensions) {
      const canonicalFileName = GetCanonicalFileName(receiver!.normalizedFilePath, loader!.opts.Host.FS().UseCaseSensitiveFileNames());
      if (!fileLoader_isSupportedExtension(loader, canonicalFileName)) {
        if (HasJSFileExtension(canonicalFileName)) {
          receiver!.processingDiagnostics = [...receiver!.processingDiagnostics, {
            kind: processingDiagnosticKindExplainingFileInclude,
            data: {
              diagnosticReason: receiver!.includeReason,
              message: File_0_is_a_JavaScript_file_Did_you_mean_to_enable_the_allowJs_option,
              args: [receiver!.normalizedFilePath],
            } as includeExplainingDiagnostic,
          }];
        } else {
          receiver!.processingDiagnostics = [...receiver!.processingDiagnostics, {
            kind: processingDiagnosticKindExplainingFileInclude,
            data: {
              diagnosticReason: receiver!.includeReason,
              message: File_0_has_an_unsupported_extension_The_only_supported_extensions_are_1,
              args: [receiver!.normalizedFilePath, "'" + strings_Join(Flatten(loader!.supportedExtensions), "', '") + "'"],
            } as includeExplainingDiagnostic,
          }];
        }
        return;
      }
    }
  }

  loader!.totalFileCount.Add(1);
  if (receiver!.libFile !== undefined) {
    loader!.libFileCount.Add(1);
    // Default lib files are all scripts; skip looking up their package.json
    receiver!.metadata = { ImpliedNodeFormat: ResolutionModeCommonJS, PackageJsonType: "", PackageJsonDirectory: "" };
  } else {
    receiver!.metadata = fileLoader_loadSourceFileMetaData(loader, receiver!.normalizedFilePath);
  }

  const file = fileLoader_parseSourceFile(loader, receiver);
  if (file === undefined) {
    return;
  }

  receiver!.file = file;
  receiver!.subTasks = [];

  const compilerOptions2 = ParsedCommandLine_CompilerOptions(loader!.opts.Config);
  if (!Tristate_IsTrue(compilerOptions2!.NoResolve)) {
    for (let index = 0; index < file!.ReferencedFiles.length; index++) {
      const ref = file!.ReferencedFiles[index]!;
      const [resolvedRef, pDiag] = fileLoader_resolveTripleslashPathReference(loader, ref.FileName, SourceFile_FileName(file), index);
      if (pDiag !== undefined) {
        receiver!.processingDiagnostics = [...receiver!.processingDiagnostics, pDiag];
        continue;
      }
      parseTask_addSubTask(receiver, resolvedRef!, undefined);
    }

    fileLoader_resolveTypeReferenceDirectives(loader, receiver);
  }

  if (compilerOptions2!.NoLib !== TSTrue) {
    for (let index = 0; index < file!.LibReferenceDirectives.length; index++) {
      const lib = file!.LibReferenceDirectives[index]!;
      const includeReason: FileIncludeReason = {
        kind: fileIncludeKindLibReferenceDirective,
        data: {
          file: receiver!.path,
          index: index,
        } as referencedFileData,
        relativeFileNameDiag: undefined,
        relativeFileNameDiagOnce: new Once(),
        diag: undefined,
        diagOnce: new Once(),
      };
      const [name, ok] = GetLibFileName(lib.FileName);
      if (ok) {
        const libFile = fileLoader_pathForLibFile(loader, name);
        parseTask_addSubTask(receiver, {
          fileName: libFile!.path,
          increaseDepth: false,
          elideOnDepth: false,
          includeReason: includeReason,
          packageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
        }, libFile);
      } else {
        receiver!.processingDiagnostics = [...receiver!.processingDiagnostics, {
          kind: processingDiagnosticKindUnknownReference,
          data: includeReason,
        }];
      }
    }
  }

  fileLoader_resolveImportsAndModuleAugmentations(loader, receiver);
}

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
export function parseTask_redirect(receiver: GoPtr<parseTask>, loader: GoPtr<fileLoader>, fileName: string): void {
  receiver!.redirectedParseTask = {
    normalizedFilePath: NormalizePath(fileName),
    path: "" as Path_65a900c3,
    file: undefined,
    libFile: receiver!.libFile,
    redirectedParseTask: undefined,
    subTasks: [],
    loaded: false,
    startedSubTasks: false,
    isForAutomaticTypeDirective: false,
    includeReason: receiver!.includeReason,
    packageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
    metadata: {} as SourceFileMetaData,
    resolutionsInFile: undefined as unknown as ModeAwareCache,
    resolutionsTrace: [],
    typeResolutionsInFile: undefined as unknown as ModeAwareCache,
    typeResolutionsTrace: [],
    resolutionDiagnostics: [],
    processingDiagnostics: [],
    importHelpersImportSpecifier: undefined,
    jsxRuntimeImportSpecifier: undefined,
    increaseDepth: false,
    elideOnDepth: false,
    loadedTask: undefined,
    allIncludeReasons: [],
  };
  // increaseDepth and elideOnDepth are not copied to redirects
  receiver!.subTasks = [receiver!.redirectedParseTask];
}

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
export function parseTask_loadAutomaticTypeDirectives(receiver: GoPtr<parseTask>, loader: GoPtr<fileLoader>): void {
  // loader.opts.Tracing is omitted (single-threaded, tracing is a no-op)
  const [toParseTypeRefs, typeResolutionsInFile, typeResolutionsTrace, pDiagnostics] = fileLoader_resolveAutomaticTypeDirectives(loader, receiver!.normalizedFilePath);
  receiver!.typeResolutionsInFile = typeResolutionsInFile;
  receiver!.typeResolutionsTrace = typeResolutionsTrace;
  receiver!.processingDiagnostics = [...(receiver!.processingDiagnostics ?? []), ...(pDiagnostics ?? [])];
  for (const typeResolution of toParseTypeRefs ?? []) {
    parseTask_addSubTask(receiver, typeResolution, undefined);
  }
}

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
export function parseTask_addSubTask(receiver: GoPtr<parseTask>, ref: resolvedRef, libFile: GoPtr<LibFile>): void {
  const normalizedFilePath = NormalizePath(ref.fileName);
  const subTask: parseTask = {
    normalizedFilePath: normalizedFilePath,
    path: "" as Path_65a900c3,
    file: undefined,
    libFile: libFile,
    redirectedParseTask: undefined,
    subTasks: [],
    loaded: false,
    startedSubTasks: false,
    isForAutomaticTypeDirective: false,
    includeReason: ref.includeReason,
    packageId: ref.packageId ?? { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
    metadata: {} as SourceFileMetaData,
    resolutionsInFile: undefined as unknown as ModeAwareCache,
    resolutionsTrace: [],
    typeResolutionsInFile: undefined as unknown as ModeAwareCache,
    typeResolutionsTrace: [],
    resolutionDiagnostics: [],
    processingDiagnostics: [],
    importHelpersImportSpecifier: undefined,
    jsxRuntimeImportSpecifier: undefined,
    increaseDepth: ref.increaseDepth,
    elideOnDepth: ref.elideOnDepth,
    loadedTask: undefined,
    allIncludeReasons: [],
  };
  receiver!.subTasks.push(subTask);
}

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
export const parseTaskDataPool: Pool<parseTaskData> = (() => {
  const pool = new Pool<parseTaskData>();
  pool.New = (): parseTaskData => ({
    tasks: new globalThis.Map<string, GoPtr<parseTask>>(),
    mu: new Mutex(),
    lowestDepth: 0,
    startedSubTasks: false,
    packageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
  });
  return pool;
})();

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
export function getParseTaskData(task: GoPtr<parseTask>): GoPtr<parseTaskData> {
  const td = parseTaskDataPool.Get()!;
  td.tasks.set(task!.normalizedFilePath, task);
  td.lowestDepth = MaxInt;
  return td;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/filesparser.go::func::putParseTaskData","kind":"func","status":"implemented","sigHash":"4c8f88199b0398d285c74b4ee3245e1d6ce216ff9cc5c68891263174836bffbc","bodyHash":"dffd014f3d9dd2cd6261ed492c38de0ffbfa6709845e70d8b0ffcb4a38e595fb"}
 *
 * Go source:
 * func putParseTaskData(td *parseTaskData) {
 * 	clear(td.tasks)
 * 	parseTaskDataPool.Put(td)
 * }
 */
export function putParseTaskData(td: GoPtr<parseTaskData>): void {
  td!.tasks.clear();
  parseTaskDataPool.Put(td!);
}

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
export function filesParser_parse(receiver: GoPtr<filesParser>, loader: GoPtr<fileLoader>, tasks: GoSlice<GoPtr<parseTask>>): void {
  filesParser_start(receiver, loader, tasks, 0);
  receiver!.wg.RunAndWait();
}

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
export function filesParser_start(receiver: GoPtr<filesParser>, loader: GoPtr<fileLoader>, tasks: GoSlice<GoPtr<parseTask>>, depth: int): void {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]!;
    task.path = fileLoader_toPath(loader, task.normalizedFilePath);
    const candidate = getParseTaskData(task);
    const [data, loaded] = SyncMap_LoadOrStore<Path_65a900c3, GoPtr<parseTaskData>>(
      receiver!.taskDataByPath as unknown as import("../collections/syncmap.js").SyncMap<Path_65a900c3, GoPtr<parseTaskData>>,
      task.path,
      candidate,
    );
    if (loaded) {
      putParseTaskData(candidate);
    }

    const capturedI = i;
    const capturedTask = task;
    receiver!.wg.Queue((): void => {
      data!.mu.Lock();

      let startSubtasks = false;
      if (loaded) {
        const existingTask = data!.tasks.get(capturedTask.normalizedFilePath);
        if (existingTask !== undefined) {
          tasks[capturedI]!.loadedTask = existingTask;
        } else {
          data!.tasks.set(capturedTask.normalizedFilePath, capturedTask);
          // This is new task for file name - so load subtasks if there was loading for any other casing
          startSubtasks = data!.startedSubTasks;
        }
      }

      // Propagate packageId to data if we have one and data doesn't yet
      const dataPackageId = data!.packageId ?? { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" };
      const taskPackageId = capturedTask.packageId ?? { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" };
      if (dataPackageId.Name === "" && taskPackageId.Name !== "") {
        data!.packageId = taskPackageId;
      }

      const currentDepth = IfElse(capturedTask.increaseDepth, depth + 1, depth);
      if (currentDepth < data!.lowestDepth) {
        // If we're seeing this task at a lower depth than before,
        // reprocess its subtasks to ensure they are loaded.
        data!.lowestDepth = currentDepth;
        startSubtasks = true;
        data!.startedSubTasks = true;
      }

      if (capturedTask.elideOnDepth && currentDepth > receiver!.maxDepth) {
        data!.mu.Unlock();
        return;
      }

      for (const [, taskByFileName] of data!.tasks) {
        let loadSubTasks = startSubtasks;
        if (!taskByFileName!.loaded) {
          parseTask_load(taskByFileName, loader);
          if (taskByFileName!.redirectedParseTask !== undefined) {
            // Always load redirected task
            loadSubTasks = true;
            data!.startedSubTasks = true;
          }
        }
        if (!taskByFileName!.startedSubTasks && loadSubTasks) {
          taskByFileName!.startedSubTasks = true;
          filesParser_start(receiver, loader, taskByFileName!.subTasks, data!.lowestDepth);
        }
      }

      data!.mu.Unlock();
    });
  }
}

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
export function filesParser_getProcessedFiles(receiver: GoPtr<filesParser>, loader: GoPtr<fileLoader>): processedFiles {
  const totalFileCount = loader!.totalFileCount.Load() as number;
  const libFileCount = loader!.libFileCount.Load() as number;

  let missingFiles: GoSlice<string> = [];
  let duplicateSourceFiles: GoSlice<GoPtr<DuplicateSourceFile>> = [];
  const files: GoSlice<GoPtr<SourceFile>> = [];
  const libFiles: GoSlice<GoPtr<SourceFile>> = [];

  const filesByPath = new globalThis.Map<Path_65a900c3, GoPtr<SourceFile>>();
  let tasksSeenByNameIgnoreCase: GoMap<string, GoPtr<parseTask>> | undefined = undefined;
  if (loader!.comparePathsOptions.UseCaseSensitiveFileNames) {
    tasksSeenByNameIgnoreCase = new globalThis.Map<string, GoPtr<parseTask>>();
  }

  const inclProcessor: includeProcessor = {
    fileIncludeReasons: new globalThis.Map<Path_65a900c3, GoSlice<GoPtr<FileIncludeReason>>>(),
    processingDiagnostics: [],
    reasonToReferenceLocation: { __tsgoBlank0: [], __tsgoBlank1: [], m: new sync_Map() } as unknown as import("../collections/syncmap.js").SyncMap,
    includeReasonToRelatedInfo: { __tsgoBlank0: [], __tsgoBlank1: [], m: new sync_Map() } as unknown as import("../collections/syncmap.js").SyncMap,
    redirectAndFileFormat: { __tsgoBlank0: [], __tsgoBlank1: [], m: new sync_Map() } as unknown as import("../collections/syncmap.js").SyncMap,
    computedDiagnostics: undefined,
    computedDiagnosticsOnce: new Once(),
    compilerOptionsSyntax: undefined,
    compilerOptionsSyntaxOnce: new Once(),
  };

  let outputFileToProjectReferenceSource: GoMap<Path_65a900c3, string> | undefined = undefined;
  if (!(ProgramOptions_canUseProjectReferenceSource(loader!.opts))) {
    outputFileToProjectReferenceSource = new globalThis.Map<Path_65a900c3, string>();
  }

  const resolvedModules = new globalThis.Map<Path_65a900c3, ModeAwareCache>();
  const typeResolutionsInFile = new globalThis.Map<Path_65a900c3, ModeAwareCache>();
  const sourceFileMetaDatas = new globalThis.Map<Path_65a900c3, SourceFileMetaData>();
  let jsxRuntimeImportSpecifiers: GoMap<Path_65a900c3, GoPtr<jsxRuntimeImportSpecifier>> | undefined = undefined;
  let importHelpersImportSpecifiers: GoMap<Path_65a900c3, GoPtr<GoUnresolved<"github.com/microsoft/typescript-go/internal/ast.StringLiteralNode">>> | undefined = undefined;
  const sourceFilesFoundSearchingNodeModules: Set_collections<Path_65a900c3> = { M: new globalThis.Map<Path_65a900c3, { readonly __tsgoEmpty?: never }>() };
  const libFilesMap = new globalThis.Map<Path_65a900c3, GoPtr<LibFile>>();

  let redirectTargetsMap: GoMap<Path_65a900c3, GoSlice<string>> | undefined = undefined;
  let redirectFilesByPath: GoMap<Path_65a900c3, GoPtr<redirectsFile>> | undefined = undefined;
  let packageIdToSourceFile: GoMap<string, GoPtr<SourceFile>> | undefined = undefined;
  if (!Tristate_IsFalse(ParsedCommandLine_CompilerOptions(loader!.opts.Config)!.DeduplicatePackages)) {
    redirectTargetsMap = new globalThis.Map<Path_65a900c3, GoSlice<string>>();
    packageIdToSourceFile = new globalThis.Map<string, GoPtr<SourceFile>>();
  }

  const collectFiles = (tasks: GoSlice<GoPtr<parseTask>>, seen: GoMap<GoPtr<parseTaskData>, string>): void => {
    for (let task of tasks) {
      const includeReason = task!.includeReason;
      if (task!.redirectedParseTask === undefined && !task!.isForAutomaticTypeDirective) {
        if (task!.loadedTask !== undefined) {
          task = task!.loadedTask;
        }
        filesParser_addIncludeReason(receiver, inclProcessor, task, includeReason);
      }
      const [data] = SyncMap_Load<Path_65a900c3, GoPtr<parseTaskData>>(
        receiver!.taskDataByPath as unknown as import("../collections/syncmap.js").SyncMap<Path_65a900c3, GoPtr<parseTaskData>>,
        task!.path,
      );
      if (!task!.loaded) {
        continue;
      }

      // ensure we only walk each task once
      const checkedName = seen.get(data);
      if (checkedName !== undefined) {
        if (task!.file !== undefined && checkedName !== task!.normalizedFilePath) {
          duplicateSourceFiles = [...duplicateSourceFiles, {
            ParseOptions: SourceFile_ParseOptions(task!.file),
            Hash: task!.file!.Hash,
            ScriptKind: task!.file!.ScriptKind,
          }];
        }
        if (!Tristate_IsFalse(ParsedCommandLine_CompilerOptions(loader!.opts.Config)!.ForceConsistentCasingInFileNames)) {
          const checkedAbsolutePath = GetNormalizedAbsolutePathWithoutRoot(checkedName, loader!.comparePathsOptions.CurrentDirectory);
          const inputAbsolutePath = GetNormalizedAbsolutePathWithoutRoot(task!.normalizedFilePath, loader!.comparePathsOptions.CurrentDirectory);
          if (checkedAbsolutePath !== inputAbsolutePath) {
            includeProcessor_addProcessingDiagnosticsForFileCasing(inclProcessor, task!.path, checkedName, task!.normalizedFilePath, includeReason);
          }
        }
        continue;
      } else {
        seen.set(data, task!.normalizedFilePath);
      }

      if (tasksSeenByNameIgnoreCase !== undefined) {
        const pathLowerCase = ToFileNameLowerCase(task!.path as string);
        const taskByIgnoreCase = tasksSeenByNameIgnoreCase.get(pathLowerCase);
        if (taskByIgnoreCase !== undefined) {
          includeProcessor_addProcessingDiagnosticsForFileCasing(inclProcessor, taskByIgnoreCase!.path, taskByIgnoreCase!.normalizedFilePath, task!.normalizedFilePath, includeReason);
        } else {
          tasksSeenByNameIgnoreCase.set(pathLowerCase, task);
        }
      }

      for (const trace of task!.typeResolutionsTrace) {
        loader!.opts.Host.Trace(trace.Message, ...trace.Args);
      }
      for (const trace of task!.resolutionsTrace) {
        loader!.opts.Host.Trace(trace.Message, ...trace.Args);
      }

      let file = task!.file;
      const dataPackageId = data!.packageId ?? { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" };
      if (packageIdToSourceFile !== undefined && dataPackageId.Name !== "") {
        const dataPackageIdKey = PackageId_String(dataPackageId);
        const packageIdFile = packageIdToSourceFile.get(dataPackageIdKey);
        if (packageIdFile !== undefined) {
          if (file !== undefined) {
            duplicateSourceFiles = [...duplicateSourceFiles, {
              ParseOptions: SourceFile_ParseOptions(file),
              Hash: file!.Hash,
              ScriptKind: file!.ScriptKind,
            }];
          }
          const existing = redirectTargetsMap!.get(SourceFile_Path(packageIdFile));
          redirectTargetsMap!.set(SourceFile_Path(packageIdFile), [...(existing !== undefined ? existing : []), task!.normalizedFilePath]);
          if (redirectFilesByPath === undefined) {
            redirectFilesByPath = new globalThis.Map<Path_65a900c3, GoPtr<redirectsFile>>();
          }
          redirectFilesByPath.set(task!.path, {
            index: files.length + redirectFilesByPath.size,
            fileName: task!.normalizedFilePath,
            path: task!.path,
            target: SourceFile_Path(packageIdFile),
          });
          filesByPath.set(task!.path, packageIdFile);
          if (data!.lowestDepth > 0) {
            Set_Add(sourceFilesFoundSearchingNodeModules, task!.path);
          }
          continue;
        } else if (file !== undefined) {
          packageIdToSourceFile.set(dataPackageIdKey, file);
        }
      }

      if (task!.subTasks.length > 0) {
        collectFiles(task!.subTasks, seen);
      }

      if (task!.redirectedParseTask !== undefined) {
        if (!ProgramOptions_canUseProjectReferenceSource(loader!.opts)) {
          outputFileToProjectReferenceSource!.set(task!.redirectedParseTask!.path, parseTask_FileName(task));
        }
        continue;
      }

      if (task!.isForAutomaticTypeDirective) {
        typeResolutionsInFile.set(task!.path, task!.typeResolutionsInFile);
        if (task!.processingDiagnostics.length > 0) {
          inclProcessor.processingDiagnostics = [...inclProcessor.processingDiagnostics, ...task!.processingDiagnostics];
        }
        continue;
      }

      const path = task!.path;

      if (task!.processingDiagnostics.length > 0) {
        inclProcessor.processingDiagnostics = [...inclProcessor.processingDiagnostics, ...task!.processingDiagnostics];
      }

      if (file === undefined) {
        missingFiles = [...missingFiles, task!.normalizedFilePath];
        continue;
      }

      if (task!.libFile !== undefined) {
        libFiles.push(file);
        libFilesMap.set(path, task!.libFile);
      } else {
        files.push(file);
      }
      filesByPath.set(path, file);
      resolvedModules.set(path, task!.resolutionsInFile);
      typeResolutionsInFile.set(path, task!.typeResolutionsInFile);
      sourceFileMetaDatas.set(path, task!.metadata);

      if (task!.jsxRuntimeImportSpecifier !== undefined) {
        if (jsxRuntimeImportSpecifiers === undefined) {
          jsxRuntimeImportSpecifiers = new globalThis.Map<Path_65a900c3, GoPtr<jsxRuntimeImportSpecifier>>();
        }
        jsxRuntimeImportSpecifiers.set(path, task!.jsxRuntimeImportSpecifier);
      }
      if (task!.importHelpersImportSpecifier !== undefined) {
        if (importHelpersImportSpecifiers === undefined) {
          importHelpersImportSpecifiers = new globalThis.Map<Path_65a900c3, GoPtr<GoUnresolved<"github.com/microsoft/typescript-go/internal/ast.StringLiteralNode">>>();
        }
        importHelpersImportSpecifiers.set(path, task!.importHelpersImportSpecifier);
      }
      if (data!.lowestDepth > 0) {
        Set_Add(sourceFilesFoundSearchingNodeModules, path);
      }
    }
  };

  collectFiles(loader!.rootTasks, new globalThis.Map<GoPtr<parseTaskData>, string>());
  fileLoader_sortLibs(loader, libFiles);

  const allFiles = [...libFiles, ...files];
  if (redirectFilesByPath !== undefined) {
    const redirectFilesByPathDefined = redirectFilesByPath as GoMap<Path_65a900c3, GoPtr<redirectsFile>>;
    for (const redirectFile of redirectFilesByPathDefined.values()) {
      redirectFile!.index += libFiles.length;
    }
  }

  const keys = Collect(SyncMap_Keys<Path_65a900c3, GoPtr<libResolution>>(
    loader!.pathForLibFileResolutions as unknown as import("../collections/syncmap.js").SyncMap<Path_65a900c3, GoPtr<libResolution>>,
  ));
  Sort(keys);
  for (const key of keys) {
    const [value] = SyncMap_Load<Path_65a900c3, GoPtr<libResolution>>(
      loader!.pathForLibFileResolutions as unknown as import("../collections/syncmap.js").SyncMap<Path_65a900c3, GoPtr<libResolution>>,
      key,
    );
    const modeAwareCache = NewGoStructMap<ModeAwareCacheKey, GoPtr<ResolvedModule>>();
    modeAwareCache.set({ Name: value!.libraryName, Mode: ModuleKindCommonJS }, value!.resolution);
    resolvedModules.set(key, modeAwareCache as ModeAwareCache);
    for (const trace of value!.trace) {
      loader!.opts.Host.Trace(trace.Message, ...trace.Args);
    }
  }

  return {
    finishedProcessing: true,
    resolver: loader!.resolver,
    files: allFiles,
    duplicateSourceFiles: duplicateSourceFiles,
    filesByPath: filesByPath,
    projectReferenceFileMapper: loader!.projectReferenceFileMapper,
    resolvedModules: resolvedModules,
    typeResolutionsInFile: typeResolutionsInFile,
    sourceFileMetaDatas: sourceFileMetaDatas,
    jsxRuntimeImportSpecifiers: jsxRuntimeImportSpecifiers !== undefined ? jsxRuntimeImportSpecifiers : new globalThis.Map(),
    importHelpersImportSpecifiers: importHelpersImportSpecifiers !== undefined ? importHelpersImportSpecifiers : new globalThis.Map(),
    sourceFilesFoundSearchingNodeModules: sourceFilesFoundSearchingNodeModules,
    libFiles: libFilesMap,
    missingFiles: missingFiles,
    includeProcessor: inclProcessor,
    outputFileToProjectReferenceSource: outputFileToProjectReferenceSource !== undefined ? outputFileToProjectReferenceSource : new globalThis.Map(),
    redirectTargetsMap: redirectTargetsMap !== undefined ? redirectTargetsMap : new globalThis.Map(),
    redirectFilesByPath: redirectFilesByPath !== undefined ? redirectFilesByPath : new globalThis.Map(),
  };
}

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
export function filesParser_addIncludeReason(receiver: GoPtr<filesParser>, includeProcessor: GoPtr<includeProcessor>, task: GoPtr<parseTask>, reason: GoPtr<FileIncludeReason>): void {
  if (task!.redirectedParseTask !== undefined) {
    filesParser_addIncludeReason(receiver, includeProcessor, task!.redirectedParseTask, reason);
  } else if (task!.loaded) {
    const existing = includeProcessor!.fileIncludeReasons.get(task!.path);
    if (existing !== undefined) {
      includeProcessor!.fileIncludeReasons.set(task!.path, [...existing, reason]);
    } else {
      includeProcessor!.fileIncludeReasons.set(task!.path, [reason]);
    }
  }
}
