import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSeq2, GoSlice } from "../../go/compat.js";
import * as strings from "../../go/strings.js";
import { Node_Expression, Node_Symbol, Node_Text } from "../ast/ast.js";
import type { HasFileName, Node, SourceFile } from "../ast/ast.js";
import { KindExportAssignment } from "../ast/generated/kinds.js";
import { IsModuleDeclaration, IsModuleDeclaration as IsModuleDeclarationPred, IsSourceFile, IsSourceFile as IsSourceFilePred } from "../ast/generated/predicates.js";
import { Node_Name } from "../ast/spine.js";
import { FindAncestor, GetSourceFileOfModule, IsModuleAugmentationExternal, IsModuleWithStringLiteralName } from "../ast/utilities.js";
import { InternalSymbolNameExportEquals } from "../ast/symbol.js";
import type { Symbol } from "../ast/symbol.js";
import { SymbolFlagsAlias } from "../ast/symbolflags.js";
import { OrderedMap_Entries } from "../collections/ordered_map.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import { SyncMap_Load } from "../collections/syncmap.js";
import { SyncSet_Range } from "../collections/syncset.js";
import {
  CompilerOptions_GetModuleResolutionKind,
  CompilerOptions_GetPathsBasePath,
  CompilerOptions_GetResolvePackageJsonExports,
  CompilerOptions_GetResolvePackageJsonImports,
  ModuleResolutionKindBundler,
  ModuleResolutionKindNodeNext,
  ResolutionModeCommonJS,
  ResolutionModeESM,
  ResolutionModeNone,
} from "../core/compileroptions.js";
import type { CompilerOptions, ResolutionMode } from "../core/compileroptions.js";
import { Pattern_IsValid } from "../core/pattern.js";
import type { Pattern as PatternType } from "../core/pattern.js";
import { IndexAfter, Some } from "../core/core.js";
import { AssertNever } from "../debug/debug.js";
import { GetConditions, MatchPatternOrExact, TryParsePatterns } from "../module/resolver.js";
import { ResolvedModule_IsResolved } from "../module/types.js";
import { GetPackageNameFromTypesPackageName, IsApplicableVersionedTypesKey, TryGetJSExtensionForFile as ModuleTryGetJSExtensionForFile } from "../module/util.js";
import { GetOutputDeclarationFileNameWorker, GetOutputJSFileNameWorker } from "../outputpaths/outputpaths.js";
import { ExportsOrImports_AsArray, ExportsOrImports_AsObject, ExportsOrImports_IsSubpaths } from "../packagejson/exportsorimports.js";
import type { ExportsOrImports } from "../packagejson/exportsorimports.js";
import { JSONValueTypeArray, JSONValueTypeNotPresent, JSONValueTypeNull, JSONValueTypeObject, JSONValueTypeString } from "../packagejson/jsonvalue.js";
import { InfoCacheEntry_GetContents, PackageJson_GetHeaderFields, PackageJson_GetPathFields, PackageJson_GetVersionPaths, VersionPaths_GetPaths } from "../packagejson/cache.js";
import type { InfoCacheEntry } from "../packagejson/cache.js";
import { HasPrefixAndSuffixWithoutOverlap, HasPrefix as stringutilHasPrefix, HasSuffix as stringutilHasSuffix } from "../stringutil/compare.js";
import { KnownSymlinks_DirectoriesByRealpath } from "../symlinks/knownsymlinks.js";
import {
  ChangeExtension,
  ChangeFullExtension,
  ExtensionCjs,
  ExtensionCts,
  ExtensionDcts,
  ExtensionDmts,
  ExtensionDts,
  ExtensionJson,
  ExtensionMjs,
  ExtensionMts,
  ExtensionTs,
  ExtensionsNotSupportingExtensionlessResolution,
  FileExtensionIsOneOf,
  GetDeclarationFileExtension,
  HasImplementationTSFileExtension,
  HasTSFileExtension,
  IsDeclarationFileName,
  RemoveExtension,
  RemoveFileExtension,
  TryGetExtensionFromPath,
} from "../tspath/extension.js";
import {
  CombinePaths,
  ComparePaths,
  ContainsPath,
  EnsureTrailingDirectorySeparator,
  ForEachAncestorDirectoryStoppingAtGlobalCache,
  GetBaseFileName,
  GetDirectoryPath,
  GetNormalizedAbsolutePath,
  GetRelativePathFromDirectory,
  NormalizePath,
  PathIsRelative,
  RemoveTrailingDirectorySeparator,
  ResolvePath,
  StartsWithDirectory,
  ToPath,
} from "../tspath/path.js";
import * as tspath from "../tspath/path.js";
import type { ComparePathsOptions, Path } from "../tspath/path.js";
import { getModuleSpecifierPreferences } from "./preferences.js";
import type { ModuleSpecifierPreferences } from "./preferences.js";
import {
  MatchingModeDirectory,
  MatchingModeExact,
  MatchingModePattern,
  ModuleSpecifierEndingIndex,
  ModuleSpecifierEndingJsExtension,
  ModuleSpecifierEndingMinimal,
  ModuleSpecifierEndingTsExtension,
  RelativePreferenceNonRelative,
  RelativePreferenceRelative,
  RelativePreferenceExternalNonRelative,
  ResultKindAmbient,
  ResultKindNodeModules,
  ResultKindNone,
  ResultKindPaths,
  ResultKindRedirect,
  ResultKindRelative,
} from "./types.js";
import type { CheckerShape, MatchingMode, ModulePath, ModuleSpecifierEnding, ModuleSpecifierGenerationHost, ModuleSpecifierOptions, ResultKind, SourceFileForSpecifierGeneration, UserPreferences } from "./types.js";
import { CountPathComponents } from "./compare.js";
import {
  GetNodeModulePathParts,
  IsExcludedByRegex,
  PathIsBareSpecifier,
  ensurePathIsNonModuleName,
  getJSExtensionForFile,
  getPathsRelativeToRootDirs,
  getRelativePathIfInSameVolume,
  isPathRelativeToParent,
  packageJsonPathsAreEqual,
  prefersTsExtension,
  replaceFirstStar,
  tryGetAnyFileFromPath,
  TryGetRealFileNameForNonJSDeclarationFileName,
  GetJSExtensionForDeclarationFileExtension,
  comparePathsByRedirect,
} from "./util.js";
import type { NodeModulePathParts } from "./util.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::GetModuleSpecifiers","kind":"func","status":"implemented","sigHash":"641b2e3d5872a25627b6cdbba77e7300466b63adde2a5ec47c7c9bda998c6190","bodyHash":"65747655a6fe6d4649b0a0823b3bf0a1379382f9566e1f139207a70ad484134e"}
 *
 * Go source:
 * func GetModuleSpecifiers(
 * 	moduleSymbol *ast.Symbol,
 * 	checker CheckerShape,
 * 	compilerOptions *core.CompilerOptions,
 * 	importingSourceFile SourceFileForSpecifierGeneration,
 * 	host ModuleSpecifierGenerationHost,
 * 	userPreferences UserPreferences,
 * 	options ModuleSpecifierOptions,
 * 	forAutoImports bool,
 * ) []string {
 * 	result, _ := GetModuleSpecifiersWithInfo(
 * 		moduleSymbol,
 * 		checker,
 * 		compilerOptions,
 * 		importingSourceFile,
 * 		host,
 * 		userPreferences,
 * 		options,
 * 		forAutoImports,
 * 	)
 * 	return result
 * }
 */
