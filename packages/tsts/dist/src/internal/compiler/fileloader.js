import { NewGoStructMap } from "../../go/compat.js";
import { Mutex, Map as SyncMapImpl } from "../../go/sync.js";
import { Int32 as Int32Impl } from "../../go/sync/atomic.js";
import * as cmp from "../../go/cmp.js";
import * as slices from "../../go/slices.js";
import * as strings from "../../go/strings.js";
import { Once as OnceImpl } from "../../go/sync.js";
import { ImportAttributesNode_GetResolutionModeOverride, Node_ModuleSpecifier, Node_Text, SourceFile_FileName, SourceFile_Imports, SourceFile_Path, SourceFile_as_ast_HasFileName, } from "../ast/ast.js";
import { GetEmitModuleFormatOfFileWorker, GetImpliedNodeFormatForEmitWorker, GetImpliedNodeFormatForFile, GetJSXImplicitImportBase, GetJSXRuntimeImport, GetSourceFileOfNode, IsExclusivelyTypeOnlyImportOrExport, IsExternalModule, IsImportCall, IsInJSFile, IsRequireCall, IsSourceFileJS, NewHasFileName, ShouldTransformImportCall, WalkUpParenthesizedExpressions, } from "../ast/utilities.js";
import { NewNodeFactory, NodeDefault_AsNode } from "../ast/spine.js";
import * as casts from "../ast/generated/casts.js";
import { IsExportDeclaration, IsImportDeclaration, IsImportEqualsDeclaration, IsExternalModuleReference, IsJSDocImportTag, IsLiteralTypeNode, IsImportTypeNode } from "../ast/generated/predicates.js";
import { KindExportDeclaration, KindImportDeclaration, KindJSImportDeclaration, KindNamedExports, KindNamedImports, KindNamespaceImport, KindStringLiteral, KindTypeKeyword } from "../ast/generated/kinds.js";
import { NodeFlagsJSDoc } from "../ast/generated/flags.js";
import { GetExternalModuleIndicatorOptions } from "../ast/parseoptions.js";
import { TokenFlagsNone } from "../ast/tokenflags.js";
import { NewImportDeclaration, NewStringLiteral } from "../ast/generated/factory.js";
import { SyncMap_Load, SyncMap_LoadOrStore } from "../collections/syncmap.js";
import { CompilerOptions_GetAllowJS, CompilerOptions_GetEmitModuleKind, CompilerOptions_GetIsolatedModules, CompilerOptions_GetModuleResolutionKind, CompilerOptions_GetResolvePackageJsonExports, CompilerOptions_GetResolvePackageJsonImports, ModuleKindCommonJS, ModuleKindESNext, ModuleKindNone, ModuleKindPreserve, ModuleKind_IsNonNodeESM, ModuleResolutionKindNode16, ModuleResolutionKindNodeNext, ResolutionModeCommonJS, ResolutionModeNone, } from "../core/compileroptions.js";
import { Tristate_IsFalseOrUnknown, Tristate_IsTrue } from "../core/tristate.js";
import { IfElse, Flatten } from "../core/core.js";
import { NewWorkGroup } from "../core/workgroup.js";
import { ScriptKindJSX, ScriptKindTS, ScriptKindTSX } from "../core/scriptkind.js";
import * as diagnostics from "../diagnostics/generated/messages.js";
import { GetAutomaticTypeDirectiveNames, GetCompilerOptionsWithRedirect, NewResolver, Resolver_ResolveModuleName, Resolver_ResolveTypeReferenceDirective, Resolver_GetPackageScopeForPath, } from "../module/resolver.js";
import { GetResolutionDiagnostic, InferredTypesContainingFile } from "../module/util.js";
import { ResolvedModuleExtensionProviderVirtual, ResolvedModule_IsResolved, ResolvedTypeReferenceDirective_IsResolved } from "../module/types.js";
import { InfoCacheEntry_Exists } from "../packagejson/cache.js";
import { Expected_GetValue } from "../packagejson/expected.js";
import { CombinePaths, DirectorySeparator, GetCanonicalFileName, GetDirectoryPath, GetNormalizedAbsolutePath, HasExtension, IsRootedDiskPath, NormalizePath, NormalizeSlashes, RemoveTrailingDirectorySeparator, ToPath, } from "../tspath/path.js";
import { FileExtensionIsOneOf, HasJSFileExtension, SupportedTSExtensionsWithJsonFlat } from "../tspath/extension.js";
import { GetDefaultLibFileName, GetLibFileName, Libs, } from "../tsoptions/enummaps.js";
import { GetSupportedExtensions, GetSupportedExtensionsWithJsonIfResolveJsonModule } from "../tsoptions/tsconfigparsing.js";
import { ParsedCommandLine_as_ResolvedProjectReference, ParsedCommandLine_CompilerOptions, ParsedCommandLine_FileNames, ParsedCommandLine_ResolvedProjectReferencePaths, } from "../tsoptions/parsedcommandline.js";
import { fileIncludeKindAutomaticTypeDirectiveFile, fileIncludeKindImport, fileIncludeKindLibFile, fileIncludeKindReferenceFile, fileIncludeKindRootFile, fileIncludeKindTypeReferenceDirective, FileIncludeReason_isReferencedFile, } from "./fileInclude.js";
import { filesParser_getProcessedFiles, filesParser_parse, parseTask_addSubTask, } from "./filesparser.js";
import { processingDiagnosticKindExplainingFileInclude, processingDiagnosticKindUnknownReference, } from "./processingDiagnostic.js";
import { projectReferenceFileMapper_getCompilerOptionsForFile, projectReferenceFileMapper_getRedirectForResolution, projectReferenceFileMapper_getRedirectParsedCommandLineForResolution, } from "./projectreferencefilemapper.js";
import { createProjectReferenceParseTasks, projectReferenceParser_parse, } from "./projectreferenceparser.js";
import { PhaseParse, PhaseProgram, Tracing_Push } from "../tracing/tracing.js";
import { ParseSourceFile } from "../parser/parser/statements-declarations.js";
import { getExtensionHost } from "../../extensions/host.js";
function fileLoader_getExtensionHost(receiver) {
    return getExtensionHost(receiver.opts);
}
function fileLoader_getProviderVirtualModule(receiver, fileName) {
    return fileLoader_getExtensionHost(receiver)?.providers.getVirtualModuleByFileName(fileName);
}
function fileLoader_resolveProviderVirtualModule(receiver, extensionHost, moduleName, containingFile, mode, importSite) {
    if (extensionHost === undefined) {
        return undefined;
    }
    const containingVirtualModule = extensionHost.providers.getVirtualModuleByFileName(containingFile);
    const directVirtualModule = containingVirtualModule === undefined
        ? undefined
        : extensionHost.providers.getVirtualModuleByFileName(moduleName);
    if (directVirtualModule !== undefined) {
        return fileLoader_createProviderVirtualResolvedModule(directVirtualModule);
    }
    const context = {
        containingFile,
        resolutionMode: mode,
        ...(extensionHost.activeTarget !== undefined ? { activeTarget: extensionHost.activeTarget } : {}),
        ...(extensionHost.activeSurface !== undefined ? { activeSurface: extensionHost.activeSurface } : {}),
        importSlice: fileLoader_getProviderImportSlice(moduleName, importSite),
    };
    if (extensionHost.providers.bindingProviders.length === 0 && extensionHost.providers.requiresProviderForModule(moduleName, context) === undefined) {
        return undefined;
    }
    const result = extensionHost.providers.resolveVirtualModule(moduleName, context);
    if (result.kind === "unowned") {
        return undefined;
    }
    if (result.kind !== "resolved") {
        return {
            ResolutionDiagnostics: [],
            ResolvedFileName: "",
            OriginalPath: "",
            Extension: "",
            ResolvedUsingTsExtension: false,
            PackageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
            IsExternalLibraryImport: false,
            AlternateResult: "",
        };
    }
    return fileLoader_createProviderVirtualResolvedModule(result.module);
}
function fileLoader_createProviderVirtualResolvedModule(module) {
    return {
        ResolutionDiagnostics: [],
        ResolvedFileName: module.resolution.virtualFileName,
        OriginalPath: "",
        Extension: ResolvedModuleExtensionProviderVirtual,
        ResolvedUsingTsExtension: false,
        PackageId: fileLoader_getProviderVirtualPackageId(module.resolution),
        IsExternalLibraryImport: true,
        AlternateResult: "",
        ProviderVirtual: {
            ProviderId: module.provider.identity.id,
            ProviderTarget: module.provider.identity.target,
            ProviderModuleId: module.resolution.providerModuleId,
            ModuleSpecifier: module.resolution.moduleSpecifier,
        },
    };
}
function fileLoader_getProviderVirtualPackageId(resolution) {
    const packageName = resolution.packageName ?? "";
    if (packageName === "") {
        return { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" };
    }
    return {
        Name: packageName,
        SubModuleName: fileLoader_getProviderVirtualSubModuleName(packageName, resolution.moduleSpecifier, resolution.virtualFileName),
        Version: resolution.packageVersion ?? "",
        PeerDependencies: "",
    };
}
function fileLoader_getProviderVirtualSubModuleName(packageName, moduleSpecifier, virtualFileName) {
    const publicSubModuleName = moduleSpecifier === packageName
        ? ""
        : strings.HasPrefix(moduleSpecifier, `${packageName}/`)
            ? moduleSpecifier.slice(`${packageName}/`.length)
            : moduleSpecifier;
    const sliceMarker = getProviderVirtualPackageSliceMarker(virtualFileName);
    if (sliceMarker !== "") {
        return `${publicSubModuleName}#${sliceMarker}`;
    }
    return publicSubModuleName;
}
function getProviderVirtualPackageSliceMarker(virtualFileName) {
    const markerIndex = virtualFileName.indexOf("#tsts-slice-");
    if (markerIndex < 0) {
        return "";
    }
    return virtualFileName.slice(markerIndex + 1);
}
function fileLoader_getProviderImportSlice(moduleSpecifier, importSite) {
    const directSlice = fileLoader_getDirectProviderImportSlice(moduleSpecifier, importSite);
    return fileLoader_composeProviderImportSlicesForSourceFile(moduleSpecifier, importSite, directSlice);
}
function fileLoader_getDirectProviderImportSlice(moduleSpecifier, importSite) {
    if (importSite === undefined) {
        return {
            moduleSpecifier,
            kind: "unknown",
            broadImport: true,
        };
    }
    const parent = importSite.Parent;
    if (parent === undefined) {
        return {
            moduleSpecifier,
            kind: "synthetic",
            broadImport: true,
        };
    }
    if (parent.Kind === KindImportDeclaration || parent.Kind === KindJSImportDeclaration) {
        const importClause = casts.AsImportDeclaration(parent)?.ImportClause;
        if (importClause === undefined) {
            return {
                moduleSpecifier,
                kind: "bare",
                broadImport: true,
            };
        }
        const importClauseData = casts.AsImportClause(importClause);
        const typeOnly = importClauseData?.PhaseModifier === KindTypeKeyword;
        const requestedExports = [];
        if (importClauseData?.name !== undefined) {
            requestedExports.push({
                exportedName: "default",
                localName: Node_Text(importClauseData.name),
                kind: getProviderImportRequestKind(typeOnly),
            });
        }
        const namedBindings = importClauseData?.NamedBindings;
        if (namedBindings?.Kind === KindNamespaceImport) {
            return {
                moduleSpecifier,
                kind: requestedExports.length > 0 ? "mixed" : "namespace",
                ...(requestedExports.length > 0 ? { requestedExports } : {}),
                broadImport: true,
                ...(typeOnly ? { typeOnly } : {}),
            };
        }
        if (namedBindings?.Kind === KindNamedImports) {
            const namedImports = casts.AsNamedImports(namedBindings);
            for (const specifier of namedImports?.Elements?.Nodes ?? []) {
                const importSpecifier = casts.AsImportSpecifier(specifier);
                if (importSpecifier === undefined || importSpecifier.name === undefined) {
                    continue;
                }
                requestedExports.push({
                    exportedName: Node_Text(importSpecifier.PropertyName ?? importSpecifier.name),
                    localName: Node_Text(importSpecifier.name),
                    kind: getProviderImportRequestKind(typeOnly || importSpecifier.IsTypeOnly),
                });
            }
        }
        return {
            moduleSpecifier,
            kind: requestedExports.length === 0 ? "unknown" : requestedExports.some((request) => request.exportedName === "default") && requestedExports.length > 1 ? "mixed" : requestedExports[0]?.exportedName === "default" ? "default" : "named",
            ...(requestedExports.length > 0 ? { requestedExports } : { broadImport: true }),
            ...(typeOnly ? { typeOnly } : {}),
        };
    }
    if (parent.Kind === KindExportDeclaration) {
        const exportDeclaration = casts.AsExportDeclaration(parent);
        const typeOnly = exportDeclaration?.IsTypeOnly === true;
        const requestedExports = [];
        const exportClause = exportDeclaration?.ExportClause;
        if (exportClause?.Kind === KindNamedExports) {
            const namedExports = casts.AsNamedExports(exportClause);
            for (const specifier of namedExports?.Elements?.Nodes ?? []) {
                const exportSpecifier = casts.AsExportSpecifier(specifier);
                if (exportSpecifier === undefined || exportSpecifier.name === undefined) {
                    continue;
                }
                requestedExports.push({
                    exportedName: Node_Text(exportSpecifier.PropertyName ?? exportSpecifier.name),
                    localName: Node_Text(exportSpecifier.name),
                    kind: getProviderImportRequestKind(typeOnly || exportSpecifier.IsTypeOnly),
                });
            }
        }
        return {
            moduleSpecifier,
            kind: "reexport",
            ...(requestedExports.length > 0 ? { requestedExports } : { broadImport: true }),
            ...(typeOnly ? { typeOnly } : {}),
        };
    }
    return {
        moduleSpecifier,
        kind: "unknown",
        broadImport: true,
    };
}
function fileLoader_composeProviderImportSlicesForSourceFile(moduleSpecifier, importSite, directSlice) {
    if (importSite === undefined || importSite.Parent === undefined) {
        return directSlice;
    }
    const sourceFile = GetSourceFileOfNode(importSite.Parent);
    const statements = sourceFile?.Statements?.Nodes ?? [];
    const matchingSlices = [];
    for (const statement of statements) {
        const statementImportSite = fileLoader_getProviderStatementImportSite(statement);
        if (statementImportSite === undefined || Node_Text(statementImportSite) !== moduleSpecifier) {
            continue;
        }
        matchingSlices.push(fileLoader_getDirectProviderImportSlice(moduleSpecifier, statementImportSite));
    }
    if (matchingSlices.length <= 1) {
        return directSlice;
    }
    return fileLoader_mergeProviderImportSlices(moduleSpecifier, matchingSlices);
}
function fileLoader_getProviderStatementImportSite(statement) {
    if (statement === undefined || (statement.Kind !== KindImportDeclaration && statement.Kind !== KindJSImportDeclaration && statement.Kind !== KindExportDeclaration)) {
        return undefined;
    }
    const moduleSpecifier = Node_ModuleSpecifier(statement);
    if (moduleSpecifier?.Kind !== KindStringLiteral) {
        return undefined;
    }
    return moduleSpecifier;
}
function fileLoader_mergeProviderImportSlices(moduleSpecifier, slicesToMerge) {
    const requestedExportsByKey = new globalThis.Map();
    let hasBroadImport = false;
    let allTypeOnly = true;
    let hasDefaultRequest = false;
    let hasReexportRequest = false;
    const sliceKinds = new globalThis.Set();
    for (const slice of slicesToMerge) {
        sliceKinds.add(slice.kind);
        hasBroadImport ||= slice.broadImport === true;
        allTypeOnly &&= slice.typeOnly === true;
        hasReexportRequest ||= slice.kind === "reexport";
        for (const requestedExport of slice.requestedExports ?? []) {
            const key = requestedExport.exportedName;
            requestedExportsByKey.set(key, mergeProviderRequestedExport(requestedExportsByKey.get(key), requestedExport));
            hasDefaultRequest ||= requestedExport.exportedName === "default";
        }
    }
    const requestedExports = [...requestedExportsByKey.values()];
    const kind = hasBroadImport
        ? requestedExports.length > 0 ? "mixed" : "namespace"
        : sliceKinds.size > 1
            ? "mixed"
            : hasReexportRequest
                ? "reexport"
                : hasDefaultRequest
                    ? requestedExports.length > 1 ? "mixed" : "default"
                    : requestedExports.length > 0 ? "named" : "unknown";
    return {
        moduleSpecifier,
        kind,
        ...(requestedExports.length > 0 ? { requestedExports } : {}),
        ...(hasBroadImport || requestedExports.length === 0 ? { broadImport: true } : {}),
        ...(allTypeOnly ? { typeOnly: true } : {}),
    };
}
function getProviderImportRequestKind(typeOnly) {
    return typeOnly ? "type" : "value";
}
function mergeProviderRequestedExport(existing, incoming) {
    if (existing === undefined) {
        return {
            exportedName: incoming.exportedName,
            ...(incoming.kind !== undefined ? { kind: incoming.kind } : {}),
        };
    }
    return {
        exportedName: existing.exportedName,
        kind: mergeProviderImportRequestKind(existing.kind, incoming.kind),
    };
}
function mergeProviderImportRequestKind(left, right) {
    if (left === "unknown" || right === "unknown") {
        return "unknown";
    }
    if (left === "value" || right === "value") {
        return "value";
    }
    return "type";
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"8284e921f9f925885aeaa798132fe24f86ec0403613b3a5953059d91a14dc916"}
 *
 * Go source:
 * var _ ast.HasFileName = (*redirectsFile)(nil)
 */
export let __386f9302_0 = redirectsFile_as_ast_HasFileName(undefined);
export function redirectsFile_as_ast_HasFileName(receiver) {
    return {
        FileName: () => redirectsFile_FileName(receiver),
        Path: () => redirectsFile_Path(receiver),
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::redirectsFile.FileName","kind":"method","status":"implemented","sigHash":"75f16d7260cdae7adab9134a6e3293c46bcac545ff2222df21ccd9a2b326c537","bodyHash":"6a52ade887033bafb1496dc973e98f22ed49ea433c3596388a9bf86f248c4787"}
 *
 * Go source:
 * func (r *redirectsFile) FileName() string {
 * 	return r.fileName
 * }
 */
export function redirectsFile_FileName(receiver) {
    return receiver.fileName;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::redirectsFile.Path","kind":"method","status":"implemented","sigHash":"a588537cee38b3b1c288ccd68de3e13cc03d3aeb06497b65de4fdf568c6490be","bodyHash":"1d9ab312206e9214fe42e3378a0abe52e9f63cbb33ccf36ea530daa80cc7583f"}
 *
 * Go source:
 * func (r *redirectsFile) Path() tspath.Path {
 * 	return r.path
 * }
 */
export function redirectsFile_Path(receiver) {
    return receiver.path;
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
export function processAllProgramFiles(opts, singleThreaded) {
    const compilerOptions = ParsedCommandLine_CompilerOptions(opts.Config);
    const rootFiles = ParsedCommandLine_FileNames(opts.Config);
    const supportedExtensions = GetSupportedExtensions(compilerOptions, []);
    const supportedExtensionsWithJsonIfResolveJsonModule = GetSupportedExtensionsWithJsonIfResolveJsonModule(compilerOptions, supportedExtensions);
    let maxNodeModuleJsDepth = 0;
    if (compilerOptions.MaxNodeModuleJsDepth !== undefined) {
        maxNodeModuleJsDepth = compilerOptions.MaxNodeModuleJsDepth;
    }
    const loader = {
        opts: opts,
        resolver: undefined,
        defaultLibraryPath: GetNormalizedAbsolutePath(opts.Host.DefaultLibraryPath(), opts.Host.GetCurrentDirectory()),
        comparePathsOptions: {
            UseCaseSensitiveFileNames: opts.Host.FS().UseCaseSensitiveFileNames(),
            CurrentDirectory: opts.Host.GetCurrentDirectory(),
        },
        filesParser: {
            wg: NewWorkGroup(singleThreaded),
            taskDataByPath: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() },
            maxDepth: maxNodeModuleJsDepth,
        },
        rootTasks: [],
        totalFileCount: new Int32Impl(),
        libFileCount: new Int32Impl(),
        factoryMu: new Mutex(),
        factory: NewNodeFactory({}),
        projectReferenceFileMapper: undefined,
        dtsDirectories: { M: new globalThis.Map() },
        pathForLibFileCache: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() },
        pathForLibFileResolutions: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() },
        supportedExtensions: supportedExtensions,
        supportedExtensionsWithJsonIfResolveJsonModule: supportedExtensionsWithJsonIfResolveJsonModule,
    };
    fileLoader_addProjectReferenceTasks(loader, singleThreaded);
    loader.resolver = NewResolver(loader.projectReferenceFileMapper.host, compilerOptions, opts.TypingsLocation ?? "", opts.ProjectName ?? "");
    let traceDone;
    if (opts.Tracing !== undefined) {
        traceDone = Tracing_Push(opts.Tracing, PhaseProgram, "processRootFiles", new globalThis.Map([["count", rootFiles.length]]), false);
    }
    try {
        for (let index = 0; index < rootFiles.length; index++) {
            const rootFile = rootFiles[index];
            fileLoader_addRootFileTask(loader, rootFile, undefined, {
                kind: fileIncludeKindRootFile,
                data: index,
                relativeFileNameDiag: undefined,
                relativeFileNameDiagOnce: new OnceImpl(),
                diag: undefined,
                diagOnce: new OnceImpl(),
            });
        }
        if (rootFiles.length > 0 && Tristate_IsFalseOrUnknown(compilerOptions.NoLib)) {
            if (compilerOptions.Lib === undefined) {
                const name = GetDefaultLibFileName(compilerOptions);
                const libFile = fileLoader_pathForLibFile(loader, name);
                fileLoader_addRootTask(loader, libFile.path, libFile, {
                    kind: fileIncludeKindLibFile,
                    data: undefined,
                    relativeFileNameDiag: undefined,
                    relativeFileNameDiagOnce: new OnceImpl(),
                    diag: undefined,
                    diagOnce: new OnceImpl(),
                });
            }
            else {
                for (let index = 0; index < compilerOptions.Lib.length; index++) {
                    const lib = compilerOptions.Lib[index];
                    const [name, ok] = GetLibFileName(lib);
                    if (ok) {
                        const libFile = fileLoader_pathForLibFile(loader, name);
                        fileLoader_addRootTask(loader, libFile.path, libFile, {
                            kind: fileIncludeKindLibFile,
                            data: index,
                            relativeFileNameDiag: undefined,
                            relativeFileNameDiagOnce: new OnceImpl(),
                            diag: undefined,
                            diagOnce: new OnceImpl(),
                        });
                    }
                    // !!! error on unknown name
                }
            }
        }
        if (rootFiles.length > 0) {
            fileLoader_addAutomaticTypeDirectiveTasks(loader);
        }
        filesParser_parse(loader.filesParser, loader, loader.rootTasks);
        // Clear out loader and host to ensure its not used post program creation
        loader.projectReferenceFileMapper.loader = undefined;
        loader.projectReferenceFileMapper.host = undefined;
        return filesParser_getProcessedFiles(loader.filesParser, loader);
    }
    finally {
        if (traceDone !== undefined) {
            traceDone();
        }
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::method::fileLoader.toPath","kind":"method","status":"implemented","sigHash":"7c9074c3d28cdd4479feef6e1fe40c3c70ab3d0918765a966f719f08949747b4","bodyHash":"9631877cd97a7240a54e42cc55ab4571dacc24837ef8312c29601a72cbf4dd28"}
 *
 * Go source:
 * func (p *fileLoader) toPath(file string) tspath.Path {
 * 	return tspath.ToPath(file, p.opts.Host.GetCurrentDirectory(), p.opts.Host.FS().UseCaseSensitiveFileNames())
 * }
 */
export function fileLoader_toPath(receiver, file) {
    return ToPath(file, receiver.opts.Host.GetCurrentDirectory(), receiver.opts.Host.FS().UseCaseSensitiveFileNames());
}
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
export function fileLoader_addRootTask(receiver, fileName, libFile, includeReason) {
    const absPath = GetNormalizedAbsolutePath(fileName, receiver.opts.Host.GetCurrentDirectory());
    if (Tristate_IsTrue(ParsedCommandLine_CompilerOptions(receiver.opts.Config).AllowNonTsExtensions) || HasExtension(absPath)) {
        receiver.rootTasks.push({
            normalizedFilePath: absPath,
            path: "",
            file: undefined,
            libFile,
            redirectedParseTask: undefined,
            subTasks: [],
            loaded: false,
            startedSubTasks: false,
            isForAutomaticTypeDirective: false,
            includeReason,
            packageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
            metadata: {},
            resolutionsInFile: undefined,
            resolutionsTrace: [],
            typeResolutionsInFile: undefined,
            typeResolutionsTrace: [],
            resolutionDiagnostics: [],
            processingDiagnostics: [],
            importHelpersImportSpecifier: undefined,
            jsxRuntimeImportSpecifier: undefined,
            increaseDepth: false,
            elideOnDepth: false,
            loadedTask: undefined,
            allIncludeReasons: [],
        });
    }
}
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
export function fileLoader_addRootFileTask(receiver, fileName, libFile, includeReason) {
    const currDir = receiver.opts.Host.GetCurrentDirectory();
    const absPath = GetNormalizedAbsolutePath(fileName, currDir);
    let containingFile = currDir;
    if (receiver.opts.Config.ConfigFile !== undefined) {
        containingFile = GetNormalizedAbsolutePath(SourceFile_FileName(receiver.opts.Config.ConfigFile.SourceFile), currDir);
    }
    const [resolvedFile, diagnostic] = fileLoader_getSourceFileFromReference(receiver, absPath, fileName, containingFile, includeReason);
    const rootTask = {
        normalizedFilePath: resolvedFile,
        path: "",
        file: undefined,
        libFile,
        redirectedParseTask: undefined,
        subTasks: [],
        loaded: false,
        startedSubTasks: false,
        isForAutomaticTypeDirective: false,
        includeReason,
        packageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
        metadata: {},
        resolutionsInFile: undefined,
        resolutionsTrace: [],
        typeResolutionsInFile: undefined,
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
    if (diagnostic !== undefined) {
        rootTask.normalizedFilePath = absPath;
        rootTask.processingDiagnostics = [{
                kind: processingDiagnosticKindExplainingFileInclude,
                data: {
                    diagnosticReason: includeReason,
                    message: diagnostic.message,
                    args: diagnostic.args,
                },
            }];
    }
    receiver.rootTasks.push(rootTask);
}
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
export function fileLoader_addAutomaticTypeDirectiveTasks(receiver) {
    let containingDirectory;
    const compilerOptions = ParsedCommandLine_CompilerOptions(receiver.opts.Config);
    if (compilerOptions.ConfigFilePath !== "") {
        containingDirectory = GetDirectoryPath(compilerOptions.ConfigFilePath);
    }
    else {
        containingDirectory = receiver.opts.Host.GetCurrentDirectory();
    }
    const containingFileName = CombinePaths(containingDirectory, InferredTypesContainingFile);
    receiver.rootTasks.push({
        normalizedFilePath: containingFileName,
        path: "",
        file: undefined,
        libFile: undefined,
        redirectedParseTask: undefined,
        subTasks: [],
        loaded: false,
        startedSubTasks: false,
        isForAutomaticTypeDirective: true,
        includeReason: undefined,
        packageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" },
        metadata: {},
        resolutionsInFile: undefined,
        resolutionsTrace: [],
        typeResolutionsInFile: undefined,
        typeResolutionsTrace: [],
        resolutionDiagnostics: [],
        processingDiagnostics: [],
        importHelpersImportSpecifier: undefined,
        jsxRuntimeImportSpecifier: undefined,
        increaseDepth: false,
        elideOnDepth: false,
        loadedTask: undefined,
        allIncludeReasons: [],
    });
}
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
export function fileLoader_resolveAutomaticTypeDirectives(receiver, containingFileName) {
    const automaticTypeDirectiveNames = GetAutomaticTypeDirectiveNames(ParsedCommandLine_CompilerOptions(receiver.opts.Config), receiver.opts.Host);
    if (automaticTypeDirectiveNames.length !== 0) {
        let toParse = [];
        const typeResolutionsInFile = NewGoStructMap();
        let typeResolutionsTrace = [];
        let pDiagnostics = [];
        for (const name of automaticTypeDirectiveNames) {
            // Under node16/nodenext module resolution, load `types`/ata include names as cjs resolution results by passing an `undefined` mode.
            // Under bundler module resolution, this also triggers the "import" condition to be used.
            const resolutionMode = ResolutionModeNone;
            const [resolved, trace] = Resolver_ResolveTypeReferenceDirective(receiver.resolver, name, containingFileName, resolutionMode, undefined);
            let traceDone;
            if (receiver.opts.Tracing !== undefined) {
                traceDone = Tracing_Push(receiver.opts.Tracing, PhaseProgram, "processTypeReferenceDirective", new globalThis.Map([["directive", name], ["hasResolved", ResolvedTypeReferenceDirective_IsResolved(resolved)], ["refKind", fileIncludeKindAutomaticTypeDirectiveFile]]), false);
            }
            typeResolutionsInFile.set({ Name: name, Mode: resolutionMode }, resolved);
            typeResolutionsTrace = [...typeResolutionsTrace, ...trace];
            if (ResolvedTypeReferenceDirective_IsResolved(resolved)) {
                toParse = [...toParse, {
                        fileName: resolved.ResolvedFileName,
                        increaseDepth: resolved.IsExternalLibraryImport,
                        elideOnDepth: false,
                        includeReason: {
                            kind: fileIncludeKindAutomaticTypeDirectiveFile,
                            data: { typeReference: name, packageId: resolved.PackageId },
                            relativeFileNameDiag: undefined,
                            relativeFileNameDiagOnce: new OnceImpl(),
                            diag: undefined,
                            diagOnce: new OnceImpl(),
                        },
                        packageId: resolved.PackageId,
                    }];
            }
            else {
                pDiagnostics = [...pDiagnostics, {
                        kind: processingDiagnosticKindExplainingFileInclude,
                        data: {
                            diagnosticReason: {
                                kind: fileIncludeKindAutomaticTypeDirectiveFile,
                                data: { typeReference: name, packageId: { Name: "", SubModuleName: "", Version: "", PeerDependencies: "" } },
                                relativeFileNameDiag: undefined,
                                relativeFileNameDiagOnce: new OnceImpl(),
                                diag: undefined,
                                diagOnce: new OnceImpl(),
                            },
                            message: diagnostics.Cannot_find_type_definition_file_for_0,
                            args: [name],
                        },
                    }];
            }
            if (traceDone !== undefined) {
                traceDone();
            }
        }
        return [toParse, typeResolutionsInFile, typeResolutionsTrace, pDiagnostics];
    }
    return [[], undefined, [], []];
}
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
export function fileLoader_addProjectReferenceTasks(receiver, singleThreaded) {
    receiver.projectReferenceFileMapper = {
        opts: receiver.opts,
        host: receiver.opts.Host,
        configToProjectReference: new globalThis.Map(),
        referencesInConfigFile: new globalThis.Map(),
        sourceToProjectReference: new globalThis.Map(),
        outputDtsToProjectReference: new globalThis.Map(),
        realpathDtsToSource: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncMapImpl() },
    };
    const projectReferences = ParsedCommandLine_ResolvedProjectReferencePaths(receiver.opts.Config);
    if (projectReferences.length === 0) {
        return;
    }
    const parser = {
        loader: receiver,
        wg: NewWorkGroup(singleThreaded),
    };
    const rootTasks = createProjectReferenceParseTasks(projectReferences);
    projectReferenceParser_parse(parser, rootTasks);
}
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
export function fileLoader_sortLibs(receiver, libFiles) {
    slices.SortFunc(libFiles, (f1, f2) => {
        return cmp.Compare(fileLoader_getDefaultLibFilePriority(receiver, f1), fileLoader_getDefaultLibFilePriority(receiver, f2));
    });
}
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
export function fileLoader_getDefaultLibFilePriority(receiver, a) {
    const defaultLibraryPath = RemoveTrailingDirectorySeparator(receiver.defaultLibraryPath);
    const aFileName = SourceFile_FileName(a);
    if (strings.HasPrefix(aFileName, defaultLibraryPath) && aFileName.length > defaultLibraryPath.length && aFileName.charCodeAt(defaultLibraryPath.length) === DirectorySeparator) {
        const basename = aFileName.slice(strings.LastIndexByte(aFileName, DirectorySeparator) + 1);
        if (basename === "lib.d.ts" || basename === "lib.es6.d.ts") {
            return 0;
        }
        const name = strings.TrimSuffix(strings.TrimPrefix(basename, "lib."), ".d.ts");
        const index = slices.Index(Libs, name);
        if (index !== -1) {
            return index + 1;
        }
    }
    return Libs.length + 2;
}
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
export function fileLoader_loadSourceFileMetaData(receiver, fileName) {
    if (fileLoader_getProviderVirtualModule(receiver, fileName) !== undefined) {
        return {
            PackageJsonType: "",
            PackageJsonDirectory: "",
            ImpliedNodeFormat: ResolutionModeCommonJS,
        };
    }
    const packageJsonScope = Resolver_GetPackageScopeForPath(receiver.resolver, GetDirectoryPath(fileName));
    const moduleResolutionKind = CompilerOptions_GetModuleResolutionKind(ParsedCommandLine_CompilerOptions(receiver.opts.Config));
    let packageJsonType = "";
    let packageJsonDirectory = "";
    if (InfoCacheEntry_Exists(packageJsonScope)) {
        packageJsonDirectory = packageJsonScope.PackageDirectory;
        const contentsFields = packageJsonScope.Contents.__tsgoEmbedded0;
        const headerFields = contentsFields?.__tsgoEmbedded0;
        const [value, ok] = Expected_GetValue(headerFields?.Type);
        if (ok) {
            if (!FileExtensionIsOneOf(fileName, [".mts", ".cts", ".mjs", ".cjs"]) &&
                ModuleResolutionKindNode16 <= moduleResolutionKind && moduleResolutionKind <= ModuleResolutionKindNodeNext || strings.Contains(fileName, "/node_modules/")) {
                packageJsonType = value;
            }
        }
    }
    const impliedNodeFormat = GetImpliedNodeFormatForFile(fileName, packageJsonType);
    return {
        PackageJsonType: packageJsonType,
        PackageJsonDirectory: packageJsonDirectory,
        ImpliedNodeFormat: impliedNodeFormat,
    };
}
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
export function fileLoader_parseSourceFile(receiver, t) {
    let traceDone;
    if (receiver.opts.Tracing !== undefined) {
        traceDone = Tracing_Push(receiver.opts.Tracing, PhaseParse, "createSourceFile", new globalThis.Map([["path", t.normalizedFilePath]]), true);
    }
    try {
        const path = fileLoader_toPath(receiver, t.normalizedFilePath);
        const options = projectReferenceFileMapper_getCompilerOptionsForFile(receiver.projectReferenceFileMapper, NewHasFileName(t.normalizedFilePath, path));
        const providerVirtualModule = fileLoader_getProviderVirtualModule(receiver, t.normalizedFilePath);
        if (providerVirtualModule !== undefined) {
            return ParseSourceFile({
                FileName: t.normalizedFilePath,
                Path: path,
                ExternalModuleIndicatorOptions: GetExternalModuleIndicatorOptions(t.normalizedFilePath, options, t.metadata),
            }, providerVirtualModule.virtualSourceText, ScriptKindTS);
        }
        const sourceFile = receiver.opts.Host.GetSourceFile({
            FileName: t.normalizedFilePath,
            Path: path,
            ExternalModuleIndicatorOptions: GetExternalModuleIndicatorOptions(t.normalizedFilePath, options, t.metadata),
        });
        return sourceFile;
    }
    finally {
        if (traceDone !== undefined) {
            traceDone();
        }
    }
}
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
export function fileLoader_isSupportedExtension(receiver, canonicalFileName) {
    for (const group of receiver.supportedExtensionsWithJsonIfResolveJsonModule) {
        if (FileExtensionIsOneOf(canonicalFileName, group)) {
            return true;
        }
    }
    return false;
}
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
export function fileLoader_getSourceFileFromReference(receiver, fileName, referenceText, containingFile, includeReason) {
    const options = ParsedCommandLine_CompilerOptions(receiver.opts.Config);
    const allowNonTsExtensions = Tristate_IsTrue(options.AllowNonTsExtensions);
    const diagnosticFileName = NormalizeSlashes(referenceText);
    if (HasExtension(fileName)) {
        const canonicalFileName = GetCanonicalFileName(fileName, receiver.opts.Host.FS().UseCaseSensitiveFileNames());
        if (!allowNonTsExtensions && !fileLoader_isSupportedExtension(receiver, canonicalFileName)) {
            if (HasJSFileExtension(canonicalFileName)) {
                return ["", { message: diagnostics.File_0_is_a_JavaScript_file_Did_you_mean_to_enable_the_allowJs_option, args: [diagnosticFileName] }];
            }
            return ["", { message: diagnostics.File_0_has_an_unsupported_extension_The_only_supported_extensions_are_1, args: [diagnosticFileName, "'" + strings.Join(Flatten(receiver.supportedExtensions), "', '") + "'"] }];
        }
        if (!receiver.opts.Host.FS().FileExists(fileName)) {
            return ["", { message: diagnostics.File_0_not_found, args: [diagnosticFileName] }];
        }
        if (FileIncludeReason_isReferencedFile(includeReason) && GetCanonicalFileName(containingFile, receiver.opts.Host.FS().UseCaseSensitiveFileNames()) === canonicalFileName) {
            return ["", { message: diagnostics.A_file_cannot_have_a_reference_to_itself, args: [] }];
        }
        return [fileName, undefined];
    }
    if (allowNonTsExtensions && receiver.opts.Host.FS().FileExists(fileName)) {
        return [fileName, undefined];
    }
    if (allowNonTsExtensions) {
        return ["", { message: diagnostics.File_0_not_found, args: [diagnosticFileName] }];
    }
    for (const ext of receiver.supportedExtensions[0]) {
        const candidate = fileName + ext;
        if (receiver.opts.Host.FS().FileExists(candidate)) {
            return [candidate, undefined];
        }
    }
    return ["", { message: diagnostics.Could_not_resolve_the_path_0_with_the_extensions_Colon_1, args: [diagnosticFileName, "'" + strings.Join(Flatten(receiver.supportedExtensions), "', '") + "'"] }];
}
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
export function fileLoader_resolveTripleslashPathReference(receiver, moduleName, containingFile, index) {
    const basePath = GetDirectoryPath(containingFile);
    let referencedFileName = moduleName;
    if (!IsRootedDiskPath(moduleName)) {
        referencedFileName = CombinePaths(basePath, moduleName);
    }
    const normalizedFileName = NormalizePath(referencedFileName);
    const includeReason = {
        kind: fileIncludeKindReferenceFile,
        data: {
            file: fileLoader_toPath(receiver, containingFile),
            index,
        },
        relativeFileNameDiag: undefined,
        relativeFileNameDiagOnce: new OnceImpl(),
        diag: undefined,
        diagOnce: new OnceImpl(),
    };
    const [resolvedFileName, diagnostic] = fileLoader_getSourceFileFromReference(receiver, normalizedFileName, moduleName, containingFile, includeReason);
    if (diagnostic !== undefined) {
        return [undefined, {
                kind: processingDiagnosticKindExplainingFileInclude,
                data: {
                    diagnosticReason: includeReason,
                    message: diagnostic.message,
                    args: diagnostic.args,
                },
            }];
    }
    return [{
            fileName: resolvedFileName,
            includeReason,
        }, undefined];
}
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
export function fileLoader_resolveTypeReferenceDirectives(receiver, t) {
    const file = t.file;
    if (file.TypeReferenceDirectives.length === 0) {
        return;
    }
    let traceDone;
    if (receiver.opts.Tracing !== undefined) {
        traceDone = Tracing_Push(receiver.opts.Tracing, PhaseProgram, "resolveTypeReferenceDirectiveNamesWorker", new globalThis.Map([["containingFileName", SourceFile_FileName(file)]]), false);
    }
    try {
        const meta = t.metadata;
        const typeResolutionsInFile = NewGoStructMap();
        let typeResolutionsTrace = [];
        for (let index = 0; index < file.TypeReferenceDirectives.length; index++) {
            const ref = file.TypeReferenceDirectives[index];
            const [redirect, fileName] = projectReferenceFileMapper_getRedirectForResolution(receiver.projectReferenceFileMapper, SourceFile_as_ast_HasFileName(file));
            const redirectedReference = redirect !== undefined ? ParsedCommandLine_as_ResolvedProjectReference(redirect) : undefined;
            const resolutionMode = getModeForTypeReferenceDirectiveInFile(ref, file, meta, GetCompilerOptionsWithRedirect(ParsedCommandLine_CompilerOptions(receiver.opts.Config), redirectedReference));
            const [resolved, trace] = Resolver_ResolveTypeReferenceDirective(receiver.resolver, ref.FileName, fileName, resolutionMode, redirectedReference);
            let innerTraceDone;
            if (receiver.opts.Tracing !== undefined) {
                innerTraceDone = Tracing_Push(receiver.opts.Tracing, PhaseProgram, "processTypeReferenceDirective", new globalThis.Map([["directive", ref.FileName], ["hasResolved", ResolvedTypeReferenceDirective_IsResolved(resolved)], ["refKind", fileIncludeKindTypeReferenceDirective], ["refPath", t.path]]), false);
            }
            typeResolutionsInFile.set({ Name: ref.FileName, Mode: resolutionMode }, resolved);
            const includeReason = {
                kind: fileIncludeKindTypeReferenceDirective,
                data: {
                    file: t.path,
                    index: index,
                    synthetic: undefined,
                },
                relativeFileNameDiag: undefined,
                relativeFileNameDiagOnce: new OnceImpl(),
                diag: undefined,
                diagOnce: new OnceImpl(),
            };
            typeResolutionsTrace = [...typeResolutionsTrace, ...trace];
            if (ResolvedTypeReferenceDirective_IsResolved(resolved)) {
                parseTask_addSubTask(t, {
                    fileName: resolved.ResolvedFileName,
                    increaseDepth: resolved.IsExternalLibraryImport,
                    elideOnDepth: false,
                    includeReason: includeReason,
                    packageId: resolved.PackageId,
                }, undefined);
            }
            else {
                t.processingDiagnostics = [...t.processingDiagnostics, {
                        kind: processingDiagnosticKindUnknownReference,
                        data: includeReason,
                    }];
            }
            if (innerTraceDone !== undefined) {
                innerTraceDone();
            }
        }
        t.typeResolutionsInFile = typeResolutionsInFile;
        t.typeResolutionsTrace = typeResolutionsTrace;
    }
    finally {
        if (traceDone !== undefined) {
            traceDone();
        }
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileloader.go::constGroup::externalHelpersModuleNameText","kind":"constGroup","status":"implemented","sigHash":"42b8d30f6cec123c960fc65215bb7957d60e1e2100a713e6f60422dd65ee175e","bodyHash":"9598756e07f54fbbeeb49a14467ace04549a5c8108fe4f60b889da06a509b940"}
 *
 * Go source:
 * const externalHelpersModuleNameText = "tslib"
 */
export const externalHelpersModuleNameText = "tslib";
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
export function fileLoader_resolveImportsAndModuleAugmentations(receiver, t) {
    let traceDone;
    if (receiver.opts.Tracing !== undefined) {
        traceDone = Tracing_Push(receiver.opts.Tracing, PhaseProgram, "resolveModuleNamesWorker", new globalThis.Map([["containingFileName", SourceFile_FileName(t.file)]]), false);
    }
    try {
        const file = t.file;
        const meta = t.metadata;
        const moduleNames = [];
        const isJavaScriptFile = IsSourceFileJS(file);
        const isExternalModuleFile = IsExternalModule(file);
        const [redirect, fileName] = projectReferenceFileMapper_getRedirectForResolution(receiver.projectReferenceFileMapper, SourceFile_as_ast_HasFileName(file));
        const optionsForFile = GetCompilerOptionsWithRedirect(ParsedCommandLine_CompilerOptions(receiver.opts.Config), redirect !== undefined ? ParsedCommandLine_as_ResolvedProjectReference(redirect) : undefined);
        if (isJavaScriptFile || (!file.IsDeclarationFile && (CompilerOptions_GetIsolatedModules(optionsForFile) || isExternalModuleFile))) {
            if (Tristate_IsTrue(optionsForFile.ImportHelpers)) {
                const specifier = fileLoader_createSyntheticImport(receiver, externalHelpersModuleNameText, file);
                moduleNames.push(specifier);
                t.importHelpersImportSpecifier = specifier;
            }
        }
        if (file.ScriptKind === ScriptKindJSX || file.ScriptKind === ScriptKindTSX) {
            const jsxImport = GetJSXRuntimeImport(GetJSXImplicitImportBase(optionsForFile, file), optionsForFile);
            if (jsxImport !== "") {
                const specifier = fileLoader_createSyntheticImport(receiver, jsxImport, file);
                moduleNames.push(specifier);
                t.jsxRuntimeImportSpecifier = {
                    moduleReference: jsxImport,
                    specifier: specifier,
                };
            }
        }
        const importsStart = moduleNames.length;
        const fileImports = SourceFile_Imports(file) ?? [];
        for (const imp of fileImports) {
            moduleNames.push(imp);
        }
        for (const imp of file.ModuleAugmentations ?? []) {
            if (imp.Kind === KindStringLiteral) {
                moduleNames.push(imp);
            }
            // Do nothing if it's an Identifier; we don't need to do module resolution for `declare global`.
        }
        if (moduleNames.length !== 0) {
            const resolutionsInFile = NewGoStructMap();
            let resolutionsTrace = [];
            const extensionHost = fileLoader_getExtensionHost(receiver);
            for (let index = 0; index < moduleNames.length; index++) {
                const entry = moduleNames[index];
                const moduleName = Node_Text(entry);
                if (moduleName === "") {
                    continue;
                }
                const mode = getModeForUsageLocation(SourceFile_FileName(file), meta, entry, optionsForFile);
                const redirectedReference = redirect !== undefined ? ParsedCommandLine_as_ResolvedProjectReference(redirect) : undefined;
                let trace = [];
                let resolvedModule = fileLoader_resolveProviderVirtualModule(receiver, extensionHost, moduleName, fileName, mode, entry);
                if (resolvedModule === undefined) {
                    [resolvedModule, trace] = Resolver_ResolveModuleName(receiver.resolver, moduleName, fileName, mode, redirectedReference);
                }
                resolutionsInFile.set({ Name: moduleName, Mode: mode }, resolvedModule);
                resolutionsTrace = [...resolutionsTrace, ...trace];
                if (!ResolvedModule_IsResolved(resolvedModule)) {
                    continue;
                }
                const resolvedFileName = resolvedModule.ResolvedFileName;
                const isFromNodeModulesSearch = resolvedModule.IsExternalLibraryImport;
                const isProviderVirtualFile = fileLoader_getProviderVirtualModule(receiver, resolvedFileName) !== undefined;
                // Don't treat redirected files as JS files.
                const isJsFile = !isProviderVirtualFile && !FileExtensionIsOneOf(resolvedFileName, SupportedTSExtensionsWithJsonFlat) && projectReferenceFileMapper_getRedirectParsedCommandLineForResolution(receiver.projectReferenceFileMapper, NewHasFileName(resolvedFileName, fileLoader_toPath(receiver, resolvedFileName))) === undefined;
                const isJsFileFromNodeModules = isFromNodeModulesSearch && isJsFile && strings.Contains(resolvedFileName, "/node_modules/");
                // add file to program only if:
                // - resolution was successful
                // - noResolve is falsy
                // - module name comes from the list of imports
                // - it's not a top level JavaScript module that exceeded the search max
                const importIndex = index - importsStart;
                const shouldAddFile = moduleName !== "" &&
                    GetResolutionDiagnostic(optionsForFile, resolvedModule, file) === undefined &&
                    !Tristate_IsTrue(optionsForFile.NoResolve) &&
                    !(isJsFile && !CompilerOptions_GetAllowJS(optionsForFile)) &&
                    (importIndex < 0 || (importIndex < fileImports.length && (IsInJSFile(fileImports[importIndex]) || (fileImports[importIndex].Flags & NodeFlagsJSDoc) === 0)));
                if (shouldAddFile) {
                    parseTask_addSubTask(t, {
                        fileName: resolvedFileName,
                        increaseDepth: resolvedModule.IsExternalLibraryImport,
                        elideOnDepth: isJsFileFromNodeModules,
                        includeReason: {
                            kind: fileIncludeKindImport,
                            data: {
                                file: t.path,
                                index: importIndex,
                                synthetic: IfElse(importIndex < 0, entry, undefined),
                            },
                            relativeFileNameDiag: undefined,
                            relativeFileNameDiagOnce: new OnceImpl(),
                            diag: undefined,
                            diagOnce: new OnceImpl(),
                        },
                        packageId: resolvedModule.PackageId,
                    }, undefined);
                }
            }
            t.resolutionsInFile = resolutionsInFile;
            t.resolutionsTrace = resolutionsTrace;
        }
    }
    finally {
        if (traceDone !== undefined) {
            traceDone();
        }
    }
}
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
export function fileLoader_createSyntheticImport(receiver, text, file) {
    const factory = receiver.factory;
    const externalHelpersModuleReference = NewStringLiteral(factory, text, TokenFlagsNone);
    const importDecl = NewImportDeclaration(factory, undefined, undefined, externalHelpersModuleReference, undefined);
    externalHelpersModuleReference.Parent = importDecl;
    importDecl.Parent = NodeDefault_AsNode(file);
    return externalHelpersModuleReference;
}
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
export function fileLoader_pathForLibFile(receiver, name) {
    const [cached, ok] = SyncMap_Load(receiver.pathForLibFileCache, name);
    if (ok) {
        return cached;
    }
    let path = CombinePaths(receiver.defaultLibraryPath, name);
    let replaced = false;
    if (Tristate_IsTrue(ParsedCommandLine_CompilerOptions(receiver.opts.Config).LibReplacement) && name !== "lib.d.ts") {
        const libraryName = getLibraryNameFromLibFileName(name);
        const resolveFrom = getInferredLibraryNameResolveFrom(ParsedCommandLine_CompilerOptions(receiver.opts.Config), receiver.opts.Host.GetCurrentDirectory(), name);
        const [resolution, trace] = fileLoader_resolveLibrary(receiver, libraryName, resolveFrom);
        if (ResolvedModule_IsResolved(resolution)) {
            path = resolution.ResolvedFileName;
            replaced = true;
        }
        SyncMap_LoadOrStore(receiver.pathForLibFileResolutions, fileLoader_toPath(receiver, resolveFrom), { libraryName, resolution, trace });
    }
    const [libPath] = SyncMap_LoadOrStore(receiver.pathForLibFileCache, name, { Name: name, path, Replaced: replaced });
    return libPath;
}
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
export function fileLoader_resolveLibrary(receiver, libraryName, resolveFrom) {
    let traceDone;
    if (receiver.opts.Tracing !== undefined) {
        traceDone = Tracing_Push(receiver.opts.Tracing, PhaseProgram, "resolveLibrary", new globalThis.Map([["resolveFrom", resolveFrom]]), false);
    }
    try {
        return Resolver_ResolveModuleName(receiver.resolver, libraryName, resolveFrom, ModuleKindCommonJS, undefined);
    }
    finally {
        if (traceDone !== undefined) {
            traceDone();
        }
    }
}
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
export function getLibraryNameFromLibFileName(libFileName) {
    const components = strings.Split(libFileName, ".");
    let path = "@typescript/lib-";
    if (components.length > 1) {
        path += components[1];
    }
    let i = 2;
    while (i < components.length && components[i] !== "" && components[i] !== "d") {
        if (i === 2) {
            path += "/";
        }
        else {
            path += "-";
        }
        path += components[i];
        i++;
    }
    return path;
}
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
export function getInferredLibraryNameResolveFrom(options, currentDirectory, libFileName) {
    let containingDirectory;
    if (options.ConfigFilePath !== "") {
        containingDirectory = GetDirectoryPath(options.ConfigFilePath);
    }
    else {
        containingDirectory = currentDirectory;
    }
    return CombinePaths(containingDirectory, "__lib_node_modules_lookup_" + libFileName + "__.ts");
}
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
export function getModeForTypeReferenceDirectiveInFile(ref, file, meta, options) {
    if (ref.ResolutionMode !== ResolutionModeNone) {
        return ref.ResolutionMode;
    }
    else {
        return getDefaultResolutionModeForFile(SourceFile_FileName(file), meta, options);
    }
}
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
export function getDefaultResolutionModeForFile(fileName, meta, options) {
    if (importSyntaxAffectsModuleResolution(options)) {
        return GetImpliedNodeFormatForEmitWorker(fileName, CompilerOptions_GetEmitModuleKind(options), meta);
    }
    else {
        return ResolutionModeNone;
    }
}
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
export function getModeForUsageLocation(fileName, meta, usage, options) {
    const parent = usage.Parent;
    if (IsImportDeclaration(parent) || parent.Kind === KindJSImportDeclaration || IsExportDeclaration(parent) || IsJSDocImportTag(parent)) {
        const isTypeOnly = IsExclusivelyTypeOnlyImportOrExport(parent);
        if (isTypeOnly) {
            let override = ResolutionModeNone;
            let ok = false;
            if (parent.Kind === KindJSImportDeclaration || IsImportDeclaration(parent)) {
                const attrs = casts.AsImportDeclaration(parent).Attributes;
                [override, ok] = ImportAttributesNode_GetResolutionModeOverride(attrs);
            }
            else if (IsExportDeclaration(parent)) {
                const attrs = casts.AsExportDeclaration(parent).Attributes;
                [override, ok] = ImportAttributesNode_GetResolutionModeOverride(attrs);
            }
            else if (IsJSDocImportTag(parent)) {
                const attrs = casts.AsJSDocImportTag(parent).Attributes;
                [override, ok] = ImportAttributesNode_GetResolutionModeOverride(attrs);
            }
            if (ok) {
                return override;
            }
        }
    }
    if (IsLiteralTypeNode(parent) && IsImportTypeNode(parent.Parent)) {
        const [override, ok] = ImportAttributesNode_GetResolutionModeOverride(casts.AsImportTypeNode(parent.Parent).Attributes);
        if (ok) {
            return override;
        }
    }
    if (options !== undefined && importSyntaxAffectsModuleResolution(options)) {
        return getEmitSyntaxForUsageLocationWorker(fileName, meta, usage, options);
    }
    return ResolutionModeNone;
}
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
export function importSyntaxAffectsModuleResolution(options) {
    const moduleResolution = CompilerOptions_GetModuleResolutionKind(options);
    return (ModuleResolutionKindNode16 <= moduleResolution && moduleResolution <= ModuleResolutionKindNodeNext) ||
        CompilerOptions_GetResolvePackageJsonExports(options) ||
        CompilerOptions_GetResolvePackageJsonImports(options);
}
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
export function getEmitSyntaxForUsageLocationWorker(fileName, meta, usage, options) {
    if (IsRequireCall(usage.Parent, false) || (IsExternalModuleReference(usage.Parent) && IsImportEqualsDeclaration(usage.Parent.Parent))) {
        return ModuleKindCommonJS;
    }
    const fileEmitMode = GetEmitModuleFormatOfFileWorker(fileName, options, meta);
    if (IsImportCall(WalkUpParenthesizedExpressions(usage.Parent))) {
        if (ShouldTransformImportCall(fileName, options, fileEmitMode)) {
            return ModuleKindCommonJS;
        }
        else {
            return ModuleKindESNext;
        }
    }
    if (fileEmitMode === ModuleKindCommonJS) {
        return ModuleKindCommonJS;
    }
    else {
        if (ModuleKind_IsNonNodeESM(fileEmitMode) || fileEmitMode === ModuleKindPreserve) {
            return ModuleKindESNext;
        }
    }
    return ModuleKindNone;
}
//# sourceMappingURL=fileloader.js.map