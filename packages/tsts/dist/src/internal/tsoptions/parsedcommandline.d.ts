import type { bool, int } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSeq, GoSeq2, GoSlice } from "../../go/compat.js";
import { Once } from "../../go/sync.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import type { CompilerOptions as CompilerOptions_3bab6c7a } from "../core/compileroptions.js";
import type { ParsedOptions } from "../core/parsedoptions.js";
import type { ProjectReference } from "../core/projectreference.js";
import type { TypeAcquisition as TypeAcquisition_0a5bf39c } from "../core/typeacquisition.js";
import type { Glob } from "../glob/glob.js";
import type { Locale as Locale_c4184476 } from "../locale/locale.js";
import type { ResolvedProjectReference } from "../module/types.js";
import type { OutputPathsHost } from "../outputpaths/outputpaths.js";
import type { ComparePathsOptions, Path } from "../tspath/path.js";
import type { FS } from "../vfs/vfs.js";
import type { FileExtensionInfo, TsConfigSourceFile } from "./tsconfigparsing.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::constGroup::fileGlobPattern+recursiveFileGlobPattern","kind":"constGroup","status":"implemented","sigHash":"b72f79c30886c1bb508333146dea617bea7fa7ea2bcd9c06e79b68e1fe236c28","bodyHash":"96d7125f6189a185d3f4b801e9da617a5550789fed13a2e75ae059830b6bbdc8"}
 *
 * Go source:
 * const (
 * 	fileGlobPattern          = "*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,json}"
 * 	recursiveFileGlobPattern = "** /*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,json}"
 * )
 */
export declare const fileGlobPattern: string;
export declare const recursiveFileGlobPattern: string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::type::ParsedCommandLine","kind":"type","status":"implemented","sigHash":"fe8a58046a678b95837026594b9593557e0041023932ee4366c6d1126b5057c0","bodyHash":"f3364adf6d588d9ea06b50bf57e377d5d7a11ce76264ab820d41514c387ee3ae"}
 *
 * Go source:
 * ParsedCommandLine struct {
 * 	ParsedConfig *core.ParsedOptions `json:"parsedConfig"`
 *
 * 	ConfigFile    *TsConfigSourceFile `json:"configFile"` // TsConfigSourceFile, used in Program and ExecuteCommandLine
 * 	Errors        []*ast.Diagnostic   `json:"errors"`
 * 	Raw           any                 `json:"raw"`
 * 	CompileOnSave *bool               `json:"compileOnSave"`
 *
 * 	comparePathsOptions     tspath.ComparePathsOptions
 * 	wildcardDirectoriesOnce sync.Once
 * 	wildcardDirectories     map[string]bool
 * 	includeGlobsOnce        sync.Once
 * 	includeGlobs            []*glob.Glob
 * 	extraFileExtensions     []FileExtensionInfo
 *
 * 	sourceAndOutputMapsOnce     sync.Once
 * 	sourceToProjectReference    map[tspath.Path]*SourceOutputAndProjectReference
 * 	outputDtsToProjectReference map[tspath.Path]*SourceOutputAndProjectReference
 *
 * 	commonSourceDirectory     string
 * 	commonSourceDirectoryOnce sync.Once
 *
 * 	resolvedProjectReferencePaths     []string
 * 	resolvedProjectReferencePathsOnce sync.Once
 *
 * 	literalFileNamesLen int
 * 	fileNamesByPath     map[tspath.Path]string // maps file names to their paths, used for quick lookups
 * 	fileNamesByPathOnce sync.Once
 *
 * 	locale     locale.Locale
 * 	localeOnce sync.Once
 * }
 */
