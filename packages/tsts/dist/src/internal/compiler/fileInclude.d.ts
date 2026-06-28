import type { bool, int } from "../../go/scalars.js";
import type { GoPtr } from "../../go/compat.js";
import type { Once } from "../../go/sync.js";
import type { FileReference, Node, SourceFile } from "../ast/ast.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import type { Message } from "../diagnostics/diagnostics.js";
import type { PackageId } from "../module/types.js";
import type { Path } from "../tspath/path.js";
import type { Program } from "./program.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::type::fileIncludeKind","kind":"type","status":"implemented","sigHash":"cfb5545dcc9725e07bdb601f934351c61a7de840776fd29fa357e094c1be7445","bodyHash":"6e1f1cdd7041c475e136b50ecf3fbc5d1666cc360df8db6a221b153123b1562f"}
 *
 * Go source:
 * fileIncludeKind int
 */
export type fileIncludeKind = int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::constGroup::fileIncludeKindImport+fileIncludeKindReferenceFile+fileIncludeKindTypeReferenceDirective+fileIncludeKindLibReferenceDirective+fileIncludeKindRootFile+fileIncludeKindLibFile+fileIncludeKindAutomaticTypeDirectiveFile","kind":"constGroup","status":"implemented","sigHash":"7d1710af5e33fd143d2f2f5f005731d694f260c677b41d68998348ebad1f7464","bodyHash":"039d152a16601afd318ff8496e2aedc9943c45ec7acc0e5fc391d83abf4c6a9e"}
 *
 * Go source:
 * const (
 * 	// References from file
 * 	fileIncludeKindImport = iota
 * 	fileIncludeKindReferenceFile
 * 	fileIncludeKindTypeReferenceDirective
 * 	fileIncludeKindLibReferenceDirective
 *
 * 	fileIncludeKindRootFile
 * 	fileIncludeKindLibFile
 * 	fileIncludeKindAutomaticTypeDirectiveFile
 * )
 */
export declare const fileIncludeKindImport: int;
export declare const fileIncludeKindReferenceFile: int;
export declare const fileIncludeKindTypeReferenceDirective: int;
export declare const fileIncludeKindLibReferenceDirective: int;
export declare const fileIncludeKindRootFile: int;
export declare const fileIncludeKindLibFile: int;
export declare const fileIncludeKindAutomaticTypeDirectiveFile: int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::type::FileIncludeReason","kind":"type","status":"implemented","sigHash":"66267829e8a4641b7a13737e2b69f20416189d54e74f87770c9012ba349a5d2e","bodyHash":"92642221a5fbe5826f6053046129d96398a40fc552098e55eb5be475f3a18cb9"}
 *
 * Go source:
 * FileIncludeReason struct {
 * 	kind fileIncludeKind
 * 	data any
 *
 * 	// Uses relative file name
 * 	relativeFileNameDiag     *ast.Diagnostic
 * 	relativeFileNameDiagOnce sync.Once
 *
 * 	// Uses file name as is
 * 	diag     *ast.Diagnostic
 * 	diagOnce sync.Once
 * }
 */
