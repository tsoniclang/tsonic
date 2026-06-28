import type { bool } from "../../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import type { Context } from "../../../go/context.js";
import { Mutex, Once } from "../../../go/sync.js";
import type { Bool as AtomicBool } from "../../../go/sync/atomic.js";
import type { SourceFile } from "../../ast/ast.js";
import type { SyncMap } from "../../collections/syncmap.js";
import type { SyncSet } from "../../collections/syncset.js";
import type { Path } from "../../tspath/path.js";
import type { Program, SignatureUpdateKind } from "./program.js";
import type { FileEmitKind } from "./snapshot.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::type::dtsMayChange","kind":"type","status":"implemented","sigHash":"161a83db43532f7d6c3498aef7567079f27b3d88380b01283197b3f6270c1465","bodyHash":"f687f6a1dbb7e16ef44dcc273af4b914bcfd2ce0fb20ddb880d9ec40e20ca30f"}
 *
 * Go source:
 * dtsMayChange map[tspath.Path]FileEmitKind
 */
export type dtsMayChange = GoMap<Path, FileEmitKind>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::dtsMayChange.addFileToAffectedFilesPendingEmit","kind":"method","status":"implemented","sigHash":"3393389a6d76c22f5ef2391904b34a5d766ea6c80f05a565c681787e5fa5b97f","bodyHash":"6dfa4b78a33764a0029c279b715dc4f4b608baaf1978109a1f8d479b68780e57"}
 *
 * Go source:
 * func (c dtsMayChange) addFileToAffectedFilesPendingEmit(filePath tspath.Path, emitKind FileEmitKind) {
 * 	c[filePath] = emitKind
 * }
 */
export declare function dtsMayChange_addFileToAffectedFilesPendingEmit(receiver: dtsMayChange, filePath: Path, emitKind: FileEmitKind): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::type::updatedSignature","kind":"type","status":"implemented","sigHash":"5d9dd1705a97a588213f44611880b83735dbe0fea78525cf843869b5195b25c5","bodyHash":"d87702b650739f69847e8c24ebbdc85732143490b212a73924a6c58d5b75d424"}
 *
 * Go source:
 * updatedSignature struct {
 * 	mu        sync.Mutex
 * 	signature string
 * 	kind      SignatureUpdateKind
 * }
 */