export interface ParsedCommandLine {
    ParsedConfig: GoPtr<ParsedOptions>;
    ConfigFile: GoPtr<TsConfigSourceFile>;
    Errors: GoSlice<GoPtr<Diagnostic>>;
    Raw: unknown;
    CompileOnSave: GoPtr<bool>;
    comparePathsOptions: ComparePathsOptions;
    wildcardDirectoriesOnce: Once;
    wildcardDirectories: GoMap<string, bool>;
    includeGlobsOnce: Once;
    includeGlobs: GoSlice<GoPtr<Glob>>;
    extraFileExtensions: GoSlice<FileExtensionInfo>;
    sourceAndOutputMapsOnce: Once;
    sourceToProjectReference: GoMap<Path, GoPtr<SourceOutputAndProjectReference>>;
    outputDtsToProjectReference: GoMap<Path, GoPtr<SourceOutputAndProjectReference>>;
    commonSourceDirectory: string;
    commonSourceDirectoryOnce: Once;
    resolvedProjectReferencePaths: GoSlice<string>;
    resolvedProjectReferencePathsOnce: Once;
    literalFileNamesLen: int;
    fileNamesByPath: GoMap<Path, string>;
    fileNamesByPathOnce: Once;
    locale: Locale_c4184476;
    localeOnce: Once;
}
export declare function ParsedCommandLine_as_ResolvedProjectReference(receiver: GoPtr<ParsedCommandLine>): ResolvedProjectReference;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::func::NewParsedCommandLine","kind":"func","status":"implemented","sigHash":"e2ad6628087e8f290d41e5f5f436cd8a69367b1abc367852b3a505b582625f26","bodyHash":"bbe71701ed1cddcec4f5743c292fd3704d169beef8a97c6c9c57a97abfc4d118"}
 *
 * Go source:
 * func NewParsedCommandLine(
 * 	compilerOptions *core.CompilerOptions,
 * 	rootFileNames []string,
 * 	comparePathsOptions tspath.ComparePathsOptions,
 * ) *ParsedCommandLine {
 * 	return &ParsedCommandLine{
 * 		ParsedConfig: &core.ParsedOptions{
 * 			CompilerOptions: compilerOptions,
 * 			FileNames:       rootFileNames,
 * 		},
 * 		comparePathsOptions: comparePathsOptions,
 * 	}
 * }
 */
export declare function NewParsedCommandLine(compilerOptions: GoPtr<CompilerOptions_3bab6c7a>, rootFileNames: GoSlice<string>, comparePathsOptions: ComparePathsOptions): GoPtr<ParsedCommandLine>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::type::SourceOutputAndProjectReference","kind":"type","status":"implemented","sigHash":"7f8fc5d25ceb67c4e5f7feaa34d531d9c06bd770fa0088d5342bc87a910e5ea3","bodyHash":"ebd05fc585b95fee3d84cfd551c7ae7c665d7793986935393ff235d5feb8a878"}
 *
 * Go source:
 * SourceOutputAndProjectReference struct {
 * 	Source    string
 * 	OutputDts string
 * 	Resolved  *ParsedCommandLine
 * }
 */
