import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice, GoUnresolved } from "../../../go/compat.js";
import type { SourceFile } from "../../ast/ast.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import type { Symbol } from "../../ast/symbol.js";
import type { Checker } from "../../checker/checker/state.js";
import type { Set } from "../../collections/set.js";
import type { Program } from "../../compiler/program.js";
import type { Program as Program_bea0eb45 } from "./program.js";
import type { buildInfoDiagnosticWithFileName, DiagnosticsOrBuildInfoDiagnosticsWithFileName, snapshot } from "./snapshot.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::programToSnapshot","kind":"func","status":"implemented","sigHash":"42d48a3553545dd6715fb0d453bb71be6beaed13999ae4fd186e8f33c1bcc1ed","bodyHash":"137f66a6c9d1dfc40826f77cbd0518efe9fb2d51acaeb9ffd286f6a6c5ddb4df"}
 *
 * Go source:
 * func programToSnapshot(program *compiler.Program, oldProgram *Program, hashWithText bool) *snapshot {
 * 	if oldProgram != nil && oldProgram.program == program {
 * 		return oldProgram.snapshot
 * 	}
 * 	snapshot := &snapshot{
 * 		options:      program.Options(),
 * 		hashWithText: hashWithText,
 * 		checkPending: program.Options().NoCheck.IsTrue(),
 * 	}
 * 	to := &toProgramSnapshot{
 * 		program:    program,
 * 		oldProgram: oldProgram,
 * 		snapshot:   snapshot,
 * 	}
 *
 * 	if to.snapshot.canUseIncrementalState() {
 * 		to.reuseFromOldProgram()
 * 		to.computeProgramFileChanges()
 * 		to.handleFileDelete()
 * 		to.handlePendingEmit()
 * 		to.handlePendingCheck()
 * 	}
 * 	return snapshot
 * }
 */
export declare function programToSnapshot(program: GoPtr<Program>, oldProgram: GoPtr<Program_bea0eb45>, hashWithText: bool): GoPtr<snapshot>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::type::toProgramSnapshot","kind":"type","status":"implemented","sigHash":"288bbbb1f63c00f0e50b69f03c7b7bea20799dcbbf5e6a35e1eb17506f6f6b28","bodyHash":"a94cc436f14a4d0e19bca67e3b02ed8bb4bed161c17968556e163262abc9f2a6"}
 *
 * Go source:
 * toProgramSnapshot struct {
 * 	program           *compiler.Program
 * 	oldProgram        *Program
 * 	snapshot          *snapshot
 * 	globalFileRemoved bool
 * }
 */
