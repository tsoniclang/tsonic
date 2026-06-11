import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import { Clone, Contains, Concat } from "../../go/slices.js";
import * as strings from "../../go/strings.js";
import type { Node } from "../ast/spine.js";
import { Node_Name } from "../ast/spine.js";
import type { SourceFile } from "../ast/ast.js";
import { Node_Text, Node_Expression, Node_Elements, SourceFile_FileName, SourceFile_Diagnostics, SourceFile_SetDiagnostics, NodeFactory_NewSourceFile, AsSourceFile } from "../ast/ast.js";
import { AsObjectLiteralExpression, AsPropertyAssignment, AsPrefixUnaryExpression, AsStringLiteral } from "../ast/generated/casts.js";
import type { NodeFactory } from "../ast/generated/factory.js";
import type { TokenNode } from "../ast/generated/unions.js";
import { NewToken as NodeFactory_NewToken } from "../ast/generated/factory.js";
import * as cmp from "../../go/cmp.js";
import { KindTrueKeyword, KindFalseKeyword, KindNullKeyword, KindStringLiteral, KindNumericLiteral, KindPrefixUnaryExpression, KindObjectLiteralExpression, KindArrayLiteralExpression, KindMinusToken, KindPropertyAssignment, KindEndOfFile } from "../ast/generated/kinds.js";
import { IsArrayLiteralExpression, IsObjectLiteralExpression, IsPropertyAssignment, IsStringLiteral } from "../ast/generated/predicates.js";
import { IsComputedNonLiteralName, TryGetTextOfPropertyName } from "../ast/utilities.js";
import type { Expression } from "../ast/generated/unions.js";
import type { ObjectLiteralExpression, PropertyAssignment, StringLiteral } from "../ast/generated/data.js";
import { NewDiagnostic, NewCompilerDiagnostic } from "../ast/diagnostic.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import { OrderedMap_Entries, OrderedMap_Has, OrderedMap_Set, OrderedMap_GetOrZero, OrderedMap_Get, OrderedMap_Delete, OrderedMap_Values, OrderedMap_Size, newMapWithSizeHint } from "../collections/ordered_map.js";
import type { Set } from "../collections/set.js";
import { Set_Add, Set_Keys } from "../collections/set.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import { CompilerOptions_GetAllowJS, CompilerOptions_GetResolveJsonModule, NormalizeCompilerOptions } from "../core/compileroptions.js";
import type { ProjectReference } from "../core/projectreference.js";
import type { ParsedOptions } from "../core/parsedoptions.js";
import type { ScriptKind } from "../core/scriptkind.js";
import { ScriptKindJSON, ScriptKindDeferred, ScriptKindJS, ScriptKindJSX } from "../core/scriptkind.js";
import { TSTrue, TSUnknown } from "../core/tristate.js";
import type { TypeAcquisition } from "../core/typeacquisition.js";
import * as diagnostics from "../diagnostics/generated/messages.js";
import type { Message } from "../diagnostics/diagnostics.js";
import { FromString as JsnumFromString } from "../jsnum/string.js";
import * as locale from "../locale/locale.js";
import { ResolveConfig } from "../module/resolver.js";
import type { ResolutionHost } from "../module/types.js";
import { ResolvedModule_IsResolved } from "../module/types.js";
import { GetBaseFileName, GetDirectoryPath, GetNormalizedAbsolutePath, NormalizeSlashes, NormalizePath, ToPath, CombinePaths, IsRootedDiskPath, HasExtension, EnsureTrailingDirectorySeparator, ConvertToRelativePath, GetCanonicalFileName, FileExtensionIs } from "../tspath/path.js";
import type { ComparePathsOptions, Path } from "../tspath/path.js";
import { ExtensionJson, ExtensionTs, ExtensionDts, ExtensionJs, ExtensionJsx, AllSupportedExtensions, SupportedTSExtensions, AllSupportedExtensionsWithJson, SupportedTSExtensionsWithJson, FileExtensionIsOneOf, ChangeExtension } from "../tspath/extension.js";
import * as core from "../core/core.js";
import { ParseSourceFile } from "../parser/parser/statements-declarations.js";
import type { SourceFileParseOptions } from "../ast/parseoptions.js";
import type { FS } from "../vfs/vfs.js";
import { NewSpecMatcher, SpecMatcher_MatchString, SpecMatcher_MatchIndex, ReadDirectory, UsageFiles, UsageExclude, UnlimitedDepth } from "../vfs/vfsmatch/vfsmatch.js";
import {
  CommandLineOptionTypeBoolean,
  CommandLineOptionTypeList,
  CommandLineOptionTypeListOrElement,
  CommandLineOptionTypeObject,
  CommandLineOptionTypeString,
  CommandLineOptionTypeEnum,
  commandLineOptionsToMap,
  extraValidationLocale,
  extraValidationNone,
  extraValidationSpec,
  newCommandLineOption,
  CommandLineOption_DisallowNullOrUndefined,
  CommandLineOption_Elements,
  CommandLineOption_EnumMap,
} from "./commandlineoption.js";
import type { CommandLineOption, CompilerOptionsValue } from "./commandlineoption.js";
import { OptionsDeclarations } from "./declscompiler.js";
import { typeAcquisitionDeclaration } from "./declstypeacquisition.js";
import {
  CreateDiagnosticForNodeInSourceFile,
  CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic,
  getCompilerOptionValueTypeString,
  createUnknownOptionError,
  extraKeyDiagnostics,
} from "./errors.js";
import {
  convertJsonOptionOfEnumType,
  tryReadFile,
} from "./commandlineparser.js";
import {
  parseJsonToStringKey,
  parseProjectReference,
  mergeCompilerOptions,
  compilerOptionsParser_as_optionParser,
  typeAcquisitionParser_as_optionParser,
  ParseCompilerOptions,
  ParseTypeAcquisition,
} from "./parsinghelpers.js";
import type { optionParser, compilerOptionsParser, typeAcquisitionParser } from "./parsinghelpers.js";
import type { ParsedCommandLine } from "./parsedcommandline.js";
import { NewParsedCommandLine } from "./parsedcommandline.js";


/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::type::extendsResult","kind":"type","status":"implemented","sigHash":"c7aea5f73d967b08ac0528a1d8b41421b0c463f32ac68d98e843b3a3f34c9be2","bodyHash":"a9a5e4be3ccd0e78727df342c62c509aaaf6cc61a508b4445c448b8a516cc80d"}
 *
 * Go source:
 * extendsResult struct {
 * 	options *core.CompilerOptions
 * 	// watchOptions        compiler.WatchOptions
 * 	watchOptionsCopied  bool
 * 	include             []any
 * 	exclude             []any
 * 	files               []any
 * 	compileOnSave       bool
 * 	extendedSourceFiles collections.Set[string]
 * }
 */
