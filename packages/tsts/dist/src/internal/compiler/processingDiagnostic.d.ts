import type { int } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import type { Message } from "../diagnostics/diagnostics.js";
import type { Path } from "../tspath/path.js";
import type { FileIncludeReason } from "./fileInclude.js";
import type { Program } from "./program.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/processingDiagnostic.go::type::processingDiagnosticKind","kind":"type","status":"implemented","sigHash":"206597e4b3e5492bed070fc03dfcc895035dc1bf0f57a065b6f6021deca831ee","bodyHash":"bb346ba4b5dd9c7c0d634136ea2a4939fb3cd88f82cacd0e7062c6e905c7e61e"}
 *
 * Go source:
 * processingDiagnosticKind int
 */
export type processingDiagnosticKind = int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/processingDiagnostic.go::constGroup::processingDiagnosticKindUnknownReference+processingDiagnosticKindExplainingFileInclude","kind":"constGroup","status":"implemented","sigHash":"0bbaee3ac98202fdda68a622bce6be83c75296c40745866e45b6050179861b1c","bodyHash":"8ff9a38b63a994920cfdbb71f713b84527811dd6486208ecc272c20f47816a68"}
 *
 * Go source:
 * const (
 * 	processingDiagnosticKindUnknownReference processingDiagnosticKind = iota
 * 	processingDiagnosticKindExplainingFileInclude
 * )
 */
export declare const processingDiagnosticKindUnknownReference: processingDiagnosticKind;
export declare const processingDiagnosticKindExplainingFileInclude: processingDiagnosticKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/processingDiagnostic.go::type::processingDiagnostic","kind":"type","status":"implemented","sigHash":"9ca2e25a43bc15f2b26a13d2229e98245f9edf1f09d0fb02d7f78c26fab3617c","bodyHash":"fd29f10b6c9ce54aed98ed951c87237fa96035d7ed0c6672e1f03e4264406557"}
 *
 * Go source:
 * processingDiagnostic struct {
 * 	kind processingDiagnosticKind
 * 	data any
 * }
 */