export interface FileIncludeReason {
    kind: fileIncludeKind;
    data: unknown;
    relativeFileNameDiag: GoPtr<Diagnostic>;
    relativeFileNameDiagOnce: Once;
    diag: GoPtr<Diagnostic>;
    diagOnce: Once;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::type::referencedFileData","kind":"type","status":"implemented","sigHash":"778e4ce0bc0e4cfaf8399aacec9e4fd35023bb53fb1e138517fe73a83a24db14","bodyHash":"29a94ead1f5309a5e04c01eccf4068564bab0bf8d297f749d849a6caab05e9e2"}
 *
 * Go source:
 * referencedFileData struct {
 * 	file      tspath.Path
 * 	index     int
 * 	synthetic *ast.Node
 * }
 */
export interface referencedFileData {
    file: Path;
    index: int;
    synthetic: GoPtr<Node>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::type::referenceFileLocation","kind":"type","status":"implemented","sigHash":"585b5de7c50e4449030bccb1039827aaee2ff64b843c05468133d54c73180022","bodyHash":"59d2f45914c719478a0a6472a2987af8d94b018eeca8e762f32e5bf184a4f227"}
 *
 * Go source:
 * referenceFileLocation struct {
 * 	file        *ast.SourceFile
 * 	node        *ast.Node
 * 	ref         *ast.FileReference
 * 	packageId   module.PackageId
 * 	isSynthetic bool
 * }
 */
export interface referenceFileLocation {
    file: GoPtr<SourceFile>;
    node: GoPtr<Node>;
    ref: GoPtr<FileReference>;
    packageId: PackageId;
    isSynthetic: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::method::referenceFileLocation.text","kind":"method","status":"implemented","sigHash":"9ef4ff384923f9e74a0ef4cf12fab1e114a55d56508f6fe3d90e59350768c334","bodyHash":"fce5033fc547d8f6bb50ec1c8e9aa839439df238bb8b503c55288515ed1daa05"}
 *
 * Go source:
 * func (r *referenceFileLocation) text() string {
 * 	if r.node != nil {
 * 		if !ast.NodeIsSynthesized(r.node) {
 * 			return r.file.Text()[scanner.SkipTrivia(r.file.Text(), r.node.Loc.Pos()):r.node.End()]
 * 		} else {
 * 			return fmt.Sprintf(`"%s"`, r.node.Text())
 * 		}
 * 	} else {
 * 		return r.file.Text()[r.ref.Pos():r.ref.End()]
 * 	}
 * }
 */
export declare function referenceFileLocation_text(receiver: GoPtr<referenceFileLocation>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::method::referenceFileLocation.diagnosticAt","kind":"method","status":"implemented","sigHash":"a8be564aa02906018cf3fa3970e8789be0fa044fe9997d7369a6b9cd8e1b0d17","bodyHash":"2b7a33fc4f09a3af5ade5537d41c5040a3b51c2c6e501f22ec0c5b90d69fe63c"}
 *
 * Go source:
 * func (r *referenceFileLocation) diagnosticAt(message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 	if r.node != nil {
 * 		return tsoptions.CreateDiagnosticForNodeInSourceFile(r.file, r.node, message, args...)
 * 	} else {
 * 		return ast.NewDiagnostic(r.file, r.ref.TextRange, message, args...)
 * 	}
 * }
 */
export declare function referenceFileLocation_diagnosticAt(receiver: GoPtr<referenceFileLocation>, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::type::automaticTypeDirectiveFileData","kind":"type","status":"implemented","sigHash":"25f491139d4af9f030687b293eef06c353e219be6e7d5da11dbf9541926694ad","bodyHash":"3e7ed9a538e66579c992c99233e35edf2df2c657e576c34dfd179466fd9efbdb"}
 *
 * Go source:
 * automaticTypeDirectiveFileData struct {
 * 	typeReference string
 * 	packageId     module.PackageId
 * }
 */
export interface automaticTypeDirectiveFileData {
    typeReference: string;
    packageId: PackageId;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::method::FileIncludeReason.asIndex","kind":"method","status":"implemented","sigHash":"34ac85d2f55ec04e25e52bc561393d2fab978f412ca2d8a583ea4d9fcc66a7d5","bodyHash":"02f7d1d8b4142bbbf121df7bc7a8798387bbffc68de9b20fdcdf4810acaa4d1b"}
 *
 * Go source:
 * func (r *FileIncludeReason) asIndex() int {
 * 	return r.data.(int)
 * }
 */
export declare function FileIncludeReason_asIndex(receiver: GoPtr<FileIncludeReason>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::method::FileIncludeReason.asLibFileIndex","kind":"method","status":"implemented","sigHash":"82725396ff49c519b0ef41a73c386a601c5b4ab3db290f79d6380d3cdeb9897f","bodyHash":"b63ecd7d547a7ad7b3912dc0a392870b7fb2d2ff6afb22eaa657111ad76b9461"}
 *
 * Go source:
 * func (r *FileIncludeReason) asLibFileIndex() (int, bool) {
 * 	index, ok := r.data.(int)
 * 	return index, ok
 * }
 */
export declare function FileIncludeReason_asLibFileIndex(receiver: GoPtr<FileIncludeReason>): [int, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::method::FileIncludeReason.isReferencedFile","kind":"method","status":"implemented","sigHash":"702bc3aa0bb6eb0c1eec2b2d772ba17bfa16bff87059451b4614bdc58c3e9255","bodyHash":"572e99b9057b9bdc80facf58f0eba9ee3a21f654cea5356f99550f6ee690161c"}
 *
 * Go source:
 * func (r *FileIncludeReason) isReferencedFile() bool {
 * 	return r != nil && r.kind <= fileIncludeKindLibReferenceDirective
 * }
 */
export declare function FileIncludeReason_isReferencedFile(receiver: GoPtr<FileIncludeReason>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::method::FileIncludeReason.asReferencedFileData","kind":"method","status":"implemented","sigHash":"fdf614f2becee0cdf5b4577d2e97a54604d45a7b15c54c355653e2843227b204","bodyHash":"937f34da40bacdd2f2466a6f6255107581b3c433d8191692029c71fe772bd7ad"}
 *
 * Go source:
 * func (r *FileIncludeReason) asReferencedFileData() *referencedFileData {
 * 	return r.data.(*referencedFileData)
 * }
 */
export declare function FileIncludeReason_asReferencedFileData(receiver: GoPtr<FileIncludeReason>): GoPtr<referencedFileData>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::method::FileIncludeReason.asAutomaticTypeDirectiveFileData","kind":"method","status":"implemented","sigHash":"6df84471a52aed2ff369d3893dbcde620102d59b0435c6c183b470742eec1067","bodyHash":"9d2f5e3eb9e95e7751677281bdc08e323bb3b65bde5c8e0299b97fa191a6e151"}
 *
 * Go source:
 * func (r *FileIncludeReason) asAutomaticTypeDirectiveFileData() *automaticTypeDirectiveFileData {
 * 	return r.data.(*automaticTypeDirectiveFileData)
 * }
 */
export declare function FileIncludeReason_asAutomaticTypeDirectiveFileData(receiver: GoPtr<FileIncludeReason>): GoPtr<automaticTypeDirectiveFileData>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::method::FileIncludeReason.getReferencedLocation","kind":"method","status":"implemented","sigHash":"a1bbb5f03e34f655c9ba1dbd04e423d6b56c77cb6ee9c9f6644b6c131481a413","bodyHash":"251df44fc8c92547ec0a88996bcd346a458071aa948087ebc8514c2262407b2e"}
 *
 * Go source:
 * func (r *FileIncludeReason) getReferencedLocation(program *Program) *referenceFileLocation {
 * 	ref := r.asReferencedFileData()
 * 	file := program.GetSourceFileByPath(ref.file)
 * 	switch r.kind {
 * 	case fileIncludeKindImport:
 * 		var specifier *ast.Node
 * 		var isSynthetic bool
 * 		if ref.synthetic != nil {
 * 			specifier = ref.synthetic
 * 			isSynthetic = true
 * 		} else if ref.index < len(file.Imports()) {
 * 			specifier = file.Imports()[ref.index]
 * 		} else {
 * 			augIndex := len(file.Imports())
 * 			for _, imp := range file.ModuleAugmentations {
 * 				if imp.Kind == ast.KindStringLiteral {
 * 					if augIndex == ref.index {
 * 						specifier = imp
 * 						break
 * 					}
 * 					augIndex++
 * 				}
 * 			}
 * 		}
 * 		resolution := program.GetResolvedModuleFromModuleSpecifier(file, specifier)
 * 		return &referenceFileLocation{
 * 			file:        file,
 * 			node:        specifier,
 * 			packageId:   resolution.PackageId,
 * 			isSynthetic: isSynthetic,
 * 		}
 * 	case fileIncludeKindReferenceFile:
 * 		return &referenceFileLocation{
 * 			file: file,
 * 			ref:  file.ReferencedFiles[ref.index],
 * 		}
 * 	case fileIncludeKindTypeReferenceDirective:
 * 		return &referenceFileLocation{
 * 			file: file,
 * 			ref:  file.TypeReferenceDirectives[ref.index],
 * 		}
 * 	case fileIncludeKindLibReferenceDirective:
 * 		return &referenceFileLocation{
 * 			file: file,
 * 			ref:  file.LibReferenceDirectives[ref.index],
 * 		}
 * 	default:
 * 		panic(fmt.Sprintf("unknown reason: %v", r.kind))
 * 	}
 * }
 */
export declare function FileIncludeReason_getReferencedLocation(receiver: GoPtr<FileIncludeReason>, program: GoPtr<Program>): GoPtr<referenceFileLocation>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::method::FileIncludeReason.toDiagnostic","kind":"method","status":"implemented","sigHash":"7d767d9cf7a2baeb62dc6af891985dcdbc4250d4b5cc2a9d49f56258b9031d2c","bodyHash":"c9b92d264342b34c0103852b98e102ebbff84d6fa585f44605b909faa6c94033"}
 *
 * Go source:
 * func (r *FileIncludeReason) toDiagnostic(program *Program, relativeFileName bool) *ast.Diagnostic {
 * 	if relativeFileName {
 * 		r.relativeFileNameDiagOnce.Do(func() {
 * 			r.relativeFileNameDiag = r.computeDiagnostic(program, func(fileName string) string {
 * 				return tspath.GetRelativePathFromDirectory(program.GetCurrentDirectory(), fileName, program.comparePathsOptions)
 * 			})
 * 		})
 * 		return r.relativeFileNameDiag
 * 	} else {
 * 		r.diagOnce.Do(func() {
 * 			r.diag = r.computeDiagnostic(program, func(fileName string) string { return fileName })
 * 		})
 * 		return r.diag
 * 	}
 * }
 */
export declare function FileIncludeReason_toDiagnostic(receiver: GoPtr<FileIncludeReason>, program: GoPtr<Program>, relativeFileName: bool): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::method::FileIncludeReason.computeDiagnostic","kind":"method","status":"implemented","sigHash":"382979fd328e216d0766a75cb0b8d593702df7cc389287c31ea140633f3897d9","bodyHash":"10f672d1ef5933bc2492cdaae5fb7b3b9b4071d127cc1a692720f4db6bde5284"}
 *
 * Go source:
 * func (r *FileIncludeReason) computeDiagnostic(program *Program, toFileName func(string) string) *ast.Diagnostic {
 * 	if r.isReferencedFile() {
 * 		return r.computeReferenceFileDiagnostic(program, toFileName)
 * 	}
 * 	switch r.kind {
 * 	case fileIncludeKindRootFile:
 * 		if program.opts.Config.ConfigFile != nil {
 * 			config := program.opts.Config
 * 			fileName := tspath.GetNormalizedAbsolutePath(config.FileNames()[r.asIndex()], program.GetCurrentDirectory())
 * 			if matchedFileSpec := config.GetMatchedFileSpec(fileName); matchedFileSpec != "" {
 * 				return ast.NewCompilerDiagnostic(diagnostics.Part_of_files_list_in_tsconfig_json, matchedFileSpec, toFileName(fileName))
 * 			} else if matchedIncludeSpec, isDefaultIncludeSpec := config.GetMatchedIncludeSpec(fileName); matchedIncludeSpec != "" {
 * 				if isDefaultIncludeSpec {
 * 					return ast.NewCompilerDiagnostic(diagnostics.Matched_by_default_include_pattern_Asterisk_Asterisk_Slash_Asterisk)
 * 				} else {
 * 					return ast.NewCompilerDiagnostic(diagnostics.Matched_by_include_pattern_0_in_1, matchedIncludeSpec, toFileName(config.ConfigName()))
 * 				}
 * 			} else {
 * 				return ast.NewCompilerDiagnostic(diagnostics.Root_file_specified_for_compilation)
 * 			}
 * 		} else {
 * 			return ast.NewCompilerDiagnostic(diagnostics.Root_file_specified_for_compilation)
 * 		}
 * 	case fileIncludeKindAutomaticTypeDirectiveFile:
 * 		data := r.asAutomaticTypeDirectiveFileData()
 * 		if !program.Options().UsesWildcardTypes() {
 * 			if data.packageId.Name != "" {
 * 				return ast.NewCompilerDiagnostic(diagnostics.Entry_point_of_type_library_0_specified_in_compilerOptions_with_packageId_1, data.typeReference, data.packageId.String())
 * 			} else {
 * 				return ast.NewCompilerDiagnostic(diagnostics.Entry_point_of_type_library_0_specified_in_compilerOptions, data.typeReference)
 * 			}
 * 		} else {
 * 			if data.packageId.Name != "" {
 * 				return ast.NewCompilerDiagnostic(diagnostics.Entry_point_for_implicit_type_library_0_with_packageId_1, data.typeReference, data.packageId.String())
 * 			} else {
 * 				return ast.NewCompilerDiagnostic(diagnostics.Entry_point_for_implicit_type_library_0, data.typeReference)
 * 			}
 * 		}
 * 	case fileIncludeKindLibFile:
 * 		if index, ok := r.asLibFileIndex(); ok {
 * 			return ast.NewCompilerDiagnostic(diagnostics.Library_0_specified_in_compilerOptions, program.Options().Lib[index])
 * 		} else if target := program.Options().GetEmitScriptTarget().String(); target != "" {
 * 			return ast.NewCompilerDiagnostic(diagnostics.Default_library_for_target_0, target)
 * 		} else {
 * 			return ast.NewCompilerDiagnostic(diagnostics.Default_library)
 * 		}
 * 	default:
 * 		panic(fmt.Sprintf("unknown reason: %v", r.kind))
 * 	}
 * }
 */
export declare function FileIncludeReason_computeDiagnostic(receiver: GoPtr<FileIncludeReason>, program: GoPtr<Program>, toFileName: (arg0: string) => string): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::method::FileIncludeReason.computeReferenceFileDiagnostic","kind":"method","status":"implemented","sigHash":"7be349ed3d73a7680cdff7031c7a9d0d079a0139be502a4ab7baac063da7e199","bodyHash":"9e2d6fdb618829e9b01f1dcf860b5fbaa1a8b366a5d319e7dfa730e5699a5473"}
 *
 * Go source:
 * func (r *FileIncludeReason) computeReferenceFileDiagnostic(program *Program, toFileName func(string) string) *ast.Diagnostic {
 * 	referenceLocation := program.includeProcessor.getReferenceLocation(r, program)
 * 	referenceText := referenceLocation.text()
 * 	switch r.kind {
 * 	case fileIncludeKindImport:
 * 		if !referenceLocation.isSynthetic {
 * 			if referenceLocation.packageId.Name != "" {
 * 				return ast.NewCompilerDiagnostic(diagnostics.Imported_via_0_from_file_1_with_packageId_2, referenceText, toFileName(referenceLocation.file.FileName()), referenceLocation.packageId.String())
 * 			} else {
 * 				return ast.NewCompilerDiagnostic(diagnostics.Imported_via_0_from_file_1, referenceText, toFileName(referenceLocation.file.FileName()))
 * 			}
 * 		} else if specifier, ok := program.importHelpersImportSpecifiers[referenceLocation.file.Path()]; ok && specifier == referenceLocation.node {
 * 			if referenceLocation.packageId.Name != "" {
 * 				return ast.NewCompilerDiagnostic(diagnostics.Imported_via_0_from_file_1_with_packageId_2_to_import_importHelpers_as_specified_in_compilerOptions, referenceText, toFileName(referenceLocation.file.FileName()), referenceLocation.packageId.String())
 * 			} else {
 * 				return ast.NewCompilerDiagnostic(diagnostics.Imported_via_0_from_file_1_to_import_importHelpers_as_specified_in_compilerOptions, referenceText, toFileName(referenceLocation.file.FileName()))
 * 			}
 * 		} else {
 * 			if referenceLocation.packageId.Name != "" {
 * 				return ast.NewCompilerDiagnostic(diagnostics.Imported_via_0_from_file_1_with_packageId_2_to_import_jsx_and_jsxs_factory_functions, referenceText, toFileName(referenceLocation.file.FileName()), referenceLocation.packageId.String())
 * 			} else {
 * 				return ast.NewCompilerDiagnostic(diagnostics.Imported_via_0_from_file_1_to_import_jsx_and_jsxs_factory_functions, referenceText, toFileName(referenceLocation.file.FileName()))
 * 			}
 * 		}
 * 	case fileIncludeKindReferenceFile:
 * 		return ast.NewCompilerDiagnostic(diagnostics.Referenced_via_0_from_file_1, referenceText, toFileName(referenceLocation.file.FileName()))
 * 	case fileIncludeKindTypeReferenceDirective:
 * 		if referenceLocation.packageId.Name != "" {
 * 			return ast.NewCompilerDiagnostic(diagnostics.Type_library_referenced_via_0_from_file_1_with_packageId_2, referenceText, toFileName(referenceLocation.file.FileName()), referenceLocation.packageId.String())
 * 		} else {
 * 			return ast.NewCompilerDiagnostic(diagnostics.Type_library_referenced_via_0_from_file_1, referenceText, toFileName(referenceLocation.file.FileName()))
 * 		}
 * 	case fileIncludeKindLibReferenceDirective:
 * 		return ast.NewCompilerDiagnostic(diagnostics.Library_referenced_via_0_from_file_1, referenceText, toFileName(referenceLocation.file.FileName()))
 * 	default:
 * 		panic(fmt.Sprintf("unknown reason: %v", r.kind))
 * 	}
 * }
 */
export declare function FileIncludeReason_computeReferenceFileDiagnostic(receiver: GoPtr<FileIncludeReason>, program: GoPtr<Program>, toFileName: (arg0: string) => string): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::method::FileIncludeReason.toRelatedInfo","kind":"method","status":"implemented","sigHash":"523e687de99e96db56b07151e19b968f0454981021761acaa7a343f883a28250","bodyHash":"2449e754ff9f524c89e3dd44dfddd791a60186e2fa0ffac4b11fefb8473b2ebf"}
 *
 * Go source:
 * func (r *FileIncludeReason) toRelatedInfo(program *Program) *ast.Diagnostic {
 * 	if r.isReferencedFile() {
 * 		return r.computeReferenceFileRelatedInfo(program)
 * 	}
 * 	if program.opts.Config.ConfigFile == nil {
 * 		return nil
 * 	}
 * 	config := program.opts.Config
 * 	switch r.kind {
 * 	case fileIncludeKindRootFile:
 * 		fileName := tspath.GetNormalizedAbsolutePath(config.FileNames()[r.asIndex()], program.GetCurrentDirectory())
 * 		if matchedFileSpec := config.GetMatchedFileSpec(fileName); matchedFileSpec != "" {
 * 			if filesNode := tsoptions.GetTsConfigPropArrayElementValue(config.ConfigFile.SourceFile, "files", matchedFileSpec); filesNode != nil {
 * 				return tsoptions.CreateDiagnosticForNodeInSourceFile(config.ConfigFile.SourceFile, filesNode.AsNode(), diagnostics.File_is_matched_by_files_list_specified_here)
 * 			}
 * 		} else if matchedIncludeSpec, isDefaultIncludeSpec := config.GetMatchedIncludeSpec(fileName); matchedIncludeSpec != "" && !isDefaultIncludeSpec {
 * 			if includeNode := tsoptions.GetTsConfigPropArrayElementValue(config.ConfigFile.SourceFile, "include", matchedIncludeSpec); includeNode != nil {
 * 				return tsoptions.CreateDiagnosticForNodeInSourceFile(config.ConfigFile.SourceFile, includeNode.AsNode(), diagnostics.File_is_matched_by_include_pattern_specified_here)
 * 			}
 * 		}
 * 	case fileIncludeKindAutomaticTypeDirectiveFile:
 * 		if !program.Options().UsesWildcardTypes() {
 * 			data := r.asAutomaticTypeDirectiveFileData()
 * 			if typesSyntax := tsoptions.GetOptionsSyntaxByArrayElementValue(program.includeProcessor.getCompilerOptionsObjectLiteralSyntax(program), "types", data.typeReference); typesSyntax != nil {
 * 				return tsoptions.CreateDiagnosticForNodeInSourceFile(config.ConfigFile.SourceFile, typesSyntax.AsNode(), diagnostics.File_is_entry_point_of_type_library_specified_here)
 * 			}
 * 		}
 * 	case fileIncludeKindLibFile:
 * 		if index, ok := r.asLibFileIndex(); ok {
 * 			if libSyntax := tsoptions.GetOptionsSyntaxByArrayElementValue(program.includeProcessor.getCompilerOptionsObjectLiteralSyntax(program), "lib", program.Options().Lib[index]); libSyntax != nil {
 * 				return tsoptions.CreateDiagnosticForNodeInSourceFile(config.ConfigFile.SourceFile, libSyntax.AsNode(), diagnostics.File_is_library_specified_here)
 * 			}
 * 		} else if target := program.Options().GetEmitScriptTarget().String(); target != "" {
 * 			if targetValueSyntax := tsoptions.ForEachPropertyAssignment(program.includeProcessor.getCompilerOptionsObjectLiteralSyntax(program), "target", tsoptions.GetCallbackForFindingPropertyAssignmentByValue(target)); targetValueSyntax != nil {
 * 				return tsoptions.CreateDiagnosticForNodeInSourceFile(config.ConfigFile.SourceFile, targetValueSyntax.AsNode(), diagnostics.File_is_default_library_for_target_specified_here)
 * 			}
 * 		}
 * 	default:
 * 		panic(fmt.Sprintf("unknown reason: %v", r.kind))
 * 	}
 * 	return nil
 * }
 */
export declare function FileIncludeReason_toRelatedInfo(receiver: GoPtr<FileIncludeReason>, program: GoPtr<Program>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/fileInclude.go::method::FileIncludeReason.computeReferenceFileRelatedInfo","kind":"method","status":"implemented","sigHash":"198857471af852bc4e93483ec60900ea8f5a88e5271d961742f1fdcdec34e726","bodyHash":"035f50d4d528d9b436bdcc177fc32a6b238df406dc725e8c53830ba7be074754"}
 *
 * Go source:
 * func (r *FileIncludeReason) computeReferenceFileRelatedInfo(program *Program) *ast.Diagnostic {
 * 	referenceLocation := program.includeProcessor.getReferenceLocation(r, program)
 * 	if referenceLocation.isSynthetic {
 * 		return nil
 * 	}
 * 	switch r.kind {
 * 	case fileIncludeKindImport:
 * 		return referenceLocation.diagnosticAt(diagnostics.File_is_included_via_import_here)
 * 	case fileIncludeKindReferenceFile:
 * 		return referenceLocation.diagnosticAt(diagnostics.File_is_included_via_reference_here)
 * 	case fileIncludeKindTypeReferenceDirective:
 * 		return referenceLocation.diagnosticAt(diagnostics.File_is_included_via_type_library_reference_here)
 * 	case fileIncludeKindLibReferenceDirective:
 * 		return referenceLocation.diagnosticAt(diagnostics.File_is_included_via_library_reference_here)
 * 	default:
 * 		panic(fmt.Sprintf("unknown reason: %v", r.kind))
 * 	}
 * }
 */
export declare function FileIncludeReason_computeReferenceFileRelatedInfo(receiver: GoPtr<FileIncludeReason>, program: GoPtr<Program>): GoPtr<Diagnostic>;
//# sourceMappingURL=fileInclude.d.ts.map