export interface toProgramSnapshot {
    program: GoPtr<Program>;
    oldProgram: GoPtr<Program_bea0eb45>;
    snapshot: GoPtr<snapshot>;
    globalFileRemoved: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::method::toProgramSnapshot.reuseFromOldProgram","kind":"method","status":"implemented","sigHash":"113030e4c458c05d170f5d971d5ac312aa8639bbb20f48038ac63881715390f0","bodyHash":"a4fd279d6c0a6eae384a1976ebaf532525b86eb3cf25dc27d082bbbedf5fdd2d"}
 *
 * Go source:
 * func (t *toProgramSnapshot) reuseFromOldProgram() {
 * 	if t.oldProgram != nil {
 * 		if t.snapshot.options.Composite.IsTrue() {
 * 			t.snapshot.latestChangedDtsFile = t.oldProgram.snapshot.latestChangedDtsFile
 * 		}
 * 		// Copy old snapshot's changed files set
 * 		t.oldProgram.snapshot.changedFilesSet.Range(func(key tspath.Path) bool {
 * 			t.snapshot.changedFilesSet.Add(key)
 * 			return true
 * 		})
 * 		t.oldProgram.snapshot.affectedFilesPendingEmit.Range(func(key tspath.Path, emitKind FileEmitKind) bool {
 * 			t.snapshot.affectedFilesPendingEmit.Store(key, emitKind)
 * 			return true
 * 		})
 * 		t.snapshot.buildInfoEmitPending.Store(t.oldProgram.snapshot.buildInfoEmitPending.Load())
 * 		t.snapshot.hasErrorsFromOldState = t.oldProgram.snapshot.hasErrors
 * 		t.snapshot.hasSemanticErrorsFromOldState = t.oldProgram.snapshot.hasSemanticErrors
 * 	} else {
 * 		t.snapshot.buildInfoEmitPending.Store(t.snapshot.options.IsIncremental())
 * 	}
 * }
 */
export declare function toProgramSnapshot_reuseFromOldProgram(receiver: GoPtr<toProgramSnapshot>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::method::toProgramSnapshot.computeProgramFileChanges","kind":"method","status":"implemented","sigHash":"547d11b83e588117d62b91bdaa5a9261d2838acff6f8b2c6ea47ad7e1041c8b4","bodyHash":"3e39a98df96c3bf0d6d5345b381f7bdae45601944d7b1adac027e85ed56a87af"}
 *
 * Go source:
 * func (t *toProgramSnapshot) computeProgramFileChanges() {
 * 	canCopySemanticDiagnostics := t.oldProgram != nil &&
 * 		!tsoptions.CompilerOptionsAffectSemanticDiagnostics(t.oldProgram.snapshot.options, t.program.Options())
 * 	canCopyEmitSignatures := t.snapshot.options.Composite.IsTrue() &&
 * 		t.oldProgram != nil &&
 * 		!tsoptions.CompilerOptionsAffectDeclarationPath(t.oldProgram.snapshot.options, t.program.Options())
 * 	copyDeclarationFileDiagnostics := canCopySemanticDiagnostics &&
 * 		t.snapshot.options.SkipLibCheck.IsTrue() == t.oldProgram.snapshot.options.SkipLibCheck.IsTrue()
 * 	copyLibFileDiagnostics := copyDeclarationFileDiagnostics &&
 * 		t.snapshot.options.SkipDefaultLibCheck.IsTrue() == t.oldProgram.snapshot.options.SkipDefaultLibCheck.IsTrue()
 *
 * 	files := t.program.GetSourceFiles()
 * 	wg := core.NewWorkGroup(t.program.SingleThreaded())
 * 	for _, file := range files {
 * 		wg.Queue(func() {
 * 			...
 * 		})
 * 	}
 * 	wg.RunAndWait()
 * }
 */
export declare function toProgramSnapshot_computeProgramFileChanges(receiver: GoPtr<toProgramSnapshot>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::method::toProgramSnapshot.handleFileDelete","kind":"method","status":"implemented","sigHash":"a33891585da98bc7a32fe0b71e4262f2249f98f77b543c99b271a5372014eb1d","bodyHash":"b2782d0e033757fcdabc23a52148f870bd954e8fb0f16a6da6d69d520de56e49"}
 *
 * Go source:
 * func (t *toProgramSnapshot) handleFileDelete() {
 * 	if t.oldProgram != nil {
 * 		// If the global file is removed, add all files as changed
 * 		t.oldProgram.snapshot.fileInfos.Range(func(filePath tspath.Path, oldInfo *FileInfo) bool {
 * 			if _, ok := t.snapshot.fileInfos.Load(filePath); !ok {
 * 				if oldInfo.affectsGlobalScope {
 * 					for _, file := range t.snapshot.getAllFilesExcludingDefaultLibraryFile(t.program, nil) {
 * 						t.snapshot.addFileToChangeSet(file.Path())
 * 					}
 * 					t.globalFileRemoved = true
 * 				} else {
 * 					t.snapshot.buildInfoEmitPending.Store(true)
 * 				}
 * 				return false
 * 			}
 * 			return true
 * 		})
 * 	}
 * }
 */
export declare function toProgramSnapshot_handleFileDelete(receiver: GoPtr<toProgramSnapshot>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::method::toProgramSnapshot.handlePendingEmit","kind":"method","status":"implemented","sigHash":"fac4c75795c0b826e6190218b82ecec8a1f54a70654391053e0bfbc97de3bc87","bodyHash":"fbd9f0501b9891ccb14f507c52bcf14e92f8f2d52d811377b6571d829048557e"}
 *
 * Go source:
 * func (t *toProgramSnapshot) handlePendingEmit() {
 * 	if t.oldProgram != nil && !t.globalFileRemoved {
 * 		var pendingEmitKind FileEmitKind
 * 		if tsoptions.CompilerOptionsAffectEmit(t.oldProgram.snapshot.options, t.snapshot.options) {
 * 			pendingEmitKind = GetFileEmitKind(t.snapshot.options)
 * 		} else {
 * 			pendingEmitKind = getPendingEmitKindWithOptions(t.snapshot.options, t.oldProgram.snapshot.options)
 * 		}
 * 		if pendingEmitKind != FileEmitKindNone {
 * 			for _, file := range t.program.GetSourceFiles() {
 * 				if !t.snapshot.changedFilesSet.Has(file.Path()) {
 * 					t.snapshot.addFileToAffectedFilesPendingEmit(file.Path(), pendingEmitKind)
 * 				}
 * 			}
 * 			t.snapshot.buildInfoEmitPending.Store(true)
 * 		}
 * 	}
 * }
 */
export declare function toProgramSnapshot_handlePendingEmit(receiver: GoPtr<toProgramSnapshot>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::method::toProgramSnapshot.handlePendingCheck","kind":"method","status":"implemented","sigHash":"92ded51e7ff59660cd783dda18f03bbec0704e2af72f4f1bd45209191d534c64","bodyHash":"471548ba6ad92a39eef7b0d75d3ec33f58c5aa189079cd205ff2a194993a789a"}
 *
 * Go source:
 * func (t *toProgramSnapshot) handlePendingCheck() {
 * 	if t.oldProgram != nil &&
 * 		t.snapshot.semanticDiagnosticsPerFile.Size() != len(t.program.GetSourceFiles()) &&
 * 		t.oldProgram.snapshot.checkPending != t.snapshot.checkPending {
 * 		t.snapshot.buildInfoEmitPending.Store(true)
 * 	}
 * }
 */
export declare function toProgramSnapshot_handlePendingCheck(receiver: GoPtr<toProgramSnapshot>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::fileAffectsGlobalScope","kind":"func","status":"implemented","sigHash":"d7099f3daa1f855a0ef9e921c1b115c33735addb4605fd5bee6ab16926a10cf1","bodyHash":"a4cd9e96350c74b9fb3574969f974e7e02f068e0453650dfd78a27b205ca50d6"}
 *
 * Go source:
 * func fileAffectsGlobalScope(file *ast.SourceFile) bool {
 * 	binder.BindSourceFile(file)
 * 	if core.Some(file.ModuleAugmentations, func(augmentation *ast.ModuleName) bool {
 * 		return ast.IsGlobalScopeAugmentation(augmentation.Parent)
 * 	}) {
 * 		return true
 * 	}
 *
 * 	if ast.IsExternalOrCommonJSModule(file) || ast.IsJsonSourceFile(file) {
 * 		return false
 * 	}
 *
 * 	return file.Statements != nil &&
 * 		file.Statements.Nodes != nil &&
 * 		core.Some(file.Statements.Nodes, func(stmt *ast.Node) bool {
 * 			return !ast.IsModuleWithStringLiteralName(stmt)
 * 		})
 * }
 */
export declare function fileAffectsGlobalScope(file: GoPtr<SourceFile>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::addReferencedFilesFromSymbol","kind":"func","status":"implemented","sigHash":"b578b142ee7638712995dccbc303304be01aeee734f02a53706a049d5f58b989","bodyHash":"06850ca157abfb44e93abeeefab08a789dfb54fb6e14b7ba7839790ad3651487"}
 *
 * Go source:
 * func addReferencedFilesFromSymbol(file *ast.SourceFile, referencedFiles *collections.Set[tspath.Path], symbol *ast.Symbol) {
 * 	if symbol == nil {
 * 		return
 * 	}
 * 	for _, declaration := range symbol.Declarations {
 * 		fileOfDecl := ast.GetSourceFileOfNode(declaration)
 * 		if fileOfDecl == nil {
 * 			continue
 * 		}
 * 		if file != fileOfDecl {
 * 			referencedFiles.Add(fileOfDecl.Path())
 * 		}
 * 	}
 * }
 */
export declare function addReferencedFilesFromSymbol(file: GoPtr<SourceFile>, referencedFiles: GoPtr<Set>, symbol_: GoPtr<Symbol>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::addReferencedFilesFromImportLiteral","kind":"func","status":"implemented","sigHash":"f37c52ce26686b278505e8673feaf55e9c0ce9d7d4b43cba057141eae9656b6b","bodyHash":"4e6e0efc1cd624403592b5da06c78c82d7519f8cac55b5ad6b651a437850be08"}
 *
 * Go source:
 * func addReferencedFilesFromImportLiteral(file *ast.SourceFile, referencedFiles *collections.Set[tspath.Path], checker *checker.Checker, importName *ast.LiteralLikeNode) {
 * 	symbol := checker.GetSymbolAtLocation(importName)
 * 	addReferencedFilesFromSymbol(file, referencedFiles, symbol)
 * }
 */
export declare function addReferencedFilesFromImportLiteral(file: GoPtr<SourceFile>, referencedFiles: GoPtr<Set>, checker: GoPtr<Checker>, importName: GoPtr<GoUnresolved<"github.com/microsoft/typescript-go/internal/ast.LiteralLikeNode">>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::addReferencedFileFromFileName","kind":"func","status":"implemented","sigHash":"3fa18a87f0e3e1ee9366476dd55b42fe6a19a31099ab2c7fd2dddbb025434aef","bodyHash":"ec2dfb7ed40a1f69b4cbd9ef384863ae20240776671be49d8cc8d8f7a33ea9ba"}
 *
 * Go source:
 * func addReferencedFileFromFileName(program *compiler.Program, fileName string, referencedFiles *collections.Set[tspath.Path], sourceFileDirectory string) {
 * 	if redirect := program.GetParseFileRedirect(fileName); redirect != "" {
 * 		referencedFiles.Add(tspath.ToPath(redirect, program.GetCurrentDirectory(), program.UseCaseSensitiveFileNames()))
 * 	} else {
 * 		referencedFiles.Add(tspath.ToPath(fileName, sourceFileDirectory, program.UseCaseSensitiveFileNames()))
 * 	}
 * }
 */
export declare function addReferencedFileFromFileName(program: GoPtr<Program>, fileName: string, referencedFiles: GoPtr<Set>, sourceFileDirectory: string): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::getReferencedFiles","kind":"func","status":"implemented","sigHash":"8f2904079e386cc4aa59351103743658ebc7ae059ff6c50186d019bafc05fce8","bodyHash":"23128532f8557b5957387793aab836ab11ed2c6c0051df806ad0259f7f01c01d"}
 *
 * Go source:
 * func getReferencedFiles(program *compiler.Program, file *ast.SourceFile) *collections.Set[tspath.Path] {
 * 	referencedFiles := collections.Set[tspath.Path]{}
 * 	checker, done := program.GetTypeCheckerForFileExclusive(context.TODO(), file)
 * 	defer done()
 * 	for _, importName := range file.Imports() {
 * 		addReferencedFilesFromImportLiteral(file, &referencedFiles, checker, importName)
 * 	}
 * 	sourceFileDirectory := tspath.GetDirectoryPath(file.FileName())
 * 	for _, referencedFile := range file.ReferencedFiles {
 * 		addReferencedFileFromFileName(program, referencedFile.FileName, &referencedFiles, sourceFileDirectory)
 * 	}
 * 	if typeRefsInFile, ok := program.GetResolvedTypeReferenceDirectives()[file.Path()]; ok {
 * 		for _, typeRef := range typeRefsInFile {
 * 			if typeRef.ResolvedFileName != "" {
 * 				addReferencedFileFromFileName(program, typeRef.ResolvedFileName, &referencedFiles, sourceFileDirectory)
 * 			}
 * 		}
 * 	}
 * 	for _, moduleName := range file.ModuleAugmentations {
 * 		if !ast.IsStringLiteral(moduleName) {
 * 			continue
 * 		}
 * 		addReferencedFilesFromImportLiteral(file, &referencedFiles, checker, moduleName)
 * 	}
 * 	for _, ambientModule := range checker.GetAmbientModules() {
 * 		addReferencedFilesFromSymbol(file, &referencedFiles, ambientModule)
 * 	}
 * 	return core.IfElse(referencedFiles.Len() > 0, &referencedFiles, nil)
 * }
 */
export declare function getReferencedFiles(program: GoPtr<Program>, file: GoPtr<SourceFile>): GoPtr<Set>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::repopulateDiagnosticsOfFile","kind":"func","status":"implemented","sigHash":"d5067aeb7564e9073f42fef03766e9f8ca9caafeecfd1abce3de0d555b1e2af4","bodyHash":"e75b134e84ec04396e5e888615666d8c6ba90b39fecfbaa3fba2d7e140f077b1"}
 *
 * Go source:
 * func repopulateDiagnosticsOfFile(diags *DiagnosticsOrBuildInfoDiagnosticsWithFileName, p *compiler.Program, file *ast.SourceFile) *DiagnosticsOrBuildInfoDiagnosticsWithFileName {
 * 	if diags.diagnostics != nil {
 * 		repopulated := repopulateDiagnosticsList(diags.diagnostics, p, file)
 * 		if repopulated == nil {
 * 			return diags
 * 		}
 * 		return &DiagnosticsOrBuildInfoDiagnosticsWithFileName{diagnostics: repopulated}
 * 	}
 * 	// buildInfoDiagnostics will be repopulated via toDiagnostic's repopulateInfo handling
 * 	return diags
 * }
 */
export declare function repopulateDiagnosticsOfFile(diags: GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName>, p: GoPtr<Program>, file: GoPtr<SourceFile>): GoPtr<DiagnosticsOrBuildInfoDiagnosticsWithFileName>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::repopulateDiagnosticsList","kind":"func","status":"implemented","sigHash":"99be7eb5fce8ead6933f781a010e4798280327a1c220a737374fa538c06cb91d","bodyHash":"a026bca71a69c25b7f1b8c11508baed25078795f4b01652a0bb622fd5fd1d7be"}
 *
 * Go source:
 * func repopulateDiagnosticsList(diags []*ast.Diagnostic, p *compiler.Program, file *ast.SourceFile) []*ast.Diagnostic {
 * 	changed := false
 * 	result := make([]*ast.Diagnostic, len(diags))
 * 	for i, d := range diags {
 * 		repopulated := repopulateDiagnosticMessageChain(d.MessageChain(), p, file)
 * 		if repopulated != nil {
 * 			clone := d.Clone()
 * 			clone.SetMessageChain(repopulated)
 * 			result[i] = clone
 * 			changed = true
 * 		} else {
 * 			result[i] = d
 * 		}
 * 	}
 * 	if !changed {
 * 		return nil
 * 	}
 * 	return result
 * }
 */
export declare function repopulateDiagnosticsList(diags: GoSlice<GoPtr<Diagnostic>>, p: GoPtr<Program>, file: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::repopulateDiagnosticMessageChain","kind":"func","status":"implemented","sigHash":"e1527c7a51b0ee2981df52918566e2fc419facbfbab3ad7960203a6cf45a001a","bodyHash":"063591cd51a507f2e92cb5d78a11a6fb01e64b78133aa29713632e3723a14497"}
 *
 * Go source:
 * func repopulateDiagnosticMessageChain(chain []*ast.Diagnostic, p *compiler.Program, file *ast.SourceFile) []*ast.Diagnostic {
 * 	if len(chain) == 0 {
 * 		return nil
 * 	}
 * 	changed := false
 * 	result := make([]*ast.Diagnostic, len(chain))
 * 	for i, c := range chain {
 * 		if c.RepopulateInfo() != nil {
 * 			b := &buildInfoDiagnosticWithFileName{...}
 * 			...
 * 			result[i] = repopulateDiagnosticChain(b, p, file)
 * 			changed = true
 * 		} else {
 * 			nested := repopulateDiagnosticMessageChain(c.MessageChain(), p, file)
 * 			if nested != nil {
 * 				clone := c.Clone()
 * 				clone.SetMessageChain(nested)
 * 				result[i] = clone
 * 				changed = true
 * 			} else {
 * 				result[i] = c
 * 			}
 * 		}
 * 	}
 * 	if !changed {
 * 		return nil
 * 	}
 * 	return result
 * }
 */
export declare function repopulateDiagnosticMessageChain(chain: GoSlice<GoPtr<Diagnostic>>, p: GoPtr<Program>, file: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/programtosnapshot.go::func::astDiagToBuildInfoDiag","kind":"func","status":"implemented","sigHash":"448a5f4058d6847dc53451f22e44f083389ef22024487c1372e7941ed556e50a","bodyHash":"d64bf6dbe38c137d35a672f37ada677662e9567b0f10f0c618f233ede429ac3e"}
 *
 * Go source:
 * func astDiagToBuildInfoDiag(d *ast.Diagnostic) *buildInfoDiagnosticWithFileName {
 * 	b := &buildInfoDiagnosticWithFileName{...}
 * 	for _, nested := range d.MessageChain() {
 * 		b.messageChain = append(b.messageChain, astDiagToBuildInfoDiag(nested))
 * 	}
 * 	return b
 * }
 */
export declare function astDiagToBuildInfoDiag(d: GoPtr<Diagnostic>): GoPtr<buildInfoDiagnosticWithFileName>;
//# sourceMappingURL=programtosnapshot.d.ts.map