export interface processingDiagnostic {
    kind: processingDiagnosticKind;
    data: unknown;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/processingDiagnostic.go::method::processingDiagnostic.asFileIncludeReason","kind":"method","status":"implemented","sigHash":"ee23d712ecfd715d8f2d817f5fcd43a251eab053edc6e47b11840a5444bdf6b7","bodyHash":"828c7f480a1e40be07d940fc4998676b26f70487e0c4ba0e8e272620a8e59562"}
 *
 * Go source:
 * func (d *processingDiagnostic) asFileIncludeReason() *FileIncludeReason {
 * 	return d.data.(*FileIncludeReason)
 * }
 */
export declare function processingDiagnostic_asFileIncludeReason(receiver: GoPtr<processingDiagnostic>): GoPtr<FileIncludeReason>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/processingDiagnostic.go::type::includeExplainingDiagnostic","kind":"type","status":"implemented","sigHash":"963e6cf6b3050764ff4c10bcc83418ecf4f03b53e9d45cd71fc03bb35991a4d2","bodyHash":"c1ca20b604daa578d5ef3c558f92efb01327a665b4462feb0b1785db8cb919d9"}
 *
 * Go source:
 * includeExplainingDiagnostic struct {
 * 	file             tspath.Path
 * 	diagnosticReason *FileIncludeReason
 * 	message          *diagnostics.Message
 * 	args             []any
 * }
 */
export interface includeExplainingDiagnostic {
    file: Path;
    diagnosticReason: GoPtr<FileIncludeReason>;
    message: GoPtr<Message>;
    args: GoSlice<unknown>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/processingDiagnostic.go::method::processingDiagnostic.asIncludeExplainingDiagnostic","kind":"method","status":"implemented","sigHash":"ba2ea0181735299bb4eb7c8a2ebfe5208facaeecedbd7168200fcdf729f01d62","bodyHash":"17852444bce5ff4851af8539ecc91caa7a5588e36a252743b25b9c2beed49ed7"}
 *
 * Go source:
 * func (d *processingDiagnostic) asIncludeExplainingDiagnostic() *includeExplainingDiagnostic {
 * 	return d.data.(*includeExplainingDiagnostic)
 * }
 */
export declare function processingDiagnostic_asIncludeExplainingDiagnostic(receiver: GoPtr<processingDiagnostic>): GoPtr<includeExplainingDiagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/processingDiagnostic.go::method::processingDiagnostic.toDiagnostic","kind":"method","status":"implemented","sigHash":"f8a7bbbf4d642e66207b5d767ec108073772a4af46c03ec462321279da892744","bodyHash":"90321122e964a36111a1d2c666440924d392eea8ca150ab4d6ab3246989a55aa"}
 *
 * Go source:
 * func (d *processingDiagnostic) toDiagnostic(program *Program) *ast.Diagnostic {
 * 	switch d.kind {
 * 	case processingDiagnosticKindUnknownReference:
 * 		ref := d.asFileIncludeReason()
 * 		loc := ref.getReferencedLocation(program)
 * 		switch ref.kind {
 * 		case fileIncludeKindTypeReferenceDirective:
 * 			return loc.diagnosticAt(diagnostics.Cannot_find_type_definition_file_for_0, loc.ref.FileName)
 * 		case fileIncludeKindLibReferenceDirective:
 * 			libName := tspath.ToFileNameLowerCase(loc.ref.FileName)
 * 			unqualifiedLibName := strings.TrimSuffix(strings.TrimPrefix(libName, "lib."), ".d.ts")
 * 			suggestion := core.GetSpellingSuggestionForStrings(unqualifiedLibName, slices.Values(tsoptions.Libs))
 * 			return loc.diagnosticAt(core.IfElse(
 * 				suggestion != "",
 * 				diagnostics.Cannot_find_lib_definition_for_0_Did_you_mean_1,
 * 				diagnostics.Cannot_find_lib_definition_for_0,
 * 			), libName, suggestion)
 * 		default:
 * 			panic("unknown include kind")
 * 		}
 * 	case processingDiagnosticKindExplainingFileInclude:
 * 		return d.createDiagnosticExplainingFile(program)
 * 	default:
 * 		panic("unknown processingDiagnosticKind")
 * 	}
 * }
 */
export declare function processingDiagnostic_toDiagnostic(receiver: GoPtr<processingDiagnostic>, program: GoPtr<Program>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/processingDiagnostic.go::method::processingDiagnostic.createDiagnosticExplainingFile","kind":"method","status":"implemented","sigHash":"3abad132f72cab5caac39e15a90a1d090228a6c2241a66bf4cbab3734e08d56b","bodyHash":"211ba4698725677f48335c75d8409431a433c5ee17f0f01d0d0558721219668c"}
 *
 * Go source:
 * func (d *processingDiagnostic) createDiagnosticExplainingFile(program *Program) *ast.Diagnostic {
 * 	diag := d.asIncludeExplainingDiagnostic()
 * 	var includeDetails []*ast.Diagnostic
 * 	var relatedInfo []*ast.Diagnostic
 * 	var redirectInfo []*ast.Diagnostic
 * 	var preferredLocation *FileIncludeReason
 * 	var seenReasons collections.Set[*FileIncludeReason]
 * 	if diag.diagnosticReason.isReferencedFile() && !program.includeProcessor.getReferenceLocation(diag.diagnosticReason, program).isSynthetic {
 * 		preferredLocation = diag.diagnosticReason
 * 	}
 *
 * 	processRelatedInfo := func(includeReason *FileIncludeReason) {
 * 		if preferredLocation == nil && includeReason.isReferencedFile() && !program.includeProcessor.getReferenceLocation(includeReason, program).isSynthetic {
 * 			preferredLocation = includeReason
 * 		} else if preferredLocation != includeReason {
 * 			info := program.includeProcessor.getRelatedInfo(includeReason, program)
 * 			if info != nil {
 * 				relatedInfo = append(relatedInfo, info)
 * 			}
 * 		}
 * 	}
 * 	processInclude := func(includeReason *FileIncludeReason) {
 * 		if !seenReasons.AddIfAbsent(includeReason) {
 * 			return
 * 		}
 * 		includeDetails = append(includeDetails, includeReason.toDiagnostic(program, false))
 * 		processRelatedInfo(includeReason)
 * 	}
 *
 * 	// !!! todo sheetal caching
 *
 * 	if diag.file != "" {
 * 		reasons := program.includeProcessor.fileIncludeReasons[diag.file]
 * 		includeDetails = make([]*ast.Diagnostic, 0, len(reasons))
 * 		for _, reason := range reasons {
 * 			processInclude(reason)
 * 		}
 * 		redirectInfo = program.includeProcessor.explainRedirectAndImpliedFormat(program, diag.file, func(fileName string) string { return fileName })
 * 	}
 * 	if diag.diagnosticReason != nil {
 * 		processInclude(diag.diagnosticReason)
 * 	}
 * 	var chain []*ast.Diagnostic
 * 	if includeDetails != nil && (preferredLocation == nil || seenReasons.Len() != 1) {
 * 		fileReason := ast.NewCompilerDiagnostic(diagnostics.The_file_is_in_the_program_because_Colon)
 * 		fileReason.SetMessageChain(includeDetails)
 * 		chain = []*ast.Diagnostic{fileReason}
 * 	}
 * 	if redirectInfo != nil {
 * 		chain = append(chain, redirectInfo...)
 * 	}
 *
 * 	var result *ast.Diagnostic
 * 	if preferredLocation != nil {
 * 		result = program.includeProcessor.getReferenceLocation(preferredLocation, program).diagnosticAt(diag.message, diag.args...)
 * 	}
 * 	if result == nil {
 * 		result = ast.NewCompilerDiagnostic(diag.message, diag.args...)
 * 	}
 * 	if chain != nil {
 * 		result.SetMessageChain(chain)
 * 	}
 * 	if relatedInfo != nil {
 * 		result.SetRelatedInfo(relatedInfo)
 * 	}
 * 	return result
 * }
 */
export declare function processingDiagnostic_createDiagnosticExplainingFile(receiver: GoPtr<processingDiagnostic>, program: GoPtr<Program>): GoPtr<Diagnostic>;
//# sourceMappingURL=processingDiagnostic.d.ts.map