export interface SourceOutputAndProjectReference {
    Source: string;
    OutputDts: string;
    Resolved: GoPtr<ParsedCommandLine>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::varGroup::_+_","kind":"varGroup","status":"implemented","sigHash":"606a448813ea549ca7a41fa67189d5c616eb07aa6693c9028679d4b9a5b43602","bodyHash":"974e7f058db395df81d3bb1307ff74b3321d842476d4fe71eb8ad40133697b9f"}
 *
 * Go source:
 * var (
 * 	_ module.ResolvedProjectReference = (*ParsedCommandLine)(nil)
 * 	_ outputpaths.OutputPathsHost     = (*ParsedCommandLine)(nil)
 * )
 */
export declare const ____696f5a2e_0: ResolvedProjectReference;
export declare const ____696f5a2e_1: OutputPathsHost;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.ConfigName","kind":"method","status":"implemented","sigHash":"ca2a0fcae55a827972ed0dddfca3fe277a8c3dcd47c3a3b8f4f2948d5df7f888","bodyHash":"43a5be1ed884944707ac2970bf30706ed5cb68b46a0a1e52efb7b495ca41229a"}
 *
 * Go source:
 * func (p *ParsedCommandLine) ConfigName() string {
 * 	if p == nil {
 * 		return ""
 * 	}
 * 	return p.ConfigFile.SourceFile.FileName()
 * }
 */
export declare function ParsedCommandLine_ConfigName(receiver: GoPtr<ParsedCommandLine>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.SourceToProjectReference","kind":"method","status":"implemented","sigHash":"ecdbb056ed5d5ba955d429fb6f3c95273a6c04e601ce968b538b59eb4df68e3a","bodyHash":"0ab1591a89e143416d0dd738f51e3c138f906fbfed25f789db79c58db0639b4a"}
 *
 * Go source:
 * func (p *ParsedCommandLine) SourceToProjectReference() map[tspath.Path]*SourceOutputAndProjectReference {
 * 	return p.sourceToProjectReference
 * }
 */
export declare function ParsedCommandLine_SourceToProjectReference(receiver: GoPtr<ParsedCommandLine>): GoMap<Path, GoPtr<SourceOutputAndProjectReference>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.OutputDtsToProjectReference","kind":"method","status":"implemented","sigHash":"fcd34a8f2dc4ddd1e53cf400dbde2906e1e84263755e16d057b509356c30fe52","bodyHash":"0aca1d31fab0493958d177b7d336475166d54d99f47396d4c9f09e9ec410daa5"}
 *
 * Go source:
 * func (p *ParsedCommandLine) OutputDtsToProjectReference() map[tspath.Path]*SourceOutputAndProjectReference {
 * 	return p.outputDtsToProjectReference
 * }
 */
export declare function ParsedCommandLine_OutputDtsToProjectReference(receiver: GoPtr<ParsedCommandLine>): GoMap<Path, GoPtr<SourceOutputAndProjectReference>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.ParseInputOutputNames","kind":"method","status":"implemented","sigHash":"0003c5c0792da437caf0ba7f60ccf1922fc17079d0c75018d6b1606acda38b60","bodyHash":"dfd6988e842901bb957999dc62e613a0a0b21fe4c41e3bd42c5f66105320a988"}
 *
 * Go source:
 * func (p *ParsedCommandLine) ParseInputOutputNames() {
 * 	p.sourceAndOutputMapsOnce.Do(func() {
 * 		sourceToOutput := map[tspath.Path]*SourceOutputAndProjectReference{}
 * 		outputDtsToSource := map[tspath.Path]*SourceOutputAndProjectReference{}
 *
 * 		for outputDts, source := range p.getOutputDeclarationAndSourceFileNames() {
 * 			path := tspath.ToPath(source, p.GetCurrentDirectory(), p.UseCaseSensitiveFileNames())
 * 			projectReference := &SourceOutputAndProjectReference{
 * 				Source:    source,
 * 				OutputDts: outputDts,
 * 				Resolved:  p,
 * 			}
 * 			if outputDts != "" {
 * 				outputDtsToSource[tspath.ToPath(outputDts, p.GetCurrentDirectory(), p.UseCaseSensitiveFileNames())] = projectReference
 * 			}
 * 			sourceToOutput[path] = projectReference
 * 		}
 * 		p.outputDtsToProjectReference = outputDtsToSource
 * 		p.sourceToProjectReference = sourceToOutput
 * 	})
 * }
 */
export declare function ParsedCommandLine_ParseInputOutputNames(receiver: GoPtr<ParsedCommandLine>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.CommonSourceDirectory","kind":"method","status":"implemented","sigHash":"669ab3ad38525146912a93c2dc4b5faeb46eada70af3133171b83a90bafbb6be","bodyHash":"5b6c77d324c9f736964047827b264586544cde233bcab76de6e8900a6f71a19d"}
 *
 * Go source:
 * func (p *ParsedCommandLine) CommonSourceDirectory() string {
 * 	p.commonSourceDirectoryOnce.Do(func() {
 * 		p.commonSourceDirectory = outputpaths.GetCommonSourceDirectory(
 * 			p.ParsedConfig.CompilerOptions,
 * 			func() []string {
 * 				return core.Filter(
 * 					p.ParsedConfig.FileNames,
 * 					func(file string) bool {
 * 						return !(p.ParsedConfig.CompilerOptions.NoEmitForJsFiles.IsTrue() && tspath.HasJSFileExtension(file)) &&
 * 							!tspath.IsDeclarationFileName(file)
 * 					})
 * 			},
 * 			p.GetCurrentDirectory(),
 * 			p.UseCaseSensitiveFileNames(),
 * 			p.checkSourceFilesBelongToPath,
 * 		)
 * 	})
 * 	return p.commonSourceDirectory
 * }
 */
export declare function ParsedCommandLine_CommonSourceDirectory(receiver: GoPtr<ParsedCommandLine>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.checkSourceFilesBelongToPath","kind":"method","status":"implemented","sigHash":"042768a353496b85a2340a1904d959c0cab1b9dd0a07c9745e2b6276abfdabf6","bodyHash":"098684e2c3ff00a2899eb0271d170335c1b315e373b462bef5b8ee60c885033e"}
 *
 * Go source:
 * func (p *ParsedCommandLine) checkSourceFilesBelongToPath(sourceFiles []string, rootDirectory string) bool {
 * 	allFilesBelongToPath := true
 * 	for _, file := range sourceFiles {
 * 		absoluteSourceFilePath := tspath.GetCanonicalFileName(tspath.GetNormalizedAbsolutePath(file, p.GetCurrentDirectory()), p.UseCaseSensitiveFileNames())
 * 		if !tspath.ContainsPath(rootDirectory, file, p.comparePathsOptions) {
 * 			p.Errors = append(p.Errors, ast.NewCompilerDiagnostic(diagnostics.File_0_is_not_under_rootDir_1_rootDir_is_expected_to_contain_all_source_files, absoluteSourceFilePath, rootDirectory))
 * 			allFilesBelongToPath = false
 * 		}
 * 	}
 *
 * 	return allFilesBelongToPath
 * }
 */
export declare function ParsedCommandLine_checkSourceFilesBelongToPath(receiver: GoPtr<ParsedCommandLine>, sourceFiles: GoSlice<string>, rootDirectory: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.GetCurrentDirectory","kind":"method","status":"implemented","sigHash":"23a48d06f7bf69a347808ec471293eaef883415b981f36db02783bda28543704","bodyHash":"17ffd2dae96656e3052871cce30db3964f874e4803d25724200dd328ea82c7ca"}
 *
 * Go source:
 * func (p *ParsedCommandLine) GetCurrentDirectory() string {
 * 	return p.comparePathsOptions.CurrentDirectory
 * }
 */
export declare function ParsedCommandLine_GetCurrentDirectory(receiver: GoPtr<ParsedCommandLine>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.UseCaseSensitiveFileNames","kind":"method","status":"implemented","sigHash":"6b15f84f43bae2a17797d99da9fc7fa0ffdd5f542d00db66bdad5c9b02cc9fc2","bodyHash":"5da209632c1ce24351243d9cf81559467a471e0d8be1873374ed7ede9893bbc3"}
 *
 * Go source:
 * func (p *ParsedCommandLine) UseCaseSensitiveFileNames() bool {
 * 	return p.comparePathsOptions.UseCaseSensitiveFileNames
 * }
 */
export declare function ParsedCommandLine_UseCaseSensitiveFileNames(receiver: GoPtr<ParsedCommandLine>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.getOutputDeclarationAndSourceFileNames","kind":"method","status":"implemented","sigHash":"38d4efcd235f208c538b34c1011ea4a23b815e1f75c64b9f8ffb907bfdfa007d","bodyHash":"43e2e4c2c7ad8e1dbf633d3ec11de526d7051f58d27ded557baaea95263879cd"}
 *
 * Go source:
 * func (p *ParsedCommandLine) getOutputDeclarationAndSourceFileNames() iter.Seq2[string, string] {
 * 	return func(yield func(dtsName string, inputName string) bool) {
 * 		for _, fileName := range p.ParsedConfig.FileNames {
 * 			var outputDts string
 * 			if !tspath.IsDeclarationFileName(fileName) && !tspath.FileExtensionIs(fileName, tspath.ExtensionJson) {
 * 				outputDts = outputpaths.GetOutputDeclarationFileNameWorker(fileName, p.CompilerOptions(), p)
 * 			}
 * 			if !yield(outputDts, fileName) {
 * 				return
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function ParsedCommandLine_getOutputDeclarationAndSourceFileNames(receiver: GoPtr<ParsedCommandLine>): GoSeq2<string, string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.GetOutputFileNames","kind":"method","status":"implemented","sigHash":"46678113bf19e6f2de1954c167664d5a468de83b9b2504158413abaaa2d03d07","bodyHash":"c89dd3050448d872c3178f04ce0d05b7faf9c2b3e31e274fc0ccdaca987fb736"}
 *
 * Go source:
 * func (p *ParsedCommandLine) GetOutputFileNames() iter.Seq[string] {
 * 	return func(yield func(outputName string) bool) {
 * 		for _, fileName := range p.ParsedConfig.FileNames {
 * 			if tspath.IsDeclarationFileName(fileName) {
 * 				continue
 * 			}
 * 			jsFileName := outputpaths.GetOutputJSFileName(fileName, p.CompilerOptions(), p)
 * 			isJson := tspath.FileExtensionIs(fileName, tspath.ExtensionJson)
 * 			if jsFileName != "" {
 * 				if !yield(jsFileName) {
 * 					return
 * 				}
 * 				if !isJson {
 * 					sourceMap := outputpaths.GetSourceMapFilePath(jsFileName, p.CompilerOptions())
 * 					if sourceMap != "" {
 * 						if !yield(sourceMap) {
 * 							return
 * 						}
 * 					}
 * 				}
 * 			}
 * 			if isJson {
 * 				continue
 * 			}
 * 			if p.CompilerOptions().GetEmitDeclarations() {
 * 				dtsFileName := outputpaths.GetOutputDeclarationFileNameWorker(fileName, p.CompilerOptions(), p)
 * 				if dtsFileName != "" {
 * 					if !yield(dtsFileName) {
 * 						return
 * 					}
 * 					if p.CompilerOptions().GetAreDeclarationMapsEnabled() {
 * 						declarationMap := dtsFileName + ".map"
 * 						if !yield(declarationMap) {
 * 							return
 * 						}
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function ParsedCommandLine_GetOutputFileNames(receiver: GoPtr<ParsedCommandLine>): GoSeq<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.GetBuildInfoFileName","kind":"method","status":"implemented","sigHash":"ca5c12d827fbdeedec8fcbee0729d47e2940e10e538ae1882efd33c33492fd7c","bodyHash":"f91a7366e7fc3473766fa9b8f6ed1aae1519d116a9e21c9f35202e1540288250"}
 *
 * Go source:
 * func (p *ParsedCommandLine) GetBuildInfoFileName() string {
 * 	return outputpaths.GetBuildInfoFileName(p.CompilerOptions(), p.comparePathsOptions)
 * }
 */
export declare function ParsedCommandLine_GetBuildInfoFileName(receiver: GoPtr<ParsedCommandLine>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.WildcardDirectories","kind":"method","status":"implemented","sigHash":"bcc1c5e97bbf7b5d49ecc7493fe1f4b2f27c4bbb57e81902f6790d5471cdd1ab","bodyHash":"4a2dfaabebe0d72942b6c076e77edcc9e353f283dbbcddd1302a332e62b6a4d9"}
 *
 * Go source:
 * func (p *ParsedCommandLine) WildcardDirectories() map[string]bool {
 * 	if p == nil {
 * 		return nil
 * 	}
 *
 * 	p.wildcardDirectoriesOnce.Do(func() {
 * 		if p.wildcardDirectories == nil {
 * 			p.wildcardDirectories = getWildcardDirectories(
 * 				p.ConfigFile.configFileSpecs.validatedIncludeSpecs,
 * 				p.ConfigFile.configFileSpecs.validatedExcludeSpecs,
 * 				p.comparePathsOptions,
 * 			)
 * 		}
 * 	})
 *
 * 	return p.wildcardDirectories
 * }
 */
export declare function ParsedCommandLine_WildcardDirectories(receiver: GoPtr<ParsedCommandLine>): GoMap<string, bool>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.WildcardDirectoryGlobs","kind":"method","status":"implemented","sigHash":"1be2dbed8713724274bb32172adcfc849b383b422e2bfc74f277deb2f8022f54","bodyHash":"b11e77671b3dd0dbfced600c7a68b9f9747fb0dcd498341c5b2495006320f7ac"}
 *
 * Go source:
 * func (p *ParsedCommandLine) WildcardDirectoryGlobs() []*glob.Glob {
 * 	wildcardDirectories := p.WildcardDirectories()
 * 	if wildcardDirectories == nil {
 * 		return nil
 * 	}
 *
 * 	p.includeGlobsOnce.Do(func() {
 * 		if p.includeGlobs == nil {
 * 			globs := make([]*glob.Glob, 0, len(wildcardDirectories))
 * 			for dir, recursive := range wildcardDirectories {
 * 				if parsed, err := glob.Parse(fmt.Sprintf("%s/%s", tspath.NormalizePath(dir), core.IfElse(recursive, recursiveFileGlobPattern, fileGlobPattern))); err == nil {
 * 					globs = append(globs, parsed)
 * 				}
 * 			}
 * 			p.includeGlobs = globs
 * 		}
 * 	})
 *
 * 	return p.includeGlobs
 * }
 */
export declare function ParsedCommandLine_WildcardDirectoryGlobs(receiver: GoPtr<ParsedCommandLine>): GoSlice<GoPtr<Glob>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.LiteralFileNames","kind":"method","status":"implemented","sigHash":"e347d7ea24e70da0991ac1020e89a93c637387cd6b35be1ee245d0e36676d864","bodyHash":"757344cb1faade711ab1221dfb2a119b9182f6bc17efdd38dc0d812eff45a215"}
 *
 * Go source:
 * func (p *ParsedCommandLine) LiteralFileNames() []string {
 * 	if p != nil && p.ConfigFile != nil {
 * 		return p.FileNames()[0:p.literalFileNamesLen]
 * 	}
 * 	return nil
 * }
 */
export declare function ParsedCommandLine_LiteralFileNames(receiver: GoPtr<ParsedCommandLine>): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.SetParsedOptions","kind":"method","status":"implemented","sigHash":"690c688d5b49a297fec3deeccfcb2fae21cba44a8984d7244efc4a4ef545e3ab","bodyHash":"c8c09f1c5559c25cef8b13cf88ff08875fd316619d70531e30ca581b97d2d190"}
 *
 * Go source:
 * func (p *ParsedCommandLine) SetParsedOptions(o *core.ParsedOptions) {
 * 	p.ParsedConfig = o
 * }
 */
export declare function ParsedCommandLine_SetParsedOptions(receiver: GoPtr<ParsedCommandLine>, o: GoPtr<ParsedOptions>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.SetCompilerOptions","kind":"method","status":"implemented","sigHash":"6697753b7c21e56874b159d0985dc2b2aa2e391c73b2cc48bd6e18f26c41e5f6","bodyHash":"f127af8ceb1dc9fdab90f9e7aad417ce2635caea8c26b92cd11156c998a7978d"}
 *
 * Go source:
 * func (p *ParsedCommandLine) SetCompilerOptions(o *core.CompilerOptions) {
 * 	p.ParsedConfig.CompilerOptions = o
 * }
 */
export declare function ParsedCommandLine_SetCompilerOptions(receiver: GoPtr<ParsedCommandLine>, o: GoPtr<CompilerOptions_3bab6c7a>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.CompilerOptions","kind":"method","status":"implemented","sigHash":"417a91bda330dfb31d1bc826fb335c56eedcfdd1d30db8342d87b86f7ef18683","bodyHash":"32ed5e757d08e4139b495407faf30768cb327b63d42dda3c8f7d8623814e8b47"}
 *
 * Go source:
 * func (p *ParsedCommandLine) CompilerOptions() *core.CompilerOptions {
 * 	if p == nil {
 * 		return nil
 * 	}
 * 	return p.ParsedConfig.CompilerOptions
 * }
 */
export declare function ParsedCommandLine_CompilerOptions(receiver: GoPtr<ParsedCommandLine>): GoPtr<CompilerOptions_3bab6c7a>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.SetTypeAcquisition","kind":"method","status":"implemented","sigHash":"a7b3f9565336ce873945d65ef384934fa3a0aa06304153e3d098adb1a959835a","bodyHash":"828f145787cd2505b3a2d7cff4cbae3939d9af707dc6377c43bc1c65d8722ff7"}
 *
 * Go source:
 * func (p *ParsedCommandLine) SetTypeAcquisition(o *core.TypeAcquisition) {
 * 	p.ParsedConfig.TypeAcquisition = o
 * }
 */
export declare function ParsedCommandLine_SetTypeAcquisition(receiver: GoPtr<ParsedCommandLine>, o: GoPtr<TypeAcquisition_0a5bf39c>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.TypeAcquisition","kind":"method","status":"implemented","sigHash":"c190161054ed9e1d473f81e5ab8478cb10fa3a6d94e213f1c0a5c89f0c7ea7b4","bodyHash":"b729c43b81624ddcf60c9e606accb314aae7be6bae7219a82af66af35c663dfe"}
 *
 * Go source:
 * func (p *ParsedCommandLine) TypeAcquisition() *core.TypeAcquisition {
 * 	return p.ParsedConfig.TypeAcquisition
 * }
 */
export declare function ParsedCommandLine_TypeAcquisition(receiver: GoPtr<ParsedCommandLine>): GoPtr<TypeAcquisition_0a5bf39c>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.FileNames","kind":"method","status":"implemented","sigHash":"cd9d32c7052438a002442ec1bff08098a440b4deb99693869e1bd4de3ae2260d","bodyHash":"fd2be573ea2bb17804eee7b17f2615d092e7dcffdfd247980f1bf3e7bd4cdd07"}
 *
 * Go source:
 * func (p *ParsedCommandLine) FileNames() []string {
 * 	return p.ParsedConfig.FileNames
 * }
 */
export declare function ParsedCommandLine_FileNames(receiver: GoPtr<ParsedCommandLine>): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.FileNamesByPath","kind":"method","status":"implemented","sigHash":"9a76b8dcaadf96585d7f6aa7520ec82e6ab3a5d9bcf046c87e1bb3d037353888","bodyHash":"21df496764de8dad6d98419b572f3877d2cce0eb8c45b6b40592c10f3d5b951a"}
 *
 * Go source:
 * func (p *ParsedCommandLine) FileNamesByPath() map[tspath.Path]string {
 * 	p.fileNamesByPathOnce.Do(func() {
 * 		p.fileNamesByPath = make(map[tspath.Path]string, len(p.ParsedConfig.FileNames))
 * 		for _, fileName := range p.ParsedConfig.FileNames {
 * 			path := tspath.ToPath(fileName, p.GetCurrentDirectory(), p.UseCaseSensitiveFileNames())
 * 			p.fileNamesByPath[path] = fileName
 * 		}
 * 	})
 * 	return p.fileNamesByPath
 * }
 */
export declare function ParsedCommandLine_FileNamesByPath(receiver: GoPtr<ParsedCommandLine>): GoMap<Path, string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.ProjectReferences","kind":"method","status":"implemented","sigHash":"85e5f6555979046b68c5ffd49930da400decb0b2e8a6effa12ab1fcb7d50d6f4","bodyHash":"cd6b82480ff0b86b8e26408245f975389cbe3862da19377ada647f9bf87c5228"}
 *
 * Go source:
 * func (p *ParsedCommandLine) ProjectReferences() []*core.ProjectReference {
 * 	return p.ParsedConfig.ProjectReferences
 * }
 */
export declare function ParsedCommandLine_ProjectReferences(receiver: GoPtr<ParsedCommandLine>): GoSlice<GoPtr<ProjectReference>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.ResolvedProjectReferencePaths","kind":"method","status":"implemented","sigHash":"d9e61e3291d6c7371e74b3a3a71502db5b6455d2577c15a0a38158e258c474bb","bodyHash":"f3399e750491db61b5231f767b834ec9f2a6ed0698ddb9437b5c064ebf8b9f9b"}
 *
 * Go source:
 * func (p *ParsedCommandLine) ResolvedProjectReferencePaths() []string {
 * 	p.resolvedProjectReferencePathsOnce.Do(func() {
 * 		p.resolvedProjectReferencePaths = core.Map(p.ParsedConfig.ProjectReferences, core.ResolveProjectReferencePath)
 * 	})
 * 	return p.resolvedProjectReferencePaths
 * }
 */
export declare function ParsedCommandLine_ResolvedProjectReferencePaths(receiver: GoPtr<ParsedCommandLine>): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.ExtendedSourceFiles","kind":"method","status":"implemented","sigHash":"0c71cd2559d25efd7fa5a46d4a21883cf9c43ec8969590561b87f2b2741b1a51","bodyHash":"0dc149ee1051af95aba5e8626c97d5695c924c20b291c25b7adc0b2053312f34"}
 *
 * Go source:
 * func (p *ParsedCommandLine) ExtendedSourceFiles() []string {
 * 	if p == nil || p.ConfigFile == nil {
 * 		return nil
 * 	}
 * 	return p.ConfigFile.ExtendedSourceFiles
 * }
 */
export declare function ParsedCommandLine_ExtendedSourceFiles(receiver: GoPtr<ParsedCommandLine>): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.GetConfigFileParsingDiagnostics","kind":"method","status":"implemented","sigHash":"eb4d9e6d8a688a330c9f9b3d9a53786e7e8d515a5128bb5174e7a1c83b921773","bodyHash":"c487ecce00b52ae58ea096f996780bf3677a3b0bf91245e95d34dfcbc14d195b"}
 *
 * Go source:
 * func (p *ParsedCommandLine) GetConfigFileParsingDiagnostics() []*ast.Diagnostic {
 * 	if p.ConfigFile != nil {
 * 		// todo: !!! should be ConfigFile.ParseDiagnostics, check if they are the same
 * 		return slices.Concat(p.ConfigFile.SourceFile.Diagnostics(), p.Errors)
 * 	}
 * 	return p.Errors
 * }
 */
export declare function ParsedCommandLine_GetConfigFileParsingDiagnostics(receiver: GoPtr<ParsedCommandLine>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.PossiblyMatchesFileName","kind":"method","status":"implemented","sigHash":"30f6e2c36d1ba5f2b9a620ba4cc4808ecb764b6c45f2bf9b7d31f1b93479b970","bodyHash":"dc72c1ff9fe91bb75618bed7206f933c7e4d051e9a321b6acf3f985fd84e5eac"}
 *
 * Go source:
 * func (p *ParsedCommandLine) PossiblyMatchesFileName(fileName string) bool {
 * 	path := tspath.ToPath(fileName, p.GetCurrentDirectory(), p.UseCaseSensitiveFileNames())
 * 	if _, ok := p.FileNamesByPath()[path]; ok {
 * 		return true
 * 	}
 *
 * 	for _, include := range p.ConfigFile.configFileSpecs.validatedIncludeSpecs {
 * 		if !strings.ContainsAny(include, "*?") && !vfsmatch.IsImplicitGlob(include) {
 * 			includePath := tspath.ToPath(include, p.GetCurrentDirectory(), p.UseCaseSensitiveFileNames())
 * 			if includePath == path {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	if wildcardDirectoryGlobs := p.WildcardDirectoryGlobs(); len(wildcardDirectoryGlobs) > 0 {
 * 		for _, glob := range wildcardDirectoryGlobs {
 * 			if glob.Match(fileName) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function ParsedCommandLine_PossiblyMatchesFileName(receiver: GoPtr<ParsedCommandLine>, fileName: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.PossiblyMatchesDirectoryName","kind":"method","status":"implemented","sigHash":"a9bb21b73145249e122e4516885a5b9f7b02147cff6544059ce137a8f93e9332","bodyHash":"de950edc22547be9150ce347d528ebb50881663d126f32a37cc7dfb09331c8fa"}
 *
 * Go source:
 * func (p *ParsedCommandLine) PossiblyMatchesDirectoryName(directoryPath tspath.Path) bool {
 * 	for wildcardDir, recursive := range p.WildcardDirectories() {
 * 		wildcardDirPath := tspath.ToPath(wildcardDir, p.GetCurrentDirectory(), p.UseCaseSensitiveFileNames())
 * 		if recursive {
 * 			if wildcardDirPath.ContainsPath(directoryPath) {
 * 				return true
 * 			}
 * 		} else {
 * 			if wildcardDirPath == directoryPath {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function ParsedCommandLine_PossiblyMatchesDirectoryName(receiver: GoPtr<ParsedCommandLine>, directoryPath: Path): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.GetMatchedFileSpec","kind":"method","status":"implemented","sigHash":"ad59179912240328819dcd8efac08d61cfe6efc3fffa10fed54ed4861e6230c3","bodyHash":"99c908e8a717ac6ab2138d56d1a3ee60efbaf35094f96984ebb6c1b87673f70d"}
 *
 * Go source:
 * func (p *ParsedCommandLine) GetMatchedFileSpec(fileName string) string {
 * 	return p.ConfigFile.configFileSpecs.getMatchedFileSpec(fileName, p.comparePathsOptions)
 * }
 */
export declare function ParsedCommandLine_GetMatchedFileSpec(receiver: GoPtr<ParsedCommandLine>, fileName: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.GetMatchedIncludeSpec","kind":"method","status":"implemented","sigHash":"cc80e60c9e244cfaa255bc90eec3f7f9df26d523f01d66cdb9dab97750982faa","bodyHash":"4efe233f7ffe0c982aa7af3484b47a497ecc706e8162201ce93db86dc2aea03d"}
 *
 * Go source:
 * func (p *ParsedCommandLine) GetMatchedIncludeSpec(fileName string) (string, bool) {
 * 	if len(p.ConfigFile.configFileSpecs.validatedIncludeSpecs) == 0 {
 * 		return "", false
 * 	}
 *
 * 	if p.ConfigFile.configFileSpecs.isDefaultIncludeSpec {
 * 		return p.ConfigFile.configFileSpecs.validatedIncludeSpecs[0], true
 * 	}
 *
 * 	return p.ConfigFile.configFileSpecs.getMatchedIncludeSpec(fileName, p.comparePathsOptions), false
 * }
 */
export declare function ParsedCommandLine_GetMatchedIncludeSpec(receiver: GoPtr<ParsedCommandLine>, fileName: string): [string, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.ReloadFileNamesOfParsedCommandLine","kind":"method","status":"implemented","sigHash":"80efa087e2c5c84dac298c6291809eb6e0e34c4ac9065362bcd98b4cdc685224","bodyHash":"98c333f675ad73057e9ca845c1f05578d94cc82f2042fa9fd106ffeee2ecfa38"}
 *
 * Go source:
 * func (p *ParsedCommandLine) ReloadFileNamesOfParsedCommandLine(fs vfs.FS) *ParsedCommandLine {
 * 	parsedConfig := *p.ParsedConfig
 * 	fileNames, literalFileNamesLen := getFileNamesFromConfigSpecs(
 * 		*p.ConfigFile.configFileSpecs,
 * 		p.GetCurrentDirectory(),
 * 		p.CompilerOptions(),
 * 		fs,
 * 		p.extraFileExtensions,
 * 	)
 * 	parsedConfig.FileNames = fileNames
 * 	parsedCommandLine := ParsedCommandLine{
 * 		ParsedConfig:        &parsedConfig,
 * 		ConfigFile:          p.ConfigFile,
 * 		Errors:              p.Errors,
 * 		Raw:                 p.Raw,
 * 		CompileOnSave:       p.CompileOnSave,
 * 		comparePathsOptions: p.comparePathsOptions,
 * 		wildcardDirectories: p.wildcardDirectories,
 * 		includeGlobs:        p.includeGlobs,
 * 		extraFileExtensions: p.extraFileExtensions,
 * 		literalFileNamesLen: literalFileNamesLen,
 * 	}
 * 	return &parsedCommandLine
 * }
 */
export declare function ParsedCommandLine_ReloadFileNamesOfParsedCommandLine(receiver: GoPtr<ParsedCommandLine>, fs: FS): GoPtr<ParsedCommandLine>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedcommandline.go::method::ParsedCommandLine.Locale","kind":"method","status":"implemented","sigHash":"235a88370a730c41aa6bbab60e8ecb7bd8f09ed50da16d6877ae0fdaa5d5f739","bodyHash":"434e6e97453431632d655438c511107367e0d716010ee37adf5c879130d358cb"}
 *
 * Go source:
 * func (p *ParsedCommandLine) Locale() locale.Locale {
 * 	p.localeOnce.Do(func() {
 * 		p.locale, _ = locale.Parse(p.CompilerOptions().Locale)
 * 	})
 * 	return p.locale
 * }
 */
export declare function ParsedCommandLine_Locale(receiver: GoPtr<ParsedCommandLine>): Locale_c4184476;
//# sourceMappingURL=parsedcommandline.d.ts.map