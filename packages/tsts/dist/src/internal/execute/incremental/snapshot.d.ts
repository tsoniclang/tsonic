import type { bool, int, uint } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Builder } from "../../../go/strings.js";
import type { Once } from "../../../go/sync.js";
import type { Bool } from "../../../go/sync/atomic.js";
import type { SourceFile } from "../../ast/ast.js";
import type { Diagnostic, RepopulateDiagnosticInfo } from "../../ast/diagnostic.js";
import type { SyncMap } from "../../collections/syncmap.js";
import type { SyncSet } from "../../collections/syncset.js";
import type { Program, WriteFileData } from "../../compiler/program.js";
import type { CompilerOptions, ResolutionMode } from "../../core/compileroptions.js";
import type { Tristate } from "../../core/tristate.js";
import type { Category, Key } from "../../diagnostics/diagnostics.js";
import type { Path } from "../../tspath/path.js";
import type { referenceMap } from "./referencemap.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::type::FileInfo","kind":"type","status":"implemented","sigHash":"6817a2591736e7725fa6ea6007ad198d48ce419bf0b5101bbd97abd6406732bd","bodyHash":"390d13d57fa5c735176dd9ae95289568c53671ec69625e59937fe63aa2e289c4"}
 *
 * Go source:
 * FileInfo struct {
 * 	version            string
 * 	signature          string
 * 	affectsGlobalScope bool
 * 	impliedNodeFormat  core.ResolutionMode
 * }
 */