export function GetModuleSpecifiers(moduleSymbol: GoPtr<Symbol>, checker: CheckerShape, compilerOptions: GoPtr<CompilerOptions>, importingSourceFile: SourceFileForSpecifierGeneration, host: ModuleSpecifierGenerationHost, userPreferences: UserPreferences, options: ModuleSpecifierOptions, forAutoImports: bool): GoSlice<string> {
  const [result] = GetModuleSpecifiersWithInfo(moduleSymbol, checker, compilerOptions, importingSourceFile, host, userPreferences, options, forAutoImports);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::GetModuleSpecifiersWithInfo","kind":"func","status":"implemented","sigHash":"b4c16680e05aad371e8123f399c4b10a68c477a2ad4f5cd5406105d5ebb0f45c","bodyHash":"0cb959f7813a1beed94900406644d48413e070f3c0d25021346126051e765d24"}
 *
 * Go source:
 * func GetModuleSpecifiersWithInfo(
 * 	moduleSymbol *ast.Symbol,
 * 	checker CheckerShape,
 * 	compilerOptions *core.CompilerOptions,
 * 	importingSourceFile SourceFileForSpecifierGeneration,
 * 	host ModuleSpecifierGenerationHost,
 * 	userPreferences UserPreferences,
 * 	options ModuleSpecifierOptions,
 * 	forAutoImports bool,
 * ) ([]string, ResultKind) {
 * 	ambient := tryGetModuleNameFromAmbientModule(moduleSymbol, checker)
 * 	if len(ambient) > 0 {
 * 		if forAutoImports && IsExcludedByRegex(ambient, userPreferences.AutoImportSpecifierExcludeRegexes) {
 * 			return nil, ResultKindAmbient
 * 		}
 * 		return []string{ambient}, ResultKindAmbient
 * 	}
 * 
 * 	moduleSourceFile := ast.GetSourceFileOfModule(moduleSymbol)
 * 	if moduleSourceFile == nil {
 * 		return nil, ResultKindNone
 * 	}
 * 
 * 	// Use original source file name when file is from project reference output
 * 	moduleFileName := host.GetSourceOfProjectReferenceIfOutputIncluded(moduleSourceFile)
 * 
 * 	return GetModuleSpecifiersForFileWithInfo(
 * 		importingSourceFile,
 * 		moduleFileName,
 * 		compilerOptions,
 * 		host,
 * 		userPreferences,
 * 		options,
 * 		forAutoImports,
 * 	)
 * }
 */
export function GetModuleSpecifiersWithInfo(moduleSymbol: GoPtr<Symbol>, checker: CheckerShape, compilerOptions: GoPtr<CompilerOptions>, importingSourceFile: SourceFileForSpecifierGeneration, host: ModuleSpecifierGenerationHost, userPreferences: UserPreferences, options: ModuleSpecifierOptions, forAutoImports: bool): [GoSlice<string>, ResultKind] {
  const ambient = tryGetModuleNameFromAmbientModule(moduleSymbol, checker);
  if (ambient.length > 0) {
    if (forAutoImports && IsExcludedByRegex(ambient, userPreferences.AutoImportSpecifierExcludeRegexes)) {
      return [[], ResultKindAmbient];
    }
    return [[ambient], ResultKindAmbient];
  }

  const moduleSourceFile = GetSourceFileOfModule(moduleSymbol);
  if (moduleSourceFile === undefined) {
    return [[], ResultKindNone];
  }

  // Use original source file name when file is from project reference output
  const moduleFileName = host.GetSourceOfProjectReferenceIfOutputIncluded(moduleSourceFile as unknown as HasFileName);

  return GetModuleSpecifiersForFileWithInfo(importingSourceFile, moduleFileName, compilerOptions, host, userPreferences, options, forAutoImports);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::GetModuleSpecifiersForFileWithInfo","kind":"func","status":"implemented","sigHash":"2d1fc447927a975d13a3ce2e1a71498076a672752c1504b169c85c78341e52f0","bodyHash":"f997f6087d6738ca81f90a09d50cf4f510c953a79c5a3995d935dfc8028a6f72"}
 *
 * Go source:
 * func GetModuleSpecifiersForFileWithInfo(
 * 	importingSourceFile SourceFileForSpecifierGeneration,
 * 	moduleFileName string,
 * 	compilerOptions *core.CompilerOptions,
 * 	host ModuleSpecifierGenerationHost,
 * 	userPreferences UserPreferences,
 * 	options ModuleSpecifierOptions,
 * 	forAutoImports bool,
 * ) ([]string, ResultKind) {
 * 	modulePaths := getAllModulePathsWorker(
 * 		getInfo(host.GetSourceOfProjectReferenceIfOutputIncluded(importingSourceFile), host),
 * 		moduleFileName,
 * 		host,
 * 		compilerOptions,
 * 		options,
 * 	)
 * 
 * 	return computeModuleSpecifiers(
 * 		modulePaths,
 * 		compilerOptions,
 * 		importingSourceFile,
 * 		host,
 * 		userPreferences,
 * 		options,
 * 		forAutoImports,
 * 	)
 * }
 */
export function GetModuleSpecifiersForFileWithInfo(importingSourceFile: SourceFileForSpecifierGeneration, moduleFileName: string, compilerOptions: GoPtr<CompilerOptions>, host: ModuleSpecifierGenerationHost, userPreferences: UserPreferences, options: ModuleSpecifierOptions, forAutoImports: bool): [GoSlice<string>, ResultKind] {
  const modulePaths = getAllModulePathsWorker(
    getInfo(host.GetSourceOfProjectReferenceIfOutputIncluded(importingSourceFile), host),
    moduleFileName,
    host,
    compilerOptions,
    options,
  );

  return computeModuleSpecifiers(modulePaths, compilerOptions, importingSourceFile, host, userPreferences, options, forAutoImports);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::tryGetModuleNameFromAmbientModule","kind":"func","status":"implemented","sigHash":"84a8254235362004915af9b659f61e2fe36ae84d9b04de87333354b5b61b9c66","bodyHash":"9e24a00c8a86347ebd4cbdc955308f12c9c367fa35fe65ce6091ea6f2f97a5e3"}
 *
 * Go source:
 * func tryGetModuleNameFromAmbientModule(moduleSymbol *ast.Symbol, checker CheckerShape) string {
 * 	for _, decl := range moduleSymbol.Declarations {
 * 		if ast.IsModuleWithStringLiteralName(decl) && (!ast.IsModuleAugmentationExternal(decl) || !tspath.IsExternalModuleNameRelative(decl.Name().Text())) {
 * 			return decl.Name().Text()
 * 		}
 * 	}
 * 
 * 	// the module could be a namespace, which is export through "export=" from an ambient module.
 * 	/**
 * 	 * declare module "m" {
 * 	 *     namespace ns {
 * 	 *         class c {}
 * 	 *     }
 * 	 *     export = ns;
 * 	 * }
 * 	 * /
 * 	// `import {c} from "m";` is valid, in which case, `moduleSymbol` is "ns", but the module name should be "m"
 * 	for _, d := range moduleSymbol.Declarations {
 * 		if !ast.IsModuleDeclaration(d) {
 * 			continue
 * 		}
 * 
 * 		possibleContainer := ast.FindAncestor(d, ast.IsModuleWithStringLiteralName)
 * 		if possibleContainer == nil || possibleContainer.Parent == nil || !ast.IsSourceFile(possibleContainer.Parent) {
 * 			continue
 * 		}
 * 
 * 		sym, ok := possibleContainer.Symbol().Exports[ast.InternalSymbolNameExportEquals]
 * 		if !ok || sym == nil {
 * 			continue
 * 		}
 * 		exportAssignmentDecl := sym.ValueDeclaration
 * 		if exportAssignmentDecl == nil || exportAssignmentDecl.Kind != ast.KindExportAssignment {
 * 			continue
 * 		}
 * 		exportSymbol := checker.GetSymbolAtLocation(exportAssignmentDecl.Expression())
 * 		if exportSymbol == nil {
 * 			continue
 * 		}
 * 		if exportSymbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 			exportSymbol = checker.GetAliasedSymbol(exportSymbol)
 * 		}
 * 		// TODO: Possible strada bug - isn't this insufficient in the presence of merge symbols?
 * 		if exportSymbol == d.Symbol() {
 * 			return possibleContainer.Name().Text()
 * 		}
 * 	}
 * 	return ""
 * }
 */
export function tryGetModuleNameFromAmbientModule(moduleSymbol: GoPtr<Symbol>, checker: CheckerShape): string {
  for (const decl of moduleSymbol!.Declarations ?? []) {
    if (IsModuleWithStringLiteralName(decl) && (!IsModuleAugmentationExternal(decl) || !PathIsRelative(Node_Text(Node_Name(decl))))) {
      return Node_Text(Node_Name(decl));
    }
  }

  // the module could be a namespace, which is exported through "export=" from an ambient module.
  for (const d of moduleSymbol!.Declarations ?? []) {
    if (!IsModuleDeclaration(d)) {
      continue;
    }

    const possibleContainer = FindAncestor(d, IsModuleWithStringLiteralName);
    if (possibleContainer === undefined || possibleContainer.Parent === undefined || !IsSourceFilePred(possibleContainer.Parent)) {
      continue;
    }

    const sym = Node_Symbol(possibleContainer)!.Exports.get(InternalSymbolNameExportEquals);
    if (sym === undefined) {
      continue;
    }
    const exportAssignmentDecl = sym.ValueDeclaration;
    if (exportAssignmentDecl === undefined || exportAssignmentDecl.Kind !== KindExportAssignment) {
      continue;
    }
    let exportSymbol = checker.GetSymbolAtLocation(Node_Expression(exportAssignmentDecl));
    if (exportSymbol === undefined) {
      continue;
    }
    if ((exportSymbol.Flags & SymbolFlagsAlias) !== 0) {
      exportSymbol = checker.GetAliasedSymbol(exportSymbol);
    }
    // TODO: Possible strada bug - isn't this insufficient in the presence of merge symbols?
    if (exportSymbol === Node_Symbol(d)) {
      return Node_Text(Node_Name(possibleContainer));
    }
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::type::Info","kind":"type","status":"implemented","sigHash":"eb63543f7710295da2879fd147c1d7cea45be5164d7914a6ea65e0f6de72c038","bodyHash":"1372b91dbe62ce1542b42e460cf53a4cee8e06c18eed95dd9d32eb669d366bb4"}
 *
 * Go source:
 * Info struct {
 * 	UseCaseSensitiveFileNames bool
 * 	ImportingSourceFileName   string
 * 	SourceDirectory           string
 * }
 */
export interface Info {
  UseCaseSensitiveFileNames: bool;
  ImportingSourceFileName: string;
  SourceDirectory: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::getInfo","kind":"func","status":"implemented","sigHash":"021037fd7616487dd420d8f0a43166880c71a1d978e395cd1b03ae9e551b2812","bodyHash":"6f40efb429d1c517e688350a6c4d5c222bbc25731e2291a6295f23e07cea654f"}
 *
 * Go source:
 * func getInfo(
 * 	importingSourceFileName string,
 * 	host ModuleSpecifierGenerationHost,
 * ) Info {
 * 	sourceDirectory := tspath.GetDirectoryPath(importingSourceFileName)
 * 	return Info{
 * 		ImportingSourceFileName:   importingSourceFileName,
 * 		SourceDirectory:           sourceDirectory,
 * 		UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
 * 	}
 * }
 */
export function getInfo(importingSourceFileName: string, host: ModuleSpecifierGenerationHost): Info {
  const sourceDirectory = tspath.GetDirectoryPath(importingSourceFileName);
  return {
    ImportingSourceFileName: importingSourceFileName,
    SourceDirectory: sourceDirectory,
    UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::getAllModulePaths","kind":"func","status":"implemented","sigHash":"2e9b343da27b4a7087e24b8523c43e7e4bcb171497d1a80d5f16871e4b27e14a","bodyHash":"ec79fff2ea7e310af3780f42d49a0bdbbf14f4a7938d23ebdb1e3f56e600a01a"}
 *
 * Go source:
 * func getAllModulePaths(
 * 	info Info,
 * 	importedFileName string,
 * 	host ModuleSpecifierGenerationHost,
 * 	compilerOptions *core.CompilerOptions,
 * 	preferences UserPreferences,
 * 	options ModuleSpecifierOptions,
 * ) []ModulePath {
 * 	// !!! use new cache model
 * 	// importingFilePath := tspath.ToPath(info.ImportingSourceFileName, host.GetCurrentDirectory(), host.UseCaseSensitiveFileNames());
 * 	// importedFilePath := tspath.ToPath(importedFileName, host.GetCurrentDirectory(), host.UseCaseSensitiveFileNames());
 * 	// cache := host.getModuleSpecifierCache();
 * 	// if (cache != nil) {
 * 	//     cached := cache.get(importingFilePath, importedFilePath, preferences, options);
 * 	//     if (cached.modulePaths) {return cached.modulePaths;}
 * 	// }
 * 	modulePaths := getAllModulePathsWorker(info, importedFileName, host, compilerOptions, options)
 * 	// if (cache != nil) {
 * 	//     cache.setModulePaths(importingFilePath, importedFilePath, preferences, options, modulePaths);
 * 	// }
 * 	return modulePaths
 * }
 */
export function getAllModulePaths(info: Info, importedFileName: string, host: ModuleSpecifierGenerationHost, compilerOptions: GoPtr<CompilerOptions>, preferences: UserPreferences, options: ModuleSpecifierOptions): GoSlice<ModulePath> {
  // !!! use new cache model (cache calls omitted as per Go source comments)
  return getAllModulePathsWorker(info, importedFileName, host, compilerOptions, options);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::getAllModulePathsWorker","kind":"func","status":"implemented","sigHash":"4a5a91117c8e5aa8053319825b8e35b6ca85e4290e8269fbc7a0cc8bb44be298","bodyHash":"4cf48d84362cee9cf754d3ba5a0d6de07a5764fc12868f7c65b8d05045d49cbb"}
 *
 * Go source:
 * func getAllModulePathsWorker(
 * 	info Info,
 * 	importedFileName string,
 * 	host ModuleSpecifierGenerationHost,
 * 	compilerOptions *core.CompilerOptions,
 * 	options ModuleSpecifierOptions,
 * ) []ModulePath {
 * 	allFileNames := make(map[string]ModulePath)
 * 	paths := GetEachFileNameOfModule(info.ImportingSourceFileName, importedFileName, host, true)
 * 	for _, p := range paths {
 * 		allFileNames[p.FileName] = p
 * 	}
 * 
 * 	useCaseSensitiveFileNames := info.UseCaseSensitiveFileNames
 * 	comparePaths := func(a, b ModulePath) int {
 * 		return comparePathsByRedirect(a, b, useCaseSensitiveFileNames)
 * 	}
 * 
 * 	// Sort by paths closest to importing file Name directory
 * 	sortedPaths := make([]ModulePath, 0, len(paths))
 * 	for directory := info.SourceDirectory; len(allFileNames) != 0; {
 * 		directoryStart := tspath.EnsureTrailingDirectorySeparator(directory)
 * 		var pathsInDirectory []ModulePath
 * 		for fileName, p := range allFileNames {
 * 			if strings.HasPrefix(fileName, directoryStart) {
 * 				pathsInDirectory = append(pathsInDirectory, p)
 * 				delete(allFileNames, fileName)
 * 			}
 * 		}
 * 		if len(pathsInDirectory) > 0 {
 * 			slices.SortFunc(pathsInDirectory, comparePaths)
 * 			sortedPaths = append(sortedPaths, pathsInDirectory...)
 * 		}
 * 		newDirectory := tspath.GetDirectoryPath(directory)
 * 		if newDirectory == directory {
 * 			break
 * 		}
 * 		directory = newDirectory
 * 	}
 * 	if len(allFileNames) > 0 {
 * 		remainingPaths := slices.Collect(maps.Values(allFileNames))
 * 		slices.SortFunc(remainingPaths, comparePaths)
 * 		sortedPaths = append(sortedPaths, remainingPaths...)
 * 	}
 * 	return sortedPaths
 * }
 */
export function getAllModulePathsWorker(info: Info, importedFileName: string, host: ModuleSpecifierGenerationHost, compilerOptions: GoPtr<CompilerOptions>, options: ModuleSpecifierOptions): GoSlice<ModulePath> {
  const allFileNames = new Map<string, ModulePath>();
  const paths = GetEachFileNameOfModule(info.ImportingSourceFileName, importedFileName, host, true);
  for (const p of paths) {
    allFileNames.set(p.FileName, p);
  }

  const useCaseSensitiveFileNames = info.UseCaseSensitiveFileNames;
  const comparePaths_ = (a: ModulePath, b: ModulePath): number => comparePathsByRedirect(a, b, useCaseSensitiveFileNames);

  // Sort by paths closest to importing file Name directory
  const sortedPaths: ModulePath[] = [];
  let directory = info.SourceDirectory;
  while (allFileNames.size !== 0) {
    const directoryStart = EnsureTrailingDirectorySeparator(directory);
    const pathsInDirectory: ModulePath[] = [];
    for (const [fileName, p] of allFileNames) {
      if (strings.HasPrefix(fileName, directoryStart)) {
        pathsInDirectory.push(p);
        allFileNames.delete(fileName);
      }
    }
    if (pathsInDirectory.length > 0) {
      pathsInDirectory.sort(comparePaths_);
      for (const p of pathsInDirectory) sortedPaths.push(p);
    }
    const newDirectory = GetDirectoryPath(directory);
    if (newDirectory === directory) {
      break;
    }
    directory = newDirectory;
  }
  if (allFileNames.size > 0) {
    const remainingPaths = Array.from(allFileNames.values());
    remainingPaths.sort(comparePaths_);
    for (const p of remainingPaths) sortedPaths.push(p);
  }
  return sortedPaths;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::containsIgnoredPath","kind":"func","status":"implemented","sigHash":"99211a466cfc8320188023cf635992dacd3253558ecd6ab619b5d51491a8d7d1","bodyHash":"07b9c9ba015b31dcbe428e66c0e52e9bb859cbb07fd183c249548e2b369393ea"}
 *
 * Go source:
 * func containsIgnoredPath(s string) bool {
 * 	return strings.Contains(s, "/node_modules/.") ||
 * 		strings.Contains(s, "/.git") ||
 * 		strings.Contains(s, ".#")
 * }
 */
export function containsIgnoredPath(s: string): bool {
  return strings.Contains(s, "/node_modules/.") ||
    strings.Contains(s, "/.git") ||
    strings.Contains(s, ".#");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::ContainsNodeModules","kind":"func","status":"implemented","sigHash":"7dcef2e597b85b226a57d2199783fc84b2e6613a1f893adb7322ea294fb4be07","bodyHash":"65e7aea6a7a1ea0d9e8401fca04ac97633bb5e70928be475f070a109ea7568f4"}
 *
 * Go source:
 * func ContainsNodeModules(s string) bool {
 * 	return strings.Contains(s, "/node_modules/")
 * }
 */
export function ContainsNodeModules(s: string): bool {
  return strings.Contains(s, "/node_modules/");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::GetEachFileNameOfModule","kind":"func","status":"implemented","sigHash":"d6eda310d1cd3299d373dd6daa150cebeec7ff1ed481947445f3bfc41bec796a","bodyHash":"6d964a62314ecb7b8a36ecffc274ce9cff865569c4d3c8db60a709c3b2545877"}
 *
 * Go source:
 * func GetEachFileNameOfModule(
 * 	importingFileName string,
 * 	importedFileName string,
 * 	host ModuleSpecifierGenerationHost,
 * 	preferSymlinks bool,
 * ) []ModulePath {
 * 	cwd := host.GetCurrentDirectory()
 * 	importedPath := tspath.ToPath(importedFileName, cwd, host.UseCaseSensitiveFileNames())
 * 	var referenceRedirect string
 * 	outputAndReference := host.GetProjectReferenceFromSource(importedPath)
 * 	if outputAndReference != nil && outputAndReference.OutputDts != "" {
 * 		referenceRedirect = outputAndReference.OutputDts
 * 	}
 * 
 * 	redirects := host.GetRedirectTargets(importedPath)
 * 	importedFileNames := make([]string, 0, 2+len(redirects))
 * 	if len(referenceRedirect) > 0 {
 * 		importedFileNames = append(importedFileNames, referenceRedirect)
 * 	}
 * 	importedFileNames = append(importedFileNames, importedFileName)
 * 	importedFileNames = append(importedFileNames, redirects...)
 * 	targets := core.Map(importedFileNames, func(f string) string { return tspath.GetNormalizedAbsolutePath(f, cwd) })
 * 	shouldFilterIgnoredPaths := !core.Every(targets, containsIgnoredPath)
 * 
 * 	results := make([]ModulePath, 0, 2)
 * 	if !preferSymlinks {
 * 		for _, p := range targets {
 * 			if !(shouldFilterIgnoredPaths && containsIgnoredPath(p)) {
 * 				results = append(results, ModulePath{
 * 					FileName:        p,
 * 					IsInNodeModules: ContainsNodeModules(p),
 * 					IsRedirect:      referenceRedirect == p,
 * 				})
 * 			}
 * 		}
 * 	}
 * 
 * 	symlinkCache := host.GetSymlinkCache()
 * 	fullImportedFileName := tspath.GetNormalizedAbsolutePath(importedFileName, cwd)
 * 	if symlinkCache != nil {
 * 		tspath.ForEachAncestorDirectoryStoppingAtGlobalCache(
 * 			host.GetGlobalTypingsCacheLocation(),
 * 			tspath.GetDirectoryPath(fullImportedFileName),
 * 			func(realPathDirectory string) (bool, bool) {
 * 				symlinkSet, ok := symlinkCache.DirectoriesByRealpath().Load(tspath.ToPath(realPathDirectory, cwd, host.UseCaseSensitiveFileNames()).EnsureTrailingDirectorySeparator())
 * 				if !ok {
 * 					return false, false
 * 				} // Continue to ancestor directory
 * 
 * 				// Don't want to a package to globally import from itself (importNameCodeFix_symlink_own_package.ts)
 * 				if tspath.StartsWithDirectory(importingFileName, realPathDirectory, host.UseCaseSensitiveFileNames()) {
 * 					return false, true // Stop search, each ancestor directory will also hit this condition
 * 				}
 * 
 * 				for _, target := range targets {
 * 					if !tspath.StartsWithDirectory(target, realPathDirectory, host.UseCaseSensitiveFileNames()) {
 * 						continue
 * 					}
 * 
 * 					relative := tspath.GetRelativePathFromDirectory(
 * 						realPathDirectory,
 * 						target,
 * 						tspath.ComparePathsOptions{
 * 							UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
 * 							CurrentDirectory:          cwd,
 * 						})
 * 					symlinkSet.Range(func(symlinkDirectory string) bool {
 * 						option := tspath.ResolvePath(symlinkDirectory, relative)
 * 						results = append(results, ModulePath{
 * 							FileName:        option,
 * 							IsInNodeModules: ContainsNodeModules(option),
 * 							IsRedirect:      target == referenceRedirect,
 * 						})
 * 						shouldFilterIgnoredPaths = true // We found a non-ignored path in symlinks, so we can reject ignored-path realpaths
 * 						return true
 * 					})
 * 				}
 * 
 * 				return false, false
 * 			},
 * 		)
 * 	}
 * 
 * 	if preferSymlinks {
 * 		for _, p := range targets {
 * 			if !(shouldFilterIgnoredPaths && containsIgnoredPath(p)) {
 * 				results = append(results, ModulePath{
 * 					FileName:        p,
 * 					IsInNodeModules: ContainsNodeModules(p),
 * 					IsRedirect:      referenceRedirect == p,
 * 				})
 * 			}
 * 		}
 * 	}
 * 
 * 	return results
 * }
 */
export function GetEachFileNameOfModule(importingFileName: string, importedFileName: string, host: ModuleSpecifierGenerationHost, preferSymlinks: bool): GoSlice<ModulePath> {
  const cwd = host.GetCurrentDirectory();
  const importedPath = ToPath(importedFileName, cwd, host.UseCaseSensitiveFileNames());
  let referenceRedirect = "";
  const outputAndReference = host.GetProjectReferenceFromSource(importedPath);
  if (outputAndReference !== undefined && outputAndReference.OutputDts !== "") {
    referenceRedirect = outputAndReference.OutputDts;
  }

  const redirects = host.GetRedirectTargets(importedPath);
  const importedFileNames: string[] = [];
  if (referenceRedirect.length > 0) {
    importedFileNames.push(referenceRedirect);
  }
  importedFileNames.push(importedFileName);
  for (const r of redirects) importedFileNames.push(r);
  const targets = importedFileNames.map(f => tspath.GetNormalizedAbsolutePath(f, cwd));
  let shouldFilterIgnoredPaths = !targets.every(containsIgnoredPath);

  const results: ModulePath[] = [];
  if (!preferSymlinks) {
    for (const p of targets) {
      if (!(shouldFilterIgnoredPaths && containsIgnoredPath(p))) {
        results.push({
          FileName: p,
          IsInNodeModules: ContainsNodeModules(p),
          IsRedirect: referenceRedirect === p,
        });
      }
    }
  }

  const symlinkCache = host.GetSymlinkCache();
  const fullImportedFileName = tspath.GetNormalizedAbsolutePath(importedFileName, cwd);
  if (symlinkCache !== undefined) {
    ForEachAncestorDirectoryStoppingAtGlobalCache(
      host.GetGlobalTypingsCacheLocation(),
      GetDirectoryPath(fullImportedFileName),
      (realPathDirectory: string): [boolean, boolean] => {
        const [symlinkSet, ok] = SyncMap_Load(KnownSymlinks_DirectoriesByRealpath(symlinkCache), EnsureTrailingDirectorySeparator(ToPath(realPathDirectory, cwd, host.UseCaseSensitiveFileNames())) as any);
        if (!ok) {
          return [false, false]; // Continue to ancestor directory
        }

        // Don't want a package to globally import from itself
        if (StartsWithDirectory(importingFileName, realPathDirectory, host.UseCaseSensitiveFileNames())) {
          return [false, true]; // Stop search
        }

        for (const target of targets) {
          if (!StartsWithDirectory(target, realPathDirectory, host.UseCaseSensitiveFileNames())) {
            continue;
          }

          const relative = GetRelativePathFromDirectory(realPathDirectory, target, {
            UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
            CurrentDirectory: cwd,
          });
          SyncSet_Range(symlinkSet as any, (symlinkDirectory: string): bool => {
            const option = ResolvePath(symlinkDirectory, relative);
            results.push({
              FileName: option,
              IsInNodeModules: ContainsNodeModules(option),
              IsRedirect: target === referenceRedirect,
            });
            shouldFilterIgnoredPaths = true; // We found a non-ignored path in symlinks
            return true;
          });
        }

        return [false, false];
      },
    );
  }

  if (preferSymlinks) {
    for (const p of targets) {
      if (!(shouldFilterIgnoredPaths && containsIgnoredPath(p))) {
        results.push({
          FileName: p,
          IsInNodeModules: ContainsNodeModules(p),
          IsRedirect: referenceRedirect === p,
        });
      }
    }
  }

  return results;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::computeModuleSpecifiers","kind":"func","status":"implemented","sigHash":"a9bd933fcebdb018c70d2755a8d99c21857e222fc54d0ed94a902abbd965290c","bodyHash":"f91a0fbf79ab3320c3ea3a9b62052d7a3febe1f1f93c77c8762c196efb1c2bf3"}
 *
 * Go source:
 * func computeModuleSpecifiers(
 * 	modulePaths []ModulePath,
 * 	compilerOptions *core.CompilerOptions,
 * 	importingSourceFile SourceFileForSpecifierGeneration,
 * 	host ModuleSpecifierGenerationHost,
 * 	userPreferences UserPreferences,
 * 	options ModuleSpecifierOptions,
 * 	forAutoImport bool,
 * ) ([]string, ResultKind) {
 * 	info := getInfo(importingSourceFile.FileName(), host)
 * 	preferences := getModuleSpecifierPreferences(userPreferences, host, compilerOptions, importingSourceFile, "")
 * 
 * 	var existingSpecifier string
 * 	for _, modulePath := range modulePaths {
 * 		targetPath := tspath.ToPath(modulePath.FileName, host.GetCurrentDirectory(), info.UseCaseSensitiveFileNames)
 * 		var existingImport *ast.StringLiteralLike
 * 		for _, importSpecifier := range importingSourceFile.Imports() {
 * 			resolvedModule := host.GetResolvedModuleFromModuleSpecifier(importingSourceFile, importSpecifier)
 * 			if resolvedModule.IsResolved() && tspath.ToPath(resolvedModule.ResolvedFileName, host.GetCurrentDirectory(), info.UseCaseSensitiveFileNames) == targetPath {
 * 				existingImport = importSpecifier
 * 				break
 * 			}
 * 		}
 * 		if existingImport != nil {
 * 			if preferences.relativePreference == RelativePreferenceNonRelative && tspath.PathIsRelative(existingImport.Text()) {
 * 				// If the preference is for non-relative and the module specifier is relative, ignore it
 * 				continue
 * 			}
 * 			existingMode := host.GetModeForUsageLocation(importingSourceFile, existingImport)
 * 			targetMode := options.OverrideImportMode
 * 			if targetMode == core.ResolutionModeNone {
 * 				targetMode = host.GetDefaultResolutionModeForFile(importingSourceFile)
 * 			}
 * 			if existingMode != targetMode && existingMode != core.ResolutionModeNone && targetMode != core.ResolutionModeNone {
 * 				// If the candidate import mode doesn't match the mode we're generating for, don't consider it
 * 				continue
 * 			}
 * 			existingSpecifier = existingImport.Text()
 * 			break
 * 		}
 * 	}
 * 
 * 	if existingSpecifier != "" {
 * 		return []string{existingSpecifier}, ResultKindNone
 * 	}
 * 
 * 	importedFileIsInNodeModules := core.Some(modulePaths, func(p ModulePath) bool { return p.IsInNodeModules })
 * 
 * 	// Module specifier priority:
 * 	//   1. "Bare package specifiers" (e.g. "@foo/bar") resulting from a path through node_modules to a package.json's "types" entry
 * 	//   2. Specifiers generated using "paths" from tsconfig
 * 	//   3. Non-relative specfiers resulting from a path through node_modules (e.g. "@foo/bar/path/to/file")
 * 	//   4. Relative paths
 * 	var pathsSpecifiers []string
 * 	var redirectPathsSpecifiers []string
 * 	var nodeModulesSpecifiers []string
 * 	var relativeSpecifiers []string
 * 
 * 	for _, modulePath := range modulePaths {
 * 		var specifier string
 * 		if modulePath.IsInNodeModules {
 * 			specifier = tryGetModuleNameAsNodeModule(modulePath, info, importingSourceFile, host, compilerOptions, userPreferences /*packageNameOnly* /, false, options.OverrideImportMode)
 * 		}
 * 		if len(specifier) > 0 && !(forAutoImport && IsExcludedByRegex(specifier, preferences.excludeRegexes)) {
 * 			nodeModulesSpecifiers = append(nodeModulesSpecifiers, specifier)
 * 			if modulePath.IsRedirect {
 * 				// If we got a specifier for a redirect, it was a bare package specifier (e.g. "@foo/bar",
 * 				// not "@foo/bar/path/to/file"). No other specifier will be this good, so stop looking.
 * 				return nodeModulesSpecifiers, ResultKindNodeModules
 * 			}
 * 		}
 * 
 * 		importMode := options.OverrideImportMode
 * 		if importMode == core.ResolutionModeNone {
 * 			importMode = host.GetDefaultResolutionModeForFile(importingSourceFile)
 * 		}
 * 		local := getLocalModuleSpecifier(
 * 			modulePath.FileName,
 * 			info,
 * 			compilerOptions,
 * 			host,
 * 			importMode,
 * 			preferences,
 * 			/*pathsOnly* / modulePath.IsRedirect || len(specifier) > 0,
 * 		)
 * 		if len(local) == 0 || forAutoImport && IsExcludedByRegex(local, preferences.excludeRegexes) {
 * 			continue
 * 		}
 * 		if modulePath.IsRedirect {
 * 			redirectPathsSpecifiers = append(redirectPathsSpecifiers, local)
 * 		} else if PathIsBareSpecifier(local) {
 * 			if ContainsNodeModules(local) {
 * 				// We could be in this branch due to inappropriate use of `baseUrl`, not intentional `paths`
 * 				// usage. It's impossible to reason about where to prioritize baseUrl-generated module
 * 				// specifiers, but if they contain `/node_modules/`, they're going to trigger a portability
 * 				// error, so *at least* don't prioritize those.
 * 				relativeSpecifiers = append(relativeSpecifiers, local)
 * 			} else {
 * 				pathsSpecifiers = append(pathsSpecifiers, local)
 * 			}
 * 		} else if forAutoImport || !importedFileIsInNodeModules || modulePath.IsInNodeModules {
 * 			// Why this extra conditional, not just an `else`? If some path to the file contained
 * 			// 'node_modules', but we can't create a non-relative specifier (e.g. "@foo/bar/path/to/file"),
 * 			// that means we had to go through a *sibling's* node_modules, not one we can access directly.
 * 			// If some path to the file was in node_modules but another was not, this likely indicates that
 * 			// we have a monorepo structure with symlinks. In this case, the non-nodeModules path is
 * 			// probably the realpath, e.g. "../bar/path/to/file", but a relative path to another package
 * 			// in a monorepo is probably not portable. So, the module specifier we actually go with will be
 * 			// the relative path through node_modules, so that the declaration emitter can produce a
 * 			// portability error. (See declarationEmitReexportedSymlinkReference3)
 * 			relativeSpecifiers = append(relativeSpecifiers, local)
 * 		}
 * 	}
 * 
 * 	if len(pathsSpecifiers) > 0 {
 * 		return pathsSpecifiers, ResultKindPaths
 * 	}
 * 	if len(redirectPathsSpecifiers) > 0 {
 * 		return redirectPathsSpecifiers, ResultKindRedirect
 * 	}
 * 	if len(nodeModulesSpecifiers) > 0 {
 * 		return nodeModulesSpecifiers, ResultKindNodeModules
 * 	}
 * 	return relativeSpecifiers, ResultKindRelative
 * }
 */
export function computeModuleSpecifiers(modulePaths: GoSlice<ModulePath>, compilerOptions: GoPtr<CompilerOptions>, importingSourceFile: SourceFileForSpecifierGeneration, host: ModuleSpecifierGenerationHost, userPreferences: UserPreferences, options: ModuleSpecifierOptions, forAutoImport: bool): [GoSlice<string>, ResultKind] {
  const info = getInfo(importingSourceFile.FileName(), host);
  const preferences = getModuleSpecifierPreferences(userPreferences, host, compilerOptions, importingSourceFile, "");

  let existingSpecifier = "";
  for (const modulePath of modulePaths) {
    const targetPath = ToPath(modulePath.FileName, host.GetCurrentDirectory(), info.UseCaseSensitiveFileNames);
    let existingImport: GoPtr<Node> = undefined;
    for (const importSpecifier of importingSourceFile.Imports()) {
      const resolvedModule = host.GetResolvedModuleFromModuleSpecifier(importingSourceFile, importSpecifier);
      if (ResolvedModule_IsResolved(resolvedModule) && ToPath(resolvedModule!.ResolvedFileName, host.GetCurrentDirectory(), info.UseCaseSensitiveFileNames) === targetPath) {
        existingImport = importSpecifier;
        break;
      }
    }
    if (existingImport !== undefined) {
      if (preferences.relativePreference === RelativePreferenceNonRelative && PathIsRelative(Node_Text(existingImport))) {
        // If the preference is for non-relative and the module specifier is relative, ignore it
        continue;
      }
      const existingMode = host.GetModeForUsageLocation(importingSourceFile, existingImport);
      let targetMode = options.OverrideImportMode;
      if (targetMode === ResolutionModeNone) {
        targetMode = host.GetDefaultResolutionModeForFile(importingSourceFile);
      }
      if (existingMode !== targetMode && existingMode !== ResolutionModeNone && targetMode !== ResolutionModeNone) {
        // If the candidate import mode doesn't match the mode we're generating for, don't consider it
        continue;
      }
      existingSpecifier = Node_Text(existingImport);
      break;
    }
  }

  if (existingSpecifier !== "") {
    return [[existingSpecifier], ResultKindNone];
  }

  const importedFileIsInNodeModules = modulePaths.some(p => p.IsInNodeModules);

  // Module specifier priority:
  //   1. "Bare package specifiers" (e.g. "@foo/bar") resulting from a path through node_modules to a package.json's "types" entry
  //   2. Specifiers generated using "paths" from tsconfig
  //   3. Non-relative specifiers resulting from a path through node_modules (e.g. "@foo/bar/path/to/file")
  //   4. Relative paths
  const pathsSpecifiers: string[] = [];
  const redirectPathsSpecifiers: string[] = [];
  const nodeModulesSpecifiers: string[] = [];
  const relativeSpecifiers: string[] = [];

  for (const modulePath of modulePaths) {
    let specifier = "";
    if (modulePath.IsInNodeModules) {
      specifier = tryGetModuleNameAsNodeModule(modulePath, info, importingSourceFile, host, compilerOptions, userPreferences, /*packageNameOnly*/ false, options.OverrideImportMode);
    }
    if (specifier.length > 0 && !(forAutoImport && IsExcludedByRegex(specifier, preferences.excludeRegexes))) {
      nodeModulesSpecifiers.push(specifier);
      if (modulePath.IsRedirect) {
        // If we got a specifier for a redirect, it was a bare package specifier (e.g. "@foo/bar",
        // not "@foo/bar/path/to/file"). No other specifier will be this good, so stop looking.
        return [nodeModulesSpecifiers, ResultKindNodeModules];
      }
    }

    let importMode = options.OverrideImportMode;
    if (importMode === ResolutionModeNone) {
      importMode = host.GetDefaultResolutionModeForFile(importingSourceFile);
    }
    const local = getLocalModuleSpecifier(
      modulePath.FileName,
      info,
      compilerOptions,
      host,
      importMode,
      preferences,
      /*pathsOnly*/ modulePath.IsRedirect || specifier.length > 0,
    );
    if (local.length === 0 || (forAutoImport && IsExcludedByRegex(local, preferences.excludeRegexes))) {
      continue;
    }
    if (modulePath.IsRedirect) {
      redirectPathsSpecifiers.push(local);
    } else if (PathIsBareSpecifier(local)) {
      if (ContainsNodeModules(local)) {
        relativeSpecifiers.push(local);
      } else {
        pathsSpecifiers.push(local);
      }
    } else if (forAutoImport || !importedFileIsInNodeModules || modulePath.IsInNodeModules) {
      relativeSpecifiers.push(local);
    }
  }

  if (pathsSpecifiers.length > 0) {
    return [pathsSpecifiers, ResultKindPaths];
  }
  if (redirectPathsSpecifiers.length > 0) {
    return [redirectPathsSpecifiers, ResultKindRedirect];
  }
  if (nodeModulesSpecifiers.length > 0) {
    return [nodeModulesSpecifiers, ResultKindNodeModules];
  }
  return [relativeSpecifiers, ResultKindRelative];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::getLocalModuleSpecifier","kind":"func","status":"implemented","sigHash":"99ba6b7baa12d7710567d4f9318b82448f7dabe3a093e95104866044e1d75f0f","bodyHash":"d90bc23ba86512af61366380b627ce466641ca0b200109dbd0c8a7c443be1ea3"}
 *
 * Go source:
 * func getLocalModuleSpecifier(
 * 	moduleFileName string,
 * 	info Info,
 * 	compilerOptions *core.CompilerOptions,
 * 	host ModuleSpecifierGenerationHost,
 * 	importMode core.ResolutionMode,
 * 	preferences ModuleSpecifierPreferences,
 * 	pathsOnly bool,
 * ) string {
 * 	paths := compilerOptions.Paths
 * 	rootDirs := compilerOptions.RootDirs
 * 
 * 	if pathsOnly && paths == nil {
 * 		return ""
 * 	}
 * 
 * 	sourceDirectory := info.SourceDirectory
 * 
 * 	allowedEndings := preferences.getAllowedEndingsInPreferredOrder(importMode)
 * 	var relativePath string
 * 	if len(rootDirs) > 0 {
 * 		relativePath = tryGetModuleNameFromRootDirs(rootDirs, moduleFileName, sourceDirectory, allowedEndings, compilerOptions, host)
 * 	}
 * 	if len(relativePath) == 0 {
 * 		relativePath = processEnding(ensurePathIsNonModuleName(tspath.GetRelativePathFromDirectory(sourceDirectory, moduleFileName, tspath.ComparePathsOptions{
 * 			UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
 * 			CurrentDirectory:          host.GetCurrentDirectory(),
 * 		})), allowedEndings, compilerOptions, host)
 * 	}
 * 
 * 	if (paths == nil && !compilerOptions.GetResolvePackageJsonImports()) || preferences.relativePreference == RelativePreferenceRelative {
 * 		if pathsOnly {
 * 			return ""
 * 		}
 * 		return relativePath
 * 	}
 * 
 * 	root := compilerOptions.GetPathsBasePath(host.GetCurrentDirectory())
 * 	baseDirectory := tspath.GetNormalizedAbsolutePath(root, host.GetCurrentDirectory())
 * 	relativeToBaseUrl := getRelativePathIfInSameVolume(moduleFileName, baseDirectory, host.UseCaseSensitiveFileNames())
 * 	if len(relativeToBaseUrl) == 0 {
 * 		if pathsOnly {
 * 			return ""
 * 		}
 * 		return relativePath
 * 	}
 * 
 * 	var fromPackageJsonImports string
 * 	if !pathsOnly {
 * 		fromPackageJsonImports = tryGetModuleNameFromPackageJsonImports(
 * 			moduleFileName,
 * 			sourceDirectory,
 * 			compilerOptions,
 * 			host,
 * 			importMode,
 * 			prefersTsExtension(allowedEndings),
 * 		)
 * 	}
 * 
 * 	var fromPaths string
 * 	if (pathsOnly || len(fromPackageJsonImports) == 0) && paths != nil {
 * 		fromPaths = tryGetModuleNameFromPaths(
 * 			relativeToBaseUrl,
 * 			paths,
 * 			allowedEndings,
 * 			baseDirectory,
 * 			host,
 * 			compilerOptions,
 * 		)
 * 	}
 * 
 * 	if pathsOnly {
 * 		return fromPaths
 * 	}
 * 
 * 	var maybeNonRelative string
 * 	if len(fromPackageJsonImports) > 0 {
 * 		maybeNonRelative = fromPackageJsonImports
 * 	} else {
 * 		maybeNonRelative = fromPaths
 * 	}
 * 	if len(maybeNonRelative) == 0 {
 * 		return relativePath
 * 	}
 * 
 * 	relativeIsExcluded := IsExcludedByRegex(relativePath, preferences.excludeRegexes)
 * 	nonRelativeIsExcluded := IsExcludedByRegex(maybeNonRelative, preferences.excludeRegexes)
 * 	if !relativeIsExcluded && nonRelativeIsExcluded {
 * 		return relativePath
 * 	}
 * 	if relativeIsExcluded && !nonRelativeIsExcluded {
 * 		return maybeNonRelative
 * 	}
 * 
 * 	if preferences.relativePreference == RelativePreferenceNonRelative && !tspath.PathIsRelative(maybeNonRelative) {
 * 		return maybeNonRelative
 * 	}
 * 
 * 	if preferences.relativePreference == RelativePreferenceExternalNonRelative && !tspath.PathIsRelative(maybeNonRelative) {
 * 		var projectDirectory tspath.Path
 * 		if len(compilerOptions.ConfigFilePath) > 0 {
 * 			projectDirectory = tspath.ToPath(compilerOptions.ConfigFilePath, host.GetCurrentDirectory(), host.UseCaseSensitiveFileNames())
 * 		} else {
 * 			projectDirectory = tspath.ToPath(host.GetCurrentDirectory(), host.GetCurrentDirectory(), host.UseCaseSensitiveFileNames())
 * 		}
 * 		canonicalSourceDirectory := tspath.ToPath(sourceDirectory, host.GetCurrentDirectory(), host.UseCaseSensitiveFileNames())
 * 		modulePath := tspath.ToPath(moduleFileName, string(projectDirectory), host.UseCaseSensitiveFileNames())
 * 
 * 		sourceIsInternal := strings.HasPrefix(string(canonicalSourceDirectory), string(projectDirectory))
 * 		targetIsInternal := strings.HasPrefix(string(modulePath), string(projectDirectory))
 * 		if sourceIsInternal && !targetIsInternal || !sourceIsInternal && targetIsInternal {
 * 			// 1. The import path crosses the boundary of the tsconfig.json-containing directory.
 * 			//
 * 			//      src/
 * 			//        tsconfig.json
 * 			//        index.ts -------
 * 			//      lib/              | (path crosses tsconfig.json)
 * 			//        imported.ts <---
 * 			//
 * 			return maybeNonRelative
 * 		}
 * 
 * 		nearestTargetPackageJson := host.GetNearestAncestorDirectoryWithPackageJson(tspath.GetDirectoryPath(string(modulePath)))
 * 		nearestSourcePackageJson := host.GetNearestAncestorDirectoryWithPackageJson(sourceDirectory)
 * 
 * 		if !packageJsonPathsAreEqual(nearestTargetPackageJson, nearestSourcePackageJson, tspath.ComparePathsOptions{
 * 			UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
 * 			CurrentDirectory:          host.GetCurrentDirectory(),
 * 		}) {
 * 			// 2. The importing and imported files are part of different packages.
 * 			//
 * 			//      packages/a/
 * 			//        package.json
 * 			//        index.ts --------
 * 			//      packages/b/        | (path crosses package.json)
 * 			//        package.json     |
 * 			//        component.ts <---
 * 			//
 * 			return maybeNonRelative
 * 		}
 * 		if len(fromPackageJsonImports) > 0 {
 * 			return relativePath
 * 		}
 * 	}
 * 
 * 	// Prefer a relative import over a baseUrl import if it has fewer components.
 * 	if isPathRelativeToParent(maybeNonRelative) || CountPathComponents(relativePath) < CountPathComponents(maybeNonRelative) {
 * 		return relativePath
 * 	}
 * 	return maybeNonRelative
 * }
 */
export function getLocalModuleSpecifier(moduleFileName: string, info: Info, compilerOptions: GoPtr<CompilerOptions>, host: ModuleSpecifierGenerationHost, importMode: ResolutionMode, preferences: ModuleSpecifierPreferences, pathsOnly: bool): string {
  const paths = compilerOptions!.Paths;
  const rootDirs = compilerOptions!.RootDirs;

  if (pathsOnly && paths === undefined) {
    return "";
  }

  const sourceDirectory = info.SourceDirectory;

  const allowedEndings = preferences.getAllowedEndingsInPreferredOrder(importMode);
  let relativePath = "";
  if (rootDirs !== undefined && rootDirs.length > 0) {
    relativePath = tryGetModuleNameFromRootDirs(rootDirs, moduleFileName, sourceDirectory, allowedEndings, compilerOptions, host);
  }
  if (relativePath.length === 0) {
    relativePath = processEnding(ensurePathIsNonModuleName(GetRelativePathFromDirectory(sourceDirectory, moduleFileName, {
      UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
      CurrentDirectory: host.GetCurrentDirectory(),
    })), allowedEndings, compilerOptions, host);
  }

  if ((paths === undefined && !CompilerOptions_GetResolvePackageJsonImports(compilerOptions)) || preferences.relativePreference === RelativePreferenceRelative) {
    if (pathsOnly) {
      return "";
    }
    return relativePath;
  }

  const root = CompilerOptions_GetPathsBasePath(compilerOptions, host.GetCurrentDirectory());
  const baseDirectory = tspath.GetNormalizedAbsolutePath(root, host.GetCurrentDirectory());
  const relativeToBaseUrl = getRelativePathIfInSameVolume(moduleFileName, baseDirectory, host.UseCaseSensitiveFileNames());
  if (relativeToBaseUrl.length === 0) {
    if (pathsOnly) {
      return "";
    }
    return relativePath;
  }

  let fromPackageJsonImports = "";
  if (!pathsOnly) {
    fromPackageJsonImports = tryGetModuleNameFromPackageJsonImports(
      moduleFileName,
      sourceDirectory,
      compilerOptions,
      host,
      importMode,
      prefersTsExtension(allowedEndings),
    );
  }

  let fromPaths = "";
  if ((pathsOnly || fromPackageJsonImports.length === 0) && paths !== undefined) {
    fromPaths = tryGetModuleNameFromPaths(relativeToBaseUrl, paths, allowedEndings, baseDirectory, host, compilerOptions);
  }

  if (pathsOnly) {
    return fromPaths;
  }

  const maybeNonRelative = fromPackageJsonImports.length > 0 ? fromPackageJsonImports : fromPaths;
  if (maybeNonRelative.length === 0) {
    return relativePath;
  }

  const relativeIsExcluded = IsExcludedByRegex(relativePath, preferences.excludeRegexes);
  const nonRelativeIsExcluded = IsExcludedByRegex(maybeNonRelative, preferences.excludeRegexes);
  if (!relativeIsExcluded && nonRelativeIsExcluded) {
    return relativePath;
  }
  if (relativeIsExcluded && !nonRelativeIsExcluded) {
    return maybeNonRelative;
  }

  if (preferences.relativePreference === RelativePreferenceNonRelative && !PathIsRelative(maybeNonRelative)) {
    return maybeNonRelative;
  }

  if (preferences.relativePreference === RelativePreferenceExternalNonRelative && !PathIsRelative(maybeNonRelative)) {
    let projectDirectory: Path;
    if (compilerOptions!.ConfigFilePath !== undefined && compilerOptions!.ConfigFilePath.length > 0) {
      projectDirectory = ToPath(GetDirectoryPath(compilerOptions!.ConfigFilePath), host.GetCurrentDirectory(), host.UseCaseSensitiveFileNames());
    } else {
      projectDirectory = ToPath(host.GetCurrentDirectory(), host.GetCurrentDirectory(), host.UseCaseSensitiveFileNames());
    }
    const canonicalSourceDirectory = ToPath(sourceDirectory, host.GetCurrentDirectory(), host.UseCaseSensitiveFileNames());
    const modulePath_ = ToPath(moduleFileName, String(projectDirectory), host.UseCaseSensitiveFileNames());

    const sourceIsInternal = strings.HasPrefix(String(canonicalSourceDirectory), String(projectDirectory));
    const targetIsInternal = strings.HasPrefix(String(modulePath_), String(projectDirectory));
    if ((sourceIsInternal && !targetIsInternal) || (!sourceIsInternal && targetIsInternal)) {
      return maybeNonRelative;
    }

    const nearestTargetPackageJson = host.GetNearestAncestorDirectoryWithPackageJson(GetDirectoryPath(String(modulePath_)));
    const nearestSourcePackageJson = host.GetNearestAncestorDirectoryWithPackageJson(sourceDirectory);

    if (!packageJsonPathsAreEqual(nearestTargetPackageJson, nearestSourcePackageJson, {
      UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
      CurrentDirectory: host.GetCurrentDirectory(),
    })) {
      return maybeNonRelative;
    }
    if (fromPackageJsonImports.length > 0) {
      return relativePath;
    }
  }

  // Prefer a relative import over a baseUrl import if it has fewer components.
  if (isPathRelativeToParent(maybeNonRelative) || CountPathComponents(relativePath) < CountPathComponents(maybeNonRelative)) {
    return relativePath;
  }
  return maybeNonRelative;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::processEnding","kind":"func","status":"implemented","sigHash":"3bf1adc24e522d479f320aad0777024bb067d8cb90270e084d50ec056232d8a9","bodyHash":"c4ce61567693b4e32b05a4f9c61375fa531f4705b6770d9f61a5f970a742abf6"}
 *
 * Go source:
 * func processEnding(
 * 	fileName string,
 * 	allowedEndings []ModuleSpecifierEnding,
 * 	options *core.CompilerOptions,
 * 	host ModuleSpecifierGenerationHost,
 * ) string {
 * 	if tspath.FileExtensionIsOneOf(fileName, []string{tspath.ExtensionJson, tspath.ExtensionMjs, tspath.ExtensionCjs}) {
 * 		return fileName
 * 	}
 * 
 * 	noExtension := tspath.RemoveFileExtension(fileName)
 * 	if fileName == noExtension {
 * 		return fileName
 * 	}
 * 
 * 	jsPriority := slices.Index(allowedEndings, ModuleSpecifierEndingJsExtension)
 * 	tsPriority := slices.Index(allowedEndings, ModuleSpecifierEndingTsExtension)
 * 	if tspath.FileExtensionIsOneOf(fileName, []string{tspath.ExtensionMts, tspath.ExtensionCts}) && tsPriority != -1 && tsPriority < jsPriority {
 * 		return fileName
 * 	}
 * 	if tspath.FileExtensionIsOneOf(fileName, []string{tspath.ExtensionDmts, tspath.ExtensionDcts}) {
 * 		inputExt := tspath.GetDeclarationFileExtension(fileName)
 * 		ext := GetJSExtensionForDeclarationFileExtension(inputExt)
 * 		return tspath.RemoveExtension(fileName, inputExt) + ext
 * 	}
 * 	if tspath.FileExtensionIsOneOf(fileName, []string{tspath.ExtensionMts, tspath.ExtensionCts}) {
 * 		return noExtension + getJSExtensionForFile(fileName, options)
 * 	}
 * 	if !tspath.FileExtensionIsOneOf(fileName, []string{tspath.ExtensionDts}) && tspath.FileExtensionIsOneOf(fileName, []string{tspath.ExtensionTs}) && strings.Contains(fileName, ".d.") {
 * 		// `foo.d.json.ts` and the like - remap back to `foo.json`
 * 		if result := TryGetRealFileNameForNonJSDeclarationFileName(fileName); result != "" {
 * 			return result
 * 		}
 * 	}
 * 
 * 	switch allowedEndings[0] {
 * 	case ModuleSpecifierEndingMinimal:
 * 		withoutIndex := strings.TrimSuffix(noExtension, "/index")
 * 		if host != nil && withoutIndex != noExtension && tryGetAnyFileFromPath(host, withoutIndex) {
 * 			// Can't remove index if there's a file by the same name as the directory.
 * 			// Probably more callers should pass `host` so we can determine this?
 * 			return noExtension
 * 		}
 * 		return withoutIndex
 * 	case ModuleSpecifierEndingIndex:
 * 		return noExtension
 * 	case ModuleSpecifierEndingJsExtension:
 * 		return noExtension + getJSExtensionForFile(fileName, options)
 * 	case ModuleSpecifierEndingTsExtension:
 * 		// For now, we don't know if this import is going to be type-only, which means we don't
 * 		// know if a .d.ts extension is valid, so use no extension or a .js extension
 * 		if tspath.IsDeclarationFileName(fileName) {
 * 			extensionlessPriority := -1
 * 			for i, e := range allowedEndings {
 * 				if e == ModuleSpecifierEndingMinimal || e == ModuleSpecifierEndingIndex {
 * 					extensionlessPriority = i
 * 					break
 * 				}
 * 			}
 * 			if extensionlessPriority != -1 && extensionlessPriority < jsPriority {
 * 				return noExtension
 * 			}
 * 			return noExtension + getJSExtensionForFile(fileName, options)
 * 		}
 * 		return fileName
 * 	default:
 * 		debug.AssertNever(allowedEndings[0])
 * 		return ""
 * 	}
 * }
 */
export function processEnding(fileName: string, allowedEndings: GoSlice<ModuleSpecifierEnding>, options: GoPtr<CompilerOptions>, host: ModuleSpecifierGenerationHost): string {
  if (FileExtensionIsOneOf(fileName, [ExtensionJson, ExtensionMjs, ExtensionCjs])) {
    return fileName;
  }

  const noExtension = RemoveFileExtension(fileName);
  if (fileName === noExtension) {
    return fileName;
  }

  const jsPriority = allowedEndings.indexOf(ModuleSpecifierEndingJsExtension);
  const tsPriority = allowedEndings.indexOf(ModuleSpecifierEndingTsExtension);
  if (FileExtensionIsOneOf(fileName, [ExtensionMts, ExtensionCts]) && tsPriority !== -1 && tsPriority < jsPriority) {
    return fileName;
  }
  if (FileExtensionIsOneOf(fileName, [ExtensionDmts, ExtensionDcts])) {
    const inputExt = GetDeclarationFileExtension(fileName);
    const ext = GetJSExtensionForDeclarationFileExtension(inputExt);
    return RemoveExtension(fileName, inputExt) + ext;
  }
  if (FileExtensionIsOneOf(fileName, [ExtensionMts, ExtensionCts])) {
    return noExtension + getJSExtensionForFile(fileName, options);
  }
  if (!FileExtensionIsOneOf(fileName, [ExtensionDts]) && FileExtensionIsOneOf(fileName, [ExtensionTs]) && strings.Contains(fileName, ".d.")) {
    // `foo.d.json.ts` and the like - remap back to `foo.json`
    const result = TryGetRealFileNameForNonJSDeclarationFileName(fileName);
    if (result !== "") {
      return result;
    }
  }

  switch (allowedEndings[0]) {
    case ModuleSpecifierEndingMinimal: {
      const withoutIndex = strings.TrimSuffix(noExtension, "/index");
      if (host !== undefined && withoutIndex !== noExtension && tryGetAnyFileFromPath(host, withoutIndex)) {
        // Can't remove index if there's a file by the same name as the directory.
        return noExtension;
      }
      return withoutIndex;
    }
    case ModuleSpecifierEndingIndex:
      return noExtension;
    case ModuleSpecifierEndingJsExtension:
      return noExtension + getJSExtensionForFile(fileName, options);
    case ModuleSpecifierEndingTsExtension: {
      // For now, we don't know if this import is going to be type-only, which means we don't
      // know if a .d.ts extension is valid, so use no extension or a .js extension
      if (IsDeclarationFileName(fileName)) {
        let extensionlessPriority = -1;
        for (let i = 0; i < allowedEndings.length; i++) {
          if (allowedEndings[i] === ModuleSpecifierEndingMinimal || allowedEndings[i] === ModuleSpecifierEndingIndex) {
            extensionlessPriority = i;
            break;
          }
        }
        if (extensionlessPriority !== -1 && extensionlessPriority < jsPriority) {
          return noExtension;
        }
        return noExtension + getJSExtensionForFile(fileName, options);
      }
      return fileName;
    }
    default:
      AssertNever(allowedEndings[0]);
      return "";
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::tryGetModuleNameFromRootDirs","kind":"func","status":"implemented","sigHash":"56f3c191ceba44b2d13d8f562ef8ab1b4258747ed4b80b51b91101cc3622b74c","bodyHash":"d5671bd628bcca105272e50dcf7cded92f6913aa236abb9c307fddeeef53e060"}
 *
 * Go source:
 * func tryGetModuleNameFromRootDirs(
 * 	rootDirs []string,
 * 	moduleFileName string,
 * 	sourceDirectory string,
 * 	allowedEndings []ModuleSpecifierEnding,
 * 	compilerOptions *core.CompilerOptions,
 * 	host ModuleSpecifierGenerationHost,
 * ) string {
 * 	normalizedTargetPaths := getPathsRelativeToRootDirs(moduleFileName, rootDirs, host.UseCaseSensitiveFileNames())
 * 	if len(normalizedTargetPaths) == 0 {
 * 		return ""
 * 	}
 * 
 * 	normalizedSourcePaths := getPathsRelativeToRootDirs(sourceDirectory, rootDirs, host.UseCaseSensitiveFileNames())
 * 	var shortest string
 * 	var shortestSepCount int
 * 	for _, sourcePath := range normalizedSourcePaths {
 * 		for _, targetPath := range normalizedTargetPaths {
 * 			candidate := ensurePathIsNonModuleName(tspath.GetRelativePathFromDirectory(sourcePath, targetPath, tspath.ComparePathsOptions{
 * 				UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
 * 				CurrentDirectory:          host.GetCurrentDirectory(),
 * 			}))
 * 			candidateSepCount := strings.Count(candidate, "/")
 * 			if len(shortest) == 0 || candidateSepCount < shortestSepCount {
 * 				shortest = candidate
 * 				shortestSepCount = candidateSepCount
 * 			}
 * 		}
 * 	}
 * 
 * 	if len(shortest) == 0 {
 * 		return ""
 * 	}
 * 	return processEnding(shortest, allowedEndings, compilerOptions, host)
 * }
 */
export function tryGetModuleNameFromRootDirs(rootDirs: GoSlice<string>, moduleFileName: string, sourceDirectory: string, allowedEndings: GoSlice<ModuleSpecifierEnding>, compilerOptions: GoPtr<CompilerOptions>, host: ModuleSpecifierGenerationHost): string {
  const normalizedTargetPaths = getPathsRelativeToRootDirs(moduleFileName, rootDirs, host.UseCaseSensitiveFileNames());
  if (normalizedTargetPaths.length === 0) {
    return "";
  }

  const normalizedSourcePaths = getPathsRelativeToRootDirs(sourceDirectory, rootDirs, host.UseCaseSensitiveFileNames());
  let shortest = "";
  let shortestSepCount = 0;
  for (const sourcePath of normalizedSourcePaths) {
    for (const targetPath of normalizedTargetPaths) {
      const candidate = ensurePathIsNonModuleName(GetRelativePathFromDirectory(sourcePath, targetPath, {
        UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
        CurrentDirectory: host.GetCurrentDirectory(),
      }));
      const candidateSepCount = strings.Count(candidate, "/");
      if (shortest.length === 0 || candidateSepCount < shortestSepCount) {
        shortest = candidate;
        shortestSepCount = candidateSepCount;
      }
    }
  }

  if (shortest.length === 0) {
    return "";
  }
  return processEnding(shortest, allowedEndings, compilerOptions, host);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::tryGetModuleNameAsNodeModule","kind":"func","status":"implemented","sigHash":"94effa29d72c657a282472ffae38f2d857f3bba2508b52933f43138270c5d354","bodyHash":"ccf2c86abac02a5b29fc97976c5f0c362ff9ba52dd3acc1ab2ad0bceb710a70a"}
 *
 * Go source:
 * func tryGetModuleNameAsNodeModule(
 * 	pathObj ModulePath,
 * 	info Info,
 * 	importingSourceFile SourceFileForSpecifierGeneration,
 * 	host ModuleSpecifierGenerationHost,
 * 	options *core.CompilerOptions,
 * 	userPreferences UserPreferences,
 * 	packageNameOnly bool,
 * 	overrideMode core.ResolutionMode,
 * ) string {
 * 	parts := GetNodeModulePathParts(pathObj.FileName)
 * 	if parts == nil {
 * 		return ""
 * 	}
 * 
 * 	// Simplify the full file path to something that can be resolved by Node.
 * 	preferences := getModuleSpecifierPreferences(userPreferences, host, options, importingSourceFile, "")
 * 	allowedEndings := preferences.getAllowedEndingsInPreferredOrder(core.ResolutionModeNone)
 * 
 * 	caseSensitive := host.UseCaseSensitiveFileNames()
 * 	moduleSpecifier := pathObj.FileName
 * 	isPackageRootPath := false
 * 	if !packageNameOnly {
 * 		packageRootIndex := parts.PackageRootIndex
 * 		var moduleFileName string
 * 		for true {
 * 			// If the module could be imported by a directory name, use that directory's name
 * 			pkgJsonResults := tryDirectoryWithPackageJson(
 * 				*parts,
 * 				pathObj,
 * 				importingSourceFile,
 * 				host,
 * 				overrideMode,
 * 				options,
 * 				allowedEndings,
 * 			)
 * 			moduleFileToTry := pkgJsonResults.moduleFileToTry
 * 			packageRootPath := pkgJsonResults.packageRootPath
 * 			blockedByExports := pkgJsonResults.blockedByExports
 * 			verbatimFromExports := pkgJsonResults.verbatimFromExports
 * 			if blockedByExports {
 * 				return "" // File is under this package.json, but is not publicly exported - there's no way to name it via `node_modules` resolution
 * 			}
 * 			if verbatimFromExports {
 * 				return moduleFileToTry
 * 			}
 * 			//}
 * 			if len(packageRootPath) > 0 {
 * 				moduleSpecifier = packageRootPath
 * 				isPackageRootPath = true
 * 				break
 * 			}
 * 			if len(moduleFileName) == 0 {
 * 				moduleFileName = moduleFileToTry
 * 			}
 * 			// try with next level of directory
 * 			packageRootIndex = core.IndexAfter(pathObj.FileName, "/", packageRootIndex+1)
 * 			if packageRootIndex == -1 {
 * 				moduleSpecifier = processEnding(moduleFileName, allowedEndings, options, host)
 * 				break
 * 			}
 * 		}
 * 	}
 * 
 * 	if pathObj.IsRedirect && !isPackageRootPath {
 * 		return ""
 * 	}
 * 
 * 	globalTypingsCacheLocation := host.GetGlobalTypingsCacheLocation()
 * 	// Get a path that's relative to node_modules or the importing file's path
 * 	// if node_modules folder is in this folder or any of its parent folders, no need to keep it.
 * 	pathToTopLevelNodeModules := moduleSpecifier[0:parts.TopLevelNodeModulesIndex]
 * 
 * 	if !stringutil.HasPrefix(info.SourceDirectory, pathToTopLevelNodeModules, caseSensitive) || len(globalTypingsCacheLocation) > 0 && stringutil.HasPrefix(globalTypingsCacheLocation, pathToTopLevelNodeModules, caseSensitive) {
 * 		return ""
 * 	}
 * 
 * 	// If the module was found in @types, get the actual Node package name
 * 	nodeModulesDirectoryName := moduleSpecifier[parts.TopLevelPackageNameIndex+1:]
 * 	return module.GetPackageNameFromTypesPackageName(nodeModulesDirectoryName)
 * }
 */
export function tryGetModuleNameAsNodeModule(pathObj: ModulePath, info: Info, importingSourceFile: SourceFileForSpecifierGeneration, host: ModuleSpecifierGenerationHost, options: GoPtr<CompilerOptions>, userPreferences: UserPreferences, packageNameOnly: bool, overrideMode: ResolutionMode): string {
  const parts = GetNodeModulePathParts(pathObj.FileName);
  if (parts === undefined) {
    return "";
  }

  // Simplify the full file path to something that can be resolved by Node.
  const preferences = getModuleSpecifierPreferences(userPreferences, host, options, importingSourceFile, "");
  const allowedEndings = preferences.getAllowedEndingsInPreferredOrder(ResolutionModeNone);

  const caseSensitive = host.UseCaseSensitiveFileNames();
  let moduleSpecifier = pathObj.FileName;
  let isPackageRootPath = false;
  if (!packageNameOnly) {
    let packageRootIndex = parts.PackageRootIndex;
    let moduleFileName = "";
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // If the module could be imported by a directory name, use that directory's name
      const pkgJsonResults = tryDirectoryWithPackageJson(parts, pathObj, importingSourceFile, host, overrideMode, options, allowedEndings);
      const moduleFileToTry = pkgJsonResults.moduleFileToTry;
      const packageRootPath = pkgJsonResults.packageRootPath;
      const blockedByExports = pkgJsonResults.blockedByExports;
      const verbatimFromExports = pkgJsonResults.verbatimFromExports;
      if (blockedByExports) {
        return ""; // File is under this package.json, but is not publicly exported
      }
      if (verbatimFromExports) {
        return moduleFileToTry;
      }
      if (packageRootPath.length > 0) {
        moduleSpecifier = packageRootPath;
        isPackageRootPath = true;
        break;
      }
      if (moduleFileName.length === 0) {
        moduleFileName = moduleFileToTry;
      }
      // try with next level of directory
      packageRootIndex = IndexAfter(pathObj.FileName, "/", packageRootIndex + 1);
      if (packageRootIndex === -1) {
        moduleSpecifier = processEnding(moduleFileName, allowedEndings, options, host);
        break;
      }
    }
  }

  if (pathObj.IsRedirect && !isPackageRootPath) {
    return "";
  }

  const globalTypingsCacheLocation = host.GetGlobalTypingsCacheLocation();
  // Get a path that's relative to node_modules or the importing file's path
  // if node_modules folder is in this folder or any of its parent folders, no need to keep it.
  const pathToTopLevelNodeModules = moduleSpecifier.slice(0, parts.TopLevelNodeModulesIndex);

  if (!stringutilHasPrefix(info.SourceDirectory, pathToTopLevelNodeModules, caseSensitive) ||
    (globalTypingsCacheLocation.length > 0 && stringutilHasPrefix(globalTypingsCacheLocation, pathToTopLevelNodeModules, caseSensitive))) {
    return "";
  }

  // If the module was found in @types, get the actual Node package name
  const nodeModulesDirectoryName = moduleSpecifier.slice(parts.TopLevelPackageNameIndex + 1);
  return GetPackageNameFromTypesPackageName(nodeModulesDirectoryName);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::type::pkgJsonDirAttemptResult","kind":"type","status":"implemented","sigHash":"f2ded6c6bf537ddeb47c8cd80e94af121b1199f225cb89ea3a7523bcd514775a","bodyHash":"70ff71664f21fe7adf73e3137c0029e4705324247f8853c625a20855a98b8e0d"}
 *
 * Go source:
 * pkgJsonDirAttemptResult struct {
 * 	moduleFileToTry     string
 * 	packageRootPath     string
 * 	blockedByExports    bool
 * 	verbatimFromExports bool
 * }
 */
export interface pkgJsonDirAttemptResult {
  moduleFileToTry: string;
  packageRootPath: string;
  blockedByExports: bool;
  verbatimFromExports: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::tryDirectoryWithPackageJson","kind":"func","status":"implemented","sigHash":"3aef2489b80213acbe5700e53ec88657ba1e30bf0ed08f69f475a54cc894e697","bodyHash":"b442e4835a9459e504f175160890d1c684ecd4a24f66de5a3c55254c3c224986"}
 *
 * Go source:
 * func tryDirectoryWithPackageJson(
 * 	parts NodeModulePathParts,
 * 	pathObj ModulePath,
 * 	importingSourceFile SourceFileForSpecifierGeneration,
 * 	host ModuleSpecifierGenerationHost,
 * 	overrideMode core.ResolutionMode,
 * 	options *core.CompilerOptions,
 * 	allowedEndings []ModuleSpecifierEnding,
 * ) pkgJsonDirAttemptResult {
 * 	rootIdx := parts.PackageRootIndex
 * 	if rootIdx == -1 {
 * 		rootIdx = len(pathObj.FileName) // TODO: possible strada bug? -1 in js slice removes characters from the end, in go it panics - js behavior seems unwanted here?
 * 	}
 * 	packageRootPath := pathObj.FileName[0:rootIdx]
 * 	packageJsonPath := tspath.CombinePaths(packageRootPath, "package.json")
 * 	moduleFileToTry := pathObj.FileName
 * 	maybeBlockedByTypesVersions := false
 * 	packageJson := host.GetPackageJsonInfo(packageJsonPath)
 * 	if packageJson == nil {
 * 		// No package.json exists; an index.js will still resolve as the package name
 * 		fileName := moduleFileToTry[parts.PackageRootIndex+1:]
 * 		if fileName == "index.d.ts" || fileName == "index.js" || fileName == "index.ts" || fileName == "index.tsx" {
 * 			return pkgJsonDirAttemptResult{moduleFileToTry: moduleFileToTry, packageRootPath: packageRootPath}
 * 		} else {
 * 			return pkgJsonDirAttemptResult{moduleFileToTry: moduleFileToTry}
 * 		}
 * 	}
 * 
 * 	importMode := overrideMode
 * 	if importMode == core.ResolutionModeNone {
 * 		importMode = host.GetDefaultResolutionModeForFile(importingSourceFile)
 * 	}
 * 
 * 	packageJsonContent := packageJson.GetContents()
 * 	if options.GetResolvePackageJsonExports() {
 * 		// The package name that we found in node_modules could be different from the package
 * 		// name in the package.json content via url/filepath dependency specifiers. We need to
 * 		// use the actual directory name, so don't look at `packageJsonContent.name` here.
 * 		nodeModulesDirectoryName := packageRootPath[parts.TopLevelPackageNameIndex+1:]
 * 		packageName := module.GetPackageNameFromTypesPackageName(nodeModulesDirectoryName)
 * 
 * 		// Determine resolution mode for package.json exports condition matching.
 * 		// TypeScript's tryDirectoryWithPackageJson uses the importing file's mode (moduleSpecifiers.ts:1257),
 * 		// but this causes incorrect exports resolution. We fix this by checking the target file's extension
 * 		// using the logic from getImpliedNodeFormatForEmitWorker (program.ts:4827-4838).
 * 		// .cjs/.cts/.d.cts → CommonJS → "require" condition
 * 		// .mjs/.mts/.d.mts → ESM → "import" condition
 * 		if tspath.FileExtensionIsOneOf(pathObj.FileName, []string{tspath.ExtensionCjs, tspath.ExtensionCts, tspath.ExtensionDcts}) {
 * 			importMode = core.ResolutionModeCommonJS
 * 		} else if tspath.FileExtensionIsOneOf(pathObj.FileName, []string{tspath.ExtensionMjs, tspath.ExtensionMts, tspath.ExtensionDmts}) {
 * 			importMode = core.ResolutionModeESM
 * 		}
 * 
 * 		conditions := module.GetConditions(options, importMode)
 * 
 * 		var fromExports string
 * 		if packageJsonContent != nil && packageJsonContent.Fields.Exports.Type != packagejson.JSONValueTypeNotPresent {
 * 			fromExports = tryGetModuleNameFromExports(
 * 				options,
 * 				host,
 * 				pathObj.FileName,
 * 				packageRootPath,
 * 				packageName,
 * 				packageJsonContent.Fields.Exports,
 * 				conditions,
 * 			)
 * 		}
 * 		if len(fromExports) > 0 {
 * 			return pkgJsonDirAttemptResult{
 * 				moduleFileToTry:     fromExports,
 * 				verbatimFromExports: true,
 * 			}
 * 		}
 * 		if packageJsonContent != nil && packageJsonContent.Fields.Exports.Type != packagejson.JSONValueTypeNotPresent {
 * 			return pkgJsonDirAttemptResult{
 * 				moduleFileToTry:  pathObj.FileName,
 * 				blockedByExports: true,
 * 			}
 * 		}
 * 	}
 * 
 * 	var versionPaths packagejson.VersionPaths
 * 	if packageJsonContent != nil && packageJsonContent.TypesVersions.Type == packagejson.JSONValueTypeObject {
 * 		versionPaths = packageJsonContent.GetVersionPaths(nil)
 * 	}
 * 	if versionPaths.GetPaths() != nil {
 * 		subModuleName := pathObj.FileName[len(packageRootPath)+1:]
 * 		fromPaths := tryGetModuleNameFromPaths(
 * 			subModuleName,
 * 			versionPaths.GetPaths(),
 * 			allowedEndings,
 * 			packageRootPath,
 * 			host,
 * 			options,
 * 		)
 * 		if len(fromPaths) == 0 {
 * 			maybeBlockedByTypesVersions = true
 * 		} else {
 * 			moduleFileToTry = tspath.CombinePaths(packageRootPath, fromPaths)
 * 		}
 * 	}
 * 	// If the file is the main module, it can be imported by the package name
 * 	mainFileRelative := "index.js"
 * 	if packageJsonContent != nil {
 * 		if packageJsonContent.Typings.Valid {
 * 			mainFileRelative = packageJsonContent.Typings.Value
 * 		} else if packageJsonContent.Types.Valid {
 * 			mainFileRelative = packageJsonContent.Types.Value
 * 		} else if packageJsonContent.Main.Valid {
 * 			mainFileRelative = packageJsonContent.Main.Value
 * 		}
 * 	}
 * 
 * 	if len(mainFileRelative) > 0 && !(maybeBlockedByTypesVersions && module.MatchPatternOrExact(module.TryParsePatterns(versionPaths.GetPaths()), mainFileRelative) != core.Pattern{}) {
 * 		// The 'main' file is also subject to mapping through typesVersions, and we couldn't come up with a path
 * 		// explicitly through typesVersions, so if it matches a key in typesVersions now, it's not reachable.
 * 		// (The only way this can happen is if some file in a package that's not resolvable from outside the
 * 		// package got pulled into the program anyway, e.g. transitively through a file that *is* reachable. It
 * 		// happens very easily in fourslash tests though, since every test file listed gets included. See
 * 		// importNameCodeFix_typesVersions.ts for an example.)
 * 		mainExportFile := tspath.ToPath(mainFileRelative, packageRootPath, host.UseCaseSensitiveFileNames())
 * 		compareOpt := tspath.ComparePathsOptions{
 * 			UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
 * 			CurrentDirectory:          host.GetCurrentDirectory(),
 * 		}
 * 		if tspath.ComparePaths(tspath.RemoveFileExtension(string(mainExportFile)), tspath.RemoveFileExtension(moduleFileToTry), compareOpt) == 0 {
 * 			// ^ An arbitrary removal of file extension for this comparison is almost certainly wrong
 * 			return pkgJsonDirAttemptResult{packageRootPath: packageRootPath, moduleFileToTry: moduleFileToTry}
 * 		} else if packageJsonContent == nil || packageJsonContent.Type.Value != "module" &&
 * 			!tspath.FileExtensionIsOneOf(moduleFileToTry, tspath.ExtensionsNotSupportingExtensionlessResolution) &&
 * 			stringutil.HasPrefix(moduleFileToTry, string(mainExportFile), host.UseCaseSensitiveFileNames()) &&
 * 			tspath.ComparePaths(tspath.GetDirectoryPath(moduleFileToTry), tspath.RemoveTrailingDirectorySeparator(string(mainExportFile)), compareOpt) == 0 &&
 * 			tspath.RemoveFileExtension(tspath.GetBaseFileName(moduleFileToTry)) == "index" {
 * 			// if mainExportFile is a directory, which contains moduleFileToTry, we just try index file
 * 			// example mainExportFile: `pkg/lib` and moduleFileToTry: `pkg/lib/index`, we can use packageRootPath
 * 			// but this behavior is deprecated for packages with "type": "module", so we only do this for packages without "type": "module"
 * 			// and make sure that the extension on index.{???} is something that supports omitting the extension
 * 			return pkgJsonDirAttemptResult{packageRootPath: packageRootPath, moduleFileToTry: moduleFileToTry}
 * 		}
 * 	}
 * 
 * 	return pkgJsonDirAttemptResult{moduleFileToTry: moduleFileToTry}
 * }
 */
export function tryDirectoryWithPackageJson(parts: NodeModulePathParts, pathObj: ModulePath, importingSourceFile: SourceFileForSpecifierGeneration, host: ModuleSpecifierGenerationHost, overrideMode: ResolutionMode, options: GoPtr<CompilerOptions>, allowedEndings: GoSlice<ModuleSpecifierEnding>): pkgJsonDirAttemptResult {
  const rootIdx = parts.PackageRootIndex === -1 ? pathObj.FileName.length : parts.PackageRootIndex;
  const packageRootPath = pathObj.FileName.slice(0, rootIdx);
  const packageJsonPath = CombinePaths(packageRootPath, "package.json");
  const moduleFileToTryInit = pathObj.FileName;
  const packageJson = host.GetPackageJsonInfo(packageJsonPath);
  if (packageJson === undefined) {
    // No package.json exists; an index.js will still resolve as the package name
    const fileName = pathObj.FileName.slice(parts.PackageRootIndex + 1);
    if (fileName === "index.d.ts" || fileName === "index.js" || fileName === "index.ts" || fileName === "index.tsx") {
      return { moduleFileToTry: moduleFileToTryInit, packageRootPath, blockedByExports: false, verbatimFromExports: false };
    } else {
      return { moduleFileToTry: moduleFileToTryInit, packageRootPath: "", blockedByExports: false, verbatimFromExports: false };
    }
  }

  const importModeInit = overrideMode === ResolutionModeNone ? host.GetDefaultResolutionModeForFile(importingSourceFile) : overrideMode;

  const packageJsonContent = InfoCacheEntry_GetContents(packageJson);
  const packageJsonHeaderFields = PackageJson_GetHeaderFields(packageJsonContent);
  const packageJsonPathFields = PackageJson_GetPathFields(packageJsonContent);
  let importMode = importModeInit;
  if (CompilerOptions_GetResolvePackageJsonExports(options)) {
    const nodeModulesDirectoryName = packageRootPath.slice(parts.TopLevelPackageNameIndex + 1);
    const packageName = GetPackageNameFromTypesPackageName(nodeModulesDirectoryName);

    if (FileExtensionIsOneOf(pathObj.FileName, [ExtensionCjs, ExtensionCts, ExtensionDcts])) {
      importMode = ResolutionModeCommonJS;
    } else if (FileExtensionIsOneOf(pathObj.FileName, [ExtensionMjs, ExtensionMts, ExtensionDmts])) {
      importMode = ResolutionModeESM;
    }

    const conditions = GetConditions(options, importMode);

    if (packageJsonContent !== undefined && packageJsonPathFields.Exports.__tsgoEmbedded0!.Type !== JSONValueTypeNotPresent) {
      const fromExports = tryGetModuleNameFromExports(
        options,
        host,
        pathObj.FileName,
        packageRootPath,
        packageName,
        packageJsonPathFields.Exports,
        conditions,
      );
      if (fromExports.length > 0) {
        return { moduleFileToTry: fromExports, packageRootPath: "", blockedByExports: false, verbatimFromExports: true };
      }
      return { moduleFileToTry: pathObj.FileName, packageRootPath: "", blockedByExports: true, verbatimFromExports: false };
    }
  }

  let moduleFileToTry = moduleFileToTryInit;
  let maybeBlockedByTypesVersions = false;
  if (packageJsonContent !== undefined && packageJsonPathFields.TypesVersions.Type === JSONValueTypeObject) {
    const versionPaths = PackageJson_GetVersionPaths(packageJsonContent, (_m, ..._args) => {});
    const paths = VersionPaths_GetPaths(versionPaths);
    if (paths !== undefined) {
      const subModuleName = pathObj.FileName.slice(packageRootPath.length + 1);
      const fromPaths = tryGetModuleNameFromPaths(
        subModuleName,
        paths,
        allowedEndings,
        packageRootPath,
        host,
        options,
      );
      if (fromPaths.length === 0) {
        maybeBlockedByTypesVersions = true;
      } else {
        moduleFileToTry = CombinePaths(packageRootPath, fromPaths);
      }
    }
  }

  // If the file is the main module, it can be imported by the package name
  let mainFileRelative = "index.js";
  if (packageJsonContent !== undefined) {
    if (packageJsonPathFields.Typings.Valid) {
      mainFileRelative = packageJsonPathFields.Typings.Value;
    } else if (packageJsonPathFields.Types.Valid) {
      mainFileRelative = packageJsonPathFields.Types.Value;
    } else if (packageJsonPathFields.Main.Valid) {
      mainFileRelative = packageJsonPathFields.Main.Value;
    }
  }

  if (mainFileRelative.length > 0) {
    const versionPaths2 = packageJsonContent !== undefined && packageJsonPathFields.TypesVersions.Type === JSONValueTypeObject
      ? PackageJson_GetVersionPaths(packageJsonContent, (_m, ..._args) => {})
      : undefined;
    const vpPaths2 = versionPaths2 !== undefined ? VersionPaths_GetPaths(versionPaths2) : undefined;
    const blockedByTypesVersions = maybeBlockedByTypesVersions && vpPaths2 !== undefined &&
      Pattern_IsValid(MatchPatternOrExact(TryParsePatterns(vpPaths2), mainFileRelative));
    if (!blockedByTypesVersions) {
      const mainExportFile = ToPath(mainFileRelative, packageRootPath, host.UseCaseSensitiveFileNames());
      const compareOpt: ComparePathsOptions = {
        UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
        CurrentDirectory: host.GetCurrentDirectory(),
      };
      if (ComparePaths(RemoveFileExtension(mainExportFile as string), RemoveFileExtension(moduleFileToTry), compareOpt) === 0) {
        return { packageRootPath, moduleFileToTry, blockedByExports: false, verbatimFromExports: false };
      } else if ((packageJsonContent === undefined || (packageJsonHeaderFields.Type.Value !== "module" &&
        !FileExtensionIsOneOf(moduleFileToTry, ExtensionsNotSupportingExtensionlessResolution) &&
        stringutilHasPrefix(moduleFileToTry, mainExportFile as string, host.UseCaseSensitiveFileNames()) &&
        ComparePaths(GetDirectoryPath(moduleFileToTry), RemoveTrailingDirectorySeparator(mainExportFile as string), compareOpt) === 0 &&
        RemoveFileExtension(GetBaseFileName(moduleFileToTry)) === "index"))) {
        return { packageRootPath, moduleFileToTry, blockedByExports: false, verbatimFromExports: false };
      }
    }
  }

  return { moduleFileToTry, packageRootPath: "", blockedByExports: false, verbatimFromExports: false };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::tryGetModuleNameFromExports","kind":"func","status":"implemented","sigHash":"407e8d116cf2c6786dfea608c488faa5d3be87f4cc47dfbaf3a18a6a48d8c4fc","bodyHash":"7b10362bd7c7494276f02236599a34738c0158fdf207fa3b8b443ae6e9d2bf28"}
 *
 * Go source:
 * func tryGetModuleNameFromExports(
 * 	options *core.CompilerOptions,
 * 	host ModuleSpecifierGenerationHost,
 * 	targetFilePath string,
 * 	packageDirectory string,
 * 	packageName string,
 * 	exports packagejson.ExportsOrImports,
 * 	conditions []string,
 * ) string {
 * 	if exports.IsSubpaths() {
 * 		// sub-mappings
 * 		// 3 cases:
 * 		// * directory mappings (legacyish, key ends with / (technically allows index/extension resolution under cjs mode))
 * 		// * pattern mappings (contains a *)
 * 		// * exact mappings (no *, does not end with /)
 * 		for k, subk := range exports.AsObject().Entries() {
 * 			subPackageName := tspath.GetNormalizedAbsolutePath(tspath.CombinePaths(packageName, k), "")
 * 			mode := MatchingModeExact
 * 			if strings.HasSuffix(k, "/") {
 * 				mode = MatchingModeDirectory
 * 			} else if strings.Contains(k, "*") {
 * 				mode = MatchingModePattern
 * 			}
 * 			result := tryGetModuleNameFromExportsOrImports(options, host, targetFilePath, packageDirectory, subPackageName, subk, conditions, mode /*isImports* /, false /*preferTsExtension* /, false)
 * 			if len(result) > 0 {
 * 				return result
 * 			}
 * 		}
 * 	}
 * 	return tryGetModuleNameFromExportsOrImports(
 * 		options,
 * 		host,
 * 		targetFilePath,
 * 		packageDirectory,
 * 		packageName,
 * 		exports,
 * 		conditions,
 * 		MatchingModeExact,
 * 		/*isImports* / false,
 * 		/*preferTsExtension* / false,
 * 	)
 * }
 */
export function tryGetModuleNameFromExports(options: GoPtr<CompilerOptions>, host: ModuleSpecifierGenerationHost, targetFilePath: string, packageDirectory: string, packageName: string, exports: ExportsOrImports, conditions: GoSlice<string>): string {
  if (ExportsOrImports_IsSubpaths(exports)) {
    const obj = ExportsOrImports_AsObject(exports);
    let result = "";
    OrderedMap_Entries(obj as GoPtr<OrderedMap<string, ExportsOrImports>>)((k, subk) => {
      const subPackageName = GetNormalizedAbsolutePath(CombinePaths(packageName, k), "");
      const mode = strings.HasSuffix(k, "/") ? MatchingModeDirectory : strings.Contains(k, "*") ? MatchingModePattern : MatchingModeExact;
      result = tryGetModuleNameFromExportsOrImports(options, host, targetFilePath, packageDirectory, subPackageName, subk, conditions, mode, false, false);
      if (result.length > 0) {
        return false; // break
      }
      return true; // continue
    });
    if (result.length > 0) {
      return result;
    }
  }
  return tryGetModuleNameFromExportsOrImports(
    options,
    host,
    targetFilePath,
    packageDirectory,
    packageName,
    exports,
    conditions,
    MatchingModeExact,
    false,
    false,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::tryGetModuleNameFromPackageJsonImports","kind":"func","status":"implemented","sigHash":"5f50ae81233fdf6a5cd8406c5bb69d10ec8151cf5f857489cbc9b7ab1bbbe4fa","bodyHash":"4385b677685e3d9d132434d1b700fc4b8304ee0dff8cd1eb307e8ed97f3fdbc3"}
 *
 * Go source:
 * func tryGetModuleNameFromPackageJsonImports(
 * 	moduleFileName string,
 * 	sourceDirectory string,
 * 	options *core.CompilerOptions,
 * 	host ModuleSpecifierGenerationHost,
 * 	importMode core.ResolutionMode,
 * 	preferTsExtension bool,
 * ) string {
 * 	if !options.GetResolvePackageJsonImports() {
 * 		return ""
 * 	}
 * 
 * 	ancestorDirectoryWithPackageJson := host.GetNearestAncestorDirectoryWithPackageJson(sourceDirectory)
 * 	if len(ancestorDirectoryWithPackageJson) == 0 {
 * 		return ""
 * 	}
 * 	packageJsonPath := tspath.CombinePaths(ancestorDirectoryWithPackageJson, "package.json")
 * 
 * 	info := host.GetPackageJsonInfo(packageJsonPath)
 * 	if info == nil {
 * 		return ""
 * 	}
 * 
 * 	imports := info.GetContents().Fields.Imports
 * 	switch imports.Type {
 * 	case packagejson.JSONValueTypeNotPresent, packagejson.JSONValueTypeArray, packagejson.JSONValueTypeString:
 * 		return "" // not present or invalid for imports
 * 	case packagejson.JSONValueTypeObject:
 * 		conditions := module.GetConditions(options, importMode)
 * 		top := imports.AsObject()
 * 		entries := top.Entries()
 * 		for k, value := range entries {
 * 			if k == "#" || k == "#/" || !strings.HasPrefix(k, "#") {
 * 				continue // invalid imports entry
 * 			}
 * 			if strings.HasPrefix(k, "#/") && options.GetModuleResolutionKind() != core.ModuleResolutionKindNodeNext && options.GetModuleResolutionKind() != core.ModuleResolutionKindBundler {
 * 				continue // "#/" imports keys are only valid in nodenext/bundler
 * 			}
 * 			mode := MatchingModeExact
 * 			if strings.HasSuffix(k, "/") {
 * 				mode = MatchingModeDirectory
 * 			} else if strings.Contains(k, "*") {
 * 				mode = MatchingModePattern
 * 			}
 * 			result := tryGetModuleNameFromExportsOrImports(
 * 				options,
 * 				host,
 * 				moduleFileName,
 * 				ancestorDirectoryWithPackageJson,
 * 				k,
 * 				value,
 * 				conditions,
 * 				mode,
 * 				true,
 * 				preferTsExtension,
 * 			)
 * 			if len(result) > 0 {
 * 				return result
 * 			}
 * 		}
 * 	}
 * 
 * 	return ""
 * }
 */
export function tryGetModuleNameFromPackageJsonImports(moduleFileName: string, sourceDirectory: string, options: GoPtr<CompilerOptions>, host: ModuleSpecifierGenerationHost, importMode: ResolutionMode, preferTsExtension: bool): string {
  if (!CompilerOptions_GetResolvePackageJsonImports(options)) {
    return "";
  }

  const ancestorDirectoryWithPackageJson = host.GetNearestAncestorDirectoryWithPackageJson(sourceDirectory);
  if (ancestorDirectoryWithPackageJson.length === 0) {
    return "";
  }
  const packageJsonPath = CombinePaths(ancestorDirectoryWithPackageJson, "package.json");

  const info = host.GetPackageJsonInfo(packageJsonPath);
  if (info === undefined) {
    return "";
  }

  const contents = InfoCacheEntry_GetContents(info);
  const imports = PackageJson_GetPathFields(contents).Imports;
  if (imports.__tsgoEmbedded0 === undefined) {
    return "";
  }

  switch (imports.__tsgoEmbedded0!.Type) {
    case JSONValueTypeNotPresent:
    case JSONValueTypeArray:
    case JSONValueTypeString:
      return ""; // not present or invalid for imports
    case JSONValueTypeObject: {
      const conditions = GetConditions(options, importMode);
      const top = ExportsOrImports_AsObject(imports);
      let result = "";
      OrderedMap_Entries(top as GoPtr<OrderedMap<string, ExportsOrImports>>)((k, value) => {
        if (k === "#" || k === "#/" || !strings.HasPrefix(k, "#")) {
          return true; // continue
        }
        if (strings.HasPrefix(k, "#/") &&
          CompilerOptions_GetModuleResolutionKind(options) !== ModuleResolutionKindNodeNext &&
          CompilerOptions_GetModuleResolutionKind(options) !== ModuleResolutionKindBundler) {
          return true; // continue
        }
        const mode = strings.HasSuffix(k, "/") ? MatchingModeDirectory : strings.Contains(k, "*") ? MatchingModePattern : MatchingModeExact;
        result = tryGetModuleNameFromExportsOrImports(
          options,
          host,
          moduleFileName,
          ancestorDirectoryWithPackageJson,
          k,
          value,
          conditions,
          mode,
          true,
          preferTsExtension,
        );
        if (result.length > 0) {
          return false; // break
        }
        return true; // continue
      });
      return result;
    }
  }

  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::type::specPair","kind":"type","status":"implemented","sigHash":"523426c96d6c554e07f74e909eaa93c612fed4655c70e387aff8ba9180f0c226","bodyHash":"6dfba63ef847f0df9a90283d7df9ebafefd6e9262e7b4fb1b7b63cd7a9ae6dae"}
 *
 * Go source:
 * specPair struct {
 * 	ending ModuleSpecifierEnding
 * 	value  string
 * }
 */
export interface specPair {
  ending: ModuleSpecifierEnding;
  value: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::tryGetModuleNameFromPaths","kind":"func","status":"implemented","sigHash":"155bd2b8ba1b306cd53470a3c220c22ce3de39f28616c46ad781613dc66e09cb","bodyHash":"fd4e6ad6e1d6d52402bac0676d26f681d1aa9c187c402d9cceb46d56836982d1"}
 *
 * Go source:
 * func tryGetModuleNameFromPaths(
 * 	relativeToBaseUrl string,
 * 	paths *collections.OrderedMap[string, []string],
 * 	allowedEndings []ModuleSpecifierEnding,
 * 	baseDirectory string,
 * 	host ModuleSpecifierGenerationHost,
 * 	compilerOptions *core.CompilerOptions,
 * ) string {
 * 	caseSensitive := host.UseCaseSensitiveFileNames()
 * 	for key, values := range paths.Entries() {
 * 		for _, patternText := range values {
 * 			normalized := tspath.NormalizePath(patternText)
 * 			pattern := getRelativePathIfInSameVolume(normalized, baseDirectory, caseSensitive)
 * 			if len(pattern) == 0 {
 * 				pattern = normalized
 * 			}
 * 			prefix, suffix, ok := strings.Cut(pattern, "*")
 * 
 * 			// In module resolution, if `pattern` itself has an extension, a file with that extension is looked up directly,
 * 			// meaning a '.ts' or '.d.ts' extension is allowed to resolve. This is distinct from the case where a '*' substitution
 * 			// causes a module specifier to have an extension, i.e. the extension comes from the module specifier in a JS/TS file
 * 			// and matches the '*'. For example:
 * 			//
 * 			// Module Specifier      | Path Mapping (key: [pattern]) | Interpolation       | Resolution Action
 * 			// ---------------------->------------------------------->--------------------->---------------------------------------------------------------
 * 			// import "@app/foo"    -> "@app/*": ["./src/app/*.ts"] -> "./src/app/foo.ts" -> tryFile("./src/app/foo.ts") || [continue resolution algorithm]
 * 			// import "@app/foo.ts" -> "@app/*": ["./src/app/*"]    -> "./src/app/foo.ts" -> [continue resolution algorithm]
 * 			//
 * 			// (https://github.com/microsoft/TypeScript/blob/ad4ded80e1d58f0bf36ac16bea71bc10d9f09895/src/compiler/moduleNameResolver.ts#L2509-L2516)
 * 			//
 * 			// The interpolation produced by both scenarios is identical, but only in the former, where the extension is encoded in
 * 			// the path mapping rather than in the module specifier, will we prioritize a file lookup on the interpolation result.
 * 			// (In fact, currently, the latter scenario will necessarily fail since no resolution mode recognizes '.ts' as a valid
 * 			// extension for a module specifier.)
 * 			//
 * 			// Here, this means we need to be careful about whether we generate a match from the target filename (typically with a
 * 			// .ts extension) or the possible relative module specifiers representing that file:
 * 			//
 * 			// Filename            | Relative Module Specifier Candidates         | Path Mapping                 | Filename Result    | Module Specifier Results
 * 			// --------------------<----------------------------------------------<------------------------------<-------------------||----------------------------
 * 			// dist/haha.d.ts      <- dist/haha, dist/haha.js                     <- "@app/*": ["./dist/*.d.ts"] <- @app/haha        || (none)
 * 			// dist/haha.d.ts      <- dist/haha, dist/haha.js                     <- "@app/*": ["./dist/*"]      <- (none)           || @app/haha, @app/haha.js
 * 			// dist/foo/index.d.ts <- dist/foo, dist/foo/index, dist/foo/index.js <- "@app/*": ["./dist/*.d.ts"] <- @app/foo/index   || (none)
 * 			// dist/foo/index.d.ts <- dist/foo, dist/foo/index, dist/foo/index.js <- "@app/*": ["./dist/*"]      <- (none)           || @app/foo, @app/foo/index, @app/foo/index.js
 * 			// dist/wow.js.js      <- dist/wow.js, dist/wow.js.js                 <- "@app/*": ["./dist/*.js"]   <- @app/wow.js      || @app/wow, @app/wow.js
 * 			//
 * 			// The "Filename Result" can be generated only if `pattern` has an extension. Care must be taken that the list of
 * 			// relative module specifiers to run the interpolation (a) is actually valid for the module resolution mode, (b) takes
 * 			// into account the existence of other files (e.g. 'dist/wow.js' cannot refer to 'dist/wow.js.js' if 'dist/wow.js'
 * 			// exists) and (c) that they are ordered by preference. The last row shows that the filename result and module
 * 			// specifier results are not mutually exclusive. Note that the filename result is a higher priority in module
 * 			// resolution, but as long criteria (b) above is met, I don't think its result needs to be the highest priority result
 * 			// in module specifier generation. I have included it last, as it's difficult to tell exactly where it should be
 * 			// sorted among the others for a particular value of `importModuleSpecifierEnding`.
 * 
 * 			var candidates []specPair
 * 			for _, ending := range allowedEndings {
 * 				result := processEnding(
 * 					relativeToBaseUrl,
 * 					[]ModuleSpecifierEnding{ending},
 * 					compilerOptions,
 * 					host,
 * 				)
 * 				candidates = append(candidates, specPair{
 * 					ending: ending,
 * 					value:  result,
 * 				})
 * 			}
 * 			if len(tspath.TryGetExtensionFromPath(pattern)) > 0 {
 * 				candidates = append(candidates, specPair{
 * 					ending: ModuleSpecifierEndingJsExtension,
 * 					value:  relativeToBaseUrl,
 * 				})
 * 			}
 * 
 * 			if ok {
 * 				for _, c := range candidates {
 * 					value := c.value
 * 					if len(value) >= len(prefix)+len(suffix) &&
 * 						stringutil.HasPrefix(value, prefix, caseSensitive) && // TODO: possible strada bug: these are not case-switched in strada
 * 						stringutil.HasSuffix(value, suffix, caseSensitive) &&
 * 						validateEnding(c, relativeToBaseUrl, compilerOptions, host) {
 * 						matchedStar := value[len(prefix) : len(value)-len(suffix)]
 * 						if !tspath.PathIsRelative(matchedStar) {
 * 							return replaceFirstStar(key, matchedStar)
 * 						}
 * 					}
 * 				}
 * 			} else if core.Some(candidates, func(c specPair) bool { return c.ending != ModuleSpecifierEndingMinimal && pattern == c.value }) ||
 * 				core.Some(candidates, func(c specPair) bool {
 * 					return c.ending == ModuleSpecifierEndingMinimal && pattern == c.value && validateEnding(c, relativeToBaseUrl, compilerOptions, host)
 * 				}) {
 * 				return key
 * 			}
 * 		}
 * 	}
 * 	return ""
 * }
 */
export function tryGetModuleNameFromPaths(relativeToBaseUrl: string, paths: GoPtr<OrderedMap>, allowedEndings: GoSlice<ModuleSpecifierEnding>, baseDirectory: string, host: ModuleSpecifierGenerationHost, compilerOptions: GoPtr<CompilerOptions>): string {
  const caseSensitive = host.UseCaseSensitiveFileNames();
  let finalResult = "";
  OrderedMap_Entries(paths as GoPtr<OrderedMap<string, GoSlice<string>>>)((key, values) => {
    for (const patternText of values) {
      const normalized = NormalizePath(patternText);
      const patternRel = getRelativePathIfInSameVolume(normalized, baseDirectory, caseSensitive);
      const pattern = patternRel.length > 0 ? patternRel : normalized;
      const [prefix, suffix, ok] = strings.Cut(pattern, "*");

      const candidates: specPair[] = [];
      for (const ending of allowedEndings) {
        const result = processEnding(
          relativeToBaseUrl,
          [ending],
          compilerOptions,
          host,
        );
        candidates.push({ ending, value: result });
      }
      if (TryGetExtensionFromPath(pattern).length > 0) {
        candidates.push({ ending: ModuleSpecifierEndingJsExtension, value: relativeToBaseUrl });
      }

      if (ok) {
        for (const c of candidates) {
          const value = c.value;
          if (value.length >= prefix.length + suffix.length &&
            stringutilHasPrefix(value, prefix, caseSensitive) &&
            stringutilHasSuffix(value, suffix, caseSensitive) &&
            validateEnding(c, relativeToBaseUrl, compilerOptions, host)) {
            const matchedStar = value.slice(prefix.length, value.length - suffix.length);
            if (!PathIsRelative(matchedStar)) {
              finalResult = replaceFirstStar(key, matchedStar);
              return false; // break outer
            }
          }
        }
      } else if (Some(candidates, (c: specPair) => c.ending !== ModuleSpecifierEndingMinimal && pattern === c.value) ||
        Some(candidates, (c: specPair) => c.ending === ModuleSpecifierEndingMinimal && pattern === c.value && validateEnding(c, relativeToBaseUrl, compilerOptions, host))) {
        finalResult = key;
        return false; // break outer
      }
    }
    return true; // continue
  });
  return finalResult;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::validateEnding","kind":"func","status":"implemented","sigHash":"e59b65f0e285d6bea68061d7b014c344e5ba30e23359e2979a392e438f3c115e","bodyHash":"b655ad0b76d31b41c4cfb9169e20b5e5beebad7e26f2abf4479cb39aa5ccf906"}
 *
 * Go source:
 * func validateEnding(c specPair, relativeToBaseUrl string, compilerOptions *core.CompilerOptions, host ModuleSpecifierGenerationHost) bool {
 * 	// Optimization: `removeExtensionAndIndexPostFix` can query the file system (a good bit) if `ending` is `Minimal`, the basename
 * 	// is 'index', and a `host` is provided. To avoid that until it's unavoidable, we ran the function with no `host` above. Only
 * 	// here, after we've checked that the minimal ending is indeed a match (via the length and prefix/suffix checks / `some` calls),
 * 	// do we check that the host-validated result is consistent with the answer we got before. If it's not, it falls back to the
 * 	// `ModuleSpecifierEnding.Index` result, which should already be in the list of candidates if `Minimal` was. (Note: the assumption here is
 * 	// that every module resolution mode that supports dropping extensions also supports dropping `/index`. Like literally
 * 	// everything else in this file, this logic needs to be updated if that's not true in some future module resolution mode.)
 * 	return c.ending != ModuleSpecifierEndingMinimal || c.value == processEnding(relativeToBaseUrl, []ModuleSpecifierEnding{c.ending}, compilerOptions, host)
 * }
 */
export function validateEnding(c: specPair, relativeToBaseUrl: string, compilerOptions: GoPtr<CompilerOptions>, host: ModuleSpecifierGenerationHost): bool {
  return c.ending !== ModuleSpecifierEndingMinimal || c.value === processEnding(relativeToBaseUrl, [c.ending], compilerOptions, host);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::tryGetModuleNameFromExportsOrImports","kind":"func","status":"implemented","sigHash":"e7fdac31419aa5d04cf172c5a5a88593645d947900ce7f212d5275334aea437d","bodyHash":"8a91cf0cb532beac261f2a502f04b17e7114c2e2ee2e0c7f46a2cc127a751c9b"}
 *
 * Go source:
 * func tryGetModuleNameFromExportsOrImports(
 * 	options *core.CompilerOptions,
 * 	host ModuleSpecifierGenerationHost,
 * 	targetFilePath string,
 * 	packageDirectory string,
 * 	packageName string,
 * 	exports packagejson.ExportsOrImports,
 * 	conditions []string,
 * 	mode MatchingMode,
 * 	isImports bool,
 * 	preferTsExtension bool,
 * ) string {
 * 	switch exports.Type {
 * 	case packagejson.JSONValueTypeNotPresent:
 * 		return ""
 * 	case packagejson.JSONValueTypeString:
 * 		strValue := exports.Value.(string)
 * 
 * 		// possible strada bug? Always uses compilerOptions of the host project, not those applicable to the targeted package.json!
 * 		var outputFile string
 * 		var declarationFile string
 * 		if isImports {
 * 			outputFile = outputpaths.GetOutputJSFileNameWorker(targetFilePath, options, host)
 * 			declarationFile = outputpaths.GetOutputDeclarationFileNameWorker(targetFilePath, options, host)
 * 		}
 * 
 * 		pathOrPattern := tspath.GetNormalizedAbsolutePath(tspath.CombinePaths(packageDirectory, strValue), "")
 * 		var extensionSwappedTarget string
 * 		if tspath.HasTSFileExtension(targetFilePath) {
 * 			extensionSwappedTarget = tspath.RemoveFileExtension(targetFilePath) + module.TryGetJSExtensionForFile(targetFilePath, options)
 * 		}
 * 		canTryTsExtension := preferTsExtension && tspath.HasImplementationTSFileExtension(targetFilePath)
 * 
 * 		compareOpts := tspath.ComparePathsOptions{
 * 			UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
 * 			CurrentDirectory:          host.GetCurrentDirectory(),
 * 		}
 * 
 * 		switch mode {
 * 		case MatchingModeExact:
 * 			if len(extensionSwappedTarget) > 0 && tspath.ComparePaths(extensionSwappedTarget, pathOrPattern, compareOpts) == 0 ||
 * 				tspath.ComparePaths(targetFilePath, pathOrPattern, compareOpts) == 0 ||
 * 				len(outputFile) > 0 && tspath.ComparePaths(outputFile, pathOrPattern, compareOpts) == 0 ||
 * 				len(declarationFile) > 0 && tspath.ComparePaths(declarationFile, pathOrPattern, compareOpts) == 0 {
 * 				return packageName
 * 			}
 * 		case MatchingModeDirectory:
 * 			if canTryTsExtension && tspath.ContainsPath(targetFilePath, pathOrPattern, compareOpts) {
 * 				fragment := tspath.GetRelativePathFromDirectory(pathOrPattern, targetFilePath, compareOpts)
 * 				return tspath.GetNormalizedAbsolutePath(tspath.CombinePaths(tspath.CombinePaths(packageName, strValue), fragment), "")
 * 			}
 * 			if len(extensionSwappedTarget) > 0 && tspath.ContainsPath(pathOrPattern, extensionSwappedTarget, compareOpts) {
 * 				fragment := tspath.GetRelativePathFromDirectory(pathOrPattern, extensionSwappedTarget, compareOpts)
 * 				return tspath.GetNormalizedAbsolutePath(tspath.CombinePaths(tspath.CombinePaths(packageName, strValue), fragment), "")
 * 			}
 * 			if !canTryTsExtension && tspath.ContainsPath(pathOrPattern, targetFilePath, compareOpts) {
 * 				fragment := tspath.GetRelativePathFromDirectory(pathOrPattern, targetFilePath, compareOpts)
 * 				return tspath.GetNormalizedAbsolutePath(tspath.CombinePaths(tspath.CombinePaths(packageName, strValue), fragment), "")
 * 			}
 * 			if len(outputFile) > 0 && tspath.ContainsPath(pathOrPattern, outputFile, compareOpts) {
 * 				fragment := tspath.GetRelativePathFromDirectory(pathOrPattern, outputFile, compareOpts)
 * 				return tspath.CombinePaths(packageName, fragment)
 * 			}
 * 			if len(declarationFile) > 0 && tspath.ContainsPath(pathOrPattern, declarationFile, compareOpts) {
 * 				fragment := tspath.GetRelativePathFromDirectory(pathOrPattern, declarationFile, compareOpts)
 * 				jsExtension := getJSExtensionForFile(declarationFile, options)
 * 				fragmentWithJsExtension := tspath.ChangeExtension(fragment, jsExtension)
 * 				return tspath.CombinePaths(packageName, fragmentWithJsExtension)
 * 			}
 * 		case MatchingModePattern:
 * 			leadingSlice, trailingSlice, _ := strings.Cut(pathOrPattern, "*")
 * 			caseSensitive := host.UseCaseSensitiveFileNames()
 * 			if canTryTsExtension && stringutil.HasPrefixAndSuffixWithoutOverlap(targetFilePath, leadingSlice, trailingSlice, caseSensitive) {
 * 				starReplacement := targetFilePath[len(leadingSlice) : len(targetFilePath)-len(trailingSlice)]
 * 				return replaceFirstStar(packageName, starReplacement)
 * 			}
 * 			if len(extensionSwappedTarget) > 0 && stringutil.HasPrefixAndSuffixWithoutOverlap(extensionSwappedTarget, leadingSlice, trailingSlice, caseSensitive) {
 * 				starReplacement := extensionSwappedTarget[len(leadingSlice) : len(extensionSwappedTarget)-len(trailingSlice)]
 * 				return replaceFirstStar(packageName, starReplacement)
 * 			}
 * 			if !canTryTsExtension && stringutil.HasPrefixAndSuffixWithoutOverlap(targetFilePath, leadingSlice, trailingSlice, caseSensitive) {
 * 				starReplacement := targetFilePath[len(leadingSlice) : len(targetFilePath)-len(trailingSlice)]
 * 				return replaceFirstStar(packageName, starReplacement)
 * 			}
 * 			if len(outputFile) > 0 && stringutil.HasPrefixAndSuffixWithoutOverlap(outputFile, leadingSlice, trailingSlice, caseSensitive) {
 * 				starReplacement := outputFile[len(leadingSlice) : len(outputFile)-len(trailingSlice)]
 * 				return replaceFirstStar(packageName, starReplacement)
 * 			}
 * 			if len(declarationFile) > 0 && stringutil.HasPrefixAndSuffixWithoutOverlap(declarationFile, leadingSlice, trailingSlice, caseSensitive) {
 * 				starReplacement := declarationFile[len(leadingSlice) : len(declarationFile)-len(trailingSlice)]
 * 				substituted := replaceFirstStar(packageName, starReplacement)
 * 				jsExtension := module.TryGetJSExtensionForFile(declarationFile, options)
 * 				if len(jsExtension) > 0 {
 * 					return tspath.ChangeFullExtension(substituted, jsExtension)
 * 				}
 * 			}
 * 		}
 * 		return ""
 * 	case packagejson.JSONValueTypeArray:
 * 		arr := exports.AsArray()
 * 		for _, e := range arr {
 * 			result := tryGetModuleNameFromExportsOrImports(options, host, targetFilePath, packageDirectory, packageName, e, conditions, mode, isImports, preferTsExtension)
 * 			if len(result) > 0 {
 * 				return result
 * 			}
 * 		}
 * 	case packagejson.JSONValueTypeObject:
 * 		// conditional mapping
 * 		obj := exports.AsObject()
 * 		for key, value := range obj.Entries() {
 * 			if key == "default" || slices.Contains(conditions, key) || slices.Contains(conditions, "types") && module.IsApplicableVersionedTypesKey(key) {
 * 				result := tryGetModuleNameFromExportsOrImports(options, host, targetFilePath, packageDirectory, packageName, value, conditions, mode, isImports, preferTsExtension)
 * 				if len(result) > 0 {
 * 					return result
 * 				}
 * 			}
 * 		}
 * 	case packagejson.JSONValueTypeNull:
 * 		return ""
 * 	}
 * 	return ""
 * }
 */
export function tryGetModuleNameFromExportsOrImports(options: GoPtr<CompilerOptions>, host: ModuleSpecifierGenerationHost, targetFilePath: string, packageDirectory: string, packageName: string, exports: ExportsOrImports, conditions: GoSlice<string>, mode: MatchingMode, isImports: bool, preferTsExtension: bool): string {
  switch (exports.__tsgoEmbedded0!.Type) {
    case JSONValueTypeNotPresent:
      return "";
    case JSONValueTypeString: {
      const strValue = exports.__tsgoEmbedded0!.Value as string;

      let outputFile = "";
      let declarationFile = "";
      if (isImports) {
        outputFile = GetOutputJSFileNameWorker(targetFilePath, options, host);
        declarationFile = GetOutputDeclarationFileNameWorker(targetFilePath, options, host);
      }

      const pathOrPattern = GetNormalizedAbsolutePath(CombinePaths(packageDirectory, strValue), "");
      const extensionSwappedTarget = HasTSFileExtension(targetFilePath)
        ? RemoveFileExtension(targetFilePath) + ModuleTryGetJSExtensionForFile(targetFilePath, options)
        : "";
      const canTryTsExtension = preferTsExtension && HasImplementationTSFileExtension(targetFilePath);

      const compareOpts: ComparePathsOptions = {
        UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
        CurrentDirectory: host.GetCurrentDirectory(),
      };

      switch (mode) {
        case MatchingModeExact:
          if ((extensionSwappedTarget.length > 0 && ComparePaths(extensionSwappedTarget, pathOrPattern, compareOpts) === 0) ||
            ComparePaths(targetFilePath, pathOrPattern, compareOpts) === 0 ||
            (outputFile.length > 0 && ComparePaths(outputFile, pathOrPattern, compareOpts) === 0) ||
            (declarationFile.length > 0 && ComparePaths(declarationFile, pathOrPattern, compareOpts) === 0)) {
            return packageName;
          }
          break;
        case MatchingModeDirectory:
          if (canTryTsExtension && ContainsPath(targetFilePath, pathOrPattern, compareOpts)) {
            const fragment = GetRelativePathFromDirectory(pathOrPattern, targetFilePath, compareOpts);
            return GetNormalizedAbsolutePath(CombinePaths(CombinePaths(packageName, strValue), fragment), "");
          }
          if (extensionSwappedTarget.length > 0 && ContainsPath(pathOrPattern, extensionSwappedTarget, compareOpts)) {
            const fragment = GetRelativePathFromDirectory(pathOrPattern, extensionSwappedTarget, compareOpts);
            return GetNormalizedAbsolutePath(CombinePaths(CombinePaths(packageName, strValue), fragment), "");
          }
          if (!canTryTsExtension && ContainsPath(pathOrPattern, targetFilePath, compareOpts)) {
            const fragment = GetRelativePathFromDirectory(pathOrPattern, targetFilePath, compareOpts);
            return GetNormalizedAbsolutePath(CombinePaths(CombinePaths(packageName, strValue), fragment), "");
          }
          if (outputFile.length > 0 && ContainsPath(pathOrPattern, outputFile, compareOpts)) {
            const fragment = GetRelativePathFromDirectory(pathOrPattern, outputFile, compareOpts);
            return CombinePaths(packageName, fragment);
          }
          if (declarationFile.length > 0 && ContainsPath(pathOrPattern, declarationFile, compareOpts)) {
            const fragment = GetRelativePathFromDirectory(pathOrPattern, declarationFile, compareOpts);
            const jsExtension = getJSExtensionForFile(declarationFile, options);
            const fragmentWithJsExtension = ChangeExtension(fragment, jsExtension);
            return CombinePaths(packageName, fragmentWithJsExtension);
          }
          break;
        case MatchingModePattern: {
          const [leadingSlice, trailingSlice] = strings.Cut(pathOrPattern, "*");
          const caseSensitive = host.UseCaseSensitiveFileNames();
          if (canTryTsExtension && HasPrefixAndSuffixWithoutOverlap(targetFilePath, leadingSlice, trailingSlice, caseSensitive)) {
            const starReplacement = targetFilePath.slice(leadingSlice.length, targetFilePath.length - trailingSlice.length);
            return replaceFirstStar(packageName, starReplacement);
          }
          if (extensionSwappedTarget.length > 0 && HasPrefixAndSuffixWithoutOverlap(extensionSwappedTarget, leadingSlice, trailingSlice, caseSensitive)) {
            const starReplacement = extensionSwappedTarget.slice(leadingSlice.length, extensionSwappedTarget.length - trailingSlice.length);
            return replaceFirstStar(packageName, starReplacement);
          }
          if (!canTryTsExtension && HasPrefixAndSuffixWithoutOverlap(targetFilePath, leadingSlice, trailingSlice, caseSensitive)) {
            const starReplacement = targetFilePath.slice(leadingSlice.length, targetFilePath.length - trailingSlice.length);
            return replaceFirstStar(packageName, starReplacement);
          }
          if (outputFile.length > 0 && HasPrefixAndSuffixWithoutOverlap(outputFile, leadingSlice, trailingSlice, caseSensitive)) {
            const starReplacement = outputFile.slice(leadingSlice.length, outputFile.length - trailingSlice.length);
            return replaceFirstStar(packageName, starReplacement);
          }
          if (declarationFile.length > 0 && HasPrefixAndSuffixWithoutOverlap(declarationFile, leadingSlice, trailingSlice, caseSensitive)) {
            const starReplacement = declarationFile.slice(leadingSlice.length, declarationFile.length - trailingSlice.length);
            const substituted = replaceFirstStar(packageName, starReplacement);
            const jsExtension = ModuleTryGetJSExtensionForFile(declarationFile, options);
            if (jsExtension.length > 0) {
              return ChangeFullExtension(substituted, jsExtension);
            }
          }
          break;
        }
        default:
          AssertNever(mode);
      }
      return "";
    }
    case JSONValueTypeArray: {
      const arr = ExportsOrImports_AsArray(exports);
      for (const e of arr) {
        const result = tryGetModuleNameFromExportsOrImports(options, host, targetFilePath, packageDirectory, packageName, e, conditions, mode, isImports, preferTsExtension);
        if (result.length > 0) {
          return result;
        }
      }
      break;
    }
    case JSONValueTypeObject: {
      const obj = ExportsOrImports_AsObject(exports);
      let result = "";
      OrderedMap_Entries(obj as GoPtr<OrderedMap<string, ExportsOrImports>>)((key, value) => {
        if (key === "default" || conditions.includes(key) || (conditions.includes("types") && IsApplicableVersionedTypesKey(key))) {
          result = tryGetModuleNameFromExportsOrImports(options, host, targetFilePath, packageDirectory, packageName, value, conditions, mode, isImports, preferTsExtension);
          if (result.length > 0) {
            return false; // break
          }
        }
        return true; // continue
      });
      if (result.length > 0) {
        return result;
      }
      break;
    }
    case JSONValueTypeNull:
      return "";
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::GetModuleSpecifier","kind":"func","status":"implemented","sigHash":"89a63e1eb58b22939cef661eb12ab626f2620401ef89821831ca7828b58cbec8","bodyHash":"cd624544f46a1bd3923539ce1d09397b01e2a191d2404e0f2589ef558119a086"}
 *
 * Go source:
 * func GetModuleSpecifier(
 * 	compilerOptions *core.CompilerOptions,
 * 	host ModuleSpecifierGenerationHost,
 * 	importingSourceFile *ast.SourceFile, // !!! | FutureSourceFile
 * 	importingSourceFileName string,
 * 	oldImportSpecifier string, // used only in updatingModuleSpecifier
 * 	toFileName string,
 * 	options ModuleSpecifierOptions,
 * ) string {
 * 	return getModuleSpecifierWithPreferences(
 * 		compilerOptions,
 * 		host,
 * 		importingSourceFile,
 * 		importingSourceFileName,
 * 		oldImportSpecifier,
 * 		toFileName,
 * 		UserPreferences{},
 * 		options,
 * 	)
 * }
 */
export function GetModuleSpecifier(compilerOptions: GoPtr<CompilerOptions>, host: ModuleSpecifierGenerationHost, importingSourceFile: GoPtr<SourceFile>, importingSourceFileName: string, oldImportSpecifier: string, toFileName: string, options: ModuleSpecifierOptions): string {
  return getModuleSpecifierWithPreferences(
    compilerOptions,
    host,
    importingSourceFile,
    importingSourceFileName,
    oldImportSpecifier,
    toFileName,
    {} as UserPreferences,
    options,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::UpdateModuleSpecifier","kind":"func","status":"implemented","sigHash":"c5bfc9dfe9abdd81d861686931206ebface74b05656e0647902c00ca9dc764cb","bodyHash":"6779825feda5050164c4dbe478720800f68cad05667d8a106cc0df5f9c212324"}
 *
 * Go source:
 * func UpdateModuleSpecifier(
 * 	compilerOptions *core.CompilerOptions,
 * 	host ModuleSpecifierGenerationHost,
 * 	importingSourceFile *ast.SourceFile,
 * 	importingSourceFileName string,
 * 	oldImportSpecifier string,
 * 	toFileName string,
 * 	userPreferences UserPreferences,
 * 	options ModuleSpecifierOptions,
 * ) string {
 * 	return getModuleSpecifierWithPreferences(
 * 		compilerOptions,
 * 		host,
 * 		importingSourceFile,
 * 		importingSourceFileName,
 * 		oldImportSpecifier,
 * 		toFileName,
 * 		userPreferences,
 * 		options,
 * 	)
 * }
 */
export function UpdateModuleSpecifier(compilerOptions: GoPtr<CompilerOptions>, host: ModuleSpecifierGenerationHost, importingSourceFile: GoPtr<SourceFile>, importingSourceFileName: string, oldImportSpecifier: string, toFileName: string, userPreferences: UserPreferences, options: ModuleSpecifierOptions): string {
  return getModuleSpecifierWithPreferences(
    compilerOptions,
    host,
    importingSourceFile,
    importingSourceFileName,
    oldImportSpecifier,
    toFileName,
    userPreferences,
    options,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/specifiers.go::func::getModuleSpecifierWithPreferences","kind":"func","status":"implemented","sigHash":"97acdb045dba89be42ee14ccbbb5239f0626624a431fa86572dd1093fd37b4c3","bodyHash":"791cd53e3d7815aa09a1262eede6e6d2f75a34ee820b7fbd2989dc7f39f9c6ef"}
 *
 * Go source:
 * func getModuleSpecifierWithPreferences(
 * 	compilerOptions *core.CompilerOptions,
 * 	host ModuleSpecifierGenerationHost,
 * 	importingSourceFile *ast.SourceFile, // !!! | FutureSourceFile
 * 	importingSourceFileName string,
 * 	oldImportSpecifier string, // used only in updatingModuleSpecifier
 * 	toFileName string,
 * 	userPreferences UserPreferences,
 * 	options ModuleSpecifierOptions,
 * ) string {
 * 	info := getInfo(importingSourceFileName, host)
 * 	modulePaths := getAllModulePaths(info, toFileName, host, compilerOptions, userPreferences, options)
 * 	preferences := getModuleSpecifierPreferences(userPreferences, host, compilerOptions, importingSourceFile, oldImportSpecifier)
 * 
 * 	resolutionMode := options.OverrideImportMode
 * 	if resolutionMode == core.ResolutionModeNone {
 * 		resolutionMode = host.GetDefaultResolutionModeForFile(importingSourceFile)
 * 	}
 * 
 * 	for _, modulePath := range modulePaths {
 * 		if firstDefined := tryGetModuleNameAsNodeModule(modulePath, info, importingSourceFile, host, compilerOptions, userPreferences, false /*packageNameOnly* /, options.OverrideImportMode); len(firstDefined) > 0 {
 * 			return firstDefined
 * 		}
 * 	}
 * 
 * 	return getLocalModuleSpecifier(toFileName, info, compilerOptions, host, resolutionMode, preferences, false)
 * }
 */
export function getModuleSpecifierWithPreferences(compilerOptions: GoPtr<CompilerOptions>, host: ModuleSpecifierGenerationHost, importingSourceFile: GoPtr<SourceFile>, importingSourceFileName: string, oldImportSpecifier: string, toFileName: string, userPreferences: UserPreferences, options: ModuleSpecifierOptions): string {
  const info = getInfo(importingSourceFileName, host);
  const modulePaths = getAllModulePaths(info, toFileName, host, compilerOptions, userPreferences, options);
  const preferences = getModuleSpecifierPreferences(userPreferences, host, compilerOptions, importingSourceFile as unknown as SourceFileForSpecifierGeneration, oldImportSpecifier);

  const resolutionMode = options.OverrideImportMode === ResolutionModeNone
    ? host.GetDefaultResolutionModeForFile(importingSourceFile as unknown as HasFileName)
    : options.OverrideImportMode;

  for (const modulePath of modulePaths) {
    const firstDefined = tryGetModuleNameAsNodeModule(modulePath, info, importingSourceFile as unknown as SourceFileForSpecifierGeneration, host, compilerOptions, userPreferences, false, options.OverrideImportMode);
    if (firstDefined.length > 0) {
      return firstDefined;
    }
  }

  return getLocalModuleSpecifier(toFileName, info, compilerOptions, host, resolutionMode, preferences, false);
}
