import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { CompilerOptions, ResolutionMode } from "../core/compileroptions.js";
import type { ImportModuleSpecifierEndingPreference, ModuleSpecifierEnding, ModuleSpecifierGenerationHost, RelativePreferenceKind, SourceFileForSpecifierGeneration, UserPreferences } from "./types.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/preferences.go::func::shouldAllowImportingTsExtension","kind":"func","status":"implemented","sigHash":"7d4350127685ad85d1d7c869b509a1b8e4995e6ecf4b77829c7cae4a68a38b9a","bodyHash":"7ed9cff31c57be9eb2bea4b79dc6b331f648fc004da573f49c42e6bd58df1bff"}
 *
 * Go source:
 * func shouldAllowImportingTsExtension(compilerOptions *core.CompilerOptions, fromFileName string) bool {
 * 	return compilerOptions.GetAllowImportingTsExtensions() || len(fromFileName) > 0 && tspath.IsDeclarationFileName(fromFileName)
 * }
 */
export declare function shouldAllowImportingTsExtension(compilerOptions: GoPtr<CompilerOptions>, fromFileName: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/preferences.go::func::usesExtensionsOnImports","kind":"func","status":"implemented","sigHash":"ca9485891208ae5f15e0d38f9d136370b02822dd641b6949dfdc9541befd6920","bodyHash":"69bfa28c8b7e8d9891549b2919d658099f566131c31ab9d579452161316da7b0"}
 *
 * Go source:
 * func usesExtensionsOnImports(file SourceFileForSpecifierGeneration) bool {
 * 	for _, ref := range file.Imports() {
 * 		text := ref.Text()
 * 		if tspath.PathIsRelative(text) && !tspath.FileExtensionIsOneOf(text, tspath.ExtensionsNotSupportingExtensionlessResolution) {
 * 			return tspath.HasTSFileExtension(text) || tspath.HasJSFileExtension(text)
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function usesExtensionsOnImports(file: SourceFileForSpecifierGeneration): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/preferences.go::func::inferPreference","kind":"func","status":"implemented","sigHash":"dd2f3ce2f51425a7d6370accc0948d646de045f610568ad620fb8869b69b7b91","bodyHash":"b404a78e9fb76840c937a236a9d6a194e6e4197cd2d4a212831377d0c422d47c"}
 *
 * Go source:
 * func inferPreference(
 * 	resolutionMode core.ResolutionMode,
 * 	sourceFile SourceFileForSpecifierGeneration,
 * 	moduleResolutionIsNodeNext bool,
 * ) ModuleSpecifierEnding {
 * 	usesJsExtensions := false
 * 	var specifiers []*ast.LiteralLikeNode
 * 	if sourceFile != nil && len(sourceFile.Imports()) > 0 {
 * 		specifiers = sourceFile.Imports()
 * 	} else if sourceFile != nil && sourceFile.IsJS() {
 * 		// !!! TODO: JS support
 * 		// specifiers = core.Map(getRequiresAtTopOfFile(sourceFile), func(d *ast.Node) *ast.Node { return d.arguments[0] })
 * 	}
 *
 * 	for _, specifier := range specifiers {
 * 		path := specifier.Text()
 * 		if tspath.PathIsRelative(path) {
 * 			// !!! TODO: proper resolutionMode support
 * 			if moduleResolutionIsNodeNext && resolutionMode == core.ResolutionModeCommonJS /* && getModeForUsageLocation(sourceFile!, specifier, compilerOptions) === ModuleKind.ESNext * / {
 * 				// We're trying to decide a preference for a CommonJS module specifier, but looking at an ESM import.
 * 				continue
 * 			}
 * 			if tspath.FileExtensionIsOneOf(path, tspath.ExtensionsNotSupportingExtensionlessResolution) {
 * 				// These extensions are not optional, so do not indicate a preference.
 * 				continue
 * 			}
 * 			if tspath.HasTSFileExtension(path) {
 * 				return ModuleSpecifierEndingTsExtension
 * 			}
 * 			if tspath.HasJSFileExtension(path) {
 * 				usesJsExtensions = true
 * 			}
 * 		}
 * 	}
 *
 * 	if usesJsExtensions {
 * 		return ModuleSpecifierEndingJsExtension
 * 	}
 * 	return ModuleSpecifierEndingMinimal
 * }
 */
export declare function inferPreference(resolutionMode: ResolutionMode, sourceFile: SourceFileForSpecifierGeneration, moduleResolutionIsNodeNext: bool): ModuleSpecifierEnding;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/preferences.go::func::getModuleSpecifierEndingPreference","kind":"func","status":"implemented","sigHash":"61632fc70011b868203184f89e7bc1653d15795b92c117fabaed5cf5cfc5243e","bodyHash":"eb50c50d0402d8cb195f0275d28be0595bdd1c0e6265386211c22d3400999865"}
 *
 * Go source:
 * func getModuleSpecifierEndingPreference(
 * 	pref ImportModuleSpecifierEndingPreference,
 * 	resolutionMode core.ResolutionMode,
 * 	compilerOptions *core.CompilerOptions,
 * 	sourceFile SourceFileForSpecifierGeneration,
 * ) ModuleSpecifierEnding {
 * 	moduleResolution := compilerOptions.GetModuleResolutionKind()
 * 	moduleResolutionIsNodeNext := core.ModuleResolutionKindNode16 <= moduleResolution && moduleResolution <= core.ModuleResolutionKindNodeNext
 *
 * 	if pref == ImportModuleSpecifierEndingPreferenceJs || resolutionMode == core.ResolutionModeESM && moduleResolutionIsNodeNext {
 * 		// Extensions are explicitly requested or required. Now choose between .js and .ts.
 * 		if !shouldAllowImportingTsExtension(compilerOptions, "") {
 * 			return ModuleSpecifierEndingJsExtension
 * 		}
 * 		// `allowImportingTsExtensions` is a strong signal, so use .ts unless the file
 * 		// already uses .js extensions and no .ts extensions.
 * 		if inferPreference(resolutionMode, sourceFile, moduleResolutionIsNodeNext) != ModuleSpecifierEndingJsExtension {
 * 			return ModuleSpecifierEndingTsExtension
 * 		}
 * 		return ModuleSpecifierEndingJsExtension
 * 	}
 *
 * 	if pref == ImportModuleSpecifierEndingPreferenceMinimal {
 * 		return ModuleSpecifierEndingMinimal
 * 	}
 *
 * 	if pref == ImportModuleSpecifierEndingPreferenceIndex {
 * 		return ModuleSpecifierEndingIndex
 * 	}
 *
 * 	// No preference was specified.
 * 	// Look at imports and/or requires to guess whether .js, .ts, or extensionless imports are preferred.
 * 	// N.B. that `Index` detection is not supported since it would require file system probing to do
 * 	// accurately, and more importantly, literally nobody wants `Index` and its existence is a mystery.
 * 	if !shouldAllowImportingTsExtension(compilerOptions, "") {
 * 		// If .ts imports are not valid, we only need to see one .js import to go with that.
 * 		if sourceFile != nil && usesExtensionsOnImports(sourceFile) {
 * 			return ModuleSpecifierEndingJsExtension
 * 		}
 * 		return ModuleSpecifierEndingMinimal
 * 	}
 *
 * 	return inferPreference(resolutionMode, sourceFile, moduleResolutionIsNodeNext)
 * }
 */
export declare function getModuleSpecifierEndingPreference(pref: ImportModuleSpecifierEndingPreference, resolutionMode: ResolutionMode, compilerOptions: GoPtr<CompilerOptions>, sourceFile: SourceFileForSpecifierGeneration): ModuleSpecifierEnding;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/preferences.go::func::getPreferredEnding","kind":"func","status":"implemented","sigHash":"030aa65ff276530d90ca9c7615baf7ad1607e7c2fc97a187541ae1744a9200d3","bodyHash":"e8150d360b8a857acbaf420835ee5c0e9842afeba936ede84db088b9641888a5"}
 *
 * Go source:
 * func getPreferredEnding(
 * 	prefs UserPreferences,
 * 	host ModuleSpecifierGenerationHost,
 * 	compilerOptions *core.CompilerOptions,
 * 	importingSourceFile SourceFileForSpecifierGeneration,
 * 	oldImportSpecifier string,
 * 	resolutionMode core.ResolutionMode,
 * ) ModuleSpecifierEnding {
 * 	if len(oldImportSpecifier) > 0 {
 * 		if tspath.HasJSFileExtension(oldImportSpecifier) {
 * 			return ModuleSpecifierEndingJsExtension
 * 		}
 * 		if strings.HasSuffix(oldImportSpecifier, "/index") {
 * 			return ModuleSpecifierEndingIndex
 * 		}
 * 	}
 * 	if resolutionMode == core.ResolutionModeNone {
 * 		resolutionMode = host.GetDefaultResolutionModeForFile(importingSourceFile)
 * 	}
 * 	return getModuleSpecifierEndingPreference(
 * 		prefs.ImportModuleSpecifierEnding,
 * 		resolutionMode,
 * 		compilerOptions,
 * 		importingSourceFile,
 * 	)
 * }
 */
export declare function getPreferredEnding(prefs: UserPreferences, host: ModuleSpecifierGenerationHost, compilerOptions: GoPtr<CompilerOptions>, importingSourceFile: SourceFileForSpecifierGeneration, oldImportSpecifier: string, resolutionMode: ResolutionMode): ModuleSpecifierEnding;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/preferences.go::type::ModuleSpecifierPreferences","kind":"type","status":"implemented","sigHash":"526c81e2bad67b3df88ec66937d4eafcccf1ec64bee02703b1fa5c83326c7130","bodyHash":"6b9197e979443465e5e8c4f3e9787cf800a1667e4079421e3ea1ef58bcfc6cb6"}
 *
 * Go source:
 * ModuleSpecifierPreferences struct {
 * 	relativePreference                RelativePreferenceKind
 * 	getAllowedEndingsInPreferredOrder func(syntaxImpliedNodeFormat core.ResolutionMode) []ModuleSpecifierEnding
 * 	excludeRegexes                    []string
 * }
 */
export interface ModuleSpecifierPreferences {
    relativePreference: RelativePreferenceKind;
    getAllowedEndingsInPreferredOrder: (syntaxImpliedNodeFormat: ResolutionMode) => GoSlice<ModuleSpecifierEnding>;
    excludeRegexes: GoSlice<string>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/preferences.go::func::GetAllowedEndingsInPreferredOrder","kind":"func","status":"implemented","sigHash":"d681bac04f83b4c5ae5c17476badb8a4028ab94583383ad79e7fe3af9c7c6db3","bodyHash":"2cd75af743083efb6126bdcf6c52501438f2dc6e9a1b8b2f2492e67054dfb84e"}
 *
 * Go source:
 * func GetAllowedEndingsInPreferredOrder(
 * 	prefs UserPreferences,
 * 	host ModuleSpecifierGenerationHost,
 * 	compilerOptions *core.CompilerOptions,
 * 	importingSourceFile SourceFileForSpecifierGeneration,
 * 	oldImportSpecifier string,
 * 	syntaxImpliedNodeFormat core.ResolutionMode,
 * ) []ModuleSpecifierEnding {
 * 	preferredEnding := getPreferredEnding(
 * 		prefs,
 * 		host,
 * 		compilerOptions,
 * 		importingSourceFile,
 * 		oldImportSpecifier,
 * 		core.ResolutionModeNone,
 * 	)
 * 	resolutionMode := host.GetDefaultResolutionModeForFile(importingSourceFile)
 * 	if resolutionMode != syntaxImpliedNodeFormat {
 * 		preferredEnding = getPreferredEnding(
 * 			prefs,
 * 			host,
 * 			compilerOptions,
 * 			importingSourceFile,
 * 			oldImportSpecifier,
 * 			syntaxImpliedNodeFormat,
 * 		)
 * 	}
 * 	moduleResolution := compilerOptions.GetModuleResolutionKind()
 * 	moduleResolutionIsNodeNext := core.ModuleResolutionKindNode16 <= moduleResolution && moduleResolution <= core.ModuleResolutionKindNodeNext
 * 	allowImportingTsExtension := shouldAllowImportingTsExtension(compilerOptions, importingSourceFile.FileName())
 * 	if syntaxImpliedNodeFormat == core.ResolutionModeESM && moduleResolutionIsNodeNext {
 * 		if allowImportingTsExtension {
 * 			return []ModuleSpecifierEnding{ModuleSpecifierEndingTsExtension, ModuleSpecifierEndingJsExtension}
 * 		}
 * 		return []ModuleSpecifierEnding{ModuleSpecifierEndingJsExtension}
 * 	}
 * 	switch preferredEnding {
 * 	case ModuleSpecifierEndingJsExtension:
 * 		if allowImportingTsExtension {
 * 			return []ModuleSpecifierEnding{ModuleSpecifierEndingJsExtension, ModuleSpecifierEndingTsExtension, ModuleSpecifierEndingMinimal, ModuleSpecifierEndingIndex}
 * 		}
 * 		return []ModuleSpecifierEnding{ModuleSpecifierEndingJsExtension, ModuleSpecifierEndingMinimal, ModuleSpecifierEndingIndex}
 * 	case ModuleSpecifierEndingTsExtension:
 * 		return []ModuleSpecifierEnding{ModuleSpecifierEndingTsExtension, ModuleSpecifierEndingMinimal, ModuleSpecifierEndingJsExtension, ModuleSpecifierEndingIndex}
 * 	case ModuleSpecifierEndingIndex:
 * 		if allowImportingTsExtension {
 * 			return []ModuleSpecifierEnding{ModuleSpecifierEndingIndex, ModuleSpecifierEndingMinimal, ModuleSpecifierEndingTsExtension, ModuleSpecifierEndingJsExtension}
 * 		}
 * 		return []ModuleSpecifierEnding{ModuleSpecifierEndingIndex, ModuleSpecifierEndingMinimal, ModuleSpecifierEndingJsExtension}
 * 	case ModuleSpecifierEndingMinimal:
 * 		if allowImportingTsExtension {
 * 			return []ModuleSpecifierEnding{ModuleSpecifierEndingMinimal, ModuleSpecifierEndingIndex, ModuleSpecifierEndingTsExtension, ModuleSpecifierEndingJsExtension}
 * 		}
 * 		return []ModuleSpecifierEnding{ModuleSpecifierEndingMinimal, ModuleSpecifierEndingIndex, ModuleSpecifierEndingJsExtension}
 * 	default:
 * 		debug.AssertNever(preferredEnding)
 * 	}
 * 	return []ModuleSpecifierEnding{ModuleSpecifierEndingMinimal}
 * }
 */
export declare function GetAllowedEndingsInPreferredOrder(prefs: UserPreferences, host: ModuleSpecifierGenerationHost, compilerOptions: GoPtr<CompilerOptions>, importingSourceFile: SourceFileForSpecifierGeneration, oldImportSpecifier: string, syntaxImpliedNodeFormat: ResolutionMode): GoSlice<ModuleSpecifierEnding>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/preferences.go::func::getModuleSpecifierPreferences","kind":"func","status":"implemented","sigHash":"4d7b610b087e5c6c565c0a3d9dbadd8a62dc0a2e3de94af1f995b1bb629aa1ec","bodyHash":"d7048861aaa932bed12ff1569b6426db04357271ae7e35934bb89a23d6e7d54b"}
 *
 * Go source:
 * func getModuleSpecifierPreferences(
 * 	prefs UserPreferences,
 * 	host ModuleSpecifierGenerationHost,
 * 	compilerOptions *core.CompilerOptions,
 * 	importingSourceFile SourceFileForSpecifierGeneration,
 * 	oldImportSpecifier string,
 * ) ModuleSpecifierPreferences {
 * 	excludes := prefs.AutoImportSpecifierExcludeRegexes
 * 	relativePreference := RelativePreferenceShortest
 * 	if len(oldImportSpecifier) > 0 {
 * 		if tspath.IsExternalModuleNameRelative(oldImportSpecifier) {
 * 			relativePreference = RelativePreferenceRelative
 * 		} else {
 * 			relativePreference = RelativePreferenceNonRelative
 * 		}
 * 	} else {
 * 		switch prefs.ImportModuleSpecifierPreference {
 * 		case ImportModuleSpecifierPreferenceRelative:
 * 			relativePreference = RelativePreferenceRelative
 * 		case ImportModuleSpecifierPreferenceNonRelative:
 * 			relativePreference = RelativePreferenceNonRelative
 * 		case ImportModuleSpecifierPreferenceProjectRelative:
 * 			relativePreference = RelativePreferenceExternalNonRelative
 * 			// all others are shortest
 * 		}
 * 	}
 *
 * 	getAllowedEndingsInPreferredOrder := func(syntaxImpliedNodeFormat core.ResolutionMode) []ModuleSpecifierEnding {
 * 		return GetAllowedEndingsInPreferredOrder(
 * 			prefs,
 * 			host,
 * 			compilerOptions,
 * 			importingSourceFile,
 * 			oldImportSpecifier,
 * 			syntaxImpliedNodeFormat,
 * 		)
 * 	}
 *
 * 	return ModuleSpecifierPreferences{
 * 		excludeRegexes:                    excludes,
 * 		relativePreference:                relativePreference,
 * 		getAllowedEndingsInPreferredOrder: getAllowedEndingsInPreferredOrder,
 * 	}
 * }
 */
export declare function getModuleSpecifierPreferences(prefs: UserPreferences, host: ModuleSpecifierGenerationHost, compilerOptions: GoPtr<CompilerOptions>, importingSourceFile: SourceFileForSpecifierGeneration, oldImportSpecifier: string): ModuleSpecifierPreferences;
//# sourceMappingURL=preferences.d.ts.map