export interface FileInfo {
    version: string;
    signature: string;
    affectsGlobalScope: bool;
    impliedNodeFormat: ResolutionMode;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::method::FileInfo.Version","kind":"method","status":"implemented","sigHash":"a37853a37dbf2add63fa9bce39ec4895dd57563b6ff6a300d1356c4dc51b4537","bodyHash":"59e23cec9fe83a661ae92a69e782fd0d0b8fa7386fe3a512cea808299413609c"}
 *
 * Go source:
 * func (f *FileInfo) Version() string                        { return f.version }
 */
export declare function FileInfo_Version(receiver: GoPtr<FileInfo>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::method::FileInfo.Signature","kind":"method","status":"implemented","sigHash":"c8417e77fa45c92fd2f2b94cf4b1f9c65a85cf1069723d5ff57f5f03bf8744d1","bodyHash":"04e36124150e37482529613627b848b1cdcbb0a0153243ef2da5ab3c52cc0e85"}
 *
 * Go source:
 * func (f *FileInfo) Signature() string                      { return f.signature }
 */
export declare function FileInfo_Signature(receiver: GoPtr<FileInfo>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::method::FileInfo.AffectsGlobalScope","kind":"method","status":"implemented","sigHash":"1c5253410bdbb43de196a658f2b7136d304f0705ec0c7e7ef065a409a1e964e6","bodyHash":"d34b2bc415ad385e0bfab94e543321453af911b6a4bb5f6f3a32c6dfbe13a248"}
 *
 * Go source:
 * func (f *FileInfo) AffectsGlobalScope() bool               { return f.affectsGlobalScope }
 */
export declare function FileInfo_AffectsGlobalScope(receiver: GoPtr<FileInfo>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::method::FileInfo.ImpliedNodeFormat","kind":"method","status":"implemented","sigHash":"7efdc7d33991ee77766cd2e07740c7d01c92cc4b1abca09efde2884f8a80d508","bodyHash":"19dad8260969a5536b064244194cd5ebdb07c125de61d18a71bfff9bb24ce0df"}
 *
 * Go source:
 * func (f *FileInfo) ImpliedNodeFormat() core.ResolutionMode { return f.impliedNodeFormat }
 */
export declare function FileInfo_ImpliedNodeFormat(receiver: GoPtr<FileInfo>): ResolutionMode;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::func::ComputeHash","kind":"func","status":"implemented","sigHash":"a4e0b7d25cc90e8b4fe227995805b8acb1f2f7c7e1dc3f133f5f12f04e786f5e","bodyHash":"6f0111ee5765ecf62d5896f686e8bd3a9e8944a211f67ce501a494524f05bba0"}
 *
 * Go source:
 * func ComputeHash(text string, hashWithText bool) string {
 * 	hashBytes := xxh3.HashString128(text).Bytes()
 * 	hash := hex.EncodeToString(hashBytes[:])
 * 	if hashWithText {
 * 		hash += "-" + text
 * 	}
 * 	return hash
 * }
 */
export declare function ComputeHash(text: string, hashWithText: bool): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::type::FileEmitKind","kind":"type","status":"implemented","sigHash":"f884c302910dcca76f02f6de918ad7c3520497d018da280c9ebfca487db2458f","bodyHash":"eaac78057f4aa2209df69f4c33ab85ac8c334281305a30476e159aa8ecbc7a01"}
 *
 * Go source:
 * FileEmitKind uint32
 */
export type FileEmitKind = uint;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::constGroup::FileEmitKindNone+FileEmitKindJs+FileEmitKindJsMap+FileEmitKindJsInlineMap+FileEmitKindDtsErrors+FileEmitKindDtsEmit+FileEmitKindDtsMap+FileEmitKindDts+FileEmitKindAllJs+FileEmitKindAllDtsEmit+FileEmitKindAllDts+FileEmitKindAll","kind":"constGroup","status":"implemented","sigHash":"a5fece8fe2d5c9d89e4b9a48f88c11ad4bf9e0ecaccc7f374f18aa0b0b214e76","bodyHash":"3197bc0b38989d1dceb0b8e278d7217acc0be070483cc380b113b753001c917f"}
 *
 * Go source:
 * const (
 * 	FileEmitKindNone        FileEmitKind = 0
 * 	FileEmitKindJs          FileEmitKind = 1 << 0 // emit js file
 * 	FileEmitKindJsMap       FileEmitKind = 1 << 1 // emit js.map file
 * 	FileEmitKindJsInlineMap FileEmitKind = 1 << 2 // emit inline source map in js file
 * 	FileEmitKindDtsErrors   FileEmitKind = 1 << 3 // emit dts errors
 * 	FileEmitKindDtsEmit     FileEmitKind = 1 << 4 // emit d.ts file
 * 	FileEmitKindDtsMap      FileEmitKind = 1 << 5 // emit d.ts.map file
 *
 * 	FileEmitKindDts        = FileEmitKindDtsErrors | FileEmitKindDtsEmit
 * 	FileEmitKindAllJs      = FileEmitKindJs | FileEmitKindJsMap | FileEmitKindJsInlineMap
 * 	FileEmitKindAllDtsEmit = FileEmitKindDtsEmit | FileEmitKindDtsMap
 * 	FileEmitKindAllDts     = FileEmitKindDts | FileEmitKindDtsMap
 * 	FileEmitKindAll        = FileEmitKindAllJs | FileEmitKindAllDts
 * )
 */
export declare const FileEmitKindNone: FileEmitKind;
export declare const FileEmitKindJs: FileEmitKind;
export declare const FileEmitKindJsMap: FileEmitKind;
export declare const FileEmitKindJsInlineMap: FileEmitKind;
export declare const FileEmitKindDtsErrors: FileEmitKind;
export declare const FileEmitKindDtsEmit: FileEmitKind;
export declare const FileEmitKindDtsMap: FileEmitKind;
export declare const FileEmitKindDts: int;
export declare const FileEmitKindAllJs: int;
export declare const FileEmitKindAllDtsEmit: int;
export declare const FileEmitKindAllDts: int;
export declare const FileEmitKindAll: int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::func::GetFileEmitKind","kind":"func","status":"implemented","sigHash":"2ffd60ee5a17179d3a4aff2c7f8cf173dad0e63a42537c54ad3509d5692f1761","bodyHash":"fccb32e4c8d796ed85e8b0fa51baf56fa803e3155e79bfa23426676d2432641f"}
 *
 * Go source:
 * func GetFileEmitKind(options *core.CompilerOptions) FileEmitKind {
 * 	result := FileEmitKindJs
 * 	if options.SourceMap.IsTrue() {
 * 		result |= FileEmitKindJsMap
 * 	}
 * 	if options.InlineSourceMap.IsTrue() {
 * 		result |= FileEmitKindJsInlineMap
 * 	}
 * 	if options.GetEmitDeclarations() {
 * 		result |= FileEmitKindDts
 * 	}
 * 	if options.DeclarationMap.IsTrue() {
 * 		result |= FileEmitKindDtsMap
 * 	}
 * 	if options.EmitDeclarationOnly.IsTrue() {
 * 		result &= FileEmitKindAllDts
 * 	}
 * 	return result
 * }
 */
export declare function GetFileEmitKind(options: GoPtr<CompilerOptions>): FileEmitKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::func::getPendingEmitKindWithOptions","kind":"func","status":"implemented","sigHash":"7183dd0a5bd4040e8221bf98bd2be1d1fe1f6b4bc30240cf3078f1516d3c86ec","bodyHash":"ad3fb5f61105599576c132d1b0f11209c0755e07e0c111eb8c3cfc0d695d8504"}
 *
 * Go source:
 * func getPendingEmitKindWithOptions(options *core.CompilerOptions, oldOptions *core.CompilerOptions) FileEmitKind {
 * 	oldEmitKind := GetFileEmitKind(oldOptions)
 * 	newEmitKind := GetFileEmitKind(options)
 * 	return getPendingEmitKind(newEmitKind, oldEmitKind)
 * }
 */
export declare function getPendingEmitKindWithOptions(options: GoPtr<CompilerOptions>, oldOptions: GoPtr<CompilerOptions>): FileEmitKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::func::getPendingEmitKind","kind":"func","status":"implemented","sigHash":"43d26a56796c4dd56c5e81b07202689d5d5c36f252bb530ea72cfb2dbcf8747f","bodyHash":"06082d13518582fbf1cf7465bc11818e01e4d3d914a1252c63bb2cd4d80118b0"}
 *
 * Go source:
 * func getPendingEmitKind(emitKind FileEmitKind, oldEmitKind FileEmitKind) FileEmitKind {
 * 	if oldEmitKind == emitKind {
 * 		return FileEmitKindNone
 * 	}
 * 	if oldEmitKind == 0 || emitKind == 0 {
 * 		return emitKind
 * 	}
 * 	diff := oldEmitKind ^ emitKind
 * 	result := FileEmitKindNone
 * 	// If there is diff in Js emit, pending emit is js emit flags
 * 	if (diff & FileEmitKindAllJs) != 0 {
 * 		result |= emitKind & FileEmitKindAllJs
 * 	}
 * 	// If dts errors pending, add dts errors flag
 * 	if (diff & FileEmitKindDtsErrors) != 0 {
 * 		result |= emitKind & FileEmitKindAllDts
 * 	}
 * 	// If there is diff in Dts emit, pending emit is dts emit flags
 * 	if (diff & FileEmitKindAllDtsEmit) != 0 {
 * 		result |= emitKind & FileEmitKindAllDtsEmit
 * 	}
 * 	return result
 * }
 */
export declare function getPendingEmitKind(emitKind: FileEmitKind, oldEmitKind: FileEmitKind): FileEmitKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::type::emitSignature","kind":"type","status":"implemented","sigHash":"4ef15f1f2c7bf4cd72359988bc50d894b5533d8fce0b3d6a73e11f035299a6a9","bodyHash":"da483500ad424212d208ff75b962eb41b784b1b9333ab52b6fbba1c1e4e31fb6"}
 *
 * Go source:
 * emitSignature struct {
 * 	signature                     string
 * 	signatureWithDifferentOptions []string
 * }
 */
export interface emitSignature {
    signature: string;
    signatureWithDifferentOptions: GoSlice<string>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::method::emitSignature.getNewEmitSignature","kind":"method","status":"implemented","sigHash":"68c623e4a838309c8165809722fd48fc0fbdf56862c7a3e8c10e77b1609a7b17","bodyHash":"a657541416456ccffabef9bc89dee12440eb0bb063a0e68ecfc4a32558be0c53"}
 *
 * Go source:
 * func (e *emitSignature) getNewEmitSignature(oldOptions *core.CompilerOptions, newOptions *core.CompilerOptions) *emitSignature {
 * 	if oldOptions.DeclarationMap.IsTrue() == newOptions.DeclarationMap.IsTrue() {
 * 		return e
 * 	}
 * 	if e.signatureWithDifferentOptions == nil {
 * 		return &emitSignature{
 * 			signatureWithDifferentOptions: []string{e.signature},
 * 		}
 * 	} else {
 * 		return &emitSignature{
 * 			signature: e.signatureWithDifferentOptions[0],
 * 		}
 * 	}
 * }
 */
export declare function emitSignature_getNewEmitSignature(receiver: GoPtr<emitSignature>, oldOptions: GoPtr<CompilerOptions>, newOptions: GoPtr<CompilerOptions>): GoPtr<emitSignature>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::type::buildInfoDiagnosticWithFileName","kind":"type","status":"implemented","sigHash":"f444af1094148757fd2d891f751dbc25d6860f82693ecd3bd3209e4b6e059e2c","bodyHash":"b8c53da23e43a66669ae070fe5f61c71f7bfba29091f38c9c828d2cc5e8b391a"}
 *
 * Go source:
 * buildInfoDiagnosticWithFileName struct {
 * 	// filename if it is for a File thats other than its stored for
 * 	file               tspath.Path
 * 	noFile             bool
 * 	pos                int
 * 	end                int
 * 	code               int32
 * 	category           diagnostics.Category
 * 	messageKey         diagnostics.Key
 * 	messageArgs        []string
 * 	messageChain       []*buildInfoDiagnosticWithFileName
 * 	relatedInformation []*buildInfoDiagnosticWithFileName
 * 	reportsUnnecessary bool
 * 	reportsDeprecated  bool
 * 	skippedOnNoEmit    bool
 * 	repopulateInfo     *ast.RepopulateDiagnosticInfo
 * }
 */
export interface buildInfoDiagnosticWithFileName {
    file: Path;
    noFile: bool;
    pos: int;
    end: int;
    code: int;
    category: Category;
    messageKey: Key;
    messageArgs: GoSlice<string>;
    messageChain: GoSlice<GoPtr<buildInfoDiagnosticWithFileName>>;
    relatedInformation: GoSlice<GoPtr<buildInfoDiagnosticWithFileName>>;
    reportsUnnecessary: bool;
    reportsDeprecated: bool;
    skippedOnNoEmit: bool;
    repopulateInfo: GoPtr<RepopulateDiagnosticInfo>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::type::DiagnosticsOrBuildInfoDiagnosticsWithFileName","kind":"type","status":"implemented","sigHash":"dc70a950215271445b76035ffefd479590c00e321621a5914b228f56f78da355","bodyHash":"3612d657c84048241ed00a1960400fa7ae940a957d011dd80f7e813422102be6"}
 *
 * Go source:
 * DiagnosticsOrBuildInfoDiagnosticsWithFileName struct {
 * 	diagnostics          []*ast.Diagnostic
 * 	buildInfoDiagnostics []*buildInfoDiagnosticWithFileName
 * }
 */
export interface DiagnosticsOrBuildInfoDiagnosticsWithFileName {
    diagnostics: GoSlice<GoPtr<Diagnostic>>;
    buildInfoDiagnostics: GoSlice<GoPtr<buildInfoDiagnosticWithFileName>>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::method::buildInfoDiagnosticWithFileName.toDiagnostic","kind":"method","status":"implemented","sigHash":"3e0b1ddf16bcdf8e38111a9cf56e36c33f3cf5742d236b428e567b5c2164f6bf","bodyHash":"b3539d007c9990e1316361bb4ef596610be7344173562e3d816ea2d5cf7b94d6"}
 *
 * Go source:
 * func (b *buildInfoDiagnosticWithFileName) toDiagnostic(p *compiler.Program, file *ast.SourceFile) *ast.Diagnostic {
 * 	var fileForDiagnostic *ast.SourceFile
 * 	if b.file != "" {
 * 		fileForDiagnostic = p.GetSourceFileByPath(b.file)
 * 	} else if !b.noFile {
 * 		fileForDiagnostic = file
 * 	}
 *
 * 	if b.repopulateInfo != nil {
 * 		return repopulateDiagnosticChain(b, p, fileForDiagnostic)
 * 	}
 *
 * 	var messageChain []*ast.Diagnostic
 * 	for _, msg := range b.messageChain {
 * 		messageChain = append(messageChain, msg.toDiagnostic(p, fileForDiagnostic))
 * 	}
 * 	var relatedInformation []*ast.Diagnostic
 * 	for _, info := range b.relatedInformation {
 * 		relatedInformation = append(relatedInformation, info.toDiagnostic(p, fileForDiagnostic))
 * 	}
 * 	return ast.NewDiagnosticFromSerialized(
 * 		fileForDiagnostic,
 * 		core.NewTextRange(b.pos, b.end),
 * 		b.code,
 * 		b.category,
 * 		b.messageKey,
 * 		b.messageArgs,
 * 		messageChain,
 * 		relatedInformation,
 * 		b.reportsUnnecessary,
 * 		b.reportsDeprecated,
 * 		b.skippedOnNoEmit,
 * 	)
 * }
 */
export declare function buildInfoDiagnosticWithFileName_toDiagnostic(receiver: GoPtr<buildInfoDiagnosticWithFileName>, p: GoPtr<Program>, file: GoPtr<SourceFile>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::func::repopulateDiagnosticChain","kind":"func","status":"implemented","sigHash":"ae96e9094867b2175a574ac81a9abe5fb192c2e569a9f9192d20590787fdd7f6","bodyHash":"f0ec098768f4a72a68ef6a609832b1b6e107485c6297b6e73854eefe2ad14c25"}
 *
 * Go source:
 * func repopulateDiagnosticChain(b *buildInfoDiagnosticWithFileName, p *compiler.Program, file *ast.SourceFile) *ast.Diagnostic {
 * 	info := b.repopulateInfo
 * 	switch info.Kind {
 * 	case ast.RepopulateModeMismatch:
 * 		return repopulateModeMismatchChain(b, p, file)
 * 	case ast.RepopulateModuleNotFound:
 * 		return repopulateModuleNotFoundChain(b, p, file, info)
 * 	default:
 * 		// Fall back to using the stored (possibly stale) data
 * 		return b.toDiagnosticWithoutRepopulate(p, file)
 * 	}
 * }
 */
export declare function repopulateDiagnosticChain(b: GoPtr<buildInfoDiagnosticWithFileName>, p: GoPtr<Program>, file: GoPtr<SourceFile>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::method::buildInfoDiagnosticWithFileName.toDiagnosticWithoutRepopulate","kind":"method","status":"implemented","sigHash":"cdcd4b0d6471e007264112da180001900add121733252e42e15c215de39a9252","bodyHash":"bf9184e2edc81e54c8b3cf29a975aa50a1487a0d377941b6213d9699441e4781"}
 *
 * Go source:
 * func (b *buildInfoDiagnosticWithFileName) toDiagnosticWithoutRepopulate(p *compiler.Program, file *ast.SourceFile) *ast.Diagnostic {
 * 	var messageChain []*ast.Diagnostic
 * 	for _, msg := range b.messageChain {
 * 		messageChain = append(messageChain, msg.toDiagnostic(p, file))
 * 	}
 * 	var relatedInformation []*ast.Diagnostic
 * 	for _, info := range b.relatedInformation {
 * 		relatedInformation = append(relatedInformation, info.toDiagnostic(p, file))
 * 	}
 * 	return ast.NewDiagnosticFromSerialized(
 * 		file,
 * 		core.NewTextRange(b.pos, b.end),
 * 		b.code,
 * 		b.category,
 * 		b.messageKey,
 * 		b.messageArgs,
 * 		messageChain,
 * 		relatedInformation,
 * 		b.reportsUnnecessary,
 * 		b.reportsDeprecated,
 * 		b.skippedOnNoEmit,
 * 	)
 * }
 */
export declare function buildInfoDiagnosticWithFileName_toDiagnosticWithoutRepopulate(receiver: GoPtr<buildInfoDiagnosticWithFileName>, p: GoPtr<Program>, file: GoPtr<SourceFile>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::func::repopulateModeMismatchChain","kind":"func","status":"implemented","sigHash":"09897ef7c9c499a6c64de963a166a621263d05d9ebb9cceab5fe654ea2d2e63e","bodyHash":"447efb79163f79b0683b776f5495a21ce9938fbf75128147b11b36f37b6f1755"}
 *
 * Go source:
 * func repopulateModeMismatchChain(b *buildInfoDiagnosticWithFileName, p *compiler.Program, file *ast.SourceFile) *ast.Diagnostic {
 * 	if file == nil {
 * 		return b.toDiagnosticWithoutRepopulate(p, file)
 * 	}
 *
 * 	details := checker.CreateModeMismatchDetails(p, file)
 *
 * 	var nextChain []*ast.Diagnostic
 * 	for _, msg := range b.messageChain {
 * 		nextChain = append(nextChain, msg.toDiagnostic(p, file))
 * 	}
 *
 * 	return ast.NewDiagnosticFromSerialized(
 * 		file,
 * 		core.NewTextRange(b.pos, b.end),
 * 		details.Message.Code(),
 * 		details.Message.Category(),
 * 		details.Message.Key(),
 * 		diagnostics.StringifyArgs(details.Args),
 * 		nextChain,
 * 		nil,
 * 		false,
 * 		false,
 * 		false,
 * 	)
 * }
 */
export declare function repopulateModeMismatchChain(b: GoPtr<buildInfoDiagnosticWithFileName>, p: GoPtr<Program>, file: GoPtr<SourceFile>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::func::repopulateModuleNotFoundChain","kind":"func","status":"implemented","sigHash":"dc6d918a3f8de5b306b335d15dd17123dfe63d6719b181f4cdfcfcba8a9ba7b6","bodyHash":"70b3d7122f104af0a1f9c627d78c8ea981779909fa6004c6384a61d7075a1994"}
 *
 * Go source:
 * func repopulateModuleNotFoundChain(b *buildInfoDiagnosticWithFileName, p *compiler.Program, file *ast.SourceFile, info *ast.RepopulateDiagnosticInfo) *ast.Diagnostic {
 * 	if file == nil {
 * 		return b.toDiagnosticWithoutRepopulate(p, file)
 * 	}
 *
 * 	packageName := info.PackageName
 * 	if packageName == "" {
 * 		packageName = info.ModuleReference
 * 	}
 *
 * 	details := checker.CreateModuleNotFoundChain(p, file, info.ModuleReference, info.Mode, packageName)
 *
 * 	var nextChain []*ast.Diagnostic
 * 	for _, msg := range b.messageChain {
 * 		nextChain = append(nextChain, msg.toDiagnostic(p, file))
 * 	}
 *
 * 	return ast.NewDiagnosticFromSerialized(
 * 		file,
 * 		core.NewTextRange(b.pos, b.end),
 * 		details.Message.Code(),
 * 		details.Message.Category(),
 * 		details.Message.Key(),
 * 		diagnostics.StringifyArgs(details.Args),
 * 		nextChain,
 * 		nil,
 * 		false,
 * 		false,
 * 		false,
 * 	)
 * }
 */
export declare function repopulateModuleNotFoundChain(b: GoPtr<buildInfoDiagnosticWithFileName>, p: GoPtr<Program>, file: GoPtr<SourceFile>, info: GoPtr<RepopulateDiagnosticInfo>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::method::DiagnosticsOrBuildInfoDiagnosticsWithFileName.getDiagnostics","kind":"method","status":"implemented","sigHash":"86382b07d8c95af4c9a289fb0a0d6212960127adf4b1e267cbf1e09960d49b9c","bodyHash":"4b3c6d19e18e23aa2765a3c0aa17a57f14b7c68ac06eecaf523e4be5bb8cd39e"}
 *
 * Go source:
 * func (d *DiagnosticsOrBuildInfoDiagnosticsWithFileName) getDiagnostics(p *compiler.Program, file *ast.SourceFile) []*ast.Diagnostic {
 * 	if d.diagnostics != nil {
 * 		return d.diagnostics
 * 	}
 * 	// Convert and cache the diagnostics
 * 	d.diagnostics = core.Map(d.buildInfoDiagnostics, func(diag *buildInfoDiagnosticWithFileName) *ast.Diagnostic {
 * 		return diag.toDiagnostic(p, file)
 * 	})
 * 	return d.diagnostics
 * }
 */
export declare function DiagnosticsOrBuildInfoDiagnosticsWithFileName_getDiagnostics(receiver: GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName>, p: GoPtr<Program>, file: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::type::snapshot","kind":"type","status":"implemented","sigHash":"b212cd3cc90f62b68f10e9ecb1dc99a8c26d92f32e39159057ad970f6b7eddef","bodyHash":"af1d695a9987712c92ecbd522d2b7d8749ab9e96beb4899adba43c26e1d58d7b"}
 *
 * Go source:
 * snapshot struct {
 * 	// These are the fields that get serialized
 *
 * 	// Information of the file eg. its version, signature etc
 * 	fileInfos collections.SyncMap[tspath.Path, *FileInfo]
 * 	options   *core.CompilerOptions
 * 	//  Contains the map of ReferencedSet=Referenced files of the file if module emit is enabled
 * 	referencedMap referenceMap
 * 	// Cache of semantic diagnostics for files with their Path being the key
 * 	semanticDiagnosticsPerFile collections.SyncMap[tspath.Path, *DiagnosticsOrBuildInfoDiagnosticsWithFileName]
 * 	// Cache of dts emit diagnostics for files with their Path being the key
 * 	emitDiagnosticsPerFile collections.SyncMap[tspath.Path, *DiagnosticsOrBuildInfoDiagnosticsWithFileName]
 * 	// The map has key by source file's path that has been changed
 * 	changedFilesSet collections.SyncSet[tspath.Path]
 * 	// Files pending to be emitted
 * 	affectedFilesPendingEmit collections.SyncMap[tspath.Path, FileEmitKind]
 * 	// Name of the file whose dts was the latest to change
 * 	latestChangedDtsFile string
 * 	// Hash of d.ts emitted for the file, use to track when emit of d.ts changes
 * 	emitSignatures collections.SyncMap[tspath.Path, *emitSignature]
 * 	// Recorded if program had errors that need to be reported even with --noCheck
 * 	hasErrors core.Tristate
 * 	// Recorded if program had semantic errors only for non incremental build
 * 	hasSemanticErrors bool
 * 	// If semantic diagnostic check is pending
 * 	checkPending bool
 *
 * 	// Additional fields that are not serialized but needed to track state
 *
 * 	// true if build info emit is pending
 * 	buildInfoEmitPending                    atomic.Bool
 * 	hasErrorsFromOldState                   core.Tristate
 * 	hasSemanticErrorsFromOldState           bool
 * 	allFilesExcludingDefaultLibraryFileOnce sync.Once
 * 	//  Cache of all files excluding default library file for the current program
 * 	allFilesExcludingDefaultLibraryFile []*ast.SourceFile
 * 	hasChangedDtsFile                   bool
 * 	hasEmitDiagnostics                  bool
 *
 * 	// Used with testing to add text of hash for better comparison
 * 	hashWithText bool
 * }
 */
export interface snapshot {
    fileInfos: SyncMap<Path, GoPtr<FileInfo>>;
    options: GoPtr<CompilerOptions>;
    referencedMap: referenceMap;
    semanticDiagnosticsPerFile: SyncMap<Path, GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName>>;
    emitDiagnosticsPerFile: SyncMap<Path, GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName>>;
    changedFilesSet: SyncSet<Path>;
    affectedFilesPendingEmit: SyncMap<Path, FileEmitKind>;
    latestChangedDtsFile: string;
    emitSignatures: SyncMap<Path, GoPtr<emitSignature>>;
    hasErrors: Tristate;
    hasSemanticErrors: bool;
    checkPending: bool;
    buildInfoEmitPending: Bool;
    hasErrorsFromOldState: Tristate;
    hasSemanticErrorsFromOldState: bool;
    allFilesExcludingDefaultLibraryFileOnce: Once;
    allFilesExcludingDefaultLibraryFile: GoSlice<GoPtr<SourceFile>>;
    hasChangedDtsFile: bool;
    hasEmitDiagnostics: bool;
    hashWithText: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::method::snapshot.addFileToChangeSet","kind":"method","status":"implemented","sigHash":"b74dc35a38b63003d790737353c1d04f6dcb9bf77dfec7cc7d05a918c7e164b0","bodyHash":"8cd6b171706ac328a5433ab1894c3d88b204cecd94b95561a171eeadb601e7cd"}
 *
 * Go source:
 * func (s *snapshot) addFileToChangeSet(filePath tspath.Path) {
 * 	s.changedFilesSet.Add(filePath)
 * 	s.buildInfoEmitPending.Store(true)
 * }
 */
export declare function snapshot_addFileToChangeSet(receiver: GoPtr<snapshot>, filePath: Path): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::method::snapshot.addFileToAffectedFilesPendingEmit","kind":"method","status":"implemented","sigHash":"d6a0905dd575e66e76e3c23881223d25c40e5d736cc328aeee55ad75caf949cd","bodyHash":"5119729741324c812db702540f1d3acc5cc02b2a99a06d3479f7e6373189b9c0"}
 *
 * Go source:
 * func (s *snapshot) addFileToAffectedFilesPendingEmit(filePath tspath.Path, emitKind FileEmitKind) {
 * 	existingKind, _ := s.affectedFilesPendingEmit.Load(filePath)
 * 	s.affectedFilesPendingEmit.Store(filePath, existingKind|emitKind)
 * 	if emitKind&FileEmitKindDtsErrors != 0 {
 * 		s.emitDiagnosticsPerFile.Delete(filePath)
 * 	}
 * 	s.buildInfoEmitPending.Store(true)
 * }
 */
export declare function snapshot_addFileToAffectedFilesPendingEmit(receiver: GoPtr<snapshot>, filePath: Path, emitKind: FileEmitKind): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::method::snapshot.getAllFilesExcludingDefaultLibraryFile","kind":"method","status":"implemented","sigHash":"91b924ef414f84899736aad88a289917ecf45049248c077776c805930dd23705","bodyHash":"798ed2e939ba3d6cb73544fc4bbeb1541a40e7d82371e8c3e742ffe40d1cfc2c"}
 *
 * Go source:
 * func (s *snapshot) getAllFilesExcludingDefaultLibraryFile(program *compiler.Program, firstSourceFile *ast.SourceFile) []*ast.SourceFile {
 * 	s.allFilesExcludingDefaultLibraryFileOnce.Do(func() {
 * 		files := program.GetSourceFiles()
 * 		s.allFilesExcludingDefaultLibraryFile = make([]*ast.SourceFile, 0, len(files))
 * 		addSourceFile := func(file *ast.SourceFile) {
 * 			if !program.IsSourceFileDefaultLibrary(file.Path()) {
 * 				s.allFilesExcludingDefaultLibraryFile = append(s.allFilesExcludingDefaultLibraryFile, file)
 * 			}
 * 		}
 * 		if firstSourceFile != nil {
 * 			addSourceFile(firstSourceFile)
 * 		}
 * 		for _, file := range files {
 * 			if file != firstSourceFile {
 * 				addSourceFile(file)
 * 			}
 * 		}
 * 	})
 * 	return s.allFilesExcludingDefaultLibraryFile
 * }
 */
export declare function snapshot_getAllFilesExcludingDefaultLibraryFile(receiver: GoPtr<snapshot>, program: GoPtr<Program>, firstSourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<SourceFile>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::func::getTextHandlingSourceMapForSignature","kind":"func","status":"implemented","sigHash":"091a59d136bb5b95b24874d9af8f376334fa4e05e325fc1a838fce3a2566dcf6","bodyHash":"b18404acda28bc1706580eadc6f77bb68652d348d65c990c2ae1b6d827844f7b"}
 *
 * Go source:
 * func getTextHandlingSourceMapForSignature(text string, data *compiler.WriteFileData) string {
 * 	if data.SourceMapUrlPos != -1 {
 * 		return text[:data.SourceMapUrlPos]
 * 	}
 * 	return text
 * }
 */
export declare function getTextHandlingSourceMapForSignature(text: string, data: GoPtr<WriteFileData>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::method::snapshot.computeSignatureWithDiagnostics","kind":"method","status":"implemented","sigHash":"09eedb70960b97f2b05c1c972ae01f8c652de0da1b36801c7863e209058eade9","bodyHash":"040e9dcd4ada20f00c384ee0a7869c663da1ab76ed14e0b253ec6e18737913c6"}
 *
 * Go source:
 * func (s *snapshot) computeSignatureWithDiagnostics(file *ast.SourceFile, text string, data *compiler.WriteFileData) string {
 * 	var builder strings.Builder
 * 	builder.WriteString(getTextHandlingSourceMapForSignature(text, data))
 * 	for _, diag := range data.Diagnostics {
 * 		diagnosticToStringBuilder(diag, file, &builder)
 * 	}
 * 	return s.computeHash(builder.String())
 * }
 */
export declare function snapshot_computeSignatureWithDiagnostics(receiver: GoPtr<snapshot>, file: GoPtr<SourceFile>, text: string, data: GoPtr<WriteFileData>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::func::diagnosticToStringBuilder","kind":"func","status":"implemented","sigHash":"8a7ae910b6f4c8ddde187728eee0c0375479e0f15a8f5c9e4566fd4725a59b57","bodyHash":"a3992f0ae263a603507de882bcb9662d81074f380a18af9842400935f1eb230b"}
 *
 * Go source:
 * func diagnosticToStringBuilder(diagnostic *ast.Diagnostic, file *ast.SourceFile, builder *strings.Builder) {
 * 	if diagnostic == nil {
 * 		return
 * 	}
 * 	builder.WriteString("\n")
 * 	if diagnostic.File() != file {
 * 		builder.WriteString(tspath.EnsurePathIsNonModuleName(tspath.GetRelativePathFromDirectory(
 * 			tspath.GetDirectoryPath(string(file.Path())),
 * 			string(diagnostic.File().Path()),
 * 			tspath.ComparePathsOptions{},
 * 		)))
 * 	}
 * 	if diagnostic.File() != nil {
 * 		builder.WriteString(fmt.Sprintf("(%d,%d): ", diagnostic.Pos(), diagnostic.Len()))
 * 	}
 * 	builder.WriteString(diagnostic.Category().Name())
 * 	builder.WriteString(fmt.Sprintf("%d: ", diagnostic.Code()))
 * 	builder.WriteString(string(diagnostic.MessageKey()))
 * 	builder.WriteString("\n")
 * 	for _, arg := range diagnostic.MessageArgs() {
 * 		builder.WriteString(arg)
 * 		builder.WriteString("\n")
 * 	}
 * 	for _, chain := range diagnostic.MessageChain() {
 * 		diagnosticToStringBuilder(chain, file, builder)
 * 	}
 * 	for _, info := range diagnostic.RelatedInformation() {
 * 		diagnosticToStringBuilder(info, file, builder)
 * 	}
 * }
 */
export declare function diagnosticToStringBuilder(diagnostic: GoPtr<Diagnostic>, file: GoPtr<SourceFile>, builder: GoPtr<Builder>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::method::snapshot.computeHash","kind":"method","status":"implemented","sigHash":"adaf3edec1edf5a762066547e33245d36d1a41fcc13571ff08c648aab3751f79","bodyHash":"6f08125cdb4d696519573bfb8910c529d5793d72a7ae40a0839142e4b7ce47e5"}
 *
 * Go source:
 * func (s *snapshot) computeHash(text string) string {
 * 	return ComputeHash(text, s.hashWithText)
 * }
 */
export declare function snapshot_computeHash(receiver: GoPtr<snapshot>, text: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/snapshot.go::method::snapshot.canUseIncrementalState","kind":"method","status":"implemented","sigHash":"7ff900c39087072ace592b9204206b1b73a06f017cfb9537c8e74afe4b4ddeae","bodyHash":"d7a2b1c2f85c773b017a4669401ef9835dbf08ec139b3084fec93aa9919d873d"}
 *
 * Go source:
 * func (s *snapshot) canUseIncrementalState() bool {
 * 	if !s.options.IsIncremental() && s.options.Build.IsTrue() {
 * 		// If not incremental build (with tsc -b), we don't need to track state except diagnostics per file so we can use it
 * 		return false
 * 	}
 * 	return true
 * }
 */
export declare function snapshot_canUseIncrementalState(receiver: GoPtr<snapshot>): bool;
//# sourceMappingURL=snapshot.d.ts.map