export interface updatedSignature {
    mu: Mutex;
    signature: string;
    kind: SignatureUpdateKind;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::type::affectedFilesHandler","kind":"type","status":"implemented","sigHash":"4be39f50583d43bff718a0a5d34c122692a7799c97890e3fcdaad96aab5a63d0","bodyHash":"e64aeb2963fa8f97b2c4d77547821721ca1cae8771e41515d2ecaea950d1e24c"}
 *
 * Go source:
 * affectedFilesHandler struct {
 * 	ctx                                    context.Context
 * 	program                                *Program
 * 	hasAllFilesExcludingDefaultLibraryFile atomic.Bool
 * 	updatedSignatures                      collections.SyncMap[tspath.Path, *updatedSignature]
 * 	dtsMayChange                           []dtsMayChange
 * 	filesToRemoveDiagnostics               collections.SyncSet[tspath.Path]
 * 	cleanedDiagnosticsOfLibFiles           sync.Once
 * 	seenFileAndReferences                  collections.SyncMap[tspath.Path, bool]
 * }
 */
export interface affectedFilesHandler {
    ctx: Context;
    program: GoPtr<Program>;
    hasAllFilesExcludingDefaultLibraryFile: AtomicBool;
    updatedSignatures: SyncMap<Path, GoPtr<updatedSignature>>;
    dtsMayChange: GoSlice<dtsMayChange>;
    filesToRemoveDiagnostics: SyncSet<Path>;
    cleanedDiagnosticsOfLibFiles: Once;
    seenFileAndReferences: SyncMap<Path, bool>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.getDtsMayChange","kind":"method","status":"implemented","sigHash":"d835a53fa87c78ee1ebeccb9347073eeaa237e14601a9d9ec46a76084687b5be","bodyHash":"7d280776ac75013b9bebaacb20d3d9e1ae85460ae78f2af5d929a6c4682c1b30"}
 *
 * Go source:
 * func (h *affectedFilesHandler) getDtsMayChange(affectedFilePath tspath.Path, affectedFileEmitKind FileEmitKind) dtsMayChange {
 * 	result := dtsMayChange(map[tspath.Path]FileEmitKind{affectedFilePath: affectedFileEmitKind})
 * 	h.dtsMayChange = append(h.dtsMayChange, result)
 * 	return result
 * }
 */
export declare function affectedFilesHandler_getDtsMayChange(receiver: GoPtr<affectedFilesHandler>, affectedFilePath: Path, affectedFileEmitKind: FileEmitKind): dtsMayChange;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.isChangedSignature","kind":"method","status":"implemented","sigHash":"4564fef6d5fb9de9b63d08a2fadb3eca3ba493c556b82ca956b747b99ebbfeb3","bodyHash":"21cf6b7180feedb2390dd6f450fdf940e1da998510296862fcd6afdddb7a3926"}
 *
 * Go source:
 * func (h *affectedFilesHandler) isChangedSignature(path tspath.Path) bool {
 * 	newSignature, _ := h.updatedSignatures.Load(path)
 * 	oldInfo, _ := h.program.snapshot.fileInfos.Load(path)
 * 	return newSignature.signature != oldInfo.signature
 * }
 */
export declare function affectedFilesHandler_isChangedSignature(receiver: GoPtr<affectedFilesHandler>, path: Path): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.removeSemanticDiagnosticsOf","kind":"method","status":"implemented","sigHash":"0a1e9519798812a989e36b9b6328ddfc0aafde758494f9c9cc670b544d51fd33","bodyHash":"318381405326e0156613fc94b0af0cca3eb8a5dd9760f554a97f952d698a1c8a"}
 *
 * Go source:
 * func (h *affectedFilesHandler) removeSemanticDiagnosticsOf(path tspath.Path) {
 * 	h.filesToRemoveDiagnostics.Add(path)
 * }
 */
export declare function affectedFilesHandler_removeSemanticDiagnosticsOf(receiver: GoPtr<affectedFilesHandler>, path: Path): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.removeDiagnosticsOfLibraryFiles","kind":"method","status":"implemented","sigHash":"3c97f238cbae0e190e5870c4eaf52516ba2abbacfc02bf5ea37c5b9e0fe92d50","bodyHash":"1529dee63377190eb19c06ea5aa640c548093f5bb75cdf6b95ca09f17cf40a23"}
 *
 * Go source:
 * func (h *affectedFilesHandler) removeDiagnosticsOfLibraryFiles() {
 * 	h.cleanedDiagnosticsOfLibFiles.Do(func() {
 * 		for _, file := range h.program.GetSourceFiles() {
 * 			if h.program.program.IsSourceFileDefaultLibrary(file.Path()) && !h.program.program.SkipTypeChecking(file, true) {
 * 				h.removeSemanticDiagnosticsOf(file.Path())
 * 			}
 * 		}
 * 	})
 * }
 */
export declare function affectedFilesHandler_removeDiagnosticsOfLibraryFiles(receiver: GoPtr<affectedFilesHandler>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.computeDtsSignature","kind":"method","status":"implemented","sigHash":"271a4ef527f323ca43afe123eaca3814a900255dcebf44e1ccf22db26c5f1d20","bodyHash":"494b355ac096b56c8ea31064845f956f158069cb6937cfd0fb2dfbcf204a9ce3"}
 *
 * Go source:
 * func (h *affectedFilesHandler) computeDtsSignature(file *ast.SourceFile) string {
 * 	var signature string
 * 	h.program.program.Emit(h.ctx, compiler.EmitOptions{
 * 		TargetSourceFile: file,
 * 		EmitOnly:         compiler.EmitOnlyForcedDts,
 * 		WriteFile: func(fileName string, text string, data *compiler.WriteFileData) error {
 * 			if !tspath.IsDeclarationFileName(fileName) {
 * 				panic("File extension for signature expected to be dts, got : " + fileName)
 * 			}
 * 			signature = h.program.snapshot.computeSignatureWithDiagnostics(file, text, data)
 * 			return nil
 * 		},
 * 	})
 * 	return signature
 * }
 */
export declare function affectedFilesHandler_computeDtsSignature(receiver: GoPtr<affectedFilesHandler>, file: GoPtr<SourceFile>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.updateShapeSignature","kind":"method","status":"implemented","sigHash":"538f3579da29c0b11c175eaac9f241e78072f3416c8ac0f7267c9a38dea9de39","bodyHash":"4e973d4b66a6741b6af66919878f23be8c53ed86040c8098fc6beba69e8d9179"}
 *
 * Go source:
 * func (h *affectedFilesHandler) updateShapeSignature(file *ast.SourceFile, useFileVersionAsSignature bool) bool {
 * 	update := &updatedSignature{}
 * 	update.mu.Lock()
 * 	defer update.mu.Unlock()
 * 	if existing, ok := h.updatedSignatures.LoadOrStore(file.Path(), update); ok {
 * 		existing.mu.Lock()
 * 		defer existing.mu.Unlock()
 * 		return false
 * 	}
 *
 * 	info, _ := h.program.snapshot.fileInfos.Load(file.Path())
 * 	prevSignature := info.signature
 * 	if !file.IsDeclarationFile && !useFileVersionAsSignature {
 * 		update.signature = h.computeDtsSignature(file)
 * 	}
 * 	if update.signature == "" {
 * 		update.signature = info.version
 * 		update.kind = SignatureUpdateKindUsedVersion
 * 	}
 * 	return update.signature != prevSignature
 * }
 */
export declare function affectedFilesHandler_updateShapeSignature(receiver: GoPtr<affectedFilesHandler>, file: GoPtr<SourceFile>, useFileVersionAsSignature: bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.getFilesAffectedBy","kind":"method","status":"implemented","sigHash":"63550bf101d9f5bd623f821ada8a72c7b04277d056c6c0be1f582c23b8f95431","bodyHash":"cfe51ec4211f2cec1da72f64de9ac262b8bd5cbbf128b0bafc4a9f95d812f58f"}
 *
 * Go source:
 * func (h *affectedFilesHandler) getFilesAffectedBy(path tspath.Path) []*ast.SourceFile {
 * 	file := h.program.program.GetSourceFileByPath(path)
 * 	if file == nil {
 * 		return nil
 * 	}
 *
 * 	if !h.updateShapeSignature(file, false) {
 * 		return []*ast.SourceFile{file}
 * 	}
 *
 * 	if info, _ := h.program.snapshot.fileInfos.Load(file.Path()); info.affectsGlobalScope {
 * 		h.hasAllFilesExcludingDefaultLibraryFile.Store(true)
 * 		h.program.snapshot.getAllFilesExcludingDefaultLibraryFile(h.program.program, file)
 * 	}
 *
 * 	if h.program.snapshot.options.IsolatedModules.IsTrue() {
 * 		return []*ast.SourceFile{file}
 * 	}
 *
 * 	seenFileNamesMap := h.forEachFileReferencedBy(
 * 		file,
 * 		func(currentFile *ast.SourceFile, currentPath tspath.Path) (queueForFile bool, fastReturn bool) {
 * 			if currentFile != nil && h.updateShapeSignature(currentFile, false) {
 * 				return true, false
 * 			}
 * 			return false, false
 * 		},
 * 	)
 * 	return core.Filter(slices.Collect(maps.Values(seenFileNamesMap)), func(file *ast.SourceFile) bool {
 * 		return file != nil
 * 	})
 * }
 */
export declare function affectedFilesHandler_getFilesAffectedBy(receiver: GoPtr<affectedFilesHandler>, path: Path): GoSlice<GoPtr<SourceFile>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.forEachFileReferencedBy","kind":"method","status":"implemented","sigHash":"af4ac7216943a39b59e9e8c6a57bbe66a008f5109c2004fc7f37d0bb55dc7e8e","bodyHash":"e2700b17e9d91141a1549c34d2d48de38a1fffdae7be903747ef36b446292c5d"}
 *
 * Go source:
 * func (h *affectedFilesHandler) forEachFileReferencedBy(file *ast.SourceFile, fn func(currentFile *ast.SourceFile, currentPath tspath.Path) (queueForFile bool, fastReturn bool)) map[tspath.Path]*ast.SourceFile {
 * 	seenFileNamesMap := map[tspath.Path]*ast.SourceFile{}
 * 	seenFileNamesMap[file.Path()] = file
 * 	queue := slices.Collect(h.program.snapshot.referencedMap.getReferencedBy(file.Path()))
 * 	for len(queue) > 0 {
 * 		currentPath := queue[len(queue)-1]
 * 		queue = queue[:len(queue)-1]
 * 		if _, ok := seenFileNamesMap[currentPath]; !ok {
 * 			currentFile := h.program.program.GetSourceFileByPath(currentPath)
 * 			seenFileNamesMap[currentPath] = currentFile
 * 			queueForFile, fastReturn := fn(currentFile, currentPath)
 * 			if fastReturn {
 * 				return seenFileNamesMap
 * 			}
 * 			if queueForFile {
 * 				for ref := range h.program.snapshot.referencedMap.getReferencedBy(currentFile.Path()) {
 * 					queue = append(queue, ref)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return seenFileNamesMap
 * }
 */
export declare function affectedFilesHandler_forEachFileReferencedBy(receiver: GoPtr<affectedFilesHandler>, file: GoPtr<SourceFile>, fn: (currentFile: GoPtr<SourceFile>, currentPath: Path) => [bool, bool]): GoMap<Path, GoPtr<SourceFile>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.handleDtsMayChangeOfAffectedFile","kind":"method","status":"implemented","sigHash":"a5c0e8df65875fc9df4b7b89abfc1b81628a2baafeecdbf120e79761625ea059","bodyHash":"83361289b5d5a1794c003fa4cae94fee55a497ac4b5b5035b3fb743ddf699fbf"}
 *
 * Go source:
 * func (h *affectedFilesHandler) handleDtsMayChangeOfAffectedFile(dtsMayChange dtsMayChange, affectedFile *ast.SourceFile) {
 * 	h.removeSemanticDiagnosticsOf(affectedFile.Path())
 *
 * 	if h.hasAllFilesExcludingDefaultLibraryFile.Load() {
 * 		h.removeDiagnosticsOfLibraryFiles()
 * 		h.updateShapeSignature(affectedFile, false)
 * 		return
 * 	}
 *
 * 	if h.program.snapshot.options.AssumeChangesOnlyAffectDirectDependencies.IsTrue() {
 * 		return
 * 	}
 *
 * 	if !h.program.snapshot.changedFilesSet.Has(affectedFile.Path()) ||
 * 		!h.isChangedSignature(affectedFile.Path()) {
 * 		return
 * 	}
 *
 * 	if h.program.snapshot.options.IsolatedModules.IsTrue() {
 * 		h.forEachFileReferencedBy(
 * 			affectedFile,
 * 			func(currentFile *ast.SourceFile, currentPath tspath.Path) (queueForFile bool, fastReturn bool) {
 * 				if h.handleDtsMayChangeOfGlobalScope(dtsMayChange, currentPath, false) {
 * 					return false, true
 * 				}
 * 				h.handleDtsMayChangeOf(dtsMayChange, currentPath, false)
 * 				if h.isChangedSignature(currentPath) {
 * 					return true, false
 * 				}
 * 				return false, false
 * 			},
 * 		)
 * 	}
 *
 * 	invalidateJsFiles := false
 * 	var typeChecker *checker.Checker
 * 	var done func()
 * 	if affectedFile.Symbol != nil {
 * 		for _, exported := range affectedFile.Symbol.Exports {
 * 			if exported.Flags&ast.SymbolFlagsConstEnum != 0 {
 * 				invalidateJsFiles = true
 * 				break
 * 			}
 * 			if typeChecker == nil {
 * 				typeChecker, done = h.program.program.GetTypeCheckerForFileExclusive(h.ctx, affectedFile)
 * 			}
 * 			aliased := checker.SkipAlias(exported, typeChecker)
 * 			if aliased == exported {
 * 				continue
 * 			}
 * 			if (aliased.Flags & ast.SymbolFlagsConstEnum) != 0 {
 * 				if slices.ContainsFunc(aliased.Declarations, func(d *ast.Node) bool {
 * 					return ast.GetSourceFileOfNode(d) == affectedFile
 * 				}) {
 * 					invalidateJsFiles = true
 * 					break
 * 				}
 * 			}
 * 		}
 * 	}
 * 	if done != nil {
 * 		done()
 * 	}
 *
 * 	for fileReferencingChangedFile := range h.program.snapshot.referencedMap.getReferencedBy(affectedFile.Path()) {
 * 		if h.handleDtsMayChangeOfGlobalScope(dtsMayChange, fileReferencingChangedFile, invalidateJsFiles) {
 * 			return
 * 		}
 * 		for fileReferencingAffectedFile := range h.program.snapshot.referencedMap.getReferencedBy(fileReferencingChangedFile) {
 * 			if h.handleDtsMayChangeOfFileAndReferences(dtsMayChange, fileReferencingAffectedFile, invalidateJsFiles) {
 * 				return
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function affectedFilesHandler_handleDtsMayChangeOfAffectedFile(receiver: GoPtr<affectedFilesHandler>, dtsMayChange: dtsMayChange, affectedFile: GoPtr<SourceFile>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.handleDtsMayChangeOfFileAndReferences","kind":"method","status":"implemented","sigHash":"05426c7cae7863d90d89d13c766af77c24fc5da5ce4eec4e3954d6e52588ccf2","bodyHash":"93d16f0c9cbef91987abf3e00abda416c800f4c7328774c4043e57b32cdb6773"}
 *
 * Go source:
 * func (h *affectedFilesHandler) handleDtsMayChangeOfFileAndReferences(dtsMayChange dtsMayChange, filePath tspath.Path, invalidateJsFiles bool) bool {
 * 	if existing, loaded := h.seenFileAndReferences.LoadOrStore(filePath, invalidateJsFiles); loaded && (existing || !invalidateJsFiles) {
 * 		return false
 * 	} else if loaded && invalidateJsFiles {
 * 		h.seenFileAndReferences.Store(filePath, true)
 * 	}
 *
 * 	if h.handleDtsMayChangeOfGlobalScope(dtsMayChange, filePath, invalidateJsFiles) {
 * 		return true
 * 	}
 * 	h.handleDtsMayChangeOf(dtsMayChange, filePath, invalidateJsFiles)
 *
 * 	for referencingFilePath := range h.program.snapshot.referencedMap.getReferencedBy(filePath) {
 * 		if h.handleDtsMayChangeOfFileAndReferences(dtsMayChange, referencingFilePath, invalidateJsFiles) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function affectedFilesHandler_handleDtsMayChangeOfFileAndReferences(receiver: GoPtr<affectedFilesHandler>, dtsMayChange: dtsMayChange, filePath: Path, invalidateJsFiles: bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.handleDtsMayChangeOfGlobalScope","kind":"method","status":"implemented","sigHash":"32845cbb1b64f3d05801f2f34eac3d658d2207fd06280317517db727cbe5eabd","bodyHash":"dce8722b5f32bfebbd472f38560782dbaacd41bf76338c789abd032c22c13cb2"}
 *
 * Go source:
 * func (h *affectedFilesHandler) handleDtsMayChangeOfGlobalScope(dtsMayChange dtsMayChange, filePath tspath.Path, invalidateJsFiles bool) bool {
 * 	if info, ok := h.program.snapshot.fileInfos.Load(filePath); !ok || !info.affectsGlobalScope {
 * 		return false
 * 	}
 * 	for _, file := range h.program.snapshot.getAllFilesExcludingDefaultLibraryFile(h.program.program, nil) {
 * 		h.handleDtsMayChangeOf(dtsMayChange, file.Path(), invalidateJsFiles)
 * 	}
 * 	h.removeDiagnosticsOfLibraryFiles()
 * 	return true
 * }
 */
export declare function affectedFilesHandler_handleDtsMayChangeOfGlobalScope(receiver: GoPtr<affectedFilesHandler>, dtsMayChange: dtsMayChange, filePath: Path, invalidateJsFiles: bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.handleDtsMayChangeOf","kind":"method","status":"implemented","sigHash":"05651f99a079f94f485234aed5ec7b1f4c8ef05b64bdb62eba5220ffba6e27b6","bodyHash":"8869d6284b49133634e117d17f5483b0b437338a5d7b180283c85be98bad1999"}
 *
 * Go source:
 * func (h *affectedFilesHandler) handleDtsMayChangeOf(dtsMayChange dtsMayChange, path tspath.Path, invalidateJsFiles bool) {
 * 	if h.program.snapshot.changedFilesSet.Has(path) {
 * 		return
 * 	}
 * 	file := h.program.program.GetSourceFileByPath(path)
 * 	if file == nil {
 * 		return
 * 	}
 * 	h.removeSemanticDiagnosticsOf(path)
 * 	h.updateShapeSignature(file, true)
 * 	if invalidateJsFiles {
 * 		dtsMayChange.addFileToAffectedFilesPendingEmit(path, GetFileEmitKind(h.program.snapshot.options))
 * 	} else if h.program.snapshot.options.GetEmitDeclarations() {
 * 		dtsMayChange.addFileToAffectedFilesPendingEmit(path, core.IfElse(h.program.snapshot.options.DeclarationMap.IsTrue(), FileEmitKindAllDts, FileEmitKindDts))
 * 	}
 * }
 */
export declare function affectedFilesHandler_handleDtsMayChangeOf(receiver: GoPtr<affectedFilesHandler>, dtsMayChange: dtsMayChange, path: Path, invalidateJsFiles: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::method::affectedFilesHandler.updateSnapshot","kind":"method","status":"implemented","sigHash":"01be83442012fb2e3a0e61a76f0e83d903ce5501c119fb43ff7b4fed99ed0604","bodyHash":"d9c07bbfe0ef2aaa79db2b17f0528d9f5755d63d20c5e9516b104697bb8a59ba"}
 *
 * Go source:
 * func (h *affectedFilesHandler) updateSnapshot() {
 * 	if h.ctx.Err() != nil {
 * 		return
 * 	}
 * 	h.updatedSignatures.Range(func(filePath tspath.Path, update *updatedSignature) bool {
 * 		if info, ok := h.program.snapshot.fileInfos.Load(filePath); ok {
 * 			info.signature = update.signature
 * 			if h.program.testingData != nil {
 * 				h.program.testingData.UpdatedSignatureKinds[filePath] = update.kind
 * 			}
 * 		}
 * 		return true
 * 	})
 * 	h.filesToRemoveDiagnostics.Range(func(file tspath.Path) bool {
 * 		h.program.snapshot.semanticDiagnosticsPerFile.Delete(file)
 * 		return true
 * 	})
 * 	for _, change := range h.dtsMayChange {
 * 		for filePath, emitKind := range change {
 * 			h.program.snapshot.addFileToAffectedFilesPendingEmit(filePath, emitKind)
 * 		}
 * 	}
 * 	h.program.snapshot.changedFilesSet = collections.SyncSet[tspath.Path]{}
 * 	h.program.snapshot.buildInfoEmitPending.Store(true)
 * }
 */
export declare function affectedFilesHandler_updateSnapshot(receiver: GoPtr<affectedFilesHandler>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/affectedfileshandler.go::func::collectAllAffectedFiles","kind":"func","status":"implemented","sigHash":"dd3355e58c8cb4813bf452aba0d3fb52a3b39e3d6b8b2b7a2850093517b6833f","bodyHash":"f2f0a32ab60b4df94a683b381bc79effe737933ebbfdb99af23cd5af19fa9755"}
 *
 * Go source:
 * func collectAllAffectedFiles(ctx context.Context, program *Program) {
 * 	if program.snapshot.changedFilesSet.Size() == 0 {
 * 		return
 * 	}
 *
 * 	handler := affectedFilesHandler{ctx: ctx, program: program}
 * 	wg := core.NewWorkGroup(handler.program.program.SingleThreaded())
 * 	var result collections.SyncSet[*ast.SourceFile]
 * 	program.snapshot.changedFilesSet.Range(func(file tspath.Path) bool {
 * 		wg.Queue(func() {
 * 			for _, affectedFile := range handler.getFilesAffectedBy(file) {
 * 				result.Add(affectedFile)
 * 			}
 * 		})
 * 		return true
 * 	})
 * 	wg.RunAndWait()
 *
 * 	if ctx.Err() != nil {
 * 		return
 * 	}
 *
 * 	wg = core.NewWorkGroup(program.program.SingleThreaded())
 * 	emitKind := GetFileEmitKind(program.snapshot.options)
 * 	result.Range(func(file *ast.SourceFile) bool {
 * 		dtsMayChange := handler.getDtsMayChange(file.Path(), emitKind)
 * 		wg.Queue(func() {
 * 			handler.handleDtsMayChangeOfAffectedFile(dtsMayChange, file)
 * 		})
 * 		return true
 * 	})
 * 	wg.RunAndWait()
 *
 * 	handler.updateSnapshot()
 * }
 */
export declare function collectAllAffectedFiles(ctx: Context, program: GoPtr<Program>): void;
//# sourceMappingURL=affectedfileshandler.d.ts.map