export interface extendsResult {
  options: GoPtr<CompilerOptions>;
  watchOptionsCopied: bool;
  include: GoSlice<unknown>;
  exclude: GoSlice<unknown>;
  files: GoSlice<unknown>;
  compileOnSave: bool;
  extendedSourceFiles: Set;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::varGroup::CommandLineCompilerOptionsMap","kind":"varGroup","status":"implemented","sigHash":"cf899e35c599db933c485788886b212911753bfeeeea1541bdd7467384c8aa13","bodyHash":"723a12b4926287ab5cf2a428562471604f67d0e3227fce5a90787cfbe37d2baf"}
 *
 * Go source:
 * var CommandLineCompilerOptionsMap CommandLineOptionNameMap = commandLineOptionsToMap(OptionsDeclarations)
 *
 * Note: hoisted above compilerOptionsDeclaration to match Go's package-level
 * initialization order (Go orders var initialization by dependency, not source position).
 */
export const CommandLineCompilerOptionsMap: CommandLineOptionNameMap = commandLineOptionsToMap(OptionsDeclarations);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::varGroup::compilerOptionsDeclaration","kind":"varGroup","status":"implemented","sigHash":"83cdeb7defd8e48a13dfcfb95ca091bfe9f3e1917639978a4461d29cfea28ffd","bodyHash":"79948a4186f3750d1a31f025dd692a43e081b2aac1df1a82591c937fbbe570d8"}
 *
 * Go source:
 * var compilerOptionsDeclaration = &CommandLineOption{
 * 	Name:           "compilerOptions",
 * 	Kind:           CommandLineOptionTypeObject,
 * 	ElementOptions: CommandLineCompilerOptionsMap,
 * }
 */
export const compilerOptionsDeclaration: GoPtr<CommandLineOption> = newCommandLineOption({
  Name: "compilerOptions",
  Kind: CommandLineOptionTypeObject,
  ElementOptions: CommandLineCompilerOptionsMap,
});

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::varGroup::compileOnSaveCommandLineOption","kind":"varGroup","status":"implemented","sigHash":"1d41fc503c60533218d861b97d514292a84342a1389bb6708097592b3ca9dae0","bodyHash":"d6c26d35d0cbd40a4b05c8ce0126ef31f5cb53da2e210f3d0585083dee226231"}
 *
 * Go source:
 * var compileOnSaveCommandLineOption = &CommandLineOption{
 * 	Name:                    "compileOnSave",
 * 	Kind:                    CommandLineOptionTypeBoolean,
 * 	DefaultValueDescription: false,
 * }
 */
export const compileOnSaveCommandLineOption: GoPtr<CommandLineOption> = newCommandLineOption({
  Name: "compileOnSave",
  Kind: CommandLineOptionTypeBoolean,
  DefaultValueDescription: false,
});

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::varGroup::extendsOptionDeclaration","kind":"varGroup","status":"implemented","sigHash":"15f616e78ca5a06b3f16c11b34837a503f4365783ba92a720ed8cd1c3f351458","bodyHash":"b2bcc7ea67e88d0110c5ed999162d5decfe1fabbb66dcd164ec3839aa8725e1f"}
 *
 * Go source:
 * var extendsOptionDeclaration = &CommandLineOption{
 * 	Name:     "extends",
 * 	Kind:     CommandLineOptionTypeListOrElement,
 * 	Category: diagnostics.File_Management,
 * 	ElementOptions: commandLineOptionsToMap([]*CommandLineOption{
 * 		{Name: "extends", Kind: CommandLineOptionTypeString},
 * 	}),
 * }
 */
export const extendsOptionDeclaration: GoPtr<CommandLineOption> = newCommandLineOption({
  Name: "extends",
  Kind: CommandLineOptionTypeListOrElement,
  Category: diagnostics.File_Management,
  ElementOptions: commandLineOptionsToMap([
    newCommandLineOption({ Name: "extends", Kind: CommandLineOptionTypeString }),
  ]),
});

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::varGroup::tsconfigRootOptionsMap","kind":"varGroup","status":"implemented","sigHash":"01f4d8133508b706dae59bd08be55aee887ffcc5419f74853bca070505f9064b","bodyHash":"40e309cd43177abe6fe029f9847d5e3df12b75df59e6e2d3a6b7404e64873615"}
 *
 * Go source:
 * var tsconfigRootOptionsMap = &CommandLineOption{
 * 	Name: "undefined", // should never be needed since this is root
 * 	Kind: CommandLineOptionTypeObject,
 * 	ElementOptions: commandLineOptionsToMap([]*CommandLineOption{
 * 		compilerOptionsDeclaration,
 * 		// watchOptionsDeclaration,
 * 		typeAcquisitionDeclaration,
 * 		extendsOptionDeclaration,
 * 		{
 * 			Name: "references",
 * 			Kind: CommandLineOptionTypeList, // should be a list of projectReference
 * 			// Category: diagnostics.Projects,
 * 		},
 * 		{
 * 			Name: "files",
 * 			Kind: CommandLineOptionTypeList,
 * 			// Category: diagnostics.File_Management,
 * 		},
 * 		{
 * 			Name: "include",
 * 			Kind: CommandLineOptionTypeList,
 * 			// Category: diagnostics.File_Management,
 * 			// DefaultValueDescription: diagnostics.if_files_is_specified_otherwise_Asterisk_Asterisk_Slash_Asterisk,
 * 		},
 * 		{
 * 			Name: "exclude",
 * 			Kind: CommandLineOptionTypeList,
 * 			// Category: diagnostics.File_Management,
 * 			// DefaultValueDescription: diagnostics.Node_modules_bower_components_jspm_packages_plus_the_value_of_outDir_if_one_is_specified,
 * 		},
 * 		compileOnSaveCommandLineOption,
 * 	}),
 * }
 */
export const tsconfigRootOptionsMap: GoPtr<CommandLineOption> = newCommandLineOption({
  Name: "undefined", // should never be needed since this is root
  Kind: CommandLineOptionTypeObject,
  ElementOptions: commandLineOptionsToMap([
    compilerOptionsDeclaration,
    // watchOptionsDeclaration,
    typeAcquisitionDeclaration,
    extendsOptionDeclaration,
    newCommandLineOption({
      Name: "references",
      Kind: CommandLineOptionTypeList, // should be a list of projectReference
      // Category: diagnostics.Projects,
    }),
    newCommandLineOption({
      Name: "files",
      Kind: CommandLineOptionTypeList,
      // Category: diagnostics.File_Management,
    }),
    newCommandLineOption({
      Name: "include",
      Kind: CommandLineOptionTypeList,
      // Category: diagnostics.File_Management,
      // DefaultValueDescription: diagnostics.if_files_is_specified_otherwise_Asterisk_Asterisk_Slash_Asterisk,
    }),
    newCommandLineOption({
      Name: "exclude",
      Kind: CommandLineOptionTypeList,
      // Category: diagnostics.File_Management,
      // DefaultValueDescription: diagnostics.Node_modules_bower_components_jspm_packages_plus_the_value_of_outDir_if_one_is_specified,
    }),
    compileOnSaveCommandLineOption,
  ]),
});

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::type::configFileSpecs","kind":"type","status":"implemented","sigHash":"0f3bad9971a4299dbdb2480b599c85770dc45e1f4d8b4def82fa92814736524c","bodyHash":"8270c6e45b5a8e65327256bf03409c2bd86c5769f3a30a54afc1857b951efae6"}
 *
 * Go source:
 * configFileSpecs struct {
 * 	filesSpecs any
 * 	// Present to report errors (user specified specs), validatedIncludeSpecs are used for file name matching
 * 	includeSpecs any
 * 	// Present to report errors (user specified specs), validatedExcludeSpecs are used for file name matching
 * 	excludeSpecs                            any
 * 	validatedFilesSpec                      []string
 * 	validatedIncludeSpecs                   []string
 * 	validatedExcludeSpecs                   []string
 * 	validatedFilesSpecBeforeSubstitution    []string
 * 	validatedIncludeSpecsBeforeSubstitution []string
 * 	isDefaultIncludeSpec                    bool
 * }
 */
export interface configFileSpecs {
  filesSpecs: unknown;
  includeSpecs: unknown;
  excludeSpecs: unknown;
  validatedFilesSpec: GoSlice<string>;
  validatedIncludeSpecs: GoSlice<string>;
  validatedExcludeSpecs: GoSlice<string>;
  validatedFilesSpecBeforeSubstitution: GoSlice<string>;
  validatedIncludeSpecsBeforeSubstitution: GoSlice<string>;
  isDefaultIncludeSpec: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::method::configFileSpecs.matchesExclude","kind":"method","status":"implemented","sigHash":"6347c91cad1f5b8ae2d0bc6d15612ac4a4627c79cfc93e4035dd1a9f0b5faca2","bodyHash":"bd81aa1c8d1f42e24813ec640a9c6bad4ce0a76590e0cf62ea794759c94aa341"}
 *
 * Go source:
 * func (c *configFileSpecs) matchesExclude(fileName string, comparePathsOptions tspath.ComparePathsOptions) bool {
 * 	if len(c.validatedExcludeSpecs) == 0 {
 * 		return false
 * 	}
 * 	excludeMatcher := vfsmatch.NewSpecMatcher(c.validatedExcludeSpecs, comparePathsOptions.CurrentDirectory, vfsmatch.UsageExclude, comparePathsOptions.UseCaseSensitiveFileNames)
 * 	if excludeMatcher == nil {
 * 		return false
 * 	}
 * 	if excludeMatcher.MatchString(fileName) {
 * 		return true
 * 	}
 * 	if !tspath.HasExtension(fileName) {
 * 		if excludeMatcher.MatchString(tspath.EnsureTrailingDirectorySeparator(fileName)) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function configFileSpecs_matchesExclude(receiver: GoPtr<configFileSpecs>, fileName: string, comparePathsOptions: ComparePathsOptions): bool {
  if ((receiver!.validatedExcludeSpecs ?? []).length === 0) {
    return false;
  }
  const excludeMatcher = NewSpecMatcher(receiver!.validatedExcludeSpecs, comparePathsOptions.CurrentDirectory, UsageExclude, comparePathsOptions.UseCaseSensitiveFileNames);
  if (excludeMatcher === undefined) {
    return false;
  }
  if (SpecMatcher_MatchString(excludeMatcher, fileName)) {
    return true;
  }
  if (!HasExtension(fileName)) {
    if (SpecMatcher_MatchString(excludeMatcher, EnsureTrailingDirectorySeparator(fileName))) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::method::configFileSpecs.getMatchedIncludeSpec","kind":"method","status":"implemented","sigHash":"4f9d3a0c4f8f51588d630675ed5777a7da927785e59c222ae3948dbc7d826644","bodyHash":"3e65c6e71c253692d41d5d25e6730d28b86f805007c5efd9de5883979b7a0652"}
 *
 * Go source:
 * func (c *configFileSpecs) getMatchedIncludeSpec(fileName string, comparePathsOptions tspath.ComparePathsOptions) string {
 * 	if len(c.validatedIncludeSpecs) == 0 {
 * 		return ""
 * 	}
 * 	for index, spec := range c.validatedIncludeSpecs {
 * 		includeMatcher := vfsmatch.NewSpecMatcher([]string{spec}, comparePathsOptions.CurrentDirectory, vfsmatch.UsageFiles, comparePathsOptions.UseCaseSensitiveFileNames)
 * 		if includeMatcher != nil && includeMatcher.MatchString(fileName) {
 * 			return c.validatedIncludeSpecsBeforeSubstitution[index]
 * 		}
 * 	}
 * 	return ""
 * }
 */
export function configFileSpecs_getMatchedIncludeSpec(receiver: GoPtr<configFileSpecs>, fileName: string, comparePathsOptions: ComparePathsOptions): string {
  if ((receiver!.validatedIncludeSpecs ?? []).length === 0) {
    return "";
  }
  for (let index = 0; index < receiver!.validatedIncludeSpecs.length; index++) {
    const spec = receiver!.validatedIncludeSpecs[index];
    const includeMatcher = NewSpecMatcher([spec!], comparePathsOptions.CurrentDirectory, UsageFiles, comparePathsOptions.UseCaseSensitiveFileNames);
    if (includeMatcher !== undefined && SpecMatcher_MatchString(includeMatcher, fileName)) {
      return receiver!.validatedIncludeSpecsBeforeSubstitution[index]!;
    }
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::method::configFileSpecs.getMatchedFileSpec","kind":"method","status":"implemented","sigHash":"c3c7519f866dcc9a126d2cff2423c03c2c4ce594d1a5509ae341534393c562dd","bodyHash":"69902249c4526d25ef6b9ead2aa4b85d9d1819677426f9eb1a400e946a30584a"}
 *
 * Go source:
 * func (c *configFileSpecs) getMatchedFileSpec(fileName string, comparePathsOptions tspath.ComparePathsOptions) string {
 * 	if len(c.validatedFilesSpec) == 0 {
 * 		return ""
 * 	}
 * 	filePath := tspath.ToPath(fileName, comparePathsOptions.CurrentDirectory, comparePathsOptions.UseCaseSensitiveFileNames)
 * 	for index, spec := range c.validatedFilesSpec {
 * 		if tspath.ToPath(spec, comparePathsOptions.CurrentDirectory, comparePathsOptions.UseCaseSensitiveFileNames) == filePath {
 * 			return c.validatedFilesSpecBeforeSubstitution[index]
 * 		}
 * 	}
 * 	return ""
 * }
 */
export function configFileSpecs_getMatchedFileSpec(receiver: GoPtr<configFileSpecs>, fileName: string, comparePathsOptions: ComparePathsOptions): string {
  if ((receiver!.validatedFilesSpec ?? []).length === 0) {
    return "";
  }
  const filePath = ToPath(fileName, comparePathsOptions.CurrentDirectory, comparePathsOptions.UseCaseSensitiveFileNames);
  for (let index = 0; index < receiver!.validatedFilesSpec.length; index++) {
    const spec = receiver!.validatedFilesSpec[index];
    if (ToPath(spec!, comparePathsOptions.CurrentDirectory, comparePathsOptions.UseCaseSensitiveFileNames) === filePath) {
      return receiver!.validatedFilesSpecBeforeSubstitution[index]!;
    }
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::type::FileExtensionInfo","kind":"type","status":"implemented","sigHash":"a5910979b7a34bd8276a9697b77103fd088b8151f7284e0276f39fea36b6988f","bodyHash":"e342463c999cdc6cb5a9464306a50ffefecb68834b7bc88b723c125f605acd76"}
 *
 * Go source:
 * FileExtensionInfo struct {
 * 	Extension      string
 * 	IsMixedContent bool
 * 	ScriptKind     core.ScriptKind
 * }
 */
export interface FileExtensionInfo {
  Extension: string;
  IsMixedContent: bool;
  ScriptKind: ScriptKind;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::type::ExtendedConfigCache","kind":"type","status":"implemented","sigHash":"135ba27068dc2b3d079395ded2b9b3986b49df6139fe7c2fcfc72fef9e15f0a4","bodyHash":"9db397aed2fad18b06357c86a334ef2ad5de99c9d6c69b1319845fed6a1c3903"}
 *
 * Go source:
 * ExtendedConfigCache interface {
 * 	GetExtendedConfig(fileName string, path tspath.Path, resolutionStack []string, host ParseConfigHost) *ExtendedConfigCacheEntry
 * }
 */
export interface ExtendedConfigCache {
  GetExtendedConfig(fileName: string, path: Path, resolutionStack: GoSlice<string>, host: ParseConfigHost): GoPtr<ExtendedConfigCacheEntry>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::type::ExtendedConfigCacheEntry","kind":"type","status":"implemented","sigHash":"a9e9705a8323ed0a5e831841abe8a604aa1dc568cd3a16c60c250bc732909f13","bodyHash":"f7771e89dad8a93129f8d53d886e1c52b8cb4521b3fb7d484ca493feb7d643c0"}
 *
 * Go source:
 * ExtendedConfigCacheEntry struct {
 * 	extendedResult *TsConfigSourceFile
 * 	extendedConfig *parsedTsconfig
 * 	errors         []*ast.Diagnostic
 * }
 */
export interface ExtendedConfigCacheEntry {
  extendedResult: GoPtr<TsConfigSourceFile>;
  extendedConfig: GoPtr<parsedTsconfig>;
  errors: GoSlice<GoPtr<Diagnostic>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::method::ExtendedConfigCacheEntry.ExtendedFileNames","kind":"method","status":"implemented","sigHash":"9ce53edd062f9cf82df14a84594914367d7e76e11f5d28ae2d883a49ddcaef66","bodyHash":"73df92bf5ebaf516662f7236957018b16f97f24af706b2e6e860526b43166e12"}
 *
 * Go source:
 * func (e *ExtendedConfigCacheEntry) ExtendedFileNames() []string {
 * 	if e.extendedResult != nil {
 * 		return e.extendedResult.ExtendedSourceFiles
 * 	}
 * 	return nil
 * }
 */
export function ExtendedConfigCacheEntry_ExtendedFileNames(receiver: GoPtr<ExtendedConfigCacheEntry>): GoSlice<string> {
  if (receiver!.extendedResult !== undefined) {
    return receiver!.extendedResult.ExtendedSourceFiles;
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::type::parsedTsconfig","kind":"type","status":"implemented","sigHash":"acb3b899a024f22f1f9025ca6d31b9948a1987b5de1346bc898027b9e4ce53ea","bodyHash":"467341198a48042300e1c327a033c6d2042f65dea080e68921062e67e19a8aac"}
 *
 * Go source:
 * parsedTsconfig struct {
 * 	raw     any
 * 	options *core.CompilerOptions
 * 	// watchOptions *core.WatchOptions
 * 	typeAcquisition *core.TypeAcquisition
 * 	// Note that the case of the config path has not yet been normalized, as no files have been imported into the project yet
 * 	extendedConfigPath any
 * }
 */
export interface parsedTsconfig {
  raw: unknown;
  options: GoPtr<CompilerOptions>;
  typeAcquisition: GoPtr<TypeAcquisition>;
  extendedConfigPath: unknown;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::parseOwnConfigOfJsonSourceFile","kind":"func","status":"implemented","sigHash":"ab9c853771e6f91dac31f6fc1ddce0cc22dc55cd1bf699f6f104d55c573d077f","bodyHash":"5794fbceaff4bed514398e27276df16d08ccea088bd9d667714d2229a74b0758"}
 *
 * Go source:
 * func parseOwnConfigOfJsonSourceFile(
 * 	sourceFile *ast.SourceFile,
 * 	host ParseConfigHost,
 * 	basePath string,
 * 	configFileName string,
 * ) (*parsedTsconfig, []*ast.Diagnostic) {
 * 	compilerOptions := getDefaultCompilerOptions(configFileName)
 * 	typeAcquisition := getDefaultTypeAcquisition(configFileName)
 * 	// var watchOptions *compiler.WatchOptions
 * 	var extendedConfigPath any
 * 	var rootCompilerOptions []*ast.PropertyName
 * 	var errors []*ast.Diagnostic
 * 	onPropertySet := func(
 * 		keyText string,
 * 		value any,
 * 		propertyAssignment *ast.PropertyAssignment,
 * 		parentOption *CommandLineOption, // TsConfigOnlyOption,
 * 		option *CommandLineOption,
 * 	) (any, []*ast.Diagnostic) {
 * 		// Ensure value is verified except for extends which is handled in its own way for error reporting
 * 		var propertySetErrors []*ast.Diagnostic
 * 		if option != nil && option != extendsOptionDeclaration {
 * 			value, propertySetErrors = convertJsonOption(option, value, basePath, propertyAssignment, propertyAssignment.Initializer, sourceFile)
 * 		}
 * 		if parentOption != nil && parentOption.Name != "undefined" && value != nil {
 * 			if option != nil && option.Name != "" {
 * 				var parseDiagnostics []*ast.Diagnostic
 * 				switch parentOption.Name {
 * 				case "compilerOptions":
 * 					parseDiagnostics = ParseCompilerOptions(option.Name, value, compilerOptions)
 * 				case "typeAcquisition":
 * 					parseDiagnostics = ParseTypeAcquisition(option.Name, value, typeAcquisition)
 * 				}
 * 				propertySetErrors = append(propertySetErrors, parseDiagnostics...)
 * 			} else if keyText != "" && extraKeyDiagnostics(parentOption.Name) != nil {
 * 				unknownNameDiag := extraKeyDiagnostics(parentOption.Name)
 * 				if parentOption.ElementOptions != nil {
 * 					// !!! TODO: support suggestion
 * 					propertySetErrors = append(propertySetErrors, createUnknownOptionError(
 * 						keyText,
 * 						unknownNameDiag,
 * 						"", /*unknownOptionErrorText* /
 * 						propertyAssignment.Name(),
 * 						sourceFile,
 * 						nil, /*alternateMode* /
 * 					))
 * 				} else {
 * 					// errors = append(errors, ast.NewCompilerDiagnostic(diagnostics.Unknown_compiler_option_0_Did_you_mean_1, keyText, core.FindKey(parentOption.ElementOptions, keyText)))
 * 				}
 * 			}
 * 		} else if parentOption == tsconfigRootOptionsMap {
 * 			if option == extendsOptionDeclaration {
 * 				configPath, err := getExtendsConfigPathOrArray(value, host, basePath, configFileName, propertyAssignment, propertyAssignment.Initializer, sourceFile)
 * 				extendedConfigPath = configPath
 * 				propertySetErrors = append(propertySetErrors, err...)
 * 			} else if option == nil {
 * 				if keyText == "excludes" {
 * 					propertySetErrors = append(propertySetErrors, CreateDiagnosticForNodeInSourceFile(sourceFile, propertyAssignment.Name(), diagnostics.Unknown_option_excludes_Did_you_mean_exclude))
 * 				}
 * 				if core.Find(OptionsDeclarations, func(option *CommandLineOption) bool { return option.Name == keyText }) != nil {
 * 					rootCompilerOptions = append(rootCompilerOptions, propertyAssignment.Name())
 * 				}
 * 			}
 * 		}
 * 		return value, propertySetErrors
 * 	}
 * 
 * 	json, err := convertConfigFileToObject(
 * 		sourceFile,
 * 		&jsonConversionNotifier{
 * 			tsconfigRootOptionsMap,
 * 			onPropertySet,
 * 		},
 * 	)
 * 	errors = append(errors, err...)
 * 	// if len(rootCompilerOptions) != 0  && json != nil && json.CompilerOptions != nil {
 * 	//    errors = append(errors, ast.NewDiagnostic(sourceFile, rootCompilerOptions[0], diagnostics.X_0_should_be_set_inside_the_compilerOptions_object_of_the_config_json_file))
 * 	// }
 * 	return &parsedTsconfig{
 * 		raw:     json,
 * 		options: compilerOptions,
 * 		// watchOptions:    watchOptions,
 * 		typeAcquisition:    typeAcquisition,
 * 		extendedConfigPath: extendedConfigPath,
 * 	}, errors
 * }
 */
export function parseOwnConfigOfJsonSourceFile(sourceFile: GoPtr<SourceFile>, host: ParseConfigHost, basePath: string, configFileName: string): [GoPtr<parsedTsconfig>, GoSlice<GoPtr<Diagnostic>>] {
  const compilerOptions = getDefaultCompilerOptions(configFileName);
  const typeAcquisition = getDefaultTypeAcquisition(configFileName);
  let extendedConfigPath: unknown = undefined;
  const errors: GoPtr<Diagnostic>[] = [];

  const onPropertySet = (
    keyText: string,
    value: unknown,
    propertyAssignment: GoPtr<PropertyAssignment>,
    parentOption: GoPtr<CommandLineOption>,
    option: GoPtr<CommandLineOption>,
  ): [unknown, GoSlice<GoPtr<Diagnostic>>] => {
    // Ensure value is verified except for extends which is handled in its own way for error reporting
    let currentValue = value;
    const propertySetErrors: GoPtr<Diagnostic>[] = [];
    if (option !== undefined && option !== extendsOptionDeclaration) {
      const [convertedValue, convertErr] = convertJsonOption(option, value, basePath, propertyAssignment, propertyAssignment!.Initializer, sourceFile);
      currentValue = convertedValue;
      propertySetErrors.push(...convertErr);
    }
    if (parentOption !== undefined && parentOption!.Name !== "undefined" && currentValue !== undefined && currentValue !== null) {
      if (option !== undefined && option!.Name !== "") {
        const parseDiagnostics: GoPtr<Diagnostic>[] = [];
        switch (parentOption!.Name) {
          case "compilerOptions": {
            const d = ParseCompilerOptions(option!.Name, currentValue, compilerOptions);
            parseDiagnostics.push(...(d ?? []));
            break;
          }
          case "typeAcquisition": {
            const d = ParseTypeAcquisition(option!.Name, currentValue, typeAcquisition);
            parseDiagnostics.push(...(d ?? []));
            break;
          }
        }
        propertySetErrors.push(...parseDiagnostics);
      } else if (keyText !== "" && extraKeyDiagnostics(parentOption!.Name) !== undefined) {
        const unknownNameDiag = extraKeyDiagnostics(parentOption!.Name);
        if (parentOption!.ElementOptions !== undefined) {
          propertySetErrors.push(createUnknownOptionError(
            keyText,
            unknownNameDiag,
            "" /*unknownOptionErrorText*/,
            propertyAssignment as unknown as GoPtr<Node>,
            sourceFile,
            undefined /*alternateMode*/,
          ));
        } else {
          // errors = append(errors, ast.NewCompilerDiagnostic(diagnostics.Unknown_compiler_option_0_Did_you_mean_1, keyText, core.FindKey(parentOption.ElementOptions, keyText)))
        }
      }
    } else if (parentOption === tsconfigRootOptionsMap) {
      if (option === extendsOptionDeclaration) {
        const [configPath, err] = getExtendsConfigPathOrArray(currentValue as CompilerOptionsValue, host, basePath, configFileName, propertyAssignment, propertyAssignment!.Initializer, sourceFile);
        extendedConfigPath = configPath;
        propertySetErrors.push(...err);
      } else if (option === undefined) {
        if (keyText === "excludes") {
          propertySetErrors.push(CreateDiagnosticForNodeInSourceFile(sourceFile, propertyAssignment as unknown as GoPtr<Node>, diagnostics.Unknown_option_excludes_Did_you_mean_exclude));
        }
        if (core.Find(OptionsDeclarations, (opt: GoPtr<CommandLineOption>): bool => opt!.Name === keyText) !== undefined) {
          // rootCompilerOptions tracking: not used in current implementation
        }
      }
    }
    return [currentValue, propertySetErrors];
  };

  const notifier: jsonConversionNotifier = {
    rootOptions: tsconfigRootOptionsMap,
    onPropertySet,
  };
  const [json, err] = convertConfigFileToObject(sourceFile, notifier);
  errors.push(...err);
  return [
    {
      raw: json,
      options: compilerOptions,
      typeAcquisition: typeAcquisition,
      extendedConfigPath: extendedConfigPath,
    },
    errors,
  ];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::type::TsConfigSourceFile","kind":"type","status":"implemented","sigHash":"223180191c8b39a3273a26fd9a879ce720dfaa84bb395ed01b926521bb2c9f77","bodyHash":"2ab83b71f39676670d7ff710e942aba2c83c838b4c09f8f6a0f28fb931497ed3"}
 *
 * Go source:
 * TsConfigSourceFile struct {
 * 	ExtendedSourceFiles []string
 * 	configFileSpecs     *configFileSpecs
 * 	SourceFile          *ast.SourceFile
 * }
 */
export interface TsConfigSourceFile {
  ExtendedSourceFiles: GoSlice<string>;
  configFileSpecs: GoPtr<configFileSpecs>;
  SourceFile: GoPtr<SourceFile>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::tsconfigToSourceFile","kind":"func","status":"implemented","sigHash":"9923d63ba2fd401c2c77d4c95124a502206b45144d0cb7da898ecb3450f8a5ca","bodyHash":"afa6e10b74f19e46020f57484bf5ed266e8fed6342337e11f90adb69e36ef6d2"}
 *
 * Go source:
 * func tsconfigToSourceFile(tsconfigSourceFile *TsConfigSourceFile) *ast.SourceFile {
 * 	if tsconfigSourceFile == nil {
 * 		return nil
 * 	}
 * 	return tsconfigSourceFile.SourceFile
 * }
 */
export function tsconfigToSourceFile(tsconfigSourceFile: GoPtr<TsConfigSourceFile>): GoPtr<SourceFile> {
  if (tsconfigSourceFile === undefined) {
    return undefined;
  }
  return tsconfigSourceFile.SourceFile;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::NewTsconfigSourceFileFromFilePath","kind":"func","status":"implemented","sigHash":"e5dc8ac1258af66d1312b04493a55f09a9c49af645ecdadd240c61f08071d73f","bodyHash":"aa68a0416e0f4f521cdd8553e3008d3393f184a6f3050d8f0f613a6eb4306f0a"}
 *
 * Go source:
 * func NewTsconfigSourceFileFromFilePath(configFileName string, configPath tspath.Path, configSourceText string) *TsConfigSourceFile {
 * 	sourceFile := parser.ParseSourceFile(ast.SourceFileParseOptions{
 * 		FileName: configFileName,
 * 		Path:     configPath,
 * 	}, configSourceText, core.ScriptKindJSON)
 * 	return &TsConfigSourceFile{
 * 		SourceFile: sourceFile,
 * 	}
 * }
 */
export function NewTsconfigSourceFileFromFilePath(configFileName: string, configPath: Path, configSourceText: string): GoPtr<TsConfigSourceFile> {
  const sourceFile = ParseSourceFile({ FileName: configFileName, Path: configPath } as SourceFileParseOptions, configSourceText, ScriptKindJSON);
  return {
    ExtendedSourceFiles: [],
    configFileSpecs: undefined,
    SourceFile: sourceFile,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::type::jsonConversionNotifier","kind":"type","status":"implemented","sigHash":"650d561798cd468bb7a09a3517ba3624372f22bca5aebdf39fe9cfd16a6c1cdb","bodyHash":"09abf378deb8d66a2317a8413d3a007bb3db642c65bc551521a18ac7f0b4f833"}
 *
 * Go source:
 * jsonConversionNotifier struct {
 * 	rootOptions   *CommandLineOption
 * 	onPropertySet func(keyText string, value any, propertyAssignment *ast.PropertyAssignment, parentOption *CommandLineOption, option *CommandLineOption) (any, []*ast.Diagnostic)
 * }
 */
export interface jsonConversionNotifier {
  rootOptions: GoPtr<CommandLineOption>;
  onPropertySet: (keyText: string, value: unknown, propertyAssignment: GoPtr<PropertyAssignment>, parentOption: GoPtr<CommandLineOption>, option: GoPtr<CommandLineOption>) => [unknown, GoSlice<GoPtr<Diagnostic>>];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::convertConfigFileToObject","kind":"func","status":"implemented","sigHash":"d5827d303a1ffbf5a7e6ee21ac602db6dc60da12134184b64967b5382e88fbe8","bodyHash":"ee517b1c790c3d22380a115621754a7e82c99acb95ef29a8bf54e633fc51a5b5"}
 *
 * Go source:
 * func convertConfigFileToObject(
 * 	sourceFile *ast.SourceFile,
 * 	jsonConversionNotifier *jsonConversionNotifier,
 * ) (any, []*ast.Diagnostic) {
 * 	var rootExpression *ast.Expression
 * 	if len(sourceFile.Statements.Nodes) > 0 {
 * 		rootExpression = sourceFile.Statements.Nodes[0].Expression()
 * 	}
 * 	if rootExpression != nil && rootExpression.Kind != ast.KindObjectLiteralExpression {
 * 		baseFileName := "tsconfig.json"
 * 		if tspath.GetBaseFileName(sourceFile.FileName()) == "jsconfig.json" {
 * 			baseFileName = "jsconfig.json"
 * 		}
 * 		errors := []*ast.Diagnostic{ast.NewCompilerDiagnostic(diagnostics.The_root_value_of_a_0_file_must_be_an_object, baseFileName)}
 * 		// Last-ditch error recovery. Somewhat useful because the JSON parser will recover from some parse errors by
 * 		// synthesizing a top-level array literal expression. There's a reasonable chance the first element of that
 * 		// array is a well-formed configuration object, made into an array element by stray characters.
 * 		if ast.IsArrayLiteralExpression(rootExpression) {
 * 			firstObject := core.Find(rootExpression.Elements(), ast.IsObjectLiteralExpression)
 * 			if firstObject != nil {
 * 				return convertToJson(sourceFile, firstObject, true /*returnValue* /, jsonConversionNotifier)
 * 			}
 * 		}
 * 		return &collections.OrderedMap[string, any]{}, errors
 * 	}
 * 	return convertToJson(sourceFile, rootExpression, true, jsonConversionNotifier)
 * }
 */
export function convertConfigFileToObject(sourceFile: GoPtr<SourceFile>, jsonConversionNotifier: GoPtr<jsonConversionNotifier>): [unknown, GoSlice<GoPtr<Diagnostic>>] {
  let rootExpression: GoPtr<Expression> = undefined;
  if ((sourceFile!.Statements!.Nodes?.length ?? 0) > 0) {
    rootExpression = Node_Expression(sourceFile!.Statements!.Nodes![0]) as GoPtr<Expression>;
  }
  if (rootExpression !== undefined && rootExpression!.Kind !== KindObjectLiteralExpression) {
    let baseFileName = "tsconfig.json";
    if (GetBaseFileName(SourceFile_FileName(sourceFile)) === "jsconfig.json") {
      baseFileName = "jsconfig.json";
    }
    const errors: GoPtr<Diagnostic>[] = [NewCompilerDiagnostic(diagnostics.The_root_value_of_a_0_file_must_be_an_object, baseFileName)];
    // Last-ditch error recovery. Somewhat useful because the JSON parser will recover from some parse errors by
    // synthesizing a top-level array literal expression. There's a reasonable chance the first element of that
    // array is a well-formed configuration object, made into an array element by stray characters.
    if (IsArrayLiteralExpression(rootExpression)) {
      const firstObject = core.Find(
        (Node_Elements(rootExpression) ?? []) as GoSlice<GoPtr<Node>>,
        (n: GoPtr<Node>): bool => IsObjectLiteralExpression(n) as bool,
      );
      if (firstObject !== undefined) {
        return convertToJson(sourceFile, firstObject as GoPtr<Expression>, true /*returnValue*/, jsonConversionNotifier);
      }
    }
    return [newMapWithSizeHint<string, unknown>(0), errors];
  }
  return convertToJson(sourceFile, rootExpression, true, jsonConversionNotifier);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::varGroup::orderedMapType","kind":"varGroup","status":"implemented","sigHash":"17cab9a1276ac342c15949905ddba707e89a6ceae0bc86104826add45c7284a2","bodyHash":"782a66df707fee84715122bc07af5a11d5d260fc295a79487398fb7f15be4ea0"}
 *
 * Go source:
 * var orderedMapType = reflect.TypeFor[*collections.OrderedMap[string, any]]()
 */
// In Go this is a reflect.Type used to check if a value is *OrderedMap[string, any].
// In TypeScript we represent this as a sentinel and use isOrderedMap() for the check.
export const orderedMapType: unique symbol = Symbol("orderedMapType");
export function isOrderedMap(value: unknown): value is OrderedMap {
  if (value === undefined || value === null || typeof value !== "object") {
    return false;
  }
  const m = value as Record<string, unknown>;
  return "keys" in m && "mp" in m && Array.isArray(m["keys"]) && m["mp"] instanceof Map;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::isCompilerOptionsValue","kind":"func","status":"implemented","sigHash":"4e66e2effa4658e3b8b080dfdd119d9a58a56739dcce3f57c66385c992c72698","bodyHash":"06fd51bf7e6cb4e0801a2c229dd1917fb7f9faf63d374321dac536165fbdf9b5"}
 *
 * Go source:
 * func isCompilerOptionsValue(option *CommandLineOption, value any) bool {
 * 	if option != nil {
 * 		if value == nil {
 * 			return !option.DisallowNullOrUndefined()
 * 		}
 * 		if option.Kind == "list" {
 * 			return reflect.TypeOf(value).Kind() == reflect.Slice
 * 		}
 * 		if option.Kind == "listOrElement" {
 * 			if reflect.TypeOf(value).Kind() == reflect.Slice {
 * 				return true
 * 			} else {
 * 				return isCompilerOptionsValue(option.Elements(), value)
 * 			}
 * 		}
 * 		if option.Kind == "string" {
 * 			return reflect.TypeOf(value).Kind() == reflect.String
 * 		}
 * 		if option.Kind == "boolean" {
 * 			return reflect.TypeOf(value).Kind() == reflect.Bool
 * 		}
 * 		if option.Kind == "number" {
 * 			return reflect.TypeOf(value).Kind() == reflect.Float64
 * 		}
 * 		if option.Kind == "object" {
 * 			return reflect.TypeOf(value) == orderedMapType
 * 		}
 * 		if option.Kind == "enum" && reflect.TypeOf(value).Kind() == reflect.String {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function isCompilerOptionsValue(option: GoPtr<CommandLineOption>, value: unknown): bool {
  if (option !== undefined) {
    if (value === undefined || value === null) {
      return !CommandLineOption_DisallowNullOrUndefined(option);
    }
    if (option!.Kind === "list") {
      return Array.isArray(value);
    }
    if (option!.Kind === "listOrElement") {
      if (Array.isArray(value)) {
        return true;
      } else {
        return isCompilerOptionsValue(CommandLineOption_Elements(option), value);
      }
    }
    if (option!.Kind === "string") {
      return typeof value === "string";
    }
    if (option!.Kind === "boolean") {
      return typeof value === "boolean";
    }
    if (option!.Kind === "number") {
      return typeof value === "number";
    }
    if (option!.Kind === "object") {
      return isOrderedMap(value);
    }
    if (option!.Kind === "enum" && typeof value === "string") {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::validateJsonOptionValue","kind":"func","status":"implemented","sigHash":"6107912a2a63ef77047fb1087c7be16eceae19d2eecb2aac5a17755974734632","bodyHash":"f1019cb15b456f56bdbeeaa3a2638ebf56d351d22c203e6e17208815cc9d518d"}
 *
 * Go source:
 * func validateJsonOptionValue(
 * 	opt *CommandLineOption,
 * 	val any,
 * 	valueExpression *ast.Expression,
 * 	sourceFile *ast.SourceFile,
 * ) (any, []*ast.Diagnostic) {
 * 	if val == nil {
 * 		return nil, nil
 * 	}
 * 
 * 	var errors []*ast.Diagnostic
 * 
 * 	switch opt.extraValidation {
 * 	case extraValidationSpec:
 * 		if diag := specToDiagnostic(val.(string), false); diag != nil {
 * 			errors = append(errors, CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile, valueExpression, diag))
 * 		}
 * 	case extraValidationLocale:
 * 		if _, ok := locale.Parse(val.(string)); !ok {
 * 			errors = append(errors, CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile, valueExpression, diagnostics.Locale_must_be_an_IETF_BCP_47_language_tag_Examples_Colon_0_1, "en", "ja-jp"))
 * 		}
 * 	}
 * 
 * 	if len(errors) > 0 {
 * 		return nil, errors
 * 	}
 * 	return val, nil
 * }
 */
export function validateJsonOptionValue(opt: GoPtr<CommandLineOption>, val: unknown, valueExpression: GoPtr<Expression>, sourceFile: GoPtr<SourceFile>): [unknown, GoSlice<GoPtr<Diagnostic>>] {
  if (val === undefined || val === null) {
    return [undefined, []];
  }
  const errors: GoPtr<Diagnostic>[] = [];
  switch (opt!.extraValidation) {
    case extraValidationSpec: {
      const diag = specToDiagnostic(val as string, false);
      if (diag !== undefined) {
        errors.push(CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile, valueExpression, diag));
      }
      break;
    }
    case extraValidationLocale: {
      const [, ok] = locale.Parse(val as string);
      if (!ok) {
        errors.push(CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile, valueExpression, diagnostics.Locale_must_be_an_IETF_BCP_47_language_tag_Examples_Colon_0_1, "en", "ja-jp"));
      }
      break;
    }
  }
  if (errors.length > 0) {
    return [undefined, errors];
  }
  return [val, []];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::convertJsonOptionOfListType","kind":"func","status":"implemented","sigHash":"3217eeaa2a06327b50dd87dde023f4856193d5603eec1dbc6856ad3239e869b4","bodyHash":"fbcdd8ae738aea247f0e23e139e6121ac7951ad319364f81251bb8fb9272efbb"}
 *
 * Go source:
 * func convertJsonOptionOfListType(
 * 	option *CommandLineOption,
 * 	values any,
 * 	basePath string,
 * 	propertyAssignment *ast.PropertyAssignment,
 * 	valueExpression *ast.Node,
 * 	sourceFile *ast.SourceFile,
 * ) ([]any, []*ast.Diagnostic) {
 * 	var expression *ast.Node
 * 	var errors []*ast.Diagnostic
 * 	if values, ok := values.([]any); ok {
 * 		mappedValues := core.MapIndex(values, func(v any, index int) any {
 * 			if valueExpression != nil {
 * 				expression = valueExpression.Elements()[index]
 * 			}
 * 			result, err := convertJsonOption(option.Elements(), v, basePath, propertyAssignment, expression, sourceFile)
 * 			errors = append(errors, err...)
 * 			return result
 * 		})
 * 		filteredValues := mappedValues
 * 		if !option.listPreserveFalsyValues {
 * 			filteredValues = core.Filter(mappedValues, func(v any) bool {
 * 				return (v != nil && v != false && v != 0 && v != "")
 * 			})
 * 		}
 * 		return filteredValues, errors
 * 	}
 * 	return nil, errors
 * }
 */
export function convertJsonOptionOfListType(option: GoPtr<CommandLineOption>, values: unknown, basePath: string, propertyAssignment: GoPtr<PropertyAssignment>, valueExpression: GoPtr<Node>, sourceFile: GoPtr<SourceFile>): [GoSlice<unknown>, GoSlice<GoPtr<Diagnostic>>] {
  let expression: GoPtr<Node> = undefined;
  const errors: GoPtr<Diagnostic>[] = [];
  if (Array.isArray(values)) {
    const valuesArr = values as unknown[];
    const mappedValues = core.MapIndex(valuesArr, (v: unknown, index: int): unknown => {
      if (valueExpression !== undefined) {
        const elems = Node_Elements(valueExpression);
        expression = elems !== undefined ? elems[index] : undefined;
      }
      const [result, err] = convertJsonOption(CommandLineOption_Elements(option), v, basePath, propertyAssignment, expression as GoPtr<Expression>, sourceFile);
      errors.push(...err);
      return result;
    });
    let filteredValues = mappedValues;
    if (!option!.listPreserveFalsyValues) {
      filteredValues = core.Filter(mappedValues, (v: unknown): bool => {
        return (v !== undefined && v !== null && v !== false && v !== 0 && v !== "") as bool;
      });
    }
    return [filteredValues, errors];
  }
  return [[], errors];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::constGroup::configDirTemplate","kind":"constGroup","status":"implemented","sigHash":"d084f86ea78d7aa710331d83cc930347fb11aa48f416d30734b2da9579184fef","bodyHash":"0d5562b4a971c61f0c7d33bfc4d7bc6a475d94eb021186abad7d65461bf1338e"}
 *
 * Go source:
 * const configDirTemplate = "${configDir}"
 */
export const configDirTemplate: string = "${configDir}";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::startsWithConfigDirTemplate","kind":"func","status":"implemented","sigHash":"de28501c06adc338a36ecd89ab4844c62895e0092995ffa3be108c230f651767","bodyHash":"b932a4ec464d99c07f170523eb0c61e4c34e64299d52060f16730c50b0adcf95"}
 *
 * Go source:
 * func startsWithConfigDirTemplate(value any) bool {
 * 	str, ok := value.(string)
 * 	if !ok {
 * 		return false
 * 	}
 * 	return strings.HasPrefix(strings.ToLower(str), strings.ToLower(configDirTemplate))
 * }
 */
export function startsWithConfigDirTemplate(value: unknown): bool {
  if (typeof value !== "string") {
    return false;
  }
  const str = value;
  return strings.HasPrefix(strings.ToLower(str), strings.ToLower(configDirTemplate));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::normalizeNonListOptionValue","kind":"func","status":"implemented","sigHash":"2bc4d1acf2d0e3b0299dd766227719a2c710c9360b2dd99fb2af0c47df3fddbf","bodyHash":"da21d5bc5f79416e953cf50618eff8972ed042b6adcb59a181121d456ab18028"}
 *
 * Go source:
 * func normalizeNonListOptionValue(option *CommandLineOption, basePath string, value any) any {
 * 	if option.IsFilePath {
 * 		value = tspath.NormalizeSlashes(value.(string))
 * 		if !startsWithConfigDirTemplate(value) {
 * 			value = tspath.GetNormalizedAbsolutePath(value.(string), basePath)
 * 		}
 * 		if value == "" {
 * 			value = "."
 * 		}
 * 	}
 * 	return value
 * }
 */
export function normalizeNonListOptionValue(option: GoPtr<CommandLineOption>, basePath: string, value: unknown): unknown {
  let result = value;
  if (option!.IsFilePath) {
    result = NormalizeSlashes(result as string);
    if (!startsWithConfigDirTemplate(result)) {
      result = GetNormalizedAbsolutePath(result as string, basePath);
    }
    if (result === "") {
      result = ".";
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::convertJsonOption","kind":"func","status":"implemented","sigHash":"016694a7f3347b9d2bf950c36a574be0c112f15d18ed130c311e04b383d52d3c","bodyHash":"804dee7f3ba5080ea45d1ca223e1e8ab5bc005793f5cc073098f21d5581bcd1f"}
 *
 * Go source:
 * func convertJsonOption(
 * 	opt *CommandLineOption,
 * 	value any,
 * 	basePath string,
 * 	propertyAssignment *ast.PropertyAssignment,
 * 	valueExpression *ast.Expression,
 * 	sourceFile *ast.SourceFile,
 * ) (any, []*ast.Diagnostic) {
 * 	if opt.IsCommandLineOnly {
 * 		var nodeValue *ast.Node
 * 		if propertyAssignment != nil {
 * 			nodeValue = propertyAssignment.Name()
 * 		}
 * 		if sourceFile == nil && nodeValue == nil {
 * 			return nil, []*ast.Diagnostic{ast.NewCompilerDiagnostic(diagnostics.Option_0_can_only_be_specified_on_command_line, opt.Name)}
 * 		} else {
 * 			return nil, []*ast.Diagnostic{CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile, nodeValue, diagnostics.Option_0_can_only_be_specified_on_command_line, opt.Name)}
 * 		}
 * 	}
 * 	if isCompilerOptionsValue(opt, value) {
 * 		switch opt.Kind {
 * 		case CommandLineOptionTypeList:
 * 			return convertJsonOptionOfListType(opt, value, basePath, propertyAssignment, valueExpression, sourceFile) // as ArrayLiteralExpression | undefined
 * 		case CommandLineOptionTypeListOrElement:
 * 			if reflect.TypeOf(value).Kind() == reflect.Slice {
 * 				return convertJsonOptionOfListType(opt, value, basePath, propertyAssignment, valueExpression, sourceFile)
 * 			} else {
 * 				return convertJsonOption(opt.Elements(), value, basePath, propertyAssignment, valueExpression, sourceFile)
 * 			}
 * 		case CommandLineOptionTypeEnum:
 * 			return convertJsonOptionOfEnumType(opt, value.(string), valueExpression, sourceFile)
 * 		}
 * 
 * 		validatedValue, errors := validateJsonOptionValue(opt, value, valueExpression, sourceFile)
 * 		if len(errors) > 0 || validatedValue == nil {
 * 			return validatedValue, errors
 * 		} else {
 * 			return normalizeNonListOptionValue(opt, basePath, validatedValue), errors
 * 		}
 * 	} else {
 * 		return nil, []*ast.Diagnostic{CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile, valueExpression, diagnostics.Compiler_option_0_requires_a_value_of_type_1, opt.Name, getCompilerOptionValueTypeString(opt))}
 * 	}
 * }
 */
export function convertJsonOption(opt: GoPtr<CommandLineOption>, value: unknown, basePath: string, propertyAssignment: GoPtr<PropertyAssignment>, valueExpression: GoPtr<Expression>, sourceFile: GoPtr<SourceFile>): [unknown, GoSlice<GoPtr<Diagnostic>>] {
  if (opt!.IsCommandLineOnly) {
    let nodeValue: GoPtr<Node> = undefined;
    if (propertyAssignment !== undefined) {
      nodeValue = propertyAssignment as unknown as GoPtr<Node>;
    }
    if (sourceFile === undefined && nodeValue === undefined) {
      return [undefined, [NewCompilerDiagnostic(diagnostics.Option_0_can_only_be_specified_on_command_line, opt!.Name)]];
    } else {
      return [undefined, [CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile, nodeValue, diagnostics.Option_0_can_only_be_specified_on_command_line, opt!.Name)]];
    }
  }
  if (isCompilerOptionsValue(opt, value)) {
    switch (opt!.Kind) {
      case CommandLineOptionTypeList:
        return convertJsonOptionOfListType(opt, value, basePath, propertyAssignment, valueExpression, sourceFile);
      case CommandLineOptionTypeListOrElement:
        if (Array.isArray(value)) {
          return convertJsonOptionOfListType(opt, value, basePath, propertyAssignment, valueExpression, sourceFile);
        } else {
          return convertJsonOption(CommandLineOption_Elements(opt), value, basePath, propertyAssignment, valueExpression, sourceFile);
        }
      case CommandLineOptionTypeEnum:
        return convertJsonOptionOfEnumType(opt, value as string, valueExpression, sourceFile);
    }
    const [validatedValue, errors] = validateJsonOptionValue(opt, value, valueExpression, sourceFile);
    if (errors.length > 0 || validatedValue === undefined) {
      return [validatedValue, errors];
    } else {
      return [normalizeNonListOptionValue(opt, basePath, validatedValue), errors];
    }
  } else {
    return [undefined, [CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(sourceFile, valueExpression, diagnostics.Compiler_option_0_requires_a_value_of_type_1, opt!.Name, getCompilerOptionValueTypeString(opt))]];
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::getExtendsConfigPathOrArray","kind":"func","status":"implemented","sigHash":"2c664fce3bd6961044fab9b02fc0aad600aa4acee54f38be3422451956e6e140","bodyHash":"113ad2f6c38f337f555d464f2cea981cc9cbe343722e752e5a95c1e6f0e9dcff"}
 *
 * Go source:
 * func getExtendsConfigPathOrArray(
 * 	value CompilerOptionsValue,
 * 	host ParseConfigHost,
 * 	basePath string,
 * 	configFileName string,
 * 	propertyAssignment *ast.PropertyAssignment,
 * 	valueExpression *ast.Expression,
 * 	sourceFile *ast.SourceFile,
 * ) ([]string, []*ast.Diagnostic) {
 * 	var extendedConfigPathArray []string
 * 	newBase := basePath
 * 	if configFileName != "" {
 * 		newBase = directoryOfCombinedPath(configFileName, basePath)
 * 	}
 * 	if reflect.TypeOf(value).Kind() == reflect.String {
 * 		val, err := getExtendsConfigPath(value.(string), host, newBase, valueExpression, sourceFile)
 * 		if val != "" {
 * 			extendedConfigPathArray = append(extendedConfigPathArray, val)
 * 		}
 * 		return extendedConfigPathArray, err
 * 	}
 * 	var errors []*ast.Diagnostic
 * 	if reflect.TypeOf(value).Kind() == reflect.Slice {
 * 		for index, fileName := range value.([]any) {
 * 			var expression *ast.Expression = nil
 * 			if valueExpression != nil {
 * 				expression = valueExpression.Elements()[index]
 * 			}
 * 			if reflect.TypeOf(fileName).Kind() == reflect.String {
 * 				val, err := getExtendsConfigPath(fileName.(string), host, newBase, expression, sourceFile)
 * 				if val != "" {
 * 					extendedConfigPathArray = append(extendedConfigPathArray, val)
 * 				}
 * 				errors = append(errors, err...)
 * 			} else {
 * 				_, err := convertJsonOption(extendsOptionDeclaration.Elements(), value, basePath, propertyAssignment, expression, sourceFile)
 * 				errors = append(errors, err...)
 * 			}
 * 		}
 * 	} else {
 * 		_, errors = convertJsonOption(extendsOptionDeclaration, value, basePath, propertyAssignment, valueExpression, sourceFile)
 * 	}
 * 	return extendedConfigPathArray, errors
 * }
 */
export function getExtendsConfigPathOrArray(value: CompilerOptionsValue, host: ParseConfigHost, basePath: string, configFileName: string, propertyAssignment: GoPtr<PropertyAssignment>, valueExpression: GoPtr<Expression>, sourceFile: GoPtr<SourceFile>): [GoSlice<string>, GoSlice<GoPtr<Diagnostic>>] {
  const extendedConfigPathArray: string[] = [];
  let newBase = basePath;
  if (configFileName !== "") {
    newBase = directoryOfCombinedPath(configFileName, basePath);
  }
  if (typeof value === "string") {
    const [val, err] = getExtendsConfigPath(value, host, newBase, valueExpression, sourceFile);
    if (val !== "") {
      extendedConfigPathArray.push(val);
    }
    return [extendedConfigPathArray, err];
  }
  const errors: GoPtr<Diagnostic>[] = [];
  if (Array.isArray(value)) {
    const valueArr = value as unknown[];
    for (let index = 0; index < valueArr.length; index++) {
      const fileName = valueArr[index];
      let expression: GoPtr<Expression> = undefined;
      if (valueExpression !== undefined) {
        const elems = Node_Elements(valueExpression);
        expression = elems !== undefined ? elems[index] as GoPtr<Expression> : undefined;
      }
      if (typeof fileName === "string") {
        const [val, err] = getExtendsConfigPath(fileName, host, newBase, expression, sourceFile);
        if (val !== "") {
          extendedConfigPathArray.push(val);
        }
        errors.push(...err);
      } else {
        const [, err] = convertJsonOption(CommandLineOption_Elements(extendsOptionDeclaration), value, basePath, propertyAssignment, expression, sourceFile);
        errors.push(...err);
      }
    }
  } else {
    const [, errs] = convertJsonOption(extendsOptionDeclaration, value, basePath, propertyAssignment, valueExpression, sourceFile);
    errors.push(...errs);
  }
  return [extendedConfigPathArray, errors];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::getExtendsConfigPath","kind":"func","status":"implemented","sigHash":"831047d7a4b217c66500dddcde163e970c43c4c8a24931804a9e2fe0b5c2660b","bodyHash":"ddcd820b1c2db03ae2c243462e3b21f95623164f49531c858fa6b4be17bcc58f"}
 *
 * Go source:
 * func getExtendsConfigPath(
 * 	extendedConfig string,
 * 	host ParseConfigHost,
 * 	basePath string,
 * 	valueExpression *ast.Expression,
 * 	sourceFile *ast.SourceFile,
 * ) (string, []*ast.Diagnostic) {
 * 	extendedConfig = tspath.NormalizeSlashes(extendedConfig)
 * 	var errors []*ast.Diagnostic
 * 	var errorFile *ast.SourceFile
 * 	if sourceFile != nil {
 * 		errorFile = sourceFile
 * 	}
 * 	if tspath.IsRootedDiskPath(extendedConfig) || strings.HasPrefix(extendedConfig, "./") || strings.HasPrefix(extendedConfig, "../") {
 * 		extendedConfigPath := tspath.GetNormalizedAbsolutePath(extendedConfig, basePath)
 * 		if !host.FS().FileExists(extendedConfigPath) && !strings.HasSuffix(extendedConfigPath, tspath.ExtensionJson) {
 * 			extendedConfigPath = extendedConfigPath + tspath.ExtensionJson
 * 			if !host.FS().FileExists(extendedConfigPath) {
 * 				errors = append(errors, CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(errorFile, valueExpression, diagnostics.File_0_not_found, extendedConfig))
 * 				return "", errors
 * 			}
 * 		}
 * 		return extendedConfigPath, errors
 * 	}
 * 	// If the path isn't a rooted or relative path, resolve like a module
 * 	resolverHost := &resolverHost{host}
 * 	if resolved := module.ResolveConfig(extendedConfig, tspath.CombinePaths(basePath, "tsconfig.json"), resolverHost); resolved.IsResolved() {
 * 		return resolved.ResolvedFileName, errors
 * 	}
 * 	if extendedConfig == "" {
 * 		errors = append(errors, CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(errorFile, valueExpression, diagnostics.Compiler_option_0_cannot_be_given_an_empty_string, "extends"))
 * 	} else {
 * 		errors = append(errors, CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(errorFile, valueExpression, diagnostics.File_0_not_found, extendedConfig))
 * 	}
 * 	return "", errors
 * }
 */
export function getExtendsConfigPath(extendedConfig: string, host: ParseConfigHost, basePath: string, valueExpression: GoPtr<Expression>, sourceFile: GoPtr<SourceFile>): [string, GoSlice<GoPtr<Diagnostic>>] {
  extendedConfig = NormalizeSlashes(extendedConfig);
  const errors: GoPtr<Diagnostic>[] = [];
  let errorFile: GoPtr<SourceFile> = undefined;
  if (sourceFile !== undefined) {
    errorFile = sourceFile;
  }
  if (IsRootedDiskPath(extendedConfig) || strings.HasPrefix(extendedConfig, "./") || strings.HasPrefix(extendedConfig, "../")) {
    let extendedConfigPath = GetNormalizedAbsolutePath(extendedConfig, basePath);
    if (!host.FS().FileExists(extendedConfigPath) && !strings.HasSuffix(extendedConfigPath, ExtensionJson)) {
      extendedConfigPath = extendedConfigPath + ExtensionJson;
      if (!host.FS().FileExists(extendedConfigPath)) {
        errors.push(CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(errorFile, valueExpression, diagnostics.File_0_not_found, extendedConfig));
        return ["", errors];
      }
    }
    return [extendedConfigPath, errors];
  }
  // If the path isn't a rooted or relative path, resolve like a module
  const resolverHostInst: resolverHost = { __tsgoEmbedded0: host };
  const resolverHostAsResolution: ResolutionHost = {
    FS: () => host.FS(),
    GetCurrentDirectory: () => host.GetCurrentDirectory(),
  };
  const resolved = ResolveConfig(extendedConfig, CombinePaths(basePath, "tsconfig.json"), resolverHostAsResolution);
  if (ResolvedModule_IsResolved(resolved)) {
    return [resolved!.ResolvedFileName, errors];
  }
  if (extendedConfig === "") {
    errors.push(CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(errorFile, valueExpression, diagnostics.Compiler_option_0_cannot_be_given_an_empty_string, "extends"));
  } else {
    errors.push(CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(errorFile, valueExpression, diagnostics.File_0_not_found, extendedConfig));
  }
  return ["", errors];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::type::tsConfigOptions","kind":"type","status":"implemented","sigHash":"903f6329787ed9c353369c4bfae67d3b701e5414612a1e1e017e62ee753e3f72","bodyHash":"f0fe9eae55eca95788e0681e9309a54b54d192d0d859ac2de19cd4f295de431e"}
 *
 * Go source:
 * tsConfigOptions struct {
 * 	prop       map[string][]string
 * 	references []*core.ProjectReference
 * 	notDefined string
 * }
 */
export interface tsConfigOptions {
  prop: GoMap<string, GoSlice<string>>;
  references: GoSlice<GoPtr<ProjectReference>>;
  notDefined: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::type::CommandLineOptionNameMap","kind":"type","status":"implemented","sigHash":"9f36b6083a1ed4384410f4fc0026653f95d3ad27a5b928b04a4bb28e2288844b","bodyHash":"ff8784e66cdac1d320a00338a06c9021ef96c315ffa60afc13d5f606bf2193e4"}
 *
 * Go source:
 * CommandLineOptionNameMap map[string]*CommandLineOption
 */
export type CommandLineOptionNameMap = GoMap<string, GoPtr<CommandLineOption>>;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::method::CommandLineOptionNameMap.Get","kind":"method","status":"implemented","sigHash":"ec7ceeaac239f48b5d3d1b64b0a4c25d21530cbd880b808fbedee5e455f1bb3b","bodyHash":"4adf525493f252b4a6a4b97af317df2a839c7888a7c0abff5cbae04bbc24a351"}
 *
 * Go source:
 * func (m CommandLineOptionNameMap) Get(name string) *CommandLineOption {
 * 	opt, ok := m[name]
 * 	if !ok {
 * 		opt, _ = m[strings.ToLower(name)]
 * 	}
 * 	return opt
 * }
 */
export function CommandLineOptionNameMap_Get(receiver: CommandLineOptionNameMap, name: string): GoPtr<CommandLineOption> {
  const m = receiver;
  const found = m.get(name);
  if (found !== undefined) {
    return found;
  }
  return m.get(strings.ToLower(name));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::commandLineOptionsToMap","kind":"func","status":"implemented","sigHash":"081d3f3103c307b2574d7a959557b4982f939f8d9e93b5cd43a8dfea4b7e6b69","bodyHash":"b8874c0fab8b4fd0a26e0bff29085c89d47dda56b079469f5f18588ce490017e"}
 *
 * Go source:
 * func commandLineOptionsToMap(compilerOptions []*CommandLineOption) CommandLineOptionNameMap {
 * 	result := make(map[string]*CommandLineOption, len(compilerOptions)*2)
 * 	for i := range compilerOptions {
 * 		result[compilerOptions[i].Name] = compilerOptions[i]
 * 		result[strings.ToLower(compilerOptions[i].Name)] = compilerOptions[i]
 * 	}
 * 	return result
 * }
 */
export { commandLineOptionsToMap };

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::convertMapToOptions","kind":"func","status":"implemented","sigHash":"2099546fa2b212ab262c21918a9ad7d8d01578776ff55a8ae02ef835fad547ff","bodyHash":"19cf6bce2f87e925e869c86e7b15ffe8e3718bf1bf5b8571d2a183cb717a0eab"}
 *
 * Go source:
 * func convertMapToOptions[O optionParser](compilerOptions *collections.OrderedMap[string, any], result O) O {
 * 	// this assumes any `key`, `value` pair in `options` will have `value` already be the correct type. this function should no error handling
 * 	for key, value := range compilerOptions.Entries() {
 * 		result.ParseOption(key, value)
 * 	}
 * 	return result
 * }
 */
export function convertMapToOptions<O extends optionParser>(compilerOptions: GoPtr<OrderedMap>, result: O): O {
  // this assumes any `key`, `value` pair in `options` will have `value` already be the correct type. this function should no error handling
  OrderedMap_Entries(compilerOptions as GoPtr<OrderedMap<string, unknown>>)((key: string, value: unknown): bool => {
    result.ParseOption(key, value);
    return true;
  });
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::convertOptionsFromJson","kind":"func","status":"implemented","sigHash":"4f41de962d1396420c47dc1c4dd23cd671c33c016d893f1c2df5ece23d645d12","bodyHash":"48d9ffddd407c47733efb0bab8f59310a553a33a04fe06b26ca67de46f5e57ea"}
 *
 * Go source:
 * func convertOptionsFromJson[O optionParser](optionsNameMap CommandLineOptionNameMap, jsonOptions any, basePath string, result O) (O, []*ast.Diagnostic) {
 * 	if jsonOptions == nil {
 * 		return result, nil
 * 	}
 * 	jsonMap, ok := jsonOptions.(*collections.OrderedMap[string, any])
 * 	if !ok {
 * 		// !!! probably should be an error
 * 		return result, nil
 * 	}
 * 	var errors []*ast.Diagnostic
 * 	for key, value := range jsonMap.Entries() {
 * 		opt := optionsNameMap.Get(key)
 * 		if opt == nil {
 * 			// !!! TODO?: support suggestion
 * 			errors = append(errors, createUnknownOptionError(key, result.UnknownOptionDiagnostic(), "", nil, nil, nil))
 * 			continue
 * 		}
 * 
 * 		commandLineOptionEnumMapVal := opt.EnumMap()
 * 		if commandLineOptionEnumMapVal != nil {
 * 			val, ok := commandLineOptionEnumMapVal.Get(strings.ToLower(value.(string)))
 * 			if ok {
 * 				errors = result.ParseOption(key, val)
 * 			}
 * 		} else {
 * 			convertJson, err := convertJsonOption(opt, value, basePath, nil, nil, nil)
 * 			errors = append(errors, err...)
 * 			compilerOptionsErr := result.ParseOption(key, convertJson)
 * 			errors = append(errors, compilerOptionsErr...)
 * 		}
 * 	}
 * 	return result, errors
 * }
 */
export function convertOptionsFromJson<O extends optionParser>(optionsNameMap: CommandLineOptionNameMap, jsonOptions: unknown, basePath: string, result: O): [O, GoSlice<GoPtr<Diagnostic>>] {
  if (jsonOptions === undefined || jsonOptions === null) {
    return [result, []];
  }
  if (!isOrderedMap(jsonOptions)) {
    // !!! probably should be an error
    return [result, []];
  }
  const jsonMap = jsonOptions as GoPtr<OrderedMap<string, unknown>>;
  const errors: GoPtr<Diagnostic>[] = [];
  OrderedMap_Entries(jsonMap)((key: string, value: unknown): bool => {
    const opt = CommandLineOptionNameMap_Get(optionsNameMap, key);
    if (opt === undefined) {
      // !!! TODO?: support suggestion
      errors.push(createUnknownOptionError(key, result.UnknownOptionDiagnostic(), "", undefined, undefined, undefined));
      return true;
    }
    const commandLineOptionEnumMapVal = CommandLineOption_EnumMap(opt);
    if (commandLineOptionEnumMapVal !== undefined) {
      const [val, ok] = OrderedMap_Get(commandLineOptionEnumMapVal as GoPtr<OrderedMap<string, unknown>>, strings.ToLower(value as string));
      if (ok) {
        const compilerOptionsErr = result.ParseOption(key, val);
        errors.push(...(compilerOptionsErr ?? []));
      }
    } else {
      const [convertJson, err] = convertJsonOption(opt, value, basePath, undefined, undefined, undefined);
      errors.push(...err);
      const compilerOptionsErr = result.ParseOption(key, convertJson);
      errors.push(...(compilerOptionsErr ?? []));
    }
    return true;
  });
  return [result, errors];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::convertArrayLiteralExpressionToJson","kind":"func","status":"implemented","sigHash":"6fe79d2c7e658814cc9ace2df41e3922d2bf39d109bdfba5db5e8ae913694561","bodyHash":"8889ab00faccd8a836322209241f3e50e9d7fe304ffa303d697694bf6aa667b0"}
 *
 * Go source:
 * func convertArrayLiteralExpressionToJson(
 * 	sourceFile *ast.SourceFile,
 * 	elements []*ast.Expression,
 * 	elementOption *CommandLineOption,
 * 	returnValue bool,
 * ) (any, []*ast.Diagnostic) {
 * 	if !returnValue {
 * 		for _, element := range elements {
 * 			convertPropertyValueToJson(sourceFile, element, elementOption, returnValue, nil)
 * 		}
 * 		return nil, nil
 * 	}
 * 	// Filter out invalid values
 * 	if len(elements) == 0 {
 * 		// Always return an empty array, even if elements is nil.
 * 		// The parser will produce nil slices instead of allocating empty ones.
 * 		return []any{}, nil
 * 	}
 * 	var errors []*ast.Diagnostic
 * 	var value []any
 * 	for _, element := range elements {
 * 		convertedValue, err := convertPropertyValueToJson(sourceFile, element, elementOption, returnValue, nil)
 * 		errors = append(errors, err...)
 * 		if convertedValue != nil {
 * 			value = append(value, convertedValue)
 * 		}
 * 	}
 * 	return value, errors
 * }
 */
export function convertArrayLiteralExpressionToJson(sourceFile: GoPtr<SourceFile>, elements: GoSlice<GoPtr<Expression>>, elementOption: GoPtr<CommandLineOption>, returnValue: bool): [unknown, GoSlice<GoPtr<Diagnostic>>] {
  if (!returnValue) {
    for (const element of elements) {
      convertPropertyValueToJson(sourceFile, element, elementOption, returnValue, undefined);
    }
    return [undefined, []];
  }
  // Filter out invalid values
  if (elements.length === 0) {
    // Always return an empty array, even if elements is nil.
    // The parser will produce nil slices instead of allocating empty ones.
    return [[], []];
  }
  const errors: GoPtr<Diagnostic>[] = [];
  const value: unknown[] = [];
  for (const element of elements) {
    const [convertedValue, err] = convertPropertyValueToJson(sourceFile, element, elementOption, returnValue, undefined);
    errors.push(...err);
    if (convertedValue !== undefined && convertedValue !== null) {
      value.push(convertedValue);
    }
  }
  return [value, errors];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::directoryOfCombinedPath","kind":"func","status":"implemented","sigHash":"2eb87dd0096a329b2635a50d2b1c86186d99f94940e624eed0389a6153e89aac","bodyHash":"3982c629644f1ae315a88bc7a01ed675f80ed3f6ccb57d6f1a4e075b8df7ec46"}
 *
 * Go source:
 * func directoryOfCombinedPath(fileName string, basePath string) string {
 * 	// Use the `getNormalizedAbsolutePath` function to avoid canonicalizing the path, as it must remain noncanonical
 * 	// until consistent casing errors are reported
 * 	return tspath.GetDirectoryPath(tspath.GetNormalizedAbsolutePath(fileName, basePath))
 * }
 */
export function directoryOfCombinedPath(fileName: string, basePath: string): string {
  // Use the `getNormalizedAbsolutePath` function to avoid canonicalizing the path, as it must remain noncanonical
  // until consistent casing errors are reported
  return GetDirectoryPath(GetNormalizedAbsolutePath(fileName, basePath));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::ParseConfigFileTextToJson","kind":"func","status":"implemented","sigHash":"110bd3ca6e2ea514ef0dcb199ac9a643fcabfb3eb164776be0a324ec0aa4e442","bodyHash":"76f7b92dea1b7544ceb4c87e1f6829344699238fbf026b4e0f28c436cc9bc359"}
 *
 * Go source:
 * func ParseConfigFileTextToJson(fileName string, path tspath.Path, jsonText string) (any, []*ast.Diagnostic) {
 * 	jsonSourceFile := parser.ParseSourceFile(ast.SourceFileParseOptions{
 * 		FileName: fileName,
 * 		Path:     path,
 * 	}, jsonText, core.ScriptKindJSON)
 * 	config, errors := convertConfigFileToObject(jsonSourceFile /*jsonConversionNotifier* /, nil)
 * 	if len(jsonSourceFile.Diagnostics()) > 0 {
 * 		errors = []*ast.Diagnostic{jsonSourceFile.Diagnostics()[0]}
 * 	}
 * 	return config, errors
 * }
 */
export function ParseConfigFileTextToJson(fileName: string, path: Path, jsonText: string): [unknown, GoSlice<GoPtr<Diagnostic>>] {
  const jsonSourceFile = ParseSourceFile({ FileName: fileName, Path: path } as SourceFileParseOptions, jsonText, ScriptKindJSON);
  const [config, errors] = convertConfigFileToObject(jsonSourceFile, undefined);
  const diags = SourceFile_Diagnostics(jsonSourceFile);
  if (diags.length > 0) {
    return [config, [diags[0]]];
  }
  return [config, errors];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::type::ParseConfigHost","kind":"type","status":"implemented","sigHash":"4fb26f380237f402efba75d6d19964481ccdfb196da84444bd86d9c11ad62dec","bodyHash":"deff8cd08f1af49448db5922281730298b762438ee4962a5ba0d6cd540ab8d31"}
 *
 * Go source:
 * ParseConfigHost interface {
 * 	FS() vfs.FS
 * 	GetCurrentDirectory() string
 * }
 */
export interface ParseConfigHost {
  FS(): FS;
  GetCurrentDirectory(): string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::type::resolverHost","kind":"type","status":"implemented","sigHash":"43a8b07719d12fb98b1d4290506499b3a3c7aa612137cf238a65c81a0f4134c6","bodyHash":"4cdaf68eccadb2333734897913e93ad31ec6f056c2e23fd4f1c9f20a0b1086b9"}
 *
 * Go source:
 * resolverHost struct {
 * 	ParseConfigHost
 * }
 */
export interface resolverHost {
  readonly __tsgoEmbedded0?: ParseConfigHost;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::method::resolverHost.Trace","kind":"method","status":"implemented","sigHash":"6f387c4e86d971a415c8ce4c10953b60e0e610904a89b7bf8db4616da2f34215","bodyHash":"4bbbfa1b5b08545bd2696037eec4d9da5befedb43f2f1e345dfdf92c6a9b6634"}
 *
 * Go source:
 * func (r *resolverHost) Trace(msg string) {}
 */
export function resolverHost_Trace(receiver: GoPtr<resolverHost>, msg: string): void {}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::ParseJsonSourceFileConfigFileContent","kind":"func","status":"implemented","sigHash":"07570e635c9066f02bcd69060aa86410c9df81e65836bdc1f3826509f4d026dc","bodyHash":"3e630cc9e243556da22404b78d49ecb1a356f6ee8887e5d6f345ec453a25a7ba"}
 *
 * Go source:
 * func ParseJsonSourceFileConfigFileContent(
 * 	sourceFile *TsConfigSourceFile,
 * 	host ParseConfigHost,
 * 	basePath string,
 * 	existingOptions *core.CompilerOptions,
 * 	existingOptionsRaw *collections.OrderedMap[string, any],
 * 	configFileName string,
 * 	resolutionStack []tspath.Path,
 * 	extraFileExtensions []FileExtensionInfo,
 * 	extendedConfigCache ExtendedConfigCache,
 * ) *ParsedCommandLine {
 * 	// tracing?.push(tracing.Phase.Parse, "parseJsonSourceFileConfigFileContent", { path: sourceFile.fileName });
 * 	result := parseJsonConfigFileContentWorker(nil /*json* /, sourceFile, host, basePath, existingOptions, existingOptionsRaw, configFileName, resolutionStack, extraFileExtensions, extendedConfigCache)
 * 	// tracing?.pop();
 * 	return result
 * }
 */
export function ParseJsonSourceFileConfigFileContent(sourceFile: GoPtr<TsConfigSourceFile>, host: ParseConfigHost, basePath: string, existingOptions: GoPtr<CompilerOptions>, existingOptionsRaw: GoPtr<OrderedMap>, configFileName: string, resolutionStack: GoSlice<Path>, extraFileExtensions: GoSlice<FileExtensionInfo>, extendedConfigCache: GoPtr<ExtendedConfigCache>): GoPtr<ParsedCommandLine> {
  // tracing?.push(tracing.Phase.Parse, "parseJsonSourceFileConfigFileContent", { path: sourceFile.fileName });
  const result = parseJsonConfigFileContentWorker(undefined /*json*/, sourceFile, host, basePath, existingOptions, existingOptionsRaw as GoPtr<OrderedMap<string, unknown>>, configFileName, resolutionStack, extraFileExtensions, extendedConfigCache);
  // tracing?.pop();
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::convertObjectLiteralExpressionToJson","kind":"func","status":"implemented","sigHash":"97a987a89f8574822bfd32242b78a9db4c6da618731935e2dce1dfcd1a82c0f9","bodyHash":"a30a3b075a8536aece033103d65519dfc805b546c1dc86af61af5124a1d822a5"}
 *
 * Go source:
 * func convertObjectLiteralExpressionToJson(
 * 	sourceFile *ast.SourceFile,
 * 	returnValue bool,
 * 	node *ast.ObjectLiteralExpression,
 * 	objectOption *CommandLineOption,
 * 	jsonConversionNotifier *jsonConversionNotifier,
 * ) (*collections.OrderedMap[string, any], []*ast.Diagnostic) {
 * 	var result *collections.OrderedMap[string, any]
 * 	if returnValue {
 * 		result = &collections.OrderedMap[string, any]{}
 * 	}
 * 	var errors []*ast.Diagnostic
 * 	for _, element := range node.Properties.Nodes {
 * 		if element.Kind != ast.KindPropertyAssignment {
 * 			errors = append(errors, ast.NewDiagnostic(sourceFile, element.Loc, diagnostics.Property_assignment_expected))
 * 			continue
 * 		}
 * 
 * 		// !!!
 * 		// if ast.IsQuestionToken(element) {
 * 		// 	errors = append(errors, ast.NewDiagnostic(sourceFile, element.Loc, diagnostics.Property_assignment_expected))
 * 		// }
 * 		if element.Name() != nil && !isDoubleQuotedString(element.Name()) {
 * 			errors = append(errors, ast.NewDiagnostic(sourceFile, element.Loc, diagnostics.String_literal_with_double_quotes_expected))
 * 		}
 * 
 * 		textOfKey := ""
 * 		if !ast.IsComputedNonLiteralName(element.Name()) {
 * 			textOfKey, _ = ast.TryGetTextOfPropertyName(element.Name())
 * 		}
 * 		keyText := textOfKey
 * 		var option *CommandLineOption = nil
 * 		if keyText != "" && objectOption != nil && objectOption.ElementOptions != nil {
 * 			option = objectOption.ElementOptions.Get(keyText)
 * 		}
 * 		value, err := convertPropertyValueToJson(sourceFile, element.AsPropertyAssignment().Initializer, option, returnValue, jsonConversionNotifier)
 * 		errors = append(errors, err...)
 * 		if keyText != "" {
 * 			if returnValue {
 * 				result.Set(keyText, value)
 * 			}
 * 			// Notify key value set, if user asked for it
 * 			if jsonConversionNotifier != nil {
 * 				_, err := jsonConversionNotifier.onPropertySet(keyText, value, element.AsPropertyAssignment(), objectOption, option)
 * 				errors = append(errors, err...)
 * 			}
 * 		}
 * 	}
 * 	return result, errors
 * }
 */
export function convertObjectLiteralExpressionToJson(sourceFile: GoPtr<SourceFile>, returnValue: bool, node: GoPtr<ObjectLiteralExpression>, objectOption: GoPtr<CommandLineOption>, jsonConversionNotifier: GoPtr<jsonConversionNotifier>): [GoPtr<OrderedMap>, GoSlice<GoPtr<Diagnostic>>] {
  let result: GoPtr<OrderedMap> = undefined;
  if (returnValue) {
    result = newMapWithSizeHint<string, unknown>(0) as GoPtr<OrderedMap>;
  }
  const errors: GoPtr<Diagnostic>[] = [];
  for (const element of (node!.Properties!.Nodes! ?? [])) {
    if (element!.Kind !== KindPropertyAssignment) {
      errors.push(NewDiagnostic(sourceFile, element!.Loc, diagnostics.Property_assignment_expected));
      continue;
    }
    if (element!.Kind !== KindPropertyAssignment && !isDoubleQuotedString(element)) {
      // !!! note: in Go, the question token check is commented out
    }
    const propAssign = AsPropertyAssignment(element);
    const elementName = Node_Name(element);
    if (elementName !== undefined && !isDoubleQuotedString(elementName)) {
      errors.push(NewDiagnostic(sourceFile, element!.Loc, diagnostics.String_literal_with_double_quotes_expected));
    }
    let textOfKey = "";
    if (elementName !== undefined && !IsComputedNonLiteralName(elementName)) {
      const [txt] = TryGetTextOfPropertyName(elementName);
      textOfKey = txt;
    }
    const keyText = textOfKey;
    let option: GoPtr<CommandLineOption> = undefined;
    if (keyText !== "" && objectOption !== undefined && objectOption!.ElementOptions !== undefined) {
      option = CommandLineOptionNameMap_Get(objectOption!.ElementOptions, keyText);
    }
    const [value, err] = convertPropertyValueToJson(sourceFile, propAssign!.Initializer, option, returnValue, jsonConversionNotifier);
    errors.push(...err);
    if (keyText !== "") {
      if (returnValue) {
        OrderedMap_Set(result as GoPtr<OrderedMap<string, unknown>>, keyText, value);
      }
      // Notify key value set, if user asked for it
      if (jsonConversionNotifier !== undefined) {
        const [, notifyErr] = jsonConversionNotifier!.onPropertySet(keyText, value, propAssign, objectOption, option);
        errors.push(...notifyErr);
      }
    }
  }
  return [result, errors];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::convertToJson","kind":"func","status":"implemented","sigHash":"e93633981cf02a96e3d08109290f1b8e3c1c8cf11d38af3ed63856e36d2c06ca","bodyHash":"871a8a9efb1f7dca4ea23d7c89c0275dea569a82d6af305e31ac31550b36ca70"}
 *
 * Go source:
 * func convertToJson(
 * 	sourceFile *ast.SourceFile,
 * 	rootExpression *ast.Expression,
 * 	returnValue bool,
 * 	jsonConversionNotifier *jsonConversionNotifier,
 * ) (any, []*ast.Diagnostic) {
 * 	if rootExpression == nil {
 * 		if returnValue {
 * 			return struct{}{}, nil
 * 		} else {
 * 			return nil, nil
 * 		}
 * 	}
 * 	var rootOptions *CommandLineOption
 * 	if jsonConversionNotifier != nil {
 * 		rootOptions = jsonConversionNotifier.rootOptions
 * 	}
 * 	return convertPropertyValueToJson(sourceFile, rootExpression, rootOptions, returnValue, jsonConversionNotifier)
 * }
 */
export function convertToJson(sourceFile: GoPtr<SourceFile>, rootExpression: GoPtr<Expression>, returnValue: bool, jsonConversionNotifier: GoPtr<jsonConversionNotifier>): [unknown, GoSlice<GoPtr<Diagnostic>>] {
  if (rootExpression === undefined) {
    if (returnValue) {
      return [{}, []];
    } else {
      return [undefined, []];
    }
  }
  let rootOptions: GoPtr<CommandLineOption> = undefined;
  if (jsonConversionNotifier !== undefined) {
    rootOptions = jsonConversionNotifier!.rootOptions;
  }
  return convertPropertyValueToJson(sourceFile, rootExpression, rootOptions, returnValue, jsonConversionNotifier);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::isDoubleQuotedString","kind":"func","status":"implemented","sigHash":"f288a4eaaa47832cb4a305a26c780d5fd0a69928e6296b797c49d3034735b48a","bodyHash":"dbeea4ce5cb7b976dd6c6fd34a6957f507e5f20b55e303606e701dca07b0e441"}
 *
 * Go source:
 * func isDoubleQuotedString(node *ast.Node) bool {
 * 	return ast.IsStringLiteral(node)
 * }
 */
export function isDoubleQuotedString(node: GoPtr<Node>): bool {
  return IsStringLiteral(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::convertPropertyValueToJson","kind":"func","status":"implemented","sigHash":"759505dc37b1869c49799d7d2ec15fc5718e63182f61d10734c99ee4bbad2dd0","bodyHash":"00c31e03b41309611b10fb9d82ca6f406bab1161d7cd79ecaffb0e2bd240e130"}
 *
 * Go source:
 * func convertPropertyValueToJson(sourceFile *ast.SourceFile, valueExpression *ast.Expression, option *CommandLineOption, returnValue bool, jsonConversionNotifier *jsonConversionNotifier) (any, []*ast.Diagnostic) {
 * 	switch valueExpression.Kind {
 * 	case ast.KindTrueKeyword:
 * 		return true, nil
 * 	case ast.KindFalseKeyword:
 * 		return false, nil
 * 	case ast.KindNullKeyword: // todo: how to manage null
 * 		return nil, nil
 * 
 * 	case ast.KindStringLiteral:
 * 		if !isDoubleQuotedString(valueExpression) {
 * 			return valueExpression.Text(), []*ast.Diagnostic{ast.NewDiagnostic(sourceFile, valueExpression.Loc, diagnostics.String_literal_with_double_quotes_expected)}
 * 		}
 * 		return valueExpression.Text(), nil
 * 
 * 	case ast.KindNumericLiteral:
 * 		return float64(jsnum.FromString(valueExpression.Text())), nil
 * 	case ast.KindPrefixUnaryExpression:
 * 		if valueExpression.AsPrefixUnaryExpression().Operator != ast.KindMinusToken || valueExpression.AsPrefixUnaryExpression().Operand.Kind != ast.KindNumericLiteral {
 * 			break // not valid JSON syntax
 * 		}
 * 		return float64(-jsnum.FromString(valueExpression.AsPrefixUnaryExpression().Operand.Text())), nil
 * 	case ast.KindObjectLiteralExpression:
 * 		objectLiteralExpression := valueExpression.AsObjectLiteralExpression()
 * 		// Currently having element option declaration in the tsconfig with type "object"
 * 		// determines if it needs onSetValidOptionKeyValueInParent callback or not
 * 		// At moment there are only "compilerOptions", "typeAcquisition" and "typingOptions"
 * 		// that satisfies it and need it to modify options set in them (for normalizing file paths)
 * 		// vs what we set in the json
 * 		// If need arises, we can modify this interface and callbacks as needed
 * 		return convertObjectLiteralExpressionToJson(sourceFile, returnValue, objectLiteralExpression, option, jsonConversionNotifier)
 * 	case ast.KindArrayLiteralExpression:
 * 		result, errors := convertArrayLiteralExpressionToJson(
 * 			sourceFile,
 * 			valueExpression.Elements(),
 * 			option,
 * 			returnValue,
 * 		)
 * 		return result, errors
 * 	}
 * 	// Not in expected format
 * 	var errors []*ast.Diagnostic
 * 	if option != nil {
 * 		errors = []*ast.Diagnostic{ast.NewDiagnostic(sourceFile, valueExpression.Loc, diagnostics.Compiler_option_0_requires_a_value_of_type_1, option.Name, getCompilerOptionValueTypeString(option))}
 * 	} else {
 * 		errors = []*ast.Diagnostic{ast.NewDiagnostic(sourceFile, valueExpression.Loc, diagnostics.Property_value_can_only_be_string_literal_numeric_literal_true_false_null_object_literal_or_array_literal)}
 * 	}
 * 	return nil, errors
 * }
 */
export function convertPropertyValueToJson(sourceFile: GoPtr<SourceFile>, valueExpression: GoPtr<Expression>, option: GoPtr<CommandLineOption>, returnValue: bool, jsonConversionNotifier: GoPtr<jsonConversionNotifier>): [unknown, GoSlice<GoPtr<Diagnostic>>] {
  switch (valueExpression!.Kind) {
    case KindTrueKeyword:
      return [true, []];
    case KindFalseKeyword:
      return [false, []];
    case KindNullKeyword: // todo: how to manage null
      return [undefined, []];
    case KindStringLiteral:
      if (!isDoubleQuotedString(valueExpression)) {
        return [Node_Text(valueExpression), [NewDiagnostic(sourceFile, valueExpression!.Loc, diagnostics.String_literal_with_double_quotes_expected)]];
      }
      return [Node_Text(valueExpression), []];
    case KindNumericLiteral:
      return [Number(JsnumFromString(Node_Text(valueExpression))), []];
    case KindPrefixUnaryExpression: {
      const prefixExpr = AsPrefixUnaryExpression(valueExpression);
      if (prefixExpr!.Operator !== KindMinusToken || prefixExpr!.Operand!.Kind !== KindNumericLiteral) {
        break; // not valid JSON syntax
      }
      return [-Number(JsnumFromString(Node_Text(prefixExpr!.Operand))), []];
    }
    case KindObjectLiteralExpression: {
      const objectLiteralExpression = AsObjectLiteralExpression(valueExpression);
      return convertObjectLiteralExpressionToJson(sourceFile, returnValue, objectLiteralExpression, option, jsonConversionNotifier);
    }
    case KindArrayLiteralExpression: {
      const [result, errors] = convertArrayLiteralExpressionToJson(
        sourceFile,
        (Node_Elements(valueExpression) ?? []) as GoSlice<GoPtr<Expression>>,
        option,
        returnValue,
      );
      return [result, errors];
    }
  }
  // Not in expected format
  if (option !== undefined) {
    return [undefined, [NewDiagnostic(sourceFile, valueExpression!.Loc, diagnostics.Compiler_option_0_requires_a_value_of_type_1, option!.Name, getCompilerOptionValueTypeString(option))]];
  } else {
    return [undefined, [NewDiagnostic(sourceFile, valueExpression!.Loc, diagnostics.Property_value_can_only_be_string_literal_numeric_literal_true_false_null_object_literal_or_array_literal)]];
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::ParseJsonConfigFileContent","kind":"func","status":"implemented","sigHash":"4ab514aceb1a0ae5dfa96518a2c9cd21d2cefd2d7296c829bc99f346a7ec8997","bodyHash":"b91cd745c6135d9951cd499e3a17098a361f261b18398c8b2eadfd8782942403"}
 *
 * Go source:
 * func ParseJsonConfigFileContent(json any, host ParseConfigHost, basePath string, existingOptions *core.CompilerOptions, configFileName string, resolutionStack []tspath.Path, extraFileExtensions []FileExtensionInfo, extendedConfigCache ExtendedConfigCache) *ParsedCommandLine {
 * 	result := parseJsonConfigFileContentWorker(parseJsonToStringKey(json), nil /*sourceFile* /, host, basePath, existingOptions, nil /*existingOptionsRaw* /, configFileName, resolutionStack, extraFileExtensions, extendedConfigCache)
 * 	return result
 * }
 */
export function ParseJsonConfigFileContent(json: unknown, host: ParseConfigHost, basePath: string, existingOptions: GoPtr<CompilerOptions>, configFileName: string, resolutionStack: GoSlice<Path>, extraFileExtensions: GoSlice<FileExtensionInfo>, extendedConfigCache: GoPtr<ExtendedConfigCache>): GoPtr<ParsedCommandLine> {
  const result = parseJsonConfigFileContentWorker(parseJsonToStringKey(json) as GoPtr<OrderedMap<string, unknown>>, undefined /*sourceFile*/, host, basePath, existingOptions, undefined /*existingOptionsRaw*/, configFileName, resolutionStack, extraFileExtensions, extendedConfigCache);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::convertToObject","kind":"func","status":"implemented","sigHash":"133943d086d9936a1abde212d709a72ce0440e72b219c107caa492f01006f749","bodyHash":"45d15af99372d20578984c376ff20c9095fa6917aae6e6c9e2142110097ea5d7"}
 *
 * Go source:
 * func convertToObject(sourceFile *ast.SourceFile) (any, []*ast.Diagnostic) {
 * 	var rootExpression *ast.Expression
 * 	if len(sourceFile.Statements.Nodes) != 0 {
 * 		rootExpression = sourceFile.Statements.Nodes[0].Expression()
 * 	}
 * 	return convertToJson(sourceFile, rootExpression, true /*returnValue* /, nil /*jsonConversionNotifier* /)
 * }
 */
export function convertToObject(sourceFile: GoPtr<SourceFile>): [unknown, GoSlice<GoPtr<Diagnostic>>] {
  let rootExpression: GoPtr<Expression> = undefined;
  if (sourceFile!.Statements!.Nodes!.length !== 0) {
    rootExpression = Node_Expression(sourceFile!.Statements!.Nodes![0]) as GoPtr<Expression>;
  }
  return convertToJson(sourceFile, rootExpression, true /*returnValue*/, undefined /*jsonConversionNotifier*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::getDefaultCompilerOptions","kind":"func","status":"implemented","sigHash":"870169b0b7f19ae35c1b23cedd30ad6ceee9b558c9cbe77a41fa0733bd19d83b","bodyHash":"c0923880f6416ec012c0cda375203cc8f3da9b2f5d08b434494471016427ca72"}
 *
 * Go source:
 * func getDefaultCompilerOptions(configFileName string) *core.CompilerOptions {
 * 	options := &core.CompilerOptions{}
 * 	if configFileName != "" && tspath.GetBaseFileName(configFileName) == "jsconfig.json" {
 * 		depth := 2
 * 		options = &core.CompilerOptions{
 * 			AllowJs:              core.TSTrue,
 * 			MaxNodeModuleJsDepth: &depth,
 * 			SkipLibCheck:         core.TSTrue,
 * 			NoEmit:               core.TSTrue,
 * 		}
 * 	}
 * 	return options
 * }
 */
export function getDefaultCompilerOptions(configFileName: string): GoPtr<CompilerOptions> {
  let options: CompilerOptions = {} as CompilerOptions;
  if (configFileName !== "" && GetBaseFileName(configFileName) === "jsconfig.json") {
    const depth: int = 2 as int;
    options = {
      AllowJs: TSTrue,
      MaxNodeModuleJsDepth: depth,
      SkipLibCheck: TSTrue,
      NoEmit: TSTrue,
    } as unknown as CompilerOptions;
  }
  return options;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::getDefaultTypeAcquisition","kind":"func","status":"implemented","sigHash":"403c3e2478ffd33fadb14df6aea1b384eb1413a66204099dc6925870010f839e","bodyHash":"754ab46f302364e86b69ec2fa03c6dc1addf5593c75cab8b8bf23fa5e4efa55b"}
 *
 * Go source:
 * func getDefaultTypeAcquisition(configFileName string) *core.TypeAcquisition {
 * 	options := &core.TypeAcquisition{}
 * 	if configFileName != "" && tspath.GetBaseFileName(configFileName) == "jsconfig.json" {
 * 		options.Enable = core.TSTrue
 * 	}
 * 	return options
 * }
 */
export function getDefaultTypeAcquisition(configFileName: string): GoPtr<TypeAcquisition> {
  const options: TypeAcquisition = {} as TypeAcquisition;
  if (configFileName !== "" && GetBaseFileName(configFileName) === "jsconfig.json") {
    options.Enable = TSTrue;
  }
  return options;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::convertCompilerOptionsFromJsonWorker","kind":"func","status":"implemented","sigHash":"fb8d16d13a79a6cf2b2445defe56f41aa72f15b4f72a6bfcd67a4075df8cafb3","bodyHash":"5c701d86086278f0e0629aab749a8059c197d594abb3cb6cd7c209afa1ee1160"}
 *
 * Go source:
 * func convertCompilerOptionsFromJsonWorker(jsonOptions any, basePath string, configFileName string) (*core.CompilerOptions, []*ast.Diagnostic) {
 * 	options := getDefaultCompilerOptions(configFileName)
 * 	_, errors := convertOptionsFromJson(CommandLineCompilerOptionsMap, jsonOptions, basePath, &compilerOptionsParser{options})
 * 	if configFileName != "" {
 * 		options.ConfigFilePath = tspath.NormalizeSlashes(configFileName)
 * 	}
 * 	return options, errors
 * }
 */
export function convertCompilerOptionsFromJsonWorker(jsonOptions: unknown, basePath: string, configFileName: string): [GoPtr<CompilerOptions>, GoSlice<GoPtr<Diagnostic>>] {
  const options = getDefaultCompilerOptions(configFileName);
  const parser: compilerOptionsParser = { __tsgoEmbedded0: options };
  const [, errors] = convertOptionsFromJson(CommandLineCompilerOptionsMap, jsonOptions, basePath, compilerOptionsParser_as_optionParser(parser));
  if (configFileName !== "") {
    options!.ConfigFilePath = NormalizeSlashes(configFileName);
  }
  return [options, errors];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::convertTypeAcquisitionFromJsonWorker","kind":"func","status":"implemented","sigHash":"69703dec3ea4449b7d10ad857b94572bea26e5b750a2448003a7e72c65abf129","bodyHash":"1119679b5da2c4d7f728acda31d1c49b44d19d9fbd7d309635c6123ac7f1d8a3"}
 *
 * Go source:
 * func convertTypeAcquisitionFromJsonWorker(jsonOptions any, basePath string, configFileName string) (*core.TypeAcquisition, []*ast.Diagnostic) {
 * 	options := getDefaultTypeAcquisition(configFileName)
 * 	_, errors := convertOptionsFromJson(typeAcquisitionDeclaration.ElementOptions, jsonOptions, basePath, &typeAcquisitionParser{options})
 * 	return options, errors
 * }
 */
export function convertTypeAcquisitionFromJsonWorker(jsonOptions: unknown, basePath: string, configFileName: string): [GoPtr<TypeAcquisition>, GoSlice<GoPtr<Diagnostic>>] {
  const options = getDefaultTypeAcquisition(configFileName);
  const parser: typeAcquisitionParser = { __tsgoEmbedded0: options };
  const [, errors] = convertOptionsFromJson(typeAcquisitionDeclaration!.ElementOptions as CommandLineOptionNameMap, jsonOptions, basePath, typeAcquisitionParser_as_optionParser(parser));
  return [options, errors];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::parseOwnConfigOfJson","kind":"func","status":"implemented","sigHash":"a534e36c8089e7b3489cd456d4900f1b022d8fae966e33420dff986345b4d22e","bodyHash":"54663ccd782646025ff7679b87ab87df8ea9c532bbe6cf06cb5798dfc9ead251"}
 *
 * Go source:
 * func parseOwnConfigOfJson(
 * 	json *collections.OrderedMap[string, any],
 * 	host ParseConfigHost,
 * 	basePath string,
 * 	configFileName string,
 * ) (*parsedTsconfig, []*ast.Diagnostic) {
 * 	var errors []*ast.Diagnostic
 * 	if json.Has("excludes") {
 * 		errors = append(errors, ast.NewCompilerDiagnostic(diagnostics.Unknown_option_excludes_Did_you_mean_exclude))
 * 	}
 * 	options, err := convertCompilerOptionsFromJsonWorker(json.GetOrZero("compilerOptions"), basePath, configFileName)
 * 	typeAcquisition, err2 := convertTypeAcquisitionFromJsonWorker(json.GetOrZero("typeAcquisition"), basePath, configFileName)
 * 	errors = append(append(errors, err...), err2...)
 * 	// watchOptions := convertWatchOptionsFromJsonWorker(json.watchOptions, basePath, errors)
 * 	// json.compileOnSave = convertCompileOnSaveOptionFromJson(json, basePath, errors)
 * 	var extendedConfigPath []string
 * 	if extends := json.GetOrZero("extends"); extends != nil && extends != "" {
 * 		extendedConfigPath, err = getExtendsConfigPathOrArray(extends, host, basePath, configFileName, nil, nil, nil)
 * 		errors = append(errors, err...)
 * 	}
 * 	parsedConfig := &parsedTsconfig{
 * 		raw:                json,
 * 		options:            options,
 * 		typeAcquisition:    typeAcquisition,
 * 		extendedConfigPath: extendedConfigPath,
 * 	}
 * 	return parsedConfig, errors
 * }
 */
export function parseOwnConfigOfJson(json: GoPtr<OrderedMap>, host: ParseConfigHost, basePath: string, configFileName: string): [GoPtr<parsedTsconfig>, GoSlice<GoPtr<Diagnostic>>] {
  const errors: GoPtr<Diagnostic>[] = [];
  const jsonMap = json as GoPtr<OrderedMap<string, unknown>>;
  if (OrderedMap_Has(jsonMap, "excludes")) {
    errors.push(NewCompilerDiagnostic(diagnostics.Unknown_option_excludes_Did_you_mean_exclude));
  }
  const [options, err] = convertCompilerOptionsFromJsonWorker(OrderedMap_GetOrZero(jsonMap, "compilerOptions"), basePath, configFileName);
  const [typeAcquisition, err2] = convertTypeAcquisitionFromJsonWorker(OrderedMap_GetOrZero(jsonMap, "typeAcquisition"), basePath, configFileName);
  errors.push(...err);
  errors.push(...err2);
  // watchOptions := convertWatchOptionsFromJsonWorker(json.watchOptions, basePath, errors)
  // json.compileOnSave = convertCompileOnSaveOptionFromJson(json, basePath, errors)
  let extendedConfigPath: unknown = undefined;
  const extendsVal = OrderedMap_GetOrZero(jsonMap, "extends");
  if (extendsVal !== undefined && extendsVal !== null && extendsVal !== "") {
    const [configPath, extErr] = getExtendsConfigPathOrArray(extendsVal as CompilerOptionsValue, host, basePath, configFileName, undefined, undefined, undefined);
    extendedConfigPath = configPath;
    errors.push(...extErr);
  }
  const parsedConfig: parsedTsconfig = {
    raw: json,
    options: options,
    typeAcquisition: typeAcquisition,
    extendedConfigPath: extendedConfigPath,
  };
  return [parsedConfig, errors];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::readJsonConfigFile","kind":"func","status":"implemented","sigHash":"d3506f9374f5e1b996c0d80a4d4c75f9d3850487664c4537639949dcdca48a52","bodyHash":"cdfd503bd3892cc43ed4af260ed730cbfb79deed1f71089e2c44259df0db6c67"}
 *
 * Go source:
 * func readJsonConfigFile(fileName string, path tspath.Path, readFile func(fileName string) (string, bool)) (*TsConfigSourceFile, []*ast.Diagnostic) {
 * 	text, diagnostic := tryReadFile(fileName, readFile, []*ast.Diagnostic{})
 * 	if text != "" {
 * 		return &TsConfigSourceFile{
 * 			SourceFile: parser.ParseSourceFile(ast.SourceFileParseOptions{
 * 				FileName: fileName,
 * 				Path:     path,
 * 			}, text, core.ScriptKindJSON),
 * 		}, diagnostic
 * 	} else {
 * 		file := &TsConfigSourceFile{
 * 			SourceFile: (&ast.NodeFactory{}).NewSourceFile(ast.SourceFileParseOptions{FileName: fileName, Path: path}, "", nil, (&ast.NodeFactory{}).NewToken(ast.KindEndOfFile)).AsSourceFile(),
 * 		}
 * 		file.SourceFile.SetDiagnostics(diagnostic)
 * 		return file, diagnostic
 * 	}
 * }
 */
export function readJsonConfigFile(fileName: string, path: Path, readFile: (fileName: string) => [string, bool]): [GoPtr<TsConfigSourceFile>, GoSlice<GoPtr<Diagnostic>>] {
  const [text, diagnostic] = tryReadFile(fileName, readFile, []);
  if (text !== "") {
    return [
      {
        ExtendedSourceFiles: [],
        configFileSpecs: undefined,
        SourceFile: ParseSourceFile({ FileName: fileName, Path: path } as SourceFileParseOptions, text, ScriptKindJSON),
      },
      diagnostic,
    ];
  } else {
    const factory: NodeFactory = { hooks: {}, nodeCount: 0 as int, textCount: 0 as int } as NodeFactory;
    const endOfFileToken = NodeFactory_NewToken(factory, KindEndOfFile) as GoPtr<TokenNode>;
    const sourceFileNode = NodeFactory_NewSourceFile(factory, { FileName: fileName, Path: path } as SourceFileParseOptions, "", undefined, endOfFileToken);
    const sf = AsSourceFile(sourceFileNode);
    SourceFile_SetDiagnostics(sf, diagnostic);
    const file: TsConfigSourceFile = {
      ExtendedSourceFiles: [],
      configFileSpecs: undefined,
      SourceFile: sf,
    };
    return [file, diagnostic];
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::getExtendedConfig","kind":"func","status":"implemented","sigHash":"67d348bf78221c2c296a527a95b731c67cdc0fd6103dc0f59e7a5f0fd45d5c03","bodyHash":"7effc57cb73089e82d7d57b28abb40d2363ad0a7b3d7827e82ad3064d4afed06"}
 *
 * Go source:
 * func getExtendedConfig(
 * 	sourceFile *TsConfigSourceFile,
 * 	extendedConfigFileName string,
 * 	host ParseConfigHost,
 * 	resolutionStack []string,
 * 	extendedConfigCache ExtendedConfigCache,
 * 	result *extendsResult,
 * ) (*parsedTsconfig, []*ast.Diagnostic) {
 * 	var errors []*ast.Diagnostic
 * 	extendedConfigPath := tspath.ToPath(extendedConfigFileName, host.GetCurrentDirectory(), host.FS().UseCaseSensitiveFileNames())
 * 
 * 	var cacheEntry *ExtendedConfigCacheEntry
 * 	if extendedConfigCache != nil {
 * 		cacheEntry = extendedConfigCache.GetExtendedConfig(extendedConfigFileName, extendedConfigPath, resolutionStack, host)
 * 	} else {
 * 		cacheEntry = ParseExtendedConfig(extendedConfigFileName, extendedConfigPath, resolutionStack, host, extendedConfigCache)
 * 	}
 * 
 * 	if len(cacheEntry.errors) > 0 {
 * 		errors = append(errors, cacheEntry.errors...)
 * 	}
 * 
 * 	if cacheEntry.extendedResult != nil {
 * 		if sourceFile != nil {
 * 			result.extendedSourceFiles.Add(cacheEntry.extendedResult.SourceFile.FileName())
 * 			for _, extendedSourceFile := range cacheEntry.extendedResult.ExtendedSourceFiles {
 * 				result.extendedSourceFiles.Add(extendedSourceFile)
 * 			}
 * 		}
 * 	}
 * 	return cacheEntry.extendedConfig, errors
 * }
 */
export function getExtendedConfig(sourceFile: GoPtr<TsConfigSourceFile>, extendedConfigFileName: string, host: ParseConfigHost, resolutionStack: GoSlice<string>, extendedConfigCache: GoPtr<ExtendedConfigCache>, result: GoPtr<extendsResult>): [GoPtr<parsedTsconfig>, GoSlice<GoPtr<Diagnostic>>] {
  const errors: GoPtr<Diagnostic>[] = [];
  const extendedConfigPath = ToPath(extendedConfigFileName, host.GetCurrentDirectory(), host.FS().UseCaseSensitiveFileNames());

  let cacheEntry: GoPtr<ExtendedConfigCacheEntry>;
  // Bypass the cache when we detect a cycle in the resolution stack.
  if (extendedConfigCache !== undefined && !Contains(resolutionStack, extendedConfigPath)) {
    cacheEntry = extendedConfigCache.GetExtendedConfig(extendedConfigFileName, extendedConfigPath, resolutionStack, host);
  } else {
    cacheEntry = ParseExtendedConfig(extendedConfigFileName, extendedConfigPath, resolutionStack, host, extendedConfigCache);
  }

  if ((cacheEntry!.errors ?? []).length > 0) {
    errors.push(...cacheEntry!.errors);
  }

  if (cacheEntry!.extendedResult !== undefined) {
    if (sourceFile !== undefined) {
      Set_Add(result!.extendedSourceFiles, SourceFile_FileName(cacheEntry!.extendedResult!.SourceFile));
      for (const extendedSourceFile of (cacheEntry!.extendedResult!.ExtendedSourceFiles ?? [])) {
        Set_Add(result!.extendedSourceFiles, extendedSourceFile);
      }
    }
  }
  return [cacheEntry!.extendedConfig, errors];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::ParseExtendedConfig","kind":"func","status":"implemented","sigHash":"f805956c4be95a81dc4a058a5331b21d515f537ecf5a336be0acaa901fa26c3b","bodyHash":"1d4674731fe094f5ac640ebfad7cbd230de9fc748dcc537dfd6db3d1c06c9880"}
 *
 * Go source:
 * func ParseExtendedConfig(
 * 	fileName string,
 * 	path tspath.Path,
 * 	resolutionStack []string,
 * 	host ParseConfigHost,
 * 	extendedConfigCache ExtendedConfigCache,
 * ) *ExtendedConfigCacheEntry {
 * 	var extendedConfig *parsedTsconfig
 * 	var entryErrors []*ast.Diagnostic
 * 	extendedResult, err := readJsonConfigFile(fileName, path, host.FS().ReadFile)
 * 	entryErrors = append(entryErrors, err...)
 * 	if len(extendedResult.SourceFile.Diagnostics()) == 0 {
 * 		extendedConfig, err = parseConfig(nil, extendedResult, host, tspath.GetDirectoryPath(fileName), tspath.GetBaseFileName(fileName), resolutionStack, extendedConfigCache)
 * 		entryErrors = append(entryErrors, err...)
 * 	}
 * 	return &ExtendedConfigCacheEntry{
 * 		extendedResult: extendedResult,
 * 		extendedConfig: extendedConfig,
 * 		errors:         entryErrors,
 * 	}
 * }
 */
export function ParseExtendedConfig(fileName: string, path: Path, resolutionStack: GoSlice<string>, host: ParseConfigHost, extendedConfigCache: GoPtr<ExtendedConfigCache>): GoPtr<ExtendedConfigCacheEntry> {
  let extendedConfig: GoPtr<parsedTsconfig> = undefined;
  const entryErrors: GoPtr<Diagnostic>[] = [];
  const [extendedResult, err] = readJsonConfigFile(fileName, path, host.FS().ReadFile.bind(host.FS()));
  entryErrors.push(...err);
  if ((SourceFile_Diagnostics(extendedResult!.SourceFile) ?? []).length === 0) {
    const [cfg, err2] = parseConfig(undefined, extendedResult, host, GetDirectoryPath(fileName), GetBaseFileName(fileName), resolutionStack, extendedConfigCache);
    extendedConfig = cfg;
    entryErrors.push(...err2);
  }
  return {
    extendedResult: extendedResult,
    extendedConfig: extendedConfig,
    errors: entryErrors,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::parseConfig","kind":"func","status":"implemented","sigHash":"1f0df9920291781cd9f789a0168d0fb5ec97b9148e609769fcdc386bcddf6bcd","bodyHash":"1d1f02a23f2e5db4d94e101a3f9d294db0fa55946e7db9f4526e719209d14e6f"}
 *
 * Go source:
 * func parseConfig(
 * 	json *collections.OrderedMap[string, any],
 * 	sourceFile *TsConfigSourceFile,
 * 	host ParseConfigHost,
 * 	basePath string,
 * 	configFileName string,
 * 	resolutionStack []string,
 * 	extendedConfigCache ExtendedConfigCache,
 * ) (*parsedTsconfig, []*ast.Diagnostic) {
 * 	basePath = tspath.NormalizeSlashes(basePath)
 * 	resolvedPath := tspath.GetNormalizedAbsolutePath(configFileName, basePath)
 * 	var errors []*ast.Diagnostic
 * 	if slices.Contains(resolutionStack, resolvedPath) {
 * 		var result *parsedTsconfig
 * 		errors = append(errors, ast.NewCompilerDiagnostic(diagnostics.Circularity_detected_while_resolving_configuration_Colon_0))
 * 		if json.Size() == 0 {
 * 			result = &parsedTsconfig{raw: json}
 * 		} else {
 * 			rawResult, err := convertToObject(sourceFile.SourceFile)
 * 			errors = append(errors, err...)
 * 			result = &parsedTsconfig{raw: rawResult}
 * 		}
 * 		return result, errors
 * 	}
 * 
 * 	var ownConfig *parsedTsconfig
 * 	var err []*ast.Diagnostic
 * 	if json != nil {
 * 		ownConfig, err = parseOwnConfigOfJson(json, host, basePath, configFileName)
 * 	} else {
 * 		ownConfig, err = parseOwnConfigOfJsonSourceFile(tsconfigToSourceFile(sourceFile), host, basePath, configFileName)
 * 	}
 * 	errors = append(errors, err...)
 * 	if ownConfig.options != nil && ownConfig.options.Paths != nil {
 * 		// If we end up needing to resolve relative paths from 'paths' relative to
 * 		// the config file location, we'll need to know where that config file was.
 * 		// Since 'paths' can be inherited from an extended config in another directory,
 * 		// we wouldn't know which directory to use unless we store it here.
 * 		ownConfig.options.PathsBasePath = basePath
 * 	}
 * 
 * 	applyExtendedConfig := func(result *extendsResult, extendedConfigPath string) {
 * 		extendedConfig, extendedErrors := getExtendedConfig(sourceFile, extendedConfigPath, host, resolutionStack, extendedConfigCache, result)
 * 		errors = append(errors, extendedErrors...)
 * 		if extendedConfig != nil && extendedConfig.options != nil {
 * 			extendsRaw := extendedConfig.raw
 * 			relativeDifference := ""
 * 			setPropertyValue := func(propertyName string) {
 * 				if rawMap, ok := ownConfig.raw.(*collections.OrderedMap[string, any]); ok && rawMap.Has(propertyName) {
 * 					return
 * 				}
 * 				if propertyName == "include" || propertyName == "exclude" || propertyName == "files" {
 * 					if rawMap, ok := extendsRaw.(*collections.OrderedMap[string, any]); ok && rawMap.Has(propertyName) {
 * 						if slice, _ := rawMap.GetOrZero(propertyName).([]any); slice != nil {
 * 							value := core.Map(slice, func(path any) any {
 * 								if startsWithConfigDirTemplate(path) || tspath.IsRootedDiskPath(path.(string)) {
 * 									return path.(string)
 * 								} else {
 * 									if relativeDifference == "" {
 * 										t := tspath.ComparePathsOptions{
 * 											UseCaseSensitiveFileNames: host.FS().UseCaseSensitiveFileNames(),
 * 											CurrentDirectory:          basePath,
 * 										}
 * 										relativeDifference = tspath.ConvertToRelativePath(tspath.GetDirectoryPath(extendedConfigPath), t)
 * 									}
 * 									return tspath.CombinePaths(relativeDifference, path.(string))
 * 								}
 * 							})
 * 							if propertyName == "include" {
 * 								result.include = value
 * 							} else if propertyName == "exclude" {
 * 								result.exclude = value
 * 							} else if propertyName == "files" {
 * 								result.files = value
 * 							}
 * 						}
 * 					}
 * 				}
 * 			}
 * 
 * 			setPropertyValue("include")
 * 			setPropertyValue("exclude")
 * 			setPropertyValue("files")
 * 			if extendedRawMap, ok := extendsRaw.(*collections.OrderedMap[string, any]); ok && extendedRawMap.Has("compileOnSave") {
 * 				if compileOnSave, ok := extendedRawMap.GetOrZero("compileOnSave").(bool); ok {
 * 					result.compileOnSave = compileOnSave
 * 				}
 * 			}
 * 			mergeCompilerOptions(result.options, extendedConfig.options, extendsRaw)
 * 		}
 * 	}
 * 
 * 	if ownConfig.extendedConfigPath != nil {
 * 		// copy the resolution stack so it is never reused between branches in potential diamond-problem scenarios.
 * 		resolutionStack = append(resolutionStack, resolvedPath)
 * 		var result *extendsResult = &extendsResult{
 * 			options: &core.CompilerOptions{},
 * 		}
 * 		if reflect.TypeOf(ownConfig.extendedConfigPath).Kind() == reflect.String {
 * 			applyExtendedConfig(result, ownConfig.extendedConfigPath.(string))
 * 		} else if configPath, ok := ownConfig.extendedConfigPath.([]string); ok {
 * 			for _, extendedConfigPath := range configPath {
 * 				applyExtendedConfig(result, extendedConfigPath)
 * 			}
 * 		}
 * 		if result.include != nil {
 * 			ownConfig.raw.(*collections.OrderedMap[string, any]).Set("include", result.include)
 * 		}
 * 		if result.exclude != nil {
 * 			ownConfig.raw.(*collections.OrderedMap[string, any]).Set("exclude", result.exclude)
 * 		}
 * 		if result.files != nil {
 * 			ownConfig.raw.(*collections.OrderedMap[string, any]).Set("files", result.files)
 * 		}
 * 		if result.compileOnSave && !ownConfig.raw.(*collections.OrderedMap[string, any]).Has("compileOnSave") {
 * 			ownConfig.raw.(*collections.OrderedMap[string, any]).Set("compileOnSave", result.compileOnSave)
 * 		}
 * 		if sourceFile != nil {
 * 			for extendedSourceFile := range result.extendedSourceFiles.Keys() {
 * 				sourceFile.ExtendedSourceFiles = core.InsertSorted(sourceFile.ExtendedSourceFiles, extendedSourceFile, cmp.Compare)
 * 			}
 * 		}
 * 		ownConfig.options = mergeCompilerOptions(result.options, ownConfig.options, ownConfig.raw)
 * 		// ownConfig.watchOptions = ownConfig.watchOptions && result.watchOptions ?
 * 		//     assignWatchOptions(result, ownConfig.watchOptions) :
 * 		//     ownConfig.watchOptions || result.watchOptions;
 * 	}
 * 	return ownConfig, errors
 * }
 */
export function parseConfig(json: GoPtr<OrderedMap>, sourceFile: GoPtr<TsConfigSourceFile>, host: ParseConfigHost, basePath: string, configFileName: string, resolutionStack: GoSlice<string>, extendedConfigCache: GoPtr<ExtendedConfigCache>): [GoPtr<parsedTsconfig>, GoSlice<GoPtr<Diagnostic>>] {
  basePath = NormalizeSlashes(basePath);
  const resolvedPath = GetNormalizedAbsolutePath(configFileName, basePath);
  const errors: GoPtr<Diagnostic>[] = [];

  if (Contains(resolutionStack, resolvedPath)) {
    errors.push(NewCompilerDiagnostic(diagnostics.Circularity_detected_while_resolving_configuration_Colon_0));
    let result: GoPtr<parsedTsconfig>;
    const jsonMap = json as GoPtr<OrderedMap<string, unknown>>;
    if (json !== undefined && OrderedMap_Size(jsonMap) === 0) {
      result = { raw: json, options: undefined, typeAcquisition: undefined, extendedConfigPath: undefined };
    } else {
      const [rawResult, err] = convertToObject(sourceFile!.SourceFile);
      errors.push(...err);
      result = { raw: rawResult, options: undefined, typeAcquisition: undefined, extendedConfigPath: undefined };
    }
    return [result, errors];
  }

  let ownConfig: GoPtr<parsedTsconfig>;
  if (json !== undefined) {
    const [cfg, err] = parseOwnConfigOfJson(json, host, basePath, configFileName);
    ownConfig = cfg;
    errors.push(...err);
  } else {
    const [cfg, err] = parseOwnConfigOfJsonSourceFile(tsconfigToSourceFile(sourceFile), host, basePath, configFileName);
    ownConfig = cfg;
    errors.push(...err);
  }

  if (ownConfig!.options !== undefined && ownConfig!.options!.Paths !== undefined) {
    ownConfig!.options!.PathsBasePath = basePath;
  }

  const applyExtendedConfig = (result: GoPtr<extendsResult>, extendedConfigPath: string): void => {
    const [extendedConfig, extendedErrors] = getExtendedConfig(sourceFile, extendedConfigPath, host, resolutionStack, extendedConfigCache, result);
    errors.push(...extendedErrors);
    if (extendedConfig !== undefined && extendedConfig!.options !== undefined) {
      const extendsRaw = extendedConfig!.raw;
      let relativeDifference = "";
      const setPropertyValue = (propertyName: string): void => {
        const ownRawMap = ownConfig!.raw;
        if (isOrderedMap(ownRawMap) && OrderedMap_Has(ownRawMap as GoPtr<OrderedMap<string, unknown>>, propertyName)) {
          return;
        }
        if (propertyName === "include" || propertyName === "exclude" || propertyName === "files") {
          if (isOrderedMap(extendsRaw) && OrderedMap_Has(extendsRaw as GoPtr<OrderedMap<string, unknown>>, propertyName)) {
            const sliceVal = OrderedMap_GetOrZero(extendsRaw as GoPtr<OrderedMap<string, unknown>>, propertyName);
            if (Array.isArray(sliceVal) && sliceVal !== undefined) {
              const slice = sliceVal as unknown[];
              const value = core.Map(slice, (path: unknown): unknown => {
                if (startsWithConfigDirTemplate(path) || IsRootedDiskPath((path as string))) {
                  return path as string;
                } else {
                  if (relativeDifference === "") {
                    const t: ComparePathsOptions = {
                      UseCaseSensitiveFileNames: host.FS().UseCaseSensitiveFileNames(),
                      CurrentDirectory: basePath,
                    };
                    relativeDifference = ConvertToRelativePath(GetDirectoryPath(extendedConfigPath), t);
                  }
                  return CombinePaths(relativeDifference, path as string);
                }
              });
              if (propertyName === "include") {
                result!.include = value;
              } else if (propertyName === "exclude") {
                result!.exclude = value;
              } else if (propertyName === "files") {
                result!.files = value;
              }
            }
          }
        }
      };

      setPropertyValue("include");
      setPropertyValue("exclude");
      setPropertyValue("files");
      if (isOrderedMap(extendsRaw) && OrderedMap_Has(extendsRaw as GoPtr<OrderedMap<string, unknown>>, "compileOnSave")) {
        const compileOnSave = OrderedMap_GetOrZero(extendsRaw as GoPtr<OrderedMap<string, unknown>>, "compileOnSave");
        if (typeof compileOnSave === "boolean") {
          result!.compileOnSave = compileOnSave;
        }
      }
      mergeCompilerOptions(result!.options, extendedConfig!.options, extendsRaw);
    }
  };

  if (ownConfig!.extendedConfigPath !== undefined && ownConfig!.extendedConfigPath !== null) {
    // copy the resolution stack so it is never reused between branches in potential diamond-problem scenarios.
    const newResolutionStack = [...resolutionStack, resolvedPath];
    const result: extendsResult = {
      options: {} as CompilerOptions,
      watchOptionsCopied: false,
      include: [],
      exclude: [],
      files: [],
      compileOnSave: false,
      extendedSourceFiles: new Set() as unknown as import("../collections/set.js").Set,
    };
    if (typeof ownConfig!.extendedConfigPath === "string") {
      applyExtendedConfig(result, ownConfig!.extendedConfigPath as string);
    } else if (Array.isArray(ownConfig!.extendedConfigPath)) {
      for (const extendedConfigPath of (ownConfig!.extendedConfigPath as string[])) {
        applyExtendedConfig(result, extendedConfigPath);
      }
    }
    const ownRawMap = ownConfig!.raw as GoPtr<OrderedMap<string, unknown>>;
    if (result.include !== undefined && (result.include as unknown[]).length > 0) {
      OrderedMap_Set(ownRawMap, "include", result.include);
    }
    if (result.exclude !== undefined && (result.exclude as unknown[]).length > 0) {
      OrderedMap_Set(ownRawMap, "exclude", result.exclude);
    }
    if (result.files !== undefined && (result.files as unknown[]).length > 0) {
      OrderedMap_Set(ownRawMap, "files", result.files);
    }
    if (result.compileOnSave && !OrderedMap_Has(ownRawMap, "compileOnSave")) {
      OrderedMap_Set(ownRawMap, "compileOnSave", result.compileOnSave);
    }
    if (sourceFile !== undefined) {
      for (const [extendedSourceFile] of Set_Keys(result.extendedSourceFiles)) {
        sourceFile!.ExtendedSourceFiles = core.InsertSorted(sourceFile!.ExtendedSourceFiles, extendedSourceFile as string, cmp.Compare) as GoSlice<string>;
      }
    }
    ownConfig!.options = mergeCompilerOptions(result.options, ownConfig!.options, ownConfig!.raw);
    // ownConfig.watchOptions = ...
    resolutionStack = newResolutionStack;
  }
  return [ownConfig, errors];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::constGroup::defaultIncludeSpec","kind":"constGroup","status":"implemented","sigHash":"d696a54b6be328ef2c5948b7be9495da93fa28765553ed5a765260a67880adf5","bodyHash":"c1aaab15ae711233a5580c3118ab35b4ea9335d2474f6ca2d0ec9a863c3e81f2"}
 *
 * Go source:
 * const defaultIncludeSpec = "** /*"
 */
export const defaultIncludeSpec: string = "**/*";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::type::propOfRaw","kind":"type","status":"implemented","sigHash":"1fbc96d33ad87bcfd3fa6b9eb4275e196711890d1d696c5bfa620720ccdffeeb","bodyHash":"5f50ed1dda71b4b77dcfd5fba9478cb64f8397120b1d14330c38ae08deb54afc"}
 *
 * Go source:
 * propOfRaw struct {
 * 	sliceValue []any
 * 	wrongValue string
 * }
 */
export interface propOfRaw {
  sliceValue: GoSlice<unknown>;
  wrongValue: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::parseJsonConfigFileContentWorker","kind":"func","status":"implemented","sigHash":"1a2442f8f361ee448256966f5838e8ae357182fb10a4e1e4ef3de627b71aa08e","bodyHash":"c89841d765d26353357aeaa7bf1e2b595ddedf1f9308ea58c5b9fa5adb08cc88"}
 *
 * Go source:
 * func parseJsonConfigFileContentWorker(
 * 	json *collections.OrderedMap[string, any],
 * 	sourceFile *TsConfigSourceFile,
 * 	host ParseConfigHost,
 * 	basePath string,
 * 	existingOptions *core.CompilerOptions,
 * 	existingOptionsRaw *collections.OrderedMap[string, any],
 * 	configFileName string,
 * 	resolutionStack []tspath.Path,
 * 	extraFileExtensions []FileExtensionInfo,
 * 	extendedConfigCache ExtendedConfigCache,
 * ) *ParsedCommandLine {
 * 	debug.Assert((json == nil && sourceFile != nil) || (json != nil && sourceFile == nil))
 * 
 * 	basePathForFileNames := ""
 * 	if configFileName != "" {
 * 		basePathForFileNames = tspath.NormalizePath(directoryOfCombinedPath(configFileName, basePath))
 * 	} else {
 * 		basePathForFileNames = tspath.NormalizePath(basePath)
 * 	}
 * 
 * 	var errors []*ast.Diagnostic
 * 	resolutionStackString := []string{}
 * 	parsedConfig, errors := parseConfig(json, sourceFile, host, basePath, configFileName, resolutionStackString, extendedConfigCache)
 * 	mergeCompilerOptions(parsedConfig.options, existingOptions, existingOptionsRaw)
 * 	handleOptionConfigDirTemplateSubstitution(parsedConfig.options, basePathForFileNames)
 * 	rawConfig := parseJsonToStringKey(parsedConfig.raw)
 * 	if configFileName != "" && parsedConfig.options != nil {
 * 		parsedConfig.options.ConfigFilePath = tspath.NormalizeSlashes(configFileName)
 * 	}
 * 	getPropFromRaw := func(prop string, validateElement func(value any) bool, elementTypeName string) propOfRaw {
 * 		value, exists := rawConfig.Get(prop)
 * 		if exists && value != nil {
 * 			if reflect.TypeOf(value).Kind() == reflect.Slice {
 * 				result := rawConfig.GetOrZero(prop)
 * 				if _, ok := result.([]any); ok {
 * 					if sourceFile == nil && !core.Every(result.([]any), validateElement) {
 * 						errors = append(errors, ast.NewCompilerDiagnostic(diagnostics.Compiler_option_0_requires_a_value_of_type_1, prop, elementTypeName))
 * 					}
 * 				}
 * 				return propOfRaw{sliceValue: result.([]any)}
 * 			} else if sourceFile == nil {
 * 				errors = append(errors, ast.NewCompilerDiagnostic(diagnostics.Compiler_option_0_requires_a_value_of_type_1, prop, "Array"))
 * 				return propOfRaw{sliceValue: nil, wrongValue: "not-array"}
 * 			}
 * 		}
 * 		return propOfRaw{sliceValue: nil, wrongValue: "no-prop"}
 * 	}
 * 	referencesOfRaw := getPropFromRaw("references", func(element any) bool { return reflect.TypeOf(element) == orderedMapType }, "object")
 * 	fileSpecs := getPropFromRaw("files", func(element any) bool { return reflect.TypeOf(element).Kind() == reflect.String }, "string")
 * 	if fileSpecs.sliceValue != nil || fileSpecs.wrongValue == "" {
 * 		hasZeroOrNoReferences := false
 * 		if referencesOfRaw.wrongValue == "no-prop" || referencesOfRaw.wrongValue == "not-array" || len(referencesOfRaw.sliceValue) == 0 {
 * 			hasZeroOrNoReferences = true
 * 		}
 * 		hasExtends := rawConfig.GetOrZero("extends")
 * 		if fileSpecs.sliceValue != nil && len(fileSpecs.sliceValue) == 0 && hasZeroOrNoReferences && hasExtends == nil {
 * 			if sourceFile != nil {
 * 				var fileName string
 * 				if configFileName != "" {
 * 					fileName = configFileName
 * 				} else {
 * 					fileName = "tsconfig.json"
 * 				}
 * 				diagnosticMessage := diagnostics.The_files_list_in_config_file_0_is_empty
 * 				nodeValue := ForEachTsConfigPropArray(sourceFile.SourceFile, "files", func(property *ast.PropertyAssignment) *ast.Node { return property.Initializer })
 * 				errors = append(errors, CreateDiagnosticForNodeInSourceFile(sourceFile.SourceFile, nodeValue, diagnosticMessage, fileName))
 * 			} else {
 * 				errors = append(errors, ast.NewCompilerDiagnostic(diagnostics.The_files_list_in_config_file_0_is_empty, configFileName))
 * 			}
 * 		}
 * 	}
 * 	includeSpecs := getPropFromRaw("include", func(element any) bool { return reflect.TypeOf(element).Kind() == reflect.String }, "string")
 * 	excludeSpecs := getPropFromRaw("exclude", func(element any) bool { return reflect.TypeOf(element).Kind() == reflect.String }, "string")
 * 	isDefaultIncludeSpec := false
 * 	if excludeSpecs.wrongValue == "no-prop" && parsedConfig.options != nil {
 * 		outDir := parsedConfig.options.OutDir
 * 		declarationDir := parsedConfig.options.DeclarationDir
 * 		if outDir != "" || declarationDir != "" {
 * 			var values []any
 * 			if outDir != "" {
 * 				values = append(values, outDir)
 * 			}
 * 			if declarationDir != "" {
 * 				values = append(values, declarationDir)
 * 			}
 * 			excludeSpecs = propOfRaw{sliceValue: values}
 * 		}
 * 	}
 * 	if fileSpecs.sliceValue == nil && includeSpecs.sliceValue == nil {
 * 		includeSpecs = propOfRaw{sliceValue: []any{defaultIncludeSpec}}
 * 		isDefaultIncludeSpec = true
 * 	}
 * 	var validatedIncludeSpecs []string
 * 	var validatedIncludeSpecsBeforeSubstitution []string
 * 	var validatedExcludeSpecs []string
 * 	var validatedFilesSpec []string
 * 	var validatedFilesSpecBeforeSubstitution []string
 * 	// The exclude spec list is converted into a regular expression, which allows us to quickly
 * 	// test whether a file or directory should be excluded before recursively traversing the
 * 	// file system.
 * 	if includeSpecs.sliceValue != nil {
 * 		var err []*ast.Diagnostic
 * 		validatedIncludeSpecsBeforeSubstitution, err = validateSpecs(includeSpecs.sliceValue, true /*disallowTrailingRecursion* /, tsconfigToSourceFile(sourceFile), "include")
 * 		errors = append(errors, err...)
 * 		if validatedIncludeSpecs = getSubstitutedStringArrayWithConfigDirTemplate(validatedIncludeSpecsBeforeSubstitution, basePathForFileNames); validatedIncludeSpecs == nil {
 * 			validatedIncludeSpecs = validatedIncludeSpecsBeforeSubstitution
 * 		}
 * 	}
 * 	if excludeSpecs.sliceValue != nil {
 * 		var err []*ast.Diagnostic
 * 		validatedExcludeSpecs, err = validateSpecs(excludeSpecs.sliceValue, false /*disallowTrailingRecursion* /, tsconfigToSourceFile(sourceFile), "exclude")
 * 		errors = append(errors, err...)
 * 		if validatedExcludeSpecsWithSubstitution := getSubstitutedStringArrayWithConfigDirTemplate(validatedExcludeSpecs, basePathForFileNames); validatedExcludeSpecsWithSubstitution != nil {
 * 			validatedExcludeSpecs = validatedExcludeSpecsWithSubstitution
 * 		}
 * 	}
 * 	if fileSpecs.sliceValue != nil {
 * 		fileSpecs := core.Filter(fileSpecs.sliceValue, func(spec any) bool { return reflect.TypeOf(spec).Kind() == reflect.String })
 * 		for _, spec := range fileSpecs {
 * 			if spec, ok := spec.(string); ok {
 * 				validatedFilesSpecBeforeSubstitution = append(validatedFilesSpecBeforeSubstitution, spec)
 * 			}
 * 		}
 * 		if validatedFilesSpec = getSubstitutedStringArrayWithConfigDirTemplate(validatedFilesSpecBeforeSubstitution, basePathForFileNames); validatedFilesSpec == nil {
 * 			validatedFilesSpec = validatedFilesSpecBeforeSubstitution
 * 		}
 * 	}
 * 	configFileSpecs := configFileSpecs{
 * 		fileSpecs.sliceValue,
 * 		includeSpecs.sliceValue,
 * 		excludeSpecs.sliceValue,
 * 		validatedFilesSpec,
 * 		validatedIncludeSpecs,
 * 		validatedExcludeSpecs,
 * 		validatedFilesSpecBeforeSubstitution,
 * 		validatedIncludeSpecsBeforeSubstitution,
 * 		isDefaultIncludeSpec,
 * 	}
 * 
 * 	if sourceFile != nil {
 * 		sourceFile.configFileSpecs = &configFileSpecs
 * 	}
 * 
 * 	getFileNames := func(basePath string) ([]string, int) {
 * 		parsedConfigOptions := parsedConfig.options
 * 		fileNames, literalFileNamesLen := getFileNamesFromConfigSpecs(configFileSpecs, basePath, parsedConfigOptions, host.FS(), extraFileExtensions)
 * 		if shouldReportNoInputFiles(fileNames, canJsonReportNoInputFiles(rawConfig), resolutionStack) {
 * 			includeSpecs := configFileSpecs.includeSpecs
 * 			excludeSpecs := configFileSpecs.excludeSpecs
 * 			if includeSpecs == nil {
 * 				includeSpecs = []string{}
 * 			}
 * 			if excludeSpecs == nil {
 * 				excludeSpecs = []string{}
 * 			}
 * 			errors = append(errors, ast.NewCompilerDiagnostic(diagnostics.No_inputs_were_found_in_config_file_0_Specified_include_paths_were_1_and_exclude_paths_were_2, configFileName, core.Must(core.StringifyJson(includeSpecs, "", "")), core.Must(core.StringifyJson(excludeSpecs, "", ""))))
 * 		}
 * 		return fileNames, literalFileNamesLen
 * 	}
 * 
 * 	getProjectReferences := func(basePath string) []*core.ProjectReference {
 * 		var projectReferences []*core.ProjectReference
 * 		newReferencesOfRaw := getPropFromRaw("references", func(element any) bool { return reflect.TypeOf(element) == orderedMapType }, "object")
 * 		if newReferencesOfRaw.sliceValue != nil {
 * 			projectReferences = []*core.ProjectReference{}
 * 			for _, reference := range newReferencesOfRaw.sliceValue {
 * 				for _, ref := range parseProjectReference(reference) {
 * 					if ref.Path == "" {
 * 						if sourceFile == nil {
 * 							errors = append(errors, ast.NewCompilerDiagnostic(diagnostics.Compiler_option_0_requires_a_value_of_type_1, "reference.path", "string"))
 * 						}
 * 					} else {
 * 						projectReferences = append(projectReferences, &core.ProjectReference{
 * 							Path:         tspath.GetNormalizedAbsolutePath(ref.Path, basePath),
 * 							OriginalPath: ref.Path,
 * 							Circular:     ref.Circular,
 * 						})
 * 					}
 * 				}
 * 			}
 * 		}
 * 		return projectReferences
 * 	}
 * 
 * 	fileNames, literalFileNamesLen := getFileNames(basePathForFileNames)
 * 	return &ParsedCommandLine{
 * 		ParsedConfig: &core.ParsedOptions{
 * 			CompilerOptions: parsedConfig.options,
 * 			TypeAcquisition: parsedConfig.typeAcquisition,
 * 			// WatchOptions:      nil,
 * 			FileNames:         fileNames,
 * 			ProjectReferences: getProjectReferences(basePathForFileNames),
 * 		},
 * 		ConfigFile: sourceFile,
 * 		Raw:        parsedConfig.raw,
 * 		Errors:     errors,
 * 
 * 		extraFileExtensions: extraFileExtensions,
 * 		comparePathsOptions: tspath.ComparePathsOptions{
 * 			UseCaseSensitiveFileNames: host.FS().UseCaseSensitiveFileNames(),
 * 			CurrentDirectory:          basePathForFileNames,
 * 		},
 * 		literalFileNamesLen: literalFileNamesLen,
 * 	}
 * }
 */
export function parseJsonConfigFileContentWorker(json: GoPtr<OrderedMap>, sourceFile: GoPtr<TsConfigSourceFile>, host: ParseConfigHost, basePath: string, existingOptions: GoPtr<CompilerOptions>, existingOptionsRaw: GoPtr<OrderedMap>, configFileName: string, resolutionStack: GoSlice<Path>, extraFileExtensions: GoSlice<FileExtensionInfo>, extendedConfigCache: GoPtr<ExtendedConfigCache>): GoPtr<ParsedCommandLine> {
  const basePathForFileNames: string = configFileName !== ""
    ? NormalizePath(directoryOfCombinedPath(configFileName, basePath))
    : NormalizePath(basePath);

  const errors: GoPtr<Diagnostic>[] = [];
  const [parsedConfig, parseConfigErrors] = parseConfig(json, sourceFile, host, basePath, configFileName, resolutionStack, extendedConfigCache);
  errors.push(...parseConfigErrors);
  mergeCompilerOptions(parsedConfig!.options, existingOptions, existingOptionsRaw as GoPtr<OrderedMap<string, unknown>>);
  parsedConfig!.options = NormalizeCompilerOptions(parsedConfig!.options);
  handleOptionConfigDirTemplateSubstitution(parsedConfig!.options, basePathForFileNames);
  const rawConfig = parseJsonToStringKey(parsedConfig!.raw) as GoPtr<OrderedMap<string, unknown>>;
  if (configFileName !== "" && parsedConfig!.options !== undefined) {
    parsedConfig!.options.ConfigFilePath = NormalizeSlashes(configFileName);
  }
  const getPropFromRaw = (prop: string, validateElement: (value: unknown) => bool, elementTypeName: string): propOfRaw => {
    const [value, exists] = OrderedMap_Get(rawConfig, prop);
    if (exists && value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        const result = OrderedMap_GetOrZero(rawConfig, prop);
        if (Array.isArray(result)) {
          if (sourceFile === undefined && !core.Every(result, validateElement)) {
            errors.push(NewCompilerDiagnostic(diagnostics.Compiler_option_0_requires_a_value_of_type_1, prop, elementTypeName));
          }
        }
        return { sliceValue: result as unknown[], wrongValue: "" };
      } else if (sourceFile === undefined) {
        errors.push(NewCompilerDiagnostic(diagnostics.Compiler_option_0_requires_a_value_of_type_1, prop, "Array"));
        return { sliceValue: undefined as unknown as GoSlice<unknown>, wrongValue: "not-array" };
      }
    }
    return { sliceValue: undefined as unknown as GoSlice<unknown>, wrongValue: "no-prop" };
  };
  const referencesOfRaw = getPropFromRaw("references", (element: unknown): bool => isOrderedMap(element), "object");
  let fileSpecs = getPropFromRaw("files", (element: unknown): bool => typeof element === "string", "string");
  if ((fileSpecs.sliceValue as unknown) !== undefined || fileSpecs.wrongValue === "") {
    const hasZeroOrNoReferences: bool =
      referencesOfRaw.wrongValue === "no-prop" || referencesOfRaw.wrongValue === "not-array" || ((referencesOfRaw.sliceValue as unknown as unknown[]) ?? []).length === 0;
    const hasExtends = OrderedMap_GetOrZero(rawConfig, "extends");
    if (((fileSpecs.sliceValue as unknown as unknown[]) ?? []).length === 0 && hasZeroOrNoReferences && (hasExtends === undefined || hasExtends === null)) {
      if (sourceFile !== undefined) {
        const fileName: string = configFileName !== "" ? configFileName : "tsconfig.json";
        const diagnosticMessage = diagnostics.The_files_list_in_config_file_0_is_empty;
        const nodeValue = ForEachTsConfigPropArray<Node>(tsconfigToSourceFile(sourceFile), "files", (property: GoPtr<PropertyAssignment>): GoPtr<Node> => property!.Initializer as unknown as GoPtr<Node>);
        errors.push(CreateDiagnosticForNodeInSourceFile(tsconfigToSourceFile(sourceFile), nodeValue, diagnosticMessage, fileName));
      } else {
        errors.push(NewCompilerDiagnostic(diagnostics.The_files_list_in_config_file_0_is_empty, configFileName));
      }
    }
  }
  const includeSpecsRaw = getPropFromRaw("include", (element: unknown): bool => typeof element === "string", "string");
  const excludeSpecsRaw = getPropFromRaw("exclude", (element: unknown): bool => typeof element === "string", "string");
  let includeSpecs: propOfRaw = includeSpecsRaw;
  let excludeSpecs: propOfRaw = excludeSpecsRaw;
  let isDefaultIncludeSpec: bool = false;
  if (excludeSpecs.wrongValue === "no-prop" && parsedConfig!.options !== undefined) {
    const outDir = parsedConfig!.options.OutDir;
    const declarationDir = parsedConfig!.options.DeclarationDir;
    if ((outDir ?? "") !== "" || (declarationDir ?? "") !== "") {
      const values: unknown[] = [];
      if ((outDir ?? "") !== "") { values.push(outDir); }
      if ((declarationDir ?? "") !== "") { values.push(declarationDir); }
      excludeSpecs = { sliceValue: values, wrongValue: "" };
    }
  }
  if ((fileSpecs.sliceValue as unknown) === undefined && (includeSpecs.sliceValue as unknown) === undefined) {
    includeSpecs = { sliceValue: [defaultIncludeSpec], wrongValue: "" };
    isDefaultIncludeSpec = true;
  }
  let validatedIncludeSpecs: GoSlice<string> = [];
  let validatedIncludeSpecsBeforeSubstitution: GoSlice<string> = [];
  let validatedExcludeSpecs: GoSlice<string> = [];
  let validatedFilesSpec: GoSlice<string> = [];
  let validatedFilesSpecBeforeSubstitution: GoSlice<string> = [];
  if ((includeSpecs.sliceValue as unknown) !== undefined) {
    const [vspecs, err] = validateSpecs(includeSpecs.sliceValue, true /*disallowTrailingRecursion*/, tsconfigToSourceFile(sourceFile), "include");
    validatedIncludeSpecsBeforeSubstitution = vspecs;
    errors.push(...err);
    const substituted = getSubstitutedStringArrayWithConfigDirTemplate(validatedIncludeSpecsBeforeSubstitution, basePathForFileNames);
    validatedIncludeSpecs = substituted !== undefined ? substituted : validatedIncludeSpecsBeforeSubstitution;
  }
  if ((excludeSpecs.sliceValue as unknown) !== undefined) {
    const [vspecs, err] = validateSpecs(excludeSpecs.sliceValue, false /*disallowTrailingRecursion*/, tsconfigToSourceFile(sourceFile), "exclude");
    validatedExcludeSpecs = vspecs;
    errors.push(...err);
    const validatedExcludeSpecsWithSubstitution = getSubstitutedStringArrayWithConfigDirTemplate(validatedExcludeSpecs, basePathForFileNames);
    if (validatedExcludeSpecsWithSubstitution !== undefined) {
      validatedExcludeSpecs = validatedExcludeSpecsWithSubstitution;
    }
  }
  if ((fileSpecs.sliceValue as unknown) !== undefined) {
    const stringFileSpecs = core.Filter(fileSpecs.sliceValue, (spec: unknown): bool => typeof spec === "string") as string[];
    validatedFilesSpecBeforeSubstitution = stringFileSpecs;
    const substituted = getSubstitutedStringArrayWithConfigDirTemplate(validatedFilesSpecBeforeSubstitution, basePathForFileNames);
    validatedFilesSpec = substituted !== undefined ? substituted : validatedFilesSpecBeforeSubstitution;
  }
  const cfgSpecs: configFileSpecs = {
    filesSpecs: fileSpecs.sliceValue,
    includeSpecs: includeSpecs.sliceValue,
    excludeSpecs: excludeSpecs.sliceValue,
    validatedFilesSpec,
    validatedIncludeSpecs,
    validatedExcludeSpecs,
    validatedFilesSpecBeforeSubstitution,
    validatedIncludeSpecsBeforeSubstitution,
    isDefaultIncludeSpec,
  };
  if (sourceFile !== undefined) {
    sourceFile.configFileSpecs = cfgSpecs;
  }
  const comparePathsOptions: ComparePathsOptions = {
    UseCaseSensitiveFileNames: host.FS().UseCaseSensitiveFileNames(),
    CurrentDirectory: basePathForFileNames,
  };
  const getFileNames = (_basePath: string): [GoSlice<string>, int] => {
    const [fileNames, litLen] = getFileNamesFromConfigSpecs(cfgSpecs, _basePath, parsedConfig!.options, host.FS(), extraFileExtensions);
    if (shouldReportNoInputFiles(fileNames, canJsonReportNoInputFiles(rawConfig), resolutionStack)) {
      const incSpecs = cfgSpecs.includeSpecs !== undefined ? cfgSpecs.includeSpecs as unknown[] : [];
      const excSpecs = cfgSpecs.excludeSpecs !== undefined ? cfgSpecs.excludeSpecs as unknown[] : [];
      errors.push(NewCompilerDiagnostic(
        diagnostics.No_inputs_were_found_in_config_file_0_Specified_include_paths_were_1_and_exclude_paths_were_2,
        configFileName,
        core.Must(...core.StringifyJson(incSpecs, "", "")),
        core.Must(...core.StringifyJson(excSpecs, "", "")),
      ));
    }
    return [fileNames, litLen];
  };
  const getProjectReferences = (_basePath: string): GoSlice<GoPtr<ProjectReference>> => {
    const newReferencesOfRaw = getPropFromRaw("references", (element: unknown): bool => isOrderedMap(element), "object");
    if ((newReferencesOfRaw.sliceValue as unknown) === undefined) {
      return undefined as unknown as GoSlice<GoPtr<ProjectReference>>;
    }
    const projectReferences: GoPtr<ProjectReference>[] = [];
    for (const reference of (newReferencesOfRaw.sliceValue as unknown as unknown[])) {
      for (const ref of parseProjectReference(reference)) {
        if ((ref!.Path ?? "") === "") {
          if (sourceFile === undefined) {
            errors.push(NewCompilerDiagnostic(diagnostics.Compiler_option_0_requires_a_value_of_type_1, "reference.path", "string"));
          }
        } else {
          projectReferences.push({
            Path: GetNormalizedAbsolutePath(ref!.Path, _basePath),
            OriginalPath: ref!.Path,
            Circular: ref!.Circular,
          });
        }
      }
    }
    return projectReferences;
  };
  const [fileNames, literalFileNamesLen] = getFileNames(basePathForFileNames);
  const base = NewParsedCommandLine(parsedConfig!.options, fileNames, comparePathsOptions);
  return {
    ...base!,
    ParsedConfig: {
      CompilerOptions: parsedConfig!.options,
      WatchOptions: undefined,
      TypeAcquisition: parsedConfig!.typeAcquisition,
      FileNames: fileNames,
      ProjectReferences: getProjectReferences(basePathForFileNames),
    },
    ConfigFile: sourceFile,
    Raw: parsedConfig!.raw,
    Errors: errors,
    extraFileExtensions,
    comparePathsOptions,
    literalFileNamesLen,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::canJsonReportNoInputFiles","kind":"func","status":"implemented","sigHash":"2905e833c0246fc0e93fa4fab88da86e1a8b71b564fe7a45008479b759db2d51","bodyHash":"7ee0e11662645b440728a9dc1f34da5eb2ccd1a8f49636693ac6867798195c1a"}
 *
 * Go source:
 * func canJsonReportNoInputFiles(rawConfig *collections.OrderedMap[string, any]) bool {
 * 	filesExists := rawConfig.Has("files")
 * 	referencesExists := rawConfig.Has("references")
 * 	return !filesExists && !referencesExists
 * }
 */
export function canJsonReportNoInputFiles(rawConfig: GoPtr<OrderedMap>): bool {
  const filesExists = OrderedMap_Has(rawConfig, "files");
  const referencesExists = OrderedMap_Has(rawConfig, "references");
  return !filesExists && !referencesExists;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::shouldReportNoInputFiles","kind":"func","status":"implemented","sigHash":"4859391026d34f6e8c56dcee6846bdca5a44bb71bf1a4f08952edfd90577be77","bodyHash":"ea0b37a11a59dd83ffa1a7cb42adca34085c4de1e4044c2a5c06312700cc04c3"}
 *
 * Go source:
 * func shouldReportNoInputFiles(fileNames []string, canJsonReportNoInputFiles bool, resolutionStack []tspath.Path) bool {
 * 	return len(fileNames) == 0 && canJsonReportNoInputFiles && len(resolutionStack) == 0
 * }
 */
export function shouldReportNoInputFiles(fileNames: GoSlice<string>, canJsonReportNoInputFiles: bool, resolutionStack: GoSlice<Path>): bool {
  return fileNames.length === 0 && canJsonReportNoInputFiles && resolutionStack.length === 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::validateSpecs","kind":"func","status":"implemented","sigHash":"713d8e4ed9c9f5a76238a468d5bd8bf2e191247effe8e08e3677af4d765352f6","bodyHash":"b364a091932e3ca2a86e3eb9ac90833169fa51588aabccdfde14f4ef70191e8f"}
 *
 * Go source:
 * func validateSpecs(specs any, disallowTrailingRecursion bool, jsonSourceFile *ast.SourceFile, specKey string) ([]string, []*ast.Diagnostic) {
 * 	createDiagnostic := func(message *diagnostics.Message, spec string) *ast.Diagnostic {
 * 		element := GetTsConfigPropArrayElementValue(jsonSourceFile, specKey, spec)
 * 		return CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(jsonSourceFile, element.AsNode(), message, spec)
 * 	}
 * 	var errors []*ast.Diagnostic
 * 	var finalSpecs []string
 * 	for _, spec := range specs.([]any) {
 * 		if reflect.TypeOf(spec).Kind() != reflect.String {
 * 			continue
 * 		}
 * 		diag := specToDiagnostic(spec.(string), disallowTrailingRecursion)
 * 		if diag != nil {
 * 			errors = append(errors, createDiagnostic(diag, spec.(string)))
 * 		} else {
 * 			finalSpecs = append(finalSpecs, spec.(string))
 * 		}
 * 	}
 * 	return finalSpecs, errors
 * }
 */
export function validateSpecs(specs: unknown, disallowTrailingRecursion: bool, jsonSourceFile: GoPtr<SourceFile>, specKey: string): [GoSlice<string>, GoSlice<GoPtr<Diagnostic>>] {
  const createDiagnostic = (message: GoPtr<Message>, spec: string): GoPtr<Diagnostic> => {
    const element = GetTsConfigPropArrayElementValue(jsonSourceFile, specKey, spec);
    let node: GoPtr<Node> = undefined;
    if (element !== undefined) {
      node = element as unknown as GoPtr<Node>;
    }
    return CreateDiagnosticForNodeInSourceFileOrCompilerDiagnostic(jsonSourceFile, node, message, spec);
  };
  const errors: GoPtr<Diagnostic>[] = [];
  const finalSpecs: string[] = [];
  for (const spec of ((specs as unknown[]) ?? [])) {
    if (typeof spec !== "string") {
      continue;
    }
    const diag = specToDiagnostic(spec as string, disallowTrailingRecursion);
    if (diag !== undefined) {
      errors.push(createDiagnostic(diag, spec as string));
    } else {
      finalSpecs.push(spec as string);
    }
  }
  return [finalSpecs, errors];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::specToDiagnostic","kind":"func","status":"implemented","sigHash":"7cd4ce0b5abd2a2a15ff9f2630185376c03fc54d445ba2aee7a336787d35c3c9","bodyHash":"6412e1861d8c01eb44e91f2d04b2ab2f1f6739955f3992b8e53fa1e3e64940c3"}
 *
 * Go source:
 * func specToDiagnostic(spec string, disallowTrailingRecursion bool) *diagnostics.Message {
 * 	if disallowTrailingRecursion {
 * 		if invalidTrailingRecursion(spec) {
 * 			return diagnostics.File_specification_cannot_end_in_a_recursive_directory_wildcard_Asterisk_Asterisk_Colon_0
 * 		}
 * 	} else if invalidDotDotAfterRecursiveWildcard(spec) {
 * 		return diagnostics.File_specification_cannot_contain_a_parent_directory_that_appears_after_a_recursive_directory_wildcard_Asterisk_Asterisk_Colon_0
 * 	}
 * 	return nil
 * }
 */
export function specToDiagnostic(spec: string, disallowTrailingRecursion: bool): GoPtr<Message> {
  if (disallowTrailingRecursion) {
    if (invalidTrailingRecursion(spec)) {
      return diagnostics.File_specification_cannot_end_in_a_recursive_directory_wildcard_Asterisk_Asterisk_Colon_0;
    }
  } else if (invalidDotDotAfterRecursiveWildcard(spec)) {
    return diagnostics.File_specification_cannot_contain_a_parent_directory_that_appears_after_a_recursive_directory_wildcard_Asterisk_Asterisk_Colon_0;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::invalidTrailingRecursion","kind":"func","status":"implemented","sigHash":"11277582afee38d5d786405d4a34cf63bdbe156bd5c6f51c4aa627c80fb124f8","bodyHash":"4acfa708e477fe4b386a52d528485e8576036f79a42e1dcf210abd2d4dea3906"}
 *
 * Go source:
 * func invalidTrailingRecursion(spec string) bool {
 * 	// Matches **, /**, ** /, and /** /, but not a**b.
 * 	// Strip optional trailing slash, then check if it ends with /** or is just **
 * 	s := strings.TrimSuffix(spec, "/")
 * 	return s == "**" || strings.HasSuffix(s, "/**")
 * }
 */
export function invalidTrailingRecursion(spec: string): bool {
  // Matches **, /**, ** /, and /** /, but not a**b.
  // Strip optional trailing slash, then check if it ends with /** or is just **
  const s = strings.TrimSuffix(spec, "/");
  return s === "**" || strings.HasSuffix(s, "/**");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::invalidDotDotAfterRecursiveWildcard","kind":"func","status":"implemented","sigHash":"9a65146b2acc92685e3511678ee63c7edd1f5e22cfbb2b782435770bb5fd4c37","bodyHash":"51f5170e652881eb7227cabe0253d70d053d2f450a5c271953e9a04ce937ca8a"}
 *
 * Go source:
 * func invalidDotDotAfterRecursiveWildcard(s string) bool {
 * 	// We used to use the regex /(^|\/)\*\*\/(.*\/)?\.\.($|\/)/ to check for this case, but
 * 	// in v8, that has polynomial performance because the recursive wildcard match - ** / -
 * 	// can be matched in many arbitrary positions when multiple are present, resulting
 * 	// in bad backtracking (and we don't care which is matched - just that some /.. segment
 * 	// comes after some ** / segment).
 * 	var wildcardIndex int
 * 	if strings.HasPrefix(s, "** /") {
 * 		wildcardIndex = 0
 * 	} else {
 * 		wildcardIndex = strings.Index(s, "/** /")
 * 	}
 * 	if wildcardIndex == -1 {
 * 		return false
 * 	}
 * 	var lastDotIndex int
 * 	if strings.HasSuffix(s, "/..") {
 * 		lastDotIndex = len(s)
 * 	} else {
 * 		lastDotIndex = strings.LastIndex(s, "/../")
 * 	}
 * 	return lastDotIndex > wildcardIndex
 * }
 */
export function invalidDotDotAfterRecursiveWildcard(s: string): bool {
  // We used to use the regex /(^|\/)\*\*\/(.*\/)?\.\.($|\/)/ to check for this case, but
  // in v8, that has polynomial performance because the recursive wildcard match - **/ -
  // can be matched in many arbitrary positions when multiple are present, resulting
  // in bad backtracking (and we don't care which is matched - just that some /.. segment
  // comes after some **/ segment).
  let wildcardIndex: int;
  if (strings.HasPrefix(s, "**/")) {
    wildcardIndex = 0;
  } else {
    wildcardIndex = strings.Index(s, "/**/");
  }
  if (wildcardIndex === -1) {
    return false;
  }
  let lastDotIndex: int;
  if (strings.HasSuffix(s, "/..")) {
    lastDotIndex = s.length;
  } else {
    lastDotIndex = strings.LastIndex(s, "/../");
  }
  return lastDotIndex > wildcardIndex;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::GetTsConfigPropArrayElementValue","kind":"func","status":"implemented","sigHash":"a410e55289bd87ccaf9653a370fec391cdbddc6ff539049cc8b79bd6d7db57e0","bodyHash":"13025f4c333fd2da8f6945a3da10fdd0093953cc578117c8dd42e359ea7dda2c"}
 *
 * Go source:
 * func GetTsConfigPropArrayElementValue(tsConfigSourceFile *ast.SourceFile, propKey string, elementValue string) *ast.StringLiteral {
 * 	callback := GetCallbackForFindingPropertyAssignmentByValue(elementValue)
 * 	return ForEachTsConfigPropArray(tsConfigSourceFile, propKey, func(property *ast.PropertyAssignment) *ast.StringLiteral {
 * 		if value := callback(property); value != nil {
 * 			return value.AsStringLiteral()
 * 		}
 * 		return nil
 * 	})
 * }
 */
export function GetTsConfigPropArrayElementValue(tsConfigSourceFile: GoPtr<SourceFile>, propKey: string, elementValue: string): GoPtr<StringLiteral> {
  const callback = GetCallbackForFindingPropertyAssignmentByValue(elementValue);
  return ForEachTsConfigPropArray(tsConfigSourceFile, propKey, (property: GoPtr<PropertyAssignment>): GoPtr<StringLiteral> => {
    const value = callback(property);
    if (value !== undefined) {
      return AsStringLiteral(value);
    }
    return undefined;
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::ForEachTsConfigPropArray","kind":"func","status":"implemented","sigHash":"98efb220004dd3be3c95a39b41da58c14d763440914745489fba22362a6f4067","bodyHash":"cdbd96c430deb2be400eecec6b443203573e56c3cba76e61f46823d4ab60a3a1"}
 *
 * Go source:
 * func ForEachTsConfigPropArray[T any](tsConfigSourceFile *ast.SourceFile, propKey string, callback func(property *ast.PropertyAssignment) *T) *T {
 * 	if tsConfigSourceFile != nil {
 * 		return ForEachPropertyAssignment(getTsConfigObjectLiteralExpression(tsConfigSourceFile), propKey, callback)
 * 	}
 * 	return nil
 * }
 */
export function ForEachTsConfigPropArray<T>(tsConfigSourceFile: GoPtr<SourceFile>, propKey: string, callback: (property: GoPtr<PropertyAssignment>) => GoPtr<T>): GoPtr<T> {
  if (tsConfigSourceFile !== undefined) {
    return ForEachPropertyAssignment(getTsConfigObjectLiteralExpression(tsConfigSourceFile), propKey, callback);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::CreateDiagnosticAtReferenceSyntax","kind":"func","status":"implemented","sigHash":"7135465d0c507b151d59654e8643970e6586576ffc01772119f32b95254792a1","bodyHash":"de14b1404f3b736c23ca455ddea21e29d73f6233869f95950a82ee71f49ef2ad"}
 *
 * Go source:
 * func CreateDiagnosticAtReferenceSyntax(config *ParsedCommandLine, index int, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 	return ForEachTsConfigPropArray(config.ConfigFile.SourceFile, "references", func(property *ast.PropertyAssignment) *ast.Diagnostic {
 * 		if ast.IsArrayLiteralExpression(property.Initializer) {
 * 			value := property.Initializer.Elements()
 * 			if len(value) > index {
 * 				return CreateDiagnosticForNodeInSourceFile(config.ConfigFile.SourceFile, value[index], message, args...)
 * 			}
 * 		}
 * 		return nil
 * 	})
 * }
 */
export function CreateDiagnosticAtReferenceSyntax(config: GoPtr<ParsedCommandLine>, index: int, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic> {
  return ForEachTsConfigPropArray(config!.ConfigFile!.SourceFile, "references", (property: GoPtr<PropertyAssignment>): GoPtr<Diagnostic> => {
    if (IsArrayLiteralExpression(property!.Initializer)) {
      const value = Node_Elements(property!.Initializer) ?? [];
      if (value.length > index) {
        return CreateDiagnosticForNodeInSourceFile(config!.ConfigFile!.SourceFile, value[index], message, ...args);
      }
    }
    return undefined;
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::GetCallbackForFindingPropertyAssignmentByValue","kind":"func","status":"implemented","sigHash":"5c1b80259716905c841ed79253b3f2f27a85f9077cda5623b9c1921f56363f57","bodyHash":"e29084f05acbb8e352e1785d922828adab15ed1b564898ff9f37ff88c80e65c3"}
 *
 * Go source:
 * func GetCallbackForFindingPropertyAssignmentByValue(value string) func(property *ast.PropertyAssignment) *ast.Node {
 * 	return func(property *ast.PropertyAssignment) *ast.Node {
 * 		if ast.IsArrayLiteralExpression(property.Initializer) {
 * 			return core.Find(property.Initializer.Elements(), func(element *ast.Node) bool {
 * 				return ast.IsStringLiteral(element) && element.Text() == value
 * 			})
 * 		}
 * 		return nil
 * 	}
 * }
 */
export function GetCallbackForFindingPropertyAssignmentByValue(value: string): (property: GoPtr<PropertyAssignment>) => GoPtr<Node> {
  return (property: GoPtr<PropertyAssignment>): GoPtr<Node> => {
    if (IsArrayLiteralExpression(property!.Initializer)) {
      return core.Find(
        (Node_Elements(property!.Initializer) ?? []) as GoSlice<GoPtr<Node>>,
        (element: GoPtr<Node>): bool => (IsStringLiteral(element) && Node_Text(element) === value) as bool,
      );
    }
    return undefined;
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::GetOptionsSyntaxByArrayElementValue","kind":"func","status":"implemented","sigHash":"0730fe94b2d65f5f6aec74517458dc0e01e2809f678a04d9bf1452d0c406d701","bodyHash":"b174a8b2f9abf556f6f40b437352dec88dae8345875091ee6d26ad59db4734cc"}
 *
 * Go source:
 * func GetOptionsSyntaxByArrayElementValue(objectLiteral *ast.ObjectLiteralExpression, propKey string, elementValue string) *ast.Node {
 * 	return ForEachPropertyAssignment(objectLiteral, propKey, GetCallbackForFindingPropertyAssignmentByValue(elementValue))
 * }
 */
export function GetOptionsSyntaxByArrayElementValue(objectLiteral: GoPtr<ObjectLiteralExpression>, propKey: string, elementValue: string): GoPtr<Node> {
  return ForEachPropertyAssignment(objectLiteral, propKey, GetCallbackForFindingPropertyAssignmentByValue(elementValue));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::ForEachPropertyAssignment","kind":"func","status":"implemented","sigHash":"aaaba7cb3a537dce528d48e5180474bc9518be2027bffc7c392ffc64d9055b4a","bodyHash":"e774b4789c0ec387b321c1788f275082efcf491fdb6cdccf2e795f4a544e498d"}
 *
 * Go source:
 * func ForEachPropertyAssignment[T any](objectLiteral *ast.ObjectLiteralExpression, key string, callback func(property *ast.PropertyAssignment) *T, key2 ...string) *T {
 * 	if objectLiteral != nil {
 * 		for _, property := range objectLiteral.Properties.Nodes {
 * 			if !ast.IsPropertyAssignment(property) {
 * 				continue
 * 			}
 * 			if propName, ok := ast.TryGetTextOfPropertyName(property.Name()); ok {
 * 				if propName == key || (len(key2) > 0 && key2[0] == propName) {
 * 					return callback(property.AsPropertyAssignment())
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function ForEachPropertyAssignment<T>(objectLiteral: GoPtr<ObjectLiteralExpression>, key: string, callback: (property: GoPtr<PropertyAssignment>) => GoPtr<T>, ...key2: Array<string>): GoPtr<T> {
  if (objectLiteral !== undefined) {
    for (const property of (objectLiteral!.Properties!.Nodes! ?? [])) {
      if (!IsPropertyAssignment(property)) {
        continue;
      }
      // Go: ast.TryGetTextOfPropertyName(property.Name()) — the NAME node, and the
      // callback's result is returned unconditionally on the first key match.
      const [propName, ok] = TryGetTextOfPropertyName(Node_Name(property));
      if (ok) {
        if (propName === key || (key2.length > 0 && key2[0] === propName)) {
          return callback(AsPropertyAssignment(property));
        }
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::getTsConfigObjectLiteralExpression","kind":"func","status":"implemented","sigHash":"e119d31336255985993ef341b2d1829b3f6030f42c2a20efa2d877172127cb54","bodyHash":"1513af28e794704d609ee1dfba2b1bd60bff82aec547a7fd813ada57c00edef0"}
 *
 * Go source:
 * func getTsConfigObjectLiteralExpression(tsConfigSourceFile *ast.SourceFile) *ast.ObjectLiteralExpression {
 * 	if tsConfigSourceFile != nil && tsConfigSourceFile.Statements != nil && len(tsConfigSourceFile.Statements.Nodes) > 0 {
 * 		expression := tsConfigSourceFile.Statements.Nodes[0].Expression()
 * 		return expression.AsObjectLiteralExpression()
 * 	}
 * 	return nil
 * }
 */
export function getTsConfigObjectLiteralExpression(tsConfigSourceFile: GoPtr<SourceFile>): GoPtr<ObjectLiteralExpression> {
  if (tsConfigSourceFile !== undefined && tsConfigSourceFile!.Statements !== undefined && tsConfigSourceFile!.Statements.Nodes.length > 0) {
    const expression = Node_Expression(tsConfigSourceFile!.Statements.Nodes[0]);
    return AsObjectLiteralExpression(expression);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::getSubstitutedPathWithConfigDirTemplate","kind":"func","status":"implemented","sigHash":"c893e5953f968627009c8c4b450ef3e54a8f865f463e2eddc4b7369d38a7183b","bodyHash":"3ebf44bb790200b0094bb8013d0597fb4dec7cd8054738bcaef33fb6f269e681"}
 *
 * Go source:
 * func getSubstitutedPathWithConfigDirTemplate(value string, basePath string) string {
 * 	return tspath.GetNormalizedAbsolutePath(strings.Replace(value, configDirTemplate, "./", 1), basePath)
 * }
 */
export function getSubstitutedPathWithConfigDirTemplate(value: string, basePath: string): string {
  return GetNormalizedAbsolutePath(strings.Replace(value, configDirTemplate, "./", 1), basePath);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::getSubstitutedStringArrayWithConfigDirTemplate","kind":"func","status":"implemented","sigHash":"a7f7c47e06c2010a9067bfa9a6f0800ccc4fd180dddb356c4f7328dd050f6dab","bodyHash":"c25a1415f7bbb11fdc7d446b7b6c4f45c605c58e5d1efddffdbc15e2ba57ecef"}
 *
 * Go source:
 * func getSubstitutedStringArrayWithConfigDirTemplate(list []string, basePath string) []string {
 * 	var result []string
 * 	for i, element := range list {
 * 		if startsWithConfigDirTemplate(element) {
 * 			if result == nil {
 * 				result = slices.Clone(list)
 * 			}
 * 			result[i] = getSubstitutedPathWithConfigDirTemplate(element, basePath)
 * 		}
 * 	}
 * 	if result != nil {
 * 		return result
 * 	}
 * 	return nil
 * }
 */
export function getSubstitutedStringArrayWithConfigDirTemplate(list: GoPtr<GoSlice<string>>, basePath: string): GoPtr<GoSlice<string>> {
  let result: string[] | undefined = undefined;
  for (let i = 0; i < (list?.length ?? 0); i++) {
    const element = list![i];
    if (startsWithConfigDirTemplate(element)) {
      if (result === undefined) {
        result = Clone(list) as string[];
      }
      result![i] = getSubstitutedPathWithConfigDirTemplate(element!, basePath);
    }
  }
  if (result !== undefined) {
    return result;
  }
  // Return undefined (nil in Go) if no substitution happened
  return undefined as unknown as GoSlice<string>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::handleOptionConfigDirTemplateSubstitution","kind":"func","status":"implemented","sigHash":"90580d957d6dfc2d3592f354a79aaf23031555a93aca982a0282d1f60c7c7049","bodyHash":"04108c381481f400237c4fa7bbd1509e3fc0e4b46e1df339a024086ada19102d"}
 *
 * Go source:
 * func handleOptionConfigDirTemplateSubstitution(compilerOptions *core.CompilerOptions, basePath string) {
 * 	if compilerOptions == nil {
 * 		return
 * 	}
 * 
 * 	// !!! don't hardcode this; use options declarations?
 * 
 * 	for k, v := range compilerOptions.Paths.Entries() {
 * 		if substitution := getSubstitutedStringArrayWithConfigDirTemplate(v, basePath); substitution != nil {
 * 			compilerOptions.Paths.Set(k, substitution)
 * 		}
 * 	}
 * 
 * 	if rootDirs := getSubstitutedStringArrayWithConfigDirTemplate(compilerOptions.RootDirs, basePath); rootDirs != nil {
 * 		compilerOptions.RootDirs = rootDirs
 * 	}
 * 	if typeRoots := getSubstitutedStringArrayWithConfigDirTemplate(compilerOptions.TypeRoots, basePath); typeRoots != nil {
 * 		compilerOptions.TypeRoots = typeRoots
 * 	}
 * 	if startsWithConfigDirTemplate(compilerOptions.GenerateCpuProfile) {
 * 		compilerOptions.GenerateCpuProfile = getSubstitutedPathWithConfigDirTemplate(compilerOptions.GenerateCpuProfile, basePath)
 * 	}
 * 	if startsWithConfigDirTemplate(compilerOptions.GenerateTrace) {
 * 		compilerOptions.GenerateTrace = getSubstitutedPathWithConfigDirTemplate(compilerOptions.GenerateTrace, basePath)
 * 	}
 * 	if startsWithConfigDirTemplate(compilerOptions.OutFile) {
 * 		compilerOptions.OutFile = getSubstitutedPathWithConfigDirTemplate(compilerOptions.OutFile, basePath)
 * 	}
 * 	if startsWithConfigDirTemplate(compilerOptions.OutDir) {
 * 		compilerOptions.OutDir = getSubstitutedPathWithConfigDirTemplate(compilerOptions.OutDir, basePath)
 * 	}
 * 	if startsWithConfigDirTemplate(compilerOptions.RootDir) {
 * 		compilerOptions.RootDir = getSubstitutedPathWithConfigDirTemplate(compilerOptions.RootDir, basePath)
 * 	}
 * 	if startsWithConfigDirTemplate(compilerOptions.TsBuildInfoFile) {
 * 		compilerOptions.TsBuildInfoFile = getSubstitutedPathWithConfigDirTemplate(compilerOptions.TsBuildInfoFile, basePath)
 * 	}
 * 	if startsWithConfigDirTemplate(compilerOptions.BaseUrl) {
 * 		compilerOptions.BaseUrl = getSubstitutedPathWithConfigDirTemplate(compilerOptions.BaseUrl, basePath)
 * 	}
 * 	if startsWithConfigDirTemplate(compilerOptions.DeclarationDir) {
 * 		compilerOptions.DeclarationDir = getSubstitutedPathWithConfigDirTemplate(compilerOptions.DeclarationDir, basePath)
 * 	}
 * }
 */
export function handleOptionConfigDirTemplateSubstitution(compilerOptions: GoPtr<CompilerOptions>, basePath: string): void {
  if (compilerOptions === undefined) {
    return;
  }
  const options = compilerOptions;

  // !!! don't hardcode this; use options declarations?

  OrderedMap_Entries(options.Paths as GoPtr<OrderedMap<string, GoSlice<string>>>)((k: string, v: GoSlice<string>): bool => {
    const substitution = getSubstitutedStringArrayWithConfigDirTemplate(v, basePath);
    if (substitution !== undefined) {
      OrderedMap_Set(options.Paths as GoPtr<OrderedMap<string, GoSlice<string>>>, k, substitution);
    }
    return true;
  });

  const rootDirs = getSubstitutedStringArrayWithConfigDirTemplate(options.RootDirs, basePath);
  if (rootDirs !== undefined) {
    options.RootDirs = rootDirs;
  }
  const typeRoots = getSubstitutedStringArrayWithConfigDirTemplate(compilerOptions.TypeRoots, basePath);
  if (typeRoots !== undefined) {
    compilerOptions.TypeRoots = typeRoots;
  }
  if (startsWithConfigDirTemplate(compilerOptions.GenerateCpuProfile)) {
    compilerOptions.GenerateCpuProfile = getSubstitutedPathWithConfigDirTemplate(compilerOptions.GenerateCpuProfile, basePath);
  }
  if (startsWithConfigDirTemplate(compilerOptions.GenerateTrace)) {
    compilerOptions.GenerateTrace = getSubstitutedPathWithConfigDirTemplate(compilerOptions.GenerateTrace, basePath);
  }
  if (startsWithConfigDirTemplate(compilerOptions.OutFile)) {
    compilerOptions.OutFile = getSubstitutedPathWithConfigDirTemplate(compilerOptions.OutFile, basePath);
  }
  if (startsWithConfigDirTemplate(compilerOptions.OutDir)) {
    compilerOptions.OutDir = getSubstitutedPathWithConfigDirTemplate(compilerOptions.OutDir, basePath);
  }
  if (startsWithConfigDirTemplate(compilerOptions.RootDir)) {
    compilerOptions.RootDir = getSubstitutedPathWithConfigDirTemplate(compilerOptions.RootDir, basePath);
  }
  if (startsWithConfigDirTemplate(compilerOptions.TsBuildInfoFile)) {
    compilerOptions.TsBuildInfoFile = getSubstitutedPathWithConfigDirTemplate(compilerOptions.TsBuildInfoFile, basePath);
  }
  if (startsWithConfigDirTemplate(compilerOptions.BaseUrl)) {
    compilerOptions.BaseUrl = getSubstitutedPathWithConfigDirTemplate(compilerOptions.BaseUrl, basePath);
  }
  if (startsWithConfigDirTemplate(compilerOptions.DeclarationDir)) {
    compilerOptions.DeclarationDir = getSubstitutedPathWithConfigDirTemplate(compilerOptions.DeclarationDir, basePath);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::hasFileWithHigherPriorityExtension","kind":"func","status":"implemented","sigHash":"4803f9d4107c4be253f309433655d046ea8e1b1166023e8c595bbab6c21def97","bodyHash":"38ffb65b4b40db18c4ee7ff66bd29dbb915e788a82bba7f59372595fb6929998"}
 *
 * Go source:
 * func hasFileWithHigherPriorityExtension(file string, extensions [][]string, hasFile func(fileName string) bool) bool {
 * 	var extensionGroup []string
 * 	for _, group := range extensions {
 * 		if tspath.FileExtensionIsOneOf(file, group) {
 * 			extensionGroup = append(extensionGroup, group...)
 * 		}
 * 	}
 * 	if len(extensionGroup) == 0 {
 * 		return false
 * 	}
 * 	for _, ext := range extensionGroup {
 * 		// d.ts files match with .ts extension and with case sensitive sorting the file order for same files with ts tsx and dts extension is
 * 		// d.ts, .ts, .tsx in that order so we need to handle tsx and dts of same same name case here and in remove files with same extensions
 * 		// So dont match .d.ts files with .ts extension
 * 		if tspath.FileExtensionIs(file, ext) && (ext != tspath.ExtensionTs || !tspath.FileExtensionIs(file, tspath.ExtensionDts)) {
 * 			return false
 * 		}
 * 		if hasFile(tspath.ChangeExtension(file, ext)) {
 * 			if ext == tspath.ExtensionDts && (tspath.FileExtensionIs(file, tspath.ExtensionJs) || tspath.FileExtensionIs(file, tspath.ExtensionJsx)) {
 * 				// LEGACY BEHAVIOR: An off-by-one bug somewhere in the extension priority system for wildcard module loading allowed declaration
 * 				// files to be loaded alongside their js(x) counterparts. We regard this as generally undesirable, but retain the behavior to
 * 				// prevent breakage.
 * 				continue
 * 			}
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function hasFileWithHigherPriorityExtension(file: string, extensions: GoSlice<GoSlice<string>>, hasFile: (fileName: string) => bool): bool {
  let extensionGroup: string[] = [];
  for (const group of extensions) {
    if (FileExtensionIsOneOf(file, group)) {
      extensionGroup = extensionGroup.concat(group);
    }
  }
  if (extensionGroup.length === 0) {
    return false;
  }
  for (const ext of extensionGroup) {
    // d.ts files match with .ts extension and with case sensitive sorting the file order for same files with ts tsx and dts extension is
    // d.ts, .ts, .tsx in that order so we need to handle tsx and dts of same same name case here and in remove files with same extensions
    // So dont match .d.ts files with .ts extension
    if (FileExtensionIs(file, ext) && (ext !== ExtensionTs || !FileExtensionIs(file, ExtensionDts))) {
      return false;
    }
    if (hasFile(ChangeExtension(file, ext))) {
      if (ext === ExtensionDts && (FileExtensionIs(file, ExtensionJs) || FileExtensionIs(file, ExtensionJsx))) {
        // LEGACY BEHAVIOR: An off-by-one bug somewhere in the extension priority system for wildcard module loading allowed declaration
        // files to be loaded alongside their js(x) counterparts. We regard this as generally undesirable, but retain the behavior to
        // prevent breakage.
        continue;
      }
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::removeWildcardFilesWithLowerPriorityExtension","kind":"func","status":"implemented","sigHash":"61b2c047ed0c8588467094a037c8f8c509cace06e547134e5663729324ff7483","bodyHash":"d96c31fd40f69c867a963243c8728bf610cf57a36592abe8875e61a4c5fdf63f"}
 *
 * Go source:
 * func removeWildcardFilesWithLowerPriorityExtension(file string, wildcardFiles *collections.OrderedMap[string, string], extensions [][]string, keyMapper func(value string) string) {
 * 	var extensionGroup []string
 * 	for _, group := range extensions {
 * 		if tspath.FileExtensionIsOneOf(file, group) {
 * 			extensionGroup = append(extensionGroup, group...)
 * 		}
 * 	}
 * 	if extensionGroup == nil {
 * 		return
 * 	}
 * 	for i := len(extensionGroup) - 1; i >= 0; i-- {
 * 		ext := extensionGroup[i]
 * 		if tspath.FileExtensionIs(file, ext) {
 * 			return
 * 		}
 * 		lowerPriorityPath := keyMapper(tspath.ChangeExtension(file, ext))
 * 		wildcardFiles.Delete(lowerPriorityPath)
 * 	}
 * }
 */
export function removeWildcardFilesWithLowerPriorityExtension(file: string, wildcardFiles: GoPtr<OrderedMap>, extensions: GoSlice<GoSlice<string>>, keyMapper: (value: string) => string): void {
  let extensionGroup: string[] = [];
  for (const group of extensions) {
    if (FileExtensionIsOneOf(file, group)) {
      extensionGroup = extensionGroup.concat(group);
    }
  }
  if (extensionGroup.length === 0) {
    return;
  }
  for (let i = extensionGroup.length - 1; i >= 0; i--) {
    const ext = extensionGroup[i];
    if (FileExtensionIs(file, ext!)) {
      return;
    }
    const lowerPriorityPath = keyMapper(ChangeExtension(file, ext!));
    OrderedMap_Delete(wildcardFiles as GoPtr<OrderedMap<string, string>>, lowerPriorityPath);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::getFileNamesFromConfigSpecs","kind":"func","status":"implemented","sigHash":"d4f288ad5e027825ff223ec4c7ae8a981fc3e88bfa0709a548906b2541c771e9","bodyHash":"fbc1db4bc1a0f8c8edb706a285f9b58b4dfd7180f8970d3c4cb294ea16dbbfe7"}
 *
 * Go source:
 * func getFileNamesFromConfigSpecs(
 * 	configFileSpecs configFileSpecs,
 * 	basePath string, // considering this is the current directory
 * 	options *core.CompilerOptions,
 * 	host vfs.FS,
 * 	extraFileExtensions []FileExtensionInfo,
 * ) ([]string, int) {
 * 	extraFileExtensions = []FileExtensionInfo{}
 * 	basePath = tspath.NormalizePath(basePath)
 * 	keyMappper := func(value string) string { return tspath.GetCanonicalFileName(value, host.UseCaseSensitiveFileNames()) }
 * 	// Literal file names (provided via the "files" array in tsconfig.json) are stored in a
 * 	// file map with a possibly case insensitive key. We use this map later when when including
 * 	// wildcard paths.
 * 	var literalFileMap collections.OrderedMap[string, string]
 * 	// Wildcard paths (provided via the "includes" array in tsconfig.json) are stored in a
 * 	// file map with a possibly case insensitive key. We use this map to store paths matched
 * 	// via wildcard, and to handle extension priority.
 * 	var wildcardFileMap collections.OrderedMap[string, string]
 * 	// Wildcard paths of json files (provided via the "includes" array in tsconfig.json) are stored in a
 * 	// file map with a possibly case insensitive key. We use this map to store paths matched
 * 	// via wildcard of *.json kind
 * 	var wildCardJsonFileMap collections.OrderedMap[string, string]
 * 	validatedFilesSpec := configFileSpecs.validatedFilesSpec
 * 	validatedIncludeSpecs := configFileSpecs.validatedIncludeSpecs
 * 	validatedExcludeSpecs := configFileSpecs.validatedExcludeSpecs
 * 	// Rather than re-query this for each file and filespec, we query the supported extensions
 * 	// once and store it on the expansion context.
 * 	supportedExtensions := GetSupportedExtensions(options, extraFileExtensions)
 * 	supportedExtensionsWithJsonIfResolveJsonModule := GetSupportedExtensionsWithJsonIfResolveJsonModule(options, supportedExtensions)
 * 	// Literal files are always included verbatim. An "include" or "exclude" specification cannot
 * 	// remove a literal file.
 * 	for _, fileName := range validatedFilesSpec {
 * 		file := tspath.GetNormalizedAbsolutePath(fileName, basePath)
 * 		literalFileMap.Set(keyMappper(fileName), file)
 * 	}
 * 
 * 	var jsonOnlyIncludeMatchers *vfsmatch.SpecMatcher
 * 	if len(validatedIncludeSpecs) > 0 {
 * 		files := vfsmatch.ReadDirectory(host, basePath, basePath, core.Flatten(supportedExtensionsWithJsonIfResolveJsonModule), validatedExcludeSpecs, validatedIncludeSpecs, vfsmatch.UnlimitedDepth)
 * 		for _, file := range files {
 * 			if tspath.FileExtensionIs(file, tspath.ExtensionJson) {
 * 				if jsonOnlyIncludeMatchers == nil {
 * 					includes := core.Filter(validatedIncludeSpecs, func(include string) bool { return strings.HasSuffix(include, tspath.ExtensionJson) })
 * 					jsonOnlyIncludeMatchers = vfsmatch.NewSpecMatcher(includes, basePath, vfsmatch.UsageFiles, host.UseCaseSensitiveFileNames())
 * 				}
 * 				var includeIndex int = -1
 * 				if jsonOnlyIncludeMatchers != nil {
 * 					includeIndex = jsonOnlyIncludeMatchers.MatchIndex(file)
 * 				}
 * 				if includeIndex != -1 {
 * 					key := keyMappper(file)
 * 					if !literalFileMap.Has(key) && !wildCardJsonFileMap.Has(key) {
 * 						wildCardJsonFileMap.Set(key, file)
 * 					}
 * 				}
 * 				continue
 * 			}
 * 			// If we have already included a literal or wildcard path with a
 * 			// higher priority extension, we should skip this file.
 * 			//
 * 			// This handles cases where we may encounter both <file>.ts and
 * 			// <file>.d.ts (or <file>.js if "allowJs" is enabled) in the same
 * 			// directory when they are compilation outputs.
 * 			if hasFileWithHigherPriorityExtension(file, supportedExtensions, func(fileName string) bool {
 * 				canonicalFileName := keyMappper(fileName)
 * 				return literalFileMap.Has(canonicalFileName) || wildcardFileMap.Has(canonicalFileName)
 * 			}) {
 * 				continue
 * 			}
 * 			// We may have included a wildcard path with a lower priority
 * 			// extension due to the user-defined order of entries in the
 * 			// "include" array. If there is a lower priority extension in the
 * 			// same directory, we should remove it.
 * 			removeWildcardFilesWithLowerPriorityExtension(file, &wildcardFileMap, supportedExtensions, keyMappper)
 * 			key := keyMappper(file)
 * 			if !literalFileMap.Has(key) && !wildcardFileMap.Has(key) {
 * 				wildcardFileMap.Set(key, file)
 * 			}
 * 		}
 * 	}
 * 	files := make([]string, 0, literalFileMap.Size()+wildcardFileMap.Size()+wildCardJsonFileMap.Size())
 * 	for file := range literalFileMap.Values() {
 * 		files = append(files, file)
 * 	}
 * 	for file := range wildcardFileMap.Values() {
 * 		files = append(files, file)
 * 	}
 * 	for file := range wildCardJsonFileMap.Values() {
 * 		files = append(files, file)
 * 	}
 * 	return files, literalFileMap.Size()
 * }
 */
export function getFileNamesFromConfigSpecs(configFileSpecs: configFileSpecs, basePath: string, options: GoPtr<CompilerOptions>, host: FS, extraFileExtensions: GoSlice<FileExtensionInfo>): [GoSlice<string>, int] {
  // Go overrides extraFileExtensions with empty slice in this function
  extraFileExtensions = [];
  basePath = NormalizePath(basePath);
  const keyMapper = (value: string): string => GetCanonicalFileName(value, host.UseCaseSensitiveFileNames());
  // Literal file names (provided via the "files" array in tsconfig.json) are stored in a
  // file map with a possibly case insensitive key. We use this map later when including wildcard paths.
  const literalFileMap = newMapWithSizeHint<string, string>(0);
  // Wildcard paths
  const wildcardFileMap = newMapWithSizeHint<string, string>(0);
  // Wildcard paths of json files
  const wildCardJsonFileMap = newMapWithSizeHint<string, string>(0);
  const validatedFilesSpec = configFileSpecs.validatedFilesSpec;
  const validatedIncludeSpecs = configFileSpecs.validatedIncludeSpecs;
  const validatedExcludeSpecs = configFileSpecs.validatedExcludeSpecs;
  // Rather than re-query this for each file and filespec, we query the supported extensions once.
  const supportedExtensions = GetSupportedExtensions(options, extraFileExtensions);
  const supportedExtensionsWithJsonIfResolveJsonModule = GetSupportedExtensionsWithJsonIfResolveJsonModule(options, supportedExtensions);
  // Literal files are always included verbatim.
  for (const fileName of (validatedFilesSpec ?? [])) {
    const file = GetNormalizedAbsolutePath(fileName, basePath);
    OrderedMap_Set(literalFileMap as GoPtr<OrderedMap<string, string>>, keyMapper(fileName), file);
  }

  let jsonOnlyIncludeMatchers: GoPtr<ReturnType<typeof NewSpecMatcher>> = undefined;
  if ((validatedIncludeSpecs ?? []).length > 0) {
    const files = ReadDirectory(host, basePath, basePath, core.Flatten(supportedExtensionsWithJsonIfResolveJsonModule), validatedExcludeSpecs, validatedIncludeSpecs, UnlimitedDepth);
    for (const file of files) {
      if (FileExtensionIs(file, ExtensionJson)) {
        if (jsonOnlyIncludeMatchers === undefined) {
          const includes = core.Filter(validatedIncludeSpecs, (include: string): bool => strings.HasSuffix(include, ExtensionJson) as bool);
          jsonOnlyIncludeMatchers = NewSpecMatcher(includes, basePath, UsageFiles, host.UseCaseSensitiveFileNames());
        }
        let includeIndex: int = -1 as int;
        if (jsonOnlyIncludeMatchers !== undefined) {
          includeIndex = SpecMatcher_MatchIndex(jsonOnlyIncludeMatchers, file);
        }
        if (includeIndex !== -1) {
          const key = keyMapper(file);
          if (!OrderedMap_Has(literalFileMap as GoPtr<OrderedMap<string, string>>, key) && !OrderedMap_Has(wildCardJsonFileMap as GoPtr<OrderedMap<string, string>>, key)) {
            OrderedMap_Set(wildCardJsonFileMap as GoPtr<OrderedMap<string, string>>, key, file);
          }
        }
        continue;
      }
      // If we have already included a literal or wildcard path with a higher priority extension, skip this file.
      if (hasFileWithHigherPriorityExtension(file, supportedExtensions, (fn: string): bool => {
        const canonicalFileName = keyMapper(fn);
        return (OrderedMap_Has(literalFileMap as GoPtr<OrderedMap<string, string>>, canonicalFileName) || OrderedMap_Has(wildcardFileMap as GoPtr<OrderedMap<string, string>>, canonicalFileName)) as bool;
      })) {
        continue;
      }
      // We may have included a wildcard path with a lower priority extension due to the user-defined order.
      removeWildcardFilesWithLowerPriorityExtension(file, wildcardFileMap as GoPtr<OrderedMap>, supportedExtensions, keyMapper);
      const key = keyMapper(file);
      if (!OrderedMap_Has(literalFileMap as GoPtr<OrderedMap<string, string>>, key) && !OrderedMap_Has(wildcardFileMap as GoPtr<OrderedMap<string, string>>, key)) {
        OrderedMap_Set(wildcardFileMap as GoPtr<OrderedMap<string, string>>, key, file);
      }
    }
  }
  const files: string[] = [];
  OrderedMap_Values(literalFileMap as GoPtr<OrderedMap<string, string>>)((file: string): bool => {
    files.push(file);
    return true;
  });
  OrderedMap_Values(wildcardFileMap as GoPtr<OrderedMap<string, string>>)((file: string): bool => {
    files.push(file);
    return true;
  });
  OrderedMap_Values(wildCardJsonFileMap as GoPtr<OrderedMap<string, string>>)((file: string): bool => {
    files.push(file);
    return true;
  });
  return [files, OrderedMap_Size(literalFileMap as GoPtr<OrderedMap<string, string>>)];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::GetSupportedExtensions","kind":"func","status":"implemented","sigHash":"8e5a95f7d0c21a2bc503dba70fc5821daa2d5cb30e6699a65ae657274648012c","bodyHash":"012a03efff573ba09331ae02c8febadf5d85aa5461dafd5643715e7de807f970"}
 *
 * Go source:
 * func GetSupportedExtensions(compilerOptions *core.CompilerOptions, extraFileExtensions []FileExtensionInfo) [][]string {
 * 	needJSExtensions := compilerOptions.GetAllowJS()
 * 	if len(extraFileExtensions) == 0 {
 * 		if needJSExtensions {
 * 			return tspath.AllSupportedExtensions
 * 		} else {
 * 			return tspath.SupportedTSExtensions
 * 		}
 * 	}
 * 	var builtins [][]string
 * 	if needJSExtensions {
 * 		builtins = tspath.AllSupportedExtensions
 * 	} else {
 * 		builtins = tspath.SupportedTSExtensions
 * 	}
 * 	flatBuiltins := core.Flatten(builtins)
 * 	var result [][]string
 * 	for _, x := range extraFileExtensions {
 * 		if x.ScriptKind == core.ScriptKindDeferred || (needJSExtensions && (x.ScriptKind == core.ScriptKindJS || x.ScriptKind == core.ScriptKindJSX)) && !slices.Contains(flatBuiltins, x.Extension) {
 * 			result = append(result, []string{x.Extension})
 * 		}
 * 	}
 * 	extensions := slices.Concat(builtins, result)
 * 	return extensions
 * }
 */
export function GetSupportedExtensions(compilerOptions: GoPtr<CompilerOptions>, extraFileExtensions: GoSlice<FileExtensionInfo>): GoSlice<GoSlice<string>> {
  const needJSExtensions = CompilerOptions_GetAllowJS(compilerOptions);
  if ((extraFileExtensions ?? []).length === 0) {
    if (needJSExtensions) {
      return AllSupportedExtensions;
    } else {
      return SupportedTSExtensions;
    }
  }
  const builtins: GoSlice<GoSlice<string>> = needJSExtensions ? AllSupportedExtensions : SupportedTSExtensions;
  const flatBuiltins = core.Flatten(builtins);
  const result: GoSlice<string>[] = [];
  for (const x of extraFileExtensions) {
    if (x.ScriptKind === ScriptKindDeferred || (needJSExtensions && (x.ScriptKind === ScriptKindJS || x.ScriptKind === ScriptKindJSX)) && !Contains(flatBuiltins, x.Extension)) {
      result.push([x.Extension]);
    }
  }
  const extensions = Concat(builtins, result);
  return extensions;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::GetSupportedExtensionsWithJsonIfResolveJsonModule","kind":"func","status":"implemented","sigHash":"3ad153f6fc830ee9836e2a90b782120ff0a5d35329b4184f77d2eee199f84f73","bodyHash":"138387b572d7be5f1b5d6ec3931db43bd68b7ea2f00f7be41b09008c19a52ba6"}
 *
 * Go source:
 * func GetSupportedExtensionsWithJsonIfResolveJsonModule(compilerOptions *core.CompilerOptions, supportedExtensions [][]string) [][]string {
 * 	if compilerOptions == nil || !compilerOptions.GetResolveJsonModule() {
 * 		return supportedExtensions
 * 	}
 * 	if core.Same(supportedExtensions, tspath.AllSupportedExtensions) {
 * 		return tspath.AllSupportedExtensionsWithJson
 * 	}
 * 	if core.Same(supportedExtensions, tspath.SupportedTSExtensions) {
 * 		return tspath.SupportedTSExtensionsWithJson
 * 	}
 * 	return slices.Concat(supportedExtensions, [][]string{{tspath.ExtensionJson}})
 * }
 */
export function GetSupportedExtensionsWithJsonIfResolveJsonModule(compilerOptions: GoPtr<CompilerOptions>, supportedExtensions: GoSlice<GoSlice<string>>): GoSlice<GoSlice<string>> {
  if (compilerOptions === undefined || !CompilerOptions_GetResolveJsonModule(compilerOptions)) {
    return supportedExtensions;
  }
  if (core.Same(supportedExtensions, AllSupportedExtensions)) {
    return AllSupportedExtensionsWithJson as GoSlice<GoSlice<string>>;
  }
  if (core.Same(supportedExtensions, SupportedTSExtensions)) {
    return SupportedTSExtensionsWithJson as GoSlice<GoSlice<string>>;
  }
  return Concat(supportedExtensions, [[ExtensionJson]]);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::GetParsedCommandLineOfConfigFile","kind":"func","status":"implemented","sigHash":"65f56f01994894b906e772a362e2f208302b65df11351b74a9f68d4ff02d2191","bodyHash":"b79e2cdc3c41250c9499d147feaf699f7ecff70b00f5d15d1db632b8f9bbae1e"}
 *
 * Go source:
 * func GetParsedCommandLineOfConfigFile(
 * 	configFileName string,
 * 	options *core.CompilerOptions,
 * 	optionsRaw *collections.OrderedMap[string, any],
 * 	sys ParseConfigHost,
 * 	extendedConfigCache ExtendedConfigCache,
 * ) (*ParsedCommandLine, []*ast.Diagnostic) {
 * 	configFileName = tspath.GetNormalizedAbsolutePath(configFileName, sys.GetCurrentDirectory())
 * 	return GetParsedCommandLineOfConfigFilePath(configFileName, tspath.ToPath(configFileName, sys.GetCurrentDirectory(), sys.FS().UseCaseSensitiveFileNames()), options, optionsRaw, sys, extendedConfigCache)
 * }
 */
export function GetParsedCommandLineOfConfigFile(configFileName: string, options: GoPtr<CompilerOptions>, optionsRaw: GoPtr<OrderedMap>, sys: ParseConfigHost, extendedConfigCache: GoPtr<ExtendedConfigCache>): [GoPtr<ParsedCommandLine>, GoSlice<GoPtr<Diagnostic>>] {
  const normalizedFileName = GetNormalizedAbsolutePath(configFileName, sys.GetCurrentDirectory());
  return GetParsedCommandLineOfConfigFilePath(normalizedFileName, ToPath(normalizedFileName, sys.GetCurrentDirectory(), sys.FS().UseCaseSensitiveFileNames()), options, optionsRaw, sys, extendedConfigCache);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/tsconfigparsing.go::func::GetParsedCommandLineOfConfigFilePath","kind":"func","status":"implemented","sigHash":"b143617fe618e5a596ae32db98b693da30e3beaea485bcaefe96b3c310a37180","bodyHash":"1df1d700c4f109dbdbff35fed1a0bb34974ffd31781ec5b025fee5385f7cd3a5"}
 *
 * Go source:
 * func GetParsedCommandLineOfConfigFilePath(
 * 	configFileName string,
 * 	path tspath.Path,
 * 	options *core.CompilerOptions,
 * 	optionsRaw *collections.OrderedMap[string, any],
 * 	sys ParseConfigHost,
 * 	extendedConfigCache ExtendedConfigCache,
 * ) (*ParsedCommandLine, []*ast.Diagnostic) {
 * 	errors := []*ast.Diagnostic{}
 * 	configFileText, errors := tryReadFile(configFileName, sys.FS().ReadFile, errors)
 * 	if len(errors) > 0 {
 * 		// these are unrecoverable errors--exit to report them as diagnostics
 * 		return nil, errors
 * 	}
 * 
 * 	tsConfigSourceFile := NewTsconfigSourceFileFromFilePath(configFileName, path, configFileText)
 * 	// tsConfigSourceFile.resolvedPath = tsConfigSourceFile.FileName()
 * 	// tsConfigSourceFile.originalFileName = tsConfigSourceFile.FileName()
 * 	return ParseJsonSourceFileConfigFileContent(
 * 		tsConfigSourceFile,
 * 		sys,
 * 		tspath.GetDirectoryPath(configFileName),
 * 		options,
 * 		optionsRaw,
 * 		configFileName,
 * 		nil,
 * 		nil,
 * 		extendedConfigCache,
 * 	), nil
 * }
 */
export function GetParsedCommandLineOfConfigFilePath(configFileName: string, path: Path, options: GoPtr<CompilerOptions>, optionsRaw: GoPtr<OrderedMap>, sys: ParseConfigHost, extendedConfigCache: GoPtr<ExtendedConfigCache>): [GoPtr<ParsedCommandLine>, GoSlice<GoPtr<Diagnostic>>] {
  const [configFileText, readErrors] = tryReadFile(configFileName, sys.FS().ReadFile.bind(sys.FS()), []);
  if ((readErrors ?? []).length > 0) {
    return [undefined, readErrors];
  }
  const tsConfigSourceFile = NewTsconfigSourceFileFromFilePath(configFileName, path, configFileText);
  return [ParseJsonSourceFileConfigFileContent(tsConfigSourceFile, sys, GetDirectoryPath(configFileName), options, optionsRaw as GoPtr<OrderedMap<string, unknown>>, configFileName, [], undefined as unknown as GoSlice<FileExtensionInfo>, extendedConfigCache), undefined as unknown as GoSlice<GoPtr<Diagnostic>>];
}
